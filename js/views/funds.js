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
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 177.72,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 1209.32,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1796.33,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-12-135M",
            "ada_date": "2024-12-12",
            "fund_type": "PSF",
            "amount": 5000,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 13209,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 2788,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 28560,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 150000,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 255.19,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 312.64,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 149974.71,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "SBFP NLC (DBP)",
            "amount": 3375,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP NLC (LBP)",
            "amount": 975,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 180750,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "1st Quarter MOOE 2026 (LBP)",
            "amount": 77.38,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_alegre",
            "ada_no": "2626013",
            "ada_date": "2026-02-10",
            "fund_type": "1st Quarter MOOE 2026 (LBP-2)",
            "amount": 471,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 59.24,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 644.96,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 958.04,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 2331,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1640,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 16800,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 132250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 102.08,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 125.06,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2503020",
            "ada_date": "2025-03-13",
            "fund_type": "LTE-SM Grade 4-6",
            "amount": 3167.71,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 132250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program (DBP)",
            "amount": 4219.34,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_arado",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 180,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2510111",
            "ada_date": "2025-11-17",
            "fund_type": "Hauling of Textbooks (DBP)",
            "amount": 73.44,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_arado",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling",
            "amount": 800,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 82.93,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 1289.93,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1916.08,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 4403,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 2829,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 28980,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 145500,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 244.99,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 300.13,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 145500,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2507073",
            "ada_date": "2025-08-29",
            "fund_type": "Water Testing (LBP)",
            "amount": 18954,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "NUTRIBAN (LBP)",
            "amount": 2250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "SBFP Milk (DBP)",
            "amount": 810,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP NLC (LBP)",
            "amount": 145500,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling",
            "amount": 177000,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 72.54,
            "year": 2026,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_batug",
            "ada_no": "2510135",
            "ada_date": "2025-12-15",
            "fund_type": "ELLNA (DBP)",
            "amount": 501,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 355.43,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 3789.16,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 5628.5,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 44030,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 6683,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 68460,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "24-12-134M",
            "ada_date": "2024-12-12",
            "fund_type": "K-FELT",
            "amount": 2346,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 206250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 602.26,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 737.83,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2503020",
            "ada_date": "2025-03-13",
            "fund_type": "LTE-SM Grade 1-3",
            "amount": 3262.79,
            "year": 2025,
            "status": "liquidated",
            "remarks": "LIQUIDATED"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2503020",
            "ada_date": "2025-03-13",
            "fund_type": "LTE-SM Grade 4-6",
            "amount": 3167.71,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 206250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2507058",
            "ada_date": "2025-07-30",
            "fund_type": "3rd Quarter MOOE (DBP)",
            "amount": 4762,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2507073",
            "ada_date": "2025-08-29",
            "fund_type": "Water Testing (LBP)",
            "amount": 116181,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE (LBP-2)",
            "amount": 9578.51,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program (DBP)",
            "amount": 10665,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "ARAL Program (LBP)",
            "amount": 1160.03,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 510.88,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabacungan",
            "ada_no": "2510111",
            "ada_date": "2025-11-17",
            "fund_type": "Hauling of Textbooks (DBP)",
            "amount": 800,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 106.63,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 644.96,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 958.04,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-12-135M",
            "ada_date": "2024-12-12",
            "fund_type": "PSF",
            "amount": 5000,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 9583,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1435,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 14700,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.49,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 137250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 173.53,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 212.59,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 137250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2507073",
            "ada_date": "2025-08-29",
            "fund_type": "Water Testing (LBP)",
            "amount": 14040,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "SBFP Milk (DBP)",
            "amount": 450,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP NLC (LBP)",
            "amount": 137250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE (LBP)",
            "amount": 3000,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE (LBP-2)",
            "amount": 6470.16,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2509109",
            "ada_date": "2025-11-12",
            "fund_type": "ARAL Program (LBP)",
            "amount": 120,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 94.37,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabarasan",
            "ada_no": "2510111",
            "ada_date": "2025-11-17",
            "fund_type": "Hauling of Textbooks (DBP)",
            "amount": 800,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 165.87,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 1048.07,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1556.82,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 3885,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1517,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 15540,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 149250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2502016",
            "ada_date": "2025-02-17",
            "fund_type": "Regular MOOE 1st Quarter (DBP)",
            "amount": 224.57,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 275.12,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2503020",
            "ada_date": "2025-03-13",
            "fund_type": "LTE-SM Grade 4-6",
            "amount": 149250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Penalty from DBP Bank",
            "amount": 149250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2509088",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP Milk (LBP)",
            "amount": 149250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "FOR CLARIFICATION",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling (2)",
            "amount": 186250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "LIquidated"
      },
      {
            "school_id": "s_cabatoan",
            "ada_no": "2626013",
            "ada_date": "2026-02-10",
            "fund_type": "1st Quarter MOOE 2026 (LBP-2)",
            "amount": 76.37,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 118.48,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 886.82,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1317.31,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 4144,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 2501,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 25620,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 138750,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 193.95,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 237.61,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 138750,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE (LBP)",
            "amount": 138750,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE (LBP-2)",
            "amount": 7016.55,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program (DBP)",
            "amount": 3000,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 400.01,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 800,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_calipayan",
            "ada_no": "2626021",
            "ada_date": "2026-02-20",
            "fund_type": "Delivery Support Fund Emergency",
            "amount": 1344,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 94.78,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 483.72,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 718.53,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-12-135M",
            "ada_date": "2024-12-12",
            "fund_type": "PSF",
            "amount": 5000,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 5698,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1148,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 11760,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 130250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 71.45,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 87.54,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_delcarmen",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 130250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 106.63,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 725.58,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1077.8,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 4662,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1476,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 15120,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 136250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 20.42,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 25.01,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 136250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP NLC (LBP)",
            "amount": 136250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling",
            "amount": 165750,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_genroxas",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "1st Quarter MOOE 2026 (LBP)",
            "amount": 82.9,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 142.17,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 967.45,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1437.06,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 5957,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1435,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 14700,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 144250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 234.78,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 287.63,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 144250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2507073",
            "ada_date": "2025-08-29",
            "fund_type": "Water Testing (LBP)",
            "amount": 15093,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "SBFP Milk (DBP)",
            "amount": 540,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509086",
            "ada_date": "2025-09-25",
            "fund_type": "SBFP NLC (DBP)",
            "amount": 144250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE (LBP)",
            "amount": 2156.72,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2509102",
            "ada_date": "2025-10-28",
            "fund_type": "Special Needs Support",
            "amount": 380.01,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 800,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_mhdelpilar",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "1st Quarter MOOE 2026 (LBP)",
            "amount": 411,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 23.7,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 483.72,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 718.53,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 1813,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 820,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 8400,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 126250,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/11/2025"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 102.08,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 125.06,
            "year": 2025,
            "status": "liquidated",
            "remarks": "LIquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Additional MOOE",
            "amount": 2200,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Penalty from DBP Bank",
            "amount": 126250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509087",
            "ada_date": "2025-09-29",
            "fund_type": "SBFP NLC (LBP)",
            "amount": 126249.92,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling",
            "amount": 156250,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 45.27,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_maricum",
            "ada_no": "2510135",
            "ada_date": "2025-12-15",
            "fund_type": "ELLNA (DBP)",
            "amount": 222,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 225.11,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 1209.3,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 1796.33,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 5957,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 2952,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 30240,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 155750,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 285.82,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 350.16,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 155750,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE (LBP)",
            "amount": 155750,
            "year": 2025,
            "status": "liquidated",
            "remarks": "LIQUIDATED"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 193250,
            "year": 2026,
            "status": "liquidated",
            "remarks": "LIQUIdated"
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626003",
            "ada_date": "2026-01-29",
            "fund_type": "1st Quarter MOOE 2026 (LBP)",
            "amount": 201.57,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_rawis",
            "ada_no": "2626013",
            "ada_date": "2026-02-10",
            "fund_type": "1st Quarter MOOE 2026 (LBP-2)",
            "amount": 1088,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 331.74,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 2741.08,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 4071.68,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-12-135M",
            "ada_date": "2024-12-12",
            "fund_type": "PSF",
            "amount": 5000,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 6734,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1681,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 17220,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 153750,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 377.69,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 462.71,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 153750,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Additional MOOE",
            "amount": 22000,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509085",
            "ada_date": "2025-09-23",
            "fund_type": "NUTRIBAN (LBP)",
            "amount": 1050,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE (LBP-2)",
            "amount": 3000,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program (DBP)",
            "amount": 11065.9,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 500.01,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2509127",
            "ada_date": "2025-12-05",
            "fund_type": "LBP-Hauling",
            "amount": 800,
            "year": 2025,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_sanantonio",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "Delivery Support Fund Leveled Reader",
            "amount": 595,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Kinder",
            "amount": 142.17,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Reading",
            "amount": 564.34,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-12-141M",
            "ada_date": "2024-12-23",
            "fund_type": "PSF-Grade 1 Math",
            "amount": 838.29,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-12-135M",
            "ada_date": "2024-12-12",
            "fund_type": "PSF",
            "amount": 5000,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-12-136M",
            "ada_date": "2024-12-13",
            "fund_type": "PSF Reading and Numeracy",
            "amount": 5180,
            "year": 2024,
            "status": "submitted_to_sou",
            "remarks": "submitted to division"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Milk",
            "amount": 1517,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-10-115M",
            "ada_date": "2024-10-29",
            "fund_type": "SBFP-Food",
            "amount": 15540,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "24-11-124M",
            "ada_date": "2024-11-22",
            "fund_type": "SBFP-Additional Operating",
            "amount": 3711.54,
            "year": 2024,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Regular MOOE 1st Quarter",
            "amount": 139500,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "submitted 4/4/2025"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Grade 4 Music and Arts",
            "amount": 153.12,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2501012",
            "ada_date": "2025-02-03",
            "fund_type": "Grade 4 Music and Arts (DBP)",
            "amount": 187.58,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2501013",
            "ada_date": "2025-02-06",
            "fund_type": "Delivery Support Fund for Math",
            "amount": 1567.56,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2504026",
            "ada_date": "2025-04-10",
            "fund_type": "Regular MOOE 2nd Quarter",
            "amount": 139500,
            "year": 2025,
            "status": "submitted_to_sou",
            "remarks": "07/04/2025 submitted to SOU"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509105",
            "ada_date": "2025-10-30",
            "fund_type": "4th Quarter MOOE (LBP)",
            "amount": 139500,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2509100",
            "ada_date": "2025-10-27",
            "fund_type": "4th Quarter MOOE (LBP-2)",
            "amount": 6611.31,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510103",
            "ada_date": "2025-10-28",
            "fund_type": "ARAL Program (DBP)",
            "amount": 3000,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510110",
            "ada_date": "2025-11-12",
            "fund_type": "MATATAG (DBP)",
            "amount": 340.01,
            "year": 2025,
            "status": "liquidated",
            "remarks": "Liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2626006",
            "ada_date": "2026-02-03",
            "fund_type": "ELLNA (LBP)",
            "amount": 800,
            "year": 2026,
            "status": "pending",
            "remarks": ""
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2510135",
            "ada_date": "2025-12-15",
            "fund_type": "ELLNA (DBP)",
            "amount": 171750,
            "year": 2025,
            "status": "liquidated",
            "remarks": "liquidated"
      },
      {
            "school_id": "s_tabu",
            "ada_no": "2626022",
            "ada_date": "2026-02-20",
            "fund_type": "Delivery Support Fund Leveled Reader",
            "amount": 68.79,
            "year": 2026,
            "status": "pending",
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
