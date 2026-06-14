import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

const LANGS = [
  { code: 'en', short: 'EN', accent: '#34d399' },
  { code: 'hi', short: 'हि', accent: '#fbbf24' },
  { code: 'te', short: 'తె', accent: '#60a5fa' },
] as const;

type Props = {
  compact?: boolean;
  className?: string;
  menuAlign?: 'left' | 'right';
};

export function LanguageSwitcher({ compact = false, className = '', menuAlign = 'right' }: Props) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = i18n.language.split('-')[0];
  const active = LANGS.find((l) => l.code === current) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className={className || undefined}>
      <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('settings.selectLanguage')}
        onClick={() => setOpen((v) => !v)}
        className={[
          'group relative inline-flex items-center gap-1.5 rounded-full font-black transition-all duration-200',
          'border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.12] to-white/[0.04]',
          'hover:border-emerald-400/35 hover:from-emerald-500/[0.18] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
          'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
          open ? 'border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.2)]' : '',
          compact ? 'h-8 pl-2 pr-1.5 text-[10px]' : 'h-9 pl-2.5 pr-2 text-xs',
        ].join(' ')}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(135deg, ${active.accent}33, ${active.accent}11)`,
            boxShadow: `0 0 12px ${active.accent}22`,
          }}
        >
          <Languages className={compact ? 'h-3 w-3 text-emerald-300' : 'h-3.5 w-3.5 text-emerald-300'} />
        </span>

        <span className="text-white/90 tracking-wide">
          {compact ? active.short : t(`settings.${active.code}`)}
        </span>

        <ChevronDown
          className={[
            'shrink-0 text-emerald-300/70 transition-transform duration-200',
            compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
            open ? 'rotate-180' : 'group-hover:translate-y-px',
          ].join(' ')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={t('settings.language')}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={[
              'absolute z-50 mt-2 overflow-hidden rounded-2xl',
              menuAlign === 'left' ? 'left-0' : 'right-0',
              'border border-white/10 bg-[#12131a]/95 backdrop-blur-xl',
              'shadow-[0_16px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]',
              compact ? 'min-w-[168px]' : 'min-w-[188px]',
            ].join(' ')}
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                {t('settings.language')}
              </p>
            </div>

            <ul className="p-1.5 space-y-0.5">
              {LANGS.map((lang) => {
                const selected = lang.code === current;
                return (
                  <li key={lang.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(lang.code)}
                      className={[
                        'w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150',
                        selected
                          ? 'bg-emerald-500/15 border border-emerald-500/25'
                          : 'border border-transparent hover:bg-white/[0.06] hover:border-white/[0.06]',
                      ].join(' ')}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                        style={{
                          background: `linear-gradient(135deg, ${lang.accent}28, ${lang.accent}10)`,
                          color: lang.accent,
                        }}
                      >
                        {lang.short}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-white/90 truncate">
                          {t(`settings.${lang.code}`)}
                        </span>
                      </span>

                      {selected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={3} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
