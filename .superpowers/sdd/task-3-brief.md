### Task 3: Socket Server — Handlers & Express Entry

**Files:**
- Create: `apps/socket-server/src/handlers/hostHandler.ts`
- Create: `apps/socket-server/src/handlers/joinHandler.ts`
- Create: `apps/socket-server/src/handlers/startGameHandler.ts`
- Create: `apps/socket-server/src/handlers/claimScoreHandler.ts`
- Create: `apps/socket-server/src/server.ts`

**Interfaces:**
- Consumes: `RoomManager` from Task 2, shared types from `@eduvision/shared-types`
- Produces: Express + Socket.io server listening on `PORT` (env or 3001), REST `POST /api/v1/rooms/create`, full WebSocket event handling

- [ ] **Step 1: Create `apps/socket-server/src/handlers/hostHandler.ts`**

```typescript
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
```

- [ ] **Step 2: Create `apps/socket-server/src/handlers/joinHandler.ts`**

```typescript
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
```

- [ ] **Step 3: Create `apps/socket-server/src/handlers/startGameHandler.ts`**

```typescript
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
```

- [ ] **Step 4: Create `apps/socket-server/src/handlers/claimScoreHandler.ts`**

```typescript
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
```

- [ ] **Step 5: Create `apps/socket-server/src/server.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
      io.to(roomId).emit('room_players_update', { players });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
```

- [ ] **Step 6: Verify server starts**

Run: `cd apps/socket-server && timeout 5 npx tsx src/server.ts || true`
Expected: "Socket server listening on port 3001" logged

- [ ] **Step 7: Verify REST endpoint responds**

Run the socket-server in background, then:
`curl -s -X POST http://localhost:3001/api/v1/rooms/create -H 'Content-Type: application/json' -d '{"moduleId":1}'`
Expected: JSON with `success: true` and `roomId`

- [ ] **Step 8: Commit**

```bash
git add apps/socket-server/src/
git commit -m "feat: implement WebSocket handlers and Express entry"
```
