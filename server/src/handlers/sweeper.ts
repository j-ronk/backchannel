import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { makeRepo } from "../domain/repo.js";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async () => {
  const repo = makeRepo(doc, process.env.TABLE!);
  const idleSecs = Number(process.env.IDLE_SECONDS);
  const ids = await repo.listExpiredRooms(Math.floor(Date.now() / 1000), idleSecs);
  await Promise.all(ids.map((id) => repo.closeRoom(id)));
  return { closed: ids.length };
};
