import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';
import { EVENTS } from '@eduvision/shared-types';

export function registerJoinHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(EVENTS.JOIN_ROOM, ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const added = roomManager.addPlayer(roomId, playerName);
    if (!added) {
      socket.emit(EVENTS.ERROR_EVENT, {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found or nickname already taken.',
      });
      return;
    }
    socket.join(roomId);
    socket.data.playerName = playerName;
    socket.data.roomId = roomId;
    const players = roomManager.getRoomPlayers(roomId);
    io.to(roomId).emit(EVENTS.ROOM_PLAYERS_UPDATE, { players });
  });
}
