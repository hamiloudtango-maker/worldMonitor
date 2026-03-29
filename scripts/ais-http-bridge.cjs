#!/usr/bin/env node
/**
 * Maritime HTTP bridge — merges AISStream (live terrestrial) + GFW (satellite fishing events).
 * Serves all positions via GET /vessels.
 *
 * Usage:
 *   AISSTREAM_API_KEY=xxx GFW_TOKEN=yyy node scripts/ais-http-bridge.cjs
 *
 * Frontend polls: GET http://localhost:3005/vessels
 */
const http = require('http');
const https = require('https');
const { WebSocket } = require('ws');

// Load .env from project root
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');
try {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const AISSTREAM_KEY = process.env.AISSTREAM_API_KEY || '';
const GFW_TOKEN = process.env.GFW_TOKEN || '';
const PORT = process.env.AIS_PORT || 3005;
const MAX_VESSELS = 100000;
const CACHE_FILE = path.join(__dirname, '..', 'data', 'ais-gfw-cache.json');

const vessels = new Map();

// ═══ Disk persistence — save/load GFW data ═══

function loadCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    let loaded = 0;
    for (let i = 0; i < (data.vessels || []).length; i++) {
      const v = data.vessels[i];
      if (v.source && v.source !== 'aisstream') {
        vessels.set(`gfw_${v.id}_${v.source}_${i}`, v);
        loaded++;
      }
    }
    console.log(`[Cache] Loaded ${loaded} GFW positions from disk (saved ${data.savedAt || '?'})`);
    return loaded;
  } catch { return 0; }
}

function saveCache() {
  try {
    const gfwOnly = [...vessels.values()].filter(v => v.source !== 'aisstream');
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ savedAt: new Date().toISOString(), count: gfwOnly.length, vessels: gfwOnly }));
    console.log(`[Cache] Saved ${gfwOnly.length} GFW positions to disk`);
  } catch (e) { console.warn('[Cache] Save error:', e.message); }
}

// ═══════════════════════════════════════════════════════════════
// AISStream — Live terrestrial AIS (WebSocket)
// ═══════════════════════════════════════════════════════════════

function connectAIS() {
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  ws.on('open', () => {
    console.log('[AIS] Connected to AISStream');
    ws.send(JSON.stringify({
      Apikey: AISSTREAM_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    }));
  });
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      const meta = msg.MetaData;
      const pos = msg.Message?.PositionReport;
      if (meta?.latitude != null && meta?.longitude != null) {
        vessels.set(`ais_${meta.MMSI}`, {
          id: String(meta.MMSI),
          name: (meta.ShipName || '').trim(),
          lat: meta.latitude,
          lon: meta.longitude,
          heading: pos?.TrueHeading || 0,
          speed: pos?.Sog || 0,
          source: 'aisstream',
          ts: Date.now(),
        });
      }
    } catch {}
  });
  ws.on('close', () => { console.log('[AIS] Disconnected, reconnecting in 5s...'); setTimeout(connectAIS, 5000); });
  ws.on('error', (e) => console.warn('[AIS] Error:', e.message));
}

// ═══════════════════════════════════════════════════════════════
// Global Fishing Watch — Satellite AIS events (REST polling)
// Covers ocean areas that AISStream terrestrial can't reach
// ═══════════════════════════════════════════════════════════════

function fetchJSON(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 400) { reject(new Error(`GFW HTTP ${res.statusCode}: ${body.slice(0, 200)}`)); return; }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GFW timeout')); });
  });
}

