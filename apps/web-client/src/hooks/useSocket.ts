'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

export function useSocket(roomId?: string) {
  const socketRef = useRef<Socket>(getSocket());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setIsConnected(true);

    return () => {
      if (roomId) {
        socket.emit('leave_room', { roomId });
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId]);

  return { socket: socketRef.current, isConnected };
}
