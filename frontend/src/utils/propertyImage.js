// ─────────────────────────────────────────────────────────────────────────────
// propertyImage — deterministic photo picker for property cards / hero.
//
// We don't have on-chain image URIs (yet), but we *do* want every property to
// look distinct without ever flickering between renders. So we hash a stable
// key (preferring the property's on-chain id, falling back to its address /
// name) and use the result to pick one of a handful of curated, royalty-free
// real-estate photographs.
//
// All images are hosted by Unsplash's CDN with `auto=format&fit=crop` params
// so they degrade nicely on slow connections.
// ─────────────────────────────────────────────────────────────────────────────

// Curated, theme-tagged Unsplash photo IDs. Tags drive the location heuristic.
//   metro    — high-rise skylines, urban towers
//   coastal  — beachfront, waterfront, tropical
//   suburban — villas, low-rise residential, greenery
//   commercial — office / mixed-use towers
const POOL = [
  // metro
  { id: "1545324418-cc1a3fa10c00", tags: ["metro"] },        // glass skyscraper
  { id: "1486325212027-8081e485255e", tags: ["metro"] },     // city tower at dusk
  { id: "1460317442991-0ec209397118", tags: ["metro"] },     // skyline at night
  { id: "1577552568192-467a12a7f376", tags: ["metro"] },     // modern apartments
  { id: "1502672260266-1c1ef2d93688", tags: ["metro"] },     // urban condo
  // coastal
  { id: "1499793983690-e29da59ef1c2", tags: ["coastal"] },   // beach villa
  { id: "1505691938895-1758d7feb511", tags: ["coastal"] },   // ocean-front
  { id: "1540541338287-41700207dee6", tags: ["coastal"] },   // tropical home
  { id: "1602343168117-bb8ffe3e2e9f", tags: ["coastal"] },   // waterfront
  // suburban
  { id: "1568605114967-8130f3a36994", tags: ["suburban"] },  // modern villa
  { id: "1564013799919-ab600027ffc6", tags: ["suburban"] },  // suburban house
  { id: "1512917774080-9991f1c4c750", tags: ["suburban"] },  // residential
  { id: "1600596542815-ffad4c1539a9", tags: ["suburban"] },  // upscale home
  // commercial
  { id: "1497366216548-37526070297c", tags: ["commercial"] },// office interior
  { id: "1542361345-89e58247f2d5", tags: ["commercial"] },   // commercial tower
  { id: "1531973576160-7125cd663d86", tags: ["commercial"] },// glass office
];

// Stable 32-bit string hash (FNV-1a). Deterministic across runs / browsers.
function hash32(input) {
  let h = 0x811c9dc5;
  const s = String(input ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function classify(location = "", name = "") {
  const t = `${location} ${name}`.toLowerCase();
  if (/(goa|beach|coast|marina|seaside|bay|island)/.test(t)) return "coastal";
  if (/(office|tower|business|park|tech|hub|plaza|complex|commercial)/.test(t)) return "commercial";
  if (/(mumbai|delhi|bangalore|bengaluru|chennai|kolkata|hyderabad|pune|gurgaon|noida|new york|london|tokyo|shanghai|dubai|singapore|hong kong)/.test(t)) return "metro";
  return "suburban";
}

/**
 * Deterministically return an Unsplash photo URL for a property.
 *
 * @param {object} prop — { id, name, location, propertyToken }
 * @param {object} [opts]
 * @param {number} [opts.w=1200]  rendered width
 * @param {number} [opts.h=600]   rendered height
 * @returns {string} fully-qualified image URL
 */
export function propertyImage(prop, opts = {}) {
  const { w = 1200, h = 600 } = opts;

  // If admin uploaded a custom photo URL at mint time, use it directly.
  if (prop?.imageUrl && typeof prop.imageUrl === "string" && prop.imageUrl.startsWith("http")) {
    return prop.imageUrl;
  }

  const key = prop?.id ?? prop?.propertyToken ?? prop?.name ?? "property";
  const tag = classify(prop?.location, prop?.name);

  // Filter pool to themed photos when we have any; otherwise use the whole pool.
  const themed = POOL.filter((p) => p.tags.includes(tag));
  const bucket = themed.length > 0 ? themed : POOL;

  const idx = hash32(`${key}:${prop?.name || ""}:${prop?.location || ""}`) % bucket.length;
  const photoId = bucket[idx].id;

  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
}

/**
 * Return a tiny placeholder (blurred / low-quality) for the same property.
 * Useful as a CSS background while the main image streams in.
 */
export function propertyImageLqip(prop) {
  return propertyImage(prop, { w: 32, h: 16 });
}
