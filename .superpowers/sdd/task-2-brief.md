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

Run: `cd apps/socket-server && pnpm exec vitest run`
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
