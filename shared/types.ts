export type TunnelRequestedEvent = {
  type: "TunnelRequested";
  data: {
    protocol: string;
    subdomain: string;
    authToken: string;
  };
};

export type TunnelOpenedEvent = {
  type: "TunnelOpened";
  data: {
    hostname: string;
    publicPort: number;
    privatePort: number;
  };
};

export type ConnectionReceivedEvent = {
  type: "ConnectionReceived";
  data: {
    clientIp: string;
    clientPort: number;
  };
};

export type Events =
  | TunnelRequestedEvent
  | TunnelOpenedEvent
  | ConnectionReceivedEvent;

export type Config = {
  eventServerHost: string;
  eventServerPort: number;
  protocol: string;
  subdomain: string;
  authToken: string;
  localPort?: number;
};
