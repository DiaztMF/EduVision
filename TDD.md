# Technical Design Document (TDD)

**Project Name:** EduVision – Web-Based Outdoor Educational Gamification with Edge AI

**Document Version:** v1.1 (reconciled with design decisions)

**Date:** 2026-06-29

**Status:** Approved for implementation

**Author:** Diazt Muhammad Firmansyah

> **What changed in v1.1:** The data layer is now **in-memory only** (Redis/PostgreSQL removed from the MVP), **no authentication** (JWT/users table removed), the target class is **`plastic_bottle`**, the WebSocket contract gained `game_started` / `game_ended` / `error_event` plus a countdown `durationSec`, scoring is **one claim per player**, and the YOLOv8 **NMS post-processing is now fully specified**.

---

## 1. System Architecture Diagram & Component Flow

A decoupled **monorepo**: persistent client-side views are isolated from the stateful, low-latency real-time orchestration. The server keeps all game state in process memory — no external datastore.

```text
                +---------------------------+        +---------------------------+
                |   Browser: Host / IFP     |        |  Browser: Student Mobile  |
                |       (Next.js 16)        |        |       (Next.js 16)        |
                +-------------+-------------+        +-------------+-------------+
                              |  ^                                 |  ^
        1. POST /rooms/create |  | 4. WSS live updates             |  | WSS
           (REST, no auth)    |  |    (players / leaderboard /     |  |
                              v  |     game_started / game_ended)  v  |
                +-------------+--+---------------------------------+--+-------------+
                |                  Node.js + Express + Socket.io                   |
                |          RoomManager  ->  in-memory Map<roomId, Room>            |
                |          modules.json (seeded game modules)                     |
                +-----------------------------------------------------------------+

   Edge AI runs entirely on each student device — frames never leave the phone:
```

### Edge Computational Isolation (Student Device)

Image frames bypass network upload entirely:

$$\text{Video Input Stream} \xrightarrow{\text{Canvas API (320×320)}} \text{Tensor} \xrightarrow{\text{onnxruntime-web}} \text{Local Inference (plastic\_bottle)}$$

The mobile client only transmits a small structured `claim_score` text payload to the server upon a valid match, cutting uplink bandwidth to near zero.

---

## 2. Monorepo Directory Structure

Managed via **pnpm workspaces** (no Turborepo for the MVP).

```text
eduvision/
├── package.json                 # workspace root scripts
├── pnpm-workspace.yaml          # workspace globs (apps/*, packages/*)
├── tsconfig.base.json           # shared TS config
├── apps/
│   ├── web-client/              # Frontend (Next.js 16, App Router)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── host/page.tsx            # select module -> create room
│   │   │   │   ├── host/[roomId]/page.tsx   # QR + lobby + start + leaderboard + countdown
│   │   │   │   ├── join/[roomId]/page.tsx   # enter nickname
│   │   │   │   └── play/[roomId]/page.tsx   # camera + scan
│   │   │   ├── components/      # QrPanel, Lobby, Leaderboard, CameraScanner, Countdown
│   │   │   ├── hooks/           # useSocket, useYOLOInference
│   │   │   └── lib/             # socket client, YOLOInferenceEngine
│   │   └── public/
│   │       └── models/
│   │           └── best.onnx    # YOLOv8n (~11.6 MB), statically hosted
│   └── socket-server/           # Backend (Node.js + TypeScript)
│       ├── src/
│       │   ├── server.ts        # Express entry + Socket.io binding + REST create
│       │   ├── rooms/
│       │   │   └── RoomManager.ts  # in-memory room lifecycle, timer, scoring
│       │   ├── handlers/        # socket event handlers (join, start, claim, ...)
│       │   └── modules.json     # seeded game modules
│       └── tests/               # RoomManager unit + socket integration (Vitest)
└── packages/
    └── shared-types/            # Synchronized TypeScript definitions
        └── index.ts             # Room, Player, Module, event names + payloads
```

---

## 3. In-Memory State Model

The MVP has **no database**. The server is the single source of truth, holding state in process memory; game modules are seeded from JSON. Players are keyed by **nickname** (not socket id) so a flaky mobile reconnect keeps its score.

### Core types (`packages/shared-types`)

```typescript
export type RoomStatus = 'LOBBY' | 'ACTIVE' | 'ENDED';

export interface Player {
  name: string;
  score: number;          // 0 or 100 in the MVP
  claimedAt: number | null; // epoch ms of the winning scan; null if not yet claimed
  connected: boolean;
}

export interface GameModule {
  id: number;
  title: string;          // e.g. "Plastic Bottle Hunt"
  targetLabel: string;    // e.g. "plastic_bottle"
  description: string;
}

export interface Room {
  id: string;             // e.g. "7892"
  moduleId: number;
  targetLabel: string;
  status: RoomStatus;
  players: Map<string, Player>;
  endsAt: number | null;  // epoch ms when the countdown expires
}
```

### Seeded modules (`apps/socket-server/src/modules.json`)

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

> **Trade-off:** in-memory state is wiped on server restart. Acceptable for sessions that last minutes. The upgrade path (Redis for state, PostgreSQL for history) is documented in PRD §9 and isolated behind `RoomManager`, so it can be swapped without touching handlers.

