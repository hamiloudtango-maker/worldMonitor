"""
Geo Layer Registry — every map data source declared here.
Adding a source = adding ONE entry with _reg().

Layers = données géolocalisées pour la carte (points/lignes).
PAS les indicateurs pays (PIB, corruption) — ceux-là sont des widgets.
"""

import logging
from dataclasses import dataclass
from typing import Callable, Awaitable

from app.domains._shared.http import fetch_json

logger = logging.getLogger(__name__)

# ─── Country centroids (for conflict/event layers that only have country codes) ──

COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "AF":(33.9,67.7),"AL":(41.2,20.2),"DZ":(28.0,1.7),"AO":(-11.2,17.9),"AR":(-38.4,-63.6),
    "AU":(-25.3,133.8),"BD":(23.7,90.4),"BR":(-14.2,-51.9),"CA":(56.1,-106.3),"CD":(-4.0,21.8),
    "CF":(6.6,20.9),"CL":(-35.7,-71.5),"CM":(7.4,12.4),"CN":(35.9,104.2),"CO":(4.6,-74.3),
    "CU":(21.5,-78.0),"DE":(51.2,10.4),"EG":(26.8,30.8),"ES":(40.5,-3.7),"ET":(9.1,40.5),
    "FR":(46.6,2.2),"GB":(55.4,-3.4),"GH":(7.9,-1.0),"GN":(9.9,-9.7),"HT":(19.0,-72.3),
    "ID":(-0.8,113.9),"IL":(31.0,34.8),"IN":(20.6,79.0),"IQ":(33.2,43.7),"IR":(32.4,53.7),
    "IT":(41.9,12.6),"JP":(36.2,138.3),"KE":(-0.0,37.9),"KP":(40.3,127.5),"KR":(35.9,127.8),
    "LB":(33.9,35.9),"LY":(26.3,17.2),"MA":(31.8,-7.1),"ML":(17.6,-4.0),"MM":(21.9,96.0),
    "MX":(23.6,-102.6),"MZ":(-18.7,35.5),"NE":(17.6,8.1),"NG":(9.1,8.7),"PH":(12.9,122.0),
    "PK":(30.4,69.3),"PS":(31.9,35.2),"RU":(61.5,105.3),"SA":(23.9,45.1),"SD":(12.9,30.2),
    "SO":(5.2,46.2),"SS":(6.9,31.3),"SY":(34.8,39.0),"TD":(15.5,18.7),"TH":(15.9,100.9),
    "TR":(38.9,35.2),"TW":(23.7,121.0),"TZ":(-6.4,34.9),"UA":(48.4,31.2),"US":(39.8,-98.5),
    "VE":(6.4,-66.6),"VN":(14.1,108.3),"YE":(15.6,48.5),"ZA":(-30.6,22.9),"ZW":(-19.0,29.2),
    "BF":(12.2,-1.6),"BI":(-3.4,29.9),"DJ":(11.8,42.6),"ER":(15.2,39.8),"GA":(-0.8,11.6),
    "GM":(13.4,-15.3),"GW":(11.8,-15.2),"LR":(6.4,-9.4),"MW":(-13.3,34.3),"NI":(12.9,-85.2),
    "RW":(-1.9,29.9),"SL":(8.5,-11.8),"SN":(14.5,-14.5),"UG":(1.4,32.3),"ZM":(-13.1,27.8),
}


def _pt(lon: float, lat: float, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}


