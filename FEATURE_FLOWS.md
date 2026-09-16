# RoomTwin Feature Flows

This file describes the dependency chains of important RoomTwin behaviors.

Use it before changing an existing feature.

The goal is to prevent narrow fixes that update one layer while leaving connected layers inconsistent.

---

# 1. Change Room Size

Example:

```text
User changes width/depth/height
```

Trace:

```text
Room setup UI
    ↓
input handler
    ↓
Zustand room state
    ↓
room geometry
    ↓
Three.js room shell
    ↓
placement constraints
    ↓
reclamp affected items
    ↓
wall/ceiling mounted objects
    ↓
save state
    ↓
history
```

Inspect at minimum:

```text
components/panels/
lib/state/store.ts
lib/state/types.ts
lib/three/roomShell.ts
lib/three/placement.ts
lib/three/reclamp.ts
hooks/useSaveState.ts
lib/state/storage.ts
```

Questions:

* Does the new room size reach Zustand?
* Does the visible room geometry update?
* Are existing objects still valid?
* Are wall-mounted objects still correctly positioned?
* Are ceiling-mounted objects still valid?
* Is the new state serialized?
* Does undo/redo restore correctly?

---

# 2. Change Room Shape

Flow:

```text
Room shape UI
    ↓
shape state
    ↓
room.blocks / room.shape
    ↓
room shell
    ↓
floor/wall geometry
    ↓
placement constraints
    ↓
reclamp
    ↓
persistence
    ↓
history
```

Inspect:

```text
lib/state/types.ts
lib/state/store.ts
lib/three/roomShell.ts
lib/three/placement.ts
lib/three/reclamp.ts
lib/state/storage.ts
hooks/useSaveState.ts
```

---

# 3. Add Furniture

Flow:

```text
Sidebar product card
    ↓
startPlacing(productId)
    ↓
placement state
    ↓
pointer interaction
    ↓
create PlacedItem
    ↓
store.addItem()
    ↓
instantiate()
    ↓
Three.js scene
    ↓
save/history
```

Inspect:

```text
components/sidebar/
lib/data/products.ts
lib/state/store.ts
lib/state/types.ts
hooks/
lib/three/instantiate.ts
lib/three/placement.ts
hooks/useSaveState.ts
```

Important — การแตะการ์ด vs การลากการ์ด (สองคนละพาธ):

```text
แตะการ์ด (ไม่ขยับเกิน 8px)
    → startPlacing(pid)  = "arm" เท่านั้น ยังไม่วางของ
    → วางจริงตอนคลิก canvas (usePointerInteraction onUp → placeProduct → cancelPlacing)
    → hint/toast "แตะจุดในห้องเพื่อวางไอเทมนี้" เป็นตัวบอกว่ากำลัง arm อยู่

ลากการ์ดไปวางใน canvas
    → วางทันทีตอนปล่อย (useCardDrag onUp)
    → ⭐ ต้องยกเลิก placing ที่ค้างจากการ "แตะการ์ดใบอื่น" ก่อนหน้า (cancelPlacing)
       ไม่งั้นตอนคลิก canvas ครั้งถัดไปจะวางของที่ค้าง arm อยู่อีกชิ้น (bug "วาง 2 อัน")
    → ยกเว้นลากการ์ดใบที่ arm อยู่เอง (armedId === state.id) = ตั้งใจวางชิ้นนั้น ไม่ต้องแตะ

⭐ class .placing บนการ์ด sync จาก store ผ่าน hooks/usePlacingHighlight.ts
   ทุกทางที่ออกจากโหมดวางของ (วางสำเร็จ / ปุ่มยกเลิกการวาง / Escape) ไฮไลต์จึงหายเอง
```

---

# 4. Move Furniture

Flow:

```text
Pointer interaction
    ↓
placement calculation
    ↓
position update
    ↓
Zustand PlacedItem
    ↓
Three.js object update
    ↓
placement constraints
    ↓
save/history
```

Important:

Do not update only the Three.js object.

The final position must be represented in `PlacedItem`.

---

