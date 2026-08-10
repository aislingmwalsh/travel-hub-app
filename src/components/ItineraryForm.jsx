// src/components/ItineraryForm.jsx
import React from 'react';
import { Plus, Clock, MapPin, Tag, DollarSign, FileText } from 'lucide-react';

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
  loading, dropdownRef,
  onAddItem
}) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <form onSubmit={onAddItem} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Activity Title *</label>
          <input 
            type="text" 
            placeholder="e.g. Visit Museum, Dinner reservation" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

        {/* Date (Now Optional) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date (Optional)</label>
          <input 
            type="date" 
            min={effectiveStartDate} 
            max={effectiveEndDate} 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <span className="text-[10px] text-slate-400 mt-0.5 block">Leave blank for Unscheduled Pool</span>
        </div>

        {/* Time */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-600" /> Time
          </label>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm">
            <select 
              value={selectedHour} 
              onChange={(e) => setSelectedHour(e.target.value)} 
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span>:</span>
            <select 
              value={selectedMinute} 
              onChange={(e) => setSelectedMinute(e.target.value)} 
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Category Type */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <Tag className="w-3 h-3 text-purple-600" /> Type
          </label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* Cost */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600" /> Cost ({currency})
          </label>
          <input 
            type="number" 
            step="0.01" 
            placeholder="0.00" 
            value={cost} 
            onChange={(e) => setCost(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

        {/* Location with Google Places Autocomplete */}
        <div className="md:col-span-3 relative" ref={dropdownRef}>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-teal-600" /> Location *
          </label>
          <input 
            type="text" 
            placeholder="Search location or address..." 
            value={location} 
            onChange={handleLocationChange} 
            required 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          {showPredictions && predictions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {predictions.map((prediction) => (
                <div 
                  key={prediction.place_id} 
                  onClick={() => handleSelectPrediction(prediction)} 
                  className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none"
                >
                  {prediction.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details & Notes */}
        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-blue-600" /> Details & Notes
          </label>
          <textarea 
            placeholder="Add booking reference numbers, confirmation codes, or notes..." 
            value={details} 
            onChange={(e) => setDetails(e.target.value)} 
            rows={2} 
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>

      </div>

      <div className="flex justify-end pt-2">
        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Activity'}
        </button>
      </div>
    </form>
  );
}