---

## 4. API & WebSocket Event Contract

### HTTP REST Endpoint (Room Creation — no auth)

#### Create Room Session

- **Method / Route:** `POST /api/v1/rooms/create`
- **Headers:** `Content-Type: application/json` *(no `Authorization` — auth is out of scope)*
- **Request Body:**
```json
{ "moduleId": 1 }
```
- **Response Payload (`201 Created`):**
```json
{
  "success": true,
  "roomId": "7892",
  "targetLabel": "plastic_bottle",
  "moduleTitle": "Plastic Bottle Hunt",
  "createdAt": "2026-06-29T15:00:00Z"
}
```

---

### WebSocket Protocols (Socket.io Channels)

All event names and payload shapes live in `packages/shared-types` and are imported by both apps.

#### Phase 1: Connection & Lobby

* `host_join` *(Host → Server)* — host subscribes to its room's broadcasts.
```json
{ "roomId": "7892" }
```

* `join_room` *(Client → Server)*
```json
{ "roomId": "7892", "playerName": "Diaz" }
```

* `room_players_update` *(Server → Room)*
```json
{ "players": [ { "name": "Diaz", "score": 0, "claimedAt": null } ] }
```

#### Phase 2: Game Flow & Evaluation

* `start_game_session` *(Host → Server)* — `durationSec` is the countdown length.
```json
{ "roomId": "7892", "durationSec": 600 }
```

* `game_started` *(Server → Room)* — clients compute the countdown locally from `endsAt`.
```json
{ "endsAt": 1782719298000, "targetLabel": "plastic_bottle" }
```

* `claim_score` *(Client → Server)* — sent only when local inference yields `C ≥ 0.65`.
```json
{ "roomId": "7892", "playerName": "Diaz", "confidenceScore": 0.87, "timestamp": 1782718698000 }
```

* `leaderboard_sync` *(Server → Room)* — sorted: claimers by `claimedAt` ascending, then non-claimers.
```json
[
  { "playerName": "Diaz", "score": 100, "claimedAt": 1782718698000 },
  { "playerName": "Amelia", "score": 0, "claimedAt": null }
]
```

* `game_ended` *(Server → Room)* — emitted when the timer expires.
```json
{ "leaderboard": [ { "playerName": "Diaz", "score": 100, "claimedAt": 1782718698000 } ] }
```

* `error_event` *(Server → Client)* — directed error feedback.
```json
{ "code": "ALREADY_CLAIMED", "message": "You have already scored this game." }
```

**Server-side validation for `claim_score`:** the room must exist and be `ACTIVE`, the player must not have claimed yet, and `confidenceScore ≥ 0.65`. On success the server sets `score = 100`, stamps `claimedAt`, and broadcasts `leaderboard_sync`. Otherwise it emits `error_event` (`ROOM_NOT_FOUND` | `GAME_NOT_ACTIVE` | `ALREADY_CLAIMED` | `LOW_CONFIDENCE`). The server never trusts the client's score — only the confidence claim, which it re-checks against the threshold.

---

## 5. Machine Learning WebAssembly Inference Pipeline

The runtime initializes onnxruntime-web against the statically hosted model and runs entirely on the device's graphics/CPU layer. `executionProviders` prefers `webgpu` for acceleration and falls back to `wasm` (the guaranteed baseline that keeps within the <50 MB RAM budget).

```typescript
import * as ort from 'onnxruntime-web';

interface InferenceResult {
  className: string;
  confidence: number;
  boundingBox: [number, number, number, number]; // x, y, w, h (top-left, in 320px space)
}

export class YOLOInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private readonly modelPath = '/models/best.onnx';
  private readonly targetDim = 320;
  // Canonical class list. Confirm against the model's exported metadata at integration.
  private readonly labels = ['plastic_bottle'];
  private readonly confThreshold = 0.65; // matches FR-3.4 (C >= 0.65)
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

    // Channel-first (NCHW): split interleaved RGBA into planar R, G, B normalized to [0,1].
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

  // YOLOv8 output is [1, 4 + numClasses, numAnchors] (transposed layout).
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

The success rule (FR-3.4): a detection of `plastic_bottle` with `confidence ≥ 0.65` triggers a single `claim_score` emit; the client disables further scanning once the player has claimed.

---

## 6. Infrastructure & Deployment Environment

* **Networking:** Host domains must enforce TLS. Secure contexts (`https://`, `wss://`) are mandatory for `navigator.mediaDevices.getUserMedia` camera access. For phone testing during development, front the dev servers with a tunnel (e.g., ngrok) or a LAN certificate; `localhost` is a secure context for desktop testing.
* **Server Footprint:** The backend coordinates events only (no media compute) and holds all state in memory. A single-core Node process with memory capped at **512 MB** runs comfortably on an entry-level cloud instance for a 40-player classroom. No Redis/PostgreSQL services are provisioned for the MVP.
* **Model Hosting:** `best.onnx` is served as a static asset from `apps/web-client/public/models/` and cached by the browser after first load (~11.6 MB).
