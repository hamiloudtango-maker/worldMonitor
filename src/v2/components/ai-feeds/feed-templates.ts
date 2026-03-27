// src/v2/components/ai-feeds/feed-templates.ts
import type { QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

export interface SuggestedFilter {
  label: string;
  aliases: string[];
  type: QueryPart['type'];
}

export interface SuggestedGroup {
  name: string;
  icon: string;
  filters: SuggestedFilter[];
}

export interface FeedTemplate {
  id: string;
  name: string;
  description?: string;
  chip1: { label: string; type: QueryPart['type']; icon: string };
  suggestions: SuggestedGroup[];
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  searchPlaceholder: string;
  templates: FeedTemplate[];
}

export const TABS: TabConfig[] = [
  {
    id: 'strategic',
    label: 'Veille Strategique',
    icon: 'strategy',
    searchPlaceholder: 'Rechercher un sujet, une region, un secteur...',
    templates: [
      {
        id: 'conflicts',
        name: 'Conflits & Crises',
        description: 'Armed conflicts, wars, military operations, ceasefire negotiations',
        chip1: { label: 'Conflits armes', type: 'topic', icon: 'swords' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Guerre', aliases: ['war', 'armed conflict', 'guerra', 'Krieg', 'война'], type: 'keyword' },
            { label: 'Cessez-le-feu', aliases: ['ceasefire', 'truce', 'armistice', 'alto el fuego', 'Waffenstillstand'], type: 'keyword' },
            { label: 'Frappe aerienne', aliases: ['airstrike', 'bombing', 'bombardement', 'Luftangriff'], type: 'keyword' },
            { label: 'Offensive terrestre', aliases: ['ground offensive', 'invasion', 'ground operation'], type: 'keyword' },
            { label: 'Victimes civiles', aliases: ['civilian casualties', 'civilian deaths', 'zivile Opfer'], type: 'keyword' },
            { label: 'Aide humanitaire', aliases: ['humanitarian aid', 'relief', 'aide humanitaire', 'humanitare Hilfe'], type: 'keyword' },
          ]},
          { name: 'Regions', icon: 'globe', filters: [
            { label: 'Ukraine', aliases: ['Donbas', 'Crimea', 'Zelensky', 'Україна', 'Crimee'], type: 'entity' },
            { label: 'Moyen-Orient', aliases: ['Middle East', 'Iran', 'Israel', 'Gaza', 'Hezbollah', 'الشرق الأوسط'], type: 'entity' },
            { label: 'Sahel', aliases: ['Mali', 'Burkina Faso', 'Niger', 'Sahel region', 'Wagner'], type: 'entity' },
            { label: 'Asie-Pacifique', aliases: ['Taiwan', 'South China Sea', 'mer de Chine', 'Indo-Pacific'], type: 'entity' },
            { label: 'Corne de l\'Afrique', aliases: ['Horn of Africa', 'Somalia', 'Ethiopia', 'Sudan', 'Soudan'], type: 'entity' },
          ]},
          { name: 'Acteurs', icon: 'users', filters: [
            { label: 'OTAN', aliases: ['NATO', 'North Atlantic Treaty Organization', 'Alliance atlantique', 'НАТО'], type: 'entity' },
            { label: 'ONU', aliases: ['UN', 'United Nations', 'Nations Unies', 'CSNU', 'Security Council'], type: 'entity' },
            { label: 'Russie', aliases: ['Russia', 'Kremlin', 'Moscow', 'Putin', 'Россия', 'Moscou'], type: 'entity' },
            { label: 'Chine', aliases: ['China', 'Beijing', 'PLA', 'Pekin', '中国'], type: 'entity' },
            { label: 'Etats-Unis', aliases: ['United States', 'USA', 'Pentagon', 'White House', 'Washington'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'diplomacy',
        name: 'Diplomatie & Sanctions',
        description: 'International diplomacy, sanctions, embargoes, treaties',
        chip1: { label: 'Diplomatie', type: 'topic', icon: 'gavel' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Sanctions economiques', aliases: ['economic sanctions', 'embargo', 'trade restrictions', 'Wirtschaftssanktionen'], type: 'keyword' },
            { label: 'Negociations', aliases: ['negotiations', 'talks', 'summit', 'sommet', 'pourparlers', 'Verhandlungen'], type: 'keyword' },
            { label: 'Traite international', aliases: ['treaty', 'agreement', 'accord', 'Abkommen', 'international deal'], type: 'keyword' },
            { label: 'Expulsion diplomatique', aliases: ['diplomatic expulsion', 'ambassador recalled', 'persona non grata'], type: 'keyword' },
            { label: 'Resolution ONU', aliases: ['UN resolution', 'Security Council vote', 'resolution du Conseil'], type: 'keyword' },
          ]},
          { name: 'Organisations', icon: 'landmark', filters: [
            { label: 'G7/G20', aliases: ['G7', 'G20', 'Group of Seven', 'Group of Twenty'], type: 'entity' },
            { label: 'Union Europeenne', aliases: ['EU', 'European Union', 'Brussels', 'Bruxelles', 'Commission europeenne'], type: 'entity' },
            { label: 'BRICS', aliases: ['BRICS+', 'BRICS nations', 'emerging economies'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'energy',
        name: 'Energie & Ressources',
        description: 'Oil, gas, nuclear, renewables, mining, critical minerals',
        chip1: { label: 'Energie', type: 'topic', icon: 'zap' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Petrole & Gaz', aliases: ['oil', 'gas', 'petroleum', 'crude oil', 'petrole', 'gaz naturel', 'LNG', 'Erdol'], type: 'keyword' },
            { label: 'Nucleaire', aliases: ['nuclear', 'uranium', 'reactor', 'IAEA', 'nucleaire', 'Kernenergie', 'ядерный'], type: 'keyword' },
            { label: 'Renouvelables', aliases: ['renewable', 'solar', 'wind', 'hydrogen', 'solaire', 'eolien', 'hydrogene'], type: 'keyword' },
            { label: 'Pipeline', aliases: ['pipeline', 'gazoduc', 'oleoduc', 'Nord Stream', 'transit'], type: 'keyword' },
            { label: 'Prix de l\'energie', aliases: ['energy prices', 'oil price', 'gas price', 'prix du petrole', 'cours du brut'], type: 'keyword' },
          ]},
          { name: 'Matieres premieres', icon: 'gem', filters: [
            { label: 'Lithium', aliases: ['lithium mining', 'lithium-ion', 'battery metals', 'extraction lithium'], type: 'entity' },
            { label: 'Terres rares', aliases: ['rare earths', 'rare earth elements', 'REE', 'seltene Erden'], type: 'entity' },
            { label: 'Cobalt', aliases: ['cobalt mining', 'DRC cobalt', 'cobalt supply'], type: 'entity' },
            { label: 'Cuivre', aliases: ['copper', 'copper mining', 'Kupfer'], type: 'entity' },
          ]},
          { name: 'Acteurs', icon: 'building', filters: [
            { label: 'OPEP+', aliases: ['OPEC', 'OPEC+', 'OPEP', 'OPEP+', 'Saudi Arabia oil', 'production cuts'], type: 'entity' },
            { label: 'AIEA', aliases: ['IAEA', 'International Atomic Energy Agency', 'Agence internationale de l\'energie atomique'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'economy',
        name: 'Economie & M&A',
        description: 'Mergers & acquisitions, trade wars, economic policy',
        chip1: { label: 'Economie', type: 'topic', icon: 'trending-up' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Fusions & Acquisitions', aliases: ['M&A', 'merger', 'acquisition', 'takeover', 'rachat', 'fusion', 'Ubernahme'], type: 'keyword' },
            { label: 'Introduction en bourse', aliases: ['IPO', 'initial public offering', 'listing', 'entree en bourse', 'Borsengang'], type: 'keyword' },
            { label: 'Levee de fonds', aliases: ['funding round', 'venture capital', 'Series A', 'investment', 'fundraising'], type: 'keyword' },
            { label: 'Partenariat strategique', aliases: ['strategic partnership', 'joint venture', 'alliance', 'partenariat'], type: 'keyword' },
            { label: 'Restructuration', aliases: ['restructuring', 'layoffs', 'cost cutting', 'licenciements', 'plan social'], type: 'keyword' },
            { label: 'Expansion geographique', aliases: ['geographic expansion', 'market entry', 'new market', 'expansion'], type: 'keyword' },
            { label: 'Brevets', aliases: ['patent', 'intellectual property', 'brevet', 'IP filing', 'Patent'], type: 'keyword' },
            { label: 'Nouveaux contrats', aliases: ['new deal', 'contract award', 'deal signed', 'contrat', 'Vertrag'], type: 'keyword' },
          ]},
          { name: 'Secteurs', icon: 'building', filters: [
            { label: 'Tech & IA', aliases: ['technology', 'artificial intelligence', 'AI', 'machine learning', 'intelligence artificielle'], type: 'entity' },
            { label: 'Pharma & Biotech', aliases: ['pharmaceutical', 'biotech', 'drug approval', 'clinical trial', 'pharma'], type: 'entity' },
            { label: 'Defense & Aeronautique', aliases: ['defense industry', 'aerospace', 'arms deal', 'defense contract'], type: 'entity' },
            { label: 'Finance & Banque', aliases: ['banking', 'fintech', 'central bank', 'banque', 'financial services'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'nuclear',
        name: 'Nucleaire',
        description: 'Nuclear energy, weapons, proliferation, IAEA, uranium',
        chip1: { label: 'Nucleaire', type: 'topic', icon: 'atom' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Energie nucleaire', aliases: ['nuclear energy', 'nuclear power', 'reactor', 'centrale nucleaire', 'Kernenergie', 'ядерная энергия'], type: 'keyword' },
            { label: 'Armes nucleaires', aliases: ['nuclear weapons', 'warhead', 'missile', 'armes nucleaires', 'Atomwaffen', 'ядерное оружие'], type: 'keyword' },
            { label: 'Proliferation', aliases: ['nuclear proliferation', 'enrichment', 'enrichissement', 'centrifuges'], type: 'keyword' },
            { label: 'Uranium', aliases: ['uranium mining', 'yellowcake', 'uranium enrichment', 'extraction uranium'], type: 'keyword' },
            { label: 'SMR', aliases: ['small modular reactor', 'mini-reacteur', 'petit reacteur modulaire'], type: 'keyword' },
            { label: 'Fusion', aliases: ['nuclear fusion', 'fusion energy', 'ITER', 'tokamak', 'energie de fusion'], type: 'keyword' },
          ]},
          { name: 'Pays', icon: 'flag', filters: [
            { label: 'Iran', aliases: ['Iran nuclear', 'JCPOA', 'Iranian nuclear program', 'programme nucleaire iranien', 'Teheran'], type: 'entity' },
            { label: 'Coree du Nord', aliases: ['North Korea', 'DPRK', 'Pyongyang', 'Kim Jong Un', 'missile test'], type: 'entity' },
            { label: 'France', aliases: ['EDF', 'Orano', 'Framatome', 'parc nucleaire francais', 'ASN'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'elections',
        name: 'Elections & Politique',
        description: 'Elections, political transitions, protests, governance',
        chip1: { label: 'Elections', type: 'topic', icon: 'vote' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Elections', aliases: ['election', 'vote', 'ballot', 'polling', 'scrutin', 'Wahl', 'выборы'], type: 'keyword' },
            { label: 'Coup d\'etat', aliases: ['coup', 'military takeover', 'putsch', 'coup d\'etat', 'Staatsstreich'], type: 'keyword' },
            { label: 'Manifestations', aliases: ['protest', 'demonstration', 'unrest', 'manifestation', 'Demonstration', 'протест'], type: 'keyword' },
            { label: 'Reforme politique', aliases: ['political reform', 'constitutional change', 'reforme', 'governance'], type: 'keyword' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'cyber',
    label: 'Veille Cyber',
    icon: 'cyber',
    searchPlaceholder: 'Rechercher un acteur, une vulnerabilite ou un sujet cyber...',
    templates: [
      {
        id: 'ransomware',
        name: 'Ransomware & Malware',
        description: 'Ransomware attacks, malware campaigns, trojans, botnets',
        chip1: { label: 'Ransomware', type: 'topic', icon: 'bug' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Ransomware', aliases: ['ransomware attack', 'ransom', 'rancongiciel', 'chiffrement', 'Erpressungstrojaner'], type: 'keyword' },
            { label: 'Malware', aliases: ['malware', 'trojan', 'worm', 'virus', 'logiciel malveillant', 'Schadsoftware'], type: 'keyword' },
            { label: 'Botnet', aliases: ['botnet', 'C2 server', 'command and control', 'reseau de bots'], type: 'keyword' },
            { label: 'Phishing', aliases: ['phishing', 'spear phishing', 'social engineering', 'hameconnage'], type: 'keyword' },
          ]},
          { name: 'Secteurs cibles', icon: 'building', filters: [
            { label: 'Sante', aliases: ['healthcare', 'hospital', 'hopital', 'medical', 'Gesundheitswesen'], type: 'entity' },
            { label: 'Finance', aliases: ['banking', 'financial sector', 'banque', 'financial services'], type: 'entity' },
            { label: 'Infrastructure critique', aliases: ['critical infrastructure', 'SCADA', 'ICS', 'OT', 'infrastructure critique'], type: 'entity' },
            { label: 'Gouvernement', aliases: ['government', 'public sector', 'administration', 'gouvernement'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'apt',
        name: 'APT & Acteurs',
        description: 'Advanced Persistent Threats, state-sponsored hackers',
        chip1: { label: 'Threat Actor', type: 'topic', icon: 'skull' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'APT', aliases: ['APT group', 'advanced persistent threat', 'state-sponsored', 'cyber espionage'], type: 'keyword' },
            { label: 'Zero-day', aliases: ['zero-day', '0-day', 'zero day exploit', 'faille zero-day'], type: 'keyword' },
            { label: 'Supply chain attack', aliases: ['supply chain', 'software supply chain', 'third-party compromise'], type: 'keyword' },
          ]},
          { name: 'Groupes', icon: 'skull', filters: [
            { label: 'Fancy Bear / APT28', aliases: ['Fancy Bear', 'APT28', 'GRU', 'Sofacy', 'Sednit'], type: 'entity' },
            { label: 'Lazarus', aliases: ['Lazarus Group', 'DPRK hackers', 'Hidden Cobra', 'APT38'], type: 'entity' },
            { label: 'APT29 / Cozy Bear', aliases: ['Cozy Bear', 'APT29', 'SVR', 'Nobelium', 'Midnight Blizzard'], type: 'entity' },
            { label: 'Volt Typhoon', aliases: ['Volt Typhoon', 'BRONZE SILHOUETTE', 'Chinese hackers', 'PRC cyber'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'vulns',
        name: 'Vulnerabilites Critiques',
        description: 'CVE, zero-day, critical vulnerabilities, patch management',
        chip1: { label: 'Vulnerabilite', type: 'topic', icon: 'alert-triangle' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'CVE critique', aliases: ['CVE', 'critical vulnerability', 'CVSS', 'vulnerabilite critique', 'faille critique'], type: 'keyword' },
            { label: 'Exploit', aliases: ['exploit', 'proof of concept', 'PoC', 'exploitation', 'remote code execution', 'RCE'], type: 'keyword' },
            { label: 'Patch', aliases: ['patch', 'security update', 'hotfix', 'correctif', 'mise a jour de securite'], type: 'keyword' },
          ]},
          { name: 'Technologies', icon: 'cpu', filters: [
            { label: 'Microsoft', aliases: ['Windows', 'Exchange', 'Azure', 'Office 365', 'Active Directory'], type: 'entity' },
            { label: 'Linux / Open Source', aliases: ['Linux', 'kernel', 'Apache', 'OpenSSL', 'open source'], type: 'entity' },
            { label: 'Cloud', aliases: ['AWS', 'Azure', 'GCP', 'cloud security', 'cloud vulnerability'], type: 'entity' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'defense',
    label: 'Defense & Militaire',
    icon: 'defense',
    searchPlaceholder: 'Rechercher une capacite, une operation ou un programme...',
    templates: [
      {
        id: 'arms',
        name: 'Armement & Industrie',
        description: 'Arms industry, defense contracts, weapons systems',
        chip1: { label: 'Armement', type: 'topic', icon: 'target' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Contrat defense', aliases: ['defense contract', 'arms deal', 'weapons sale', 'contrat d\'armement', 'Rustungsvertrag'], type: 'keyword' },
            { label: 'Missile', aliases: ['missile', 'ballistic', 'ICBM', 'hypersonic', 'missile balistique', 'Rakete'], type: 'keyword' },
            { label: 'Drone', aliases: ['drone', 'UAV', 'unmanned', 'UCAV', 'drone militaire'], type: 'keyword' },
            { label: 'Sous-marin', aliases: ['submarine', 'sous-marin', 'AUKUS', 'U-Boot', 'подводная лодка'], type: 'keyword' },
          ]},
          { name: 'Industriels', icon: 'factory', filters: [
            { label: 'Lockheed Martin', aliases: ['Lockheed', 'F-35', 'Skunk Works'], type: 'entity' },
            { label: 'MBDA / Thales', aliases: ['MBDA', 'Thales', 'Dassault', 'Safran', 'Naval Group'], type: 'entity' },
            { label: 'Rheinmetall', aliases: ['Rheinmetall', 'KMW', 'Leopard', 'KNDS'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'naval',
        name: 'Maritime & Naval',
        description: 'Naval operations, maritime security, piracy, chokepoints',
        chip1: { label: 'Maritime', type: 'topic', icon: 'anchor' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Piraterie', aliases: ['piracy', 'hijacking', 'Houthi attacks', 'piraterie maritime'], type: 'keyword' },
            { label: 'Detroits strategiques', aliases: ['Strait of Hormuz', 'Suez Canal', 'Malacca', 'Bab el-Mandeb', 'chokepoint'], type: 'keyword' },
            { label: 'Marine militaire', aliases: ['navy', 'naval exercise', 'fleet', 'marine nationale', 'Flotte'], type: 'keyword' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Marches',
    icon: 'finance',
    searchPlaceholder: 'Rechercher un marche, un actif ou un indicateur...',
    templates: [
      {
        id: 'commodities',
        name: 'Matieres premieres',
        description: 'Oil, gold, copper, lithium, agricultural commodities',
        chip1: { label: 'Commodities', type: 'topic', icon: 'gem' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Or', aliases: ['gold', 'gold price', 'bullion', 'cours de l\'or', 'Goldpreis', 'золото'], type: 'keyword' },
            { label: 'Petrole brut', aliases: ['crude oil', 'Brent', 'WTI', 'oil price', 'brut', 'Rohol'], type: 'keyword' },
            { label: 'Cuivre', aliases: ['copper', 'copper price', 'cuivre', 'Kupfer', 'медь'], type: 'keyword' },
            { label: 'Ble & Agriculture', aliases: ['wheat', 'grain', 'agriculture', 'food prices', 'ble', 'cereales', 'Weizen'], type: 'keyword' },
          ]},
        ],
      },
      {
        id: 'crypto',
        name: 'Crypto & DeFi',
        description: 'Bitcoin, Ethereum, stablecoins, DeFi, crypto regulation',
        chip1: { label: 'Crypto', type: 'topic', icon: 'bitcoin' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Bitcoin', aliases: ['BTC', 'bitcoin price', 'satoshi', 'halving'], type: 'keyword' },
            { label: 'Ethereum', aliases: ['ETH', 'ethereum', 'smart contract', 'DeFi'], type: 'keyword' },
            { label: 'Stablecoins', aliases: ['USDT', 'USDC', 'stablecoin', 'Tether', 'Circle'], type: 'keyword' },
            { label: 'Regulation crypto', aliases: ['crypto regulation', 'MiCA', 'SEC crypto', 'reglementation crypto'], type: 'keyword' },
          ]},
        ],
      },
      {
        id: 'central-banks',
        name: 'Banques centrales',
        description: 'Fed, ECB, interest rates, monetary policy, inflation',
        chip1: { label: 'Politique monetaire', type: 'topic', icon: 'landmark' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Taux d\'interet', aliases: ['interest rate', 'rate hike', 'rate cut', 'taux directeur', 'Zinssatz'], type: 'keyword' },
            { label: 'Inflation', aliases: ['inflation', 'CPI', 'consumer prices', 'prix a la consommation', 'Inflation'], type: 'keyword' },
            { label: 'QE / QT', aliases: ['quantitative easing', 'quantitative tightening', 'bond buying', 'bilan BCE'], type: 'keyword' },
          ]},
          { name: 'Institutions', icon: 'landmark', filters: [
            { label: 'Fed', aliases: ['Federal Reserve', 'Jerome Powell', 'FOMC', 'Fed rate'], type: 'entity' },
            { label: 'BCE', aliases: ['ECB', 'European Central Bank', 'Christine Lagarde', 'Banque centrale europeenne'], type: 'entity' },
            { label: 'BoJ', aliases: ['Bank of Japan', 'Banque du Japon', 'Ueda', 'yen policy'], type: 'entity' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Innovation',
    icon: 'tech',
    searchPlaceholder: 'Rechercher une technologie, une entreprise...',
    templates: [
      {
        id: 'ai',
        name: 'Intelligence artificielle',
        description: 'AI regulation, LLMs, deep learning, AI safety',
        chip1: { label: 'IA', type: 'topic', icon: 'brain' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'LLM / GPT', aliases: ['large language model', 'GPT', 'Claude', 'Gemini', 'ChatGPT', 'LLM'], type: 'keyword' },
            { label: 'Regulation IA', aliases: ['AI regulation', 'AI Act', 'AI safety', 'reglementation IA', 'EU AI Act'], type: 'keyword' },
            { label: 'IA generative', aliases: ['generative AI', 'GenAI', 'text-to-image', 'IA generative', 'Midjourney'], type: 'keyword' },
            { label: 'Autonomous systems', aliases: ['autonomous', 'self-driving', 'robotics', 'autonome', 'vehicule autonome'], type: 'keyword' },
          ]},
          { name: 'Entreprises', icon: 'building', filters: [
            { label: 'OpenAI', aliases: ['OpenAI', 'Sam Altman', 'GPT-5', 'ChatGPT'], type: 'entity' },
            { label: 'Google DeepMind', aliases: ['DeepMind', 'Google AI', 'Gemini', 'Alphabet AI'], type: 'entity' },
            { label: 'Anthropic', aliases: ['Anthropic', 'Claude', 'Dario Amodei'], type: 'entity' },
            { label: 'NVIDIA', aliases: ['NVIDIA', 'GPU', 'CUDA', 'Jensen Huang', 'H100', 'Blackwell'], type: 'entity' },
          ]},
        ],
      },
      {
        id: 'semiconductors',
        name: 'Semi-conducteurs',
        description: 'Chip manufacturing, export controls, semiconductor supply',
        chip1: { label: 'Semi-conducteurs', type: 'topic', icon: 'chip' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Fabrication puces', aliases: ['chip manufacturing', 'semiconductor', 'foundry', 'wafer', 'fabrication', 'Halbleiter'], type: 'keyword' },
            { label: 'Export controls', aliases: ['chip export ban', 'export controls', 'tech restrictions', 'controle export'], type: 'keyword' },
            { label: 'EUV lithographie', aliases: ['EUV', 'lithography', 'ASML', 'extreme ultraviolet'], type: 'keyword' },
          ]},
          { name: 'Entreprises', icon: 'building', filters: [
            { label: 'TSMC', aliases: ['TSMC', 'Taiwan Semiconductor', 'foundry'], type: 'entity' },
            { label: 'ASML', aliases: ['ASML', 'lithography', 'EUV machines'], type: 'entity' },
            { label: 'Intel', aliases: ['Intel', 'Pat Gelsinger', 'Intel Foundry', 'x86'], type: 'entity' },
            { label: 'Samsung Semi', aliases: ['Samsung Semiconductor', 'Samsung foundry', 'HBM'], type: 'entity' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'climate',
    label: 'Climat & Environnement',
    icon: 'climate',
    searchPlaceholder: 'Rechercher un sujet environnemental...',
    templates: [
      {
        id: 'climate-policy',
        name: 'Politique climatique',
        description: 'Paris agreement, COP, carbon markets, net zero',
        chip1: { label: 'Climat', type: 'topic', icon: 'leaf' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Accord de Paris', aliases: ['Paris agreement', 'COP', 'climate summit', 'accord de Paris', 'Pariser Abkommen'], type: 'keyword' },
            { label: 'Marche carbone', aliases: ['carbon market', 'carbon credit', 'emissions trading', 'ETS', 'marche carbone'], type: 'keyword' },
            { label: 'Net zero', aliases: ['net zero', 'carbon neutral', 'neutralite carbone', 'decarbonation', 'Klimaneutralitat'], type: 'keyword' },
            { label: 'Deforestation', aliases: ['deforestation', 'forest loss', 'illegal logging', 'deforestation', 'Abholzung'], type: 'keyword' },
          ]},
        ],
      },
      {
        id: 'disasters',
        name: 'Catastrophes naturelles',
        description: 'Earthquakes, floods, hurricanes, wildfires, droughts',
        chip1: { label: 'Catastrophes', type: 'topic', icon: 'alert-triangle' },
        suggestions: [
          { name: 'Suggested', icon: 'sparkles', filters: [
            { label: 'Seisme', aliases: ['earthquake', 'seisme', 'tremblement de terre', 'Erdbeben', 'землетрясение'], type: 'keyword' },
            { label: 'Inondation', aliases: ['flood', 'flooding', 'inondation', 'crue', 'Uberschwemmung', 'наводнение'], type: 'keyword' },
            { label: 'Incendie', aliases: ['wildfire', 'forest fire', 'bushfire', 'incendie', 'feu de foret', 'Waldbrand'], type: 'keyword' },
            { label: 'Ouragan / Cyclone', aliases: ['hurricane', 'cyclone', 'typhoon', 'tropical storm', 'ouragan', 'Hurrikan'], type: 'keyword' },
            { label: 'Secheresse', aliases: ['drought', 'water crisis', 'secheresse', 'Durre', 'засуха'], type: 'keyword' },
          ]},
        ],
      },
    ],
  },
];

/** Convert template selection into a FeedQuery */
export function templateToQuery(template: FeedTemplate): FeedQuery {
  return {
    layers: [
      { operator: 'OR', parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }] },
    ],
  };
}
