// ============================================================
// DATABASE LAYER — wraps Supabase calls
// Falls back to localStorage when Supabase is not configured.
// ============================================================

const DB = (() => {
  let sb = null;
  let useLocal = true;

  function init() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      useLocal = false;
      return true;
    }
    return false;
  }

  // ---- localStorage helpers ----
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem('dwd_' + key) || '[]'); } catch { return []; }
  }
  function lsSet(key, val) { localStorage.setItem('dwd_' + key, JSON.stringify(val)); }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function now() { return new Date().toISOString(); }

  // ---- Generic CRUD for localStorage ----
  function lsInsert(table, row) {
    const rows = lsGet(table);
    row.id = row.id || newId();
    row.created_at = row.created_at || now();
    rows.push(row);
    lsSet(table, rows);
    return { data: row, error: null };
  }
  function lsUpdate(table, id, changes) {
    const rows = lsGet(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return { data: null, error: 'Not found' };
    rows[idx] = { ...rows[idx], ...changes, updated_at: now() };
    lsSet(table, rows);
    return { data: rows[idx], error: null };
  }
  function lsDelete(table, id) {
    const rows = lsGet(table).filter(r => r.id !== id);
    lsSet(table, rows);
    return { error: null };
  }
  function lsAll(table) { return { data: lsGet(table), error: null }; }

  // ============================================================
  // SCHOOLS
  // ============================================================
  async function getSchools() {
    if (useLocal) return lsAll('schools');
    const { data, error } = await sb.from('schools').select('*').order('name');
    return { data, error };
  }
  async function upsertSchool(school) {
    if (useLocal) {
      const rows = lsGet('schools');
      const idx = rows.findIndex(r => r.id === school.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...school }; lsSet('schools', rows); return { data: rows[idx], error: null }; }
      return lsInsert('schools', school);
    }
    const { data, error } = await sb.from('schools').upsert(school).select().single();
    return { data, error };
  }
  async function deleteSchool(id) {
    if (useLocal) return lsDelete('schools', id);
    const { error } = await sb.from('schools').delete().eq('id', id);
    return { error };
  }

  // ============================================================
  // DISBURSEMENTS (MOOE monitoring)
  // ============================================================
  async function getDisbursements(filters = {}) {
    if (useLocal) {
      let rows = lsGet('disbursements');
      if (filters.school_id) rows = rows.filter(r => r.school_id === filters.school_id);
      if (filters.year) rows = rows.filter(r => r.ada_date && r.ada_date.startsWith(filters.year));
      if (filters.status) rows = rows.filter(r => r.status === filters.status);
      return { data: rows, error: null };
    }
    let q = sb.from('disbursements').select('*, schools(name, short_name)').order('ada_date', { ascending: false });
    if (filters.school_id) q = q.eq('school_id', filters.school_id);
    if (filters.year) q = q.gte('ada_date', filters.year + '-01-01').lte('ada_date', filters.year + '-12-31');
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q;
    return { data, error };
  }
  async function upsertDisbursement(row) {
    if (useLocal) {
      const rows = lsGet('disbursements');
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row, updated_at: now() }; lsSet('disbursements', rows); return { data: rows[idx], error: null }; }
      return lsInsert('disbursements', row);
    }
    const { data, error } = await sb.from('disbursements').upsert(row).select().single();
    return { data, error };
  }
  async function deleteDisbursement(id) {
    if (useLocal) return lsDelete('disbursements', id);
    const { error } = await sb.from('disbursements').delete().eq('id', id);
    return { error };
  }

  // ============================================================
  // CDR HEADERS
  // ============================================================
  async function getCDRHeaders(filters = {}) {
    if (useLocal) {
      let rows = lsGet('cdr_headers');
      if (filters.school_id) rows = rows.filter(r => r.school_id === filters.school_id);
      if (filters.year) rows = rows.filter(r => r.year == filters.year);
      return { data: rows, error: null };
    }
    let q = sb.from('cdr_headers').select('*, schools(name, short_name, school_head, designation)').order('created_at', { ascending: false });
    if (filters.school_id) q = q.eq('school_id', filters.school_id);
    if (filters.year) q = q.eq('year', filters.year);
    const { data, error } = await q;
    return { data, error };
  }
  async function getCDRHeader(id) {
    if (useLocal) {
      const row = lsGet('cdr_headers').find(r => r.id === id);
      return { data: row || null, error: row ? null : 'Not found' };
    }
    const { data, error } = await sb.from('cdr_headers').select('*, schools(*)').eq('id', id).single();
    return { data, error };
  }
  async function upsertCDRHeader(row) {
    if (useLocal) {
      const rows = lsGet('cdr_headers');
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('cdr_headers', rows); return { data: rows[idx], error: null }; }
      return lsInsert('cdr_headers', row);
    }
    const { data, error } = await sb.from('cdr_headers').upsert(row).select().single();
    return { data, error };
  }
  async function deleteCDRHeader(id) {
    if (useLocal) {
      lsDelete('cdr_headers', id);
      // also delete entries
      const entries = lsGet('cdr_entries').filter(e => e.cdr_id !== id);
      lsSet('cdr_entries', entries);
      return { error: null };
    }
    const { error } = await sb.from('cdr_headers').delete().eq('id', id);
    return { error };
  }

  // ============================================================
  // CDR ENTRIES
  // ============================================================
  async function getCDREntries(cdr_id) {
    if (useLocal) {
      const rows = lsGet('cdr_entries').filter(r => r.cdr_id === cdr_id).sort((a, b) => a.sort_order - b.sort_order || a.entry_date.localeCompare(b.entry_date));
      return { data: rows, error: null };
    }
    const { data, error } = await sb.from('cdr_entries').select('*').eq('cdr_id', cdr_id).order('sort_order').order('entry_date');
    return { data, error };
  }
  async function upsertCDREntry(row) {
    if (useLocal) {
      const rows = lsGet('cdr_entries');
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('cdr_entries', rows); return { data: rows[idx], error: null }; }
      return lsInsert('cdr_entries', row);
    }
    const { data, error } = await sb.from('cdr_entries').upsert(row).select().single();
    return { data, error };
  }
  async function deleteCDREntry(id) {
    if (useLocal) return lsDelete('cdr_entries', id);
    const { error } = await sb.from('cdr_entries').delete().eq('id', id);
    return { error };
  }

  // ============================================================
  // BANK RECONCILIATION
  // ============================================================
  async function getBankRecon(filters = {}) {
    if (useLocal) {
      let rows = lsGet('bank_recon');
      if (filters.school_id) rows = rows.filter(r => r.school_id === filters.school_id);
      if (filters.year) rows = rows.filter(r => r.year == filters.year);
      if (filters.bank) rows = rows.filter(r => r.bank === filters.bank);
      return { data: rows, error: null };
    }
    let q = sb.from('bank_reconciliation').select('*, schools(name, short_name)');
    if (filters.school_id) q = q.eq('school_id', filters.school_id);
    if (filters.year) q = q.eq('year', filters.year);
    if (filters.bank) q = q.eq('bank', filters.bank);
    const { data, error } = await q;
    return { data, error };
  }
  async function upsertBankRecon(row) {
    if (useLocal) {
      const rows = lsGet('bank_recon');
      const idx = rows.findIndex(r => r.school_id === row.school_id && r.bank === row.bank && r.year == row.year && r.month == row.month);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('bank_recon', rows); return { data: rows[idx], error: null }; }
      return lsInsert('bank_recon', row);
    }
    const { data, error } = await sb.from('bank_reconciliation').upsert(row, { onConflict: 'school_id,bank,year,month' }).select().single();
    return { data, error };
  }

  // ============================================================
  // RESOURCES
  // ============================================================
  async function getResources(filters = {}) {
    if (useLocal) {
      let rows = lsGet('resources');
      if (filters.category) rows = rows.filter(r => r.category === filters.category);
      return { data: rows, error: null };
    }
    let q = sb.from('resources').select('*').order('created_at', { ascending: false });
    if (filters.category) q = q.eq('category', filters.category);
    const { data, error } = await q;
    return { data, error };
  }
  async function upsertResource(row) {
    if (useLocal) {
      const rows = lsGet('resources');
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('resources', rows); return { data: rows[idx], error: null }; }
      return lsInsert('resources', row);
    }
    const { data, error } = await sb.from('resources').upsert(row).select().single();
    return { data, error };
  }
  async function deleteResource(id) {
    if (useLocal) return lsDelete('resources', id);
    const { error } = await sb.from('resources').delete().eq('id', id);
    return { error };
  }

  // ============================================================
  // UACS CODES (localStorage only)
  // ============================================================
  async function getUACS() {
    const saved = lsGet('uacs');
    if (saved.length) return { data: saved, error: null };
    const defaults = typeof UACS_CODES !== 'undefined'
      ? UACS_CODES.map(u => ({ id: u.code, code: u.code, desc: u.desc }))
      : [];
    return { data: defaults, error: null };
  }
  async function upsertUACS(row) {
    let rows = lsGet('uacs');
    if (!rows.length && typeof UACS_CODES !== 'undefined') {
      rows = UACS_CODES.map(u => ({ id: u.code, code: u.code, desc: u.desc }));
    }
    row.id = row.id || row.code || newId();
    const idx = rows.findIndex(r => r.id === row.id);
    if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('uacs', rows); return { data: rows[idx], error: null }; }
    rows.push(row);
    lsSet('uacs', rows);
    return { data: row, error: null };
  }

  // ============================================================
  // SUPABASE FILE UPLOAD (for PDFs)
  // ============================================================
  async function uploadFile(bucket, path, file) {
    if (!sb) return { url: null, error: 'Supabase not connected' };
    const { data, error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return { url: null, error };
    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
    return { url: urlData.publicUrl, error: null };
  }

  // ============================================================
  // DOWNLOADED FUNDS
  // ============================================================
  async function getFunds(filters = {}) {
    if (useLocal) {
      let rows = lsGet('funds');
      if (filters.school_id) rows = rows.filter(r => r.school_id === filters.school_id);
      if (filters.year)      rows = rows.filter(r => r.year == filters.year);
      if (filters.status)    rows = rows.filter(r => r.status === filters.status);
      rows.sort((a,b) => (a.ada_date||'').localeCompare(b.ada_date||''));
      return { data: rows, error: null };
    }
    let q = sb.from('downloaded_funds').select('*').order('ada_date');
    if (filters.school_id) q = q.eq('school_id', filters.school_id);
    if (filters.year)      q = q.eq('year', filters.year);
    if (filters.status)    q = q.eq('status', filters.status);
    const { data, error } = await q;
    return { data, error };
  }
  async function upsertFund(row) {
    if (useLocal) {
      const rows = lsGet('funds');
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx > -1) { rows[idx] = { ...rows[idx], ...row }; lsSet('funds', rows); return { data: rows[idx], error: null }; }
      return lsInsert('funds', row);
    }
    const { data, error } = await sb.from('downloaded_funds').upsert(row).select().single();
    return { data, error };
  }
  async function deleteFund(id) {
    if (useLocal) return lsDelete('funds', id);
    const { error } = await sb.from('downloaded_funds').delete().eq('id', id);
    return { error };
  }

  return {
    init, isLocal: () => useLocal,
    // schools
    getSchools, upsertSchool, deleteSchool,
    // disbursements
    getDisbursements, upsertDisbursement, deleteDisbursement,
    // cdr
    getCDRHeaders, getCDRHeader, upsertCDRHeader, deleteCDRHeader,
    getCDREntries, upsertCDREntry, deleteCDREntry,
    // bank recon
    getBankRecon, upsertBankRecon,
    // resources
    getResources, upsertResource, deleteResource,
    // uacs codes
    getUACS, upsertUACS,
    // downloaded funds
    getFunds, upsertFund, deleteFund,
    // files
    uploadFile,
    // helpers
    newId,
  };
})();
