// ============================================================
// CDR EXCEL DOWNLOAD  —  fills assets/cdr_template.xlsx
// ============================================================
const CDRExcel = {
  async download(id) {
    try {
      if (typeof ExcelJS === 'undefined') {
        App.toast('Excel library not loaded. Please refresh the page.', 'error');
        return;
      }

      App.toast('Loading template…');

      const [headerRes, entriesRes, schoolsRes, tplResp] = await Promise.all([
        DB.getCDRHeader(id),
        DB.getCDREntries(id),
        DB.getSchools(),
        fetch('assets/cdr_template.xlsx'),
      ]);

      const header = headerRes.data;
      if (!header) { App.toast('CDR not found', 'error'); return; }
      if (!tplResp.ok) throw new Error('Template file not found');

      const school    = (schoolsRes.data || []).find(s => s.id === header.school_id) || {};
      const shortName = school.short_name || school.name || 'School';
      const sName     = (school.name || '').toUpperCase();
      const qNum      = header.quarter.replace('Q', '');
      const suffix    = `-Q${qNum}`;

      // Inject cash advance entry if none present (matches printCDR logic)
      let allEntries = [...(entriesRes.data || [])];
      if (!allEntries.some(e => (parseFloat(e.advances) || 0) > 0)) {
        allEntries = await _cdrInjectAdvance(header, allEntries);
      }

      // Load workbook from template buffer
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await tplResp.arrayBuffer());

      // Find and rename target sheet
      const ws = wb.worksheets.find(s => s.name.endsWith(suffix));
      if (!ws) throw new Error(`Sheet ending in "${suffix}" not found in template`);
      ws.name = shortName + suffix;

      // Remove other quarter sheets; keep UACS
      wb.worksheets
        .filter(s => s !== ws && s.name !== 'UACS')
        .forEach(s => wb.removeWorksheet(s.id));

      // Write header cells
      const set = (addr, v) => { ws.getCell(addr).value = v; };
      set('A3',  sName);
      set('A8',  `Entity Name: ${sName}`);
      set('I8',  `Name of Accountable Officer: ${school.school_head || ''}`);
      set('I9',  `Official Designation: ${school.designation || ''}`);
      set('I10', `Station: ${shortName}`);
      set('I11', `Register No. : ${header.register_no || '_____'}`);
      set('I12', `Sheet No. : ${header.sheet_no || '_____'}`);

      // Clear data rows 19–65 values only (preserve formatting)
      for (let r = 19; r <= 65; r++) {
        ws.getRow(r).eachCell({ includeEmpty: false }, c => { c.value = null; });
      }

      // Write data rows starting at row 19
      const COL_OFF = '5020301000', COL_GEN = '5021299000', COL_JAN = '5021202000';
      allEntries.forEach((e, i) => {
        const rn  = 19 + i;
        const adv = parseFloat(e.advances) || 0;
        const pay = parseFloat(e.payment)  || 0;
        const isOff = e.uacs_code === COL_OFF;
        const isGen = e.uacs_code === COL_GEN;
        const isJan = e.uacs_code === COL_JAN;
        const isOth = !isOff && !isGen && !isJan && pay > 0;

        ws.getCell(rn, 1).value = e.entry_date ? _fd(e.entry_date) : '';
        ws.getCell(rn, 2).value = e.ref_no || '';
        ws.getCell(rn, 3).value = e.particulars || '';
        if (i === 0 && adv > 0) ws.getCell(rn, 4).value = adv;
        if (pay > 0)            ws.getCell(rn, 5).value = pay;
        ws.getCell(rn, 6).value = rn === 19
          ? { formula: '=D19' }
          : { formula: `=F${rn - 1}-E${rn}` };
        if (isOff) ws.getCell(rn, 7).value = pay;
        if (isGen) ws.getCell(rn, 8).value = pay;
        if (isJan) ws.getCell(rn, 9).value = pay;
        if (isOth) {
          const desc = e.uacs_desc || (UACS_CODES.find(u => u.code === e.uacs_code)?.desc) || '';
          ws.getCell(rn, 10).value = desc;
          ws.getCell(rn, 11).value = e.uacs_code || '';
          ws.getCell(rn, 12).value = pay;
        }
      });

      // Generate file and trigger download
      const safeName = shortName.replace(/[\s/\\]+/g, '_');
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `CDR_${header.year}_${safeName}_Q${qNum}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      App.toast('Excel downloaded!');
    } catch (err) {
      App.toast('Excel error: ' + (err.message || err), 'error');
    }
  },
};

// Looks up the matching fund release and prepends a cash-advance entry
async function _cdrInjectAdvance(header, entries) {
  const { data: funds } = await DB.getFunds({ school_id: header.school_id });
  const norm    = s => (s || '').trim().toLowerCase();
  const matched = (funds || [])
    .filter(f => norm(f.fund_type) === norm(header.fund_type))
    .sort((a, b) => (b.ada_date || '').localeCompare(a.ada_date || ''));
  const rf = matched[0];
  if (!rf) return entries;
  const ord      = { Q1: '1st', Q2: '2nd', Q3: '3rd', Q4: '4th' };
  const isMOOE   = typeof DashboardView !== 'undefined' && DashboardView._isMOOE(header.fund_type);
  const particulars = isMOOE
    ? `Operating Advances for ${ord[header.quarter] || header.quarter} Quarter`
    : `Operating Advances for ${header.fund_type}`;
  return [{
    id: '_adv', entry_date: rf.ada_date, ref_no: rf.ada_no || '',
    particulars, uacs_code: '', uacs_desc: '',
    advances: parseFloat(rf.amount) || 0, payment: 0,
  }, ...entries];
}
