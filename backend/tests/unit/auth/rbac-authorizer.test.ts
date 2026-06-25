import { describe, it, expect } from 'vitest';
import {
  autorizar,
  rolTienePermiso,
  obtenerPermisos,
  obtenerPermisoRequerido,
} from '../../../src/auth/rbac-authorizer';
import { PERMISOS_POR_ROL, Rol, TokenClaims } from '../../../src/auth/types';

describe('RBAC Authorizer', () => {
  describe('rolTienePermiso', () => {
    it('admin tiene todos los permisos', () => {
      expect(rolTienePermiso('admin', 'dashboard:read')).toBe(true);
      expect(rolTienePermiso('admin', 'usuarios:gestionar')).toBe(true);
      expect(rolTienePermiso('admin', 'config:modificar')).toBe(true);
      expect(rolTienePermiso('admin', 'metricas:realtime')).toBe(true);
      expect(rolTienePermiso('admin', 'metricas:historicas')).toBe(true);
    });

    it('ingeniero_pista tiene acceso a métricas realtime pero no historicas', () => {
      expect(rolTienePermiso('ingeniero_pista', 'metricas:realtime')).toBe(true);
      expect(rolTienePermiso('ingeniero_pista', 'metricas:historicas')).toBe(false);
    });

    it('ingeniero_pista tiene acceso a alertas pero no a reportes', () => {
      expect(rolTienePermiso('ingeniero_pista', 'alertas:read')).toBe(true);
      expect(rolTienePermiso('ingeniero_pista', 'alertas:acknowledge')).toBe(true);
      expect(rolTienePermiso('ingeniero_pista', 'reportes:generar')).toBe(false);
    });

    it('analista tiene acceso a historicas y reportes pero no realtime', () => {
      expect(rolTienePermiso('analista', 'metricas:historicas')).toBe(true);
      expect(rolTienePermiso('analista', 'reportes:generar')).toBe(true);
      expect(rolTienePermiso('analista', 'reportes:exportar')).toBe(true);
      expect(rolTienePermiso('analista', 'metricas:realtime')).toBe(false);
    });

    it('viewer solo tiene dashboard:read', () => {
      expect(rolTienePermiso('viewer', 'dashboard:read')).toBe(true);
      expect(rolTienePermiso('viewer', 'metricas:realtime')).toBe(false);
      expect(rolTienePermiso('viewer', 'reportes:generar')).toBe(false);
      expect(rolTienePermiso('viewer', 'config:modificar')).toBe(false);
    });
  });

  describe('obtenerPermisos', () => {
    it('retorna permisos completos de admin', () => {
      const permisos = obtenerPermisos('admin');
      expect(permisos).toHaveLength(10);
    });

    it('retorna permisos de viewer (solo 1)', () => {
      const permisos = obtenerPermisos('viewer');
      expect(permisos).toHaveLength(1);
      expect(permisos[0]).toBe('dashboard:read');
    });
  });

  describe('autorizar', () => {
    const makeClaims = (rol: Rol, exp?: number): TokenClaims => ({
      sub: 'user-123',
      email: 'test@apexvision.ai',
      'custom:rol': rol,
      'cognito:groups': [rol],
      exp: exp || Math.floor(Date.now() / 1000) + 900,
      iat: Math.floor(Date.now() / 1000),
    });

    it('admin autorizado para gestión de usuarios', () => {
      const result = autorizar(makeClaims('admin'), 'POST /users');
      expect(result.authorized).toBe(true);
      expect(result.rol).toBe('admin');
    });

    it('viewer denegado para gestión de usuarios', () => {
      const result = autorizar(makeClaims('viewer'), 'POST /users');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('no tiene permiso');
    });

    it('token expirado es denegado', () => {
      const expiredClaims = makeClaims('admin', Math.floor(Date.now() / 1000) - 100);
      const result = autorizar(expiredClaims, 'GET /dashboard');
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('Token expirado');
    });

    it('recurso no reconocido es denegado', () => {
      const result = autorizar(makeClaims('admin'), 'DELETE /unknown');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Recurso no reconocido');
    });

    it('ingeniero_pista autorizado para métricas realtime', () => {
      const result = autorizar(makeClaims('ingeniero_pista'), 'GET /metrics/realtime');
      expect(result.authorized).toBe(true);
    });

    it('analista autorizado para exportar reportes', () => {
      const result = autorizar(makeClaims('analista'), 'POST /reports/export');
      expect(result.authorized).toBe(true);
    });

    it('analista denegado para métricas realtime', () => {
      const result = autorizar(makeClaims('analista'), 'GET /metrics/realtime');
      expect(result.authorized).toBe(false);
    });
  });
});
