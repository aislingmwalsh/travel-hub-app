// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Calendar, MapPin, ArrowRight, Filter } from 'lucide-react';

export default function Dashboard({ user, onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'upcoming', 'past'

  useEffect(() => {
    async function fetchUserTrips() {
      if (!user) return;
      try {
        const q = query(collection(db, "trips"), orderBy("startDate", "asc"));
        const snap = await getDocs(q);
        
        const authorizedTrips = [];
        const today = new Date().toISOString().split('T')[0];

        // Check membership for each trip
        for (const tripDoc of snap.docs) {
          const tripId = tripDoc.id;
          const tripData = tripDoc.data();

          const membersSnap = await getDocs(collection(db, "trips", tripId, "members"));
          const membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Check if current user is part of this trip (by email or uid)
          const isMember = membersList.some(m => 
            (m.email && m.email.toLowerCase() === user.email?.toLowerCase()) || 
            m.id === user.uid
          );

          if (isMember) {
            authorizedTrips.push({
              id: tripId,
              ...tripData,
              userRole: membersList.find(m => m.email?.toLowerCase() === user.email?.toLowerCase() || m.id === user.uid)?.role || 'Guest'
            });
          }
        }

        setTrips(authorizedTrips);
      } catch (err) {
        console.error("Error fetching user trips:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserTrips();
  }, [user]);

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
          <p className="text-xs text-slate-500 mt-0.5">Manage your active itineraries, bookings, and invitations.</p>
        </div>

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
      </div>

      {filteredTrips.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">No trips found matching this filter</p>
          <p className="text-xs text-slate-400">You have not been invited to or created any trips in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map(trip => (
            <div 
              key={trip.id} 
              onClick={() => onSelectTrip && onSelectTrip(trip.id)}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    {trip.currency || 'EUR'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
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

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{trip.startDate}</span>
                </div>

                <span className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:underline">
                  Open Itinerary <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}