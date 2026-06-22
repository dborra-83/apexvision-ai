import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { amplifyConfig } from './config/amplify';
import App from './App';
import './index.css';
import './racing.css';
import { useThemeStore } from './store/theme-store';

// Validar variables de entorno requeridas en producción
if (import.meta.env.PROD && import.meta.env.VITE_DEV_BYPASS_AUTH !== 'true') {
  const required = ['VITE_USER_POOL_ID', 'VITE_USER_POOL_CLIENT_ID', 'VITE_IDENTITY_POOL_ID'];
  const missing = required.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[ApexVision] Variables de entorno requeridas no definidas: ${missing.join(', ')}. ` +
      'La aplicación no puede iniciar sin configuración de autenticación.'
    );
  }
}

// Inicializar AWS Amplify antes de renderizar
Amplify.configure(amplifyConfig);

// Aplicar tema inicial desde el store (única fuente de verdad)
const initialTheme = useThemeStore.getState().theme;
document.documentElement.setAttribute('data-theme', initialTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
