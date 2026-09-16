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

# 7.1 ขนาดสำเร็จรูป (Size Presets — ปุ่ม 📐 บน floating toolbar)

Flow:

```text
📐 บน floating toolbar (หรือ chip row ใน CustomizePanel)
    ↓
SIZE_PRESETS[productId]          (lib/data/sizePresets.ts — derived data, ไม่ใช่ state)
    ↓
clampPresetParams(productId, preset.params)   → clamp ตาม PARAM_SCHEMA
    ↓
applyParamsPatch(item, patch)    (lib/three/paramEdit.ts — เจ้าของเดียวของการแก้ params)
    ↓
PlacedItem.params (Zustand)
    ↓
reinstantiate + resolvePlacement / resolveWallPlacement / resolveCeilingPlacement
    ↓
reclampAttachmentsOf(host) + rebuildBaseboards()   (ประตู)
    ↓
saveState()/history
```

กติกา:

```text
- preset ไม่เก็บลง state → ไม่เปลี่ยน serialized shape → ไม่ bump STORAGE_KEY
- ปุ่ม 📐 แสดงเมื่อไอเทมไม่ได้ล็อก + สินค้านั้นมี preset เท่านั้น
  (โหมดโซนซ่อนอัตโนมัติผ่าน .item-btn; โหมดสลับสินค้าซ่อนผ่าน #ftSize ใน CSS)
- ข้อความบนปุ่มต้องสื่อความหมายเสมอ = ชื่อ preset ถ้าตรง / ไม่ตรงให้ fallback เป็น W×D จริง
- เลือกแล้ว saveState() ทันที (1 การเลือก = 1 history entry เหมือนปุ่มหมุน/ทำซ้ำ)
- ห้าม UI คำนวณ/ตั้งตำแหน่งเอง — ต้องผ่าน applyParamsPatch เพื่อให้ clamp + reclamp ครบ
- เปลี่ยนขนาดประตู/หน้าต่าง/เสา/ฉากกั้น → ของที่แขวนบนพื้นผิวนั้น reclamp ตามอัตโนมัติ
```

Edge ที่รู้ไว้ (พฤติกรรมเดิม — ไม่แก้ในฟีเจอร์นี้):

```text
- "รีเซ็ตธีมโซน" คืน params จาก zoneMeta.themeBaseline → ขนาดที่แก้หลังใช้ธีมจะถูกคืนค่า
  (เหมือนการแก้ params ทางอื่น เช่น สไลเดอร์สี/สไลเดอร์ขนาด — baseline คือ snapshot ตอนใช้ธีม)
- สไลเดอร์ของ roundrug แก้แค่ w แต่ footprintOf ใช้ทั้ง w/d (ปัญหาก่อนมีฟีเจอร์นี้)
  → preset ของ roundrug ตั้ง w/d เท่ากันให้ถูกต้อง
```

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

⭐ ถ้าสินค้านั้นมี "ขนาดมาตรฐานที่ผู้ใช้รู้จัก" (เตียง/ประตู/หน้าต่าง/ตู้/โต๊ะ/ชั้นวาง/พรม)
ให้เพิ่มรายการใน `lib/data/sizePresets.ts` ด้วย → ปุ่ม 📐 จะโผล่บน floating toolbar
และ chip row จะโผล่ในแผงปรับแต่งเอง โดยไม่ต้องแก้ serialization (ดู §7.1)
`lib/data/products.ts` ควรตั้ง `dims` เริ่มต้นให้ตรงกับ preset ใด preset หนึ่ง เพื่อให้ปุ่มแสดงชื่อขนาดทันที

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

---

# 22. ค้นหา & กรองสินค้า (Smart Search)

Flow:

