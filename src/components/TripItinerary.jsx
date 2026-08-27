// src/components/TripItinerary.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Inbox, Building2, Trash2, Edit2, MapPin, Car, Footprints, Train, ExternalLink, Calendar, Hotel } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

import ItineraryForm from './ItineraryForm';
import ItineraryCard from './ItineraryCard';
import DailyMapView from './DailyMapView';
import { getCurrencySymbol } from '../utils/currencyUtils';

const DEFAULT_CATEGORIES = ['Tour', 'Meal', 'Museum', 'Transport', 'Accommodation', 'Other'];

const BANNER_COLOR_MAP = {
  rose: { bg: 'bg-rose-50/50 border-rose-100', dot: 'bg-rose-500', text: 'text-rose-800' },
  pink: { bg: 'bg-pink-50/50 border-pink-100', dot: 'bg-pink-500', text: 'text-pink-800' },
  fuchsia: { bg: 'bg-fuchsia-50/50 border-fuchsia-100', dot: 'bg-fuchsia-500', text: 'text-fuchsia-800' },
  purple: { bg: 'bg-purple-50/50 border-purple-100', dot: 'bg-purple-500', text: 'text-purple-800' },
  violet: { bg: 'bg-violet-50/50 border-violet-100', dot: 'bg-violet-500', text: 'text-violet-800' },
  indigo: { bg: 'bg-indigo-50/50 border-indigo-100', dot: 'bg-indigo-500', text: 'text-indigo-800' },
  blue: { bg: 'bg-blue-50/50 border-blue-100', dot: 'bg-blue-500', text: 'text-blue-800' },
  sky: { bg: 'bg-sky-50/50 border-sky-100', dot: 'bg-sky-500', text: 'text-sky-800' },
  cyan: { bg: 'bg-cyan-50/50 border-cyan-100', dot: 'bg-cyan-500', text: 'text-cyan-800' },
  teal: { bg: 'bg-teal-50/50 border-teal-100', dot: 'bg-teal-500', text: 'text-teal-800' },
  emerald: { bg: 'bg-emerald-50/50 border-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-800' },
  green: { bg: 'bg-green-50/50 border-green-100', dot: 'bg-green-500', text: 'text-green-800' },
  lime: { bg: 'bg-lime-50/50 border-lime-100', dot: 'bg-lime-500', text: 'text-lime-800' },
  yellow: { bg: 'bg-yellow-50/50 border-yellow-100', dot: 'bg-yellow-500', text: 'text-yellow-800' },
  amber: { bg: 'bg-amber-50/50 border-amber-100', dot: 'bg-amber-500', text: 'text-amber-800' },
  orange: { bg: 'bg-orange-50/50 border-orange-100', dot: 'bg-orange-500', text: 'text-orange-800' },
  red: { bg: 'bg-red-50/50 border-red-100', dot: 'bg-red-500', text: 'text-red-800' },
  stone: { bg: 'bg-stone-50/50 border-stone-100', dot: 'bg-stone-500', text: 'text-stone-800' },
  slate: { bg: 'bg-slate-50/50 border-slate-200/60', dot: 'bg-slate-500', text: 'text-slate-800' }
};

function isAccommodation(cat) {
  if (!cat) return false;
  const normalized = String(cat).trim().toLowerCase();
  return normalized.includes('accommodation');
}

