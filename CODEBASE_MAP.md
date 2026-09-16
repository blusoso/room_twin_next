# RoomTwin Codebase Map

This document is the architectural map of RoomTwin.

Use this document to understand how the major systems connect before changing existing behavior.

Do not treat a file named in a user request as the complete implementation of a feature.

---

# 1. System Overview

RoomTwin is a Thai-language room-decoration editor built as a single-page Next.js App Router application.

Core architecture:

```text
Next.js
  ↓
React UI
  ↓
Zustand application state
  ↓
Imperative Three.js runtime
  ↓
localStorage persistence
```

The important distinction is:

```text
Zustand = source of truth

Three.js = runtime/rendering representation

React = UI layer
```

Do not make Three.js objects the source of truth for persistent application state.

---

# 2. Application Entry

```text
app/page.tsx
    ↓
app/RoomTwinClient.tsx
    ↓
components/RoomTwinApp.tsx
```

## `app/page.tsx`

Next.js route entry.

Keep this layer thin.

## `app/RoomTwinClient.tsx`

Client-side bootstrap.

RoomTwin is dynamically imported with SSR disabled because the application depends on browser-side Three.js state.

## `components/RoomTwinApp.tsx`

Main application orchestrator.

It connects:

* Zustand
* React UI
* Three.js initialization
* history restore
* global RoomTwin events
* save/persistence behavior

When a feature changes application behavior, inspect this file when the feature crosses UI/state/Three.js boundaries.

---

# 3. React UI

```text
components/
├── RoomTwinApp.tsx
├── viewport/
├── sidebar/
├── panels/
├── cart/
└── modals/
```

React components should primarily represent UI.

They should not independently become a second source of truth for room/furniture state.

---

# 4. Sidebar

```text
components/sidebar/
```

Responsible for:

* browsing categories
* browsing products
* browsing zones
* room tree
* build actions
* starting placement
* selecting room/build modes

Typical flow:

```text
Sidebar interaction
    ↓
Zustand action
    ↓
placement / selection state
    ↓
Three.js interaction or UI update
```

When changing sidebar behavior, search for the Zustand action and its consumers rather than modifying only the component.

---

# 5. Panels

```text
components/panels/
```

Panels edit application state.

Important domains include:

* room setup
* room structure
* surface
* blocks
* zone selection
* zone/theme customization
* item customization

Typical flow:

```text
Panel input
    ↓
handler
    ↓
Zustand action
    ↓
dependent 3D update
    ↓
save/history
```

A panel change is not complete if only the UI changes.

---

# 6. Viewport

```text
components/viewport/
```

Contains:

* Canvas3D
* viewport overlays
* toolbar
* viewport-facing UI

The viewport is the React-side interface to the Three.js world.

The actual Three.js scene is implemented under:

```text
lib/three/
```

Do not put persistent room/furniture state only inside viewport components.

---

# 7. Zustand State

Primary state owner:

```text
lib/state/store.ts
```

Types:

```text
lib/state/types.ts
```

Persistence:

```text
lib/state/storage.ts
```

The main state is:

```text
RoomTwinState
├── room
├── surface
├── placedItems
├── zones
├── selection
├── placement
├── customization
├── active UI state
├── history
├── cart
└── drawer/UI flags
```

Important rule:

```text
If data affects the saved room,
it belongs in application state,
not only in a React component or Three.js object.
```

---

# 8. Room State

Defined primarily by:

```text
lib/state/types.ts
lib/state/store.ts
```

Current room model:

```text
RoomShape
├── w
├── d
├── h
├── shape
├── blocks
├── cellSize
└── cellLevels
```

Room geometry is a high-impact dependency.

Changing:

* width
* depth
* height
* shape
* blocks
* cell levels

may affect:

* room shell
* floor
* walls
* ceiling
* wall-mounted objects
* ceiling-mounted objects
* furniture clamping
* object placement
* zone placement
* persistence
* history

Therefore room changes must be traced through all dependent systems.

---

# 9. Placed Items

Type:

```text
lib/state/types.ts
```

Main state:

```text
lib/state/store.ts
```

A `PlacedItem` is persistent application data.

Conceptually:

```text
PlacedItem
├── uid
├── productId
├── params
├── position
├── rotation
├── parentUid
├── wall mounting
├── ceiling mounting
├── zone relationship
├── slot relationship
├── locked state
└── display/customization metadata
```

The Three.js representation is derived from this data.

---

# 10. Product Catalog

Primary file:

```text
lib/data/products.ts
```

Products are data-driven.

A product definition generally contains:

```text
ProductDef
├── identity
├── category
├── dimensions
├── metadata
└── build(...)
        ↓
    THREE.Group
```

Important:

```text
Product definition
    ↓
THREE.Group
```

is different from:

```text
PlacedItem
```

`PlacedItem` is persistent room data.

The THREE.Group is the runtime visual representation.

When changing a product, inspect both the product definition and the code that instantiates it.

---

# 11. Zones

Primary file:

```text
lib/data/zones.ts
```

Zones are higher-level room-layout concepts.

Conceptually:

```text
Zone
├── zone definition
├── slots
├── generated items
├── zone metadata
└── relationships between items
```

Typical flow:

```text
User chooses zone
    ↓
startPlacingZone()
    ↓
zone placement
    ↓
PlacedItems
    ↓
Three.js instantiation
```

When changing zone behavior, inspect:

* zone definitions
* zone placement
* placed item relationships
* zone metadata
* Three.js instantiation
* deletion behavior

---

# 12. Three.js Runtime

