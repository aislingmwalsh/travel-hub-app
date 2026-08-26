// src/utils/imageUtils.js

/**
 * Returns exactly 3 image URLs based on the actual destinations specified.
 * Queries Lorem Flickr dynamically to fetch high-quality photographs matching the locations.
 * 
 * @param {string} destination - The destination field from the trip.
 * @param {boolean} isHeader - True if requesting high-resolution banner sizes.
 * @returns {string[]} Array of exactly 3 image URLs.
 */
export function getTripCoverUrls(destination, isHeader = false) {
  const dest = String(destination || '').trim();
  
  // Clean up and split by common delimiters: "and", "&", "to", "/", ",", ";"
  const locations = dest
    .split(/\b(?:and|to|&|\/|,|;)\b/i)
    .map(loc => loc.replace(/[^a-zA-Z0-9\s]/g, '').trim())
    .filter(loc => loc.length > 1);

  const width = isHeader ? 1200 : 600;
  const height = isHeader ? 500 : 400;

  const urls = [];

  if (locations.length === 0) {
    // Fallback if destination is empty
    urls.push(
      `https://loremflickr.com/${width}/${height}/travel,landscape?lock=11`,
      `https://loremflickr.com/${width}/${height}/travel,landscape?lock=22`,
      `https://loremflickr.com/${width}/${height}/travel,landscape?lock=33`
    );
  } else if (locations.length === 1) {
    const loc = encodeURIComponent(locations[0]);
    urls.push(
      `https://loremflickr.com/${width}/${height}/${loc}?lock=11`,
      `https://loremflickr.com/${width}/${height}/${loc}?lock=22`,
      `https://loremflickr.com/${width}/${height}/${loc}?lock=33`
    );
  } else if (locations.length === 2) {
    const loc1 = encodeURIComponent(locations[0]);
    const loc2 = encodeURIComponent(locations[1]);
    urls.push(
      `https://loremflickr.com/${width}/${height}/${loc1}?lock=11`,
      `https://loremflickr.com/${width}/${height}/${loc2}?lock=22`,
      `https://loremflickr.com/${width}/${height}/${loc1}?lock=33`
    );
  } else {
    const loc1 = encodeURIComponent(locations[0]);
    const loc2 = encodeURIComponent(locations[1]);
    const loc3 = encodeURIComponent(locations[2]);
    urls.push(
      `https://loremflickr.com/${width}/${height}/${loc1}?lock=11`,
      `https://loremflickr.com/${width}/${height}/${loc2}?lock=22`,
      `https://loremflickr.com/${width}/${height}/${loc3}?lock=33`
    );
  }

  return urls;
}
