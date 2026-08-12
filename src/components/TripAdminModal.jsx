// src/components/TripAdminModal.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { X, Users, Link as LinkIcon, Shield, Trash2, Plus, ExternalLink, Globe, UserPlus, AlertTriangle, Tag, Download } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currencyUtils';

const DEFAULT_CATEGORIES = ['Tour', 'Meal', 'Museum', 'Transport', 'Accommodation', 'Other'];

export default function TripAdminModal({ isOpen, onClose, currentUser, onDeleteTrip }) {
  const [authorizedTrips, setAuthorizedTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  
  const [membersMap, setMembersMap] = useState({});
  const [vaultLinks, setVaultLinks] = useState([]);
  const [selectedTripRole, setSelectedTripRole] = useState('Guest');
  
  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('collaborator');

  // Vault Form States
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState('Booking');

  // Universal Categories State
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newCatName, setNewCatName] = useState('');
  const [selectedTripData, setSelectedTripData] = useState(null);
  const [selectedItineraryItems, setSelectedItineraryItems] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    async function fetchAdminData() {
      try {
        // Fetch Trips
        const snap = await getDocs(collection(db, "trips"));
        const tripList = [];

        for (const docSnap of snap.docs) {
          const tripData = docSnap.data();
          const tripId = docSnap.id;

          const memberData = tripData.members && tripData.members[currentUser.uid];
          const memberRole = typeof memberData === 'object' ? memberData?.role : memberData;

          if (memberRole || tripData.createdBy === currentUser.uid) {
            tripList.push({
              id: tripId,
              title: tripData.title || 'Untitled Trip',
              destination: tripData.destination || '',
              userRole: memberRole ? memberRole.toUpperCase() : 'OWNER',
              members: tripData.members || { [currentUser.uid]: { role: 'owner', email: currentUser.email } }
            });
          }
        }

        setAuthorizedTrips(tripList);
        if (tripList.length > 0) {
          setSelectedTripId(tripList[0].id);
          setSelectedTripRole(tripList[0].userRole);
          setMembersMap(tripList[0].members);
        }

        // Fetch Global Categories
        const catSnap = await getDoc(doc(db, "settings", "global_categories"));
        if (catSnap.exists() && catSnap.data().list) {
          setCategories(catSnap.data().list);
        } else {
          await setDoc(doc(db, "settings", "global_categories"), { list: DEFAULT_CATEGORIES });
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
    }
    fetchAdminData();
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!selectedTripId) return;

    async function fetchTripDetails() {
      try {
        const vaultSnap = await getDocs(collection(db, "trips", selectedTripId, "vault"));
        setVaultLinks(vaultSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const tripSnap = await getDoc(doc(db, "trips", selectedTripId));
        if (tripSnap.exists()) {
          setSelectedTripData({ id: tripSnap.id, ...tripSnap.data() });
        } else {
          setSelectedTripData(null);
        }

        const itinerarySnap = await getDocs(query(collection(db, "trips", selectedTripId, "itinerary"), orderBy("date", "asc")));
        const itineraryItems = itinerarySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        itineraryItems.sort((a, b) => {
          const aDate = a.date || 'ZZZZ-ZZ-ZZ';
          const bDate = b.date || 'ZZZZ-ZZ-ZZ';
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return String(a.time || '').localeCompare(String(b.time || ''));
        });
        setSelectedItineraryItems(itineraryItems);

        const currentTrip = authorizedTrips.find(t => t.id === selectedTripId);
        if (currentTrip) {
          setSelectedTripRole(currentTrip.userRole);
          setMembersMap(currentTrip.members || {});
        }
      } catch (err) {
        console.error("Error fetching trip details:", err);
      }
    }
    fetchTripDetails();
  }, [selectedTripId, authorizedTrips]);

  const handleTripSelect = (e) => {
    const tripId = e.target.value;
    setSelectedTripId(tripId);
    const trip = authorizedTrips.find(t => t.id === tripId);
    if (trip) {
      setSelectedTripRole(trip.userRole);
      setMembersMap(trip.members || {});
    }
  };

  const isOwner = selectedTripRole?.toUpperCase() === 'OWNER';

  const formatPdfDateHeading = (dateStr) => {
    if (!dateStr || dateStr === 'Unscheduled') return 'Unscheduled Activities';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const ensurePdfPage = (pdf, y) => {
    const pageHeight = pdf.internal.pageSize.height;
    if (y > pageHeight - 80) {
      pdf.addPage();
      return 40;
    }
    return y;
  };

  const exportTripPdf = async () => {
    if (!selectedTripData) return;
    setExportingPdf(true);
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule;
      const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
      const left = 40;
      const pageWidth = (pdf.internal && pdf.internal.pageSize && (pdf.internal.pageSize.getWidth ? pdf.internal.pageSize.getWidth() : pdf.internal.pageSize.width)) || 612;
      const rightBoundary = pageWidth - 40;
      let y = 40;

      pdf.setFontSize(18);
      const tripTitle = selectedTripData.title || 'Trip Itinerary';
      const destination = selectedTripData.destination || '—';
      // Title left, destination right-aligned
      pdf.text(tripTitle, left, y);
      try {
        pdf.text(destination, rightBoundary, y, { align: 'right' });
      } catch (e) {
        // fallback for older jsPDF versions
        const destWidth = pdf.getTextWidth ? pdf.getTextWidth(destination) : destination.length * 6;
        pdf.text(destination, rightBoundary - destWidth, y);
      }
      y += 24;
      const grandTotalCost = selectedItineraryItems.reduce((s, it) => s + (Number(it.cost) || 0), 0);
      pdf.setDrawColor(220);
      pdf.setLineWidth(0.5);
      pdf.line(left, y, rightBoundary, y);
      y += 20;

      // Dates, Status and Currency on same line
      pdf.setFontSize(11);
      pdf.setTextColor('#1f2937');
      const formatShortDate = (d) => {
        if (!d) return '—';
        const dt = new Date(d + 'T00:00:00');
        if (isNaN(dt.getTime())) return d;
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${String(dt.getDate()).padStart(2,'0')}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
      };
      const startShort = formatShortDate(selectedTripData.startDate);
      const endShort = formatShortDate(selectedTripData.endDate);
      const datesLine = `Dates: ${startShort} to ${endShort}`;
      const statusLine = `Status: ${selectedTripData.status || 'Planning'}`;
      const currencySymbol = getCurrencySymbol(selectedTripData.currency || 'EUR');
      const currencyLine = `Currency: ${selectedTripData.currency || 'EUR'} (${currencySymbol})`;
      // Justify Dates (left), Status (center), Currency (right) across the header
      pdf.text(datesLine, left, y);
      const mid = left + ((rightBoundary - left) / 2);
      try { pdf.text(statusLine, mid, y, { align: 'center' }); }
      catch (e) { pdf.text(statusLine, mid, y); }
      try { pdf.text(currencyLine, rightBoundary, y, { align: 'right' }); }
      catch (e) { pdf.text(currencyLine, rightBoundary - (currencyLine.length * 6), y); }
      y += 18;
      y += 8;

      // We'll render per-date, including multi-day accommodations on each day they span
      // Build a set of all dates that should appear in the PDF by expanding multi-day accommodations
      const dateSet = new Set();
      const pushDate = (d) => dateSet.add(d);
      const addRange = (startStr, endStr) => {
        if (!startStr) return;
        const start = new Date(startStr + 'T00:00:00');
        const end = new Date((endStr || startStr) + 'T00:00:00');
        const curr = new Date(start);
        while (curr <= end) {
          const s = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
          dateSet.add(s);
          curr.setDate(curr.getDate() + 1);
        }
      };

      selectedItineraryItems.forEach(item => {
        if (item.date) {
          const cat = String(item.category || '').toLowerCase();
          if (cat === 'accommodation') {
            addRange(item.date, item.endDate);
          } else {
            pushDate(item.date);
          }
        } else {
          pushDate('Unscheduled');
        }
      });

      const orderedKeys = Array.from(dateSet);
      if (orderedKeys.length === 0) orderedKeys.push('Unscheduled');

      for (const dateKey of orderedKeys) {
        y = ensurePdfPage(pdf, y);
        pdf.setFontSize(12);
        pdf.setTextColor('#111827');
        pdf.text(formatPdfDateHeading(dateKey), left, y);
        y += 16;

        // items for this date: include activities with matching date, plus accommodations that span this date
        const items = selectedItineraryItems.filter(item => {
          const cat = String(item.category || '').toLowerCase();
          if (cat === 'accommodation') {
            if (!item.date) return false;
            const start = item.date;
            const end = item.endDate || item.date;
            return start <= dateKey && end >= dateKey;
          }
          return item.date === dateKey;
        });

        // sort: accommodations first, except check-in items should render after pre-15:00 scheduled items
        const getSortTime = (item) => {
          const cat = String(item.category || '').toLowerCase();
          const isAccommodation = cat === 'accommodation';
          const isCheckIn = isAccommodation && item.date === dateKey;
          if (isCheckIn) return '15:00';
          if (isAccommodation) return '00:00';
          if (!item.time || item.time === 'Flexible') return '00:01';
          return item.time;
        };

        items.sort((a, b) => {
          const aTime = getSortTime(a);
          const bTime = getSortTime(b);
          if (aTime !== bTime) return aTime.localeCompare(bTime);
          const aAcc = String(a.category || '').toLowerCase() === 'accommodation';
          const bAcc = String(b.category || '').toLowerCase() === 'accommodation';
          if (aAcc && !bAcc) return -1;
          if (!aAcc && bAcc) return 1;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });
        if (items.length === 0) {
          pdf.setFontSize(10);
          pdf.setTextColor('#475569');
          pdf.text('No activities planned today', left + 10, y);
          y += 16;
          continue;
        }

        const accommodationOnly = items.filter(item => String(item.category || '').toLowerCase() === 'accommodation');
        const nonAccommodationItems = items.filter(item => String(item.category || '').toLowerCase() !== 'accommodation');

        // track day total
        const dayTotal = items.reduce((s,i)=>s + (Number(i.cost) || 0), 0);

        for (const item of items) {
          y = ensurePdfPage(pdf, y);
          pdf.setFontSize(10);
          pdf.setTextColor('#111827');
          // Build activity line(s)
          const isAccommodation = String(item.category || '').toLowerCase() === 'accommodation';
          const activityTime = item.time || 'Anytime';
          const activityType = item.category || 'General';
          const activityTitle = item.title || 'Untitled';

          let titleText;
          if (isAccommodation) {
            const isCheckIn = item.date === dateKey;
            const isCheckOut = item.endDate === dateKey;
            if (isCheckIn) titleText = `• Check-in: ${activityTitle}`;
            else if (isCheckOut) titleText = `• Check-out: ${activityTitle}`;
            else titleText = `• Accommodation: ${activityTitle}`;
          } else {
            titleText = `• ${activityTime} - ${activityType} - ${activityTitle}`;
          }

          // Strip emoji and invisible/formatting characters before rendering text — jsPDF fonts don't include emoji glyphs
          const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}]/gu;
          const invisibleRegex = /[\u200B-\u200F\uFE00-\uFE0F\u2060-\u206F\u200D]/g;
          const combiningMarks = /[\u0300-\u036F]/g;
          let sanitized = titleText.replace(emojiRegex, '');
          sanitized = sanitized.replace(invisibleRegex, '');
          sanitized = sanitized.replace(combiningMarks, '');
          sanitized = sanitized.replace(/\s+/g, ' ').trim();
          const finalText = sanitized.length ? sanitized : '(details omitted)';
          const titleLines = pdf.splitTextToSize(finalText, rightBoundary - left);
          pdf.text(titleLines, left + 10, y);
          y += titleLines.length * 14;

          if (item.location) {
            y = ensurePdfPage(pdf, y);
            pdf.setFontSize(9);
            pdf.setTextColor('#334155');
            pdf.text(`Location: ${item.location}`, left + 24, y);
            y += 12;
          }

          const cost = Number(item.cost) || 0;
          if (cost) {
            y = ensurePdfPage(pdf, y);
            pdf.setFontSize(9);
            pdf.setTextColor('#334155');
            pdf.text(`Cost: ${currencySymbol} ${cost.toFixed(2)}`, left + 24, y);
            y += 12;
          }

          if (item.details && item.details.toString().trim()) {
            y = ensurePdfPage(pdf, y);
            pdf.setFontSize(9);
            pdf.setTextColor('#475569');
            const detailsLines = pdf.splitTextToSize(`Notes: ${item.details.toString().trim()}`, rightBoundary - left - 24);
            pdf.text(detailsLines, left + 24, y);
            y += detailsLines.length * 12;
          }

          y += 10;
        }
        if (accommodationOnly.length > 0 && nonAccommodationItems.length === 0) {
          y = ensurePdfPage(pdf, y);
          pdf.setFontSize(10);
          pdf.setTextColor('#64748b');
          try {
            pdf.setFont('helvetica', 'italic');
          } catch (e) {
            pdf.setFontStyle && pdf.setFontStyle('italic');
          }
          pdf.text('No activities planned', left + 24, y);
          try {
            pdf.setFont('helvetica', 'normal');
          } catch (e) {
            pdf.setFontStyle && pdf.setFontStyle('normal');
          }
          y += 16;
        }
        // Day total line
        y = ensurePdfPage(pdf, y);
        pdf.setFontSize(10);
        pdf.setTextColor('#0f172a');
        const dayTotalText = `Daily Total: ${getCurrencySymbol(selectedTripData.currency || 'EUR')} ${dayTotal.toFixed(2)}`;
        try { pdf.text(dayTotalText, rightBoundary, y, { align: 'right' }); } catch (e) { pdf.text(dayTotalText, rightBoundary - dayTotalText.length*6, y); }
        y += 18;
        y = ensurePdfPage(pdf, y);
        pdf.setDrawColor(230);
        pdf.setLineWidth(0.5);
        pdf.line(left, y, rightBoundary, y);
        y += 18;
      }

      // Grand total
      y = ensurePdfPage(pdf, y);
      pdf.setFontSize(12);
      pdf.setTextColor('#111827');
      const grandTotalText = `Grand Total: ${getCurrencySymbol(selectedTripData.currency || 'EUR')} ${grandTotalCost.toFixed(2)}`;
      pdf.text(grandTotalText, left, y);
      y += 18;

      // Add page numbers in footer
      const pageCount = pdf.getNumberOfPages ? pdf.getNumberOfPages() : (pdf.internal && pdf.internal.getNumberOfPages ? pdf.internal.getNumberOfPages() : 1);
      const pageHeight = pdf.internal.pageSize.height;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor('#94a3b8');
        const footerText = `Page ${i} of ${pageCount}`;
        try { pdf.text(footerText, rightBoundary, pageHeight - 18, { align: 'right' }); }
        catch (e) { pdf.text(footerText, rightBoundary - footerText.length*6, pageHeight - 18); }
      }

      const fileName = `${(selectedTripData.title || 'trip-itinerary').replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Unable to export itinerary PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleRoleChange = async (targetKey, newRole) => {
    if (!isOwner) return;
    try {
      const updatedMembers = { ...membersMap };
      if (typeof updatedMembers[targetKey] === 'object') {
        updatedMembers[targetKey].role = newRole;
      } else {
        updatedMembers[targetKey] = newRole;
      }

      const tripRef = doc(db, "trips", selectedTripId);
      await updateDoc(tripRef, { members: updatedMembers });

      setMembersMap(updatedMembers);
      setAuthorizedTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, members: updatedMembers } : t));
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  const handleRemoveMember = async (targetKey) => {
    if (!isOwner) return;
    try {
      const updatedMembers = { ...membersMap };
      delete updatedMembers[targetKey];

      const tripRef = doc(db, "trips", selectedTripId);
      await updateDoc(tripRef, { members: updatedMembers });

      setMembersMap(updatedMembers);
      setAuthorizedTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, members: updatedMembers } : t));
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isOwner) return;

    const emailTrimmed = inviteEmail.trim().toLowerCase();
    try {
      const updatedMembers = {
        ...membersMap,
        [emailTrimmed]: { role: inviteRole, email: emailTrimmed }
      };

      const tripRef = doc(db, "trips", selectedTripId);
      await updateDoc(tripRef, { members: updatedMembers });

      setMembersMap(updatedMembers);
      setAuthorizedTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, members: updatedMembers } : t));
      setInviteEmail('');
      alert("Collaborator added successfully!");
    } catch (err) {
      console.error("Error adding member:", err);
    }
  };

  const handleDeleteTrip = async () => {
    if (!isOwner) return;
    const currentTrip = authorizedTrips.find(t => t.id === selectedTripId);
    const tripTitle = currentTrip ? currentTrip.title : 'this trip';

    const confirmed = window.confirm(`Are you sure you want to cancel/delete "${tripTitle}"? This will permanently delete all itinerary activities and vault links.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "trips", selectedTripId));
      if (onDeleteTrip) onDeleteTrip(selectedTripId);
      alert("Trip deleted successfully.");
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error deleting trip:", err);
      alert("Failed to delete trip.");
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    try {
      const newLink = {
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        category: linkCategory,
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, "trips", selectedTripId, "vault"), newLink);
      setVaultLinks(prev => [...prev, { id: docRef.id, ...newLink }]);
      setLinkTitle('');
      setLinkUrl('');
    } catch (err) {
      console.error("Error adding link:", err);
    }
  };

  const handleDeleteLink = async (linkId) => {
    try {
      await deleteDoc(doc(db, "trips", selectedTripId, "vault", linkId));
      setVaultLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err) {
      console.error("Error deleting link:", err);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const formatted = newCatName.trim();
    if (!formatted || categories.includes(formatted)) return;

    const updated = [...categories, formatted].sort((a, b) => a.localeCompare(b));
    try {
      await setDoc(doc(db, "settings", "global_categories"), { list: updated });
      setCategories(updated);
      setNewCatName('');
    } catch (err) {
      console.error("Error saving global category:", err);
    }
  };

  const handleDeleteCategory = async (catToDelete) => {
    if (categories.length <= 1) {
      alert("You must keep at least one category.");
      return;
    }
    const updated = categories.filter(c => c !== catToDelete);
    try {
      await setDoc(doc(db, "settings", "global_categories"), { list: updated });
      setCategories(updated);
    } catch (err) {
      console.error("Error deleting global category:", err);
    }
  };

  if (!isOpen) return null;

  const memberEntries = Object.entries(membersMap).map(([key, val]) => {
    const role = typeof val === 'object' ? val?.role : val;
    const email = typeof val === 'object' ? val?.email : (key.includes('@') ? key : (key === currentUser.uid ? currentUser.email : `User (${key.substring(0, 6)}...)`));
    return {
      key,
      email: email || key,
      role: (role || 'guest').toLowerCase()
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Settings & Vault</h3>
            <p className="text-xs text-slate-500">Manage members, global categories, and trip reference documents</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Trip Selector Bar */}
        <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between gap-4">
          <label className="text-xs font-bold text-blue-900 uppercase tracking-wider shrink-0">Select Trip:</label>
          <select 
            value={selectedTripId} 
            onChange={handleTripSelect}
            className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 cursor-pointer shadow-sm"
          >
            {authorizedTrips.length === 0 ? (
              <option value="">No managed trips available</option>
            ) : (
              authorizedTrips.map(trip => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({trip.destination || 'No Destination'}) — Role: {trip.userRole}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Users className="w-4 h-4" /> Travelers & Roles
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${activeTab === 'vault' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <LinkIcon className="w-4 h-4" /> Documents & Links Vault
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${activeTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Tag className="w-4 h-4" /> Activity Types
          </button>
          <button 
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${activeTab === 'export' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          
          {/* TAB 1: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {isOwner && (
                <form onSubmit={handleAddMember} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add Traveler</h4>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      placeholder="traveler@example.com" 
                      value={inviteEmail} 
                      onChange={(e) => setInviteEmail(e.target.value)} 
                      required 
                      className="flex-grow bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                    />
                    <select 
                      value={inviteRole} 
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
                    >
                      <option value="owner">Owner</option>
                      <option value="collaborator">Collaborator</option>
                      <option value="guest">Guest</option>
                    </select>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">Trip Party Members</h4>
                <div className="space-y-2">
                  {memberEntries.map(member => (
                    <div key={member.key} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{member.email}</p>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {member.key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        <select 
                          value={member.role}
                          disabled={!isOwner}
                          onChange={(e) => handleRoleChange(member.key, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
                        >
                          <option value="owner">Owner</option>
                          <option value="collaborator">Collaborator</option>
                          <option value="guest">Guest</option>
                        </select>
                        {isOwner && member.key !== currentUser.uid && (
                          <button onClick={() => handleRemoveMember(member.key)} className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isOwner && (
                <div className="pt-6 border-t border-red-100 space-y-3">
                  <h4 className="font-bold text-red-600 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                  </h4>
                  <div className="p-4 bg-red-50/50 rounded-2xl border border-red-200 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-red-900 text-xs">Cancel & Delete This Trip</p>
                      <p className="text-[11px] text-red-700">Permanently removes this trip and its itinerary.</p>
                    </div>
                    <button onClick={handleDeleteTrip} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Trip
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VAULT LINKS */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              <form onSubmit={handleAddLink} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add Reference Link</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input type="text" placeholder="Title (e.g. Flight Confirmation)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" />
                  </div>
                  <div>
                    <select value={linkCategory} onChange={(e) => setLinkCategory(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer">
                      <option value="Booking">Booking</option>
                      <option value="Flight">Flight</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Guide">Guide</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <input type="url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Save Link
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">Saved Resources & Documents</h4>
                {vaultLinks.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">No reference links added yet.</div>
                ) : (
                  <div className="space-y-2">
                    {vaultLinks.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Globe className="w-4 h-4" /></div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{link.title}</p>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">{link.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 transition" title="Open"><ExternalLink className="w-4 h-4" /></a>
                          <button onClick={() => handleDeleteLink(link.id)} className="p-2 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT PDF */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <h4 className="font-bold text-slate-800 text-sm">Export Trip Itinerary</h4>
                <p className="text-xs text-slate-500 mt-1">Generate a simplified PDF version of the selected trip.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">The PDF includes:</p>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                      <li>Trip Title, Destination, Dates, Status, Currency</li>
                      <li>Day-by-day itinerary activities</li>
                      <li>Activity location, cost, and notes (when present)</li>
                    </ul>
                  </div>
                  <button
                    onClick={exportTripPdf}
                    disabled={!selectedTripData || exportingPdf}
                    className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-3 rounded-2xl transition shadow-sm ${selectedTripData && !exportingPdf ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >
                    <Download className="w-4 h-4" />
                    {exportingPdf ? 'Exporting…' : 'Download PDF'}
                  </button>
                </div>

                {!selectedTripData && (
                  <div className="mt-4 text-xs text-slate-500">Select a trip at the top to export its itinerary.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: UNIVERSAL CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Universal Activity Types</h4>
                <p className="text-xs text-slate-500 mt-0.5">Categories added here instantly populate dropdowns across all trips.</p>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="New Category (e.g. Adventure, Coffee)" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required 
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add Type
                </button>
              </form>

              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-blue-600" /> {cat}
                    </span>
                    <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl text-xs cursor-pointer">
            Done
          </button>
        </div>

      </div>
    </div>
  );
}