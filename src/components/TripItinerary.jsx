// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, Plus, Trash2, GripVertical, Settings, X } from 'lucide-react';
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

export default function TripItinerary({ tripId, tripStartDate, tripEndDate }) {
  const [itineraryItems, setItineraryItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  
  // Form States
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedDate, setSelectedDate] = useState(tripStartDate || '');
  const [category, setCategory] = useState('Tour');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Google Places Autocomplete ref
  const locationInputRef = useRef(null);

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

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && locationInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(locationInputRef.current, {
        fields: ['formatted_address', 'name', 'geometry']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setLocation(place.formatted_address);
        } else if (place.name) {
          setLocation(place.name);
        }
      });
    }
  }, []);

  // Handle adding a new activity
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    setLoading(true);
    try {
      const newItem = {
        title,
        time: time || '00:00',
        date: selectedDate,
        category,
        location: location.trim(),
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
      setTitle('');
      setLocation('');
      setTime('09:00');
    } catch (error) {
      console.error("Error adding itinerary item:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting an itinerary item
  const handleDeleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "trips", tripId, "itinerary", itemId));
      setItineraryItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Handle saving a new custom category
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

  // Handle deleting a custom category
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

  // Group items by calendar date
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
          <input 
            type="time" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
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

        {/* Location Input with Google Places Autocomplete Ref */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location / Venue</label>
          <input 
            ref={locationInputRef}
            type="text" 
            placeholder="Search venue or address..." 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-3 lg:col-span-4 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {loading ? 'Adding Activity...' : 'Add to Itinerary'}
          </button>
        </div>
      </form>

      {/* Drag and Drop Itinerary Feed */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No activities scheduled yet. Use the form above to add your first event!</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([dateStr, items]) => {
              const formattedDateHeading = new Date(dateStr).toLocaleDateString('en-IE', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div key={dateStr} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                  <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{formattedDateHeading}</h4>
                  </div>

                  <Droppable droppableId={dateStr}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className={`p-3 space-y-3 min-h-[70px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/60' : ''}`}
                      >
                        {items.map((item, index) => {
                          const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;

                          return (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={provided.draggableProps.style}
                                  className={`bg-white p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition ${snapshot.isDragging ? 'ring-2 ring-blue-500 shadow-xl bg-blue-50/20' : ''}`}
                                >
                                  <div className="flex items-start sm:items-center gap-3">
                                    <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1">
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

                                  <button 
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition self-end sm:self-center"
                                    title="Delete activity"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
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