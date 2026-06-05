// ============================================================
// CASH DISBURSEMENT REGISTER VIEW  —  Appendix 43
// ============================================================
const CDRView = {
  async render() {
    this._schoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;
    const [schoolsRes, headersRes] = await Promise.all([DB.getSchools(), DB.getCDRHeaders()]);
    const schools = schoolsRes.data || [];

    const schoolOpts = schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const years = [];
    const yr = new Date().getFullYear();
    for (let y = yr; y >= yr - 4; y--) years.push(y);

    const schoolDropdown = this._schoolId
      ? `<select id="cdr-filter-school" class="form-select" disabled>
           <option value="${this._schoolId}">${schools.find(s => s.id === this._schoolId)?.name || 'My School'}</option>
         </select>`
      : `<select id="cdr-filter-school" class="form-select" onchange="CDRView.load()">
           <option value="">All Schools</option>${schoolOpts}
         </select>`;

    return `
    <div class="page-header">
      <h2>Cash Disbursement Register</h2>
      <p>Appendix 43 — per school per quarter</p>
    </div>

    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3>Filters</h3>
      </div>
      <div class="section-card-body">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="form-label">School</label>
            ${schoolDropdown}
            </select>
          </div>
          <div>
            <label class="form-label">Year</label>
            <select id="cdr-filter-year" class="form-select" onchange="CDRView.load()">
              <option value="">All Years</option>
              ${years.map(y => `<option value="${y}" ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Quarter</label>
            <select id="cdr-filter-quarter" class="form-select" onchange="CDRView.load()">
              <option value="">All Quarters</option>
              <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
            </select>
          </div>
          <div class="flex items-end">
            <button class="btn btn-primary w-full" onclick="CDRView.openCreate()">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              New CDR
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header"><h3>CDR List</h3></div>
      <div id="cdr-list-body" class="table-scroll">
        <div class="flex justify-center py-10"><div class="spinner"></div></div>
      </div>
    </div>
    `;
  },

  async afterRender() {
    this._schools = (await DB.getSchools()).data || [];
    await this.load();
  },

  async load() {
    const school_id = this._schoolId || document.getElementById('cdr-filter-school')?.value || '';
    const year = document.getElementById('cdr-filter-year')?.value || '';
    const quarter = document.getElementById('cdr-filter-quarter')?.value || '';

    const filters = {};
    if (school_id) filters.school_id = school_id;
    if (year) filters.year = year;

    const { data } = await DB.getCDRHeaders(filters);
    let rows = data || [];
    if (quarter) rows = rows.filter(r => r.quarter === quarter);

    const el = document.getElementById('cdr-list-body');
    if (!el) return;

    if (!rows.length) {
      el.innerHTML = emptyState('No CDR records found. Create one using the "New CDR" button.');
      return;
    }

    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>School</th><th>Year</th><th>Quarter</th><th>Fund Type</th>
        <th class="text-right">Opening Balance</th><th>Entries</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td class="font-medium">${this._schoolName(r.school_id)}</td>
          <td>${r.year}</td>
          <td><span class="badge badge-submitted">${r.quarter}</span></td>
          <td class="text-xs text-gray-600">${r.fund_type || '—'}</td>
          <td class="text-right font-semibold">${fmt(r.opening_balance)}</td>
          <td class="text-center text-xs text-gray-500">${r.entry_count || 0}</td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-secondary btn-sm" onclick="CDRView.openDetail('${r.id}')">View</button>
              <button class="btn btn-primary btn-sm" onclick="CDRView.printCDR('${r.id}')">Print</button>
              <button class="btn btn-danger btn-sm" onclick="CDRView.deleteHeader('${r.id}')">Del</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  },

  _schoolName(id) {
    const s = (this._schools || []).find(x => x.id === id);
    return s ? s.name : '—';
  },

  _getSchool(id) {
    return (this._schools || []).find(x => x.id === id) || {};
  },

  // ---- Create new CDR header ----
  openCreate() {
    const schools = this._schools || [];
    const yr = new Date().getFullYear();
    const years = [];
    for (let y = yr; y >= yr - 4; y--) years.push(y);

    const html = `
    <form id="cdr-create-form" onsubmit="CDRView.saveHeader(event)">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="col-span-2">
          <label class="form-label">School *</label>
          <select id="cdr-school" class="form-select" required>
            <option value="">Select school…</option>
            ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Year *</label>
          <select id="cdr-year" class="form-select" required>
            ${years.map(y => `<option value="${y}" ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Quarter *</label>
          <select id="cdr-quarter" class="form-select" required>
            <option value="Q1">Q1 (Jan–Mar)</option>
            <option value="Q2">Q2 (Apr–Jun)</option>
            <option value="Q3">Q3 (Jul–Sep)</option>
            <option value="Q4">Q4 (Oct–Dec)</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="form-label">Fund Type</label>
          <select id="cdr-fund-type" class="form-select">
            ${FUND_TYPES.map(f => `<option>${f}</option>`).join('')}
          </select>
        </div>
        <div class="col-span-2">
          <label class="form-label">Opening Balance (Advances Received)</label>
          <input id="cdr-opening" type="number" step="0.01" class="form-input" placeholder="0.00" value="0" />
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create CDR</button>
      </div>
    </form>`;
    App.openModal('New Cash Disbursement Register', html);
  },

  async saveHeader(e) {
    e.preventDefault();
    const row = {
      id: DB.newId(),
      school_id: document.getElementById('cdr-school').value,
      year: parseInt(document.getElementById('cdr-year').value),
      quarter: document.getElementById('cdr-quarter').value,
      fund_type: document.getElementById('cdr-fund-type').value,
      opening_balance: parseFloat(document.getElementById('cdr-opening').value) || 0,
      entry_count: 0,
    };
    const { error } = await DB.upsertCDRHeader(row);
    if (error) { App.toast('Error saving CDR: ' + error, 'error'); return; }
    App.closeModal();
    App.toast('CDR created!');
    await this.load();
  },

  async deleteHeader(id) {
    if (!confirm('Delete this CDR and all its entries?')) return;
    await DB.deleteCDRHeader(id);
    App.toast('CDR deleted.');
    await this.load();
  },

  // ---- Detail / Entry view ----
  async openDetail(id) {
    const [headerRes, entriesRes] = await Promise.all([DB.getCDRHeader(id), DB.getCDREntries(id)]);
    const header = headerRes.data;
    const entries = entriesRes.data || [];
    if (!header) { App.toast('CDR not found', 'error'); return; }

    const school = this._getSchool(header.school_id);

    // Compute running balance
    let balance = parseFloat(header.opening_balance) || 0;
    const rows = entries.map(e => {
      const adv = parseFloat(e.advances) || 0;
      const pay = parseFloat(e.payment) || 0;
      balance = balance + adv - pay;
      return { ...e, running_balance: balance };
    });

    // Recapitulation by UACS
    const recap = {};
    entries.forEach(e => {
      const code = e.uacs_code || 'Unclassified';
      const desc = e.uacs_desc || UACS_CODES.find(u => u.code === code)?.desc || code;
      if (!recap[code]) recap[code] = { code, desc, total: 0 };
      recap[code].total += parseFloat(e.payment) || 0;
    });

    const totalAdv = entries.reduce((s, e) => s + (parseFloat(e.advances) || 0), 0);
    const totalPay = entries.reduce((s, e) => s + (parseFloat(e.payment) || 0), 0);

    const html = `
    <div class="mb-4 flex flex-wrap gap-3 items-center justify-between">
      <div>
        <div class="font-bold text-gray-800">${school.name || '—'} — ${header.year} ${header.quarter}</div>
        <div class="text-xs text-gray-500">${header.fund_type || ''} | Opening Balance: ${fmt(header.opening_balance)}</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="CDRView.openAddEntry('${id}')">+ Add Entry</button>
        <button class="btn btn-secondary btn-sm" onclick="CDRView.printCDR('${id}')">Print</button>
        <button class="btn btn-secondary btn-sm" onclick="App.closeModal()">Close</button>
      </div>
    </div>

    <div class="table-scroll mb-4">
      <table class="data-table">
        <thead><tr>
          <th>#</th><th>Date</th><th>Particulars</th><th>UACS Code</th>
          <th class="text-right">Advances</th><th class="text-right">Payment</th>
          <th class="text-right">Balance</th><th>Actions</th>
        </tr></thead>
        <tbody>
          <tr class="bg-blue-50">
            <td colspan="4" class="font-semibold text-xs">Opening Balance</td>
            <td></td><td></td>
            <td class="text-right font-bold">${fmt(header.opening_balance)}</td>
            <td></td>
          </tr>
          ${rows.length === 0 ? `<tr><td colspan="8" class="text-center text-gray-400 py-6 text-sm">No entries yet.</td></tr>` : ''}
          ${rows.map((e, i) => `
          <tr>
            <td class="text-xs text-gray-400">${i + 1}</td>
            <td class="text-xs">${formatDate(e.entry_date)}</td>
            <td class="text-xs">${e.particulars || '—'}</td>
            <td class="font-mono text-xs text-gray-600">${e.uacs_code || '—'}</td>
            <td class="text-right text-xs">${e.advances > 0 ? fmt(e.advances) : ''}</td>
            <td class="text-right text-xs font-semibold">${e.payment > 0 ? fmt(e.payment) : ''}</td>
            <td class="text-right text-xs font-bold">${fmt(e.running_balance)}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="CDRView.deleteEntry('${e.id}','${id}')">Del</button>
            </td>
          </tr>`).join('')}
          <tr class="bg-gray-50 font-bold">
            <td colspan="4" class="text-xs">TOTAL</td>
            <td class="text-right text-xs">${fmt(totalAdv)}</td>
            <td class="text-right text-xs">${fmt(totalPay)}</td>
            <td class="text-right text-xs">${fmt(rows.length > 0 ? rows[rows.length-1].running_balance : header.opening_balance)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    ${Object.keys(recap).length > 0 ? `
    <div class="border-t pt-3">
      <div class="font-bold text-xs text-gray-600 mb-2 uppercase tracking-wide">Recapitulation</div>
      <table class="data-table">
        <thead><tr><th>UACS Code</th><th>Description</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          ${Object.values(recap).map(r => `
          <tr>
            <td class="font-mono text-xs">${r.code}</td>
            <td class="text-xs">${r.desc}</td>
            <td class="text-right text-xs font-semibold">${fmt(r.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    `;

    App.openModal(`CDR — ${school.name || '—'} ${header.year} ${header.quarter}`, html);
  },

  openAddEntry(cdr_id) {
    const uacsOpts = UACS_CODES.map(u =>
      `<option value="${u.code}" data-desc="${u.desc}">${u.code} — ${u.desc}</option>`
    ).join('');

    const html = `
    <form id="entry-form" onsubmit="CDRView.saveEntry(event,'${cdr_id}')">
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="form-label">Date *</label>
          <input id="entry-date" type="date" class="form-input" required value="${new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="col-span-2">
          <label class="form-label">Particulars / Description</label>
          <input id="entry-particulars" type="text" class="form-input" placeholder="Brief description of expense" />
        </div>
        <div class="col-span-2">
          <label class="form-label">UACS Object Code</label>
          <select id="entry-uacs" class="form-select" onchange="CDRView.onUACSChange(this)">
            <option value="">Select UACS code…</option>${uacsOpts}
          </select>
        </div>
        <div class="col-span-2" id="uacs-desc-row" style="display:none">
          <label class="form-label">Description (auto-filled)</label>
          <input id="entry-uacs-desc" type="text" class="form-input" placeholder="UACS description" />
        </div>
        <div>
          <label class="form-label">Advances Received (₱)</label>
          <input id="entry-advances" type="number" step="0.01" class="form-input" placeholder="0.00" value="0" />
        </div>
        <div>
          <label class="form-label">Payment / Disbursement (₱)</label>
          <input id="entry-payment" type="number" step="0.01" class="form-input" placeholder="0.00" value="0" />
        </div>
        <div>
          <label class="form-label">OR/DV/Voucher No.</label>
          <input id="entry-ref-no" type="text" class="form-input" placeholder="Reference number" />
        </div>
        <div>
          <label class="form-label">Payee</label>
          <input id="entry-payee" type="text" class="form-input" placeholder="Name of payee" />
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal(); CDRView.openDetail('${cdr_id}')">Back</button>
        <button type="submit" class="btn btn-primary">Save Entry</button>
      </div>
    </form>`;
    App.openModal('Add CDR Entry', html);
  },

  onUACSChange(sel) {
    const opt = sel.options[sel.selectedIndex];
    const desc = opt?.dataset?.desc || '';
    const row = document.getElementById('uacs-desc-row');
    const inp = document.getElementById('entry-uacs-desc');
    if (desc) {
      row.style.display = '';
      inp.value = desc;
    } else {
      row.style.display = 'none';
      inp.value = '';
    }
  },

  async saveEntry(e, cdr_id) {
    e.preventDefault();
    const uacsEl = document.getElementById('entry-uacs');
    const uacs_code = uacsEl.value;
    const uacs_desc = uacs_code
      ? (document.getElementById('entry-uacs-desc').value || UACS_CODES.find(u => u.code === uacs_code)?.desc || '')
      : '';

    const row = {
      id: DB.newId(),
      cdr_id,
      entry_date: document.getElementById('entry-date').value,
      particulars: document.getElementById('entry-particulars').value,
      uacs_code,
      uacs_desc,
      advances: parseFloat(document.getElementById('entry-advances').value) || 0,
      payment: parseFloat(document.getElementById('entry-payment').value) || 0,
      ref_no: document.getElementById('entry-ref-no').value,
      payee: document.getElementById('entry-payee').value,
      sort_order: Date.now(),
    };
    const { error } = await DB.upsertCDREntry(row);
    if (error) { App.toast('Error: ' + error, 'error'); return; }

    // Update entry_count on header
    const { data: existing } = await DB.getCDREntries(cdr_id);
    await DB.upsertCDRHeader({ id: cdr_id, entry_count: (existing || []).length });

    App.toast('Entry saved!');
    App.closeModal();
    await this.openDetail(cdr_id);
  },

  async deleteEntry(entry_id, cdr_id) {
    if (!confirm('Delete this entry?')) return;
    await DB.deleteCDREntry(entry_id);
    const { data: existing } = await DB.getCDREntries(cdr_id);
    await DB.upsertCDRHeader({ id: cdr_id, entry_count: (existing || []).length });
    App.toast('Entry deleted.');
    App.closeModal();
    await this.openDetail(cdr_id);
  },

  // ---- Print Appendix 43 ----
  async printCDR(id) {
    const [headerRes, entriesRes] = await Promise.all([DB.getCDRHeader(id), DB.getCDREntries(id)]);
    const header = headerRes.data;
    const entries = entriesRes.data || [];
    if (!header) { App.toast('CDR not found', 'error'); return; }

    const school = this._getSchool(header.school_id);

    // Running balance
    let balance = parseFloat(header.opening_balance) || 0;
    const rows = entries.map(e => {
      const adv = parseFloat(e.advances) || 0;
      const pay = parseFloat(e.payment) || 0;
      balance = balance + adv - pay;
      return { ...e, running_balance: balance };
    });

    const totalAdv = entries.reduce((s, e) => s + (parseFloat(e.advances) || 0), 0);
    const totalPay = entries.reduce((s, e) => s + (parseFloat(e.payment) || 0), 0);
    const finalBal = rows.length > 0 ? rows[rows.length - 1].running_balance : parseFloat(header.opening_balance) || 0;

    // Recap by UACS
    const recap = {};
    entries.forEach(e => {
      const code = e.uacs_code || 'Others';
      const desc = e.uacs_desc || UACS_CODES.find(u => u.code === code)?.desc || code;
      if (!recap[code]) recap[code] = { code, desc, total: 0 };
      recap[code].total += parseFloat(e.payment) || 0;
    });

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>CDR — ${school.name || ''} ${header.year} ${header.quarter}</title>
<style>
  @page { size: legal landscape; margin: 12mm 10mm; }
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; }
  h1 { font-size: 10pt; text-align: center; margin: 0; }
  h2 { font-size: 9pt; text-align: center; margin: 2px 0; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 2px 4px; vertical-align: top; font-size: 7.5pt; }
  th { background: #e5e7eb; text-align: center; font-size: 7pt; }
  .no-border td { border: none; }
  .header-block td { border: none; font-size: 8pt; }
  .sig-line { border-top: 1px solid #000; padding-top: 2px; text-align: center; font-size: 7.5pt; }
  .underline { text-decoration: underline; font-weight: bold; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="center bold" style="font-size:9pt">Republic of the Philippines</div>
  <div class="center bold" style="font-size:9pt">Department of Education</div>
  <div class="center" style="font-size:8pt">Region VIII — Eastern Visayas | Division of Leyte | Dulag West District</div>
  <br/>
  <div class="center bold" style="font-size:11pt">CASH DISBURSEMENT REGISTER</div>
  <div class="center" style="font-size:8pt">(Appendix 43)</div>
  <br/>
  <table class="header-block" style="margin-bottom:6px">
    <tr>
      <td width="25%">Entity/School: <span class="underline">${school.name || ''}</span></td>
      <td width="25%">Fund Type: <span class="underline">${header.fund_type || ''}</span></td>
      <td width="25%">Year: <span class="underline">${header.year}</span></td>
      <td width="25%">Quarter: <span class="underline">${header.quarter}</span></td>
    </tr>
    <tr>
      <td>Accountable Officer: <span class="underline">${school.school_head || ''}</span></td>
      <td>Designation: <span class="underline">${school.designation || 'School Head'}</span></td>
      <td colspan="2">Station: <span class="underline">Dulag West District, Division of Leyte</span></td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th rowspan="2" width="4%">Date</th>
        <th rowspan="2" width="6%">DV/OR No.</th>
        <th rowspan="2" width="20%">Particulars</th>
        <th rowspan="2" width="7%">UACS Object Code</th>
        <th rowspan="2" width="8%">Payee</th>
        <th colspan="3" width="24%">ADVANCES</th>
        <th colspan="3" width="24%">PAYMENTS/DISBURSEMENTS</th>
        <th rowspan="2" width="7%">Balance</th>
      </tr>
      <tr>
        <th>Cash</th><th>Check</th><th>Total</th>
        <th>Cash</th><th>Check</th><th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="5" class="bold">Opening Balance / Beginning Balance</td>
        <td></td><td></td><td class="right">${fmtPrint(header.opening_balance)}</td>
        <td></td><td></td><td></td>
        <td class="right bold">${fmtPrint(header.opening_balance)}</td>
      </tr>
      ${rows.map(e => `
      <tr>
        <td>${fmtDatePrint(e.entry_date)}</td>
        <td style="font-size:6.5pt">${e.ref_no || ''}</td>
        <td>${e.particulars || ''}</td>
        <td style="font-size:6.5pt">${e.uacs_code || ''}</td>
        <td style="font-size:6.5pt">${e.payee || ''}</td>
        <td></td>
        <td class="right">${e.advances > 0 ? fmtPrint(e.advances) : ''}</td>
        <td class="right">${e.advances > 0 ? fmtPrint(e.advances) : ''}</td>
        <td></td>
        <td class="right">${e.payment > 0 ? fmtPrint(e.payment) : ''}</td>
        <td class="right">${e.payment > 0 ? fmtPrint(e.payment) : ''}</td>
        <td class="right">${fmtPrint(e.running_balance)}</td>
      </tr>`).join('')}
      <tr class="bold">
        <td colspan="5">TOTAL</td>
        <td></td>
        <td class="right">${fmtPrint(totalAdv)}</td>
        <td class="right">${fmtPrint(totalAdv)}</td>
        <td></td>
        <td class="right">${fmtPrint(totalPay)}</td>
        <td class="right">${fmtPrint(totalPay)}</td>
        <td class="right">${fmtPrint(finalBal)}</td>
      </tr>
    </tbody>
  </table>

  ${Object.keys(recap).length > 0 ? `
  <br/>
  <div class="bold" style="font-size:8pt;margin-bottom:4px">RECAPITULATION</div>
  <table style="width:50%">
    <thead><tr><th>UACS Object Code</th><th>Description</th><th>Amount (₱)</th></tr></thead>
    <tbody>
      ${Object.values(recap).map(r => `
      <tr>
        <td style="font-size:7pt">${r.code}</td>
        <td style="font-size:7pt">${r.desc}</td>
        <td class="right" style="font-size:7pt">${fmtPrint(r.total)}</td>
      </tr>`).join('')}
      <tr class="bold">
        <td colspan="2">TOTAL</td>
        <td class="right">${fmtPrint(totalPay)}</td>
      </tr>
    </tbody>
  </table>` : ''}

  <br/><br/>
  <table style="width:100%" class="no-border">
    <tr>
      <td width="40%" style="padding-right:20px">
        <div style="margin-bottom:40px">Certified Correct:</div>
        <div class="sig-line"><span class="underline bold">${school.school_head || ''}</span></div>
        <div class="center" style="font-size:7.5pt">${school.designation || 'Principal/Head Teacher'}</div>
        <div class="center" style="font-size:7.5pt">${school.name || ''}</div>
      </td>
      <td width="20%"></td>
      <td width="40%">
        <div style="margin-bottom:40px">Verified by:</div>
        <div class="sig-line"><span class="underline bold">${BOOKKEEPER}</span></div>
        <div class="center" style="font-size:7.5pt">${BOOKKEEPER_TITLE}</div>
        <div class="center" style="font-size:7.5pt">Dulag West District</div>
      </td>
    </tr>
  </table>

  <script>
    function fmtPrint(n){const v=parseFloat(n)||0; return v===0?'':v.toLocaleString('en-PH',{minimumFractionDigits:2});}
    function fmtDatePrint(d){if(!d)return''; const dt=new Date(d); return (dt.getMonth()+1)+'/'+(dt.getDate())+'/'+dt.getFullYear();}
    window.onload=()=>window.print();
  <\/script>
</body>
</html>`);
    w.document.close();
  },
};

function fmtPrint(n) {
  const v = parseFloat(n) || 0;
  return v === 0 ? '' : v.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
