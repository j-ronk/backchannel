import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../domain/repo.js";
import { json, bad } from "../lib/responses.js";
import { extractToken, verifyToken } from "../lib/auth.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (evt: any) => {
  const roomId = evt.pathParameters?.roomId;
  const repo = makeRepo(doc, process.env.TABLE!);
  const accessHash = await repo.getRoomAccessHash(roomId);
  if (!verifyToken(extractToken(evt), accessHash ?? undefined)) return bad(401, "unauthorized");
  await repo.closeRoom(roomId);
  return json(200, { ok: true });
};
