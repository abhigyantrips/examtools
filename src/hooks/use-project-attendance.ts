import { useCallback, useEffect, useState } from 'react';

import type { ProjectAttendanceData, SlotAttendance } from '@/types';

import {
  getActiveProjectId,
  getAttendance,
  putAttendance,
} from '@/lib/projects-db';

import { notifyProjectsChanged } from './use-projects';

const ACTIVE_EVENT = 'examtools:active-project-changed';
const PROJECTS_EVENT = 'examtools:projects-changed';

const EMPTY: ProjectAttendanceData = {
  slots: {},
  updatedAt: new Date(),
};

export function useProjectAttendance(projectIdOverride?: string | null) {
  const [projectId, setProjectId] = useState<string | null>(
    projectIdOverride ?? null
  );
  const [data, setData] = useState<ProjectAttendanceData>(EMPTY);
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
      const stored = await getAttendance(projectId);
      setData(stored ?? EMPTY);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load attendance'
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

  const replaceAll = useCallback(
    async (slots: Record<string, SlotAttendance>) => {
      if (!projectId) {
        console.warn('useProjectAttendance.replaceAll: no active project');
        return;
      }
      const next: ProjectAttendanceData = {
        slots,
        updatedAt: new Date(),
      };
      await putAttendance(projectId, next);
      setData(next);
      notifyProjectsChanged();
    },
    [projectId]
  );

  const upsertSlot = useCallback(
    async (slot: SlotAttendance) => {
      if (!projectId) {
        console.warn('useProjectAttendance.upsertSlot: no active project');
        return;
      }
      const key = `d${slot.day}-s${slot.slot}`;
      const next: ProjectAttendanceData = {
        slots: { ...data.slots, [key]: { ...slot, updatedAt: new Date().toISOString() } },
        updatedAt: new Date(),
      };
      await putAttendance(projectId, next);
      setData(next);
      notifyProjectsChanged();
    },
    [projectId, data.slots]
  );

  const clear = useCallback(async () => {
    if (!projectId) return;
    await putAttendance(projectId, EMPTY);
    setData(EMPTY);
    notifyProjectsChanged();
  }, [projectId]);

  return {
    data,
    projectId,
    loading,
    error,
    reload,
    replaceAll,
    upsertSlot,
    clear,
  };
}
