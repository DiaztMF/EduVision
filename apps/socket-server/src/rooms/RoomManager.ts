import type { Room, LeaderboardEntry } from '@eduvision/shared-types';
import modules from '../modules.json' with { type: 'json' };

const CONFIDENCE_THRESHOLD = 0.15;

interface ClaimResult {
  success: boolean;
  error?: 'ROOM_NOT_FOUND' | 'GAME_NOT_ACTIVE' | 'ALREADY_CLAIMED' | 'LOW_CONFIDENCE';
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(moduleId: number): Room {
    const mod = modules.find(m => m.id === moduleId);
    const id = Math.floor(1000 + Math.random() * 9000).toString();
    const room: Room = {
      id,
      moduleId: mod?.id ?? moduleId,
      targetLabel: mod?.targetLabel ?? 'plastic_bottle',
      status: 'LOBBY',
      players: new Map(),
      endsAt: null,
    };
    this.rooms.set(id, room);
    return room;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  addPlayer(roomId: string, playerName: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.players.has(playerName)) return false;
    room.players.set(playerName, {
      name: playerName,
      score: 0,
      claimedAt: null,
      connected: true,
      aiProgress: 0,
    });
    return true;
  }

  updatePlayerProgress(roomId: string, playerName: string, progress: number): boolean {
    const player = this.rooms.get(roomId)?.players.get(playerName);
    if (!player) return false;
    player.aiProgress = progress;
    return true;
  }

  removePlayer(roomId: string, playerName: string): void {
    this.rooms.get(roomId)?.players.delete(playerName);
  }

  startGame(roomId: string, durationSec: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.status = 'ACTIVE';
    room.endsAt = Date.now() + durationSec * 1000;
    return true;
  }

  hasPlayerClaimed(roomId: string, playerName: string): boolean {
    return this.rooms.get(roomId)?.players.get(playerName)?.claimedAt !== null;
  }

  claimScore(roomId: string, playerName: string, confidenceScore: number): ClaimResult {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'ROOM_NOT_FOUND' };
    if (room.status !== 'ACTIVE') return { success: false, error: 'GAME_NOT_ACTIVE' };
    if (room.endsAt && Date.now() > room.endsAt) return { success: false, error: 'GAME_NOT_ACTIVE' };
    const player = room.players.get(playerName);
    if (!player) return { success: false, error: 'ROOM_NOT_FOUND' };
    if (player.claimedAt !== null) return { success: false, error: 'ALREADY_CLAIMED' };
    if (confidenceScore < CONFIDENCE_THRESHOLD) return { success: false, error: 'LOW_CONFIDENCE' };
    player.score = 100;
    player.claimedAt = Date.now();
    return { success: true };
  }

  getLeaderboard(roomId: string): LeaderboardEntry[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.players.values())
      .map(p => ({ playerName: p.name, score: p.score, claimedAt: p.claimedAt }))
      .sort((a, b) => {
        if (a.claimedAt && b.claimedAt) return a.claimedAt - b.claimedAt;
        if (a.claimedAt) return -1;
        if (b.claimedAt) return 1;
        return a.playerName.localeCompare(b.playerName);
      });
  }

  getRoomPlayers(roomId: string): Array<{ name: string; score: number; claimedAt: number | null; aiProgress: number }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.players.values()).map(p => ({
      name: p.name, score: p.score, claimedAt: p.claimedAt, aiProgress: p.aiProgress,
    }));
  }

  getModules(): Array<{ id: number; title: string; targetLabel: string; description: string }> {
    return modules;
  }
}
