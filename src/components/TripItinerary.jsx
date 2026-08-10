// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Settings } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

import ItineraryForm from './ItineraryForm';
import ItineraryCard from './ItineraryCard';
import CategoryModal from './CategoryModal';

const DEFAULT_CATEGORIES = ['Tour', 'Meal', 'Museum', 'Transport', 'Accommodation', 'Other'];

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

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const handleSelectPrediction = (prediction) => {
    setLocation(prediction.description);
    setPredictions([]);
    setShowPredictions(false);
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

      {/* Creation Form Sub-component */}
      <ItineraryForm 
        title={title} setTitle={setTitle}
        selectedDate={selectedDate} setSelectedDate={setSelectedDate}
        effectiveStartDate={effectiveStartDate} effectiveEndDate={effectiveEndDate}
        selectedHour={selectedHour} setSelectedHour={setSelectedHour}
        selectedMinute={selectedMinute} setSelectedMinute={setSelectedMinute}
        category={category} setCategory={setCategory} sortedCategories={sortedCategories}
        cost={cost} setCost={setCost} currency={currency}
        location={location} setLocation={setLocation} handleLocationChange={handleLocationChange}
        showPredictions={showPredictions} predictions={predictions} handleSelectPrediction={handleSelectPrediction}
        details={details} setDetails={setDetails}
        loading={loading} dropdownRef={dropdownRef}
      />

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
                        items.map((item, index) => (
                          <ItineraryCard 
                            key={item.id}
                            item={item} index={index} currency={currency}
                            isExpanded={expandedCardId === item.id}
                            onToggleExpand={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                            isEditing={editingCardId === item.id}
                            onStartEdit={(e) => handleStartEdit(item, e)}
                            onSaveEdit={(e) => handleSaveEdit(item.id, e)}
                            onCancelEdit={() => setEditingCardId(null)}
                            onDelete={(e) => handleDeleteItem(item.id, e)}
                            editTitle={editTitle} setEditTitle={setEditTitle}
                            editDate={editDate} setEditDate={setEditDate} 
                            effectiveStartDate={effectiveStartDate} effectiveEndDate={effectiveEndDate}
                            editHour={editHour} setEditHour={setEditHour} 
                            editMinute={editMinute} setEditMinute={setEditMinute} 
                            hours={hours} minutes={minutes}
                            editCategory={editCategory} setEditCategory={setEditCategory} sortedCategories={sortedCategories}
                            editCost={editCost} setEditCost={setEditCost}
                            editLocation={editLocation} setEditLocation={setEditLocation}
                            editDetails={editDetails} setEditDetails={setEditDetails}
                          />
                        ))
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

      {/* Category Management Modal */}
      <CategoryModal 
        tripId={tripId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        categories={categories}
        setCategories={setCategories}
        sortedCategories={sortedCategories}
      />
    </div>
  );
}