import { Link } from 'react-router-dom';

export const DoctorPortalPage = () => {
  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Doctor Portal</div>
        <p className="mt-2 text-sm text-white/70">
          Manage availability, appointments, and upload prescriptions/reports for completed visits.
        </p>
        <Link to="/app" className="mt-5 inline-flex h-10 items-center rounded-2xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15">
          Back to app
        </Link>
      </div>
    </div>
  );
};

