// ============================================================
// DOWNLOADED FUNDS VIEW
// Tracks ADA disbursements per school with liquidation status
// ============================================================
const FundsView = {
  _schoolId: null,
  _schools: [],
  _category: '',

  async render(category = '') {
    this._category = category;
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    const isAdmin  = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const [schoolsRes, ftRes] = await Promise.all([DB.getSchools(), DB.getFundTypes(category)]);
    this._schools = schoolsRes.data || [];
    const fundTypeOpts = (ftRes.data || []).map(t => `<option value="${t.name}">`).join('');

    const yr = new Date().getFullYear();
    const years = this._category === 'special' ? [yr, yr - 1] : [yr];

    const schoolOpts = this._schools.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const schoolFilter = this._schoolId
      ? `<input type="hidden" id="f-school" value="${this._schoolId}" /><div class="text-sm font-semibold text-gray-700">${this._schools.find(s=>s.id===this._schoolId)?.name||'My School'}</div>`
      : `<select id="f-school" class="form-select" onchange="FundsView.load()">
           <option value="">All Schools</option>${schoolOpts}
         </select>`;

    return `

    <div class="section-card mb-4">
      <div class="section-card-header"><h3>Filters</h3></div>
      <div class="section-card-body">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label class="form-label">School</label>
            ${schoolFilter}
          </div>
          <div>
            <label class="form-label">Year</label>
            <select id="f-year" class="form-select" onchange="FundsView.load()">
              <option value="">All Years</option>
              ${years.map(y=>`<option value="${y}" ${y===yr?'selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="f-status" class="form-select" onchange="FundsView.load()">
              <option value="">All Statuses</option>
              <option value="unliquidated">Unliquidated</option>
              <option value="liquidated">Liquidated</option>
            </select>
          </div>
          <div>
            <label class="form-label">Fund Type</label>
            <input id="f-fund" type="text" class="form-input" placeholder="Search fund type…" oninput="FundsView.load()" list="f-fund-list" />
            <datalist id="f-fund-list">${fundTypeOpts}</datalist>
          </div>
          ${isAdmin ? `
          <div class="flex items-end gap-2">
            <button class="btn btn-primary flex-1" onclick="FundsView.openForm()">+ Add</button>
          </div>` : '<div></div>'}
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <h3>Fund Records</h3>
        <div id="funds-summary" class="text-xs text-gray-500"></div>
      </div>
      <div id="funds-body" class="table-scroll">
        <div class="flex justify-center py-10"><div class="spinner"></div></div>
      </div>
    </div>`;
  },

  async afterRender() {
    await this.load();
  },

  async load() {
    const school_id = this._schoolId || document.getElementById('f-school')?.value || '';
    const year      = document.getElementById('f-year')?.value   || '';
    const status    = document.getElementById('f-status')?.value || '';
    const fundType  = document.getElementById('f-fund')?.value   || '';

    const filters = {};
    if (school_id) filters.school_id = school_id;
    if (year)      filters.year = year;
    if (status)    filters.status = status;

    const { data } = await DB.getFunds(filters);
    let rows = data || [];
    if (fundType) rows = rows.filter(r => (r.fund_type || '').toLowerCase().includes(fundType.toLowerCase()));
    if (this._category === 'mooe')    rows = rows.filter(r => DashboardView._isMOOE(r.fund_type));
    if (this._category === 'special') rows = rows.filter(r => !DashboardView._isMOOE(r.fund_type));

    const isAdmin = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const el = document.getElementById('funds-body');
    const sumEl = document.getElementById('funds-summary');
    if (!el) return;

    // Summary counts
    const total     = rows.length;
    const liquid    = rows.filter(r=>r.status==='liquidated').length;
    const totalAmt  = rows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    if (sumEl) sumEl.textContent = `${total} records | Total: ${fmt(totalAmt)} | Liquidated: ${liquid} | Unliquidated: ${total - liquid}`;

    if (!rows.length) {
      el.innerHTML = emptyState('No fund records found. Click "+ Add" to add a record.');
      return;
    }

    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>ADA No.</th>
        <th>ADA Date</th>
        <th>Fund Type</th>
        ${!this._schoolId ? '<th>School</th>' : ''}
        ${this._category === 'special' ? '<th>Bank</th>' : ''}
        <th class="text-right">Amount</th>
        <th>Status</th>
        <th>Remarks</th>
        ${isAdmin ? '<th>Actions</th>' : ''}
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const school = this._schools.find(s=>s.id===r.school_id);
          const badge = r.status === 'liquidated'
            ? `<span class="badge badge-liquidated">Liquidated</span>`
            : `<span class="badge badge-missing">Unliquidated</span>`;
          return `
          <tr>
            <td class="font-mono text-xs font-semibold">${r.ada_no || '—'}</td>
            <td class="text-xs whitespace-nowrap">${formatDate(r.ada_date)}</td>
            <td class="text-xs">${r.fund_type || '—'}</td>
            ${!this._schoolId ? `<td class="text-xs">${school?.name || r.school_id || '—'}</td>` : ''}
            ${this._category === 'special' ? `<td class="text-xs">${r.bank || '—'}</td>` : ''}
            <td class="text-right font-semibold">${fmt(r.amount)}</td>
            <td>${badge}</td>
            <td class="text-xs text-gray-500">${r.remarks || ''}</td>
            ${isAdmin ? `
            <td>
              <div class="flex gap-1">
                <button class="btn btn-secondary btn-sm" onclick="FundsView.openForm('${r.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="FundsView.deleteFund('${r.id}')">Del</button>
              </div>
            </td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  },

  setCategory(cat) {
    this._category = cat;
    ['', 'mooe', 'special'].forEach(c => {
      const btn = document.getElementById(`f-cat-${c || 'all'}`);
      if (btn) btn.className = this._tabClass(c === cat);
    });
    this.load();
  },

  _tabClass(active) {
    return active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  },

  async openForm(id) {
    const schools = this._schools;
    const [{ data }, { data: ftData }] = await Promise.all([
      DB.getFunds(),
      DB.getFundTypes(this._category),
    ]);
    const rec = id ? (data||[]).find(r=>r.id===id) : null;
      const yr  = new Date().getFullYear();
      const years = [yr];

      const schoolOpts = schools.map(s =>
        `<option value="${s.id}" ${rec?.school_id===s.id?'selected':''}>${s.name}</option>`
      ).join('');

      const fundTypeOpts = (ftData || []).map(t => `<option value="${t.name}">`).join('');

      const html = `
      <form id="fund-form" onsubmit="FundsView.saveFund(event,'${id||''}')">
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="col-span-2">
            <label class="form-label">School *</label>
            <select id="fd-school" class="form-select" required>
              <option value="">Select school</option>${schoolOpts}
            </select>
          </div>
          <div>
            <label class="form-label">ADA Number *</label>
            <input id="fd-ada-no" type="text" class="form-input" required placeholder="e.g. 2626003" value="${rec?.ada_no||''}" />
          </div>
          <div>
            <label class="form-label">ADA Date *</label>
            <input id="fd-ada-date" type="date" class="form-input" required value="${rec?.ada_date||''}"
              onchange="const y=this.value.split('-')[0];if(y)document.getElementById('fd-year').value=y;" />
          </div>
          <div class="col-span-2">
            <label class="form-label">Fund Type *</label>
            <input id="fd-fund" type="text" class="form-input" required
              placeholder="e.g. LBP-1st Quarter MOOE"
              value="${rec?.fund_type||''}" list="fd-fund-list" />
            <datalist id="fd-fund-list">${fundTypeOpts}</datalist>
          </div>
          <div>
            <label class="form-label">Amount (&#8369;) *</label>
            <input id="fd-amount" type="number" step="0.01" min="0" class="form-input" required value="${rec?.amount||''}" placeholder="0.00" />
          </div>
          <div>
            <label class="form-label">Year</label>
            <select id="fd-year" class="form-select">
              ${years.map(y=>`<option value="${y}" ${(rec?.year||yr)==y?'selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          ${this._category !== 'mooe' ? `
          <div class="col-span-2">
            <label class="form-label">Bank</label>
            <select id="fd-bank" class="form-select">
              ${BANKS.map(b=>`<option value="${b}" ${rec?.bank===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="col-span-2">
            <label class="form-label">Status *</label>
            <select id="fd-status" class="form-select" required>
              <option value="unliquidated" ${rec?.status!=='liquidated'?'selected':''}>Unliquidated</option>
              <option value="liquidated"   ${rec?.status==='liquidated'?'selected':''}>Liquidated</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="form-label">Remarks</label>
            <input id="fd-remarks" type="text" class="form-input" placeholder="e.g. submitted 4/4/2025" value="${rec?.remarks||''}" />
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?'Update':'Add'} Record</button>
        </div>
      </form>`;
      App.openModal(id ? 'Edit Fund Record' : 'Add Fund Record', html);
  },

  async saveFund(e, id) {
    e.preventDefault();
    const row = {
      id: id || DB.newId(),
      school_id:  document.getElementById('fd-school').value,
      ada_no:     document.getElementById('fd-ada-no').value.trim(),
      ada_date:   document.getElementById('fd-ada-date').value,
      fund_type:  document.getElementById('fd-fund').value,
      bank:       document.getElementById('fd-bank')?.value || '',
      amount:     parseFloat(document.getElementById('fd-amount').value) || 0,
      year:       parseInt(document.getElementById('fd-year').value),
      status:     document.getElementById('fd-status').value,
      remarks:    document.getElementById('fd-remarks').value.trim(),
    };
    const { error } = await DB.upsertFund(row);
    if (error) { App.toast('Error: ' + error, 'error'); return; }
    App.closeModal();
    App.toast(id ? 'Record updated!' : 'Record added!');
    await this.load();
  },

  async deleteFund(id) {
    if (!confirm('Delete this fund record?')) return;
    await DB.deleteFund(id);
    App.toast('Record deleted.');
    await this.load();
  },
};

const FundsMOOEView = {
  async render()      { return FundsView.render('mooe'); },
  async afterRender() { return FundsView.afterRender(); },
};
const FundsSpecialView = {
  async render()      { return FundsView.render('special'); },
  async afterRender() { return FundsView.afterRender(); },
};
