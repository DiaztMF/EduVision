import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';
import { EVENTS } from '@eduvision/shared-types';

export function registerHostHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(EVENTS.HOST_JOIN, ({ roomId }: { roomId: string }) => {
    socket.join(roomId);
    const players = roomManager.getRoomPlayers(roomId);
    io.to(roomId).emit(EVENTS.ROOM_PLAYERS_UPDATE, { players });
  });
}