Primary directory:

```text
lib/three/
```

This is an imperative runtime.

There is no react-three-fiber.

Important modules include:

```text
lib/three/
├── scene.ts
├── instantiate.ts
├── roomShell.ts
├── placement.ts
├── wallPlacement.ts
├── ceilingPlacement.ts
├── reclamp.ts
├── zoneActions.ts
└── index.ts
```

---

# 13. Three.js Scene

```text
lib/three/scene.ts
```

Contains module-level runtime objects such as:

```text
scene
camera
renderer
objectsByUid
groups
```

The scene is mutable.

Do not treat the Three.js scene as persistent application state.

---

# 14. Instantiation

```text
lib/three/instantiate.ts
```

Conceptual flow:

```text
PlacedItem
    ↓
ProductDef
    ↓
ProductDef.build(...)
    ↓
THREE.Group
    ↓
scene
objectsByUid
```

When adding/removing/rebuilding furniture, inspect this path.

---

# 15. Placement

Placement is split by physical relationship.

```text
lib/three/placement.ts
lib/three/wallPlacement.ts
lib/three/ceilingPlacement.ts
lib/three/reclamp.ts
```

Different objects may use different coordinate systems.

Examples:

```text
Floor item
→ x / z / restY

Wall item
→ wallId / u / v / wall orientation

Ceiling item
→ ceiling-related placement
```

Do not assume every object uses the same placement logic.

---

# 16. Room Shell

```text
lib/three/roomShell.ts
```

Responsible for the visual room structure.

Room geometry changes may require rebuilding or updating:

* floor
* walls
* ceiling
* openings
* related structural visuals

Whenever room dimensions or shape change, inspect this module and its callers.

---

# 17. Reclamping

```text
lib/three/reclamp.ts
```

Responsible for maintaining valid object placement when room geometry or related constraints change.

Room changes may therefore require:

```text
room change
    ↓
reclamp
    ↓
item position correction
```

Do not change room geometry without considering object placement.

---

# 18. Hooks

```text
hooks/
```

Hooks provide React-side glue between:

```text
UI
Zustand
Three.js
browser events
persistence
```

Important areas include:

```text
initialization
placement
pointer interaction
keyboard interaction
save
```

When changing interaction behavior, search both the hook and its callers.

---

# 19. Persistence

```text
lib/state/storage.ts
hooks/useSaveState.ts
lib/data/constants.ts
```

Current storage key:

```text
roomtwin_state_v12
```

Legacy keys (read as fallback in `loadFromStorage()` so saved rooms migrate instead of being lost):

```text
lib/data/constants.ts → LEGACY_STORAGE_KEYS = ["roomtwin_state_v11"]
```

Important rule:

```text
If serialized state shape changes,
bump STORAGE_KEY.
```

Serialization must preserve:

```text
room
items
surface
zoneMeta
```

Special structures require conversion:

```text
Set → Array → Set

Map → entries → Map
```

Do not introduce non-serializable persistent state without updating serialization and restoration.

---

# 20. History

Undo/redo uses JSON snapshots.

Conceptual flow:

```text
Current Zustand state
    ↓
serialize
    ↓
history snapshot
```

Restore:

```text
history snapshot
    ↓
JSON parse
    ↓
restore Zustand state
    ↓
rebuild Three.js runtime
```

The restore event is:

```text
roomtwin:restore
```

History restoration is coordinated by:

```text
components/RoomTwinApp.tsx
```

When changing persistent state, inspect history serialization/restoration as well.

---

# 21. Custom Events

RoomTwin uses browser `CustomEvent`s for cross-component signals.

Prefix:

```text
roomtwin:
```

Examples include:

```text
roomtwin:restore
roomtwin:closePanels
roomtwin:closeRoomStructure
roomtwin:closeZoneTheme
roomtwin:closeBlocksEditor
roomtwin:swapSlot
```

Before changing or removing a custom event:

1. Search for every dispatcher.
2. Search for every listener.
3. Understand the payload.
4. Update both sides.
5. Verify behavior after the event fires.

Never assume the file that dispatches an event is the only implementation.

---

# 22. Feature Dependency Rule

Use this rule for every behavior change:

```text
User action
    ↓
UI component / event
    ↓
handler
    ↓
Zustand action
    ↓
state/data transformation
    ↓
dependent systems
    ↓
Three.js runtime
    ↓
persistence/history
```

Before editing, identify the complete affected path.

---

# 23. High-Impact Domains

These domains have broad dependencies:

```text
Room geometry
Furniture placement
Wall mounting
Ceiling mounting
Zone generation
PlacedItem schema
Serialization
History restore
Product definitions
CustomEvents
```

Changes in these areas require broader tracing.

---

# 24. Low-Risk UI Changes

Pure visual changes may not require deep tracing when they do not alter behavior.

Examples:

```text
spacing
padding
font size
border radius
visual colors
layout-only CSS
```

Still verify that the component does not contain hidden state or behavior.

---

# 25. Change Classification

Before editing, classify the task:

```text
A. UI-only
B. State-only
C. State + Three.js
D. State + persistence
E. Room geometry
F. Product/catalog
G. Zone behavior
H. Cross-component event
I. Serialized schema
```

For B-I, trace dependencies before editing.

---

# 26. Definition of Complete

A behavior change is complete only when:

```text
UI works
AND
state is correct
AND
Three.js representation is correct
AND
related constraints are correct
AND
persistence is correct when applicable
AND
undo/redo remains correct when applicable
```

Do not stop after the directly visible UI behavior works.
