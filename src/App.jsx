// src/App.jsx
import React, { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetails from './components/TripDetails'; 
import TripAdminModal from './components/TripAdminModal';
import { Settings } from 'lucide-react';
import { claimRememberedInvite, rememberInviteFromUrl } from './utils/invitations';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isGlobalAdminOpen, setIsGlobalAdminOpen] = useState(false);

  useEffect(() => {
    // Save the invitation before an email sign-in redirects back to the app.
    rememberInviteFromUrl();

    const checkEmailLink = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        try {
          await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState(null, '', '/');
        } catch (error) {
          console.error('Error signing in with link', error);
        }
      }
    };

    checkEmailLink();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const acceptInvite = async () => {
      try {
        const result = await claimRememberedInvite(user);
        if (result) {
          setSelectedTripId(result.tripId);
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (error) {
        console.error('Error accepting trip invitation:', error);
        alert(error.message || 'Unable to accept this trip invitation.');
      }
    };

    acceptInvite();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 font-medium animate-pulse">Loading Travel Hub...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-40 shadow-sm">
        <h1 
          onClick={() => setSelectedTripId(null)} 
          className="min-w-0 font-bold text-slate-900 text-sm sm:text-lg leading-tight cursor-pointer hover:text-blue-600 transition"
        >
          Away from Home: Travel Planner ✈️ 🌍
        </h1>
        
        <button 
          onClick={() => setIsGlobalAdminOpen(true)}
          aria-label="Open settings and vault"
          className="shrink-0 flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 sm:px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm"
        >
          <Settings className="w-4 h-4 text-blue-600" /> Settings
        </button>
      </header>

      <main className="flex-grow">
        {selectedTripId ? (
          <TripDetails 
            tripId={selectedTripId} 
            onBack={() => setSelectedTripId(null)} 
          />
        ) : (
          <Dashboard 
            user={user} 
            onSelectTrip={(tripId) => setSelectedTripId(tripId)} 
          />
        )}
      </main>

      <TripAdminModal 
        isOpen={isGlobalAdminOpen}
        onClose={() => setIsGlobalAdminOpen(false)}
        currentUser={user}
      />
    </div>
  );
}
