// src/components/DailyMapView.jsx
import React, { useEffect, useRef } from 'react';

export default function DailyMapView({ activities, currency }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Filter activities that have valid locations
    const validActivities = activities.filter(act => act.location && act.location.trim() !== '');

    if (!window.google?.maps || validActivities.length === 0) return;

    // Initialize Map if not already created
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: 53.3498, lng: -6.2603 }, // Default fallback (e.g., Dublin)
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
      });
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Use Geocoder to convert location text strings into geographic coordinates
    const geocoder = new window.google.maps.Geocoder();
    const bounds = new window.google.maps.LatLngBounds();

    validActivities.forEach((activity, index) => {
      geocoder.geocode({ address: activity.location }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const position = results[0].geometry.location;
          bounds.extend(position);

          // Create a custom marker for the activity
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

          // Optional info window when clicking a marker
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="font-family: sans-serif; padding: 4px;">
                <h4 style="font-weight: bold; margin: 0 0 4px 0;">${activity.title}</h4>
                <p style="margin: 0; font-size: 12px; color: #555;">🕒 ${activity.time} | 📍 ${activity.location}</p>
                ${activity.cost ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #059669; font-weight: bold;">Cost: ${currency} ${Number(activity.cost).toFixed(2)}</p>` : ''}
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);

          // Fit map bounds to show all markers for the day
          if (markersRef.current.length === validActivities.length) {
            map.fitBounds(bounds);
          }
        }
      });
    });
  }, [activities, currency]);

  if (!activities || activities.filter(a => a.location).length === 0) {
    return (
      <div className="h-48 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-xs text-slate-400">
        No mapped locations for this day yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        🗺️ Daily Route Map
      </div>
      <div ref={mapRef} className="w-full h-64 rounded-2xl border border-slate-200 shadow-sm overflow-hidden" />
    </div>
  );
}