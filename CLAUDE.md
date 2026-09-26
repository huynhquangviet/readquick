# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Product:** readquick is a phone-first web app where a signed-in user uploads a Document (PDF, EPUB, MOBI, TXT) and reads it one Word at a time at a fixed Focus point. The domain language is in `CONTEXT.md`; use those terms in code, tests and issues. The full spec is GitHub issue #1 (`gh issue view 1`). None of it is built yet.

**Code today:** an unmodified copy of the Supabase "Next.js + Supabase Starter Kit" (`create-next-app --example with-supabase`), named `readquick`. Next.js App Router + React 19 + TypeScript (strict), Tailwind CSS 3, shadcn/ui (new-york style, Radix + lucide), Supabase Auth via cookies (`@supabase/ssr`). Starter/tutorial UI (`components/tutorial/*`, `deploy-button`, `hero`, `next-logo`, `supabase-logo`, `env-var-warning`, and the `hasEnvVars` checks) is placeholder and meant to be removed as the real app is built.

## Commands

```bash
npm run dev     # next dev, http://localhost:3000
npm run build   # next build
npm run start   # next start (after build)
npm run lint    # eslint . (next/core-web-vitals + next/typescript, flat config)
```

There is no test runner configured, and no lockfile is committed. Dependencies `next`, `@supabase/ssr` and `@supabase/supabase-js` are pinned to `latest`.

Setup: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a legacy anon key also works in that variable).

## Architecture

**Auth/session flow spans several files:**
- `proxy.ts` (root) is the Next.js 16 replacement for `middleware.ts`. It exports `proxy()` and delegates to `updateSession()` in `lib/supabase/proxy.ts`, which refreshes the Supabase session cookies on every matched request and redirects unauthenticated users to `/auth/login`. Exempt paths: `/`, `/login*`, `/auth*`. Any new public route must be added to that allowlist or it will redirect.
- In `updateSession`, do not put code between `createServerClient(...)` and `supabase.auth.getClaims()`, and always return the `supabaseResponse` object as-is (or copy its cookies), otherwise sessions get dropped. The comments in the file explain this.
- `lib/supabase/server.ts` (`createClient()`, async, for Server Components / Route Handlers / Actions) and `lib/supabase/client.ts` (`createClient()`, for Client Components) are the two Supabase entry points. Always create a new client per call; never store one in a module-level variable (Fluid compute).
- Auth pages are under `app/auth/*` (login, sign-up, forgot/update-password, error, sign-up-success). `app/auth/confirm/route.ts` handles the email OTP link (`verifyOtp` with `token_hash` + `type`, then redirects to `next`). The corresponding forms are client components in `components/*-form.tsx`.
- `app/protected/*` is the example gated area; gating is enforced by the proxy, not by the layout.
- User info is read with `supabase.auth.getClaims()` (see `components/auth-button.tsx`), not `getUser()`.

**Next config:** `next.config.ts` enables `cacheComponents: true` (Cache Components / PPR). Components that read request-time data such as cookies (e.g. `AuthButton`) are wrapped in `<Suspense>` at the call site. Keep that pattern when adding dynamic server components.

**Env gating:** `hasEnvVars` in `lib/utils.ts` lets the starter render without Supabase configured; `updateSession` returns early if it is false.

## Conventions

- Path alias `@/*` maps to the repo root (e.g. `@/lib/supabase/server`, `@/components/ui/button`).
- shadcn config is in `components.json` (aliases: `components`, `ui`, `lib`, `utils`; `hooks` → `@/hooks`, not yet created). Add UI primitives to `components/ui/`. Use `cn()` from `lib/utils.ts` for class merging.
- Tailwind theme (CSS-variable colors, dark mode via `next-themes`) is defined in `tailwind.config.ts` and `app/globals.css`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
