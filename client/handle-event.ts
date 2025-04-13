import net from "net";
import { ConnectionReceivedEvent } from "../shared/types";
const localHost = "127.0.0.1";

export function handleRecievedConnection(
  data: ConnectionReceivedEvent["data"],
  localPort: number,
  remote: {
    host: string;
    port: number;
  }
) {
  const localSocket = net.createConnection(localPort, localHost);
  const remoteSocket = net.createConnection(remote.port, remote.host);
  localSocket.pipe(remoteSocket);
  remoteSocket.pipe(localSocket);
  console.log(`🔁 New connection from ${data.clientIp}:${data.clientPort}`);
}
