import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configured) return configured;
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return 'http://localhost:3001';
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
