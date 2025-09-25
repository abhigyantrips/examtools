import { ClipboardCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function AttendancePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <Card>
          <CardHeader>
            <ClipboardCheck className="mx-auto mb-4 size-16 text-green-600" />
            <CardTitle className="text-2xl">Duty Attendance Marking</CardTitle>
            <CardDescription>
              Mark and track faculty attendance during examination duties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                This tool will allow you to:
              </p>
              <ul className="mx-auto max-w-md space-y-2 text-left text-sm">
                <li>• Import duty assignments from the Assignment tool</li>
                <li>• Mark faculty as present/absent for each slot</li>
                <li>• Track late arrivals and early departures</li>
                <li>• Export attendance reports in Excel format</li>
                <li>• Generate absence summaries for administrative review</li>
              </ul>

              <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-800">
                  🚧 <strong>Coming Soon</strong> - This feature is under
                  development
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
