// src/components/TripAdminModal.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { X, Users, Link as LinkIcon, Shield, Trash2, Plus, ExternalLink, Globe } from 'lucide-react';

export default function TripAdminModal({ tripId, isOpen, onClose, userRole }) {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [vaultLinks, setVaultLinks] = useState([]);
  
  // Vault Form States
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState('Booking');

  const isOwner = userRole?.toLowerCase() === 'owner';

  useEffect(() => {
    if (!isOpen || !tripId) return;

    async function fetchAdminData() {
      try {
        // Fetch trip members/collaborators
        const membersSnap = await getDocs(collection(db, "trips", tripId, "members"));
        setMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch vault links
        const vaultSnap = await getDocs(collection(db, "trips", tripId, "vault"));
        setVaultLinks(vaultSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
    }
    fetchAdminData();
  }, [isOpen, tripId]);

  const handleRoleChange = async (memberId, newRole) => {
    if (!isOwner) return;
    try {
      await updateDoc(doc(db, "trips", tripId, "members", memberId), { role: newRole });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (err) {
      console.error("Error updating role:", err);
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
      const docRef = await addDoc(collection(db, "trips", tripId, "vault"), newLink);
      setVaultLinks(prev => [...prev, { id: docRef.id, ...newLink }]);
      setLinkTitle('');
      setLinkUrl('');
    } catch (err) {
      console.error("Error adding link:", err);
    }
  };

  const handleDeleteLink = async (linkId) => {
    try {
      await deleteDoc(doc(db, "trips", tripId, "vault", linkId));
      setVaultLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err) {
      console.error("Error deleting link:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Trip Administration Hub</h3>
            <p className="text-xs text-slate-500">Manage travelers, permissions, and reference links</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 transition cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
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
          
          {/* TAB 1: MEMBERS & ROLES */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm">Trip Party Members</h4>
                <span className="text-xs text-slate-500">{members.length} Total</span>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                  No member records found for this trip.
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{member.name || member.email}</p>
                        <p className="text-[11px] text-slate-500">{member.email}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        <select 
                          value={member.role || 'Guest'} 
                          disabled={!isOwner}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
                        >
                          <option value="Owner">Owner</option>
                          <option value="Collaborator">Collaborator</option>
                          <option value="Guest">Guest</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                      placeholder="Title (e.g. Flight Booking Confirmation PDF)" 
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
                      placeholder="https://drive.google.com/... or booking portal URL" 
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
                    No reference links added yet. Save booking URLs or cloud documents here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vaultLinks.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
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