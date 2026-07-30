import React, { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetails from './components/TripDetails'; // <--- 1. Import your new details component

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState(null); // <--- 2. Track which trip is open

  useEffect(() => {
    // 1. The "Link Catcher"
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

    // 2. The "Bouncer"
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 font-medium animate-pulse">Loading Travel Hub...</div>
      </div>
    );
  }

  // If not logged in, show Login
  if (!user) {
    return <Login />;
  }

  // <--- 3. If a trip is selected, show the TripDetails page instead of the Dashboard
  if (selectedTripId) {
    return (
      <TripDetails 
        tripId={selectedTripId} 
        onBack={() => setSelectedTripId(null)} 
      />
    );
  }

  // Otherwise, show the Dashboard and pass down the function to select a trip
  return (
    <Dashboard 
      user={user} 
      onSelectTrip={(tripId) => setSelectedTripId(tripId)} 
    />
  );
}