```text
CatalogSearch (components/sidebar/CatalogSearch.tsx — แถบค้นหาใน sidebar)
    ↓
Zustand transient slice: catalogQuery / catalogFilters / catalogSearchFocusNonce /
                         catalogFiltersOpen   (ไม่เข้า serialize/history → ไม่ bump STORAGE_KEY)
    ↓
useCatalogSearchResult()  (hooks/useCatalogSearchResult.ts — แหล่งเดียวของผลลัพธ์)
    ↓
searchCatalog()  (lib/data/productSearch.ts — pure)
    ├─ อ่าน PRODUCTS + tags + THEME / ZONES + room.w/d/h
    └─ ให้คะแนนแล้วเรียงลำดับ + กรอง facet
    ↓
ผู้ใช้ 2 ราย:
    ├─ BuildPanel: browse mode (เดิม) vs search mode
    │     ├─ browse mode = tabs + activeCat (พฤติกรรมเดิมทั้งหมด)
    │     └─ search mode = ซ่อน tabs, แสดงโซนที่ตรง + สินค้าที่ตรง (มี badge หมวด/ธีม)
    └─ CatalogFilterPanel (components/panels/CatalogFilterPanel.tsx)
          ⭐ floating panel — mount จาก components/viewport/Viewport.tsx ใน .viewport-wrap
          position:absolute; top:12px; left:12px → ลอย "ข้างขวาของ sidebar"
          มือถือ (≤820px): .viewport-wrap อยู่เหนือ drawer → panel อยู่เหนือ drawer เสมอ
    ↓
การ์ดเดิม (ProductCard / ZoneCard) → useCardDrag → startPlacing / placeProduct
```

กติกา:

```text
⭐ สองโหมดแยกกันชัดเจน
   browse  = query ว่าง และไม่มี facet ใดๆ เปิด (sort เป็น "แนะนำ") → เหมือนก่อนแก้ทุกประการ
   search  = มี query หรือ facet → ค้นข้ามทุกหมวดและซ่อน tabs (facet หมวดหมู่ทำหน้าที่แทน)

⭐ คะแนน: ชื่อตรง 100 → ชื่อขึ้นต้น 80 → ชื่อมีคำ 60 → id 40 → tag 30 → ขนาด 20 → ราคาตรง 18
   ทุก token ต้อง match (AND) — ขนาด/ราคา match เฉพาะคำค้นยาว ≥ 2 ตัวอักษร

⭐ themed variant เข้าร่วมผลค้นหาเมื่อมี themeDisplayName (เหมือนที่แคตตาล็อกแสดง)
   โหมดเปลี่ยนสินค้า (swapTargetUid) แสดงเฉพาะสินค้าพื้นฐาน และไม่แสดงโซน

⭐ filter = floating panel ไม่ใช่ inline
   - อยู่ใน .viewport-wrap (position:absolute) → ไม่มีทางทับ sidebar / drawer บนมือถือ
   - ไม่มี backdrop → sidebar ยังคลิก/สกรอลล์/ลากการ์ดวางของได้ขณะแผงเปิด
   - ปิดด้วย ✕ / ปุ่ม "ปิด" / คลิกนอกแผง (ยกเว้นในแผงและใน .catalog-search) / Escape
   - สลับไปแท็บ "ห้องของฉัน" → setActivePanel() ปิดแผงให้ด้วย

⭐ Escape priority (hooks/useKeyboardShortcuts.ts)
   1) แผงตัวกรองเปิดอยู่ → ปิดแผง (คำค้น/ตัวกรองยังอยู่)
   2) ช่องค้นหาโฟกัส → ล้างคำค้น+ตัวกรอง + blur
   3) ที่เหลือ → chain เดิม (cancelPlacing / closeItemPanel / swap / closePanels)

⭐ ปุ่ม "/" หรือ Ctrl/⌘+K (hooks/useCatalogSearchShortcut.ts)
   → setActivePanel("build") + expandDrawer (มือถือ) + requestCatalogSearchFocus()

⭐ ไม่แตะ serialized shape, history, Three.js runtime หรือ placement flow → ไม่ bump STORAGE_KEY
```

Inspect:

```text
components/sidebar/CatalogSearch.tsx
components/panels/CatalogFilterPanel.tsx      ← floating filter panel
components/sidebar/BuildPanel.tsx
components/sidebar/ProductCard.tsx
components/sidebar/ZoneCard.tsx
components/sidebar/HighlightedText.tsx
components/viewport/Viewport.tsx              ← mount CatalogFilterPanel
lib/data/productSearch.ts
lib/data/products.ts        ← tags
lib/state/store.ts          ← transient slice (รวม catalogFiltersOpen)
hooks/useCatalogSearchResult.ts
hooks/useCatalogSearchShortcut.ts
hooks/useKeyboardShortcuts.ts
app/globals.css             ← .catalog-search / .catalog-filter-panel / .chip / mark.hl
```

