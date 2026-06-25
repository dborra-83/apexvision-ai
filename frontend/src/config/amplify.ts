/**
 * Configuración de AWS Amplify para autenticación con Cognito.
 */

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || '',
      loginWith: {
        email: true,
      },
    },
  },
  Storage: {
    S3: {
      bucket: import.meta.env.VITE_S3_BUCKET || 'apexvision-sessions-520754296204',
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    },
  },
};

export const wsEndpoint = import.meta.env.VITE_WS_ENDPOINT || 'wss://localhost:3001';
export const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3000/v1';
