import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../src/domain/repo.js";
import { describe, it, expect, beforeEach } from "vitest";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

describe("appendEvent", () => {
  it("uses the atomically incremented seq for the event SK", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: { seqCounter: 5 } });
    ddb.on(PutCommand).resolves({});
    const repo = makeRepo(ddb as any, "T");
    const res = await repo.appendEvent("abc", { author: "jay", type: "finding", payload: "X" }, "2026-06-24T00:00:00Z");
    expect(res.seq).toBe(5);
    const put = ddb.commandCalls(PutCommand)[0].args[0].input as any;
    expect(put.Item.SK).toBe("EVT#000000000005");
  });
});

describe("getEventsSince", () => {
  it("maps SK EVT#000000000003 to seq 3", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [{ SK: "EVT#000000000003", author: "ali", ts: "2026-06-24T00:01:00Z", type: "trace", payload: "hello" }],
    });
    const repo = makeRepo(ddb as any, "T");
    const events = await repo.getEventsSince("abc", 2);
    expect(events).toHaveLength(1);
    expect(events[0].seq).toBe(3);
    expect(events[0].author).toBe("ali");
    expect(events[0].type).toBe("trace");
    expect(events[0].payload).toBe("hello");
  });

  // DynamoDB forbids key attributes (SK) in a FilterExpression — the aws-sdk mock does
  // NOT enforce this, so we assert the range is expressed via the KeyConditionExpression.
  it("bounds the EVT# range via KeyConditionExpression, not a FilterExpression on SK", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    const repo = makeRepo(ddb as any, "T");
    await repo.getEventsSince("abc", 2);
    const input = ddb.commandCalls(QueryCommand)[0].args[0].input as any;
    expect(input.KeyConditionExpression).toContain("BETWEEN");
    expect(input.FilterExpression).toBeUndefined();
    expect(input.ExpressionAttributeValues[":lo"]).toBe("EVT#000000000003"); // strictly > cursor 2
    expect(input.ConsistentRead).toBe(true); // read-after-write: must see just-posted events
  });
});

describe("access hash", () => {
  it("createRoom persists accessHash on META", async () => {
    ddb.on(PutCommand).resolves({});
    const repo = makeRepo(ddb as any, "T");
    await repo.createRoom("r1", "2026-06-25T00:00:00Z", 86400, "HASH123");
    const put = ddb.commandCalls(PutCommand)[0].args[0].input as any;
    expect(put.Item.accessHash).toBe("HASH123");
  });
  it("getRoomAccessHash returns the stored hash", async () => {
    ddb.on(GetCommand).resolves({ Item: { accessHash: "HASH123" } });
    const repo = makeRepo(ddb as any, "T");
    expect(await repo.getRoomAccessHash("r1")).toBe("HASH123");
  });
  it("getRoomMeta returns accessHash + status", async () => {
    ddb.on(GetCommand).resolves({ Item: { accessHash: "HASH123", status: "closed" } });
    const repo = makeRepo(ddb as any, "T");
    expect(await repo.getRoomMeta("r1")).toEqual({ accessHash: "HASH123", status: "closed" });
  });
  it("getRoomMeta defaults status to open when absent; null when the room record is missing", async () => {
    ddb.on(GetCommand).resolves({ Item: { accessHash: "HASH123" } });
    const repo = makeRepo(ddb as any, "T");
    expect(await repo.getRoomMeta("r1")).toEqual({ accessHash: "HASH123", status: "open" });
    ddb.on(GetCommand).resolves({});
    expect(await repo.getRoomMeta("r1")).toBeNull();
  });
});

describe("listExpiredRooms", () => {
  // lastActivityAt is the byStatus GSI sort key, so it cannot go in a FilterExpression.
  // We query open rooms by the GSI partition key only and test idle/max-life in code.
  it("queries the byStatus GSI by status=open with no FilterExpression on key attrs", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    const repo = makeRepo(ddb as any, "T");
    await repo.listExpiredRooms(1_750_000_000, 3600);
    const input = ddb.commandCalls(QueryCommand)[0].args[0].input as any;
    expect(input.IndexName).toBe("byStatus");
    expect(input.KeyConditionExpression).toContain("status");
    expect(input.ExpressionAttributeValues[":statusOpen"]).toBe("open");
    expect(input.FilterExpression).toBeUndefined();
  });

  it("selects idle OR past-max-life rooms in code, excluding fresh ones (strips ROOM#)", async () => {
    // nowEpoch = 1_750_000_000, idleSecs = 3600
    ddb.on(QueryCommand).resolves({
      Items: [
        { PK: "ROOM#idle-1", lastActivityAt: "2020-01-01T00:00:00Z", maxLifeAt: 9_999_999_999 }, // idle
        { PK: "ROOM#maxed-1", lastActivityAt: "2999-01-01T00:00:00Z", maxLifeAt: 1 },            // past max-life
        { PK: "ROOM#fresh-1", lastActivityAt: "2999-01-01T00:00:00Z", maxLifeAt: 9_999_999_999 }, // neither
      ],
    });
    const repo = makeRepo(ddb as any, "T");
    const ids = await repo.listExpiredRooms(1_750_000_000, 3600);
    expect(ids.sort()).toEqual(["idle-1", "maxed-1"]);
  });
});
