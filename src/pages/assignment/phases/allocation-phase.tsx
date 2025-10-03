import { AvailabilityForm } from '@/pages/assignment/forms/availability-form';
import { Calculator } from 'lucide-react';
import { toast } from 'sonner';

import { useMemo } from 'react';

import type { ExamStructure, Faculty, UnavailableFaculty } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AllocationPhaseProps {
  faculty: Faculty[];
  examStructure: ExamStructure;
  unavailability: UnavailableFaculty[];
  onExamStructureUpdated: (structure: ExamStructure) => void;
  onUnavailabilityUpdated: (unavailability: UnavailableFaculty[]) => void;
}

export function AllocationPhase({
  faculty,
  examStructure,
  unavailability,
  onExamStructureUpdated,
  onUnavailabilityUpdated,
}: AllocationPhaseProps) {
  // Get unique designations with faculty count
  const designationData = useMemo(() => {
    const designations = new Map<
      string,
      { count: number; faculty: Faculty[] }
    >();

    faculty.forEach((f) => {
      if (!designations.has(f.designation)) {
        designations.set(f.designation, { count: 0, faculty: [] });
      }
      const group = designations.get(f.designation)!;
      group.count++;
      group.faculty.push(f);
    });

    return Array.from(designations.entries())
      .map(([designation, data]) => ({
        designation,
        facultyCount: data.count,
        faculty: data.faculty,
        regularDuties: examStructure.designationDutyCounts[designation] || 0,
        relieverDuties:
          examStructure.designationRelieverCounts?.[designation] || 0,
        squadDuties: examStructure.designationSquadCounts?.[designation] || 0,
        bufferDuties: examStructure.designationBufferCounts?.[designation] || 0,
      }))
      .sort((a, b) => b.facultyCount - a.facultyCount);
  }, [faculty, examStructure]);

  // Calculate totals
  const totals = useMemo(() => {
    return designationData.reduce(
      (acc, curr) => {
        const facultyRegular = curr.regularDuties * curr.facultyCount;
        const facultyReliever = curr.relieverDuties * curr.facultyCount;
        const facultySquad = curr.squadDuties * curr.facultyCount;
        const facultyBuffer = curr.bufferDuties * curr.facultyCount;

        return {
          faculty: acc.faculty + curr.facultyCount,
          regularDuties: acc.regularDuties + facultyRegular,
          relieverDuties: acc.relieverDuties + facultyReliever,
          squadDuties: acc.squadDuties + facultySquad,
          bufferDuties: acc.bufferDuties + facultyBuffer,
          totalDuties:
            acc.totalDuties +
            facultyRegular +
            facultyReliever +
            facultySquad +
            facultyBuffer,
        };
      },
      {
        faculty: 0,
        regularDuties: 0,
        relieverDuties: 0,
        squadDuties: 0,
        bufferDuties: 0,
        totalDuties: 0,
      }
    );
  }, [designationData]);

  // Update designation counts
  const updateDesignationCount = (
    designation: string,
    type: 'regular' | 'reliever' | 'squad' | 'buffer',
    value: number
  ) => {
    const updates: Partial<ExamStructure> = {};

    switch (type) {
      case 'regular':
        updates.designationDutyCounts = {
          ...examStructure.designationDutyCounts,
          [designation]: value,
        };
        break;
      case 'reliever':
        updates.designationRelieverCounts = {
          ...examStructure.designationRelieverCounts,
          [designation]: value,
        };
        break;
      case 'squad':
        updates.designationSquadCounts = {
          ...examStructure.designationSquadCounts,
          [designation]: value,
        };
        break;
      case 'buffer':
        updates.designationBufferCounts = {
          ...examStructure.designationBufferCounts,
          [designation]: value,
        };
        break;
    }

    onExamStructureUpdated({
      ...examStructure,
      ...updates,
    });
  };

  // Preset allocation patterns
  const applyPreset = (preset: 'balanced' | 'heavy' | 'light') => {
    const presets = {
      balanced: { regular: 5, reliever: 2, squad: 2, buffer: 1 },
      heavy: { regular: 8, reliever: 3, squad: 3, buffer: 2 },
      light: { regular: 3, reliever: 1, squad: 1, buffer: 0 },
    };

    const pattern = presets[preset];
    const updates = { ...examStructure };

    designationData.forEach(({ designation }) => {
      updates.designationDutyCounts = {
        ...updates.designationDutyCounts,
        [designation]: pattern.regular,
      };
      updates.designationRelieverCounts = {
        ...updates.designationRelieverCounts,
        [designation]: pattern.reliever,
      };
      updates.designationSquadCounts = {
        ...updates.designationSquadCounts,
        [designation]: pattern.squad,
      };
      updates.designationBufferCounts = {
        ...updates.designationBufferCounts,
        [designation]: pattern.buffer,
      };
    });

    onExamStructureUpdated(updates);
    toast.success(`Applied ${preset} allocation preset to all designations.`);
  };

  return (
    <div className="space-y-6">
      {/* Allocation Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" />
                Duty Allocation by Designation
              </CardTitle>
              <CardDescription>
                Set the number of duties each designation will receive during
                the exam period
              </CardDescription>
            </div>

            {/* Preset Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('light')}
              >
                Light (3-1-1-0)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('balanced')}
              >
                Balanced (5-2-2-1)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('heavy')}
              >
                Heavy (8-3-3-2)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-center">Faculty Count</TableHead>
                  <TableHead className="text-center">Regular Duties</TableHead>
                  <TableHead className="text-center">Reliever Duties</TableHead>
                  <TableHead className="text-center">Squad Duties</TableHead>
                  <TableHead className="text-center">Buffer Duties</TableHead>
                  <TableHead className="text-center">
                    Total per Faculty
                  </TableHead>
                  <TableHead className="text-center">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designationData.map(
                  ({
                    designation,
                    facultyCount,
                    regularDuties,
                    relieverDuties,
                    squadDuties,
                    bufferDuties,
                  }) => {
                    const totalPerFaculty =
                      regularDuties +
                      relieverDuties +
                      squadDuties +
                      bufferDuties;
                    const grandTotal = totalPerFaculty * facultyCount;

                    return (
                      <TableRow key={designation}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{designation}</div>
                            <Badge variant="outline" className="mt-1">
                              {facultyCount} faculty
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {facultyCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={regularDuties}
                            onChange={(e) =>
                              updateDesignationCount(
                                designation,
                                'regular',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={relieverDuties}
                            onChange={(e) =>
                              updateDesignationCount(
                                designation,
                                'reliever',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={squadDuties}
                            onChange={(e) =>
                              updateDesignationCount(
                                designation,
                                'squad',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={bufferDuties}
                            onChange={(e) =>
                              updateDesignationCount(
                                designation,
                                'buffer',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {totalPerFaculty}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {grandTotal}
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}

                {/* Totals Row */}
                <TableRow className="bg-muted/30 border-t-2 font-semibold">
                  <TableCell>TOTALS</TableCell>
                  <TableCell className="text-center">
                    {totals.faculty}
                  </TableCell>
                  <TableCell className="text-center text-blue-700 dark:text-blue-400">
                    {totals.regularDuties}
                  </TableCell>
                  <TableCell className="text-center text-green-700 dark:text-green-400">
                    {totals.relieverDuties}
                  </TableCell>
                  <TableCell className="text-center text-purple-700 dark:text-purple-400">
                    {totals.squadDuties}
                  </TableCell>
                  <TableCell className="text-center text-orange-700 dark:text-orange-400">
                    {totals.bufferDuties}
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                  <TableCell className="text-center text-lg font-bold">
                    {totals.totalDuties}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Duty Breakdown Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Duty Distribution Summary</CardTitle>
          <CardDescription>
            Total duties needed across all faculty members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/30">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {totals.regularDuties}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Regular Duties
              </div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {totals.relieverDuties}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Reliever Duties
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/30">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {totals.squadDuties}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Squad Duties
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 text-center dark:bg-orange-900/30">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {totals.bufferDuties}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">
                Buffer Duties
              </div>
            </div>
            <div className="rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                {totals.totalDuties}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Duties
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Faculty Unavailability */}
      <AvailabilityForm
        faculty={faculty}
        dutySlots={[]} // Empty for now, will be populated in configuration phase
        unavailability={unavailability}
        onUnavailabilityUpdated={onUnavailabilityUpdated}
      />
    </div>
  );
}
