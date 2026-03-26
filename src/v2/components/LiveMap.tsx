import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Article } from '@/v2/lib/constants';

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

export default function LiveMap({ articles }: { articles: Article[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    map.on('load', () => {
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
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  return <div ref={ref} className="w-full h-full rounded-xl overflow-hidden" />;
}
