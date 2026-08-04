// ============================================================
// DASHBOARD — Fund Monitor (MOOE + Special Funds two-section view)
// ============================================================
const DashboardView = {
  _schools:     [],
  _allFunds:    [],
  _isAdmin:     false,
  _schoolId:    null,
  _year:        '',
  _mode:        'all',
  _mooeQuarter: null,
  _mooeTab:     'all',
  _specialFund: '',
  _specialTab:  'all',

  // ---- Classification ----
  _isMOOE(ft) {
    if (!ft) return false;
    const f = ft.toLowerCase();
    return /(1st|2nd|3rd|4th)\s+quarter/.test(f)
        || f.includes('regular mooe')
        || f.includes('additional mooe');
  },

  _quarterKey(f) {
    const ft = (f.fund_type || '').toLowerCase();
    let q;
    if      (ft.includes('1st quarter')) q = 1;
    else if (ft.includes('2nd quarter')) q = 2;
    else if (ft.includes('3rd quarter')) q = 3;
    else if (ft.includes('4th quarter')) q = 4;
    else if (f.ada_date) {
      const mo = parseInt(f.ada_date.split('-')[1] || '1', 10);
      q = Math.ceil(mo / 3);
    } else q = 1;
    const yr = (f.ada_date || '').split('-')[0] || String(f.year || new Date().getFullYear());
    return `Q${q}-${yr}`;
  },

  _visibleFunds() {
    let funds = this._schoolId ? this._allFunds.filter(f => f.school_id === this._schoolId) : this._allFunds;
    if (this._year) funds = funds.filter(f => String(f.year) === this._year);
    if (this._mode === 'mooe')    funds = funds.filter(f => this._isMOOE(f.fund_type));
    if (this._mode === 'special') funds = funds.filter(f => !this._isMOOE(f.fund_type));
    return funds;
  },

  // ---- render() — instant shell, no network ----
  render(mode = 'all') {
    this._mode     = mode;
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    this._isAdmin  = typeof Auth !== 'undefined' ? Auth.isAdmin()    : false;
    return `<div id="dash-root"><div class="flex justify-center py-20"><div class="spinner"></div></div></div>`;
  },

  afterRender() { this._fetchAndPaint(); },

  async _fetchAndPaint() {
    // Paint cached data immediately on return visits
    if (this._schools.length || this._allFunds.length) this._paintAll();
    const [schoolsRes, fundsRes] = await Promise.all([DB.getSchools(), DB.getFunds()]);
    this._schools  = (schoolsRes.data || []).sort((a, b) => a.name.localeCompare(b.name));
    this._allFunds = (fundsRes.data   || []).map(f => ({
      ...f,
      fund_type: (f.fund_type || '').trim().toUpperCase() === 'NUTRIBAN' ? 'SBFP-Food' : f.fund_type,
    }));
    this._paintAll();
  },

  _paintAll() {
    const root = document.getElementById('dash-root');
    if (!root) return;
    const sum  = this._buildSummaryHtml();
    const mooe = this._mode !== 'special' ? `<div class="mb-6">${this._buildMOOEHtml()}</div>` : '';
    const spec = this._mode !== 'mooe'    ? `<div>${this._buildSpecialHtml()}</div>` : '';
    root.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">${sum}</div>${mooe}${spec}`;
  },

  // ---- Summary cards ----
  _buildSummaryHtml() {
    const funds    = this._visibleFunds();
    const totalAmt = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const liqAmt   = funds.filter(f => f.status === 'liquidated').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const unliqAmt = totalAmt - liqAmt;
    const unliqCnt = funds.filter(f => f.status !== 'liquidated').length;
    const liqPct   = totalAmt > 0 ? Math.round(liqAmt   / totalAmt * 100) : 0;
    const unliqPct = totalAmt > 0 ? Math.round(unliqAmt / totalAmt * 100) : 0;
    const schoolCnt = new Set(funds.map(f => f.school_id).filter(Boolean)).size;

    const clickableCard = (title, value, color, sub, status) => `
      <div class="stat-card" style="background:${color};cursor:pointer;transition:all 0.2s"
        onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'"
        onclick="DashboardView.filterByStatus('${status}')">
        <div class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:rgba(255,255,255,0.75)">${title}</div>
        <div class="text-2xl font-bold mb-1" style="color:#fff">${value}</div>
        <div class="text-xs" style="color:rgba(255,255,255,0.65)">${sub}</div>
      </div>`;

    return (
      statCard('Total Downloaded', fmt(totalAmt),       '#1d6fb0', `${schoolCnt} school${schoolCnt !== 1 ? 's' : ''}`) +
      clickableCard('Liquidated',   fmt(liqAmt),        '#16a34a', `${liqPct}% of total`, 'liquidated') +
      clickableCard('Unliquidated', fmt(unliqAmt),      '#78350f', `${unliqPct}% of total`, 'unliquidated') +
      statCard('Needs Attention', String(unliqCnt),     '#dc2626', 'unliquidated releases')
    );
  },

  setSchool(id) {
    this._schoolId    = id || null;
    this._mooeQuarter = null;
    this._mooeTab     = 'all';
    this._specialFund = '';
    this._specialTab  = 'all';
    this._paintAll();
  },

  setYear(yr) {
    this._year = yr;
    this._mooeQuarter = null;
    this._mooeTab     = 'all';
    this._specialFund = '';
    this._specialTab  = 'all';
    this._paintAll();
  },

  filterByStatus(status) {
    if (this._mooeTab === status && this._specialTab === status) {
      this._mooeTab = 'all';
      this._specialTab = 'all';
    } else {
      this._mooeTab = status;
      this._specialTab = status;
    }
    this._paintAll();
  },

  // ============================================================
  // MOOE SECTION
  // ============================================================
  _buildMOOEHtml() {
    const mooeFunds     = this._visibleFunds().filter(f => this._isMOOE(f.fund_type));
    const schoolsToShow = this._schoolId
      ? this._schools.filter(s => s.id === this._schoolId)
      : this._schools;

    const qKeys = [...new Set(mooeFunds.map(f => this._quarterKey(f)))]
      .filter(k => !/Q\d+-$/.test(k) && !k.includes('undefined'))
      .sort((a, b) => {
        const [aq, ay] = a.slice(1).split('-').map(Number);
        const [bq, by] = b.slice(1).split('-').map(Number);
        return (by - ay) || (bq - aq);
      });

    if (!qKeys.length) {
      return `<div class="section-card"><div class="section-card-header"><h3>MOOE (quarterly)</h3></div><div class="section-card-body">${emptyState('No MOOE records found. Add records via Fund Releases.')}</div></div>`;
    }

    if (!this._mooeQuarter || !qKeys.includes(this._mooeQuarter)) {
      this._mooeQuarter = qKeys[0];
    }

    const [qn, yr]  = this._mooeQuarter.split('-');
    const qFunds     = mooeFunds.filter(f => this._quarterKey(f) === this._mooeQuarter);
    const withRecord = new Set(qFunds.map(f => f.school_id));
    const notRecvCnt = schoolsToShow.filter(s => !withRecord.has(s.id)).length;
    const allCnt     = qFunds.length + notRecvCnt;
    const liqCnt     = qFunds.filter(f => f.status === 'liquidated').length;
    const unliqCnt   = qFunds.filter(f => f.status !== 'liquidated').length;
    const qOpts      = qKeys.map(q => `<option value="${q}" ${q === this._mooeQuarter ? 'selected' : ''}>${q.replace('-', ' ')}</option>`).join('');

    return `
    <div class="section-card">
      <div class="section-card-header">
        <div>
          <h3>MOOE (quarterly)</h3>
          <div class="text-xs text-gray-500 mt-1">${qn} ${yr}, all ${schoolsToShow.length} schools sorted alphabetically</div>
        </div>
        <div class="flex gap-2 items-center flex-wrap justify-end">
          ${this._isAdmin ? `
          <select class="form-select" style="width:auto;min-width:190px" onchange="DashboardView.setSchool(this.value)">
            <option value="">All Schools</option>
            ${this._schools.map(s => `<option value="${s.id}" ${s.id === this._schoolId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>` : ''}
          <select class="form-select" style="width:auto;min-width:130px"
            onchange="DashboardView.setMOOEQuarter(this.value)">${qOpts}</select>
        </div>
      </div>
      <div style="padding:0 20px">
        <div class="flex gap-2 py-3 border-b border-gray-100">
          ${this._tabBtn('mooe','all',          `All (${allCnt})`)}
          ${this._tabBtn('mooe','unliquidated', `Unliquidated (${unliqCnt})`)}
          ${this._tabBtn('mooe','liquidated',   `Liquidated (${liqCnt})`)}
        </div>
      </div>
      <div id="dash-mooe-table" class="table-scroll">${this._buildMOOETableHtml(qFunds, schoolsToShow)}</div>
    </div>`;
  },

  _buildMOOETableHtml(qFunds, schoolsToShow) {
    if (!qFunds) {
      const mooeFunds = this._visibleFunds().filter(f => this._isMOOE(f.fund_type));
      qFunds        = mooeFunds.filter(f => this._quarterKey(f) === this._mooeQuarter);
      schoolsToShow = this._schoolId
        ? this._schools.filter(s => s.id === this._schoolId)
        : this._schools;
    }

    const rows = [];
    for (const school of schoolsToShow) {
      const recs = qFunds.filter(f => f.school_id === school.id);
      if (recs.length) {
        recs.forEach(f => rows.push({ school, fund: f, notReceived: false }));
      } else {
        rows.push({ school, fund: null, notReceived: true });
      }
    }

    let visible = rows;
    if (this._mooeTab === 'liquidated')   visible = rows.filter(r => !r.notReceived && r.fund.status === 'liquidated');
    if (this._mooeTab === 'unliquidated') visible = rows.filter(r => !r.notReceived && r.fund.status !== 'liquidated');

    if (!visible.length) {
      return `<div class="py-8 text-center text-gray-400 text-sm">No records match this filter.</div>`;
    }

    return `
    <table class="data-table">
      <thead><tr>
        <th>School</th><th>ADA No.</th><th>Date</th><th>Bank</th>
        <th class="col-amount">Amount</th><th>Status</th><th>Deadline</th>
        ${this._isAdmin ? '<th></th>' : ''}
      </tr></thead>
      <tbody>
        ${visible.map(({ school, fund, notReceived }) => {
          if (notReceived) {
            return `<tr>
              <td class="text-sm font-medium">${school.name}</td>
              <td class="text-gray-300">—</td>
              <td class="text-gray-300">—</td>
              <td class="text-gray-300">—</td>
              <td class="col-amount text-gray-300">—</td>
              <td><span class="badge" style="background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0">Not received</span></td>
              <td class="text-gray-300">—</td>
              ${this._isAdmin ? '<td></td>' : ''}
            </tr>`;
          }
          return `<tr>
            <td class="text-sm font-medium">${school.name}</td>
            <td class="font-mono text-xs">${fund.ada_no || '—'}</td>
            <td class="text-xs whitespace-nowrap">${compactDate(fund.ada_date)}</td>
            <td>${bankBadge(fund.fund_type)}</td>
            <td class="col-amount font-semibold">${fmt(fund.amount)}</td>
            <td>${liquidBadge(fund.status)}</td>
            <td>${deadlineBadge(fund.status, fund.deadline)}</td>
            ${this._isAdmin ? `<td><button class="btn btn-sm btn-secondary"
              onclick="DashboardView.toggleStatus('${fund.id}','${fund.status}')">
              ${fund.status === 'liquidated' ? 'Mark Unliquidated' : 'Mark Liquidated'}
            </button></td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  _renderMOOETable() {
    const el = document.getElementById('dash-mooe-table');
    if (el) el.innerHTML = this._buildMOOETableHtml();
  },

  setMOOEQuarter(q) {
    this._mooeQuarter = q;
    this._mooeTab     = 'all';
    this._paintAll();
  },

  setMOOETab(tab) {
    this._mooeTab = tab;
    ['all','unliquidated','liquidated'].forEach(t => {
      const b = document.getElementById(`mooe-tab-${t}`);
      if (b) b.className = this._tabClass(t === tab);
    });
    this._renderMOOETable();
  },

  // ============================================================
  // SPECIAL FUNDS SECTION
  // ============================================================
  _buildSpecialHtml() {
    const specFunds = this._visibleFunds().filter(f => !this._isMOOE(f.fund_type));
    const fundTypes = [...new Set(specFunds.map(f => f.fund_type).filter(Boolean))].sort();

    if (!specFunds.length) {
      return `<div class="section-card"><div class="section-card-header"><h3>Special Funds (per release)</h3></div><div class="section-card-body">${emptyState('No special fund records found.')}</div></div>`;
    }

    if (this._specialFund && !fundTypes.includes(this._specialFund)) this._specialFund = '';

    const filtered = this._specialFund
      ? specFunds.filter(f => f.fund_type === this._specialFund)
      : specFunds;

    const allCnt   = filtered.length;
    const liqCnt   = filtered.filter(f => f.status === 'liquidated').length;
    const unliqCnt = filtered.filter(f => f.status !== 'liquidated').length;

    const ftOpts = `<option value="">All special funds</option>` +
      fundTypes.map(ft => `<option value="${ft}" ${ft === this._specialFund ? 'selected' : ''}>${ft}</option>`).join('');

    return `
    <div class="section-card">
      <div class="section-card-header">
        <div>
          <h3>Special Funds (per release)</h3>
          <div class="text-xs text-gray-500 mt-1">${specFunds.length} releases across all special fund types</div>
        </div>
        <div class="flex gap-2 items-center flex-wrap justify-end">
          ${this._isAdmin ? `
          <select class="form-select" style="width:auto;min-width:190px" onchange="DashboardView.setSchool(this.value)">
            <option value="">All Schools</option>
            ${this._schools.map(s => `<option value="${s.id}" ${s.id === this._schoolId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>` : ''}
          <select class="form-select" style="width:auto;min-width:210px"
            onchange="DashboardView.setSpecialFund(this.value)">${ftOpts}</select>
        </div>
      </div>
      <div style="padding:0 20px">
        <div class="flex gap-2 py-3 border-b border-gray-100">
          ${this._tabBtn('special','all',          `All (${allCnt})`)}
          ${this._tabBtn('special','unliquidated', `Unliquidated (${unliqCnt})`)}
          ${this._tabBtn('special','liquidated',   `Liquidated (${liqCnt})`)}
        </div>
      </div>
      <div id="dash-special-table" class="table-scroll">${this._buildSpecialTableHtml(filtered)}</div>
    </div>`;
  },

  _buildSpecialTableHtml(filtered) {
    if (!filtered) {
      const specFunds = this._visibleFunds().filter(f => !this._isMOOE(f.fund_type));
      filtered = this._specialFund
        ? specFunds.filter(f => f.fund_type === this._specialFund)
        : specFunds;
    }

    if (this._specialTab === 'liquidated')   filtered = filtered.filter(f => f.status === 'liquidated');
    if (this._specialTab === 'unliquidated') filtered = filtered.filter(f => f.status !== 'liquidated');

    filtered = [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'liquidated' ? 1 : -1;
      return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
    });

    if (!filtered.length) {
      return `<div class="py-8 text-center text-gray-400 text-sm">No records match this filter.</div>`;
    }

    return `
    <table class="data-table">
      <thead><tr>
        <th>School</th><th>Fund</th><th>ADA No.</th><th>Date</th>
        <th>Bank</th><th class="col-amount">Amount</th><th>Status</th><th>Deadline</th>
        ${this._isAdmin ? '<th></th>' : ''}
      </tr></thead>
      <tbody>
        ${filtered.map(f => {
          const school = this._schools.find(s => s.id === f.school_id);
          return `<tr>
            <td class="text-sm font-medium">${school?.name || f.school_id || '—'}</td>
            <td class="text-xs text-gray-600">${f.fund_type || '—'}</td>
            <td class="font-mono text-xs">${f.ada_no || '—'}</td>
            <td class="text-xs whitespace-nowrap">${compactDate(f.ada_date)}</td>
            <td>${bankBadge(f.fund_type)}</td>
            <td class="col-amount font-semibold">${fmt(f.amount)}</td>
            <td>${liquidBadge(f.status)}</td>
            <td>${deadlineBadge(f.status, f.deadline)}</td>
            ${this._isAdmin ? `<td><button class="btn btn-sm btn-secondary"
              onclick="DashboardView.toggleStatus('${f.id}','${f.status}')">
              ${f.status === 'liquidated' ? 'Mark Unliquidated' : 'Mark Liquidated'}
            </button></td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  _renderSpecialTable() {
    const specFunds = this._visibleFunds().filter(f => !this._isMOOE(f.fund_type));
    const filtered  = this._specialFund
      ? specFunds.filter(f => f.fund_type === this._specialFund)
      : specFunds;
    const el = document.getElementById('dash-special-table');
    if (el) el.innerHTML = this._buildSpecialTableHtml(filtered);
  },

  setSpecialFund(ft) {
    this._specialFund = ft;
    this._specialTab  = 'all';
    this._paintAll();
  },

  setSpecialTab(tab) {
    this._specialTab = tab;
    ['all','unliquidated','liquidated'].forEach(t => {
      const b = document.getElementById(`special-tab-${t}`);
      if (b) b.className = this._tabClass(t === tab);
    });
    this._renderSpecialTable();
  },

  // ---- Clear all fund data (admin only) ----
  async clearAllFunds() {
    if (!confirm('Delete ALL fund data from this device? This cannot be undone.')) return;
    localStorage.removeItem('dwd_funds');
    this._allFunds = [];
    App.toast('All fund data cleared.');
    this._paintAll();
  },

  // ---- Toggle status (admin only) ----
  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'liquidated' ? 'unliquidated' : 'liquidated';
    const fund = this._allFunds.find(f => f.id === id);
    if (!fund) return;
    fund.status = newStatus;
    this._paintAll();
    App.toast(`Marked as ${newStatus === 'liquidated' ? 'Liquidated' : 'Unliquidated'}`);
    const { error } = await DB.upsertFund({ ...fund });
    if (error) {
      fund.status = currentStatus;
      this._paintAll();
      App.toast('Failed to save. Please try again.', 'error');
    }
  },

  // ---- Tab helpers ----
  _tabClass(active) {
    return active ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  },
  _tabBtn(section, tab, label) {
    const active = section === 'mooe' ? this._mooeTab === tab : this._specialTab === tab;
    const fn     = section === 'mooe' ? 'setMOOETab' : 'setSpecialTab';
    return `<button id="${section}-tab-${tab}" class="${this._tabClass(active)}"
      onclick="DashboardView.${fn}('${tab}')">${label}</button>`;
  },
};

// ============================================================
// MOOE-only and Special Funds-only sub-views (share DashboardView logic)
// ============================================================
const DashboardMOOEView = {
  async render()      { return DashboardView.render('mooe'); },
  async afterRender() { return DashboardView.afterRender(); },
};
const DashboardSpecialView = {
  async render()      { return DashboardView.render('special'); },
  async afterRender() { return DashboardView.afterRender(); },
};

// ============================================================
// ALL-FUNDS DASHBOARD — combined read-only rollup
// ============================================================
const AllFundsDashboardView = {
  _funds:   [],
  _schools: [],

  render() {
    return `<div id="afd-root" class="space-y-6"><div class="flex justify-center py-20"><div class="spinner"></div></div></div>`;
  },

  afterRender() { this._loadAFD(); },

  async _loadAFD() {
    if (this._funds.length || this._schools.length) this._paint(); // cache hit
    const schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    const [fundsRes, schoolsRes] = await Promise.all([DB.getFunds(), DB.getSchools()]);
    let funds   = (fundsRes.data || []).map(f => ({
      ...f,
      fund_type: (f.fund_type || '').trim().toUpperCase() === 'NUTRIBAN' ? 'SBFP-Food' : f.fund_type,
    }));
    let schools = schoolsRes.data || [];
    if (schoolId) {
      funds   = funds.filter(f => f.school_id === schoolId);
      schools = schools.filter(s => s.id === schoolId);
    }
    this._funds   = funds;
    this._schools = schools;
    this._paint();
  },

  _buildMobBlock(funds, schools, totalAmt, liqAmt, unliqAmt, liqPct, attention, today) {
    const overduePct = totalAmt > 0 ? Math.round(unliqAmt / totalAmt * 100) : 0;
    const barColor   = liqPct >= 80 ? '#16a34a' : liqPct >= 50 ? '#1E5FA8' : '#b45309';

    const metricsHtml =
      `<div class="afd-mob-metric">
        <div class="afd-mob-label">Total Downloaded</div>
        <div class="afd-mob-value" style="color:#1d6fb0">${fmt(totalAmt)}</div>
      </div>
      <div class="afd-mob-metric">
        <div class="afd-mob-label">Liquidated</div>
        <div class="afd-mob-value" style="color:#16a34a">${fmt(liqAmt)}</div>
      </div>
      <div class="afd-mob-metric">
        <div class="afd-mob-label">Unliquidated</div>
        <div class="afd-mob-value" style="color:#b45309">${fmt(unliqAmt)}</div>
      </div>
      <div class="afd-mob-metric">
        <div class="afd-mob-label">Overdue</div>
        <div class="afd-mob-value" style="color:#dc2626">${attention.length}</div>
      </div>`;

    const progHtml =
      `<div class="afd-mob-card">
        <div class="afd-mob-prog-row">
          <span class="afd-mob-prog-label">Liquidation progress</span>
          <span class="afd-mob-prog-pct" style="color:${barColor}">${liqPct}%</span>
        </div>
        <div class="afd-mob-bar"><div class="afd-mob-bar-fill" style="width:${liqPct}%;background:${barColor}"></div></div>
      </div>`;

    const overdueHtml = attention.length
      ? `<div class="afd-mob-card">
          <div class="afd-mob-header" style="padding:0 0 8px">Needs Attention</div>
          ${attention.slice(0, 5).map(({ f, school, daysOverdue }) =>
            `<div class="afd-mob-overdue-row">
              <span class="afd-mob-overdue-name">${school ? school.name : (f.school_id || 'Unknown')}</span>
              <span class="afd-mob-overdue-days">${daysOverdue}d overdue</span>
            </div>`
          ).join('')}
        </div>`
      : `<div class="afd-mob-card" style="color:#6b7280;font-size:13px;text-align:center">All releases on track.</div>`;

    return `
      <div class="afd-mob-header">Overview</div>
      <div class="afd-mob-grid">${metricsHtml}</div>
      ${progHtml}
      ${overdueHtml}
    `;
  },

  _paint() {
    const root = document.getElementById('afd-root');
    if (!root) return;

    const funds   = this._funds;
    const schools = this._schools;
    const today   = new Date(); today.setHours(0, 0, 0, 0);

    const totalAmt   = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const liqFunds   = funds.filter(f => f.status === 'liquidated');
    const unliqFunds = funds.filter(f => f.status !== 'liquidated');
    const liqAmt     = liqFunds.reduce((s, f)  => s + (parseFloat(f.amount) || 0), 0);
    const unliqAmt   = totalAmt - liqAmt;
    const liqPct     = totalAmt > 0 ? Math.round(liqAmt   / totalAmt * 100) : 0;
    const unliqPct   = totalAmt > 0 ? Math.round(unliqAmt / totalAmt * 100) : 0;

    // Needs Attention: has a deadline AND is past it
    const attention = unliqFunds
      .filter(f => f.deadline)
      .map(f => {
        const deadline    = new Date(f.deadline + 'T00:00:00');
        const daysOverdue = Math.floor((today - deadline) / 86400000);
        return { f, school: schools.find(s => s.id === f.school_id), daysOverdue };
      })
      .filter(item => item.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // MOOE / Special split
    function splitTotals(arr) {
      const dl  = arr.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const lq  = arr.filter(f => f.status === 'liquidated').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      return { dl, lq, ul: dl - lq, pct: dl > 0 ? Math.round(lq / dl * 100) : 0 };
    }
    const mRow = splitTotals(funds.filter(f =>  DashboardView._isMOOE(f.fund_type)));
    const sRow = splitTotals(funds.filter(f => !DashboardView._isMOOE(f.fund_type)));
    const tRow = splitTotals(funds);

    // ---------- desktop redesign (option 2a) ----------
    // "₱ 1,234.56" → pesos big, centavos small
    const money = (n) => {
      const s = fmt(n), i = s.lastIndexOf('.');
      return i === -1 ? s : `${s.slice(0, i)}<span class="cents">${s.slice(i)}</span>`;
    };

    // KPI strip
    const kpi = (label, value, sub, o = {}) =>
      `<div class="atlas-kpi${o.attention ? ' is-attention' : ''}"${o.accent ? ` style="--atlas-accent:${o.accent}"` : ''}>
        <div class="atlas-kpi-label">${label}</div>
        <div class="atlas-kpi-value"${o.color ? ` style="color:${o.color}"` : ''}>${value}</div>
        <div class="atlas-kpi-sub"${o.subColor ? ` style="color:${o.subColor};font-weight:600"` : ''}>${sub}</div>
      </div>`;

    const sumHtml =
      kpi('Total Downloaded', money(totalAmt), `${funds.length} release${funds.length !== 1 ? 's' : ''}`) +
      kpi('Liquidated',   money(liqAmt),   `${liqPct}% of total ▲`, { accent: '#16a34a', color: '#15803d', subColor: '#16a34a' }) +
      kpi('Unliquidated', money(unliqAmt), `${unliqPct}% of total`, { accent: '#f59e0b', color: '#b45309', subColor: '#b45309' }) +
      kpi('Needs Attention', String(attention.length),
          `release${attention.length !== 1 ? 's' : ''} past deadline`,
          { accent: '#ef4444', color: '#dc2626', subColor: '#dc2626', attention: true });

    // Fund Split — bar per row. Green at ≥50% liquidated, amber below.
    const splitLine = (label, r, isTotal) => {
      const green = r.pct >= 50;
      return `
        <div class="atlas-split-row${isTotal ? ' is-total' : ''}">
          <div class="atlas-split-cat">${label}</div>
          <div class="atlas-split-num">${fmt(r.dl)}</div>
          <div class="atlas-split-num is-unliq">${fmt(r.ul)}</div>
          <div class="atlas-bar-cell">
            <div class="atlas-bar">
              <div class="atlas-bar-fill ${green ? 'is-green' : 'is-amber'}" style="width:${r.pct}%"></div>
            </div>
            <span class="atlas-bar-pct" style="color:${green ? '#15803d' : '#b45309'}">${r.pct}%</span>
          </div>
        </div>`;
    };

    const splitCard = `
      <div class="atlas-card">
        <div class="atlas-card-head">
          <div class="atlas-card-title">Fund Split</div>
          <div class="atlas-card-note">by liquidation %</div>
        </div>
        <div class="atlas-split-body">
          <div class="atlas-split-row is-head">
            <div>Category</div>
            <div style="text-align:right">Downloaded</div>
            <div style="text-align:right">Unliq.</div>
            <div>Liquidation</div>
          </div>
          ${splitLine('MOOE', mRow)}
          ${splitLine('Special Funds', sRow)}
          ${splitLine('Total', tRow, true)}
        </div>
      </div>`;

    // Overall Liquidation donut — arc length derived from liqPct
    const CIRC = 2 * Math.PI * 60;            // r = 60
    const arc  = (liqPct / 100) * CIRC;
    const compact = totalAmt >= 1e6 ? `₱${(totalAmt / 1e6).toFixed(2)}M` : fmt(totalAmt);

    const donutCard = `
      <div class="atlas-card atlas-donut-card">
        <div class="atlas-card-title">Overall Liquidation</div>
        <div class="atlas-donut-sub">of ${compact} downloaded</div>
        <div class="atlas-donut-wrap">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="60" fill="none" stroke="#eef1f4" stroke-width="16"/>
            <circle class="atlas-donut-arc" cx="75" cy="75" r="60" fill="none" stroke="url(#atlasDonut)"
                    stroke-width="16" stroke-linecap="round"
                    stroke-dasharray="${arc.toFixed(1)} ${CIRC.toFixed(1)}"
                    transform="rotate(-90 75 75)"/>
            <defs>
              <linearGradient id="atlasDonut" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#15803d"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="atlas-donut-center">
            <div class="atlas-donut-pct">${liqPct}%</div>
            <div class="atlas-donut-cap">LIQUIDATED</div>
          </div>
        </div>
        <div class="atlas-legend">
          <div class="atlas-legend-row">
            <span><span class="atlas-swatch" style="background:#16a34a"></span>Liquidated</span>
            <span class="atlas-legend-val">${fmt(liqAmt)}</span>
          </div>
          <div class="atlas-legend-row">
            <span><span class="atlas-swatch" style="background:#f59e0b"></span>Unliquidated</span>
            <span class="atlas-legend-val">${fmt(unliqAmt)}</span>
          </div>
        </div>
      </div>`;

    const splitHtml = `<div class="atlas-split-grid">${splitCard}${donutCard}</div>`;

    // Needs Attention queue — past deadline only, worst first
    const naHead = `
      <div class="atlas-card-head atlas-na-head">
        <div style="display:flex;align-items:center;gap:9px">
          <span class="atlas-na-dot"></span>
          <span class="atlas-card-title">Needs Attention</span>
        </div>
        <span class="atlas-na-note">Past deadline — worst first</span>
      </div>`;

    const queueHtml = !attention.length
      ? `<div class="atlas-card">
          ${naHead}
          <div style="padding:34px 20px;text-align:center">
            <div style="font-size:14px;font-weight:700;color:#15803d">All caught up</div>
            <div style="font-size:12.5px;color:#8a93a3;margin-top:4px">No releases are past their liquidation deadline.</div>
          </div>
        </div>`
      : `<div class="atlas-card">
          ${naHead}
          <div class="table-scroll">
            <table class="atlas-na-table">
              <thead><tr>
                <th>School</th><th>Fund Type</th><th style="text-align:right">Amount</th>
                <th>ADA Date</th><th>Deadline</th><th>Overdue</th>
              </tr></thead>
              <tbody>
                ${attention.map(({ f, school, daysOverdue }) => {
                  const name = school ? school.name : (f.school_id || '—');
                  return `
                <tr>
                  <td>
                    <div class="atlas-na-school">
                      <div class="atlas-na-chip">${App._initials(name)}</div>
                      <div class="atlas-na-name">${name}</div>
                    </div>
                  </td>
                  <td>${f.fund_type || '—'}</td>
                  <td class="atlas-na-amt">${fmt(f.amount)}</td>
                  <td style="white-space:nowrap">${compactDate(f.ada_date)}</td>
                  <td class="atlas-na-due" style="white-space:nowrap">${compactDate(f.deadline)}</td>
                  <td><span class="atlas-na-pill">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</span></td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

    root.innerHTML =
      `<div id="afd-mob-block">${this._buildMobBlock(funds, schools, totalAmt, liqAmt, unliqAmt, liqPct, attention, today)}</div>` +
      `<div class="afd-desktop atlas-ui atlas-stack">` +
        `<div class="atlas-kpi-grid">${sumHtml}</div>${splitHtml}${queueHtml}` +
      `</div>`;
  },
};

// ============================================================
// Global helpers — used by dashboard, mooe, cdr, and other views
// ============================================================
function statCard(title, value, color, sub) {
  return `<div class="stat-card" style="background:${color}">
    <div class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:rgba(255,255,255,0.75)">${title}</div>
    <div class="text-2xl font-bold mb-1" style="color:#fff">${value}</div>
    <div class="text-xs" style="color:rgba(255,255,255,0.65)">${sub}</div>
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
function compactDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}
function bankBadge(fund_type) {
  const ft = (fund_type || '').toUpperCase();
  if (ft.includes('LBP')) return `<span class="badge" style="background:#dcfce7;color:#166534">LBP</span>`;
  if (ft.includes('DBP')) return `<span class="badge" style="background:#dbeafe;color:#1e40af">DBP</span>`;
  return `<span class="text-xs text-gray-300">—</span>`;
}
function liquidBadge(status) {
  return status === 'liquidated'
    ? `<span class="badge" style="background:#dcfce7;color:#166534">✓ Liquidated</span>`
    : `<span class="badge" style="background:#fef3c7;color:#92400e">⚠ Unliquidated</span>`;
}
function deadlineBadge(status, deadline) {
  if (status === 'liquidated') {
    return `<span class="badge" style="background:#dcfce7;color:#166534">✓ Okay</span>`;
  }
  if (!deadline) return `<span class="text-xs text-gray-300">—</span>`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  return dl < today
    ? `<span class="badge" style="background:#fee2e2;color:#991b1b">${compactDate(deadline)}</span>`
    : `<span class="text-xs text-gray-600 whitespace-nowrap">${compactDate(deadline)}</span>`;
}
function statusBadge(s) { return liquidBadge(s); }
function schoolName(row, schools) {
  if (row.schools) return row.schools.name;
  const s = (schools || []).find(s => s.id === row.school_id);
  return s ? s.name : '—';
}
function emptyState(msg) {
  return `<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>${msg}</p></div>`;
}
