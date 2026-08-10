// src/pages/TripDetail.jsx (or src/components/TripDetail.jsx)
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import TripHeader from '../components/TripHeader';
import TripItinerary from '../components/TripItinerary';
import TripMembersModal from '../components/TripMembersModal';

export default function TripDetail() {
  const { tripId } = useParams(); // Or receive tripId as a prop if your routing differs
  const [tripData, setTripData] = useState(null);
  const [userRole, setUserRole] = useState('Owner'); // Default or fetched from members subcollection
  const [loading, setLoading] = useState(true);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Fetch trip document details from Firestore
  useEffect(() => {
    async function fetchTripDetails() {
      if (!tripId) return;
      try {
        const tripRef = doc(db, "trips", tripId);
        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
          setTripData(tripSnap.data());
        } else {
          console.error("Trip not found");
        }
      } catch (error) {
        console.error("Error fetching trip:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTripDetails();
  }, [tripId]);

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
        <p className="text-slate-500 text-sm">The trip you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Back / Navigation link if needed */}
      <div className="mb-6">
        <a href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </a>
      </div>

      {/* Trip Header Component (Title, Destination, Dates, Status, Currency, Edit & Manage Buttons) */}
      <TripHeader 
        tripId={tripId} 
        tripData={tripData} 
        userRole={userRole} 
        onOpenMembersModal={() => setIsMembersModalOpen(true)} 
      />

      {/* Itinerary Component (Dates Feed, Creation Form, Drag & Drop, Map Links, Inline Editing) */}
      <TripItinerary 
        tripId={tripId} 
        tripStartDate={tripData.startDate} 
        tripEndDate={tripData.endDate} 
      />

      {/* Members Management Modal Component (Invite Guests/Collaborators/Owners) */}
      <TripMembersModal 
        tripId={tripId} 
        isOpen={isMembersModalOpen} 
        onClose={() => setIsMembersModalOpen(false)} 
      />
    </div>
  );
}