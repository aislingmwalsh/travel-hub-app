import React, { useState } from 'react';
import { sendLoginEmail, loginWithGoogle } from '../firebase'; 
import { Plane, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  // Handler for the Magic Link
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setStatus('loading');
    
    const success = await sendLoginEmail(email);
    
    if (success) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMessage('Failed to send the login link. Please try again later.');
    }
  };

  // Handler for the Google Login
  const handleGoogleAuth = async () => {
    const success = await loginWithGoogle();
    if (!success) {
      setStatus('error');
      setErrorMessage('Google sign-in failed or was cancelled.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        
        {/* Header section */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-emerald-950 p-3 rounded-full mb-4 border border-emerald-800">
            <Plane className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-emerald-400 mb-1">Travel Hub</h1>
          <p className="text-sm text-slate-400">Log in to access your itineraries.</p>
        </div>

        {/* Success State for Magic Link */}
        {status === 'success' ? (
          <div className="bg-emerald-950/50 border border-emerald-800 rounded-xl p-6 text-center animate-pulse">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-bold text-slate-200 mb-2">Check your inbox!</h3>
            <p className="text-xs text-slate-400">
              We've sent a magic link to <span className="text-emerald-400">{email}</span>. Click it to log in securely.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Error Message Alert */}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 p-3 rounded-lg text-xs border border-rose-900/50 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Magic Link Form */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {status === 'loading' ? 'Sending Link...' : 'Send Magic Link'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900 px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            
          </div>
        )}
      </div>
    </div>
  );
}