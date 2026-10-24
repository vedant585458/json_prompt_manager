# Source layout

This directory follows the layer rules documented in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

Dependencies point inward:

```
routes → features → components → store → data → domain
```

- `domain/` — pure TypeScript, no React, no browser APIs, no storage imports.
- `data/` — repository interfaces and adapters; may import `domain`, never React.
- `store/` — Zustand stores orchestrating repositories; components never touch IndexedDB.
- `components/ui/` — design-system primitives without domain knowledge.
- `routes/` — screen composition.

Empty directories are tracked with `.gitkeep` and are filled by the tasks that own them in
[`../tasks.md`](../tasks.md). No placeholder or mock feature lives in this tree.
