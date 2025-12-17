import { Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/assignment':
        return 'duties.';
      case '/attendance':
        return 'attendance.';
      case '/renumeration':
        return 'renumeration.';
      default:
        return '';
    }
  };

  return (
    <header className="bg-card border-b">
      <div className="mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-row items-center space-x-0.5">
              <img
                src="/favicon.png"
                alt="Institute Logo"
                height={28}
                width={28}
              />
              <svg height="32" role="separator" viewBox="0 0 32 32" width="32">
                <path
                  d="M22 5L9 28"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-current"
                />
              </svg>
              <span className="text-foreground text-xl font-semibold tracking-tight">
                examtools
                {isHome && <span className="text-primary">.</span>}
              </span>
              {!isHome && (
                <>
                  <svg
                    height="32"
                    role="separator"
                    viewBox="0 0 32 32"
                    width="32"
                  >
                    <path
                      d="M22 5L9 28"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="stroke-current"
                    />
                  </svg>
                  <span className="text-foreground text-xl font-semibold tracking-tight">
                    {getPageTitle()}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            {!isHome && (
              <Button variant="outline" asChild>
                <Link to="/">
                  <Home />
                  Home
                </Link>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
