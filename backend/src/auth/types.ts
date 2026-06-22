/**
 * Tipos del sistema de autenticación y autorización de ApexVision AI.
 */

/** Roles disponibles en el sistema */
export type Rol = 'admin' | 'ingeniero_pista' | 'analista' | 'viewer';

/** Permisos granulares del sistema */
export type Permiso =
  | 'dashboard:read'
  | 'metricas:realtime'
  | 'metricas:historicas'
  | 'estrategia:read'
  | 'alertas:read'
  | 'alertas:acknowledge'
  | 'reportes:generar'
  | 'reportes:exportar'
  | 'usuarios:gestionar'
  | 'config:modificar';

/** Matriz de permisos por rol */
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  admin: [
    'dashboard:read',
    'metricas:realtime',
    'metricas:historicas',
    'estrategia:read',
    'alertas:read',
    'alertas:acknowledge',
    'reportes:generar',
    'reportes:exportar',
    'usuarios:gestionar',
    'config:modificar',
  ],
  ingeniero_pista: [
    'dashboard:read',
    'metricas:realtime',
    'estrategia:read',
    'alertas:read',
    'alertas:acknowledge',
  ],
  analista: [
    'dashboard:read',
    'metricas:historicas',
    'reportes:generar',
    'reportes:exportar',
  ],
  viewer: [
    'dashboard:read',
  ],
};

/** Mapeo de recursos API a permisos requeridos */
export const RECURSO_A_PERMISO: Record<string, Permiso> = {
  'GET /metrics/realtime': 'metricas:realtime',
  'GET /metrics/historical': 'metricas:historicas',
  'GET /predictions': 'estrategia:read',
  'GET /alerts': 'alertas:read',
  'POST /alerts/acknowledge': 'alertas:acknowledge',
  'GET /reports': 'reportes:generar',
  'POST /reports/export': 'reportes:exportar',
  'GET /users': 'usuarios:gestionar',
  'POST /users': 'usuarios:gestionar',
  'PUT /config': 'config:modificar',
  'GET /dashboard': 'dashboard:read',
};

/** Claims esperados en el token JWT */
export interface TokenClaims {
  sub: string;
  email: string;
  'custom:rol': Rol;
  'cognito:groups': string[];
  exp: number;
  iat: number;
}

/** Resultado de autorización */
export interface AuthorizationResult {
  authorized: boolean;
  userId: string;
  rol: Rol;
  reason?: string;
}

/** Evento de intento de autenticación para rate limiting */
export interface AuthAttempt {
  identifier: string;  // IP o userId
  timestamp: number;   // Epoch ms
  success: boolean;
  type: 'login' | 'mfa';
}

/** Estado de bloqueo */
export interface BlockStatus {
  blocked: boolean;
  unblockAt?: number;   // Epoch ms cuando se desbloquea
  reason?: string;
}
