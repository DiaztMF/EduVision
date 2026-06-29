import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/rooms/RoomManager.js';
import { registerJoinHandler } from '../src/handlers/joinHandler.js';
import { registerHostHandler } from '../src/handlers/hostHandler.js';
import { registerStartGameHandler } from '../src/handlers/startGameHandler.js';
import { registerClaimScoreHandler } from '../src/handlers/claimScoreHandler.js';
import { EVENTS } from '@eduvision/shared-types';

describe('Full Game Flow Integration', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let hostSocket: ClientSocket;
  let playerSocket: ClientSocket;
  let roomManager: RoomManager;
  let roomId: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const app = express();
      app.use(cors());
      app.use(express.json());
      roomManager = new RoomManager();

      app.post('/api/v1/rooms/create', (req, res) => {
        const room = roomManager.createRoom(req.body.moduleId);
        res.status(201).json({
          success: true,
          roomId: room.id,
          targetLabel: room.targetLabel,
          moduleTitle: 'Plastic Bottle Hunt',
          createdAt: new Date().toISOString(),
        });
      });

      httpServer = createServer(app);
      io = new Server(httpServer, { cors: { origin: '*' } });

      io.on('connection', (socket) => {
        registerHostHandler(io, socket, roomManager);
        registerJoinHandler(io, socket, roomManager);
        registerStartGameHandler(io, socket, roomManager);
        registerClaimScoreHandler(io, socket, roomManager);
      });

      httpServer.listen(0, () => {
        const port = (httpServer.address() as any).port;
        hostSocket = ioc(`http://localhost:${port}`);
        playerSocket = ioc(`http://localhost:${port}`);

        Promise.all([
          new Promise(r => hostSocket.on('connect', r)),
          new Promise(r => playerSocket.on('connect', r)),
        ]).then(() => {
          // Create a room via HTTP
          fetch(`http://localhost:${port}/api/v1/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleId: 1 }),
          }).then(r => r.json()).then(data => {
            roomId = data.roomId;
            resolve();
          });
        });
      });
    });
  });

  afterAll(() => {
    hostSocket?.close();
    playerSocket?.close();
    io?.close();
    httpServer?.close();
  });

  it('should complete a full game flow', () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test timed out')), 10000);

      hostSocket.emit(EVENTS.HOST_JOIN, { roomId });
      playerSocket.emit(EVENTS.JOIN_ROOM, { roomId, playerName: 'Diaz' });

      hostSocket.on(EVENTS.ROOM_PLAYERS_UPDATE, (data) => {
        if (data.players.length === 1 && data.players[0].name === 'Diaz') {
          hostSocket.emit(EVENTS.START_GAME_SESSION, { roomId, durationSec: 30 });
        }
      });

      playerSocket.on(EVENTS.GAME_STARTED, () => {
        playerSocket.emit(EVENTS.CLAIM_SCORE, {
          roomId,
          playerName: 'Diaz',
          confidenceScore: 0.87,
          timestamp: Date.now(),
        });
      });

      playerSocket.on(EVENTS.LEADERBOARD_SYNC, (data) => {
        expect(data).toHaveLength(1);
        expect(data[0].playerName).toBe('Diaz');
        expect(data[0].score).toBe(100);
        clearTimeout(timeout);
        resolve();
      });
    });
  });
});
