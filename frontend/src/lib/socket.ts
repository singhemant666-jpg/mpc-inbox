import { io, Socket } from 'socket.io-client';

// Auto-detect: use env var if set, otherwise connect to same origin (works through tunnels)
// For local dev, Next.js rewrites proxy /socket.io/* to localhost:3001
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL || undefined, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      path: '/socket.io/',
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
