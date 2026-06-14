import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, Star, MapPin, CalendarCheck2, FolderHeart, Sparkles, Stethoscope,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DEPARTMENTS, SHOWCASE_HOSPITAL } from '../../../data/hospitals';

export const CareSpecialtiesPage = () => {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DEPARTMENTS;
    return DEPARTMENTS.filter((d) => {
      const name = t(`departments.${d.id}.name`, { defaultValue: d.name }).toLowerCase();
      const tagline = t(`departments.${d.id}.tagline`, { defaultValue: d.tagline }).toLowerCase();
      return (
        name.includes(needle) ||
        tagline.includes(needle) ||
        d.name.toLowerCase().includes(needle) ||
        d.tagline.toLowerCase().includes(needle)
      );
    });
  }, [q, t]);

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-8 max-w-lg mx-auto w-full space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-sky-300" />
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-300/80">{t('care.eyebrow')}</span>
        </div>
        <h1 className="mt-1 text-2xl font-black text-white">{t('care.title')}</h1>
        <p className="mt-1 text-xs text-white/40">{t('care.subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('care.searchPlaceholder')}
          className="w-full h-12 rounded-2xl border border-white/[0.06] bg-[#13141a] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/15 transition"
        />
      </div>

      {/* Showcase hospital call-out — always bookable */}
      <Link
        to={`/app/care/hospital/${SHOWCASE_HOSPITAL.id}?dept=general`}
        className="block rounded-3xl border border-white/[0.08] bg-[#13141a] p-4 relative overflow-hidden hover:border-white/15 transition"
      >
        <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)' }} />
        <div className="relative flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#10b981,#0891b2)', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
            <span className="text-2xl">🏥</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">{t('care.partnerHospital')}</span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-bold text-white/40 inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {SHOWCASE_HOSPITAL.rating}
              </span>
            </div>
            <div className="mt-0.5 text-base font-black text-white truncate">{SHOWCASE_HOSPITAL.name}</div>
            <div className="text-[11px] text-white/45 truncate">
              {SHOWCASE_HOSPITAL.tagline} · {t('care.bookableSub')}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        </div>
      </Link>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <QuickAction
          onClick={() => nav('/app/appointments')}
          icon={<CalendarCheck2 className="h-4 w-4 text-emerald-300" />}
          label={t('care.myAppts')}
          sub={t('care.upcoming')}
        />
        <QuickAction
          onClick={() => nav('/app/vault?from=home')}
          icon={<FolderHeart className="h-4 w-4 text-pink-300" />}
          label={t('care.vaultShort')}
          sub={t('care.records')}
        />
        <QuickAction
          onClick={() => nav('/app/care/department/general')}
          icon={<Sparkles className="h-4 w-4 text-amber-300" />}
          label={t('care.quickVisit')}
          sub={t('care.general')}
        />
      </div>

      {/* Departments grid */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{t('care.browseDept')}</span>
          <span className="text-[10px] text-white/30">{t('care.deptCount', { visible: visible.length, total: DEPARTMENTS.length })}</span>
        </div>
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <Search className="h-7 w-7 text-white/20 mx-auto mb-2" />
            <p className="text-sm font-bold text-white/50">{t('care.noDeptFound')}</p>
            <p className="text-xs text-white/30 mt-0.5">{t('care.noDeptHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {visible.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
              >
                <Link
                  to={`/app/care/department/${d.id}`}
                  className="group block h-full rounded-2xl border border-white/[0.06] bg-[#13141a] p-3.5 relative overflow-hidden hover:border-white/15 transition"
                >
                  <div
                    className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl pointer-events-none transition group-hover:opacity-40"
                    style={{ background: d.gradient }}
                  />
                  <div className="relative flex items-start gap-2.5">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                      style={{ background: d.gradient }}
                    >
                      <span>{d.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-white leading-tight truncate">
                        {t(`departments.${d.id}.name`, { defaultValue: d.name })}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5 truncate">
                        {t(`departments.${d.id}.tagline`, { defaultValue: d.tagline })}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Tiny tip */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 flex items-start gap-2">
        <MapPin className="h-3.5 w-3.5 text-white/30 shrink-0 mt-0.5" />
        <p className="text-[10px] text-white/40 leading-relaxed">{t('care.mapTip')}</p>
      </div>
    </div>
  );
};

const QuickAction = ({
  onClick, icon, label, sub,
}: { onClick: () => void; icon: React.ReactNode; label: string; sub: string }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.05] bg-[#13141a] py-3 transition active:scale-95 hover:bg-white/[0.04]"
  >
    {icon}
    <span className="text-[11px] font-black text-white/80">{label}</span>
    <span className="text-[9px] text-white/30">{sub}</span>
  </button>
);
