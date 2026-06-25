/**
 * Traducciones específicas de la vista Live / Racing Dashboard.
 */

export const liveTranslations = {
  en: {
    // Session
    session: 'Session', driver: 'Driver', car: 'Car', track: 'Track',
    // Delta
    delta: 'Delta', position: 'Position', lap: 'Lap',
    reconnecting: 'RECONNECTING', pit: 'PIT',
    // Speed
    speed: 'Speed', kmh: 'KM/H', rpm: 'RPM', gear: 'Gear', shift: 'SHIFT',
    // Pedals
    throttle: 'Throttle', brake: 'Brake', clutch: 'Clutch', steering: 'Steering',
    // Timing
    timing: 'Timing', current: 'Current', best: 'Best', last: 'Last',
    // Handling
    handling: 'Handling', oversteer: 'OVERSTEER', understeer: 'UNDERSTEER', neutral: 'NEUTRAL',
    abs: 'ABS', active: 'ACTIVE', off: 'OFF', incidents: 'Incidents',
    // Tires
    tires: 'Tires', compound: 'Compound', wear: 'Wear', temp: 'Temp',
    fl: 'FL', fr: 'FR', rl: 'RL', rr: 'RR',
    inner: 'Inner', mid: 'Mid', outer: 'Outer',
    // Fuel
    fuel: 'Fuel', level: 'Level', perLap: 'Per Lap', lapsLeft: 'Laps Left',
    liters: 'Liters', consumption: 'Consumption',
    // Engine
    engine: 'Engine', oilTemp: 'Oil Temp', oilPress: 'Oil Press',
    waterTemp: 'Water Temp', voltage: 'Voltage',
    // Weather
    weather: 'Weather & Track', air: 'Air', trackTemp: 'Track',
    wind: 'Wind', humidity: 'Humidity', skies: 'Skies', surface: 'Surface', fog: 'Fog',
    // G-Force
    gforce: 'G-Force', lat: 'LAT', lon: 'LON',
    // AI
    aiEngineer: 'AI RACE ENGINEER', analyzing: 'Analyzing telemetry...',
    // Events
    events: 'Session Log', maxSpeed: 'Max Speed', offTrack: 'Off Track',
    bestLapEvent: 'Best Lap', clearLog: 'Clear',
    recent: 'Recent', noEvents: 'No events yet...',
    // Sectors
    sector: 'Sector', sectors: 'Sectors', s1: 'S1', s2: 'S2', s3: 'S3',
    better: 'better', worse: 'worse', trackMap: 'Track Map',
    // Telemetry trace
    inputTrace: 'Inputs', lastSeconds: 'last {n}s',
    // Connect
    connect: 'CONNECT', disconnect: 'Disconnect',
    telemetry: 'iRacing Telemetry',
    analysis: 'Analysis',
    // Theme
    darkMode: 'Dark', lightMode: 'Light',
    // Stint Pace
    stintPace: 'Stint Pace', trendPer3L: 'Trend/3L', frontDegL: 'F.Deg/L',
    trackInfo: 'Track Info', lapHistoryTitle: 'Lap History', lapLabel: 'L', deltaVsBest: 'Δ Best',
    fuelUsed: 'Fuel/L',
    // Tire status
    tireColdStatus: 'COLD', tireOptStatus: 'OPTIMAL', tireHotStatus: 'HOT',
    tireOptRange: 'Opt: 65°–105°C',
  },
  es: {
    // Sesión
    session: 'Sesión', driver: 'Piloto', car: 'Auto', track: 'Circuito',
    // Delta
    delta: 'Delta', position: 'Posición', lap: 'Vuelta',
    reconnecting: 'RECONECTANDO', pit: 'PITS',
    // Velocidad
    speed: 'Velocidad', kmh: 'KM/H', rpm: 'RPM', gear: 'Marcha', shift: 'CAMBIO',
    // Pedales
    throttle: 'Acelerador', brake: 'Freno', clutch: 'Embrague', steering: 'Volante',
    // Tiempos
    timing: 'Tiempos', current: 'Actual', best: 'Mejor', last: 'Última',
    // Manejo
    handling: 'Manejo', oversteer: 'SOBREVIRAJE', understeer: 'SUBVIRAJE', neutral: 'NEUTRO',
    abs: 'ABS', active: 'ACTIVO', off: 'OFF', incidents: 'Incidentes',
    // Neumáticos
    tires: 'Neumáticos', compound: 'Compuesto', wear: 'Desgaste', temp: 'Temp',
    fl: 'DI', fr: 'DD', rl: 'TI', rr: 'TD',
    inner: 'Interior', mid: 'Centro', outer: 'Exterior',
    // Combustible
    fuel: 'Combustible', level: 'Nivel', perLap: 'Por Vuelta', lapsLeft: 'Vueltas Rest.',
    liters: 'Litros', consumption: 'Consumo',
    // Motor
    engine: 'Motor', oilTemp: 'Temp Aceite', oilPress: 'Pres Aceite',
    waterTemp: 'Temp Agua', voltage: 'Voltaje',
    // Clima
    weather: 'Clima y Pista', air: 'Aire', trackTemp: 'Pista',
    wind: 'Viento', humidity: 'Humedad', skies: 'Cielo', surface: 'Superficie', fog: 'Niebla',
    // Fuerza G
    gforce: 'Fuerza G', lat: 'LAT', lon: 'LON',
    // IA
    aiEngineer: 'IA INGENIERO DE CARRERA', analyzing: 'Analizando telemetría...',
    // Events
    events: 'Registro de Sesión', maxSpeed: 'Vel. Máxima', offTrack: 'Fuera de Pista',
    bestLapEvent: 'Mejor Vuelta', clearLog: 'Limpiar',
    recent: 'Recientes', noEvents: 'Sin eventos aún...',
    // Sectors
    sector: 'Sector', sectors: 'Sectores', s1: 'S1', s2: 'S2', s3: 'S3',
    better: 'mejor', worse: 'peor', trackMap: 'Mapa de Pista',
    // Telemetry trace
    inputTrace: 'Entradas', lastSeconds: 'últimos {n}s',
    // Connect
    connect: 'CONECTAR', disconnect: 'Desconectar',
    telemetry: 'Telemetría iRacing',
    analysis: 'Análisis',
    // Tema
    darkMode: 'Oscuro', lightMode: 'Claro',
    // Ritmo
    stintPace: 'Ritmo del Stint', trendPer3L: 'Tend./3V', frontDegL: 'Deg.D/V',
    trackInfo: 'Info del Circuito', lapHistoryTitle: 'Historial de Vueltas', lapLabel: 'V', deltaVsBest: 'Δ Mejor',
    fuelUsed: 'Comb./V',
    // Estado neumáticos
    tireColdStatus: 'FRÍO', tireOptStatus: 'ÓPTIMO', tireHotStatus: 'CALIENTE',
    tireOptRange: 'Ópt: 65°–105°C',
  },
};

export type LiveLang = keyof typeof liveTranslations;
export type LiveT = typeof liveTranslations.en;
