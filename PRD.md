# Product Requirement Document (PRD)

**Project Name:** EduVision – Web-Based Outdoor Educational Gamification with Edge AI

**Document Version:** v1.1 (MVP – reconciled with design decisions)

**Date:** 2026-06-29

**Status:** Approved for implementation

> **What changed in v1.1:** Target object switched from thorny plants to **plastic bottles** (matching the trained model). Teacher authentication dropped, persistence reduced to **in-memory only** (Redis/PostgreSQL deferred), scoring fixed to **one claim per player per game**, and an explicit **countdown timer** game lifecycle added. See §9 for the full decision log.

---

## 1. Executive Summary & Background

Traditional outdoor learning activities are highly effective for environmental education but often lack engagement and present tracking challenges for educators. **EduVision** bridges this gap by synchronizing a central **Interactive Flat Panel (IFP)** dashboard inside the classroom with **students' smartphones** in the field.

Through real-time gamification and localized machine learning (Edge AI), students hunt for **plastic bottles / plastic waste** around the school campus, instantly verify them via their mobile browser cameras, and watch their scores update dynamically on the classroom's leaderboard. The plastic-waste theme doubles as a **litter cleanup & recycling-awareness** lesson — turning a campus tidy-up into a competitive game.

## 2. Product Objectives & Success Metrics

- **Enhance Engagement:** Transform outdoor observations into an interactive, competitive edugame.
- **Zero-Server-Cost Verification:** Use client-side Edge AI for image recognition to save school server infrastructure costs and students' mobile data.
- **Instant Feedback Loop:** Maintain sub-second score synchronization between field actions and classroom visualizations.
- **Metrics:**
  - Sustained connection for up to 40 concurrent players per game room.
  - Object-detection inference time under 200 ms on standard smartphones.

---

## 3. User Personas

1. **Teacher (Host):** Manages game sessions from the classroom IFP, selects a learning module, starts/ends the game, and monitors progress. **No login required** for the MVP.
2. **Student (Player):** Participates using a mobile smartphone browser, hunts for plastic bottles, and scans them with the built-in AI camera. Joins with a nickname only.

---

## 4. Technical Architecture Overview (Tech Stack)

The project is a **monorepo** (managed via **pnpm workspaces**) keeping a clean boundary between the frontend and the real-time backend. Turborepo is intentionally omitted for the MVP — two apps run fine with two dev commands.

- **Frontend (`apps/web-client`):** **Next.js 16 (App Router)** + **Tailwind CSS + shadcn/ui**. Serves both the cinematic IFP dashboard and the mobile-responsive student interface.
- **Real-Time Server (`apps/socket-server`):** **Node.js + Express + Socket.io**. Holds the **authoritative game state in memory** and brokers all real-time events. (Express, not NestJS — this is a lightweight socket relay.)
- **State Management:** **In-memory only** (a single Node process holds room/player/score state in a `Map`). Game modules are **seeded from a JSON file**. Redis and PostgreSQL are **deferred** (see §9) — a single classroom session of ≤40 players on one VPS does not need them.
- **Edge AI Inference Engine:** A custom-trained **YOLOv8-nano** model exported to `best.onnx` (~11.6 MB), executed client-side in the student's browser via **`onnxruntime-web`**. The model recognizes the `plastic_bottle` class.
- **Shared code (`packages/shared-types`):** TypeScript interfaces for rooms, players, and the event contract, imported by both apps.

---

## 5. Functional Requirements

### Module 1: Room Creation & Lobby Management (Host/IFP View)

- **FR-1.1:** A teacher can start a new game room by selecting a **seeded educational module** (e.g., "Plastic Bottle Hunt"). No login is required.
- **FR-1.2:** The system generates a unique, short-lived `Room ID` and renders a dynamic **QR Code** containing the join URL (e.g., `https://domain.com/join/ROOM_ID`).
- **FR-1.3:** The IFP lobby updates in real-time as students join, displaying their nicknames without page refreshes.

### Module 2: Player Onboarding (Client/Mobile View)

- **FR-2.1:** Students are onboarded instantly by scanning the IFP's QR Code with their smartphone's native camera.
- **FR-2.2:** Students join by entering a display **nickname only** — no email registration or password. Nicknames must be unique within a room.

### Module 3: Edge AI Object Scanner (Client/Mobile View)

- **FR-3.1:** The web app must securely request back-camera permissions from the browser (strict requirement: secure **HTTPS** context).
- **FR-3.2:** A capture mechanism streams a video frame into an HTML5 Canvas upon tapping the **"Scan Object"** button.
- **FR-3.3:** The canvas downscales the image to **320 × 320** pixels before feeding it into the locally cached `onnxruntime-web` execution layer.
- **FR-3.4:** If the YOLO model detects the target class `plastic_bottle` with a confidence score **C ≥ 0.65**, the client emits a `claim_score` payload to the server.

### Module 4: Real-Time Live Leaderboard (Host/IFP View)

