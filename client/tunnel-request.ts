import net from "net";
import { decodeEvents, encodeEvents } from "../utils/events";
import { Config, TunnelOpenedEvent } from "../shared/types";

export function sendTunnelRequest(
  config: Config,
  cb: (
    err: Error | null,
    data?: TunnelOpenedEvent["data"],
    socket?: net.Socket
  ) => void
) {
  const socket = net.createConnection(
    config.eventServerPort,
    config.eventServerHost,
    () => {
      const event = {
        type: "TunnelRequested",
        data: {
          protocol: config.protocol,
          subdomain: config.subdomain,
          authToken: config.authToken,
        },
      } as const;
      socket.write(encodeEvents(event));
    }
  );

  socket.on("data", (chunk) => {
    const event = decodeEvents(chunk);
    if (event?.type === "TunnelOpened") {
      cb(null, event.data, socket);
    } else {
      cb(new Error("Unexpected or invalid response"), undefined, socket);
    }
  });

  socket.on("error", (err) => {
    cb(err);
  });
}