function compareItineraryItems(a, b) {
  if (a.highlighted && !b.highlighted) return -1;
  if (!a.highlighted && b.highlighted) return 1;
  if (a.time === 'Flexible' && b.time !== 'Flexible') return -1;
  if (a.time !== 'Flexible' && b.time === 'Flexible') return 1;
  
  const timeCompare = a.time.localeCompare(b.time);
  if (timeCompare !== 0) return timeCompare;
  
  const catA = String(a.category || '').toLowerCase();
  const catB = String(b.category || '').toLowerCase();
  
  const isTransitA = catA.includes('flight') || catA.includes('train') || catA.includes('drive') || catA.includes('transport');
  const isTransitB = catB.includes('flight') || catB.includes('train') || catB.includes('drive') || catB.includes('transport');
  
  const isLuggageA = a.category === 'Luggage Drop';
  const isLuggageB = b.category === 'Luggage Drop';
  
  if (isTransitA && !isTransitB) return -1;
  if (!isTransitA && isTransitB) return 1;
  
  if (isLuggageA && !isLuggageB) return isTransitB ? 1 : -1;
  if (!isLuggageA && isLuggageB) return isTransitA ? -1 : 1;
  
  return 0;
}

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
  const [categories, setCategories] = useState([]);
  const [categoriesWithColors, setCategoriesWithColors] = useState([]);
  
  // Creation Form States & Collapse Toggle
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [isFlexibleTime, setIsFlexibleTime] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
  const [endDate, setEndDate] = useState(''); 
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [paidInAdvance, setPaidInAdvance] = useState(false);
  const [loading, setLoading] = useState(false);

    // Unscheduled Pool Toggles
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(true);

  const safeRole = typeof userRole === 'object' ? userRole?.role : userRole;
  const isGuest = String(safeRole || '').toLowerCase() === 'guest';

  const effectiveStartDate = normalizeDate(tripStartDate) || new Date().toISOString().split('T')[0];
  const effectiveEndDate = normalizeDate(tripEndDate) || effectiveStartDate;
  const rawSortedDates = getTripDateRange(effectiveStartDate, effectiveEndDate);

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
  const [editPaidInAdvance, setEditPaidInAdvance] = useState(false);

  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const autocompleteServiceRef = useRef(null);
  const dropdownRef = useRef(null);

  const [destination, setDestination] = useState('');
  const [destPredictions, setDestPredictions] = useState([]);
  const [showDestPredictions, setShowDestPredictions] = useState(false);
  const destDropdownRef = useRef(null);

  const [editDestination, setEditDestination] = useState('');

  // Arrival time for transit activities (add form)
  const [arrivalHour, setArrivalHour] = useState('');
  const [arrivalMinute, setArrivalMinute] = useState('00');

  // Arrival time for transit activities (edit form)
  const [editArrivalHour, setEditArrivalHour] = useState('');
  const [editArrivalMinute, setEditArrivalMinute] = useState('00');

  // Track dismissed/accepted early arrival luggage suggestions (by transit item ID)
  const [dismissedLuggageSuggestions, setDismissedLuggageSuggestions] = useState(new Set());

  // Suggested travel time states
  const [travelCache, setTravelCache] = useState(() => {
    try {
      const saved = localStorage.getItem('travelHubRouteCache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [travelModes, setTravelModes] = useState(() => {
    try {
      const saved = localStorage.getItem('travelHubPreferredModes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [loadingSegments, setLoadingSegments] = useState({});

  const fetchRoute = useCallback(async (origin, destination, mode, segmentKey) => {
    if (!origin || !destination || !window.google?.maps) return;
    const cacheKey = `${origin.trim()}||${destination.trim()}||${mode}`;
    const loadingKey = `${segmentKey}-${mode}`;
    
    if (travelCache[cacheKey]) {
      return travelCache[cacheKey];
    }

    setLoadingSegments(prev => ({ ...prev, [loadingKey]: true }));

    try {
      const { Route } = await window.google.maps.importLibrary("routes");
      
      let sdkMode = 'DRIVING';
      if (mode === 'WALK') sdkMode = 'WALKING';
      else if (mode === 'TRANSIT') sdkMode = 'TRANSIT';

       const request = {
        origin: origin.trim(),
        destination: destination.trim(),
        travelMode: sdkMode,
        fields: ['durationMillis', 'distanceMeters']
      };

      const response = await Route.computeRoutes(request);
      
      if (response && response.routes && response.routes.length > 0) {
        const route = response.routes[0];
        const durationMins = route.durationMillis ? Math.round(route.durationMillis / 60000) : 0;
        const distanceKm = route.distanceMeters ? (route.distanceMeters / 1000).toFixed(1) : '0.0';
        
        const routeData = {
          duration: durationMins,
          distance: distanceKm
        };

        setTravelCache(prev => {
          const updated = { ...prev, [cacheKey]: routeData };
          localStorage.setItem('travelHubRouteCache', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error("Error computing route:", err);
      const errorData = {
        duration: 'N/A',
        distance: 'N/A',
        error: true,
        errorMessage: err?.message || 'Permission denied or API disabled'
      };
      setTravelCache(prev => {
        const updated = { ...prev, [cacheKey]: errorData };
        localStorage.setItem('travelHubRouteCache', JSON.stringify(updated));
        return updated;
      });
    } finally {
      setLoadingSegments(prev => ({ ...prev, [loadingKey]: false }));
    }
  }, [travelCache]);

  useEffect(() => {
    if (!window.google?.maps || itineraryItems.length === 0) return;

    const grouped = {};
    itineraryItems.forEach(item => {
      if (item.date && !isAccommodation(item.category)) {
        if (!grouped[item.date]) grouped[item.date] = [];
        grouped[item.date].push(item);
      }
    });

    rawSortedDates.forEach(dateStr => {
      const standardItems = grouped[dateStr] || [];

      // Generate check-ins and check-outs
      const checkInVirtualItems = itineraryItems
        .filter(i => isAccommodation(i.category) && i.date === dateStr)
        .map(acc => ({
          id: `${acc.id}-checkin`,
          parentId: acc.id,
          title: `Check-in: ${acc.title}`,
          date: acc.date,
          time: acc.checkInTime || '15:00',
          location: acc.location,
          category: acc.category,
          type: 'checkin',
          isVirtual: true,
          rawItem: acc
        }));

      const checkOutVirtualItems = itineraryItems
        .filter(i => isAccommodation(i.category) && i.endDate === dateStr)
        .map(acc => ({
          id: `${acc.id}-checkout`,
          parentId: acc.id,
          title: `Check-out: ${acc.title}`,
          date: acc.endDate,
          time: acc.checkOutTime || '11:00',
          location: acc.location,
          category: acc.category,
          type: 'checkout',
          isVirtual: true,
          rawItem: acc
        }));

      // Merge and sort chronologically
      const sorted = [...checkOutVirtualItems, ...standardItems, ...checkInVirtualItems];
      sorted.sort((a, b) => {
        if (a.time === 'Flexible') return 1;
        if (b.time === 'Flexible') return -1;
        return a.time.localeCompare(b.time);
      });

      // Prefetch route from active accommodation to first activity on staying-at days
      const intermediateAccommodations = itineraryItems.filter(i => 
        isAccommodation(i.category) && 
        i.date && 
        i.date < dateStr && 
        i.endDate > dateStr
      );

      if (intermediateAccommodations.length > 0 && sorted.length > 0) {
        const firstItem = sorted[0];
        const startLoc = intermediateAccommodations[0].location;
        const endLoc = firstItem.location;
        if (startLoc && endLoc && startLoc.trim() !== endLoc.trim()) {
          const segmentKey = `${intermediateAccommodations[0].id}-${firstItem.id}-hotelstart`;
          const modes = ['DRIVE', 'WALK', 'TRANSIT'];
          modes.forEach(mode => {
            const cacheKey = `${startLoc.trim()}||${endLoc.trim()}||${mode}`;
            const loadingKey = `${segmentKey}-${mode}`;
            if (!travelCache[cacheKey] && !loadingSegments[loadingKey]) {
              fetchRoute(startLoc, endLoc, mode, segmentKey);
            }
          });
        }
      }

      for (let i = 0; i < sorted.length - 1; i++) {
        const itemA = sorted[i];
        const itemB = sorted[i + 1];
        
        // Resolve start and end locations for transit routing
        const catA = itemA.category?.toLowerCase() || '';
        const isTransitA = catA.includes('flight') || catA.includes('train') || catA.includes('drive') || catA.includes('transport');
        const startLoc = (isTransitA && itemA.destination) ? itemA.destination : itemA.location;
        const endLoc = itemB.location;

        if (startLoc && endLoc) {
          const segmentKey = `${itemA.id}-${itemB.id}`;
          const modes = ['DRIVE', 'WALK', 'TRANSIT'];
          
          modes.forEach(mode => {
            const cacheKey = `${startLoc.trim()}||${endLoc.trim()}||${mode}`;
            const loadingKey = `${segmentKey}-${mode}`;
            
            if (!travelCache[cacheKey] && !loadingSegments[loadingKey]) {
              fetchRoute(startLoc, endLoc, mode, segmentKey);
            }
          });
        }
      }
    });
  }, [itineraryItems, travelModes, window.google?.maps, fetchRoute, travelCache, loadingSegments, rawSortedDates]);

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
                  const fetchedCats = settingsSnap.data().list;
                  // Store raw rich list for colors
                  const normalizedRichList = fetchedCats.map(c => typeof c === 'string' ? { name: c, color: 'blue' } : c);
                  setCategoriesWithColors(normalizedRichList);

                  // Normalize to strings for select options
                  const catNames = normalizedRichList.map(c => c.name);
                  setCategories(catNames);
                  // Set initial default category to the first sorted category
                  if (catNames.length > 0) {
                    const sorted = [...catNames].sort((a, b) => a.localeCompare(b));
                    setCategory(sorted[0]);
                  }
                } else {
                  // Fallback if global settings don't exist yet
                  const catNames = DEFAULT_CATEGORIES;
                  setCategories(catNames);
                  const defaultRich = DEFAULT_CATEGORIES.map(c => ({ name: c, color: 'blue' }));
                  setCategoriesWithColors(defaultRich);
                  const sorted = [...catNames].sort((a, b) => a.localeCompare(b));
                  setCategory(sorted[0]);
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
      if (destDropdownRef.current && !destDropdownRef.current.contains(e.target)) setShowDestPredictions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDestLocationChange = (e) => {
    const value = e.target.value;
    setDestination(value);
    if (!value.trim() || !autocompleteServiceRef.current) {
      setDestPredictions([]);
      setShowDestPredictions(false);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions({ input: value }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        setDestPredictions(results);
        setShowDestPredictions(true);
      } else {
        setDestPredictions([]);
        setShowDestPredictions(false);
      }
    });
  };

  const handleSelectDestPrediction = (prediction) => {
    setDestination(prediction.description);
    setDestPredictions([]);
    setShowDestPredictions(false);
  };

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
      const catL = category?.toLowerCase() || '';
      const isTransit = catL.includes('flight') || catL.includes('train') || catL.includes('drive') || catL.includes('transport');
      const newItem = {
        title,
        time: isFlexibleTime ? 'Flexible' : `${selectedHour}:${selectedMinute}`,
        arrivalTime: (isTransit && arrivalHour) ? `${arrivalHour}:${arrivalMinute}` : null,
        date: selectedDate ? selectedDate : null,
        endDate: isAccommodation(category) && endDate ? endDate : (isAccommodation(category) ? selectedDate : null),
        category,
        location: location.trim(),
        destination: isTransit ? destination.trim() : null,
        details: details.trim(),
        cost: cost ? parseFloat(cost) : 0,
        paidInAdvance: Boolean(paidInAdvance),
        highlighted: false,
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, "trips", tripId, "itinerary"), newItem);
      setItineraryItems(prev => [...prev, { id: docRef.id, ...newItem }]);
            // Reset form fields
      setTitle('');
      setLocation('');
      setDestination('');
      setDetails('');
      setCost('');
      setPaidInAdvance(false);
      setSelectedDate('');
      setEndDate('');
      setIsFlexibleTime(false);
      setSelectedHour('09');
      setSelectedMinute('00');
      setArrivalHour('');
      setArrivalMinute('00');
      // Reset category to first item in sorted list
      if (sortedCategories.length > 0) {
        setCategory(sortedCategories[0]);
      }
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
      const docId = itemId.endsWith('-checkin') ? itemId.replace('-checkin', '') : (itemId.endsWith('-checkout') ? itemId.replace('-checkout', '') : itemId);
      await deleteDoc(doc(db, "trips", tripId, "itinerary", docId));
      setItineraryItems(prev => prev.filter(i => i.id !== docId));
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  const handleStartEdit = (item, e) => {
    if (e) e.stopPropagation();
    if (isGuest) return;
    setEditingCardId(item.id);
    setExpandedCardId(item.id);
    const raw = item.isVirtual ? item.rawItem : item;
    setEditTitle(raw.title);
    setEditDate(raw.date || '');
    setEditEndDate(raw.endDate || raw.date || '');
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
    setEditCategory(raw.category || 'Accommodation');
    setEditLocation(raw.location || '');
    setEditDestination(raw.destination || '');
    if (raw.arrivalTime) {
      const [ah, am] = raw.arrivalTime.split(':');
      setEditArrivalHour(ah || '');
      setEditArrivalMinute(am || '00');
    } else {
      setEditArrivalHour('');
      setEditArrivalMinute('00');
    }
    setEditDetails(raw.details || '');
    setEditCost(raw.cost ? raw.cost.toString() : '');
    setEditPaidInAdvance(Boolean(raw.paidInAdvance));
  };

  const handleSaveEdit = async (itemId, paidFlag) => {
    if (isGuest) return;
    if (!editTitle.trim()) return;

    const isVirtual = itemId.endsWith('-checkin') || itemId.endsWith('-checkout');
    const parentId = itemId.endsWith('-checkin') ? itemId.replace('-checkin', '') : (itemId.endsWith('-checkout') ? itemId.replace('-checkout', '') : itemId);
    const isCheckin = itemId.endsWith('-checkin');

    const updatedFields = {
      title: editTitle.trim(),
      date: editDate ? editDate : null,
      endDate: isAccommodation(editCategory) && editEndDate ? editEndDate : (isAccommodation(editCategory) ? editDate : null),
      category: editCategory,
      location: editLocation.trim(),
      details: editDetails.trim(),
      cost: editCost ? parseFloat(editCost) : 0,
      paidInAdvance: Boolean(paidFlag)
    };

    if (isVirtual) {
      if (isCheckin) {
        updatedFields.checkInTime = editIsFlexible ? 'Flexible' : `${editHour}:${editMinute}`;
      } else {
        updatedFields.checkOutTime = editIsFlexible ? 'Flexible' : `${editHour}:${editMinute}`;
      }
    } else {
      const editCatL = editCategory?.toLowerCase() || '';
      const isTransit = editCatL.includes('flight') || editCatL.includes('train') || editCatL.includes('drive') || editCatL.includes('transport');
      updatedFields.time = editIsFlexible ? 'Flexible' : `${editHour}:${editMinute}`;
      updatedFields.destination = isTransit ? editDestination.trim() : null;
      updatedFields.arrivalTime = (isTransit && editArrivalHour) ? `${editArrivalHour}:${editArrivalMinute}` : null;
    }

    try {
      await updateDoc(doc(db, "trips", tripId, "itinerary", parentId), updatedFields);
      const snap = await getDocs(query(collection(db, "trips", tripId, "itinerary"), orderBy("createdAt", "asc")));
      setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEditingCardId(null);
      setEditPaidInAdvance(false);
    } catch (err) {
      console.error("Error saving edit:", err);
    }
  };

  const handleDragEnd = async (result) => {
    if (isGuest) return;
    const { destination, source, draggableId } = result;
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return;

    const isVirtual = draggableId.endsWith('-checkin') || draggableId.endsWith('-checkout');
    const docId = draggableId.endsWith('-checkin') ? draggableId.replace('-checkin', '') : (draggableId.endsWith('-checkout') ? draggableId.replace('-checkout', '') : draggableId);
    const isCheckin = draggableId.endsWith('-checkin');

    const newDate = destination.droppableId === 'unscheduled' ? null : destination.droppableId;
    
    let updatedField = { date: newDate };
    if (isVirtual) {
      if (isCheckin) {
        updatedField = { date: newDate };
      } else {
        updatedField = { endDate: newDate };
      }
    }

    setItineraryItems(prev => prev.map(i => i.id === docId ? { ...i, ...updatedField } : i));

    try {
      const itemRef = doc(db, "trips", tripId, "itinerary", docId);
      await updateDoc(itemRef, updatedField);
      // Force reload to update check-in/check-out cards layout properly
      const snap = await getDocs(query(collection(db, "trips", tripId, "itinerary"), orderBy("createdAt", "asc")));
      setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error updating item date in Firestore:", err);
      alert("Failed to save schedule change.");
      const snap = await getDocs(query(collection(db, "trips", tripId, "itinerary"), orderBy("createdAt", "asc")));
      setItineraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

    const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));
  
  // Sort dates conditionally: Today first, future next, past at the very end
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedDates = [...rawSortedDates].sort((a, b) => {
    // If start date is today or trip status is In Progress, customize ordering
    const aIsToday = a === todayStr;
    const bIsToday = b === todayStr;

    if (aIsToday && !bIsToday) return -1;
    if (bIsToday && !aIsToday) return 1;

    const aIsPast = a < todayStr;
    const bIsPast = b < todayStr;

    if (aIsPast && !bIsPast) return 1; // Move past days to the end
    if (bIsPast && !aIsPast) return -1;

    // Otherwise, order chronologically
    return a.localeCompare(b);
  });
  
    const unscheduledItems = itineraryItems.filter(i => !i.date || !rawSortedDates.includes(i.date));
  
  const groupedItems = itineraryItems.reduce((groups, item) => {
    if (item.date && rawSortedDates.includes(item.date) && !isAccommodation(item.category)) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return groups;
  }, {});

  Object.keys(groupedItems).forEach(d => {
    groupedItems[d].sort(compareItineraryItems);
  });

  const grandTotalCost = itineraryItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  const currencySymbol = getCurrencySymbol(currency);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className="mt-6 sm:mt-8 bg-white p-4 sm:p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Trip Itinerary</h3>
          <p className="text-xs text-slate-500 mt-0.5">Estimated Trip Budget: <span className="font-bold text-slate-800">{currencySymbol} {grandTotalCost.toFixed(2)}</span></p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3">
          {!isGuest && (
            <button 
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className="w-full md:w-auto justify-center flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 rounded-xl transition cursor-pointer shadow-sm"
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
            destination={destination} setDestination={setDestination} handleDestLocationChange={handleDestLocationChange}
            showDestPredictions={showDestPredictions} destPredictions={destPredictions} handleSelectDestPrediction={handleSelectDestPrediction}
            arrivalHour={arrivalHour} setArrivalHour={setArrivalHour} arrivalMinute={arrivalMinute} setArrivalMinute={setArrivalMinute}
            details={details} setDetails={setDetails}
            paidInAdvance={paidInAdvance} setPaidInAdvance={setPaidInAdvance}
            loading={loading} dropdownRef={dropdownRef} destDropdownRef={destDropdownRef}
            onAddItem={handleAddItem}
          />
          {isAccommodation(category) && (
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
          <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-indigo-50/20 shadow-sm">
            <div 
              onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
              className="bg-indigo-50/40 hover:bg-indigo-50/60 px-4 sm:px-5 py-3 border-b border-indigo-100 flex items-center justify-between gap-3 cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-indigo-600 shrink-0" />
                <h4 className="font-bold text-indigo-900 text-xs sm:text-sm uppercase tracking-wider">Unscheduled Ideas Pool</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200/50 shadow-sm">
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
                          if (isAccommodation(item.category)) {
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
                              <div key={item.id} className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-start md:items-center gap-3">
                                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0"><Building2 className="w-4 h-4" /></div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px]">{item.category}</span>
                                      <h5 className="font-bold text-amber-950 text-sm">{item.title}</h5>
                                    </div>
                                    {item.cost > 0 && <span className="md:hidden inline-flex mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50">{currency} {Number(item.cost).toFixed(2)}</span>}
                                    {item.location && <p className="text-xs text-amber-800 mt-1 break-words">{item.location}</p>}
                                    {!isGuest && (
                                      <div className="md:hidden flex items-center gap-1 mt-2">
                                        <button onClick={(e) => handleStartEdit(item, e)} className="p-2 text-slate-400 hover:text-blue-600 transition cursor-pointer" title="Edit Hotel"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={(e) => handleDeleteItem(item.id, e)} className="p-2 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete Hotel"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                  {item.cost > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50">{currency} {Number(item.cost).toFixed(2)}</span>}
                                  {!isGuest && (
                                  <>
                                    <button onClick={(e) => handleStartEdit(item, e)} className="p-1.5 text-slate-400 hover:text-blue-600 transition cursor-pointer" title="Edit Hotel"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={(e) => handleDeleteItem(item.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete Hotel"><Trash2 className="w-4 h-4" /></button>
                                  </>
                                  )}
                                </div>
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
                              onSaveEdit={(paidFlag) => handleSaveEdit(item.id, paidFlag)}
                              onCancelEdit={() => { setEditingCardId(null); setEditPaidInAdvance(false); }}
                              onDelete={(e) => handleDeleteItem(item.id, e)}
                                                            onToggleHighlight={async (itemId, newHighlightState) => {
                                try {
                                  await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), { highlighted: newHighlightState });
                                  setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, highlighted: newHighlightState } : i));
                                } catch (err) { console.error(err); }
                              }}
                              editPaidInAdvance={editPaidInAdvance} setEditPaidInAdvance={setEditPaidInAdvance}
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
                              editDestination={editDestination} setEditDestination={setEditDestination}
                              editDetails={editDetails} setEditDetails={setEditDetails}
                              isGuest={isGuest}
                              categoriesWithColors={categoriesWithColors}
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
            const standardItems = groupedItems[dateStr] || [];

            // Generate virtual check-ins and check-outs for this day
            const checkInVirtualItems = itineraryItems
              .filter(i => isAccommodation(i.category) && i.category !== 'Luggage Drop' && !i.title?.toLowerCase().includes('drop luggage') && i.date === dateStr)
              .map(acc => ({
                id: `${acc.id}-checkin`,
                parentId: acc.id,
                title: `Check-in: ${acc.title}`,
                date: acc.date,
                time: acc.checkInTime || '15:00',
                location: acc.location,
                category: acc.category,
                type: 'checkin',
                cost: acc.cost,
                paidInAdvance: acc.paidInAdvance,
                details: acc.details || '',
                highlighted: acc.highlighted || false,
                isVirtual: true,
                rawItem: acc
              }));

            const checkOutVirtualItems = itineraryItems
              .filter(i => isAccommodation(i.category) && i.category !== 'Luggage Drop' && !i.title?.toLowerCase().includes('drop luggage') && i.endDate === dateStr)
              .map(acc => ({
                id: `${acc.id}-checkout`,
                parentId: acc.id,
                title: `Check-out: ${acc.title}`,
                date: acc.endDate,
                time: acc.checkOutTime || '11:00',
                location: acc.location,
                category: acc.category,
                type: 'checkout',
                details: acc.details || '',
                highlighted: acc.highlighted || false,
                isVirtual: true,
                rawItem: acc
              }));

            // Find intermediate accommodations (stay is active, but today is neither checkin nor checkout day)
            const intermediateAccommodations = itineraryItems.filter(i => 
              isAccommodation(i.category) && 
              i.date && 
              i.date < dateStr && 
              i.endDate > dateStr
            );

            // Merge and sort chronologically
            const items = [...checkOutVirtualItems, ...standardItems, ...checkInVirtualItems];
            items.sort(compareItineraryItems);

            const dayTotal = items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
            const formattedDateHeading = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

            return (
              <div key={dateStr} className="border-0 sm:border border-slate-200 rounded-none sm:rounded-2xl overflow-hidden bg-transparent sm:bg-slate-50/40">
                <div 
                  className="bg-transparent sm:bg-slate-100 px-0 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-200/60 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">{formattedDateHeading}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayTotal > 0 && <span className="text-[10px] sm:text-xs font-bold text-slate-600 bg-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-slate-200 shadow-sm">{currencySymbol}{dayTotal.toFixed(2)}</span>}
                    {items.length === 0 && intermediateAccommodations.length === 0 && <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 italic">No activities planned</span>}
                  </div>
                </div>

                <div className="py-3 px-0 sm:p-4 space-y-4">
                  {/* intermediate accommodations banner */}
                  {intermediateAccommodations.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {intermediateAccommodations.map(acc => {
                        const matchedCat = categoriesWithColors.find(c => c.name === acc.category);
                        const colorKey = matchedCat ? matchedCat.color : 'slate';
                        const theme = BANNER_COLOR_MAP[colorKey] || BANNER_COLOR_MAP.slate;

                        return (
                          <div key={acc.id} className={`${theme.bg} border p-2.5 rounded-xl flex items-center justify-between shadow-3xs`}>
                            <div className="flex items-center gap-2">
                              <Hotel className={`w-3.5 h-3.5 ${theme.text} shrink-0`} />
                              <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.text}`}>Staying at:</p>
                              <span className="text-xs font-semibold text-slate-800">{acc.title}</span>
                              <span className="text-[10px] text-slate-400">({acc.location})</span>
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
                            items.map((item, index) => {
                              const nextItem = items[index + 1];

                              // Determine start and end locations for transit suggestions
                              const catLower = item.category?.toLowerCase() || '';
                              const isTransit = catLower.includes('flight') || catLower.includes('train') || catLower.includes('drive') || catLower.includes('transport');
                              const startLoc = (isTransit && item.destination) ? item.destination : item.location;
                              const endLoc = nextItem ? nextItem.location : '';

                              const showTransit = nextItem && startLoc && endLoc && startLoc.trim() !== endLoc.trim();
                              const segmentKey = nextItem ? `${item.id}-${nextItem.id}` : '';
                              const driveCacheKey = nextItem && startLoc && endLoc ? `${startLoc.trim()}||${endLoc.trim()}||DRIVE` : '';
                              const walkCacheKey = nextItem && startLoc && endLoc ? `${startLoc.trim()}||${endLoc.trim()}||WALK` : '';
                              const transitCacheKey = nextItem && startLoc && endLoc ? `${startLoc.trim()}||${endLoc.trim()}||TRANSIT` : '';

                              const driveInfo = travelCache[driveCacheKey];
                              const walkInfo = travelCache[walkCacheKey];
                              const transitInfo = travelCache[transitCacheKey];

                              // Determine intelligent default mode if no user preference is stored
                              let defaultMode = 'DRIVE';
                              if (walkInfo && !walkInfo.error && typeof walkInfo.duration === 'number') {
                                if (walkInfo.duration <= 15 || Number(walkInfo.distance) < 1.2) {
                                  defaultMode = 'WALK';
                                }
                              }

                              const preferredMode = travelModes[segmentKey] || defaultMode;

                              const isDriveLoading = loadingSegments[`${segmentKey}-DRIVE`];
                              const isWalkLoading = loadingSegments[`${segmentKey}-WALK`];
                              const isTransitLoading = loadingSegments[`${segmentKey}-TRANSIT`];

                              const driveDuration = driveInfo && !driveInfo.error && typeof driveInfo.duration === 'number' ? driveInfo.duration : Infinity;
                              const walkDuration = walkInfo && !walkInfo.error && typeof walkInfo.duration === 'number' ? walkInfo.duration : Infinity;
                              const transitDuration = transitInfo && !transitInfo.error && typeof transitInfo.duration === 'number' ? transitInfo.duration : Infinity;

                              let fastestMode = null;
                              let minDuration = Infinity;

                              if (driveDuration < minDuration) { minDuration = driveDuration; fastestMode = 'DRIVE'; }
                              if (walkDuration < minDuration) { minDuration = walkDuration; fastestMode = 'WALK'; }
                              if (transitDuration < minDuration) { minDuration = transitDuration; fastestMode = 'TRANSIT'; }
                              if (minDuration === Infinity) fastestMode = null;

                              const activeInfo = preferredMode === 'DRIVE' ? driveInfo : (preferredMode === 'WALK' ? walkInfo : transitInfo);
                              const isActiveLoading = preferredMode === 'DRIVE' ? isDriveLoading : (preferredMode === 'WALK' ? isWalkLoading : isTransitLoading);

                              const getModeDurationText = (isLoading, info) => {
                                if (isLoading) return '...';
                                if (!info) return 'pending';
                                if (info.error) return 'N/A';
                                return `${info.duration}m`;
                              };

                              let distanceDisplay = null;
                              if (isActiveLoading) {
                                distanceDisplay = <span className="text-[10px] text-slate-400 animate-pulse px-1">Loading...</span>;
                              } else if (activeInfo) {
                                if (activeInfo.error) {
                                  distanceDisplay = (
                                    <span className="text-[10px] text-red-500 font-semibold cursor-help px-1" title={activeInfo.errorMessage}>
                                      API blocked
                                    </span>
                                  );
                                } else {
                                  distanceDisplay = (
                                    <span className="text-[10px] text-slate-500 font-semibold px-1">
                                      {`(${activeInfo.distance} km)`}
                                    </span>
                                  );
                                }
                              } else {
                                distanceDisplay = <span className="text-[10px] text-slate-400 px-1">No data</span>;
                              }

                              // Determine variables for hotelstart segments
                              const isFirstItem = index === 0;
                              const hasHotelStart = isFirstItem && intermediateAccommodations.length > 0;
                              const hotelStartSegmentKey = hasHotelStart ? `${intermediateAccommodations[0].id}-${item.id}-hotelstart` : '';
                              const hotelStartStartLoc = hasHotelStart ? intermediateAccommodations[0].location : '';
                              const hotelStartEndLoc = hasHotelStart ? item.location : '';
                              const showHotelStartTransit = hasHotelStart && hotelStartStartLoc && hotelStartEndLoc && hotelStartStartLoc.trim() !== hotelStartEndLoc.trim();

                              const hotelStartDriveCacheKey = showHotelStartTransit ? `${hotelStartStartLoc.trim()}||${hotelStartEndLoc.trim()}||DRIVE` : '';
                              const hotelStartWalkCacheKey = showHotelStartTransit ? `${hotelStartStartLoc.trim()}||${hotelStartEndLoc.trim()}||WALK` : '';
                              const hotelStartTransitCacheKey = showHotelStartTransit ? `${hotelStartStartLoc.trim()}||${hotelStartEndLoc.trim()}||TRANSIT` : '';

                              const hotelStartDriveInfo = travelCache[hotelStartDriveCacheKey];
                              const hotelStartWalkInfo = travelCache[hotelStartWalkCacheKey];
                              const hotelStartTransitInfo = travelCache[hotelStartTransitCacheKey];

                              let hotelStartDefaultMode = 'DRIVE';
                              if (hotelStartWalkInfo && !hotelStartWalkInfo.error && typeof hotelStartWalkInfo.duration === 'number') {
                                if (hotelStartWalkInfo.duration <= 15 || Number(hotelStartWalkInfo.distance) < 1.2) {
                                  hotelStartDefaultMode = 'WALK';
                                }
                              }

                              const hotelStartPreferredMode = travelModes[hotelStartSegmentKey] || hotelStartDefaultMode;

                              const isHotelStartDriveLoading = loadingSegments[`${hotelStartSegmentKey}-DRIVE`];
                              const isHotelStartWalkLoading = loadingSegments[`${hotelStartSegmentKey}-WALK`];
                              const isHotelStartTransitLoading = loadingSegments[`${hotelStartSegmentKey}-TRANSIT`];

                              const hotelStartDriveDuration = hotelStartDriveInfo && !hotelStartDriveInfo.error && typeof hotelStartDriveInfo.duration === 'number' ? hotelStartDriveInfo.duration : Infinity;
                              const hotelStartWalkDuration = hotelStartWalkInfo && !hotelStartWalkInfo.error && typeof hotelStartWalkInfo.duration === 'number' ? hotelStartWalkInfo.duration : Infinity;
                              const hotelStartTransitDuration = hotelStartTransitInfo && !hotelStartTransitInfo.error && typeof hotelStartTransitInfo.duration === 'number' ? hotelStartTransitInfo.duration : Infinity;

                              let hotelStartFastestMode = null;
                              let hotelStartMinDuration = Infinity;
                              if (hotelStartDriveDuration < hotelStartMinDuration) { hotelStartMinDuration = hotelStartDriveDuration; hotelStartFastestMode = 'DRIVE'; }
                              if (hotelStartWalkDuration < hotelStartMinDuration) { hotelStartMinDuration = hotelStartWalkDuration; hotelStartFastestMode = 'WALK'; }
                              if (hotelStartTransitDuration < hotelStartMinDuration) { hotelStartMinDuration = hotelStartTransitDuration; hotelStartFastestMode = 'TRANSIT'; }
                              if (hotelStartMinDuration === Infinity) hotelStartFastestMode = null;

                              const hotelStartActiveInfo = hotelStartPreferredMode === 'DRIVE' ? hotelStartDriveInfo : (hotelStartPreferredMode === 'WALK' ? hotelStartWalkInfo : hotelStartTransitInfo);
                              const isHotelStartActiveLoading = hotelStartPreferredMode === 'DRIVE' ? isHotelStartDriveLoading : (hotelStartPreferredMode === 'WALK' ? isHotelStartWalkLoading : isHotelStartTransitLoading);

                              let hotelStartDistanceDisplay = null;
                              if (isHotelStartActiveLoading) {
                                hotelStartDistanceDisplay = <span className="text-[10px] text-slate-400 animate-pulse px-1">Loading...</span>;
                              } else if (hotelStartActiveInfo) {
                                if (hotelStartActiveInfo.error) {
                                  hotelStartDistanceDisplay = <span className="text-[10px] text-red-500 font-semibold cursor-help px-1" title={hotelStartActiveInfo.errorMessage}>API blocked</span>;
                                } else {
                                  hotelStartDistanceDisplay = <span className="text-[10px] text-slate-500 font-semibold px-1">{`(${hotelStartActiveInfo.distance} km)`}</span>;
                                }
                              } else {
                                hotelStartDistanceDisplay = <span className="text-[10px] text-slate-400 px-1">No data</span>;
                              }

                              return (
                                <React.Fragment key={item.id}>
                                  {showHotelStartTransit && (
                                    <div className="flex items-center gap-3 px-4 py-1.5 ml-8 sm:ml-9 text-slate-400 group/transit mb-2 mt-1">
                                      {/* Vertical dotted connector lines */}
                                      <div className="w-0.5 h-6 border-l-2 border-dotted border-slate-200 self-stretch -my-1.5 shrink-0" />
                                      
                                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-full px-2.5 py-1 shadow-xs text-[11px] font-medium text-slate-500 transition">
                                        {/* Label indicating departure from accommodation */}
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From Hotel:</span>
                                        
                                        {/* Multi-mode Pill Selector */}
                                        <div className="flex items-center gap-1 bg-slate-100/60 border border-slate-200/50 rounded-lg p-0.5 shadow-2xs">
                                          {/* Drive Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [hotelStartSegmentKey]: 'DRIVE' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              hotelStartPreferredMode === 'DRIVE' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Drive as preferred mode"
                                          >
                                            <Car className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isHotelStartDriveLoading, hotelStartDriveInfo)}</span>
                                            {hotelStartFastestMode === 'DRIVE' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>

                                          {/* Walk Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [hotelStartSegmentKey]: 'WALK' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              hotelStartPreferredMode === 'WALK' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Walk as preferred mode"
                                          >
                                            <Footprints className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isHotelStartWalkLoading, hotelStartWalkInfo)}</span>
                                            {hotelStartFastestMode === 'WALK' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>

                                          {/* Transit Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [hotelStartSegmentKey]: 'TRANSIT' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              hotelStartPreferredMode === 'TRANSIT' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Transit as preferred mode"
                                          >
                                            <Train className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isHotelStartTransitLoading, hotelStartTransitInfo)}</span>
                                            {hotelStartFastestMode === 'TRANSIT' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>
                                        </div>

                                        {/* Distance Details */}
                                        {hotelStartDistanceDisplay}

                                        {/* External link to Google Maps */}
                                        <a 
                                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(hotelStartStartLoc)}&destination=${encodeURIComponent(hotelStartEndLoc)}&travelmode=${hotelStartPreferredMode === 'DRIVE' ? 'driving' : (hotelStartPreferredMode === 'WALK' ? 'walking' : 'transit')}`}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-slate-400 hover:text-blue-600 transition ml-0.5"
                                          title="Open Directions in Google Maps"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                  <ItineraryCard 
                                    item={item} 
                                    index={index} 
                                    currency={currency}
                                    isExpanded={expandedCardId === item.id}
                                    onToggleExpand={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                                    isEditing={editingCardId === item.id}
                                    onStartEdit={(e) => handleStartEdit(item, e)}
                                    onSaveEdit={(paidFlag) => handleSaveEdit(item.id, paidFlag)}
                                    onCancelEdit={() => { setEditingCardId(null); setEditPaidInAdvance(false); }}
                                    onDelete={(e) => handleDeleteItem(item.id, e)}
                                    onToggleHighlight={async (itemId, newHighlightState) => {
                                      try {
                                        await updateDoc(doc(db, "trips", tripId, "itinerary", itemId), { highlighted: newHighlightState });
                                        setItineraryItems(prev => prev.map(i => i.id === itemId ? { ...i, highlighted: newHighlightState } : i));
                                      } catch (err) { console.error(err); }
                                    }}
                                    editPaidInAdvance={editPaidInAdvance} setEditPaidInAdvance={setEditPaidInAdvance}
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
                                    editDestination={editDestination} setEditDestination={setEditDestination}
                                    editArrivalHour={editArrivalHour} setEditArrivalHour={setEditArrivalHour}
                                    editArrivalMinute={editArrivalMinute} setEditArrivalMinute={setEditArrivalMinute}
                                    editDetails={editDetails} setEditDetails={setEditDetails}
                                    isGuest={isGuest}
                                    categoriesWithColors={categoriesWithColors}
                                  />

                                  {/* Early Arrival Luggage Drop Suggestion */}
                                  {(() => {
                                    if (!isTransit || !item.arrivalTime || dismissedLuggageSuggestions.has(item.id)) return null;
                                    // Check if there is already a Luggage Drop activity on this day
                                    const hasLuggageDrop = items.some(i => i.category === 'Luggage Drop');
                                    if (hasLuggageDrop) return null;
                                    // Find the next check-in virtual card in this day's items
                                    const nextCheckin = items.slice(index + 1).find(i => i.isVirtual && i.type === 'checkin');
                                    if (!nextCheckin) return null;
                                    // Compare times as HH:MM strings (zero-padded, so lexicographic is correct)
                                    if (item.arrivalTime >= nextCheckin.time) return null;

                                    // Snapshot all values into explicit const variables to avoid stale closure issues
                                    const snapshotArrivalTime = String(item.arrivalTime);
                                    const snapshotTransitItemId = item.id;
                                    const hotelName = nextCheckin.title?.replace(/^Check-in:\s*/i, '') || 'the hotel';
                                    const hotelLocation = nextCheckin.location || '';
                                    const snapshotCheckInTime = nextCheckin.time;
                                    const targetCategory = categories.find(c => {
                                      const name = String(c).toLowerCase();
                                      return name.includes('other');
                                    }) || categories.find(c => !isAccommodation(c)) || 'Other';
                                    const snapshotDate = dateStr;

                                    return (
                                      <div className="mx-1 my-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                          <span className="text-2xl shrink-0">🧳</span>
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-amber-900">You're arriving at {snapshotArrivalTime} — check-in isn't until {snapshotCheckInTime}!</p>
                                            <p className="text-xs text-amber-700 mt-0.5">Would you like to drop your luggage off at {hotelName} first?</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              setDismissedLuggageSuggestions(prev => new Set([...prev, snapshotTransitItemId]));
                                              try {
                                                const luggageItem = {
                                                  title: `Drop luggage at ${hotelName}`,
                                                  time: snapshotArrivalTime,
                                                  date: snapshotDate,
                                                  category: 'Luggage Drop',
                                                  location: hotelLocation,
                                                  details: 'Drop luggage before check-in time.',
                                                  cost: 0,
                                                  paidInAdvance: false,
                                                  highlighted: false,
                                                  createdAt: new Date()
                                                };
                                                const docRef = await addDoc(collection(db, 'trips', tripId, 'itinerary'), luggageItem);
                                                setItineraryItems(prev => [...prev, { id: docRef.id, ...luggageItem }]);
                                              } catch (err) { console.error('Error adding luggage drop activity:', err); }
                                            }}
                                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                          >
                                            Yes, add it
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDismissedLuggageSuggestions(prev => new Set([...prev, snapshotTransitItemId]))}
                                            className="text-xs text-amber-600 hover:text-amber-800 font-medium transition cursor-pointer px-1"
                                          >
                                            No thanks
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Travel Time Connector Strip */}
                                  {showTransit && (
                                    <div className="flex items-center gap-3 px-4 py-1.5 ml-8 sm:ml-9 text-slate-400 group/transit">
                                      {/* Vertical dotted connector lines */}
                                      <div className="w-0.5 h-6 border-l-2 border-dotted border-slate-200 self-stretch -my-1.5 shrink-0" />
                                      
                                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-full px-2.5 py-1 shadow-xs text-[11px] font-medium text-slate-500 transition">
                                        
                                        {/* Multi-mode Pill Selector */}
                                        <div className="flex items-center gap-1 bg-slate-100/60 border border-slate-200/50 rounded-lg p-0.5 shadow-2xs">
                                          {/* Drive Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [segmentKey]: 'DRIVE' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              preferredMode === 'DRIVE' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Driving as preferred mode"
                                          >
                                            <Car className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isDriveLoading, driveInfo)}</span>
                                            {fastestMode === 'DRIVE' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>

                                          {/* Walk Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [segmentKey]: 'WALK' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              preferredMode === 'WALK' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Walking as preferred mode"
                                          >
                                            <Footprints className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isWalkLoading, walkInfo)}</span>
                                            {fastestMode === 'WALK' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>

                                          {/* Transit Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTravelModes(prev => {
                                                const updated = { ...prev, [segmentKey]: 'TRANSIT' };
                                                localStorage.setItem('travelHubPreferredModes', JSON.stringify(updated));
                                                return updated;
                                              });
                                            }}
                                            disabled={isGuest}
                                            className={`relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                                              preferredMode === 'TRANSIT' 
                                                ? 'bg-white text-slate-800 shadow-2xs' 
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                            title="Set Transit as preferred mode"
                                          >
                                            <Train className="w-3.5 h-3.5" />
                                            <span>{getModeDurationText(isTransitLoading, transitInfo)}</span>
                                            {fastestMode === 'TRANSIT' && (
                                              <span className="absolute -top-1 -right-0.5 flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                              </span>
                                            )}
                                          </button>
                                        </div>

                                        {/* Distance Details */}
                                        {distanceDisplay}

                                        {/* External link to Google Maps */}
                                        <a 
                                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.location)}&destination=${encodeURIComponent(nextItem.location)}&travelmode=${preferredMode === 'DRIVE' ? 'driving' : (preferredMode === 'WALK' ? 'walking' : 'transit')}`}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-slate-400 hover:text-blue-600 transition ml-0.5"
                                          title="Open Directions in Google Maps"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                                        {(() => {
                      const mapActivities = [...intermediateAccommodations, ...items].filter(a => a.location);
                      return mapActivities.length > 0 ? (
                        <DailyMapView 
                          activities={mapActivities} 
                          currency={currency} 
                          destination={tripDestination} 
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
