import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * React Router `errorElement` fallback. Keeps Firestore / runtime hiccups from
 * nuking the whole UI with a raw stack trace.
 */
export const RouteErrorFallback = () => {
  const err = useRouteError();
  let msg =
    isRouteErrorResponse(err)
      ? `${err.status} ${err.statusText}`
      : err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Something went wrong';

  if (err instanceof Error && (err.message.includes('permission-denied') || err.message.includes('offline'))) {
    msg = 'Cannot connect to database (offline or permissions issue).';
  }

  return (
    <div className="min-h-dvh bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-white/[0.08] bg-[#13141a] p-6 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-amber-400" />
        </div>
        <h1 className="text-lg font-black">We hit a snag</h1>
        <p className="text-xs text-white/50">The app ran into an unexpected error.</p>
        <div className="mt-4 rounded-xl border border-white/5 bg-black/50 p-4 text-left">
          <code className="text-[10px] text-red-400 font-mono break-all">
            {err instanceof Error ? err.message : msg}
            <br/><br/>
            {err instanceof Error ? err.stack : 'No stack trace available'}
          </code>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-black bg-white text-slate-950 active:scale-[0.98] transition"
          >
            <RefreshCw className="h-4 w-4" /> Reload page
          </button>
          <Link
            to="/app"
            className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-black border border-white/15 text-white/80 hover:bg-white/[0.05] transition"
          >
            <Home className="h-4 w-4" /> Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
