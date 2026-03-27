"""
Seed data for Intel Models — based on Feedly AI Models catalog.
Each model has: name, family, section, and initial aliases.
Aliases are enriched weekly by LLM from article metadata.
"""

INTEL_MODELS = [
    # ══════════════════════════════════════════════════════════════
    # FEED TEMPLATE CHIP1 — core topics for template-based feed creation
    # ══════════════════════════════════════════════════════════════
    {"name": "Conflits armes", "family": "risk", "section": "Political Risk", "aliases": ["armed conflict", "war", "military conflict", "guerre", "conflit armé", "Krieg", "bewaffneter Konflikt", "война", "вооружённый конфликт", "conflicto armado", "guerra"]},
    {"name": "Diplomatie", "family": "risk", "section": "Political Risk", "aliases": ["diplomacy", "diplomatic", "foreign affairs", "international relations", "affaires étrangères", "relations internationales", "Diplomatie", "дипломатия", "diplomacia"]},
    {"name": "Energie", "family": "market", "section": "Industries", "aliases": ["energy", "power", "electricity", "énergie", "électricité", "Energie", "Strom", "энергия", "energía"]},
    {"name": "Economie", "family": "market", "section": "Market Insights", "aliases": ["economy", "economic", "GDP", "growth", "recession", "économie", "croissance", "récession", "Wirtschaft", "экономика", "economía"]},
    {"name": "Nucleaire", "family": "market", "section": "Sustainability", "aliases": ["nuclear", "atomic", "nuclear energy", "nuclear weapon", "nucléaire", "atomique", "Kernenergie", "Atomwaffe", "ядерный", "nuclear"]},
    {"name": "Migrations", "family": "risk", "section": "Physical Risk", "aliases": ["migration", "refugee", "asylum", "displacement", "immigration", "réfugié", "demandeur d'asile", "déplacé", "Migration", "Flüchtling", "миграция", "беженец"]},
    {"name": "Terrorisme", "family": "risk", "section": "Physical Risk", "aliases": ["terrorism", "terrorist", "extremism", "radicalization", "terrorisme", "extrémisme", "radicalisation", "Terrorismus", "терроризм", "terrorismo"]},
    {"name": "Elections & Vote", "family": "risk", "section": "Political Risk", "aliases": ["election", "vote", "ballot", "polling", "scrutin", "élection", "Wahl", "выборы", "elección", "elections"]},
    {"name": "Ransomware Attack", "family": "threat", "section": "Malware Families", "aliases": ["ransomware", "ransom", "encryption attack", "rançongiciel", "Erpressungstrojaner", "вымогатель", "ransomware attack"]},
    {"name": "Threat Actor", "family": "threat", "section": "Threat Actors", "aliases": ["APT", "threat actor", "state-sponsored", "hacker group", "acteur de menace", "groupe de hackers", "Bedrohungsakteur", "группа угроз"]},
    {"name": "Vulnerabilite", "family": "threat", "section": "Vulnerabilities", "aliases": ["vulnerability", "CVE", "zero-day", "security flaw", "vulnérabilité", "faille", "Schwachstelle", "уязвимость", "vulnerabilidad"]},
    {"name": "Data Breach", "family": "threat", "section": "Threat Landscape", "aliases": ["data breach", "data leak", "breach", "leak", "fuite de données", "violation de données", "Datenleck", "утечка данных"]},
    {"name": "Armement", "family": "foundation", "section": "Industries", "aliases": ["armament", "weapons", "arms", "defense procurement", "armement", "armes", "Rüstung", "Waffen", "вооружение", "armamento"]},
    {"name": "Maritime", "family": "foundation", "section": "Industries", "aliases": ["maritime", "naval", "shipping", "sea", "navy", "marine", "Seefahrt", "морской", "marítimo"]},
    {"name": "Climat", "family": "market", "section": "Sustainability", "aliases": ["climate", "climate change", "global warming", "climat", "changement climatique", "réchauffement", "Klimawandel", "климат", "clima"]},
    {"name": "Catastrophes", "family": "risk", "section": "Physical Risk", "aliases": ["disaster", "natural disaster", "catastrophe", "earthquake", "flood", "séisme", "inondation", "Naturkatastrophe", "катастрофа", "desastre"]},
    {"name": "IA", "family": "market", "section": "Technologies", "aliases": ["AI", "artificial intelligence", "machine learning", "deep learning", "LLM", "intelligence artificielle", "künstliche Intelligenz", "искусственный интеллект", "inteligencia artificial"]},
    {"name": "Semi-conducteurs", "family": "foundation", "section": "Industries", "aliases": ["semiconductor", "chip", "microchip", "foundry", "wafer", "semi-conducteur", "puce", "Halbleiter", "полупроводник", "semiconductor"]},
    {"name": "Commodities", "family": "market", "section": "Market Insights", "aliases": ["commodity", "raw material", "matière première", "Rohstoff", "сырьё", "materia prima", "oil", "gold", "copper", "pétrole", "or", "cuivre"]},
    {"name": "Crypto & Blockchain", "family": "market", "section": "Technologies", "aliases": ["cryptocurrency", "Bitcoin", "Ethereum", "blockchain", "cryptomonnaie", "Kryptowährung", "криптовалюта", "criptomoneda", "crypto"]},
    {"name": "Politique monetaire", "family": "market", "section": "Market Insights", "aliases": ["monetary policy", "interest rate", "central bank", "Fed", "ECB", "politique monétaire", "taux d'intérêt", "banque centrale", "Geldpolitik", "Zinssatz"]},

    # ══════════════════════════════════════════════════════════════
    # MARKET INTELLIGENCE
    # ══════════════════════════════════════════════════════════════

    # ── Strategic Moves ──
    {"name": "Mergers & Acquisitions", "family": "market", "section": "Strategic Moves", "aliases": ["M&A", "merger", "acquisition", "takeover", "rachat", "fusion", "Übernahme", "OPA"]},
    {"name": "Funding Events", "family": "market", "section": "Strategic Moves", "aliases": ["funding round", "venture capital", "Series A", "Series B", "levée de fonds", "investissement", "Finanzierung"]},
    {"name": "Initial Public Offerings", "family": "market", "section": "Strategic Moves", "aliases": ["IPO", "listing", "introduction en bourse", "entrée en bourse", "Börsengang"]},
    {"name": "Partnerships", "family": "market", "section": "Strategic Moves", "aliases": ["partnership", "strategic alliance", "joint venture", "partenariat", "alliance stratégique"]},
    {"name": "Product Launches", "family": "market", "section": "Strategic Moves", "aliases": ["product launch", "new product", "release", "lancement produit", "nouveau produit", "Produkteinführung"]},
    {"name": "Layoffs", "family": "market", "section": "Strategic Moves", "aliases": ["layoff", "downsizing", "restructuring", "licenciements", "plan social", "Entlassungen"]},
    {"name": "Leadership Changes", "family": "market", "section": "Strategic Moves", "aliases": ["CEO change", "new CEO", "appointment", "nomination", "changement de direction"]},
    {"name": "Location Expansions", "family": "market", "section": "Strategic Moves", "aliases": ["expansion", "new office", "new facility", "opening", "expansion géographique"]},
    {"name": "New Deals", "family": "market", "section": "Strategic Moves", "aliases": ["deal", "contract", "agreement", "contrat", "accord", "Vertrag"]},
    {"name": "Hiring", "family": "market", "section": "Strategic Moves", "aliases": ["hiring", "recruitment", "talent acquisition", "recrutement", "embauche"]},
    {"name": "Fund Formation", "family": "market", "section": "Strategic Moves", "aliases": ["fund formation", "new fund", "fund launch", "création de fonds"]},
    {"name": "Organizational Initiatives", "family": "market", "section": "Strategic Moves", "aliases": ["organizational change", "initiative", "transformation", "restructuration"]},
    {"name": "Industry Awards", "family": "market", "section": "Strategic Moves", "aliases": ["award", "prize", "recognition", "prix", "récompense"]},

    # ── Innovation ──
    {"name": "New Patents", "family": "market", "section": "Innovation", "aliases": ["patent", "brevet", "intellectual property", "IP filing", "Patent"]},
    {"name": "Clinical Trials", "family": "market", "section": "Innovation", "aliases": ["clinical trial", "Phase I", "Phase II", "Phase III", "essai clinique"]},
    {"name": "Pilot Projects", "family": "market", "section": "Innovation", "aliases": ["pilot project", "proof of concept", "PoC", "projet pilote", "prototype"]},

    # ── Market Insights ──
    {"name": "Market Data", "family": "market", "section": "Market Insights", "aliases": ["market data", "market report", "données marché", "rapport de marché", "Marktdaten"]},
    {"name": "Revenue", "family": "market", "section": "Market Insights", "aliases": ["revenue", "earnings", "quarterly results", "chiffre d'affaires", "résultats", "Umsatz"]},
    {"name": "Market Share", "family": "market", "section": "Market Insights", "aliases": ["market share", "part de marché", "Marktanteil"]},
    {"name": "Consumer Insights", "family": "market", "section": "Market Insights", "aliases": ["consumer insight", "consumer behavior", "comportement consommateur"]},
    {"name": "Market Prices", "family": "market", "section": "Market Insights", "aliases": ["price", "pricing", "cost", "prix", "cours", "tarif"]},

    # ── Regulatory ──
    {"name": "Regulatory Approvals", "family": "market", "section": "Regulatory", "aliases": ["approval", "authorization", "clearance", "approbation", "autorisation", "homologation"]},
    {"name": "Regulatory Changes", "family": "market", "section": "Regulatory", "aliases": ["regulation", "new law", "policy change", "réglementation", "loi", "directive"]},

    # ── Technologies ──
    {"name": "Artificial Intelligence", "family": "market", "section": "Technologies", "aliases": ["AI", "machine learning", "deep learning", "LLM", "GPT", "intelligence artificielle", "IA", "KI"]},
    {"name": "AI Agents", "family": "market", "section": "Technologies", "aliases": ["AI agent", "autonomous agent", "agentic AI", "agent IA"]},
    {"name": "Quantum Computing", "family": "market", "section": "Technologies", "aliases": ["quantum", "qubit", "quantum computer", "informatique quantique", "Quantencomputer"]},
    {"name": "Autonomous Vehicles", "family": "market", "section": "Technologies", "aliases": ["self-driving", "autonomous car", "robotaxi", "véhicule autonome"]},
    {"name": "Cloud Computing", "family": "market", "section": "Technologies", "aliases": ["cloud", "SaaS", "PaaS", "IaaS", "AWS", "Azure", "GCP", "cloud computing"]},
    {"name": "Blockchain", "family": "market", "section": "Technologies", "aliases": ["blockchain", "distributed ledger", "Web3", "smart contract", "chaîne de blocs"]},
    {"name": "Crypto", "family": "market", "section": "Technologies", "aliases": ["cryptocurrency", "Bitcoin", "Ethereum", "crypto", "cryptomonnaie", "Kryptowährung"]},
    {"name": "Internet of Things", "family": "market", "section": "Technologies", "aliases": ["IoT", "connected devices", "smart devices", "objets connectés"]},
    {"name": "Robotics", "family": "market", "section": "Technologies", "aliases": ["robot", "robotics", "automation", "robotique", "Robotik"]},
    {"name": "Virtual Reality", "family": "market", "section": "Technologies", "aliases": ["VR", "virtual reality", "réalité virtuelle", "metaverse"]},
    {"name": "Augmented Reality", "family": "market", "section": "Technologies", "aliases": ["AR", "augmented reality", "réalité augmentée", "mixed reality"]},
    {"name": "Fintech", "family": "market", "section": "Technologies", "aliases": ["fintech", "financial technology", "neobank", "digital banking"]},
    {"name": "Deepfakes", "family": "market", "section": "Technologies", "aliases": ["deepfake", "synthetic media", "face swap", "hypertrucage"]},
    {"name": "Hypersonic", "family": "market", "section": "Technologies", "aliases": ["hypersonic", "Mach 5", "scramjet", "hypersonique", "Hyperschall"]},
    {"name": "Wearables", "family": "market", "section": "Technologies", "aliases": ["wearable", "smartwatch", "fitness tracker", "objets portables"]},

    # ── Sustainability ──
    {"name": "ESG", "family": "market", "section": "Sustainability", "aliases": ["ESG", "environmental social governance", "responsible investment", "investissement responsable"]},
    {"name": "Renewable Energy", "family": "market", "section": "Sustainability", "aliases": ["renewable", "clean energy", "énergie renouvelable", "erneuerbare Energie"]},
    {"name": "Solar Energy", "family": "market", "section": "Sustainability", "aliases": ["solar", "photovoltaic", "PV", "solaire", "Solarenergie"]},
    {"name": "Wind Energy", "family": "market", "section": "Sustainability", "aliases": ["wind", "wind farm", "offshore wind", "éolien", "Windenergie"]},
    {"name": "Nuclear Energy", "family": "market", "section": "Sustainability", "aliases": ["nuclear", "nuclear power", "nucléaire", "Kernenergie", "ядерная энергия"]},
    {"name": "Carbon Footprint", "family": "market", "section": "Sustainability", "aliases": ["carbon footprint", "CO2 emissions", "empreinte carbone", "émissions CO2"]},
    {"name": "Circular Economy", "family": "market", "section": "Sustainability", "aliases": ["circular economy", "recycling", "économie circulaire", "Kreislaufwirtschaft"]},
    {"name": "Energy Storage", "family": "market", "section": "Sustainability", "aliases": ["battery", "energy storage", "stockage énergie", "batteries", "Energiespeicher"]},

    # ── Trends ──
    {"name": "Digital Transformation", "family": "market", "section": "Trends", "aliases": ["digital transformation", "digitalization", "transformation numérique", "Digitalisierung"]},
    {"name": "Future of Work", "family": "market", "section": "Trends", "aliases": ["future of work", "remote work", "hybrid work", "télétravail", "travail hybride"]},
    {"name": "Privacy", "family": "market", "section": "Trends", "aliases": ["privacy", "data protection", "GDPR", "RGPD", "vie privée", "Datenschutz"]},
    {"name": "Diversity & Inclusion", "family": "market", "section": "Trends", "aliases": ["diversity", "inclusion", "DEI", "diversité", "inclusion", "Vielfalt"]},
    {"name": "Creator Economy", "family": "market", "section": "Trends", "aliases": ["creator economy", "influencer", "content creator", "économie des créateurs"]},

    # ── Industries (selection) ──
    {"name": "Automotive Industry", "family": "market", "section": "Industries", "aliases": ["automotive", "car industry", "automobile", "Automobilindustrie", "автомобильная промышленность"]},
    {"name": "Banking Industry", "family": "market", "section": "Industries", "aliases": ["banking", "bank", "financial services", "banque", "services financiers", "Bankwesen"]},
    {"name": "Defense Industry", "family": "market", "section": "Industries", "aliases": ["defense", "arms industry", "défense", "industrie de défense", "Rüstungsindustrie"]},
    {"name": "Energy Industry", "family": "market", "section": "Industries", "aliases": ["energy", "power", "utilities", "énergie", "Energiewirtschaft"]},
    {"name": "Healthcare Industry", "family": "market", "section": "Industries", "aliases": ["healthcare", "health", "medical", "santé", "Gesundheitswesen"]},
    {"name": "Mining Industry", "family": "market", "section": "Industries", "aliases": ["mining", "minerals", "extraction", "mines", "Bergbau"]},
    {"name": "Oil and Gas Industry", "family": "market", "section": "Industries", "aliases": ["oil", "gas", "petroleum", "pétrole", "gaz", "Öl und Gas"]},
    {"name": "Semiconductor Industry", "family": "market", "section": "Industries", "aliases": ["semiconductor", "chip", "foundry", "semi-conducteur", "puce", "Halbleiter"]},
    {"name": "Space Industry", "family": "market", "section": "Industries", "aliases": ["space", "aerospace", "satellite", "spatial", "aérospatial", "Raumfahrt"]},
    {"name": "Telecom Industry", "family": "market", "section": "Industries", "aliases": ["telecom", "5G", "6G", "télécommunications", "Telekommunikation"]},
    {"name": "Biopharma Industry", "family": "market", "section": "Industries", "aliases": ["biopharma", "pharmaceutical", "biotech", "pharma", "biopharmaceutique"]},
    {"name": "Real Estate Industry", "family": "market", "section": "Industries", "aliases": ["real estate", "property", "immobilier", "Immobilien"]},
    {"name": "Retail Industry", "family": "market", "section": "Industries", "aliases": ["retail", "e-commerce", "commerce de détail", "distribution", "Einzelhandel"]},
    {"name": "Maritime Industry", "family": "market", "section": "Industries", "aliases": ["maritime", "shipping", "transport maritime", "Schifffahrt"]},
    {"name": "Agriculture Industry", "family": "market", "section": "Industries", "aliases": ["agriculture", "farming", "agritech", "agroalimentaire", "Landwirtschaft"]},

    # ══════════════════════════════════════════════════════════════
    # THREAT INTELLIGENCE
    # ══════════════════════════════════════════════════════════════

    {"name": "Cyber Attacks", "family": "threat", "section": "Threat Landscape", "aliases": ["cyberattack", "hacking", "breach", "intrusion", "cyberattaque", "piratage", "Cyberangriff", "кибератака"]},
    {"name": "Ransomware", "family": "threat", "section": "Malware Families", "aliases": ["ransomware", "ransom", "encryption attack", "rançongiciel", "Erpressungstrojaner"]},
    {"name": "New Malware", "family": "threat", "section": "Malware Families", "aliases": ["malware", "trojan", "worm", "virus", "logiciel malveillant", "Schadsoftware"]},
    {"name": "Phishing", "family": "threat", "section": "Malware Families", "aliases": ["phishing", "spear phishing", "social engineering", "hameçonnage"]},
    {"name": "High Vulnerabilities", "family": "threat", "section": "Vulnerabilities", "aliases": ["CVE", "critical vulnerability", "zero-day", "0-day", "faille critique", "Schwachstelle"]},
    {"name": "Proof of Exploit", "family": "threat", "section": "Vulnerabilities", "aliases": ["exploit", "PoC", "proof of concept", "exploitation", "RCE", "remote code execution"]},
    {"name": "All Tactics & Techniques", "family": "threat", "section": "Tactics & Techniques", "aliases": ["MITRE ATT&CK", "TTP", "tactics techniques procedures", "kill chain"]},
    {"name": "Indicators of Compromise", "family": "threat", "section": "IoC", "aliases": ["IoC", "indicator of compromise", "C2", "command and control", "IP indicator", "hash indicator"]},
    {"name": "Threat Intelligence Reports", "family": "threat", "section": "Reports", "aliases": ["threat report", "CTI report", "threat brief", "rapport de menace"]},

    # ── Threat Actors ──
    {"name": "Fancy Bear / APT28", "family": "threat", "section": "Threat Actors", "aliases": ["Fancy Bear", "APT28", "GRU", "Sofacy", "Sednit", "Strontium"]},
    {"name": "Lazarus Group", "family": "threat", "section": "Threat Actors", "aliases": ["Lazarus", "DPRK hackers", "Hidden Cobra", "APT38", "Andariel"]},
    {"name": "APT29 / Cozy Bear", "family": "threat", "section": "Threat Actors", "aliases": ["Cozy Bear", "APT29", "SVR", "Nobelium", "Midnight Blizzard", "The Dukes"]},
    {"name": "Volt Typhoon", "family": "threat", "section": "Threat Actors", "aliases": ["Volt Typhoon", "BRONZE SILHOUETTE", "Chinese state hackers", "PRC cyber"]},
    {"name": "LockBit", "family": "threat", "section": "Threat Actors", "aliases": ["LockBit", "LockBit 3.0", "LockBit ransomware"]},
    {"name": "BlackCat / ALPHV", "family": "threat", "section": "Threat Actors", "aliases": ["BlackCat", "ALPHV", "Noberus"]},
    {"name": "Sandworm", "family": "threat", "section": "Threat Actors", "aliases": ["Sandworm", "Voodoo Bear", "IRIDIUM", "Seashell Blizzard"]},

    # ══════════════════════════════════════════════════════════════
    # RISK INTELLIGENCE
    # ══════════════════════════════════════════════════════════════

    {"name": "Elections", "family": "risk", "section": "Political Risk", "aliases": ["election", "vote", "ballot", "polling", "scrutin", "élection", "Wahl", "выборы"]},
    {"name": "Political Instability", "family": "risk", "section": "Political Risk", "aliases": ["coup", "political crisis", "instabilité politique", "coup d'état", "putsch"]},
    {"name": "Sanctions", "family": "risk", "section": "Political Risk", "aliases": ["sanctions", "embargo", "trade restrictions", "sanctions économiques", "Sanktionen"]},
    {"name": "Protests", "family": "risk", "section": "Physical Risk", "aliases": ["protest", "demonstration", "unrest", "manifestation", "Demonstration", "протест"]},
    {"name": "Violent Protests", "family": "risk", "section": "Physical Risk", "aliases": ["riot", "violent protest", "civil unrest", "émeute", "violence urbaine"]},
    {"name": "Terrorism", "family": "risk", "section": "Physical Risk", "aliases": ["terrorism", "terrorist attack", "terrorisme", "attentat", "Terrorismus", "терроризм"]},
    {"name": "Natural Disasters", "family": "risk", "section": "Physical Risk", "aliases": ["earthquake", "flood", "hurricane", "wildfire", "catastrophe naturelle", "Naturkatastrophe"]},

    # ══════════════════════════════════════════════════════════════
    # MUTE FILTERS (exclusion)
    # ══════════════════════════════════════════════════════════════

    {"name": "Sports", "family": "mute", "section": "Mute Filters", "aliases": ["sports", "football", "basketball", "soccer", "Olympics", "sport"]},
    {"name": "Job Postings", "family": "mute", "section": "Mute Filters", "aliases": ["job posting", "hiring", "career", "offre d'emploi", "recrutement"]},
    {"name": "Obituaries", "family": "mute", "section": "Mute Filters", "aliases": ["obituary", "death notice", "nécrologie", "décès"]},
    {"name": "Opinions", "family": "mute", "section": "Mute Filters", "aliases": ["opinion", "editorial", "op-ed", "tribune", "Meinung"]},
    {"name": "Listicles", "family": "mute", "section": "Mute Filters", "aliases": ["listicle", "top 10", "best of", "classement"]},
    {"name": "Tutorials", "family": "mute", "section": "Mute Filters", "aliases": ["tutorial", "how-to", "guide", "tutoriel", "Anleitung"]},
    {"name": "Discounts and Offers", "family": "mute", "section": "Mute Filters", "aliases": ["discount", "deal", "sale", "promo", "coupon", "réduction", "promotion"]},
    {"name": "Market Reports", "family": "mute", "section": "Mute Filters", "aliases": ["market report", "industry report", "forecast report", "rapport de marché"]},
    {"name": "Stock Analyses", "family": "mute", "section": "Mute Filters", "aliases": ["stock analysis", "stock pick", "analyst rating", "analyse boursière"]},
    {"name": "History", "family": "mute", "section": "Mute Filters", "aliases": ["history", "historical", "this day in history", "histoire"]},
    {"name": "Ratings", "family": "mute", "section": "Mute Filters", "aliases": ["rating", "review", "top rated", "best of", "classement"]},

    # ══════════════════════════════════════════════════════════════
    # FOUNDATION — Companies
    # ══════════════════════════════════════════════════════════════
    {"name": "Amazon", "family": "foundation", "section": "Companies", "aliases": ["AMZN", "Amazon.com", "AWS", "Amazon Web Services", "Jeff Bezos", "Andy Jassy"]},
    {"name": "Google", "family": "foundation", "section": "Companies", "aliases": ["GOOGL", "Alphabet", "Google LLC", "Sundar Pichai", "DeepMind", "YouTube"]},
    {"name": "Apple", "family": "foundation", "section": "Companies", "aliases": ["AAPL", "Apple Inc", "Apple Computer", "Tim Cook", "iPhone", "MacBook"]},
    {"name": "Microsoft", "family": "foundation", "section": "Companies", "aliases": ["MSFT", "Microsoft Corp", "Satya Nadella", "Azure", "Windows", "LinkedIn", "GitHub"]},
    {"name": "Tesla", "family": "foundation", "section": "Companies", "aliases": ["TSLA", "Tesla Inc", "Elon Musk", "Tesla Motors", "Gigafactory"]},
    {"name": "Meta", "family": "foundation", "section": "Companies", "aliases": ["META", "Facebook", "Meta Platforms", "Mark Zuckerberg", "Instagram", "WhatsApp"]},
    {"name": "NVIDIA", "family": "foundation", "section": "Companies", "aliases": ["NVDA", "Nvidia Corp", "Jensen Huang", "GPU", "CUDA", "H100", "Blackwell"]},
    {"name": "JPMorgan Chase", "family": "foundation", "section": "Companies", "aliases": ["JPM", "JP Morgan", "Jamie Dimon", "Chase Bank"]},
    {"name": "Walmart", "family": "foundation", "section": "Companies", "aliases": ["WMT", "Walmart Inc", "Walmart Stores"]},
    {"name": "Alibaba Group", "family": "foundation", "section": "Companies", "aliases": ["BABA", "Alibaba", "Alipay", "Ant Group", "Jack Ma", "阿里巴巴"]},
    {"name": "Samsung", "family": "foundation", "section": "Companies", "aliases": ["Samsung Electronics", "삼성", "Samsung Group"]},
    {"name": "TotalEnergies", "family": "foundation", "section": "Companies", "aliases": ["TTE", "Total", "TotalEnergies SE", "Total SA"]},
    {"name": "Shell", "family": "foundation", "section": "Companies", "aliases": ["SHEL", "Royal Dutch Shell", "Shell plc"]},
    {"name": "ExxonMobil", "family": "foundation", "section": "Companies", "aliases": ["XOM", "Exxon", "Mobil", "ExxonMobil Corp"]},
    {"name": "Lockheed Martin", "family": "foundation", "section": "Companies", "aliases": ["LMT", "Lockheed", "F-35", "Skunk Works"]},
    {"name": "Boeing", "family": "foundation", "section": "Companies", "aliases": ["BA", "Boeing Co", "737 MAX", "Boeing Defense"]},
    {"name": "Airbus", "family": "foundation", "section": "Companies", "aliases": ["AIR", "Airbus SE", "A320", "A350"]},
    {"name": "TSMC", "family": "foundation", "section": "Companies", "aliases": ["TSM", "Taiwan Semiconductor", "TSMC Ltd"]},
    {"name": "OpenAI", "family": "foundation", "section": "Companies", "aliases": ["OpenAI Inc", "Sam Altman", "ChatGPT", "GPT-4", "GPT-5"]},
    {"name": "Anthropic", "family": "foundation", "section": "Companies", "aliases": ["Anthropic PBC", "Claude", "Dario Amodei"]},
    {"name": "SpaceX", "family": "foundation", "section": "Companies", "aliases": ["Space Exploration Technologies", "Starlink", "Falcon 9", "Starship"]},
    {"name": "Huawei", "family": "foundation", "section": "Companies", "aliases": ["Huawei Technologies", "华为", "Ren Zhengfei"]},
    {"name": "ByteDance", "family": "foundation", "section": "Companies", "aliases": ["TikTok", "字节跳动", "Douyin"]},
    {"name": "Shopify", "family": "foundation", "section": "Companies", "aliases": ["SHOP", "Shopify Inc"]},
    {"name": "Block", "family": "foundation", "section": "Companies", "aliases": ["SQ", "Square", "Block Inc", "Cash App", "Jack Dorsey"]},
    {"name": "Pfizer", "family": "foundation", "section": "Companies", "aliases": ["PFE", "Pfizer Inc"]},
    {"name": "Moderna", "family": "foundation", "section": "Companies", "aliases": ["MRNA", "Moderna Inc", "mRNA"]},
    {"name": "Rheinmetall", "family": "foundation", "section": "Companies", "aliases": ["RHM", "Rheinmetall AG", "Leopard 2", "KNDS"]},
    {"name": "Thales", "family": "foundation", "section": "Companies", "aliases": ["HO", "Thales Group", "Thales SA"]},
    {"name": "Dassault", "family": "foundation", "section": "Companies", "aliases": ["Dassault Aviation", "Rafale", "Dassault Systèmes"]},
    {"name": "Orano", "family": "foundation", "section": "Companies", "aliases": ["Orano SA", "Areva", "uranium enrichment"]},
    {"name": "EDF", "family": "foundation", "section": "Companies", "aliases": ["Electricité de France", "EDF SA", "nuclear power France"]},

    # ── Company Lists ──
    {"name": "Fortune 500 Companies", "family": "foundation", "section": "Company Lists", "aliases": ["Fortune 500", "Fortune Global 500", "top companies"]},
    {"name": "Drug Manufacturing Companies", "family": "foundation", "section": "Company Lists", "aliases": ["pharma companies", "drug makers", "pharmaceutical manufacturers"]},
    {"name": "Luxury Companies", "family": "foundation", "section": "Company Lists", "aliases": ["luxury brands", "LVMH", "Kering", "Hermès", "Richemont"]},
    {"name": "Neobank Companies", "family": "foundation", "section": "Company Lists", "aliases": ["neobank", "digital bank", "Revolut", "N26", "Chime"]},
    {"name": "Renewable Energy Companies", "family": "foundation", "section": "Company Lists", "aliases": ["renewable companies", "solar companies", "wind companies", "clean energy"]},
    {"name": "Defense Contractors", "family": "foundation", "section": "Company Lists", "aliases": ["defense companies", "arms manufacturers", "military contractors", "industriels défense"]},
    {"name": "Big Tech", "family": "foundation", "section": "Company Lists", "aliases": ["GAFAM", "FAANG", "Big Tech", "Magnificent 7", "tech giants"]},

    # ── Industries (missing from previous seed) ──
    {"name": "Accounting Industry", "family": "foundation", "section": "Industries", "aliases": ["accounting", "audit", "Big Four", "comptabilité"]},
    {"name": "Advertising Industry", "family": "foundation", "section": "Industries", "aliases": ["advertising", "ad tech", "publicité", "Werbung"]},
    {"name": "Airline Industry", "family": "foundation", "section": "Industries", "aliases": ["airline", "aviation", "air transport", "compagnie aérienne", "Luftfahrt"]},
    {"name": "Beauty Industry", "family": "foundation", "section": "Industries", "aliases": ["beauty", "cosmetics", "skincare", "beauté", "cosmétique"]},
    {"name": "Beverage Industry", "family": "foundation", "section": "Industries", "aliases": ["beverage", "drinks", "soft drink", "boisson"]},
    {"name": "Chemical Industry", "family": "foundation", "section": "Industries", "aliases": ["chemical", "chemicals", "chimie", "Chemie"]},
    {"name": "Consulting Industry", "family": "foundation", "section": "Industries", "aliases": ["consulting", "management consulting", "McKinsey", "BCG", "conseil"]},
    {"name": "Consumer Electronics Industry", "family": "foundation", "section": "Industries", "aliases": ["consumer electronics", "gadgets", "électronique grand public"]},
    {"name": "Consumer Packaged Goods Industry", "family": "foundation", "section": "Industries", "aliases": ["CPG", "FMCG", "consumer goods", "biens de consommation"]},
    {"name": "Education Industry", "family": "foundation", "section": "Industries", "aliases": ["education", "edtech", "university", "éducation", "enseignement"]},
    {"name": "Fashion Industry", "family": "foundation", "section": "Industries", "aliases": ["fashion", "apparel", "clothing", "mode", "habillement"]},
    {"name": "Food Industry", "family": "foundation", "section": "Industries", "aliases": ["food", "food processing", "agroalimentaire", "Lebensmittel"]},
    {"name": "Gambling & Casino Industry", "family": "foundation", "section": "Industries", "aliases": ["gambling", "casino", "betting", "jeux d'argent"]},
    {"name": "Gaming Industry", "family": "foundation", "section": "Industries", "aliases": ["gaming", "video games", "esports", "jeux vidéo", "Spieleindustrie"]},
    {"name": "Insurance Industry", "family": "foundation", "section": "Industries", "aliases": ["insurance", "insurtech", "assurance", "Versicherung"]},
    {"name": "Legal Industry", "family": "foundation", "section": "Industries", "aliases": ["legal", "law firm", "legaltech", "juridique", "cabinet d'avocats"]},
    {"name": "Luxury Industry", "family": "foundation", "section": "Industries", "aliases": ["luxury", "premium", "haute couture", "luxe"]},
    {"name": "Manufacturing Industry", "family": "foundation", "section": "Industries", "aliases": ["manufacturing", "factory", "production", "industrie manufacturière"]},
    {"name": "Media & Entertainment Industry", "family": "foundation", "section": "Industries", "aliases": ["media", "entertainment", "streaming", "médias", "divertissement"]},
    {"name": "Medical Devices Industry", "family": "foundation", "section": "Industries", "aliases": ["medical devices", "medtech", "dispositifs médicaux"]},
    {"name": "Packaging Industry", "family": "foundation", "section": "Industries", "aliases": ["packaging", "emballage", "Verpackung"]},
    {"name": "Railway Industry", "family": "foundation", "section": "Industries", "aliases": ["railway", "railroad", "train", "ferroviaire", "Eisenbahn"]},
    {"name": "Supply Chain Industry", "family": "foundation", "section": "Industries", "aliases": ["supply chain", "logistics", "chaîne d'approvisionnement", "logistique"]},
    {"name": "Textile Industry", "family": "foundation", "section": "Industries", "aliases": ["textile", "fabric", "fiber", "textile", "Textilindustrie"]},
    {"name": "Travel & Hospitality Industry", "family": "foundation", "section": "Industries", "aliases": ["travel", "hospitality", "tourism", "tourisme", "hôtellerie"]},
    {"name": "Water Industry", "family": "foundation", "section": "Industries", "aliases": ["water", "water treatment", "eau", "Wasser"]},
    {"name": "Optics Industry", "family": "foundation", "section": "Industries", "aliases": ["optics", "optical", "photonics", "optique"]},
    {"name": "Polymer Industry", "family": "foundation", "section": "Industries", "aliases": ["polymer", "plastics", "polymère", "plastique"]},
    {"name": "Public Sector", "family": "foundation", "section": "Industries", "aliases": ["public sector", "government", "secteur public", "administration"]},
    {"name": "Personal Mobility Industry", "family": "foundation", "section": "Industries", "aliases": ["mobility", "e-scooter", "ride-hailing", "mobilité"]},
    {"name": "Pet Industry", "family": "foundation", "section": "Industries", "aliases": ["pet", "pet care", "animal", "animaux de compagnie"]},
    {"name": "Alcohol Industry", "family": "foundation", "section": "Industries", "aliases": ["alcohol", "spirits", "wine", "beer", "alcool", "Alkohol"]},
    {"name": "Eyewear Industry", "family": "foundation", "section": "Industries", "aliases": ["eyewear", "glasses", "sunglasses", "lunettes", "optique"]},
    {"name": "Luxury Fashion Industry", "family": "foundation", "section": "Industries", "aliases": ["luxury fashion", "haute couture", "designer", "mode de luxe"]},
    {"name": "Lodging Industry", "family": "foundation", "section": "Industries", "aliases": ["lodging", "hotel", "accommodation", "hébergement", "hôtel"]},
    {"name": "Professional Services Industry", "family": "foundation", "section": "Industries", "aliases": ["professional services", "consulting", "services professionnels"]},
    {"name": "Aviation Industry", "family": "foundation", "section": "Industries", "aliases": ["aviation", "aircraft", "aerospace", "aéronautique"]},

    # ══════════════════════════════════════════════════════════════
    # RISK INTELLIGENCE — additional models
    # ══════════════════════════════════════════════════════════════
    {"name": "Outages", "family": "risk", "section": "Outages", "aliases": ["outage", "service disruption", "downtime", "blackout", "panne", "coupure"]},
    {"name": "Election Interference", "family": "risk", "section": "Political Risk", "aliases": ["election interference", "election meddling", "voter fraud", "ingérence électorale"]},
    {"name": "Politics", "family": "risk", "section": "Political Risk", "aliases": ["politics", "political", "government policy", "politique", "Politik"]},
    {"name": "Accidents", "family": "risk", "section": "Physical Risk", "aliases": ["accident", "crash", "explosion", "industrial accident", "accident industriel"]},
    {"name": "Crime", "family": "risk", "section": "Physical Risk", "aliases": ["crime", "criminal", "theft", "fraud", "criminalité", "Kriminalität"]},
    {"name": "ESDI", "family": "risk", "section": "Physical Risk", "aliases": ["ESDI", "environmental social disruption", "supply disruption"]},

    # ══════════════════════════════════════════════════════════════
    # BIOPHARMA RESEARCH
    # ══════════════════════════════════════════════════════════════
    {"name": "TP53", "family": "biopharma", "section": "Genes", "aliases": ["BMFS5", "LFS1", "TRP53", "tumor protein p53", "p53", "tumor suppressor p53"]},
    {"name": "BRCA1", "family": "biopharma", "section": "Genes", "aliases": ["BRCA1", "breast cancer gene 1", "RING finger protein 53"]},
    {"name": "EGFR", "family": "biopharma", "section": "Genes", "aliases": ["EGFR", "epidermal growth factor receptor", "HER1", "ErbB-1"]},
    {"name": "KRAS", "family": "biopharma", "section": "Genes", "aliases": ["KRAS", "K-Ras", "Kirsten rat sarcoma", "KRAS4B"]},
    {"name": "Heart Diseases", "family": "biopharma", "section": "Diseases", "aliases": ["heart disease", "cardiovascular", "cardiac", "maladie cardiaque", "Herzerkrankung"]},
    {"name": "Cancer", "family": "biopharma", "section": "Diseases", "aliases": ["cancer", "tumor", "oncology", "carcinoma", "cancer", "Krebs"]},
    {"name": "Diabetes", "family": "biopharma", "section": "Diseases", "aliases": ["diabetes", "diabète", "insulin", "glucose", "Diabetes"]},
    {"name": "Alzheimer's Disease", "family": "biopharma", "section": "Diseases", "aliases": ["Alzheimer", "dementia", "démence", "Alzheimer-Krankheit"]},
    {"name": "COVID-19", "family": "biopharma", "section": "Diseases", "aliases": ["COVID", "SARS-CoV-2", "coronavirus", "pandemic", "pandémie"]},

    # ══════════════════════════════════════════════════════════════
    # THREAT INTELLIGENCE — additional detection rules
    # ══════════════════════════════════════════════════════════════
    {"name": "YARA Rules", "family": "threat", "section": "Detection Rules", "aliases": ["YARA", "YARA rule", "YARA signature", "malware signature"]},
    {"name": "Sigma Rules", "family": "threat", "section": "Detection Rules", "aliases": ["Sigma", "Sigma rule", "SIEM detection", "log detection"]},
    {"name": "Snort Rules", "family": "threat", "section": "Detection Rules", "aliases": ["Snort", "Snort rule", "IDS rule", "network detection"]},
    {"name": "Hunting Queries", "family": "threat", "section": "Detection Rules", "aliases": ["hunting query", "threat hunting", "KQL", "SPL"]},
]


async def seed_intel_models(db) -> int:
    """Insert seed intel models into DB. Skips existing names."""
    from sqlalchemy import select
    from app.models.intel_model import IntelModel

    result = await db.execute(select(IntelModel.name))
    existing = {r[0] for r in result.all()}

    inserted = 0
    for m in INTEL_MODELS:
        if m["name"] not in existing:
            entry = IntelModel(
                name=m["name"],
                family=m["family"],
                section=m["section"],
                aliases=m.get("aliases", []),
                origin="seed",
            )
            db.add(entry)
            inserted += 1

    if inserted:
        await db.commit()
    return inserted
