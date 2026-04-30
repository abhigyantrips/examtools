import { useCallback, useEffect, useState } from 'react';

import type { ProjectCapabilities } from '@/lib/projects-db';
import { listProjectCapabilities } from '@/lib/projects-db';

const PROJECTS_EVENT = 'examtools:projects-changed';

const EMPTY: ProjectCapabilities = {
  hasAssignment: false,
  hasAttendance: false,
};

/**
 * Returns a map of projectId -> {hasAssignment, hasAttendance}, refreshed
 * whenever a project or per-phase data record changes anywhere in the app.
 *
 * Lookups for unknown ids return the empty capability object so consumers
 * can call `caps[id]` unconditionally without null-checks.
 */
export function useProjectCapabilities(): {
  capabilities: Record<string, ProjectCapabilities>;
  loading: boolean;
  reload: () => Promise<void>;
  capabilityFor: (id: string | null | undefined) => ProjectCapabilities;
} {
  const [capabilities, setCapabilities] = useState<
    Record<string, ProjectCapabilities>
  >({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listProjectCapabilities();
      setCapabilities(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(PROJECTS_EVENT, onChange);
    return () => window.removeEventListener(PROJECTS_EVENT, onChange);
  }, [reload]);

  const capabilityFor = useCallback(
    (id: string | null | undefined) => (id ? capabilities[id] : EMPTY) ?? EMPTY,
    [capabilities]
  );

  return { capabilities, loading, reload, capabilityFor };
}
