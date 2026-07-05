export interface StoredEvent { seq: number; author: string; ts: string; type: string; payload: string; }

async function req(url: string, init: any): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) { const e: any = new Error(`relay ${res.status}`); e.status = res.status; throw e; }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
const auth = (token: string) => ({ "x-backchannel-token": token, "content-type": "application/json" });

export async function apiCreateRoom(relayUrl: string, accessAuthHash: string): Promise<string> {
  const r = await req(`${relayUrl}/rooms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessAuthHash }) });
  return r.roomId;
}
export async function apiPostEvent(relayUrl: string, roomId: string, token: string, body: { author: string; type: string; payload: string }): Promise<{ seq: number; ts: string }> {
  return req(`${relayUrl}/rooms/${roomId}/events`, { method: "POST", headers: auth(token), body: JSON.stringify(body) });
}
export async function apiGetEvents(relayUrl: string, roomId: string, token: string, since: number): Promise<{ events: StoredEvent[]; cursor: number; status?: string }> {
  return req(`${relayUrl}/rooms/${roomId}/events?since=${since}`, { headers: { "x-backchannel-token": token } });
}
export async function apiCloseRoom(relayUrl: string, roomId: string, token: string): Promise<void> {
  await req(`${relayUrl}/rooms/${roomId}/close`, { method: "POST", headers: { "x-backchannel-token": token } });
}
