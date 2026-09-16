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

---

# 9. Wall-Mounted Furniture

Flow:

```text
Wall object
    ↓
wall placement data
    ↓
wallId / u / v / rotation
    ↓
wallPlacement.ts
    ↓
Three.js transform
```

Room geometry changes may affect wall-mounted objects.

Always inspect:

```text
lib/three/wallPlacement.ts
lib/three/reclamp.ts
lib/three/roomShell.ts
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

Inspect:

```text
lib/data/zones.ts
lib/state/store.ts
lib/state/types.ts
lib/three/zoneActions.ts
lib/three/instantiate.ts
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
