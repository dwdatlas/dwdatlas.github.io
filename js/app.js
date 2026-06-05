// ============================================================
// MAIN APP — routing, navigation, utilities
// ============================================================
const App = {
  currentView: null,

  views: {
    dashboard:  { title: 'Dashboard',                 subtitle: 'Overview',                  obj: () => DashboardView },
    mooe:       { title: 'MOOE Monitoring',           subtitle: 'Disbursement tracking',     obj: () => MOOEView },
    cdr:        { title: 'Cash Disbursement Register',subtitle: 'Appendix 43',               obj: () => CDRView },
    funds:      { title: 'Downloaded Funds',          subtitle: 'ADA monitoring & liquidation', obj: () => FundsView },
    resources:  { title: 'Resources',                subtitle: 'Documents & Links',          obj: () => ResourcesView },
    schools:    { title: 'Schools',                   subtitle: 'Accountable Officers',      obj: () => SchoolsView },
    setup:      { title: 'Setup / Config',            subtitle: 'Supabase & Settings',       obj: () => SetupView },
  },

  async init() {
    const connected = DB.init();
    this.updateConnectionStatus(connected);

    // Apply role-based UI
    const isAdmin = typeof Auth !== 'undefined' && Auth.isAdmin();
    const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;

    // Hide Setup nav for school users
    const setupNav = document.getElementById('nav-setup');
    if (setupNav) setupNav.style.display = isAdmin ? '' : 'none';

    // Show logged-in user in sidebar footer
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (nameEl && user) nameEl.textContent = user.role === 'admin' ? 'Jo Ann Marie P. Cagara' : (user.school_name || user.username);
    if (roleEl && user) roleEl.textContent = user.role === 'admin' ? 'ADAS III (Sr. Bookkeeper)' : 'School Account';

    // Handle nav clicks
    document.querySelectorAll('.nav-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.view);
        this.closeSidebar();
      });
    });

    // Navigate to hash or default
    const hash = location.hash.slice(1) || 'dashboard';
    this.navigate(this.views[hash] ? hash : 'dashboard');
  },

  async navigate(viewName) {
    if (!this.views[viewName]) return;
    this.currentView = viewName;
    location.hash = viewName;

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });

    // Update header
    const v = this.views[viewName];
    document.getElementById('page-title').textContent = v.title;
    document.getElementById('page-subtitle').textContent = v.subtitle;

    // Render view
    const container = document.getElementById('view-container');
    container.innerHTML = '<div class="flex justify-center py-20"><div class="spinner"></div></div>';

    try {
      const viewObj = v.obj();
      const html = await viewObj.render();
      container.innerHTML = html;
      if (viewObj.afterRender) await viewObj.afterRender();
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="section-card section-card-body text-red-600">
        <p class="font-bold">Error loading view</p>
        <p class="text-sm mt-1">${err.message}</p>
      </div>`;
    }
  },

  updateConnectionStatus(connected) {
    const el = document.getElementById('conn-status');
    if (!el) return;
    if (connected) {
      el.className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium';
      el.textContent = '● Supabase';
    } else {
      el.className = 'text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium';
      el.textContent = '● Local only';
    }
  },

  openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  },

  toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `fixed bottom-5 right-5 z-50 text-sm px-4 py-3 rounded-lg shadow-lg max-w-xs transition-opacity ${type === 'error' ? 'bg-red-700 text-white' : 'bg-gray-900 text-white'}`;
    el.classList.remove('hidden');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  },
};

// Close modal on backdrop click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) App.closeModal();
});

// Boot — only start app if already authenticated (Auth.guard handles the rest)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) App.init();
});
