import { format } from 'date-fns';
import { Calendar, UserMinus, X } from 'lucide-react';

import { useCallback, useMemo, useState } from 'react';

import type { DutySlot, Faculty, UnavailableFaculty } from '@/types';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AvailabilityFormProps {
  faculty: Faculty[];
  dutySlots: DutySlot[];
  unavailability: UnavailableFaculty[];
  onUnavailabilityUpdated: (unavailability: UnavailableFaculty[]) => void;
}

export function AvailabilityForm({
  faculty,
  dutySlots,
  unavailability,
  onUnavailabilityUpdated,
}: AvailabilityFormProps) {
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [facultySearchOpen, setFacultySearchOpen] = useState(false);

  // Get unique exam dates from duty slots
  const examDates = useMemo(() => {
    const dates = dutySlots.map(
      (slot) => slot.date.toISOString().split('T')[0]
    );
    return Array.from(new Set(dates)).sort();
  }, [dutySlots]);

  // Add unavailability
  const addUnavailability = useCallback(() => {
    if (!selectedFaculty || !selectedDate) return;

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const exists = unavailability.some(
      (u) => u.facultyId === selectedFaculty.facultyId && u.date === dateString
    );

    if (!exists) {
      onUnavailabilityUpdated([
        ...unavailability,
        {
          facultyId: selectedFaculty.facultyId,
          date: dateString,
        },
      ]);
    }

    setSelectedFaculty(null);
    setSelectedDate(null);
  }, [selectedFaculty, selectedDate, unavailability, onUnavailabilityUpdated]);

  // Remove unavailability
  const removeUnavailability = useCallback(
    (facultyId: string, date: string) => {
      onUnavailabilityUpdated(
        unavailability.filter(
          (u) => !(u.facultyId === facultyId && u.date === date)
        )
      );
    },
    [unavailability, onUnavailabilityUpdated]
  );

  // Group unavailability by faculty for display
  const unavailabilityByFaculty = useMemo(() => {
    const grouped: Record<string, { faculty: Faculty; dates: string[] }> = {};

    unavailability.forEach((u) => {
      const facultyMember = faculty.find((f) => f.facultyId === u.facultyId);
      if (facultyMember) {
        if (!grouped[u.facultyId]) {
          grouped[u.facultyId] = {
            faculty: facultyMember,
            dates: [],
          };
        }
        grouped[u.facultyId].dates.push(u.date);
      }
    });

    // Sort dates for each faculty
    Object.values(grouped).forEach((group) => {
      group.dates.sort();
    });

    return grouped;
  }, [unavailability, faculty]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty Availability</CardTitle>
        <CardDescription>
          Mark faculty members as unavailable for specific exam dates. They will
          be excluded from all slots on those days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Unavailability */}
        <div className="space-y-4">
          <h4 className="font-medium">Mark Faculty Unavailable</h4>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Faculty Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Select Faculty
              </label>
              <Popover
                open={facultySearchOpen}
                onOpenChange={setFacultySearchOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={facultySearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedFaculty
                      ? `${selectedFaculty.facultyName} (${selectedFaculty.facultyId})`
                      : 'Select faculty member...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search faculty..." />
                    <CommandEmpty>No faculty found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {faculty.map((member) => (
                          <CommandItem
                            key={member.facultyId}
                            value={`${member.facultyName} ${member.facultyId}`}
                            onSelect={() => {
                              setSelectedFaculty(member);
                              setFacultySearchOpen(false);
                            }}
                          >
                            <div>
                              <div className="font-medium">
                                {member.facultyName}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {member.facultyId} • {member.designation}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Select Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 size-4" />
                    {selectedDate
                      ? format(selectedDate, 'PPP')
                      : 'Pick exam date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      const dateString = date.toISOString().split('T')[0];
                      return !examDates.includes(dateString);
                    }}
                    required
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button
            onClick={addUnavailability}
            disabled={!selectedFaculty || !selectedDate}
            className="w-full md:w-auto"
          >
            <UserMinus className="mr-2 size-4" />
            Mark Unavailable
          </Button>
        </div>

        {/* Current Unavailability */}
        <div className="space-y-4">
          <h4 className="font-medium">
            Current Unavailability ({unavailability.length})
          </h4>

          {Object.keys(unavailabilityByFaculty).length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <UserMinus className="mx-auto size-12 opacity-50" />
              <p className="mt-2">No unavailability marked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.values(unavailabilityByFaculty).map(
                ({ faculty: facultyMember, dates }) => (
                  <div
                    key={facultyMember.facultyId}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {facultyMember.facultyName}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {facultyMember.facultyId} • {facultyMember.designation}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dates.map((date) => (
                          <span
                            key={date}
                            className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          >
                            {format(new Date(date), 'MMM dd')}
                            <button
                              onClick={() =>
                                removeUnavailability(
                                  facultyMember.facultyId,
                                  date
                                )
                              }
                              className="rounded-full p-0.5 hover:bg-red-100 dark:hover:bg-red-800/50"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
