"""
Pre-built RSS source catalog for WorldMonitor.
These feeds are publicly available and cover major world news outlets.
"""

RSS_CATALOG = [
    # Major international
    {"name": "BBC World",        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",           "category": "news",     "lang": "en"},
    {"name": "BBC Business",     "url": "https://feeds.bbci.co.uk/news/business/rss.xml",        "category": "economic", "lang": "en"},
    {"name": "BBC Tech",         "url": "https://feeds.bbci.co.uk/news/technology/rss.xml",      "category": "tech",     "lang": "en"},
    {"name": "Guardian World",   "url": "https://www.theguardian.com/world/rss",                 "category": "news",     "lang": "en"},
    {"name": "Al Jazeera",       "url": "https://www.aljazeera.com/xml/rss/all.xml",             "category": "news",     "lang": "en"},
    {"name": "NPR News",        "url": "https://feeds.npr.org/1001/rss.xml",                    "category": "news",     "lang": "en"},
    {"name": "Reuters World",    "url": "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best", "category": "news", "lang": "en"},
    {"name": "AP News",          "url": "https://rsshub.app/apnews/topics/apf-topnews",         "category": "news",     "lang": "en"},

    # French
    {"name": "Le Monde",        "url": "https://www.lemonde.fr/rss/une.xml",                    "category": "news",     "lang": "fr"},
    {"name": "Le Monde Éco",    "url": "https://www.lemonde.fr/economie/rss_full.xml",          "category": "economic", "lang": "fr"},
    {"name": "France24 FR",     "url": "https://www.france24.com/fr/rss",                       "category": "news",     "lang": "fr"},
    {"name": "France24 EN",     "url": "https://www.france24.com/en/rss",                       "category": "news",     "lang": "en"},
    {"name": "RFI",             "url": "https://www.rfi.fr/fr/rss",                             "category": "news",     "lang": "fr"},
    {"name": "Libération",      "url": "https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-une/", "category": "news", "lang": "fr"},

    # German
    {"name": "DW News",         "url": "https://rss.dw.com/rdf/rss-en-all",                    "category": "news",     "lang": "en"},
    {"name": "Spiegel Int",     "url": "https://www.spiegel.de/international/index.rss",        "category": "news",     "lang": "en"},

    # Tech
    {"name": "Ars Technica",    "url": "https://feeds.arstechnica.com/arstechnica/index",       "category": "tech",     "lang": "en"},
    {"name": "TechCrunch",      "url": "https://techcrunch.com/feed/",                          "category": "tech",     "lang": "en"},
    {"name": "The Verge",       "url": "https://www.theverge.com/rss/index.xml",                "category": "tech",     "lang": "en"},
    {"name": "Wired",           "url": "https://www.wired.com/feed/rss",                        "category": "tech",     "lang": "en"},

    # Security & Defense
    {"name": "Defense One",     "url": "https://www.defenseone.com/rss/",                       "category": "military", "lang": "en"},
    {"name": "The War Zone",    "url": "https://www.thedrive.com/the-war-zone/feed",            "category": "military", "lang": "en"},
    {"name": "CSIS",            "url": "https://www.csis.org/analysis/feed",                    "category": "diplomatic", "lang": "en"},

    # Economic & Finance
    {"name": "FT",              "url": "https://www.ft.com/rss/home",                           "category": "economic", "lang": "en"},
    {"name": "MarketWatch",     "url": "https://feeds.marketwatch.com/marketwatch/topstories/",  "category": "economic", "lang": "en"},
    {"name": "Investing.com",   "url": "https://www.investing.com/rss/news.rss",                "category": "economic", "lang": "en"},

    # Regional
    {"name": "TASS",            "url": "https://tass.com/rss/v2.xml",                           "category": "news",     "lang": "en"},
    {"name": "Xinhua",          "url": "https://rsshub.app/xinhuanet/english",                  "category": "news",     "lang": "en"},
    {"name": "NHK World",       "url": "https://www3.nhk.or.jp/rss/news/cat0.xml",             "category": "news",     "lang": "en"},
    {"name": "Times of India",  "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "category": "news", "lang": "en"},
    {"name": "Haaretz",         "url": "https://www.haaretz.com/cmlink/1.628765",               "category": "news",     "lang": "en"},
    {"name": "Middle East Eye", "url": "https://www.middleeasteye.net/rss",                     "category": "news",     "lang": "en"},

    # Cyber & Infosec
    {"name": "Krebs Security",  "url": "https://krebsonsecurity.com/feed/",                     "category": "cyber",    "lang": "en"},
    {"name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews",           "category": "cyber",    "lang": "en"},
    {"name": "BleepingComputer","url": "https://www.bleepingcomputer.com/feed/",                "category": "cyber",    "lang": "en"},
    {"name": "Dark Reading",    "url": "https://www.darkreading.com/rss.xml",                   "category": "cyber",    "lang": "en"},

    # Maritime & Energy
    {"name": "gCaptain",        "url": "https://gcaptain.com/feed/",                            "category": "maritime", "lang": "en"},
    {"name": "Splash247",       "url": "https://splash247.com/feed/",                           "category": "maritime", "lang": "en"},
    {"name": "Rigzone",         "url": "https://www.rigzone.com/news/rss/rigzone_latest.aspx",  "category": "energy",   "lang": "en"},

    # Climate & Environment
    {"name": "Carbon Brief",    "url": "https://www.carbonbrief.org/feed",                      "category": "climate",  "lang": "en"},
    {"name": "Climate Home",    "url": "https://www.climatechangenews.com/feed/",               "category": "climate",  "lang": "en"},
]
