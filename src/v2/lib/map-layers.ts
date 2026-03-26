/**
 * Map layer registry — connects to backend geo API.
 * Adding a layer = adding it in the backend registry.py, then ONE line here.
 *
 * Backend: GET /api/geo/v1/layers/{id} → GeoJSON features + metadata
 * Backend: GET /api/geo/v1/catalog → list all available layers
 */

export interface LayerDef {
  id: string;
  label: string;
  icon: string;
  category: string;
  color: string;
  geometry: 'point' | 'line';
  source:
    | { type: 'geo-api'; layerId: string }
    | { type: 'direct'; url: string; toFeatures: (data: any) => GeoJSON.Feature[] };
  defaultOn?: boolean;
}

function pt(lon: number, lat: number, props: Record<string, any>): GeoJSON.Feature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props };
}

// ─── LAYER REGISTRY ─────────────────────────────────────────
// Backend layers use { type: 'geo-api', layerId } — features come from /api/geo/v1/layers/{id}
// Transport layers (flights, ais) are handled separately in LiveMap.tsx

export const LAYER_DEFS: LayerDef[] = [
  // ═══ Événements ═══
  { id: 'earthquakes',     label: 'Séismes',              icon: '🔴', category: 'Événements',    color: '#ef4444', geometry: 'point', source: { type: 'geo-api', layerId: 'earthquakes' },     defaultOn: true },
  { id: 'natural_events',  label: 'Catastrophes',         icon: '🌍', category: 'Événements',    color: '#eab308', geometry: 'point', source: { type: 'geo-api', layerId: 'natural_events' },  defaultOn: true },
  { id: 'wildfires',       label: 'Feux actifs',          icon: '🔥', category: 'Événements',    color: '#f97316', geometry: 'point', source: { type: 'geo-api', layerId: 'wildfires' } },
  { id: 'volcanoes',       label: 'Volcans',              icon: '🌋', category: 'Événements',    color: '#dc2626', geometry: 'point', source: { type: 'geo-api', layerId: 'volcanoes' } },
  { id: 'severe_storms',   label: 'Tempêtes',             icon: '🌀', category: 'Événements',    color: '#7c3aed', geometry: 'point', source: { type: 'geo-api', layerId: 'severe_storms' } },

  // ═══ Sécurité ═══
  { id: 'conflicts',       label: 'Zones de conflit',     icon: '⚔️', category: 'Sécurité',      color: '#dc2626', geometry: 'point', source: { type: 'geo-api', layerId: 'conflicts' } },
  { id: 'chokepoints',     label: 'Chokepoints',          icon: '⚓', category: 'Sécurité',      color: '#0ea5e9', geometry: 'point', source: { type: 'geo-api', layerId: 'chokepoints' } },

  // ═══ Ressources ═══
  { id: 'mines_uranium',     label: 'Uranium',            icon: '☢️', category: 'Ressources',    color: '#eab308', geometry: 'point', source: { type: 'geo-api', layerId: 'mines_uranium' } },
  { id: 'mines_rare_earths', label: 'Terres rares',       icon: '💎', category: 'Ressources',    color: '#a855f7', geometry: 'point', source: { type: 'geo-api', layerId: 'mines_rare_earths' } },
  { id: 'mines_lithium',     label: 'Lithium',            icon: '🔋', category: 'Ressources',    color: '#22c55e', geometry: 'point', source: { type: 'geo-api', layerId: 'mines_lithium' } },
  { id: 'mines_cobalt',      label: 'Cobalt',             icon: '⛏️', category: 'Ressources',    color: '#3b82f6', geometry: 'point', source: { type: 'geo-api', layerId: 'mines_cobalt' } },

  // ═══ Infrastructure & Énergie ═══
  { id: 'nuclear_reactors',    label: 'Réacteurs nucléaires',  icon: '☢️', category: 'Infrastructure', color: '#f59e0b', geometry: 'point', source: { type: 'geo-api', layerId: 'nuclear_reactors' } },
  { id: 'fossil_power_plants', label: 'Centrales fossiles',    icon: '🏭', category: 'Infrastructure', color: '#78716c', geometry: 'point', source: { type: 'geo-api', layerId: 'fossil_power_plants' } },

  // ═══ Transport (heatmaps — handled specially in LiveMap) ═══
  { id: 'flights', label: 'Aviation',            icon: '✈️', category: 'Transport', color: '#60a5fa', geometry: 'point',
    source: { type: 'direct', url: '/api/opensky/states/all', toFeatures: () => [] } },
  { id: 'ais',     label: 'Trafic maritime',     icon: '🚢', category: 'Transport', color: '#22d3ee', geometry: 'point',
    source: { type: 'direct', url: 'http://localhost:3005/vessels', toFeatures: () => [] } },
];

// ─── Derived ────────────────────────────────────────────────

export const LAYER_CATEGORIES = [...new Set(LAYER_DEFS.map(l => l.category))];

export function getLayersByCategory(): Map<string, LayerDef[]> {
  const map = new Map<string, LayerDef[]>();
  for (const l of LAYER_DEFS) {
    if (!map.has(l.category)) map.set(l.category, []);
    map.get(l.category)!.push(l);
  }
  return map;
}
