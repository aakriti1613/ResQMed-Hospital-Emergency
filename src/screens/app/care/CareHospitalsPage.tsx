import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, Star, ChevronLeft, Building2, Loader2, Phone, Sparkles, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DEPARTMENTS, SHOWCASE_HOSPITAL, findNearbyHospitals, formatDistanceKm, getDepartment,
  type DepartmentId, type HospitalInfo,
} from '../../../data/hospitals';
import { useSharedLocation } from '../../../hooks/useSharedLocation';
import { LocationSearchModal } from '../../../components/LocationSearchModal';
import { AnimatePresence } from 'framer-motion';

export const CareHospitalsPage = () => {
  const nav = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const deptId = (params.deptId || search.get('dept') || 'general') as DepartmentId;
  const dept = getDepartment(deptId);

  const { currentLocation, requestGPS } = useSharedLocation('arogya_raksha_location');
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showManual, setShowManual] = useState(false);

  // On mount, silently try to obtain GPS if not set
  useEffect(() => {
    if (!currentLocation) {
      void requestGPS({ silent: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch nearby hospitals only when the user has a real location
  useEffect(() => {
    if (!currentLocation) return;
    setLoading(true);
    findNearbyHospitals({ lat: currentLocation.lat, lon: currentLocation.lon }, 8)
      .then((list) =>
        // remove any demo placeholders — user wants only real nearby hospitals
        setHospitals(list.filter((h) => !String(h.id || '').startsWith('demo_nearby_')))
      )
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false));
  }, [currentLocation?.lat, currentLocation?.lon]);

  const merged = useMemo<HospitalInfo[]>(() => {
    const list: HospitalInfo[] = [
      // Always pin the showcase hospital at the top — it's the only fully
      // bookable hospital and we want users to always see it as an option.
      {
        ...SHOWCASE_HOSPITAL,
        distanceKm: undefined, // "Available everywhere" label
      },
      ...hospitals,
    ];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((h) =>
      h.name.toLowerCase().includes(needle) ||
      (h.address || '').toLowerCase().includes(needle) ||
      (h.tagline || '').toLowerCase().includes(needle)
    );
  }, [hospitals, query]);


  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-8 max-w-lg mx-auto w-full space-y-4">
      {/* Header */}
      <button
        onClick={() => nav('/app/care')}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Departments
      </button>

      <div className="rounded-3xl p-4 relative overflow-hidden" style={{ background: dept.gradient }}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">
            {dept.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Department</div>
            <div className="text-lg font-black text-white leading-tight">{dept.name}</div>
            <div className="text-[11px] text-white/70 mt-0.5">{dept.tagline}</div>
          </div>
        </div>
      </div>

      {/* Search + location row */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hospital by name or area"
            className="w-full h-12 rounded-2xl border border-white/[0.06] bg-[#13141a] pl-11 pr-11 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/15 transition"
          />
          {query.trim() !== '' && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.08] transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowManual(true)}
          className="w-full flex items-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.04] transition"
        >
          <MapPin className="h-3.5 w-3.5 text-sky-300 shrink-0" />
          <span className="flex-1 text-[11px] text-white/55 truncate">
            {currentLocation
              ? <>Near <span className="text-white/85 font-semibold">{currentLocation.displayName || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)}`}</span></>
              : 'Tap to set your location'}
          </span>
          <span className="text-[10px] font-bold text-sky-300">Change</span>
        </button>
      </div>

      {/* Status strip */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
          {loading ? 'Finding hospitals…' : `${merged.length} hospital${merged.length === 1 ? '' : 's'}`}
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin" />}
      </div>

      {/* Hospitals list */}
      <div className="space-y-2.5">
        {merged.map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
          >
            <HospitalRow hospital={h} deptId={deptId} />
          </motion.div>
        ))}

        {!loading && merged.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Building2 className="h-7 w-7 text-white/20 mx-auto mb-2" />
            <p className="text-sm font-bold text-white/50">
              {query.trim() ? 'No matches for your search' : 'No hospitals found nearby'}
            </p>
            <p className="text-[11px] text-white/30 mt-0.5">
              {query.trim()
                ? 'Clear the search box or try a shorter keyword (e.g. “Apollo”).'
                : 'Try widening your search or pick another location.'}
            </p>
            {query.trim() !== '' && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-3 text-xs font-black text-sky-300 hover:text-sky-200 underline underline-offset-2"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Manual location modal */}
      <AnimatePresence>
        {showManual && (
          <LocationSearchModal
            onClose={() => setShowManual(false)}
            onSelect={(r) => {
              // Piggy-back on the same shared location used by the rest of the app
              const loc = {
                lat: r.lat, lon: r.lon, displayName: r.displayName,
                source: 'manual' as const, timestamp: Date.now(),
              };
              localStorage.setItem('arogya_raksha_location', JSON.stringify(loc));
              window.dispatchEvent(new Event('arogya_location_updated_arogya_raksha_location'));
              setShowManual(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const HospitalRow = ({ hospital, deptId }: { hospital: HospitalInfo; deptId: DepartmentId }) => (
  <Link
    to={`/app/care/hospital/${encodeURIComponent(hospital.id)}?dept=${encodeURIComponent(deptId)}`}
    className="block rounded-3xl border border-white/[0.06] bg-[#13141a] p-3.5 relative overflow-hidden hover:border-white/15 transition"
  >
    {hospital.isShowcase && (
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }} />
    )}
    <div className="relative flex items-start gap-3">
      <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
        style={
          hospital.photoUrl
            ? { background: `#1c1d25 url(${hospital.photoUrl}) center/cover` }
            : { background: hospital.isShowcase ? 'linear-gradient(135deg,#10b981,#0891b2)' : '#1c1d25' }
        }>
        {!hospital.photoUrl && (
          <Building2 className={`h-6 w-6 ${hospital.isShowcase ? 'text-white' : 'text-white/40'}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {hospital.isShowcase && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-[1px] text-[9px] font-black text-emerald-300 uppercase tracking-wider">
              <Sparkles className="h-2.5 w-2.5" /> Partner
            </span>
          )}
          {typeof hospital.rating === 'number' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-white/60 font-bold">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {hospital.rating.toFixed(1)}
              {hospital.reviewsCount && (
                <span className="text-white/30 font-medium"> · {hospital.reviewsCount.toLocaleString()}</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm font-black text-white truncate">{hospital.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{hospital.address || hospital.tagline || 'Location unavailable'}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-white/55">
          {hospital.distanceKm !== undefined ? (
            <span>📍 {formatDistanceKm(hospital.distanceKm)} away</span>
          ) : hospital.isShowcase ? (
            <span className="text-emerald-300/90">✨ Available everywhere</span>
          ) : null}
          {hospital.openingHours && (
            <>
              <span className="h-1 w-1 rounded-full bg-white/15" />
              <span className="text-emerald-300/80">{hospital.openingHours}</span>
            </>
          )}
          {hospital.isShowcase && hospital.phone && (
            <>
              <span className="h-1 w-1 rounded-full bg-white/15" />
              <span className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" />24×7</span>
            </>
          )}
        </div>
      </div>
    </div>
  </Link>
);

// Re-export the (unused) DEPARTMENTS reference so tree-shaking keeps the file
// from going dead on unrelated refactors.
export { DEPARTMENTS };
