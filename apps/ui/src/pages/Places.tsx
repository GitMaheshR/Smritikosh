import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Crosshair, MapPin, Navigation, Pencil, Phone, Plus, Search, Share2, Star } from 'lucide-react';
import {
  PLACE_VISITS, coordinatesText, directionsUrl, isShortMapLink, listPlaceCategories, mapsUrl, parseCoordinates, placeInfo, placeMeta,
  placeShareText, placeVisit, telUrl, toLocalIso, validCoordinates, visiblePlaces, visitLabel, type Item, type PlaceFilter, type PlaceVisit,
} from '@smritikosh/core';
import { useApp } from '../store/app';
import { Chip, EmptyState, FormRow, PageHeader } from '../components/ui';
import { useGoBack } from '../components/Shell';
import { canCall, canUseLocation, currentLocation, openExternal, shareText } from '../platform';
import { whenLabel } from '../format';

const FILTERS: { key: PlaceFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'want', label: 'Want to visit' }, { key: 'visited', label: 'Visited' }, { key: 'favourite', label: 'Favourites' },
];

const today = () => toLocalIso(new Date()).slice(0, 10);

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-medium" aria-label={`Rated ${value} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} aria-hidden className={n <= value ? 'fill-current' : 'text-faint'} />)}
    </span>
  );
}

function VisitPill({ visit }: { visit: PlaceVisit }) {
  return (
    <span className={`inline-flex min-h-0 items-center rounded-full px-2 py-0.5 text-meta font-bold ${visit === 'visited' ? 'bg-secondary-soft text-secondary' : 'bg-primary-soft text-primary'}`}>
      {visitLabel(visit)}
    </span>
  );
}

