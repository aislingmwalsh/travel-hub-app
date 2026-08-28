// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, addDoc, doc, setDoc, updateDoc, where } from 'firebase/firestore';
import { Calendar, MapPin, ArrowRight, Filter, Plus, X } from 'lucide-react';
import { getTripCoverUrl } from '../utils/imageUtils';
import { formatTripCardDate } from '../utils/dateUtils';

function getNextDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
      bg: 'bg-gradient-to-br from-rose-50/40 via-white to-white',
      border: 'border-rose-200/60',
      badge: 'bg-rose-50 text-rose-700 border-rose-200'
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

function getRelativeTripTiming(startDateStr, endDateStr) {
  if (!startDateStr) return '';
  const parseDate = (str) => {
    const [year, month, day] = String(str || '').split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
  };

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr || startDateStr);
  if (!start || isNaN(start.getTime())) return '';

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const msPerDay = 24 * 60 * 60 * 1000;

  if (todayUtc.getTime() === start.getTime()) {
    return 'Starts today';
  }

  if (start.getTime() > todayUtc.getTime()) {
    const days = Math.round((start.getTime() - todayUtc.getTime()) / msPerDay);
    return `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }

  if (end && todayUtc.getTime() <= end.getTime()) {
    return 'In progress';
  }

  if (end) {
    const daysAgo = Math.round((todayUtc.getTime() - end.getTime()) / msPerDay);
    return `Ended ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }

  return '';
}

