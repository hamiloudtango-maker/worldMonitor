/**
 * Facet models — 3-level hierarchical keyword matching.
 *
 * Level 1 (Family): broadest filter — e.g. "Market Intelligence" aliases
 * Level 2 (Section): medium filter — e.g. "Strategic Moves" aliases
 * Level 3 (Model): precise filter — e.g. "Mergers & Acquisitions" aliases
 *
 * Selecting a family filters with family aliases.
 * Selecting a section filters with section aliases (narrower).
 * Selecting a model filters with model aliases (most specific).
 */
import { useState, useEffect, useMemo } from 'react';
import { fetchIntelTree } from '@/v2/lib/ai-feeds-api';
import type { IntelFamily } from '@/v2/lib/ai-feeds-api';
import type { Article } from '@/v2/lib/constants';

export interface FacetChoice {
  id: string;
  label: string;
  level: 'family' | 'section' | 'model';
  family: string;
  section?: string;
  /** All keywords to match, lowercased, min 3 chars */
  keywords: string[];
  articleCount: number;
}

/** Precomputed lowercase text for an article */
export function articleText(a: Article): string {
  return `${a.title} ${a.description || ''} ${a.entities?.join(' ') || ''}`.toLowerCase();
}

/** Check if an article matches any keyword from a facet choice */
export function matchesFacet(text: string, choice: FacetChoice): boolean {
  return choice.keywords.some(kw => text.includes(kw));
}

/**
 * Hierarchical AND filter: OR within each level, AND between levels.
 * Family selected → must match family aliases
 * + Section selected → AND must match section aliases
 * + Model selected → AND must match model aliases
 */
export function matchesHierarchical(text: string, selected: FacetChoice[]): boolean {
  const byLevel = { family: [] as FacetChoice[], section: [] as FacetChoice[], model: [] as FacetChoice[] };
  for (const c of selected) byLevel[c.level].push(c);

  // AND between levels that have selections, OR within each level
  for (const level of ['family', 'section', 'model'] as const) {
    const choices = byLevel[level];
    if (choices.length === 0) continue;
    // Must match at least one choice in this level
    if (!choices.some(c => matchesFacet(text, c))) return false;
  }
  return true;
}

function toKeywords(terms: string[]): string[] {
  return terms.map(k => k.toLowerCase().trim()).filter(k => k.length >= 3);
}

export function useFacetModels() {
  const [families, setFamilies] = useState<IntelFamily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntelTree()
      .then(r => setFamilies(r.families || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Flat list of all facet choices at all 3 levels */
  const choices = useMemo<FacetChoice[]>(() => {
    const result: FacetChoice[] = [];
    for (const fam of families) {
      if (fam.key === 'mute') continue;

      // Level 1: Family
      const famKw = toKeywords([fam.label, ...(fam.aliases || [])]);
      if (famKw.length > 0) {
        result.push({
          id: `fam:${fam.key}`,
          label: fam.label,
          level: 'family',
          family: fam.key,
          keywords: famKw,
          articleCount: 0,
        });
      }

      for (const sec of fam.sections) {
        // Level 2: Section
        const secKw = toKeywords([sec.name, ...(sec.aliases || [])]);
        if (secKw.length > 0) {
          result.push({
            id: `sec:${fam.key}:${sec.name}`,
            label: sec.name,
            level: 'section',
            family: fam.key,
            section: sec.name,
            keywords: secKw,
            articleCount: 0,
          });
        }

        // Level 3: Models
        for (const m of sec.models) {
          const modelKw = toKeywords([m.name, ...(m.aliases || [])]);
          if (modelKw.length === 0) continue;
          result.push({
            id: m.id,
            label: m.name,
            level: 'model',
            family: fam.key,
            section: sec.name,
            keywords: modelKw,
            articleCount: m.article_count || 0,
          });
        }
      }
    }
    return result;
  }, [families]);

  /** Choices grouped by family for dropdown display */
  const byFamily = useMemo(() => {
    const map = new Map<string, { label: string; choices: FacetChoice[] }>();
    for (const c of choices) {
      if (!map.has(c.family)) {
        const fam = families.find(f => f.key === c.family);
        map.set(c.family, { label: fam?.label || c.family, choices: [] });
      }
      map.get(c.family)!.choices.push(c);
    }
    return map;
  }, [choices, families]);

  /** Count articles matching each choice */
  function countMatches(articles: Article[]): Map<string, number> {
    const counts = new Map<string, number>();
    const texts = articles.map(articleText);
    for (const choice of choices) {
      let count = 0;
      for (const t of texts) {
        if (matchesFacet(t, choice)) count++;
      }
      if (count > 0) counts.set(choice.id, count);
    }
    return counts;
  }

  return { families, choices, byFamily, loading, countMatches };
}