# 5. Rotate Furniture

Flow:

```text
UI / pointer / keyboard
    ↓
rotation handler
    ↓
PlacedItem.rotY / related rotation
    ↓
Three.js object rotation
    ↓
placement constraint if relevant
    ↓
save/history
```

Inspect both state mutation and runtime mutation.

---

# 6. Delete Furniture

Flow:

```text
Delete action
    ↓
store.removeItem(uid)
    ↓
relationship cleanup
    ↓
Three.js object removal
    ↓
selection cleanup
    ↓
zone relationship cleanup if relevant
    ↓
save/history
```

Important relationships:

```text
parentUid
zoneUid
selectedUid
customizeTargetUid
swapTargetUid
```

When deleting a parent, inspect child/orphan behavior.

---

# 7. Customize Furniture

Flow:

```text
Customize UI
    ↓
customizeTargetUid
    ↓
new params
    ↓
PlacedItem.params
    ↓
Three.js representation
    ↓
save/history
```

Do not create a second persistent copy of the item's parameters in the UI.

---

# 8. Swap Furniture

Flow:

```text
Swap UI
    ↓
swapTargetUid
    ↓
new product
    ↓
PlacedItem.productId / params
    ↓
replace/rebuild Three.js object
    ↓
preserve required placement metadata
    ↓
save/history
```

Check whether these need to survive the swap:

```text
x
z
restY
rotY
wallId
mountUid
mountFace
u
v
rotZ
ceilingMount
zoneUid
zoneDefId
slotId
parentUid
locked
```

Do not accidentally reset placement metadata when swapping products.

## 8.1 Swap Mode (ปุ่ม ⇄ บน floating toolbar)

Flow:

```text
FloatingToolbar #ftSwap
    ↓
setSwapTarget(item.uid)
    + setActiveCat(PRODUCT_BY_ID.get(item.productId).cat)   ← sidebar ไปหมวดของ object
    + expandDrawer()                                        ← กาง drawer (มือถือ)
    ↓
swapTargetUid (transient UI — ไม่เข้า serialize/history)
    ├─ BuildPanel: swap-header.swapping + การ์ดเป็น "แตะเพื่อแทนที่"
    └─ useSwapHighlight → lib/three/swapHighlight.ts
           → updateSwapHighlight() รายเฟรมใน useAnimationLoop
               = กรอบ dashed wireframe 2 ชั้น (pulse) รอบ object
               + badge #swapBadge บอกชื่อสินค้าที่กำลังเปลี่ยน
    ↓
แตะการ์ด → roomtwin:swapSlot → SwapSlotListener → swapZoneSlotFull → saveState
```

การออกจากโหมด (ทุกทางต้องเคลียร์ `swapTargetUid` และซ่อน highlight):

```text
คลิก object อื่น       → selectItem(uid)      (คลิก object เดิมซ้ำไม่หลุดโหมด)
คลิกพื้นที่ว่าง/✕ panel → closeItemPanel()
คลิก/เลือกโซน          → selectZone() / deselectZone()
ยกเลิกใน sidebar       → setSwapTarget(null)
Escape                → useKeyboardShortcuts → closeItemPanel()
ลบ object ที่กำลังเปลี่ยน → removeItem() (เคลียร์ swapTargetUid อยู่แล้ว)
undo/redo             → restoreSnapshot() → setSwapTarget(null)

⭐ ระหว่างโหมด replace: updateRotateGizmo() ซ่อน gizmo หมุน
   และ usePointerInteraction() ไม่เริ่มลาก object (ล็อกตำแหน่งระหว่างเลือกสินค้า)
⭐ ไม่เปลี่ยน serialized shape → ไม่ bump STORAGE_KEY
```

Inspect:

```text
components/viewport/FloatingToolbar.tsx
lib/three/swapHighlight.ts
hooks/useSwapHighlight.ts
lib/state/store.ts
components/sidebar/BuildPanel.tsx
lib/three/gizmo.ts
hooks/usePointerInteraction.ts
```

---

# 9. Wall-Mounted Furniture

