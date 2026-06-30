import type { Server, Socket } from 'socket.io';
import { EVENTS, type PlayerProgressPayload } from '@eduvision/shared-types';
import type { RoomManager } from '../rooms/RoomManager.js';

export function registerPlayerProgressHandler(io: Server, socket: Socket, roomManager: RoomManager) {
  socket.on(EVENTS.PLAYER_PROGRESS_UPDATE, (payload: PlayerProgressPayload) => {
    const { roomId, playerName, progress } = payload;
    
    // Validasi dasar
    if (typeof progress !== 'number') return;
    
    // Update progress di RoomManager
    const success = roomManager.updatePlayerProgress(roomId, playerName, progress);
    
    if (success) {
      // Broadcast update terbaru ke seluruh room (terutama host)
      io.to(roomId).emit(EVENTS.ROOM_PLAYERS_UPDATE, {
        players: roomManager.getRoomPlayers(roomId),
      });
    }
  });
}
