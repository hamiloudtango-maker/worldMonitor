/**
 * Shared formatting utilities for renderers.
 */

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export function formatDate(val: unknown): string {
  try {
    const date = typeof val === 'number' ? new Date(val) : new Date(String(val));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return String(val);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
