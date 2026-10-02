// src/components/InstallPwaPrompt.jsx
import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, MoreVertical } from 'lucide-react';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isFirefoxAndroid, setIsFirefoxAndroid] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed in standalone mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setIsStandalone(standalone);
    if (standalone) {
      return; // Already installed
    }

    // 2. Detect iOS Safari or Firefox Android
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
    const isFirefox = /firefox|fxios/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIosDevice) {
      setIsIos(true);
    }

    if (isFirefox && isAndroid) {
      setIsFirefoxAndroid(true);
    }

    // 3. Check if user dismissed prompt recently (14 day snooze)
    const dismissedUntil = localStorage.getItem('pwa_prompt_dismissed_until');
    const isSnoozed = dismissedUntil && new Date().getTime() < Number(dismissedUntil);

    if (!isSnoozed) {
      if ((isIosDevice && isSafari) || (isFirefox && isAndroid)) {
        const timer = setTimeout(() => setShowPrompt(true), 2500);
        return () => clearTimeout(timer);
      }
    }

    // 4. Listen for Chrome/Edge/Samsung Internet beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isSnoozed) {
        setShowPrompt(true);
      }
    };

    // 5. Global listener to open guide from any button in the app
    const handleTriggerInstall = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(({ outcome }) => {
          if (outcome === 'accepted') {
            setShowPrompt(false);
            setDeferredPrompt(null);
          }
        });
      } else {
        setShowGuideModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('triggerPwaInstall', handleTriggerInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('triggerPwaInstall', handleTriggerInstall);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowGuideModal(false);
    // Snooze for 14 days
    const snoozeTime = new Date().getTime() + 14 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_prompt_dismissed_until', snoozeTime.toString());
  };

  return (
    <>
      {/* Floating Bottom Install Banner (if not snoozed and not in standalone) */}
      {showPrompt && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-100 truncate">Away from Home</h4>
                <p className="text-xs text-slate-300 truncate">Install app for offline itineraries & fast access</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallClick}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                onClick={handleDismiss}
                aria-label="Dismiss install prompt"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-Step Installation Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {isIos ? 'Install on iPhone / iPad' : (isFirefoxAndroid ? 'Install in Firefox (Android)' : 'Install Away from Home')}
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIos ? (
              <>
                <p className="text-xs text-slate-600">
                  Install the app directly to your home screen for quick offline access during your trips:
                </p>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div className="pt-0.5">
                      Tap the <span className="font-semibold text-slate-900 inline-flex items-center gap-1 mx-0.5"><Share className="w-3.5 h-3.5 inline text-blue-600" /> Share</span> button in Safari's bottom toolbar.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div className="pt-0.5">
                      Scroll down and tap <span className="font-semibold text-slate-900 inline-flex items-center gap-1 mx-0.5"><PlusSquare className="w-3.5 h-3.5 inline text-blue-600" /> Add to Home Screen</span>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <div className="pt-0.5">
                      Tap <span className="font-bold text-blue-600">Add</span> in the top right corner. Done!
                    </div>
                  </div>
                </div>
              </>
            ) : isFirefoxAndroid ? (
              <>
                <p className="text-xs text-slate-600">
                  Install from Firefox to your Android home screen:
                </p>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div className="pt-0.5">
                      Tap the <span className="font-semibold text-slate-900 inline-flex items-center gap-1 mx-0.5"><MoreVertical className="w-3.5 h-3.5 inline text-blue-600" /> 3 dots menu</span> next to the Firefox address bar.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div className="pt-0.5">
                      Tap <span className="font-bold text-blue-600">"Install"</span> (or "Add to Home screen").
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <div className="pt-0.5">
                      Tap <span className="font-bold text-blue-600">Add to home screen</span> to confirm.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Install the app to your device for instant offline access and a full-screen native app experience:
                </p>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div className="pt-0.5">
                      In your browser address bar (top right), look for the <span className="font-semibold text-slate-900">Install icon (🖥️ or ⬇️)</span> or tap browser menu <span className="font-semibold text-slate-900">(⋮)</span>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div className="pt-0.5">
                      Click <span className="font-bold text-blue-600">"Install Away from Home"</span> or <span className="font-bold text-blue-600">"Add to Home screen"</span>.
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