// Fetch into a SEPARATE buffer, not into vessels directly
async function fetchGFWEventsInto(buffer, eventType, datasetId) {
  if (!GFW_TOKEN) return;
  try {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    let offset = 0;
    let totalAdded = 0;
    const PAGE = 1000;
    const MAX_PAGES = 20;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=${datasetId}&start-date=${start}&end-date=${end}&limit=${PAGE}&offset=${offset}`;
      const data = await fetchJSON(url, GFW_TOKEN);
      const events = data.entries || [];

      for (const ev of events) {
        if (ev.position?.lat != null && ev.position?.lon != null) {
          const id = ev.vessel?.ssvid || ev.id;
          buffer.set(`gfw_${id}_${ev.type}_${ev.start}`, {
            id: id,
            name: ev.vessel?.name || `GFW ${eventType}`,
            lat: ev.position.lat,
            lon: ev.position.lon,
            heading: 0,
            speed: ev.fishing?.averageSpeedKnots || 0,
            source: `gfw_${eventType}`,
            ts: new Date(ev.end || ev.start).getTime(),
          });
          totalAdded++;
        }
      }

      if (events.length < PAGE) break;
      offset += PAGE;
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`[GFW] ${eventType}: ${totalAdded} positions fetched`);
  } catch (e) {
    console.warn(`[GFW] ${eventType} error:`, e.message);
  }
}

async function pollGFW() {
  if (!GFW_TOKEN) return;
  console.log('[GFW] Fetching into buffer (30 days, parallel)...');

  // Fetch into a temp buffer — old data stays live
  const buffer = new Map();
  await Promise.all([
    fetchGFWEventsInto(buffer, 'port_visit', 'public-global-port-visits-events:latest'),
    fetchGFWEventsInto(buffer, 'encounters', 'public-global-encounters-events:latest'),
    fetchGFWEventsInto(buffer, 'loitering', 'public-global-loitering-events:latest'),
    fetchGFWEventsInto(buffer, 'gap', 'public-global-gaps-events:latest'),
  ]);

  if (buffer.size === 0) {
    console.warn('[GFW] Fetch returned 0 results, keeping old data');
    return;
  }

  // Atomic swap: remove old GFW, insert new
  for (const key of [...vessels.keys()]) {
    if (key.startsWith('gfw_')) vessels.delete(key);
  }
  for (const [k, v] of buffer) vessels.set(k, v);

  console.log(`[GFW] Swapped: ${buffer.size} new positions. Total: ${vessels.size}`);
}

// ═══════════════════════════════════════════════════════════════
// Eviction — remove stale positions
// ═══════════════════════════════════════════════════════════════

function evict() {
  const now = Date.now();
  const aisCutoff = now - 30 * 60 * 1000;      // AISStream: 30 min (live)
  const gfwCutoff = now - 7 * 24 * 3600 * 1000; // GFW: 7 jours (agrégé, poll quotidien)

  for (const [key, v] of vessels) {
    const cutoff = v.source === 'aisstream' ? aisCutoff : gfwCutoff;
    if (v.ts < cutoff) vessels.delete(key);
  }

  // Hard cap
  if (vessels.size > MAX_VESSELS) {
    const sorted = [...vessels.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < vessels.size - MAX_VESSELS; i++) vessels.delete(sorted[i][0]);
  }
}

// ═══════════════════════════════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/vessels') {
    const list = [...vessels.values()].map(v => ({
      mmsi: v.id, name: v.name, lat: v.lat, lon: v.lon,
      heading: v.heading, speed: v.speed, source: v.source,
    }));
    res.end(JSON.stringify({ vessels: list, count: list.length }));
  } else if (req.url === '/stats') {
    const bySource = {};
    for (const v of vessels.values()) bySource[v.source] = (bySource[v.source] || 0) + 1;
    res.end(JSON.stringify({ total: vessels.size, bySource }));
  } else {
    res.statusCode = 404;
    res.end('{"error":"not found"}');
  }
});

server.listen(PORT, () => {
  console.log(`[Bridge] HTTP server on http://localhost:${PORT}/vessels`);
  console.log(`[Bridge] AISStream: ${AISSTREAM_KEY ? 'configured' : 'MISSING KEY'}`);
  console.log(`[Bridge] GFW: ${GFW_TOKEN ? 'configured' : 'no token (set GFW_TOKEN for satellite coverage)'}`);

  connectAIS();

  // Load GFW cache from disk — skip fetch if fresh (<24h)
  const cachedCount = loadCache();
  if (GFW_TOKEN) {
    let cacheAge = Infinity;
    try {
      const stat = fs.statSync(CACHE_FILE);
      cacheAge = Date.now() - stat.mtimeMs;
    } catch {}

    if (cachedCount > 0 && cacheAge < 24 * 3600 * 1000) {
      console.log(`[GFW] Cache is fresh (${Math.round(cacheAge / 3600000)}h old, ${cachedCount} positions). Skipping fetch.`);
    } else {
      console.log(`[GFW] Cache ${cachedCount === 0 ? 'empty' : `stale (${Math.round(cacheAge / 3600000)}h)`}. Fetching...`);
      setTimeout(async () => { await pollGFW(); saveCache(); }, 5000);
    }
    // Re-fetch + save once per day
    setInterval(async () => { await pollGFW(); saveCache(); }, 24 * 3600 * 1000);
  }
});

// Evict stale positions every 5 minutes
setInterval(evict, 5 * 60 * 1000);

// Stats every 30s
setInterval(() => {
  const bySource = {};
  for (const v of vessels.values()) bySource[v.source] = (bySource[v.source] || 0) + 1;
  const parts = Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`[Bridge] ${vessels.size} vessels (${parts})`);
}, 30000);
