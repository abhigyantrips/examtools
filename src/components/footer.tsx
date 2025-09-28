import { Github } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="bg-card border-t">
      <div className="mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            built by{' '}
            <a
              className="underline underline-offset-4 hover:no-underline"
              href="https://github.com/abhigyantrips/examtools/graphs/contributors"
              target="_blank"
              rel="noopener noreferrer"
            >
              students
            </a>
            , for{' '}
            <a
              className="underline underline-offset-4 hover:no-underline"
              href="https://www.manipal.edu/"
              target="_blank"
              rel="noopener noreferrer"
            >
              manipal.edu
            </a>
            .
          </div>
          <Button variant="ghost" size="icon" asChild className="mt-2">
            <a
              href="https://github.com/abhigyantrips/examtools"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github />
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
}