---

# 23. Save / Share Room (backend SQLite + ลิงก์แชร์)

Flow:

```text
Header 💾 บันทึก / แชร์  (#saveShareBtn)
    ↓
openSaveShareDialog()  (components/modals/useModalStores.ts)
    ↓
SaveShareModal  (components/modals/SaveShareModal.tsx)
    ├─ การ์ด "ห้องที่กำลังแก้ไข" + ภาพ preview สดจากกล้อง 3D
    │     captureRoomThumbnail()  (lib/three/screenshot.ts)
    ├─ บันทึกไฟล์ใหม่  → POST /api/rooms                  → createRoom()
    ├─ บันทึกทับ       → PUT  /api/rooms/[id]             → updateRoom()
    ├─ เปิด / ตั้งเทมเพลต / ลบ → GET|PUT|DELETE /api/rooms
    ├─ รายการเทมเพลต   → GET  /api/templates             → listTemplateRooms()
    └─ ลิงก์แชร์ในกล่อง → shareUrlOf(id) = <origin>/r/<id>
    ↓
components/modals/RoomCard.tsx  ← การ์ดห้อง (thumbnail + "แก้ไขล่าสุด …" + เมนู ⋮)
    ↓
app/api/**/route.ts  (runtime = "nodejs", dynamic = "force-dynamic")
    ↓
lib/server/rooms.ts   (validate + repository)
    ↓
lib/server/db.ts      (node:sqlite built-in, data/roomtwin.db)
```

การเปิดลิงก์แชร์:

```text
/r/<id>  (app/r/[id]/page.tsx, await params)
    ↓
RoomTwinClient(shareId)
    ├─ prefetchSharedRoom(id)  → GET /api/rooms/<id>   (เริ่มทันที ขนานกับโหลด chunk)
    └─ dynamic import RoomTwinApp → <LoadingScreen/> (skeleton โครงแอป + progress)
    ↓
useRoomTwinInit: hasPendingSharedRoom() === true → "ไม่โหลดห้องของเจ้าของเครื่อง"
                 (ใช้ค่า default, ไม่แตะ localStorage, ไม่ setActiveCloudRoomId)
    ↓ setStoreReady(true)
SharedRoomLoader: await Promise.all([ prefetchSharedRoom(id), storeReady ])
    ↓ สำเร็จ → applyCloudRoom(room)  (lib/cloud/sharedRoomBoot.ts)
    │    owned = true   → setActiveCloudRoomId(id) + setStoredActiveRoomId + restoreSerializedState + saveToStorage
    │    owned = false  → enterSharedRoom(id, name) + restoreSerializedState
    │    resetHistory(serializeSnapshotOf(state)) → onStatus("ready") → LoadingOverlay fade-out
    └─ ล้มเหลว → onStatus("error") → การ์ด error [ลองอีกครั้ง] [ไปห้องของฉัน]
                    ↓ ไปห้องของฉัน
              returnToOwnRoom()  (lib/cloud/returnToMine.ts)
```

กติกา:

