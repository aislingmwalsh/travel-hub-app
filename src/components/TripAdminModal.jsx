// src/components/TripAdminModal.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { X, Users, Link as LinkIcon, Shield, Trash2, Plus, ExternalLink, Globe, UserPlus } from 'lucide-react';

export default function TripAdminModal({ isOpen, onClose, currentUser }) {
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

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    async function fetchAuthorizedTrips() {
      try {
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
      } catch (err) {
        console.error("Error fetching trips for admin modal:", err);
      }
    }
    fetchAuthorizedTrips();
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!selectedTripId) return;

    async function fetchTripDetails() {
      try {
        const vaultSnap = await getDocs(collection(db, "trips", selectedTripId, "vault"));
        setVaultLinks(vaultSnap.docs.map(d => ({ id: d.id, ...d.data() })));

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

  // Handle Role Change
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
      // Update local state in authorizedTrips
      setAuthorizedTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, members: updatedMembers } : t));
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role.");
    }
  };

  // Handle Removing Member
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
      alert("Failed to remove member.");
    }
  };

  // Handle Adding / Inviting Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isOwner) return;

    const emailTrimmed = inviteEmail.trim().toLowerCase();
    try {
      // Use email as the identifier key in the map for invited users without known UIDs yet
      const updatedMembers = {
        ...membersMap,
        [emailTrimmed]: {
          role: inviteRole,
          email: emailTrimmed
        }
      };

      const tripRef = doc(db, "trips", selectedTripId);
      await updateDoc(tripRef, { members: updatedMembers });

      setMembersMap(updatedMembers);
      setAuthorizedTrips(prev => prev.map(t => t.id === selectedTripId ? { ...t, members: updatedMembers } : t));
      setInviteEmail('');
      alert("Collaborator added successfully!");
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Failed to add collaborator.");
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

  if (!isOpen) return null;

  // Format member entries for rendering
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
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Settings & Vault</h3>
            <p className="text-xs text-slate-500">Manage members and reference documents across your managed trips</p>
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
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Users className="w-4 h-4" /> Travelers & Roles
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${activeTab === 'vault' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <LinkIcon className="w-4 h-4" /> Documents & Links Vault
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          
          {authorizedTrips.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No managed trips available.
            </div>
          ) : (
            <>
              {/* TAB 1: MEMBERS & ROLES */}
              {activeTab === 'members' && (
                <div className="space-y-6">
                  
                  {/* Add Member Form (Owner Only) */}
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
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm">Trip Party Members</h4>
                      <span className="text-xs text-slate-500">{memberEntries.length} Total</span>
                    </div>

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
                              <button 
                                onClick={() => handleRemoveMember(member.key)}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer"
                                title="Remove Member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DOCUMENTS & LINKS VAULT */}
              {activeTab === 'vault' && (
                <div className="space-y-6">
                  
                  {/* Add Link Form */}
                  <form onSubmit={handleAddLink} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add Reference Link</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input 
                          type="text" 
                          placeholder="Title (e.g. Flight Booking Confirmation)" 
                          value={linkTitle} 
                          onChange={(e) => setLinkTitle(e.target.value)} 
                          required 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                        />
                      </div>
                      <div>
                        <select 
                          value={linkCategory} 
                          onChange={(e) => setLinkCategory(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs cursor-pointer"
                        >
                          <option value="Booking">Booking</option>
                          <option value="Flight">Flight</option>
                          <option value="Hotel">Hotel</option>
                          <option value="Guide">Guide</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <input 
                          type="url" 
                          placeholder="https://drive.google.com/... or booking URL" 
                          value={linkUrl} 
                          onChange={(e) => setLinkUrl(e.target.value)} 
                          required 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" /> Save Link
                      </button>
                    </div>
                  </form>

                  {/* Links List */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">Saved Resources & Documents</h4>
                    {vaultLinks.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                        No reference links added yet for this trip.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {vaultLinks.map(link => (
                          <div key={link.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Globe className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-xs">{link.title}</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">{link.category}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-2 text-slate-400 hover:text-blue-600 transition" 
                                title="Open Link"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button 
                                onClick={() => handleDeleteLink(link.id)} 
                                className="p-2 text-slate-400 hover:text-red-500 transition cursor-pointer" 
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl text-xs cursor-pointer">
            Done
          </button>
        </div>

      </div>
    </div>
  );
}