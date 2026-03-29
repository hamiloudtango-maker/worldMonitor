"""
Taxonomy — 12 families, 58 sections.
Single source of truth for article and intel model classification.
Used for: pre-filtering articles, classifying intel models, tree display.
"""

FAMILIES: dict[str, str] = {
    "politics": "Politics",
    "economy": "Economy",
    "defense": "Defense",
    "technology": "Technology",
    "cyber": "Cyber",
    "energy": "Energy",
    "health": "Health",
    "environment": "Environment",
    "society": "Society",
    "foundation": "Foundation",
    "geo": "Geography",
    "mute": "Mute Filters",
}

SECTIONS: dict[str, list[str]] = {
    "politics": [
        "Geopolitics",
        "Governance",
        "Legal & Regulation",
        "Conflicts & Crises",
        "Social Movements",
        "Intelligence & Influence",
    ],
    "economy": [
        "Macroeconomics",
        "Finance & Markets",
        "Trade & Commodities",
        "Supply Chains",
        "Infrastructure",
        "Agriculture & Food",
        "Corporate",
        "Employment",
    ],
    "defense": [
        "Military",
        "Armament",
        "Terrorism",
        "Nuclear Weapons",
    ],
    "technology": [
        "Digital & AI",
        "Hardware",
        "Telecom",
        "Space",
        "Platforms & Internet",
        "Science & Research",
    ],
    "cyber": [
        "Attacks",
        "Threat Actors",
        "Vulnerabilities",
        "Detection",
        "Cyber Policy",
    ],
    "energy": [
        "Fossil",
        "Nuclear",
        "Renewables",
        "Energy Markets",
        "Policy & Grid",
    ],
    "health": [
        "Diseases",
        "Pharma & Biotech",
        "Public Health",
        "Healthcare Systems",
    ],
    "environment": [
        "Climate",
        "Disasters",
        "Sustainability",
        "Resources",
    ],
    "society": [
        "Migration",
        "Rights & Justice",
        "Organized Crime",
        "Education & Culture",
        "Religion",
        "Information & Media",
        "Labor",
    ],
    "foundation": [
        "Companies",
        "Industries",
        "Organizations",
        "People",
    ],
    "geo": [
        "Global",
        "Europe",
        "North America",
        "Asia-Pacific",
        "Middle East",
        "Africa",
        "Latin America",
        "Central Asia",
    ],
    "mute": [
        "Noise",
        "Entertainment",
    ],
}

