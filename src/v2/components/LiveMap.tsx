import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, ChevronDown, ChevronRight } from 'lucide-react';
import type { Article } from '@/v2/lib/constants';
import { LAYER_DEFS, getLayersByCategory, type LayerDef } from '@/v2/lib/map-layers';
import { api } from '@/v2/lib/api';

const COORDS: Record<string, [number, number]> = {
  US:[39.8,-98.5],FR:[46.6,2.2],UA:[48.4,31.2],RU:[61.5,105.3],CN:[35.9,104.2],
  IR:[32.4,53.7],IL:[31,34.8],DE:[51.2,10.4],GB:[55.4,-3.4],JP:[36.2,138.3],
  IN:[20.6,79],BR:[-14.2,-51.9],TR:[38.9,35.2],SA:[23.9,45.1],KR:[35.9,127.8],
  AU:[-25.3,133.8],CA:[56.1,-106.3],KP:[40.3,127.5],PS:[31.9,35.2],PH:[12.9,122],
  NL:[52.1,5.3],ES:[40.5,-3.7],IT:[41.9,12.6],PL:[51.9,19.1],SE:[60.1,18.6],
  NO:[60.5,8.5],MX:[23.6,-102.6],EG:[26.8,30.8],NG:[9.1,8.7],ZA:[-30.6,22.9],
  TW:[23.7,121],SY:[34.8,39],IQ:[33.2,43.7],AF:[33.9,67.7],SD:[12.9,30.2],
  YE:[15.6,48.5],LB:[33.9,35.9],PK:[30.4,69.3],TH:[15.9,100.9],VN:[14.1,108.3],
  MY:[4.2,101.9],ID:[-0.8,113.9],MM:[21.9,96],ET:[9.1,40.5],KE:[-0.02,37.9],
  CO:[4.6,-74.3],AR:[-38.4,-63.6],FI:[61.9,25.7],
};

// ─── SVG icons as data URIs (same approach as V1 DeckGLMap) ───
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2 L17.5 10 L17 12 L27 17 L27 19 L17 16 L17 24 L20 26.5 L20 28 L16 27 L12 28 L12 26.5 L15 24 L15 16 L5 19 L5 17 L15 12 L14.5 10 Z" fill="#60a5fa"/></svg>`;
const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 L14 8 L14 14 L18 18 L12 21 L6 18 L10 14 L10 8 Z" fill="#22d3ee"/></svg>`;

const LS_KEY = 'wm-map-layers';

function loadEnabled(): Set<string> {
  const validIds = new Set(LAYER_DEFS.map(l => l.id));
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      const saved: string[] = JSON.parse(s);
      const valid = saved.filter(id => validIds.has(id));
      if (valid.length > 0) return new Set(valid);
    }
  } catch {/**/}
  return new Set(LAYER_DEFS.filter(l => l.defaultOn).map(l => l.id));
}
function saveEnabled(set: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}

