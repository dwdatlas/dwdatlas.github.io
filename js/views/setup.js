// ============================================================
// SETUP / CONFIG VIEW
// ============================================================
const SetupView = {
  async render() {
    const url = localStorage.getItem('sb_url') || '';
    const key = localStorage.getItem('sb_key') || '';
    const isConnected = !!(url && key);

    return `
    <div class="page-header">
      <h2>Setup / Configuration</h2>
      <p>Connect Supabase, backup data, and manage settings</p>
    </div>

    <!-- Supabase Connection -->
    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3>Supabase Connection</h3>
        <span class="${isConnected ? 'badge badge-liquidated' : 'badge badge-pending'}">${isConnected ? '✓ Connected' : '⚡ Local Only'}</span>
      </div>
      <div class="section-card-body">
        <p class="text-sm text-gray-600 mb-4">
          The app works completely <strong>offline using localStorage</strong>. To sync data across devices, connect a free
          <a href="https://supabase.com" target="_blank" class="text-blue-600 underline">Supabase</a> project.
        </p>
        <form id="supabase-form" onsubmit="SetupView.saveSupabase(event)">
          <div class="grid grid-cols-1 gap-3 mb-3 max-w-lg">
            <div>
              <label class="form-label">Supabase Project URL</label>
              <input id="sb-url" type="url" class="form-input" placeholder="https://xxxxxxxxxxxx.supabase.co"
                     value="${url}" />
            </div>
            <div>
              <label class="form-label">Supabase Anon/Public Key</label>
              <input id="sb-key" type="text" class="form-input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                     value="${key}" />
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn btn-primary">Save &amp; Connect</button>
            ${isConnected ? `<button type="button" class="btn btn-danger" onclick="SetupView.disconnectSupabase()">Disconnect</button>` : ''}
          </div>
        </form>
      </div>
    </div>

    <!-- Database Schema -->
    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3>Database Schema (Supabase SQL)</h3>
        <button class="btn btn-secondary btn-sm" onclick="SetupView.copySchema()">Copy SQL</button>
      </div>
      <div class="section-card-body">
        <p class="text-sm text-gray-600 mb-3">
          Run this SQL in your Supabase project → SQL Editor to create all required tables.
        </p>
        <pre id="schema-pre" class="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">${this.schemaSql()}</pre>
      </div>
    </div>

    <!-- Storage Bucket -->
    <div class="section-card mb-4">
      <div class="section-card-header"><h3>Storage Bucket Setup</h3></div>
      <div class="section-card-body">
        <ol class="list-decimal list-inside text-sm text-gray-700 space-y-1">
          <li>Go to your Supabase project → <strong>Storage</strong></li>
          <li>Click <strong>New Bucket</strong>, name it <code class="bg-gray-100 px-1 rounded">resources</code></li>
          <li>Check <strong>Public bucket</strong> to allow file downloads</li>
          <li>Save. PDF uploads in the Resources section will now work.</li>
        </ol>
      </div>
    </div>

    <!-- Backup / Restore -->
    <div class="section-card mb-4">
      <div class="section-card-header"><h3>Data Backup &amp; Restore</h3></div>
      <div class="section-card-body">
        <div class="flex flex-wrap gap-3">
          <button class="btn btn-secondary" onclick="SetupView.exportData()">Export JSON Backup</button>
          <label class="btn btn-secondary cursor-pointer">
            Import JSON Backup
            <input type="file" accept=".json" class="hidden" onchange="SetupView.importData(event)" />
          </label>
          <button class="btn btn-danger" onclick="SetupView.clearData()">Clear All Local Data</button>
        </div>
        <p class="text-xs text-gray-500 mt-2">Export saves all localStorage data to a JSON file. Import restores from a previously exported file.</p>
      </div>
    </div>

    <!-- App Info -->
    <div class="section-card">
      <div class="section-card-header"><h3>Application Info</h3></div>
      <div class="section-card-body text-sm text-gray-700 space-y-1">
        <p><strong>App:</strong> Dulag West District MOOE Dashboard</p>
        <p><strong>Bookkeeper:</strong> ${BOOKKEEPER} | ${BOOKKEEPER_TITLE}</p>
        <p><strong>District:</strong> ${DISTRICT} | ${DIVISION}</p>
        <p><strong>Hosting:</strong> GitHub Pages (free)</p>
        <p><strong>Database:</strong> ${isConnected ? 'Supabase (connected)' : 'Browser localStorage (offline)'}</p>
      </div>
    </div>
    `;
  },

  saveSupabase(e) {
    e.preventDefault();
    const url = document.getElementById('sb-url').value.trim();
    const key = document.getElementById('sb-key').value.trim();
    if (!url || !key) { App.toast('Please fill in both URL and Key.', 'error'); return; }
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    App.toast('Supabase credentials saved! Reloading…');
    setTimeout(() => location.reload(), 1000);
  },

  disconnectSupabase() {
    if (!confirm('Disconnect Supabase? The app will use local storage only.')) return;
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    App.toast('Disconnected. Reloading…');
    setTimeout(() => location.reload(), 1000);
  },

  copySchema() {
    const text = document.getElementById('schema-pre').textContent;
    navigator.clipboard.writeText(text).then(() => App.toast('SQL copied to clipboard!'));
  },

  exportData() {
    const backup = {};
    ['schools', 'disbursements', 'cdr_headers', 'cdr_entries', 'resources'].forEach(k => {
      try { backup[k] = JSON.parse(localStorage.getItem('dwd_' + k) || '[]'); } catch { backup[k] = []; }
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mooe-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Backup exported!');
  },

  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        let count = 0;
        ['schools', 'disbursements', 'cdr_headers', 'cdr_entries', 'resources'].forEach(k => {
          if (data[k]) { localStorage.setItem('dwd_' + k, JSON.stringify(data[k])); count++; }
        });
        App.toast(`Imported ${count} data tables. Reloading…`);
        setTimeout(() => location.reload(), 1200);
      } catch {
        App.toast('Invalid backup file.', 'error');
      }
    };
    reader.readAsText(file);
  },

  clearData() {
    if (!confirm('Clear ALL local data? This cannot be undone!')) return;
    if (!confirm('Are you sure? All schools, disbursements, CDRs, and resources will be deleted.')) return;
    ['schools', 'disbursements', 'cdr_headers', 'cdr_entries', 'resources', 'bank_recon'].forEach(k => {
      localStorage.removeItem('dwd_' + k);
    });
    App.toast('All data cleared.');
    App.navigate('dashboard');
  },

  schemaSql() {
    return `-- Dulag West District MOOE Dashboard
-- Run this in Supabase SQL Editor

-- Schools / Accountable Officers
create table if not exists schools (
  id text primary key,
  name text not null,
  short_name text,
  school_code text,
  school_head text,
  designation text,
  confirmation_expiry date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MOOE Disbursements
create table if not exists disbursements (
  id text primary key,
  school_id text references schools(id) on delete cascade,
  ada_no text,
  ada_date date,
  fund_type text,
  amount numeric(14,2) default 0,
  status text default 'pending',
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CDR Headers
create table if not exists cdr_headers (
  id text primary key,
  school_id text references schools(id) on delete cascade,
  year integer,
  quarter text,
  fund_type text,
  opening_balance numeric(14,2) default 0,
  entry_count integer default 0,
  created_at timestamptz default now()
);

-- CDR Entries
create table if not exists cdr_entries (
  id text primary key,
  cdr_id text references cdr_headers(id) on delete cascade,
  entry_date date,
  particulars text,
  uacs_code text,
  uacs_desc text,
  advances numeric(14,2) default 0,
  payment numeric(14,2) default 0,
  ref_no text,
  payee text,
  sort_order bigint,
  created_at timestamptz default now()
);

-- Resources (COA Circulars, DepEd Orders, etc.)
create table if not exists resources (
  id text primary key,
  title text not null,
  category text,
  url text,
  file_path text,
  description text,
  created_at timestamptz default now()
);

-- Enable Row Level Security and allow all operations (adjust as needed)
alter table schools enable row level security;
alter table disbursements enable row level security;
alter table cdr_headers enable row level security;
alter table cdr_entries enable row level security;
alter table resources enable row level security;

create policy "Allow all" on schools for all using (true) with check (true);
create policy "Allow all" on disbursements for all using (true) with check (true);
create policy "Allow all" on cdr_headers for all using (true) with check (true);
create policy "Allow all" on cdr_entries for all using (true) with check (true);
create policy "Allow all" on resources for all using (true) with check (true);`;
  },
};
