import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../domain/repo.js";
import { json, bad } from "../lib/responses.js";
import { extractToken, verifyToken } from "../lib/auth.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TYPES = new Set(["trace", "finding", "summary", "system"]);

export const handler = async (evt: any) => {
  const roomId = evt.pathParameters?.roomId;
  // API Gateway base64-encodes the request body for non-JSON content types and sets
  // isBase64Encoded; decode it before parsing so any content type works (not just
  // application/json). Without this, a base64 body fails JSON.parse → "bad json".
  const rawBody = evt.isBase64Encoded && typeof evt.body === "string"
    ? Buffer.from(evt.body, "base64").toString("utf8")
    : evt.body;
  let b: any;
  try { b = JSON.parse(rawBody ?? "{}"); } catch { return bad(400, "bad json"); }
  if (typeof b.author !== "string" || b.author.length > 64) return bad(400, "author");
  if (!TYPES.has(b.type)) return bad(400, "type");
  if (typeof b.payload !== "string" || b.payload.length > 65536) return bad(400, "payload");
  const repo = makeRepo(doc, process.env.TABLE!);
  const accessHash = await repo.getRoomAccessHash(roomId);
  if (!verifyToken(extractToken(evt), accessHash ?? undefined)) return bad(401, "unauthorized");
  try {
    const r = await repo.appendEvent(roomId, { author: b.author, type: b.type, payload: b.payload }, new Date().toISOString());
    return json(200, r);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") return bad(404, "room not open");
    throw e;
  }
};
