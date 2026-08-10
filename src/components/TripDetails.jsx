// src/components/TripDetails.jsx (or src/pages/TripDetails.jsx)
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import TripHeader from './TripHeader';
import TripItinerary from './TripItinerary';
import TripMembersModal from './TripMembersModal';

export default function TripDetails({ tripId, onBack }) {
  const [tripData, setTripData] = useState(null);
  const [userRole, setUserRole] = useState('Owner');
  const [loading, setLoading] = useState(true);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTripDetails() {
      if (!tripId) return;
      try {
        const tripRef = doc(db, "trips", tripId);
        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
          setTripData(tripSnap.data());
        }
      } catch (error) {
        console.error("Error fetching trip:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTripDetails();
  }, [tripId]);

  // Handler to instantly update local state when edited in TripHeader
  const handleTripUpdate = (updatedFields) => {
    setTripData(prev => ({ ...prev, ...updatedFields }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!tripData) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Trip not found</h2>
        <button onClick={onBack} className="text-blue-600 font-bold text-sm underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>

      {/* Pass onTripUpdate callback */}
      <TripHeader 
        tripId={tripId} 
        tripData={tripData} 
        userRole={userRole} 
        onOpenMembersModal={() => setIsMembersModalOpen(true)}
        onTripUpdate={handleTripUpdate}
      />

      <TripItinerary 
        tripId={tripId} 
        tripStartDate={tripData.startDate} 
        tripEndDate={tripData.endDate} 
        currency={tripData.currency || 'EUR'}
      />

      <TripMembersModal 
        tripId={tripId} 
        isOpen={isMembersModalOpen} 
        onClose={() => setIsMembersModalOpen(false)} 
      />
    </div>
  );
}