// src/components/DailyMapView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

export default function DailyMapView({ activities, currency, destination }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isMapOpen, setIsMapOpen] = useState(true);

  useEffect(() => {
    if (!isMapOpen) return;
    const validActivities = activities.filter(act => act.location && act.location.trim() !== '');

    if (!window.google?.maps) return;

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address: destination || 'World' }, (destResults, destStatus) => {
      let defaultCenter = { lat: 41.9028, lng: 12.4964 };

      if (destStatus === 'OK' && destResults[0]) {
        defaultCenter = destResults[0].geometry.location;
      }

      // Initialize map instance once
      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 14,
          center: defaultCenter,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
          ]
        });
      }

      const map = mapInstanceRef.current;
      if (map) {
        // FIX: Force Google Maps to recalculate dimensions after expansion repaint
        setTimeout(() => {
          window.google.maps.event.trigger(map, 'resize');
          map.setCenter(defaultCenter);
        }, 100);
      }

      if (validActivities.length === 0) return;

      // Clear old markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();

      validActivities.forEach((activity, index) => {
        geocoder.geocode({ address: activity.location }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const position = results[0].geometry.location;
            bounds.extend(position);

            const marker = new window.google.maps.Marker({
              map: map,
              position: position,
              label: {
                text: String(index + 1),
                color: '#ffffff',
                fontWeight: 'bold'
              },
              title: activity.title
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="font-family: sans-serif; padding: 6px;">
                  <h4 style="font-weight: bold; margin: 0 0 4px 0; font-size: 13px;">${activity.title}</h4>
                  <p style="margin: 0; font-size: 11px; color: #555;">🕒 ${activity.time} | 📍 ${activity.location}</p>
                  ${activity.cost ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #059669; font-weight: bold;">Cost: ${currency} ${Number(activity.cost).toFixed(2)}</p>` : ''}
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            markersRef.current.push(marker);

            if (validActivities.length === 1) {
              map.setCenter(position);
              map.setZoom(14);
            } else {
              map.fitBounds(bounds);
            }
          }
        });
      });
    });
  }, [activities, currency, destination, isMapOpen]);

  if (!activities || activities.filter(a => a.location).length === 0) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm mt-3">
      <button 
        onClick={() => setIsMapOpen(!isMapOpen)}
        className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <MapPin className="w-4 h-4 text-teal-500" /> Daily Route Map ({activities.filter(a => a.location).length} locations)
        </span>
        {isMapOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isMapOpen && (
        <div className="p-3 bg-white">
          <div ref={mapRef} className="w-full h-64 rounded-xl border border-slate-200 overflow-hidden" />
        </div>
      )}
    </div>
  );
}