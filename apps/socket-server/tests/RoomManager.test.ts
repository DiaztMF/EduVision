import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/rooms/RoomManager.js';

describe('RoomManager', () => {
  it('should create a room and return room data with targetLabel', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    expect(room.id).toBeDefined();
    expect(room.targetLabel).toBe('plastic_bottle');
    expect(room.moduleId).toBe(1);
    expect(room.status).toBe('LOBBY');
    expect(room.players.size).toBe(0);
  });

  it('should add a player to a room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    const added = manager.addPlayer(room.id, 'Diaz');
    expect(added).toBe(true);
    expect(room.players.get('Diaz')).toEqual({
      name: 'Diaz', score: 0, claimedAt: null, connected: true,
    });
  });

  it('should reject duplicate player names in the same room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    const added = manager.addPlayer(room.id, 'Diaz');
    expect(added).toBe(false);
  });

  it('should return null for non-existent room', () => {
    const manager = new RoomManager();
    const room = manager.getRoom('NONEXISTENT');
    expect(room).toBeNull();
  });

  it('should start a game and set endsAt', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.startGame(room.id, 600);
    expect(room.status).toBe('ACTIVE');
    expect(room.endsAt).toBeGreaterThan(Date.now());
  });

  it('should handle claim score successfully', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    manager.startGame(room.id, 600);
    const result = manager.claimScore(room.id, 'Diaz', 0.87);
    expect(result.success).toBe(true);
    expect(room.players.get('Diaz')!.score).toBe(100);
    expect(room.players.get('Diaz')!.claimedAt).toBeGreaterThan(0);
  });

  it('should detect if a player has claimed', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    expect(manager.hasPlayerClaimed(room.id, 'Diaz')).toBe(false);
    manager.startGame(room.id, 600);
    manager.claimScore(room.id, 'Diaz', 0.87);
    expect(manager.hasPlayerClaimed(room.id, 'Diaz')).toBe(true);
  });

  it('should reject claim after game has expired', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    manager.startGame(room.id, -1);
    // endsAt is in the past, so claim is after expiry
    const result = manager.claimScore(room.id, 'Diaz', 0.87);
    expect(result.success).toBe(false);
    expect(result.error).toBe('GAME_NOT_ACTIVE');
  });

  it('should reject claim when game is not active', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    const result = manager.claimScore(room.id, 'Diaz', 0.87);
    expect(result.success).toBe(false);
    expect(result.error).toBe('GAME_NOT_ACTIVE');
  });

  it('should reject duplicate claim from same player', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    manager.startGame(room.id, 600);
    manager.claimScore(room.id, 'Diaz', 0.87);
    const result = manager.claimScore(room.id, 'Diaz', 0.90);
    expect(result.success).toBe(false);
    expect(result.error).toBe('ALREADY_CLAIMED');
  });

  it('should reject claim with low confidence', () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Diaz');
    manager.startGame(room.id, 600);
    const result = manager.claimScore(room.id, 'Diaz', 0.50);
    expect(result.success).toBe(false);
    expect(result.error).toBe('LOW_CONFIDENCE');
  });

  it('should return leaderboard sorted by claimedAt', async () => {
    const manager = new RoomManager();
    const room = manager.createRoom(1);
    manager.addPlayer(room.id, 'Amelia');
    manager.addPlayer(room.id, 'Budi');
    manager.addPlayer(room.id, 'Diaz');
    manager.startGame(room.id, 600);
    manager.claimScore(room.id, 'Budi', 0.90);
    // Wait a ms so timestamps differ
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    await wait(5);
    manager.claimScore(room.id, 'Amelia', 0.85);
    const lb = manager.getLeaderboard(room.id);
    expect(lb[0].playerName).toBe('Budi');
    expect(lb[1].playerName).toBe('Amelia');
    expect(lb[2].playerName).toBe('Diaz');
    expect(lb[2].score).toBe(0);
  });
});