ของติดผนังแขวนได้บน **พื้ นผิว 2 ชนิด**: ผนังห้อง (`wallId`) หรือผิวด้านตั้งของไอเทม
(`mountUid` + `mountFace` = เสา/ฉากกั้น/ประตู/หน้าต่าง)

```text
Wall object (wallart / ac / curtain)
    ↓
mount target
    ├─ ผนังห้อง  → wallId
    └─ ไอเทม     → mountUid + mountFace (pz/nz/px/nx ใน local frame ของ host)
    ↓
mountPlane() หา { cx, cz, dx, dz, nx, nz, len, baseY, topY, rotY }
    ↓
u (ตามแนวพื้ นผิว) / v (สูงจาก baseY ของพื้ นผิว) / rotZ
    ↓
wallPlacement.ts  →  Three.js transform
```

กติกา:

```text
- v นับจาก baseY ของพื้ นผิว → ผนังห้อง baseY = 0 จึงเหมือนเดิมทุกประการ
- host ถูกย้าย/หมุน/เปลี่ยนขนาด → เรียก reclampAttachmentsOf(hostUid)
- host ถูกลบ → ลบของที่แขวนด้วยทั้งชุด (lib/three/itemTree.ts deleteItemTree)
- host ที่เป็นพื้ นผิวได้ = ProductDef.hostSurface (เสา/ฉากกั้น/ประตู/ประตูเลื่อน/หน้าต่าง)
- ของที่แขวนบน host ได้ = ProductDef.attachToSurface (กรอบภาพ/แอร์/ม่าน)
  ประตู/หน้าต่างยังติดได้แค่ผนังห้องจริง
```

การเปลี่ยน room geometry มีผลกับของติดผนัง (โดยเฉพาะของที่แขวนบนประตู/หน้าต่าง)

Always inspect:

```text
lib/three/wallPlacement.ts   ← mountPlane / clamp / overlap / world pose
lib/three/reclamp.ts         ← reclampWallItems / reclampAttachmentsOf
lib/three/raycast.ts         ← raycastWallPlacement (ผนัง + ผิว host)
lib/three/roomShell.ts
lib/three/itemTree.ts        ← ลบ host + ของที่แขวน
```

---

# 10. Ceiling-Mounted Furniture

Flow:

```text
Ceiling item
    ↓
ceiling placement data
    ↓
ceiling placement logic
    ↓
Three.js transform
```

Room height changes may affect ceiling-mounted items.

Inspect:

```text
lib/three/ceilingPlacement.ts
lib/three/reclamp.ts
```

---

# 11. Zone Creation

Flow:

```text
Zone card
    ↓
startPlacingZone(zoneId)
    ↓
zone placement
    ↓
ZoneDef
    ↓
slots
    ↓
PlacedItems
    ↓
zoneUid / zoneDefId / slotId
    ↓
Three.js instantiate
    ↓
zoneMeta
    ↓
save/history
```

Important:

```text
วางสินค้าบนพื้นใกล้โซน → handleZoneDrop() (hooks/usePlacement.ts)
auto-assign เข้าโซนที่ใกล้สุด / เด้ง ZoneChooser เมื่อกำกวม

⭐ ยกเว้นสินค้าหมวด structure + fixtures (ประตู/หน้าต่าง/เสา/ฉากกั้น/บันได/ม่าน/แอร์)
   isAutoZoneExcludedProduct() (lib/data/products.ts) → ข้าม auto-zone ทั้งหมด
   (การลากเข้าโซนเองผ่าน RoomTree / ZoneChooser ยังทำได้)
```

Inspect:

```text
lib/data/zones.ts
lib/state/store.ts
lib/state/types.ts
lib/three/zoneActions.ts
lib/three/instantiate.ts
hooks/usePlacement.ts
lib/data/products.ts
```

---

# 11.1 Move Item Between Zones (Room Tree Drag)

Flow:

