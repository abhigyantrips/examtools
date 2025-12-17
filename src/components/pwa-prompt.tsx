import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Handle app installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      toast.success('ExamTools installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    // Handle service worker updates
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener(
        'controllerchange',
        handleControllerChange
      );

      return () => {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          handleControllerChange
        );
      };
    }
  }, []);

  // PWA update detection (you'll need to import this from workbox-window)
  useEffect(() => {
    const registerSW = async () => {
      if ('serviceWorker' in navigator) {
        const { Workbox } = await import('workbox-window');
        const wb = new Workbox('/sw.js');

        wb.addEventListener('waiting', () => {
          setShowUpdatePrompt(true);
          setUpdateSW(() => () => {
            wb.messageSkipWaiting();
            setShowUpdatePrompt(false);
            toast.loading('Updating ExamTools...', { id: 'sw-update' });
            return Promise.resolve();
          });
        });

        wb.register();
      }
    };

    registerSW();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleUpdate = async () => {
    if (updateSW) {
      await updateSW();
    }
  };

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed right-4 bottom-4 z-50 max-w-54">
          <Card className="border-primary shadow-lg">
            <CardContent className="flex flex-col items-end space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">
                    Install Application?
                  </CardTitle>
                  <CardDescription className="text-xs">
                    This will allow for offline access and a better experience.
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleInstall} size="sm" className="flex-1">
                  <Download />
                  Install
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInstallPrompt(false)}
                >
                  Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed right-4 bottom-4 z-50 max-w-54">
          <Card className="border-blue-200 bg-blue-50 shadow-lg dark:border-blue-800 dark:bg-blue-900">
            <CardContent className="flex flex-col items-end space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
                    Update Available
                  </CardTitle>
                  <CardDescription className="text-xs text-blue-700 dark:text-blue-300">
                    A new version of the application is ready!
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdate} size="sm" className="flex-1">
                  <RefreshCw />
                  Update Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpdatePrompt(false)}
                >
                  Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
