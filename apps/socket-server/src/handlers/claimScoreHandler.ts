import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager.js';
import { EVENTS } from '@eduvision/shared-types';

export function registerClaimScoreHandler(io: Server, socket: Socket, roomManager: RoomManager): void {
  socket.on(EVENTS.CLAIM_SCORE, (payload: { roomId: string; playerName: string; confidenceScore: number; timestamp: number }) => {
    const { roomId, playerName, confidenceScore } = payload;
    const result = roomManager.claimScore(roomId, playerName, confidenceScore);
    if (result.success) {
      const leaderboard = roomManager.getLeaderboard(roomId);
      io.to(roomId).emit(EVENTS.LEADERBOARD_SYNC, leaderboard);
    } else {
      socket.emit(EVENTS.ERROR_EVENT, { code: result.error, message: result.error ?? 'Unknown error' });
    }
  });
}
