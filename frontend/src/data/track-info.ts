/**
 * Base de datos de información de circuitos para el piloto.
 * Incluye consejos de manejo, particularidades y datos útiles.
 * Se busca por nombre parcial del circuito.
 */

export interface TrackTip {
  key: string;          // Keyword parcial para match con trackName
  name: string;
  country: string;
  length: string;
  turns: number;
  lapRecord?: string;
  tipEs: string;        // Consejo en español
  tipEn: string;        // Consejo en inglés
  particularityEs: string;
  particularityEn: string;
}

export const TRACK_DATABASE: TrackTip[] = [
  {
    key: 'monza', name: 'Autodromo Nazionale Monza', country: 'Italy', length: '5.793 km', turns: 11,
    lapRecord: '1:19.119 (Barrichello, 2004)',
    tipEs: 'Circuito de alta velocidad. Usar marchas altas, frenadas tardías. Las chicanes de Variante del Rettifilo requieren precision. Cuidado con los pianos agresivos.',
    tipEn: 'High-speed circuit. Use high gears, late braking. Variante del Rettifilo chicanes need precision. Watch aggressive curbs.',
    particularityEs: 'El "Templo de la Velocidad". Baja carga aerodinámica. Los slipstreams son clave para adelantar en recta principal y Curva Parabolica.',
    particularityEn: 'The "Temple of Speed". Low downforce setup. Slipstreams are key for overtaking on main straight and Parabolica.',
  },
  {
    key: 'spa', name: 'Circuit de Spa-Francorchamps', country: 'Belgium', length: '7.004 km', turns: 19,
    lapRecord: '1:41.252 (Bottas, 2018)',
    tipEs: 'Eau Rouge/Raidillon es flat-out con confianza. Sector medio técnico con cambios de elevación. El clima cambia rápido — puede llover en un sector y no en otro.',
    tipEn: 'Eau Rouge/Raidillon is flat-out with confidence. Technical middle sector with elevation changes. Weather changes fast — rain in one sector, dry in another.',
    particularityEs: 'Uno de los circuitos más largos y rápidos. Las diferencias de elevación hacen que el agarre varíe mucho. Blanchimont es una curva ciega rápida — comprometerse.',
    particularityEn: 'One of the longest and fastest tracks. Elevation changes mean grip varies a lot. Blanchimont is a fast blind corner — commit to it.',
  },
  {
    key: 'silverstone', name: 'Silverstone Circuit', country: 'UK', length: '5.891 km', turns: 18,
    lapRecord: '1:24.303 (Hamilton, 2020)',
    tipEs: 'Maggots-Becketts-Chapel es la secuencia más exigente: mantener ritmo y usar todo el ancho. Copse y Stowe son curvas rápidas de alta G. Zona de DRS larga.',
    tipEn: 'Maggots-Becketts-Chapel is the most demanding sequence: keep rhythm and use full width. Copse and Stowe are high-G fast corners. Long DRS zone.',
    particularityEs: 'Circuito aerodinámico — alta carga. El viento afecta mucho en las curvas rápidas. Superficie muy abrasiva con los neumáticos.',
    particularityEn: 'Aero-dependent track — high downforce. Wind affects fast corners significantly. Surface is very abrasive on tires.',
  },
  {
    key: 'nurburgring nordschleife', name: 'Nürburgring Nordschleife', country: 'Germany', length: '20.832 km', turns: 154,
    tipEs: 'La "Montaña Verde" — 154 curvas, memorizar es imposible sin práctica. Cambios de elevación extremos. Karussell requiere ir por el concreto interior. Cuidado con el clima cambiante.',
    tipEn: 'The "Green Hell" — 154 corners, memorizing is impossible without practice. Extreme elevation changes. Karussell requires the inner concrete. Watch for changing weather.',
    particularityEs: 'El circuito más largo y peligroso del mundo. No hay escapatorias. Cada vuelta perfecta es un logro. Hay secciones ciegas con crestas — confianza y memoria muscular.',
    particularityEn: 'The longest and most dangerous circuit in the world. No run-offs. Every clean lap is an achievement. Blind crests throughout — confidence and muscle memory required.',
  },
  {
    key: 'barcelona', name: 'Circuit de Barcelona-Catalunya', country: 'Spain', length: '4.675 km', turns: 16,
    lapRecord: '1:16.741 (Hamilton, 2020)',
    tipEs: 'Sector 3 es clave — curvas lentas donde se gana tiempo. T1 es rápida y ciega. Cuidado con el viento en la recta principal. Desgaste alto de neumáticos.',
    tipEn: 'Sector 3 is key — slow corners where time is gained. T1 is fast and blind. Watch for wind on main straight. High tire degradation.',
    particularityEs: 'Circuito de referencia para pruebas. Equilibrio entre tracción y velocidad punta. El asfalto es muy exigente con neumáticos traseros.',
    particularityEn: 'Reference circuit for testing. Balance between traction and top speed. Tarmac is very demanding on rear tires.',
  },
  {
    key: 'imola', name: 'Autodromo Enzo e Dino Ferrari', country: 'Italy', length: '4.909 km', turns: 19,
    tipEs: 'Circuito rápido con muros cercanos. Variante Alta es técnica — no cortar demasiado. Aqua Minerale tiene cambio de elevación que desestabiliza. Pianese requiere entrada precisa.',
    tipEn: 'Fast track with close walls. Variante Alta is technical — don\'t cut too much. Aqua Minerale has elevation change that destabilizes. Pianese needs precise entry.',
    particularityEs: 'Anti-horario mixto. Errores se pagan caro — muros cercanos. Los frenos sufren mucho. Recordar: aquí murieron Senna y Ratzenberger en 1994.',
    particularityEn: 'Mixed anti-clockwise. Mistakes are costly — close walls. Brakes suffer a lot. Remember: Senna and Ratzenberger died here in 1994.',
  },
  {
    key: 'suzuka', name: 'Suzuka International Racing Course', country: 'Japan', length: '5.807 km', turns: 18,
    tipEs: 'Las Esses son flat-out con timing perfecto. Spoon es clave para la velocidad en la recta trasera. 130R es compromiso total — flat con confianza. El Casio Triangle requiere paciencia.',
    tipEn: 'The Esses are flat-out with perfect timing. Spoon is key for back straight speed. 130R is full commitment — flat with confidence. Casio Triangle needs patience.',
    particularityEs: 'Circuito en forma de 8 — único en F1. Flujo excepcional. Recompensa la consistencia y el compromiso en curvas rápidas.',
    particularityEn: 'Figure-8 layout — unique in F1. Exceptional flow. Rewards consistency and commitment in fast corners.',
  },
  {
    key: 'daytona', name: 'Daytona International Speedway', country: 'USA', length: '5.729 km', turns: 12,
    tipEs: 'Los peraltes tienen mucho grip — usar la línea alta para mantener velocidad. En el infield sector, las frenadas son intensas tras velocidades de óvalo. Cuidado con el tráfico.',
    tipEn: 'Banking has high grip — use high line to maintain speed. In the infield sector, braking is intense after oval speeds. Watch for traffic.',
    particularityEs: 'Combinación de óvalo con infield técnico. Drafting esencial en las rectas peraltadas. La gestión de tráfico define la carrera.',
    particularityEn: 'Combination of oval with technical infield. Drafting essential on banked straights. Traffic management defines the race.',
  },
  {
    key: 'watkins glen', name: 'Watkins Glen International', country: 'USA', length: '5.430 km', turns: 11,
    tipEs: 'Circuito rápido americano clásico. Las Esses son rápidas con cambios de elevación. La recta de atrás permite velocidades altas. Inner Loop es lento — paciencia.',
    tipEn: 'Classic fast American track. The Esses are fast with elevation changes. Back straight allows high speeds. Inner Loop is slow — patience.',
    particularityEs: 'Superficie bumpy que castiga la suspensión. Boot section es técnica. Mucha historia de NASCAR y F1 clásica.',
    particularityEn: 'Bumpy surface that punishes suspension. Boot section is technical. Rich NASCAR and classic F1 history.',
  },
  {
    key: 'laguna seca', name: 'WeatherTech Raceway Laguna Seca', country: 'USA', length: '3.602 km', turns: 11,
    tipEs: 'El Corkscrew es icónico — frenar tarde, apuntar al árbol, dejarse caer. No se ve la salida hasta comprometerse. T2 es rápida y ciega. Circuito corto — consistencia manda.',
    tipEn: 'The Corkscrew is iconic — brake late, aim at the tree, drop in. Exit not visible until committed. T2 is fast and blind. Short track — consistency wins.',
    particularityEs: 'El desnivel del Corkscrew es ~18m en ~140m. Superficie con poco grip. Frenos sufren en el descenso. No hay run-off en varias curvas.',
    particularityEn: 'Corkscrew drop is ~18m over ~140m. Low-grip surface. Brakes suffer on the descent. No run-off at several corners.',
  },
  {
    key: 'mans', name: 'Circuit des 24 Heures du Mans', country: 'France', length: '13.626 km', turns: 38,
    lapRecord: '3:14.791 (Kamui Kobayashi, Toyota, 2017)',
    tipEs: 'Circuito de resistencia más famoso del mundo. La recta de Mulsanne (6km) exige baja carga aerodinámica. Las chicanes de Mulsanne requieren frenadas desde 340+ km/h — referencia en distancia, no en visual. Indianápolis y Arnage son curvas lentas cruciales para el tiempo. Porsche Curves son una secuencia rápida y ciega con cambios de elevación — fluidez total.',
    tipEn: 'Most famous endurance circuit in the world. Mulsanne straight (6km) demands low downforce. Mulsanne chicanes need braking from 340+ km/h — use distance markers, not visual. Indianapolis and Arnage are crucial slow corners for lap time. Porsche Curves are a fast blind sequence with elevation changes — total flow required.',
    particularityEs: 'Mezcla de circuito permanente (sector técnico) con carreteras públicas cerradas (Mulsanne). El tráfico es constante — gestionar adelantamientos sin arriesgar. Cambios de grip entre secciones de asfalto nuevo y viejo. De noche la visibilidad cae drásticamente — memorizar frenadas. Gestión de neumáticos y combustible son la clave en las 24 horas.',
    particularityEn: 'Mix of permanent circuit (technical sector) with closed public roads (Mulsanne). Traffic is constant — manage overtakes without risk. Grip changes between new and old tarmac sections. At night visibility drops drastically — memorize braking points. Tire and fuel management are key across 24 hours.',
  },
];

/**
 * Busca información del circuito por nombre parcial.
 */
export function findTrackInfo(trackName: string): TrackTip | null {
  if (!trackName) return null;
  const lower = trackName.toLowerCase();
  return TRACK_DATABASE.find((t) => lower.includes(t.key)) || null;
}
