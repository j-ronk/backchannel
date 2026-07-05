import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { it, expect, beforeEach } from "vitest";

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

it("closes all expired rooms and returns { closed: 2 }", async () => {
  ddb.on(QueryCommand).resolves({
    Items: [
      { PK: "ROOM#room-a", SK: "META", status: "open", lastActivityAt: "2025-01-01T00:00:00Z", maxLifeAt: 1600000000 },
      { PK: "ROOM#room-b", SK: "META", status: "open", lastActivityAt: "2025-01-02T00:00:00Z", maxLifeAt: 1600000001 },
    ],
  });
  ddb.on(UpdateCommand).resolves({});
  process.env.TABLE = "T";
  process.env.IDLE_SECONDS = "3600";
  const { handler } = await import("../../src/handlers/sweeper.js");
  const result = await handler();
  expect(result).toEqual({ closed: 2 });
  const updateCalls = ddb.commandCalls(UpdateCommand);
  expect(updateCalls).toHaveLength(2);
  expect((updateCalls[0].args[0].input as any).Key.PK).toBe("ROOM#room-a");
  expect((updateCalls[1].args[0].input as any).Key.PK).toBe("ROOM#room-b");
});
