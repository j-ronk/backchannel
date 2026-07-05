export const json = (statusCode: number, body: unknown) => ({
  statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
export const bad = (statusCode: number, error: string) => json(statusCode, { error });
