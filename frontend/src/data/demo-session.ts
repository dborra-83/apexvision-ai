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
 * Generates a realistic demo telemetry stream for the Live page.
 * 
 * Simulates a full lap at Le Mans (~3:50 = 230 seconds real time compressed to ~90 seconds).
 * Uses smooth interpolation (no random jumps) to simulate proper driving physics:
 * - Straights: smooth acceleration to top speed
 * - Braking zones: sharp deceleration
 * - Corners: reduced speed, high steering, lateral G
 * - Exit: progressive throttle application
 * 
 * Called at 10Hz (every 100ms). One full lap takes ~90 seconds of real time.
 */
export function createDemoTelemetryStream() {
  let tick = 0;
  let lap = 1;
  let bestLapTime = 228.102;
  let lastLapTime = 230.5;
  
  // Smooth state (interpolated, not random)
  let speed = 0;
  let throttle = 0;
  let brake = 0;
  let steering = 0;
  let rpm = 800;
  let gear = 1;
  let gLat = 0;
  let gLon = 0;

  // Le Mans track profile: 38 segments defining the character of each section
  // Each segment: [type, length%] where type is 'S'=straight, 'B'=braking, 'C'=corner, 'E'=exit
  const trackProfile = [
    { start: 0, end: 8, type: 'S', topSpeed: 310, label: 'Start/Finish Straight' },
    { start: 8, end: 11, type: 'B', label: 'Dunlop Braking' },
    { start: 11, end: 15, type: 'C', speed: 95, steer: 40, label: 'Dunlop Chicane' },
    { start: 15, end: 18, type: 'E', label: 'Dunlop Exit' },
    { start: 18, end: 22, type: 'S', topSpeed: 270, label: 'Esses approach' },
    { start: 22, end: 24, type: 'B', label: 'Esses Braking' },
    { start: 24, end: 30, type: 'C', speed: 140, steer: 25, label: 'Esses' },
    { start: 30, end: 33, type: 'E', label: 'Tertre Rouge approach' },
    { start: 33, end: 35, type: 'B', label: 'Tertre Rouge Braking' },
    { start: 35, end: 38, type: 'C', speed: 160, steer: 30, label: 'Tertre Rouge' },
    { start: 38, end: 55, type: 'S', topSpeed: 340, label: 'Mulsanne Straight' },
    { start: 55, end: 57, type: 'B', label: 'Mulsanne Chicane 1 Braking' },
    { start: 57, end: 60, type: 'C', speed: 120, steer: 35, label: 'Mulsanne Chicane 1' },
    { start: 60, end: 65, type: 'S', topSpeed: 320, label: 'Mulsanne Straight 2' },
    { start: 65, end: 67, type: 'B', label: 'Mulsanne Chicane 2 Braking' },
    { start: 67, end: 70, type: 'C', speed: 115, steer: 38, label: 'Mulsanne Chicane 2' },
    { start: 70, end: 75, type: 'S', topSpeed: 310, label: 'Mulsanne End' },
    { start: 75, end: 78, type: 'B', label: 'Indianapolis Braking' },
    { start: 78, end: 82, type: 'C', speed: 80, steer: 55, label: 'Indianapolis' },
    { start: 82, end: 84, type: 'E', label: 'Arnage approach' },
    { start: 84, end: 86, type: 'B', label: 'Arnage Braking' },
    { start: 86, end: 89, type: 'C', speed: 65, steer: 65, label: 'Arnage' },
    { start: 89, end: 92, type: 'E', label: 'Porsche Curves approach' },
    { start: 92, end: 97, type: 'C', speed: 200, steer: 20, label: 'Porsche Curves' },
    { start: 97, end: 100, type: 'S', topSpeed: 280, label: 'Ford Chicane approach' },
  ];

  function getSegment(pct: number) {
    return trackProfile.find(s => pct >= s.start && pct < s.end) || trackProfile[0];
  }

  // Smooth interpolation helper
  function lerp(current: number, target: number, rate: number): number {
    return current + (target - current) * rate;
  }

  return function nextFrame(): Record<string, unknown> {
    tick++;

    // Advance track position: ~0.11% per tick at 10Hz = 1.1%/s → full lap in ~90 seconds
    const lapDistPct = (tick * 0.11) % 100;
    const newLap = Math.floor(tick * 0.11 / 100) + 1;
    if (newLap > lap) {
      lastLapTime = 228 + Math.sin(lap * 0.7) * 3;
      if (lastLapTime < bestLapTime) bestLapTime = lastLapTime;
      lap = newLap;
    }

    const segment = getSegment(lapDistPct);
    const smoothRate = 0.08; // How fast values change (lower = smoother)
    const fastRate = 0.15;

    // Calculate targets based on segment type
    let targetSpeed = 200;
    let targetThrottle = 50;
    let targetBrake = 0;
    let targetSteering = 0;
    let targetGLat = 0;
    let targetGLon = 0;

    switch (segment.type) {
      case 'S': // Straight — full throttle, building speed
        targetSpeed = segment.topSpeed || 300;
        targetThrottle = 100;
        targetBrake = 0;
        targetSteering = Math.sin(tick * 0.02) * 2; // tiny corrections
        targetGLat = Math.sin(tick * 0.03) * 0.2;
        targetGLon = speed < targetSpeed * 0.9 ? 0.4 : 0.1;
        break;
      case 'B': // Braking — hard decel
        targetSpeed = (segment as any).speed || 100;
        targetThrottle = 0;
        targetBrake = 85 + Math.sin(tick * 0.1) * 10;
        targetSteering = Math.sin(tick * 0.05) * 5;
        targetGLat = Math.sin(tick * 0.04) * 0.5;
        targetGLon = -3.5;
        break;
      case 'C': // Corner — low speed, high steering, lateral G
        targetSpeed = (segment as any).speed || 120;
        targetThrottle = 20 + Math.sin(tick * 0.05) * 15;
        targetBrake = speed > targetSpeed + 20 ? 30 : 0;
        targetSteering = (segment as any).steer || 30;
        targetSteering *= Math.sin(tick * 0.03) > 0 ? 1 : -0.3; // vary direction slightly
        targetGLat = ((segment as any).steer || 30) / 20; // proportional to steering
        targetGLon = -0.3;
        break;
      case 'E': // Exit — progressive throttle
        targetSpeed = speed + 2; // accelerating
        targetThrottle = 60 + (lapDistPct - segment.start) / (segment.end - segment.start) * 40;
        targetBrake = 0;
        targetSteering = steering * 0.7; // unwinding
        targetGLat = gLat * 0.8;
        targetGLon = 0.5;
        break;
    }

    // Smooth interpolation — values change gradually, never jump
    speed = lerp(speed, targetSpeed, smoothRate);
    throttle = lerp(throttle, targetThrottle, fastRate);
    brake = lerp(brake, targetBrake, fastRate);
    steering = lerp(steering, targetSteering, smoothRate);
    gLat = lerp(gLat, targetGLat, smoothRate);
    gLon = lerp(gLon, targetGLon, smoothRate);

    // Derived values
    rpm = Math.round(speed * 22 + 800);
    gear = speed < 60 ? 2 : speed < 110 ? 3 : speed < 160 ? 4 : speed < 220 ? 5 : speed < 280 ? 6 : 7;

    const fuelPercent = Math.max(10, 100 - lap * 3.5 - lapDistPct * 0.035);
    const currentLapTime = lapDistPct * 2.3; // ~230s per lap
    const delta = (Math.sin(lapDistPct * 0.05 + lap) * 0.8);

    // Tire temps: warmer in corners, cooler on straights
    const cornerHeat = segment.type === 'C' ? 8 : segment.type === 'B' ? 4 : 0;
    const tireLF = 88 + cornerHeat + Math.sin(tick * 0.01) * 3;
    const tireRF = 90 + cornerHeat + Math.cos(tick * 0.01) * 3;
    const tireLR = 84 + cornerHeat * 0.7 + Math.sin(tick * 0.008) * 2;
    const tireRR = 86 + cornerHeat * 0.7 + Math.cos(tick * 0.008) * 2;

    return {
      simulator: "demo",
      connected: true,
      timestamp: Date.now() / 1000,
      fieldAvailability: {},
      speed: Math.round(Math.max(0, speed) * 10) / 10,
      rpm: Math.max(800, rpm),
      gear,
      throttle: Math.round(Math.max(0, Math.min(100, throttle))),
      brake: Math.round(Math.max(0, Math.min(100, brake))),
      clutch: 0,
      steering: Math.round(steering * 10) / 10,
      lap,
      lapDistPct: Math.round(lapDistPct * 10) / 10,
      position: 3, classPosition: 2,
      lastLapTime,
      bestLapTime,
      currentLapTime: Math.round(currentLapTime * 100) / 100,
      deltaToSessionBest: Math.round(delta * 1000) / 1000,
      sessionLapsRemaining: Math.max(0, 20 - lap),
      fuelLevel: fuelPercent * 0.9,
      fuelPercent: Math.round(fuelPercent * 10) / 10,
      fuelUsePerHour: 38.5,
      gLateral: Math.round(gLat * 100) / 100,
      gLongitudinal: Math.round(gLon * 100) / 100,
      tireLF_temp: Math.round(tireLF * 10) / 10,
      tireRF_temp: Math.round(tireRF * 10) / 10,
      tireLR_temp: Math.round(tireLR * 10) / 10,
      tireRR_temp: Math.round(tireRR * 10) / 10,
      tireLF_wear: Math.min(90, lap * 3 + lapDistPct * 0.02),
      tireRF_wear: Math.min(90, lap * 3.2 + lapDistPct * 0.02),
      tireLR_wear: Math.min(85, lap * 2.5 + lapDistPct * 0.015),
      tireRR_wear: Math.min(85, lap * 2.7 + lapDistPct * 0.015),
      tireCompound: "Medium",
      trackTemp: 31, airTemp: 22, windSpeed: 8, humidity: 55,
      skies: "Partly Cloudy", trackState: "dry",
      flags: [], onPitRoad: false, isOnTrack: true, isOffTrack: false,
      drs: segment.type === 'S' && speed > 280,
      absActive: brake > 70 && speed > 100,
      trackName: "Circuit des 24 Heures du Mans", trackConfig: "24h",
      sessionName: "Practice (DEMO)",
      driverName: "Demo Driver", driverIRating: 2350, driverLicense: "A 4.99",
      carName: "Mercedes AMG GT3 EVO", carClass: "GT3",
      handling: segment.type === 'C' && gLat > 1.5 ? "oversteer" : "neutral",
      understeerIndicator: segment.type === 'C' ? gLat * 2 : 0,
      incidentCount: 2,
      shiftIndicator: rpm > 7500 ? Math.min(100, (rpm - 7500) / 10) : 0,
      oilTemp: 92 + Math.sin(tick * 0.005) * 2,
      oilPress: 4.2 + Math.sin(tick * 0.003) * 0.2,
      waterTemp: 85 + Math.sin(tick * 0.004) * 2,
      voltage: 13.8,
    };
  };
}
