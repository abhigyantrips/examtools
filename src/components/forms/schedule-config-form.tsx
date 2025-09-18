import { useState, useCallback, useMemo } from 'react';
import { Calendar, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseRoomsExcel } from '@/lib/excel';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ExamStructure, DutySlot, Faculty } from '@/types';

interface ScheduleConfigFormProps {
  faculty: Faculty[];
  examStructure: ExamStructure;
  onExamStructureUpdated: (structure: ExamStructure) => void;
}

export function ScheduleConfigForm({ 
  faculty, 
  examStructure, 
  onExamStructureUpdated 
}: ScheduleConfigFormProps) {
  const [days, setDays] = useState(examStructure.days || 3);
  const [slots, setSlots] = useState(examStructure.slots || 2);
  const [dutySlots, setDutySlots] = useState<DutySlot[]>(examStructure.dutySlots || []);
  const [designationCounts, setDesignationCounts] = useState<Record<string, number>>(
    examStructure.designationDutyCounts || {}
  );

  // Extract unique designations from faculty
  const designations = useMemo(() => {
    return Array.from(new Set(faculty.map(f => f.designation))).filter(Boolean);
  }, [faculty]);

  // Initialize duty slots grid when dimensions change
  const initializeDutySlots = useCallback(() => {
    const newSlots: DutySlot[] = [];
    
    for (let day = 0; day < days; day++) {
      for (let slot = 0; slot < slots; slot++) {
        const existing = dutySlots.find(s => s.day === day && s.slot === slot);
        newSlots.push(existing || {
          day,
          slot,
          date: new Date(),
          startTime: slot === 0 ? '9:00 AM' : '2:00 PM',
          endTime: slot === 0 ? '12:00 PM' : '5:00 PM',
          totalDuties: 10,
          bufferDuties: 2,
          rooms: []
        });
      }
    }
    
    setDutySlots(newSlots);
  }, [days, slots, dutySlots]);

  const updateDutySlot = useCallback((day: number, slot: number, updates: Partial<DutySlot>) => {
    setDutySlots(prev => prev.map(s => 
      s.day === day && s.slot === slot 
        ? { ...s, ...updates }
        : s
    ));
  }, []);

  const handleRoomUpload = useCallback(async (day: number, slot: number, file: File) => {
    try {
      const result = await parseRoomsExcel(file);
      if (result.data.length > 0) {
        updateDutySlot(day, slot, { rooms: result.data });
      }
    } catch (error) {
      console.error('Room upload failed:', error);
    }
  }, [updateDutySlot]);

  const saveConfiguration = useCallback(() => {
    const structure: ExamStructure = {
      days,
      slots,
      dutySlots,
      designationDutyCounts: designationCounts
    };
    onExamStructureUpdated(structure);
  }, [days, slots, dutySlots, designationCounts, onExamStructureUpdated]);

  // Time options for dropdowns
  const timeOptions = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
  ];

  return (
    <div className="space-y-6">
      {/* Exam Structure Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Structure</CardTitle>
          <CardDescription>
            Configure the basic structure of your examination period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Number of Days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slots per Day</label>
              <input
                type="number"
                min="1"
                max="6"
                value={slots}
                onChange={(e) => setSlots(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <Button onClick={initializeDutySlots} variant="outline">
            Initialize {days} × {slots} Schedule Grid
          </Button>
        </CardContent>
      </Card>

      {/* Designation Duty Counts */}
      {designations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Duty Assignments by Designation</CardTitle>
            <CardDescription>
              Set how many duties each designation should receive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {designations.map(designation => (
                <div key={designation} className="flex items-center justify-between">
                  <span className="text-sm">{designation}</span>
                  <input
                    type="number"
                    min="0"
                    value={designationCounts[designation] || 0}
                    onChange={(e) => setDesignationCounts(prev => ({
                      ...prev,
                      [designation]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 px-2 py-1 border rounded text-center"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Grid */}
      {dutySlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
            <CardDescription>
              Configure dates, times, and room requirements for each slot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border text-left">Day/Slot</th>
                    {Array.from({ length: days }, (_, i) => (
                      <th key={i} className="p-2 border text-center">Day {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: slots }, (_, slotIndex) => (
                    <tr key={slotIndex}>
                      <td className="p-2 border font-medium">Slot {slotIndex + 1}</td>
                      {Array.from({ length: days }, (_, dayIndex) => {
                        const dutySlot = dutySlots.find(s => s.day === dayIndex && s.slot === slotIndex);
                        if (!dutySlot) return <td key={dayIndex} className="p-2 border" />;

                        return (
                          <td key={dayIndex} className="p-2 border">
                            <div className="space-y-2 min-w-[200px]">
                              {/* Date Picker */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !dutySlot.date && "text-muted-foreground"
                                    )}
                                  >
                                    <Calendar className="mr-2 size-3" />
                                    {dutySlot.date ? format(dutySlot.date, 'MMM dd') : 'Pick date'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={dutySlot.date}
                                    onSelect={(date) => date && updateDutySlot(dayIndex, slotIndex, { date })}
                                  />
                                </PopoverContent>
                              </Popover>

                              {/* Time Range */}
                              <div className="flex gap-1">
                                <select
                                  value={dutySlot.startTime}
                                  onChange={(e) => updateDutySlot(dayIndex, slotIndex, { startTime: e.target.value })}
                                  className="flex-1 px-1 py-1 border rounded text-xs"
                                >
                                  {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <select
                                  value={dutySlot.endTime}
                                  onChange={(e) => updateDutySlot(dayIndex, slotIndex, { endTime: e.target.value })}
                                  className="flex-1 px-1 py-1 border rounded text-xs"
                                >
                                  {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Duties */}
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Total"
                                  min="0"
                                  value={dutySlot.totalDuties}
                                  onChange={(e) => updateDutySlot(dayIndex, slotIndex, { 
                                    totalDuties: parseInt(e.target.value) || 0 
                                  })}
                                  className="flex-1 px-1 py-1 border rounded text-xs text-center"
                                />
                                <input
                                  type="number"
                                  placeholder="Buffer"
                                  min="0"
                                  value={dutySlot.bufferDuties}
                                  onChange={(e) => updateDutySlot(dayIndex, slotIndex, { 
                                    bufferDuties: parseInt(e.target.value) || 0 
                                  })}
                                  className="flex-1 px-1 py-1 border rounded text-xs text-center"
                                />
                              </div>

                              {/* Rooms Upload */}
                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".xlsx,.xls"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleRoomUpload(dayIndex, slotIndex, file);
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button variant="outline" size="sm" className="w-full">
                                  <Upload className="mr-1 size-3" />
                                  Rooms ({dutySlot.rooms.length})
                                </Button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfiguration} size="lg">
          Save Configuration
        </Button>
      </div>
    </div>
  );
}