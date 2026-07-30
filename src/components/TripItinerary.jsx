// src/components/TripItinerary.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, Tag, Plus, Trash2 } from 'lucide-react';

// Category color badges mapping
const CATEGORY_COLORS = {
  Tour: 'bg-purple-50 text-purple-700 border-purple-100',
  Meal: 'bg-amber-50 text-amber-700 border-amber-100',
  Museum: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Transport: 'bg-blue-50 text-blue-700 border-blue-100',
  Accommodation: 'bg-rose-50 text-rose-700 border-rose-100',
  Other: 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function TripItinerary({ tripId, tripStartDate, tripEndDate }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedDate, setSelectedDate] = useState(tripStartDate || '');
  const [category, setCategory] = useState('Tour');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch items for this specific trip from Firestore
  useEffect(() => {
    async function fetchItinerary() {
      if (!tripId) return;
      try {
        const q = query(
          collection(db, "trips", tripId, "itinerary"),
          orderBy("date", "asc")
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

  // Handle adding a new rich activity
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    setLoading(true);
    try {
      const newItem = {
        title,
        time: time || '00:00',
        date: selectedDate,
        category,
        location: location.trim(),
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setLocation('');
      setTime('09:00');
      setCategory('Tour');
    } catch (error) {
      console.error("Error adding itinerary item:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting an item
  const handleDeleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "trips", tripId, "itinerary", itemId));
      setItineraryItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Group items by calendar date
  const groupedItems = itineraryItems.reduce((groups, item) => {
    const dateKey = item.date || tripStartDate;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {});

  // Sort activities within each day by time
  Object.keys(groupedItems).forEach(date => {
    groupedItems[date].sort((a, b) => a.time.localeCompare(b.time));
  });

  return (
    <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Trip Itinerary</h3>

      {/* Rich Activity Creation Form */}
      <form onSubmit={handleAddItem} className="bg-slate-50 p-6 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end border border-slate-100">
        
        {/* Title */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Activity / Event</label>
          <input 
            type="text" 
            placeholder="e.g., Guinness Storehouse Tour" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Date Picker */}
        <div className="md:col-span-1 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
          <input 
            type="date" 
            min={tripStartDate}
            max={tripEndDate}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Time Picker */}
        <div className="md:col-span-1 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Time</label>
          <input 
            type="time" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Category Dropdown */}
        <div className="md:col-span-1 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          >
            <option value="Tour">Tour</option>
            <option value="Meal">Meal</option>
            <option value="Museum">Museum</option>
            <option value="Transport">Transport</option>
            <option value="Accommodation">Accommodation</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Location Input */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location / Venue</label>
          <input 
            type="text" 
            placeholder="e.g., St. James's Gate, Dublin" 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <div className="md:col-span-3 lg:col-span-4 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Adding Activity...' : 'Add to Itinerary'}
          </button>
        </div>
      </form>

      {/* Grouped Day-by-Day Itinerary Feed */}
      <div className="space-y-6">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No activities scheduled yet. Use the form above to add your first event!</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([dateStr, items]) => {
            const formattedDateHeading = new Date(dateStr).toLocaleDateString('en-IE', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div key={dateStr} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                {/* Day Header */}
                <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{formattedDateHeading}</h4>
                </div>

                {/* Activities for this Day */}
                <div className="p-3 space-y-3">
                  {items.map((item) => {
                    const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;

                    return (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition">
                        
                        <div className="flex items-start sm:items-center gap-4">
                          {/* Time Badge */}
                          <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            {item.time}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h5 className="font-semibold text-slate-900 text-base">{item.title}</h5>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                                {item.category || 'Other'}
                              </span>
                            </div>

                            {item.location && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                <span>{item.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition self-end sm:self-center"
                          title="Delete activity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}