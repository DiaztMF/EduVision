export type RoomStatus = 'LOBBY' | 'ACTIVE' | 'ENDED';

export interface Player {
  name: string;
  score: number;
  claimedAt: number | null;
  connected: boolean;
}

export interface GameModule {
  id: number;
  title: string;
  targetLabel: string;
  description: string;
}

export interface Room {
  id: string;
  moduleId: number;
  targetLabel: string;
  status: RoomStatus;
  players: Map<string, Player>;
  endsAt: number | null;
}

export interface CreateRoomRequest {
  moduleId: number;
}

export interface CreateRoomResponse {
  success: true;
  roomId: string;
  targetLabel: string;
  moduleTitle: string;
  createdAt: string;
}

export interface HostJoinPayload {
  roomId: string;
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface RoomPlayersUpdatePayload {
  players: Array<{ name: string; score: number; claimedAt: number | null }>;
}

export interface StartGameSessionPayload {
  roomId: string;
  durationSec: number;
}

export interface GameStartedPayload {
  endsAt: number;
  targetLabel: string;
}

export interface ClaimScorePayload {
  roomId: string;
  playerName: string;
  confidenceScore: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  playerName: string;
  score: number;
  claimedAt: number | null;
}

export interface LeaderboardSyncPayload extends Array<LeaderboardEntry> {}

export interface GameEndedPayload {
  leaderboard: LeaderboardEntry[];
}

export interface ErrorEventPayload {
  code: 'ROOM_NOT_FOUND' | 'GAME_NOT_ACTIVE' | 'ALREADY_CLAIMED' | 'LOW_CONFIDENCE';
  message: string;
}

export const EVENTS = {
  HOST_JOIN: 'host_join',
  JOIN_ROOM: 'join_room',
  ROOM_PLAYERS_UPDATE: 'room_players_update',
  START_GAME_SESSION: 'start_game_session',
  GAME_STARTED: 'game_started',
  CLAIM_SCORE: 'claim_score',
  LEADERBOARD_SYNC: 'leaderboard_sync',
  GAME_ENDED: 'game_ended',
  ERROR_EVENT: 'error_event',
} as const;
