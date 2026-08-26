// src/utils/imageUtils.js

const IMAGES = {
  beach: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=600&q=80"
  ],
  asia: [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80"
  ],
  europe: [
    "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1503152394-c571994fd383?auto=format&fit=crop&w=600&q=80"
  ],
  city: [
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=600&q=80"
  ],
  mountain: [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80"
  ],
  winter: [
    "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1489674262261-122557936378?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1517210122102-f4b360b30222?auto=format&fit=crop&w=600&q=80"
  ],
  generic: [
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80"
  ]
};

export function getTripCoverUrls(destination, isHeader = false) {
  const dest = String(destination || '').trim().toLowerCase();
  const matched = [];

  if (dest) {
    // Beach & Tropical keywords
    if (/\b(beach|island|coast|sea|ocean|sun|bali|maldives|hawaii|phuket|bahamas|cancun|caribbean|tropical|coastline|surf|surfing)\b/.test(dest)) {
      matched.push('beach');
    }
    // Asian keywords
    if (/\b(tokyo|kyoto|osaka|japan|seoul|korea|bangkok|thailand|shanghai|beijing|china|singapore|vietnam|hanoi|asia|taipei|taiwan)\b/.test(dest)) {
      matched.push('asia');
    }
    // European keywords (excluding mountains check first)
    if (/\b(paris|france|london|uk|england|rome|italy|venice|florence|spain|barcelona|madrid|europe|prague|amsterdam|greece|athens|vienna|austria|swiss|switzerland|alps|berlin|munich|germany|cork|dublin|ireland)\b/.test(dest)) {
      if (/\b(swiss|switzerland|alps)\b/.test(dest)) {
        matched.push('mountain');
      } else {
        matched.push('europe');
      }
    }
    // Mountains & Outdoor keywords
    if (/\b(mountain|mountains|hike|hiking|lake|forest|nature|outdoor|outdoors|camping|national park|yosemite|yellowstone|rockies|denali)\b/.test(dest)) {
      if (!matched.includes('mountain')) {
        matched.push('mountain');
      }
    }
    // Winter keywords
    if (/\b(snow|winter|ski|ice|iceland|arctic|alaska|lapland|glacier)\b/.test(dest)) {
      matched.push('winter');
    }
    // Skyline/Cities
    if (/\b(city|nyc|new york|chicago|sydney|melbourne|skyline|urban|boston|san francisco|toronto)\b/.test(dest)) {
      matched.push('city');
    }
  }

  // Deduplicate matched themes
  const uniqueMatched = Array.from(new Set(matched));

  if (uniqueMatched.length === 0) {
    uniqueMatched.push('generic');
  }

  const resultUrls = [];

  if (uniqueMatched.length === 1) {
    // 1 matched theme: take all 3 images from this theme
    const theme = uniqueMatched[0];
    resultUrls.push(IMAGES[theme][0], IMAGES[theme][1], IMAGES[theme][2]);
  } else if (uniqueMatched.length === 2) {
    // 2 matched themes: take 2 from the first theme, 1 from the second theme
    const theme1 = uniqueMatched[0];
    const theme2 = uniqueMatched[1];
    resultUrls.push(IMAGES[theme1][0], IMAGES[theme1][1], IMAGES[theme2][0]);
  } else {
    // 3 or more matched themes: take 1 from each of the first 3 themes
    resultUrls.push(IMAGES[uniqueMatched[0]][0], IMAGES[uniqueMatched[1]][0], IMAGES[uniqueMatched[2]][0]);
  }

  // Map theme names to image URLs, replacing resolution if it is a header
  return resultUrls.map(url => {
    return isHeader ? url.replace('w=600', 'w=1200') : url;
  });
}
