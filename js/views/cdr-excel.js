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
      let startBal   = parseFloat(header.opening_balance) || 0;
      if (!allEntries.some(e => (parseFloat(e.advances) || 0) > 0)) {
        const injected = await _cdrInjectAdvance(header, allEntries);
        if (injected.length > allEntries.length) { allEntries = injected; startBal = 0; }
      }

      // Compute running balances in JS — avoids ExcelJS formula-object issues
      const COL_OFF = '5020301000', COL_GEN = '5021299000', COL_JAN = '5021202000';
      let bal = startBal;
      const rows = allEntries.map((e, i) => {
        const adv = parseFloat(e.advances) || 0;
        const pay = parseFloat(e.payment)  || 0;
        bal += adv - pay;
        const isOff = e.uacs_code === COL_OFF;
        const isGen = e.uacs_code === COL_GEN;
        const isJan = e.uacs_code === COL_JAN;
        const isOth = !isOff && !isGen && !isJan && pay > 0;
        const desc  = isOth
          ? (e.uacs_desc || (UACS_CODES.find(u => u.code === e.uacs_code)?.desc) || '')
          : '';
        return { e, i, adv, pay, bal, isOff, isGen, isJan, isOth, desc };
      });

      // Load workbook from template buffer
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await tplResp.arrayBuffer());

      // Find and rename target sheet
      const ws = wb.worksheets.find(s => s.name.endsWith(suffix));
      if (!ws) throw new Error(`No sheet ending in "${suffix}" found in template`);
      ws.name = shortName + suffix;

      // Remove other quarter sheets; keep UACS
      wb.worksheets
        .filter(s => s !== ws && s.name !== 'UACS')
        .forEach(s => wb.removeWorksheet(s.id));

      // Write header cells (top-left of each merged region)
      ws.getCell('A3').value  = sName;
      ws.getCell('A8').value  = `Entity Name: ${sName}`;
      ws.getCell('I8').value  = `Name of Accountable Officer: ${school.school_head || ''}`;
      ws.getCell('I9').value  = `Official Designation: ${school.designation || ''}`;
      ws.getCell('I10').value = `Station: ${shortName}`;
      ws.getCell('I11').value = `Register No. : ${header.register_no || '_____'}`;
      ws.getCell('I12').value = `Sheet No. : ${header.sheet_no || '_____'}`;

      // Overwrite data rows 19–65 directly (no eachCell clear — avoids ExcelJS model corruption)
      const FIRST_ROW = 19, LAST_ROW = 65;
      for (let i = 0; i < rows.length && (FIRST_ROW + i) <= LAST_ROW; i++) {
        const { e, adv, pay, bal: b, isOff, isGen, isJan, isOth, desc } = rows[i];
        const rn = FIRST_ROW + i;
        ws.getCell(rn, 1).value  = e.entry_date ? new Date(e.entry_date + 'T00:00:00') : null;
        ws.getCell(rn, 2).value  = e.ref_no || null;
        ws.getCell(rn, 3).value  = e.particulars || null;
        ws.getCell(rn, 4).value  = (i === 0 && adv > 0) ? adv : null;
        ws.getCell(rn, 5).value  = pay > 0 ? pay : null;
        ws.getCell(rn, 6).value  = b;
        ws.getCell(rn, 7).value  = isOff ? pay : null;
        ws.getCell(rn, 8).value  = isGen ? pay : null;
        ws.getCell(rn, 9).value  = isJan ? pay : null;
        ws.getCell(rn, 10).value = isOth ? (desc || null) : null;
        ws.getCell(rn, 11).value = isOth ? (e.uacs_code || null) : null;
        ws.getCell(rn, 12).value = isOth ? pay : null;
      }

      // Null-out any leftover template rows below our data
      for (let r = FIRST_ROW + rows.length; r <= LAST_ROW; r++) {
        for (let c = 1; c <= 12; c++) ws.getCell(r, c).value = null;
      }

      // Trigger download
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
