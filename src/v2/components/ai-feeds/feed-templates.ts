// src/v2/components/ai-feeds/feed-templates.ts
import type { QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

export interface FeedTemplate {
  id: string;
  name: string;
  description?: string;
  chip1: { label: string; type: QueryPart['type']; icon: string };
  chip2: { label: string; type: QueryPart['type']; icon: string; placeholder: string };
}

export interface DropdownCategory {
  label: string;
  icon: string;
  type: 'suggested' | 'model';
  hasSubmenu?: boolean;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: 'strategy' | 'cyber' | 'finance' | 'defense' | 'health' | 'climate' | 'tech';
  searchPlaceholder: string;
  templates: FeedTemplate[];
  dropdownCategories: DropdownCategory[];
}

export const TABS: TabConfig[] = [
  {
    id: 'strategic',
    label: 'Veille Stratégique',
    icon: 'strategy',
    searchPlaceholder: 'Rechercher un sujet, une région, un secteur ou un acteur...',
    templates: [
      {
        id: 'conflicts',
        name: 'Conflits & Crises',
        description: 'Armed conflicts, wars, military operations, ceasefire negotiations, humanitarian crises',
        chip1: { label: 'Conflits armés', type: 'topic', icon: 'swords' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone à surveiller' },
      },
      {
        id: 'diplomacy',
        name: 'Diplomatie & Sanctions',
        description: 'International diplomacy, sanctions, embargoes, treaties, UN resolutions, bilateral relations',
        chip1: { label: 'Sanctions', type: 'topic', icon: 'gavel' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: "Choisir le pays ou l'entité" },
      },
      {
        id: 'energy',
        name: 'Énergie & Ressources',
        description: 'Oil, gas, nuclear, renewables, mining, critical minerals, OPEC, energy security, pipelines',
        chip1: { label: 'Énergie', type: 'topic', icon: 'zap' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone ou le secteur' },
      },
      {
        id: 'economy',
        name: 'Économie & M&A',
        description: 'Mergers & acquisitions, trade wars, economic sanctions, GDP, inflation, central banks',
        chip1: { label: 'M&A', type: 'topic', icon: 'trending-up' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur à surveiller' },
      },
      {
        id: 'nuclear',
        name: 'Nucléaire',
        description: 'Nuclear energy, weapons, proliferation, IAEA, uranium, reactors, nuclear policy',
        chip1: { label: 'Nucléaire', type: 'topic', icon: 'atom' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays' },
      },
      {
        id: 'migration',
        name: 'Migrations & Réfugiés',
        description: 'Refugee flows, displacement, migration policy, border control, UNHCR, asylum',
        chip1: { label: 'Migrations', type: 'topic', icon: 'users' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la région' },
      },
      {
        id: 'terrorism',
        name: 'Terrorisme & Radicalisation',
        description: 'Terrorist attacks, radicalization, counter-terrorism, extremism, ISIS, Al-Qaeda',
        chip1: { label: 'Terrorisme', type: 'topic', icon: 'alert-octagon' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone' },
      },
      {
        id: 'elections',
        name: 'Élections & Politique',
        description: 'Elections, political transitions, protests, coups, governance, democratic processes',
        chip1: { label: 'Élections', type: 'topic', icon: 'vote' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays' },
      },
    ],
    dropdownCategories: [
      { label: 'Région / Pays', icon: 'globe', type: 'suggested', hasSubmenu: true },
      { label: 'Organisations internationales', icon: 'landmark', type: 'model', hasSubmenu: true },
      { label: 'Secteurs industriels', icon: 'factory', type: 'model', hasSubmenu: true },
      { label: 'Matières premières', icon: 'gem', type: 'model', hasSubmenu: true },
      { label: 'Acteurs étatiques', icon: 'crown', type: 'model', hasSubmenu: true },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Climat & Environnement', icon: 'cloud-sun', type: 'model', hasSubmenu: true },
    ],
  },
  {
    id: 'cyber',
    label: 'Veille Cyber',
    icon: 'cyber',
    searchPlaceholder: 'Rechercher un acteur, une vulnérabilité ou un sujet cyber...',
    templates: [
      {
        id: 'ransomware',
        name: 'Ransomware & Malware',
        description: 'Ransomware attacks, malware campaigns, trojans, worms, botnet operations',
        chip1: { label: 'Ransomware', type: 'topic', icon: 'bug' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur ciblé' },
      },
      {
        id: 'apt',
        name: 'APT & Acteurs',
        description: 'Advanced Persistent Threats, state-sponsored hackers, threat actors, cyber espionage',
        chip1: { label: 'Threat Actor', type: 'topic', icon: 'skull' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: "Choisir la zone d'origine" },
      },
      {
        id: 'vulns',
        name: 'Vulnérabilités Critiques',
        description: 'CVE, zero-day, critical vulnerabilities, patch management, exploit chains',
        chip1: { label: 'Vulnérabilité haute', type: 'topic', icon: 'alert-triangle' },
        chip2: { label: 'Technologie', type: 'entity', icon: 'cpu', placeholder: 'Choisir la technologie affectée' },
      },
      {
        id: 'breaches',
        name: 'Data Breaches',
        description: 'Data leaks, breaches, exposed databases, credential dumps, privacy violations',
        chip1: { label: 'Data Breach', type: 'topic', icon: 'database' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur impacté' },
      },
      {
        id: 'infrastructure',
        name: 'Infra & SCADA',
        description: 'Critical infrastructure attacks, SCADA/ICS vulnerabilities, power grid, water systems',
        chip1: { label: 'Infrastructure critique', type: 'topic', icon: 'server' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur' },
      },
      {
        id: 'cyber-policy',
        name: 'Réglementation Cyber',
        description: 'Cybersecurity regulations, NIS2, DORA, GDPR enforcement, national cyber strategies',
        chip1: { label: 'Réglementation cyber', type: 'topic', icon: 'shield' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la région' },
      },
    ],
    dropdownCategories: [
      { label: 'Secteur', icon: 'building', type: 'suggested', hasSubmenu: true },
      { label: 'Threat Actors', icon: 'skull', type: 'model', hasSubmenu: true },
      { label: 'Malware', icon: 'bug', type: 'model', hasSubmenu: true },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Frameworks (MITRE)', icon: 'shield', type: 'model', hasSubmenu: true },
      { label: "Régions d'origine", icon: 'globe', type: 'model', hasSubmenu: true },
    ],
  },
  {
    id: 'defense',
    label: 'Défense & Militaire',
    icon: 'defense',
    searchPlaceholder: 'Rechercher une capacité, une opération ou un programme...',
    templates: [
      {
        id: 'arms',
        name: 'Armement & Industrie',
        description: 'Arms industry, defense contracts, weapons systems, military exports, procurement',
        chip1: { label: 'Armement', type: 'topic', icon: 'target' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays' },
      },
      {
        id: 'operations',
        name: 'Opérations militaires',
        description: 'Military operations, deployments, exercises, NATO operations, peacekeeping missions',
        chip1: { label: 'Opérations militaires', type: 'topic', icon: 'radar' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone' },
      },
      {
        id: 'naval',
        name: 'Maritime & Naval',
        description: 'Naval operations, maritime security, piracy, chokepoints, strait of Hormuz, South China Sea',
        chip1: { label: 'Maritime', type: 'topic', icon: 'anchor' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone maritime' },
      },
      {
        id: 'space-defense',
        name: 'Espace & Satellites',
        description: 'Space militarization, satellite warfare, anti-satellite weapons, space defense programs',
        chip1: { label: 'Défense spatiale', type: 'topic', icon: 'satellite' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays' },
      },
    ],
    dropdownCategories: [
      { label: 'Pays / Alliance', icon: 'flag', type: 'suggested', hasSubmenu: true },
      { label: 'Systèmes d\'armes', icon: 'target', type: 'model', hasSubmenu: true },
      { label: 'Forces armées', icon: 'shield', type: 'model', hasSubmenu: true },
      { label: 'Industriels défense', icon: 'factory', type: 'model', hasSubmenu: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Marchés',
    icon: 'finance',
    searchPlaceholder: 'Rechercher un marché, un actif ou un indicateur...',
    templates: [
      {
        id: 'forex',
        name: 'Devises & Forex',
        description: 'Foreign exchange, currency markets, dollar, euro, yen, emerging market currencies',
        chip1: { label: 'Forex', type: 'topic', icon: 'banknote' },
        chip2: { label: 'Devise', type: 'entity', icon: 'coins', placeholder: 'Choisir la devise' },
      },
      {
        id: 'commodities',
        name: 'Matières premières',
        description: 'Oil, gold, copper, lithium, rare earths, agricultural commodities, commodity prices',
        chip1: { label: 'Commodities', type: 'topic', icon: 'gem' },
        chip2: { label: 'Matière', type: 'entity', icon: 'gem', placeholder: 'Choisir la matière' },
      },
      {
        id: 'crypto',
        name: 'Crypto & DeFi',
        description: 'Bitcoin, Ethereum, stablecoins, DeFi protocols, crypto regulation, CBDC',
        chip1: { label: 'Crypto', type: 'topic', icon: 'bitcoin' },
        chip2: { label: 'Actif', type: 'entity', icon: 'coins', placeholder: 'Choisir le token/protocole' },
      },
      {
        id: 'central-banks',
        name: 'Banques centrales',
        description: 'Fed, ECB, BoJ, interest rates, monetary policy, quantitative easing, inflation targeting',
        chip1: { label: 'Banques centrales', type: 'topic', icon: 'landmark' },
        chip2: { label: 'Institution', type: 'entity', icon: 'landmark', placeholder: 'Choisir la banque centrale' },
      },
    ],
    dropdownCategories: [
      { label: 'Marchés', icon: 'trending-up', type: 'suggested', hasSubmenu: true },
      { label: 'Secteurs', icon: 'building', type: 'model', hasSubmenu: true },
      { label: 'Indicateurs', icon: 'bar-chart', type: 'model', hasSubmenu: true },
    ],
  },
  {
    id: 'climate',
    label: 'Climat & Environnement',
    icon: 'climate',
    searchPlaceholder: 'Rechercher un sujet environnemental ou climatique...',
    templates: [
      {
        id: 'climate-policy',
        name: 'Politique climatique',
        description: 'Paris agreement, COP summits, carbon markets, net zero, climate finance, green deal',
        chip1: { label: 'Politique climatique', type: 'topic', icon: 'leaf' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays' },
      },
      {
        id: 'disasters',
        name: 'Catastrophes naturelles',
        description: 'Earthquakes, floods, hurricanes, wildfires, tsunamis, volcanic eruptions, droughts',
        chip1: { label: 'Catastrophes', type: 'topic', icon: 'alert-triangle' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la région' },
      },
      {
        id: 'pollution',
        name: 'Pollution & Biodiversité',
        description: 'Air pollution, ocean pollution, deforestation, species extinction, environmental disasters',
        chip1: { label: 'Pollution', type: 'topic', icon: 'cloud-rain' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone' },
      },
    ],
    dropdownCategories: [
      { label: 'Région', icon: 'globe', type: 'suggested', hasSubmenu: true },
      { label: 'Secteurs polluants', icon: 'factory', type: 'model', hasSubmenu: true },
      { label: 'Accords internationaux', icon: 'landmark', type: 'model', hasSubmenu: true },
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Innovation',
    icon: 'tech',
    searchPlaceholder: 'Rechercher une technologie, une entreprise ou un sujet...',
    templates: [
      {
        id: 'ai',
        name: 'Intelligence artificielle',
        description: 'AI regulation, LLMs, deep learning, AI safety, OpenAI, Google DeepMind, AI ethics',
        chip1: { label: 'Intelligence artificielle', type: 'topic', icon: 'brain' },
        chip2: { label: 'Entreprise', type: 'entity', icon: 'building', placeholder: 'Choisir une entreprise' },
      },
      {
        id: 'semiconductors',
        name: 'Semi-conducteurs',
        description: 'Chip manufacturing, TSMC, NVIDIA, chip export controls, semiconductor supply chain',
        chip1: { label: 'Semi-conducteurs', type: 'topic', icon: 'chip' },
        chip2: { label: 'Entreprise', type: 'entity', icon: 'building', placeholder: 'Choisir un fabricant' },
      },
      {
        id: 'space',
        name: 'Espace & NewSpace',
        description: 'SpaceX, satellite constellations, space exploration, NASA, ESA, Starlink, moon missions',
        chip1: { label: 'Espace', type: 'topic', icon: 'rocket' },
        chip2: { label: 'Agence/Entreprise', type: 'entity', icon: 'building', placeholder: 'Choisir' },
      },
      {
        id: 'biotech',
        name: 'Biotech & Santé',
        description: 'Biotech, pharma, pandemics, vaccines, WHO, drug approvals, gene therapy, health policy',
        chip1: { label: 'Biotech', type: 'topic', icon: 'dna' },
        chip2: { label: 'Domaine', type: 'entity', icon: 'heart', placeholder: 'Choisir le domaine' },
      },
      {
        id: 'quantum',
        name: 'Quantique',
        description: 'Quantum computing, quantum cryptography, post-quantum security, IBM, Google Quantum',
        chip1: { label: 'Quantique', type: 'topic', icon: 'atom' },
        chip2: { label: 'Entreprise', type: 'entity', icon: 'building', placeholder: 'Choisir' },
      },
    ],
    dropdownCategories: [
      { label: 'Entreprises', icon: 'building', type: 'suggested', hasSubmenu: true },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Régulateurs', icon: 'landmark', type: 'model', hasSubmenu: true },
    ],
  },
];

/** Convert template selection + chip2 value into a FeedQuery */
export function templateToQuery(
  template: FeedTemplate,
  chip2Value: string,
): FeedQuery {
  return {
    layers: [
      {
        operator: 'OR',
        parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }],
      },
      {
        operator: 'OR',
        parts: [{ type: template.chip2.type, value: chip2Value, scope: 'title_and_content' }],
      },
    ],
  };
}
