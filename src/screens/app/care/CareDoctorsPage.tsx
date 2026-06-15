// NOTE: Historical filename retained (src/screens/app/care/CareDoctorsPage.tsx)
// so the existing router & dynamic imports keep working. This file now
// implements the **Hospital details** screen. It lists doctors available at
// the selected hospital for the selected department.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Star, MapPin, Clock, Search, Stethoscope, Building2, Sparkles, ChevronRight, Phone,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DEPARTMENTS, SHOWCASE_HOSPITAL, SHOWCASE_HOSPITAL_ID,
  findNearbyHospitals, getDepartment, getShowcaseDoctorsForDept,
  type DepartmentId, type Doctor, type HospitalInfo,
} from '../../../data/hospitals';
import { useSharedLocation } from '../../../hooks/useSharedLocation';

export const CareDoctorsPage = () => {
  const nav = useNavigate();
  const params = useParams();
  const [search, setSearch] = useSearchParams();

  const hospitalId = params.hospitalId || search.get('hospital') || SHOWCASE_HOSPITAL_ID;
  const deptId = (search.get('dept') || 'general') as DepartmentId;
  const [deptIdState, setDeptIdState] = useState<DepartmentId>(deptId);
  const dept = getDepartment(deptIdState);

  // Resolve hospital metadata. The showcase hospital is in our static data;
  // real hospitals need a round-trip to Google Places.
  const [hospital, setHospital] = useState<HospitalInfo | null>(
    hospitalId === SHOWCASE_HOSPITAL_ID ? SHOWCASE_HOSPITAL : null
  );
  const { currentLocation } = useSharedLocation('arogya_raksha_location');

  useEffect(() => {
    if (hospital) return;
    if (!currentLocation) return;
    findNearbyHospitals({ lat: currentLocation.lat, lon: currentLocation.lon }).then((list) => {
      const match = list.find((h) => h.id === hospitalId);
      if (match) setHospital(match);
    }).catch(() => {});
  }, [hospital, currentLocation?.lat, currentLocation?.lon, hospitalId]);

  // Keep the URL in sync when the user taps a different department chip.
  const selectDept = (id: DepartmentId) => {
    setDeptIdState(id);
    const next = new URLSearchParams(search);
    next.set('dept', id);
    setSearch(next, { replace: true });
  };

  const isShowcase = hospitalId === SHOWCASE_HOSPITAL_ID;

  // Doctors: only the showcase hospital has a stored roster. For real
  // hospitals we explain that booking is handled through the partner hospital.
  const doctors: Doctor[] = useMemo(
    () => isShowcase ? getShowcaseDoctorsForDept(deptIdState) : [],
    [isShowcase, deptIdState]
  );

  const [q, setQ] = useState('');
  const visibleDoctors = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return doctors;
    return doctors.filter((d) =>
      d.name.toLowerCase().includes(needle) ||
      d.title.toLowerCase().includes(needle) ||
      d.qualifications.toLowerCase().includes(needle)
    );
  }, [q, doctors]);

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-8 max-w-lg mx-auto w-full space-y-4">
      <button
        onClick={() => nav(-1)}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Hospital hero card */}
      <div className="rounded-3xl overflow-hidden border border-white/[0.06] bg-[#13141a]">
        <div
          className="relative h-28 flex items-end"
          style={
            hospital?.photoUrl
              ? { background: `#1c1d25 url(${hospital.photoUrl}) center/cover` }
              : { background: isShowcase
                  ? 'linear-gradient(135deg,#10b981,#0891b2)'
                  : 'linear-gradient(135deg,#1e293b,#0f172a)' }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="relative p-4">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {isShowcase && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-[1px] text-[9px] font-black text-emerald-200 uppercase tracking-wider">
                  <Sparkles className="h-2.5 w-2.5" /> Partner
                </span>
              )}
              {typeof hospital?.rating === 'number' && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-black/40 border border-white/10 px-1.5 py-[1px] text-[10px] text-white/85 font-bold">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {hospital.rating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="text-base font-black text-white leading-tight">
              {hospital?.name || 'Loading hospital…'}
            </div>
            <div className="text-[10px] text-white/70 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{hospital?.address || hospital?.tagline || '-'}</span>
            </div>
          </div>
        </div>

        <div className="p-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat icon={<Clock className="h-3.5 w-3.5 text-emerald-400" />}
            label="Hours" value={hospital?.openingHours || '10 AM – 10 PM'} />
          <MiniStat icon={<Stethoscope className="h-3.5 w-3.5 text-sky-400" />}
            label={isShowcase ? 'Doctors' : 'Departments'} value={isShowcase ? '12+' : 'Multi'} />
          <MiniStat icon={<Phone className="h-3.5 w-3.5 text-amber-400" />}
            label="Contact" value={isShowcase ? '24×7' : 'On-site'} />
        </div>
      </div>

      {/* Department chips */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Department
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DEPARTMENTS.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDept(d.id)}
              className={[
                'shrink-0 rounded-full px-3 h-9 text-[11px] font-black transition border flex items-center gap-1',
                d.id === deptIdState
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:bg-white/[0.06]',
              ].join(' ')}
            >
              <span>{d.icon}</span> {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor search */}
      {isShowcase && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search doctor or condition"
            className="w-full h-11 rounded-2xl border border-white/[0.06] bg-[#13141a] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/15 transition"
          />
        </div>
      )}

      {/* Doctors list */}
      {isShowcase ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
              {visibleDoctors.length} doctor{visibleDoctors.length === 1 ? '' : 's'} in {dept.name}
            </span>
          </div>

          {visibleDoctors.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.25) }}
            >
              <DoctorRow doctor={d} hospitalId={hospitalId} />
            </motion.div>
          ))}

          {visibleDoctors.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <Stethoscope className="h-7 w-7 text-white/20 mx-auto mb-2" />
              <p className="text-sm font-bold text-white/50">No matching doctor</p>
              <p className="text-[11px] text-white/30 mt-0.5">Try another specialty or search term</p>
            </div>
          )}
        </div>
      ) : (
        <PartnerRedirectCard hospital={hospital} deptId={deptIdState} />
      )}
    </div>
  );
};

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2.5">
    <div className="flex items-center justify-center mb-1">{icon}</div>
    <div className="text-[11px] font-black text-white truncate">{value}</div>
    <div className="text-[9px] text-white/35 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);

