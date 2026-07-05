import { DynamoDBDocumentClient, UpdateCommand, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { EventType, PostEventRequest, PostEventResponse, StoredEvent } from "./types.js";

const pad = (n: number) => `EVT#${String(n).padStart(12, "0")}`;
// Upper sentinel for the event-key range: lexicographically greater than any
// "EVT#<12 digits>" key but below the room META item ("META"), so a range query can
// exclude META via the KeyConditionExpression. DynamoDB forbids primary/index key
// attributes (like SK) in a FilterExpression, so range-bounding is the correct approach.
const EVT_MAX_SK = `EVT#${"9".repeat(12)}`;
const ttlFrom = (iso: string, secs: number) => Math.floor(new Date(iso).getTime() / 1000) + secs;

export function makeRepo(client: DynamoDBDocumentClient, table: string) {
  return {
    async createRoom(roomId: string, now: string, maxLifeSecs: number, accessHash: string) {
      await client.send(new PutCommand({ TableName: table, Item: {
        PK: `ROOM#${roomId}`, SK: "META", status: "open",
        createdAt: now, lastActivityAt: now, maxLifeAt: ttlFrom(now, maxLifeSecs),
        seqCounter: 0, ttl: ttlFrom(now, maxLifeSecs + 3600), accessHash,
      }, ConditionExpression: "attribute_not_exists(PK)" }));
    },
    async getRoomAccessHash(roomId: string): Promise<string | null> {
      const out = await client.send(new GetCommand({
        TableName: table, Key: { PK: `ROOM#${roomId}`, SK: "META" },
        ProjectionExpression: "accessHash",
      }));
      return (out.Item?.accessHash as string) ?? null;
    },
    // Like getRoomAccessHash but also returns the room's lifecycle status ("open"/"closed"),
    // so readers can tell a dead room from a live one. `status` is a DynamoDB reserved word,
    // hence the #s alias. Returns null when the room record is absent.
    async getRoomMeta(roomId: string): Promise<{ accessHash: string; status: string } | null> {
      const out = await client.send(new GetCommand({
        TableName: table, Key: { PK: `ROOM#${roomId}`, SK: "META" },
        ProjectionExpression: "accessHash, #s",
        ExpressionAttributeNames: { "#s": "status" },
      }));
      if (!out.Item?.accessHash) return null;
      return { accessHash: out.Item.accessHash as string, status: (out.Item.status as string) ?? "open" };
    },
    async appendEvent(roomId: string, e: PostEventRequest, now: string): Promise<PostEventResponse> {
      const upd = await client.send(new UpdateCommand({
        TableName: table, Key: { PK: `ROOM#${roomId}`, SK: "META" },
        UpdateExpression: "ADD seqCounter :one SET lastActivityAt = :now",
        ConditionExpression: "attribute_exists(PK) AND #s = :open",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":one": 1, ":now": now, ":open": "open" },
        ReturnValues: "UPDATED_NEW",
      }));
      const seq = (upd.Attributes as { seqCounter: number }).seqCounter;
      await client.send(new PutCommand({ TableName: table, Item: {
        PK: `ROOM#${roomId}`, SK: pad(seq), author: e.author, ts: now,
        type: e.type, payload: e.payload, ttl: ttlFrom(now, 90000),
      }}));
      return { seq, ts: now };
    },
    async getEventsSince(roomId: string, cursor: number): Promise<StoredEvent[]> {
      const out = await client.send(new QueryCommand({
        TableName: table,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :lo AND :hi",
        ExpressionAttributeValues: { ":pk": `ROOM#${roomId}`, ":lo": pad(cursor + 1), ":hi": EVT_MAX_SK },
        // Strongly consistent: a collaborator polling for new events must reliably see an
        // event another participant just posted (an eventually-consistent read can miss a
        // just-written item). Supported here because this is a base-table (not GSI) query.
        ConsistentRead: true,
      }));
      type EventRow = { SK: string; author: string; ts: string; type: EventType; payload: string };
      return (out.Items ?? [] as EventRow[]).map((i) => ({
        seq: Number(i.SK.slice(4)), author: i.author, ts: i.ts, type: i.type, payload: i.payload,
      }));
    },
    async closeRoom(roomId: string) {
      await client.send(new UpdateCommand({
        TableName: table, Key: { PK: `ROOM#${roomId}`, SK: "META" },
        UpdateExpression: "SET #s = :closed", ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":closed": "closed" },
      }));
    },
    async listExpiredRooms(nowEpoch: number, idleSecs: number): Promise<string[]> {
      const idleThresholdIso = new Date((nowEpoch - idleSecs) * 1000).toISOString();
      type RoomMetaRow = { PK: string; lastActivityAt: string; maxLifeAt: number };
      // Query open rooms by the byStatus GSI partition key only, then test idle / max-life
      // in code. lastActivityAt is the GSI sort key, so it cannot appear in a
      // FilterExpression (DynamoDB rejects key attributes there); at this scale the
      // open-room set is tiny, so filtering client-side is cheap and correct.
      const out = await client.send(new QueryCommand({
        TableName: table,
        IndexName: "byStatus",
        KeyConditionExpression: "#status = :statusOpen",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":statusOpen": "open" },
      }));
      return ((out.Items ?? []) as RoomMetaRow[])
        .filter((i) => i.lastActivityAt < idleThresholdIso || i.maxLifeAt < nowEpoch)
        .map((i) => i.PK.slice("ROOM#".length));
    },
  };
}
