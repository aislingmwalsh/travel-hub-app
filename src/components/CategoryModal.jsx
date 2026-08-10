// src/components/CategoryModal.jsx
import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function CategoryModal({ tripId, isOpen, onClose, categories, setCategories, sortedCategories }) {
  const [newCategoryName, setNewCategoryName] = useState('');

  if (!isOpen) return null;

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || categories.includes(newCategoryName.trim())) return;
    const updated = [...categories, newCategoryName.trim()];
    setCategories(updated);
    setNewCategoryName('');
    await setDoc(doc(db, "trips", tripId, "settings", "categories"), { list: updated });
  };

  const handleDeleteCategory = async (catToDelete) => {
    if (categories.length <= 1) return alert("Must have at least one category.");
    const updated = categories.filter(c => c !== catToDelete);
    setCategories(updated);
    await setDoc(doc(db, "trips", tripId, "settings", "categories"), { list: updated });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"><X className="w-4 h-4" /></button>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Manage Activity Types</h2>
        <p className="text-sm text-slate-500 mb-6">Add or remove custom categories.</p>
        
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
          <input type="text" placeholder="e.g., Flight, Hiking" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none" />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl text-sm">Add</button>
        </form>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {sortedCategories.map(cat => (
            <div key={cat} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-800 text-sm">{cat}</span>
              <button onClick={() => handleDeleteCategory(cat)} className="text-slate-400 hover:text-red-500 p-1.5 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}