const DoctorRow = ({ doctor, hospitalId }: { doctor: Doctor; hospitalId: string }) => (
  <Link
    to={`/app/care/book?doctor=${encodeURIComponent(doctor.id)}&hospital=${encodeURIComponent(hospitalId)}&dept=${encodeURIComponent(doctor.department)}`}
    className="block rounded-3xl border border-white/[0.06] bg-[#13141a] p-3.5 hover:border-white/15 transition"
  >
    <div className="flex gap-3">
      <div
        className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: `linear-gradient(135deg, ${doctor.avatarTint}30, ${doctor.avatarTint}10)` }}
      >
        <span>{doctor.avatarEmoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black text-white truncate">{doctor.name}</span>
        </div>
        <div className="text-[11px] text-white/55 truncate mt-0.5">{doctor.title}</div>
        <div className="text-[10px] text-white/35 truncate">{doctor.qualifications}</div>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-white/55">
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            {doctor.rating.toFixed(1)}
            <span className="text-white/25 font-medium">· {doctor.reviewsCount.toLocaleString()}</span>
          </span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span>{doctor.experienceYears} yrs exp</span>
          <span className="h-1 w-1 rounded-full bg-white/15" />
          <span className="text-emerald-300/85">{doctor.bookingsCount.toLocaleString()} booked</span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <span className="text-[10px] font-black text-white/70">₹{doctor.feeRupees}</span>
        <ChevronRight className="h-4 w-4 text-white/30" />
      </div>
    </div>
  </Link>
);

const PartnerRedirectCard = ({
  hospital, deptId,
}: { hospital: HospitalInfo | null; deptId: DepartmentId }) => (
  <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-5 space-y-3">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }}>
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-white">
          {hospital?.name} is a Google-listed hospital
        </div>
        <p className="mt-1 text-[11px] text-white/45 leading-relaxed">
          Live appointment booking is currently available only with our verified partner hospital,
          <span className="text-white/80 font-semibold"> Arogya Medicare</span>. You can still call or
          visit {hospital?.name}, or book a {getDepartment(deptId).name} consultation with one of our partner doctors right now.
        </p>
      </div>
    </div>
    <Link
      to={`/app/care/hospital/${SHOWCASE_HOSPITAL.id}?dept=${encodeURIComponent(deptId)}`}
      className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-white transition active:scale-95"
      style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
    >
      <Sparkles className="h-4 w-4" />
      Book with Arogya Medicare
    </Link>
  </div>
);
