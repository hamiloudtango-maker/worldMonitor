# server-py/app/domains/ai_feeds/seed.py
"""
RSS source catalog — ~300 sources.
Unified seed data for the rss_catalog DB table.
"""


_SOURCES: list[dict] = [
    # ── Wire Services (Tier 1) ──────────────────────────────────
    {"name": "Reuters", "url": "https://www.reutersagency.com/feed/", "lang": "en", "tier": 1, "source_type": "wire", "country": "UK", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "AP News", "url": "https://rsshub.app/apnews/topics/apf-topnews", "lang": "en", "tier": 1, "source_type": "wire", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Xinhua", "url": "https://rsshub.app/xinhuanet/english", "lang": "en", "tier": 1, "source_type": "wire", "country": "Chine", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "TASS", "url": "https://tass.com/rss/v2.xml", "lang": "en", "tier": 2, "source_type": "wire", "country": "Russie", "continent": "Europe", "tags": ["Actualites"]},

    # ── Major Outlets (Tier 2) ──────────────────────────────────
    {"name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "UK", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "BBC Business", "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Finance"]},
    {"name": "BBC Tech", "url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Tech"]},
    {"name": "Guardian World", "url": "https://www.theguardian.com/world/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "UK", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "CNN World", "url": "https://rss.cnn.com/rss/edition_world.rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Le Monde", "url": "https://www.lemonde.fr/rss/une.xml", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Le Monde Eco", "url": "https://www.lemonde.fr/economie/rss_full.xml", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Finance"]},
    {"name": "Deutsche Welle (EN)", "url": "https://rss.dw.com/rdf/rss-en-all", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Allemagne", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "France 24 (EN)", "url": "https://www.france24.com/en/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Al Jazeera (EN)", "url": "https://www.aljazeera.com/xml/rss/all.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Qatar", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "PBS", "url": "https://www.pbs.org/newshour/feeds/rss/headlines", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "RFI", "url": "https://www.rfi.fr/fr/rss", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Liberation", "url": "https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-une/", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Spiegel Int", "url": "https://www.spiegel.de/international/index.rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Allemagne", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "NHK World", "url": "https://www3.nhk.or.jp/rss/news/cat0.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Japon", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Inde", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Haaretz", "url": "https://www.haaretz.com/cmlink/1.628765", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Israel", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "Middle East Eye", "url": "https://www.middleeasteye.net/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Politico", "url": "https://rss.politico.com/politics-news.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Actualites"]},

    # ── Tech (Tier 2-3) ─────────────────────────────────────────
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},
    {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},
    {"name": "Wired", "url": "https://www.wired.com/feed/rss", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},
    {"name": "MIT Tech Review", "url": "https://www.technologyreview.com/feed/", "lang": "en", "tier": 2, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["AI"]},
    {"name": "Hacker News", "url": "https://hnrss.org/frontpage", "lang": "en", "tier": 4, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Tech"]},

    # ── Finance (Tier 1-3) ──────────────────────────────────────
    {"name": "Financial Times", "url": "https://www.ft.com/rss/home/uk", "lang": "en", "tier": 1, "source_type": "market", "country": "UK", "continent": "Europe", "tags": ["Finance"]},
    {"name": "WSJ", "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "US", "continent": "Amerique du Nord", "tags": ["Finance"]},
    {"name": "CNBC", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "lang": "en", "tier": 2, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "tags": ["Finance"]},
    {"name": "MarketWatch", "url": "https://feeds.marketwatch.com/marketwatch/topstories/", "lang": "en", "tier": 2, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "tags": ["Finance"]},
    {"name": "Investing.com", "url": "https://www.investing.com/rss/news.rss", "lang": "en", "tier": 2, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "tags": ["Finance"]},

    # ── Government (Tier 2) ─────────────────────────────────────
    {"name": "White House", "url": "https://www.whitehouse.gov/feed/", "lang": "en", "tier": 2, "source_type": "gov", "country": "US", "continent": "Amerique du Nord", "tags": ["Gouvernement"]},
    {"name": "UN News", "url": "https://news.un.org/feed/subscribe/en/news/all/rss.xml", "lang": "en", "tier": 2, "source_type": "gov", "country": "International", "continent": "International", "tags": ["Gouvernement"]},

    # ── Defense/Intel (Tier 2-3) ────────────────────────────────
    {"name": "Jane's Defence", "url": "https://www.janes.com/feeds/news", "lang": "en", "tier": 2, "source_type": "intel", "country": "UK", "continent": "Europe", "tags": ["Defense"]},
    {"name": "Defense One", "url": "https://www.defenseone.com/rss/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "tags": ["Defense"]},
    {"name": "The War Zone", "url": "https://www.thedrive.com/the-war-zone/feed", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "tags": ["Defense"]},
    {"name": "War on the Rocks", "url": "https://warontherocks.com/feed/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "tags": ["Defense"]},
    {"name": "CSIS", "url": "https://www.csis.org/analysis/feed", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "tags": ["Thinktank"]},
    {"name": "Brookings", "url": "https://www.brookings.edu/feed/", "lang": "en", "tier": 3, "source_type": "intel", "country": "US", "continent": "Amerique du Nord", "tags": ["Thinktank"]},

    # ── Cyber (Tier 2-3) ────────────────────────────────────────
    {"name": "CISA Alerts", "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml", "lang": "en", "tier": 2, "source_type": "gov", "country": "US", "continent": "Amerique du Nord", "tags": ["Cyber"]},
    {"name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Cyber"]},
    {"name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Cyber"]},
    {"name": "BleepingComputer", "url": "https://www.bleepingcomputer.com/feed/", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Cyber"]},
    {"name": "Dark Reading", "url": "https://www.darkreading.com/rss.xml", "lang": "en", "tier": 3, "source_type": "tech", "country": "US", "continent": "Amerique du Nord", "tags": ["Cyber"]},

    # ── Energy (Tier 3) ─────────────────────────────────────────
    {"name": "OilPrice", "url": "https://oilprice.com/rss/main", "lang": "en", "tier": 3, "source_type": "market", "country": "US", "continent": "Amerique du Nord", "tags": ["Energie"]},
    {"name": "Rigzone", "url": "https://www.rigzone.com/news/rss/rigzone_latest.aspx", "lang": "en", "tier": 3, "source_type": "specialty", "country": "US", "continent": "Amerique du Nord", "tags": ["Energie"]},

    # ── Maritime (Tier 3) ───────────────────────────────────────
    {"name": "gCaptain", "url": "https://gcaptain.com/feed/", "lang": "en", "tier": 3, "source_type": "specialty", "country": "US", "continent": "Amerique du Nord", "tags": ["Maritime"]},
    {"name": "Splash247", "url": "https://splash247.com/feed/", "lang": "en", "tier": 3, "source_type": "specialty", "country": "Singapour", "continent": "Asie", "tags": ["Maritime"]},

    # ── Climate (Tier 3) ────────────────────────────────────────
    {"name": "Carbon Brief", "url": "https://www.carbonbrief.org/feed", "lang": "en", "tier": 3, "source_type": "specialty", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Climat"]},
    {"name": "Climate Home", "url": "https://www.climatechangenews.com/feed/", "lang": "en", "tier": 3, "source_type": "specialty", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Climat"]},

    # ── Country Sources ─────────────────────────────────────────
    {"name": "TOLOnews", "url": "https://tolonews.com/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Afghanistan", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "News24", "url": "http://feeds.news24.com/articles/news24/TopStories/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Afrique du Sud", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Albanian Daily News", "url": "https://albaniandailynews.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Albanie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "TSA Algerie", "url": "https://www.tsa-algerie.com/feed/", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Algerie", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Arab News", "url": "https://www.arabnews.com/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Arabie Saoudite", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "Clarin", "url": "https://www.clarin.com/rss/lo-ultimo/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Argentine", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "Armenpress", "url": "https://armenpress.am/eng/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Armenie", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "ABC News Australia", "url": "https://www.abc.net.au/news/feed/45910/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Australie", "continent": "Oceanie", "tags": ["Actualites"]},
    {"name": "Der Standard", "url": "https://www.derstandard.at/rss", "lang": "de", "tier": 3, "source_type": "mainstream", "country": "Autriche", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Trend News Agency", "url": "https://en.trend.az/feeds/index.rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Azerbaidjan", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Bahrain News Agency", "url": "https://www.bna.bh/en/rss/", "lang": "en", "tier": 3, "source_type": "gov", "country": "Bahrein", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "The Daily Star BD", "url": "https://www.thedailystar.net/frontpage/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bangladesh", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Le Soir", "url": "https://www.lesoir.be/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Belgique", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Belta", "url": "https://eng.belta.by/rss", "lang": "en", "tier": 3, "source_type": "gov", "country": "Bielorussie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "El Deber", "url": "https://eldeber.com.bo/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Bolivie", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "Sarajevo Times", "url": "https://sarajevotimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bosnie-Herzegovine", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "G1 Globo", "url": "https://g1.globo.com/rss/g1/", "lang": "pt", "tier": 2, "source_type": "mainstream", "country": "Bresil", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "Borneo Bulletin", "url": "https://borneobulletin.com.bn/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Brunei", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Novinite", "url": "https://www.novinite.com/rss/news.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Bulgarie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Khmer Times", "url": "https://www.khmertimeskh.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Cambodge", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Cameroon Tribune", "url": "https://www.cameroon-tribune.cm/rss.xml", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Cameroun", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "CBC News", "url": "https://www.cbc.ca/cmlink/rss-topstories", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Canada", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "La Tercera", "url": "https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Chili", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "South China Morning Post", "url": "https://www.scmp.com/rss/91/feed", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Chine", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Cyprus Mail", "url": "https://cyprus-mail.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Chypre", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "El Tiempo", "url": "https://www.eltiempo.com/rss", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Colombie", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "Yonhap (EN)", "url": "https://en.yna.co.kr/RSS/news.xml", "lang": "en", "tier": 2, "source_type": "wire", "country": "Coree du Sud", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Tico Times", "url": "https://ticotimes.net/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Costa Rica", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Fraternite Matin", "url": "https://www.fratmat.info/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Cote d Ivoire", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Index.hr", "url": "https://www.index.hr/rss", "lang": "hr", "tier": 3, "source_type": "mainstream", "country": "Croatie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Granma (EN)", "url": "https://en.granma.cu/feed", "lang": "en", "tier": 3, "source_type": "gov", "country": "Cuba", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Copenhagen Post", "url": "https://cphpost.dk/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Danemark", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Al Ahram (EN)", "url": "https://english.ahram.org.eg/RSS.aspx", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Egypte", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Gulf News", "url": "https://gulfnews.com/rss/top-stories", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Emirats Arabes Unis", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "El Comercio Ecuador", "url": "https://www.elcomercio.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Equateur", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "El Pais", "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "lang": "es", "tier": 2, "source_type": "mainstream", "country": "Espagne", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "ERR News", "url": "https://news.err.ee/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Estonie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Borkena", "url": "https://borkena.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ethiopie", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Fiji Times", "url": "https://www.fijitimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Fidji", "continent": "Oceanie", "tags": ["Actualites"]},
    {"name": "Yle (EN)", "url": "https://yle.fi/uutiset/rss/uutiset.rss?osasto=news", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Finlande", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Agenda.ge", "url": "https://agenda.ge/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Georgie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Graphic Online", "url": "https://www.graphic.com.gh/news.feed?type=rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ghana", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Ekathimerini (EN)", "url": "https://www.ekathimerini.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Grece", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Prensa Libre", "url": "https://www.prensalibre.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Guatemala", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "La Prensa Honduras", "url": "https://www.laprensa.hn/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Honduras", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Hungary Today", "url": "https://hungarytoday.hu/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Hongrie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "The Hindu", "url": "https://www.thehindu.com/news/national/feeder/default.rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Inde", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Jakarta Post", "url": "https://www.thejakartapost.com/news/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Indonesie", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Shafaq News", "url": "https://shafaq.com/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Irak", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "Tehran Times", "url": "https://www.tehrantimes.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Iran", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "RTE News", "url": "https://www.rte.ie/news/rss/news-headlines.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Irlande", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Iceland Monitor", "url": "https://icelandmonitor.mbl.is/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Islande", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Jerusalem Post", "url": "https://www.jpost.com/rss/rssfeed.aspx?id=15", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Israel", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "ANSA", "url": "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml", "lang": "it", "tier": 2, "source_type": "wire", "country": "Italie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Jamaica Gleaner", "url": "https://jamaica-gleaner.com/feed/rss.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Jamaique", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "The Japan Times", "url": "https://www.japantimes.co.jp/feed/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Japon", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Jordan Times", "url": "https://jordantimes.com/rss/all.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Jordanie", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "Astana Times", "url": "https://astanatimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Kazakhstan", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Daily Nation", "url": "https://nation.africa/service/search/kenya/290754?query=&sortByDate=true&wsRC=1&wsRSS=1", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Kenya", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "KUNA", "url": "https://www.kuna.net.kw/RssLatestNews.aspx?Language=en", "lang": "en", "tier": 3, "source_type": "wire", "country": "Koweit", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "LSM", "url": "https://eng.lsm.lv/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Lettonie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "L'Orient-Le Jour", "url": "https://www.lorientlejour.com/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Liban", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "LRT", "url": "https://www.lrt.lt/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Lituanie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "RTL Today", "url": "https://today.rtl.lu/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Luxembourg", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "MIA", "url": "https://mia.mk/en/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Macedoine du Nord", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "The Star Malaysia", "url": "https://www.thestar.com.my/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Malaisie", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Times of Malta", "url": "https://timesofmalta.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Malte", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Le Matin", "url": "https://lematin.ma/express/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Maroc", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "L'Express Maurice", "url": "https://lexpress.mu/rss", "lang": "fr", "tier": 3, "source_type": "mainstream", "country": "Maurice", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "El Universal", "url": "https://www.eluniversal.com.mx/rss.xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Mexique", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "IPN Moldova", "url": "https://www.ipn.md/en/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Moldavie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Montsame", "url": "https://montsame.mn/en/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Mongolie", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Irrawaddy", "url": "https://www.irrawaddy.com/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Myanmar", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Namibian", "url": "https://www.namibian.com.na/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Namibie", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Kathmandu Post", "url": "https://kathmandupost.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Nepal", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Vanguard Nigeria", "url": "https://www.vanguardngr.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Nigeria", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Aftenposten", "url": "https://www.aftenposten.no/rss", "lang": "no", "tier": 3, "source_type": "mainstream", "country": "Norvege", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "NZ Herald", "url": "https://www.nzherald.co.nz/arc/outboundfeeds/rss/news/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Nouvelle-Zelande", "continent": "Oceanie", "tags": ["Actualites"]},
    {"name": "Times of Oman", "url": "https://timesofoman.com/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Oman", "continent": "Moyen-Orient", "tags": ["Actualites"]},
    {"name": "Daily Monitor Uganda", "url": "https://www.monitor.co.ug/uganda/news/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Ouganda", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Dawn", "url": "https://www.dawn.com/feeds/home/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Pakistan", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "La Prensa Panama", "url": "https://www.prensa.com/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Panama", "continent": "Amerique du Nord", "tags": ["Actualites"]},
    {"name": "Post Courier PNG", "url": "https://postcourier.com.pg/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Papouasie-Nouvelle-Guinee", "continent": "Oceanie", "tags": ["Actualites"]},
    {"name": "ABC Color", "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Paraguay", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "DutchNews (EN)", "url": "https://www.dutchnews.nl/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Pays-Bas", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Andina", "url": "https://andina.pe/rss/rss.aspx", "lang": "es", "tier": 3, "source_type": "wire", "country": "Perou", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "Inquirer", "url": "https://www.inquirer.net/fullfeed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Philippines", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Warsaw Voice", "url": "http://www.warsawvoice.pl/rss/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Pologne", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "RTP", "url": "https://www.rtp.pt/noticias/rss", "lang": "pt", "tier": 3, "source_type": "mainstream", "country": "Portugal", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Prague Morning", "url": "https://www.praguemorning.cz/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Republique Tcheque", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Romania Insider", "url": "https://www.romania-insider.com/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Roumanie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Moscow Times (EN)", "url": "https://www.themoscowtimes.com/rss/news", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Russie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "The New Times Rwanda", "url": "https://www.newtimes.co.rw/feed", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Rwanda", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Agence de Presse Senegalaise", "url": "https://aps.sn/feed/", "lang": "fr", "tier": 3, "source_type": "wire", "country": "Senegal", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "B92 (EN)", "url": "https://www.b92.net/eng/rss/vesti.xml", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Serbie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Channel News Asia", "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Singapour", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Spectator Slovakia", "url": "https://spectator.sme.sk/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Slovaquie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "STA Slovenia", "url": "https://english.sta.si/rss", "lang": "en", "tier": 3, "source_type": "wire", "country": "Slovenie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Daily Mirror Sri Lanka", "url": "https://www.dailymirror.lk/rss/1", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Sri Lanka", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Local Sweden", "url": "https://feeds.thelocal.com/rss/se", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Suede", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "RTS Suisse", "url": "https://www.rts.ch/info/rss", "lang": "fr", "tier": 2, "source_type": "mainstream", "country": "Suisse", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Focus Taiwan", "url": "https://focustaiwan.tw/rss/news/all", "lang": "en", "tier": 3, "source_type": "wire", "country": "Taiwan", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "The Citizen Tanzania", "url": "https://www.thecitizen.co.tz/tanzania/news/rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Tanzanie", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "Bangkok Post", "url": "https://www.bangkokpost.com/rss/data/topstories.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Thailande", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Hurriyet Daily News (EN)", "url": "https://www.hurriyetdailynews.com/rss.aspx", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Turquie", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "Kyiv Independent", "url": "https://kyivindependent.com/feed/", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Ukraine", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "El Pais Uruguay", "url": "https://www.elpais.com.uy/rss/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Uruguay", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "El Nacional Venezuela", "url": "https://www.elnacional.com/feed/", "lang": "es", "tier": 3, "source_type": "mainstream", "country": "Venezuela", "continent": "Amerique du Sud", "tags": ["Actualites"]},
    {"name": "VNExpress (EN)", "url": "https://e.vnexpress.net/rss/news.rss", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Vietnam", "continent": "Asie", "tags": ["Actualites"]},
    {"name": "Lusaka Times", "url": "https://www.lusakatimes.com/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Zambie", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "The Herald Zimbabwe", "url": "https://www.herald.co.zw/feed/", "lang": "en", "tier": 3, "source_type": "mainstream", "country": "Zimbabwe", "continent": "Afrique", "tags": ["Actualites"]},
    {"name": "BBC UK", "url": "http://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "Royaume-Uni", "continent": "Europe", "tags": ["Actualites"]},
    {"name": "EuroNews", "url": "https://www.euronews.com/rss", "lang": "en", "tier": 2, "source_type": "mainstream", "country": "France", "continent": "Europe", "tags": ["Actualites"]},
]


async def seed_catalog(db) -> int:
    """Insert builtin sources into rss_catalog table. Skips existing URLs."""
    from sqlalchemy import select
    from app.models.ai_feed import RssCatalogEntry

    result = await db.execute(select(RssCatalogEntry.url))
    existing_urls = {row[0] for row in result.all()}

    inserted = 0
    for src in _SOURCES:
        if src["url"] not in existing_urls:
            entry = RssCatalogEntry(
                url=src["url"],
                name=src["name"],
                lang=src.get("lang", "en"),
                tier=src.get("tier", 3),
                source_type=src.get("source_type"),
                country=src.get("country"),
                continent=src.get("continent"),
                tags=src.get("tags", []),
                origin="builtin",
            )
            db.add(entry)
            inserted += 1

    if inserted:
        await db.commit()
    return inserted
