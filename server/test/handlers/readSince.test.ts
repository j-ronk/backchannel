import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { it, expect, beforeEach } from "vitest";
import { tokenHash } from "../../src/lib/auth.js";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

it("returns events and advances cursor to last seq", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(QueryCommand).resolves({
    Items: [
      { SK: "EVT#000000000002", author: "alice", ts: "2026-06-24T00:00:00Z", type: "finding", payload: "first" },
      { SK: "EVT#000000000003", author: "bob", ts: "2026-06-24T00:01:00Z", type: "trace", payload: "second" },
    ],
  });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/readSince.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    queryStringParameters: { since: "1" },
  } as any);
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.events).toHaveLength(2);
  expect(body.events[0].seq).toBe(2);
  expect(body.events[1].seq).toBe(3);
  expect(body.cursor).toBe(3);
});

it("returns cursor unchanged when no events", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(QueryCommand).resolves({ Items: [] });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/readSince.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    queryStringParameters: { since: "5" },
  } as any);
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.events).toHaveLength(0);
  expect(body.cursor).toBe(5);
});

it("401 when token missing or wrong", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/readSince.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: {},
    queryStringParameters: { since: "0" },
  } as any);
  expect(res.statusCode).toBe(401);
});

it("surfaces room status: closed for a closed room", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good"), status: "closed" } });
  ddb.on(QueryCommand).resolves({ Items: [] });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/readSince.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    queryStringParameters: { since: "0" },
  } as any);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body).status).toBe("closed");
});

it("surfaces room status: open by default", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(QueryCommand).resolves({ Items: [] });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/readSince.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    queryStringParameters: { since: "0" },
  } as any);
  expect(JSON.parse(res.body).status).toBe("open");
});
