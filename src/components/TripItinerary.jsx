// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, Plus, Trash2, GripVertical, Settings, X, ChevronDown, ChevronUp, ExternalLink, FileText, Edit2, Save, DollarSign } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const DEFAULT_CATEGORIES = ['Tour', 'Meal', 'Museum', 'Transport', 'Accommodation', 'Other'];

const CATEGORY_COLORS = {
  Tour: 'bg-purple-50 text-purple-700 border-purple-100',
  Meal: 'bg-amber-50 text-amber-700 border-amber-100',
  Museum: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Transport: 'bg-blue-50 text-blue-700 border-blue-100',
  Accommodation: 'bg-rose-50 text-rose-700 border-rose-100',
  Flight: 'bg-sky-50 text-sky-700 border-sky-100',
  Hiking: 'bg-green-50 text-green-700 border-green-100',
  Other: 'bg-slate-100 text-slate-700 border-slate-200'
};

function normalizeDate(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput.toDate === 'function') dateInput = dateInput.toDate();
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`;
  }
  if (typeof dateInput === 'string') return dateInput.split('T')[0];
  return null;
}

function getTripDateRange(startDateStr, endDateStr) {
  const normStart = normalizeDate(startDateStr);
  const normEnd = normalizeDate(endDateStr) || normStart;
  if (!normStart) return [];
  if (!normEnd) return [normStart];

  const [sY, sM, sD] = normStart.split('-').map(Number);
  const [eY, eM, eD] = normEnd.split('-').map(Number);
  const curr = new Date(sY, sM - 1, sD);
  const last = new Date(eY, eM - 1, eD);

  if (isNaN(curr.getTime()) || isNaN(last.getTime())) return [normStart];

  const dates = [];
  while (curr <= last) {
    dates.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export default function TripItinerary({ tripId, tripStartDate, tripEndDate, currency = 'EUR' }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  
  // Creation Form States
  const [title, setTitle] = useState('');
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedDate, setSelectedDate] = useState('');
  const [category, setCategory] = useState('Tour');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);

  // Effective Dates
  const effectiveStartDate = normalizeDate(tripStartDate) || new Date().toISOString().split('T')[0];
  const effectiveEndDate = normalizeDate(tripEndDate) || effectiveStartDate;

  useEffect(() => {
    if (effectiveStartDate && !selectedDate) setSelectedDate(effectiveStartDate);
  }, [effectiveStartDate, selectedDate]);

  // Expanded card & Editing States
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('09');
  const [editMinute, setEditMinute] = useState('00');
  const [editCategory, setEditCategory] = useState('Tour');
  const [editLocation, setEditLocation] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editCost, setEditCost] = useState('');

  // Autocomplete states
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const dropdownRef = useRef(null);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch Firestore Data
  useEffect(() => {
    async function fetchData() {
      if (!tripId) return;
      try {
        const q = query(collection(db, "trips", tripId, "itinerary"), orderBy("date", "asc"));
        const snap = await getDocs(q);
        setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));

        const settingsSnap = await getDoc(doc(db, "trips", tripId, "settings", "categories"));
        if (settingsSnap.exists() && settingsSnap.data().list) {
          setCategories(settingsSnap.data().list);
        }
      } catch (err) {
        console.error("Error fetching itinerary:", err);
      }
    }
    fetchData();
  }, [tripId]);

  // Google Places Service Init
  useEffect(() => {
    function initService() {
      if (window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
    }
    if (window.google?.maps) initService();
    else {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) {
          initService();
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowPredictions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setLocation(value);
    if (!value.trim() || !autocompleteServiceRef.current) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions({ input: value }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        setPredictions(results);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        setShowPredictions(false);
      }
    });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate || !location.trim()) return;

    setLoading(true);
    try {
      const newItem = {
        title,
        time: `${selectedHour}:${selectedMinute}`,
        date: selectedDate,
        category,
        location: location.trim(),
        details: details.trim(),
        cost: cost ? parseFloat(cost) : 0,
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setLocation('');
      setDetails('');
      setCost('');
      setSelectedHour('09');
      setSelectedMinute('00');
    } catch (err) {
      console.error("Error adding item:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId, e) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "trips", tripId, "itinerary", itemId));
      setItineraryItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleStartEdit = (item, e) => {
    e.stopPropagation();
    setEditingCardId(item.id);
    setEditTitle(item.title);
    setEditDate(item.date || effectiveStartDate);
    const [h, m] = (item.time || '09:00').split(':');
    setEditHour(h || '09');
    setEditMinute(m || '00');
    setEditCategory(item.category || 'Tour');
    setEditLocation(item.location || '');
    setEditDetails(item.details || '');
    setEditCost(item.cost ? item.cost.toString() : '');
  };

  const handleSaveEdit = async (itemId, e) => {
    e.stopPropagation();
    if (!editTitle.trim() || !editDate) return;

    const updatedFields = {
      title: editTitle.trim(),
      date: editDate,
      time: `${editHour}:${editMinute}`,
      category: editCategory,
      location: editLocation.trim(),
      details: editDetails.trim(),
      cost: editCost ? parseFloat(editCost) : 0
    };

    try {
      await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), updatedFields);
      setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updatedFields } : i));
      setEditingCardId(null);
    } catch (err) {
      console.error("Error saving edit:", err);
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

    const newDate = destination.droppableId;
    setItineraryItems(prev => prev.map(i => i.id === draggableId ? { ...i, date: newDate } : i));

    try {
      await updateDoc(doc(db, "trips", tripId, "itinerary", draggableId), { date: newDate });
    } catch (err) {
      console.error("Error dragging item:", err);
    }
  };

  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));
  const sortedDates = getTripDateRange(effectiveStartDate, effectiveEndDate);
  
  const groupedItems = itineraryItems.reduce((groups, item) => {
    const dateKey = item.date || effectiveStartDate;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {});

  Object.keys(groupedItems).forEach(d => groupedItems[d].sort((a, b) => a.time.localeCompare(b.time)));

  // Calculate Grand Total Cost
  const grandTotalCost = itineraryItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Trip Itinerary</h3>
          <p className="text-xs text-slate-500 mt-0.5">Estimated Total Budget: <span className="font-bold text-slate-800">{currency} {grandTotalCost.toFixed(2)}</span></p>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
        >
          <Settings className="w-4 h-4" /> Manage Activity Types
        </button>
      </div>

      {/* Creation Form */}
      <form onSubmit={handleAddItem} className="bg-slate-50 p-6 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end border border-slate-100">
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
            <DollarSign className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={cost} 
              onChange={(e) => setCost(e.target.value)}
              className="w-full bg-white border-0 pl-9 pr-3 py-3 text-sm text-slate-900 focus:outline-none"
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
              onFocus={() => { if (predictions.length > 0) setShowPredictions(true); }}
              required
              className="w-full bg-white border-0 pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none"
            />
          </div>
          {showPredictions && predictions.length > 0 && (
            <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
              {predictions.map(p => (
                <li key={p.place_id} onClick={() => { setLocation(p.description); setPredictions([]); setShowPredictions(false); }} className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex items-center gap-2">
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

      {/* Itinerary Feed with Daily Totals */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {sortedDates.map(dateStr => {
            const items = groupedItems[dateStr] || [];
            const dayTotal = items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
            const formattedDateHeading = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

            return (
              <div key={dateStr} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{formattedDateHeading}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    {dayTotal > 0 && <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">Day Total: {currency} {dayTotal.toFixed(2)}</span>}
                    {items.length === 0 && <span className="text-[11px] font-medium text-slate-400 italic">No activities planned</span>}
                  </div>
                </div>

                <Droppable droppableId={dateStr}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`p-3 space-y-3 min-h-[75px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-300 rounded-b-2xl' : ''}`}>
                      {items.length === 0 ? (
                        <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">Drop activities here</div>
                      ) : (
                        items.map((item, index) => {
                          const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
                          const isExpanded = expandedCardId === item.id;
                          const isEditing = editingCardId === item.id;
                          const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`;

                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} style={provided.draggableProps.style} onClick={() => { if (!isEditing) setExpandedCardId(isExpanded ? null : item.id); }} className={`bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden ${snapshot.isDragging ? 'ring-2 ring-blue-500 shadow-xl bg-blue-50/20' : ''}`}>
                                  <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-start sm:items-center gap-3">
                                      <div {...provided.dragHandleProps} onClick={(e) => e.stopPropagation()} className="text-slate-300 hover:text-slate-500 cursor-grab p-1"><GripVertical className="w-4 h-4" /></div>
                                      <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"><Clock className="w-3.5 h-3.5 text-blue-600" />{item.time}</div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <h5 className="font-semibold text-slate-900 text-base">{item.title}</h5>
                                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}>{item.category || 'Other'}</span>
                                          {Number(item.cost) > 0 && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{currency} {Number(item.cost).toFixed(2)}</span>}
                                        </div>
                                        {item.location && <div className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" /><span>{item.location}</span></div>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                      {!isEditing && <button onClick={(e) => handleStartEdit(item, e)} className="text-slate-400 hover:text-blue-600 p-2 transition" title="Edit"><Edit2 className="w-4 h-4" /></button>}
                                      <button onClick={(e) => handleDeleteItem(item.id, e)} className="text-slate-400 hover:text-red-500 p-2 transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                      <div className="text-slate-400 p-1">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 border-t border-slate-100 p-5">
                                      {isEditing ? (
                                        <div className="space-y-4">
                                          <div className="flex justify-between items-center mb-2">
                                            <h6 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Activity</h6>
                                            <button onClick={() => setEditingCardId(null)} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Cancel</button>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-2"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" min={effectiveStartDate} max={effectiveEndDate} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Time</label><div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm"><select value={editHour} onChange={(e) => setEditHour(e.target.value)} className="bg-transparent focus:outline-none">{hours.h?.map ? '' : hours.map(h => <option key={h} value={h}>{h}</option>)}</select><span>:</span><select value={editMinute} onChange={(e) => setEditMinute(e.target.value)} className="bg-transparent focus:outline-none">{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div>
                                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Type</label><select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">{sortedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                                            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cost ({currency})</label><input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                                            <div className="md:col-span-3"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Location</label><input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                                            <div className="md:col-span-3"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Details & Notes</label><textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" /></div>
                                          </div>
                                          <div className="flex justify-end pt-2"><button onClick={(e) => handleSaveEdit(item.id, e)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"><Save className="w-3.5 h-3.5" /> Save Changes</button></div>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                          <div className="md:col-span-2 space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider"><FileText className="w-3.5 h-3.5 text-blue-600" />Activity Details & Notes</div>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">{item.details?.trim() ? item.details : "No additional notes provided."}</p>
                                          </div>
                                          <div className="space-y-2 flex flex-col">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider"><MapPin className="w-3.5 h-3.5 text-teal-500" />Location & Map</div>
                                            <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" className="flex-grow bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-200 rounded-xl p-4 transition flex flex-col justify-between group shadow-sm">
                                              <div><p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 mb-1 line-clamp-2">{item.location}</p><p className="text-[11px] text-slate-400">Click to open directions</p></div>
                                              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:underline"><span>Open in Google Maps</span><ExternalLink className="w-3.5 h-3.5" /></div>
                                            </a>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Manage Activity Types Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"><X className="w-4 h-4" /></button>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Manage Activity Types</h2>
            <p className="text-sm text-slate-500 mb-6">Add or remove custom categories.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCategoryName.trim() || categories.includes(newCategoryName.trim())) return;
              const updated = [...categories, newCategoryName.trim()];
              setCategories(updated);
              setNewCategoryName('');
              await setDoc(doc(db, "trips", tripId, "settings", "categories"), { list: updated });
            }} className="flex gap-2 mb-6">
              <input type="text" placeholder="e.g., Flight, Hiking" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none" />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl text-sm">Add</button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {sortedCategories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-800 text-sm">{cat}</span>
                  <button onClick={async () => {
                    if (categories.length <= 1) return alert("Must have at least one category.");
                    const updated = categories.filter(c => c !== cat);
                    setCategories(updated);
                    await setDoc(doc(db, "trips", tripId, "settings", "categories"), { list: updated });
                  }} className="text-slate-400 hover:text-red-500 p-1.5 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}