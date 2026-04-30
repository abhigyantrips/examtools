import { useCallback, useEffect, useState } from 'react';

import type { ProjectRenumerationData } from '@/types';

import {
  getActiveProjectId,
  getRenumeration,
  putRenumeration,
} from '@/lib/projects-db';

import { notifyProjectsChanged } from './use-projects';

const ACTIVE_EVENT = 'examtools:active-project-changed';
const PROJECTS_EVENT = 'examtools:projects-changed';

const EMPTY: ProjectRenumerationData = {
  roles: [],
  staffList: [],
  slotWiseAssignments: {},
  nonSlotAssignments: {},
  roleNameToIdMap: {},
  updatedAt: new Date(),
};

export function useProjectRenumeration(projectIdOverride?: string | null) {
  const [projectId, setProjectId] = useState<string | null>(
    projectIdOverride ?? null
  );
  const [data, setData] = useState<ProjectRenumerationData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectIdOverride !== undefined) {
      setProjectId(projectIdOverride);
      return;
    }
    let cancelled = false;
    (async () => {
      const id = await getActiveProjectId();
      if (!cancelled) setProjectId(id);
    })();
    const onActive = async () => {
      const id = await getActiveProjectId();
      if (!cancelled) setProjectId(id);
    };
    window.addEventListener(ACTIVE_EVENT, onActive);
    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVE_EVENT, onActive);
    };
  }, [projectIdOverride]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!projectId) {
        setData(EMPTY);
        return;
      }
      const stored = await getRenumeration(projectId);
      setData(stored ?? EMPTY);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load renumeration'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(PROJECTS_EVENT, onChange);
    return () => window.removeEventListener(PROJECTS_EVENT, onChange);
  }, [reload]);

  const save = useCallback(
    async (patch: Partial<ProjectRenumerationData>) => {
      if (!projectId) {
        console.warn('useProjectRenumeration.save: no active project');
        return;
      }
      const next: ProjectRenumerationData = {
        ...data,
        ...patch,
        updatedAt: new Date(),
      };
      await putRenumeration(projectId, next);
      setData(next);
      notifyProjectsChanged();
    },
    [projectId, data]
  );

  const clear = useCallback(async () => {
    if (!projectId) return;
    await putRenumeration(projectId, EMPTY);
    setData(EMPTY);
    notifyProjectsChanged();
  }, [projectId]);

  return {
    data,
    projectId,
    loading,
    error,
    reload,
    save,
    clear,
  };
}
