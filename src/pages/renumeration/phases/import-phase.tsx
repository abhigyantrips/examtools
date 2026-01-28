import { Check, CircleAlert, CircleDotDashed, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface ImportPhaseProps {
  zipFileName: string | null;
  zipTimestamps?: { updated?: string; created?: string } | null;
  onImport: (file: File | null) => Promise<void>;
  onReset: () => void;
  checks?: any | null;
  facultyList?: any[];
}

export function ImportPhase({
  zipFileName,
  zipTimestamps,
  onImport,
  onReset,
  checks,
  facultyList,
}: ImportPhaseProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Renumeration Tool</CardTitle>
          <CardDescription>
            Import final ZIP with all attendance marked to generate renumeration
            export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                /* highlight when dragging */
                'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            >
              <input
                id="zipfile"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) =>
                  onImport(e.target.files ? e.target.files[0] : null)
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              <div className="space-y-3">
                <Upload className="text-muted-foreground mx-auto size-12" />
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop your ZIP file here
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    or click to browse files (.zip)
                  </p>
                </div>
                <div className="text-muted-foreground text-sm">
                  {zipFileName || 'No ZIP loaded'}
                </div>
              </div>
            </div>
            {zipFileName && (
              <div className="mt-2 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  <div className="font-medium">{zipFileName}</div>
                  {zipTimestamps?.updated && (
                    <div className="text-xs">
                      Last updated: {zipTimestamps.updated}
                    </div>
                  )}
                </div>
                <div>
                  <Button variant="destructive" size="sm" onClick={onReset}>
                    Reset ZIP
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verification card below import */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verification Checklist</CardTitle>
            <CardDescription />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <ul className="space-y-2 text-sm">
                <li>
                  {checks == null ? (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  ) : checks.progress?.metadata?.state === 'processing' ? (
                    <span className="mr-2 inline-block align-middle">
                      <Spinner />
                    </span>
                  ) : checks.slotsFound ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  )}
                  Slots found: {checks?.slotsCount ?? 'Pending'}
                  {checks?.progress?.metadata?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.metadata.message}
                    </span>
                  )}
                </li>

                <li>
                  {checks == null ? (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  ) : checks.progress?.faculty?.state === 'processing' ? (
                    <span className="mr-2 inline-block align-middle">
                      <Spinner />
                    </span>
                  ) : checks.facultyCount && checks.facultyCount > 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  )}
                  Faculty entries: {checks?.facultyCount ?? 'Pending'}
                  {checks?.progress?.faculty?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.faculty.message}
                    </span>
                  )}
                </li>

                <li>
                  {checks == null ? (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  ) : checks.progress?.attendance?.state === 'processing' ? (
                    <span className="mr-2 inline-block align-middle">
                      <Spinner />
                    </span>
                  ) : checks.missingAttendanceSlots &&
                    checks.missingAttendanceSlots.length === 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  )}
                  Attendance present for all slots:{' '}
                  {checks
                    ? (checks.missingAttendanceSlots?.length ?? 0)
                    : 'Pending'}{' '}
                  missing
                  {checks?.progress?.attendance?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.attendance.message}
                    </span>
                  )}
                </li>

                <li>
                  {checks == null ? (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  ) : checks.progress?.subjectInfo?.state === 'processing' ? (
                    <span className="mr-2 inline-block align-middle">
                      <Spinner />
                    </span>
                  ) : checks.missingSubjectInfoSlots &&
                    checks.missingSubjectInfoSlots.length === 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  )}
                  Subject info complete:{' '}
                  {checks
                    ? (checks.missingSubjectInfoSlots?.length ?? 0)
                    : 'Pending'}{' '}
                  issues
                  {checks?.progress?.subjectInfo?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.subjectInfo.message}
                    </span>
                  )}
                </li>
              </ul>

              {checks &&
                checks.missingAttendanceSlots &&
                checks.missingAttendanceSlots.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    Missing attendance for slots:{' '}
                    {checks.missingAttendanceSlots
                      .slice(0, 3)
                      .map((s: any) => `d${s.day}-s${s.slot}`)
                      .join(', ')}
                    {/* Requires some smarter handling of error display */}
                    {checks.missingAttendanceSlots.length > 3
                      ? ` and ${checks.missingAttendanceSlots.length - 3} more`
                      : ''}
                  </div>
                )}

              {checks &&
                checks.missingSubjectInfoSlots &&
                checks.missingSubjectInfoSlots.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    Slots with missing subject info:{' '}
                    {checks.missingSubjectInfoSlots
                      .slice(0, 3)
                      .map(
                        (s: any) =>
                          `d${s.day}-s${s.slot}(${s.missing.join(',')})`
                      )
                      .join(', ')}
                    {/* Requires some smarter handling of error display */}
                    {checks.missingSubjectInfoSlots.length > 3
                      ? ` and ${checks.missingSubjectInfoSlots.length - 3} more`
                      : ''}
                  </div>
                )}

              {checks && facultyList && facultyList.length > 0 && (
                <div className="text-muted-foreground mt-2 text-xs">
                  Faculty sample:{' '}
                  {facultyList
                    .slice(0, 3)
                    .map((f: any) => f.facultyName)
                    .join(', ')}
                  {/* Added this just cause, not sure if we need the display */}
                  {facultyList.length > 3
                    ? ` and ${facultyList.length - 3} more`
                    : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
