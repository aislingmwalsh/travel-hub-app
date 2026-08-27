// src/components/TripDetails.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft, Calendar, ClipboardList } from 'lucide-react';
import TripHeader from './TripHeader';
import TripItinerary from './TripItinerary';
import TripMembersModal from './TripMembersModal';
import PackingList from './PackingList';

export default function TripDetails({ tripId, onBack }) {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [userNamesMap, setUserNamesMap] = useState({});
  const [hasPackingList, setHasPackingList] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary'); // 'itinerary' or 'packing'

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

  useEffect(() => {
    if (!tripId) return;
    async function checkPackingList() {
      try {
        const packingSnap = await getDoc(doc(db, "trips", tripId, "settings", "packing_list"));
        setHasPackingList(packingSnap.exists());
      } catch (err) {
        console.error("Error checking packing list:", err);
      }
    }
    checkPackingList();

    const handlePackingListCreated = (e) => {
      if (e.detail?.tripId === tripId) {
        setHasPackingList(true);
      }
    };
    window.addEventListener('packingListCreated', handlePackingListCreated);
    return () => window.removeEventListener('packingListCreated', handlePackingListCreated);
  }, [tripId]);

  useEffect(() => {
    if (!tripData?.members) return;
    const uids = Object.keys(tripData.members);
    if (uids.length === 0) return;

    async function fetchMemberProfiles() {
      const mapping = {};
      try {
        await Promise.all(uids.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists() && userSnap.data().displayName) {
            mapping[uid] = userSnap.data().displayName;
          }
        }));
        setUserNamesMap(mapping);
      } catch (err) {
        console.error("Error fetching member profiles:", err);
      }
    }
    fetchMemberProfiles();
  }, [tripData?.members]);

  // Safely check current user role from members object
  const currentUserRole = tripData?.members?.[auth.currentUser?.uid] || 'Guest';

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
        <button onClick={onBack} className="text-blue-600 font-bold text-sm underline cursor-pointer">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-6">
        <button onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>

      {/* Header with Role Permissions Passed */}
      <TripHeader 
        tripId={tripId} 
        tripData={tripData} 
        userRole={currentUserRole} 
        onOpenMembersModal={() => setIsMembersModalOpen(true)}
        onTripUpdate={(updatedFields) => setTripData(prev => ({ ...prev, ...updatedFields }))}
      />

      {/* Tabs */}
      {hasPackingList && (
        <div className="flex border-b border-slate-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('itinerary')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'itinerary' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" /> Itinerary
          </button>
          <button
            onClick={() => setActiveTab('packing')}
            className={`pb-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'packing' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Packing List
          </button>
        </div>
      )}

      {/* Conditional Active Panel Render */}
      {activeTab === 'packing' && hasPackingList ? (
        <PackingList 
          tripId={tripId}
          tripMembers={tripData.members || {}}
          userNamesMap={userNamesMap}
          userRole={currentUserRole}
          tripTitle={tripData.title}
        />
      ) : (
        <TripItinerary 
          tripId={tripId} 
          tripStartDate={tripData.startDate} 
          tripEndDate={tripData.endDate} 
          currency={tripData.currency || 'EUR'}
          userRole={currentUserRole}
          tripDestination={tripData.destination} 
          tripMembers={tripData.members || {}}
          userNamesMap={userNamesMap}
        />
      )}

      <TripMembersModal 
        tripId={tripId} 
        isOpen={isMembersModalOpen} 
        onClose={() => setIsMembersModalOpen(false)} 
      />
    </div>
  );
}
