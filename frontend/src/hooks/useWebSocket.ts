/**
 * Hook de conexión WebSocket con reconexión automática.
 *
 * Mantiene conexión activa, reconecta automáticamente en caso de
 * desconexión (max intentos configurable, intervalo < 3s) y detecta datos obsoletos.
 *
 * Seguridad: El token se envía como mensaje de autenticación tras conectar (no en query string).
 * El backend debe validar el primer mensaje { action: 'auth', token } antes de enviar datos.
 *
 * Validates: Requirements 6.5, 6.6, 6.8
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface WebSocketState {
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastMessageTimestamp: number | null;
  isStale: boolean;
}

interface UseWebSocketOptions {
  url: string;
  token: string;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
  staleThresholdMs?: number;
  onMessage?: (data: unknown) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    token,
    maxReconnectAttempts = 5,
    reconnectIntervalMs = 2000,
    staleThresholdMs = 10000,
    onMessage,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    lastMessageTimestamp: null,
    isStale: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs para evitar recrear connect en cada render
  const onMessageRef = useRef(onMessage);
  const tokenRef = useRef(token);
  const reconnectAttemptsRef = useRef(0);

  // Mantener refs actualizados
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const connect = useCallback(() => {
    // Conectar sin token en la URL
    const ws = new WebSocket(url);

    ws.onopen = () => {
      // Enviar token como mensaje de autenticación inmediatamente tras abrir
      const currentToken = tokenRef.current;
      ws.send(JSON.stringify({ action: 'auth', token: currentToken }));

      reconnectAttemptsRef.current = 0;
      setState((prev) => ({
        ...prev,
        status: 'connected',
        reconnectAttempts: 0,
      }));
    };

    ws.onmessage = (event) => {
      setState((prev) => ({
        ...prev,
        lastMessageTimestamp: Date.now(),
        isStale: false,
      }));

      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setState((prev) => {
        const attempts = reconnectAttemptsRef.current;
        if (attempts < maxReconnectAttempts) {
          reconnectAttemptsRef.current = attempts + 1;

          // Reconectar con token fresco
          reconnectTimerRef.current = setTimeout(async () => {
            // Intentar refrescar el token antes de reconectar
            try {
              const session = await fetchAuthSession({ forceRefresh: true });
              const freshToken = session.tokens?.accessToken?.toString();
              if (freshToken) {
                tokenRef.current = freshToken;
              }
            } catch {
              // Si falla el refresh, usa el último token disponible
            }
            connect();
          }, reconnectIntervalMs);

          return {
            ...prev,
            status: 'reconnecting',
            reconnectAttempts: attempts + 1,
          };
        }

        return { ...prev, status: 'disconnected' };
      });
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url, maxReconnectAttempts, reconnectIntervalMs]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    reconnectAttemptsRef.current = 0;
    setState({ status: 'disconnected', reconnectAttempts: 0, lastMessageTimestamp: null, isStale: false });
  }, []);

  const manualReconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Efecto de conexión: solo se dispara al montar o si cambia la URL
  useEffect(() => {
    if (tokenRef.current) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  // Intervalo para detectar datos obsoletos (stale) y forzar re-render
  useEffect(() => {
    staleIntervalRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev.lastMessageTimestamp) return prev;
        const isStale = Date.now() - prev.lastMessageTimestamp > staleThresholdMs;
        if (isStale !== prev.isStale) {
          return { ...prev, isStale };
        }
        return prev;
      });
    }, 1500);

    return () => {
      if (staleIntervalRef.current) {
        clearInterval(staleIntervalRef.current);
      }
    };
  }, [staleThresholdMs]);

  // Función pura de consulta (mantenida por compatibilidad)
  const isDataStale = useCallback(
    (pilotoLastUpdate: number | null): boolean => {
      if (!pilotoLastUpdate) return false;
      return Date.now() - pilotoLastUpdate > staleThresholdMs;
    },
    [staleThresholdMs]
  );

  return {
    ...state,
    connect,
    disconnect,
    manualReconnect,
    isDataStale,
  };
}
