import { Events } from "../shared/types";

export function encodeEvents(events: Events): Buffer {
  return Buffer.from(JSON.stringify(events), "utf-8");
}

export function decodeEvents(buffer: Buffer): Events | null {
  try {
    return JSON.parse(buffer.toString()) as Events;
  } catch (err) {
    console.log("Failed to decode event:", err);
    return null;
  }
}
