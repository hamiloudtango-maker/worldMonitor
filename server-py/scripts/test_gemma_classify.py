"""Test Gemma classification with short descriptions on 500 unclassified articles."""
import asyncio
import numpy as np
import sys
sys.path.insert(0, ".")

SHORT_DESCS = {
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


async def main():
    from app.db import async_session
    from sqlalchemy import select
    from app.models.article import Article
    from app.models.intel_model import IntelModel
    from app.source_engine.matching_engine import load_models

    async with async_session() as db:
        models = (await db.execute(select(IntelModel))).scalars().all()
        load_models(models)
        articles = (await db.execute(
            select(Article).where((Article.family == None) | (Article.family == "")).limit(500)
        )).scalars().all()

    # Thematic only
    thematic = {k: v for k, v in SHORT_DESCS.items() if k[0] not in ("geo", "foundation")}
    keys = list(thematic.keys())
    texts = list(thematic.values())

    from sentence_transformers import SentenceTransformer
    enc = SentenceTransformer("google/embeddinggemma-300m", trust_remote_code=True)
    sec_vecs = enc.encode(texts, normalize_embeddings=True, batch_size=64)

    art_texts = [(a.title or "") + " " + (a.description or "")[:200] for a in articles]
    art_vecs = enc.encode(art_texts, normalize_embeddings=True, batch_size=64)
    sim = np.dot(art_vecs, sec_vecs.T)

    for t in [0.15, 0.20, 0.25, 0.30]:
        above = sum(1 for i in range(len(articles)) if float(np.max(sim[i])) >= t)
        print(f"Threshold {t}: {above}/{len(articles)} ({above*100//len(articles)}%)")

    print()
    shown = 0
    for i in range(len(articles)):
        best_idx = int(np.argmax(sim[i]))
        score = float(sim[i][best_idx])
        if score >= 0.20 and shown < 15:
            fam, sec = keys[best_idx]
            title = (articles[i].title or "")[:55]
            print(f"  {score:.3f} {fam}/{sec}: {title}")
            shown += 1


asyncio.run(main())
