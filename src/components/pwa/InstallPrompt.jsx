/**
 * InstallPrompt — Shows "Add to Home Screen" banner for PWA install
 */
import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      const timer = setTimeout(() => setShow(true), 30000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setShow(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') dismiss();
      else dismiss();
    } else dismiss();
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:w-80">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-lg">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Add MiNest to Home Screen</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isIOS ? 'Tap Share ⬆ then "Add to Home Screen"' : 'Get instant access — works offline too!'}
            </p>
            {!isIOS && (
              <Button size="sm" onClick={handleInstall} className="mt-3 h-8 bg-accent text-accent-foreground text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> Install App
              </Button>
            )}
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