function PlaceRow({ place, onOpen }: { place: Item; onOpen: () => void }) {
  const p = placeInfo(place);
  const area = p.address?.split('\n')[0] ?? null;
  return (
    <button type="button" onClick={onOpen} className="flex min-h-touch w-full items-start gap-3 border-t border-border py-3 text-left first:border-t-0 first:pt-0 last:pb-0">
      <MapPin size={18} aria-hidden className={`mt-0.5 shrink-0 ${p.lat !== null ? 'text-secondary' : 'text-faint'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong className="truncate text-body">{place.title}</strong>
          {place.pinned && <Star size={14} aria-label="Favourite" className="shrink-0 fill-current text-medium" />}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-meta text-muted">
          {p.category && <span>{p.category}</span>}
          {area && <span className="truncate">· {area}</span>}
          {p.recommendedBy && <span>· from {p.recommendedBy}</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <VisitPill visit={placeVisit(place)} />
        {p.rating && <Stars value={p.rating} size={12} />}
      </span>
    </button>
  );
}

export function PlacesPage() {
  const { items, placeCategories } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState<PlaceFilter>('all');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const any = items.some((i) => i.type === 'place' && !i.deleted_at);
  const places = useMemo(() => visiblePlaces(items, { q, filter, category: category || null }), [items, q, filter, category]);
  const cats = useMemo(() => listPlaceCategories(items, placeCategories).filter((c) => c.count > 0), [items, placeCategories]);

  return (
    <div>
      <PageHeader eyebrow="Worth remembering" title="Places" subtitle="Restaurants, clinics, sights and the spots friends told you about."
        action={<button type="button" onClick={() => nav('/places/new')} className="btn btn-primary"><Plus size={18} aria-hidden />New place</button>} />

      {!any ? (
        <div className="panel"><EmptyState icon={MapPin} line="Save a place with a Google Maps link or your current location, and find it again later." action="Add your first place" onAction={() => nav('/places/new')} /></div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input aria-label="Search places" className="input !pl-10" placeholder="Search places…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {cats.length > 0 && (
              <select aria-label="Category" className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {cats.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
              </select>
            )}
          </div>
          <div className="-mx-page-x mb-4 flex gap-2 overflow-x-auto px-page-x pb-1" role="group" aria-label="Filters">
            {FILTERS.map((f) => <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>)}
          </div>
          {places.length === 0 ? (
            <p className="panel py-10 text-center text-body text-muted">{q || category ? 'No places match.' : filter === 'favourite' ? 'No favourites yet. Mark a place as a favourite to keep it at the top.' : 'Nothing here yet.'}</p>
          ) : (
            <section className="panel" aria-label="Places">
              {places.map((p) => <PlaceRow key={p.id} place={p} onOpen={() => nav(`/places/${p.id}`)} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

const findPlace = (items: Item[], id: string | undefined) => items.find((i) => i.id === id && i.type === 'place' && !i.deleted_at) ?? null;

/** A place shown as details (`/places/:id`), with buttons that hand it to Google Maps. */
export function PlaceDetail() {
  const { id } = useParams();
  const { items, store, refresh, removeWithUndo, showToast } = useApp();
  const nav = useNavigate();
  const goBack = useGoBack();
  const place = findPlace(items, id);
  if (!place) return <div className="panel"><EmptyState icon={MapPin} line="That place is gone or was deleted." action="Back" onAction={goBack} /></div>;

  const p = placeInfo(place);
  const visit = placeVisit(place);
  const tel = telUrl(p.phone);
  const open = (url: string) => openExternal(url).catch((e: Error) => showToast(e.message));
  const rows: [string, string | null][] = [
    ['Address', p.address],
    ['Location', coordinatesText(p)],
    ['Phone', p.phone],
    ['Recommended by', p.recommendedBy],
    ['Last visited', visit === 'visited' ? whenLabel(p.visitedOn) : null],
  ];

  async function markVisited() {
    await store!.updateItem(place!.id, { status: 'visited', meta: placeMeta(place!.meta, { visitedOn: today() }) });
    await refresh(false);
    showToast('Marked as visited today');
  }

  return (
    <div>
      <PageHeader eyebrow={p.category ?? 'Place'} title={place.title}
        action={<button type="button" onClick={() => nav(`/places/${place.id}/edit`)} className="btn btn-primary"><Pencil size={16} aria-hidden />Edit</button>} />

      <section className="panel max-w-3xl" aria-label="Place details">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <VisitPill visit={visit} />
          {place.pinned && <span className="inline-flex items-center gap-1 text-meta font-semibold text-muted"><Star size={14} aria-hidden className="fill-current text-medium" />Favourite</span>}
          {p.rating && <Stars value={p.rating} />}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void open(mapsUrl(place))}><MapPin size={16} aria-hidden />Open in Google Maps</button>
          <button type="button" className="btn" onClick={() => void open(directionsUrl(place))}><Navigation size={16} aria-hidden />Directions</button>
          {tel && canCall() && <button type="button" className="btn" onClick={() => void open(tel)}><Phone size={16} aria-hidden />Call</button>}
          <button type="button" className="btn" onClick={() => void shareText(place.title, placeShareText(place)).then((r) => r === 'copied' && showToast('Copied. Paste it into a message.')).catch(() => showToast('Could not share this place'))}>
            <Share2 size={16} aria-hidden />Share
          </button>
        </div>
        {p.lat === null && !p.mapUrl && <p className="mb-4 text-meta text-faint">No exact location saved, so Google Maps will search for the name{p.address ? ' and address' : ''}.</p>}

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-label uppercase text-faint">{k}</dt>
              <dd className={`mt-1 whitespace-pre-wrap break-words text-body ${k === 'Location' ? 'num' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>

        {place.body && (
          <div className="mt-4 border-t border-border pt-4">
            <h2 className="text-label uppercase text-faint">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-body">{place.body}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn btn-danger" onClick={async () => { goBack(); await removeWithUndo(place); }}>Delete</button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={goBack} className="btn">Back</button>
            {visit === 'want' && <button type="button" onClick={() => void markVisited()} className="btn">Mark visited</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

const coordText = (n: number | null) => (n === null ? '' : String(n));

/** New place (`/places/new`) and editing one (`/places/:id/edit`). */
export function PlaceForm() {
  const { id } = useParams();
  const { items, store, refresh, placeCategories, showToast } = useApp();
  const nav = useNavigate();
  const goBack = useGoBack();
  const place = id ? findPlace(items, id) : null;
  const start = place ? placeInfo(place) : null;

  const [title, setTitle] = useState(place?.title ?? '');
  const [category, setCategory] = useState(start?.category ?? '');
  const [visit, setVisit] = useState<PlaceVisit>(place ? placeVisit(place) : 'want');
  const [favourite, setFavourite] = useState(place?.pinned ?? false);
  const [mapUrl, setMapUrl] = useState(start?.mapUrl ?? '');
  const [lat, setLat] = useState(coordText(start?.lat ?? null));
  const [lng, setLng] = useState(coordText(start?.lng ?? null));
  const [address, setAddress] = useState(start?.address ?? '');
  const [phone, setPhone] = useState(start?.phone ?? '');
  const [recommendedBy, setRecommendedBy] = useState(start?.recommendedBy ?? '');
  const [rating, setRating] = useState<number | null>(start?.rating ?? null);
  const [visitedOn, setVisitedOn] = useState(start?.visitedOn ?? '');
  const [body, setBody] = useState(place?.body ?? '');
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (id && !place) return <div className="panel"><EmptyState icon={MapPin} line="That place is gone or was deleted." action="Back" onAction={goBack} /></div>;

  const categories = category && !placeCategories.some((c) => c.toLowerCase() === category.toLowerCase()) ? [...placeCategories, category] : placeCategories;
  const latN = lat.trim() ? Number(lat) : null;
  const lngN = lng.trim() ? Number(lng) : null;
  const coordsOk = (latN === null && lngN === null) || (latN !== null && lngN !== null && validCoordinates(latN, lngN));
  const phoneOk = !phone.trim() || !!telUrl(phone);

  function onLink(value: string) {
    setMapUrl(value);
    if (!value.trim()) return setLinkNote(null);
    const c = parseCoordinates(value);
    if (c) {
      setLat(String(c.lat));
      setLng(String(c.lng));
      setLinkNote('Found the location in the link.');
    } else if (isShortMapLink(value)) {
      setLinkNote('Short links keep working for opening Google Maps, but the exact spot cannot be read from them offline. For the exact spot, long-press the place in Google Maps, copy the numbers it shows, and paste them here.');
    } else {
      setLinkNote('No location found in this text. It is kept as typed.');
    }
  }

  async function useMyLocation() {
    setLocating(true);
    try {
      const fix = await currentLocation();
      setLat(String(Math.round(fix.lat * 1e6) / 1e6));
      setLng(String(Math.round(fix.lng * 1e6) / 1e6));
      showToast(`Location saved (within about ${Math.max(1, Math.round(fix.accuracy))} m)`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !store || !coordsOk || !phoneOk) return;
    // A pasted pair of numbers is a location, not a link: keep only real links in the link field.
    const link = mapUrl.trim() && !/^[-+\d.,\s]+$/.test(mapUrl.trim()) ? mapUrl.trim() : null;
    const meta = placeMeta(place?.meta ?? {}, {
      category: category || null, address, phone, recommendedBy, mapUrl: link, lat: latN, lng: lngN, rating,
      visitedOn: visit === 'visited' ? visitedOn || today() : null,
    });
    const data = { title: title.trim(), body: body.trim() || null, status: visit, pinned: favourite, meta };
    let target = place?.id;
    if (place) await store.updateItem(place.id, data);
    else target = (await store.createItem({ type: 'place', ...data })).id;
    await refresh(false);
    if (place) goBack(); else nav(`/places/${target}`, { replace: true });
  }

  return (
    <div>
      <PageHeader eyebrow={place ? 'Edit place' : 'Worth remembering'} title={place ? place.title : 'New place'}
        subtitle={place ? undefined : 'Where is it, and why do you want to remember it?'}
        action={<button type="button" onClick={goBack} className="btn">Cancel</button>} />

      <form onSubmit={save} className="panel max-w-3xl">
        <FormRow label="Name" htmlFor="pl-title">
          <input id="pl-title" required maxLength={120} autoFocus={!place} className="input" placeholder="e.g. Corner bakery near the office" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormRow>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label="Category" htmlFor="pl-cat">
            <select id="pl-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormRow>
          <FormRow label="Status" htmlFor="pl-visit">
            <select id="pl-visit" className="input" value={visit} onChange={(e) => { const v = e.target.value as PlaceVisit; setVisit(v); if (v === 'visited' && !visitedOn) setVisitedOn(today()); }}>
              {PLACE_VISITS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </FormRow>
        </div>
        <label className="mb-4 flex min-h-touch items-center gap-3 text-body font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--c-secondary))]" checked={favourite} onChange={(e) => setFavourite(e.target.checked)} />
          Favourite (keeps it at the top of the list)
        </label>

        <span className="field-label">Location</span>
        <div className="mb-4 rounded-tile border border-border p-3">
          <FormRow label="Google Maps link" htmlFor="pl-link" hint="In Google Maps, tap Share and copy the link, then paste it here.">
            <input id="pl-link" className="input" inputMode="url" autoComplete="off" placeholder="Paste a Google Maps link or 18.5204, 73.8567" value={mapUrl} onChange={(e) => onLink(e.target.value)} />
          </FormRow>
          {linkNote && <p className="-mt-2 mb-3 text-meta text-muted" role="status">{linkNote}</p>}
          <div className="grid grid-cols-2 gap-x-4">
            <FormRow label="Latitude" htmlFor="pl-lat">
              <input id="pl-lat" className="input num" inputMode="decimal" placeholder="18.5204" value={lat} onChange={(e) => setLat(e.target.value.trim())} />
            </FormRow>
            <FormRow label="Longitude" htmlFor="pl-lng">
              <input id="pl-lng" className="input num" inputMode="decimal" placeholder="73.8567" value={lng} onChange={(e) => setLng(e.target.value.trim())} />
            </FormRow>
          </div>
          {!coordsOk && <p className="-mt-2 mb-3 text-meta text-overdue" role="alert">Enter both numbers: latitude between -90 and 90, longitude between -180 and 180.</p>}
          <div className="flex flex-wrap gap-2">
            {canUseLocation() && (
              <button type="button" className="btn" disabled={locating} onClick={() => void useMyLocation()}><Crosshair size={16} aria-hidden />{locating ? 'Finding you…' : 'Use my location'}</button>
            )}
            {(lat || lng) && <button type="button" className="btn" onClick={() => { setLat(''); setLng(''); }}>Clear location</button>}
          </div>
        </div>

        <FormRow label="Address or area" htmlFor="pl-addr">
          <textarea id="pl-addr" rows={2} className="input py-2" placeholder="e.g. FC Road, Pune" value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormRow>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label="Phone" htmlFor="pl-phone">
            <input id="pl-phone" type="tel" className="input num" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormRow>
          <FormRow label="Recommended by" htmlFor="pl-rec">
            <input id="pl-rec" className="input" maxLength={80} placeholder="e.g. Priya" value={recommendedBy} onChange={(e) => setRecommendedBy(e.target.value)} />
          </FormRow>
        </div>
        {!phoneOk && <p className="-mt-2 mb-3 text-meta text-overdue" role="alert">Use only digits, spaces, dashes, brackets and a leading +.</p>}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="mb-4">
            <span className="field-label" id="pl-rating">Rating</span>
            <div className="flex items-center" role="group" aria-labelledby="pl-rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n}
                  onClick={() => setRating(rating === n ? null : n)} className="flex min-h-touch w-touch items-center justify-center text-medium">
                  <Star size={22} aria-hidden className={rating !== null && n <= rating ? 'fill-current' : 'text-faint'} />
                </button>
              ))}
              {rating !== null && <button type="button" className="text-link ml-2 !text-meta" onClick={() => setRating(null)}>Clear</button>}
            </div>
          </div>
          {visit === 'visited' && (
            <FormRow label="Last visited" htmlFor="pl-when">
              <input id="pl-when" type="date" className="input num" value={visitedOn} max={today()} onChange={(e) => setVisitedOn(e.target.value)} />
            </FormRow>
          )}
        </div>

        <FormRow label="Notes" htmlFor="pl-body">
          <textarea id="pl-body" rows={3} className="input py-2" placeholder="What to order, opening hours, who to ask for…" value={body} onChange={(e) => setBody(e.target.value)} />
        </FormRow>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={goBack} className="btn">Cancel</button>
          <button type="submit" disabled={!title.trim() || !coordsOk || !phoneOk} className="btn btn-primary disabled:opacity-50">Save place</button>
        </div>
      </form>
    </div>
  );
}
