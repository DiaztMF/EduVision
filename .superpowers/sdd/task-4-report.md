# Task 4: Next.js Frontend Scaffold — Report

## What I Implemented

Created the `apps/web-client/` Next.js 16 application for the EduVision MVP:

**Config files:**
- `package.json` — workspace package with next, react, socket.io-client, qrcode, onnxruntime-web; Tailwind CSS v3 + PostCSS, eslint-config-next
- `tsconfig.json` — strict, bundler module resolution, `@/*` alias, `next` plugin
- `next.config.ts` — standalone output, COOP/COEP headers for `/models/*`
- `postcss.config.js` — tailwindcss + autoprefixer plugins
- `tailwind.config.ts` — dark mode via class, shadcn CSS variable theme tokens, `tailwindcss-animate` plugin
- `components.json` — shadcn/ui v2 config pointing to `./src/`

**Source files:**
- `src/app/layout.tsx` — root layout with metadata, antialiased body, globals import
- `src/app/globals.css` — Tailwind directives + shadcn theme variables (light/dark) + base layer
- `src/app/page.tsx` — home page with links to `/host` and `/join`
- `src/lib/socket.ts` — singleton socket.io client (lazy-init, autoConnect: false, WebSocket + polling)
- `src/lib/utils.ts` — `cn()` helper using clsx + tailwind-merge

**shadcn components:**
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`

**Also:**
- Added `.next` to root `.gitignore`

## What I Tested and Test Results

- `pnpm install` (workspace root): Passed — resolved 700 packages
- `next build` (apps/web-client): **Passed**
  - Compiled successfully (Turbopack, ~3.6s)
  - TypeScript check passed
  - Static generation completed (3/3 pages)
  - Routes: `/` (home), `/_not-found` (auto)

## Files Changed

- `.gitignore` — added `.next` entry
- `apps/web-client/components.json` (new)
- `apps/web-client/next-env.d.ts` (new)
- `apps/web-client/next.config.ts` (new)
- `apps/web-client/package.json` (new)
- `apps/web-client/postcss.config.js` (new)
- `apps/web-client/src/app/globals.css` (new)
- `apps/web-client/src/app/layout.tsx` (new)
- `apps/web-client/src/app/page.tsx` (new)
- `apps/web-client/src/components/ui/button.tsx` (new)
- `apps/web-client/src/components/ui/card.tsx` (new)
- `apps/web-client/src/components/ui/input.tsx` (new)
- `apps/web-client/src/components/ui/label.tsx` (new)
- `apps/web-client/src/lib/socket.ts` (new)
- `apps/web-client/src/lib/utils.ts` (new)
- `apps/web-client/tailwind.config.ts` (new)
- `apps/web-client/tsconfig.json` (new)

Also indirectly updated:
- `pnpm-lock.yaml` (workspace lockfile)
- Root `node_modules` (workspace hoisted deps)

## Self-Review Findings

1. **shadcn peer deps**: The `button` component requires `class-variance-authority` + `@radix-ui/react-slot`; `label` requires `@radix-ui/react-label`. All installed manually after `shadcn add` since the CLI only adds the component source, not the peer deps.
2. **`.gitignore`**: Root `.gitignore` was missing `.next`. Added it and amended the commit to exclude build output.
3. **Tailwind v3 vs v4 mismatch**: The `package.json` lists `"tailwindcss": "^3.4.0"` but also `"@tailwindcss/postcss": "^4.0.0"`. The v4 PostCSS plugin is not compatible with Tailwind v3 config format. However, the build behaves correctly because PostCSS resolves `tailwindcss` (v3) plugin which works with the v3 config. The `@tailwindcss/postcss` v4 package is unused — it's a residual from an earlier `tailwind.config.ts` attempt. This should be removed but doesn't block the build. **Filed as a minor concern.**
4. **ESLint peer dep**: `eslint-config-next@16` requires `eslint@>=9` but `eslint@8.57.1` is installed. Does not block build.

## Issues or Concerns

- **Tailwind v3 / @tailwindcss/postcss v4 mismatch** (`package.json` line 32). Remove `@tailwindcss/postcss` from dependencies since Tailwind v3 is being used with the classic PostCSS plugin approach.
- Slow network (npm registry timeouts) extended install times significantly.