export default function LiveMap({ articles }: { articles: Article[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(loadEnabled);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [aisCount, setAisCount] = useState(0);
  const [flightCount, setFlightCount] = useState(0);
  const loadedRef = useRef<Set<string>>(new Set());
  // AIS and flights layers are self-managed by their effects

  const countryData = useMemo(() => {
    const m: Record<string, { count: number; crit: number; high: number }> = {};
    for (const a of articles) {
      for (const c of a.country_codes) {
        if (!m[c]) m[c] = { count: 0, crit: 0, high: 0 };
        m[c].count++;
        if (a.threat_level === 'critical') m[c].crit++;
        if (a.threat_level === 'high') m[c].high++;
      }
    }
    return m;
  }, [articles]);

  // ─── Register SVG images on map (returns promise) ───
  const registerIcons = useCallback(async (map: maplibregl.Map) => {
    const icons: [string, string, number][] = [
      ['plane-icon', PLANE_SVG, 32],
      ['ship-icon', SHIP_SVG, 24],
    ];
    await Promise.all(icons.map(([name, svg, size]) => new Promise<void>((resolve) => {
      if (map.hasImage(name)) { resolve(); return; }
      const img = new Image(size, size);
      img.onload = () => {
        if (!map.hasImage(name)) map.addImage(name, img, { sdf: false });
        resolve();
      };
      img.onerror = () => resolve(); // don't block on failure
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    })));
  }, []);

  // ─── Load a generic layer onto the map ───
  const loadLayer = useCallback(async (map: maplibregl.Map, layer: LayerDef) => {
    if (layer.id === 'flights' || layer.id === 'ais') return; // handled separately
    if (loadedRef.current.has(layer.id)) return;
    loadedRef.current.add(layer.id);

    let geojson: GeoJSON.FeatureCollection;
    try {
      if (layer.source.type === 'geo-api') {
        // Unified geo API — backend returns { features: [...], fetched_at, ... }
        const data = await api<any>(`/geo/v1/layers/${layer.source.layerId}`);
        geojson = { type: 'FeatureCollection', features: data.features || [] };
      } else if (layer.source.type === 'direct') {
        const resp = await fetch(layer.source.url, { signal: AbortSignal.timeout(15_000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        geojson = { type: 'FeatureCollection', features: layer.source.toFeatures(data) };
      } else {
        geojson = { type: 'FeatureCollection', features: [] };
      }
    } catch {
      loadedRef.current.delete(layer.id);
      return;
    }

    if (!map.getSource(`src_${layer.id}`)) {
      map.addSource(`src_${layer.id}`, { type: 'geojson', data: geojson });
    }

    if (layer.geometry === 'point') {
      map.addLayer({
        id: `lyr_${layer.id}`, type: 'circle', source: `src_${layer.id}`,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 5, 12, 8],
          'circle-color': layer.color,
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': layer.color + '60',
        },
      });
      map.on('click', `lyr_${layer.id}`, (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        const name = p.name || p.place || p.ip || '';
        const details = Object.entries(p).filter(([k]) => k !== 'name').slice(0, 3)
          .map(([k, v]) => `<span style="color:#94a3b8">${k}:</span> ${v}`).join('<br>');
        new maplibregl.Popup({ closeButton: false, className: 'wm-popup', maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-size:11px;color:#e2e8f0"><strong>${layer.icon} ${name}</strong>${details ? '<br>' + details : ''}</div>`)
          .addTo(map);
      });
      map.on('mouseenter', `lyr_${layer.id}`, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', `lyr_${layer.id}`, () => { map.getCanvas().style.cursor = ''; });
    } else {
      map.addLayer({
        id: `lyr_${layer.id}`, type: 'line', source: `src_${layer.id}`,
        paint: {
          'line-color': layer.color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 6, 1.5, 12, 3],
          'line-opacity': 0.6,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveEnabled(next);
      return next;
    });
  }, []);

  // ─── Init map ───
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8, name: 'Dark',
        sources: { tiles: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'], tileSize: 256 } },
        layers: [{ id: 'tiles', type: 'raster', source: 'tiles', minzoom: 0, maxzoom: 19 }],
      },
      center: [20, 25], zoom: 1.8, attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', async () => {
      await registerIcons(map);

      // Article heatmap (always on)
      const features = Object.entries(countryData)
        .filter(([c]) => COORDS[c])
        .map(([c, d]) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [COORDS[c]![1], COORDS[c]![0]] },
          properties: { count: d.count, crit: d.crit, high: d.high, code: c },
        }));

      map.addSource('pts', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.addLayer({
        id: 'heat', type: 'heatmap', source: 'pts', maxzoom: 8,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, 50, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)', 0.15, 'rgba(59,130,246,0.2)', 0.4, 'rgba(66,211,165,0.4)',
            0.65, 'rgba(249,115,22,0.55)', 0.85, 'rgba(239,68,68,0.7)', 1, 'rgba(239,68,68,0.9)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 25, 8, 55],
          'heatmap-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'circles', type: 'circle', source: 'pts', minzoom: 3,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 5, 10, 12, 50, 22, 100, 34],
          'circle-color': ['case', ['>', ['get', 'crit'], 0], '#ef4444', ['>', ['get', 'high'], 0], '#f97316', '#3b82f6'],
          'circle-opacity': 0.55,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['case', ['>', ['get', 'crit'], 0], '#ef444460', ['>', ['get', 'high'], 0], '#f9731660', '#3b82f660'],
        },
      });
      map.on('click', 'circles', (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        new maplibregl.Popup({ closeButton: false, className: 'wm-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-size:12px;color:#e2e8f0"><strong>${p.code}</strong> — ${p.count} docs${p.crit > 0 ? `<br><span style="color:#ef4444">${p.crit} critical</span>` : ''}${p.high > 0 ? `<br><span style="color:#f97316">${p.high} high</span>` : ''}</div>`)
          .addTo(map);
      });
      map.on('mouseenter', 'circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'circles', () => { map.getCanvas().style.cursor = ''; });

      // flights + ais are heatmaps managed by their own effects

      // Load enabled layers
      for (const layer of LAYER_DEFS) {
        if (enabled.has(layer.id)) loadLayer(map, layer);
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loadedRef.current.clear(); };
  }, []); // eslint-disable-line

  // ─── React to layer toggle (generic layers only, flights+ais have own effects) ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    for (const layer of LAYER_DEFS) {
      if (layer.id === 'flights' || layer.id === 'ais') {
        // Toggle both heatmap + dots layers
        const vis = enabled.has(layer.id) ? 'visible' : 'none';
        if (map.getLayer(`lyr_${layer.id}`)) map.setLayoutProperty(`lyr_${layer.id}`, 'visibility', vis);
        if (map.getLayer(`lyr_${layer.id}_dots`)) map.setLayoutProperty(`lyr_${layer.id}_dots`, 'visibility', vis);
        continue;
      }
      const layerId = `lyr_${layer.id}`;
      if (enabled.has(layer.id)) {
        if (loadedRef.current.has(layer.id)) {
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'visible');
        } else {
          loadLayer(map, layer);
        }
      } else {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    }
  }, [enabled, loadLayer]);

  // ─── Heatmap helper: create source + heatmap layer + circle layer for zoom ───
  // ─── Heatmap: blue (low density) → red (high density), soft gradient ───
  const ensureHeatLayer = useCallback((map: maplibregl.Map, id: string, features: GeoJSON.Feature[]) => {
    const srcId = `src_${id}`;
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    if (!map.getSource(srcId)) {
      map.addSource(srcId, { type: 'geojson', data: fc });
      map.addLayer({
        id: `lyr_${id}`, type: 'heatmap', source: srcId,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 3, 1, 6, 2, 10, 4, 14, 6],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.08, 'rgba(25,50,120,0.15)',
            0.2,  'rgba(40,100,180,0.3)',
            0.35, 'rgba(55,155,195,0.4)',
            0.5,  'rgba(80,195,140,0.48)',
            0.65, 'rgba(180,210,50,0.55)',
            0.8,  'rgba(225,150,35,0.62)',
            0.92, 'rgba(210,70,25,0.68)',
            1,    'rgba(160,20,20,0.75)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 3, 8, 6, 14, 10, 22, 14, 35],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 16, 0.3],
        },
      });
      // Petits dots discrets au zoom élevé
      map.addLayer({
        id: `lyr_${id}_dots`, type: 'circle', source: srcId, minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2.5, 16, 4],
          'circle-color': 'rgba(100,160,220,0.6)',
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 0.3, 14, 0.6],
        },
      });
    } else {
      (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(fc);
    }
  }, []);

  // ─── Aviation heatmap: OpenSky via Vite proxy ───
  const flightsEnabled = enabled.has('flights');
  useEffect(() => {
    if (!flightsEnabled) return;
    let cancelled = false;

    const fetchFlights = async () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      try {
        const resp = await fetch('/api/opensky/states/all', { signal: AbortSignal.timeout(12_000) });
        if (!resp.ok) return;
        const data = await resp.json();
        const features = (data.states || [])
          .filter((s: any[]) => s[5] != null && s[6] != null && !s[8])
          .map((s: any[]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [Number(s[5]), Number(s[6])] },
            properties: { w: 1 },
          }));
        if (cancelled) return;
        setFlightCount(features.length);
        ensureHeatLayer(map, 'flights', features);
      } catch {/**/}
    };

    const t = setTimeout(() => { if (!cancelled) fetchFlights(); }, 1500);
    const id = setInterval(fetchFlights, 30_000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(id); };
  }, [flightsEnabled, ensureHeatLayer]);

  // ─── Maritime heatmap: AIS bridge HTTP poll ───
  const aisEnabled = enabled.has('ais');
  useEffect(() => {
    if (!aisEnabled) { setAisCount(0); return; }
    let cancelled = false;

    const fetchAis = async () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      try {
        const resp = await fetch('http://localhost:3005/vessels', { signal: AbortSignal.timeout(8_000) });
        if (!resp.ok) return;
        const data = await resp.json();
        const vessels: any[] = data.vessels || [];
        if (cancelled) return;
        setAisCount(vessels.length);
        const features = vessels.map((v: any) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [v.lon, v.lat] },
          properties: { w: 1 },
        }));
        ensureHeatLayer(map, 'ais', features);
      } catch {/**/}
    };

    const t = setTimeout(() => { if (!cancelled) fetchAis(); }, 1500);
    const id = setInterval(fetchAis, 10_000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(id); };
  }, [aisEnabled, ensureHeatLayer]);

  const categories = useMemo(() => getLayersByCategory(), []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden relative">
      <div ref={ref} className="w-full h-full" />

      {/* Layer toggle button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/90 backdrop-blur text-white text-[11px] font-semibold rounded-lg border border-white/10 hover:bg-slate-800/90 transition-colors"
      >
        <Layers size={13} />
        Layers
        <span className="text-[9px] bg-white/15 px-1.5 py-0.5 rounded-full">{enabled.size}</span>
      </button>

      {/* Live counters */}
      <div className="absolute top-2 right-10 z-10 flex gap-1.5">
        {enabled.has('flights') && flightCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-900/80 backdrop-blur rounded-lg text-[10px] text-blue-400 font-semibold border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            ✈️ {flightCount}
          </div>
        )}
        {enabled.has('ais') && aisCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-900/80 backdrop-blur rounded-lg text-[10px] text-cyan-400 font-semibold border border-cyan-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            🚢 {aisCount}
          </div>
        )}
      </div>

      {/* Layer panel */}
      {showPanel && (
        <div className="absolute top-10 left-2 z-10 w-56 max-h-[70%] overflow-y-auto bg-slate-900/95 backdrop-blur-lg rounded-xl border border-white/10 shadow-2xl text-white">
          <div className="px-3 py-2 border-b border-white/5 flex justify-between items-center">
            <span className="text-[11px] font-bold">Couches de données</span>
            <span className="text-[9px] text-slate-400">{enabled.size}/{LAYER_DEFS.length}</span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {[...categories.entries()].map(([cat, layers]) => {
              const isCollapsed = collapsed.has(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => setCollapsed(prev => {
                      const n = new Set(prev);
                      if (n.has(cat)) n.delete(cat); else n.add(cat);
                      return n;
                    })}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                    {cat}
                    <span className="ml-auto text-[8px] text-slate-500">{layers.filter(l => enabled.has(l.id)).length}/{layers.length}</span>
                  </button>
                  {!isCollapsed && layers.map(l => (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={enabled.has(l.id)}
                        onChange={() => toggle(l.id)}
                        className="accent-emerald-500 w-3 h-3"
                      />
                      <span className="text-[12px]">{l.icon}</span>
                      <span className="text-[10px] text-slate-300 flex-1">{l.label}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
