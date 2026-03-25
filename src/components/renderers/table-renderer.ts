/**
 * Table renderer — sortable HTML table.
 * Columns defined by template.panel.columns.
 * Numbers formatted, dates relative, URLs as links.
 */

import type { SourceTemplate } from '@/services/template-store';
import { formatNumber, formatDate } from './format-utils';

export function renderTable(
  container: HTMLElement,
  rows: Record<string, unknown>[],
  template: SourceTemplate,
): void {
  const columns = template.panel.columns.length > 0
    ? template.panel.columns
    : template.fields.map((f) => f.name);

  const fieldMap = new Map(template.fields.map((f) => [f.name, f]));

  const table = document.createElement('table');
  table.className = 'wm-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col.replace(/_/g, ' ');
    th.className = 'wm-table-th';
    // Click to sort
    th.addEventListener('click', () => sortTable(table, columns.indexOf(col), rows, col, fieldMap.get(col)?.type));
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const row of rows.slice(0, 100)) {
    const tr = document.createElement('tr');
    tr.className = 'wm-table-row';
    for (const col of columns) {
      const td = document.createElement('td');
      td.className = 'wm-table-cell';
      const field = fieldMap.get(col);
      const val = row[col];

      if (val == null) {
        td.textContent = '—';
        td.classList.add('wm-null');
      } else if (field?.type === 'url') {
        const a = document.createElement('a');
        a.href = String(val);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'link';
        td.appendChild(a);
      } else if (field?.type === 'number' || typeof val === 'number') {
        td.textContent = formatNumber(val as number);
        td.classList.add('wm-number');
      } else if (field?.type === 'date_iso' || field?.type === 'date_ms') {
        td.textContent = formatDate(val);
      } else {
        td.textContent = String(val).slice(0, 80);
      }

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function sortTable(
  table: HTMLTableElement,
  colIdx: number,
  _rows: Record<string, unknown>[],
  _colName: string,
  _fieldType?: string,
): void {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.rows);
  const asc = table.dataset.sortCol === String(colIdx) && table.dataset.sortDir !== 'asc';

  rows.sort((a, b) => {
    const aVal = a.cells[colIdx]?.textContent ?? '';
    const bVal = b.cells[colIdx]?.textContent ?? '';
    const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
    const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum)) return asc ? aNum - bNum : bNum - aNum;
    return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  table.dataset.sortCol = String(colIdx);
  table.dataset.sortDir = asc ? 'asc' : 'desc';
  for (const row of rows) tbody.appendChild(row);
}
