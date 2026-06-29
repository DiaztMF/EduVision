# EduVision MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based outdoor educational gamification platform where students hunt plastic bottles using their phone camera + on-device AI, and scores update in real-time on a classroom IFP leaderboard.

**Architecture:** pnpm monorepo with three packages — `packages/shared-types` (TypeScript interfaces), `apps/socket-server` (Express + Socket.io with in-memory state), `apps/web-client` (Next.js 16 App Router serving both host/IFP and student/mobile views). Edge AI inference runs entirely client-side via `onnxruntime-web`.

**Tech Stack:** pnpm workspaces, Node.js + Express + Socket.io, Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, onnxruntime-web (Wasm/WebGPU), YOLOv8n (best.onnx).

## Global Constraints

- Target class: `plastic_bottle` (from `best.onnx` model metadata — confirm at integration)
- Scoring: one claim per player per game (+100), ties broken by `claimedAt` ascending
- Game lifecycle: host-driven countdown (5-15 min), server auto-ends at expiry
- Persistence: in-memory only (no Redis, no PostgreSQL, no JWT/auth)
- Socket.io event names and payloads must match TDD §4 exactly
- All camera APIs require secure context (`https://` or `localhost`)
- `best.onnx` statically hosted at `apps/web-client/public/models/best.onnx`
- Server memory cap: 512 MB Node process
- No Turborepo — two apps, two dev commands

---

## File Structure

