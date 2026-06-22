/**
 * Hook para conectarse al servidor de telemetría iRacing en red local.
 *
 * Uso:
 *   const { data, connected } = useIRacingLive('ws://192.168.1.100:8765');
 *
 * El servidor corre en la PC de iRacing (iracing_live.py).
 *
 * Usa useReconnectingWebSocket como base para:
 * - Tope de intentos de reconexión (maxAttempts, default 10)
 * - Backoff configurable
 * - Logging de errores de parseo (no silenciados)
 */

import { useState, useCallback, useEffect } from 'react';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

export interface IRacingData {
  timestamp: number;
  connected: boolean;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  clutch: number;
  steering: number;
  lap: number;
  lapDistPct: number;
  position: number;
  classPosition: number;
  lastLapTime: number;
  bestLapTime: number;
  currentLapTime: number;
  deltaToSessionBest: number;
  fuelLevel: number;
  fuelPercent: number;
  tireLF_temp: number;
  tireRF_temp: number;
  tireLR_temp: number;
  tireRR_temp: number;
  tireLF_wear: number;
  tireRF_wear: number;
  tireLR_wear: number;
  tireRR_wear: number;
  gLateral: number;
  gLongitudinal: number;
  drs: boolean;
  trackTemp: number;
  airTemp: number;
  sessionTime: number;
  sessionLapsRemaining: number;
  flags: string[];
  onPitRoad: boolean;
  isOnTrack: boolean;
  // Session info
  trackName?: string;
  trackConfig?: string;
  trackCity?: string;
  trackCountry?: string;
  trackLength?: string;
  sessionType?: string;
  sessionName?: string;
  sessionLaps?: string;
  // Driver info
  driverName?: string;
  driverID?: number;
  driverIRating?: number;
  driverLicense?: string;
  carName?: string;
  carNumber?: string;
  carClass?: string;
  teamName?: string;
  // Weather
  weatherType?: string;
  skies?: string;
  windSpeed?: number;
  windDir?: number;
  humidity?: number;
  pressure?: number;
  trackState?: string;
  fogLevel?: number;
  // Dynamics
  handling?: string;
  absActive?: boolean;
  incidentCount?: number;
  shiftIndicator?: number;
  understeerIndicator?: number;
  vehicleSlipAngle?: number;
}

interface UseIRacingLiveOptions {
  url?: string;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
}

interface UseIRacingLiveResult {
  data: IRacingData | null;
  connected: boolean;
  error: string | null;
  reconnectAttempts: number;
  connect: (url?: string) => void;
  disconnect: () => void;
}

export function useIRacingLive(options: UseIRacingLiveOptions | string = {}): UseIRacingLiveResult {
  // Soportar la API original con un string como argumento
  const normalizedOptions: UseIRacingLiveOptions =
    typeof options === 'string' ? { url: options } : options;

  const {
    url: initialUrl,
    maxReconnectAttempts = 10,
    reconnectIntervalMs = 3000,
  } = normalizedOptions;

  const [url, setUrl] = useState(initialUrl);
  const [data, setData] = useState<IRacingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar si el prop URL cambia externamente
  useEffect(() => {
    if (initialUrl !== undefined) setUrl(initialUrl);
  }, [initialUrl]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const telemetry = JSON.parse(event.data) as IRacingData;
      setData(telemetry);
    } catch (e) {
      // Log del error de parseo (no silenciar)
      if (import.meta.env.DEV) {
        console.warn('🏎️ iRacing parse error:', e, 'Raw data:', event.data);
      }
    }
  }, []);

  const handleError = useCallback(() => {
    setError('Connection failed — is iracing_live.py running?');
  }, []);

  const { status, reconnectAttempts, connect: wsConnect, disconnect } = useReconnectingWebSocket({
    url,
    maxAttempts: maxReconnectAttempts,
    intervalMs: reconnectIntervalMs,
    onMessage: handleMessage,
    onError: handleError,
    autoConnect: !!url,
  });

  // Exponer connect con argumento URL para compatibilidad con uso existente
  const connect = useCallback((newUrl?: string) => {
    if (newUrl) {
      setUrl(newUrl);
      // useReconnectingWebSocket reconectará automáticamente al cambiar la url
    } else {
      wsConnect();
    }
  }, [wsConnect]);

  return {
    data,
    connected: status === 'connected',
    error,
    reconnectAttempts,
    connect,
    disconnect,
  };
}
