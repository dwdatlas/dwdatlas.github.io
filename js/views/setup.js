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

    <!-- User / School Accounts -->
    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3>School Accounts</h3>
        <button class="btn btn-primary btn-sm" onclick="SetupView.openAddUser()">+ Add School Account</button>
      </div>
      <div id="users-list" class="table-scroll">
        <div class="flex justify-center py-6"><div class="spinner"></div></div>
      </div>
      <div class="px-5 pb-4 border-t pt-3 bg-gray-50">
        <p class="text-xs text-gray-500 mb-2">After adding/removing accounts, export and send the file to your developer to publish the changes for all devices.</p>
        <button class="btn btn-secondary btn-sm" onclick="SetupView.exportUsers()">Export Users File</button>
      </div>
    </div>

    <!-- Fund Types -->
    <div class="section-card mb-4">
      <div class="section-card-header"><h3>Fund Types</h3></div>
      <div class="section-card-body border-b">
        <form id="fund-type-form" onsubmit="SetupView.addFundType(event)" class="flex gap-2 items-end flex-wrap">
          <div class="flex-1" style="min-width:200px">
            <label class="form-label">Fund Type Name *</label>
            <input id="ft-name" type="text" class="form-input" placeholder="e.g. 1st Quarter MOOE" required />
          </div>
          <div style="min-width:160px">
            <label class="form-label">Category *</label>
            <select id="ft-category" class="form-select">
              <option value="mooe">MOOE</option>
              <option value="special">Special Fund</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">+ Add</button>
        </form>
      </div>
      <div id="fund-types-list">
        <div class="flex justify-center py-6"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Change Password -->
    <div class="section-card mb-4">
      <div class="section-card-header"><h3>Change Login Credentials</h3></div>
      <div class="section-card-body">
        <form id="change-creds-form" onsubmit="SetupView.saveCredentials(event)" class="max-w-sm">
          <div class="mb-3">
            <label class="form-label">New Username</label>
            <input id="new-username" type="text" class="form-input" placeholder="Enter new username" required />
          </div>
          <div class="mb-3">
            <label class="form-label">New Password</label>
            <input id="new-password" type="password" class="form-input" placeholder="Enter new password" required minlength="6" />
          </div>
          <div class="mb-4">
            <label class="form-label">Confirm New Password</label>
            <input id="confirm-password" type="password" class="form-input" placeholder="Re-enter new password" required minlength="6" />
          </div>
          <button type="submit" class="btn btn-primary">Update Credentials</button>
        </form>
        <p class="text-xs text-gray-400 mt-2">Default login: username <strong>admin</strong> / password <strong>mooe2024</strong></p>
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

  async afterRender() {
    this.loadUsers();
    await this.loadFundTypes();
  },

  loadUsers() {
    const users = Auth.getUsers();
    const el = document.getElementById('users-list');
    if (!el) return;
    const schoolUsers = users.filter(u => u.role === 'school');
    if (!schoolUsers.length) {
      el.innerHTML = `<div class="px-6 py-6 text-sm text-gray-400 text-center">No school accounts yet. Click "+ Add School Account" to create one.</div>`;
      return;
    }
    el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Username</th><th>School</th><th>Role</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${schoolUsers.map(u => `
        <tr>
          <td class="font-mono text-sm">${u.username}</td>
          <td class="text-sm">${u.school_name || '—'}</td>
          <td><span class="badge badge-submitted">School</span></td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-secondary btn-sm" onclick="SetupView.openResetPassword('${u.id}','${u.username}')">Reset Password</button>
              <button class="btn btn-danger btn-sm" onclick="SetupView.deleteUser('${u.id}')">Delete</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  },

  async loadFundTypes() {
    const el = document.getElementById('fund-types-list');
    if (!el) return;
    const { data } = await DB.getFundTypes();
    const types = data || [];
    if (!types.length) {
      el.innerHTML = `<div class="px-6 py-4 text-sm text-gray-400 text-center">No fund types yet. Add one above.</div>`;
      return;
    }
    const mooe    = types.filter(t => t.category === 'mooe');
    const special = types.filter(t => t.category === 'special');
    const renderGroup = (label, items, badgeCss) => !items.length ? '' : `
      <div class="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b">${label}</div>
      ${items.map(t => `
      <div class="flex items-center justify-between px-5 py-2 border-b last:border-0 hover:bg-gray-50">
        <span class="text-sm">${t.name}</span>
        <div class="flex items-center gap-2">
          <span class="badge ${badgeCss} text-xs">${label}</span>
          <button class="btn btn-danger btn-sm" onclick="SetupView.deleteFundType('${t.id}')">Del</button>
        </div>
      </div>`).join('')}`;
    el.innerHTML = renderGroup('MOOE', mooe, 'badge-submitted') + renderGroup('Special Fund', special, 'badge-pending');
  },

  async addFundType(e) {
    e.preventDefault();
    const name = document.getElementById('ft-name').value.trim();
    const category = document.getElementById('ft-category').value;
    if (!name) return;
    await DB.upsertFundType({ name, category });
    document.getElementById('ft-name').value = '';
    App.toast('Fund type added!');
    await this.loadFundTypes();
  },

  async deleteFundType(id) {
    if (!confirm('Delete this fund type?')) return;
    await DB.deleteFundType(id);
    App.toast('Fund type deleted.');
    await this.loadFundTypes();
  },

  async openAddUser() {
    const { data: schools } = await DB.getSchools();
    const schools_ = schools || [];
    const html = `
    <form id="add-user-form" onsubmit="SetupView.saveUser(event)">
      <div class="grid grid-cols-1 gap-3 mb-3">
        <div>
          <label class="form-label">School *</label>
          <select id="u-school" class="form-select" required>
            <option value="">Select school…</option>
            ${schools_.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Username *</label>
          <input id="u-username" type="text" class="form-input" placeholder="e.g. alegre_es" required />
        </div>
        <div>
          <label class="form-label">Password *</label>
          <input id="u-password" type="password" class="form-input" placeholder="Min. 6 characters" required minlength="6" />
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Account</button>
      </div>
    </form>`;
    App.openModal('Add School Account', html);
  },

  saveUser(e) {
    e.preventDefault();
    const schoolEl = document.getElementById('u-school');
    const school_id = schoolEl.value;
    const school_name = schoolEl.options[schoolEl.selectedIndex]?.dataset?.name || '';
    const username = document.getElementById('u-username').value.trim();
    const password = document.getElementById('u-password').value;
    const { error } = Auth.addSchoolUser(username, password, school_id, school_name);
    if (error) { App.toast(error, 'error'); return; }
    App.closeModal();
    App.toast('School account created!');
    this.loadUsers();
  },

  openResetPassword(id, username) {
    const html = `
    <form onsubmit="SetupView.resetPassword(event,'${id}')">
      <p class="text-sm text-gray-600 mb-3">Reset password for <strong>${username}</strong></p>
      <div class="mb-4">
        <label class="form-label">New Password</label>
        <input id="reset-pw" type="password" class="form-input" required minlength="6" placeholder="Min. 6 characters" />
      </div>
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Reset Password</button>
      </div>
    </form>`;
    App.openModal('Reset Password', html);
  },

  resetPassword(e, id) {
    e.preventDefault();
    Auth.updateUserPassword(id, document.getElementById('reset-pw').value);
    App.closeModal();
    App.toast('Password reset!');
  },

  exportUsers() {
    const users = Auth.getUsers();
    const lines = users.map(u => `  ${JSON.stringify(u)},`).join('\n');
    const content = `// ============================================================\n// USERS DATA — committed to GitHub so all devices share accounts\n// Passwords are hashed — actual passwords never stored here\n// ============================================================\nconst USERS_DATA = [\n${lines}\n];\n`;
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-data.js';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('users-data.js downloaded! Send this file to your developer.');
  },

  deleteUser(id) {
    if (!confirm('Delete this school account?')) return;
    Auth.deleteUser(id);
    App.toast('Account deleted.');
    this.loadUsers();
  },

  saveCredentials(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    if (!username) { App.toast('Username cannot be empty.', 'error'); return; }
    if (password !== confirm) { App.toast('Passwords do not match.', 'error'); return; }
    if (password.length < 6) { App.toast('Password must be at least 6 characters.', 'error'); return; }
    Auth.changeCredentials(username, password);
    App.toast('Credentials updated! Use them on next login.');
    document.getElementById('change-creds-form').reset();
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
