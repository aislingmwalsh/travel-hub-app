// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, addDoc, doc, setDoc } from 'firebase/firestore';
import { Calendar, MapPin, ArrowRight, Filter, Plus, X } from 'lucide-react';

function getSeasonalTheme(startDateStr) {
  if (!startDateStr) return { bg: 'bg-white', border: 'border-slate-200', badge: 'bg-blue-50 text-blue-600 border-blue-100' };
  
  const month = new Date(startDateStr).getMonth();
  
  if (month >= 2 && month <= 4) {
    return {
      bg: 'bg-gradient-to-br from-emerald-50/40 via-white to-white',
      border: 'border-emerald-200/60',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      bg: 'bg-gradient-to-br from-amber-50/40 via-white to-white',
      border: 'border-amber-200/60',
      badge: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }
  if (month >= 8 && month <= 10) {
    return {
      bg: 'bg-gradient-to-br from-orange-50/40 via-white to-white',
      border: 'border-orange-200/60',
      badge: 'bg-orange-50 text-orange-700 border-orange-200'
    };
  }
  return {
    bg: 'bg-gradient-to-br from-blue-50/40 via-white to-white',
    border: 'border-blue-200/60',
    badge: 'bg-blue-50 text-blue-700 border-blue-200'
  };
}

export default function Dashboard({ user, onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Trip Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchUserTrips() {
      if (!user) return;
      try {
        const q = query(collection(db, "trips"), orderBy("startDate", "asc"));
        const snap = await getDocs(q);
        
        const authorizedTrips = [];

        for (const docSnap of snap.docs) {
          const tripData = docSnap.data();
          const tripId = docSnap.id;

          // Check if current user exists in the members map with an owner or collaborator/guest role
          const memberRole = tripData.members && tripData.members[user.uid];

          // If the user is in the members map OR if they created it (fallback), show the trip
          if (memberRole || tripData.createdBy === user.uid) {
            authorizedTrips.push({
              id: tripId,
              ...tripData,
              userRole: memberRole ? memberRole.toUpperCase() : 'OWNER'
            });
          }
        }

        setTrips(authorizedTrips);
      } catch (err) {
        console.error("Error fetching authorized trips:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserTrips();
  }, [user]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !user) return;

    setSubmitting(true);
    try {
      // Create trip document with the exact 'members' map expected by your database rules
      const newTripRef = await addDoc(collection(db, "trips"), {
        title: title.trim(),
        destination: destination.trim(),
        startDate: startDate,
        endDate: endDate || startDate,
        currency: currency,
        createdBy: user.uid,
        members: {
          [user.uid]: 'owner' // Matches your rule: resource.data.members[request.auth.uid] == 'owner'
        },
        createdAt: new Date()
      });

      // Reset form & close modal
      setTitle('');
      setDestination('');
      setStartDate('');
      setEndDate('');
      setCurrency('EUR');
      setIsCreateModalOpen(false);

      // Open new trip itinerary
      onSelectTrip(newTripRef.id);
    } catch (err) {
      console.error("Error creating trip:", err);
      alert("Failed to create trip. Check console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTrips = trips.filter(trip => {
    const today = new Date().toISOString().split('T')[0];
    if (statusFilter === 'upcoming') return trip.startDate >= today;
    if (statusFilter === 'past') return trip.startDate < today;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-sm text-slate-400 animate-pulse">Loading your trips...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Trips Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Select a trip to view and manage its itinerary.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Bar */}
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              All ({trips.length})
            </button>
            <button 
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${statusFilter === 'upcoming' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Upcoming
            </button>
            <button 
              onClick={() => setStatusFilter('past')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${statusFilter === 'past' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Past
            </button>
          </div>

          {/* Create New Trip Button */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2.5 rounded-2xl transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Trip
          </button>
        </div>
      </div>

      {filteredTrips.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">No trips found matching this filter</p>
          <p className="text-xs text-slate-400">Click "Create Trip" above to start planning your first itinerary.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map(trip => {
            const theme = getSeasonalTheme(trip.startDate);
            
            return (
              <div 
                key={trip.id} 
                onClick={() => onSelectTrip && onSelectTrip(trip.id)}
                className={`${theme.bg} p-6 rounded-3xl border ${theme.border} shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer group`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200 shadow-xs">
                      {trip.currency || 'EUR'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs ${theme.badge}`}>
                      {trip.userRole}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition">{trip.title}</h3>
                    {trip.destination && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">{trip.destination}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{trip.startDate}</span>
                  </div>

                  <span className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:underline">
                    Open Itinerary <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Trip Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-lg">Create New Trip</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full hover:bg-slate-200 transition cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Trip Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Summer in Tokyo" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Destination</label>
                <input 
                  type="text" 
                  placeholder="e.g. Tokyo, Japan" 
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Start Date *</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Currency</label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}