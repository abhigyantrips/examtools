import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import type {
  ExamData,
  Project,
  ProjectAttendanceData,
  ProjectBundle,
  ProjectRenumerationData,
  SemesterParity,
} from '@/types';

const DB_NAME = 'ExamToolsDB';
const DB_VERSION = 2;

// Per-project store names. Keyed by `Project.id`.
const STORE_PROJECTS = 'projects';
const STORE_EXAM_DATA = 'examData';
const STORE_ATTENDANCE = 'attendance';
const STORE_RENUMERATION = 'renumeration';
const STORE_META = 'meta';

const META_KEY_ACTIVE_PROJECT = 'activeProjectId';
const META_KEY_MIGRATED_FROM_LOCAL_STORAGE = 'migratedFromLocalStorageV2';

interface ExamToolsDB extends DBSchema {
  [STORE_PROJECTS]: {
    key: string;
    value: Project;
    indexes: {
      'by-slug': string;
      'by-updatedAt': Date;
      'by-isDraft': string; // 'true' | 'false' (booleans aren't valid IDB keys)
    };
  };
  [STORE_EXAM_DATA]: {
    key: string;
    value: ExamData;
  };
  [STORE_ATTENDANCE]: {
    key: string;
    value: ProjectAttendanceData;
  };
  [STORE_RENUMERATION]: {
    key: string;
    value: ProjectRenumerationData;
  };
  [STORE_META]: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<ExamToolsDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ExamToolsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ExamToolsDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 → v2: drop the legacy single-key examData store and rebuild
        // the schema around per-project records. Per the explicit decision
        // (see project rollout plan), the old `examData/current` value is
        // discarded; localStorage data is migrated separately on first run.
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains(STORE_EXAM_DATA)) {
            db.deleteObjectStore(STORE_EXAM_DATA);
          }
          if (db.objectStoreNames.contains(STORE_PROJECTS)) {
            db.deleteObjectStore(STORE_PROJECTS);
          }
          if (db.objectStoreNames.contains(STORE_ATTENDANCE)) {
            db.deleteObjectStore(STORE_ATTENDANCE);
          }
          if (db.objectStoreNames.contains(STORE_RENUMERATION)) {
            db.deleteObjectStore(STORE_RENUMERATION);
          }
          if (db.objectStoreNames.contains(STORE_META)) {
            db.deleteObjectStore(STORE_META);
          }

          const projects = db.createObjectStore(STORE_PROJECTS, {
            keyPath: 'id',
          });
          projects.createIndex('by-slug', 'slug', { unique: true });
          projects.createIndex('by-updatedAt', 'updatedAt');
          projects.createIndex('by-isDraft', 'isDraft');

          db.createObjectStore(STORE_EXAM_DATA);
          db.createObjectStore(STORE_ATTENDANCE);
          db.createObjectStore(STORE_RENUMERATION);
          db.createObjectStore(STORE_META);
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export async function generateUniqueSlug(
  baseTitle: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(baseTitle) || 'untitled-exam';
  const db = await getDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const idx = tx.store.index('by-slug');

  let candidate = base;
  let suffix = 2;
  // Walk until we find a free slug. Bounded by a sane upper limit so we
  // never spin forever even on a corrupted store.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const existing = await idx.get(candidate);
    if (!existing || existing.id === excludeId) {
      await tx.done;
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  await tx.done;
  // Fallback: append timestamp.
  return `${base}-${Date.now()}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  title: string;
  semesterParity: SemesterParity;
  notes?: string;
  isDraft?: boolean;
}

export async function createProject(
  input: CreateProjectInput
): Promise<Project> {
  const now = new Date();
  const slug = await generateUniqueSlug(input.title);
  const project: Project = {
    id: newId(),
    slug,
    title: input.title.trim() || 'Untitled Exam',
    semesterParity: input.semesterParity,
    notes: input.notes ?? '',
    isDraft: input.isDraft ?? false,
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDB();
  await db.put(STORE_PROJECTS, project);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDB();
  return (await db.get(STORE_PROJECTS, id)) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex(STORE_PROJECTS, 'by-updatedAt');
  return projects.reverse(); // most recently updated first
}

export interface UpdateProjectInput {
  title?: string;
  semesterParity?: SemesterParity;
  notes?: string;
  isDraft?: boolean;
}

export async function updateProject(
  id: string,
  patch: UpdateProjectInput
): Promise<Project> {
  const db = await getDB();
  const existing = await db.get(STORE_PROJECTS, id);
  if (!existing) throw new Error(`Project ${id} not found`);

  const next: Project = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim() || existing.title
        : existing.title,
    semesterParity: patch.semesterParity ?? existing.semesterParity,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    isDraft: patch.isDraft !== undefined ? patch.isDraft : existing.isDraft,
    updatedAt: new Date(),
  };

  // Only re-slug if the title actually changed.
  if (patch.title && patch.title.trim() && patch.title.trim() !== existing.title) {
    next.slug = await generateUniqueSlug(next.title, id);
  }

  await db.put(STORE_PROJECTS, next);
  return next;
}

export async function touchProject(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get(STORE_PROJECTS, id);
  if (!existing) return;
  await db.put(STORE_PROJECTS, { ...existing, updatedAt: new Date() });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    [
      STORE_PROJECTS,
      STORE_EXAM_DATA,
      STORE_ATTENDANCE,
      STORE_RENUMERATION,
      STORE_META,
    ],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore(STORE_PROJECTS).delete(id),
    tx.objectStore(STORE_EXAM_DATA).delete(id),
    tx.objectStore(STORE_ATTENDANCE).delete(id),
    tx.objectStore(STORE_RENUMERATION).delete(id),
  ]);
  // Clear active pointer if it referenced this project.
  const metaStore = tx.objectStore(STORE_META);
  const active = await metaStore.get(META_KEY_ACTIVE_PROJECT);
  if (active === id) {
    await metaStore.delete(META_KEY_ACTIVE_PROJECT);
  }
  await tx.done;
}

// ---------------------------------------------------------------------------
// Per-phase data accessors
// ---------------------------------------------------------------------------

export async function getExamData(projectId: string): Promise<ExamData | null> {
  const db = await getDB();
  const value = await db.get(STORE_EXAM_DATA, projectId);
  if (!value) return null;
  return rehydrateExamData(value);
}

export async function putExamData(
  projectId: string,
  data: ExamData
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_EXAM_DATA, STORE_PROJECTS], 'readwrite');
  await tx.objectStore(STORE_EXAM_DATA).put(data, projectId);
  const project = await tx.objectStore(STORE_PROJECTS).get(projectId);
  if (project) {
    await tx
      .objectStore(STORE_PROJECTS)
      .put({ ...project, updatedAt: new Date() });
  }
  await tx.done;
}

export async function getAttendance(
  projectId: string
): Promise<ProjectAttendanceData | null> {
  const db = await getDB();
  return (await db.get(STORE_ATTENDANCE, projectId)) ?? null;
}

export async function putAttendance(
  projectId: string,
  data: ProjectAttendanceData
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_ATTENDANCE, STORE_PROJECTS], 'readwrite');
  await tx.objectStore(STORE_ATTENDANCE).put(data, projectId);
  const project = await tx.objectStore(STORE_PROJECTS).get(projectId);
  if (project) {
    await tx
      .objectStore(STORE_PROJECTS)
      .put({ ...project, updatedAt: new Date() });
  }
  await tx.done;
}

export async function getRenumeration(
  projectId: string
): Promise<ProjectRenumerationData | null> {
  const db = await getDB();
  return (await db.get(STORE_RENUMERATION, projectId)) ?? null;
}

export async function putRenumeration(
  projectId: string,
  data: ProjectRenumerationData
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_RENUMERATION, STORE_PROJECTS], 'readwrite');
  await tx.objectStore(STORE_RENUMERATION).put(data, projectId);
  const project = await tx.objectStore(STORE_PROJECTS).get(projectId);
  if (project) {
    await tx
      .objectStore(STORE_PROJECTS)
      .put({ ...project, updatedAt: new Date() });
  }
  await tx.done;
}

export async function getProjectBundle(
  projectId: string
): Promise<ProjectBundle | null> {
  const db = await getDB();
  const tx = db.transaction(
    [STORE_PROJECTS, STORE_EXAM_DATA, STORE_ATTENDANCE, STORE_RENUMERATION],
    'readonly'
  );
  const [project, examData, attendance, renumeration] = await Promise.all([
    tx.objectStore(STORE_PROJECTS).get(projectId),
    tx.objectStore(STORE_EXAM_DATA).get(projectId),
    tx.objectStore(STORE_ATTENDANCE).get(projectId),
    tx.objectStore(STORE_RENUMERATION).get(projectId),
  ]);
  await tx.done;
  if (!project) return null;
  return {
    project,
    examData: examData ? rehydrateExamData(examData) : null,
    attendance: attendance ?? null,
    renumeration: renumeration ?? null,
  };
}

function rehydrateExamData(stored: ExamData): ExamData {
  // IndexedDB preserves Date objects via the structured clone algorithm,
  // but data migrated from older paths or stored as JSON strings may need
  // coercion. Be defensive.
  return {
    ...stored,
    lastUpdated:
      stored.lastUpdated instanceof Date
        ? stored.lastUpdated
        : new Date(stored.lastUpdated as unknown as string),
    examStructure: {
      ...stored.examStructure,
      dutySlots: stored.examStructure.dutySlots.map((slot) => ({
        ...slot,
        date:
          slot.date instanceof Date
            ? slot.date
            : new Date(slot.date as unknown as string),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Active project pointer
// ---------------------------------------------------------------------------

export async function getActiveProjectId(): Promise<string | null> {
  const db = await getDB();
  const v = await db.get(STORE_META, META_KEY_ACTIVE_PROJECT);
  return typeof v === 'string' ? v : null;
}

export async function setActiveProjectId(id: string | null): Promise<void> {
  const db = await getDB();
  if (id == null) {
    await db.delete(STORE_META, META_KEY_ACTIVE_PROJECT);
  } else {
    await db.put(STORE_META, id, META_KEY_ACTIVE_PROJECT);
  }
}

// ---------------------------------------------------------------------------
// Migration flag
// ---------------------------------------------------------------------------

export async function hasRunLocalStorageMigration(): Promise<boolean> {
  const db = await getDB();
  const v = await db.get(STORE_META, META_KEY_MIGRATED_FROM_LOCAL_STORAGE);
  return v === true;
}

export async function markLocalStorageMigrationDone(): Promise<void> {
  const db = await getDB();
  await db.put(STORE_META, true, META_KEY_MIGRATED_FROM_LOCAL_STORAGE);
}
