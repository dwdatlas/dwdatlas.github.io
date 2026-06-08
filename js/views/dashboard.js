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

  // ---- render() — loads data, returns skeleton HTML ----
  async render(mode = 'all') {
    this._mode     = mode;
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    this._isAdmin  = typeof Auth !== 'undefined' ? Auth.isAdmin()    : false;

    const [schoolsRes, fundsRes] = await Promise.all([DB.getSchools(), DB.getFunds()]);
    this._schools  = (schoolsRes.data || []).sort((a, b) => a.name.localeCompare(b.name));
    this._allFunds = (fundsRes.data   || []).map(f => ({
      ...f,
      fund_type: (f.fund_type || '').trim().toUpperCase() === 'NUTRIBAN' ? 'SBFP-Food' : f.fund_type,
    }));

    return `
    <div id="dash-summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>
    ${mode !== 'special' ? '<div id="dash-mooe" class="mb-6"></div>'    : ''}
    ${mode !== 'mooe'    ? '<div id="dash-special" class="mb-6"></div>' : ''}
    `;
  },

  async afterRender() {
    this._renderSummary();
    if (this._mode !== 'special') this._renderMOOE();
    if (this._mode !== 'mooe')    this._renderSpecial();
  },

  // ---- Global summary cards (never change with filters) ----
  _renderSummary() {
    const funds    = this._visibleFunds();
    const totalAmt = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const liqAmt   = funds.filter(f => f.status === 'liquidated').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const unliqAmt = totalAmt - liqAmt;
    const unliqCnt = funds.filter(f => f.status !== 'liquidated').length;
    const liqPct   = totalAmt > 0 ? Math.round(liqAmt   / totalAmt * 100) : 0;
    const unliqPct = totalAmt > 0 ? Math.round(unliqAmt / totalAmt * 100) : 0;
    const schoolCnt = new Set(funds.map(f => f.school_id).filter(Boolean)).size;
    const el = document.getElementById('dash-summary');
    if (!el) return;
    el.innerHTML =
      statCard('Total Downloaded', fmt(totalAmt),       '#1d6fb0', `${schoolCnt} school${schoolCnt !== 1 ? 's' : ''}`) +
      statCard('Liquidated',       fmt(liqAmt),         '#16a34a', `${liqPct}% of total`) +
      statCard('Unliquidated',     fmt(unliqAmt),       '#78350f', `${unliqPct}% of total`) +
      statCard('Needs Attention',  String(unliqCnt),    '#dc2626', 'unliquidated releases');
  },

  setSchool(id) {
    this._schoolId    = id || null;
    this._mooeQuarter = null;
    this._mooeTab     = 'all';
    this._specialFund = '';
    this._specialTab  = 'all';
    this._renderSummary();
    if (this._mode !== 'special') this._renderMOOE();
    if (this._mode !== 'mooe')    this._renderSpecial();
  },

  setYear(yr) {
    this._year = yr;
    this._mooeQuarter = null;
    this._mooeTab     = 'all';
    this._specialFund = '';
    this._specialTab  = 'all';
    this._renderSummary();
    if (this._mode !== 'special') this._renderMOOE();
    if (this._mode !== 'mooe')    this._renderSpecial();
  },

  // ============================================================
  // MOOE SECTION
  // ============================================================
  _renderMOOE() {
    const mooeFunds     = this._visibleFunds().filter(f => this._isMOOE(f.fund_type));
    const schoolsToShow = this._schoolId
      ? this._schools.filter(s => s.id === this._schoolId)
      : this._schools;

    const qKeys = [...new Set(mooeFunds.map(f => this._quarterKey(f)))]
      .filter(k => !/Q\d+-$/.test(k) && !k.includes('undefined'))
      .sort((a, b) => {
        const [aq, ay] = a.slice(1).split('-').map(Number);
        const [bq, by] = b.slice(1).split('-').map(Number);
        return (by - ay) || (bq - aq); // newest first
      });

    const el = document.getElementById('dash-mooe');
    if (!el) return;

    if (!qKeys.length) {
      el.innerHTML = `<div class="section-card"><div class="section-card-header"><h3>MOOE (quarterly)</h3></div><div class="section-card-body">${emptyState('No MOOE records found. Add records via Fund Releases.')}</div></div>`;
      return;
    }

    if (!this._mooeQuarter || !qKeys.includes(this._mooeQuarter)) {
      this._mooeQuarter = qKeys[0];
    }

    const [qn, yr]   = this._mooeQuarter.split('-');
    const qFunds      = mooeFunds.filter(f => this._quarterKey(f) === this._mooeQuarter);
    const withRecord  = new Set(qFunds.map(f => f.school_id));
    const notRecvCnt  = schoolsToShow.filter(s => !withRecord.has(s.id)).length;
    const allCnt      = qFunds.length + notRecvCnt;
    const liqCnt      = qFunds.filter(f => f.status === 'liquidated').length;
    const unliqCnt    = qFunds.filter(f => f.status !== 'liquidated').length;

    const qOpts = qKeys.map(q => `<option value="${q}" ${q === this._mooeQuarter ? 'selected' : ''}>${q.replace('-', ' ')}</option>`).join('');

    el.innerHTML = `
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
      <div id="dash-mooe-table" class="table-scroll"></div>
    </div>`;

    this._renderMOOETable(qFunds, schoolsToShow);
  },

  _renderMOOETable(qFunds, schoolsToShow) {
    if (!qFunds) {
      const mooeFunds = this._visibleFunds().filter(f => this._isMOOE(f.fund_type));
      qFunds       = mooeFunds.filter(f => this._quarterKey(f) === this._mooeQuarter);
      schoolsToShow = this._schoolId
        ? this._schools.filter(s => s.id === this._schoolId)
        : this._schools;
    }

    // Build one row per school per ADA record; "Not received" for missing schools
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

    const el = document.getElementById('dash-mooe-table');
    if (!el) return;
    if (!visible.length) {
      el.innerHTML = `<div class="py-8 text-center text-gray-400 text-sm">No records match this filter.</div>`;
      return;
    }

    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>School</th><th>ADA No.</th><th>Date</th><th>Bank</th>
        <th class="text-right">Amount</th><th>Status</th>
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
              <td class="text-right text-gray-300">—</td>
              <td><span class="badge" style="background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0">Not received</span></td>
              ${this._isAdmin ? '<td></td>' : ''}
            </tr>`;
          }
          return `<tr>
            <td class="text-sm font-medium">${school.name}</td>
            <td class="font-mono text-xs">${fund.ada_no || '—'}</td>
            <td class="text-xs whitespace-nowrap">${compactDate(fund.ada_date)}</td>
            <td>${bankBadge(fund.fund_type)}</td>
            <td class="text-right font-semibold">${fmt(fund.amount)}</td>
            <td>${liquidBadge(fund.status)}</td>
            ${this._isAdmin ? `<td><button class="btn btn-sm btn-secondary"
              onclick="DashboardView.toggleStatus('${fund.id}','${fund.status}')">
              ${fund.status === 'liquidated' ? 'Mark Unliquidated' : 'Mark Liquidated'}
            </button></td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  setMOOEQuarter(q) {
    this._mooeQuarter = q;
    this._mooeTab     = 'all';
    this._renderMOOE();
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
  _renderSpecial() {
    const specFunds = this._visibleFunds().filter(f => !this._isMOOE(f.fund_type));
    const fundTypes = [...new Set(specFunds.map(f => f.fund_type).filter(Boolean))].sort();

    const el = document.getElementById('dash-special');
    if (!el) return;

    if (!specFunds.length) {
      el.innerHTML = `<div class="section-card"><div class="section-card-header"><h3>Special Funds (per release)</h3></div><div class="section-card-body">${emptyState('No special fund records found.')}</div></div>`;
      return;
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

    el.innerHTML = `
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
      <div id="dash-special-table" class="table-scroll"></div>
    </div>`;

    this._renderSpecialTable();
  },

  _renderSpecialTable() {
    const specFunds = this._visibleFunds().filter(f => !this._isMOOE(f.fund_type));
    let filtered = this._specialFund
      ? specFunds.filter(f => f.fund_type === this._specialFund)
      : specFunds;

    if (this._specialTab === 'liquidated')   filtered = filtered.filter(f => f.status === 'liquidated');
    if (this._specialTab === 'unliquidated') filtered = filtered.filter(f => f.status !== 'liquidated');

    // Sort: unliquidated first, then amount descending within each group
    filtered = [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'liquidated' ? 1 : -1;
      return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
    });

    const el = document.getElementById('dash-special-table');
    if (!el) return;
    if (!filtered.length) {
      el.innerHTML = `<div class="py-8 text-center text-gray-400 text-sm">No records match this filter.</div>`;
      return;
    }

    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>School</th><th>Fund</th><th>ADA No.</th><th>Date</th>
        <th>Bank</th><th class="text-right">Amount</th><th>Status</th>
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
            <td class="text-right font-semibold">${fmt(f.amount)}</td>
            <td>${liquidBadge(f.status)}</td>
            ${this._isAdmin ? `<td><button class="btn btn-sm btn-secondary"
              onclick="DashboardView.toggleStatus('${f.id}','${f.status}')">
              ${f.status === 'liquidated' ? 'Mark Unliquidated' : 'Mark Liquidated'}
            </button></td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  setSpecialFund(ft) {
    this._specialFund = ft;
    this._specialTab  = 'all';
    this._renderSpecial();
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
    this._renderSummary();
    this._renderMOOE();
    this._renderSpecial();
  },

  // ---- Toggle status (admin only) ----
  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'liquidated' ? 'unliquidated' : 'liquidated';
    const fund = this._allFunds.find(f => f.id === id);
    if (!fund) return;
    await DB.upsertFund({ ...fund, status: newStatus });
    fund.status = newStatus; // update local cache immediately
    App.toast(`Marked as ${newStatus === 'liquidated' ? 'Liquidated ✓' : 'Unliquidated ⚠'}`);
    this._renderSummary();
    this._renderMOOE();
    this._renderSpecial();
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

  async render() {
    const [fundsRes, schoolsRes] = await Promise.all([DB.getFunds(), DB.getSchools()]);
    this._funds   = (fundsRes.data || []).map(f => ({
      ...f,
      fund_type: (f.fund_type || '').trim().toUpperCase() === 'NUTRIBAN' ? 'SBFP-Food' : f.fund_type,
    }));
    this._schools = schoolsRes.data || [];
    return `
      <div id="afd-summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>
      <div id="afd-split"   class="mb-6"></div>
      <div id="afd-queue"></div>`;
  },

  async afterRender() { this._paint(); },

  _paint() {
    const funds   = this._funds;
    const schools = this._schools;
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const OVERDUE_DAYS = 60;

    // ---- Totals (reuse DB data, no second computation) ----
    const totalAmt  = funds.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const liqFunds  = funds.filter(f => f.status === 'liquidated');
    const unliqFunds = funds.filter(f => f.status !== 'liquidated');
    const liqAmt    = liqFunds.reduce((s, f)  => s + (parseFloat(f.amount) || 0), 0);
    const unliqAmt  = totalAmt - liqAmt;
    const liqPct    = totalAmt > 0 ? Math.round(liqAmt   / totalAmt * 100) : 0;
    const unliqPct  = totalAmt > 0 ? Math.round(unliqAmt / totalAmt * 100) : 0;

    // ---- Needs Attention: unliquidated AND issued >60 days ago ----
    const attention = unliqFunds
      .map(f => {
        const issued  = f.ada_date ? new Date(f.ada_date + 'T00:00:00') : null;
        const daysOld = issued ? Math.floor((today - issued) / 86400000) : 0;
        return { f, school: schools.find(s => s.id === f.school_id), daysOld };
      })
      .filter(item => item.daysOld > OVERDUE_DAYS)
      .sort((a, b) => b.daysOld - a.daysOld);

    // ---- MOOE / Special split ----
    function splitTotals(arr) {
      const dl  = arr.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const lq  = arr.filter(f => f.status === 'liquidated').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      return { dl, lq, ul: dl - lq, pct: dl > 0 ? Math.round(lq / dl * 100) : 0 };
    }
    const mRow = splitTotals(funds.filter(f =>  DashboardView._isMOOE(f.fund_type)));
    const sRow = splitTotals(funds.filter(f => !DashboardView._isMOOE(f.fund_type)));
    const tRow = splitTotals(funds);

    // ---- Summary cards (white + colored left border per spec) ----
    const card = (title, value, color, sub) =>
      `<div class="stat-card border-l-4" style="border-color:${color};background:#fff">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">${title}</div>
        <div class="text-2xl font-bold mb-1" style="color:${color}">${value}</div>
        <div class="text-xs text-gray-400">${sub}</div>
      </div>`;

    const sumEl = document.getElementById('afd-summary');
    if (sumEl) sumEl.innerHTML =
      card('Total Downloaded', fmt(totalAmt),              '#1d6fb0', funds.length + ' release' + (funds.length !== 1 ? 's' : '')) +
      card('Liquidated',       fmt(liqAmt),                '#16a34a', liqPct  + '% of total') +
      card('Unliquidated',     fmt(unliqAmt),              '#b45309', unliqPct + '% of total') +
      card('Needs Attention',  String(attention.length),   '#dc2626', '>60 days unliquidated');

    // ---- Fund-split table ----
    const pctBadge = (n, green) => {
      const bg  = green ? '#dcfce7' : '#fef3c7';
      const col = green ? '#166534' : '#92400e';
      return `<span class="badge" style="background:${bg};color:${col}">${n}%</span>`;
    };
    const NUM = 'text-align:right;font-variant-numeric:tabular-nums';
    const splitRow = (label, r) =>
      `<tr>
        <td class="font-semibold text-sm">${label}</td>
        <td style="${NUM}">${fmt(r.dl)}</td>
        <td style="${NUM};font-weight:600;color:#16a34a">${fmt(r.lq)}</td>
        <td style="${NUM};font-weight:600;color:#b45309">${fmt(r.ul)}</td>
        <td style="text-align:right">${pctBadge(r.pct, r.pct >= 50)}</td>
      </tr>`;

    const splitEl = document.getElementById('afd-split');
    if (splitEl) splitEl.innerHTML = `
      <div class="section-card">
        <div class="section-card-header"><h3>Fund Split</h3></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr>
              <th>Category</th>
              <th style="text-align:right">Downloaded</th>
              <th style="text-align:right">Liquidated</th>
              <th style="text-align:right">Unliquidated</th>
              <th style="text-align:right">Liq %</th>
            </tr></thead>
            <tbody>
              ${splitRow('MOOE', mRow)}
              ${splitRow('Special Funds', sRow)}
              <tr style="border-top:2px solid #e2e8f0">
                <td class="font-bold text-sm">Total</td>
                <td style="${NUM};font-weight:700">${fmt(tRow.dl)}</td>
                <td style="${NUM};font-weight:700;color:#16a34a">${fmt(tRow.lq)}</td>
                <td style="${NUM};font-weight:700;color:#b45309">${fmt(tRow.ul)}</td>
                <td style="text-align:right">${pctBadge(tRow.pct, tRow.pct >= 50)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`;

    // ---- Needs Attention queue ----
    const queueEl = document.getElementById('afd-queue');
    if (!queueEl) return;
    if (!attention.length) {
      queueEl.innerHTML = `
        <div class="section-card">
          <div class="section-card-header"><h3>Needs Attention</h3></div>
          <div class="section-card-body">${emptyState('All releases on track.')}</div>
        </div>`;
      return;
    }
    queueEl.innerHTML = `
      <div class="section-card">
        <div class="section-card-header">
          <h3>Needs Attention</h3>
          <span class="text-xs text-gray-500">Unliquidated &gt;60 days — worst first</span>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr>
              <th>School</th><th>Fund Type</th>
              <th class="text-right">Amount</th>
              <th>ADA Date</th>
              <th class="text-right">Days Old</th>
            </tr></thead>
            <tbody>
              ${attention.map(({ f, school, daysOld }) => `
              <tr>
                <td class="font-medium text-sm">${school ? school.name : (f.school_id || '—')}</td>
                <td class="text-xs text-gray-600">${f.fund_type || '—'}</td>
                <td class="text-right font-semibold">${fmt(f.amount)}</td>
                <td class="text-xs whitespace-nowrap">${compactDate(f.ada_date)}</td>
                <td class="text-right">
                  <span class="badge" style="background:#fef3c7;color:#92400e">${daysOld}d</span>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
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
  const dt    = new Date(d + 'T00:00:00');
  const curYr = new Date().getFullYear();
  const dtYr  = dt.getFullYear();
  const mon   = dt.toLocaleDateString('en-PH', { month: 'short' });
  const day   = dt.getDate();
  return dtYr === curYr
    ? `${mon} ${day}`
    : `${mon} ${day}, '${String(dtYr).slice(-2)}`;
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
function statusBadge(s) { return liquidBadge(s); }
function schoolName(row, schools) {
  if (row.schools) return row.schools.name;
  const s = (schools || []).find(s => s.id === row.school_id);
  return s ? s.name : '—';
}
function emptyState(msg) {
  return `<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>${msg}</p></div>`;
}