- **FR-4.1:** The central IFP screen features a visually engaging leaderboard sorting students by score.
- **FR-4.2:** Upon receiving verified score events from the server, leaderboard bars instantly animate and re-rank.
- **FR-4.3:** **Scoring rule** — each player may **claim once per game** for **+100 points**. Because a class detector cannot distinguish one bottle from another, a single claim per player is the anti-farming rule. Since every score is therefore 0 or 100, ties are broken by **claim time** (the earliest scanner ranks higher).

### Module 5: Game Lifecycle & Timer (Host/IFP View)

- **FR-5.1:** The host starts the game with a chosen **countdown duration** (e.g., 5–15 minutes).
- **FR-5.2:** The server broadcasts a `game_started` event carrying an `endsAt` timestamp; all clients render a synchronized countdown computed locally from `endsAt` (no per-second network chatter).
- **FR-5.3:** The server **auto-ends** the game at expiry and broadcasts final standings (`game_ended`). Scans submitted after the game ends are rejected.

---

## 6. Non-Functional Requirements (NFRs)

- **Security:** Full SSL/TLS across the platform (**HTTPS** for web assets, **WSS** for WebSocket connections) to satisfy browser camera-privacy rules. For phone testing during development, use a tunnel (e.g., ngrok) or a LAN certificate; `localhost` is already a secure context for desktop testing.
- **Performance & Latency:** Cross-network event dispatch (Student → Server → IFP) must stay within a **< 1.5-second** threshold.
- **Resource Management (client):** ONNX runtime memory inside mobile browsers must stay **under ~50 MB RAM** to avoid crashes on entry-level phones. The `wasm` execution provider is the guaranteed baseline; `webgpu` is used when available for acceleration.
- **Server Scalability:** Since AI inference is fully offloaded to clients, the server only coordinates events. A minimal **single-core VPS (1 vCPU, 1–2 GB RAM)** comfortably handles a 40-player classroom; Node memory is capped at **512 MB**.

---

## 7. User Journey & Sequence Flowchart

```text
[Teacher @ IFP]                  [Student @ Mobile]              [Socket Server (in-memory)]
       |                                  |                               |
       |--- 1. Select module, create room (REST) --------------------->   |
       |<-- 2. roomId + targetLabel ----------------------------------    |
       |--- 3. host_join, render Lobby & QR Code                          |
       |                                  |--- 4. Scan QR & input name -->|
       |                                  |--- 5. emit 'join_room' ------>|
       |<-- 6. 'room_players_update' (player appears in lobby) -----------|
       |                                  |                               |
       |--- 7. 'start_game_session' (durationSec) -------------------->   |
       |<-- 8. 'game_started' { endsAt, targetLabel } (to all) ----------|
       |                                  |--- 9. Camera + local Edge AI  |
       |                                  |--- 10. (if C>=0.65 & unclaimed) emit 'claim_score' ->|
       |<-- 11. 'leaderboard_sync' (re-ranks by claim time) -------------|
       |<-- 12. 'game_ended' { final leaderboard } (timer expires) ------|
```

---

## 8. Development Milestones & Implementation Schedule

> The YOLOv8-nano model is **already trained and provided** (`best.onnx`), so the original "AI pipeline engineering" milestone is complete. Remaining work is integration.

- **Milestone 1 — Monorepo Setup & Real-Time Sync Engine**
  Configure pnpm workspace + `shared-types`, stand up the Express + Socket.io server with in-memory `RoomManager`, and build the Next.js host/student UI scaffold with live lobby and leaderboard sync.
- **Milestone 2 — Edge AI Integration**
  Embed `onnxruntime-web` + the Canvas capture pipeline, implement YOLOv8 preprocessing and **NMS post-processing**, wire confidence thresholding, and tune under real-world lighting.
- **Milestone 3 — Game Lifecycle & Acceptance Testing**
  Implement the countdown timer, one-claim scoring, end-game flow, and run end-to-end integration/stress checks for a full 40-player classroom.

---

## 9. Design Decisions & Out of Scope

**Decisions locked during brainstorming (2026-06-29):**

| Area | Decision |
|------|----------|
| Build scope | Full MVP end-to-end, including real `onnxruntime-web` inference |
| ML model | Provided by the team (`best.onnx`, YOLOv8n, `plastic_bottle` class) |
| Teacher auth | None — anyone can open the host view and create a room |
| Persistence | In-memory only; modules seeded from JSON |
| Scoring | One claim per player per game, +100, ranked by claim time |
| Game end | Countdown timer; server auto-ends |
| Backend | Express + Socket.io (not NestJS) |
| Monorepo | pnpm workspaces (no Turborepo) |

**Out of scope for the MVP (deferred):**

- Teacher accounts / authentication / JWT
- Redis ephemeral cache and PostgreSQL (Neon) historical persistence
- Module-authoring UI (modules are seeded in JSON)
- Multiple target labels per game
- Cooldown- or confidence-weighted scoring (multi-claim variants)
- Horizontal scaling / multi-process server

> **Integration note:** the exact class-name string emitted by `best.onnx` must be confirmed at integration time (e.g., `plastic_bottle` vs `bottle`); the documented `plastic_bottle` label is the canonical value and the code reads the model's own class list.
