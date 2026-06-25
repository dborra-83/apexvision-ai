/**
 * Componente que protege rutas privadas verificando la sesión de Amplify.
 * Muestra un spinner de carga mientras se verifica la sesión.
 * Redirige a /login si no hay sesión válida.
 *
 * En modo desarrollo (VITE_DEV_BYPASS_AUTH=true), permite acceso sin autenticación.
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(
    DEV_BYPASS_AUTH ? 'authenticated' : 'loading'
  );

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    let cancelled = false;

    async function checkAuth() {
      try {
        await getCurrentUser();
        if (!cancelled) setAuthState('authenticated');
      } catch {
        if (!cancelled) setAuthState('unauthenticated');
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  if (authState === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--border)',
              borderTopColor: 'var(--accent)',
            }}
          />
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
