// src/components/TripHeader.jsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Calendar, MapPin, Edit3, Save, X, Tag, Users } from 'lucide-react';

const STATUS_OPTIONS = ['Planning', 'Booked', 'In Progress', 'Completed'];

export default function TripHeader({ tripId, tripData, userRole, onOpenMembersModal }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(tripData.title || '');
  const [destination, setDestination] = useState(tripData.destination || '');
  const [startDate, setStartDate] = useState(tripData.startDate || '');
  const [endDate, setEndDate] = useState(tripData.endDate || '');
  const [status, setStatus] = useState(tripData.status || 'Planning');
  const [currency, setCurrency] = useState(tripData.currency || 'EUR');

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const tripRef = doc(db, "trips", tripId);
      await updateDoc(tripRef, {
        title,
        destination,
        startDate,
        endDate,
        status,
        currency
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating trip details:", error);
    }
  };

  const isOwner = userRole === 'Owner';

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
      {!isEditing ? (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{tripData.title}</h1>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                tripData.status === 'Booked' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                tripData.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                tripData.status === 'Completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {tripData.status || 'Planning'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-500" /> {tripData.destination}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-500" /> {tripData.startDate} to {tripData.endDate}</span>
              <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-purple-500" /> Currency: {tripData.currency || 'EUR'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Manage Travelers Button */}
            <button 
              onClick={onOpenMembersModal}
              className="flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition"
            >
              <Users className="w-4 h-4" /> Manage Travelers
            </button>

            {isOwner && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition"
              >
                <Edit3 className="w-4 h-4" /> Edit Trip Details
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-900 text-lg">Edit Trip Information</h3>
            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trip Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Destination</label>
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}