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
                    Drop your ZIP file here
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
                  ) : checks.progress?.metadata?.state === 'failed' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : checks.progress?.metadata?.state === 'done' &&
                    checks.slotsFound ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : checks.progress?.metadata?.state === 'done' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  )}
                  Slots found:{' '}
                  {checks?.progress?.metadata?.state === 'done'
                    ? checks.slotsCount
                    : checks?.progress?.metadata?.state === 'failed'
                      ? 'Failed'
                      : checks?.progress?.metadata?.state === 'processing'
                        ? 'Processing...'
                        : 'Pending'}
                  {checks?.progress?.metadata?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.metadata.message}
                    </span>
                  )}
                  {checks?.progress?.metadata?.state === 'failed' && (
                    <span className="ml-2 text-xs text-red-600">
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
                  ) : checks.progress?.faculty?.state === 'failed' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : checks.progress?.faculty?.state === 'done' &&
                    checks.facultyCount > 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : checks.progress?.faculty?.state === 'done' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  )}
                  Faculty entries:{' '}
                  {checks?.progress?.faculty?.state === 'done'
                    ? checks.facultyCount
                    : checks?.progress?.faculty?.state === 'failed'
                      ? 'Failed'
                      : checks?.progress?.faculty?.state === 'processing'
                        ? 'Processing...'
                        : 'Pending'}
                  {checks?.progress?.faculty?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.faculty.message}
                    </span>
                  )}
                  {checks?.progress?.faculty?.state === 'failed' && (
                    <span className="ml-2 text-xs text-red-600">
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
                  ) : checks.progress?.attendance?.state === 'failed' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : checks.progress?.attendance?.state === 'done' &&
                    checks.missingAttendanceSlots?.length === 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : checks.progress?.attendance?.state === 'done' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  )}
                  Attendance present for all slots:{' '}
                  {checks?.progress?.attendance?.state === 'done'
                    ? `${checks.missingAttendanceSlots?.length ?? 0} missing`
                    : checks?.progress?.attendance?.state === 'failed'
                      ? 'Failed'
                      : checks?.progress?.attendance?.state === 'processing'
                        ? 'Processing...'
                        : 'Pending'}
                  {checks?.progress?.attendance?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.attendance.message}
                    </span>
                  )}
                  {checks?.progress?.attendance?.state === 'failed' && (
                    <span className="ml-2 text-xs text-red-600">
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
                  ) : checks.progress?.subjectInfo?.state === 'failed' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : checks.progress?.subjectInfo?.state === 'done' &&
                    checks.missingSubjectInfoSlots?.length === 0 ? (
                    <Check className="mr-2 inline-block size-4 text-green-600" />
                  ) : checks.progress?.subjectInfo?.state === 'done' ? (
                    <CircleAlert className="mr-2 inline-block size-4 text-red-600" />
                  ) : (
                    <CircleDotDashed className="text-muted-foreground mr-2 inline-block size-4" />
                  )}
                  Subject info complete:{' '}
                  {checks?.progress?.subjectInfo?.state === 'done'
                    ? `${checks.missingSubjectInfoSlots?.length ?? 0} issues`
                    : checks?.progress?.subjectInfo?.state === 'failed'
                      ? 'Failed'
                      : checks?.progress?.subjectInfo?.state === 'processing'
                        ? 'Processing...'
                        : 'Pending'}
                  {checks?.progress?.subjectInfo?.state === 'processing' && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {checks.progress.subjectInfo.message}
                    </span>
                  )}
                  {checks?.progress?.subjectInfo?.state === 'failed' && (
                    <span className="ml-2 text-xs text-red-600">
                      {checks.progress.subjectInfo.message}
                    </span>
                  )}
                </li>
              </ul>

              {/* Show warning banner for invalid ZIP */}
              {checks &&
                (checks.progress?.metadata?.state === 'failed' ||
                  checks.progress?.faculty?.state === 'failed' ||
                  checks.progress?.attendance?.state === 'failed' ||
                  checks.progress?.subjectInfo?.state === 'failed') && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Invalid or Incompatible ZIP File
                    </p>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                      This ZIP file doesn't appear to be a valid exam duty
                      attendance export. Please ensure you're uploading the
                      correct ZIP file from the attendance marking phase.
                    </p>
                  </div>
                )}

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
