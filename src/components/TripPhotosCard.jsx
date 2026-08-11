// src/components/TripPhotosCard.jsx
import React from 'react';
import { Camera, ExternalLink, Image as ImageIcon } from 'lucide-react';

export default function TripPhotosCard({ photoAlbumUrl }) {
  return (
    <div className="mt-8 bg-gradient-to-br from-slate-900 to-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-start gap-4">
        <div className="p-3.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-2xl shrink-0">
          <Camera className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">Shared Trip Album</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
              Google Photos
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {photoAlbumUrl 
              ? "View photos captured by the travel party or add your own memories to the shared album." 
              : "No Google Photos album linked yet. Trip owners can add one via 'Edit Trip Details'."}
          </p>
        </div>
      </div>

      {photoAlbumUrl ? (
        <a 
          href={photoAlbumUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-2xl text-xs transition shadow-md shrink-0 cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" /> Open Album <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
        </a>
      ) : (
        <div className="text-xs text-slate-500 italic shrink-0">
          Link pending
        </div>
      )}
    </div>
  );
}