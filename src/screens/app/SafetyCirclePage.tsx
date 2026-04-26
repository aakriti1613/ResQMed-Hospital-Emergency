import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Users, Phone, UserPlus, Trash2, Star, Pencil, X, ShieldCheck, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenUserProfile, updateUserProfile, type UserProfile } from '../../data/user';

type Contact = { name: string; phone: string; relation?: string };

const RELATION_PRESETS = ['Mother', 'Father', 'Sister', 'Brother', 'Spouse', 'Friend', 'Doctor', 'Other'];

/**
 * Safety Circle — dedicated page for managing emergency contacts.
 * These are the people who get an instant alert (WhatsApp + SMS + voice
 * cascade) the moment the user triggers an SOS, and again on every key
 * milestone (helper accepted, hospital alerted, marked safe).
 */
export const SafetyCirclePage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Contact>({ name: '', phone: '', relation: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { nav('/login?redirect=/app/safety-circle'); return; }
    return listenUserProfile(user.uid, setProfile);
  }, [user, nav]);

  const contacts: Contact[] = useMemo(() => profile?.contacts ?? [], [profile?.contacts]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const startAdd = () => {
    setDraft({ name: '', phone: '', relation: '' });
    setEditingIdx(null);
    setAdding(true);
    setErr(null);
  };

  const startEdit = (idx: number) => {
    const c = contacts[idx];
    if (!c) return;
    setDraft({ name: c.name || '', phone: c.phone || '', relation: c.relation || '' });
    setEditingIdx(idx);
    setAdding(true);
    setErr(null);
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return 'Name is required.';
    const cleanPhone = draft.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return 'Enter a valid phone number.';
    return null;
  };

  const save = async () => {
    if (!user) return;
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr(null);
    try {
      const next = [...contacts];
      const cleaned: Contact = {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        relation: draft.relation?.trim() || undefined,
      };
      if (editingIdx === null) next.push(cleaned);
      else next[editingIdx] = cleaned;
      await updateUserProfile(user.uid, { contacts: next });
      setAdding(false);
      setEditingIdx(null);
      showToast(editingIdx === null ? 'Contact added' : 'Contact updated');
    } catch (e: any) {
      setErr(e?.message || 'Failed to save contact.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (idx: number) => {
    if (!user) return;
    if (!confirm('Remove this contact from your safety circle?')) return;
    try {
      const next = contacts.filter((_, i) => i !== idx);
      await updateUserProfile(user.uid, { contacts: next });
      showToast('Contact removed');
    } catch (e: any) {
      showToast(e?.message || 'Failed to remove');
    }
  };

  const makePrimary = async (idx: number) => {
    if (!user || idx === 0) return;
    const reordered = [contacts[idx]!, ...contacts.filter((_, i) => i !== idx)];
    try {
      await updateUserProfile(user.uid, { contacts: reordered });
      showToast('Set as primary');
    } catch (e: any) {
      showToast(e?.message || 'Failed to update');
    }
  };

  return (
    <div className="min-h-full bg-[#0a0b0f] max-w-lg mx-auto w-full pb-24">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1c1d25] border border-white/10 px-5 py-2.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0b0f]/95 backdrop-blur border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center transition">
          <ChevronLeft className="h-4 w-4 text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-white">Safety Circle</h1>
          <p className="text-[11px] text-white/45">People notified during emergencies</p>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-4 mt-4 rounded-3xl p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' }}>
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Your Safety Circle</div>
            <div className="text-base font-black text-white">{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} added</div>
            <div className="text-[11px] text-white/70 mt-0.5">
              They'll receive your live location, helper details and status updates the instant you trigger an SOS.
            </div>
          </div>
        </div>
      </div>

      {/* Contact list */}
      <div className="mx-4 mt-4 space-y-2">
        {contacts.length === 0 && !adding && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
              <UserPlus className="h-6 w-6 text-white/30" />
            </div>
            <div className="text-sm font-black text-white/70">No contacts yet</div>
            <div className="text-[11px] text-white/40 mt-1">Add at least one trusted person.</div>
          </div>
        )}

        {contacts.map((c, idx) => (
          <div key={`${c.phone}-${idx}`}
            className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-3 flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-full flex items-center justify-center text-base font-black text-white shrink-0"
              style={{ background: idx === 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
              {c.name?.[0]?.toUpperCase() || '?'}
              {idx === 0 && (
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 border-2 border-[#13141a] flex items-center justify-center">
                  <Star className="h-2.5 w-2.5 text-white fill-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-black text-white truncate">{c.name}</span>
                {c.relation && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/45 px-1.5 rounded bg-white/[0.05]">
                    {c.relation}
                  </span>
                )}
                {idx === 0 && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 px-1.5 rounded bg-amber-500/15">
                    Primary
                  </span>
                )}
              </div>
              <div className="text-[11px] text-white/50 truncate">{c.phone}</div>
            </div>

            <a href={`tel:${c.phone}`}
              className="h-9 w-9 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 flex items-center justify-center transition active:scale-95">
              <Phone className="h-4 w-4 text-emerald-300" />
            </a>
            <button onClick={() => startEdit(idx)}
              className="h-9 w-9 rounded-full bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center transition active:scale-95">
              <Pencil className="h-3.5 w-3.5 text-white/60" />
            </button>
            <button onClick={() => remove(idx)}
              className="h-9 w-9 rounded-full bg-white/[0.05] hover:bg-red-500/20 flex items-center justify-center transition active:scale-95 group">
              <Trash2 className="h-3.5 w-3.5 text-white/40 group-hover:text-red-300" />
            </button>
            {idx !== 0 && (
              <button onClick={() => makePrimary(idx)}
                className="absolute right-2 -mt-12 text-[9px] font-black uppercase tracking-wider text-white/40 hover:text-amber-300 hidden">
                Make primary
              </button>
            )}
          </div>
        ))}

        {!adding && (
          <button
            onClick={startAdd}
            className="mt-2 w-full h-12 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center gap-2 text-sm font-black text-white/70 transition active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            Add Contact
          </button>
        )}
      </div>

      {/* Privacy note */}
      <div className="mx-4 mt-6 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 flex items-start gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0 mt-0.5" />
        <span className="text-[11px] text-white/55 leading-snug">
          Contacts are notified via WhatsApp + SMS during an emergency. They'll receive a tokenised live-tracking link that auto-expires. Your phone number is never shared with helpers.
        </span>
      </div>

      {/* Add / Edit drawer */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/65 flex items-end justify-center"
            onClick={() => setAdding(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-lg rounded-t-3xl bg-[#13141a] border-t border-white/[0.08] p-5 pb-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-white">
                  {editingIdx === null ? 'Add Contact' : 'Edit Contact'}
                </h2>
                <button onClick={() => setAdding(false)}
                  className="h-9 w-9 rounded-full bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center">
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>

              <div className="space-y-3">
                <Field label="Name">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Priya Mehta"
                    className="w-full h-11 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20" />
                </Field>

                <Field label="Phone">
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="+91 98765 43210" inputMode="tel"
                    className="w-full h-11 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20" />
                </Field>

                <Field label="Relation (optional)">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {RELATION_PRESETS.map((r) => {
                      const active = draft.relation === r;
                      return (
                        <button key={r} onClick={() => setDraft({ ...draft, relation: active ? '' : r })}
                          className={[
                            'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition',
                            active
                              ? 'border-blue-400/40 bg-blue-500/15 text-blue-200'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.06]',
                          ].join(' ')}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  <input value={draft.relation || ''} onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
                    placeholder="Or type custom (e.g. Cousin)"
                    className="w-full h-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20" />
                </Field>

                {err && (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-[11px] text-red-200">
                    {err}
                  </div>
                )}

                <button onClick={save} disabled={busy}
                  className="w-full h-12 rounded-2xl text-sm font-black text-white transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)' }}
                >
                  {busy ? 'Saving…' : (
                    <>
                      <Check className="h-4 w-4" />
                      {editingIdx === null ? 'Add to Safety Circle' : 'Save changes'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5">{label}</div>
    {children}
  </div>
);
