// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, Plus, Trash2, GripVertical, Settings, X, ChevronDown, ChevronUp, ExternalLink, FileText, Edit2, Save } from 'lucide-react';
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

// Helper function to generate all YYYY-MM-DD dates between a start and end date
function getTripDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return startDateStr ? [startDateStr] : [];
  
  const dates = [];
  const curr = new Date(startDateStr);
  const last = new Date(endDateStr);

  while (curr <= last) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export default function TripItinerary({ tripId, tripStartDate, tripEndDate }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  
  // Creation Form States
  const [title, setTitle] = useState('');
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedDate, setSelectedDate] = useState(tripStartDate || '');
  const [category, setCategory] = useState('Tour');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Autocomplete prediction states for Creation form
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const dropdownRef = useRef(null);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch itinerary items and custom categories from Firestore
  useEffect(() => {
    async function fetchData() {
      if (!tripId) return;
      try {
        const q = query(
          collection(db, "trips", tripId, "itinerary"),
          orderBy("date", "asc")
        );
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(document => ({
          id: document.id,
          ...document.data()
        }));
        setItineraryItems(items);

        const settingsDocRef = doc(db, "trips", tripId, "settings", "categories");
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists() && settingsSnap.data().list) {
          setCategories(settingsSnap.data().list);
        }
      } catch (error) {
        console.error("Error fetching itinerary or settings:", error);
      }
    }
    fetchData();
  }, [tripId]);

  // Initialize Google Maps AutocompleteService safely
  useEffect(() => {
    function initService() {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }
    }
    if (window.google && window.google.maps) {
      initService();
    } else {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          initService();
          clearInterval(checkInterval);
        }
      }, 300);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Close prediction dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPredictions(false);
      }
    }
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

    autocompleteServiceRef.current.getPlacePredictions(
      { input: value },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      }
    );
  };

  const handleSelectPrediction = (prediction) => {
    setLocation(prediction.description);
    setPredictions([]);
    setShowPredictions(false);
  };

  // Handle adding a new activity
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    if (!location.trim()) {
      alert("Please select or enter a location.");
      return;
    }

    setLoading(true);
    try {
      const formattedTime = `${selectedHour}:${selectedMinute}`;
      const newItem = {
        title,
        time: formattedTime,
        date: selectedDate,
        category,
        location: location.trim(),
        details: details.trim(),
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setLocation('');
      setDetails('');
      setSelectedHour('09');
      setSelectedMinute('00');
    } catch (error) {
      console.error("Error adding itinerary item:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting an itinerary item
  const handleDeleteItem = async (itemId, e) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "trips", tripId, "itinerary", itemId));
      setItineraryItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Start Editing an Item
  const handleStartEdit = (item, e) => {
    e.stopPropagation();
    setEditingCardId(item.id);
    setEditTitle(item.title);
    setEditDate(item.date || tripStartDate);
    const [h, m] = (item.time || '09:00').split(':');
    setEditHour(h || '09');
    setEditMinute(m || '00');
    setEditCategory(item.category || 'Tour');
    setEditLocation(item.location || '');
    setEditDetails(item.details || '');
  };

  // Save Edited Item to Firebase
  const handleSaveEdit = async (itemId, e) => {
    e.stopPropagation();
    if (!editTitle.trim() || !editDate) {
      alert("Title and Date cannot be empty.");
      return;
    }

    const updatedTime = `${editHour}:${editMinute}`;
    const updatedFields = {
      title: editTitle.trim(),
      date: editDate,
      time: updatedTime,
      category: editCategory,
      location: editLocation.trim(),
      details: editDetails.trim()
    };

    try {
      const itemRef = doc(db, "trips", tripId, "itinerary", itemId);
      await updateDoc(itemRef, updatedFields);

      setItineraryItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updatedFields } : item));
      setEditingCardId(null);
    } catch (error) {
      console.error("Error updating itinerary item:", error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const formattedName = newCategoryName.trim();
    if (categories.includes(formattedName)) {
      alert("This category already exists.");
      return;
    }

    const updatedCategories = [...categories, formattedName];
    setCategories(updatedCategories);
    setNewCategoryName('');

    try {
      const settingsDocRef = doc(db, "trips", tripId, "settings", "categories");
      await setDoc(settingsDocRef, { list: updatedCategories });
    } catch (error) {
      console.error("Error saving categories to Firestore:", error);
    }
  };

  const handleDeleteCategory = async (catToDelete) => {
    if (categories.length <= 1) {
      alert("You must have at least one activity type.");
      return;
    }

    const updatedCategories = categories.filter(c => c !== catToDelete);
    setCategories(updatedCategories);
    if (category === catToDelete) {
      setCategory(updatedCategories[0]);
    }

    try {
      const settingsDocRef = doc(db, "trips", tripId, "settings", "categories");
      await setDoc(settingsDocRef, { list: updatedCategories });
    } catch (error) {
      console.error("Error updating categories in Firestore:", error);
    }
  };

  // Handle Drag and Drop End
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newDate = destination.droppableId;
    const itemToUpdate = itineraryItems.find(item => item.id === draggableId);
    if (!itemToUpdate) return;

    const updatedItems = itineraryItems.map(item => {
      if (item.id === draggableId) {
        return { ...item, date: newDate };
      }
      return item;
    });

    setItineraryItems(updatedItems);

    try {
      const itemRef = doc(db, "trips", tripId, "itinerary", draggableId);
      await updateDoc(itemRef, { date: newDate });
    } catch (error) {
      console.error("Error updating activity date via drag and drop:", error);
    }
  };

  // Generate all scheduled days or fall back to dates with items if trip dates aren't set
  const allTripDates = getTripDateRange(tripStartDate, tripEndDate);
  
  // Ensure any items with dates outside the formal trip range are still displayed
  const itemDates = itineraryItems.map(item => item.date).filter(Boolean);
  const combinedDatesSet = new Set([...allTripDates, ...itemDates]);
  const sortedDates = Array.from(combinedDatesSet).sort();

  // Group items by date
  const groupedItems = itineraryItems.reduce((groups, item) => {
    const dateKey = item.date || tripStartDate;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {});

  Object.keys(groupedItems).forEach(date => {
    groupedItems[date].sort((a, b) => a.time.localeCompare(b.time));
  });

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-900">Trip Itinerary</h3>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
        >
          <Settings className="w-4 h-4" /> Manage Activity Types
        </button>
      </div>

      {/* Rich Activity Creation Form */}
      <form onSubmit={handleAddItem} className="bg-slate-50 p-6 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end border border-slate-100">
        
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

        <div className="md:col-span-1 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Time</label>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-2 text-sm text-slate-900 focus-within:border-blue-500">
            <Clock className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <select 
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              className="bg-transparent focus:outline-none font-medium cursor-pointer py-1"
            >
              {hours.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-slate-400 font-bold">:</span>
            <select 
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(e.target.value)}
              className="bg-transparent focus:outline-none font-medium cursor-pointer py-1"
            >
              {minutes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="md:col-span-1 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Location Input with Predictions Dropdown */}
        <div className="md:col-span-2 lg:col-span-2 relative" ref={dropdownRef}>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location / Venue</label>
          <div className="relative flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500">
            <MapPin className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search location..." 
              value={location}
              onChange={handleLocationChange}
              onFocus={() => {
                if (predictions.length > 0) setShowPredictions(true);
              }}
              required
              className="w-full bg-white border-0 pl-10 pr-4 py-3 text-sm text-slate-900 focus:outline-none"
            />
          </div>

          {showPredictions && predictions.length > 0 && (
            <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
              {predictions.map((prediction) => (
                <li
                  key={prediction.place_id}
                  onClick={() => handleSelectPrediction(prediction)}
                  className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span className="truncate">{prediction.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-3 lg:col-span-5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Activity Details & Notes (Optional)</label>
          <textarea 
            placeholder="Add booking reference numbers, website links, or itinerary notes..." 
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="md:col-span-3 lg:col-span-1 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Adding...' : 'Add Activity'}
          </button>
        </div>
      </form>

      {/* Drag and Drop Itinerary Feed (Pre-rendered for all trip dates) */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No dates available for this trip.</p>
            </div>
          ) : (
            sortedDates.map((dateStr) => {
              const items = groupedItems[dateStr] || [];
              const formattedDateHeading = new Date(dateStr).toLocaleDateString('en-IE', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div key={dateStr} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                  <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{formattedDateHeading}</h4>
                    </div>
                    {items.length === 0 && (
                      <span className="text-[11px] font-medium text-slate-400 italic">No activities planned</span>
                    )}
                  </div>

                  <Droppable droppableId={dateStr}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className={`p-3 space-y-3 min-h-[75px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-300 rounded-b-2xl' : ''}`}
                      >
                        {items.length === 0 ? (
                          <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                            Drop activities here
                          </div>
                        ) : (
                          items.map((item, index) => {
                            const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
                            const isExpanded = expandedCardId === item.id;
                            const isEditing = editingCardId === item.id;
                            const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`;

                            return (
                              <Draggable key={item.id} draggableId={item.id} index={index}>
                                {(provided, snapshot) => (
                                  <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={provided.draggableProps.style}
                                    onClick={() => {
                                      if (!isEditing) setExpandedCardId(isExpanded ? null : item.id);
                                    }}
                                    className={`bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden ${snapshot.isDragging ? 'ring-2 ring-blue-500 shadow-xl bg-blue-50/20' : ''}`}
                                  >
                                    {/* Main Card Header Row */}
                                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                      <div className="flex items-start sm:items-center gap-3">
                                        <div 
                                          {...provided.dragHandleProps} 
                                          onClick={(e) => e.stopPropagation()} 
                                          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>

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

                                      <div className="flex items-center gap-2 self-end sm:self-center">
                                        {!isEditing && (
                                          <button 
                                            onClick={(e) => handleStartEdit(item, e)}
                                            className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition"
                                            title="Edit activity"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button 
                                          onClick={(e) => handleDeleteItem(item.id, e)}
                                          className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition"
                                          title="Delete activity"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="text-slate-400 p-1">
                                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expandable Section: View Mode vs Edit Mode */}
                                    {isExpanded && (
                                      <div 
                                        onClick={(e) => e.stopPropagation()} 
                                        className="bg-slate-50 border-t border-slate-100 p-5"
                                      >
                                        {isEditing ? (
                                          /* EDIT MODE FORM */
                                          <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                              <h6 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Activity</h6>
                                              <button 
                                                onClick={() => setEditingCardId(null)}
                                                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                                              >
                                                Cancel
                                              </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                              <div className="md:col-span-2">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label>
                                                <input 
                                                  type="text" 
                                                  value={editTitle}
                                                  onChange={(e) => setEditTitle(e.target.value)}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                                                />
                                              </div>

                                              <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date</label>
                                                <input 
                                                  type="date" 
                                                  min={tripStartDate}
                                                  max={tripEndDate}
                                                  value={editDate}
                                                  onChange={(e) => setEditDate(e.target.value)}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                                                />
                                              </div>

                                              <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Time</label>
                                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm text-slate-900">
                                                  <select value={editHour} onChange={(e) => setEditHour(e.target.value)} className="bg-transparent focus:outline-none font-medium">
                                                    {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                                  </select>
                                                  <span>:</span>
                                                  <select value={editMinute} onChange={(e) => setEditMinute(e.target.value)} className="bg-transparent focus:outline-none font-medium">
                                                    {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                                                  </select>
                                                </div>
                                              </div>

                                              <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Type</label>
                                                <select 
                                                  value={editCategory}
                                                  onChange={(e) => setEditCategory(e.target.value)}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                                                >
                                                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>
                                              </div>

                                              <div className="md:col-span-2">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Location</label>
                                                <input 
                                                  type="text" 
                                                  value={editLocation}
                                                  onChange={(e) => setEditLocation(e.target.value)}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                                                />
                                              </div>

                                              <div className="md:col-span-3">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Details & Notes</label>
                                                <textarea 
                                                  value={editDetails}
                                                  onChange={(e) => setEditDetails(e.target.value)}
                                                  rows={2}
                                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                                                />
                                              </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                              <button 
                                                onClick={(e) => handleSaveEdit(item.id, e)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                                              >
                                                <Save className="w-3.5 h-3.5" /> Save Changes
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          /* VIEW MODE (Side-by-Side Grid) */
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Left Column: Long Description / Details */}
                                            <div className="md:col-span-2 space-y-2">
                                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                                Activity Details & Notes
                                              </div>
                                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                                                {item.details && item.details.trim() ? item.details : "No additional notes or description provided for this activity."}
                                              </p>
                                            </div>

                                            {/* Right Column: Clickable Map Link Card */}
                                            <div className="space-y-2 flex flex-col">
                                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <MapPin className="w-3.5 h-3.5 text-teal-500" />
                                                Location & Map
                                              </div>
                                              <a 
                                                href={mapsSearchUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-grow bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-200 rounded-xl p-4 transition flex flex-col justify-between group shadow-sm"
                                              >
                                                <div>
                                                  <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 mb-1 line-clamp-2">
                                                    {item.location}
                                                  </p>
                                                  <p className="text-[11px] text-slate-400">Click to open directions and venue details</p>
                                                </div>
                                                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:underline">
                                                  <span>Open in Google Maps</span>
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </div>
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
            })
          )}
        </div>
      </DragDropContext>

      {/* Manage Activity Types Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full">
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Manage Activity Types</h2>
            <p className="text-sm text-slate-500 mb-6">Add or remove custom categories for your trip itineraries.</p>
            
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="e.g., Flight, Hiking, Show" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
                className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition shadow-sm">
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {categories.map((cat) => (
                <div key={cat} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-800 text-sm">{cat}</span>
                  <button 
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}