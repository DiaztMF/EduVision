import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { EVENTS } from '@eduvision/shared-types';
import { RoomManager } from './rooms/RoomManager.js';
import { registerJoinHandler } from './handlers/joinHandler.js';
import { registerHostHandler } from './handlers/hostHandler.js';
import { registerStartGameHandler } from './handlers/startGameHandler.js';
import { registerClaimScoreHandler } from './handlers/claimScoreHandler.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const app = express();
app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();

app.post('/api/v1/rooms/create', (req, res) => {
  const { moduleId } = req.body;
  if (typeof moduleId !== 'number') {
    res.status(400).json({ success: false, error: 'moduleId is required' });
    return;
  }
  const room = roomManager.createRoom(moduleId);
  res.status(201).json({
    success: true,
    roomId: room.id,
    targetLabel: room.targetLabel,
    moduleTitle: roomManager.getModules().find(m => m.id === moduleId)?.title ?? '',
    createdAt: new Date().toISOString(),
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  registerHostHandler(io, socket, roomManager);
  registerJoinHandler(io, socket, roomManager);
  registerStartGameHandler(io, socket, roomManager);
  registerClaimScoreHandler(io, socket, roomManager);

  socket.on('disconnect', () => {
    const { playerName, roomId } = socket.data;
    if (playerName && roomId) {
      roomManager.removePlayer(roomId, playerName);
      const players = roomManager.getRoomPlayers(roomId);
      io.to(roomId).emit(EVENTS.ROOM_PLAYERS_UPDATE, { players });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
