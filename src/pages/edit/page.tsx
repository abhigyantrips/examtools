import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function EditPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <h1 className="text-3xl font-bold">Edit Page</h1>
        <p className="text-muted-foreground">
          This is a placeholder for the edit page where users can manually edit
          the uploaded ZIP file.
        </p>
        <Button asChild>
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
