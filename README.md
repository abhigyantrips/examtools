# ExamTools (React + TypeScript + Vite)
ExamTools is a client-side web app to automate examination invigilation: duty allocation, attendance tracking, and remuneration export. It is built with React, TypeScript and Vite and provides ZIP/Excel import-export, IndexedDB persistence, and a constraint-based assignment engine.

## Features
- Automatic duty assignment with hard and soft constraints, plus post-check validations
- Attendance marking per slot and room with round-trip ZIP import/export
- Excel generation for overview and per-slot worksheets; machine-readable JSON stored under `internal/` in exported ZIPs
- Local persistence via IndexedDB for exam state and imports

## Tech stack
- Framework: React + TypeScript (Vite)
- Excel: ExcelJS
- ZIP packaging: JSZip
- Persistence: IndexedDB (via `idb` wrapper)
- Styling: Tailwind CSS

## Quick start
1. Install dependencies:

```bash
pnpm install
```

2. Run development server:

```bash
pnpm dev
```

3. Build for production:

```bash
pnpm build
```

4. Run tests (if present):

```bash
pnpm test
```

## Key files and locations
- `src/lib/assignment.ts`: core assignment engine (`assignDuties`) and validation
- `src/lib/excel.ts`: Excel generation and `exportBatchAssignments`
- `src/lib/json-files.ts` and `src/lib/zip.ts`: ZIP + JSON import/export helpers
- `src/hooks/use-exam-data.ts`: IndexedDB persistence and import flows
- `src/pages/assignment/*`, `src/pages/attendance/*`, `src/pages/renumeration/*`: feature flows and UI
- `src/types/index.ts`: shared TypeScript types and interfaces

## Notes
- Exports include `internal/metadata.json` and `internal/assignment.json` to support round-trip imports.