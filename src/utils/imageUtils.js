// src/utils/imageUtils.js

const IMAGES = {
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  asia: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  europe: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
  city: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  winter: "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?auto=format&fit=crop&w=800&q=80",
  generic: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
};

export function getTripCoverUrl(destination, isHeader = false) {
  const dest = String(destination || '').trim().toLowerCase();
  let selected = IMAGES.generic;

  if (dest) {
    // Beach & Tropical keywords
    if (/\b(beach|island|coast|sea|ocean|sun|bali|maldives|hawaii|phuket|bahamas|cancun|caribbean|tropical|coastline|surf|surfing)\b/.test(dest)) {
      selected = IMAGES.beach;
    }
    // Asian keywords
    else if (/\b(tokyo|kyoto|osaka|japan|seoul|korea|bangkok|thailand|shanghai|beijing|china|singapore|vietnam|hanoi|asia|taipei|taiwan)\b/.test(dest)) {
      selected = IMAGES.asia;
    }
    // European keywords (excluding mountains check first)
    else if (/\b(paris|france|london|uk|england|rome|italy|venice|florence|spain|barcelona|madrid|europe|prague|amsterdam|greece|athens|vienna|austria|swiss|switzerland|alps|berlin|munich|germany|cork|dublin|ireland)\b/.test(dest)) {
      if (/\b(swiss|switzerland|alps)\b/.test(dest)) {
        selected = IMAGES.mountain;
      } else {
        selected = IMAGES.europe;
      }
    }
    // Mountains & Outdoor keywords
    else if (/\b(mountain|mountains|hike|hiking|lake|forest|nature|outdoor|outdoors|camping|national park|yosemite|yellowstone|rockies|denali)\b/.test(dest)) {
      selected = IMAGES.mountain;
    }
    // Winter keywords
    else if (/\b(snow|winter|ski|ice|iceland|arctic|alaska|lapland|glacier)\b/.test(dest)) {
      selected = IMAGES.winter;
    }
    // Skyline/Cities
    else if (/\b(city|nyc|new york|chicago|sydney|melbourne|skyline|urban|boston|san francisco|toronto)\b/.test(dest)) {
      selected = IMAGES.city;
    }
  }

  if (isHeader) {
    return selected.replace('w=800', 'w=1200');
  }
  return selected;
}

