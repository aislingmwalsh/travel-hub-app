import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // adjust to your firebase path
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { addDaysToDate } from '../utils/dateUtils';

export default function TripItinerary({ tripId, tripStartDate, tripEndDate }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [dayOffset, setDayOffset] = useState(0); // 0 = First day of the trip
  const [loading, setLoading] = useState(false);

  // Fetch itinerary items for this specific trip
  useEffect(() => {
    async function fetchItinerary() {
      if (!tripId) return;
      try {
        const q = query(
          collection(db, "trips", tripId, "itinerary"),
          orderBy("dayOffset", "asc")
        );
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setItineraryItems(items);
      } catch (error) {
        console.error("Error fetching itinerary:", error);
      }
    }
    fetchItinerary();
  }, [tripId]);

  // Handle adding a new activity
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const newItem = {
        title,
        time: time || 'All Day',
        dayOffset: Number(dayOffset),
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      
      // Update local state so it renders immediately without refreshing
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setTime('');
      setDayOffset(0);
    } catch (error) {
      console.error("Error adding itinerary item:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Trip Itinerary</h2>

      {/* Add Itinerary Item Form */}
      <form onSubmit={handleAddItem} className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Activity / Event</label>
          <input 
            type="text" 
            placeholder="e.g., Dinner reservation or Flight" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Day of Trip</label>
          <select 
            value={dayOffset} 
            onChange={(e) => setDayOffset(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* Generates options dynamically based on trip dates */}
            <option value={0}>Day 1 (Start Date)</option>
            <option value={1}>Day 2</option>
            <option value={2}>Day 3</option>
            <option value={3}>Day 4</option>
            <option value={4}>Day 5</option>
            <option value={5}>Day 6</option>
            <option value={6}>Day 7</option>
            <option value={7}>Day 8</option>
            <option value={8}>Day 9</option>
            <option value={9}>Day 10+</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Time</label>
          <input 
            type="text" 
            placeholder="e.g., 18:30" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-4 flex justify-end mt-2">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
          >
            {loading ? 'Adding...' : '+ Add to Itinerary'}
          </button>
        </div>
      </form>

      {/* Render Itinerary List with Smart Dates */}
      <div className="space-y-3">
        {itineraryItems.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No itinerary items added yet. Add your first activity above!</p>
        ) : (
          itineraryItems.map((item) => {
            const calculatedDate = addDaysToDate(tripStartDate, item.dayOffset);

            return (
              <div key={item.id} className="p-4 rounded-lg border border-gray-200 flex justify-between items-center bg-white">
                <div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">
                    Day {item.dayOffset + 1} {calculatedDate ? `(${calculatedDate})` : ''}
                  </span>
                  <h4 className="text-md font-semibold text-gray-800 mt-1">{item.title}</h4>
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {item.time}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}