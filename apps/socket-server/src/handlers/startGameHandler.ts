import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';
import { EVENTS } from '@eduvision/shared-types';

export function registerStartGameHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(EVENTS.START_GAME_SESSION, ({ roomId, durationSec }: { roomId: string; durationSec: number }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit(EVENTS.ERROR_EVENT, { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      return;
    }
    roomManager.startGame(roomId, durationSec);
    io.to(roomId).emit(EVENTS.GAME_STARTED, {
      endsAt: room.endsAt,
      targetLabel: room.targetLabel,
    });

    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomId);
      if (!currentRoom || currentRoom.status === 'ENDED') return;
      currentRoom.status = 'ENDED';
      const leaderboard = roomManager.getLeaderboard(roomId);
      io.to(roomId).emit(EVENTS.GAME_ENDED, { leaderboard });
    }, durationSec * 1000);
  });
}
