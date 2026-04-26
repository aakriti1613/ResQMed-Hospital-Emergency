
import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Page not found</div>
        <p className="mt-2 text-sm text-white/70">That route doesn’t exist.</p>
        <Link to="/" className="mt-5 inline-flex h-10 items-center rounded-2xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15">
          Go to landing
        </Link>
      </div>
    </div>
  );
};

