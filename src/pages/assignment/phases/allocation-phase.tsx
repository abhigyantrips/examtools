import { Calculator } from 'lucide-react';

import { useMemo } from 'react';

import type { ExamStructure, Faculty, UnavailableFaculty } from '@/types';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { AvailabilityForm } from '@/pages/assignment/forms/availability-form';

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
        bufferEligible:
          examStructure.designationBufferEligibility?.[designation] || false,
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
        const bufferEligibleCount = curr.bufferEligible ? 1 : 0;

        return {
          faculty: acc.faculty + curr.facultyCount,
          regularDuties: acc.regularDuties + facultyRegular,
          relieverDuties: acc.relieverDuties + facultyReliever,
          squadDuties: acc.squadDuties + facultySquad,
          bufferEligible: acc.bufferEligible + bufferEligibleCount,
          totalDuties:
            acc.totalDuties + facultyRegular + facultyReliever + facultySquad,
        };
      },
      {
        faculty: 0,
        regularDuties: 0,
        relieverDuties: 0,
        squadDuties: 0,
        bufferEligible: 0,
        totalDuties: 0,
      }
    );
  }, [designationData]);

  // Update designation counts
  const updateDesignationCount = (
    designation: string,
    type: 'regular' | 'reliever' | 'squad',
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
    }

    onExamStructureUpdated({
      ...examStructure,
      ...updates,
    });
  };

  const updateDesignationEligibility = (
    designation: string,
    enabled: boolean
  ) => {
    onExamStructureUpdated({
      ...examStructure,
      designationBufferEligibility: {
        ...examStructure.designationBufferEligibility,
        [designation]: enabled,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Allocation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-5" />
            Duty Allocation by Designation
          </CardTitle>
          <CardDescription>
            Set the number of duties each designation will receive during the
            exam period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="px-3">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-center">Faculty Count</TableHead>
                  <TableHead className="text-center">Regular Duties</TableHead>
                  <TableHead className="text-center">Reliever Duties</TableHead>
                  <TableHead className="text-center">Squad Duties</TableHead>
                  <TableHead className="text-center">Buffer Eligible</TableHead>
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
                    bufferEligible,
                  }) => {
                    const totalPerFaculty =
                      regularDuties + relieverDuties + squadDuties;
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
                          <div className="flex justify-center">
                            <Switch
                              checked={bufferEligible}
                              onCheckedChange={(checked) =>
                                updateDesignationEligibility(
                                  designation,
                                  checked
                                )
                              }
                            />
                          </div>
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
                    {totals.bufferEligible} Designations
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/30">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {totals.regularDuties}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Regular Duties
              </div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {totals.relieverDuties}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Reliever Duties
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-900/30">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {totals.squadDuties}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Squad Duties
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3 text-center dark:bg-orange-900/30">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {totals.bufferEligible}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">
                Buffer Designations
              </div>
            </div>
            <div className="rounded-lg bg-teal-50 p-3 text-center dark:bg-teal-900/30">
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">
                {totals.faculty}
              </div>
              <div className="text-sm text-teal-600 dark:text-teal-400">
                Faculty
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-foreground text-2xl font-bold">
                {totals.totalDuties}
              </div>
              <div className="text-muted-foreground text-sm font-medium">
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
