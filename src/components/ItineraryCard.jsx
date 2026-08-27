// src/components/ItineraryCard.jsx
import React from 'react';
import { Clock, MapPin, Trash2, GripVertical, ChevronDown, ChevronUp, ExternalLink, FileText, Edit2, Save, Star, Luggage } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { auth } from '../firebase';

const isTransitCategory = (cat) => {
  if (!cat) return false;
  const name = String(cat).toLowerCase();
  return name.includes('flight') || name.includes('train') || name.includes('drive') || name.includes('transport');
};

const COLOR_MAP = {
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  pink: 'bg-pink-50 text-pink-700 border-pink-100',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  lime: 'bg-lime-50 text-lime-700 border-lime-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  stone: 'bg-stone-50 text-stone-700 border-stone-100',
  slate: 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function ItineraryCard({
  item, index, currency,
  isExpanded, onToggleExpand,
  isEditing, onStartEdit, onSaveEdit, onCancelEdit, onDelete,
  onToggleHighlight,
  editPaidInAdvance, setEditPaidInAdvance,
  editTitle, setEditTitle,
  editDate, setEditDate, effectiveStartDate, effectiveEndDate,
  editHour, setEditHour, editMinute, setEditMinute, hours, minutes,
  editCategory, setEditCategory, sortedCategories,
  editCost, setEditCost,
  editLocation, setEditLocation,
  editDetails, setEditDetails,
  editDestination, setEditDestination,
  editArrivalHour, setEditArrivalHour, editArrivalMinute, setEditArrivalMinute,
  isGuest,
  categoriesWithColors = []
}) {
  // Dynamically find color chosen from the global configuration
  const isLuggageDrop = item.category === 'Luggage Drop';
  const matchingCat = categoriesWithColors.find(c => c.name === item.category);
  const badgeColorKey = isLuggageDrop ? 'sky' : (matchingCat ? matchingCat.color : 'slate');
  const badgeClass = COLOR_MAP[badgeColorKey] || COLOR_MAP.slate;

  const mapsSearchUrl = item.destination
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.location)}&destination=${encodeURIComponent(item.destination)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`;

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <Draggable key={item.id} draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={provided.draggableProps.style}
          onClick={() => { if (!isEditing && !isExpanded) onToggleExpand(); }}
          className={`rounded-xl border transition overflow-hidden flex ${
            isEditing ? 'cursor-default ring-2 ring-blue-400' : 'cursor-pointer'
          } ${
            isLuggageDrop
              ? 'bg-sky-50/50 border-sky-100 shadow-xs hover:shadow-sm'
              : item.type === 'checkin'
                ? 'bg-white border-emerald-300 shadow-sm hover:shadow-md'
                : item.type === 'checkout'
                  ? 'bg-white border-rose-200 shadow-sm hover:shadow-md'
                  : item.highlighted 
                    ? 'border-amber-300 shadow-md ring-1 ring-amber-200 bg-amber-50/20 bg-white' 
                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
          } ${snapshot.isDragging ? 'ring-2 ring-blue-500 shadow-xl bg-blue-50/20' : ''}`}
        >
          {/* Drag Handle Column on Left */}
          {!isGuest && (
            <div 
              {...provided.dragHandleProps} 
              onClick={(e) => e.stopPropagation()} 
              className="w-7 sm:w-8 flex items-center justify-center bg-slate-50/30 hover:bg-slate-100/85 border-r border-slate-100 text-slate-300 hover:text-slate-500 cursor-grab transition shrink-0 self-stretch"
            >
              <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          )}

          {/* Main Card Body */}
          <div className="flex-grow flex flex-col min-w-0">
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              
              {/* Main Content */}
              <div className="min-w-0 flex-1">
                {/* Title and Inline Time */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-blue-600" />{item.time}
                  </span>
                  {item.arrivalTime && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-teal-500" />arr. {item.arrivalTime}
                    </span>
                  )}
                  <h5 className="font-semibold text-slate-900 text-base break-words flex items-center gap-1.5">
                    {isLuggageDrop && <Luggage className="w-4 h-4 text-sky-600 shrink-0" />}
                    {item.title}
                  </h5>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClass}`}>{item.category || 'Other'}</span>
                  {Number(item.cost) > 0 && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{currencySymbol} {Number(item.cost).toFixed(2)}</span>}
                  {item.paidInAdvance && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">Paid ✅</span>}
                  {item.highlighted && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">⭐ Highlighted</span>}
                </div>

                {/* Location */}
                {item.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    {item.destination ? (
                      <span className="break-words font-medium">
                        {item.location} <span className="text-slate-400 mx-1">➔</span> {item.destination}
                      </span>
                    ) : (
                      <span className="break-words">{item.location}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 self-end sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                {!isEditing && !isGuest && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (onToggleHighlight) onToggleHighlight(item.id, !item.highlighted); 
                    }} 
                    className={`p-2.5 transition cursor-pointer ${item.highlighted ? 'text-amber-500 fill-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
                    title={item.highlighted ? "Remove Highlight" : "Highlight Activity"}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}

                {!isEditing && !isGuest && (
                  <button 
                    onClick={onStartEdit} 
                    className="text-slate-400 hover:text-blue-600 p-2.5 transition cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}

                {!isGuest && (
                  <button 
                    onClick={onDelete} 
                    className="text-slate-400 hover:text-red-500 p-2.5 transition cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div 
                  onClick={onToggleExpand} 
                  className="text-slate-400 p-2.5 cursor-pointer hover:text-slate-600"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {/* Expanded Details View / Inline Editor */}
            {isExpanded && (
              <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 border-t border-slate-100 p-4 sm:p-5">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h6 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Editing Activity</h6>
                      <button onClick={onCancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer">Cancel</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Title</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                      <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" min={effectiveStartDate} max={effectiveEndDate} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                      <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Time</label><div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm"><select value={editHour} onChange={(e) => setEditHour(e.target.value)} className="bg-transparent focus:outline-none cursor-pointer">{hours.map(h => <option key={h} value={h}>{h}</option>)}</select><span>:</span><select value={editMinute} onChange={(e) => setEditMinute(e.target.value)} className="bg-transparent focus:outline-none cursor-pointer">{minutes.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Type</label>
                        <select 
                          value={editCategory} 
                          onChange={(e) => setEditCategory(e.target.value)} 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm cursor-pointer"
                        >
                          {editCategory === 'Luggage Drop' && (
                            <option value="Luggage Drop">Luggage Drop 🧳</option>
                          )}
                          {sortedCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cost ({currency})</label><input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                      <div className="md:col-span-3 flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={editPaidInAdvance}
                            onChange={(e) => setEditPaidInAdvance(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          Paid in advance
                        </label>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                          {isTransitCategory(editCategory) ? 'From (Origin Location) *' : 'Location'}
                        </label>
                        <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                      </div>
                      {isTransitCategory(editCategory) && (
                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">To (Destination Location) *</label>
                          <input type="text" value={editDestination} onChange={(e) => setEditDestination(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                        </div>
                      )}
                      {isTransitCategory(editCategory) && (
                        <div className="md:col-span-3 space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase">Arrival Time (Optional)</label>
                          <div className="flex items-center gap-2">
                            <select value={editArrivalHour} onChange={(e) => setEditArrivalHour(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm cursor-pointer">
                              <option value="">--</option>
                              {hours.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-slate-400 font-bold">:</span>
                            <select value={editArrivalMinute} onChange={(e) => setEditArrivalMinute(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm cursor-pointer" disabled={!editArrivalHour}>
                              {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            {editArrivalHour && (
                              <button type="button" onClick={() => { setEditArrivalHour(''); setEditArrivalMinute('00'); }} className="text-xs text-slate-400 hover:text-red-500 transition cursor-pointer">Clear</button>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="md:col-span-3"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Details & Notes</label><textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" /></div>
                    </div>
                    <div className="flex justify-end pt-2"><button type="button" onClick={() => onSaveEdit(editPaidInAdvance)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"><Save className="w-3.5 h-3.5" /> Save Changes</button></div>
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
                        <div>
                          {item.destination ? (
                            <div className="space-y-2 mb-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin</p>
                                <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 line-clamp-2">{item.location}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</p>
                                <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 line-clamp-2">{item.destination}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 mb-1 line-clamp-2">{item.location}</p>
                          )}
                          <p className="text-[11px] text-slate-400">Click to open directions</p>
                        </div>
                        <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:underline"><span>Open in Google Maps</span><ExternalLink className="w-3.5 h-3.5" /></div>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
