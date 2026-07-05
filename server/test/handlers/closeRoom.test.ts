import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { it, expect, beforeEach } from "vitest";
import { tokenHash } from "../../src/lib/auth.js";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

it("closes a room and returns 200 ok", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(UpdateCommand).resolves({});
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/closeRoom.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
  } as any);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ ok: true });
  const calls = ddb.commandCalls(UpdateCommand);
  expect(calls).toHaveLength(1);
  const input = calls[0].args[0].input;
  expect(input.UpdateExpression).toContain("SET #s = :closed");
  expect(input.ExpressionAttributeValues![":closed"]).toBe("closed");
});

it("401 when token missing or wrong", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/closeRoom.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: {},
  } as any);
  expect(res.statusCode).toBe(401);
});
