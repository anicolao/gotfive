import type { PeerJSOption } from 'peerjs';

export function getPeerConfig(): PeerJSOption | undefined {
  const host = import.meta.env.VITE_PEER_HOST;
  const portStr = import.meta.env.VITE_PEER_PORT;
  const secureStr = import.meta.env.VITE_PEER_SECURE;

  if (host && portStr) {
    return {
      host: host,
      port: parseInt(portStr, 10),
      secure: secureStr === 'true',
      debug: 1
    };
  }

  // default to undefined to use PeerJS default cloud server
  return undefined;
}

export function getLobbyConfig() {
  const isTest = !!import.meta.env.VITE_PEER_HOST;
  return {
    newcomerDelay: isTest ? 1500 : 1000,
    watchdogTimeout: isTest ? 1000 : 10000,
    reconnectDelay: isTest ? 100 : 0
  };
}
