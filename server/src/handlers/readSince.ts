import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../domain/repo.js";
import { json, bad } from "../lib/responses.js";
import { extractToken, verifyToken } from "../lib/auth.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (evt: any) => {
  const roomId = evt.pathParameters?.roomId;
  const since = Number(evt.queryStringParameters?.since ?? 0) || 0;
  const repo = makeRepo(doc, process.env.TABLE!);
  const meta = await repo.getRoomMeta(roomId);
  if (!verifyToken(extractToken(evt), meta?.accessHash ?? undefined)) return bad(401, "unauthorized");
  const events = await repo.getEventsSince(roomId, since);
  const cursor = events.length ? events[events.length - 1].seq : since;
  // Surface room status so a reader can detect a closed/expired room and stop auto-sharing.
  // (Reads still succeed on a closed room — only posting is blocked — so status is the signal.)
  return json(200, { events, cursor, status: meta?.status ?? "open" });
};
