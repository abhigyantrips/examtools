import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function EditPage() {
  const { tool } = useParams();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <h1 className="text-3xl font-bold capitalize">{tool} Edit Page</h1>
        <p className="text-muted-foreground">
          Ingestion system for {tool} will be implemented here.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Back to Upload</Link>
        </Button>
      </div>
    </div>
  );
}
