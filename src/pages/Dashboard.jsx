// src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Settings, Calendar, MapPin, ArrowRight } from 'lucide-react';
import TripAdminModal from '../components/TripAdminModal';

export default function Dashboard({ onSelectTrip, userRole = 'Owner' }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for the Trip Admin Modal (Members & Vault)
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTrips() {
      try {
        const q = query(collection(db, "trips"), orderBy("startDate", "asc"));
        const snap = await getDocs(q);
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching trips:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, []);

  const handleOpenAdmin = (tripId, e) => {
    e.stopPropagation(); // Prevents triggering the trip selection click
    setSelectedTripId(tripId);
    setIsAdminModalOpen(true);
  };

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
          <p className="text-xs text-slate-500 mt-0.5">Manage your active itineraries, collaborators, and booking vaults.</p>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">No trips found</p>
          <p className="text-xs text-slate-400">Create your first trip to start planning your itinerary.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map(trip => (
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
                  
                  {/* Trip Settings & Vault Button */}
                  <button 
                    onClick={(e) => handleOpenAdmin(trip.id, e)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                    title="Manage Trip Members & Vault Links"
                  >
                    <Settings className="w-3.5 h-3.5 text-blue-600" /> Settings & Vault
                  </button>
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

              {/* Card Footer */}
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

      {/* Global Dashboard Modal Instance for Settings & Vault */}
      {selectedTripId && (
        <TripAdminModal 
          tripId={selectedTripId}
          isOpen={isAdminModalOpen}
          onClose={() => {
            setIsAdminModalOpen(false);
            setSelectedTripId(null);
          }}
          userRole={userRole}
        />
      )}
    </div>
  );
}