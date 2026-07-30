// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, arrayUnion, or } from 'firebase/firestore';
import { Plane, Plus, MapPin, Calendar, Users, LogOut, X, UserPlus, Mail, ChevronRight } from 'lucide-react';

export default function Dashboard({ user, onSelectTrip }) {
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTrip, setNewTrip] = useState({ title: '', location: '', startDate: '', endDate: '' });
  
  const [activeInviteTrip, setActiveInviteTrip] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  useEffect(() => {
    if (!user?.uid || !user?.email) return;

    const tripsQuery = query(
      collection(db, 'trips'),
      or(
        where(`members.${user.uid}`, '==', 'owner'),
        where('invitedEmails', 'array-contains', user.email)
      )
    );

    const unsubscribe = onSnapshot(tripsQuery, (snapshot) => {
      const liveTrips = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));
      
      liveTrips.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setTrips(liveTrips);
      setLoadingTrips(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'trips'), {
        title: newTrip.title,
        location: newTrip.location,
        startDate: newTrip.startDate,
        endDate: newTrip.endDate,
        members: { [user.uid]: 'owner' },
        invitedEmails: [],
        status: 'Planning',
        createdAt: new Date()
      });
      setIsNewTripModalOpen(false);
      setNewTrip({ title: '', location: '', startDate: '', endDate: '' });
    } catch (error) {
      console.error("Error creating trip:", error);
      alert("Failed to create trip.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteTraveller = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !activeInviteTrip) return;
    setIsInviting(true);
    try {
      const tripRef = doc(db, 'trips', activeInviteTrip.id);
      await updateDoc(tripRef, {
        invitedEmails: arrayUnion(inviteEmail.toLowerCase())
      });
      setActiveInviteTrip(null);
      setInviteEmail('');
    } catch (error) {
      console.error("Error inviting user:", error);
      alert("Failed to send invite.");
    } finally {
      setIsInviting(false);
    }
  };

  const formatTripDates = (trip) => {
    if (trip.startDate && trip.endDate) {
      const options = { day: 'numeric', month: 'short', year: 'numeric' };
      const start = new Date(trip.startDate).toLocaleDateString('en-IE', options);
      const end = new Date(trip.endDate).toLocaleDateString('en-IE', options);
      return `${start} to ${end}`;
    }
    return trip.dates || 'Dates TBC';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-blue-200">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-blue-100/50 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Header Navigation */}
        <header className="flex justify-between items-center mb-16 pt-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-teal-400 p-2.5 rounded-xl shadow-md shadow-blue-500/20">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Travel Hub</h1>
          </div>
          <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-600 hidden md:inline-block">
              {user?.email}
            </span>
            <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
            <button 
              onClick={() => auth.signOut()}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline-block">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dashboard Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1">Your Itineraries</h2>
            <p className="text-slate-500 text-sm">Manage your upcoming global fixtures and trips.</p>
          </div>
          <button 
            onClick={() => setIsNewTripModalOpen(true)}
            className="group bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-all flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            New Trip
          </button>
        </div>

        {/* Trips Grid */}
        {loadingTrips ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse shadow-sm"></div>
             ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm">
            <div className="bg-slate-50 p-4 rounded-full mb-6 border border-slate-100">
              <Plane className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No itineraries yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm">Your passport is waiting. Create your first trip to start organising your plans.</p>
            <button onClick={() => setIsNewTripModalOpen(true)} className="text-blue-600 font-bold hover:text-blue-700 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Start Planning
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                onClick={() => onSelectTrip(trip.id)}
                className="group relative bg-white rounded-3xl border border-slate-200 hover:border-blue-300 overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1 flex flex-col h-full cursor-pointer"
              >
                
                {/* Card Banner Gradient */}
                <div className="h-2 w-full bg-gradient-to-r from-teal-400 via-blue-500 to-blue-600"></div>
                
                <div className="p-6 flex flex-col flex-grow relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-bold text-xl text-