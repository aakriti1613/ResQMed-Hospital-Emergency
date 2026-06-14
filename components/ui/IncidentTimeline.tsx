import { CheckCircle2, Clock } from 'lucide-react';


export type TimelineStepStatus = 'completed' | 'active' | 'pending';

export interface TimelineStep {
  id: string;
  label: string;
  subLabel?: string;
  status: TimelineStepStatus;
  time?: string;
}

export function IncidentTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rounded-3xl border border-white/[0.05] bg-[#12131a] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-5">
        Live Incident Timeline
      </h3>
      
      <div className="relative space-y-6">
        {/* Vertical tracking line */}
        <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-white/[0.05]" />
        
        {steps.map((step) => (
          <div key={step.id} className="relative flex gap-4 items-start">
            {/* Status Icon */}
            <div className="relative z-10 bg-[#12131a] py-0.5">
              {step.status === 'completed' ? (
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              ) : step.status === 'active' ? (
                <div className="h-6 w-6 rounded-full border border-blue-500/30 flex items-center justify-center relative">
                  <span className="absolute h-full w-full rounded-full bg-blue-500/20 animate-ping opacity-75" />
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className={`text-sm font-black transition ${
                  step.status === 'completed' ? 'text-white' : 
                  step.status === 'active' ? 'text-blue-200' : 'text-white/40'
                }`}>
                  {step.label}
                </div>
                {step.time && (
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <Clock className="h-3 w-3" />
                    {step.time}
                  </div>
                )}
              </div>
              
              {step.subLabel && (
                <div className={`mt-1 text-xs transition ${
                  step.status === 'completed' ? 'text-emerald-200/70' :
                  step.status === 'active' ? 'text-blue-200/60' : 'text-white/20'
                }`}>
                  {step.subLabel}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
