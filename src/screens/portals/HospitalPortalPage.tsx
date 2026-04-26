import { Link } from 'react-router-dom';

export const HospitalPortalPage = () => {
  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Hospital Portal</div>
        <p className="mt-2 text-sm text-white/70">
          Verify hospital profile, manage departments, doctor roster, and (optional) update wait-time/availability.
        </p>
        <Link
          to="/app"
          className="mt-5 inline-flex h-10 items-center rounded-2xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15"
        >
          Back to app
        </Link>
      </div>
    </div>
  );
};

