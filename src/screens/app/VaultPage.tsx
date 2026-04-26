import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderHeart, Upload, File as FileIcon, AlertCircle, X,
  FlaskConical, FileText, Activity, Pill, Camera, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import {
  createRecord, listenRecords, resolveFileUrls,
  type MedicalRecord, type RecordType,
} from '../../data/records';

const TYPE_META: Record<RecordType, { label: string; icon: React.ReactNode; tint: string }> = {
  Prescription:  { label: 'Prescription', icon: <Pill className="h-3.5 w-3.5" />,         tint: '#ec4899' },
  LabReport:     { label: 'Lab report',   icon: <FlaskConical className="h-3.5 w-3.5" />, tint: '#3b82f6' },
  XRay:          { label: 'X-Ray',        icon: <Camera className="h-3.5 w-3.5" />,       tint: '#a855f7' },
  Imaging:       { label: 'Imaging',      icon: <Activity className="h-3.5 w-3.5" />,     tint: '#f59e0b' },
  Consultation:  { label: 'Consultation', icon: <FileText className="h-3.5 w-3.5" />,     tint: '#10b981' },
};

const TYPES: RecordType[] = ['Prescription', 'LabReport', 'XRay', 'Imaging', 'Consultation'];

export const VaultPage = () => {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecordType | 'all'>('all');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    setErr(null);
    if (!ready) return;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const unsub = listenRecords(user.uid, (data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user, ready]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        (r.notes || '').toLowerCase().includes(needle)
      );
    });
  }, [items, query, filter]);

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-8 pb-6 max-w-lg mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderHeart className="h-4 w-4 text-pink-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-pink-300/80">Health Vault</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white">Your records</h1>
          <p className="mt-1 text-xs text-white/40">Prescriptions, lab reports and scans — kept safe.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="h-10 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-black text-white transition active:scale-95"
          style={{ background: 'linear-gradient(135deg,#ec4899,#9d174d)', boxShadow: '0 0 20px rgba(236,72,153,0.35)' }}
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
      </div>

      {/* Not logged in */}
      {!user && ready && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.05] p-5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100/80">
            Log in to see and upload your records.
            <div className="mt-2"><Link to="/login" className="font-black underline underline-offset-2">Log in →</Link></div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          icon={<FolderHeart className="h-3 w-3" />}
          label="All"
        />
        {TYPES.map((t) => (
          <FilterChip
            key={t}
            active={filter === t}
            onClick={() => setFilter(t)}
            icon={TYPE_META[t].icon}
            label={TYPE_META[t].label}
            tint={TYPE_META[t].tint}
          />
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search record title or notes"
          className="w-full h-11 rounded-2xl border border-white/[0.06] bg-[#13141a] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/15 transition"
        />
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">{err}</div>
      )}

      {/* Records */}
      {loading ? (
        <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 text-center text-sm text-white/40">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <FolderHeart className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm font-bold text-white/50">
            {items.length === 0 ? 'No records yet' : 'Nothing matches your filter'}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">
            {items.length === 0
              ? 'Upload your first prescription or lab report.'
              : 'Try a different department or search term.'}
          </p>
          {items.length === 0 && user && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg,#ec4899,#9d174d)' }}
            >
              <Upload className="h-3.5 w-3.5" /> Upload first record
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.035, 0.25) }}
            >
              <RecordCard record={r} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && user && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onUploaded={(created) => {
              setItems((prev) => [created, ...prev]);
              setShowUpload(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const FilterChip = ({
  active, onClick, icon, label, tint,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tint?: string }) => (
  <button
    onClick={onClick}
    className={[
      'shrink-0 h-9 px-3 rounded-full text-[11px] font-black flex items-center gap-1 transition border',
      active
        ? 'bg-white text-slate-950 border-white'
        : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]',
    ].join(' ')}
    style={active && tint ? { background: tint, borderColor: tint, color: '#fff' } : undefined}
  >
    {icon} {label}
  </button>
);

const RecordCard = ({ record }: { record: MedicalRecord }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MedicalRecord>(record);
  const [busy, setBusy] = useState(false);
  const meta = TYPE_META[record.type] ?? TYPE_META.Consultation;

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (view.files.some((f) => f.url)) return;
    setBusy(true);
    try { setView(await resolveFileUrls(record)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4">
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-white"
          style={{ background: `${meta.tint}22`, color: meta.tint }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wider"
              style={{ background: `${meta.tint}18`, color: meta.tint }}>
              {meta.label}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-black text-white truncate">{record.title}</div>
          <div className="text-[10px] text-white/40">
            {record.recordDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            {record.files.length > 0 && <> · {record.files.length} file{record.files.length === 1 ? '' : 's'}</>}
          </div>
          {record.notes && (
            <div className="mt-1.5 text-[11px] text-white/55 line-clamp-2">{record.notes}</div>
          )}
        </div>
        <button
          onClick={toggle}
          className="h-8 px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-[11px] font-black text-white/80 transition shrink-0"
        >
          {open ? 'Hide' : 'View'}
        </button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          {busy ? (
            <div className="text-[11px] text-white/40">Preparing file links…</div>
          ) : (
            <ul className="space-y-1.5">
              {view.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon className="h-3.5 w-3.5 text-white/35 shrink-0" />
                    <span className="truncate text-[11px] text-white/75">{f.name}</span>
                  </div>
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="h-7 px-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-[10px] font-black text-white">
                      Open
                    </a>
                  ) : (
                    <span className="text-[10px] text-white/35">demo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const UploadModal = ({
  onClose, onUploaded,
}: {
  onClose: () => void;
  onUploaded: (r: MedicalRecord) => void;
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<RecordType>('LabReport');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canUpload = !!user && title.trim() && files.length > 0;

  const submit = async () => {
    if (!user || !canUpload) return;
    setBusy(true); setErr(null);
    try {
      const created = await createRecord({
        patientId: user.uid,
        type,
        title: title.trim(),
        notes: notes.trim() || undefined,
        recordDate: new Date(),
        files,
      });
      onUploaded(created);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#13141a] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Upload record</div>
            <h3 className="text-lg font-black text-white mt-0.5">New health record</h3>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/60 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{err}</div>
        )}

        {/* Type chips */}
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={[
                'h-8 px-3 rounded-full text-[11px] font-black border transition',
                t === type ? 'bg-white text-slate-950 border-white' : 'bg-white/[0.04] text-white/55 border-white/[0.08] hover:bg-white/[0.08]',
              ].join(' ')}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        <label className="grid gap-1">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CBC Report · 15 Apr 2026"
            className="h-11 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/15" />
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief description"
            className="h-11 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/15" />
        </label>

        <label className="grid gap-1">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Files</span>
          <input
            type="file" multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-[11px] text-white/60 file:mr-3 file:rounded-xl file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-[11px] file:font-black file:text-white hover:file:bg-white/[0.14]"
          />
          {files.length > 0 && (
            <span className="text-[10px] text-emerald-300/80">{files.length} file(s) ready to upload</span>
          )}
        </label>

        <button
          onClick={submit}
          disabled={!canUpload || busy}
          className="w-full h-11 rounded-full text-sm font-black text-white transition active:scale-95 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#ec4899,#9d174d)', boxShadow: '0 0 24px rgba(236,72,153,0.35)' }}
        >
          {busy ? 'Uploading…' : 'Upload record'}
        </button>
      </motion.div>
    </motion.div>
  );
};
