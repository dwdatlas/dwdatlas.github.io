// ============================================================
// DOWNLOADED FUNDS VIEW
// Tracks ADA disbursements per school with liquidation status
// ============================================================
const FundsView = {
  _schoolId: null,
  _schools: [],

  async render() {
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    const isAdmin  = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const [schoolsRes] = await Promise.all([DB.getSchools()]);
    this._schools = schoolsRes.data || [];

    const yr = new Date().getFullYear();
    const years = [];
    for (let y = yr; y >= yr - 3; y--) years.push(y);

    const schoolOpts = this._schools.map(s =>
      `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const schoolFilter = this._schoolId
      ? `<input type="hidden" id="f-school" value="${this._schoolId}" /><div class="text-sm font-semibold text-gray-700">${this._schools.find(s=>s.id===this._schoolId)?.name||'My School'}</div>`
      : `<select id="f-school" class="form-select" onchange="FundsView.load()">
           <option value="">All Schools</option>${schoolOpts}
         </select>`;

    return `
    <div class="page-header">
      <h2>Downloaded Funds</h2>
      <p>ADA monitoring — liquidation status per school</p>
    </div>

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
              <option value="pending">Pending</option>
              <option value="submitted_to_sou">Submitted to SOU</option>
              <option value="liquidated">Liquidated</option>
            </select>
          </div>
          <div>
            <label class="form-label">Fund Type</label>
            <select id="f-fund" class="form-select" onchange="FundsView.load()">
              <option value="">All Fund Types</option>
              ${FUND_TYPES.map(f=>`<option value="${f}">${f}</option>`).join('')}
            </select>
          </div>
          ${isAdmin ? `
          <div class="flex items-end gap-2">
            <button class="btn btn-primary flex-1" onclick="FundsView.openForm()">+ Add</button>
            <button class="btn btn-secondary" onclick="FundsView.seedDefaults()" title="Load default MOOE data">Seed</button>
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
    if (fundType) rows = rows.filter(r => r.fund_type === fundType);

    const isAdmin = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const el = document.getElementById('funds-body');
    const sumEl = document.getElementById('funds-summary');
    if (!el) return;

    // Summary counts
    const total     = rows.length;
    const liquid    = rows.filter(r=>r.status==='liquidated').length;
    const sou       = rows.filter(r=>r.status==='submitted_to_sou').length;
    const pending   = rows.filter(r=>r.status==='pending').length;
    const totalAmt  = rows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    if (sumEl) sumEl.textContent = `${total} records | Total: ${fmt(totalAmt)} | Liquidated: ${liquid} | SOU: ${sou} | Pending: ${pending}`;

    if (!rows.length) {
      el.innerHTML = emptyState('No fund records found. Click "+ Add" to add a record or "Seed" to load MOOE defaults.');
      return;
    }

    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>ADA No.</th>
        <th>ADA Date</th>
        <th>Fund Type</th>
        ${!this._schoolId ? '<th>School</th>' : ''}
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
            : r.status === 'submitted_to_sou'
            ? `<span class="badge badge-submitted">Submitted to SOU</span>`
            : `<span class="badge badge-missing">Pending</span>`;
          return `
          <tr>
            <td class="font-mono text-xs font-semibold">${r.ada_no || '—'}</td>
            <td class="text-xs whitespace-nowrap">${formatDate(r.ada_date)}</td>
            <td class="text-xs">${r.fund_type || '—'}</td>
            ${!this._schoolId ? `<td class="text-xs">${school?.name || r.school_id || '—'}</td>` : ''}
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

  openForm(id) {
    const schools = this._schools;
    const existing = id ? (DB.getFunds ? null : null) : null;

    DB.getFunds().then(({ data }) => {
      const rec = id ? (data||[]).find(r=>r.id===id) : null;
      const yr  = new Date().getFullYear();
      const years = [];
      for (let y = yr; y >= yr - 3; y--) years.push(y);

      const schoolOpts = schools.map(s =>
        `<option value="${s.id}" ${rec?.school_id===s.id?'selected':''}>${s.name}</option>`
      ).join('');

      const fundOpts = FUND_TYPES.map(f =>
        `<option value="${f}" ${rec?.fund_type===f?'selected':''}>${f}</option>`
      ).join('');

      const html = `
      <form id="fund-form" onsubmit="FundsView.saveFund(event,'${id||''}')">
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="col-span-2">
            <label class="form-label">School *</label>
            <select id="fd-school" class="form-select" required>
              <option value="">Select school…</option>${schoolOpts}
            </select>
          </div>
          <div>
            <label class="form-label">ADA Number *</label>
            <input id="fd-ada-no" type="text" class="form-input" required placeholder="e.g. 2626003" value="${rec?.ada_no||''}" />
          </div>
          <div>
            <label class="form-label">ADA Date *</label>
            <input id="fd-ada-date" type="date" class="form-input" required value="${rec?.ada_date||''}" />
          </div>
          <div class="col-span-2">
            <label class="form-label">Fund Type *</label>
            <select id="fd-fund" class="form-select" required>
              <option value="">Select fund type…</option>${fundOpts}
            </select>
          </div>
          <div>
            <label class="form-label">Amount (₱) *</label>
            <input id="fd-amount" type="number" step="0.01" min="0" class="form-input" required value="${rec?.amount||''}" placeholder="0.00" />
          </div>
          <div>
            <label class="form-label">Year</label>
            <select id="fd-year" class="form-select">
              ${years.map(y=>`<option value="${y}" ${(rec?.year||yr)==y?'selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <div class="col-span-2">
            <label class="form-label">Status *</label>
            <select id="fd-status" class="form-select" required>
              <option value="pending"          ${rec?.status==='pending'?'selected':''}>Pending</option>
              <option value="submitted_to_sou" ${rec?.status==='submitted_to_sou'?'selected':''}>Submitted to SOU</option>
              <option value="liquidated"       ${rec?.status==='liquidated'?'selected':''}>Liquidated</option>
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
    });
  },

  async saveFund(e, id) {
    e.preventDefault();
    const row = {
      id: id || DB.newId(),
      school_id:  document.getElementById('fd-school').value,
      ada_no:     document.getElementById('fd-ada-no').value.trim(),
      ada_date:   document.getElementById('fd-ada-date').value,
      fund_type:  document.getElementById('fd-fund').value,
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

  async seedDefaults() {
    if (!confirm('Load all downloaded funds for all 14 schools from the CSV data? This will add missing records only.')) return;

    const { data: existing } = await DB.getFunds();
    const existingKeys = new Set((existing||[]).map(r=>`${r.school_id}_${r.ada_no}_${r.fund_type}`));

    const seeds = [
      {
            "school_id": "s_alegre",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 22815.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP NLC",
            "amount": 3375.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 975.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 149901.26,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 11565.24,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 400.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 180750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 77.38,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 471.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 15795.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 675.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 132250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 4219.34,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 180.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 161750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 95.05,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 466.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 18954.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP NLC",
            "amount": 2250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 810.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 145500.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 2844.26,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 280.01,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_batug",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 177000.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 72.54,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 501.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2507073",
            "ada_date": "2025-08-29",
            "fund_type": "LBP-WATER TESTING",
            "amount": 4762.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 116181.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 2250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP NLC",
            "amount": 6750.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 206250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 9578.51,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 1160.03,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 253750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 291.23,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 1836.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2626025",
            "ada_date": "2025-02-26",
            "fund_type": "LBP-SBFP-Milk Operational Expenses",
            "amount": 300.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 14040.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 450.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 137250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 6470.16,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 120.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 170000.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 91.48,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 540.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 18954.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 795.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 149250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 7063.6,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 580.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 186250.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "LIquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 76.37,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 592.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 22464.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 600.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 138750.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program-DBP",
            "amount": 7016.55,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2510111",
            "ada_date": "2025-11-17",
            "fund_type": "DBP-Hauling of Textbooks",
            "amount": 400.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2510135",
            "ada_date": "2025-12-15",
            "fund_type": "DBP-ELLNA",
            "amount": 800.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2626013",
            "ada_date": "2026-02-10",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 173000.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 297.63,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 1344.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 11934.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP NLC",
            "amount": 1125.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 510.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 130250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 3390.65,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 140.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 160250.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 45.3,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 271.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 12285.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 525.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 136250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 1693.8,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 220.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 165750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 82.9,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 430.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 15093.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 540.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 144250.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 2156.72,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 380.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 65.07,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 411.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 10881.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "LBP-SBFP MILK",
            "amount": 465.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 126249.92,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 2109.67,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 120.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 156250.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 45.27,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 222.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 26325.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 825.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 155750.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "LIQUIDATED"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 5641.47,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 580.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 193250.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "LIQUIdated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626016",
            "ada_date": "2026-02-08",
            "fund_type": "LBP-Delivery Support Fund for LRs",
            "amount": 201.57,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 1088.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 40014.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 1050.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 153750.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "LBP-ARAL Program",
            "amount": 11065.9,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-HAULING",
            "amount": 500.01,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "LBP-ELLNA",
            "amount": 800.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 201750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 96.3,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 595.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509084",
            "ada_date": "2025-09-23",
            "fund_type": "SBFP-Food",
            "amount": 22815.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "DBP-SBFP MILK",
            "amount": 750.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE-LBP",
            "amount": 139500.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program-DBP",
            "amount": 6611.31,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support-PSF-LBP",
            "amount": 3000.0,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510111",
            "ada_date": "2025-11-17",
            "fund_type": "DBP-Hauling of Textbooks",
            "amount": 340.01,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510135",
            "ada_date": "2025-12-15",
            "fund_type": "DBP-ELLNA",
            "amount": 800.0,
            "year": 2025,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "LBP-1st Quarter MOOE",
            "amount": 171750.0,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "LBP-Delivery Support Fund--Emergency Situation",
            "amount": 68.79,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2626028",
            "ada_date": "2026-03-09",
            "fund_type": "LBP-Delivery Support Fund-Leveled Reader Mini Book",
            "amount": 446.0,
            "year": 2026,
            "status": "unliquidated",
            "remarks": ""
      }
];

    let added = 0;
    for (const s of seeds) {
      const key = `${s.school_id}_${s.ada_no}_${s.fund_type}`;
      if (existingKeys.has(key)) continue;
      s.id = DB.newId();
      await DB.upsertFund(s);
      added++;
    }
    App.toast(`Loaded ${added} fund records!`);
    await this.load();
  },
};
