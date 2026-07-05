import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { it, expect, beforeEach } from "vitest";
import { tokenHash } from "../../src/lib/auth.js";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

// --- 400 paths (no token needed: validation fires before auth) ---

it("rejects body without payload", async () => {
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({ pathParameters: { roomId: "r" }, body: JSON.stringify({ author: "a", type: "finding" }) } as any);
  expect(res.statusCode).toBe(400);
  expect(ddb.calls()).toHaveLength(0);
});

it("rejects bad JSON body", async () => {
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({ pathParameters: { roomId: "r" }, body: "not-json" } as any);
  expect(res.statusCode).toBe(400);
  expect(ddb.calls()).toHaveLength(0);
});

it("rejects invalid type", async () => {
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({ pathParameters: { roomId: "r" }, body: JSON.stringify({ author: "a", type: "invalid", payload: "x" }) } as any);
  expect(res.statusCode).toBe(400);
  expect(ddb.calls()).toHaveLength(0);
});

it("rejects oversized author", async () => {
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({ pathParameters: { roomId: "r" }, body: JSON.stringify({ author: "a".repeat(65), type: "trace", payload: "x" }) } as any);
  expect(res.statusCode).toBe(400);
  expect(ddb.calls()).toHaveLength(0);
});

// --- 401 path ---

it("401 when token missing or wrong", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: {},
    body: JSON.stringify({ author: "a", type: "finding", payload: "x" }),
  } as any);
  expect(res.statusCode).toBe(401);
});

// --- 404 path ---

it("returns 404 when room is missing or closed", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(UpdateCommand).rejects(Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" }));
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    body: JSON.stringify({ author: "a", type: "finding", payload: "enc-payload" }),
  } as any);
  expect(res.statusCode).toBe(404);
  expect(JSON.parse(res.body).error).toBe("room not open");
});

// --- 200 path ---

it("returns 200 with seq and ts on success", async () => {
  const seqCounter = 7;
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(UpdateCommand).resolves({ Attributes: { seqCounter } });
  ddb.on(PutCommand).resolves({});
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    body: JSON.stringify({ author: "alice", type: "summary", payload: "ciphertext-abc" }),
  } as any);
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.seq).toBe(seqCounter);
  expect(typeof body.ts).toBe("string");
});

// Regression: API Gateway base64-encodes the body for non-JSON content types and sets
// isBase64Encoded. The handler must decode before JSON.parse, else it returns "bad json".
it("decodes a base64-encoded body (isBase64Encoded=true)", async () => {
  ddb.on(GetCommand).resolves({ Item: { accessHash: tokenHash("good") } });
  ddb.on(UpdateCommand).resolves({ Attributes: { seqCounter: 1 } });
  ddb.on(PutCommand).resolves({});
  process.env.TABLE = "T";
  const { handler } = await import("../../src/handlers/postEvent.js");
  const bodyJson = JSON.stringify({ author: "alice", type: "finding", payload: "ct" });
  const body = Buffer.from(bodyJson, "utf8").toString("base64");
  const res: any = await handler({
    pathParameters: { roomId: "r" },
    headers: { "x-backchannel-token": "good" },
    body,
    isBase64Encoded: true,
  } as any);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body).seq).toBe(1);
});
