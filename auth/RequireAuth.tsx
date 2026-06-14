import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return null;

  if (!user) {
    const returnTo = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
