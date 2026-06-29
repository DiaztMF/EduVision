### Task 5: Frontend — Host Views (IFP Dashboard)

**Files:**
- Create: `apps/web-client/src/app/host/page.tsx`
- Create: `apps/web-client/src/app/host/[roomId]/page.tsx`
- Create: `apps/web-client/src/components/QrPanel.tsx`
- Create: `apps/web-client/src/components/Lobby.tsx`
- Create: `apps/web-client/src/components/Leaderboard.tsx`
- Create: `apps/web-client/src/components/Countdown.tsx`
- Create: `apps/web-client/src/hooks/useSocket.ts`

All file contents are in the plan. Create them exactly as specified. Then verify `next build` succeeds and commit.

Create `apps/web-client/src/hooks/useSocket.ts`:

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
    if (!socket.connected) { socket.connect(); }
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setIsConnected(true);
    return () => {
      if (roomId) { socket.emit('leave_room', { roomId }); }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId]);
  return { socket: socketRef.current, isConnected };
}
```

Create `apps/web-client/src/app/host/page.tsx` — teacher selects module, creates room, navigates to host/[roomId].

Create `apps/web-client/src/components/QrPanel.tsx` — renders QR code from join URL.

Create `apps/web-client/src/components/Lobby.tsx` — displays joined players list.

Create `apps/web-client/src/components/Countdown.tsx` — synchronized countdown from endsAt.

Create `apps/web-client/src/components/Leaderboard.tsx` — sorted leaderboard with score bars.

Create `apps/web-client/src/app/host/[roomId]/page.tsx` — lobby/QR view, game countdown + leaderboard, game over state.

All component code is in the plan at docs/superpowers/plans/2026-06-29-eduvision-mvp.md lines 1186-1583.

**Step: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

**Step: Commit**

```bash
git add apps/web-client/src/app/host/ apps/web-client/src/components/QrPanel.tsx apps/web-client/src/components/Lobby.tsx apps/web-client/src/components/Leaderboard.tsx apps/web-client/src/components/Countdown.tsx apps/web-client/src/hooks/
git commit -m "feat: implement host IFP views with lobby, QR, countdown and leaderboard"
```
