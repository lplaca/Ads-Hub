/* ═══════════════════════════════════════════════════════════════════════════
   Auth System — Login / Setup / Session
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Global Auth Helper ────────────────────────────────────────────────────────
window.Auth = {
  TOKEN_KEY: 'meta_auth_token',
  USER_KEY:  'meta_auth_user',

  getToken() { return localStorage.getItem(this.TOKEN_KEY) || ''; },
  getUser()  { try { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },
  isLoggedIn() { return !!this.getToken(); },
};

// ── Patch API to include auth token ──────────────────────────────────────────
// Override the global API client to include X-Auth-Token header
(function patchAPI() {
  const _orig = window.API;
  if (!_orig) return;
  const addHeaders = (opts) => {
    const token = Auth.getToken();
    if (!token) return opts;
    const headers = { ...(opts?.headers || {}), 'X-Auth-Token': token };
    return { ...opts, headers };
  };
  const withTimeout = (ms = 20000) => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  };
  window.API = {
    async get(path) {
      try {
        const r = await fetch(path, { ...addHeaders({}), signal: withTimeout() });
        if (r.status === 401) { Auth.clearSession(); location.reload(); return null; }
        return r.ok ? r.json() : null;
      } catch { return null; }
    },
    async post(path, body) {
      try {
        const r = await fetch(path, { ...addHeaders({ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }), signal: withTimeout() });
        if (r.status === 401) { Auth.clearSession(); location.reload(); return null; }
        return r.ok ? r.json() : null;
      } catch { return null; }
    },
    async put(path, body) {
      try {
        const r = await fetch(path, { ...addHeaders({ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }), signal: withTimeout() });
        if (r.status === 401) { Auth.clearSession(); location.reload(); return null; }
        return r.ok ? r.json() : null;
      } catch { return null; }
    },
    async del(path) {
      try {
        const r = await fetch(path, { ...addHeaders({ method:'DELETE' }), signal: withTimeout() });
        if (r.status === 401) { Auth.clearSession(); location.reload(); return null; }
        return r.ok ? r.json() : null;
      } catch { return null; }
    },
  };
})();


document.addEventListener('alpine:init', () => {

// ── AuthGate — wraps entire app ───────────────────────────────────────────────
Alpine.data('AuthGate', () => ({
  checked: false,
  authed:  false,
  mode:    'login',    // 'login' | 'setup'
  form:    { email: '', password: '', name: '' },
  loading: false,
  error:   '',

  async init() {
    const status = await fetch('/api/auth/status').then(r => r.json()).catch(() => null);
    if (!status) { this.mode = 'login'; this.checked = true; this.authed = false; return; }

    if (!status.has_users) {
      // No users at all — show setup
      this.mode = 'setup';
      this.checked = true;
      this.authed = false;
      return;
    }

    // Check if already logged in
    const token = Auth.getToken();
    if (token) {
      const me = await fetch('/api/auth/me', { headers: { 'X-Auth-Token': token } })
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (me) {
        this.authed = true;
        this.checked = true;
        return;
      }
      Auth.clearSession();
    }

    this.mode = 'login';
    this.checked = true;
    this.authed = false;
  },

  async submit() {
    this.loading = true;
    this.error = '';
    const path = this.mode === 'setup' ? '/api/auth/setup' : '/api/auth/login';
    const body = this.mode === 'setup'
      ? { email: this.form.email, password: this.form.password, name: this.form.name }
      : { email: this.form.email, password: this.form.password };
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { this.error = data.detail || 'Erro ao autenticar'; }
      else {
        Auth.setSession(data.token, data.user);
        this.authed = true;
      }
    } catch(e) {
      this.error = 'Erro de conexão';
    }
    this.loading = false;
  },

  renderLogin() {
    const isSetup = this.mode === 'setup';
    return `
    <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0a1628 0%, #0f172a 40%, #0d1f3c 100%);">
      <div class="w-full max-w-sm">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 8px 32px rgba(59,130,246,0.4);">
            <i class="fas fa-chart-line text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-white">Meta Ads</h1>
          <p class="text-blue-400 text-sm font-medium">Control Center</p>
        </div>

        <!-- Card -->
        <div class="rounded-2xl p-6 space-y-4" style="background:rgba(30,41,59,0.8); border:1px solid rgba(51,65,85,0.5); backdrop-filter:blur(20px);">
          <h2 class="text-lg font-bold text-white text-center">${isSetup ? 'Criar sua conta' : 'Entrar na plataforma'}</h2>
          ${isSetup ? '<p class="text-slate-400 text-xs text-center">Configure seu acesso pela primeira vez</p>' : ''}

          ${isSetup ? `
          <div>
            <label class="text-xs font-medium text-slate-400 block mb-1">Seu nome</label>
            <input type="text" x-model="form.name" placeholder="Ex: Lucas" autocomplete="name"
              class="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>` : ''}

          <div>
            <label class="text-xs font-medium text-slate-400 block mb-1">Email</label>
            <input type="email" x-model="form.email" placeholder="seu@email.com" autocomplete="email"
              class="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
              @keydown.enter="submit()" />
          </div>

          <div>
            <label class="text-xs font-medium text-slate-400 block mb-1">Senha</label>
            <input type="password" x-model="form.password" placeholder="••••••••" autocomplete="current-password"
              class="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
              @keydown.enter="submit()" />
          </div>

          ${`<div x-show="error" class="px-3 py-2 rounded-xl text-xs text-red-300" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);">
            <i class="fas fa-triangle-exclamation mr-1"></i>
            <span x-text="error"></span>
          </div>`}

          <button @click="submit()" :disabled="loading" class="w-full py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2" style="background:linear-gradient(135deg,#2563eb,#7c3aed); box-shadow:0 4px 20px rgba(59,130,246,0.3);">
            <i :class="loading ? 'fas fa-spinner animate-spin' : 'fas fa-arrow-right-to-bracket'"></i>
            <span>${isSetup ? (this.loading ? 'Criando...' : 'Criar conta e entrar') : (this.loading ? 'Entrando...' : 'Entrar')}</span>
          </button>
        </div>

        <p class="text-center text-xs text-slate-600 mt-4">Acesso privado — apenas para uso autorizado</p>
      </div>
    </div>`;
  },
}));


// ── ProjectSwitcher — shown in sidebar ───────────────────────────────────────
Alpine.data('ProjectSwitcher', () => ({
  projects: [],
  active: null,
  open: false,
  showModal: false,
  editId: null,
  form: { name: '', color: '#3b82f6' },
  saving: false,

  COLORS: ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'],

  async init() {
    await this.load();
    window.addEventListener('project-changed', () => this.load());
  },

  async load() {
    const [list, active] = await Promise.all([
      API.get('/api/projects'),
      API.get('/api/projects/active'),
    ]);
    if (list) this.projects = list;
    if (active) this.active = active;
  },

  async activate(pid) {
    await API.post(`/api/projects/${pid}/activate`, {});
    await this.load();
    window.dispatchEvent(new CustomEvent('project-changed'));
    window.dispatchEvent(new CustomEvent('page-refresh'));
    this.open = false;
  },

  openCreate() {
    this.editId = null;
    this.form = { name: '', color: '#3b82f6' };
    this.showModal = true;
  },

  openEdit(p) {
    this.editId = p.id;
    this.form = { name: p.name, color: p.color };
    this.showModal = true;
  },

  async save() {
    if (!this.form.name.trim()) return;
    this.saving = true;
    try {
      if (this.editId) {
        await API.put(`/api/projects/${this.editId}`, this.form);
      } else {
        await API.post('/api/projects', this.form);
      }
      this.showModal = false;
      this.form = { name: '', color: '#3b82f6' };
      await this.load();
      window.dispatchEvent(new CustomEvent('project-changed'));
      window.dispatchEvent(new CustomEvent('page-refresh'));
    } catch(e) {
      // silent fail — modal still closes
      this.showModal = false;
    } finally {
      this.saving = false;
    }
  },

  async remove(pid) {
    if (!confirm('Remover este projeto? As contas continuarão existindo.')) return;
    await API.del(`/api/projects/${pid}`);
    await this.load();
    window.dispatchEvent(new CustomEvent('project-changed'));
  },
}));


// ── UserMenu — dropdown in header ─────────────────────────────────────────────
Alpine.data('UserMenu', () => ({
  open: false,
  showProfile: false,
  form: { name: '', email: '', current_password: '', new_password: '' },
  saving: false,
  user: null,

  init() {
    this.user = Auth.getUser();
    if (this.user) this.form.name = this.user.name || '';
    if (this.user) this.form.email = this.user.email || '';
    window.addEventListener('auth-user-updated', () => {
      this.user = Auth.getUser();
    });
  },

  async saveProfile() {
    this.saving = true;
    const body = { name: this.form.name, email: this.form.email };
    if (this.form.new_password) {
      body.new_password = this.form.new_password;
      body.current_password = this.form.current_password;
    }
    const r = await API.put('/api/auth/me', body);
    if (r && r.ok) {
      const updated = { ...this.user, name: r.user.name, email: r.user.email };
      Auth.setSession(Auth.getToken(), updated);
      this.user = updated;
      window.dispatchEvent(new CustomEvent('auth-user-updated'));
      toast('success', 'Perfil atualizado!');
      this.showProfile = false;
      this.form.current_password = '';
      this.form.new_password = '';
    } else {
      toast('error', 'Erro ao salvar perfil');
    }
    this.saving = false;
  },

  async logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': Auth.getToken() },
      body: JSON.stringify({ token: Auth.getToken() }),
    }).catch(() => {});
    Auth.clearSession();
    location.reload();
  },

  initials() {
    const name = this.user?.name || this.user?.email || 'U';
    return name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  },
}));

}); // alpine:init
