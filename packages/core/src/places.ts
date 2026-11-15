import type { Item } from './types';

/** Places worth remembering: restaurants, clinics, sights, friends' tips. Stored as items of type `place`.
 *
 *  Columns used: title = name, body = notes (plain text), status = 'want' | 'visited', pinned = favourite.
 *  Everything else lives in `meta` (see PlaceInfo), flat so search indexes the text fields.
 *  Offline: nothing here contacts a map service. Links are only built for the person to open in Google Maps. */

export type PlaceVisit = 'want' | 'visited';
export const PLACE_VISITS: { key: PlaceVisit; label: string }[] = [
  { key: 'want', label: 'Want to visit' },
  { key: 'visited', label: 'Visited' },
];

export const PLACE_CATEGORIES_SETTING = 'place_categories';
export const PLACE_CATEGORY_MAX = 40;
export const DEFAULT_PLACE_CATEGORIES = [
  'Restaurant', 'Cafe', 'Food outlet', 'Mall', 'Shop', 'Tourist place', 'Clinic', 'Hospital', "Friend's recommendation", 'Other',
] as const;

export interface Coordinates { lat: number; lng: number }

export interface PlaceInfo {
  category: string | null;
  address: string | null;
  phone: string | null;
  recommendedBy: string | null;
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  /** YYYY-MM-DD */
  visitedOn: string | null;
}

export const isPlace = (i: Item) => i.type === 'place' && !i.deleted_at;
export const placeVisit = (i: Item): PlaceVisit => (i.status === 'visited' ? 'visited' : 'want');
export const visitLabel = (v: PlaceVisit) => PLACE_VISITS.find((x) => x.key === v)!.label;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function placeInfo(i: Item): PlaceInfo {
  const m = i.meta;
  const lat = num(m.lat), lng = num(m.lng);
  const coords = lat !== null && lng !== null && validCoordinates(lat, lng);
  const rating = num(m.rating);
  return {
    category: str(m.placeCategory),
    address: str(m.address),
    phone: str(m.phone),
    recommendedBy: str(m.recommendedBy),
    mapUrl: str(m.mapUrl),
    lat: coords ? lat : null,
    lng: coords ? lng : null,
    rating: rating !== null && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    visitedOn: str(m.visitedOn) && /^\d{4}-\d{2}-\d{2}$/.test(String(m.visitedOn)) ? String(m.visitedOn) : null,
  };
}

/** The meta for a place: the given fields replace the place ones, other keys (such as `sample`) are kept. */
export function placeMeta(base: Record<string, unknown>, p: Partial<PlaceInfo>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  const keys: [keyof PlaceInfo, string][] = [
    ['category', 'placeCategory'], ['address', 'address'], ['phone', 'phone'], ['recommendedBy', 'recommendedBy'],
    ['mapUrl', 'mapUrl'], ['lat', 'lat'], ['lng', 'lng'], ['rating', 'rating'], ['visitedOn', 'visitedOn'],
  ];
  for (const [k, metaKey] of keys) {
    if (!(k in p)) continue;
    const v = p[k];
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) delete out[metaKey];
    else out[metaKey] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// ---- Coordinates and map links ------------------------------------------------------------------

export const validCoordinates = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const N = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;

function pair(lat: string | undefined, lng: string | undefined): Coordinates | null {
  if (!lat || !lng) return null;
  const a = Number(lat), b = Number(lng);
  return validCoordinates(a, b) ? { lat: round6(a), lng: round6(b) } : null;
}

/**
 * Reads coordinates from a pasted Google Maps link, a `geo:` link, or plain "18.52, 73.85" text. Returns null when
 * the text has none, as with short links (maps.app.goo.gl), which only the internet can expand.
 */
export function parseCoordinates(input: string): Coordinates | null {
  let s = input.trim();
  if (!s) return null;
  try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { /* keep as typed */ }

  // The dropped pin (!3d lat !4d lng) beats the map's centre (@lat,lng), which is only where the view was.
  const tries: RegExp[] = [
    new RegExp(String.raw`!3d(${N})!4d(${N})`),
    new RegExp(String.raw`^geo:(${N}),(${N})`, 'i'),
    // only when the whole value is a pair, so "q=Cafe 21,5 Street" style names are not read as coordinates
    new RegExp(String.raw`[?&](?:q|query|ll|sll|destination|daddr|center)=(?:loc:)?\s*(${N})\s*,\s*(${N})\s*(?=$|[&#(])`),
    new RegExp(String.raw`/(?:place|search|dir)/(?:[^/]*/)*?(${N}),\s*(${N})(?=$|[/?&#])`),
    new RegExp(String.raw`@(${N}),(${N})`),
    new RegExp(String.raw`^(${N})\s*[, ]\s*(${N})$`),
  ];
  for (const re of tries) {
    const m = re.exec(s);
    const c = m && pair(m[1], m[2]);
    if (c) return c;
  }
  return null;
}

/** Short share links that need the internet to show where they point. */
export function isShortMapLink(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url.trim());
}

