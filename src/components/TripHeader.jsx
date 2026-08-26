// src/components/TripHeader.jsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Calendar, MapPin, Edit3, Save, X, Tag, Camera } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { getTripCoverUrl } from '../utils/imageUtils';

const STATUS_OPTIONS = ['Planning', 'Booked', 'In Progress', 'Completed'];

// Helper to get the next calendar day string (YYYY-MM-DD)
function getNextDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TripHeader({ tripId, tripData, userRole, onTripUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(tripData.title || '');
  const [destination, setDestination] = useState(tripData.destination || '');
  const [startDate, setStartDate] = useState(tripData.startDate || '');
  const [endDate, setEndDate] = useState(tripData.endDate || '');
  const [status, setStatus] = useState(tripData.status || 'Planning');
  const [currency, setCurrency] = useState(tripData.currency || 'EUR');
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState(tripData.photoAlbumUrl || '');
  const currencySymbol = getCurrencySymbol(tripData.currency || 'EUR');
  const coverUrl = getTripCoverUrl(tripData.destination, true);

  // Handle start date change and auto-default end date to the next day
  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    
    // If end date is empty or now earlier than the new start date, default it to start date + 1 day
    if (!endDate || endDate < newStart) {
      setEndDate(getNextDay(newStart));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (startDate && endDate && endDate < startDate) {
      alert("The End Date cannot be earlier than the Start Date.");
      return;
    }

    try {
      const tripRef = doc(db, "trips", tripId);
      const updatedFields = { 
        title, 
        destination, 
        startDate, 
        endDate: endDate || startDate, 
        status, 
        currency, 
        photoAlbumUrl: photoAlbumUrl.trim() 
      };
      await updateDoc(tripRef, updatedFields);
      if (onTripUpdate) onTripUpdate(updatedFields);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating trip details:", error);
      alert("Failed to update trip details.");
    }
  };

  const unwrappedRole = typeof userRole === 'object' && userRole !== null ? userRole.role : userRole;
  const isOwner = String(unwrappedRole || '').trim().toLowerCase() === 'owner';

  return (
    <div className="space-y-6 mb-6 sm:mb-8">
      {/* Cover Image Banner */}
      <div className="relative h-48 sm:h-60 md:h-72 w-full rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100">
        <img 
          src={coverUrl} 
          alt={tripData.title} 
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 35%' }}
        />
      </div>

      {/* Details Section */}
      {!isEditing ? (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">{tripData.title}</h1>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                tripData.status === 'Booked' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                tripData.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                tripData.status === 'Completed' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {tripData.status || 'Planning'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-500 font-semibold">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-600" /> {tripData.destination}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-600" /> {tripData.startDate} to {tripData.endDate}</span>
              <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-purple-600" /> {tripData.currency || 'EUR'} ({currencySymbol})</span>
              {tripData.photoAlbumUrl && (
                <a 
                  href={tripData.photoAlbumUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-500 transition font-bold"
                >
                  <Camera className="w-4 h-4" /> Shared Album
                </a>
              )}
            </div>
          </div>

          <div className="flex w-full md:w-auto items-center gap-2 flex-wrap shrink-0">
            {isOwner && (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto justify-center flex items-center gap-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4" /> Edit Trip Details
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSave} className="w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-900 text-lg">Edit Trip Information</h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trip Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Destination</label>
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold cursor-pointer">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={handleStartDateChange} 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  min={startDate} 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold cursor-pointer">
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Google Photos Shared Album URL</label>
                <input 
                  type="url" 
                  placeholder="https://photos.app.goo.gl/..." 
                  value={photoAlbumUrl} 
                  onChange={(e) => setPhotoAlbumUrl(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold" 
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="submit" className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 sm:py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer border border-blue-500">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
