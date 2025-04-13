import { Config } from "../shared/types";
import { decodeEvents } from "../utils/events";
import { handleRecievedConnection } from "./handle-event";
import { sendTunnelRequest } from "./tunnel-request";

const config: Config = {
  eventServerHost: "127.0.0.1",
  eventServerPort: 9000,
  protocol: "http",
  subdomain: "my-app",
  authToken: "secrettoken123",
  localPort: 3000,
};

sendTunnelRequest(config, (err, data, socket) => {
  if (err) console.error(`Tunnel Connection Failed: ${err.message}`);
  console.log(
    `✅ Tunnel created: ${data!.hostname}:${data!.publicPort} → localhost:${
      config.localPort
    }`
  );

  socket!.on("data", (chunk) => {
    const event = decodeEvents(chunk);
    if (event?.type === "ConnectionReceived") {
      handleRecievedConnection(event.data, config.localPort!, {
        host: config.eventServerHost,
        port: config.eventServerPort,
      });
    }
  });
});
