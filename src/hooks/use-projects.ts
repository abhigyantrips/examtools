import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '@/lib/projects-db';
import {
  createProject as dbCreate,
  deleteProject as dbDelete,
  getActiveProjectId,
  listProjects,
  setActiveProjectId,
  updateProject as dbUpdate,
} from '@/lib/projects-db';
import { migrateLegacyLocalStorageOnce } from '@/lib/projects-migration';

import type { Project } from '@/types';

// Cross-component event so multiple `useProjects` instances stay in sync
// without depending on an external store.
const PROJECTS_EVENT = 'examtools:projects-changed';
const ACTIVE_EVENT = 'examtools:active-project-changed';

function emit(name: string) {
  window.dispatchEvent(new Event(name));
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [list, active] = await Promise.all([
        listProjects(),
        getActiveProjectId(),
      ]);
      setProjects(list);
      setActiveProjectIdState(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await migrateLegacyLocalStorageOnce();
      } catch (err) {
        console.warn('Legacy storage migration failed', err);
      }
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    const onChange = () => {
      reload();
    };
    window.addEventListener(PROJECTS_EVENT, onChange);
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => {
      window.removeEventListener(PROJECTS_EVENT, onChange);
      window.removeEventListener(ACTIVE_EVENT, onChange);
    };
  }, [reload]);

  const create = useCallback(
    async (input: CreateProjectInput, options?: { setActive?: boolean }) => {
      const project = await dbCreate(input);
      if (options?.setActive) {
        await setActiveProjectId(project.id);
      }
      emit(PROJECTS_EVENT);
      if (options?.setActive) emit(ACTIVE_EVENT);
      return project;
    },
    []
  );

  const update = useCallback(
    async (id: string, patch: UpdateProjectInput) => {
      const project = await dbUpdate(id, patch);
      emit(PROJECTS_EVENT);
      return project;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await dbDelete(id);
    emit(PROJECTS_EVENT);
    emit(ACTIVE_EVENT);
  }, []);

  const setActive = useCallback(async (id: string | null) => {
    await setActiveProjectId(id);
    emit(ACTIVE_EVENT);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  return {
    projects,
    activeProject,
    activeProjectId,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    setActive,
  };
}

// Lightweight hook for components that only need the active project id and a
// way to subscribe to changes. Avoids re-listing every project.
export function useActiveProjectId(): {
  activeProjectId: string | null;
  setActive: (id: string | null) => Promise<void>;
  loading: boolean;
} {
  const [activeProjectId, setIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await migrateLegacyLocalStorageOnce();
      const id = await getActiveProjectId();
      setIdState(id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_EVENT, onChange);
  }, [reload]);

  const setActive = useCallback(async (id: string | null) => {
    await setActiveProjectId(id);
    emit(ACTIVE_EVENT);
  }, []);

  return { activeProjectId, setActive, loading };
}

// Helper for tools that want to broadcast a change they made to the active
// project's per-phase data so other open views can refresh.
export function notifyProjectsChanged() {
  emit(PROJECTS_EVENT);
}

export function notifyActiveProjectChanged() {
  emit(ACTIVE_EVENT);
}
