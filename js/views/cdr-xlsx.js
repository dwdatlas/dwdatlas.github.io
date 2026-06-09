// STEP 1 SMOKE TEST — confirms xlsx-populate preserves template formatting.
// Call CDRXlsx.test() from the browser console.
// This file will be replaced in Step 2 after formatting is confirmed.
const CDRXlsx = {
  async test() {
    try {
      if (typeof XlsxPopulate === 'undefined') { App.toast('XlsxPopulate not loaded — check CDN in console.', 'error'); return; }
      App.toast('Loading template for format test…');
      const resp = await fetch('assets/cdr_template.xlsx');
      if (!resp.ok) throw new Error('Template not found');
      const buf = await resp.arrayBuffer();
      const wb  = await XlsxPopulate.fromDataAsync(buf);
      wb.sheet(0).cell('A3').value('TEST');
      const out  = await wb.outputAsync();
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'FORMAT_TEST.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      App.toast('FORMAT_TEST.xlsx downloaded — open it and confirm borders/formatting survived.');
    } catch (err) {
      App.toast('Test error: ' + (err.message || err), 'error');
    }
  },
};
