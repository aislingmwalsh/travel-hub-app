import React, { useState } from 'react';
import { addDaysToDate } from '../utils/dateUtils';

export default function ItineraryView({ trip, itineraryItems, onUpdateTripStartDate }) {
  // trip = { id: '1', name: 'Australia Rugby Trip', startDate: '2027-10-01' }
  // itineraryItems = [{ id: '101', title: 'Ireland vs Portugal', dayOffset: 3, time: '18:00' }]

  const [newStartDate, setNewStartDate] = useState(trip.startDate);

  const handleDateChange = (e) => {
    const updatedDate = e.target.value;
    setNewStartDate(updatedDate);
    // Call your Firebase/database update function here:
    onUpdateTripStartDate(trip.id, updatedDate);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Trip Header & Master Date Picker */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{trip.name}</h1>
          <p className="text-sm text-gray-500">Changing the start date automatically shifts the entire itinerary.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Trip Start Date</label>
          <input 
            type="date" 
            value={newStartDate}
            onChange={handleDateChange}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Itinerary List */}
      <div className="space-y-4">
        {itineraryItems.map((item) => {
          // Dynamically compute the exact calendar date for this item
          const calculatedDate = addDaysToDate(newStartDate, item.dayOffset);

          return (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">
                  Day {item.dayOffset + 1} ({calculatedDate})
                </span>
                <h3 className="text-lg font-semibold text-gray-800 mt-1">{item.title}</h3>
              </div>
              <div className="text-right text-sm text-gray-500">
                <span>{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}