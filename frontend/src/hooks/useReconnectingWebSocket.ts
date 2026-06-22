/**
 * Hook base reutilizable para WebSocket con reconexión automática.
 *
 * Características:
 * - Tope de intentos configurable (maxAttempts)
 * - Backoff configurable (intervalMs)
 * - Callbacks de mensaje vía ref (evita loops de reconexión)
 * - Manejo de errores configurable
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ReconnectStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ReconnectingWSOptions {
  /** URL del WebSocket */
  url: string | undefined;
  /** Máximo de intentos de reconexión */
  maxAttempts?: number;
  /** Intervalo entre reconexiones (ms) */
  intervalMs?: number;
  /** Callback al recibir un mensaje (se guarda en ref, seguro de pasar inline) */
  onMessage?: (data: MessageEvent) => void;
  /** Callback al ocurrir un error */
  onError?: (error: Event) => void;
  /** Si es true, conecta automáticamente al montar */
  autoConnect?: boolean;
}

export interface ReconnectingWSResult {
  status: ReconnectStatus;
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  send: (data: string) => void;
}

export function useReconnectingWebSocket(options: ReconnectingWSOptions): ReconnectingWSResult {
  const {
    url,
    maxAttempts = 5,
    intervalMs = 3000,
    onMessage,
    onError,
    autoConnect = true,
  } = options;

  const [status, setStatus] = useState<ReconnectStatus>('idle');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const urlRef = useRef(url);
  const intentionalCloseRef = useRef(false);

  // Mantener refs actualizados
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { urlRef.current = url; }, [url]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;

    // Limpiar conexión existente
    clearReconnectTimer();
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }

    intentionalCloseRef.current = false;
    setStatus('connecting');

    try {
      const ws = new WebSocket(currentUrl);

      ws.onopen = () => {
        attemptsRef.current = 0;
        setReconnectAttempts(0);
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        onMessageRef.current?.(event);
      };

      ws.onclose = () => {
        if (intentionalCloseRef.current) {
          setStatus('disconnected');
          return;
        }

        const attempts = attemptsRef.current;
        if (attempts < maxAttempts) {
          attemptsRef.current = attempts + 1;
          setReconnectAttempts(attempts + 1);
          setStatus('reconnecting');

          if (import.meta.env.DEV) {
            console.log(`🔄 Reconnecting (${attempts + 1}/${maxAttempts})...`);
          }

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, intervalMs);
        } else {
          setStatus('disconnected');
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Max reconnection attempts (${maxAttempts}) reached.`);
          }
        }
      };

      ws.onerror = (event) => {
        onErrorRef.current?.(event);
        if (import.meta.env.DEV) {
          console.error('🔴 WebSocket error:', event);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Failed to create WebSocket:', e);
      }
      setStatus('disconnected');
    }
  }, [maxAttempts, intervalMs, clearReconnectTimer]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    intentionalCloseRef.current = true;
    attemptsRef.current = 0;
    setReconnectAttempts(0);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimer]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  // Auto-connect al montar y desconectar al desmontar
  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [url, autoConnect, connect, disconnect]);

  return { status, reconnectAttempts, connect, disconnect, send };
}
