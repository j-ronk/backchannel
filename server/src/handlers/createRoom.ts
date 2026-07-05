import { randomBytes } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../domain/repo.js";
import { json, bad } from "../lib/responses.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (evt: any) => {
  let b: any;
  try { b = JSON.parse(evt.body ?? "{}"); } catch { return bad(400, "bad json"); }
  if (typeof b.accessAuthHash !== "string" || !b.accessAuthHash) return bad(400, "accessAuthHash");
  const repo = makeRepo(doc, process.env.TABLE!);
  const roomId = randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  await repo.createRoom(roomId, now, Number(process.env.MAX_LIFE_SECONDS), b.accessAuthHash);
  return json(201, { roomId });
};
