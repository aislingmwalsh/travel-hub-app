// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Calendar, Settings, Inbox, Building2, Trash2, Edit2 } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

import ItineraryForm from './ItineraryForm';
import ItineraryCard from './ItineraryCard';
import DailyMapView from './DailyMapView';

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

export default function TripItinerary({ tripId, tripStartDate, tripEndDate, currency = 'EUR', userRole = 'Guest', tripDestination }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  
  // Creation Form States & Collapse Toggle
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [isFlexibleTime, setIsFlexibleTime] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [endDate, setEndDate] = useState(''); 
  const [category, setCategory] = useState('Tour');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [paidInAdvance, setPaidInAdvance] = useState(false);
  const [loading, setLoading] = useState(false);

  // Collapsed Days & Unscheduled Pool Toggles
  const [collapsedDays, setCollapsedDays] = useState({});
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(true);

  const toggleDayCollapse = (dateStr) => {
    setCollapsedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const safeRole = typeof userRole === 'object' ? userRole?.role : userRole;
  const isGuest = String(safeRole || '').toLowerCase() === 'guest';

  const effectiveStartDate = normalizeDate(tripStartDate) || new Date().toISOString().split('T')[0];
  const effectiveEndDate = normalizeDate(tripEndDate) || effectiveStartDate;

  const [expandedCardId, setExpandedCardId] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editHour, setEditHour] = useState('09');
  const [editMinute, setEditMinute] = useState('00');
  const [editIsFlexible, setEditIsFlexible] = useState(false);
  const [editCategory, setEditCategory] = useState('Tour');
  const [editLocation, setEditLocation] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editCost, setEditCost] = useState('');

  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      if (!tripId) return;
      try {
        const q = query(collection(db, "trips", tripId, "itinerary"), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch universal global categories
        const settingsSnap = await getDoc(doc(db, "settings", "global_categories"));
        if (settingsSnap.exists() && settingsSnap.data().list) {
          setCategories(settingsSnap.data().list);
        }
      } catch (err) {
        console.error("Error fetching itinerary:", err);
      }
    }
    fetchData();
  }, [tripId]);

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
    if (isGuest) return;
    if (!title.trim() || !location.trim()) return;

    setLoading(true);
    try {
      const newItem = {
        title,
        time: isFlexibleTime ? 'Flexible' : `${selectedHour}:${selectedMinute}`,
        date: selectedDate ? selectedDate : null,
        endDate: category === 'Accommodation' && endDate ? endDate : (category === 'Accommodation' ? selectedDate : null),
        category,
        location: location.trim(),
        details: details.trim(),
        cost: cost ? parseFloat(cost) : 0,
        paidInAdvance: Boolean(paidInAdvance),
        highlighted: false,
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setLocation('');
      setDetails('');
      setCost('');
      setPaidInAdvance(false);
      setSelectedDate('');
      setEndDate('');
      setIsFlexibleTime(false);
      setSelectedHour('09');
      setSelectedMinute('00');
    } catch (err) {
      console.error("Error adding item:", err);
      alert("Failed to save activity. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId, e) => {
    if (e) e.stopPropagation();
    if (isGuest) return;
    try {
      await deleteDoc(doc(db, "trips", tripId, "itinerary", itemId));
      setItineraryItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleStartEdit = (item, e) => {
    if (e) e.stopPropagation();
    if (isGuest) return;
    setEditingCardId(item.id);
    setExpandedCardId(item.id);
    setEditTitle(item.title);
    setEditDate(item.date || '');
    setEditEndDate(item.endDate || item.date || '');
    if (item.time === 'Flexible') {
      setEditIsFlexible(true);
      setEditHour('09');
      setEditMinute('00');
    } else {
      setEditIsFlexible(false);
      const [h, m] = (item.time || '09:00').split(':');
      setEditHour(h || '09');
      setEditMinute(m || '00');
    }
    setEditCategory(item.category || 'Tour');
    setEditLocation(item.location || '');
    setEditDetails(item.details || '');
    setEditCost(item.cost ? item.cost.toString() : '');
  };

  const handleSaveEdit = async (itemId, e) => {
    if (e) e.stopPropagation();
    if (isGuest) return;
    if (!editTitle.trim()) return;

    const itemToUpdate = itineraryItems.find(i => i.id === itemId);
    const updatedFields = {
      title: editTitle.trim(),
      date: editDate ? editDate : null,
      endDate: editCategory === 'Accommodation' && editEndDate ? editEndDate : (editCategory === 'Accommodation' ? editDate : null),
      time: editIsFlexible ? 'Flexible' : `${editHour}:${editMinute}`,
      category: editCategory,
      location: editLocation.trim(),
      details: editDetails.trim(),
      cost: editCost ? parseFloat(editCost) : 0,
      paidInAdvance: Boolean(itemToUpdate?.paidInAdvance)
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
    if (isGuest) return;
    const { destination, source, draggableId } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

    const newDate = destination.droppableId === 'unscheduled' ? null : destination.droppableId;
    
    setItineraryItems(prev => prev.map(i => i.id === draggableId ? { ...i, date: newDate } : i));

    try {
      const itemRef = doc(db, "trips", tripId, "itinerary", draggableId);
      await updateDoc(itemRef, { date: newDate });
    } catch (err) {
      console.error("Error updating item date in Firestore:", err);
      alert("Failed to save schedule change.");
      const snap = await getDocs(query(collection(db, "trips", tripId, "itinerary"), orderBy("createdAt", "asc")));
      setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));
  const sortedDates = getTripDateRange(effectiveStartDate, effectiveEndDate);
  
  const unscheduledItems = itineraryItems.filter(i => !i.date || !sortedDates.includes(i.date));
  
  const groupedItems = itineraryItems.reduce((groups, item) => {
    if (item.date && sortedDates.includes(item.date) && item.category !== 'Accommodation') {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return groups;
  }, {});

  Object.keys(groupedItems).forEach(d => {
    groupedItems[d].sort((a, b) => {
      if (a.highlighted && !b.highlighted) return -1;
      if (!a.highlighted && b.highlighted) return 1;
      if (a.time === 'Flexible' && b.time !== 'Flexible') return -1;
      if (a.time !== 'Flexible' && b.time === 'Flexible') return 1;
      return a.time.localeCompare(b.time);
    });
  });

  const grandTotalCost = itineraryItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const handleTogglePaidInAdvance = async (itemId, nextValue) => {
    const itemToUpdate = itineraryItems.find(i => i.id === itemId);
    if (!itemToUpdate) return;

    try {
      await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), { paidInAdvance: nextValue });
      setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, paidInAdvance: nextValue } : i));
    } catch (err) {
      console.error("Error updating paid-in-advance flag:", err);
      alert("Failed to update payment status.");
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Trip Itinerary</h3>
          <p className="text-xs text-slate-500 mt-0.5">Estimated Trip Budget: <span className="font-bold text-slate-800">{currency} {grandTotalCost.toFixed(2)}</span></p>
        </div>
        <div className="flex items-center gap-3">
          {!isGuest && (
            <button 
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <span>{isAddFormOpen ? 'Close Add Form' : 'Add Activity'}</span>
            </button>
          )}
        </div>
      </div>

      {!isGuest && isAddFormOpen && (
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-fadeIn space-y-4">
          <ItineraryForm 
            title={title} setTitle={setTitle}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            effectiveStartDate={effectiveStartDate} effectiveEndDate={effectiveEndDate}
            selectedHour={selectedHour} setSelectedHour={setSelectedHour}
            selectedMinute={selectedMinute} setSelectedMinute={setSelectedMinute}
            isFlexibleTime={isFlexibleTime} setIsFlexibleTime={setIsFlexibleTime}
            category={category} setCategory={setCategory} sortedCategories={sortedCategories}
            cost={cost} setCost={setCost} currency={currency}
            location={location} setLocation={setLocation} handleLocationChange={handleLocationChange}
            showPredictions={showPredictions} predictions={predictions} handleSelectPrediction={handleSelectPrediction}
            details={details} setDetails={setDetails}
            paidInAdvance={paidInAdvance} setPaidInAdvance={setPaidInAdvance}
            loading={loading} dropdownRef={dropdownRef}
            onAddItem={handleAddItem}
          />
          {category === 'Accommodation' && (
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Check-out Date (Optional Multi-day stay)</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                min={selectedDate || effectiveStartDate} 
                max={effectiveEndDate}
                className="w-full md:w-1/2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
              />
            </div>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          
          {/* 📦 UNSCHEDULED ACTIVITIES POOL */}
          <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-indigo-50/20">
            <div 
              onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
              className="bg-indigo-50 hover:bg-indigo-100/60 px-5 py-3.5 border-b border-indigo-100 flex items-center justify-between cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wider">Unscheduled Ideas Pool</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200">
                  {unscheduledItems.length} {unscheduledItems.length === 1 ? 'Idea' : 'Ideas'}
                </span>
              </div>
            </div>

            {isUnscheduledOpen && (
              <div className="p-4">
                <Droppable droppableId="unscheduled" isDropDisabled={isGuest}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.droppableProps} 
                      className={`space-y-3 min-h-[70px] transition-colors rounded-xl p-1 ${snapshot.isDraggingOver ? 'bg-indigo-100/50 ring-2 ring-inset ring-indigo-300' : ''}`}
                    >
                      {unscheduledItems.length === 0 ? (
                        <div className="h-16 flex items-center justify-center border border-dashed border-indigo-200 rounded-xl text-xs text-indigo-400 italic">
                          Drop activities here to keep them unscheduled, or select no date when adding.
                        </div>
                      ) : (
                        unscheduledItems.map((item, index) => {
                          if (item.category === 'Accommodation') {
                            const isEditingThisHotel = editingCardId === item.id;
                            if (isEditingThisHotel) {
                              return (
                                <div key={item.id} className="bg-amber-50 border border-amber-300 p-4 rounded-2xl shadow-sm space-y-3">
                                  <h6 className="font-bold text-amber-950 text-xs uppercase tracking-wider">Edit Accommodation</h6>
                                  <div className="space-y-2">
                                    <input 
                                      type="text" 
                                      value={editTitle} 
                                      onChange={(e) => setEditTitle(e.target.value)} 
                                      placeholder="Hotel Name" 
                                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs" 
                                    />
                                    <input 
                                      type="text" 
                                      value={editLocation} 
                                      onChange={(e) => setEditLocation(e.target.value)} 
                                      placeholder="Location / Address" 
                                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs" 
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-amber-800 uppercase">Check-in</label>
                                        <input 
                                          type="date" 
                                          value={editDate} 
                                          onChange={(e) => setEditDate(e.target.value)} 
                                          min={effectiveStartDate} 
                                          max={effectiveEndDate} 
                                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs" 
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-amber-800 uppercase">Check-out</label>
                                        <input 
                                          type="date" 
                                          value={editEndDate} 
                                          onChange={(e) => setEditEndDate(e.target.value)} 
                                          min={editDate || effectiveStartDate} 
                                          max={effectiveEndDate} 
                                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs" 
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <input 
                                        type="number" 
                                        value={editCost} 
                                        onChange={(e) => setEditCost(e.target.value)} 
                                        placeholder="Total Cost" 
                                        className="w-1/2 bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs" 
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button onClick={() => setEditingCardId(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer">Cancel</button>
                                    <button onClick={(e) => handleSaveEdit(item.id, e)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer">Save Changes</button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={item.id} className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0"><Building2 className="w-4 h-4" /></div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">Accommodation</span>
                                      <h5 className="font-bold text-amber-950 text-sm">{item.title}</h5>
                                    </div>
                                    {item.location && <p className="text-xs text-amber-800 mt-0.5">{item.location}</p>}
                                  </div>
                                </div>
                                {!isGuest && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={(e) => handleStartEdit(item, e)} className="p-1.5 text-slate-400 hover:text-blue-600 transition cursor-pointer" title="Edit Hotel"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={(e) => handleDeleteItem(item.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete Hotel"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <ItineraryCard 
                              key={item.id}
                              item={item} 
                              index={index} 
                              currency={currency}
                              isExpanded={expandedCardId === item.id}
                              onToggleExpand={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                              isEditing={editingCardId === item.id}
                              onStartEdit={(e) => handleStartEdit(item, e)}
                              onSaveEdit={(e) => handleSaveEdit(item.id, e)}
                              onCancelEdit={() => setEditingCardId(null)}
                              onDelete={(e) => handleDeleteItem(item.id, e)}
                              onToggleHighlight={async (itemId, newHighlightState) => {
                                try {
                                  await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), { highlighted: newHighlightState });
                                  setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, highlighted: newHighlightState } : i));
                                } catch (err) { console.error(err); }
                              }}
                              onTogglePaidInAdvance={handleTogglePaidInAdvance}
                              editTitle={editTitle} setEditTitle={setEditTitle}
                              editDate={editDate} setEditDate={setEditDate} 
                              editEndDate={editEndDate} setEditEndDate={setEditEndDate}
                              effectiveStartDate={effectiveStartDate} effectiveEndDate={effectiveEndDate}
                              editHour={editHour} setEditHour={setEditHour} 
                              editMinute={editMinute} setEditMinute={setEditMinute} 
                              editIsFlexible={editIsFlexible} setEditIsFlexible={setEditIsFlexible}
                              hours={hours} minutes={minutes}
                              editCategory={editCategory} setEditCategory={setEditCategory} sortedCategories={sortedCategories}
                              editCost={editCost} setEditCost={setEditCost}
                              editLocation={editLocation} setEditLocation={setEditLocation}
                              editDetails={editDetails} setEditDetails={setEditDetails}
                              isGuest={isGuest}
                            />
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )}
          </div>

          {/* 📅 DAILY ITINERARY FEED */}
          {sortedDates.map(dateStr => {
            const items = groupedItems[dateStr] || [];
            
            const activeAccommodations = itineraryItems.filter(i => 
              i.category === 'Accommodation' && 
              i.date && 
              i.date <= dateStr && 
              (i.endDate >= dateStr || !i.endDate)
            );

            const dayTotal = items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
            
            const formattedDateHeading = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            const isDayCollapsed = collapsedDays[dateStr];

            return (
              <div key={dateStr} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                <div 
                  onClick={() => toggleDayCollapse(dateStr)}
                  className="bg-slate-100 hover:bg-slate-200/60 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{formattedDateHeading}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    {dayTotal > 0 && <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">Daily Total: {currency} {dayTotal.toFixed(2)}</span>}
                    {items.length === 0 && activeAccommodations.length === 0 && <span className="text-[11px] font-medium text-slate-400 italic">No activities planned</span>}
                  </div>
                </div>

                {!isDayCollapsed && (
                  <div className="p-4 space-y-4">
                    
                    {/* 🏨 ACCOMMODATION BANNERS WITH INLINE EDIT & DELETE */}
                    {activeAccommodations.length > 0 && (
                      <div className="space-y-2">
                        {activeAccommodations.map(acc => {
                          const isCheckIn = acc.date === dateStr;
                          const isCheckOut = acc.endDate === dateStr;
                          const badgeLabel = isCheckIn ? 'Check-in' : (isCheckOut ? 'Check-out' : 'Accommodation');
                          const isEditingThisHotel = editingCardId === acc.id;

                          if (isEditingThisHotel) {
                            return (
                              <div key={acc.id} className="bg-amber-50 border border-amber-300 p-4 rounded-2xl shadow-sm space-y-3">
                                <h6 className="font-bold text-amber-950 text-xs uppercase tracking-wider">Edit Accommodation</h6>
                                <div className="space-y-2">
                                  <input 
                                    type="text" 
                                    value={editTitle} 
                                    onChange={(e) => setEditTitle(e.target.value)} 
                                    placeholder="Hotel Name" 
                                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs" 
                                  />
                                  <input 
                                    type="text" 
                                    value={editLocation} 
                                    onChange={(e) => setEditLocation(e.target.value)} 
                                    placeholder="Location / Address" 
                                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs" 
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-amber-800 uppercase">Check-in</label>
                                      <input 
                                        type="date" 
                                        value={editDate} 
                                        onChange={(e) => setEditDate(e.target.value)} 
                                        min={effectiveStartDate} 
                                        max={effectiveEndDate} 
                                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs" 
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-amber-800 uppercase">Check-out</label>
                                      <input 
                                        type="date" 
                                        value={editEndDate} 
                                        onChange={(e) => setEditEndDate(e.target.value)} 
                                        min={editDate || effectiveStartDate} 
                                        max={effectiveEndDate} 
                                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs" 
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <input 
                                      type="number" 
                                      value={editCost} 
                                      onChange={(e) => setEditCost(e.target.value)} 
                                      placeholder="Total Cost" 
                                      className="w-1/2 bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs" 
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button onClick={() => setEditingCardId(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer">Cancel</button>
                                  <button onClick={(e) => handleSaveEdit(acc.id, e)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer">Save Changes</button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={acc.id} className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">
                                      {badgeLabel}
                                    </span>
                                    <h5 className="font-bold text-amber-950 text-sm">{acc.title}</h5>
                                  </div>
                                  {acc.location && <p className="text-xs text-amber-800 mt-0.5">{acc.location}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {acc.cost > 0 && (
                                  <span className="text-xs font-bold text-amber-900">{currency} {Number(acc.cost).toFixed(2)}</span>
                                )}
                                {!isGuest && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={(e) => handleStartEdit(acc, e)} className="p-1.5 text-slate-400 hover:text-blue-600 transition cursor-pointer" title="Edit Hotel"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={(e) => handleDeleteItem(acc.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete Hotel"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <Droppable droppableId={dateStr} isDropDisabled={isGuest}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className={`space-y-3 min-h-[90px] transition-colors rounded-xl p-1 ${snapshot.isDraggingOver ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-300' : ''}`}>
                          {items.length === 0 ? (
                            <div className="h-20 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                              Drop activities here
                            </div>
                          ) : (
                            items.map((item, index) => (
                              <ItineraryCard 
                                key={item.id}
                                item={item} 
                                index={index} 
                                currency={currency}
                                isExpanded={expandedCardId === item.id}
                                onToggleExpand={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                                isEditing={editingCardId === item.id}
                                onStartEdit={(e) => handleStartEdit(item, e)}
                                onSaveEdit={(e) => handleSaveEdit(item.id, e)}
                                onCancelEdit={() => setEditingCardId(null)}
                                onDelete={(e) => handleDeleteItem(item.id, e)}
                                onToggleHighlight={async (itemId, newHighlightState) => {
                                  try {
                                    await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), { highlighted: newHighlightState });
                                    setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, highlighted: newHighlightState } : i));
                                  } catch (err) { console.error(err); }
                                }}
                                editTitle={editTitle} setEditTitle={setEditTitle}
                                editDate={editDate} setEditDate={setEditDate} 
                                editEndDate={editEndDate} setEditEndDate={setEditEndDate}
                                effectiveStartDate={effectiveStartDate} effectiveEndDate={effectiveEndDate}
                                editHour={editHour} setEditHour={setEditHour} 
                                editMinute={editMinute} setEditMinute={setEditMinute} 
                                editIsFlexible={editIsFlexible} setEditIsFlexible={setEditIsFlexible}
                                hours={hours} minutes={minutes}
                                editCategory={editCategory} setEditCategory={setEditCategory} sortedCategories={sortedCategories}
                                editCost={editCost} setEditCost={setEditCost}
                                editLocation={editLocation} setEditLocation={setEditLocation}
                                editDetails={editDetails} setEditDetails={setEditDetails}
                                isGuest={isGuest}
                              />
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    {(() => {
                      const mapActivities = [...activeAccommodations, ...items].filter(a => a.location);
                      return mapActivities.length > 0 ? (
                        <DailyMapView 
                          activities={mapActivities} 
                          currency={currency} 
                          destination={tripDestination} 
                        />
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}