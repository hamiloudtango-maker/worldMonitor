/**
 * WorldMonitor v2 — Entry point.
 * Auth → Dashboard → Gridstack + DynamicSourcePanels.
 */

import './styles.css';
import { registerAllRenderers } from '@/components/renderers';
import {
  initGrid,
  loadDashboard,
  listDashboards,
  createDashboard,
  destroyGrid,
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

// Register renderers
registerAllRenderers();

// Route
async function route() {
  if (!isAuthenticated()) {
    renderAuth();
  } else {
    try {
      const me = await getMe();
      await renderDashboard(me);
    } catch {
      clearTokens();
      renderAuth();
    }
  }
}

// ===== Auth Page =====
function renderAuth() {
  let isLogin = true;

  function render() {
    app.innerHTML = `
      <div class="wm-auth-page">
        <div class="wm-auth-card">
          <h1>${isLogin ? 'Sign in' : 'Create account'}</h1>
          <p>${isLogin ? 'Welcome back to WorldMonitor' : 'Start monitoring the world'}</p>
          <div id="auth-error"></div>
          ${!isLogin ? '<input id="org-name" type="text" placeholder="Organization name" />' : ''}
          <input id="email" type="email" placeholder="Email" />
          <input id="password" type="password" placeholder="Password" />
          <button id="auth-submit">${isLogin ? 'Sign in' : 'Create account'}</button>
          <div class="wm-auth-switch">
            ${isLogin ? "Don't have an account?" : 'Already have an account?'}
            <a id="auth-toggle">${isLogin ? 'Sign up' : 'Sign in'}</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('auth-toggle')!.onclick = () => {
      isLogin = !isLogin;
      render();
    };

    document.getElementById('auth-submit')!.onclick = async () => {
      const email = (document.getElementById('email') as HTMLInputElement).value;
      const password = (document.getElementById('password') as HTMLInputElement).value;
      const errEl = document.getElementById('auth-error')!;
      errEl.innerHTML = '';

      try {
        if (isLogin) {
          await login(email, password);
        } else {
          const orgName = (document.getElementById('org-name') as HTMLInputElement).value;
          await register(email, password, orgName);
        }
        await route();
      } catch (e) {
        errEl.innerHTML = `<div class="wm-auth-error">${e instanceof Error ? e.message : 'Error'}</div>`;
      }
    };

    // Enter key submit
    app.querySelectorAll('input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('auth-submit')!.click();
      });
    });
  }

  render();
}

// ===== Dashboard Page =====
async function renderDashboard(me: { email: string; org_name: string }) {
  // Get or create default dashboard
  let dashboards = await listDashboards();
  if (dashboards.length === 0) {
    await createDashboard('My Dashboard');
    dashboards = await listDashboards();
  }

  const currentDash = dashboards.find((d) => d.is_default) ?? dashboards[0]!;

  app.innerHTML = `
    <div class="wm-header">
      <div class="wm-header-left">
        <span class="wm-logo">WorldMonitor</span>
        <select id="dash-select" class="wm-dashboard-select">
          ${dashboards.map((d) => `<option value="${d.id}" ${d.id === currentDash.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="wm-header-right">
        <button id="add-widget-btn" class="wm-btn wm-btn-primary">+ Add Widget</button>
        <span class="wm-user-badge">${me.email}</span>
        <button id="logout-btn" class="wm-btn">Logout</button>
      </div>
    </div>
    <div class="wm-dashboard">
      <div id="grid-container" class="grid-stack"></div>
    </div>
  `;

  // Init Gridstack
  const container = document.getElementById('grid-container')!;
  const isEmbed = new URLSearchParams(location.search).has('embed');
  initGrid(container, { readOnly: isEmbed });

  // Load dashboard panels
  await loadDashboard(currentDash.id);

  // Dashboard switcher
  document.getElementById('dash-select')!.addEventListener('change', async (e) => {
    const id = (e.target as HTMLSelectElement).value;
    destroyGrid();
    initGrid(document.getElementById('grid-container')!, { readOnly: isEmbed });
    await loadDashboard(id);
  });

  // Add widget
  document.getElementById('add-widget-btn')!.onclick = () => {
    showAddWidgetModal(currentDash.id);
  };

  // Logout
  document.getElementById('logout-btn')!.onclick = () => {
    clearTokens();
    destroyGrid();
    route();
  };
}

// Boot
route();
