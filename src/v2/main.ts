/**
 * WorldMonitor v2 — Entry point.
 */

import './styles.css';
import { registerAllRenderers } from '@/components/renderers';
import {
  initGrid,
  loadDashboard,
  listDashboards,
  createDashboard,
  destroyGrid,
  getCurrentDashboard,
} from '@/app/dashboard-engine';
import {
  isAuthenticated,
  login,
  register,
  getMe,
  clearTokens,
} from '@/services/api-client';
import { showAddWidgetModal } from '@/v2/add-widget-modal';

const app = document.getElementById('app')!;
registerAllRenderers();

// ===== Toast ====
export function toast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `wm-toast wm-toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== Router =====
async function route() {
  if (!isAuthenticated()) {
    renderAuth();
  } else {
    try {
      const me = await getMe();
      renderDashboard(me);
    } catch {
      clearTokens();
      renderAuth();
    }
  }
}

// ===== Auth =====
function renderAuth() {
  let mode: 'login' | 'register' = 'login';

  function render() {
    const isLogin = mode === 'login';
    app.innerHTML = `
      <div class="wm-auth-page">
        <div class="wm-auth-card">
          <h1>${isLogin ? 'Sign in' : 'Create account'}</h1>
          <div class="wm-auth-subtitle">${isLogin ? 'Welcome back to WorldMonitor' : 'Start monitoring the world'}</div>
          <div id="auth-error"></div>
          <form id="auth-form">
            ${!isLogin ? '<input name="org" type="text" placeholder="Organization name" required />' : ''}
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Password" minlength="6" required />
            <button type="submit" class="wm-auth-submit">${isLogin ? 'Sign in' : 'Create account'}</button>
          </form>
          <div class="wm-auth-switch">
            ${isLogin ? "Don't have an account?" : 'Already have an account?'}
            <a id="auth-toggle">${isLogin ? 'Sign up' : 'Sign in'}</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('auth-toggle')!.addEventListener('click', (e) => {
      e.preventDefault();
      mode = isLogin ? 'register' : 'login';
      render();
    });

    document.getElementById('auth-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const btn = form.querySelector('button') as HTMLButtonElement;
      const errEl = document.getElementById('auth-error')!;
      errEl.innerHTML = '';
      btn.disabled = true;

      try {
        if (isLogin) {
          await login(data.get('email') as string, data.get('password') as string);
        } else {
          await register(
            data.get('email') as string,
            data.get('password') as string,
            data.get('org') as string,
          );
        }
        route();
      } catch (err) {
        btn.disabled = false;
        errEl.innerHTML = `<div class="wm-auth-error">${err instanceof Error ? err.message : 'Something went wrong'}</div>`;
      }
    });
  }

  render();
}

// ===== Dashboard =====
async function renderDashboard(me: { email: string; org_name: string }) {
  let dashboards = await listDashboards();
  if (dashboards.length === 0) {
    await createDashboard('My Dashboard');
    dashboards = await listDashboards();
  }

  let activeDash = dashboards.find((d) => d.is_default) ?? dashboards[0]!;

  app.innerHTML = `
    <div class="wm-header">
      <div class="wm-header-left">
        <span class="wm-logo">WorldMonitor</span>
        <select id="dash-select" class="wm-dashboard-select">
          ${dashboards.map((d) => `<option value="${d.id}" ${d.id === activeDash.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="wm-header-right">
        <button id="add-widget-btn" class="wm-btn wm-btn-primary">+ Add Widget</button>
        <span class="wm-user-badge">${me.org_name}</span>
        <button id="logout-btn" class="wm-btn">Sign out</button>
      </div>
    </div>
    <div class="wm-dashboard">
      <div id="grid-container" class="grid-stack"></div>
    </div>
  `;

  const isEmbed = new URLSearchParams(location.search).has('embed');
  const container = document.getElementById('grid-container')!;
  initGrid(container, { readOnly: isEmbed });

  const dash = await loadDashboard(activeDash.id);

  // Show empty state if no panels
  if (dash.panels.length === 0) {
    showEmptyState(container, activeDash.id);
  }

  // Dashboard switcher
  document.getElementById('dash-select')!.addEventListener('change', async (e) => {
    const id = (e.target as HTMLSelectElement).value;
    destroyGrid();
    initGrid(document.getElementById('grid-container')!, { readOnly: isEmbed });
    const d = await loadDashboard(id);
    activeDash = dashboards.find((x) => x.id === id) ?? activeDash;
    if (d.panels.length === 0) showEmptyState(document.getElementById('grid-container')!, id);
  });

  document.getElementById('add-widget-btn')!.onclick = () => {
    const current = getCurrentDashboard();
    showAddWidgetModal(current?.id ?? activeDash.id);
  };

  document.getElementById('logout-btn')!.onclick = () => {
    clearTokens();
    destroyGrid();
    route();
  };

  if (isEmbed) {
    document.querySelector('.wm-header')?.remove();
    document.querySelector('.wm-dashboard')!.setAttribute('style', 'height:100vh');
  }
}

function showEmptyState(container: HTMLElement, dashboardId: string) {
  const empty = document.createElement('div');
  empty.className = 'wm-empty-state';
  empty.innerHTML = `
    <div class="wm-empty-state-icon">📡</div>
    <h2>No widgets yet</h2>
    <p>Add your first data source — news feeds, earthquake maps, crypto prices, weather, and more.</p>
    <button class="wm-btn wm-btn-primary" id="empty-add-btn">+ Add Widget</button>
  `;
  container.appendChild(empty);
  document.getElementById('empty-add-btn')!.onclick = () => {
    empty.remove();
    showAddWidgetModal(dashboardId);
  };
}

// Boot
route();
