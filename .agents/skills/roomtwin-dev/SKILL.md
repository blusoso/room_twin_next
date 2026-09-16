---
name: roomtwin-dev
description: Develop features in the RoomTwin room-decoration editor (Next.js 16 App Router + imperative Three.js + Zustand). Covers the non-obvious stack, 3D scene/store/persistence wiring, and repo verification. Use when working on RoomTwin components, lib/three, lib/state, furniture/zone/theme data, or tasks touching the 3D scene or localStorage persistence.
---

# RoomTwin Dev

## หลักการต้องห้าม
- UI strings & code comments เป็นภาษาไทย — ห้าม "ทำความสะอาด" เป็นอังกฤษ (`app/layout.tsx` ตั้ง `lang="th"`)
- Three.js เป็น **imperative (ไม่มี react-three-fiber)** → เพิ่ม/ย้าย/ลบ item = store action + เรียกฟังก์ชันใน `lib/three/` ตรง ๆ ไม่ใช่การ React render

## Verification
- `npx tsc --noEmit` คือ check เดียวที่ใช้ได้ — ตอนนี้มี error เดิมค้างที่ `hooks/useSaveState.ts:26` (`serialize()` ขาด `cellLevels` ใน room snapshot); แก้ให้ถ้าต้องแตะไฟล์นี้
- `npm run lint` พังทั้งสองสาเหตุ: `next lint` ถูกลบใน Next 16 + `eslint` ไม่ได้ติดตั้งใน `node_modules` — อย่าใช้ อย่าเพิ่ม lint step
- ตรวจ manual: `npm run dev` แล้วเช็ค 3D viewport + localStorage restore

## Wiring สั้น ๆ
- Render flow: `app/page.tsx` → `app/RoomTwinClient.tsx` (dynamic import, `ssr: false`) → `components/RoomTwinApp.tsx`
- Scene singletons อยู่ module-level ใน `lib/three/scene.ts` (`scene`, `camera`, `renderer`, `objectsByUid`) — React รู้แค่ UI, scene ถูก mutate ตรง ๆ
- เชื่อม scene: `instantiate()` / `reinstantiateItem()` / `removeInstantiated()` ใน `lib/three/instantiate.ts`
- Store: `lib/state/store.ts` (`useRoomTwin`); undo/redo = JSON snapshot (max 60), ใช้ `window` event `roomtwin:restore`
- Persistence: `lib/state/storage.ts` → localStorage key `roomtwin_state_v11` (`STORAGE_KEY` ใน `lib/data/constants.ts`) — **bump `STORAGE_KEY`ทุกครั้งที่ serialized shape เปลี่ยน** + เพิ่ม migration ใน `loadFromStorage()`
- History snapshots ต้อง round-trip ผ่าน `JSON.parse`: `Set` → array, `Map` (`zoneMeta`) → entries

## Workflow: เพิ่มสินค้าใหม่
1. เพิ่ม product def ใน `lib/data/products.ts` — `build(dims, color, opts) => THREE.Group`
2. เพิ่มการ์ดใน `components/sidebar/`
3. ถ้าเป็นหมวดใหม่: เพิ่มรายการใน `CATEGORIES` (`lib/data/constants.ts`)
4. ตรวจ: `npx tsc --noEmit` + ทดสอบใน dev server

## Workflow: เปลี่ยน serialized shape
1. แก้ type ใน `lib/state/types.ts` (`RoomShape` / `SerializedState`)
2. เพิ่ม migration ใน `lib/state/storage.ts` `loadFromStorage()`
3. bump `STORAGE_KEY` ใน `lib/data/constants.ts`
4. แก้ `serialize()` ใน `hooks/useSaveState.ts` ให้ตรง type

## อ้างอิง
- รายละเอียดเพิ่มเติมดูใน `AGENTS.md` (โหลดให้อัตโนมัติอยู่แล้ว)
- Next 16 API ต่างจากเวอร์ชันเก่า — เช็ค `node_modules/next/dist/docs/` ก่อนเขียนโค้ด

## Important rule

Before editing:
1. Find the relevant implementation.
2. Trace data flow.
3. Explain which files are involved.
4. Only then modify code.