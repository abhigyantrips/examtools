import JSZip from 'jszip';
import { ClipboardCheck } from 'lucide-react';

import { useCallback, useMemo, useState } from 'react';

import type { SlotAttendance } from '@/types';

import {
  createEmptyAttendance,
  generateZipBlob,
  loadZip,
  readAssignmentsFromZip,
  readSlotAttendance,
  saveSlotAttendance,
} from '@/lib/attendance';

import { useExamData } from '@/hooks/use-exam-data';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function AttendancePage() {
  const { data: examData } = useExamData();
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    day: number;
    slot: number;
  } | null>(null);
  const [attendance, setAttendance] = useState<SlotAttendance | null>(null);

  const slots = useMemo(
    () => examData.examStructure.dutySlots || [],
    [examData]
  );

  const onImportZip = useCallback(async (f: File | null) => {
    if (!f) return;
    try {
      const zip = await loadZip(f);
      setZipInstance(zip as any);
      setZipFileName(f.name);

      console.log('Loaded ZIP');
    } catch (err) {
      console.error('Failed to load ZIP', err);
    }
  }, []);

  const onSelectSlot = useCallback(
    async (day: number, slot: number) => {
      setSelected({ day, slot });
      if (!zipInstance) {
        // create empty template based on examData
        const ds = slots.find((s) => s.day === day && s.slot === slot);
        const att = createEmptyAttendance(
          day,
          slot,
          ds ? ds.date.toISOString() : new Date().toISOString(),
          ds ? `${ds.startTime} - ${ds.endTime}` : undefined
        );
        setAttendance(att);
        return;
      }
      const existing = await readSlotAttendance(zipInstance, day, slot);
      if (existing) setAttendance(existing);
      else {
        const ds = slots.find((s) => s.day === day && s.slot === slot);
        const att = createEmptyAttendance(
          day,
          slot,
          ds ? ds.date.toISOString() : new Date().toISOString(),
          ds ? `${ds.startTime} - ${ds.endTime}` : undefined
        );
        // try to prefill from internal assignment.json
        const fromZip = await readAssignmentsFromZip(zipInstance, day, slot);
        if (fromZip && fromZip.length > 0) {
          att.entries = fromZip.map((r) => ({
            facultyId: r.facultyId,
            role: r.role as any,
            status: 'absent',
          }));
        }
        setAttendance(att);
      }
    },
    [zipInstance, slots]
  );

  const onToggleStatus = useCallback(
    (facultyId: string) => {
      if (!attendance) return;
      const next = { ...attendance } as SlotAttendance;
      const idx = next.entries.findIndex((e) => e.facultyId === facultyId);
      if (idx === -1) {
        next.entries.push({ facultyId, role: 'regular', status: 'present' });
      } else {
        const entry = next.entries[idx];
        // cycle: present -> absent -> replacement -> present
        if (entry.status === 'present') entry.status = 'absent';
        else if (entry.status === 'absent') entry.status = 'replacement';
        else entry.status = 'present';
      }
      next.updatedAt = new Date().toISOString();
      setAttendance(next);
    },
    [attendance]
  );

  const onSave = useCallback(async () => {
    if (!attendance) return;
    let zip = zipInstance;
    if (!zip) zip = new JSZip();
    await saveSlotAttendance(zip, attendance);
    const blob = await generateZipBlob(zip);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      zipFileName ||
      `exam-duty-updated-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [attendance, zipInstance, zipFileName]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <ClipboardCheck className="mx-auto mb-4 size-16 text-green-600" />
            <CardTitle className="text-2xl">Duty Attendance Marking</CardTitle>
            <CardDescription>
              Import exported ZIP, mark attendance per slot and save back into
              ZIP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  id="zipfile"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) =>
                    onImportZip(e.target.files ? e.target.files[0] : null)
                  }
                />
                <div>
                  {zipFileName ||
                    'No ZIP loaded'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={`${s.day}-${s.slot}`}
                    className={`rounded border p-2 ${selected && selected.day === s.day && selected.slot === s.slot ? 'bg-blue-100' : ''}`}
                    onClick={() => onSelectSlot(s.day, s.slot)}
                  >
                    Day {s.day + 1} - Slot {s.slot + 1}
                    <div className="text-xs">{s.date.toLocaleDateString()}</div>
                  </button>
                ))}
              </div>

              {attendance && (
                <div>
                  <h3 className="font-semibold">
                    Attendance for Day {attendance.day + 1} Slot{' '}
                    {attendance.slot + 1}
                  </h3>
                  <div className="mt-2 space-y-1">
                    {(attendance.entries.length === 0
                      ? examData.assignments
                          .filter(
                            (a) =>
                              a.day === attendance.day &&
                              a.slot === attendance.slot
                          )
                          .map((a) => ({
                            facultyId: a.facultyId,
                            role: a.role,
                          }))
                      : attendance.entries.map(
                          (e) =>
                            ({
                              facultyId: e.facultyId,
                              role: e.role,
                              status: e.status,
                            }) as any
                        )
                    ).map((row: any) => {
                      const currentStatus =
                        attendance.entries.find(
                          (en) => en.facultyId === row.facultyId
                        )?.status || 'absent';
                      return (
                        <div
                          key={row.facultyId}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <div>
                            <div className="font-medium">{row.facultyId}</div>
                            <div className="text-xs">{row.role}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className={`rounded border px-2 py-1 ${currentStatus === 'present' ? 'bg-green-100' : ''}`}
                              onClick={() => {
                                // set present
                                if (!attendance) return;
                                const next = {
                                  ...attendance,
                                } as SlotAttendance;
                                const idx = next.entries.findIndex(
                                  (e) => e.facultyId === row.facultyId
                                );
                                if (idx === -1)
                                  next.entries.push({
                                    facultyId: row.facultyId,
                                    role: row.role,
                                    status: 'present',
                                  });
                                else next.entries[idx].status = 'present';
                                next.updatedAt = new Date().toISOString();
                                setAttendance(next);
                              }}
                            >
                              Present
                            </button>
                            <button
                              className={`rounded border px-2 py-1 ${currentStatus === 'absent' ? 'bg-yellow-100' : ''}`}
                              onClick={() => {
                                if (!attendance) return;
                                const next = {
                                  ...attendance,
                                } as SlotAttendance;
                                const idx = next.entries.findIndex(
                                  (e) => e.facultyId === row.facultyId
                                );
                                if (idx === -1)
                                  next.entries.push({
                                    facultyId: row.facultyId,
                                    role: row.role,
                                    status: 'absent',
                                  });
                                else next.entries[idx].status = 'absent';
                                next.updatedAt = new Date().toISOString();
                                setAttendance(next);
                              }}
                            >
                              Absent
                            </button>
                            <button
                              className={`rounded border px-2 py-1 ${currentStatus === 'replacement' ? 'bg-orange-100' : ''}`}
                              onClick={() => onToggleStatus(row.facultyId)}
                            >
                              Cycle
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button onClick={onSave}>Save & Download ZIP</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
