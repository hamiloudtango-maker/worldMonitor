/**
 * Facet models — maps each Intel Model to a keyword matcher.
 *
 * When the user selects a facet choice (e.g. "Mergers & Acquisitions"),
 * instead of matching a.theme === 'economic', we search for all aliases
 * ["M&A", "merger", "acquisition", "takeover", "rachat"] in the article text.
 *
 * This makes facets dramatically more effective at filtering.
 */
import { useState, useEffect, useMemo } from 'react';
import { fetchIntelTree } from '@/v2/lib/ai-feeds-api';
import type { IntelFamily } from '@/v2/lib/ai-feeds-api';
import type { Article } from '@/v2/lib/constants';

export interface FacetChoice {
  id: string;
  label: string;
  section: string;
  family: string;
  familyLabel: string;
  /** All keywords to match (name + aliases), lowercased, min 3 chars */
  keywords: string[];
  articleCount: number;
}

/** Precomputed lowercase text for an article — avoids recomputing per facet */
export function articleText(a: Article): string {
  return `${a.title} ${a.description || ''} ${a.entities?.join(' ') || ''}`.toLowerCase();
}

/** Check if an article matches any keyword from a facet choice */
export function matchesFacet(text: string, choice: FacetChoice): boolean {
  return choice.keywords.some(kw => text.includes(kw));
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

  /** Flat list of all facet choices with their keyword matchers */
  const choices = useMemo<FacetChoice[]>(() => {
    const result: FacetChoice[] = [];
    for (const fam of families) {
      // Skip mute filters — they're for exclusion, not facets
      if (fam.key === 'mute') continue;
      for (const sec of fam.sections) {
        for (const m of sec.models) {
          const keywords = [m.name, ...(m.aliases || [])]
            .map(k => k.toLowerCase().trim())
            .filter(k => k.length >= 3);
          if (keywords.length === 0) continue;
          result.push({
            id: m.id,
            label: m.name,
            section: sec.name,
            family: fam.key,
            familyLabel: fam.label,
            keywords,
            articleCount: m.article_count || 0,
          });
        }
      }
    }
    return result;
  }, [families]);

  /** Choices grouped by family for dropdown sections */
  const byFamily = useMemo(() => {
    const map = new Map<string, { label: string; choices: FacetChoice[] }>();
    for (const c of choices) {
      if (!map.has(c.family)) map.set(c.family, { label: c.familyLabel, choices: [] });
      map.get(c.family)!.choices.push(c);
    }
    return map;
  }, [choices]);

  /** Count how many articles match each choice (for showing counts in facet dropdown) */
  function countMatches(articles: Article[]): Map<string, number> {
    const counts = new Map<string, number>();
    // Precompute article texts once
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
