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
              <button class="btn btn-secondary btn-sm" onclick="CDRView.showDetail('${r.id}')">View</button>
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

  // ---- Detail view (full-page, inline form) ----
  async showDetail(id) {
    this._detailId = id;
    const [headerRes, entriesRes] = await Promise.all([DB.getCDRHeader(id), DB.getCDREntries(id)]);
    const header = headerRes.data;
    const entries = entriesRes.data || [];
    if (!header) { App.toast('CDR not found', 'error'); return; }

    const school = this._getSchool(header.school_id);
    const el = document.getElementById('view-container');
    if (!el) return;

    const pt = document.getElementById('page-title');
    const ps = document.getElementById('page-subtitle');
    if (pt) pt.textContent = 'Cash Disbursement Register';
    if (ps) ps.textContent = `${school.name || ''} — ${header.year} ${header.quarter}`;

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
    const finalBal = rows.length > 0 ? rows[rows.length - 1].running_balance : (parseFloat(header.opening_balance) || 0);

    const uacsOpts = UACS_CODES.map(u =>
      `<option value="${u.code}" data-desc="${u.desc}">${u.code} — ${u.desc}</option>`
    ).join('');

    el.innerHTML = `
    <!-- Top bar -->
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <button class="btn btn-secondary btn-sm" onclick="CDRView.backToList()">
        ← Back to CDR List
      </button>
      <button class="btn btn-primary btn-sm" onclick="CDRView.printCDR('${id}')">
        Print CDR (Appendix 43)
      </button>
    </div>

    <!-- CDR Info -->
    <div class="section-card mb-4">
      <div class="section-card-body py-3">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span class="text-gray-500 text-xs block">School</span><strong>${school.name || '—'}</strong></div>
          <div><span class="text-gray-500 text-xs block">Year / Quarter</span><strong>${header.year} ${header.quarter}</strong></div>
          <div><span class="text-gray-500 text-xs block">Fund Type</span><strong>${header.fund_type || '—'}</strong></div>
          <div><span class="text-gray-500 text-xs block">Opening Balance</span><strong class="text-blue-700">${fmt(header.opening_balance)}</strong></div>
        </div>
      </div>
    </div>

    <!-- Add Transaction Form -->
    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3>Add Transaction</h3>
      </div>
      <div class="section-card-body">
        <form id="cdr-entry-form" onsubmit="CDRView.saveInlineEntry(event,'${id}')">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label class="form-label">Date *</label>
              <input id="ei-date" type="date" class="form-input" required value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div>
              <label class="form-label">DV / Check No.</label>
              <input id="ei-ref" type="text" class="form-input" placeholder="e.g. 2026-01-001 1496368" />
            </div>
            <div class="sm:col-span-2">
              <label class="form-label">Particulars *</label>
              <input id="ei-particulars" type="text" class="form-input" required placeholder="Description of transaction" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label class="form-label">Cash Advance (₱)</label>
              <input id="ei-advance" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" />
              <p class="text-xs text-gray-400 mt-1">For MOOE advances received only</p>
            </div>
            <div>
              <label class="form-label">Payment (₱)</label>
              <input id="ei-payment" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" />
            </div>
            <div class="sm:col-span-2">
              <label class="form-label">UACS Object Code & Name</label>
              <select id="ei-uacs" class="form-select">
                <option value="">— Select UACS (required for payments) —</option>
                ${uacsOpts}
              </select>
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="btn btn-primary">
              + Add Transaction
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Transactions Table -->
    <div class="section-card">
      <div class="section-card-header">
        <h3>Transactions</h3>
        <span class="text-xs text-gray-500">${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>#</th>
            <th>Date</th>
            <th>DV / Check No.</th>
            <th>Particulars</th>
            <th>UACS Code</th>
            <th class="text-right">Cash Advance</th>
            <th class="text-right">Payment</th>
            <th class="text-right">Balance</th>
            <th></th>
          </tr></thead>
          <tbody>
            <tr class="bg-blue-50 text-xs font-semibold">
              <td colspan="7">Opening Balance</td>
              <td class="text-right font-bold">${fmt(header.opening_balance)}</td>
              <td></td>
            </tr>
            ${rows.length === 0
              ? `<tr><td colspan="9" class="text-center text-gray-400 py-8 text-sm">No transactions yet. Use the form above to add the first entry.</td></tr>`
              : rows.map((e, i) => {
                  const uacsLabel = e.uacs_code
                    ? `<span class="font-mono" title="${e.uacs_desc || ''}">${e.uacs_code}</span>`
                    : '—';
                  return `
                  <tr>
                    <td class="text-xs text-gray-400">${i + 1}</td>
                    <td class="text-xs whitespace-nowrap">${formatDate(e.entry_date)}</td>
                    <td class="text-xs text-gray-600">${e.ref_no || '—'}</td>
                    <td class="text-xs">${e.particulars || '—'}</td>
                    <td class="text-xs">${uacsLabel}</td>
                    <td class="text-right text-xs">${(parseFloat(e.advances)||0) > 0 ? fmt(e.advances) : ''}</td>
                    <td class="text-right text-xs font-semibold text-blue-700">${(parseFloat(e.payment)||0) > 0 ? fmt(e.payment) : ''}</td>
                    <td class="text-right text-xs font-bold">${fmt(e.running_balance)}</td>
                    <td>
                      <button class="btn btn-danger btn-sm" onclick="CDRView.deleteEntry('${e.id}','${id}')">Del</button>
                    </td>
                  </tr>`;
                }).join('')
            }
            ${entries.length > 0 ? `
            <tr class="bg-gray-50 font-bold text-xs">
              <td colspan="5" class="text-right pr-2">TOTAL</td>
              <td class="text-right">${fmt(totalAdv)}</td>
              <td class="text-right text-blue-700">${fmt(totalPay)}</td>
              <td class="text-right">${fmt(finalBal)}</td>
              <td></td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  async backToList() {
    this._detailId = null;
    const el = document.getElementById('view-container');
    const pt = document.getElementById('page-title');
    const ps = document.getElementById('page-subtitle');
    if (pt) pt.textContent = 'Cash Disbursement Register';
    if (ps) ps.textContent = 'Appendix 43 — per school per quarter';
    if (el) el.innerHTML = await this.render();
    await this.afterRender();
  },

  onUACSChange(sel) {
    const opt = sel.options[sel.selectedIndex];
    const desc = opt?.dataset?.desc || '';
    const row = document.getElementById('uacs-desc-row');
    const inp = document.getElementById('entry-uacs-desc');
    if (row) row.style.display = desc ? '' : 'none';
    if (inp) inp.value = desc;
  },

  async saveInlineEntry(e, cdr_id) {
    e.preventDefault();
    const uacs_code = document.getElementById('ei-uacs').value;
    const uacs_desc = uacs_code
      ? (UACS_CODES.find(u => u.code === uacs_code)?.desc || '')
      : '';
    const advances = parseFloat(document.getElementById('ei-advance').value) || 0;
    const payment  = parseFloat(document.getElementById('ei-payment').value)  || 0;

    if (advances === 0 && payment === 0) {
      App.toast('Enter a Cash Advance or Payment amount.', 'error'); return;
    }
    if (payment > 0 && !uacs_code) {
      App.toast('Please select a UACS code for the payment.', 'error'); return;
    }

    const row = {
      id: DB.newId(),
      cdr_id,
      entry_date:  document.getElementById('ei-date').value,
      particulars: document.getElementById('ei-particulars').value.trim(),
      uacs_code,
      uacs_desc,
      advances,
      payment,
      ref_no: document.getElementById('ei-ref').value.trim(),
      sort_order: Date.now(),
    };
    const { error } = await DB.upsertCDREntry(row);
    if (error) { App.toast('Error: ' + error, 'error'); return; }

    const { data: existing } = await DB.getCDREntries(cdr_id);
    await DB.upsertCDRHeader({ id: cdr_id, entry_count: (existing || []).length });

    App.toast('Transaction added!');
    await this.showDetail(cdr_id);
  },

  async deleteEntry(entry_id, cdr_id) {
    if (!confirm('Delete this entry?')) return;
    await DB.deleteCDREntry(entry_id);
    const { data: existing } = await DB.getCDREntries(cdr_id);
    await DB.upsertCDRHeader({ id: cdr_id, entry_count: (existing || []).length });
    App.toast('Entry deleted.');
    await this.showDetail(cdr_id);
  },

  // ---- Print Appendix 43 (matches Google Sheets template) ----
  async printCDR(id) {
    // Open window immediately (must be synchronous from user gesture)
    const w = window.open('', '_blank');
    if (!w) {
      App.toast('Pop-up blocked! Please allow pop-ups for this site and try again.', 'error');
      return;
    }
    w.document.write('<html><body style="font-family:Arial;text-align:center;padding:40px">Loading CDR...</body></html>');

    const [headerRes, entriesRes] = await Promise.all([DB.getCDRHeader(id), DB.getCDREntries(id)]);
    const header = headerRes.data;
    const entries = entriesRes.data || [];
    if (!header) { w.close(); App.toast('CDR not found', 'error'); return; }

    const school = this._getSchool(header.school_id);

    // Running balance (opening balance is shown as a row)
    let balance = parseFloat(header.opening_balance) || 0;
    const rows = entries.map(e => {
      const adv = parseFloat(e.advances) || 0;
      const pay = parseFloat(e.payment) || 0;
      balance = balance + adv - pay;
      return { ...e, running_balance: balance };
    });

    const totalAdv  = entries.reduce((s, e) => s + (parseFloat(e.advances) || 0), 0);
    const totalPay  = entries.reduce((s, e) => s + (parseFloat(e.payment)  || 0), 0);
    const finalBal  = rows.length > 0 ? rows[rows.length - 1].running_balance : (parseFloat(header.opening_balance) || 0);

    // Fixed UACS columns
    const COL_OFFICE = '5020301000';
    const COL_GENSVC = '5021299000';
    const COL_JANIT  = '5021202000';

    const totOffice = entries.filter(e => e.uacs_code === COL_OFFICE).reduce((s,e) => s + (parseFloat(e.payment)||0), 0);
    const totGenSvc = entries.filter(e => e.uacs_code === COL_GENSVC).reduce((s,e) => s + (parseFloat(e.payment)||0), 0);
    const totJanit  = entries.filter(e => e.uacs_code === COL_JANIT ).reduce((s,e) => s + (parseFloat(e.payment)||0), 0);

    // Recapitulation — only payment entries, grouped by UACS
    const recap = {};
    entries.forEach(e => {
      const pay = parseFloat(e.payment) || 0;
      if (!pay) return;
      const code = e.uacs_code || '';
      const desc = e.uacs_desc || UACS_CODES.find(u => u.code === code)?.desc || code;
      if (!recap[code]) recap[code] = { code, desc, total: 0 };
      recap[code].total += pay;
    });

    const recapRows = Object.values(recap).map(r => `
      <tr>
        <td style="border:1px solid #000;padding:1px 3px;font-size:6.5pt">${r.desc}</td>
        <td style="border:1px solid #000;padding:1px 3px;font-size:6.5pt;text-align:center">${r.code}</td>
        <td style="border:1px solid #000;padding:1px 3px;font-size:6.5pt;text-align:right">${_fp(r.total)}</td>
      </tr>`).join('');

    const tableRows = rows.map(e => {
      const adv = parseFloat(e.advances) || 0;
      const pay = parseFloat(e.payment)  || 0;
      const isOffice = e.uacs_code === COL_OFFICE;
      const isGenSvc = e.uacs_code === COL_GENSVC;
      const isJanit  = e.uacs_code === COL_JANIT;
      const isOthers = !isOffice && !isGenSvc && !isJanit && pay > 0;
      const othDesc  = isOthers ? (e.uacs_desc || UACS_CODES.find(u => u.code === e.uacs_code)?.desc || '') : '';
      return `
      <tr>
        <td style="text-align:center;white-space:nowrap">${_fd(e.entry_date)}</td>
        <td style="font-size:6pt;word-break:break-all">${e.ref_no || ''}</td>
        <td style="font-size:6.5pt">${e.particulars || ''}</td>
        <td style="text-align:right">${adv > 0 ? _fp(adv) : ''}</td>
        <td style="text-align:right">${pay > 0 ? _fp(pay) : ''}</td>
        <td style="text-align:right;font-weight:bold">${_fp(e.running_balance)}</td>
        <td style="text-align:right">${isOffice ? _fp(pay) : ''}</td>
        <td style="text-align:right">${isGenSvc ? _fp(pay) : ''}</td>
        <td style="text-align:right">${isJanit  ? _fp(pay) : ''}</td>
        <td style="font-size:6pt">${othDesc}</td>
        <td style="text-align:center;font-size:6pt">${isOthers ? (e.uacs_code || '') : ''}</td>
        <td style="text-align:right">${isOthers ? _fp(pay) : ''}</td>
      </tr>`;
    }).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>CDR — ${school.name || ''} ${header.year} ${header.quarter}</title>
<style>
  @page { size: legal landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #000; margin: 0; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; }
  th { text-align: center; font-size: 6.5pt; background: #f0f0f0; }
  .nb td, .nb th { border: none; }
  .bold { font-weight: bold; }
  .center { text-align: center; }
  .right { text-align: right; }
  .sig { border-top: 1px solid #000; text-align: center; padding-top: 2px; margin-top: 36px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>

<!-- ① Page title -->
<table style="width:100%;margin-bottom:3px" class="nb">
  <tr>
    <td colspan="2" class="center bold" style="font-size:9pt">DEPED LEYTE DIVISION</td>
  </tr>
  <tr>
    <td class="center bold" style="font-size:9pt">${(school.name || '').toUpperCase()}</td>
    <td class="right" style="font-size:8pt">Appendix 43</td>
  </tr>
</table>

<!-- ② Side-by-side: Accountable Officer (left) + Recapitulation (right) -->
<table style="width:100%;margin-bottom:4px" class="nb">
  <tr>
    <td style="width:42%;vertical-align:top;padding-right:6px">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="border:1px solid #000;padding:2px 4px;font-size:7pt" colspan="2">
          <strong>Name of Accountable Officer:</strong> ${school.school_head || ''}
        </td></tr>
        <tr><td style="border:1px solid #000;padding:2px 4px;font-size:7pt" colspan="2">
          <strong>Official Designation:</strong> ${school.designation || ''}
        </td></tr>
        <tr><td style="border:1px solid #000;padding:2px 4px;font-size:7pt" colspan="2">
          <strong>Station:</strong> ${school.short_name || school.name || ''}
        </td></tr>
        <tr>
          <td style="border:1px solid #000;padding:2px 4px;font-size:7pt;width:50%">
            Register No.: ____________________
          </td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:7pt">
            Sheet No.: ____________________
          </td>
        </tr>
      </table>
    </td>
    <td style="width:58%;vertical-align:top">
      <table style="width:100%">
        <thead>
          <tr>
            <th style="width:52%">Account Description</th>
            <th style="width:27%">UACS Object Code</th>
            <th style="width:21%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${recapRows}
          <tr class="bold">
            <td colspan="2" style="text-align:right;padding-right:4px">Total</td>
            <td class="right">${_fp(totalPay)}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:5.5pt;margin-top:2px;font-style:italic">
        The total of the 'Advances for Operating Expenses – Payments' column must always be equal to the sum of the totals of the 'Breakdown of Payments' columns.
      </div>
    </td>
  </tr>
</table>

<!-- ③ Main CDR Table -->
<table style="width:100%;table-layout:fixed">
  <colgroup>
    <col style="width:5%"/>   <!-- Date -->
    <col style="width:11%"/>  <!-- DV/Check -->
    <col style="width:22%"/>  <!-- Particulars -->
    <col style="width:7%"/>   <!-- Cash Advance -->
    <col style="width:7%"/>   <!-- Payments -->
    <col style="width:7%"/>   <!-- Balance -->
    <col style="width:8%"/>   <!-- Office Supplies -->
    <col style="width:8%"/>   <!-- Other Gen Svc -->
    <col style="width:7%"/>   <!-- Janitorial -->
    <col style="width:9%"/>   <!-- Others Desc -->
    <col style="width:6%"/>   <!-- Others UACS -->
    <col style="width:6%"/>   <!-- Others Amt -->
  </colgroup>
  <thead>
    <tr>
      <th rowspan="5">Date</th>
      <th rowspan="5">DV/Payroll/<br/>Check No.</th>
      <th rowspan="5">Particulars</th>
      <th colspan="3">Advances for<br/>Operating Expenses</th>
      <th colspan="6">BREAKDOWN OF PAYMENTS</th>
    </tr>
    <tr>
      <th colspan="3">-19901010</th>
      <th colspan="6"></th>
    </tr>
    <tr>
      <th colspan="3">Amount</th>
      <th rowspan="2">Office Supplies<br/>Expenses</th>
      <th rowspan="2">Other General<br/>Services</th>
      <th rowspan="2">Janitorial<br/>Services</th>
      <th colspan="3">O T H E R S</th>
    </tr>
    <tr>
      <th>Cash<br/>Advance</th>
      <th>Payments</th>
      <th>Balance</th>
      <th>Account<br/>Description</th>
      <th>UACS<br/>Object Code</th>
      <th>Amount</th>
    </tr>
    <tr>
      <th></th><th></th><th></th>
      <th>5020301000</th><th>5021299000</th><th>5021202000</th>
      <th></th><th></th><th></th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="bold" style="background:#f9f9f9">
      <td colspan="3" style="text-align:center;font-size:7pt">TOTAL</td>
      <td class="right">${_fp(totalAdv)}</td>
      <td class="right">${_fp(totalPay)}</td>
      <td class="right">${_fp(finalBal)}</td>
      <td class="right">${totOffice > 0 ? _fp(totOffice) : ''}</td>
      <td class="right">${totGenSvc > 0 ? _fp(totGenSvc) : ''}</td>
      <td class="right">${totJanit  > 0 ? _fp(totJanit)  : ''}</td>
      <td></td><td></td><td></td>
    </tr>
  </tbody>
</table>

<!-- ④ Entity info block -->
<table style="width:100%;margin-top:3px" class="nb">
  <tr>
    <td style="border:1px solid #000;padding:1px 3px;font-size:7pt;width:35%">
      <strong>Entity Name:</strong> ${(school.name || '').toUpperCase()}
    </td>
    <td style="border:1px solid #000;padding:1px 3px;font-size:7pt;width:30%">
      <strong>Sub-Office/District/Division:</strong> DULAG WEST DISTRICT
    </td>
    <td style="border:1px solid #000;padding:1px 3px;font-size:7pt;width:20%">
      <strong>Municipality/City/Province:</strong> DULAG, LEYTE
    </td>
    <td style="border:1px solid #000;padding:1px 3px;font-size:7pt;width:15%">
      <strong>Fund Cluster:</strong> 01-REGULAR
    </td>
  </tr>
</table>

<!-- ⑤ Signature block -->
<table style="width:100%;margin-top:12px" class="nb">
  <tr>
    <td style="width:40%;padding-right:20px;vertical-align:bottom">
      <div class="sig">
        <strong>${school.school_head || ''}</strong><br/>
        <span style="font-size:7pt">${school.designation || 'Principal/Head Teacher'}</span><br/>
        <span style="font-size:7pt">${school.short_name || school.name || ''}</span>
      </div>
    </td>
    <td style="width:20%"></td>
    <td style="width:40%;vertical-align:bottom">
      <div class="sig">
        <strong>${BOOKKEEPER}</strong><br/>
        <span style="font-size:7pt">${BOOKKEEPER_TITLE}</span><br/>
        <span style="font-size:7pt">Dulag West District</span>
      </div>
    </td>
  </tr>
</table>

<script>
  function _fp(n){const v=parseFloat(n)||0;return v===0?'':v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function _fd(d){if(!d)return'';const dt=new Date(d+'T00:00:00');return(dt.getMonth()+1)+'/'+(dt.getDate())+'/'+dt.getFullYear();}
  window.onload=()=>window.print();
<\/script>
</body>
</html>`);
    w.document.close();
  },
};

// Helpers used inside printCDR template literals
function _fp(n) {
  const v = parseFloat(n) || 0;
  return v === 0 ? '' : v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function _fd(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();
}

