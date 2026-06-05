// ============================================================
// AUTHENTICATION — simple username/password login
// Default: admin / mooe2024  (change in Setup → Change Password)
// Session stored in sessionStorage (clears on browser close)
// ============================================================
const Auth = {
  SESSION_KEY: 'dwd_session',
  CREDS_KEY: 'dwd_credentials',

  // Default credentials (used if none saved)
  _defaults: {
    username: 'admin',
    // SHA-256 of 'mooe2024'
    passwordHash: 'a1b72f1083f7a5bece8dc0c8d0e9576898c00f9e2fb2f98a86d1fa4c5e6f8b3d',
  },

  // Simple non-cryptographic hash for basic protection
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  },

  _getCreds() {
    try {
      const stored = localStorage.getItem(this.CREDS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { username: 'admin', passwordHash: this._hash('mooe2024') };
  },

  isLoggedIn() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  },

  login(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const creds = this._getCreds();
    const errEl = document.getElementById('login-error');

    if (username === creds.username && this._hash(password) === creds.passwordHash) {
      sessionStorage.setItem(this.SESSION_KEY, 'true');
      document.getElementById('login-screen').style.display = 'none';
      errEl.classList.add('hidden');
      // Init app after login
      if (typeof App !== 'undefined') App.init();
    } else {
      errEl.textContent = 'Incorrect username or password.';
      errEl.classList.remove('hidden');
      document.getElementById('login-password').value = '';
    }
  },

  logout() {
    if (!confirm('Sign out?')) return;
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  changeCredentials(newUsername, newPassword) {
    const creds = {
      username: newUsername.trim(),
      passwordHash: this._hash(newPassword),
    };
    localStorage.setItem(this.CREDS_KEY, JSON.stringify(creds));
  },

  // Called on page load — show login if not authenticated
  guard() {
    if (!this.isLoggedIn()) {
      document.getElementById('login-screen').style.display = 'flex';
    } else {
      document.getElementById('login-screen').style.display = 'none';
      // App.init() will be called by DOMContentLoaded in app.js
    }
  },
};

// Guard runs immediately when this script loads
document.addEventListener('DOMContentLoaded', () => Auth.guard());