```text
⭐ ownerToken แบบไม่ระบุตัวตน — lib/cloud/ownerToken.ts (localStorage roomtwin_owner_token)
   ส่งเป็น header x-owner-token ทุก request

⭐ boot ของลิงก์แชร์ (ห้ามโหลดห้องของตัวเองทิ้ง):
   - RoomTwinClient เริ่ม prefetchSharedRoom() ก่อน editor chunk จะโหลดเสร็จ (idempotent ด้วย Map)
   - useRoomTwinInit ข้ามการอ่าน localStorage เมื่อ hasPendingSharedRoom() = true
   - useSaveState ไม่เขียน localStorage ระหว่าง pending (กัน default room + ประตู/หน้าต่าง seed ทับห้องของเจ้าของเครื่อง)
   - หลัง applyCloudRoom สำเร็จ/ล้มเหลว pending จะเป็น false → saveState กลับมาทำงานตามปกติ
   - applyCloudRoom() เป็นแหล่งเดียวของ "เอา snapshot จากเซิร์ฟเวอร์เข้า store"
     (SharedRoomLoader + SaveShareModal เรียกตัวเดียวกัน + normalizeSerializedState ให้ทุกทาง)

⭐ ระหว่าง sharedRoomId != null (ดูห้องของคนอื่น):
   - useSaveState().saveState()  "ไม่เขียน localStorage" (ยัง pushHistory → undo/redo ใช้ได้)
   - ผู้ชมแก้ได้ แต่ของเดิมของตัวเองไม่ถูกทับ
   - ต้องกด "บันทึกเป็นสำเนาของฉัน" (components/ShareBanner.tsx) → POST /api/rooms
        → exitSharedRoom() + setActiveCloudRoomId(newId) + saveToStorage()
        → history.replaceState("/") เพื่อออกจาก URL /r/<id>
   - "กลับไปห้องของฉัน" = returnToOwnRoom() (lib/cloud/returnToMine.ts)
        → clearPendingSharedRoom + exitSharedRoom
        → loadFromStorage() (หรือห้องเปล่ามาตรฐานถ้าไม่เคยมี) → restoreSerializedState + resetHistory
        → setActiveCloudRoomId(getStoredActiveRoomId()) + history.replaceState("/")
        ⭐ ไม่ reload ทั้งหน้า / ไม่โหลด bundle ใหม่ (เดิมใช้ window.location.assign)

⭐ restore เป็นแหล่งเดียว: lib/state/restore.ts (restoreSerializedState / restoreSnapshot)
   RoomTwinApp.HistoryRestoreListener (undo/redo), SharedRoomLoader และ SaveShareModal ใช้ตัวเดียวกัน

⭐ normalize/migrate เป็นแหล่งเดียว: normalizeSerializedState() ใน lib/state/storage.ts
   ใช้ทั้งตอนอ่าน localStorage และตอนรับข้อมูลจาก API (ผ่าน applyCloudRoom)

⭐ Loading UI (components/LoadingScreen.tsx + .rt-* ใน app/globals.css):
   - LoadingScreen  = fallback ตอนโหลด chunk ของ editor (skeleton โครงแอป + แบรนด์ + progress)
   - LoadingOverlay = overlay ทับแอปตอนรอข้อมูลห้องที่แชร์ + การ์ด error (retry / ไปห้องของฉัน)
   - RoomCardSkeleton (.ss-skel-card) = skeleton การ์ดห้องใน modal
   - ใช้ --z-boot-overlay (90) และเคารพ prefers-reduced-motion

⭐ รายการห้องใน modal โหลด "ทีละแท็บ":
   - เปิด modal → ยิงแค่ GET /api/rooms ; สลับไปแท็บเทมเพลตครั้งแรกจึงยิง GET /api/templates
   - cache ต่อแท็บ (lists) + seq guard กันผลลัพธ์เก่ามาทับ ; loadingTab แยกจาก busy (busy = กำลัง mutate)
   - หลังบันทึก/ลบ/เปลี่ยนชื่อ → โหลดใหม่เฉพาะแท็บ "ห้องของฉัน"
   - toggle เทมเพลต → โหลดใหม่ทั้งสองแท็บเท่าที่เคยโหลดไว้

⭐ ไม่แตะ SerializedState / ไม่ bump STORAGE_KEY
   - state ใหม่ทั้งหมด (storeReady / cloudRooms / activeCloudRoomId / sharedRoomId) เป็น transient
   - activeCloudRoomId และ ownerToken เก็บใน localStorage คนละ key (ไม่ใช่ SerializedState)
   - DB อยู่ที่ data/roomtwin.db (override ด้วย env ROOMTWIN_DB_PATH) — ถูก gitignore

⭐ เพดาน: items ≤ 500 ชิ้น, JSON ≤ 512 KB, ชื่อ ≤ 60 ตัวอักษร (lib/shared/roomShare.ts + validateRoomInput)

⭐ preview (thumbnail) ของแต่ละห้อง:
   - captureRoomThumbnail() ใน lib/three/screenshot.ts ถ่ายจาก canvas ของ Three.js
     → ต้องมี preserveDrawingBuffer = true (ตั้งใน lib/three/scene.ts initScene)
     → ครอปกลางจอเป็น 480x300 (8:5) JPEG คุณภาพ 0.62 (ประมาณ 15–35 KB)
     → คืน null เมื่อถ่ายไม่ได้ (ผู้เรียกใช้ placeholder แทน และบันทึกโดยไม่มีภาพได้)
   - เก็บเป็น data URL ในคอลัมน์ rooms.preview (TEXT NOT NULL DEFAULT '')
     → migrate() ใน lib/server/db.ts จะ ALTER TABLE ให้ DB เก่าอัตโนมัติ
   - isStorablePreview() ต้องเป็น data:image/ และ ≤ MAX_PREVIEW_BYTES (160 KB)
     → ค่าที่ใช้ไม่ได้ "ไม่ทำให้ request ล้ม" เพียงถอยไปใช้ค่าเดิม (หรือ "")
   - ส่งไปกับ CloudRoomSummary ทุกครั้ง (list/get) → ไม่มี endpoint รูปแยก
     ยอมรับ tradeoff: รายการ 20 ห้อง ≈ 600 KB (ยังไม่ต้องทำ image endpoint)

⭐ เวลา "แก้ไขล่าสุด": relativeTimeTh() / absoluteTimeTh() ใน lib/utils/format.ts
   ใช้ updated_at จากเซิร์ฟเวอร์ คำนวณฝั่ง client

⭐ บันทึกสำเนาของห้องที่แชร์: lib/cloud/saveCopy.ts → saveSharedAsCopy()
   ใช้ร่วมกันทั้ง components/ShareBanner.tsx และ SaveShareModal
```

