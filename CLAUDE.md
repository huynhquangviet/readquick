# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Product:** readquick is a phone-first web app where a signed-in user uploads a Document (PDF, EPUB, MOBI, TXT) and reads it one Word at a time at a fixed Focus point. The domain language is in `CONTEXT.md`; use those terms in code, tests and issues. The full spec is GitHub issue #1 (`gh issue view 1`), broken into tickets #2 to #18.

**Code today:** the Supabase "Next.js + Supabase Starter Kit" (`create-next-app --example with-supabase`) with its placeholder UI removed. Next.js App Router + React 19 + TypeScript (strict), Tailwind CSS 3, shadcn/ui (new-york style, Radix + lucide), Supabase Auth via cookies (`@supabase/ssr`). Signing in lands on the Library (`/library`). Built so far: the Reader engine (`lib/reader/`, no UI yet) and uploading TXT Documents (Ingestion module in `lib/ingestion/`, storage, Library list, minimal Document page).

## Commands

```bash
npm run dev     # next dev, http://localhost:3000
npm run build   # next build
npm run start   # next start (after build)
npm run lint    # eslint . (next/core-web-vitals + next/typescript, flat config)
npm test        # vitest run: runs **/*.test.ts once, non-zero exit on failure
```

Tests live next to the code as `*.test.ts`; the `@/*` alias resolves in tests (`vitest.config.ts`). There is no lockfile committed. Dependencies `next`, `@supabase/ssr` and `@supabase/supabase-js` are pinned to `latest`.

Setup: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a legacy anon key also works in that variable).

## Architecture

**Auth/session flow spans several files:**
- `proxy.ts` (root) is the Next.js 16 replacement for `middleware.ts`. It exports `proxy()` and delegates to `updateSession()` in `lib/supabase/proxy.ts`, which refreshes the Supabase session cookies on every matched request and redirects unauthenticated users to `/auth/login`. Exempt paths: `/auth*` only (so `/` and `/library` require sign-in). Any new public route must be added to that allowlist or it will redirect.
- In `updateSession`, do not put code between `createServerClient(...)` and `supabase.auth.getClaims()`, and always return the `supabaseResponse` object as-is (or copy its cookies), otherwise sessions get dropped. The comments in the file explain this.
- `lib/supabase/server.ts` (`createClient()`, async, for Server Components / Route Handlers / Actions) and `lib/supabase/client.ts` (`createClient()`, for Client Components) are the two Supabase entry points. Always create a new client per call; never store one in a module-level variable (Fluid compute).
- Auth pages are under `app/auth/*` (login, sign-up, forgot/update-password, error, sign-up-success). `app/auth/confirm/route.ts` handles the email OTP link (`verifyOtp` with `token_hash` + `type`, then redirects to `next`). The corresponding forms are client components in `components/*-form.tsx`.
- `app/library/*` is the Library, the signed-in home screen; `/` just redirects to it. Gating is enforced by the proxy, not by the layout. Sign-in, sign-up and password update all route to `/library`.
- User info is read with `supabase.auth.getClaims()` (see `components/auth-button.tsx`), not `getUser()`.

**Next config:** `next.config.ts` enables `cacheComponents: true` (Cache Components / PPR). Components that read request-time data such as cookies (e.g. `AuthButton`) are wrapped in `<Suspense>` at the call site. Keep that pattern when adding dynamic server components.

**Env:** the Supabase env vars are required; there is no fallback when they are missing.

## Modules and data

- `lib/ingestion/ingest.ts`: `ingest({ bytes, filename })` returns a readable Document (title, format, Words, Sentence starts, Chapters) or a typed refusal with a user-facing message. The extension is the declared format; `SUPPORTED_FORMATS` lists what is implemented (TXT so far, extend it as formats land). The Word segmentation rule (split on whitespace) is a stable contract, because a Reading position is a Word index.
- `lib/reader/reader.ts`: `createReader({ words, sentenceStarts, clock })`, a playback state machine on an injectable `Clock` (`lib/reader/fake-clock.ts` for tests). No UI, no storage; it emits `position`, `activity` (`playedMs`, `wordsRead` increments) and `playback` events.
- Upload is `POST /library/upload` (`app/library/upload/route.ts`, a Route Handler, not a Server Action, so an oversized file gets our "too large" refusal instead of the Server Action body limit). It ingests, then stores the original in the private `documents` bucket at `<user id>/<document id>.<format>` and the text in `documents` and `document_texts`.
- Schema, row-level security and storage policies live in `supabase/migrations/`. Apply them to the Supabase project (SQL editor or `supabase db push`); nothing applies them automatically.

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
