import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Mail, Check, Square, CheckSquare, User, Loader2, History, AlertCircle, CheckCircle } from 'lucide-react';

export default function PackingList({ tripId, tripMembers = {}, userNamesMap = {}, userRole = 'Guest', tripTitle = 'Our Trip' }) {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [emailNotice, setEmailNotice] = useState('');
  const [recentEmails, setRecentEmails] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  const isGuest = userRole === 'Guest';

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "mail"),
      where("senderUid", "==", auth.currentUser.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in-memory to avoid composite index requirements
      logs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return timeB - timeA;
      });
      setRecentEmails(logs.slice(0, 5));
    }, (error) => {
      console.error("Error fetching mail logs:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!tripId) return;
    async function fetchPackingList() {
      try {
        const docRef = doc(db, "trips", tripId, "settings", "packing_list");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().items) {
          setItems(docSnap.data().items);
        }
      } catch (err) {
        console.error("Error fetching packing list:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPackingList();
  }, [tripId]);

  const saveItemsToFirestore = async (newItems) => {
    try {
      const docRef = doc(db, "trips", tripId, "settings", "packing_list");
      await updateDoc(docRef, { items: newItems });
      setItems(newItems);
    } catch (err) {
      console.error("Error saving packing list items:", err);
      alert("Failed to save packing list change.");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || isGuest) return;

    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newItemName.trim(),
      claimedBy: null,
      claimedByName: '',
      packed: false
    };

    const updated = [...items, newItem];
    await saveItemsToFirestore(updated);
    setNewItemName('');
  };

  const handleDeleteItem = async (itemId) => {
    if (isGuest) return;
    const updated = items.filter(item => item.id !== itemId);
    await saveItemsToFirestore(updated);
  };

  const handleTogglePacked = async (itemId) => {
    if (isGuest) return;
    const updated = items.map(item => {
      if (item.id === itemId) {
        return { ...item, packed: !item.packed };
      }
      return item;
    });
    await saveItemsToFirestore(updated);
  };

  const handleAssignItem = async (itemId, targetUid) => {
    if (isGuest) return;
    const updated = items.map(item => {
      if (item.id === itemId) {
        if (!targetUid) {
          return { ...item, claimedBy: null, claimedByName: '' };
        }
        
        // Resolve display name or email
        const customName = userNamesMap[targetUid];
        const email = tripMembers[targetUid]?.email || '';
        const displayName = customName || email || 'Traveler';

        return { ...item, claimedBy: targetUid, claimedByName: displayName };
      }
      return item;
    });
    await saveItemsToFirestore(updated);
  };

  const handleEmailPackingList = async () => {
    if (items.length === 0 || emailing) return;
    setEmailing(true);
    setEmailNotice('');

    try {
      // Get all trip member email addresses
      const memberList = Object.entries(tripMembers).map(([uid, val]) => {
        const email = typeof val === 'object' ? val?.email : (uid.includes('@') ? uid : '');
        return { uid, email };
      }).filter(m => m.email);

      // Always include current logged in user to ensure they receive a copy
      const currentUserEmail = auth.currentUser?.email;
      if (currentUserEmail && !memberList.some(m => m.email.toLowerCase() === currentUserEmail.toLowerCase())) {
        memberList.push({ uid: auth.currentUser.uid, email: currentUserEmail });
      }

      console.log("Raw tripMembers:", tripMembers);
      console.log("Resolved memberList for emailing:", memberList);

      if (memberList.length === 0) {
        setEmailNotice('No members with valid emails found.');
        setEmailing(false);
        return;
      }

      // Generate clean HTML content for the email
      let listHtml = `<h2 style="font-family: sans-serif; color: #1e293b;">Shared Packing List: ${tripTitle}</h2>`;
      listHtml += `<p style="font-family: sans-serif; font-size: 14px; color: #475569;">Here is the coordinated packing list for our trip:</p>`;
      listHtml += `<table style="font-family: sans-serif; font-size: 13px; width: 100%; border-collapse: collapse; margin-top: 15px;">`;
      listHtml += `<thead><tr style="background-color: #f1f5f9; text-align: left;"><th style="padding: 10px; border: 1px solid #e2e8f0;">Item</th><th style="padding: 10px; border: 1px solid #e2e8f0;">Assigned To</th><th style="padding: 10px; border: 1px solid #e2e8f0;">Packed</th></tr></thead>`;
      listHtml += `<tbody>`;

      items.forEach(item => {
        const assigned = item.claimedByName || 'Unassigned';
        const isPacked = item.packed ? 'Yes ✅' : 'No ❌';
        listHtml += `<tr>`;
        listHtml += `<td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${item.name}</td>`;
        listHtml += `<td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${assigned}</td>`;
        listHtml += `<td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${isPacked}</td>`;
        listHtml += `</tr>`;
      });

      listHtml += `</tbody></table>`;
      listHtml += `<p style="font-family: sans-serif; font-size: 12px; color: #94a3b8; margin-top: 25px;">Sent from Travel Planner App ✈️</p>`;

      // Queue email for each member
      await Promise.all(memberList.map(member => 
        addDoc(collection(db, "mail"), {
          to: member.email,
          senderUid: auth.currentUser?.uid || '',
          createdAt: new Date(),
          message: {
            subject: `📋 Shared Packing List for ${tripTitle}`,
            html: listHtml,
            text: `Shared Packing List for ${tripTitle}. Go to travel planner app to claim/pack items.`
          }
        })
      ));

      console.log("Queued emails in /mail for members:", memberList);

      setEmailNotice(`Emailed to: ${memberList.map(m => m.email).join(', ')} ✉️`);
      setTimeout(() => setEmailNotice(''), 4000);
    } catch (err) {
      console.error("Error emailing packing list:", err);
      setEmailNotice('Failed to dispatch emails.');
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Members lists for dropdown
  const memberOptions = Object.entries(tripMembers).map(([uid, val]) => {
    const customName = userNamesMap[uid];
    const email = typeof val === 'object' ? val?.email : (uid.includes('@') ? uid : '');
    return {
      uid,
      displayName: customName || email || `User (${uid.substring(0, 6)}...)`
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Coordinated Packing List</h3>
          <p className="text-xs text-slate-500 mt-1">Claim items yourself or assign them to other trip travelers to make sure nothing gets left behind.</p>
        </div>
        
        {items.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            {emailNotice && <span className="text-xs font-semibold text-emerald-600 transition animate-fade-in">{emailNotice}</span>}
            <button
              onClick={handleEmailPackingList}
              disabled={emailing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition disabled:opacity-50"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              {emailing ? 'Emailing...' : 'Email List to Group'}
            </button>
          </div>
        )}
      </div>

      {/* Add Item Form */}
      {!isGuest && (
        <form onSubmit={handleAddItem} className="flex gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
          <input 
            type="text" 
            placeholder="Add packing item (e.g. Swimwear 🩱, Sunscreen 🧴)" 
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            required
            className="flex-grow bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
          />
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      )}

      {/* Packing items list */}
      {items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
          Your packing list is empty. Add some items to get started!
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20">
          {items.map(item => {
            const currentUserId = auth.currentUser?.uid;
            const isClaimedByMe = item.claimedBy === currentUserId;

            return (
              <div 
                key={item.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 transition ${
                  item.packed ? 'bg-slate-50/50' : 'bg-white'
                }`}
              >
                {/* Left side: Packed status and Item name */}
                <div className="flex items-center gap-3 min-w-0 flex-grow">
                  <button
                    disabled={isGuest}
                    onClick={() => handleTogglePacked(item.id)}
                    className={`shrink-0 transition cursor-pointer disabled:opacity-50 ${
                      item.packed ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'
                    }`}
                  >
                    {item.packed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>

                  <span className={`text-xs font-bold break-words min-w-0 ${
                    item.packed ? 'line-through text-slate-400 font-medium' : 'text-slate-800'
                  }`}>
                    {item.name}
                  </span>
                </div>

                {/* Right side: Claim selector and Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-8 sm:pl-0">
                  <div className="flex items-center gap-1.5">
                    <User className={`w-3.5 h-3.5 ${item.claimedBy ? 'text-blue-500' : 'text-slate-400'}`} />
                    <select
                      value={item.claimedBy || ''}
                      disabled={isGuest}
                      onChange={(e) => handleAssignItem(item.id, e.target.value)}
                      className={`bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer focus:outline-none max-w-[150px] sm:max-w-[200px] truncate ${
                        isClaimedByMe ? 'text-blue-700 bg-blue-50/50 border-blue-100 font-bold' : 'text-slate-600'
                      }`}
                    >
                      <option value="">Unassigned</option>
                      {memberOptions.map(member => (
                        <option key={member.uid} value={member.uid}>
                          {member.uid === currentUserId ? 'Me' : member.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isGuest && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Email Queue History Section */}
      <div className="pt-6 border-t border-slate-200 mt-8 space-y-4">
        <button
          onClick={() => setShowLogs(!showLogs)}
          type="button"
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer select-none"
        >
          <History className="w-4 h-4 text-blue-600" />
          {showLogs ? 'Hide Email Delivery Log' : 'Show Email Delivery Log'}
        </button>

        {showLogs && (
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-fade-in">
            <h4 className="text-xs font-bold text-slate-700">Email Delivery Log (Recent 5 runs)</h4>
            {recentEmails.length === 0 ? (
              <p className="text-[11px] text-slate-400">No emails sent by you in this session yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentEmails.map(log => {
                  let dateStr = 'Unknown';
                  try {
                    const time = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt || 0);
                    dateStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  } catch (e) {
                    console.error("Error parsing date:", e);
                  }
                  
                  const state = log.delivery?.state || 'QUEUED';
                  const error = log.delivery?.error || '';
                  
                  return (
                    <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-2">
                      <div>
                        <span className="font-bold text-slate-700">To: </span>
                        <span className="font-semibold text-blue-600">{log.to}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Sent at {dateStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {state === 'SUCCESS' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold text-[9px]">
                            <CheckCircle className="w-3.5 h-3.5" /> SUCCESS
                          </span>
                        )}
                        {state === 'ERROR' && (
                          <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold text-[9px]" title={error}>
                            <AlertCircle className="w-3.5 h-3.5" /> ERROR: {error || 'Failed'}
                          </span>
                        )}
                        {state !== 'SUCCESS' && state !== 'ERROR' && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold text-[9px]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {state}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

