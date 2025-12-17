import { BarChart3 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function RenumerationPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl text-center">
        <Card>
          <CardHeader>
            <BarChart3 className="mx-auto mb-4 size-16 text-purple-600" />
            <CardTitle className="text-2xl">
              Faculty Duty Renumeration
            </CardTitle>
            <CardDescription>
              End-of-year analysis and balancing of faculty duty distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">This tool will help you:</p>
              <ul className="mx-auto max-w-md space-y-2 text-left text-sm">
                <li>• Import attendance data from multiple examinations</li>
                <li>• Calculate total duties performed by each faculty</li>
                <li>• Identify over/under-assigned faculty members</li>
                <li>• Generate fair compensation recommendations</li>
                <li>• Export annual duty distribution reports</li>
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