/** A Google Maps web link (the only outside links the app opens, apart from phone calls on Android). */
export function isGoogleMapsUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return u.pathname.startsWith('/maps');
  if (host === 'maps.google.com' || /^maps\.google\.[a-z.]+$/.test(host)) return true;
  return (host === 'google.com' || host === 'www.google.com' || /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) && u.pathname.startsWith('/maps');
}

/** What the app may hand to the system: Google Maps web links, and `tel:` numbers. */
export function isAllowedExternalUrl(url: string): boolean {
  return isGoogleMapsUrl(url) || /^tel:\+?[0-9]{3,15}$/.test(url.trim());
}

const MAPS = 'https://www.google.com/maps';

function query(i: Item, p: PlaceInfo): string {
  if (p.lat !== null && p.lng !== null) return `${p.lat},${p.lng}`;
  return [i.title, p.address].filter(Boolean).join(', ');
}

/** Opens the place in Google Maps: by its coordinates, else the saved link, else a search for name and address. */
export function mapsUrl(i: Item): string {
  const p = placeInfo(i);
  if (p.lat === null && p.mapUrl && isGoogleMapsUrl(p.mapUrl)) return p.mapUrl;
  return `${MAPS}/search/?api=1&query=${encodeURIComponent(query(i, p))}`;
}

export function directionsUrl(i: Item): string {
  return `${MAPS}/dir/?api=1&destination=${encodeURIComponent(query(i, placeInfo(i)))}`;
}

/** `tel:` link for a phone number as typed (spaces, dashes and brackets allowed), or null if it is not a number. */
export function telUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const t = phone.trim();
  if (!/^\+?[0-9 ()\-.]+$/.test(t)) return null;
  const digits = t.replace(/[^0-9]/g, '');
  if (digits.length < 3 || digits.length > 15) return null;
  return `tel:${t.startsWith('+') ? '+' : ''}${digits}`;
}

export const coordinatesText = (p: Pick<PlaceInfo, 'lat' | 'lng'>) =>
  p.lat !== null && p.lng !== null ? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : null;

/** Plain text for sharing a place with someone. */
export function placeShareText(i: Item): string {
  const p = placeInfo(i);
  return [i.title, p.category, p.address, p.phone, mapsUrl(i)].filter(Boolean).join('\n');
}

// ---- Lists, filters, categories -----------------------------------------------------------------

export type PlaceFilter = 'all' | PlaceVisit | 'favourite';
export interface PlaceQuery { q?: string; filter?: PlaceFilter; category?: string | null }

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

function matches(i: Item, q: string): boolean {
  if (!q.trim()) return true;
  const p = placeInfo(i);
  const hay = [i.title, i.body ?? '', p.category ?? '', p.address ?? '', p.recommendedBy ?? '', p.phone ?? ''].join(' ').toLocaleLowerCase();
  return q.toLocaleLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** Places for the list: favourites first, then the most recently changed. */
export function visiblePlaces(items: Item[], f: PlaceQuery = {}): Item[] {
  const filter = f.filter ?? 'all';
  return items
    .filter(isPlace)
    .filter((i) => filter === 'all' || (filter === 'favourite' ? i.pinned : placeVisit(i) === filter))
    .filter((i) => !f.category || same(placeInfo(i).category ?? '', f.category))
    .filter((i) => matches(i, f.q ?? ''))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
}

export function normalizePlaceCategory(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, PLACE_CATEGORY_MAX);
}

/** The saved category list. Nothing saved yet means the starting list; an empty saved list stays empty. */
export function parsePlaceCategories(json: string | null | undefined): string[] {
  if (json === null || json === undefined) return [...DEFAULT_PLACE_CATEGORIES];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(normalizePlaceCategory) : [...DEFAULT_PLACE_CATEGORIES];
  } catch {
    return [...DEFAULT_PLACE_CATEGORIES];
  }
}

export interface PlaceCategoryInfo { name: string; count: number }

/** Saved categories (in order) plus any a place uses that is missing from the list, with how many places use each. */
export function listPlaceCategories(items: Item[], saved: string[]): PlaceCategoryInfo[] {
  const places = items.filter(isPlace);
  const names = [...saved];
  for (const c of places.map((p) => placeInfo(p).category).filter((c): c is string => !!c).sort()) {
    if (!names.some((n) => same(n, c))) names.push(c);
  }
  return names.map((name) => ({ name, count: places.filter((p) => same(placeInfo(p).category ?? '', name)).length }));
}

export const hasPlaceCategory = (saved: string[], name: string) => saved.some((s) => same(s, name));
