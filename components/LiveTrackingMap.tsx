/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Clock } from 'lucide-react';
import { loadGoogleMaps } from '../lib/googleMaps';
import { decodePolyline, formatEta, formatDistance } from '../data/routing';

export type LatLonLite = { lat: number; lon: number };

type Props = {
  /** Destination pin (the person in trouble). Always shown. */
  victim: LatLonLite;
  /** Helper / ambulance marker. Moves smoothly between updates. */
  helper?: LatLonLite | null;
  /** Encoded polyline to draw. Empty means no route yet. */
  routeEncoded?: string;
  etaSeconds?: number;
  distanceMeters?: number;
  /** Who is viewing: affects label copy only. */
  viewerRole: 'victim' | 'helper';
  /** Display name of helper (shown on victim side). */
  helperName?: string;
  /** Height of the map container */
  height?: number | string;
  /** Show a native "Open in Google Maps" deep-link button. */
  showOpenInMaps?: boolean;
};

const VICTIM_ICON_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs>
        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".4"/>
        </filter>
      </defs>
      <path filter="url(#s)" d="M20 2C10.6 2 3 9.6 3 19c0 11.7 14.4 28.5 16.2 30.6a1 1 0 0 0 1.6 0C22.6 47.5 37 30.7 37 19 37 9.6 29.4 2 20 2z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
      <circle cx="20" cy="19" r="6" fill="#fff"/>
    </svg>`
  );

const HELPER_ICON_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <defs>
        <filter id="s2" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".4"/>
        </filter>
      </defs>
      <circle filter="url(#s2)" cx="20" cy="20" r="15" fill="#1d4ed8" stroke="#fff" stroke-width="3"/>
      <path d="M14 22l4 4 8-10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );

// Dark map style tuned for the app's theme
const NIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f1420' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1420' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7c8ba3' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2030' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#222a3a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8b96ab' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2d3a55' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1020' }] },
];

export const LiveTrackingMap = ({
  victim,
  helper,
  routeEncoded,
  etaSeconds,
  distanceMeters,
  viewerRole,
  helperName,
  height = 280,
  showOpenInMaps = true,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const victimMarkerRef = useRef<google.maps.Marker | null>(null);
  const helperMarkerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const tweenRafRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local ETA countdown between server updates so the display feels alive
  const [localEta, setLocalEta] = useState<number | undefined>(etaSeconds);
  useEffect(() => setLocalEta(etaSeconds), [etaSeconds]);
  useEffect(() => {
    if (localEta === undefined || localEta <= 0) return;
    const t = setInterval(() => {
      setLocalEta((e) => (e === undefined ? undefined : Math.max(0, e - 1)));
    }, 1000);
    return () => clearInterval(t);
  }, [etaSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1. Load Maps + init ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(['geometry'])
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: victim.lat, lng: victim.lon },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          styles: NIGHT_STYLE,
          gestureHandling: 'greedy',
          clickableIcons: false,
          backgroundColor: '#0f1420',
        });
        mapRef.current = map;

        victimMarkerRef.current = new google.maps.Marker({
          position: { lat: victim.lat, lng: victim.lon },
          map,
          icon: {
            url: VICTIM_ICON_SVG,
            scaledSize: new google.maps.Size(40, 52),
            anchor: new google.maps.Point(20, 50),
          },
          zIndex: 10,
          title: viewerRole === 'helper' ? 'Emergency location' : 'You',
        });

        setReady(true);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    return () => {
      cancelled = true;
      if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Victim marker position keeps current (rare, but SOS loc can update) ─
  useEffect(() => {
    if (!ready || !victimMarkerRef.current) return;
    victimMarkerRef.current.setPosition({ lat: victim.lat, lng: victim.lon });
  }, [ready, victim.lat, victim.lon]);

  // ── 3. Helper marker + smooth tween between updates ────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!helper) return;

    const target = { lat: helper.lat, lng: helper.lon };
    if (!helperMarkerRef.current) {
      helperMarkerRef.current = new google.maps.Marker({
        position: target,
        map: mapRef.current,
        icon: {
          url: HELPER_ICON_SVG,
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        },
        zIndex: 20,
        title: viewerRole === 'victim' ? helperName || 'Helper' : 'You',
      });
      return;
    }

    // Tween from current position to the new target over ~800ms
    const marker = helperMarkerRef.current;
    const fromPos = marker.getPosition();
    if (!fromPos) {
      marker.setPosition(target);
      return;
    }
    const from = { lat: fromPos.lat(), lng: fromPos.lng() };
    const duration = 800;
    const start = performance.now();

    if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      const lat = from.lat + (target.lat - from.lat) * eased;
      const lng = from.lng + (target.lng - from.lng) * eased;
      marker.setPosition({ lat, lng });
      if (t < 1) tweenRafRef.current = requestAnimationFrame(step);
    };
    tweenRafRef.current = requestAnimationFrame(step);
  }, [ready, helper?.lat, helper?.lon, helperName, viewerRole]);

  // ── 4. Route polyline ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    if (!routeEncoded) {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      return;
    }

    decodePolyline(routeEncoded).then((path) => {
      if (cancelled || !mapRef.current) return;

      polylineRef.current?.setMap(null);
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapRef.current,
        zIndex: 5,
      });

      // Fit bounds to show both markers + route
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      bounds.extend({ lat: victim.lat, lng: victim.lon });
      if (helper) bounds.extend({ lat: helper.lat, lng: helper.lon });
      mapRef.current.fitBounds(bounds, 60);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, routeEncoded, victim.lat, victim.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Re-fit when helper appears for first time without a route yet ───
  useEffect(() => {
    if (!ready || !mapRef.current || routeEncoded) return;
    if (!helper) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: victim.lat, lng: victim.lon });
    bounds.extend({ lat: helper.lat, lng: helper.lon });
    mapRef.current.fitBounds(bounds, 80);
  }, [ready, helper?.lat, helper?.lon, routeEncoded, victim.lat, victim.lon]);

  // ── UI chrome ─────────────────────────────────────────────────────────
  const h = typeof height === 'number' ? `${height}px` : height;

  const mapsDeepLink = helper
    ? // For the helper: turn-by-turn directions to the victim
      viewerRole === 'helper'
      ? `https://www.google.com/maps/dir/?api=1&origin=${helper.lat},${helper.lon}&destination=${victim.lat},${victim.lon}&travelmode=driving`
      : // For the victim: just open the SOS location
        `https://maps.google.com/?q=${victim.lat},${victim.lon}`
    : `https://maps.google.com/?q=${victim.lat},${victim.lon}`;

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden border border-white/[0.06] bg-[#0c1420]"
      style={{ height: h }}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <div className="text-[10px] text-red-300">Map failed to load: {error}</div>
        </div>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      )}

      {/* ETA card */}
      {(helper || routeEncoded) && ready && (
        <div
          className="absolute left-3 top-3 rounded-2xl border border-white/[0.08] bg-black/55 backdrop-blur-md px-3.5 py-2 flex items-center gap-3 shadow-2xl"
          style={{ maxWidth: 'calc(100% - 24px)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-blue-300 shrink-0" />
            <div>
              <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider leading-none">
                ETA
              </div>
              <div className="text-sm font-black text-white leading-tight">
                {formatEta(localEta)}
              </div>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <div>
              <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider leading-none">
                Distance
              </div>
              <div className="text-sm font-black text-white leading-tight">
                {formatDistance(distanceMeters)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* "Open in Google Maps" deep link */}
      {showOpenInMaps && ready && (
        <a
          href={mapsDeepLink}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-black/60 backdrop-blur-md px-3 py-2 text-[10px] font-black text-white hover:bg-black/75 transition shadow-xl"
        >
          <Navigation className="h-3.5 w-3.5" />
          {viewerRole === 'helper' ? 'Navigate' : 'Open in Maps'}
        </a>
      )}
    </div>
  );
};
