// src/v2/components/ai-feeds/feed-templates.ts
import type { QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

export interface FeedTemplate {
  id: string;
  name: string;
  description?: string;
  chip1: { label: string; type: QueryPart['type']; icon: string };
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
    id: 'geopolitics',
    label: 'Geopolitique',
    icon: 'globe',
    searchPlaceholder: 'Rechercher un sujet geopolitique...',
    templates: [
      {
        id: 'geopolitics',
        name: 'Geopolitique & Conflits',
        description: 'Conflits armes, crises internationales, tensions geopolitiques, operations militaires',
        chip1: { label: 'Conflits armes', type: 'topic', icon: 'swords' },
      },
      {
        id: 'diplomacy',
        name: 'Diplomatie & Relations internationales',
        description: 'Sanctions, traites, negociations, organisations internationales, sommets',
        chip1: { label: 'Diplomatie', type: 'topic', icon: 'handshake' },
      },
      {
        id: 'defense',
        name: 'Defense & Securite',
        description: 'Armement, operations militaires, industrie de defense, alliances, renseignement',
        chip1: { label: 'Armement', type: 'topic', icon: 'shield' },
      },
    ],
  },
  {
    id: 'economy',
    label: 'Economie',
    icon: 'trending-up',
    searchPlaceholder: 'Rechercher un sujet economique...',
    templates: [
      {
        id: 'economy',
        name: 'Economie & Finance',
        description: 'Marches financiers, politique monetaire, croissance, recession, commerce international',
        chip1: { label: 'Economie', type: 'topic', icon: 'trending-up' },
      },
      {
        id: 'energy',
        name: 'Energie & Ressources',
        description: 'Petrole, gaz, nucleaire, renouvelables, matieres premieres, mineraux critiques',
        chip1: { label: 'Energie', type: 'topic', icon: 'zap' },
      },
    ],
  },
  {
    id: 'cyber',
    label: 'Cybersecurite',
    icon: 'shield',
    searchPlaceholder: 'Rechercher un sujet cyber...',
    templates: [
      {
        id: 'cyber',
        name: 'Cybersecurite & Menaces',
        description: 'Cyberattaques, ransomware, vulnerabilites, acteurs de menace, espionnage numerique',
        chip1: { label: 'Ransomware Attack', type: 'topic', icon: 'bug' },
      },
    ],
  },
  {
    id: 'tech',
    label: 'Tech & Science',
    icon: 'cpu',
    searchPlaceholder: 'Rechercher une technologie...',
    templates: [
      {
        id: 'tech',
        name: 'Technologies & Innovation',
        description: 'Intelligence artificielle, semi-conducteurs, quantique, spatial, biotechnologies',
        chip1: { label: 'IA', type: 'topic', icon: 'brain' },
      },
    ],
  },
  {
    id: 'climate',
    label: 'Climat & Risques',
    icon: 'cloud',
    searchPlaceholder: 'Rechercher un risque ou sujet climatique...',
    templates: [
      {
        id: 'climate',
        name: 'Climat & Environnement',
        description: 'Changement climatique, politique climatique, catastrophes naturelles, biodiversite',
        chip1: { label: 'Climat', type: 'topic', icon: 'leaf' },
      },
      {
        id: 'risks',
        name: 'Risques & Crises',
        description: 'Catastrophes naturelles, instabilite politique, migrations, terrorisme, pandemies',
        chip1: { label: 'Catastrophes', type: 'topic', icon: 'alert-triangle' },
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
