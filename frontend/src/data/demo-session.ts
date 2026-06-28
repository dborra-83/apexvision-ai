/**
 * Demo data for Analysis and Live modes.
 * Simulates a 10-lap session at Le Mans with realistic telemetry.
 */

export const DEMO_SESSION_INFO = {
  startTime: "2026-06-22T20:00:00",
  simulator: "iracing",
  driver: "Demo Driver",
  driverID: 99999,
  iRating: 2350,
  license: "A 4.99",
  car: "Mercedes AMG GT3 EVO",
  carNumber: "77",
  carClass: "GT3",
  track: "Circuit des 24 Heures du Mans",
  trackConfig: "24h",
  trackLength: "13.626 km",
  sessionName: "Practice",
  airTemp: 22,
  trackTemp: 31,
};

export const DEMO_LAP_SUMMARIES = [
  { lap: 1, lapTime: 234.567, maxSpeed: 312.4, avgSpeed: 185.2, minSpeed: 62.1, fuelStart: 100, fuelEnd: 96.2, fuelUsed: 3.8, samples: 2345, offTracks: 2, maxGLat: 2.1, maxGLon: 3.8, maxBrake: 98, incidents: 0 },
  { lap: 2, lapTime: 231.234, maxSpeed: 318.1, avgSpeed: 188.5, minSpeed: 58.3, fuelStart: 96.2, fuelEnd: 92.5, fuelUsed: 3.7, samples: 2312, offTracks: 1, maxGLat: 2.3, maxGLon: 4.0, maxBrake: 100, incidents: 0 },
  { lap: 3, lapTime: 229.876, maxSpeed: 321.0, avgSpeed: 190.1, minSpeed: 60.5, fuelStart: 92.5, fuelEnd: 88.9, fuelUsed: 3.6, samples: 2298, offTracks: 0, maxGLat: 2.4, maxGLon: 4.1, maxBrake: 99, incidents: 0 },
  { lap: 4, lapTime: 230.445, maxSpeed: 319.8, avgSpeed: 189.3, minSpeed: 59.7, fuelStart: 88.9, fuelEnd: 85.4, fuelUsed: 3.5, samples: 2305, offTracks: 1, maxGLat: 2.2, maxGLon: 3.9, maxBrake: 97, incidents: 2 },
  { lap: 5, lapTime: 228.912, maxSpeed: 322.5, avgSpeed: 191.0, minSpeed: 61.2, fuelStart: 85.4, fuelEnd: 81.9, fuelUsed: 3.5, samples: 2289, offTracks: 0, maxGLat: 2.5, maxGLon: 4.2, maxBrake: 100, incidents: 0 },
  { lap: 6, lapTime: 229.301, maxSpeed: 320.8, avgSpeed: 190.5, minSpeed: 60.8, fuelStart: 81.9, fuelEnd: 78.4, fuelUsed: 3.5, samples: 2293, offTracks: 0, maxGLat: 2.4, maxGLon: 4.0, maxBrake: 99, incidents: 0 },
  { lap: 7, lapTime: 230.876, maxSpeed: 318.2, avgSpeed: 189.0, minSpeed: 59.5, fuelStart: 78.4, fuelEnd: 74.8, fuelUsed: 3.6, samples: 2309, offTracks: 1, maxGLat: 2.3, maxGLon: 3.9, maxBrake: 98, incidents: 0 },
  { lap: 8, lapTime: 229.654, maxSpeed: 321.3, avgSpeed: 190.3, minSpeed: 60.2, fuelStart: 74.8, fuelEnd: 71.3, fuelUsed: 3.5, samples: 2297, offTracks: 0, maxGLat: 2.5, maxGLon: 4.1, maxBrake: 100, incidents: 0 },
  { lap: 9, lapTime: 228.432, maxSpeed: 323.1, avgSpeed: 191.5, minSpeed: 61.5, fuelStart: 71.3, fuelEnd: 67.8, fuelUsed: 3.5, samples: 2284, offTracks: 0, maxGLat: 2.6, maxGLon: 4.3, maxBrake: 100, incidents: 0 },
  { lap: 10, lapTime: 228.102, maxSpeed: 324.0, avgSpeed: 191.8, minSpeed: 62.0, fuelStart: 67.8, fuelEnd: 64.2, fuelUsed: 3.6, samples: 2281, offTracks: 0, maxGLat: 2.6, maxGLon: 4.4, maxBrake: 100, incidents: 0 },
];

export const DEMO_EVENTS = [
  { type: "off_track", timestamp: 1719090100, message: "Off track @ 23% lap 1", lap: 1, trackPct: 23, speed: 245.3 },
  { type: "off_track", timestamp: 1719090200, message: "Off track @ 67% lap 1", lap: 1, trackPct: 67, speed: 198.7 },
  { type: "ai_recommendation", timestamp: 1719090300, message: "🔄 Oversteer detected — smooth throttle exit", lap: 2, trackPct: 45 },
  { type: "off_track", timestamp: 1719090400, message: "Off track @ 23% lap 2", lap: 2, trackPct: 23, speed: 251.0 },
  { type: "ai_recommendation", timestamp: 1719090500, message: "⚠️ 2x off-track @ 23% — brake 5m earlier", lap: 3, trackPct: 23 },
  { type: "best_lap", timestamp: 1719090600, message: "New best: 3:49.876 (L3)", lap: 3, trackPct: 0 },
  { type: "ai_recommendation", timestamp: 1719090700, message: "🛞 Wear 45% — consider pit next lap", lap: 4, trackPct: 50 },
  { type: "off_track", timestamp: 1719090750, message: "Off track @ 82% lap 4", lap: 4, trackPct: 82, speed: 175.2 },
  { type: "off_track", timestamp: 1719090780, message: "Off track @ 23% lap 7", lap: 7, trackPct: 23, speed: 248.0 },
  { type: "best_lap", timestamp: 1719090900, message: "New best: 3:48.912 (L5)", lap: 5, trackPct: 0 },
  { type: "ai_recommendation", timestamp: 1719091000, message: "📊 Consistency improving — maintain pace", lap: 6, trackPct: 100 },
  { type: "best_lap", timestamp: 1719091100, message: "New best: 3:48.432 (L9)", lap: 9, trackPct: 0 },
  { type: "ai_recommendation", timestamp: 1719091200, message: "🎯 Pace improving lap over lap — focus on exits", lap: 10, trackPct: 50 },
  { type: "best_lap", timestamp: 1719091300, message: "New best: 3:48.102 (L10)", lap: 10, trackPct: 0 },
];

