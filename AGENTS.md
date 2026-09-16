<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RoomTwin

Thai-language room-decoration editor (single-page Next.js App Router app). UI strings and code comments are in **Thai** — match that; don't "clean up" Thai text to English. `app/layout.tsx` sets `lang="th"`.

## Stack
- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 (`@tailwindcss/postcss`), Zustand 4, Three.js 0.160.
- `@/*` path alias maps to repo root (`tsconfig.json`).
- No tests, no CI, no test runner. `reactStrictMode: false` is intentional (`next.config.ts`), as are `turbopack: {}` and `transpilePackages: ["three"]`.

## Commands & verification
- `npx tsc --noEmit` is the only working check. It currently reports one pre-existing error: `hooks/useSaveState.ts:26` — `serialize()` omits `cellLevels` in the room snapshot (new field, `lib/state/types.ts` `RoomShape`); fix it if you touch that file.
- `npm run lint` is BROKEN: it runs `next lint`, which was removed in Next.js 16. ESLint is not even installed (flat `eslint.config.mjs` exists, but `eslint`/`eslint-config-next` are absent from `node_modules`), so `npx eslint` fails too. Don't rely on linting; don't add a lint step.
- Manual verification via `npm run dev`, then check the 3D viewport + localStorage restore.

## Architecture
- **Folder map:** `app/` = Next.js entry (`layout.tsx` sets `lang="th"` + fonts; `RoomTwinClient.tsx` is the client bootstrap). `components/` = React UI only — `RoomTwinApp.tsx` is the root; subfolders by surface: `viewport/` (Canvas3D + overlays/toolbar), `sidebar/` (Sidebar, RoomTree, BuildPanel), `panels/` (room setup/structure, customize, blocks, zone chooser/theme), `cart/` (CartDrawer), `modals/`. `lib/three/` = the imperative Three.js world (singletons, instantiate, roomShell, placement). `lib/state/` = Zustand store/types/storage. `lib/data/` = product/zone/theme catalog + constants (`ProductDef`, `ZoneDef`, `STORAGE_KEY`). `lib/utils/` = small format/hex helpers. `hooks/` = React glue (placement, pointer interaction, keyboard, save, init). Re-exports: `lib/three/index.ts`, `lib/state/index.ts`, `hooks/index.ts`.
- Render flow: `app/page.tsx` → `app/RoomTwinClient.tsx` (client component; dynamic import with `ssr: false`) → `components/RoomTwinApp.tsx`.
- Three.js is **imperative — no react-three-fiber**. Shared singletons (`scene`, `camera`, `renderer`, `objectsByUid` map, groups) are module-level in `lib/three/scene.ts`. React only renders UI; the scene is mutated directly by functions in `lib/three/` (`instantiate.ts`, `roomShell.ts`, `placement.ts`, `wallPlacement.ts`, `ceilingPlacement.ts`, `reclamp.ts`). Adding/moving an item means store action + calling those functions, not a React render.
- Single Zustand store: `lib/state/store.ts` (`useRoomTwin`, `subscribeWithSelector`). Undo/redo is JSON-snapshot history (max 60); applying a snapshot happens in `RoomTwinApp.tsx` `HistoryRestoreListener` on the `roomtwin:restore` window event. Cross-component signals are `window` CustomEvents prefixed `roomtwin:` (e.g. `roomtwin:closePanels`, `roomtwin:closeRoomStructure`).
- Persistence: `lib/state/storage.ts` → localStorage key `roomtwin_state_v12` (`STORAGE_KEY` in `lib/data/constants.ts`; `LEGACY_STORAGE_KEYS` ถือ key รุ่นก่อนที่อ่านเป็น fallback ให้ migrate ของเดิม). `loadFromStorage()` holds one-off migrations. **Bump `STORAGE_KEY` whenever the serialized shape changes.** `useSaveState()` (`hooks/useSaveState.ts`) serializes, pushes history, and saves (`saveState` vs 400ms-debounced `saveStateDebounced`).
- Furniture/zones/themes are data-driven: `lib/data/products.ts` (`ProductDef.build(dims, color, opts) => THREE.Group`), `lib/data/zones.ts` (`ZoneDef` with pre-wired slots), `lib/data/themes.ts`. A new product = product def + card in `components/sidebar/` + optionally a `CATEGORIES` entry in `constants.ts`.

- Save / Share Room backend: `app/api/` = Route Handlers (`runtime = "nodejs"`); `lib/server/` = SQLite ผ่าน `node:sqlite` built-in เขียนที่ `data/roomtwin.db` (override ด้วย `ROOMTWIN_DB_PATH`); `lib/cloud/` = client fetch helpers + anonymous owner token; `lib/shared/roomShare.ts` = types/limits ที่ใช้ร่วม client-server. หน้า `/r/[id]` โหลดห้องที่แชร์เข้า editor และระหว่างดูห้องของคนอื่น `useSaveState()` จะไม่เขียน localStorage จนกว่าจะ "บันทึกเป็นสำเนา". แต่ละห้องมี `preview` (data URL จาก `lib/three/screenshot.ts` → `captureRoomThumbnail()`, ต้องมี `preserveDrawingBuffer`) และแสดง "แก้ไขล่าสุด" ด้วย `relativeTimeTh()`; การ์ดห้องอยู่ที่ `components/modals/RoomCard.tsx`.
- On-demand skill `roomtwin-dev` (`.agents/skills/roomtwin-dev/SKILL.md`) carries the actionable workflow steps (add a product / change the serialized shape); load it via the skill tool when a task matches.

