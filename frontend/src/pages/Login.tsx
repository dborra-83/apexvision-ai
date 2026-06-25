/**
 * Página de login con autenticación Cognito + MFA.
 * Usa el componente <Authenticator> de @aws-amplify/ui-react para cubrir
 * login, MFA, recuperación de contraseña y registro.
 *
 * En modo desarrollo (VITE_DEV_BYPASS_AUTH=true), muestra un botón de
 * acceso directo sin necesidad de Cognito.
 */

import { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import '@aws-amplify/ui-react/styles.css';

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

function LoginRedirect() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [authStatus, navigate]);

  return null;
}

function DevBypassLogin() {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      <div
        className="inline-block px-3 py-1 rounded text-xs font-medium mb-4"
        style={{ backgroundColor: 'var(--warning-soft, #fffbeb)', color: 'var(--warning, #f59e0b)' }}
      >
        ⚠️ Modo Desarrollo — Auth desactivada
      </div>
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        className="w-full py-3 rounded-lg font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: 'var(--accent, #0ea5e9)' }}
      >
        Entrar al Dashboard
      </button>
      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        Para activar Cognito, configura las variables VITE_USER_POOL_* en .env
      </p>
    </div>
  );
}

export function Login() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            ApexVision AI
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Plataforma de Análisis F1 en Tiempo Real
          </p>
        </div>

        {DEV_BYPASS_AUTH ? (
          <DevBypassLogin />
        ) : (
          <Authenticator
            loginMechanisms={['email']}
            signUpAttributes={['email']}
            hideSignUp={false}
          >
            <LoginRedirect />
          </Authenticator>
        )}
      </div>
    </div>
  );
}
