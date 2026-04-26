import { Outlet } from 'react-router-dom';
import { GlobalSosWatcher } from './GlobalSosWatcher';
import { IncomingSosOverlay } from '../components/IncomingSosOverlay';

export const RootLayout = () => {
  return (
    <>
      {/* Victim side: auto-route to /app/sos when this user has an active SOS */}
      <GlobalSosWatcher />
      {/* Helper side: Uber/Rapido-style popup for nearby emergencies */}
      <IncomingSosOverlay />
      <Outlet />
    </>
  );
};
