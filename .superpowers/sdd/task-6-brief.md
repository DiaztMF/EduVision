### Task 6: Frontend — Student Views (Join & Play)

**Files:**
- Create: `apps/web-client/src/app/join/[roomId]/page.tsx`
- Create: `apps/web-client/src/app/play/[roomId]/page.tsx`
- Create: `apps/web-client/src/components/CameraScanner.tsx`

All file contents are in the plan. Create them exactly as specified. Then verify `next build` succeeds and commit.

Create `apps/web-client/src/app/join/[roomId]/page.tsx` — student enters nickname and joins room.
Create `apps/web-client/src/app/play/[roomId]/page.tsx` — camera view, scanning, score display, game over state.
Create `apps/web-client/src/components/CameraScanner.tsx` — camera access with canvas capture and simulated inference.

All component code is in the plan at docs/superpowers/plans/2026-06-29-eduvision-mvp.md lines 1587-1920.

**Step: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

**Step: Commit**

```bash
git add apps/web-client/src/app/join/ apps/web-client/src/app/play/ apps/web-client/src/components/CameraScanner.tsx
git commit -m "feat: implement student join and play views with camera scanner"
```
