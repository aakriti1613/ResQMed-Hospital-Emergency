import { Outlet } from 'react-router-dom';
import { GlobalSosWatcher } from './GlobalSosWatcher';
import { HelmetCrashWatcher } from './HelmetCrashWatcher';
import { IncomingSosOverlay } from '../components/IncomingSosOverlay';
import { AssistantWidget } from '../components/AssistantWidget';

export const RootLayout = () => {
  return (
    <div className="min-h-dvh bg-[#0a0b0f] text-white">
      {/* Victim side: auto-route to /app/sos when this user has an active SOS */}
      <GlobalSosWatcher />
      {/* Hardware side: helmet crashEvent -> auto-create SOS, then GlobalSosWatcher routes */}
      <HelmetCrashWatcher />
      {/* Helper side: Uber/Rapido-style popup for nearby emergencies */}
      <IncomingSosOverlay />

      {/* Mobile-first frame on large screens */}
      <div className="mx-auto w-full max-w-lg min-h-dvh">
        <Outlet />
      </div>

      {/* Kaya — caring health companion (floating). Hidden on SOS/portal routes. */}
      <AssistantWidget />
    </div>
  );
};
