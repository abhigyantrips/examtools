import { useState, useCallback, useMemo } from 'react';
import { Calendar, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseRoomsExcel } from '@/lib/excel';
import { format } from 'date-fns';
import type { ExamStructure, DutySlot, ExcelParseResult } from '@/types';
import { toast } from 'sonner';

interface ScheduleConfigFormProps {
  examStructure: ExamStructure;
  onExamStructureUpdated: (structure: ExamStructure) => void;
}

interface RoomUploadState {
  [key: string]: ExcelParseResult<string> | null;
}

export function ScheduleConfigForm({
  examStructure,
  onExamStructureUpdated
}: ScheduleConfigFormProps) {
  const [days, setDays] = useState(examStructure.days || 3);
  const [slots, setSlots] = useState(examStructure.slots || 2);
  const [dutySlots, setDutySlots] = useState<DutySlot[]>(examStructure.dutySlots || []);
  const [roomUploadResults, setRoomUploadResults] = useState<RoomUploadState>({});

  // Time options for dropdowns
  const timeOptions = useMemo(() => [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
  ], []);

  // Get date for a specific day
  const getDayDate = useCallback((day: number): Date => {
    const daySlot = dutySlots.find(s => s.day === day);
    return daySlot?.date || new Date();
  }, [dutySlots]);

  // Get time range for a specific slot
  const getSlotTimes = useCallback((slot: number): { startTime: string; endTime: string } => {
    const slotData = dutySlots.find(s => s.slot === slot);
    return {
      startTime: slotData?.startTime || (slot === 0 ? '9:00 AM' : '2:00 PM'),
      endTime: slotData?.endTime || (slot === 0 ? '12:00 PM' : '5:00 PM')
    };
  }, [dutySlots]);

  // Update date for all slots of a specific day
  const updateDayDate = useCallback((day: number, date: Date) => {
    setDutySlots(prev => prev.map(slot => 
      slot.day === day ? { ...slot, date } : slot
    ));
  }, []);

  // Update time range for all days of a specific slot
  const updateSlotTimes = useCallback((slot: number, startTime: string, endTime: string) => {
    setDutySlots(prev => prev.map(s => 
      s.slot === slot ? { ...s, startTime, endTime } : s
    ));
  }, []);

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
          regularDuties: 8,
          bufferDuties: 2,
          rooms: []
        });
      }
    }

    setDutySlots(newSlots);
  }, [days, slots, dutySlots]);

  // Update individual slot properties (duties, rooms)
  const updateSlotRegularDuties = useCallback((day: number, slot: number, regularDuties: number) => {
    setDutySlots(prev => prev.map(s =>
      s.day === day && s.slot === slot ? { ...s, regularDuties } : s
    ));
  }, []);

  const updateSlotBufferDuties = useCallback((day: number, slot: number, bufferDuties: number) => {
    setDutySlots(prev => prev.map(s =>
      s.day === day && s.slot === slot ? { ...s, bufferDuties } : s
    ));
  }, []);

  const updateSlotRooms = useCallback((day: number, slot: number, rooms: string[]) => {
    setDutySlots(prev => prev.map(s =>
      s.day === day && s.slot === slot ? { ...s, rooms } : s
    ));
  }, []);

  // Handle room upload
  const handleRoomUpload = useCallback(async (day: number, slot: number, file: File) => {
    const key = `${day}-${slot}`;
    
    // Set loading state
    setRoomUploadResults(prev => ({
      ...prev,
      [key]: { data: [], errors: ['Uploading...'], warnings: [] }
    }));

    try {
      const result = await parseRoomsExcel(file);
      setRoomUploadResults(prev => ({
        ...prev,
        [key]: result
      }));

      if (result.data.length > 0) {
        updateSlotRooms(day, slot, result.data);
		toast.success(`Uploaded ${result.data.length} rooms for Day ${day + 1} Slot ${slot + 1}.`);
      }
    } catch (error) {
      setRoomUploadResults(prev => ({
        ...prev,
        [key]: {
          data: [],
          errors: [`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: []
        }
      }));
    }
  }, [updateSlotRooms]);

  const clearRoomUploadResult = useCallback((day: number, slot: number) => {
    const key = `${day}-${slot}`;
    setRoomUploadResults(prev => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const saveConfiguration = useCallback(() => {
    const structure: ExamStructure = {
      days,
      slots,
      dutySlots,
      designationDutyCounts: examStructure.designationDutyCounts
    };
    onExamStructureUpdated(structure);
	toast.success('Schedule configuration saved successfully.');
  }, [days, slots, dutySlots, examStructure.designationDutyCounts, onExamStructureUpdated]);

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
              <label className="text-sm font-medium block mb-1">Number of Days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Slots per Day</label>
              <input
                type="number"
                min="1"
                max="6"
                value={slots}
                onChange={(e) => setSlots(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <Button onClick={initializeDutySlots} variant="outline">
            Initialize {days} × {slots} Schedule Grid
          </Button>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      {dutySlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
            <CardDescription>
              Set dates for each day, times for each slot, then configure rooms and duties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 border text-center uppercase w-32">Day / Slot</th>
                    {Array.from({ length: days }, (_, dayIndex) => (
                      <th key={dayIndex} className="p-3 border text-center min-w-[200px]">
                        <div className="space-y-2">
                          <div className="font-medium">Day {dayIndex + 1}</div>
                          {/* Date Picker for this day */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-center font-normal"
                              >
                                <Calendar className="mr-2 size-3" />
                                {format(getDayDate(dayIndex), 'MMM dd, yyyy')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={getDayDate(dayIndex)}
                                onSelect={(date) => date && updateDayDate(dayIndex, date)}
                                required
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: slots }, (_, slotIndex) => (
                    <tr key={slotIndex}>
                      <td className="p-3 border font-medium min-w-32">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Slot {slotIndex + 1}</div>
                          {/* Time Range for this slot */}
                          <div className="space-y-1">
                            <select
                              value={getSlotTimes(slotIndex).startTime}
                              onChange={(e) => updateSlotTimes(slotIndex, e.target.value, getSlotTimes(slotIndex).endTime)}
                              className="w-full px-2 py-1 border rounded text-xs"
                            >
                              {timeOptions.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                            <div className="text-center text-xs text-muted-foreground">to</div>
                            <select
                              value={getSlotTimes(slotIndex).endTime}
                              onChange={(e) => updateSlotTimes(slotIndex, getSlotTimes(slotIndex).startTime, e.target.value)}
                              className="w-full px-2 py-1 border rounded text-xs"
                            >
                              {timeOptions.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                      
                      {/* Individual day-slot cells */}
                      {Array.from({ length: days }, (_, dayIndex) => {
                        const dutySlot = dutySlots.find(s => s.day === dayIndex && s.slot === slotIndex);
                        const uploadKey = `${dayIndex}-${slotIndex}`;
                        const uploadResult = roomUploadResults[uploadKey];
                        
                        if (!dutySlot) return <td key={dayIndex} className="p-3 border" />;

                        return (
                          <td key={dayIndex} className="p-3 border">
                            <div className="space-y-3">
                              {/* Duties Configuration */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-muted-foreground">Regular</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={dutySlot.regularDuties}
                                    onChange={(e) => updateSlotRegularDuties(dayIndex, slotIndex, parseInt(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border rounded text-sm text-center"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Buffer</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={dutySlot.bufferDuties}
                                    onChange={(e) => updateSlotBufferDuties(dayIndex, slotIndex, parseInt(e.target.value) || 0)}
                                    className="w-full px-2 py-1 border rounded text-sm text-center"
                                  />
                                </div>
                              </div>

                              {/* Room Upload */}
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
                                  <Upload className="mr-2 size-3" />
                                  Rooms ({dutySlot.rooms.length})
                                </Button>
                              </div>

                              {/* Upload Result */}
                              {uploadResult && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">Upload Result</span>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => clearRoomUploadResult(dayIndex, slotIndex)}
                                      className="size-6 p-0"
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  </div>

                                  {uploadResult.data.length > 0 && uploadResult.errors.length === 0 && (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="size-3" />
                                      <span className="text-xs">Success: {uploadResult.data.length} rooms</span>
                                    </div>
                                  )}

                                  {uploadResult.errors.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-red-600">
                                        <AlertCircle className="size-3" />
                                        <span className="text-xs font-medium">Errors</span>
                                      </div>
                                      <div className="text-xs text-red-600 max-h-16 overflow-y-auto">
                                        {uploadResult.errors.slice(0, 2).map((error, index) => (
                                          <div key={index}>• {error}</div>
                                        ))}
                                        {uploadResult.errors.length > 2 && (
                                          <div>...and {uploadResult.errors.length - 2} more</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
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