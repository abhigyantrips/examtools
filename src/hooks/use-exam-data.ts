import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import { useCallback, useEffect, useState } from 'react';

import type {
  Assignment,
  ExamData,
  ExamStructure,
  Faculty,
  UnavailableFaculty,
} from '@/types';

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
    (faculty: Faculty[]) => {
      // Normalize order once at intake for consistency across the app
      const sorted = [...faculty].sort((a, b) => facultyCompare(a, b));
      saveData({ faculty: sorted });
    },
    [saveData]
  );

  const updateExamStructure = useCallback(
    (examStructure: ExamStructure) => {
      saveData({ examStructure });
    },
    [saveData]
  );

  const updateUnavailability = useCallback(
    (unavailability: UnavailableFaculty[]) => {
      saveData({ unavailability });
    },
    [saveData]
  );

  const updateAssignments = useCallback(
    (assignments: Assignment[]) => {
      saveData({ assignments });
    },
    [saveData]
  );

  const clearAllData = useCallback(async () => {
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  }, [initDB]);

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
  };
}
