"""
Seed data for Intel Models — 12 families, 63 sections taxonomy.
Each model has: name, family, section, and initial aliases.
Aliases are enriched weekly by LLM from article metadata.
"""

INTEL_MODELS = [
    # ══════════════════════════════════════════════════════════════
    # POLITICS (6 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Geopolitics ──
    {"name": "Diplomatie", "family": "politics", "section": "Geopolitics", "aliases": ["diplomacy", "diplomatic", "foreign affairs", "international relations", "affaires étrangères", "relations internationales", "Diplomatie", "дипломатия"]},
    {"name": "Alliances internationales", "family": "politics", "section": "Geopolitics", "aliases": ["NATO", "OTAN", "AUKUS", "QUAD", "alliance", "military alliance", "pacte", "traité"]},
    {"name": "Sanctions", "family": "politics", "section": "Geopolitics", "aliases": ["sanctions", "embargo", "trade restrictions", "sanctions économiques", "Sanktionen", "sanctions internationales"]},

    # ── Governance ──
    {"name": "Elections", "family": "politics", "section": "Governance", "aliases": ["election", "vote", "ballot", "polling", "scrutin", "élection", "Wahl", "выборы", "elections"]},
    {"name": "Politics", "family": "politics", "section": "Governance", "aliases": ["politics", "political", "government policy", "politique", "Politik", "gouvernement"]},

    # ── Legal & Regulation ──
    {"name": "Regulatory Approvals", "family": "politics", "section": "Legal & Regulation", "aliases": ["approval", "authorization", "clearance", "approbation", "autorisation", "homologation"]},
    {"name": "Regulatory Changes", "family": "politics", "section": "Legal & Regulation", "aliases": ["regulation", "new law", "policy change", "réglementation", "loi", "directive"]},
    {"name": "Privacy", "family": "politics", "section": "Legal & Regulation", "aliases": ["privacy", "data protection", "GDPR", "RGPD", "vie privée", "Datenschutz"]},

    # ── Conflicts & Crises ──
    {"name": "Conflits armés", "family": "politics", "section": "Conflicts & Crises", "aliases": ["armed conflict", "war", "military conflict", "guerre", "conflit armé", "Krieg", "война", "conflicto armado"]},
    {"name": "Political Instability", "family": "politics", "section": "Conflicts & Crises", "aliases": ["coup", "political crisis", "instabilité politique", "coup d'état", "putsch", "crise politique"]},

    # ── Social Movements ──
    {"name": "Protests", "family": "politics", "section": "Social Movements", "aliases": ["protest", "demonstration", "unrest", "manifestation", "Demonstration", "протест", "mouvement social"]},
    {"name": "Violent Protests", "family": "politics", "section": "Social Movements", "aliases": ["riot", "violent protest", "civil unrest", "émeute", "violence urbaine", "insurrection"]},

    # ── Intelligence & Influence ──
    {"name": "Espionnage", "family": "politics", "section": "Intelligence & Influence", "aliases": ["espionage", "spy", "intelligence", "espionnage", "renseignement", "Spionage", "шпионаж"]},
    {"name": "Désinformation", "family": "politics", "section": "Intelligence & Influence", "aliases": ["disinformation", "misinformation", "fake news", "propaganda", "désinformation", "infox", "ingérence"]},
    {"name": "Election Interference", "family": "politics", "section": "Intelligence & Influence", "aliases": ["election interference", "election meddling", "voter fraud", "ingérence électorale"]},

    # ══════════════════════════════════════════════════════════════
    # ECONOMY (8 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Macroeconomics ──
    {"name": "Economie", "family": "economy", "section": "Macroeconomics", "aliases": ["economy", "economic", "GDP", "growth", "recession", "économie", "croissance", "récession", "Wirtschaft", "экономика"]},
    {"name": "Inflation", "family": "economy", "section": "Macroeconomics", "aliases": ["inflation", "CPI", "consumer prices", "prix à la consommation", "Inflation", "инфляция", "deflation"]},
    {"name": "Dette publique", "family": "economy", "section": "Macroeconomics", "aliases": ["public debt", "sovereign debt", "deficit", "dette publique", "déficit", "Staatsverschuldung"]},

    # ── Finance & Markets ──
    {"name": "Politique monétaire", "family": "economy", "section": "Finance & Markets", "aliases": ["monetary policy", "interest rate", "central bank", "Fed", "ECB", "politique monétaire", "taux d'intérêt", "banque centrale"]},
    {"name": "Market Data", "family": "economy", "section": "Finance & Markets", "aliases": ["market data", "market report", "données marché", "rapport de marché", "Marktdaten"]},
    {"name": "Revenue", "family": "economy", "section": "Finance & Markets", "aliases": ["revenue", "earnings", "quarterly results", "chiffre d'affaires", "résultats", "Umsatz"]},
    {"name": "Market Prices", "family": "economy", "section": "Finance & Markets", "aliases": ["price", "pricing", "cost", "prix", "cours", "tarif", "Marktpreise"]},

    # ── Trade & Commodities ──
    {"name": "Commodities", "family": "economy", "section": "Trade & Commodities", "aliases": ["commodity", "raw material", "matière première", "Rohstoff", "oil", "gold", "copper", "pétrole", "or", "cuivre"]},
    {"name": "Commerce international", "family": "economy", "section": "Trade & Commodities", "aliases": ["international trade", "tariff", "export", "import", "commerce international", "tarifs douaniers", "Handel"]},
    {"name": "Métaux rares", "family": "economy", "section": "Trade & Commodities", "aliases": ["rare earth", "lithium", "cobalt", "terres rares", "métaux critiques", "seltene Erden", "critical minerals"]},

    # ── Supply Chains ──
    {"name": "Supply Chain Disruption", "family": "economy", "section": "Supply Chains", "aliases": ["supply chain", "logistics", "supply disruption", "shortage", "pénurie", "logistique", "Lieferkette"]},
    {"name": "ESDI", "family": "economy", "section": "Supply Chains", "aliases": ["ESDI", "environmental social disruption", "supply disruption", "perturbation"]},

    # ── Infrastructure ──
    {"name": "Maritime", "family": "economy", "section": "Infrastructure", "aliases": ["maritime", "shipping", "sea", "port", "marine", "Seefahrt", "transport maritime"]},
    {"name": "Outages", "family": "economy", "section": "Infrastructure", "aliases": ["outage", "service disruption", "downtime", "blackout", "panne", "coupure"]},
    {"name": "Transport", "family": "economy", "section": "Infrastructure", "aliases": ["transport", "railway", "aviation", "infrastructure", "ferroviaire", "Verkehr", "grands projets"]},

    # ── Agriculture & Food ──
    {"name": "Sécurité alimentaire", "family": "economy", "section": "Agriculture & Food", "aliases": ["food security", "famine", "hunger", "sécurité alimentaire", "Ernährungssicherheit"]},
    {"name": "Agriculture", "family": "economy", "section": "Agriculture & Food", "aliases": ["agriculture", "farming", "crop", "harvest", "récolte", "agroalimentaire", "Landwirtschaft"]},

    # ── Corporate ──
    {"name": "Mergers & Acquisitions", "family": "economy", "section": "Corporate", "aliases": ["M&A", "merger", "acquisition", "takeover", "rachat", "fusion", "Übernahme", "OPA"]},
    {"name": "Funding Events", "family": "economy", "section": "Corporate", "aliases": ["funding round", "venture capital", "Series A", "Series B", "levée de fonds", "investissement"]},
    {"name": "Initial Public Offerings", "family": "economy", "section": "Corporate", "aliases": ["IPO", "listing", "introduction en bourse", "Börsengang"]},
    {"name": "Partnerships", "family": "economy", "section": "Corporate", "aliases": ["partnership", "strategic alliance", "joint venture", "partenariat", "alliance stratégique"]},
    {"name": "Product Launches", "family": "economy", "section": "Corporate", "aliases": ["product launch", "new product", "release", "lancement produit"]},
    {"name": "Leadership Changes", "family": "economy", "section": "Corporate", "aliases": ["CEO change", "new CEO", "appointment", "nomination", "changement de direction"]},
    {"name": "New Deals", "family": "economy", "section": "Corporate", "aliases": ["deal", "contract", "agreement", "contrat", "accord", "Vertrag"]},

    # ── Employment ──
    {"name": "Layoffs", "family": "economy", "section": "Employment", "aliases": ["layoff", "downsizing", "restructuring", "licenciements", "plan social", "Entlassungen"]},
    {"name": "Hiring", "family": "economy", "section": "Employment", "aliases": ["hiring", "recruitment", "talent acquisition", "recrutement", "embauche"]},
    {"name": "Chômage", "family": "economy", "section": "Employment", "aliases": ["unemployment", "jobless", "labor market", "chômage", "marché du travail", "Arbeitslosigkeit"]},

    # ══════════════════════════════════════════════════════════════
    # DEFENSE (4 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Military ──
    {"name": "Opérations militaires", "family": "defense", "section": "Military", "aliases": ["military operation", "deployment", "troops", "opération militaire", "déploiement", "troupes", "Militäroperation"]},
    {"name": "Guerre navale", "family": "defense", "section": "Military", "aliases": ["naval warfare", "navy", "warship", "destroyer", "guerre navale", "marine de guerre", "Seekrieg"]},
    {"name": "Forces aériennes", "family": "defense", "section": "Military", "aliases": ["air force", "fighter jet", "air strike", "forces aériennes", "frappe aérienne", "Luftwaffe"]},

    # ── Armament ──
    {"name": "Armement", "family": "defense", "section": "Armament", "aliases": ["armament", "weapons", "arms", "defense procurement", "armement", "armes", "Rüstung", "Waffen"]},
    {"name": "Missiles", "family": "defense", "section": "Armament", "aliases": ["missile", "ICBM", "cruise missile", "ballistic", "missile balistique", "Rakete"]},
    {"name": "Drones militaires", "family": "defense", "section": "Armament", "aliases": ["military drone", "UAV", "unmanned aerial", "drone militaire", "Drohne"]},
    {"name": "Hypersonic", "family": "defense", "section": "Armament", "aliases": ["hypersonic", "Mach 5", "scramjet", "hypersonique", "Hyperschall"]},

    # ── Terrorism ──
    {"name": "Terrorisme", "family": "defense", "section": "Terrorism", "aliases": ["terrorism", "terrorist", "extremism", "radicalization", "terrorisme", "attentat", "Terrorismus", "терроризм"]},
    {"name": "Contre-terrorisme", "family": "defense", "section": "Terrorism", "aliases": ["counter-terrorism", "anti-terrorism", "counter terror", "contre-terrorisme", "antiterrorisme"]},

    # ── Nuclear Weapons ──
    {"name": "Prolifération nucléaire", "family": "defense", "section": "Nuclear Weapons", "aliases": ["nuclear proliferation", "nuclear weapon", "atomic bomb", "prolifération nucléaire", "arme nucléaire", "Atomwaffe"]},
    {"name": "Dissuasion nucléaire", "family": "defense", "section": "Nuclear Weapons", "aliases": ["nuclear deterrence", "nuclear doctrine", "dissuasion nucléaire", "doctrine nucléaire", "nukleare Abschreckung"]},

    # ══════════════════════════════════════════════════════════════
    # TECHNOLOGY (6 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Digital & AI ──
    {"name": "Artificial Intelligence", "family": "technology", "section": "Digital & AI", "aliases": ["AI", "machine learning", "deep learning", "LLM", "GPT", "intelligence artificielle", "IA", "KI"]},
    {"name": "AI Agents", "family": "technology", "section": "Digital & AI", "aliases": ["AI agent", "autonomous agent", "agentic AI", "agent IA"]},
    {"name": "Cloud Computing", "family": "technology", "section": "Digital & AI", "aliases": ["cloud", "SaaS", "PaaS", "IaaS", "AWS", "Azure", "GCP"]},
    {"name": "Blockchain", "family": "technology", "section": "Digital & AI", "aliases": ["blockchain", "distributed ledger", "Web3", "smart contract", "chaîne de blocs"]},
    {"name": "Crypto", "family": "technology", "section": "Digital & AI", "aliases": ["cryptocurrency", "Bitcoin", "Ethereum", "crypto", "cryptomonnaie", "Kryptowährung"]},
    {"name": "Deepfakes", "family": "technology", "section": "Digital & AI", "aliases": ["deepfake", "synthetic media", "face swap", "hypertrucage"]},
    {"name": "Digital Transformation", "family": "technology", "section": "Digital & AI", "aliases": ["digital transformation", "digitalization", "transformation numérique", "Digitalisierung"]},
    {"name": "Fintech", "family": "technology", "section": "Digital & AI", "aliases": ["fintech", "financial technology", "neobank", "digital banking"]},

    # ── Hardware ──
    {"name": "Semi-conducteurs", "family": "technology", "section": "Hardware", "aliases": ["semiconductor", "chip", "microchip", "foundry", "wafer", "semi-conducteur", "puce", "Halbleiter"]},
    {"name": "Quantum Computing", "family": "technology", "section": "Hardware", "aliases": ["quantum", "qubit", "quantum computer", "informatique quantique", "Quantencomputer"]},
    {"name": "Autonomous Vehicles", "family": "technology", "section": "Hardware", "aliases": ["self-driving", "autonomous car", "robotaxi", "véhicule autonome"]},
    {"name": "Robotics", "family": "technology", "section": "Hardware", "aliases": ["robot", "robotics", "automation", "robotique", "Robotik"]},
    {"name": "Internet of Things", "family": "technology", "section": "Hardware", "aliases": ["IoT", "connected devices", "smart devices", "objets connectés"]},
    {"name": "Wearables", "family": "technology", "section": "Hardware", "aliases": ["wearable", "smartwatch", "fitness tracker", "objets portables"]},

    # ── Telecom ──
    {"name": "5G & 6G", "family": "technology", "section": "Telecom", "aliases": ["5G", "6G", "mobile network", "réseau mobile", "Mobilfunknetz", "télécommunications"]},
    {"name": "Fibre optique", "family": "technology", "section": "Telecom", "aliases": ["fiber optic", "broadband", "fibre optique", "haut débit", "Glasfaser"]},

    # ── Space ──
    {"name": "Exploration spatiale", "family": "technology", "section": "Space", "aliases": ["space exploration", "NASA", "ESA", "moon", "Mars", "exploration spatiale", "Weltraumforschung"]},
    {"name": "Satellites", "family": "technology", "section": "Space", "aliases": ["satellite", "orbit", "Starlink", "satellite constellation", "orbite", "Satellit"]},

    # ── Platforms & Internet ──
    {"name": "Réseaux sociaux", "family": "technology", "section": "Platforms & Internet", "aliases": ["social media", "Twitter", "X", "TikTok", "Instagram", "réseaux sociaux", "soziale Medien"]},
    {"name": "Régulation numérique", "family": "technology", "section": "Platforms & Internet", "aliases": ["digital regulation", "DMA", "DSA", "content moderation", "régulation numérique"]},
    {"name": "Creator Economy", "family": "technology", "section": "Platforms & Internet", "aliases": ["creator economy", "influencer", "content creator", "économie des créateurs"]},

    # ── Science & Research ──
    {"name": "New Patents", "family": "technology", "section": "Science & Research", "aliases": ["patent", "brevet", "intellectual property", "IP filing", "Patent"]},
    {"name": "Pilot Projects", "family": "technology", "section": "Science & Research", "aliases": ["pilot project", "proof of concept", "PoC", "projet pilote", "prototype"]},
    {"name": "Recherche scientifique", "family": "technology", "section": "Science & Research", "aliases": ["scientific research", "discovery", "peer review", "recherche scientifique", "découverte"]},

    # ══════════════════════════════════════════════════════════════
    # CYBER (5 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Attacks ──
    {"name": "Cyber Attacks", "family": "cyber", "section": "Attacks", "aliases": ["cyberattack", "hacking", "breach", "intrusion", "cyberattaque", "piratage", "Cyberangriff"]},
    {"name": "Ransomware", "family": "cyber", "section": "Attacks", "aliases": ["ransomware", "ransom", "encryption attack", "rançongiciel", "Erpressungstrojaner"]},
    {"name": "New Malware", "family": "cyber", "section": "Attacks", "aliases": ["malware", "trojan", "worm", "virus", "logiciel malveillant", "Schadsoftware"]},
    {"name": "Phishing", "family": "cyber", "section": "Attacks", "aliases": ["phishing", "spear phishing", "social engineering", "hameçonnage"]},
    {"name": "Data Breach", "family": "cyber", "section": "Attacks", "aliases": ["data breach", "data leak", "fuite de données", "violation de données", "Datenleck"]},

    # ── Threat Actors ──
    {"name": "Threat Actor", "family": "cyber", "section": "Threat Actors", "aliases": ["APT", "threat actor", "state-sponsored", "hacker group", "acteur de menace"]},
    {"name": "Fancy Bear / APT28", "family": "cyber", "section": "Threat Actors", "aliases": ["Fancy Bear", "APT28", "GRU", "Sofacy", "Sednit", "Strontium"]},
    {"name": "Lazarus Group", "family": "cyber", "section": "Threat Actors", "aliases": ["Lazarus", "DPRK hackers", "Hidden Cobra", "APT38", "Andariel"]},
    {"name": "APT29 / Cozy Bear", "family": "cyber", "section": "Threat Actors", "aliases": ["Cozy Bear", "APT29", "SVR", "Nobelium", "Midnight Blizzard"]},
    {"name": "Volt Typhoon", "family": "cyber", "section": "Threat Actors", "aliases": ["Volt Typhoon", "BRONZE SILHOUETTE", "Chinese state hackers", "PRC cyber"]},
    {"name": "LockBit", "family": "cyber", "section": "Threat Actors", "aliases": ["LockBit", "LockBit 3.0", "LockBit ransomware"]},
    {"name": "BlackCat / ALPHV", "family": "cyber", "section": "Threat Actors", "aliases": ["BlackCat", "ALPHV", "Noberus"]},
    {"name": "Sandworm", "family": "cyber", "section": "Threat Actors", "aliases": ["Sandworm", "Voodoo Bear", "IRIDIUM", "Seashell Blizzard"]},

    # ── Vulnerabilities ──
    {"name": "High Vulnerabilities", "family": "cyber", "section": "Vulnerabilities", "aliases": ["CVE", "critical vulnerability", "zero-day", "0-day", "faille critique"]},
    {"name": "Proof of Exploit", "family": "cyber", "section": "Vulnerabilities", "aliases": ["exploit", "PoC", "proof of concept", "exploitation", "RCE"]},

    # ── Detection ──
    {"name": "MITRE ATT&CK", "family": "cyber", "section": "Detection", "aliases": ["MITRE ATT&CK", "TTP", "tactics techniques procedures", "kill chain"]},
    {"name": "Indicators of Compromise", "family": "cyber", "section": "Detection", "aliases": ["IoC", "indicator of compromise", "C2", "command and control"]},
    {"name": "YARA Rules", "family": "cyber", "section": "Detection", "aliases": ["YARA", "YARA rule", "YARA signature", "malware signature"]},
    {"name": "Sigma Rules", "family": "cyber", "section": "Detection", "aliases": ["Sigma", "Sigma rule", "SIEM detection", "log detection"]},
    {"name": "Threat Intelligence Reports", "family": "cyber", "section": "Detection", "aliases": ["threat report", "CTI report", "threat brief", "rapport de menace"]},

    # ── Cyber Policy ──
    {"name": "Souveraineté numérique", "family": "cyber", "section": "Cyber Policy", "aliases": ["digital sovereignty", "cyber sovereignty", "souveraineté numérique", "digitale Souveränität"]},
    {"name": "Doctrine cyber", "family": "cyber", "section": "Cyber Policy", "aliases": ["cyber doctrine", "cyber strategy", "cyber warfare policy", "doctrine cyber", "stratégie cyber"]},

    # ══════════════════════════════════════════════════════════════
    # ENERGY (5 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Fossil ──
    {"name": "Pétrole", "family": "energy", "section": "Fossil", "aliases": ["oil", "crude oil", "petroleum", "Brent", "WTI", "pétrole", "brut", "Erdöl"]},
    {"name": "Gaz naturel", "family": "energy", "section": "Fossil", "aliases": ["natural gas", "LNG", "pipeline", "gaz naturel", "GNL", "gazoduc", "Erdgas"]},
    {"name": "Charbon", "family": "energy", "section": "Fossil", "aliases": ["coal", "charbon", "Kohle", "уголь", "carbón"]},

    # ── Nuclear ──
    {"name": "Nuclear Energy", "family": "energy", "section": "Nuclear", "aliases": ["nuclear", "nuclear power", "nucléaire", "Kernenergie", "ядерная энергия"]},
    {"name": "Réacteurs nucléaires", "family": "energy", "section": "Nuclear", "aliases": ["nuclear reactor", "EPR", "SMR", "réacteur nucléaire", "Kernreaktor"]},
    {"name": "Uranium", "family": "energy", "section": "Nuclear", "aliases": ["uranium", "enrichment", "yellowcake", "enrichissement", "Uran"]},

    # ── Renewables ──
    {"name": "Renewable Energy", "family": "energy", "section": "Renewables", "aliases": ["renewable", "clean energy", "énergie renouvelable", "erneuerbare Energie"]},
    {"name": "Solar Energy", "family": "energy", "section": "Renewables", "aliases": ["solar", "photovoltaic", "PV", "solaire", "Solarenergie"]},
    {"name": "Wind Energy", "family": "energy", "section": "Renewables", "aliases": ["wind", "wind farm", "offshore wind", "éolien", "Windenergie"]},
    {"name": "Energy Storage", "family": "energy", "section": "Renewables", "aliases": ["battery", "energy storage", "stockage énergie", "batteries", "Energiespeicher"]},

    # ── Energy Markets ──
    {"name": "OPEP", "family": "energy", "section": "Energy Markets", "aliases": ["OPEC", "OPEC+", "OPEP", "oil cartel", "production cuts", "quota pétrolier"]},
    {"name": "Prix de l'énergie", "family": "energy", "section": "Energy Markets", "aliases": ["energy price", "electricity price", "prix énergie", "prix électricité", "Energiepreis"]},

    # ── Policy & Grid ──
    {"name": "Transition énergétique", "family": "energy", "section": "Policy & Grid", "aliases": ["energy transition", "decarbonization", "net zero", "transition énergétique", "décarbonation", "Energiewende"]},
    {"name": "Réseau électrique", "family": "energy", "section": "Policy & Grid", "aliases": ["power grid", "electricity grid", "transmission", "réseau électrique", "Stromnetz"]},

    # ══════════════════════════════════════════════════════════════
    # HEALTH (4 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Diseases ──
    {"name": "Heart Diseases", "family": "health", "section": "Diseases", "aliases": ["heart disease", "cardiovascular", "cardiac", "maladie cardiaque", "Herzerkrankung"]},
    {"name": "Cancer", "family": "health", "section": "Diseases", "aliases": ["cancer", "tumor", "oncology", "carcinoma", "Krebs"]},
    {"name": "Diabetes", "family": "health", "section": "Diseases", "aliases": ["diabetes", "diabète", "insulin", "glucose", "Diabetes"]},
    {"name": "Alzheimer's Disease", "family": "health", "section": "Diseases", "aliases": ["Alzheimer", "dementia", "démence", "Alzheimer-Krankheit"]},
    {"name": "COVID-19", "family": "health", "section": "Diseases", "aliases": ["COVID", "SARS-CoV-2", "coronavirus", "pandemic", "pandémie"]},

    # ── Pharma & Biotech ──
    {"name": "Clinical Trials", "family": "health", "section": "Pharma & Biotech", "aliases": ["clinical trial", "Phase I", "Phase II", "Phase III", "essai clinique"]},
    {"name": "TP53", "family": "health", "section": "Pharma & Biotech", "aliases": ["BMFS5", "LFS1", "TRP53", "tumor protein p53", "p53"]},
    {"name": "BRCA1", "family": "health", "section": "Pharma & Biotech", "aliases": ["BRCA1", "breast cancer gene 1", "RING finger protein 53"]},
    {"name": "EGFR", "family": "health", "section": "Pharma & Biotech", "aliases": ["EGFR", "epidermal growth factor receptor", "HER1", "ErbB-1"]},
    {"name": "KRAS", "family": "health", "section": "Pharma & Biotech", "aliases": ["KRAS", "K-Ras", "Kirsten rat sarcoma", "KRAS4B"]},

    # ── Public Health ──
    {"name": "Santé publique", "family": "health", "section": "Public Health", "aliases": ["public health", "WHO", "OMS", "santé publique", "öffentliche Gesundheit", "prévention"]},
    {"name": "Vaccination", "family": "health", "section": "Public Health", "aliases": ["vaccine", "vaccination", "immunization", "vaccin", "Impfung"]},

    # ── Healthcare Systems ──
    {"name": "Systèmes de santé", "family": "health", "section": "Healthcare Systems", "aliases": ["healthcare system", "hospital", "health insurance", "système de santé", "hôpital", "Gesundheitssystem"]},
    {"name": "Accès aux soins", "family": "health", "section": "Healthcare Systems", "aliases": ["healthcare access", "medical care", "accès aux soins", "couverture médicale"]},

    # ══════════════════════════════════════════════════════════════
    # ENVIRONMENT (4 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Climate ──
    {"name": "Climat", "family": "environment", "section": "Climate", "aliases": ["climate", "climate change", "global warming", "changement climatique", "réchauffement", "Klimawandel"]},
    {"name": "Carbon Footprint", "family": "environment", "section": "Climate", "aliases": ["carbon footprint", "CO2 emissions", "empreinte carbone", "émissions CO2"]},
    {"name": "COP & Accords climat", "family": "environment", "section": "Climate", "aliases": ["COP", "Paris Agreement", "climate summit", "accord de Paris", "sommet climatique"]},

    # ── Disasters ──
    {"name": "Catastrophes naturelles", "family": "environment", "section": "Disasters", "aliases": ["disaster", "natural disaster", "earthquake", "flood", "hurricane", "wildfire", "séisme", "inondation", "Naturkatastrophe"]},
    {"name": "Accidents industriels", "family": "environment", "section": "Disasters", "aliases": ["accident", "crash", "explosion", "industrial accident", "accident industriel"]},

    # ── Sustainability ──
    {"name": "ESG", "family": "environment", "section": "Sustainability", "aliases": ["ESG", "environmental social governance", "responsible investment", "investissement responsable"]},
    {"name": "Circular Economy", "family": "environment", "section": "Sustainability", "aliases": ["circular economy", "recycling", "économie circulaire", "Kreislaufwirtschaft"]},
    {"name": "Biodiversité", "family": "environment", "section": "Sustainability", "aliases": ["biodiversity", "species", "extinction", "biodiversité", "espèces menacées", "Artenvielfalt"]},
    {"name": "Pollution", "family": "environment", "section": "Sustainability", "aliases": ["pollution", "air quality", "contamination", "pollution atmosphérique", "Verschmutzung"]},

    # ── Resources ──
    {"name": "Eau", "family": "environment", "section": "Resources", "aliases": ["water", "water scarcity", "drought", "eau", "sécheresse", "pénurie d'eau", "Wasser"]},
    {"name": "Minerais critiques", "family": "environment", "section": "Resources", "aliases": ["critical minerals", "rare earth mining", "minerais critiques", "extraction minière", "kritische Rohstoffe"]},

    # ══════════════════════════════════════════════════════════════
    # SOCIETY (7 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Migration ──
    {"name": "Migrations", "family": "society", "section": "Migration", "aliases": ["migration", "refugee", "asylum", "displacement", "immigration", "réfugié", "demandeur d'asile", "Migration", "Flüchtling"]},
    {"name": "Crise migratoire", "family": "society", "section": "Migration", "aliases": ["migration crisis", "refugee crisis", "border crisis", "crise migratoire", "frontière", "Migrationskrise"]},

    # ── Rights & Justice ──
    {"name": "Droits humains", "family": "society", "section": "Rights & Justice", "aliases": ["human rights", "civil rights", "liberty", "droits humains", "droits civiques", "Menschenrechte"]},
    {"name": "Justice internationale", "family": "society", "section": "Rights & Justice", "aliases": ["international justice", "ICC", "war crimes", "CPI", "crimes de guerre", "justice internationale"]},
    {"name": "Crime", "family": "society", "section": "Rights & Justice", "aliases": ["crime", "criminal", "theft", "fraud", "criminalité", "Kriminalität"]},

    # ── Organized Crime ──
    {"name": "Narcotrafic", "family": "society", "section": "Organized Crime", "aliases": ["drug trafficking", "cartel", "narcotics", "narcotrafic", "trafic de drogue", "Drogenhandel"]},
    {"name": "Trafic d'êtres humains", "family": "society", "section": "Organized Crime", "aliases": ["human trafficking", "modern slavery", "trafic d'êtres humains", "esclavage moderne", "Menschenhandel"]},
    {"name": "Mafia & Réseaux criminels", "family": "society", "section": "Organized Crime", "aliases": ["mafia", "organized crime", "criminal network", "crime organisé", "réseau criminel"]},

    # ── Education & Culture ──
    {"name": "Éducation", "family": "society", "section": "Education & Culture", "aliases": ["education", "school", "university", "éducation", "école", "université", "Bildung"]},
    {"name": "Culture & Patrimoine", "family": "society", "section": "Education & Culture", "aliases": ["culture", "heritage", "museum", "UNESCO", "patrimoine", "Kultur"]},

    # ── Religion ──
    {"name": "Tensions religieuses", "family": "society", "section": "Religion", "aliases": ["religious tension", "sectarianism", "interfaith", "tensions religieuses", "sectarisme"]},
    {"name": "Islam politique", "family": "society", "section": "Religion", "aliases": ["political Islam", "Islamism", "Muslim Brotherhood", "islam politique", "islamisme"]},

    # ── Information & Media ──
    {"name": "Liberté de la presse", "family": "society", "section": "Information & Media", "aliases": ["press freedom", "journalism", "media freedom", "liberté de la presse", "journalisme", "Pressefreiheit"]},
    {"name": "Opinion publique", "family": "society", "section": "Information & Media", "aliases": ["public opinion", "poll", "survey", "opinion publique", "sondage"]},

    # ── Labor ──
    {"name": "Droit du travail", "family": "society", "section": "Labor", "aliases": ["labor law", "workers rights", "union", "droit du travail", "syndicat", "Arbeitsrecht"]},
    {"name": "Diversity & Inclusion", "family": "society", "section": "Labor", "aliases": ["diversity", "inclusion", "DEI", "diversité", "Vielfalt"]},
    {"name": "Future of Work", "family": "society", "section": "Labor", "aliases": ["future of work", "remote work", "hybrid work", "télétravail", "travail hybride"]},

    # ══════════════════════════════════════════════════════════════
    # FOUNDATION (4 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Companies ──
    {"name": "Amazon", "family": "foundation", "section": "Companies", "aliases": ["AMZN", "Amazon.com", "AWS", "Amazon Web Services", "Jeff Bezos", "Andy Jassy"]},
    {"name": "Google", "family": "foundation", "section": "Companies", "aliases": ["GOOGL", "Alphabet", "Google LLC", "Sundar Pichai", "DeepMind", "YouTube"]},
    {"name": "Apple", "family": "foundation", "section": "Companies", "aliases": ["AAPL", "Apple Inc", "Tim Cook", "iPhone", "MacBook"]},
    {"name": "Microsoft", "family": "foundation", "section": "Companies", "aliases": ["MSFT", "Microsoft Corp", "Satya Nadella", "Azure", "Windows", "GitHub"]},
    {"name": "Tesla", "family": "foundation", "section": "Companies", "aliases": ["TSLA", "Tesla Inc", "Elon Musk", "Tesla Motors", "Gigafactory"]},
    {"name": "Meta", "family": "foundation", "section": "Companies", "aliases": ["META", "Facebook", "Meta Platforms", "Mark Zuckerberg", "Instagram", "WhatsApp"]},
    {"name": "NVIDIA", "family": "foundation", "section": "Companies", "aliases": ["NVDA", "Nvidia Corp", "Jensen Huang", "GPU", "CUDA", "H100", "Blackwell"]},
    {"name": "JPMorgan Chase", "family": "foundation", "section": "Companies", "aliases": ["JPM", "JP Morgan", "Jamie Dimon", "Chase Bank"]},
    {"name": "Alibaba Group", "family": "foundation", "section": "Companies", "aliases": ["BABA", "Alibaba", "Alipay", "Ant Group", "Jack Ma"]},
    {"name": "Samsung", "family": "foundation", "section": "Companies", "aliases": ["Samsung Electronics", "Samsung Group"]},
    {"name": "TotalEnergies", "family": "foundation", "section": "Companies", "aliases": ["TTE", "Total", "TotalEnergies SE"]},
    {"name": "Shell", "family": "foundation", "section": "Companies", "aliases": ["SHEL", "Royal Dutch Shell", "Shell plc"]},
    {"name": "ExxonMobil", "family": "foundation", "section": "Companies", "aliases": ["XOM", "Exxon", "Mobil", "ExxonMobil Corp"]},
    {"name": "Lockheed Martin", "family": "foundation", "section": "Companies", "aliases": ["LMT", "Lockheed", "F-35", "Skunk Works"]},
    {"name": "Boeing", "family": "foundation", "section": "Companies", "aliases": ["BA", "Boeing Co", "737 MAX", "Boeing Defense"]},
    {"name": "Airbus", "family": "foundation", "section": "Companies", "aliases": ["AIR", "Airbus SE", "A320", "A350"]},
    {"name": "TSMC", "family": "foundation", "section": "Companies", "aliases": ["TSM", "Taiwan Semiconductor", "TSMC Ltd"]},
    {"name": "OpenAI", "family": "foundation", "section": "Companies", "aliases": ["OpenAI Inc", "Sam Altman", "ChatGPT", "GPT-4", "GPT-5"]},
    {"name": "Anthropic", "family": "foundation", "section": "Companies", "aliases": ["Anthropic PBC", "Claude", "Dario Amodei"]},
    {"name": "SpaceX", "family": "foundation", "section": "Companies", "aliases": ["Space Exploration Technologies", "Starlink", "Falcon 9", "Starship"]},
    {"name": "Huawei", "family": "foundation", "section": "Companies", "aliases": ["Huawei Technologies", "Ren Zhengfei"]},
    {"name": "ByteDance", "family": "foundation", "section": "Companies", "aliases": ["TikTok", "Douyin"]},
    {"name": "Pfizer", "family": "foundation", "section": "Companies", "aliases": ["PFE", "Pfizer Inc"]},
    {"name": "Moderna", "family": "foundation", "section": "Companies", "aliases": ["MRNA", "Moderna Inc", "mRNA"]},
    {"name": "Rheinmetall", "family": "foundation", "section": "Companies", "aliases": ["RHM", "Rheinmetall AG", "Leopard 2"]},
    {"name": "Thales", "family": "foundation", "section": "Companies", "aliases": ["HO", "Thales Group", "Thales SA"]},
    {"name": "Dassault", "family": "foundation", "section": "Companies", "aliases": ["Dassault Aviation", "Rafale", "Dassault Systèmes"]},
    {"name": "Orano", "family": "foundation", "section": "Companies", "aliases": ["Orano SA", "Areva", "uranium enrichment"]},
    {"name": "EDF", "family": "foundation", "section": "Companies", "aliases": ["Electricité de France", "EDF SA"]},
    {"name": "Fortune 500", "family": "foundation", "section": "Companies", "aliases": ["Fortune 500", "Fortune Global 500", "top companies"]},
    {"name": "Big Tech", "family": "foundation", "section": "Companies", "aliases": ["GAFAM", "FAANG", "Big Tech", "Magnificent 7", "tech giants"]},
    {"name": "Defense Contractors", "family": "foundation", "section": "Companies", "aliases": ["defense companies", "arms manufacturers", "military contractors", "industriels défense"]},

    # ── Industries ──
    {"name": "Automotive Industry", "family": "foundation", "section": "Industries", "aliases": ["automotive", "car industry", "automobile", "Automobilindustrie"]},
    {"name": "Banking Industry", "family": "foundation", "section": "Industries", "aliases": ["banking", "bank", "financial services", "banque", "Bankwesen"]},
    {"name": "Defense Industry", "family": "foundation", "section": "Industries", "aliases": ["defense", "arms industry", "défense", "Rüstungsindustrie"]},
    {"name": "Energy Industry", "family": "foundation", "section": "Industries", "aliases": ["energy", "power", "utilities", "énergie", "Energiewirtschaft"]},
    {"name": "Healthcare Industry", "family": "foundation", "section": "Industries", "aliases": ["healthcare", "health", "medical", "santé", "Gesundheitswesen"]},
    {"name": "Mining Industry", "family": "foundation", "section": "Industries", "aliases": ["mining", "minerals", "extraction", "mines", "Bergbau"]},
    {"name": "Oil and Gas Industry", "family": "foundation", "section": "Industries", "aliases": ["oil", "gas", "petroleum", "pétrole", "gaz"]},
    {"name": "Semiconductor Industry", "family": "foundation", "section": "Industries", "aliases": ["semiconductor", "chip", "foundry", "Halbleiter"]},
    {"name": "Space Industry", "family": "foundation", "section": "Industries", "aliases": ["space", "aerospace", "satellite", "aérospatial"]},
    {"name": "Telecom Industry", "family": "foundation", "section": "Industries", "aliases": ["telecom", "5G", "6G", "télécommunications"]},
    {"name": "Biopharma Industry", "family": "foundation", "section": "Industries", "aliases": ["biopharma", "pharmaceutical", "biotech", "pharma"]},
    {"name": "Real Estate Industry", "family": "foundation", "section": "Industries", "aliases": ["real estate", "property", "immobilier"]},
    {"name": "Retail Industry", "family": "foundation", "section": "Industries", "aliases": ["retail", "e-commerce", "commerce de détail"]},
    {"name": "Maritime Industry", "family": "foundation", "section": "Industries", "aliases": ["maritime", "shipping", "transport maritime"]},
    {"name": "Agriculture Industry", "family": "foundation", "section": "Industries", "aliases": ["agriculture", "farming", "agritech", "agroalimentaire"]},
    {"name": "Aviation Industry", "family": "foundation", "section": "Industries", "aliases": ["aviation", "aircraft", "aerospace", "aéronautique"]},
    {"name": "Chemical Industry", "family": "foundation", "section": "Industries", "aliases": ["chemical", "chemicals", "chimie", "Chemie"]},
    {"name": "Gaming Industry", "family": "foundation", "section": "Industries", "aliases": ["gaming", "video games", "esports", "jeux vidéo"]},
    {"name": "Insurance Industry", "family": "foundation", "section": "Industries", "aliases": ["insurance", "insurtech", "assurance"]},
    {"name": "Media & Entertainment Industry", "family": "foundation", "section": "Industries", "aliases": ["media", "entertainment", "streaming", "médias"]},
    {"name": "Food Industry", "family": "foundation", "section": "Industries", "aliases": ["food", "food processing", "agroalimentaire"]},
    {"name": "Fashion Industry", "family": "foundation", "section": "Industries", "aliases": ["fashion", "apparel", "clothing", "mode"]},
    {"name": "Luxury Industry", "family": "foundation", "section": "Industries", "aliases": ["luxury", "premium", "haute couture", "luxe", "LVMH"]},
    {"name": "Education Industry", "family": "foundation", "section": "Industries", "aliases": ["education", "edtech", "university", "éducation"]},
    {"name": "Construction Industry", "family": "foundation", "section": "Industries", "aliases": ["construction", "building", "BTP", "Bauwesen"]},

    # ── Organizations ──
    {"name": "ONU", "family": "foundation", "section": "Organizations", "aliases": ["United Nations", "UN", "ONU", "Nations Unies", "Vereinte Nationen"]},
    {"name": "OTAN", "family": "foundation", "section": "Organizations", "aliases": ["NATO", "OTAN", "North Atlantic Treaty", "Alliance atlantique"]},
    {"name": "Union européenne", "family": "foundation", "section": "Organizations", "aliases": ["EU", "European Union", "UE", "Union européenne", "European Commission"]},
    {"name": "FMI", "family": "foundation", "section": "Organizations", "aliases": ["IMF", "International Monetary Fund", "FMI", "Fonds monétaire international"]},
    {"name": "Banque mondiale", "family": "foundation", "section": "Organizations", "aliases": ["World Bank", "IBRD", "Banque mondiale", "Weltbank"]},
    {"name": "OMS", "family": "foundation", "section": "Organizations", "aliases": ["WHO", "World Health Organization", "OMS", "Organisation mondiale de la santé"]},
    {"name": "AIEA", "family": "foundation", "section": "Organizations", "aliases": ["IAEA", "International Atomic Energy Agency", "AIEA", "Agence internationale de l'énergie atomique"]},

    # ── People ──
    {"name": "Chefs d'État", "family": "foundation", "section": "People", "aliases": ["head of state", "president", "prime minister", "chef d'État", "premier ministre"]},
    {"name": "Dirigeants d'entreprise", "family": "foundation", "section": "People", "aliases": ["CEO", "executive", "board", "dirigeant", "PDG", "Vorstandsvorsitzender"]},

    # ══════════════════════════════════════════════════════════════
    # GEO (8 sections)
    # ══════════════════════════════════════════════════════════════

    {"name": "Enjeux mondiaux", "family": "geo", "section": "Global", "aliases": ["global", "worldwide", "international", "mondial", "planétaire"]},
    {"name": "Europe", "family": "geo", "section": "Europe", "aliases": ["Europe", "EU", "European", "européen", "Europa"]},
    {"name": "Amérique du Nord", "family": "geo", "section": "North America", "aliases": ["North America", "USA", "Canada", "Mexico", "Amérique du Nord"]},
    {"name": "Asie-Pacifique", "family": "geo", "section": "Asia-Pacific", "aliases": ["Asia-Pacific", "APAC", "Asia", "China", "Japan", "India", "Asie"]},
    {"name": "Moyen-Orient", "family": "geo", "section": "Middle East", "aliases": ["Middle East", "MENA", "Moyen-Orient", "Naher Osten", "Iran", "Israel", "Saudi"]},
    {"name": "Afrique", "family": "geo", "section": "Africa", "aliases": ["Africa", "African", "Afrique", "Afrika", "Sub-Saharan"]},
    {"name": "Amérique latine", "family": "geo", "section": "Latin America", "aliases": ["Latin America", "South America", "Amérique latine", "Lateinamerika", "Brazil"]},
    {"name": "Asie centrale", "family": "geo", "section": "Central Asia", "aliases": ["Central Asia", "Kazakhstan", "Uzbekistan", "Asie centrale", "Zentralasien"]},

    # ══════════════════════════════════════════════════════════════
    # MUTE (2 sections)
    # ══════════════════════════════════════════════════════════════

    # ── Noise ──
    {"name": "Sports", "family": "mute", "section": "Noise", "aliases": ["sports", "football", "basketball", "soccer", "Olympics", "sport"]},
    {"name": "Job Postings", "family": "mute", "section": "Noise", "aliases": ["job posting", "hiring", "career", "offre d'emploi"]},
    {"name": "Obituaries", "family": "mute", "section": "Noise", "aliases": ["obituary", "death notice", "nécrologie", "décès"]},
    {"name": "Opinions", "family": "mute", "section": "Noise", "aliases": ["opinion", "editorial", "op-ed", "tribune"]},
    {"name": "Listicles", "family": "mute", "section": "Noise", "aliases": ["listicle", "top 10", "best of", "classement"]},
    {"name": "Tutorials", "family": "mute", "section": "Noise", "aliases": ["tutorial", "how-to", "guide", "tutoriel"]},
    {"name": "Discounts and Offers", "family": "mute", "section": "Noise", "aliases": ["discount", "deal", "sale", "promo", "coupon", "réduction"]},
    {"name": "History", "family": "mute", "section": "Noise", "aliases": ["history", "historical", "this day in history", "histoire"]},

    # ── Entertainment ──
    {"name": "Divertissement", "family": "mute", "section": "Entertainment", "aliases": ["entertainment", "celebrity", "movie", "TV show", "divertissement", "célébrité", "cinéma"]},
    {"name": "Gossip", "family": "mute", "section": "Entertainment", "aliases": ["gossip", "tabloid", "paparazzi", "people", "potins"]},
]