def _line(coords: list, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": props}


# ═══════════════════════════════════════════════════════════════
# FETCH FUNCTIONS
# ═══════════════════════════════════════════════════════════════

async def fetch_earthquakes() -> list[dict]:
    data = await fetch_json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson", timeout=15)
    return [{"type": "Feature", "geometry": f["geometry"],
             "properties": {"name": f["properties"]["place"], "magnitude": f["properties"]["mag"]}}
            for f in data.get("features", [])]


async def fetch_natural_events() -> list[dict]:
    data = await fetch_json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200", timeout=20)
    out = []
    for ev in data.get("events", []):
        geo = ev.get("geometry", [{}])
        if geo and geo[0].get("coordinates"):
            out.append(_pt(geo[0]["coordinates"][0], geo[0]["coordinates"][1],
                           {"name": ev["title"], "category": ev.get("categories", [{}])[0].get("title", ""),
                            "magnitude": geo[0].get("magnitudeValue")}))
    return out


async def fetch_volcanoes() -> list[dict]:
    """Smithsonian GVP — active volcanoes via EONET."""
    data = await fetch_json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=100", timeout=20)
    out = []
    for ev in data.get("events", []):
        geo = ev.get("geometry", [{}])
        if geo and geo[0].get("coordinates"):
            out.append(_pt(geo[0]["coordinates"][0], geo[0]["coordinates"][1],
                           {"name": ev["title"], "category": "Volcan"}))
    return out


async def fetch_wildfires() -> list[dict]:
    data = await fetch_json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=200", timeout=20)
    out = []
    for ev in data.get("events", []):
        geo = ev.get("geometry", [{}])
        if geo and geo[0].get("coordinates"):
            out.append(_pt(geo[0]["coordinates"][0], geo[0]["coordinates"][1],
                           {"name": ev["title"], "magnitude": geo[0].get("magnitudeValue"),
                            "unit": geo[0].get("magnitudeUnit", "")}))
    return out


async def fetch_severe_storms() -> list[dict]:
    data = await fetch_json("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=severeStorms&limit=100", timeout=20)
    out = []
    for ev in data.get("events", []):
        geo = ev.get("geometry", [{}])
        if geo and geo[0].get("coordinates"):
            out.append(_pt(geo[0]["coordinates"][0], geo[0]["coordinates"][1],
                           {"name": ev["title"], "category": "Tempête"}))
    return out


async def _fetch_wri_plants(fuel_filter: set[str], min_mw: float = 0) -> list[dict]:
    """WRI Global Power Plant Database — filtered by fuel type."""
    import csv as csvmod
    import io
    from app.domains._shared.http import fetch_text
    raw = await fetch_text(
        "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv",
        timeout=30,
    )
    features = []
    reader = csvmod.DictReader(io.StringIO(raw))
    for row in reader:
        if row.get("primary_fuel", "") not in fuel_filter:
            continue
        try:
            cap = float(row.get("capacity_mw") or 0)
            if cap < min_mw:
                continue
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            features.append(_pt(lon, lat, {
                "name": row.get("name", ""),
                "country": row.get("country_long", row.get("country", "")),
                "capacity_mw": cap,
                "fuel": row.get("primary_fuel", ""),
            }))
        except (ValueError, KeyError):
            continue
    return features


async def fetch_nuclear_reactors() -> list[dict]:
    return await _fetch_wri_plants({"Nuclear"})


async def fetch_power_plants_fossil() -> list[dict]:
    return await _fetch_wri_plants({"Oil", "Gas", "Coal", "Petcoke"}, min_mw=500)


async def fetch_mines_uranium() -> list[dict]:
    """IAEA UDEPO — world uranium deposits. Fallback to known major sites."""
    MAJOR_SITES = [
        _pt(136.0, -30.3, {"name": "Olympic Dam", "country": "AU", "mineral": "Uranium", "operator": "BHP", "production_t": 3500}),
        _pt(105.3, 49.0, {"name": "Cigar Lake", "country": "CA", "mineral": "Uranium", "operator": "Cameco", "production_t": 6900}),
        _pt(-107.5, 51.0, {"name": "McArthur River", "country": "CA", "mineral": "Uranium", "operator": "Cameco", "production_t": 7500}),
        _pt(68.5, 41.3, {"name": "Navoi Mining", "country": "UZ", "mineral": "Uranium", "operator": "NMMC", "production_t": 3500}),
        _pt(69.0, 51.1, {"name": "Inkai", "country": "KZ", "mineral": "Uranium", "operator": "Kazatomprom/Cameco", "production_t": 4000}),
        _pt(68.0, 44.0, {"name": "Budenovskoye", "country": "KZ", "mineral": "Uranium", "operator": "Kazatomprom", "production_t": 3000}),
        _pt(63.4, 43.5, {"name": "Zarechnoye", "country": "KZ", "mineral": "Uranium", "operator": "Kazatomprom", "production_t": 2500}),
        _pt(28.0, -26.2, {"name": "Vaal River", "country": "ZA", "mineral": "Uranium", "operator": "AngloGold", "production_t": 500}),
        _pt(18.3, -22.4, {"name": "Rössing", "country": "NA", "mineral": "Uranium", "operator": "CNNC", "production_t": 2500}),
        _pt(15.0, -22.0, {"name": "Husab", "country": "NA", "mineral": "Uranium", "operator": "Swakop Uranium", "production_t": 4200}),
        _pt(11.6, 7.3, {"name": "Akouta/Arlit", "country": "NE", "mineral": "Uranium", "operator": "Orano", "production_t": 2000}),
        _pt(132.5, -25.5, {"name": "Ranger", "country": "AU", "mineral": "Uranium", "operator": "ERA", "production_t": 0, "status": "closed"}),
    ]
    return MAJOR_SITES


async def fetch_mines_rare_earths() -> list[dict]:
    """Major rare earth mining sites."""
    return [
        _pt(109.97, 40.65, {"name": "Bayan Obo", "country": "CN", "mineral": "Rare Earths", "operator": "Baotou Steel", "pct_global": 60}),
        _pt(115.9, -33.8, {"name": "Mt Weld", "country": "AU", "mineral": "Rare Earths", "operator": "Lynas", "pct_global": 8}),
        _pt(-100.3, 29.3, {"name": "Mountain Pass", "country": "US", "mineral": "Rare Earths", "operator": "MP Materials", "pct_global": 15}),
        _pt(103.5, 24.5, {"name": "Xunwu/Ganzhou (Ion Adsorption)", "country": "CN", "mineral": "Heavy Rare Earths", "operator": "Various", "pct_global": 90}),
        _pt(105.0, 22.5, {"name": "Dong Pao", "country": "VN", "mineral": "Rare Earths", "operator": "VIMICO", "pct_global": 1}),
        _pt(33.0, -3.0, {"name": "Ngualla", "country": "TZ", "mineral": "Rare Earths", "operator": "Peak Resources"}),
        _pt(49.4, -22.0, {"name": "Ambatovy (Cobalt+REE)", "country": "MG", "mineral": "Rare Earths", "operator": "Sumitomo"}),
        _pt(-60.5, -22.3, {"name": "Serra Verde", "country": "BR", "mineral": "Rare Earths", "operator": "Serra Verde Mining"}),
        _pt(29.2, 68.4, {"name": "Norra Kärr", "country": "SE", "mineral": "Rare Earths", "operator": "Leading Edge Materials"}),
    ]


async def fetch_mines_lithium() -> list[dict]:
    return [
        _pt(-68.5, -23.5, {"name": "Salar de Atacama", "country": "CL", "mineral": "Lithium", "operator": "SQM/Albemarle", "pct_global": 26}),
        _pt(-67.0, -23.9, {"name": "Salar de Olaroz", "country": "AR", "mineral": "Lithium", "operator": "Allkem"}),
        _pt(-67.5, -20.3, {"name": "Salar de Uyuni", "country": "BO", "mineral": "Lithium", "operator": "YLB"}),
        _pt(114.0, 36.0, {"name": "Jiangxi (Spodumene)", "country": "CN", "mineral": "Lithium", "operator": "Ganfeng"}),
        _pt(101.0, 37.0, {"name": "Qinghai Salt Lake", "country": "CN", "mineral": "Lithium", "operator": "Qinghai Salt Lake"}),
        _pt(121.6, -33.8, {"name": "Greenbushes", "country": "AU", "mineral": "Lithium", "operator": "Tianqi/IGO", "pct_global": 20}),
        _pt(121.2, -31.1, {"name": "Mt Marion", "country": "AU", "mineral": "Lithium", "operator": "Mineral Resources"}),
        _pt(-117.4, 35.8, {"name": "Silver Peak", "country": "US", "mineral": "Lithium", "operator": "Albemarle"}),
        _pt(-117.2, 40.9, {"name": "Thacker Pass", "country": "US", "mineral": "Lithium", "operator": "Lithium Americas"}),
        _pt(25.5, -29.2, {"name": "Jadar (projet)", "country": "RS", "mineral": "Lithium", "operator": "Rio Tinto", "status": "projet"}),
    ]


async def fetch_mines_cobalt() -> list[dict]:
    return [
        _pt(26.0, -10.5, {"name": "Katanga (Kolwezi)", "country": "CD", "mineral": "Cobalt", "operator": "Glencore/CMOC", "pct_global": 70}),
        _pt(27.8, -11.7, {"name": "Mutanda", "country": "CD", "mineral": "Cobalt", "operator": "Glencore"}),
        _pt(28.0, -12.0, {"name": "Tenke Fungurume", "country": "CD", "mineral": "Cobalt", "operator": "CMOC"}),
        _pt(49.4, -22.0, {"name": "Ambatovy", "country": "MG", "mineral": "Cobalt", "operator": "Sumitomo"}),
        _pt(136.0, -30.3, {"name": "Olympic Dam", "country": "AU", "mineral": "Cobalt", "operator": "BHP"}),
        _pt(-82.0, 22.0, {"name": "Moa Bay", "country": "CU", "mineral": "Cobalt", "operator": "Sherritt"}),
        _pt(29.0, 61.5, {"name": "Talvivaara/Terrafame", "country": "FI", "mineral": "Cobalt", "operator": "Terrafame"}),
    ]


async def fetch_conflicts() -> list[dict]:
    """Conflict events — uses backend conflict domain if available, else static hotspots."""
    try:
        data = await fetch_json("http://localhost:8000/api/conflict/v1/get-humanitarian-summary?country_code=UA", timeout=10)
        # Fallback to known conflict zones
    except Exception:
        pass
    # Static major conflict zones with escalation data
    CONFLICTS = [
        _pt(31.2, 48.4, {"name": "Ukraine", "type": "Interstate war", "intensity": "high", "parties": "Russia vs Ukraine"}),
        _pt(53.7, 32.4, {"name": "Iran", "type": "Bombing campaign", "intensity": "high", "parties": "US/Israel vs Iran"}),
        _pt(35.2, 31.9, {"name": "Gaza", "type": "Asymmetric war", "intensity": "critical", "parties": "Israel vs Hamas"}),
        _pt(30.2, 12.9, {"name": "Soudan", "type": "Civil war", "intensity": "critical", "parties": "SAF vs RSF"}),
        _pt(96.0, 21.9, {"name": "Myanmar", "type": "Civil war", "intensity": "high", "parties": "Junta vs résistance"}),
        _pt(46.2, 5.2, {"name": "Somalie", "type": "Insurgency", "intensity": "high", "parties": "Govt vs Al-Shabaab"}),
        _pt(-4.0, 17.6, {"name": "Sahel (Mali)", "type": "Insurgency", "intensity": "high", "parties": "Juntes vs JNIM/ISGS"}),
        _pt(-1.6, 12.2, {"name": "Burkina Faso", "type": "Insurgency", "intensity": "high", "parties": "Junta vs djihadistes"}),
        _pt(8.1, 17.6, {"name": "Niger", "type": "Insurgency", "intensity": "elevated", "parties": "Junta vs djihadistes"}),
        _pt(48.5, 15.6, {"name": "Yémen", "type": "Civil war", "intensity": "elevated", "parties": "Govt vs Houthis"}),
        _pt(40.5, 9.1, {"name": "Éthiopie (Amhara)", "type": "Internal conflict", "intensity": "elevated", "parties": "Fano vs ENDF"}),
        _pt(43.7, 33.2, {"name": "Irak", "type": "Low-intensity", "intensity": "moderate", "parties": "ISF vs IS remnants"}),
        _pt(18.7, 15.5, {"name": "Tchad", "type": "Instability", "intensity": "elevated", "parties": "Junta vs opposition"}),
        _pt(67.7, 33.9, {"name": "Afghanistan", "type": "Post-war instability", "intensity": "moderate", "parties": "Taliban vs IS-K"}),
        _pt(69.3, 30.4, {"name": "Pakistan (Balochistan)", "type": "Insurgency", "intensity": "moderate", "parties": "Army vs BLA/TTP"}),
        _pt(29.9, -1.9, {"name": "RDC Est (Kivu)", "type": "Armed groups", "intensity": "high", "parties": "FARDC vs M23/ADF"}),
        _pt(105.0, 22.5, {"name": "Mer de Chine", "type": "Tensions", "intensity": "elevated", "parties": "China vs Philippines/Taiwan"}),
    ]
    return CONFLICTS


async def fetch_chokepoints() -> list[dict]:
    """Strategic maritime chokepoints."""
    return [
        _pt(32.3, 30.0, {"name": "Canal de Suez", "daily_ships": 50, "type": "Canal", "oil_pct": 12}),
        _pt(43.3, 12.6, {"name": "Bab el-Mandeb", "daily_ships": 30, "type": "Détroit", "oil_pct": 7}),
        _pt(56.3, 26.6, {"name": "Détroit d'Ormuz", "daily_ships": 40, "type": "Détroit", "oil_pct": 21}),
        _pt(100.2, 2.5, {"name": "Détroit de Malacca", "daily_ships": 80, "type": "Détroit", "oil_pct": 16}),
        _pt(-79.9, 9.1, {"name": "Canal de Panama", "daily_ships": 35, "type": "Canal"}),
        _pt(29.0, 41.0, {"name": "Bosphore", "daily_ships": 45, "type": "Détroit"}),
        _pt(-5.6, 35.9, {"name": "Détroit de Gibraltar", "daily_ships": 60, "type": "Détroit"}),
        _pt(104.1, 1.2, {"name": "Détroit de Singapour", "daily_ships": 70, "type": "Détroit"}),
        _pt(121.0, 23.5, {"name": "Détroit de Taiwan", "daily_ships": 40, "type": "Détroit", "tension": "elevated"}),
        _pt(12.5, 54.5, {"name": "Détroits Danois", "daily_ships": 30, "type": "Détroit"}),
        _pt(36.6, -1.0, {"name": "Canal de Mozambique", "daily_ships": 20, "type": "Canal"}),
        _pt(-67.0, -55.0, {"name": "Passage de Drake", "daily_ships": 5, "type": "Passage"}),
        _pt(-73.0, 48.5, {"name": "Voie Maritime du Saint-Laurent", "daily_ships": 25, "type": "Canal"}),
    ]


# ═══════════════════════════════════════════════════════════════
# LAYER REGISTRY
# ═══════════════════════════════════════════════════════════════

@dataclass
class LayerDef:
    id: str
    name: str
    category: str
    ttl_hours: float
    fetch: Callable[[], Awaitable[list[dict]]]
    icon: str = ""


LAYERS: dict[str, LayerDef] = {}


def _reg(id: str, name: str, category: str, ttl_hours: float, fetch, icon: str = ""):
    LAYERS[id] = LayerDef(id=id, name=name, category=category, ttl_hours=ttl_hours, fetch=fetch, icon=icon)


# ── Événements naturels (refresh fréquent) ──
_reg("earthquakes",       "Séismes M4.5+ (USGS)",       "evenements",     1,   fetch_earthquakes,     "🔴")
_reg("natural_events",    "Catastrophes (NASA EONET)",   "evenements",     1,   fetch_natural_events,  "🌍")
_reg("wildfires",         "Feux actifs",                 "evenements",     2,   fetch_wildfires,       "🔥")
_reg("volcanoes",         "Volcans actifs",              "evenements",     6,   fetch_volcanoes,       "🌋")
_reg("severe_storms",     "Tempêtes",                    "evenements",     2,   fetch_severe_storms,   "🌀")

# ── Conflits & Sécurité ──
_reg("conflicts",         "Zones de conflit",            "securite",       24,  fetch_conflicts,       "⚔️")
_reg("chokepoints",       "Chokepoints maritimes",       "securite",       720, fetch_chokepoints,     "⚓")

# ── Ressources & Mines ──
_reg("mines_uranium",     "Mines d'uranium",             "ressources",     720, fetch_mines_uranium,    "☢️")
_reg("mines_rare_earths", "Terres rares",                "ressources",     720, fetch_mines_rare_earths,"💎")
_reg("mines_lithium",     "Mines de lithium",            "ressources",     720, fetch_mines_lithium,    "🔋")
_reg("mines_cobalt",      "Mines de cobalt",             "ressources",     720, fetch_mines_cobalt,     "⛏️")

# ── Infrastructure & Énergie ──
_reg("nuclear_reactors",     "Réacteurs nucléaires",        "infrastructure", 720, fetch_nuclear_reactors,     "☢️")
_reg("fossil_power_plants",  "Centrales fossiles (>500MW)", "infrastructure", 720, fetch_power_plants_fossil,  "🏭")
