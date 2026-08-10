// src/components/ItineraryForm.jsx
import React from 'react';
import { Clock, MapPin, Plus, DollarSign } from 'lucide-react';

export default function ItineraryForm({
  title, setTitle,
  selectedDate, setSelectedDate,
  effectiveStartDate, effectiveEndDate,
  selectedHour, setSelectedHour,
  selectedMinute, setSelectedMinute,
  category, setCategory, sortedCategories,
  cost, setCost, currency,
  location, setLocation, handleLocationChange,
  showPredictions, predictions, handleSelectPrediction,
  details, setDetails,
  loading, dropdownRef
}) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <form onSubmit={(e) => e.target.closest('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))} className="bg-slate-50 p-6 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end border border-slate-100">
      <div className="md:col-span-2">
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

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
        <input 
          type="date" 
          min={effectiveStartDate}
          max={effectiveEndDate}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          required
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Time</label>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-2 text-sm text-slate-900">
          <Clock className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)} className="bg-transparent focus:outline-none font-medium py-1">
            {hours.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <span>:</span>
          <select value={selectedMinute} onChange={(e) => setSelectedMinute(e.target.value)} className="bg-transparent focus:outline-none font-medium py-1">
            {minutes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500">
          {sortedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cost ({currency})</label>
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500">
                <span className="absolute left-3 text-xs font-bold text-slate-400 pointer-events-none">{currency}</span>
                <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={cost} 
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-white border-0 pl-12 pr-3 py-3 text-sm text-slate-900 focus:outline-none"
                />
            </div>
        </div>

      <div className="md:col-span-2 relative" ref={dropdownRef}>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location / Venue</label>
        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500">
          <MapPin className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search location..." 
            value={location}
            onChange={handleLocationChange}
            required
            className="w-full bg-white border-0 pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none"
          />
        </div>
        {showPredictions && predictions.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
            {predictions.map(p => (
              <li key={p.place_id} onClick={() => handleSelectPrediction(p)} className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span className="truncate">{p.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="md:col-span-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Activity Details & Notes (Optional)</label>
        <textarea placeholder="Add booking references or notes..." value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none resize-none" />
      </div>

      <div className="md:col-span-6 flex justify-end">
        <button type="submit" disabled={loading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> {loading ? 'Adding...' : 'Add Activity'}
        </button>
      </div>
    </form>
  );
}