```text
Room Tree item row (แท็บ "ห้องของฉัน")
    ↓
pointerdown → useTreeItemDrag.startDrag
    ↓
pointermove (เกิน threshold 6px) → drag ghost + drop indicator
    ↓
detect drop target (.tree-group[data-zone-uid] / .tree-group[data-standalone])
    ↓
pointerup → moveItemIntoZoneFull(uid, zoneUid, insertBeforeUid?)
    ↓
assignItemToZone  → patch zoneUid / zoneDefId / slotId + reorder ใน placedItems
    ↓
resolveRestHeights
    ↓
saveState (localStorage + history — 1 ครั้ง = 1 undo step)
    ↓
roomtwin:treeExpandZone → ขยายกลุ่มปลายทางที่ย่ออยู่
```

Inspect:

```text
components/sidebar/RoomTree.tsx
hooks/useTreeItemDrag.ts
lib/three/zoneHelpers.ts
lib/three/zoneActions.ts
```

Important:

โซนไม่มี record ของตัวเอง — สมาชิกโซน derive จาก `PlacedItem.zoneUid` และ identity ของโซน
(`zoneDefId`) สืบทอดจาก item แรกในโซนเป้าหมาย; ย้าย item ออกจากโซนจนไม่เหลือ item = โซนหายไปทั้งกลุ่ม

---

# 11.2 Add Zone from "ห้องของฉัน" Tab

Flow:

```text
RoomPanel "+ เพิ่มโซน" (id=addZoneBtn) (แท็บ "ห้องของฉัน")
    ↓
openZoneAddDialog() → useZoneAddStore (mode = "choose")
    ├─ "สร้างโซนเอง" → mode = "create"
    │      ↓
    │   draft: name / icon / color  +  memberUids (ติ๊กของในห้อง)
    │      ↓
    │   validateZoneIdentity() (lib/data/zoneResolve.ts — name/icon/color ห้ามซ้ำ)
    │      ↓
    │   createCustomZoneFull() (lib/three/zoneActions.ts)
    │      ↓
    │   setZoneMeta(zuid, { name, icon, color })
    │      ↓
    │   replaceItems patch: zoneUid = zuid, zoneDefId = null, slotId = undefined (atomic)
    │      ↓
    │   selectZone(zuid) → resolveRestHeights()
    │      ↓
    │   saveState() (1 การสร้าง = 1 undo step)
    │
    └─ "เลือกจากโซนสำเร็จรูปใน catalog" (พฤติกรรมเดิมของปุ่ม)
           ↓
        setSwapTarget(null) → setActivePanel("build") → setActiveCat("zone") → expandDrawer()
           ↓
        ผู้ใช้ลาก/แตะการ์ดโซนในแคตตาล็อก (flow # 11)
```

Inspect:

```text
components/sidebar/RoomPanel.tsx
components/modals/ZoneAddModal.tsx
components/modals/useModalStores.ts
lib/three/zoneActions.ts
lib/data/zoneResolve.ts
components/sidebar/ThumbIcon.tsx
```

Important:

```text
⭐ โซนยัง derive จาก items — โซนที่ไม่มีของไม่แสดงที่ไหนเลย
   ดังนั้น "สร้างโซนเอง" ต้องมีสมาชิกอย่างน้อย 1 ชิ้นเสมอ (ปุ่มสร้างถูก disable เมื่อยังไม่ติ๊ก)

⭐ โซนเองไม่มี ZoneDef → สมาชิกทุกตัวมี zoneDefId = null
   identity (name/icon/color) มาจาก zoneMeta เท่านั้น ผ่าน resolveZoneDisplay()
   ห้าม hardcode ค่าเหล่านี้ที่ UI/3D

⭐ สินค้าหมวด structure / fixtures (ประตู/หน้าต่าง/เสา/ฉากกั้น/บันได/ม่าน/แอร์)
   ไม่ปรากฏในรายการติ๊ก และถูกกรองซ้ำใน createCustomZoneFull()
   (สอดคล้องกับ storage migration ที่ตัดสินค้ากลุ่มนี้ออกจากโซน)

⭐ ไม่มีการ instantiate/remove Three.js object ตอนสร้างโซน — ของอยู่ตำแหน่งเดิม
   ขอบเขตโซนใน 3D มาจาก buildZoneBoundary() รายเฟรมตาม selectedZoneUid

⭐ ไม่เปลี่ยน serialized shape → ไม่ bump STORAGE_KEY
```