## Gotchas
- `next-env.d.ts` and `lib/three/floorGizmo.ts` are gitignored; `next-env.d.ts` is a `tsconfig` include and gets regenerated by the dev server.
- `.next/dev/types/**` is a `tsconfig` include — run `next dev`/`next build` after adding routes before trusting `tsc` output.
- History snapshots must round-trip through `JSON.parse` — `Set`s (e.g. `room.blocks`) are serialized as arrays and rebuilt on restore; `zoneMeta` (a `Map`) as entry arrays.

# Extended Codebase Guidance

## Mandatory Architecture References

Before changing existing behavior:

1. Read `CODEBASE_MAP.md` when you need to understand ownership or architecture.
2. Read `FEATURE_FLOWS.md` when the task changes an existing feature or behavior.
3. Use the feature flow to identify affected files before editing.

These files are architectural references, not optional documentation.

---

## Dependency Tracing Is Mandatory

Never assume that the file named by the user contains the complete implementation.

For behavior changes, trace:

```text
user interaction
→ event handler
→ Zustand/state mutation
→ dependent state/data
→ Three.js/runtime effects
→ persistence
→ history/restore
```

When relevant, also trace:

```text
CustomEvent dispatch
→ CustomEvent listener
→ side effect
```

---

## Source of Truth

Use this separation:

```text
Zustand
    = application source of truth

PlacedItem / RoomShape / SurfaceState
    = persistent domain data

Three.js Object3D
    = runtime representation

React component state
    = local UI state only
```

Do not introduce a second source of truth.

Do not store persistent room/furniture state only inside a Three.js object.

---

## Before Editing

For non-trivial changes, identify:

```text
1. Entry point
2. State owner
3. State mutation
4. Runtime consumer
5. Dependent systems
6. Persistence
7. History
8. CustomEvents
```

Then edit the smallest complete set of files.

---

## High-Risk Changes

Always perform dependency tracing before changing:

* room dimensions
* room shape
* room height
* wall/floor/ceiling geometry
* furniture placement
* wall-mounted objects
* ceiling-mounted objects
* zones
* PlacedItem structure
* serialization
* persistence
* history
* CustomEvents

---

## Serialized State

When serialized state changes:

1. Update TypeScript types.
2. Update serialization.
3. Update restoration.
4. Update migrations when required.
5. Bump `STORAGE_KEY`.
6. Verify localStorage restore.
7. Verify undo/redo.

Do not change serialized shape without considering existing saved state.

---

## Verification

After a behavior change:

1. Run the TypeScript check.
2. Verify the changed feature.
3. Verify directly connected behavior.
4. If state changed, verify localStorage restore.
5. If state/history changed, verify undo/redo.
6. If room geometry changed, verify furniture placement.
7. If CustomEvents changed, verify both dispatcher and listener.

Do not claim a change is complete based only on compilation.

---

## OpenCode Investigation Workflow

When the task is unclear or an existing behavior is difficult to trace:

1. Search the repository for the relevant UI label, function, state field, product ID, event name, or action.
2. Identify callers and consumers.
3. Read the relevant feature flow in `FEATURE_FLOWS.md`.
4. Inspect the implementation chain.
5. State the affected files before editing.
6. Make the smallest complete change.
7. Verify connected behavior.

Prefer repository evidence over assumptions.

---

## Important

Do not "fix" unrelated code discovered during investigation.

If unrelated problems are found:

* mention them separately;
* do not modify them unless required for the requested behavior.

The goal is a complete change, not a broad refactor.

---

## Build Completion Requirements

After completing any implementation/build task, ALWAYS finish with these sections:

### 1. What Changed

Briefly summarize the actual changes that were implemented.

### 2. Manual Test Cases

Always provide a concrete list of manual test cases the user should perform.

The test cases must be based on the feature/bug that was changed.

For each test case include:

* Scenario
* Steps
* Expected result

Prioritize:

1. The exact reproduction case from the original bug/request
2. Normal/success case
3. Edge cases
4. Regression cases for related existing behavior
5. Persistence/reload cases when state or room data was changed

Example:

### Manual Test Cases

#### Test 1 — Original Bug

1. Create a 15 cm raised floor.
2. Place an object on it.
3. Raise the floor to 50 cm.
4. Expected: the object moves with the floor and remains correctly placed.

#### Test 2 — Persistence

1. Create the raised floor.
2. Save/reload the room.
3. Expected: floor elevation and object position are preserved.

#### Test 3 — Regression

1. Place an object on a normal floor.
2. Change an unrelated floor.
3. Expected: the unrelated object does not move.


### 3. Suggested Git Commit

Provide a suggested Git commit message.

Do NOT run `git commit`.

Do NOT stage files with `git add` unless explicitly requested.

Use conventional commit style when appropriate:

* `feat:` new functionality
* `fix:` bug fixes
* `refactor:` structural/code changes
* `perf:` performance changes
* `ui:` UI/UX changes
* `chore:` tooling/configuration changes

Example:

### Suggested Git Commit

`fix: keep objects aligned with raised floors`

### Important

Never create a Git commit unless the user explicitly asks you to commit.

Never claim that manual testing was performed unless it was actually performed.

The final response must always include both:

* `Manual Test Cases`
* `Suggested Git Commit`

