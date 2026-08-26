// src/utils/imageUtils.js

// High-speed, official Unsplash CDN URLs (no network rate limits, cached globally via CDN)
const SPECIFIC_DESTINATIONS = {
  // Italy
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
  venice: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=800&q=80",
  florence: "https://images.unsplash.com/photo-1543431109-7f0868f764a7?auto=format&fit=crop&w=800&q=80",
  milan: "https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?auto=format&fit=crop&w=800&q=80",
  amalfi: "https://images.unsplash.com/photo-1503152394-c571994fd383?auto=format&fit=crop&w=800&q=80",
  italy: "https://images.unsplash.com/photo-1498503182468-3b51cbb6cb24?auto=format&fit=crop&w=800&q=80",

  // Spain & Portugal
  barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
  madrid: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=800&q=80",
  seville: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=80",
  mallorca: "https://images.unsplash.com/photo-1516813350153-62c64b63e808?auto=format&fit=crop&w=800&q=80",
  spain: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=800&q=80",
  lisbon: "https://images.unsplash.com/photo-1509840841025-9088ba78a826?auto=format&fit=crop&w=800&q=80",
  porto: "https://images.unsplash.com/photo-1555881400-7a23cf4da124?auto=format&fit=crop&w=800&q=80",
  portugal: "https://images.unsplash.com/photo-1509840841025-9088ba78a826?auto=format&fit=crop&w=800&q=80",

  // Greece
  santorini: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
  mykonos: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80",
  athens: "https://images.unsplash.com/photo-1555992336-03a23c7b20eb?auto=format&fit=crop&w=800&q=80",
  greece: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",

  // UK & Ireland
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  uk: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  england: "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
  scotland: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=800&q=80",
  edinburgh: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=800&q=80",
  cork: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=800&q=80",
  dublin: "https://images.unsplash.com/photo-1549880181-56a44cf8a4a1?auto=format&fit=crop&w=800&q=80",
  ireland: "https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=800&q=80",

  // France & Benelux
  paris: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
  france: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
  amsterdam: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80",
  netherlands: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80",
  brussels: "https://images.unsplash.com/photo-1491555103944-7c647fd857e6?auto=format&fit=crop&w=800&q=80",
  bruges: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=800&q=80",
  belgium: "https://images.unsplash.com/photo-1491555103944-7c647fd857e6?auto=format&fit=crop&w=800&q=80",

  // Germany, Austria & Switzerland
  berlin: "https://images.unsplash.com/photo-1599586120429-902f6f219add?auto=format&fit=crop&w=800&q=80",
  munich: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=800&q=80",
  germany: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=800&q=80",
  vienna: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
  austria: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80",
  swiss: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80",
  switzerland: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
  zurich: "https://images.unsplash.com/photo-1515488042361-404e9250afb2?auto=format&fit=crop&w=800&q=80",
  geneva: "https://images.unsplash.com/photo-1554160049-c1240a59a7a6?auto=format&fit=crop&w=800&q=80",

  // Eastern & Northern Europe
  prague: "https://images.unsplash.com/photo-1541849546-2165ae35718b?auto=format&fit=crop&w=800&q=80",
  budapest: "https://images.unsplash.com/photo-1565120130276-dfbd9a7a3ad7?auto=format&fit=crop&w=800&q=80",
  hungary: "https://images.unsplash.com/photo-1565120130276-dfbd9a7a3ad7?auto=format&fit=crop&w=800&q=80",
  dubrovnik: "https://images.unsplash.com/photo-1555400038-63f5ba517a4a?auto=format&fit=crop&w=800&q=80",
  croatia: "https://images.unsplash.com/photo-1555400038-63f5ba517a4a?auto=format&fit=crop&w=800&q=80",
  iceland: "https://images.unsplash.com/photo-1504893524553-ac55fce698be?auto=format&fit=crop&w=800&q=80",
  reykjavik: "https://images.unsplash.com/photo-1504893524553-ac55fce698be?auto=format&fit=crop&w=800&q=80",

  // Global / Other Specifics
  singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
  australia: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80",
  sydney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80",
  melbourne: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=800&q=80",
  tokyo: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  japan: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  nyc: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80",

  // Regional Categories
  "central america": "https://images.unsplash.com/photo-1596422846543-75c6fc18a523?auto=format&fit=crop&w=800&q=80",
  "south america": "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80",
  "south east asia": "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=800&q=80",
  "southeast asia": "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=800&q=80",
  "middle east": "https://images.unsplash.com/photo-1547984609-44d977756247?auto=format&fit=crop&w=800&q=80",
  // Africa & Regions
  "south africa": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=800&q=80",
  "north africa": "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
  morocco: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
  egypt: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=800&q=80",
  "east africa": "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  kenya: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  tanzania: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  safari: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  serengeti: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  "west africa": "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=800&q=80",
  "western africa": "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=800&q=80",
  nigeria: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=800&q=80",
  ghana: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=800&q=80",
  "central africa": "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
  congo: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
  "sub saharan africa": "https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=800&q=80",
  "subsaharan africa": "https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=800&q=80",
  africa: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
  "north america": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80",
  caribbean: "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=800&q=80",

  // Wine Regions
  stellenbosch: "https://images.unsplash.com/photo-1516594738148-0d1264b9b952?auto=format&fit=crop&w=800&q=80",
  bordeaux: "https://images.unsplash.com/photo-1504275107627-0c2ba7a43dba?auto=format&fit=crop&w=800&q=80",
  tuscany: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80",
  napa: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=800&q=80",
  mendoza: "https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=800&q=80",
  douro: "https://images.unsplash.com/photo-1584967918940-a7d51b064268?auto=format&fit=crop&w=800&q=80",
  rioja: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
  champagne: "https://images.unsplash.com/photo-1594487524021-39fa1cf87431?auto=format&fit=crop&w=800&q=80"
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
