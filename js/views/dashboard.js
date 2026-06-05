// ============================================================
// DASHBOARD — Fund Monitor
// Shows per-fund liquidation status for all schools
// ============================================================
const DashboardView = {
  _schools: [],
  _schoolId: null,
  _isAdmin: false,
  _allFunds: [],

  async render() {
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    this._isAdmin  = typeof Auth !== 'undefined' ? Auth.isAdmin()    : false;

    const [schoolsRes, fundsRes] = await Promise.all([
      DB.getSchools(),
      DB.getFunds(),
    ]);

    this._schools  = schoolsRes.data || [];
    this._allFunds = fundsRes.data   || [];

    // Get unique fund types from the data
    const fundTypes = [...new Set(this._allFunds.map(f => f.fund_type))].sort();

    const fundOpts = fundTypes.map(f =>
      `<option value="${f}">${f}</option>`
    ).join('');

    return `
    <div class="page-header">
      <h2>Fund Monitor</h2>
      <p>Liquidation status per fund — select a fund type to view all schools</p>
    </div>

    <!-- Fund type selector -->
    <div class="section-card mb-4">
      <div class="section-card-body">
        <div class="flex flex-wrap items-center gap-3">
          <label class="form-label mb-0 whitespace-nowrap font-semibold">Fund Type:</label>
          <select id="dash-fund-select" class="form-select max-w-sm" onchange="DashboardView.loadFund()">
            <option value="">— Select a fund type —</option>
            ${fundOpts}
          </select>
          ${this._isAdmin ? `
          <button class="btn btn-secondary btn-sm" onclick="FundsView.seedDefaults()" title="Load seed data from CSV">
            Load Seed Data
          </button>` : ''}
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div id="dash-summary" class="grid grid-cols-3 gap-4 mb-6"></div>

    <!-- Schools table -->
    <div class="section-card">
      <div class="section-card-header">
        <h3 id="dash-fund-title">Select a fund type above</h3>
      </div>
      <div id="dash-fund-body">
        <div class="py-12 text-center text-gray-400 text-sm">
          Select a fund type from the dropdown to view school liquidation status
        </div>
      </div>
    </div>`;
  },

  async afterRender() {
    // Auto-select first fund type
    const sel = document.getElementById('dash-fund-select');
    if (sel && sel.options.length > 1) {
      sel.selectedIndex = 1;
      await this.loadFund();
    }
  },

  async loadFund() {
    const fundType = document.getElementById('dash-fund-select')?.value;
    if (!fundType) return;

    // Refresh fund data
    const { data } = await DB.getFunds();
    this._allFunds = data || [];

    let funds = this._allFunds.filter(f => f.fund_type === fundType);

    // School filter for school users
    if (this._schoolId) {
      funds = funds.filter(f => f.school_id === this._schoolId);
    }

    // Summary counts
    const total       = funds.length;
    const liquidated  = funds.filter(f => f.status === 'liquidated').length;
    const unliquidated = total - liquidated;

    const summaryEl = document.getElementById('dash-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        ${statCard('Total Schools', total,        '#0038A8', 'with this fund')}
        ${statCard('Liquidated',    liquidated,   '#166534', 'completed')}
        ${statCard('Unliquidated',  unliquidated, '#b91c1c', 'needs action')}`;
    }

    const titleEl = document.getElementById('dash-fund-title');
    if (titleEl) titleEl.textContent = fundType;

    const bodyEl = document.getElementById('dash-fund-body');
    if (!bodyEl) return;

    if (!funds.length) {
      bodyEl.innerHTML = emptyState('No records found for this fund type. Click "Load Seed Data" to populate.');
      return;
    }

    bodyEl.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>#</th>
          <th>School Name</th>
          <th>ADA No.</th>
          <th>ADA Date</th>
          <th class="text-right">Amount</th>
          <th>Status</th>
          ${this._isAdmin ? '<th>Action</th>' : ''}
        </tr></thead>
        <tbody>
          ${funds.map((f, i) => {
            const school = this._schools.find(s => s.id === f.school_id);
            const isLiq  = f.status === 'liquidated';
            const badge  = isLiq
              ? `<span class="badge badge-liquidated">✓ Liquidated</span>`
              : `<span class="badge badge-missing">⚠ Unliquidated</span>`;
            return `
            <tr class="${!isLiq ? 'bg-red-50' : ''}">
              <td class="text-xs text-gray-400">${i + 1}</td>
              <td class="font-medium">${school?.name || f.school_id}</td>
              <td class="font-mono text-xs">${f.ada_no || '—'}</td>
              <td class="text-xs whitespace-nowrap">${formatDate(f.ada_date)}</td>
              <td class="text-right font-semibold">${fmt(f.amount)}</td>
              <td>${badge}</td>
              ${this._isAdmin ? `
              <td>
                <button class="btn btn-sm ${isLiq ? 'btn-secondary' : 'btn-primary'}"
                  onclick="DashboardView.toggleStatus('${f.id}', '${f.status}')">
                  ${isLiq ? 'Mark Unliquidated' : 'Mark Liquidated'}
                </button>
              </td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'liquidated' ? 'unliquidated' : 'liquidated';
    const fund = this._allFunds.find(f => f.id === id);
    if (!fund) return;
    await DB.upsertFund({ ...fund, status: newStatus });
    App.toast(`Marked as ${newStatus === 'liquidated' ? 'Liquidated' : 'Unliquidated'}!`);
    await this.loadFund();
  },
};

// ---- Global helpers (used by other views) ----
function statCard(title, value, color, sub) {
  return `
  <div class="stat-card border-l-4" style="border-color:${color}">
    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">${title}</div>
    <div class="text-2xl font-bold mb-1" style="color:${color}">${value}</div>
    <div class="text-xs text-gray-400">${sub}</div>
  </div>`;
}
function fmt(n) {
  const num = parseFloat(n) || 0;
  return '₱ ' + num.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function statusBadge(s) {
  const map = {
    liquidated:           ['badge-liquidated', '✓ Liquidated'],
    submitted_to_division:['badge-submitted',  '↑ Submitted to Division'],
    submitted_to_sou:     ['badge-submitted',  '↑ Submitted to SOU'],
    pending:              ['badge-pending',    '● Pending'],
  };
  const [cls, label] = map[s] || ['badge-pending', '● Pending'];
  return `<span class="badge ${cls}">${label}</span>`;
}
function schoolName(row, schools) {
  if (row.schools) return row.schools.name;
  const s = (schools || []).find(s => s.id === row.school_id);
  return s ? s.name : '—';
}
function emptyState(msg) {
  return `<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>${msg}</p></div>`;
}
