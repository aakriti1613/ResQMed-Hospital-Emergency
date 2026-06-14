import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
}

interface Props {
  onSelect: (result: GeoResult) => void;
  placeholder?: string;
}

export const LocationSearchInput = ({ onSelect, placeholder = 'Search for a location…' }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setResults(
          data.map((d: any) => ({
            lat: parseFloat(d.lat),
            lon: parseFloat(d.lon),
            displayName: d.display_name,
          }))
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query]);

  const handleSelect = (r: GeoResult) => {
    setQuery(r.displayName.split(',').slice(0, 2).join(','));
    setOpen(false);
    onSelect(r);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      {/* Search input */}
      <div className="flex items-center gap-2 h-11 rounded-2xl border border-white/10 bg-[#0e0f14] px-3 focus-within:border-blue-500/50 transition">
        {loading
          ? <Loader2 className="h-4 w-4 text-white/30 animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-white/30 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-white/30 outline-none"
        />
        {query && (
          <button onClick={clear} className="p-0.5 rounded-full hover:bg-white/10 transition shrink-0">
            <X className="h-3.5 w-3.5 text-white/40" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 top-[calc(100%+6px)] inset-x-0 rounded-2xl border border-white/[0.08] bg-[#13141a] shadow-2xl overflow-hidden"
          >
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/[0.04] last:border-0"
              >
                <MapPin className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <span className="text-xs text-white/80 leading-relaxed line-clamp-2">{r.displayName}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
