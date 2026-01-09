import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ImportPhaseProps {
  zipFileName: string | null;
  zipTimestamps?: { updated?: string; created?: string } | null;
  onImport: (file: File | null) => Promise<void>;
  onReset: () => void;
}

export function ImportPhase({
  zipFileName,
  zipTimestamps,
  onImport,
  onReset,
}: ImportPhaseProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Duty Attendance Marking</CardTitle>
        <CardDescription>
          Import exported ZIP, mark attendance per slot and save back into ZIP
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
  );
}
