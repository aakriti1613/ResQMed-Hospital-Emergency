/// <reference types="google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, ChevronLeft, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
}

interface Props {
  onSelect: (result: GeoResult) => void;
  onClose: () => void;
}

// Add a global type for the geocoder results we temporarily store
type PredictionResult = {
  placeId: string;
  displayName: string;
};

let googleMapsLoadPromise: Promise<void> | null = null;

const loadGoogleMaps = () => {
  if (typeof google !== 'undefined' && google?.maps) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
};

export const LocationSearchModal = ({ onSelect, onClose }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  const [recentSearches, setRecentSearches] = useState<GeoResult[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('arogya_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}

    loadGoogleMaps().then(() => {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      geocoder.current = new google.maps.Geocoder();
      setMapsReady(true);
    });
  }, []);

  const handleSelectRecent = (r: GeoResult) => {
    const newRecents = [r, ...recentSearches.filter(x => x.displayName !== r.displayName)].slice(0, 5);
    setRecentSearches(newRecents);
    localStorage.setItem('arogya_recent_searches', JSON.stringify(newRecents));
    onSelect(r);
  };

  const handleSelectPrediction = async (p: PredictionResult) => {
    if (!geocoder.current) return;
    setLoading(true);
    try {
      const res = await geocoder.current.geocode({ placeId: p.placeId });
      if (res.results && res.results.length > 0 && res.results[0]) {
        const location = res.results[0].geometry.location;
        const result: GeoResult = {
          lat: location.lat(),
          lon: location.lng(),
          displayName: p.displayName
        };
        handleSelectRecent(result);
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    if (!mapsReady || !autocompleteService.current) return;

    debounce.current = setTimeout(() => {
      setLoading(true);
      autocompleteService.current?.getPlacePredictions(
        { input: query },
        (
          predictions: google.maps.places.AutocompletePrediction[] | null,
          status: any
        ) => {
          setLoading(false);
          if (status !== (google.maps.places as any).PlacesServiceStatus?.OK || !predictions) {
            setResults([]);
            return;
          }
          setResults(
            predictions.map((p) => ({
              placeId: p.place_id,
              displayName: p.description
            }))
          );
        }
      );
    }, 400);
  }, [query, mapsReady]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ ease: "easeOut", duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-[#0a0b0f] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition shrink-0">
          <ChevronLeft className="h-6 w-6 text-white/70" />
        </button>
        <div className="flex-1 flex items-center gap-2 h-12 rounded-xl bg-white/[0.05] border border-white/10 px-3 focus-within:border-blue-500/50 transition">
          {loading ? (
            <Loader2 className="h-4 w-4 text-white/30 animate-spin shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-white/30 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter area, street, or city…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none h-full"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }} className="p-1 rounded-full hover:bg-white/10 transition shrink-0">
              <X className="h-4 w-4 text-white/40" />
            </button>
          )}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {results.length > 0 ? (
          <div className="divide-y divide-white/[0.04]">
            {results.map((r, i) => {
              const parts = r.displayName.split(',');
              const mainText = parts[0];
              const subText = parts.slice(1).join(',').trim();
              return (
                <button
                  key={i}
                  onClick={() => handleSelectPrediction(r)}
                  className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/5 transition active:bg-white/10"
                >
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/90 truncate">{mainText}</div>
                    {subText && (
                      <div className="text-xs text-white/40 truncate mt-0.5">{subText}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : query.length >= 3 && !loading ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">
            No places found for "{query}"
          </div>
        ) : query.length > 0 && query.length < 3 ? (
          <div className="px-5 py-8 text-center text-xs text-white/30">
            Keep typing to search…
          </div>
        ) : (
          <div className="px-5 pt-6">
            {recentSearches.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {recentSearches.map((r, i) => {
                  const parts = r.displayName.split(',');
                  const mainText = parts[0];
                  const subText = parts.slice(1).join(',').trim();
                  return (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleSelectRecent(r)}
                      className="w-full flex items-start gap-4 py-3 text-left hover:bg-white/5 transition"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-white/30" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white/70 truncate">{mainText}</div>
                        {subText && (
                          <div className="text-[10px] text-white/30 truncate mt-0.5">{subText}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-white/30">
                Search for an intersection, business, or address
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
