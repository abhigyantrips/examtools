import { CheckCircle, Users } from 'lucide-react';

import { useMemo, useState } from 'react';

import type { Faculty } from '@/types';

import { facultyCompare } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { FacultyUploadForm } from '@/pages/assignment/forms/faculty-upload-form';

interface UploadPhaseProps {
  faculty: Faculty[];
  onFacultyUploaded: (faculty: Faculty[]) => void;
}

export function UploadPhase({ faculty, onFacultyUploaded }: UploadPhaseProps) {
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Group faculty by designation for summary
  const facultySummary = useMemo(() => {
    const summary = new Map<string, { count: number; faculty: Faculty[] }>();

    faculty.forEach((f) => {
      if (!summary.has(f.designation)) {
        summary.set(f.designation, { count: 0, faculty: [] });
      }
      const group = summary.get(f.designation)!;
      group.count++;
      group.faculty.push(f);
    });

    return Array.from(summary.entries())
      .map(([designation, data]) => ({
        designation,
        count: data.count,
        faculty: data.faculty,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [faculty]);

  const handleUploadSuccess = (newFaculty: Faculty[]) => {
    onFacultyUploaded(newFaculty);
    setUploadSuccess(true);
  };

  const sortedFaculty = useMemo(
    () => [...faculty].sort((a, b) => facultyCompare(a, b)),
    [faculty]
  );

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <FacultyUploadForm
        currentFaculty={faculty}
        onFacultyUploaded={handleUploadSuccess}
      />

      {/* Faculty Preview */}
      {faculty.length > 0 && (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {uploadSuccess && (
                  <CheckCircle className="size-5 text-green-600" />
                )}
                <Users className="size-5" />
                Faculty Summary
              </CardTitle>
              <CardDescription>
                {faculty.length} faculty members across {facultySummary.length}{' '}
                designations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {facultySummary.map(({ designation, count }) => (
                  <div
                    key={designation}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">{designation}</div>
                      <div className="text-muted-foreground text-sm">
                        {count} member{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Faculty Table */}
          <Card>
            <CardHeader>
              <CardTitle>Faculty List</CardTitle>
              <CardDescription>
                Complete list of uploaded faculty members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-16">S. No.</TableHead>
                      <TableHead>Faculty Name</TableHead>
                      <TableHead>Faculty ID</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="w-32">Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFaculty.map((f, index) => (
                      <TableRow key={f.facultyId}>
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {f.facultyName}
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted rounded px-1 py-0.5 text-xs">
                            {f.facultyId}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.designation}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.department}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{f.phoneNo}</code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Upload Instructions */}
      {faculty.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-center">
              <Users className="mx-auto mb-4 size-12 opacity-50" />
              <p className="text-sm">
                Upload your faculty Excel file to begin the duty assignment
                process.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
