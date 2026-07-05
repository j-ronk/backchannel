export type EventType = "trace" | "finding" | "summary" | "system";
export interface StoredEvent { seq: number; author: string; ts: string; type: EventType; payload: string; }
export interface CreateRoomResponse { roomId: string; }
export interface PostEventRequest { author: string; type: EventType; payload: string; }
export interface PostEventResponse { seq: number; ts: string; }
export interface ReadSinceResponse { events: StoredEvent[]; cursor: number; }
