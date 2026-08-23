# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quy tắc làm việc (do chủ dự án đặt ra)

- **Giao tiếp:** Luôn trả lời, giải thích, trao đổi bằng tiếng Việt.
- **Comment code:** Code phải có comment giải thích rõ ràng (đặc biệt là logic nghiệp vụ, chỗ phức tạp/dễ gây nhầm lẫn) — không để code trơ trụi không lời giải thích.
- **Phạm vi sửa đổi:** Chỉ sửa đúng phần được yêu cầu. Không tự ý sửa/refactor các phần khác không liên quan. Nếu phát hiện bắt buộc phải sửa thêm phần khác (VD: để fix bug mới sửa xong không lỗi), phải hỏi và được đồng ý trước khi làm.
- **Đồng bộ thiết kế form/UI:** Khi tạo hoặc sửa form, phải theo đúng thiết kế/pattern UI đã có trong dự án (màu sắc, bố cục, component dùng lại) — tránh tình trạng mỗi task một kiểu thiết kế khác nhau gây rối mắt. Trước khi làm UI mới, tham khảo form/màn hình tương tự đã có trong `src/components/` để giữ nhất quán.
- **Phong cách thiết kế:** Thuần Việt, rõ ràng, đơn giản — nội dung dễ hiểu, không dùng màu mè/hiệu ứng rườm rà không cần thiết.

## Commands

```bash
npm install          # install deps
npm run dev           # start Vite dev server
npm run build          # production build (vite build)
npm run preview        # preview a production build
npm run lint           # type-check only: tsc --noEmit (no ESLint configured)
npm run test           # run all tests once: vitest run
npx vitest run <path>  # run a single test file, e.g. npx vitest run src/lib/__tests__/kanbanLogic.test.ts
npx vitest             # watch mode
```

There is no ESLint/Prettier config in this repo — `npm run lint` only type-checks (and `tsconfig.json` excludes `*.test.ts(x)` and `src/test` from that check).

### Environment

Copy `.env.example` to `.env.local` and fill in:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required, otherwise the app runs with empty/local-only data (see `src/lib/supabase.ts`).
- `VITE_WEBPUSH_VAPID_PUBLIC_KEY` — optional, only needed for Web Push notifications.

Supabase credentials can also be overridden at runtime from an admin settings screen, stored in `localStorage['hl_supabase_config']`, which takes priority over the env vars (`getSupabase()` in `src/lib/supabase.ts`).

When deploying to Vercel, the same two `VITE_SUPABASE_*` vars must be set in the Vercel dashboard or the deployed app shows empty data.

## Architecture

**Single large SPA, no client-side router for the main app.** `src/App.tsx` (~4900 lines) is the central orchestrator: it owns almost all top-level state (projects, tasks, receipts, payments, quotes, employees, customers, conversations, etc.) in `useState`, loads/syncs it via `dbService`, and passes it down as props. Navigation between feature areas is just an `activeTab` string state, dispatched to `src/pages/RouteHandler.tsx`, which if/else-chains `activeTab` to the right top-level component (e.g. `finance` → `FinanceManagement`, `projects-construction` → `ProjectKanbanBoard` with `sector="construction"`). `react-router-dom` is a dependency but is not the primary navigation mechanism for the app shell.

State beyond props is split across `src/context/`: `AuthContext` (current user/session), `SettingsContext` (business profile, HRM config, role groups), `DisplaySettingsContext`, `NotificationContext`. These are for cross-cutting concerns only — feature data (projects/tasks/finance/etc.) stays in `App.tsx` and is prop-drilled.

### Data flow: localStorage cache → Supabase source of truth

- `src/lib/dbService.ts` (~2900 lines, one large flat `dbService` object with ~80 methods) is the sole data-access layer — all reads/writes to Supabase go through it. There is no per-domain module split (e.g. no separate `dbService.finance`); everything is a flat method like `dbService.loadAllCore()`, `dbService.uploadAvatar()`, etc.
- Supabase rows use `snake_case`; app/domain objects use `camelCase`. `dbService.ts` exports the conversion helpers (`camelToSnake`, `snakeToCamel`, `keysToSnake`, `rowToCamel`) — use these rather than hand-rolling key mapping when adding new synced fields.
- `localStorage` is a read-through cache/offline backup; Supabase is authoritative. On load, `App.tsx` reads local data first for instant paint, then reconciles with Supabase.
- Realtime: the app subscribes to Supabase realtime channels and updates state on change events. `stableStr()` in `dbService.ts` does key-sorted deep serialization specifically to detect "no real change" and break save→realtime-event→save feedback loops — a real incident (business_profile) caused 100K+ runaway INSERTs from such a loop. When wiring a new realtime-synced field, guard the save-on-change effect the same way.
- `src/lib/migrateLocalStorage.ts` handles one-time migration of legacy localStorage-only data into Supabase on first load.

### Domain model & seed data

- `src/types.ts` (~990 lines) is the single source of truth for all domain types (Employee, Customer, Project, ProjectDoc, Quote, etc.) — check here before assuming a shape.
- `src/data.ts` holds `INITIAL_*` seed/demo arrays and `DEFAULT_*` configs (e.g. `DEFAULT_SYSTEM_CONFIG`, `DEFAULT_QUOTE_CONFIG`), used as fallback data before Supabase is loaded or configured.

### Auth & permissions

Auth is custom, not Supabase Auth: `Employee` records carry `username`/`password` (hashed with `bcryptjs`), see `src/context/AuthContext.tsx`. Permissions are role-group based via `Employee.roleGroupIds` (e.g. `role_admin`, `role_accounting`, `role_office`, `role_technical`, `role_factory_mwood`, `role_factory_mmetal`), checked with `isUserInRoleGroup()` from `src/context/index.ts`. There is a hardcoded fallback admin account (`admin`/`admin`) that `ensureAdminAndPasswords()` injects if no admin employee exists — this is intentional bootstrap behavior, not a bug.

### Supabase migrations

`supabase/migrations/*.sql` are date-prefixed (`YYYYMMDDNN_description.sql`) and applied manually/ad-hoc — there's no migration CLI wired into `package.json` scripts. `supabase/schema.sql` is a snapshot of the full schema. `scripts/` contains many one-off maintenance/backfill/fix scripts (`.cjs`, `.mjs`, `.sql`) written for specific past incidents — treat them as historical/reference, not a reusable pipeline.

### Push notifications

Web Push (VAPID) via `src/hooks/useWebPush.ts` + `public/web-push-sw.js`, backed by the `push_subscriptions` Supabase table and a `send-push` Supabase Edge Function. Firebase/FCM was fully removed in favor of this — don't reintroduce Firebase-based push code.

### Large components

Several feature components are very large single files; when making a small fix, prefer a targeted read/edit over loading the whole file into context:
- `src/components/FinanceManagement.tsx` (~9600 lines)
- `src/components/ProjectKanbanBoard.tsx` (~6700 lines)
- `src/components/HumanResourcesManagement.tsx` (~6500 lines)
- `src/components/TaskDetailModal.tsx` (~5200 lines)
- `src/App.tsx` (~4900 lines)
- `src/components/DashboardOverview.tsx` (~4200 lines)

### Build config notes

- `vite.config.ts` defines the `@` path alias to the project root (also mirrored in `tsconfig.json` as `@/*`).
- `DISABLE_HMR=true` disables Vite HMR and file watching — used in the AI Studio agent-edit environment to prevent flicker while files are being edited programmatically.
- Manual vendor chunk splitting (`vendor-react`, `vendor-supabase`, `vendor-xlsx`) keeps bundle chunks under Vite's 500kb warning.
