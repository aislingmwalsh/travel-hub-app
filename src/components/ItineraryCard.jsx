// src/components/ItineraryCard.jsx
import React from 'react';
import { Clock, MapPin, Trash2, GripVertical, ChevronDown, ChevronUp, ExternalLink, FileText, Edit2, Save } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';

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

export default function ItineraryCard({
  item, index, currency,
  isExpanded, onToggleExpand,
  isEditing, onStartEdit, onSaveEdit, onCancelEdit, onDelete,
  editTitle, setEditTitle,
  editDate, setEditDate, effectiveStartDate, effectiveEndDate,
  editHour, setEditHour, editMinute, setEditMinute, hours, minutes,
  editCategory, setEditCategory, sortedCategories,
  editCost, setEditCost,
  editLocation, setEditLocation,
  editDetails, setEditDetails
}) {
  const badgeClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`;

  return (
    <Draggable key={item.id} draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={provided.draggableProps.style}
          onClick={() => { if (!isEditing) onToggleExpand(); }}
          className={`bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden ${snapshot.isDragging ? 'ring-2 ring-blue-500 shadow-xl bg-blue-50/20' : ''}`}
        >
          <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div {...provided.dragHandleProps} onClick={(e) => e.stopPropagation()} className="text-slate-300 hover:text-slate-500 cursor-grab p-1">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-blue-600" />{item.time}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h5 className="font-semibold text-slate-900 text-base">{item.title}</h5>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}>{item.category || 'Other'}</span>
                  {Number(item.cost) > 0 && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{currency} {Number(item.cost).toFixed(2)}</span>}
                </div>
                {item.location && <div className="flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" /><span>{item.location}</span></div>}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {!isEditing && <button onClick={onStartEdit} className="text-slate-400 hover:text-blue-600 p-2 transition" title="Edit"><Edit2 className="w-4 h-4" /></button>}
              <button onClick={onDelete} className="text-slate-400 hover:text-red-500 p-2 transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
              <div className="text-slate-400 p-1">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
            </div>
          </div>

          {isExpanded && (
            <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 border-t border-slate-100 p-5">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h6 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Activity</h6>
                    <button onClick={onCancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Cancel</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" min={effectiveStartDate} max={effectiveEndDate} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Time</label><div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm"><select value={editHour} onChange={(e) => setEditHour(e.target.value)} className="bg-transparent focus:outline-none">{hours.map(h => <option key={h} value={h}>{h}</option>)}</select><span>:</span><select value={editMinute} onChange={(e) => setEditMinute(e.target.value)} className="bg-transparent focus:outline-none">{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Type</label><select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">{sortedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cost ({currency})</label><input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div className="md:col-span-3"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Location</label><input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div className="md:col-span-3"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Details & Notes</label><textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" /></div>
                  </div>
                  <div className="flex justify-end pt-2"><button onClick={onSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"><Save className="w-3.5 h-3.5" /> Save Changes</button></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider"><FileText className="w-3.5 h-3.5 text-blue-600" />Activity Details & Notes</div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-slate-200">{item.details?.trim() ? item.details : "No additional notes provided."}</p>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider"><MapPin className="w-3.5 h-3.5 text-teal-500" />Location & Map</div>
                    <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" className="flex-grow bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-200 rounded-xl p-4 transition flex flex-col justify-between group shadow-sm">
                      <div><p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 mb-1 line-clamp-2">{item.location}</p><p className="text-[11px] text-slate-400">Click to open directions</p></div>
                      <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:underline"><span>Open in Google Maps</span><ExternalLink className="w-3.5 h-3.5" /></div>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}