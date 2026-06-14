import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listenAlertsForHospital, updateHospitalAlert, type HospitalAlert } from '../../data/hospitalAlerts';
import { getSosRequestDoc, listenAssignmentsForRequest, type SosAssignmentDoc, type SosRequestDoc } from '../../data/sos';
import { SHOWCASE_HOSPITAL } from '../../data/hospitals';
import { getUserProfile, type UserProfile, computeAgeFromDob } from '../../data/user';
import { CheckCircle2, User, Activity, AlertTriangle, Syringe, Ambulance, ArrowLeft } from 'lucide-react';
import { formatEta } from '../../data/routing';
import { motion, AnimatePresence } from 'framer-motion';

// A single comprehensive object representing an incoming patient
type PatientIncoming = {
  alert: HospitalAlert;
  sos: SosRequestDoc | null;
  victimProfile: UserProfile | null;
  primaryResponder: SosAssignmentDoc | null;
};

export const HospitalPortalPage = () => {
  const [alerts, setAlerts] = useState<HospitalAlert[]>([]);
  const [patients, setPatients] = useState<PatientIncoming[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => {
    return listenAlertsForHospital(SHOWCASE_HOSPITAL.id, setAlerts);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchContext = async () => {
      const enriched: PatientIncoming[] = await Promise.all(
        alerts.map(async (alert) => {
          let sos: SosRequestDoc | null = null;
          let victimProfile: UserProfile | null = null;
          let primaryResponder: SosAssignmentDoc | null = null;
          
          try {
            sos = await getSosRequestDoc(alert.requestId);
            if (sos) {
              victimProfile = await getUserProfile(sos.victimId);
            }
            if (alert.helperId && alert.requestId) {
              // Get the primary responder's assignment to track ETA
              const assignments = await new Promise<SosAssignmentDoc[]>(resolve => {
                const unsub = listenAssignmentsForRequest(alert.requestId, (assigns) => {
                  unsub();
                  resolve(assigns);
                });
              });
              primaryResponder = assignments.find(a => a.helperId === alert.helperId) || null;
            }
          } catch (e) {
            console.error('Error fetching context for alert', alert.id, e);
          }
          return { alert, sos, victimProfile, primaryResponder };
        })
      );
      if (active) {
        setPatients(enriched);
        if (!selectedAlertId && enriched.length > 0 && enriched[0]) {
          setSelectedAlertId(enriched[0].alert.id);
        }
      }
    };
    fetchContext();
    return () => { active = false; };
  }, [alerts, selectedAlertId]);

  const selectedPatient = patients.find(p => p.alert.id === selectedAlertId) || null;

  const handleAcknowledge = async (alertId: string) => {
    try {
      await updateHospitalAlert(alertId, { status: 'acknowledged' });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0a0b0f] flex flex-col font-sans text-white h-screen overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 shrink-0 border-b border-white/[0.06] bg-[#12131a] flex items-center px-6 justify-between shadow-md z-10">
        <div className="flex items-center gap-4">
          <Link to="/app" className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              H
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide leading-tight">{SHOWCASE_HOSPITAL.name}</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Pre-Arrival Command Center</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
              {patients.filter(p => p.alert.status === 'notified').length} Pending
            </span>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Patient List */}
        <div className="w-[380px] shrink-0 border-r border-white/[0.06] bg-[#0c0d12] overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-white/[0.05]">
            <h2 className="text-xs font-black uppercase tracking-widest text-white/50">Incoming Patients</h2>
          </div>
          
          <div className="flex-1 p-3 space-y-2">
            {patients.length === 0 && (
              <div className="p-6 text-center text-white/30 text-sm mt-10">
                No active incoming alerts.
              </div>
            )}
            
            {patients.map(p => {
              const isSelected = selectedAlertId === p.alert.id;
              const isPending = p.alert.status === 'notified';
              return (
                <button
                  key={p.alert.id}
                  onClick={() => setSelectedAlertId(p.alert.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected 
                      ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {isPending && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isPending ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isPending ? 'Action Required' : 'Acknowledged'}
                        </span>
                      </div>
                      <div className="text-base font-black truncate max-w-[200px]">
                        {p.victimProfile?.name || p.sos?.victimBrief?.name || 'Unknown Patient'}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {p.alert.suggestedDept || 'Emergency Room'}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xl font-black text-white">
                        {p.primaryResponder?.etaSeconds ? formatEta(p.primaryResponder.etaSeconds) : '—'}
                      </div>
                      <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">ETA</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Patient Details */}
        <div className="flex-1 bg-[#0f1016] overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {selectedPatient ? (
              <motion.div 
                key={selectedPatient.alert.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 max-w-4xl mx-auto space-y-6"
              >
                
                {/* Header Section */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-black mb-2">
                      {selectedPatient.victimProfile?.name || selectedPatient.sos?.victimBrief?.name || 'Unknown Patient'}
                    </h2>
                    <div className="flex gap-4 text-sm text-white/60 font-semibold">
                      <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-white/40" /> Age {selectedPatient.victimProfile?.dob ? computeAgeFromDob(selectedPatient.victimProfile.dob) : 'Unknown'}</span>
                      <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-white/40" /> Blood: {selectedPatient.victimProfile?.bloodGroup || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  {selectedPatient.alert.status === 'notified' ? (
                    <button
                      onClick={() => handleAcknowledge(selectedPatient.alert.id)}
                      className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      Acknowledge & Prepare
                    </button>
                  ) : (
                    <div className="px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Preparation in Progress
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Transport Card */}
                  <div className="col-span-1 rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                      <Ambulance className="h-4 w-4" /> Transport
                    </div>
                    <div className="text-4xl font-black text-blue-400 mb-1">
                      {selectedPatient.primaryResponder?.etaSeconds ? formatEta(selectedPatient.primaryResponder.etaSeconds) : 'N/A'}
                    </div>
                    <div className="text-sm font-bold text-white/80">
                      Via {selectedPatient.alert.helperName || 'Responder'}
                    </div>
                  </div>

                  {/* Incident Context */}
                  <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                      <AlertTriangle className="h-4 w-4" /> Incident Context
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Type</div>
                        <div className="text-base font-black capitalize text-red-400">
                          {selectedPatient.sos?.incidentType || 'Unknown'} Emergency
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/40 mb-1">Severity</div>
                        <div className="text-base font-black capitalize text-amber-400">
                          {selectedPatient.alert.severity || selectedPatient.sos?.severity || 'Assessing...'}
                        </div>
                      </div>
                      <div className="col-span-2 mt-2">
                        <div className="text-xs text-white/40 mb-1">Responder Notes</div>
                        <div className="text-sm bg-white/5 p-3 rounded-xl border border-white/10 italic text-white/80">
                          "{selectedPatient.alert.injuryNotes || 'No notes provided by responder yet.'}"
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medical History */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-5">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                    <Syringe className="h-4 w-4" /> Critical Medical History
                  </div>
                  
                  {selectedPatient.victimProfile?.medicalConditions && selectedPatient.victimProfile.medicalConditions.trim().length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.victimProfile.medicalConditions.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                        <div key={c} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold">
                          {c}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-white/40 italic">No critical conditions found in record.</div>
                  )}

                  {selectedPatient.victimProfile?.allergies && selectedPatient.victimProfile.allergies.trim().length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs text-white/40 mb-2">Known Allergies</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedPatient.victimProfile.allergies.split(',').map(a => a.trim()).filter(Boolean).map(a => (
                          <div key={a} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 font-semibold">
                Select a patient from the queue to view details
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
