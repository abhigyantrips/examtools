import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
      toast.success('ExamDuty installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    // Handle service worker updates
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
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
            toast.loading('Updating ExamDuty...', { id: 'sw-update' });
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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Card className="shadow-lg border-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Install ExamDuty</CardTitle>
                  <CardDescription className="text-xs">
                    Install for offline access and better performance
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstallPrompt(false)}
                  className="size-6 p-0"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button onClick={handleInstall} size="sm" className="flex-1">
                  <Download className="mr-2 size-3" />
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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Card className="shadow-lg border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-blue-900">Update Available</CardTitle>
                  <CardDescription className="text-xs text-blue-700">
                    A new version of ExamDuty is ready
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpdatePrompt(false)}
                  className="size-6 p-0 text-blue-700"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button onClick={handleUpdate} size="sm" className="flex-1">
                  <RefreshCw className="mr-2 size-3" />
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