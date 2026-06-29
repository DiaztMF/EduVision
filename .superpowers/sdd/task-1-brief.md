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