```
eduvision/
├── package.json                    # workspaces: ["apps/*", "packages/*"]
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── web-client/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.ts
│   │   ├── components.json         # shadcn/ui config
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── host/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [roomId]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── join/
│   │   │   │   │   └── [roomId]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── play/
│   │   │   │       └── [roomId]/
│   │   │   │           └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── QrPanel.tsx
│   │   │   │   ├── Lobby.tsx
│   │   │   │   ├── Leaderboard.tsx
│   │   │   │   ├── Countdown.tsx
│   │   │   │   └── CameraScanner.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.ts
│   │   │   │   └── useYOLOInference.ts
│   │   │   └── lib/
│   │   │       ├── socket.ts
│   │   │       └── YOLOInferenceEngine.ts
│   │   └── public/
│   │       └── models/
│   │           └── best.onnx      # provided asset
│   └── socket-server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── server.ts
│       │   ├── rooms/
│       │   │   └── RoomManager.ts
│       │   ├── handlers/
│       │   │   ├── joinHandler.ts
│       │   │   ├── hostHandler.ts
│       │   │   ├── startGameHandler.ts
│       │   │   └── claimScoreHandler.ts
│       │   └── modules.json
│       └── tests/
│           └── RoomManager.test.ts
└── packages/
    └── shared-types/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

---

### Task 1: Monorepo Scaffolding & Shared Types

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: All shared types and event contract constants (imported by Tasks 2-7)

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "eduvision",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter @eduvision/web-client dev",
    "dev:server": "pnpm --filter @eduvision/socket-server dev",
    "build": "pnpm --filter @eduvision/shared-types build && pnpm --filter @eduvision/socket-server build && pnpm --filter @eduvision/web-client build",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create `packages/shared-types/package.json`**

```json
{
  "name": "@eduvision/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 5: Create `packages/shared-types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `packages/shared-types/src/index.ts`**

```typescript
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
```

- [ ] **Step 7: Install workspace dependencies**

Run: `pnpm install`

- [ ] **Step 8: Verify shared-types compiles**

Run: `pnpm --filter @eduvision/shared-types exec tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/
git commit -m "feat: initialize monorepo scaffold with shared types"
```

---

### Task 2: Socket Server — Core & REST Endpoint

**Files:**
- Create: `apps/socket-server/package.json`
- Create: `apps/socket-server/tsconfig.json`
- Create: `apps/socket-server/src/modules.json`
- Create: `apps/socket-server/src/rooms/RoomManager.ts`

**Interfaces:**
- Consumes: `Room`, `Player`, `RoomStatus`, `GameModule`, `CreateRoomResponse` from `@eduvision/shared-types`
- Produces: `RoomManager` class with methods: `createRoom`, `getRoom`, `addPlayer`, `removePlayer`, `startGame`, `claimScore`, `getLeaderboard`, `hasPlayerClaimed`, `getRoomPlayers`

- [ ] **Step 1: Create `apps/socket-server/package.json`**

```json
{
  "name": "@eduvision/socket-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@eduvision/shared-types": "workspace:*",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "socket.io": "^4.8.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/socket-server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared-types" }
  ]
}
```

- [ ] **Step 3: Create `apps/socket-server/src/modules.json`**

```json
[
  {
    "id": 1,
    "title": "Plastic Bottle Hunt",
    "targetLabel": "plastic_bottle",
    "description": "Find and scan plastic bottles around campus to score points and clean up litter."
  }
]
```

- [ ] **Step 4: Write the failing test for RoomManager**

Create `apps/socket-server/tests/RoomManager.test.ts`:

```typescript
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

  it('should return leaderboard sorted by claimedAt', () => {
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
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd apps/socket-server
pnpm exec vitest run
```
Expected: Tests fail — `RoomManager` module not found

- [ ] **Step 6: Implement RoomManager**

Create `apps/socket-server/src/rooms/RoomManager.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, RoomStatus, LeaderboardEntry } from '@eduvision/shared-types';
import modules from '../modules.json' with { type: 'json' };

const CONFIDENCE_THRESHOLD = 0.65;

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
    });
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

  claimScore(roomId: string, playerName: string, confidenceScore: number): ClaimResult {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'ROOM_NOT_FOUND' };
    if (room.status !== 'ACTIVE') return { success: false, error: 'GAME_NOT_ACTIVE' };
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

  getRoomPlayers(roomId: string): Array<{ name: string; score: number; claimedAt: number | null }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.players.values()).map(p => ({
      name: p.name, score: p.score, claimedAt: p.claimedAt,
    }));
  }

  getModules(): Array<{ id: number; title: string; targetLabel: string; description: string }> {
    return modules;
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/socket-server && pnpm exec vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/socket-server/
git commit -m "feat: add socket server with RoomManager and unit tests"
```

---

### Task 3: Socket Server — Handlers & Express Entry

**Files:**
- Create: `apps/socket-server/src/handlers/joinHandler.ts`
- Create: `apps/socket-server/src/handlers/hostHandler.ts`
- Create: `apps/socket-server/src/handlers/startGameHandler.ts`
- Create: `apps/socket-server/src/handlers/claimScoreHandler.ts`
- Create: `apps/socket-server/src/server.ts`

**Interfaces:**
- Consumes: `RoomManager`, shared types from `@eduvision/shared-types`
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

Run: `cd apps/socket-server && timeout 5 pnpm exec tsx src/server.ts || true`
Expected: "Socket server listening on port 3001" logged

- [ ] **Step 7: Verify REST endpoint responds**

Run:
```bash
cd apps/socket-server
pnpm exec tsx src/server.ts &
sleep 2
curl -s -X POST http://localhost:3001/api/v1/rooms/create -H 'Content-Type: application/json' -d '{"moduleId":1}'
kill %1 2>/dev/null || true
```
Expected: JSON response with `success: true` and a `roomId`

- [ ] **Step 8: Commit**

```bash
git add apps/socket-server/src/
git commit -m "feat: implement WebSocket handlers and Express entry"
```

---

### Task 4: Next.js Frontend Scaffold

**Files:**
- Create: `apps/web-client/package.json`
- Create: `apps/web-client/tsconfig.json`
- Create: `apps/web-client/next.config.ts`
- Create: `apps/web-client/postcss.config.js`
- Create: `apps/web-client/tailwind.config.ts`
- Create: `apps/web-client/components.json`
- Create: `apps/web-client/src/app/layout.tsx`
- Create: `apps/web-client/src/app/page.tsx`
- Create: `apps/web-client/src/lib/socket.ts`

**Interfaces:**
- Consumes: `@eduvision/shared-types`
- Produces: Basic Next.js 16 app with Tailwind + shadcn/ui, root layout, home page, and singleton socket client

- [ ] **Step 1: Create `apps/web-client/package.json`**

```json
{
  "name": "@eduvision/web-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@eduvision/shared-types": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "socket.io-client": "^4.8.0",
    "qrcode": "^1.5.4",
    "onnxruntime-web": "^1.21.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.8.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^16.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/web-client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web-client/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web-client/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `apps/web-client/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

- [ ] **Step 6: Create `apps/web-client/components.json` for shadcn**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Create `apps/web-client/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduVision',
  description: 'Outdoor Educational Gamification with Edge AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Create CSS**

Create `apps/web-client/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 9: Create `apps/web-client/src/app/page.tsx` (home/landing)**

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">EduVision</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        Outdoor Educational Gamification with Edge AI
      </p>
      <div className="flex gap-4">
        <Link
          href="/host"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Teacher / Host
        </Link>
        <Link
          href="/join"
          className="rounded-lg border border-input bg-background px-6 py-3 font-medium hover:bg-accent transition-colors"
        >
          Student / Join
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Create `apps/web-client/src/lib/socket.ts`**

```typescript
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
```

- [ ] **Step 11: Create `apps/web-client/src/lib/utils.ts` (shadcn requirement)**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 12: Install shadcn base components**

```bash
cd apps/web-client
pnpm add clsx tailwind-merge tailwindcss-animate
pnpm exec shadcn@latest add button card input label -y
```

- [ ] **Step 13: Install dependencies**

Run: `pnpm install`

- [ ] **Step 14: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

- [ ] **Step 15: Commit**

```bash
git add apps/web-client/
git commit -m "feat: scaffold Next.js frontend with Tailwind and shadcn"
```

---

### Task 5: Frontend — Host Views (IFP Dashboard)

**Files:**
- Create: `apps/web-client/src/app/host/page.tsx`
- Create: `apps/web-client/src/app/host/[roomId]/page.tsx`
- Create: `apps/web-client/src/components/QrPanel.tsx`
- Create: `apps/web-client/src/components/Lobby.tsx`
- Create: `apps/web-client/src/components/Leaderboard.tsx`
- Create: `apps/web-client/src/components/Countdown.tsx`
- Create: `apps/web-client/src/hooks/useSocket.ts`

**Interfaces:**
- Consumes: `@eduvision/shared-types`, `getSocket` from `lib/socket.ts`
- Produces: Host flow — module selection → room creation → QR display → lobby → start game → countdown + live leaderboard

- [ ] **Step 1: Create `apps/web-client/src/hooks/useSocket.ts`**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

export function useSocket(roomId?: string) {
  const socketRef = useRef<Socket>(getSocket());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setIsConnected(true);

    return () => {
      if (roomId) {
        socket.emit('leave_room', { roomId });
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId]);

  return { socket: socketRef.current, isConnected };
}
```

- [ ] **Step 2: Create `apps/web-client/src/app/host/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MODULES = [
  {
    id: 1,
    title: 'Plastic Bottle Hunt',
    targetLabel: 'plastic_bottle',
    description: 'Find and scan plastic bottles around campus to score points and clean up litter.',
  },
];

export default function HostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createRoom = async (moduleId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'}/api/v1/rooms/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        router.push(`/host/${data.roomId}`);
      } else {
        setError('Failed to create room');
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
      <p className="text-muted-foreground mb-8">Select a learning module to start a game session</p>
      {error && <p className="text-destructive mb-4">{error}</p>}
      <div className="grid gap-4">
        {MODULES.map((mod) => (
          <Card key={mod.id}>
            <CardHeader>
              <CardTitle>{mod.title}</CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => createRoom(mod.id)} disabled={loading}>
                {loading ? 'Creating...' : 'Create Room'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `apps/web-client/src/components/QrPanel.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrPanelProps {
  joinUrl: string;
}

export default function QrPanel({ joinUrl }: QrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    });
  }, [joinUrl]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} />
      <p className="text-sm text-muted-foreground break-all text-center max-w-xs">{joinUrl}</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web-client/src/components/Lobby.tsx`**

```tsx
interface LobbyProps {
  players: Array<{ name: string; score: number; claimedAt: number | null }>;
}

export default function Lobby({ players }: LobbyProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Players Joined ({players.length})</h2>
      <ul className="grid gap-1">
        {players.map((p) => (
          <li
            key={p.name}
            className="rounded-lg border bg-card px-4 py-2 text-card-foreground"
          >
            {p.name}
          </li>
        ))}
      </ul>
      {players.length === 0 && (
        <p className="text-muted-foreground">Waiting for students to join...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web-client/src/components/Countdown.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  endsAt: number;
}

export default function Countdown({ endsAt }: CountdownProps) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="text-center">
      <p className="text-5xl font-bold tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
      <p className="text-sm text-muted-foreground">Time Remaining</p>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web-client/src/components/Leaderboard.tsx`**

```tsx
import type { LeaderboardEntry } from '@eduvision/shared-types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  const maxScore = Math.max(...entries.map(e => e.score), 1);
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Leaderboard</h2>
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div
            key={entry.playerName}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{entry.playerName}</p>
              <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(entry.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `apps/web-client/src/app/host/[roomId]/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, type LeaderboardEntry } from '@eduvision/shared-types';
import QrPanel from '@/components/QrPanel';
import Lobby from '@/components/Lobby';
import Leaderboard from '@/components/Leaderboard';
import Countdown from '@/components/Countdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Phase = 'lobby' | 'active' | 'ended';

export default function HostRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { socket, isConnected } = useSocket(roomId);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<Array<{ name: string; score: number; claimedAt: number | null }>>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(600);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomId}`
    : '';

  useEffect(() => {
    if (!socket.connected) socket.connect();
  }, [socket]);

  useEffect(() => {
    const onPlayersUpdate = (data: { players: Array<{ name: string; score: number; claimedAt: number | null }> }) => {
      setPlayers(data.players);
    };
    const onGameStarted = (data: { endsAt: number; targetLabel: string }) => {
      setPhase('active');
      setEndsAt(data.endsAt);
    };
    const onLeaderboardSync = (data: LeaderboardEntry[]) => {
      setLeaderboard(data);
    };
    const onGameEnded = (data: { leaderboard: LeaderboardEntry[] }) => {
      setPhase('ended');
      setLeaderboard(data.leaderboard);
    };

    socket.on(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
    socket.on(EVENTS.GAME_STARTED, onGameStarted);
    socket.on(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
    socket.on(EVENTS.GAME_ENDED, onGameEnded);

    socket.emit(EVENTS.HOST_JOIN, { roomId });

    return () => {
      socket.off(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
      socket.off(EVENTS.GAME_STARTED, onGameStarted);
      socket.off(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
      socket.off(EVENTS.GAME_ENDED, onGameEnded);
    };
  }, [socket, roomId]);

  const startGame = useCallback(() => {
    socket.emit(EVENTS.START_GAME_SESSION, { roomId, durationSec });
  }, [socket, roomId, durationSec]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">EduVision</h1>
        <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      <p className="text-muted-foreground mb-6">Room: <span className="font-mono text-lg">{roomId}</span></p>

      {phase === 'lobby' && (
        <div className="space-y-6">
          <QrPanel joinUrl={joinUrl} />
          <Lobby players={players} />
          <div className="space-y-2">
            <Label htmlFor="duration">Game Duration</Label>
            <Input
              id="duration"
              type="number"
              min={60}
              max={900}
              step={60}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{durationSec / 60} minutes</p>
          </div>
          <Button onClick={startGame} disabled={players.length === 0} className="w-full">
            Start Game
          </Button>
        </div>
      )}

      {phase === 'active' && endsAt && (
        <div className="space-y-6">
          <Countdown endsAt={endsAt} />
          <Leaderboard entries={leaderboard} />
        </div>
      )}

      {phase === 'ended' && (
        <div className="space-y-6">
          <div className="rounded-lg border-2 border-primary bg-card p-6 text-center">
            <h2 className="text-3xl font-bold">Game Over</h2>
          </div>
          <Leaderboard entries={leaderboard} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 8: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds with no errors

- [ ] **Step 9: Commit**

```bash
git add apps/web-client/src/app/host/ apps/web-client/src/components/QrPanel.tsx apps/web-client/src/components/Lobby.tsx apps/web-client/src/components/Leaderboard.tsx apps/web-client/src/components/Countdown.tsx apps/web-client/src/hooks/
git commit -m "feat: implement host IFP views with lobby, QR, countdown and leaderboard"
```

---

### Task 6: Frontend — Student Views (Join & Play)

**Files:**
- Create: `apps/web-client/src/app/join/[roomId]/page.tsx`
- Create: `apps/web-client/src/app/play/[roomId]/page.tsx`

**Interfaces:**
- Consumes: `@eduvision/shared-types`, `useSocket`
- Produces: Student join flow — enter nickname → join room → navigate to play view

- [ ] **Step 1: Create `apps/web-client/src/app/join/[roomId]/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS } from '@eduvision/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { socket, isConnected } = useSocket(roomId);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Please enter a nickname');
      return;
    }
    setJoining(true);
    setError('');

    if (!socket.connected) socket.connect();

    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
      setJoining(false);
      socket.off(EVENTS.ERROR_EVENT, onError);
    };

    const onPlayersUpdate = () => {
      socket.off(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
      socket.off(EVENTS.ERROR_EVENT, onError);
      router.push(`/play/${roomId}?name=${encodeURIComponent(trimmed)}`);
    };

    socket.on(EVENTS.ERROR_EVENT, onError);
    socket.on(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
    socket.emit(EVENTS.JOIN_ROOM, { roomId, playerName: trimmed });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join Room</CardTitle>
          <CardDescription>Enter a nickname to join the game</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={20}
              disabled={joining}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? 'Joining...' : 'Join Game'}
          </Button>
          {!isConnected && <p className="text-xs text-muted-foreground text-center">Connecting to server...</p>}
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Create `apps/web-client/src/app/play/[roomId]/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS } from '@eduvision/shared-types';
import CameraScanner from '@/components/CameraScanner';
import Countdown from '@/components/Countdown';
import { Button } from '@/components/ui/button';

type GamePhase = 'waiting' | 'active' | 'ended';

export default function PlayRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const playerName = searchParams.get('name') ?? '';
  const { socket, isConnected } = useSocket(roomId);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [targetLabel, setTargetLabel] = useState('');
  const [hasClaimed, setHasClaimed] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const [gameEndedData, setGameEndedData] = useState<{ leaderboard: Array<{ playerName: string; score: number }> } | null>(null);
  const hasClaimedRef = useRef(false);

  useEffect(() => {
    if (!playerName) {
      router.push(`/join/${roomId}`);
    }
  }, [playerName, roomId, router]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
  }, [socket]);

  useEffect(() => {
    const onGameStarted = (data: { endsAt: number; targetLabel: string }) => {
      setGamePhase('active');
      setEndsAt(data.endsAt);
      setTargetLabel(data.targetLabel);
    };
    const onLeaderboardSync = (data: Array<{ playerName: string; score: number; claimedAt: number | null }>) => {
      const me = data.find(e => e.playerName === playerName);
      if (me) {
        setScore(me.score);
        if (me.claimedAt !== null) {
          setHasClaimed(true);
          hasClaimedRef.current = true;
        }
      }
    };
    const onGameEnded = (data: { leaderboard: Array<{ playerName: string; score: number; claimedAt: number | null }> }) => {
      setGamePhase('ended');
      setGameEndedData({ leaderboard: data.leaderboard });
    };
    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
    };

    socket.on(EVENTS.GAME_STARTED, onGameStarted);
    socket.on(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
    socket.on(EVENTS.GAME_ENDED, onGameEnded);
    socket.on(EVENTS.ERROR_EVENT, onError);

    return () => {
      socket.off(EVENTS.GAME_STARTED, onGameStarted);
      socket.off(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
      socket.off(EVENTS.GAME_ENDED, onGameEnded);
      socket.off(EVENTS.ERROR_EVENT, onError);
    };
  }, [socket, playerName]);

  const onDetection = useCallback((confidence: number) => {
    if (hasClaimedRef.current) return;
    hasClaimedRef.current = true;
    setHasClaimed(true);
    socket.emit(EVENTS.CLAIM_SCORE, {
      roomId,
      playerName,
      confidenceScore: confidence,
      timestamp: Date.now(),
    });
  }, [socket, roomId, playerName]);

  return (
    <main className="min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">EduVision</h1>
          <span className="text-sm text-muted-foreground">Player: {playerName}</span>
        </div>

        {gamePhase === 'waiting' && (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">Waiting for the teacher to start the game...</p>
            {!isConnected && <p className="text-sm text-destructive mt-2">Connecting to server...</p>}
          </div>
        )}

        {gamePhase === 'active' && endsAt && (
          <>
            <Countdown endsAt={endsAt} />
            <p className="text-center text-sm text-muted-foreground">
              Find and scan: <span className="font-semibold text-foreground">{targetLabel}</span>
            </p>

            <CameraScanner onDetection={onDetection} disabled={hasClaimed} />

            {hasClaimed && (
              <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-300">Bottle Scanned! +100</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  You have submitted your scan. Well done!
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </>
        )}

        {gamePhase === 'ended' && (
          <div className="text-center py-8 space-y-4">
            <h2 className="text-2xl font-bold">Game Over</h2>
            <p className="text-lg">Your score: {score}</p>
            {gameEndedData && (
              <div className="space-y-1">
                <p className="font-semibold">Final Standings:</p>
                {gameEndedData.leaderboard.map((entry, i) => (
                  <p key={entry.playerName}>
                    {i + 1}. {entry.playerName} — {entry.score}
                  </p>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `apps/web-client/src/components/CameraScanner.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface CameraScannerProps {
  onDetection: (confidence: number) => void;
  disabled: boolean;
}

export default function CameraScanner({ onDetection, disabled }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 320 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        setError('Camera access denied. Please allow camera permissions.');
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleScan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || disabled) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 320, 320);
    setScanning(true);
    // Emit a simulated confidence — real YOLO inference wired in Task 7
    onDetection(0.85);
    setTimeout(() => setScanning(false), 1500);
  }, [onDetection, disabled]);

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-sm mx-auto overflow-hidden rounded-lg bg-muted">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Starting camera...</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        onClick={handleScan}
        disabled={!cameraReady || disabled || scanning}
        className="w-full"
        size="lg"
      >
        {scanning ? 'Scanning...' : disabled ? 'Already Scanned' : 'Scan Object'}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground text-center">
          You have already claimed a bottle. Great job!
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web-client/src/app/join/ apps/web-client/src/app/play/ apps/web-client/src/components/CameraScanner.tsx
git commit -m "feat: implement student join and play views with camera scanner"
```

---

### Task 7: Edge AI Integration (YOLOv8 via onnxruntime-web)

**Files:**
- Create: `apps/web-client/src/lib/YOLOInferenceEngine.ts`
- Create: `apps/web-client/src/hooks/useYOLOInference.ts`
- Modify: `apps/web-client/src/components/CameraScanner.tsx` (wire real inference)

**Interfaces:**
- Consumes: `@eduvision/shared-types`, `best.onnx` from `/models/best.onnx`
- Produces: `YOLOInferenceEngine` class for ONNX inference, `useYOLOInference` hook, fully wired CameraScanner

- [ ] **Step 1: Create `apps/web-client/src/lib/YOLOInferenceEngine.ts`**

```typescript
import * as ort from 'onnxruntime-web';

