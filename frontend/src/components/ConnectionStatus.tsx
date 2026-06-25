/**
 * Indicador de estado de conexión WebSocket.
 */

interface ConnectionStatusProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
  attempts: number;
  onManualReconnect?: () => void;
}

const statusConfig = {
  connected: { color: 'bg-green-500', label: 'Conectado' },
  reconnecting: { color: 'bg-yellow-500 animate-pulse', label: 'Reconectando...' },
  disconnected: { color: 'bg-red-500', label: 'Desconectado' },
};

export function ConnectionStatus({ status, attempts, onManualReconnect }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-400">{config.label}</span>
      {status === 'disconnected' && onManualReconnect && (
        <button
          onClick={onManualReconnect}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Reconectar
        </button>
      )}
      {status === 'reconnecting' && (
        <span className="text-xs text-gray-500">({attempts}/5)</span>
      )}
    </div>
  );
}
