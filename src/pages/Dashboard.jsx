// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, arrayUnion, or } from 'firebase/firestore';
import { Plane, Plus, MapPin, Calendar, Users, LogOut, X, UserPlus, Mail, ChevronRight } from 'lucide-react';

function getSeasonalAccent(startDateStr) {
  if (!startDateStr) return 'from-slate-400 to-slate-500';
  const month = new Date(startDateStr).getMonth() + 1;
  
  if (month >= 3 && month <= 5) return 'from-emerald-400 to-teal-500'; // Spring
  if (month >= 6 && month <= 8) return 'from-amber-400 to-orange-500'; // Summer
  if (month >= 9 && month <= 11) return 'from-orange-500 to-rose-500'; // Autumn
  return 'from-sky-400 to-indigo-500'; // Winter
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Booked': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Completed': return 'bg-slate-200 text-slate-700 border-slate-300';
    case 'Planning':
    default: return 'bg-amber-100 text-amber-800 border-amber-300';
  }
}

export default function Dashboard({ user, onSelectTrip }) {
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Standardized field name: destination instead of location
  const [newTrip, setNewTrip] = useState({ title: '', destination: '', startDate: '', endDate: '' });
  
  const [activeInviteTrip, setActiveInviteTrip] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

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
        destination: newTrip.destination, // Saved as destination in Firestore
        startDate: newTrip.startDate,
        endDate: newTrip.endDate,
        members: { [user.uid]: 'owner' },
        invitedEmails: [],
        status: 'Planning',
        createdAt: new Date()
      });
      setIsNewTripModalOpen(false);
      setNewTrip({ title: '', destination: '', startDate: '', endDate: '' });
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

  // Filtering & Sorting Logic
  const filteredTrips = trips.filter(trip => {
    const status = trip.status || 'Planning';
    if (statusFilter === 'All') {
      return status !== 'Completed'; // Hide completed trips by default in "All" view
    }
    return status === statusFilter;
  });

  filteredTrips.sort((a, b) => {
    if (statusFilter === 'Completed') {
      const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
      const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
      return dateB - dateA; // Most recent end date first
    } else {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB; // Soonest start date first
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans selection:bg-blue-200">
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
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline-block">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dashboard Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1">Your Itineraries</h2>
            <p className="text-slate-500 text-sm">Manage your upcoming global fixtures and trips.</p>
          </div>
          <button 
            onClick={() => setIsNewTripModalOpen(true)}
            className="group bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-all flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            New Trip
          </button>
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8">
          {['All', 'Planning', 'Booked', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === status 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Trips Grid */}
        {loadingTrips ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse shadow-sm"></div>
             ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm">
            <div className="bg-slate-50 p-4 rounded-full mb-6 border border-slate-100">
              <Plane className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No itineraries found</h3>
            <p className="text-slate-500 mb-8 max-w-sm">No trips match the selected status filter.</p>
            {statusFilter !== 'All' && (
              <button onClick={() => setStatusFilter('All')} className="text-blue-600 font-bold hover:underline text-sm cursor-pointer">
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => {
              const accentGradient = getSeasonalAccent(trip.startDate);
              const statusBadgeClass = getStatusBadgeStyle(trip.status);

              return (
                <div 
                  key={trip.id} 
                  onClick={() => onSelectTrip(trip.id)}
                  className="group relative bg-white rounded-3xl border border-slate-200 hover:border-slate-300 overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col h-full cursor-pointer"
                >
                  {/* Seasonal Top Banner Accent */}
                  <div className={`h-2.5 w-full bg-gradient-to-r ${accentGradient}`}></div>
                  
                  <div className="p-6 flex flex-col flex-grow relative z-10">
                    <div className="flex justify-between items-start gap-3 mb-6">
                      <h3 className="font-bold text-xl text-slate-900 tracking-tight line-clamp-2 pr-2">
                        {trip.title}
                      </h3>
                      {/* Top-Right Status Pill */}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border shrink-0 ${statusBadgeClass}`}>
                        {trip.status || 'Planning'}
                      </span>
                    </div>
                    
                    <div className="space-y-4 mt-auto">
                      <div className="flex items-start gap-3 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                        <span>{formatTripDates(trip)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {Array.from({ length: Math.min(3, Object.keys(trip.members || {}).length + (trip.invitedEmails?.length || 0)) }).map((_, i) => (
                              <div key={i} className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shadow-xs">
                                <Users className="w-3 h-3 text-slate-500" />
                              </div>
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-slate-500 ml-2">
                            {Object.keys(trip.members || {}).length + (trip.invitedEmails?.length || 0)} Traveller(s)
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {trip.members?.[user.uid] === 'owner' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveInviteTrip(trip); }}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-blue-600 p-2 rounded-full transition-colors border border-slate-200 cursor-pointer"
                              title="Invite a traveller"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          <div className="bg-slate-50 group-hover:bg-blue-600 text-slate-400 group-hover:text-white p-2 rounded-full transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Trip Modal */}
        {isNewTripModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
              <button onClick={() => setIsNewTripModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-8">Draft New Trip</h2>
              
              <form onSubmit={handleCreateTrip} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Trip Title</label>
                  <input required type="text" placeholder="e.g. Australia 2027" value={newTrip.title} onChange={(e) => setNewTrip({...newTrip, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  {/* Renamed from Location to Destination */}
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Destination</label>
                  <input required type="text" placeholder="e.g. Melbourne & Sydney" value={newTrip.destination} onChange={(e) => setNewTrip({...newTrip, destination: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Start Date</label>
                    <input required type="date" value={newTrip.startDate} onChange={(e) => setNewTrip({...newTrip, startDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">End Date</label>
                    <input required type="date" value={newTrip.endDate} onChange={(e) => setNewTrip({...newTrip, endDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white font-bold py-4 px-4 rounded-2xl mt-4 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20 cursor-pointer">
                  {isSubmitting ? 'Securing Dates...' : 'Create Itinerary'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {activeInviteTrip && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-8 relative shadow-2xl">
              <button onClick={() => setActiveInviteTrip(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Add Traveller</h2>
              <p className="text-sm text-slate-500 mb-8">
                Send an invite for <span className="text-blue-600 font-medium">{activeInviteTrip.title}</span>.
              </p>
              
              <form onSubmit={handleInviteTraveller} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input required type="email" placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 placeholder:text-slate-400 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={isInviting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-2xl mt-4 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer">
                  <UserPlus className="w-5 h-5" />
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}