---

# 12. Delete Zone

Flow:

```text
Delete zone
    ↓
zone UID
    ↓
find all zone items
    ↓
remove items
    ↓
clean parent relationships
    ↓
clean zoneMeta
    ↓
selection cleanup
    ↓
Three.js removal
    ↓
save/history
```

Important:

Deleting a zone is not the same as deleting one furniture item.

---

# 13. Room Surface

Examples:

```text
floor
wall
ceiling
wall colors
```

Flow:

```text
Surface UI
    ↓
Zustand surface
    ↓
Three.js material/geometry update
    ↓
save/history
```

Inspect:

```text
lib/state/store.ts
lib/three/roomShell.ts
lib/state/storage.ts
```

---

# 14. Openings: Door / Window

Openings have special state behavior.

Relevant concepts:

```text
door
window
wallMount
opening flags
```

Inspect:

```text
lib/state/store.ts
lib/state/openingFlags.ts
lib/three/wallPlacement.ts
```

When removing or adding an opening, verify both the item and opening-related state.

---

# 15. Undo / Redo

Flow:

```text
User changes state
    ↓
serialize
    ↓
history snapshot
    ↓
undo/redo
    ↓
roomtwin:restore
    ↓
HistoryRestoreListener
    ↓
restore snapshot
    ↓
rebuild Three.js runtime
```

Important special structures:

```text
Set → JSON array → Set
Map → JSON entries → Map
```

When serialized state changes, inspect:

```text
lib/state/types.ts
hooks/useSaveState.ts
lib/state/storage.ts
components/RoomTwinApp.tsx
lib/data/constants.ts
```

---

# 16. Persistence

When adding/removing/renaming persistent fields:

```text
TypeScript type
    ↓
Zustand state
    ↓
serialize()
    ↓
SerializedState
    ↓
localStorage
    ↓
loadFromStorage()
    ↓
migration if necessary
    ↓
restore
```

If serialized shape changes:

```text
Bump STORAGE_KEY.
```

Do not silently change serialized structure without considering old saved state.

---

# 17. Custom Event

Before changing an event:

```text
Search:
roomtwin:<event>
```

Find:

```text
dispatchEvent()
```

and:

```text
addEventListener()
```

Then trace:

```text
dispatcher
    ↓
event payload
    ↓
listener
    ↓
state/runtime side effect
```

Update both sides if the contract changes.

---

# 18. New Product

Flow:

```text
Product definition
    ↓
ProductDef.build()
    ↓
sidebar card/category
    ↓
start placing
    ↓
PlacedItem
    ↓
instantiate
    ↓
Three.js
    ↓
save
```

Typical files:

```text
lib/data/products.ts
components/sidebar/
lib/data/constants.ts
lib/state/types.ts
lib/three/instantiate.ts
```

---

# 19. New Persistent Field

Use this sequence:

```text
1. Add TypeScript type
2. Add Zustand state/action
3. Update serialize()
4. Update restore/load
5. Update migration if needed
6. Bump STORAGE_KEY
7. Update history snapshot behavior
8. Update runtime consumers
9. Verify localStorage
10. Verify undo/redo
```

Never add only the type.

---

# 20. How to Investigate Any Unknown Feature

Start from the user-visible action.

Ask:

```text
Where is the UI action?

↓
What handler runs?

↓
What Zustand action/state changes?

↓
What code consumes that state?

↓
What Three.js function changes?

↓
What other objects depend on it?

↓
Is it serialized?

↓
Does undo/redo include it?

↓
Are there CustomEvents involved?
```

Only after this trace should implementation begin.

---

# 21. Definition of Complete

For behavior changes:

```text
UI
+
State
+
Runtime
+
Dependencies
+
Persistence
+
History
```

must be considered together where applicable.

A fix is not complete merely because the visible UI appears correct.