export default function Dashboard({ user, onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('upcoming');

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
        // Auto-sync user profile document in Firestore
        try {
          await setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });
        } catch (err) {
          console.error("Error auto-syncing user profile:", err);
        }

        // Query 1: Trips created by the current user
        const qCreated = query(
          collection(db, "trips"),
          where("createdBy", "==", user.uid)
        );

        // Query 2: Trips where the user is in the members map
        const qMember = query(
          collection(db, "trips"),
          where(`members.${user.uid}`, "!=", null)
        );

        // Execute both queries in parallel
        const [snapCreated, snapMember] = await Promise.all([
          getDocs(qCreated),
          getDocs(qMember)
        ]);

        const tripMap = new Map();

        // Process created trips
        snapCreated.docs.forEach(docSnap => {
          tripMap.set(docSnap.id, docSnap);
        });

        // Process member trips
        snapMember.docs.forEach(docSnap => {
          tripMap.set(docSnap.id, docSnap);
        });

        const authorizedTrips = [];

        for (const docSnap of tripMap.values()) {
          const tripData = docSnap.data();
          const tripId = docSnap.id;

          // Check if current user exists in the members map
          const memberRole = tripData.members && tripData.members[user.uid];

          // Safely extract the role string whether it's stored as a string or an object
          let resolvedRole = 'OWNER';
          if (memberRole) {
            if (typeof memberRole === 'object' && memberRole !== null) {
              resolvedRole = (memberRole.role || 'owner').toUpperCase();
            } else if (typeof memberRole === 'string') {
              resolvedRole = memberRole.toUpperCase();
            }
          }

          // If we detect the membership map has a legacy format (string or missing email), trigger a silent migration update
          const isLegacyFormat = typeof memberRole === 'string' || (memberRole && typeof memberRole === 'object' && !memberRole.email);
          if (isLegacyFormat && user.email) {
            try {
              const tripRef = doc(db, "trips", tripId);
              await updateDoc(tripRef, {
                [`members.${user.uid}`]: {
                  role: resolvedRole.toLowerCase(),
                  email: user.email
                }
              });
            } catch (migrationErr) {
              console.error("Failed to migrate legacy member object:", migrationErr);
            }
          }

          // Determine dynamic status based on dates
          const todayStr = new Date().toISOString().split('T')[0];
          let dynamicStatus = tripData.status || 'Planning';
          
          // Check if end date passed
          if (tripData.endDate && tripData.endDate < todayStr) {
            dynamicStatus = 'Completed';
          } else if (tripData.startDate && tripData.startDate <= todayStr) {
            dynamicStatus = 'In Progress';
          }

          // Sync with Firestore if the dynamic status has changed and user is Owner to avoid excessive write loops
          if (dynamicStatus !== tripData.status && (resolvedRole === 'OWNER' || tripData.createdBy === user.uid)) {
            try {
              const tripRef = doc(db, "trips", tripId);
              await updateDoc(tripRef, { status: dynamicStatus });
            } catch (updateErr) {
              console.error("Error auto-updating trip status:", updateErr);
            }
          }

          authorizedTrips.push({
            id: tripId,
            ...tripData,
            status: dynamicStatus,
            userRole: resolvedRole
          });
        }

        // Sort authorized trips in memory by startDate (ascending)
        authorizedTrips.sort((a, b) => {
          const aDate = a.startDate || '';
          const bDate = b.startDate || '';
          return aDate.localeCompare(bDate);
        });

        setTrips(authorizedTrips);
      } catch (err) {
        console.error("Error fetching authorized trips:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserTrips();
  }, [user]);

  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);

    if (!newStartDate) {
      setEndDate('');
      return;
    }

    setEndDate((currentEndDate) => {
      if (!currentEndDate || currentEndDate < newStartDate) {
        return getNextDay(newStartDate);
      }
      return currentEndDate;
    });
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !user) return;
    if (endDate && endDate < startDate) {
      alert('The End Date cannot be earlier than the Start Date.');
      return;
    }

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
          [user.uid]: {
            role: 'owner',
            email: user.email
          }
        }, // 👈 Comma added here correctly!
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

  const today = new Date().toISOString().split('T')[0];
  const upcomingCount = trips.filter(trip => trip.startDate >= today).length;
  const inProgressCount = trips.filter(trip => trip.status === 'In Progress').length;
  const pastCount = trips.filter(trip => trip.startDate < today).length;

  const filteredTrips = trips.filter(trip => {
    if (statusFilter === 'upcoming') return trip.startDate >= today;
    if (statusFilter === 'inprogress') return trip.status === 'In Progress';
    if (statusFilter === 'past') return trip.startDate < today;
    return true;
  });

  const sortedTrips = statusFilter === 'all'
    ? [...filteredTrips].sort((a, b) => {
        if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
        if (b.status === 'In Progress' && a.status !== 'In Progress') return 1;
        return 0;
      })
    : filteredTrips;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-sm text-slate-400 animate-pulse">Loading your trips...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Trips Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Select a trip to view and manage its itinerary.</p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-3">
          {/* Status Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1 sm:ml-2 shrink-0" />
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition cursor-pointer ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              All ({trips.length})
            </button>
            <button 
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition cursor-pointer ${statusFilter === 'upcoming' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Upcoming ({upcomingCount})
            </button>
            <button 
              onClick={() => setStatusFilter('inprogress')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition cursor-pointer ${statusFilter === 'inprogress' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              In Progress ({inProgressCount})
            </button>
            <button 
              onClick={() => setStatusFilter('past')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition cursor-pointer ${statusFilter === 'past' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Past
            </button>
          </div>

          {/* Create New Trip Button */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-3 sm:py-2.5 rounded-2xl transition cursor-pointer shadow-sm"
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
          {sortedTrips.map(trip => {
            const relativeDateLabel = getRelativeTripTiming(trip.startDate, trip.endDate);
            const coverUrl = getTripCoverUrl(trip.destination);

            return (
              <div 
                key={trip.id} 
                onClick={() => onSelectTrip && onSelectTrip(trip.id)}
                className={`bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer group overflow-hidden ${trip.status === 'In Progress' ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
              >
                {/* Image Banner */}
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  <img 
                    src={coverUrl} 
                    alt={trip.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  />
                  {/* Floating Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm bg-white/95 text-slate-800 backdrop-blur-sm border border-slate-100">
                      {trip.userRole}
                    </span>
                    {trip.status && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm border backdrop-blur-sm ${
                        trip.status === 'Booked' ? 'bg-emerald-500/90 text-white border-emerald-400' :
                        trip.status === 'In Progress' ? 'bg-blue-600/90 text-white border-blue-500' :
                        trip.status === 'Completed' ? 'bg-slate-600/90 text-white border-slate-500' :
                        'bg-amber-500/90 text-white border-amber-400'
                      }`}>
                        {trip.status}
                      </span>
                    )}
                  </div>
                  {relativeDateLabel && relativeDateLabel !== 'In progress' && !relativeDateLabel.startsWith('Ended') && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="text-[9px] font-bold text-slate-700 bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-slate-100 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-blue-500" />
                        {relativeDateLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-5 space-y-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-slate-900 truncate group-hover:text-blue-600 transition">{trip.title}</h3>
                    {trip.destination && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">{trip.destination}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      {formatTripCardDate(trip.startDate)}
                    </span>
                    <span className="whitespace-nowrap flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-3 py-1.5 transition">
                      <span>View itinerary</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Trip Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto border border-slate-200 flex flex-col">
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
                    onChange={(e) => handleStartDateChange(e.target.value)} 
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    min={startDate} 
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
