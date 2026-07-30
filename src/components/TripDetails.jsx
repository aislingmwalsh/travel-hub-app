// src/components/TripDetails.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import TripItinerary from './TripItinerary';

export default function TripDetails({ tripId, onBack }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the specific trip's details using its ID
  useEffect(() => {
    async function fetchTripDetails() {
      if (!tripId) return;
      try {
        const docRef = doc(db, "trips", tripId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setTrip({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.log("No such trip found!");
        }
      } catch (error) {
        console.error("Error fetching trip details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTripDetails();
  }, [tripId]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading trip details...</div>;
  }

  if (!trip) {
    return <div className="p-6 text-center text-red-500">Trip not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="mb-6 text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        ← Back to Dashboard
      </button>

      {/* Trip Header Banner */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
          {trip.status || 'Planning'}
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">{trip.title}</h1>
        <p className="text-sm text-gray-500 mt-1">📍 {trip.location}</p>
        
        <div className="mt-4 flex gap-6 text-sm text-gray-600 border-t border-gray-100 pt-4">
          <div>
            <span className="font-semibold text-gray-800">Start Date:</span> {trip.startDate}
          </div>
          <div>
            <span className="font-semibold text-gray-800">End Date:</span> {trip.endDate}
          </div>
        </div>
      </div>

      {/* Itinerary Section (Where our date-shifting schedule lives) */}
      <TripItinerary 
        tripId={trip.id} 
        tripStartDate={trip.startDate} 
      />
    </div>
  );
}