# ── Migration helper ──────────────────────────────────────────

_MIGRATION_MAP: dict[tuple[str, str], tuple[str, str]] = {
    ("market", "Strategic Moves"): ("economy", "Corporate"),
    ("market", "Innovation"): ("technology", "Science & Research"),
    ("market", "Market Insights"): ("economy", "Finance & Markets"),
    ("market", "Regulatory"): ("politics", "Legal & Regulation"),
    ("market", "Technologies"): ("technology", "Digital & AI"),
    ("market", "Sustainability"): ("energy", "Renewables"),
    ("market", "Trends"): ("technology", "Digital & AI"),
    ("market", "Industries"): ("foundation", "Industries"),
    ("threat", "Threat Landscape"): ("cyber", "Attacks"),
    ("threat", "Malware Families"): ("cyber", "Attacks"),
    ("threat", "Threat Actors"): ("cyber", "Threat Actors"),
    ("threat", "Vulnerabilities"): ("cyber", "Vulnerabilities"),
    ("threat", "Tactics & Techniques"): ("cyber", "Detection"),
    ("threat", "IoC"): ("cyber", "Detection"),
    ("threat", "Reports"): ("cyber", "Detection"),
    ("threat", "Detection Rules"): ("cyber", "Detection"),
    ("risk", "Political Risk"): ("politics", "Conflicts & Crises"),
    ("risk", "Physical Risk"): ("environment", "Disasters"),
    ("risk", "Outages"): ("economy", "Infrastructure"),
    ("biopharma", "Genes"): ("health", "Pharma & Biotech"),
    ("biopharma", "Diseases"): ("health", "Diseases"),
    ("foundation", "Company Lists"): ("foundation", "Companies"),
    ("mute", "Mute Filters"): ("mute", "Noise"),
    ("geopolitical", "Geopolitics"): ("politics", "Geopolitics"),
    ("geopolitical", "Diplomacy"): ("politics", "Geopolitics"),
    ("geopolitical", "US Politics"): ("politics", "Governance"),
    ("foundation", "Regions"): ("geo", "Middle East"),
    ("foundation", "Countries"): ("geo", "Global"),
}


async def migrate_existing_models(db) -> int:
    """Migrate existing intel models from old taxonomy to new."""
    from sqlalchemy import select, update
    from app.models.intel_model import IntelModel
    from app.domains.ai_feeds.taxonomy import VALID_PAIRS

    result = await db.execute(select(IntelModel))
    models = result.scalars().all()
    migrated = 0

    for m in models:
        if (m.family, m.section) in VALID_PAIRS:
            continue
        key = (m.family, m.section)
        if key in _MIGRATION_MAP:
            new_fam, new_sec = _MIGRATION_MAP[key]
            await db.execute(
                update(IntelModel).where(IntelModel.id == m.id)
                .values(family=new_fam, section=new_sec)
            )
            migrated += 1

    if migrated:
        await db.commit()
    return migrated


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
