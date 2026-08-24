// src/components/TripMembersModal.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Users, UserPlus, Trash2, Shield, Mail, X } from 'lucide-react';

export default function TripMembersModal({ tripId, isOpen, onClose }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Collaborator'); // Owner, Collaborator, Guest
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMembers() {
      if (!tripId) return;
      const querySnapshot = await getDocs(collection(db, "trips", tripId, "members"));
      setMembers(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    if (isOpen) fetchMembers();
  }, [tripId, isOpen]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // 1. Add member record to Firestore
      const memberData = { email: email.trim(), role, status: 'invited', createdAt: new Date() };
      const docRef = await addDoc(collection(db, "trips", tripId, "members"), memberData);

      // 2. Queue email via Firebase Trigger Email extension collection
      await addDoc(collection(db, "mail"), {
        to: email.trim(),
        message: {
          subject: `You've been invited to join a trip!`,
          text: `You have been added as a ${role} to a shared trip. Log in to view and collaborate!`,
          html: `<p>You have been added as a <strong>${role}</strong> to a shared trip.</p><p><a href="${window.location.origin}/trip/${tripId}">Click here to view the trip</a></p>`
        }
      });

      setMembers(prev => [...prev, { id: docRef.id, ...memberData }]);
      setEmail('');
    } catch (error) {
      console.error("Error inviting member:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await deleteDoc(doc(db, "trips", tripId, "members", memberId));
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-8 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Manage Trip Travelers</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">Assign roles to control who can edit the trip itinerary or view details.</p>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                placeholder="colleague@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none font-medium"
            >
              <option value="Guest">Guest (Read-only)</option>
              <option value="Collaborator">Collaborator (Edit Itinerary)</option>
              <option value="Owner">Owner (Full Control)</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> {loading ? 'Sending Invite...' : 'Send Email Invite'}
          </button>
        </form>

        {/* Members List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {members.map((member) => (
            <div key={member.id} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{member.email}</p>
                <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3" /> {member.role}
                </p>
              </div>
              <button 
                onClick={() => handleRemoveMember(member.id)}
                className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition"
                title="Remove access"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