export interface InferenceResult {
  className: string;
  confidence: number;
  boundingBox: [number, number, number, number];
}

export class YOLOInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private readonly modelPath = '/models/best.onnx';
  private readonly targetDim = 320;
  private readonly labels = ['plastic_bottle'];
  private readonly confThreshold = 0.65;
  private readonly iouThreshold = 0.45;

  async initEngine(): Promise<void> {
    this.session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  async runInference(canvasElement: HTMLCanvasElement): Promise<InferenceResult[]> {
    if (!this.session) throw new Error('ONNX_SESSION_NOT_INITIALIZED');
    const ctx = canvasElement.getContext('2d');
    if (!ctx) throw new Error('CANVAS_CONTEXT_ERROR');

    const tensorInput = this.preprocessCanvasImageData(ctx);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensorInput;

    const outputMap = await this.session.run(feeds);
    const outputTensor = outputMap[this.session.outputNames[0]];
    return this.postProcessYOLOv8(outputTensor);
  }

  private preprocessCanvasImageData(ctx: CanvasRenderingContext2D): ort.Tensor {
    const imgData = ctx.getImageData(0, 0, this.targetDim, this.targetDim);
    const float32Buffer = new Float32Array(1 * 3 * this.targetDim * this.targetDim);

    let rIdx = 0;
    let gIdx = this.targetDim * this.targetDim;
    let bIdx = this.targetDim * this.targetDim * 2;
    for (let i = 0; i < imgData.data.length; i += 4) {
      float32Buffer[rIdx++] = imgData.data[i] / 255.0;
      float32Buffer[gIdx++] = imgData.data[i + 1] / 255.0;
      float32Buffer[bIdx++] = imgData.data[i + 2] / 255.0;
    }
    return new ort.Tensor('float32', float32Buffer, [1, 3, this.targetDim, this.targetDim]);
  }

  private postProcessYOLOv8(outputTensor: ort.Tensor): InferenceResult[] {
    const data = outputTensor.data as Float32Array;
    const [, channels, numAnchors] = outputTensor.dims as number[];
    const numClasses = channels - 4;

    const candidates: InferenceResult[] = [];
    for (let a = 0; a < numAnchors; a++) {
      let bestScore = 0;
      let bestClass = -1;
      for (let c = 0; c < numClasses; c++) {
        const score = data[(4 + c) * numAnchors + a];
        if (score > bestScore) { bestScore = score; bestClass = c; }
      }
      if (bestScore < this.confThreshold) continue;

      const cx = data[0 * numAnchors + a];
      const cy = data[1 * numAnchors + a];
      const w = data[2 * numAnchors + a];
      const h = data[3 * numAnchors + a];
      candidates.push({
        className: this.labels[bestClass] ?? `class_${bestClass}`,
        confidence: bestScore,
        boundingBox: [cx - w / 2, cy - h / 2, w, h],
      });
    }
    return this.nonMaxSuppression(candidates);
  }

  private nonMaxSuppression(boxes: InferenceResult[]): InferenceResult[] {
    const sorted = boxes.sort((a, b) => b.confidence - a.confidence);
    const kept: InferenceResult[] = [];
    for (const box of sorted) {
      if (kept.every((k) => this.iou(k.boundingBox, box.boundingBox) < this.iouThreshold)) {
        kept.push(box);
      }
    }
    return kept;
  }

  private iou(a: number[], b: number[]): number {
    const [ax, ay, aw, ah] = a;
    const [bx, by, bw, bh] = b;
    const x1 = Math.max(ax, bx);
    const y1 = Math.max(ay, by);
    const x2 = Math.min(ax + aw, bx + bw);
    const y2 = Math.min(ay + ah, by + bh);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const union = aw * ah + bw * bh - inter;
    return union <= 0 ? 0 : inter / union;
  }
}
```

- [ ] **Step 2: Create `apps/web-client/src/hooks/useYOLOInference.ts`**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { YOLOInferenceEngine, type InferenceResult } from '@/lib/YOLOInferenceEngine';

export function useYOLOInference() {
  const engineRef = useRef<YOLOInferenceEngine | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const engine = new YOLOInferenceEngine();
      try {
        setLoadingProgress(10);
        await engine.initEngine();
        if (cancelled) return;
        setLoadingProgress(100);
        engineRef.current = engine;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load YOLO model:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const runInference = async (canvas: HTMLCanvasElement): Promise<InferenceResult[]> => {
    if (!engineRef.current) throw new Error('Engine not loaded');
    return engineRef.current.runInference(canvas);
  };

  return { isLoaded, loadingProgress, runInference };
}
```