# Short reference descriptions per section — used for Gemma embedding classification.
# Short descriptions (15-25 words) give better discrimination with Gemma 300m.
# Regenerate via scripts/gen_section_descriptions.py when sections change.
SECTION_DESCRIPTIONS: dict[tuple[str, str], str] = {
    ("politics", "Geopolitics"): "International relations, diplomacy, foreign affairs, alliances, treaties, global power dynamics, diplomatic conflicts.",
    ("politics", "Governance"): "Elections, government, policy-making, public administration, political systems, democratic processes, legislative reforms.",
    ("politics", "Legal & Regulation"): "Laws, regulations, court decisions, regulatory frameworks, legislative actions, legal systems, compliance.",
    ("politics", "Conflicts & Crises"): "Armed conflicts, wars, political instability, civil unrest, humanitarian crises, coups, sanctions.",
    ("politics", "Social Movements"): "Protests, demonstrations, activism, social movements, civil rights campaigns, grassroots mobilization.",
    ("politics", "Intelligence & Influence"): "Espionage, intelligence, covert operations, disinformation, propaganda, foreign interference, surveillance.",
    ("economy", "Macroeconomics"): "GDP, inflation, interest rates, recession, economic growth, fiscal policy, monetary policy, central banks.",
    ("economy", "Finance & Markets"): "Stock markets, banking, investments, bonds, currencies, financial regulation, IPOs, capital flows.",
    ("economy", "Trade & Commodities"): "International trade, tariffs, commodities, raw materials, exports, imports, trade agreements.",
    ("economy", "Supply Chains"): "Logistics, supply chain disruptions, shipping, manufacturing, sourcing, shortages, distribution.",
    ("economy", "Infrastructure"): "Transportation, railways, ports, airports, roads, energy grids, public works, construction projects.",
    ("economy", "Agriculture & Food"): "Farming, food production, agriculture, crop yields, livestock, food security, agribusiness.",
    ("economy", "Corporate"): "Mergers, acquisitions, company earnings, corporate strategy, business news, startups, bankruptcies.",
    ("economy", "Employment"): "Jobs, unemployment, wages, labor market, hiring, layoffs, strikes, workforce trends.",
    ("defense", "Military"): "Military operations, armed forces, troop deployments, defense spending, navy, air force, army exercises.",
    ("defense", "Armament"): "Weapons, missiles, drones, defense industry, arms trade, military technology, procurement.",
    ("defense", "Terrorism"): "Terrorist attacks, extremism, counter-terrorism, radicalization, security threats, bombings.",
    ("defense", "Nuclear Weapons"): "Nuclear weapons, proliferation, deterrence, atomic arsenal, ICBMs, disarmament treaties.",
    ("technology", "Digital & AI"): "Artificial intelligence, machine learning, software, cloud computing, blockchain, digital transformation.",
    ("technology", "Hardware"): "Semiconductors, microchips, processors, electronics, robotics, IoT devices, quantum computing.",
    ("technology", "Telecom"): "Telecommunications, 5G, mobile networks, broadband, fiber optics, internet connectivity.",
    ("technology", "Space"): "Space exploration, satellites, rockets, NASA, SpaceX, astronauts, lunar missions, Mars.",
    ("technology", "Platforms & Internet"): "Social media, online platforms, content moderation, data privacy, digital regulation, e-commerce.",
    ("technology", "Science & Research"): "Scientific discoveries, research, academic studies, innovation, patents, laboratories.",
    ("cyber", "Attacks"): "Cyberattacks, ransomware, malware, phishing, data breaches, hacking, network intrusions.",
    ("cyber", "Threat Actors"): "APT groups, state-sponsored hackers, cybercriminals, hacktivists, ransomware gangs.",
    ("cyber", "Vulnerabilities"): "CVEs, zero-day exploits, software vulnerabilities, security flaws, patch management.",
    ("cyber", "Detection"): "Threat detection, SIEM, incident response, security monitoring, forensics, threat intelligence.",
    ("cyber", "Cyber Policy"): "Cybersecurity regulation, digital sovereignty, data protection laws, GDPR, cyber governance.",
    ("energy", "Fossil"): "Oil, petroleum, natural gas, coal, fossil fuels, drilling, refineries, pipelines.",
    ("energy", "Nuclear"): "Nuclear power plants, reactors, uranium, atomic energy, fusion, nuclear safety.",
    ("energy", "Renewables"): "Solar, wind, hydroelectric, geothermal, renewable energy, batteries, clean power.",
    ("energy", "Energy Markets"): "Oil prices, OPEC, energy trading, electricity markets, gas prices, energy supply.",
    ("energy", "Policy & Grid"): "Energy policy, power grid, energy transition, smart grids, decarbonization.",
    ("health", "Diseases"): "Epidemics, pandemics, infectious diseases, cancer, diabetes, heart disease, medical conditions.",
    ("health", "Pharma & Biotech"): "Pharmaceuticals, drug development, clinical trials, biotechnology, gene therapy, vaccines.",
    ("health", "Public Health"): "Public health policy, vaccination campaigns, disease prevention, WHO, sanitation.",
    ("health", "Healthcare Systems"): "Hospitals, healthcare access, health insurance, medical services, patient care.",
    ("environment", "Climate"): "Climate change, global warming, greenhouse gases, emissions, COP, extreme weather.",
    ("environment", "Disasters"): "Earthquakes, floods, wildfires, hurricanes, tsunamis, volcanic eruptions, industrial accidents.",
    ("environment", "Sustainability"): "ESG, conservation, biodiversity, pollution, recycling, circular economy, environmental protection.",
    ("environment", "Resources"): "Water scarcity, deforestation, mining, natural resources, minerals, land use.",
    ("society", "Migration"): "Immigration, refugees, asylum seekers, border control, displacement, migration policy.",
    ("society", "Rights & Justice"): "Human rights, civil liberties, social justice, discrimination, equality, criminal justice.",
    ("society", "Organized Crime"): "Drug trafficking, cartels, mafia, money laundering, human trafficking, organized crime.",
    ("society", "Education & Culture"): "Schools, universities, education policy, arts, museums, cultural heritage, literature.",
    ("society", "Religion"): "Religious institutions, interfaith, sectarianism, religious freedom, spirituality.",
    ("society", "Information & Media"): "Journalism, press freedom, disinformation, censorship, media ethics, fake news.",
    ("society", "Labor"): "Labor rights, unions, working conditions, strikes, employment law, gig economy.",
    ("mute", "Noise"): "Sports scores, game results, tournament brackets, job postings, obituaries, recipes, horoscopes.",
    ("mute", "Entertainment"): "Movies, TV shows, music, celebrities, gaming, award shows, pop culture.",
}

# Flat set for fast validation
VALID_FAMILIES = set(FAMILIES.keys())
VALID_PAIRS = {
    (fam, sec) for fam, secs in SECTIONS.items() for sec in secs
}


def is_valid(family: str, section: str) -> bool:
    return (family, section) in VALID_PAIRS
