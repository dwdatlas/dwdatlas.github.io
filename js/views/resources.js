// ============================================================
// RESOURCES VIEW
// ============================================================
const ResourcesView = {
  activeCategory: '',

  async render() {
    const isAdmin = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    return `
    <div class="page-header flex items-start justify-between flex-wrap gap-3">
      <div><h2>Resources</h2><p>COA Circulars, DepEd Orders, UACS reference, Forms & Templates</p></div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="ResourcesView.openForm()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Resource
      </button>` : ''}
    </div>

    <!-- Category tabs -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button class="btn ${!this.activeCategory ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="ResourcesView.setCategory('')">All</button>
      ${RESOURCE_CATEGORIES.map(c => `
      <button class="btn ${this.activeCategory === c.value ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="ResourcesView.setCategory('${c.value}')">${c.label}</button>
      `).join('')}
    </div>

    <!-- UACS Quick Reference (always shown if category is uacs_reference or all) -->
    ${!this.activeCategory || this.activeCategory === 'uacs_reference' ? '<div id="uacs-ref"></div>' : ''}

    <div id="resources-list">
      <div class="flex justify-center py-10"><div class="spinner"></div></div>
    </div>`;
  },

  afterRender() {
    if (!this.activeCategory || this.activeCategory === 'uacs_reference') this.loadUACSRef();
    this.loadList();
  },

  async loadUACSRef() {
    const el = document.getElementById('uacs-ref');
    if (!el) return;
    const isAdmin = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const { data } = await DB.getUACS();
    const codes = data || [];
    el.innerHTML = `
    <div class="section-card mb-4">
      <div class="section-card-header">
        <h3 class="flex items-center gap-2">UACS Object Codes Quick Reference <span class="badge cat-uacs">Reference</span></h3>
        ${isAdmin ? '<button class="btn btn-primary btn-sm" onclick="ResourcesView.openUACSForm()">+ Add Code</button>' : ''}
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>UACS Code</th><th>Account Description</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>
            ${codes.map(u => `
            <tr>
              <td class="font-mono">${u.code}</td>
              <td>${u.desc}</td>
              ${isAdmin ? `<td><div class="flex gap-1"><button class="btn btn-secondary btn-sm" onclick="ResourcesView.openUACSForm('${u.id}')">Edit</button><button class="btn btn-danger btn-sm" onclick="ResourcesView.deleteUACSCode('${u.id}')">Del</button></div></td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  async openUACSForm(id = null) {
    const { data } = await DB.getUACS();
    const rec = id ? (data || []).find(u => u.id === id) : null;
    const readonly = rec ? 'readonly style="background:#f3f4f6"' : '';
    App.openModal(rec ? 'Edit UACS Code' : 'Add UACS Code', `
    <form onsubmit="ResourcesView.saveUACSCode(event, '${id || ''}')">
      <div class="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label class="form-label">UACS Code *</label>
          <input class="form-input font-mono" name="code" value="${rec?.code || ''}" placeholder="e.g. 5020101000" required ${readonly} />
        </div>
        <div>
          <label class="form-label">Account Description *</label>
          <input class="form-input" name="desc" value="${rec?.desc || ''}" placeholder="e.g. Travelling Expenses-Local" required />
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${rec ? 'Update' : 'Add'}</button>
      </div>
    </form>`);
  },

  async saveUACSCode(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const code = fd.get('code').trim();
    const row = { id: id || code, code, desc: fd.get('desc').trim() };
    await DB.upsertUACS(row);
    App.closeModal();
    App.toast(id ? 'UACS code updated!' : 'UACS code added!');
    await this.loadUACSRef();
  },

  async deleteUACSCode(id) {
    if (!confirm('Delete this UACS code?')) return;
    await DB.deleteUACS(id);
    App.toast('UACS code deleted.');
    await this.loadUACSRef();
  },


  setCategory(cat) {
    this.activeCategory = cat;
    const vc = document.getElementById('view-container');
    if (vc) {
      this.render().then(async html => {
        vc.innerHTML = html;
        if (!cat || cat === 'uacs_reference') await this.loadUACSRef();
        await this.loadList();
      });
    }
  },

  async loadList() {
    const container = document.getElementById('resources-list');
    if (!container) return;
    const isAdmin = typeof Auth !== 'undefined' ? Auth.isAdmin() : false;
    const { data } = await DB.getResources(this.activeCategory ? { category: this.activeCategory } : {});
    const resources = data || [];

    if (resources.length === 0) {
      container.innerHTML = `<div class="section-card">${emptyState(isAdmin ? 'No resources yet. Click "Add Resource" to add documents and links.' : 'No resources found.')}</div>`;
      return;
    }

    // Group by category
    const grouped = {};
    resources.forEach(r => {
      const key = r.category || 'other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    container.innerHTML = Object.entries(grouped).map(([cat, items]) => {
      const catInfo = RESOURCE_CATEGORIES.find(c => c.value === cat) || { label: cat, css: 'badge' };
      return `
      <div class="section-card mb-4">
        <div class="section-card-header">
          <h3 class="flex items-center gap-2">
            <span class="badge ${catInfo.css}">${catInfo.label}</span>
            <span class="text-sm font-normal text-gray-500">${items.length} item(s)</span>
          </h3>
        </div>
        <div class="section-card-body p-0">
          ${items.map(r => `
          <div class="flex items-start justify-between px-5 py-3 border-b last:border-0 hover:bg-gray-50 gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-gray-800 text-sm">${r.title}</div>
              ${r.description ? `<div class="text-xs text-gray-500 mt-0.5">${r.description}</div>` : ''}
              ${r.url ? `<a href="${r.url}" target="_blank" class="text-xs text-blue-600 hover:underline mt-0.5 block truncate">${r.url}</a>` : ''}
              <div class="text-xs text-gray-400 mt-0.5">${formatDate(r.created_at)}</div>
            </div>
            <div class="flex gap-2 shrink-0">
              ${(r.resource_type === 'pdf' || r.has_file) ? `<button class="btn btn-primary btn-sm" onclick="ResourcesView.openPDF('${r.id}')">View PDF</button>` : ''}
              ${r.url ? `<a href="${r.url}" target="_blank" class="btn btn-secondary btn-sm">Open ↗</a>` : ''}
              ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="ResourcesView.openForm('${r.id}')">Edit</button>` : ''}
              ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="ResourcesView.deleteResource('${r.id}')">Del</button>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
  },

  async openForm(id = null) {
    let row = { title: '', category: 'deped_order', resource_type: 'link', url: '', description: '' };
    if (id) {
      const { data } = await DB.getResources();
      const found = (data || []).find(r => r.id === id);
      if (found) row = found;
    }
    App.openModal(id ? 'Edit Resource' : 'Add Resource', `
    <form onsubmit="ResourcesView.saveForm(event, '${id || ''}')">
      <div class="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label class="form-label">Title *</label>
          <input class="form-input" name="title" value="${row.title || ''}" placeholder="e.g. COA Circular 2012-001" required />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Category *</label>
            <select class="form-select" name="category" required>
              ${RESOURCE_CATEGORIES.map(c => `<option value="${c.value}" ${row.category === c.value ? 'selected':''}>${c.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Type</label>
            <select class="form-select" name="resource_type" id="res-type" onchange="ResourcesView.toggleFileInput(this.value)">
              <option value="link" ${row.resource_type === 'link' ? 'selected':''}>Link (URL / Google Drive)</option>
              <option value="pdf" ${row.resource_type === 'pdf' ? 'selected':''}>PDF Upload</option>
            </select>
          </div>
        </div>
        <div id="url-input">
          <label class="form-label" id="url-label">URL / Google Drive / Google Sheets Link</label>
          <input class="form-input" name="url" value="${row.url || ''}" placeholder="https://docs.google.com/..." />
          <p class="text-xs text-gray-400 mt-1" id="url-hint">Paste any Google Docs, Sheets, Drive, or web link here.</p>
        </div>
        <div id="file-input" class="hidden">
          <label class="form-label">Upload PDF File</label>
          <input class="form-input" type="file" name="pdf_file" accept=".pdf" />
          <p class="text-xs text-gray-400 mt-1">Max 3 MB. Stored directly in the app — no external service needed.</p>
          ${row.has_file ? `<p class="text-xs text-blue-600 mt-1">A PDF file is already stored. Upload a new one to replace it, or leave blank to keep the existing file.</p>` : ''}
        </div>
        <div>
          <label class="form-label">Description (optional)</label>
          <textarea class="form-input" name="description" rows="2" placeholder="Brief description...">${row.description || ''}</textarea>
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);
    // Set initial visibility
    this.toggleFileInput(row.resource_type || 'link');
  },

  toggleFileInput(type) {
    const urlDiv   = document.getElementById('url-input');
    const fileDiv  = document.getElementById('file-input');
    const urlLabel = document.getElementById('url-label');
    const urlHint  = document.getElementById('url-hint');
    if (!urlDiv || !fileDiv) return;
    fileDiv.classList.toggle('hidden', type !== 'pdf');
    if (type === 'pdf') {
      if (urlLabel) urlLabel.textContent = 'Or paste a PDF link (Google Drive, etc.)';
      if (urlHint)  urlHint.textContent  = 'Optional — use this if you cannot upload a file directly.';
    } else {
      if (urlLabel) urlLabel.textContent = 'URL / Google Drive / Google Sheets Link';
      if (urlHint)  urlHint.textContent  = 'Paste any Google Docs, Sheets, Drive, or web link here.';
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  async openPDF(id) {
    App.toast('Loading PDF…');
    const { data: base64, error } = await DB.getResourceFile(id);
    if (error || !base64) { App.toast('No PDF file stored for this resource.', 'error'); return; }
    try {
      const [header, data] = base64.split(',');
      const mime = header.split(':')[1].split(';')[0];
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { App.toast('Could not open PDF.', 'error'); }
  },

  async saveForm(e, id) {
    e.preventDefault();
    const fd  = new FormData(e.target);
    const type = fd.get('resource_type');
    const url  = fd.get('url') || '';
    const btn  = e.target.querySelector('button[type="submit"]');
    let file_path; // undefined = keep existing; null = no file; string = new base64

    if (type === 'pdf') {
      const file = fd.get('pdf_file');
      if (file && file.size > 0) {
        if (file.size > 3 * 1024 * 1024) {
          App.toast('File too large. Maximum PDF size is 3 MB.', 'error'); return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        try {
          file_path = await this.fileToBase64(file);
        } catch (err) {
          App.toast('Error reading file: ' + err.message, 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
          return;
        }
      }
      // If no new file selected, file_path stays undefined → existing file preserved
    }

    const row = {
      id: id || DB.newId(),
      title: fd.get('title'),
      category: fd.get('category'),
      resource_type: type,
      url,
      description: fd.get('description'),
      ...(file_path !== undefined && { file_path }),
    };
    const { error } = await DB.upsertResource(row);
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    if (error) { App.toast('Error: ' + (error?.message || error), 'error'); return; }
    App.closeModal();
    App.toast('Resource saved!');
    await this.loadList();
  },

  async deleteResource(id) {
    if (!confirm('Delete this resource?')) return;
    await DB.deleteResource(id);
    App.toast('Deleted.');
    await this.loadList();
  },
};
