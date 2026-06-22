/**
 * Componente de notificación de alertas.
 * Posición fija, alto contraste, descarte manual.
 */

import { Alert, useAlertsStore } from '../store/alerts-store';

interface AlertNotificationProps {
  alert: Alert;
}

const severityColors = {
  critica: 'bg-red-600 border-red-400',
  alta: 'bg-orange-600 border-orange-400',
  media: 'bg-yellow-600 border-yellow-400',
  informativa: 'bg-blue-600 border-blue-400',
};

export function AlertNotification({ alert }: AlertNotificationProps) {
  const dismissAlert = useAlertsStore((state) => state.dismissAlert);

  return (
    <div
      className={`${severityColors[alert.severidad]} border-l-4 px-4 py-3 flex items-center justify-between`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-3">
        <span className="font-bold uppercase text-xs">{alert.severidad}</span>
        <span className="font-semibold">{alert.pilotoId}</span>
        <span>{alert.texto || alert.tipo}</span>
      </div>
      <button
        onClick={() => dismissAlert(alert.alertaId)}
        className="text-white hover:text-gray-200 ml-4 text-xl leading-none"
        aria-label="Descartar alerta"
      >
        ×
      </button>
    </div>
  );
}
