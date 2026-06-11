// ============================================================
// CHECK ISSUED REPORT — lists all payment CDR entries across
// both MOOE and Special Fund CDRs
// ============================================================
const CheckIssuedView = {
  _schools:     [],
  _headers:     [],
  _entries:     [],
  _currentRows: [],
  _schoolFilter:   '',
  _yearFilter:     '',
  _fundTypeFilter: '',

  async render() {
    return `<div class="flex justify-center py-20"><div class="spinner"></div></div>`;
  },

  async afterRender() {
    const [schoolsRes, headersRes, entriesRes, ftRes] = await Promise.all([
      DB.getSchools(),
      DB.getCDRHeaders(),
      DB.getAllCDREntries(),
      DB.getFundTypes(),
    ]);
    this._schools = schoolsRes.data  || [];
    this._headers = headersRes.data  || [];
    this._entries = (entriesRes.data || []).filter(e => (parseFloat(e.payment) || 0) > 0);

    const years = [...new Set(this._headers.map(h => h.year).filter(Boolean))].sort((a, b) => b - a);
    const isAdmin      = typeof Auth !== 'undefined' && Auth.isAdmin();
    const userSchoolId = typeof Auth !== 'undefined' ? Auth.getSchoolId() : null;

    const schoolOpts = isAdmin
      ? `<option value="">All Schools</option>` +
        this._schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : `<option value="${userSchoolId}">${this._schools.find(s => s.id === userSchoolId)?.name || 'My School'}</option>`;

    const yearOpts = `<option value="">All Years</option>` +
      years.map(y => `<option value="${y}">${y}</option>`).join('');

    const fundTypeOpts = `<option value="">All Fund Types</option>` +
      (ftRes.data || []).map(f => `<option value="${f.name}">${f.name}</option>`).join('');

    const el = document.getElementById('view-container');
    el.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div class="flex gap-2 flex-wrap">
        ${isAdmin ? `<select id="ci-school" class="form-select" style="min-width:180px">${schoolOpts}</select>` : ''}
        <select id="ci-year" class="form-select" style="min-width:120px">${yearOpts}</select>
        <select id="ci-fundtype" class="form-select" style="min-width:200px">${fundTypeOpts}</select>
      </div>
      <button class="btn btn-primary btn-sm" onclick="CheckIssuedView.downloadExcel()">Download Excel</button>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <h3>Check Issued</h3>
        <span id="ci-count" class="text-xs text-gray-500"></span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>#</th>
            <th>Date</th>
            <th>Check/DV No.</th>
            <th>Payee</th>
            <th>Fund Type</th>
            <th>School</th>
            <th class="text-right">Amount</th>
          </tr></thead>
          <tbody id="ci-tbody"></tbody>
        </table>
      </div>
    </div>`;

    this._schoolFilter   = isAdmin ? '' : (userSchoolId || '');
    this._yearFilter     = '';
    this._fundTypeFilter = '';

    if (isAdmin) {
      document.getElementById('ci-school').addEventListener('change', e => {
        this._schoolFilter = e.target.value;
        this._paint();
      });
    }
    document.getElementById('ci-fundtype').addEventListener('change', e => {
      this._fundTypeFilter = e.target.value;
      this._paint();
    });
    document.getElementById('ci-year').addEventListener('change', e => {
      this._yearFilter = e.target.value;
      this._paint();
    });

    this._paint();
  },

  _paint() {
    const tbody   = document.getElementById('ci-tbody');
    const countEl = document.getElementById('ci-count');
    if (!tbody) return;

    const headerMap = new Map(this._headers.map(h => [h.id, h]));
    const schoolMap = new Map(this._schools.map(s => [s.id, s]));

    let rows = this._entries.map(e => {
      const h = headerMap.get(e.cdr_id) || {};
      return { ...e, fund_type: h.fund_type || '—', school_id: h.school_id, year: h.year };
    });

    if (this._schoolFilter)   rows = rows.filter(r => r.school_id === this._schoolFilter);
    if (this._yearFilter)     rows = rows.filter(r => String(r.year) === String(this._yearFilter));
    if (this._fundTypeFilter) rows = rows.filter(r => r.fund_type === this._fundTypeFilter);

    rows.sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || ''));

    this._currentRows = rows;
    if (countEl) countEl.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-8 text-sm">No records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((e, i) => {
      const dvCheck = e.dv_no || e.check_no
        ? [e.dv_no, e.check_no].filter(Boolean).join('/')
        : (e.ref_no || '—');
      const school = schoolMap.get(e.school_id);
      return `<tr>
        <td class="text-xs text-gray-400">${i + 1}</td>
        <td class="text-xs whitespace-nowrap">${formatDate(e.entry_date)}</td>
        <td class="text-xs">${dvCheck}</td>
        <td class="text-xs">${e.payee || '—'}</td>
        <td class="text-xs">${e.fund_type}</td>
        <td class="text-xs">${school?.short_name || school?.name || '—'}</td>
        <td class="text-right text-xs font-semibold">${fmt(e.payment)}</td>
      </tr>`;
    }).join('');
  },

  async downloadExcel() {
    if (!this._currentRows.length) { App.toast('No data to export.', 'error'); return; }
    App.toast('Building Excel...');
    if (typeof XLSX === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const schoolMap = new Map(this._schools.map(s => [s.id, s]));
    const data = [
      ['#', 'Date', 'DV/Check No.', 'Payee', 'Fund Type', 'School', 'Amount'],
      ...this._currentRows.map((e, i) => {
        const school  = schoolMap.get(e.school_id);
        const dvCheck = e.dv_no || e.check_no
          ? [e.dv_no, e.check_no].filter(Boolean).join('/')
          : (e.ref_no || '');
        return [
          i + 1,
          e.entry_date || '',
          dvCheck,
          e.payee || '',
          e.fund_type || '',
          school?.name || '',
          parseFloat(e.payment) || 0,
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 24 },
      { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Check Issued');
    XLSX.writeFile(wb, 'Check_Issued.xlsx');
    App.toast('Excel downloaded!');
  },
};
