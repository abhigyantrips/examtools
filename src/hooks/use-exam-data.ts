import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { toast } from 'sonner';

import { useCallback, useEffect, useState } from 'react';

import type {
  Assignment,
  ExamData,
  ExamStructure,
  Faculty,
  UnavailableFaculty,
} from '@/types';

import {
  importMetadataFromJsonFile,
  importMetadataFromZipFile,
} from '@/lib/excel';
import { facultyCompare } from '@/lib/utils';

interface ExamToolsDB extends DBSchema {
  examData: {
    key: 'current';
    value: ExamData;
  };
}

const DB_NAME = 'ExamToolsDB';
const DB_VERSION = 1;
const STORE_KEY = 'current';

export function useExamData() {
  const [data, setData] = useState<ExamData>({
    faculty: [],
    examStructure: {
      days: 0,
      dutySlots: [],
      designationDutyCounts: {},
    },
    unavailability: [],
    assignments: [],
    lastUpdated: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize IndexedDB
  const initDB = useCallback(async (): Promise<IDBPDatabase<ExamToolsDB>> => {
    return openDB<ExamToolsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('examData')) {
          db.createObjectStore('examData');
        }
      },
    });
  }, []);

  // Load data from IndexedDB
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await initDB();
      const stored = await db.get('examData', STORE_KEY);

      if (stored) {
        // Convert date strings back to Date objects
        const restoredData = {
          ...stored,
          lastUpdated: new Date(stored.lastUpdated),
          examStructure: {
            ...stored.examStructure,
            dutySlots: stored.examStructure.dutySlots.map((slot) => ({
              ...slot,
              date: new Date(slot.date),
            })),
          },
        };
        setData(restoredData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [initDB]);

  // Save data to IndexedDB
  const saveData = useCallback(
    async (newData: Partial<ExamData>) => {
      try {
        const updatedData = {
          ...data,
          ...newData,
          lastUpdated: new Date(),
        };

        const db = await initDB();
        await db.put('examData', updatedData, STORE_KEY);
        setData(updatedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save data');
      }
    },
    [data, initDB]
  );

  // Specific update functions
  const updateFaculty = useCallback(
    async (faculty: Faculty[]) => {
      // Normalize order once at intake for consistency across the app
      const sorted = [...faculty].sort((a, b) => facultyCompare(a, b));
      const hadAssignments = (data.assignments || []).length > 0;
      // Changing faculty affects assignments; reset assignments
      await saveData({ faculty: sorted, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because the faculty list changed'
        );
      }
    },
    [saveData, data]
  );

  const updateExamStructure = useCallback(
    async (examStructure: ExamStructure) => {
      const hadAssignments = (data.assignments || []).length > 0;
      // Changing exam structure affects assignments; reset assignments
      await saveData({ examStructure, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because the exam configuration changed'
        );
      }
    },
    [saveData, data]
  );

  const updateUnavailability = useCallback(
    async (unavailability: UnavailableFaculty[]) => {
      const hadAssignments = (data.assignments || []).length > 0;
      // Changing unavailability affects assignments; reset assignments
      await saveData({ unavailability, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because faculty unavailability changed'
        );
      }
    },
    [saveData, data]
  );

  const updateAssignments = useCallback(
    (assignments: Assignment[]) => {
      saveData({ assignments });
    },
    [saveData]
  );

  const clearAllData = useCallback(async () => {
    try {
      const hadAssignments = (data.assignments || []).length > 0;
      const db = await initDB();
      await db.delete('examData', STORE_KEY);
      setData({
        faculty: [],
        examStructure: {
          days: 0,
          dutySlots: [],
          designationDutyCounts: {},
        },
        unavailability: [],
        assignments: [],
        lastUpdated: new Date(),
      });
      if (hadAssignments)
        toast('All data cleared; assignments have been reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  }, [initDB, data]);

  // Import metadata (either a metadata.json file or a ZIP containing internal/metadata.json)
  const importMetadata = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        const isZip = file.name.toLowerCase().endsWith('.zip');
        const imported = isZip
          ? await importMetadataFromZipFile(file)
          : await importMetadataFromJsonFile(file);

        // Save imported pieces into the DB
        // Faculty (normalized order)
        const sortedFaculty = [...imported.faculty].sort((a, b) =>
          facultyCompare(a, b)
        );

        const updatedExamStructure = imported.examStructure;

        const hadAssignments = (data.assignments || []).length > 0;
        await saveData({
          faculty: sortedFaculty,
          examStructure: updatedExamStructure,
          unavailability: imported.unavailability,
          assignments: [],
        });
        if (hadAssignments)
          toast.success('Metadata imported; assignments have been reset');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to import metadata'
        );
      } finally {
        setLoading(false);
      }
    },
    [saveData]
  );

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    updateFaculty,
    updateExamStructure,
    updateUnavailability,
    updateAssignments,
    saveData,
    clearAllData,
    reload: loadData,
    importMetadata,
  };
}
