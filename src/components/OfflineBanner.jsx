// src/components/OfflineBanner.jsx
import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !justReconnected) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none`}
    >
      {isOffline && (
        <div className="flex items-center gap-2 bg-amber-500/95 text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold backdrop-blur-md border border-amber-400">
          <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span>Offline Mode Active — Cached itineraries available</span>
        </div>
      )}

      {justReconnected && (
        <div className="flex items-center gap-2 bg-emerald-600/95 text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold backdrop-blur-md border border-emerald-500">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Back Online — Syncing latest trip updates</span>
        </div>
      )}
    </div>
  );
}
