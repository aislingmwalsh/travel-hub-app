import React, { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. The "Link Catcher": Checks if the URL contains a Firebase magic link
    const checkEmailLink = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        
        // If they opened the link on a different device, ask for their email to confirm
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        
        try {
          await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem('emailForSignIn');
          // This cleans up the messy URL so the token disappears from the address bar
          window.history.replaceState(null, '', '/');
        } catch (error) {
          console.error('Error signing in with link', error);
        }
      }
    };

    checkEmailLink();

    // 2. The "Bouncer": Listens for login or logout events in the background
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Stop showing the loading screen once we know their status
    });

    // Cleanup the listener when the app closes
    return () => unsubscribe();
  }, []);

  // Show a dark loading screen while Firebase checks the user's status
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-emerald-400 font-medium animate-pulse">Loading Travel Hub...</div>
      </div>
    );
  }


// If the user is logged in, show the Dashboard. 
  // If not, show the Login screen.
 return user ? <Dashboard user={user} /> : <Login />;
} 