/**
 * Generates a continuous stream of demo telemetry data (for Live demo mode).
 * Simulates a realistic lap with proper timing — each "lap" takes ~60 seconds real time.
 * Returns a function that produces the next frame each time it's called (at 10Hz = 100ms).
 */
export function createDemoTelemetryStream() {
  let tick = 0;
  let lap = 1;
  let lapDistPct = 0;
  let bestLapTime = 228.102;

  return function nextFrame(): Record<string, unknown> {
    tick++;
    // Advance ~1.5-2% per second (at 10Hz = 0.15-0.2% per tick)
    // A full lap takes ~60-70 seconds of real time
    lapDistPct += 0.15 + Math.sin(tick * 0.01) * 0.03;
    if (lapDistPct >= 100) {
      lapDistPct = 0;
      lap++;
    }

    const phase = (lapDistPct / 100) * Math.PI * 2;
    const isCorner = Math.sin(phase * 3) > 0.3;
    const isStraight = Math.cos(phase * 2) > 0.5;

    const speed = isStraight ? 290 + Math.random() * 35 : 80 + Math.random() * 120;
    const throttle = isStraight ? 95 + Math.random() * 5 : isCorner ? 30 + Math.random() * 40 : 70 + Math.random() * 20;
    const brake = isCorner && Math.sin(phase * 6) > 0.7 ? 60 + Math.random() * 40 : 0;
    const rpm = Math.round(speed * 22 + Math.random() * 500);
    const gear = speed < 80 ? 2 : speed < 130 ? 3 : speed < 180 ? 4 : speed < 230 ? 5 : speed < 280 ? 6 : 7;
    const steering = isCorner ? (Math.sin(phase * 4) * 45) : Math.sin(phase) * 5;

    const fuelPercent = Math.max(10, 100 - lap * 3.5 - lapDistPct * 0.035);
    const tireLF = 85 + Math.sin(phase * 2) * 15 + Math.random() * 5;
    const tireRF = 87 + Math.cos(phase * 2) * 14 + Math.random() * 5;
    const tireLR = 82 + Math.sin(phase * 1.5) * 12 + Math.random() * 4;
    const tireRR = 84 + Math.cos(phase * 1.5) * 13 + Math.random() * 4;

    return {
      simulator: "demo",
      connected: true,
      timestamp: Date.now() / 1000,
      fieldAvailability: {},
      speed: Math.round(speed * 10) / 10,
      rpm, gear, throttle: Math.round(throttle), brake: Math.round(brake),
      clutch: 0,
      steering: Math.round(steering * 10) / 10,
      lap, lapDistPct: Math.round(lapDistPct * 10) / 10,
      position: 3, classPosition: 2,
      lastLapTime: 228 + Math.random() * 4,
      bestLapTime, currentLapTime: lapDistPct * 2.28,
      deltaToSessionBest: (Math.random() - 0.4) * 1.5,
      sessionLapsRemaining: Math.max(0, 20 - lap),
      fuelLevel: fuelPercent * 0.9, fuelPercent,
      fuelUsePerHour: 38.5 + Math.random() * 2,
      gLateral: isCorner ? (Math.sin(phase * 4) * 2.5) : Math.random() * 0.3,
      gLongitudinal: brake > 50 ? -(1.5 + Math.random()) : throttle > 80 ? 0.5 + Math.random() * 0.3 : 0,
      tireLF_temp: tireLF, tireRF_temp: tireRF, tireLR_temp: tireLR, tireRR_temp: tireRR,
      tireLF_wear: Math.min(90, lap * 4 + Math.random() * 5),
      tireRF_wear: Math.min(90, lap * 4.2 + Math.random() * 5),
      tireLR_wear: Math.min(85, lap * 3.5 + Math.random() * 4),
      tireRR_wear: Math.min(85, lap * 3.7 + Math.random() * 4),
      tireCompound: "Medium",
      trackTemp: 31, airTemp: 22, windSpeed: 8, humidity: 55,
      skies: "Partly Cloudy", trackState: "dry",
      flags: [], onPitRoad: false, isOnTrack: true, isOffTrack: false,
      drs: isStraight && speed > 280, absActive: brake > 80,
      trackName: "Circuit des 24 Heures du Mans", trackConfig: "24h",
      sessionName: "Practice (DEMO)",
      driverName: "Demo Driver", driverIRating: 2350, driverLicense: "A 4.99",
      carName: "Mercedes AMG GT3 EVO", carClass: "GT3",
      handling: isCorner && Math.random() > 0.7 ? "oversteer" : "neutral",
      understeerIndicator: 0, incidentCount: 2, shiftIndicator: rpm > 7500 ? 85 : 40,
      oilTemp: 92 + Math.random() * 5, oilPress: 4.2 + Math.random() * 0.3,
      waterTemp: 85 + Math.random() * 4, voltage: 13.8,
    };
  };
}
