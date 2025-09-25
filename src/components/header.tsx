import { ArrowLeft, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/assignment':
        return 'Exam Duty Assignment';
      case '/attendance':
        return 'Duty Attendance Marking';
      case '/accumulation':
        return 'Faculty Duty Accumulation';
      default:
        return 'Exam Tools';
    }
  };

  return (
    <header className="bg-card border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isHome && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Link>
              </Button>
            )}

            <div>
              <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
              {!isHome && (
                <p className="text-muted-foreground text-sm">
                  Manipal&apos;s Exam Management System
                </p>
              )}
            </div>
          </div>

          {!isHome && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <Home className="mr-2 size-4" />
                Home
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
