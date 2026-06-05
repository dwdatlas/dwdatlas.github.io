// ============================================================
// DASHBOARD VIEW
// ============================================================
const DashboardView = {
  async render() {
    const [schoolsRes, disbRes] = await Promise.all([
      DB.getSchools(),
      DB.getDisbursements({ year: new Date().getFullYear().toString() }),
    ]);

    const schools = schoolsRes.data || [];
    const disb = disbRes.data || [];

    const total = disb.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const liquidated = disb.filter(r => r.status === 'liquidated').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const submitted = disb.filter(r => r.status?.startsWith('submitted')).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const pending = disb.filter(r => !r.status || r.status === 'pending').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // Count expiring confirmation letters (within 60 days)
    const today = new Date();
    const expiring = schools.filter(s => {
      if (!s.confirmation_expiry) return false;
      const diff = (new Date(s.confirmation_expiry) - today) / 86400000;
      return diff >= 0 && diff <= 60;
    });

    return `
    <div class="page-header">
      <h2>Dashboard</h2>
      <p>Overview of MOOE disbursements — ${new Date().getFullYear()}</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${statCard('Total Disbursed', fmt(total), '#0038A8', `${disb.length} transactions`)}
      ${statCard('Liquidated', fmt(liquidated), '#166534', `${disb.filter(r => r.status === 'liquidated').length} records`)}
      ${statCard('Submitted', fmt(submitted), '#1e40af', `${disb.filter(r => r.status?.startsWith('submitted')).length} records`)}
      ${statCard('Pending / For Action', fmt(pending), '#b45309', `${disb.filter(r => !r.status || r.status === 'pending').length} records`)}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <!-- Chart -->
      <div class="section-card lg:col-span-2">
        <div class="section-card-header"><h3>Status Breakdown by Fund Type</h3></div>
        <div class="section-card-body">
          <canvas id="status-chart" height="200"></canvas>
        </div>
      </div>

      <!-- Quick info -->
      <div class="section-card">
        <div class="section-card-header"><h3>Schools Summary</h3></div>
        <div class="section-card-body p-0">
          <div class="px-5 py-3 flex items-center justify-between border-b">
            <span class="text-sm text-gray-600">Total Schools</span>
            <span class="font-bold text-gray-800">${schools.length}</span>
          </div>
          <div class="px-5 py-3 flex items-center justify-between border-b">
            <span class="text-sm text-gray-600">Confirmation Expiring (60 days)</span>
            <span class="font-bold ${expiring.length > 0 ? 'text-red-600' : 'text-green-600'}">${expiring.length}</span>
          </div>
          ${expiring.length > 0 ? `
          <div class="px-5 py-2">
            ${expiring.map(s => `
            <div class="flex items-center justify-between py-1">
              <span class="text-xs text-gray-700">${s.name}</span>
              <span class="text-xs font-semibold text-red-600">${formatDate(s.confirmation_expiry)}</span>
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Recent disbursements -->
    <div class="section-card">
      <div class="section-card-header">
        <h3>Recent Disbursements</h3>
        <a href="#" class="btn btn-secondary btn-sm" onclick="App.navigate('mooe'); return false;">View All</a>
      </div>
      <div class="table-scroll">
        ${disb.length === 0 ? emptyState('No disbursements recorded yet.') : `
        <table class="data-table">
          <thead><tr>
            <th>ADA No.</th><th>ADA Date</th><th>Fund Type</th><th>School</th>
            <th class="text-right">Amount</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${disb.slice(0, 10).map(r => `
            <tr>
              <td class="font-mono text-xs">${r.ada_no || '—'}</td>
              <td>${formatDate(r.ada_date)}</td>
              <td>${r.fund_type || '—'}</td>
              <td>${schoolName(r, schools)}</td>
              <td class="text-right font-semibold">${fmt(r.amount)}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>
    `;
  },

  afterRender() {
    DB.getDisbursements({ year: new Date().getFullYear().toString() }).then(({ data }) => {
      if (!data || !data.length) return;
      const counts = {};
      data.forEach(r => { counts[r.status || 'pending'] = (counts[r.status || 'pending'] || 0) + 1; });
      const ctx = document.getElementById('status-chart');
      if (!ctx) return;
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Liquidated', 'Submitted to Division', 'Submitted to SOU', 'Pending'],
          datasets: [{
            data: [
              counts['liquidated'] || 0,
              counts['submitted_to_division'] || 0,
              counts['submitted_to_sou'] || 0,
              counts['pending'] || 0,
            ],
            backgroundColor: ['#16a34a', '#2563eb', '#7c3aed', '#d97706'],
            borderWidth: 0,
          }]
        },
        options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
      });
    });
  }
};

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
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function statusBadge(s) {
  const map = {
    liquidated: ['badge-liquidated', '✓ Liquidated'],
    submitted_to_division: ['badge-submitted', '↑ Submitted to Division'],
    submitted_to_sou: ['badge-submitted', '↑ Submitted to SOU'],
    pending: ['badge-pending', '● Pending'],
  };
  const [cls, label] = map[s] || ['badge-pending', '● Pending'];
  return `<span class="badge ${cls}">${label}</span>`;
}
function schoolName(row, schools) {
  if (row.schools) return row.schools.name;
  const s = schools.find(s => s.id === row.school_id);
  return s ? s.name : '—';
}
function emptyState(msg) {
  return `<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>${msg}</p></div>`;
}
