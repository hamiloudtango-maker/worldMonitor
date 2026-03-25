/**
 * Mount React News Intelligence into a vanilla DOM container.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import NewsIntelligence from './news-app';

let root: ReturnType<typeof createRoot> | null = null;

export function mountNewsReact(container: HTMLElement): void {
  if (root) root.unmount();
  root = createRoot(container);
  root.render(React.createElement(NewsIntelligence));
}

export function unmountNewsReact(): void {
  if (root) { root.unmount(); root = null; }
}
