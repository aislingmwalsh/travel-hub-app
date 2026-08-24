// src/components/DailyMapView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currencyUtils';

export default function DailyMapView({ activities, currency, destination }) {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const markersRef = useRef([]);
  const geocodeCacheRef = useRef(new Map());

  const forceMapRefresh = (map, centerOverride = null) => {
    if (!map || !window.google?.maps) return;

        window.google.maps.event.trigger(map, 'resize');

    if (centerOverride) {
      map.setCenter(centerOverride);
      map.setZoom(12); // Less aggressive zoom-in
      return;
    }

    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach(marker => bounds.extend(marker.getPosition()));
      if (markersRef.current.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(12); // Zoom out standard 14 to 12 when there's only 1 marker
      } else {
        map.fitBounds(bounds);
        
        // Add listener to prevent map from zooming in too tight on fitBounds
        const listener = window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
          if (map.getZoom() > 13) {
            map.setZoom(13); // Restrict max zoom on fitBounds
          }
        });
      }
    }
  };

    // Initialize map once on mount
  useEffect(() => {
    if (!window.google?.maps || !mapRef.current) return;

    const geocoder = new window.google.maps.Geocoder();

        geocoder.geocode({ address: destination || 'World' }, (destResults, destStatus) => {
      let defaultCenter = { lat: 41.9028, lng: 12.4964 };

      if (destStatus === 'OK' && destResults[0]) {
        defaultCenter = destResults[0].geometry.location;
      }

      if (!mapInstance && mapRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 12, // Zoomed out from 14
          center: defaultCenter,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
          ]
        });
        setMapInstance(map);

        requestAnimationFrame(() => {
          setTimeout(() => forceMapRefresh(map), 80);
        });
      }
    });
  }, [destination]);

  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;

    const timer = setTimeout(() => {
      forceMapRefresh(mapInstance);
    }, 120);

    return () => clearTimeout(timer);
  }, [mapInstance, activities]);

  // Update markers and bounds whenever activities change
  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;

    const map = mapInstance;
    const validActivities = activities.filter((act) => {
      const location = String(act.location || '').trim();
      return location && location.length > 2 && !/^https?:\/\//i.test(location) && location !== 'N/A';
    });
    if (validActivities.length === 0) return;

    const geocoder = new window.google.maps.Geocoder();

    const geocodeLocation = (location) => {
      const normalizedLocation = typeof location === 'string' ? location.trim() : '';

      if (!normalizedLocation || normalizedLocation.length < 3 || normalizedLocation === '[object Object]' || normalizedLocation === 'N/A') {
        return Promise.resolve(null);
      }

      if (geocodeCacheRef.current.has(normalizedLocation)) {
        return Promise.resolve(geocodeCacheRef.current.get(normalizedLocation));
      }

      return new Promise((resolve) => {
        geocoder.geocode({ address: normalizedLocation }, (results, status) => {
          const resolved = status === 'OK' && results && results[0] ? results[0].geometry.location : null;
          geocodeCacheRef.current.set(normalizedLocation, resolved);
          resolve(resolved);
        });
      });
    };

        const renderMarkers = async () => {
      // Clear old markers first
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      const resolvedLocations = await Promise.all(
        validActivities.map((activity) => geocodeLocation(activity.location))
      );

      const positions = resolvedLocations.filter(Boolean);
      if (!positions.length) return;

      const newMarkers = [];

      validActivities.forEach((activity, index) => {
        const resolvedPosition = resolvedLocations[index];
        if (!resolvedPosition) return;

        const marker = new window.google.maps.Marker({
          map: map,
          position: resolvedPosition,
          label: {
            text: String(index + 1),
            color: '#ffffff',
            fontWeight: 'bold'
          },
          title: activity.title
        });

        const currencySymbol = getCurrencySymbol(currency);
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; padding: 6px;">
              <h4 style="font-weight: bold; margin: 0 0 4px 0; font-size: 13px;">${activity.title}</h4>
              <p style="margin: 0; font-size: 11px; color: #555;">🕒 ${activity.time} | 📍 ${activity.location}</p>
              ${activity.cost ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #059669; font-weight: bold;">Cost: ${currencySymbol} ${Number(activity.cost).toFixed(2)}</p>` : ''}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        newMarkers.push(marker);
      });

      markersRef.current = newMarkers;

      requestAnimationFrame(() => {
        setTimeout(() => forceMapRefresh(map), 100);
      });
    };

        renderMarkers();
  }, [mapInstance, activities, currency]);

        if (!activities || activities.filter(a => a.location).length === 0) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm mt-3">
      <div className="w-full bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          <MapPin className="w-4 h-4 text-teal-500" /> Daily Route Map ({activities.filter(a => a.location).length} locations)
        </span>
      </div>

      <div className="p-3 bg-white">
        <div ref={mapRef} className="w-full h-56 sm:h-64 rounded-xl border border-slate-200 overflow-hidden" />
      </div>
    </div>
  );
}
