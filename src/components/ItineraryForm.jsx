// src/components/ItineraryForm.jsx
import React from 'react';
import { Clock, Calendar, MapPin, DollarSign, FileText, Plus } from 'lucide-react';

export default function ItineraryForm({
  title, setTitle,
  selectedDate, setSelectedDate,
  effectiveStartDate, effectiveEndDate,
  selectedHour, setSelectedHour,
  selectedMinute, setSelectedMinute,
  isFlexibleTime, setIsFlexibleTime,
  category, setCategory, sortedCategories,
  cost, setCost, currency,
  location, setLocation, handleLocationChange,
  showPredictions, predictions, handleSelectPrediction,
  details, setDetails,
  paidInAdvance, setPaidInAdvance,
  loading, dropdownRef,
  onAddItem
}) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <form onSubmit={onAddItem} className="space-y-4">
      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add New Activity</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Activity Title *</label>
          <input 
            type="text" 
            placeholder="e.g. Dinner at Restaurant" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
          >
            {sortedCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date (Optional)</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            min={effectiveStartDate} 
            max={effectiveEndDate} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-slate-500 uppercase">Time</label>
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
              <input 
                type="checkbox" 
                checked={isFlexibleTime} 
                onChange={(e) => setIsFlexibleTime(e.target.checked)} 
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer" 
              />
              All Day / Flexible Time
            </label>
          </div>

          {!isFlexibleTime ? (
            <div className="flex items-center gap-2">
              <select 
                value={selectedHour} 
                onChange={(e) => setSelectedHour(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
              >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400 font-bold">:</span>
              <select 
                value={selectedMinute} 
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
              >
                {minutes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-400 italic">
              Activity will be scheduled as Flexible (All Day)
            </div>
          )}
        </div>

        <div className="md:col-span-3 relative" ref={dropdownRef}>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Location / Address *</label>
          <input 
            type="text" 
            placeholder="Search address or landmark..." 
            value={location} 
            onChange={handleLocationChange} 
            required 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
          />
          {showPredictions && predictions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {predictions.map(pred => (
                <div 
                  key={pred.place_id} 
                  onClick={() => handleSelectPrediction(pred)}
                  className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 truncate"
                >
                  {pred.description}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cost ({currency})</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={cost} 
            onChange={(e) => setCost(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Notes / Details</label>
          <input 
            type="text" 
            placeholder="Booking reference, dress code, etc." 
            value={details} 
            onChange={(e) => setDetails(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
          />
        </div>

        <div className="md:col-span-3">
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase cursor-pointer">
            <input
              type="checkbox"
              checked={paidInAdvance}
              onChange={(e) => setPaidInAdvance(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            Paid in advance
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button 
          type="submit" 
          disabled={loading}
          className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> {loading ? 'Saving...' : 'Save Activity'}
        </button>
      </div>
    </form>
  );
}
