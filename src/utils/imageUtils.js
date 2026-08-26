// src/utils/imageUtils.js

// High-speed, official Unsplash CDN URLs (no network rate limits, cached globally via CDN)
const SPECIFIC_DESTINATIONS = {
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
  singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
  australia: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80",
  sydney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80",
  melbourne: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=800&q=80",
  tokyo: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  japan: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  paris: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
  france: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  uk: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  england: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  cork: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=800&q=80",
  dublin: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=800&q=80",
  ireland: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=800&q=80",
  nyc: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80"
};

const THEMES = {
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  winter: "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?auto=format&fit=crop&w=800&q=80",
  city: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80",
  generic: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
};

/**
 * Returns a single cover image URL for a given destination.
 * Matches specific cities/countries first, then falls back to general themes, and finally a generic default.
 * 
 * @param {string} destination - The destination field from the trip.
 * @param {boolean} isHeader - True if requesting high-resolution banner sizes.
 * @returns {string} The Unsplash CDN cover image URL.
 */
export function getTripCoverUrl(destination, isHeader = false) {
  const dest = String(destination || '').trim().toLowerCase();

  if (dest) {
    // 1. Check for specific highly matching cities/countries first
    for (const key of Object.keys(SPECIFIC_DESTINATIONS)) {
      if (dest.includes(key)) {
        const url = SPECIFIC_DESTINATIONS[key];
        return isHeader ? url.replace('w=800', 'w=1200') : url;
      }
    }

    // 2. Fall back to theme checks if no specific city matches
    if (/\b(beach|island|coast|sea|ocean|sun|maldives|hawaii|phuket|bahamas|cancun|caribbean|tropical|coastline|surf|surfing)\b/.test(dest)) {
      const url = THEMES.beach;
      return isHeader ? url.replace('w=800', 'w=1200') : url;
    }
    
    if (/\b(mountain|mountains|hike|hiking|lake|forest|nature|outdoor|outdoors|camping|national park|yosemite|yellowstone|rockies|denali|alps|swiss|switzerland)\b/.test(dest)) {
      const url = THEMES.mountain;
      return isHeader ? url.replace('w=800', 'w=1200') : url;
    }

    if (/\b(snow|winter|ski|ice|iceland|arctic|alaska|lapland|glacier)\b/.test(dest)) {
      const url = THEMES.winter;
      return isHeader ? url.replace('w=800', 'w=1200') : url;
    }

    if (/\b(city|nyc|new york|chicago|sydney|melbourne|skyline|urban|boston|san francisco|toronto|street|metropolis)\b/.test(dest)) {
      const url = THEMES.city;
      return isHeader ? url.replace('w=800', 'w=1200') : url;
    }
  }

  // 3. Absolute generic fallback
  const fallbackUrl = THEMES.generic;
  return isHeader ? fallbackUrl.replace('w=800', 'w=1200') : fallbackUrl;
}
