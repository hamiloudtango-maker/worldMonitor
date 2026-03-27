// src/v2/components/ai-feeds/feed-templates.ts
import type { QueryPart, FeedQuery } from '@/v2/lib/ai-feeds-api';

export interface FeedTemplate {
  id: string;
  name: string;
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
  icon: 'strategy' | 'cyber';
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
        chip1: { label: 'Conflits armés', type: 'topic', icon: 'swords' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone à surveiller' },
      },
      {
        id: 'diplomacy',
        name: 'Diplomatie & Sanctions',
        chip1: { label: 'Sanctions', type: 'topic', icon: 'gavel' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: "Choisir le pays ou l'entité" },
      },
      {
        id: 'energy',
        name: 'Énergie & Ressources',
        chip1: { label: 'Énergie', type: 'topic', icon: 'zap' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone ou le secteur' },
      },
      {
        id: 'economy',
        name: 'Économie & M&A',
        chip1: { label: 'M&A', type: 'topic', icon: 'trending-up' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur à surveiller' },
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
        chip1: { label: 'Ransomware', type: 'topic', icon: 'bug' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur ciblé' },
      },
      {
        id: 'apt',
        name: 'APT & Acteurs',
        chip1: { label: 'Threat Actor', type: 'topic', icon: 'skull' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: "Choisir la zone d'origine" },
      },
      {
        id: 'vulns',
        name: 'Vulnérabilités Critiques',
        chip1: { label: 'Vulnérabilité haute', type: 'topic', icon: 'alert-triangle' },
        chip2: { label: 'Technologie', type: 'entity', icon: 'cpu', placeholder: 'Choisir la technologie affectée' },
      },
      {
        id: 'breaches',
        name: 'Data Breaches',
        chip1: { label: 'Data Breach', type: 'topic', icon: 'database' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur impacté' },
      },
    ],
    dropdownCategories: [
      { label: 'Secteur', icon: 'building', type: 'suggested', hasSubmenu: true },
      { label: 'Threat Actors', icon: 'skull', type: 'model', hasSubmenu: true },
      { label: 'Malware', icon: 'bug', type: 'model', hasSubmenu: true },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Frameworks (MITRE)', icon: 'shield', type: 'model', hasSubmenu: true },
      { label: 'Régions d\'origine', icon: 'globe', type: 'model', hasSubmenu: true },
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
        operator: 'AND',
        parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }],
      },
      {
        operator: 'AND',
        parts: [{ type: template.chip2.type, value: chip2Value, scope: 'title_and_content' }],
      },
    ],
  };
}
