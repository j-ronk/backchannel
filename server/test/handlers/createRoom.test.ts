import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { it, expect, beforeEach } from "vitest";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

it("returns a roomId", async () => {
  ddb.on(PutCommand).resolves({});
  process.env.TABLE = "T";
  process.env.MAX_LIFE_SECONDS = "86400";
  const { handler } = await import("../../src/handlers/createRoom.js");
  const res: any = await handler({ body: JSON.stringify({ accessAuthHash: "H" }) } as any);
  expect(res.statusCode).toBe(201);
  expect(JSON.parse(res.body).roomId).toMatch(/^[A-Za-z0-9_-]{16}$/);
});

it("400 when accessAuthHash missing", async () => {
  process.env.TABLE = "T";
  process.env.MAX_LIFE_SECONDS = "86400";
  const { handler } = await import("../../src/handlers/createRoom.js");
  const res: any = await handler({ body: JSON.stringify({}) } as any);
  expect(res.statusCode).toBe(400);
});

it("201 stores accessAuthHash and returns roomId", async () => {
  ddb.on(PutCommand).resolves({});
  process.env.TABLE = "T";
  process.env.MAX_LIFE_SECONDS = "86400";
  const { handler } = await import("../../src/handlers/createRoom.js");
  const res: any = await handler({ body: JSON.stringify({ accessAuthHash: "H" }) } as any);
  expect(res.statusCode).toBe(201);
  expect(typeof JSON.parse(res.body).roomId).toBe("string");
  const put = ddb.commandCalls(PutCommand)[0].args[0].input as any;
  expect(put.Item.accessHash).toBe("H");
});
