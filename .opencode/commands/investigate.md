---

## description: Investigate a RoomTwin feature and trace all affected code before editing

Investigate the following RoomTwin task:

$ARGUMENTS

Do NOT edit files yet.

Follow this exact investigation process.

## 1. Understand the request

Rewrite the requested behavior in one or two precise sentences.

Separate:

* requested behavior
* current behavior
* expected behavior
* constraints

Do not invent requirements.

## 2. Read architecture guidance

Read:

* AGENTS.md
* CODEBASE_MAP.md
* FEATURE_FLOWS.md

Use the relevant feature flow if one exists.

## 3. Find the entry point

Search the repository for:

* visible UI text
* component names
* action names
* state fields
* product IDs
* event names
* handler names

Identify where the user interaction enters the system.

## 4. Trace the complete flow

Trace:

```text
user interaction
→ UI handler
→ Zustand/state mutation
→ dependent state/data
→ Three.js/runtime effect
→ persistence
→ history/restore
```

Also check:

```text
CustomEvent dispatch
→ listener
→ side effect
```

when applicable.

## 5. Identify affected files

Create a table:

| File | Role                  | Why affected        |
| ---- | --------------------- | ------------------- |
| path | UI/state/runtime/etc. | concrete dependency |

Only include files supported by repository evidence.

## 6. Identify risks

Check for:

* duplicated source of truth
* stale Three.js objects
* state/runtime mismatch
* placement constraints
* wall/ceiling dependencies
* zone relationships
* parentUid relationships
* serialization
* migrations
* history
* CustomEvents
* localStorage restore

## 7. Identify verification

Specify exactly what should be checked after implementation.

For example:

```text
- UI behavior
- 3D result
- existing furniture
- wall-mounted objects
- localStorage reload
- undo
- redo
```

Only include checks relevant to the task.

## 8. Final response

Return:

### Understanding

...

### Flow

```text
A
↓
B
↓
C
```

### Affected files

| File | Role | Change likely? |
| ---- | ---- | -------------- |

### Dependencies

...

### Risks

...

### Verification

...

### Implementation plan

Provide a concise ordered plan.

Do not edit files during this command.
