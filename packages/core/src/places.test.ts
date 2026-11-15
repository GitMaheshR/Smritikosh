import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLACE_CATEGORIES, coordinatesText, directionsUrl, isAllowedExternalUrl, isGoogleMapsUrl, isShortMapLink, listPlaceCategories,
  mapsUrl, parseCoordinates, parsePlaceCategories, placeInfo, placeMeta, placeShareText, placeVisit, telUrl, visiblePlaces,
} from './places';
import type { Item } from './types';

let seq = 0;
function place(title: string, o: Partial<Item> = {}): Item {
  seq++;
  return {
    id: `p${seq}`, type: 'place', title, body: null, category: null, priority: 2, status: 'want', due_at: null, remind_at: null,
    repeat_rule: null, parent_id: null, meta: {}, pinned: false, archived: false, created_at: '2026-11-01T10:00:00',
    updated_at: `2026-11-01T10:00:${String(seq).padStart(2, '0')}`, deleted_at: null, tags: [], ...o,
  };
}

describe('parseCoordinates', () => {
  it('prefers the dropped pin over the map centre in a full place link', () => {
    const url = 'https://www.google.com/maps/place/Gateway+of+India/@18.9219841,72.8320,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d18.9219841!4d72.8346543!16s';
    expect(parseCoordinates(url)).toEqual({ lat: 18.921984, lng: 72.834654 });
  });
  it('reads the map centre when there is no pin', () => {
    expect(parseCoordinates('https://www.google.com/maps/@18.5204,73.8567,15z')).toEqual({ lat: 18.5204, lng: 73.8567 });
  });
  it('reads search, query and directions links', () => {
    expect(parseCoordinates('https://www.google.com/maps/search/?api=1&query=18.5204%2C73.8567')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates('https://maps.google.com/?q=18.5204,73.8567')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates('https://www.google.com/maps/search/18.5204,+73.8567')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates('https://www.google.com/maps/dir/?api=1&destination=-33.8568,151.2153')).toEqual({ lat: -33.8568, lng: 151.2153 });
  });
  it('reads geo: links and typed pairs', () => {
    expect(parseCoordinates('geo:18.5204,73.8567?z=15')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates('geo:0,0?q=18.5204,73.8567(Home)')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates(' 18.5204, 73.8567 ')).toEqual({ lat: 18.5204, lng: 73.8567 });
    expect(parseCoordinates('-12.5 -45.25')).toEqual({ lat: -12.5, lng: -45.25 });
  });
  it('returns null for short links, names and out-of-range numbers', () => {
    expect(parseCoordinates('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(parseCoordinates('https://www.google.com/maps/search/?api=1&query=Cafe+21,5+Street')).toBeNull();
    expect(parseCoordinates('https://www.google.com/maps/place/Cafe+21,5+Street/')).toBeNull();
    expect(parseCoordinates('95.1, 20')).toBeNull();
    expect(parseCoordinates('10, 181')).toBeNull();
    expect(parseCoordinates('0, 0')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('%E0%A4%')).toBeNull();
  });
});

describe('map links', () => {
  it('recognises Google Maps web links only', () => {
    expect(isGoogleMapsUrl('https://www.google.com/maps/@1,2,3z')).toBe(true);
    expect(isGoogleMapsUrl('https://www.google.co.in/maps/place/x')).toBe(true);
    expect(isGoogleMapsUrl('https://maps.google.com/?q=1,2')).toBe(true);
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isGoogleMapsUrl('https://goo.gl/maps/abc')).toBe(true);
    expect(isGoogleMapsUrl('http://www.google.com/maps')).toBe(false);
    expect(isGoogleMapsUrl('https://www.google.com/search?q=maps')).toBe(false);
    expect(isGoogleMapsUrl('https://google.com.evil.example/maps')).toBe(false);
    expect(isGoogleMapsUrl('https://user:pw@www.google.com/maps')).toBe(false);
    expect(isGoogleMapsUrl('javascript:alert(1)')).toBe(false);
    expect(isGoogleMapsUrl('not a url')).toBe(false);
  });
  it('allows only maps links and plain phone numbers to leave the app', () => {
    expect(isAllowedExternalUrl('tel:+919876543210')).toBe(true);
    expect(isAllowedExternalUrl('tel:12')).toBe(false);
    expect(isAllowedExternalUrl('tel:123;drop')).toBe(false);
    expect(isAllowedExternalUrl('https://example.com')).toBe(false);
    expect(isAllowedExternalUrl('file:///C:/x')).toBe(false);
  });
  it('spots short links', () => {
    expect(isShortMapLink('https://maps.app.goo.gl/x')).toBe(true);
    expect(isShortMapLink('https://www.google.com/maps/@1,2')).toBe(false);
  });
  it('opens by coordinates, then the saved link, then name and address', () => {
    const withCoords = place('Gateway', { meta: { lat: 18.922, lng: 72.8347, mapUrl: 'https://maps.app.goo.gl/x' } });
    expect(mapsUrl(withCoords)).toBe('https://www.google.com/maps/search/?api=1&query=18.922%2C72.8347');
    expect(directionsUrl(withCoords)).toBe('https://www.google.com/maps/dir/?api=1&destination=18.922%2C72.8347');
    expect(mapsUrl(place('X', { meta: { mapUrl: 'https://maps.app.goo.gl/x' } }))).toBe('https://maps.app.goo.gl/x');
    expect(mapsUrl(place('X', { meta: { mapUrl: 'https://example.com/x' } }))).toBe('https://www.google.com/maps/search/?api=1&query=X');
    expect(mapsUrl(place('Corner Cafe', { meta: { address: 'FC Road, Pune' } }))).toBe('https://www.google.com/maps/search/?api=1&query=Corner%20Cafe%2C%20FC%20Road%2C%20Pune');
    expect(isGoogleMapsUrl(mapsUrl(place('A & B')))).toBe(true);
  });
  it('makes call links from typed numbers', () => {
    expect(telUrl('+91 98765-43210')).toBe('tel:+919876543210');
    expect(telUrl('(020) 2553 1234')).toBe('tel:02025531234');
    expect(telUrl('call me')).toBeNull();
    expect(telUrl('12')).toBeNull();
    expect(telUrl(null)).toBeNull();
  });
});

describe('place fields', () => {
  it('reads meta safely and ignores bad values', () => {
    const p = placeInfo(place('X', { meta: { placeCategory: ' Cafe ', lat: 18.5, lng: 'x', rating: 9, visitedOn: '2026-11-02', phone: '' } }));
    expect(p).toMatchObject({ category: 'Cafe', lat: null, lng: null, rating: null, visitedOn: '2026-11-02', phone: null });
    expect(placeInfo(place('X', { meta: { lat: 18.5, lng: 73.8, rating: 4, visitedOn: 'soon' } }))).toMatchObject({ lat: 18.5, lng: 73.8, rating: 4, visitedOn: null });
  });
  it('writes meta, clearing empty fields and keeping other keys', () => {
    const m = placeMeta({ sample: true, address: 'Old', phone: '1' }, { address: ' New road ', phone: '', lat: 1, lng: 2, rating: null });
    expect(m).toEqual({ sample: true, address: 'New road', lat: 1, lng: 2 });
  });
  it('shows coordinates and share text', () => {
    expect(coordinatesText({ lat: 18.5, lng: 73.8 })).toBe('18.500000, 73.800000');
    expect(coordinatesText({ lat: null, lng: null })).toBeNull();
    expect(placeShareText(place('Cafe', { meta: { placeCategory: 'Cafe', address: 'Pune' } }))).toBe('Cafe\nCafe\nPune\nhttps://www.google.com/maps/search/?api=1&query=Cafe%2C%20Pune');
  });
  it('treats anything but visited as want to visit', () => {
    expect(placeVisit(place('a', { status: 'visited' }))).toBe('visited');
    expect(placeVisit(place('a', { status: null }))).toBe('want');
  });
});

describe('place lists', () => {
  const items = [
    place('Old cafe', { meta: { placeCategory: 'Cafe', address: 'Kothrud' } }),
    place('Dentist', { status: 'visited', meta: { placeCategory: 'clinic', recommendedBy: 'Asha' } }),
    place('Fort', { pinned: true, meta: { placeCategory: 'Hill fort' } }),
    place('Gone', { deleted_at: '2026-11-02T00:00:00' }),
    { ...place('Not a place'), type: 'note' as const },
  ];
  it('puts favourites first, then the latest changed', () => {
    expect(visiblePlaces(items).map((i) => i.title)).toEqual(['Fort', 'Dentist', 'Old cafe']);
  });
  it('filters by status, favourite, category and words', () => {
    expect(visiblePlaces(items, { filter: 'visited' }).map((i) => i.title)).toEqual(['Dentist']);
    expect(visiblePlaces(items, { filter: 'want' }).map((i) => i.title)).toEqual(['Fort', 'Old cafe']);
    expect(visiblePlaces(items, { filter: 'favourite' }).map((i) => i.title)).toEqual(['Fort']);
    expect(visiblePlaces(items, { category: 'Clinic' }).map((i) => i.title)).toEqual(['Dentist']);
    expect(visiblePlaces(items, { q: 'asha' }).map((i) => i.title)).toEqual(['Dentist']);
    expect(visiblePlaces(items, { q: 'cafe kothrud' }).map((i) => i.title)).toEqual(['Old cafe']);
  });
  it('lists categories with counts, adding ones only places use', () => {
    const list = listPlaceCategories(items, ['Cafe', 'Clinic']);
    expect(list).toEqual([{ name: 'Cafe', count: 1 }, { name: 'Clinic', count: 1 }, { name: 'Hill fort', count: 1 }]);
  });
  it('starts with the default categories until a list is saved', () => {
    expect(parsePlaceCategories(null)).toEqual([...DEFAULT_PLACE_CATEGORIES]);
    expect(parsePlaceCategories('[]')).toEqual([]);
    expect(parsePlaceCategories('["Cafe","  ", 3]')).toEqual(['Cafe']);
    expect(parsePlaceCategories('broken')).toEqual([...DEFAULT_PLACE_CATEGORIES]);
  });
});
