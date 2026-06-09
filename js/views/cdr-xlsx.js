// ============================================================
// CDR EXCEL DOWNLOAD — xlsx-populate (preserves template formatting)
// NOTE: xlsx-populate browser build does not support row insertion/
// deletion. If entries exceed 38 template blank rows, Totals is
// written at row 19+n (overwriting that row) instead of row 57.
// ============================================================
const CDRXlsx = {
  async download(headerId) {
    try {
      if (typeof XlsxPopulate === 'undefined') {
        App.toast('XlsxPopulate not loaded.', 'error');
        return;
      }

      App.toast('Building Excel…');

      const [headerRes, entriesRes, schoolsRes, tplResp] = await Promise.all([
        DB.getCDRHeader(headerId),
        DB.getCDREntries(headerId),
        DB.getSchools(),
        fetch('assets/cdr_template.xlsx'),
      ]);

      const header = headerRes.data;
      if (!header) { App.toast('CDR not found.', 'error'); return; }
      if (!tplResp.ok) throw new Error('Template not found');

      const school  = (schoolsRes.data || []).find(s => s.id === header.school_id) || {};
      const entries = (entriesRes.data || []).slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const buf = await tplResp.arrayBuffer();
      const wb  = await XlsxPopulate.fromDataAsync(buf);
      const ws  = wb.sheet(0);

      // Search cols 1-12 for a row containing text (exact=true for strict match)
      const findRow = (text, from, to, exact) => {
        const t = text.toLowerCase();
        for (let r = (from || 1); r <= (to || 200); r++) {
          for (let c = 1; c <= 12; c++) {
            const v = ws.cell(r, c).value();
            if (typeof v === 'string') {
              const vt = v.trim().toLowerCase();
              if (exact ? vt === t : vt.includes(t)) return r;
            }
          }
        }
        return null;
      };

      const name  = (school.name || '').toUpperCase();
      const NUM   = '#,##0.00';
      const FIRST = 19;

      // ── Header cells ──
      ws.cell('A3').value(name);
      ws.cell('A8').value('Entity Name: ' + name);
      ws.cell('I8').value('Name of Accountable Officer: ' + (school.school_head || ''));
      ws.cell('I9').value('Official Designation: ' + (school.designation || ''));
      ws.cell('I10').value('Station: ' + (school.short_name || ''));
      ws.cell('I11').value('Register No. : ' + (header.register_no || '____'));
      ws.cell('I12').value('Sheet No. : ' + (header.sheet_no || '____'));

      // ── Find Totals row and clear template sample data ──
      const totalsRow = findRow('totals', FIRST, 100) || 57;
      const blank = totalsRow - FIRST;   // 38 in template
      const need  = entries.length;

      for (let r = FIRST; r < totalsRow; r++) {
        for (let c = 1; c <= 12; c++) ws.cell(r, c).value(null);
      }

      // ── Write entries ──
      let bal = 0, sumPay = 0, sumG = 0, sumH = 0, sumI = 0, sumL = 0;
      const recap = [];

      entries.forEach((e, i) => {
        const rn  = FIRST + i;
        const adv = parseFloat(e.advances) || 0;
        const pay = parseFloat(e.payment)  || 0;

        if (e.entry_date)  ws.cell(rn, 1).value(new Date(e.entry_date + 'T00:00:00')).style('numberFormat', 'MM/DD/YYYY');
        if (e.ref_no)      ws.cell(rn, 2).value(String(e.ref_no));
        if (e.particulars) ws.cell(rn, 3).value(String(e.particulars));

        if (adv > 0) {
          ws.cell(rn, 4).value(adv).style('numberFormat', NUM);
          bal = adv;
        } else if (pay > 0) {
          ws.cell(rn, 5).value(pay).style('numberFormat', NUM);
          bal    -= pay;
          sumPay += pay;
          const code = e.uacs_code || '';
          if      (code === '5020301000') { ws.cell(rn, 7).value(pay).style('numberFormat', NUM); sumG += pay; }
          else if (code === '5021299000') { ws.cell(rn, 8).value(pay).style('numberFormat', NUM); sumH += pay; }
          else if (code === '5021202000') { ws.cell(rn, 9).value(pay).style('numberFormat', NUM); sumI += pay; }
          else {
            const desc = e.uacs_desc || '';
            if (desc) ws.cell(rn, 10).value(desc);
            if (code) ws.cell(rn, 11).value(code);
            ws.cell(rn, 12).value(pay).style('numberFormat', NUM);
            sumL += pay;
            recap.push({ desc, code, amt: pay });
          }
        }
        ws.cell(rn, 6).value(bal).style('numberFormat', NUM);
      });

      // ── Totals row ──
      const tRow = need <= blank ? totalsRow : FIRST + need;
      ws.cell(tRow, 5).value(sumPay).style('numberFormat', NUM);
      ws.cell(tRow, 6).value(bal).style('numberFormat', NUM);
      ws.cell(tRow, 7).value(sumG).style('numberFormat', NUM);
      ws.cell(tRow, 8).value(sumH).style('numberFormat', NUM);
      ws.cell(tRow, 9).value(sumI).style('numberFormat', NUM);
      ws.cell(tRow, 12).value(sumL).style('numberFormat', NUM);

      // ── Recap section ──
      const acctRow = findRow('account description', tRow + 1, 120);
      if (acctRow) {
        for (let r = acctRow + 1; r < acctRow + 12; r++) {
          ws.cell(r, 10).value(null);
          ws.cell(r, 11).value(null);
          ws.cell(r, 12).value(null);
        }
        recap.forEach((item, i) => {
          const r = acctRow + 1 + i;
          if (item.desc) ws.cell(r, 10).value(item.desc);
          if (item.code) ws.cell(r, 11).value(item.code);
          ws.cell(r, 12).value(item.amt).style('numberFormat', NUM);
        });
        const recapTotRow = findRow('total', acctRow + 1, acctRow + 15, true);
        if (recapTotRow) ws.cell(recapTotRow, 12).value(sumL).style('numberFormat', NUM);
      }

      // ── Signatures ──
      const certRow = findRow('certified correct', 60);
      if (certRow) {
        ws.cell(certRow + 2, 3).value((school.school_head || '').toUpperCase());
        ws.cell(certRow + 3, 3).value(school.designation || '');
      }
      const rcvRow = findRow('received by', 60);
      if (rcvRow) {
        ws.cell(rcvRow + 2, 9).value('JO ANN MARIE P. CAGARA');
        ws.cell(rcvRow + 3, 9).value('ADAS III (Senior Bookkeeper)');
      }

      // ── Download ──
      const safeName = (school.short_name || school.name || 'School').replace(/[\s/\\]+/g, '_');
      const qNum = (header.quarter || 'Q1').replace('Q', '');
      const out  = await wb.outputAsync();
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