Inspect:

```text
app/api/rooms/route.ts
app/api/rooms/[id]/route.ts
app/api/templates/route.ts
app/r/[id]/page.tsx
lib/server/db.ts            ← node:sqlite singleton (types/node-sqlite.d.ts)
lib/server/rooms.ts         ← validation + repository
lib/shared/roomShare.ts     ← types / keys / limits / shareUrlOf / serializeSnapshotOf
lib/cloud/api.ts            ← client fetch helpers
lib/cloud/ownerToken.ts
lib/cloud/activeRoom.ts
lib/cloud/saveCopy.ts       ← saveSharedAsCopy (ShareBanner + modal ใช้ร่วม)
lib/cloud/sharedRoomBoot.ts ← prefetchSharedRoom / retrySharedRoom / hasPendingSharedRoom / applyCloudRoom
lib/cloud/returnToMine.ts   ← returnToOwnRoom (กลับห้องตัวเองแบบ client-side ไม่ reload หน้า)
lib/three/screenshot.ts     ← captureRoomThumbnail (ต้องมี preserveDrawingBuffer)
lib/utils/format.ts         ← relativeTimeTh / absoluteTimeTh
lib/state/restore.ts        ← restoreSerializedState (ใช้ร่วม undo/redo + cloud)
lib/state/storage.ts        ← normalizeSerializedState / saveToStorage / loadFromStorage
hooks/useSaveState.ts       ← guard: ห้ามเขียน localStorage ตอน sharedRoomId หรือ pending share boot
hooks/useRoomTwinInit.ts    ← setStoreReady / setActiveCloudRoomId / ข้าม localStorage เมื่อเปิดลิงก์แชร์
components/SharedRoomLoader.tsx
components/ShareBanner.tsx
components/LoadingScreen.tsx    ← LoadingScreen / LoadingOverlay / InlineSpinner
components/modals/SaveShareModal.tsx
components/modals/RoomCard.tsx  ← การ์ดห้อง + RoomThumb + RoomCardSkeleton
components/modals/useModalStores.ts
components/Header.tsx
app/RoomTwinClient.tsx      ← prefetchSharedRoom(shareId) + LoadingScreen เป็น fallback ของ dynamic()
app/globals.css             ← .save-share-* / .ss-* / .share-banner / .sb-* / .rt-* (Loading UI)
```