- [ ] **Step 3: Modify `apps/web-client/src/components/CameraScanner.tsx` to wire real inference**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useYOLOInference } from '@/hooks/useYOLOInference';
import { Button } from '@/components/ui/button';

interface CameraScannerProps {
  onDetection: (confidence: number) => void;
  disabled: boolean;
}

export default function CameraScanner({ onDetection, disabled }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const { isLoaded, loadingProgress, runInference } = useYOLOInference();

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 320 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        setError('Camera access denied. Please allow camera permissions.');
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || disabled) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 320, 320);
    setScanning(true);

    try {
      const results = await runInference(canvas);
      const plasticBottle = results.find(
        r => r.className === 'plastic_bottle' && r.confidence >= 0.65
      );
      if (plasticBottle) {
        onDetection(plasticBottle.confidence);
      } else {
        setError('No plastic bottle detected. Try again.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Inference failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [onDetection, disabled, runInference]);

  if (!isLoaded) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading AI model ({loadingProgress}%)...</p>
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${loadingProgress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-sm mx-auto overflow-hidden rounded-lg bg-muted">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Starting camera...</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        onClick={handleScan}
        disabled={!cameraReady || disabled || scanning}
        className="w-full"
        size="lg"
      >
        {scanning ? 'Scanning...' : disabled ? 'Already Scanned' : 'Scan Object'}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground text-center">
          You have already claimed a bottle. Great job!
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Copy the provided model file**

```bash
copy D:\Project\Web Project\Enuma\EduVision\best.onnx apps\web-client\public\models\best.onnx
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web-client/src/lib/YOLOInferenceEngine.ts apps/web-client/src/hooks/useYOLOInference.ts apps/web-client/src/components/CameraScanner.tsx apps/web-client/public/models/best.onnx
git commit -m "feat: integrate YOLOv8 inference with onnxruntime-web"
```

---

### Task 8: Integration Test & Final Verification

**Files:**
- Create: `apps/socket-server/tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `apps/socket-server/tests/integration.test.ts`:

```typescript
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
  let roomId: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const app = express();
      app.use(cors());
      app.use(express.json());
      const roomManager = new RoomManager();

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
        ]).then(() => resolve());
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

      hostSocket.emit(EVENTS.HOST_JOIN, { roomId: 'TEST001' });
      playerSocket.emit(EVENTS.JOIN_ROOM, { roomId: 'TEST001', playerName: 'Diaz' });

      // Wait for player to appear in lobby
      hostSocket.on(EVENTS.ROOM_PLAYERS_UPDATE, (data) => {
        if (data.players.length === 1 && data.players[0].name === 'Diaz') {
          hostSocket.emit(EVENTS.START_GAME_SESSION, { roomId: 'TEST001', durationSec: 30 });
        }
      });

      playerSocket.on(EVENTS.GAME_STARTED, () => {
        playerSocket.emit(EVENTS.CLAIM_SCORE, {
          roomId: 'TEST001',
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
```

- [ ] **Step 2: Run integration test**

Run: `cd apps/socket-server && pnpm exec vitest run`
Expected: All tests pass (unit + integration)

- [ ] **Step 3: Verify both apps start together**

Run in separate terminals:
```bash
# Terminal 1
cd apps/socket-server && pnpm exec tsx src/server.ts

# Terminal 2
cd apps/web-client && pnpm exec next dev
```

Expected: Server on :3001, web client on :3000

- [ ] **Step 4: Run lint across the project**

Run: `pnpm -r lint`
Expected: No lint errors

- [ ] **Step 5: Commit**

```bash
git add apps/socket-server/tests/
git commit -m "test: add integration test for full game flow"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ FR-1.1: Room creation with module selection (Task 2, 5)
- ✅ FR-1.2: QR Code generation with join URL (Task 5 — QrPanel)
- ✅ FR-1.3: Real-time lobby updates (Task 3, 5)
- ✅ FR-2.1: QR Code scanning for onboarding (Task 6 — join page)
- ✅ FR-2.2: Nickname-only join, unique per room (Task 3, 6)
- ✅ FR-3.1: Camera permission via HTTPS (Task 7 — CameraScanner)
- ✅ FR-3.2: Canvas frame capture on scan button (Task 7)
- ✅ FR-3.3: 320x320 downscale (Task 7 — YOLOInferenceEngine)
- ✅ FR-3.4: Model detection with C≥0.65 (Task 7)
- ✅ FR-4.1: Leaderboard on IFP (Task 5)
- ✅ FR-4.2: Animated leaderboard bars (Task 5 — Leaderboard component)
- ✅ FR-4.3: One claim per player, +100, sorted by claimTime (Task 2)
- ✅ FR-5.1: Countdown duration selection (Task 5)
- ✅ FR-5.2: game_started event with endsAt (Task 3)
- ✅ FR-5.3: Server auto-ends at expiry (Task 3)
- ✅ Edge AI: YOLOv8 preprocessing, NMS, confidence thresholding (Task 7)

**2. Placeholder scan:** No TBD, TODOs, or placeholder patterns found.

**3. Type consistency:** All types, method signatures, and event payloads match across tasks and align with the TDD §4 contract.
