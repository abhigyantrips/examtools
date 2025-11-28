import { ClipboardCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ImportPhaseProps {
  zipFileName: string | null;
  onImport: (file: File | null) => Promise<void>;
}

export function ImportPhase({ zipFileName, onImport }: ImportPhaseProps) {
  return (
    <Card>
      <CardHeader>
        <ClipboardCheck className="mx-auto mb-4 size-16 text-green-600" />
        <CardTitle className="text-2xl">Duty Attendance Marking</CardTitle>
        <CardDescription>
          Import exported ZIP, mark attendance per slot and save back into ZIP
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
                onImport(e.target.files ? e.target.files[0] : null)
              }
            />
            <div>{zipFileName || 'No ZIP loaded'}</div>
          </div>
          <p className="text-muted-foreground text-sm">
            Import the exported assignments ZIP (contains internal/metadata.json
            and internal/assignment.json). If you don't have one you can still
            proceed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
