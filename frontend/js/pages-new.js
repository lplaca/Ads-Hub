/* ═══════════════════════════════════════════════════════════════════════════
   Ads Hub — Páginas novas (pages-new.js)
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('alpine:init', () => {

// ── ProjectsPage ─────────────────────────────────────────────────────────────
Alpine.data('ProjectsPage', () => ({
  projects: [],
  loading: false,

  async init() {
    window.addEventListener('project-changed', () => this.load());
    window.addEventListener('page-refresh', () => this.load());
    await this.load();
  },

  async load() {
    this.loading = true;
    const data = await API.get('/api/projects');
    this.projects = data || [];
    this.loading = false;
  },

  openProject(pid) {
    window._activeProjectId = pid;
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'project-detail', projectId: pid } }));
  },

  newProject() {
    Alpine.store('projectModal').show({ onSave: () => this.load() });
  },

  editProject(p) {
    Alpine.store('projectModal').show({ editId: p.id, name: p.name, color: p.color, onSave: () => this.load() });
  },

  async removeProject(pid) {
    if (!confirm('Remover este projeto?')) return;
    await API.del('/api/projects/' + pid);
    await this.load();
  },

  statusColor(s) {
    return { active: '#22c55e', paused: '#f59e0b', archived: '#64748b' }[s] || '#64748b';
  },

  renderPage() {
    if (this.loading) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;

    const cards = this.projects.length === 0
      ? `<div class="col-span-full flex flex-col items-center justify-center py-20 text-center">
           <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.2);">
             <i class="fas fa-folder-open text-blue-400 text-2xl"></i>
           </div>
           <p class="font-semibold text-slate-300 mb-1">Nenhum projeto ainda</p>
           <p class="text-sm text-slate-500 mb-4">Crie seu primeiro projeto para começar</p>
           <button @click="newProject()" class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
             <i class="fas fa-plus mr-2"></i>Novo Projeto
           </button>
         </div>`
      : this.projects.map(p => `
          <div class="rounded-2xl p-5 cursor-pointer transition-all hover:border-slate-600 group"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="openProject('${p.id}')">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex-shrink-0" style="background:${p.color || '#3b82f6'};"></div>
                <div>
                  <p class="font-semibold text-white text-sm">${p.name}</p>
                  <p class="text-xs text-slate-500">${p.client_name || 'Sem cliente'}</p>
                </div>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="editProject(${JSON.stringify(p).replace(/"/g, '&quot;')})"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-all">
                  <i class="fas fa-pen text-xs"></i>
                </button>
                <button @click.stop="removeProject('${p.id}')"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <i class="fas fa-trash text-xs"></i>
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    style="background:${this.statusColor(p.status)}20; color:${this.statusColor(p.status)};">
                ${{ active: 'Ativo', paused: 'Pausado', archived: 'Arquivado' }[p.status] || 'Ativo'}
              </span>
              ${p.is_active ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium" style="background:rgba(59,130,246,0.15);color:#60a5fa;">Selecionado</span>' : ''}
            </div>
          </div>`).join('');

    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-white">Projetos</h2>
            <p class="text-sm text-slate-400">${this.projects.length} projeto(s) no total</p>
          </div>
          <button @click="newProject()"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
            <i class="fas fa-plus"></i> Novo Projeto
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${cards}
        </div>
      </div>`;
  },
}));


// ── ProjectDetailPage — workspace com abas ────────────────────────────────────
Alpine.data('ProjectDetailPage', () => ({
  projectId: null,
  project: null,
  activeTab: 'overview',
  loading: false,

  // dados por aba
  health: null,
  summary: null,
  products: [],
  accounts: [],
  allAccounts: [],        // todas as contas no DB (para vinculação)
  bms: [],
  alerts: [],
  tasks: [],
  rules: [],

  // drilldown de conta
  expandedAccountId: null,
  accountCampaigns: {},   // { accountId: [...campaigns] }
  loadingAccountId: null,
  showAllAccounts: false, // painel de vincular contas

  // produto form
  showProductForm: false,
  productForm: { name: '', description: '', sku: '', price: '', category: '', landing_url: '' },
  savingProduct: false,

  async init() {
    this.projectId = window._activeProjectId || null;
    if (this.projectId) await this.loadOverview();
    window.addEventListener('page-refresh', () => { if (this.projectId) this.loadTab(this.activeTab); });
  },

  async loadOverview() {
    this.loading = true;
    const [summary, health] = await Promise.all([
      API.get('/api/projects/' + this.projectId + '/summary'),
      API.get('/api/projects/' + this.projectId + '/health'),
    ]);
    this.summary = summary;
    this.health = health;
    this.project = summary?.project || null;
    this.alerts = summary?.alerts || [];
    this.tasks = summary?.tasks || [];
    this.loading = false;
  },

  async loadTab(tab) {
    this.activeTab = tab;
    this.expandedAccountId = null;
    this.accountCampaigns = {};
    if (tab === 'overview') { await this.loadOverview(); return; }
    this.loading = true;
    if (tab === 'products') {
      this.products = (await API.get('/api/products?project_id=' + this.projectId)) || [];
    } else if (tab === 'meta') {
      const [accounts, bms, rules, alerts] = await Promise.all([
        API.get('/api/projects/' + this.projectId + '/accounts'),
        API.get('/api/projects/' + this.projectId + '/bms'),
        API.get('/api/projects/' + this.projectId + '/rules'),
        API.get('/api/alerts?project_id=' + this.projectId),
      ]);
      this.accounts = accounts || [];
      this.bms = bms || [];
      this.rules = rules || [];
      this.alerts = alerts || [];
    } else if (tab === 'google') {
      // placeholder — Google Ads não integrado ainda
    }
    this.loading = false;
  },

  async toggleAccount(accountId) {
    if (this.expandedAccountId === accountId) {
      this.expandedAccountId = null;
      return;
    }
    this.expandedAccountId = accountId;
    if (!this.accountCampaigns[accountId]) {
      this.loadingAccountId = accountId;
      const camps = await API.get(
        '/api/projects/' + this.projectId + '/accounts/' + accountId + '/campaigns'
      );
      this.accountCampaigns[accountId] = camps || [];
      this.loadingAccountId = null;
    }
  },

  async loadAllAccounts() {
    this.showAllAccounts = !this.showAllAccounts;
    if (this.showAllAccounts && this.allAccounts.length === 0) {
      this.allAccounts = (await API.get('/api/projects/' + this.projectId + '/accounts/available')) || [];
    }
  },

  async assignAccount(accountId) {
    await API.post('/api/projects/' + this.projectId + '/accounts/' + accountId + '/assign');
    this.allAccounts = this.allAccounts.map(a => a.id === accountId ? { ...a, project_id: this.projectId } : a);
    this.accounts = (await API.get('/api/projects/' + this.projectId + '/accounts')) || [];
    toast('success', 'Conta vinculada!');
  },

  async unassignAccount(accountId) {
    await API.post('/api/projects/' + this.projectId + '/accounts/' + accountId + '/unassign');
    this.accounts = this.accounts.filter(a => a.id !== accountId);
    this.allAccounts = this.allAccounts.map(a => a.id === accountId ? { ...a, project_id: '' } : a);
    if (this.expandedAccountId === accountId) this.expandedAccountId = null;
    toast('success', 'Conta desvinculada');
  },

  async pauseCampaign(accountId, cid) {
    await API.post('/api/campaigns/' + cid + '/pause');
    toast('success', 'Campanha pausada');
    this.loadingAccountId = accountId;
    const camps = await API.get('/api/projects/' + this.projectId + '/accounts/' + accountId + '/campaigns');
    this.accountCampaigns[accountId] = camps || [];
    this.loadingAccountId = null;
  },

  async activateCampaign(accountId, cid) {
    await API.post('/api/campaigns/' + cid + '/activate');
    toast('success', 'Campanha ativada');
    this.loadingAccountId = accountId;
    const camps = await API.get('/api/projects/' + this.projectId + '/accounts/' + accountId + '/campaigns');
    this.accountCampaigns[accountId] = camps || [];
    this.loadingAccountId = null;
  },

  async saveProduct() {
    if (!this.productForm.name.trim()) { toast('warning', 'Nome obrigatório'); return; }
    this.savingProduct = true;
    await API.post('/api/products', { ...this.productForm, project_id: this.projectId });
    this.productForm = { name: '', description: '', sku: '', price: '', category: '', landing_url: '' };
    this.showProductForm = false;
    this.products = (await API.get('/api/products?project_id=' + this.projectId)) || [];
    toast('success', 'Produto criado!');
    this.savingProduct = false;
  },

  async deleteProduct(pid) {
    if (!confirm('Remover produto?')) return;
    await API.del('/api/products/' + pid);
    this.products = this.products.filter(p => p.id !== pid);
    toast('success', 'Produto removido');
  },

  fmtCurrency(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  fmtNum(v)      { return Number(v || 0).toLocaleString('pt-BR'); },
  fmtRoas(v)     { return Number(v || 0).toFixed(2) + 'x'; },
  fmtPct(v)      { return Number(v || 0).toFixed(2) + '%'; },

  healthColor(s) { return { healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444' }[s] || '#64748b'; },
  statusColor(s) { return { active: '#22c55e', paused: '#f59e0b', archived: '#64748b' }[s] || '#64748b'; },
  severityColor(s) { return { critical: '#ef4444', warning: '#f59e0b' }[s] || '#64748b'; },

  _tab(id, label, icon) {
    const active = this.activeTab === id;
    return `<button @click="loadTab('${id}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style="${active
                ? 'background:rgba(37,99,235,0.15); color:#60a5fa; border:1px solid rgba(37,99,235,0.3);'
                : 'color:#94a3b8; border:1px solid transparent;'}">
              <i class="${icon} text-xs"></i>${label}
            </button>`;
  },

  renderPage() {
    if (!this.project && !this.loading) return `<div class="p-8 text-center text-slate-500">Projeto não encontrado.</div>`;
    if (!this.project) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;

    const p = this.project;
    const hColor = this.health ? this.healthColor(this.health.status) : '#64748b';

    const tabs = `
      <div class="flex items-center gap-1.5 mb-6 flex-wrap">
        ${this._tab('overview',  'Visão Geral',  'fas fa-chart-pie')}
        ${this._tab('products',  'Produtos',     'fas fa-box')}
        ${this._tab('meta',      'Meta Ads',     'fab fa-meta')}
        ${this._tab('google',    'Google Ads',   'fab fa-google')}
      </div>`;

    const content = this.loading
      ? `<div class="py-12 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-xl"></i></div>`
      : this._renderTab();

    return `
      <div class="p-6 max-w-[1400px]">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
          <button @click="$dispatch('navigate',{page:'projects'})"
                  class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <i class="fas fa-arrow-left text-sm"></i>
          </button>
          <div class="w-10 h-10 rounded-xl flex-shrink-0" style="background:${p.color || '#3b82f6'};"></div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold text-white">${p.name}</h2>
            <p class="text-sm text-slate-400">${p.client_name || 'Sem cliente'}</p>
          </div>
          <span class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style="background:${hColor}15; color:${hColor}; border:1px solid ${hColor}30;">
            <i class="fas fa-heart-pulse"></i>
            Saúde: ${this.health?.score ?? '–'}
          </span>
        </div>
        ${tabs}
        ${content}
      </div>`;
  },

  _renderTab() {
    switch (this.activeTab) {
      case 'overview':      return this._tabOverview();
      case 'products':      return this._tabProducts();
      case 'meta':     return this._tabMeta();
      case 'google':   return this._tabGoogle();
      default:         return '';
    }
  },

  _tabOverview() {
    const hColor = this.health ? this.healthColor(this.health.status) : '#64748b';
    const hScore = this.health?.score ?? '–';
    const s = this.summary || {};

    const alertCards = (this.alerts || []).length === 0
      ? `<p class="text-slate-500 text-sm py-4 text-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Sem alertas ativos</p>`
      : (this.alerts).map(a => `
          <div class="flex items-start gap-3 py-3 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${this.severityColor(a.severity)};"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200 leading-snug">${a.message || a.rule_name || 'Alerta'}</p>
              <p class="text-xs text-slate-500 mt-0.5">${a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : ''}</p>
            </div>
          </div>`).join('');

    const taskCards = (this.tasks || []).length === 0
      ? `<p class="text-slate-500 text-sm py-4 text-center"><i class="fas fa-circle-check text-slate-600 mr-2"></i>Sem tarefas pendentes</p>`
      : (this.tasks).map(t => `
          <div class="flex items-center gap-3 py-2.5 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${{ high:'#ef4444',normal:'#64748b',low:'#22c55e' }[t.priority]||'#64748b'};"></div>
            <span class="text-sm text-slate-300 flex-1 truncate">${t.title}</span>
          </div>`).join('');

    return `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <p class="text-xs text-slate-500 mb-1">Saúde</p>
          <p class="text-2xl font-bold" style="color:${hColor};">${hScore}</p>
          <p class="text-xs mt-0.5 text-slate-500">/ 100</p>
        </div>
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <p class="text-xs text-slate-500 mb-1">Alertas</p>
          <p class="text-2xl font-bold text-white">${s.alert_count ?? 0}</p>
          <p class="text-xs text-slate-500 mt-0.5">ativos</p>
        </div>
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <p class="text-xs text-slate-500 mb-1">Tarefas</p>
          <p class="text-2xl font-bold text-white">${s.task_count ?? 0}</p>
          <p class="text-xs text-slate-500 mt-0.5">pendentes</p>
        </div>
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <p class="text-xs text-slate-500 mb-1">Contas</p>
          <p class="text-2xl font-bold text-white">${s.account_count ?? 0}</p>
          <p class="text-xs text-slate-500 mt-0.5">Meta Ads</p>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-3">
            <p class="font-semibold text-white text-sm"><i class="fas fa-triangle-exclamation text-amber-400 mr-2"></i>Alertas Recentes</p>
            <button @click="loadTab('meta')" class="text-xs text-blue-400 hover:text-blue-300">Ver no Meta</button>
          </div>
          ${alertCards}
        </div>
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-3">
            <p class="font-semibold text-white text-sm"><i class="fas fa-circle-check text-blue-400 mr-2"></i>Tarefas Pendentes</p>
            <button @click="$dispatch('navigate',{page:'tasks'})" class="text-xs text-blue-400 hover:text-blue-300">Ver todas</button>
          </div>
          ${taskCards}
        </div>
      </div>`;
  },

  _tabProducts() {
    const form = this.showProductForm ? `
      <div class="rounded-2xl p-5 mb-5" style="background:#1e293b; border:1px solid rgba(37,99,235,0.3);">
        <p class="font-semibold text-white text-sm mb-4"><i class="fas fa-plus text-blue-400 mr-2"></i>Novo Produto</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input x-model="productForm.name" type="text" placeholder="Nome do produto *"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none sm:col-span-2" />
          <input x-model="productForm.sku" type="text" placeholder="SKU / código"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none" />
          <input x-model="productForm.price" type="number" step="0.01" placeholder="Preço (R$)"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none" />
          <input x-model="productForm.category" type="text" placeholder="Categoria"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none" />
          <input x-model="productForm.landing_url" type="url" placeholder="URL da landing page"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none" />
          <textarea x-model="productForm.description" placeholder="Descrição (opcional)"
                    rows="2" class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none sm:col-span-2"></textarea>
        </div>
        <div class="flex gap-2">
          <button @click="saveProduct()" :disabled="savingProduct"
                  class="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
            <i x-show="savingProduct" class="fas fa-spinner animate-spin mr-1"></i>Salvar
          </button>
          <button @click="showProductForm=false; productForm={name:'',description:'',sku:'',price:'',category:'',landing_url:''}"
                  class="px-4 py-2 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-500 transition-all">Cancelar</button>
        </div>
      </div>` : '';

    const rows = this.products.length === 0
      ? `<div class="flex flex-col items-center py-12 text-center">
           <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.15);">
             <i class="fas fa-box text-blue-400"></i>
           </div>
           <p class="font-semibold text-slate-300 mb-1">Nenhum produto</p>
           <p class="text-sm text-slate-500 mb-4">Crie produtos manualmente ou importe via planilha</p>
         </div>`
      : `<div class="overflow-x-auto">
           <table class="w-full text-sm">
             <thead>
               <tr class="text-left text-xs text-slate-500 border-b" style="border-color:rgba(51,65,85,0.5);">
                 <th class="pb-3 pr-4 font-medium">Nome</th>
                 <th class="pb-3 pr-4 font-medium hidden sm:table-cell">SKU</th>
                 <th class="pb-3 pr-4 font-medium hidden md:table-cell">Categoria</th>
                 <th class="pb-3 pr-4 font-medium">Preço</th>
                 <th class="pb-3 pr-4 font-medium hidden lg:table-cell">Landing Page</th>
                 <th class="pb-3 font-medium text-right"></th>
               </tr>
             </thead>
             <tbody>
               ${this.products.map(prod => `
                 <tr class="border-b hover:bg-slate-800/30 transition-all group" style="border-color:rgba(51,65,85,0.3);">
                   <td class="py-3 pr-4">
                     <p class="text-slate-200 font-medium">${prod.name}</p>
                     ${prod.description ? `<p class="text-xs text-slate-500 truncate max-w-[180px]">${prod.description}</p>` : ''}
                   </td>
                   <td class="py-3 pr-4 text-slate-400 hidden sm:table-cell font-mono text-xs">${prod.sku || '—'}</td>
                   <td class="py-3 pr-4 hidden md:table-cell">
                     ${prod.category ? `<span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(59,130,246,0.1);color:#60a5fa;">${prod.category}</span>` : '<span class="text-slate-600">—</span>'}
                   </td>
                   <td class="py-3 pr-4 text-slate-200 font-medium">${prod.price ? 'R$ ' + Number(prod.price).toFixed(2) : '—'}</td>
                   <td class="py-3 pr-4 hidden lg:table-cell">
                     ${prod.landing_url
                       ? `<a href="${prod.landing_url}" target="_blank" class="text-xs text-blue-400 hover:underline truncate max-w-[180px] block">
                            <i class="fas fa-external-link-alt mr-1"></i>${prod.landing_url.replace(/^https?:\/\//, '')}
                          </a>`
                       : '<span class="text-slate-600 text-xs">—</span>'}
                   </td>
                   <td class="py-3 text-right">
                     <button @click="deleteProduct('${prod.id}')"
                             class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                       <i class="fas fa-trash text-xs"></i>
                     </button>
                   </td>
                 </tr>`).join('')}
             </tbody>
           </table>
         </div>`;

    return `
      <div class="space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-400">${this.products.length} produto(s)</p>
          <div class="flex gap-2">
            <button @click="showProductForm = !showProductForm"
                    class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white"
                    style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
              <i class="fas fa-plus"></i>Novo Produto
            </button>
            <button @click="$dispatch('navigate',{page:'importar'})"
                    class="px-3 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
              <i class="fas fa-file-import mr-1"></i>Importar
            </button>
          </div>
        </div>
        ${form}
        <!-- Tabela de produtos -->
        <div class="rounded-2xl overflow-hidden p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          ${rows}
        </div>
        <!-- Analytics placeholder -->
        ${this.products.length > 0 ? `
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);">
              <i class="fas fa-chart-line text-amber-400 text-sm"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-300">Análises por Produto — Em breve</p>
              <p class="text-xs text-slate-500">Vincule campanhas a produtos via UTM para ver ROAS, receita e conversões por produto.</p>
            </div>
          </div>
        </div>` : ''}
      </div>`;
  },

  _tabMeta() {
    // --- Contas de Anúncios com drilldown ---
    const accountsSection = (() => {
      if (this.accounts.length === 0) {
        return `<div class="py-6 text-center">
          <p class="text-slate-500 text-sm mb-3">Nenhuma conta vinculada a este projeto.</p>
          <button @click="loadAllAccounts()"
                  class="px-4 py-2 rounded-xl text-sm font-medium text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all">
            <i class="fas fa-link mr-1.5"></i>Vincular Contas
          </button>
        </div>`;
      }
      return this.accounts.map(a => {
        const isExpanded = this.expandedAccountId === a.id;
        const isLoading  = this.loadingAccountId === a.id;
        const camps = this.accountCampaigns[a.id] || [];

        const campaignRows = isLoading
          ? `<div class="py-4 text-center text-slate-500 text-sm"><i class="fas fa-spinner animate-spin mr-2"></i>Carregando campanhas...</div>`
          : camps.length === 0
            ? `<p class="text-slate-500 text-sm py-4 text-center">Nenhuma campanha encontrada para esta conta.</p>`
            : `<table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-slate-500 border-b" style="border-color:rgba(51,65,85,0.4);">
                    <th class="pb-2 font-medium">Campanha</th>
                    <th class="pb-2 font-medium text-right">Gasto</th>
                    <th class="pb-2 font-medium text-right hidden sm:table-cell">ROAS</th>
                    <th class="pb-2 font-medium text-right hidden md:table-cell">Impressões</th>
                    <th class="pb-2 font-medium text-right hidden md:table-cell">Cliques</th>
                    <th class="pb-2 font-medium text-right hidden lg:table-cell">CPC</th>
                    <th class="pb-2 font-medium text-center">Status</th>
                    <th class="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  ${camps.map(c => `
                    <tr class="border-b last:border-0 group hover:bg-slate-800/40 transition-colors" style="border-color:rgba(51,65,85,0.3);">
                      <td class="py-3 pr-3">
                        <p class="text-slate-200 font-medium truncate max-w-[200px]">${c.name}</p>
                        <p class="text-xs text-slate-500">${c.objective || ''}</p>
                      </td>
                      <td class="py-3 text-right text-slate-200 font-medium pr-3">${this.fmtCurrency(c.spend)}</td>
                      <td class="py-3 text-right pr-3 hidden sm:table-cell">
                        <span style="color:${Number(c.roas||0)>=2?'#22c55e':Number(c.roas||0)>=1?'#f59e0b':'#ef4444'}">
                          ${this.fmtRoas(c.roas)}
                        </span>
                      </td>
                      <td class="py-3 text-right text-slate-400 pr-3 hidden md:table-cell">${this.fmtNum(c.impressions)}</td>
                      <td class="py-3 text-right text-slate-400 pr-3 hidden md:table-cell">${this.fmtNum(c.clicks)}</td>
                      <td class="py-3 text-right text-slate-400 pr-3 hidden lg:table-cell">${this.fmtCurrency(c.cpc)}</td>
                      <td class="py-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                              style="background:${c.status==='active'?'rgba(34,197,94,0.12)':'rgba(100,116,139,0.12)'}; color:${c.status==='active'?'#22c55e':'#94a3b8'};">
                          ${c.status === 'active' ? 'Ativa' : 'Pausada'}
                        </span>
                      </td>
                      <td class="py-3 pl-2">
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          ${c.status === 'active'
                            ? `<button @click="pauseCampaign('${a.id}','${c.id}')" title="Pausar"
                                       class="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
                                 <i class="fas fa-pause text-xs"></i>
                               </button>`
                            : `<button @click="activateCampaign('${a.id}','${c.id}')" title="Ativar"
                                       class="p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-400/10 transition-all">
                                 <i class="fas fa-play text-xs"></i>
                               </button>`}
                        </div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>`;

        // Summary metrics for the account card
        const spendFmt  = this.fmtCurrency(a.spend || 0);
        const roasFmt   = this.fmtRoas(a.roas || 0);
        const impFmt    = this.fmtNum(a.impressions || 0);
        const clickFmt  = this.fmtNum(a.clicks || 0);

        return `
          <div class="rounded-2xl overflow-hidden" style="border:1px solid ${isExpanded?'rgba(37,99,235,0.4)':'rgba(51,65,85,0.5)'}; transition:border-color 0.2s;">
            <!-- Account header row -->
            <div class="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                 @click="toggleAccount('${a.id}')" style="background:#1e293b;">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style="background:rgba(24,119,242,0.1);border:1px solid rgba(24,119,242,0.2);">
                <i class="fab fa-meta text-blue-400 text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white font-semibold">${a.name}</p>
                <p class="text-xs text-slate-500">ID: ${a.account_id} · ${a.country || 'BR'}</p>
              </div>
              <!-- Métricas inline -->
              <div class="hidden sm:flex items-center gap-4 text-xs">
                <div class="text-right">
                  <p class="text-slate-400">Gasto 7d</p>
                  <p class="text-white font-medium">${spendFmt}</p>
                </div>
                <div class="text-right hidden md:block">
                  <p class="text-slate-400">ROAS</p>
                  <p style="color:${Number(a.roas||0)>=2?'#22c55e':Number(a.roas||0)>=1?'#f59e0b':'#ef4444'}; font-weight:600;">${roasFmt}</p>
                </div>
                <div class="text-right hidden lg:block">
                  <p class="text-slate-400">Impressões</p>
                  <p class="text-slate-300">${impFmt}</p>
                </div>
                <div class="text-right hidden lg:block">
                  <p class="text-slate-400">Cliques</p>
                  <p class="text-slate-300">${clickFmt}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 ml-2">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                      style="background:${a.status==='active'?'rgba(34,197,94,0.12)':'rgba(100,116,139,0.12)'}; color:${a.status==='active'?'#22c55e':'#94a3b8'};">
                  ${a.status === 'active' ? 'Ativa' : 'Pausada'}
                </span>
                <button @click.stop="unassignAccount('${a.id}')" title="Desvincular"
                        class="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <i class="fas fa-unlink text-xs"></i>
                </button>
                <i class="fas fa-chevron-${isExpanded?'up':'down'} text-xs text-slate-500 transition-transform"></i>
              </div>
            </div>
            <!-- Campaign drilldown -->
            ${isExpanded ? `
              <div class="border-t p-4 overflow-x-auto" style="border-color:rgba(51,65,85,0.4);background:rgba(15,23,42,0.6);">
                ${campaignRows}
              </div>` : ''}
          </div>`;
      }).join('');
    })();

    // --- All-accounts panel (for linking) ---
    const allAccountsPanel = this.showAllAccounts ? `
      <div class="rounded-2xl mt-3 p-4" style="background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.5);">
        <p class="text-sm font-semibold text-slate-300 mb-3"><i class="fas fa-list mr-2 text-slate-500"></i>Todas as contas disponíveis</p>
        ${this.allAccounts.length === 0
          ? `<p class="text-sm text-slate-500 text-center py-4">Nenhuma conta cadastrada. <button class="text-blue-400 hover:underline" @click="$dispatch('navigate',{page:'accounts'})">Adicionar conta</button></p>`
          : this.allAccounts.map(a => `
            <div class="flex items-center gap-3 py-2.5 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:rgba(24,119,242,0.1);">
                <i class="fab fa-meta text-blue-400 text-xs"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-200">${a.name}</p>
                <p class="text-xs text-slate-500">${a.account_id}</p>
              </div>
              ${a.project_id === this.projectId
                ? `<span class="text-xs text-green-400 px-2 py-0.5 rounded-full" style="background:rgba(34,197,94,0.1);">Vinculada</span>`
                : a.project_id && a.project_id !== ''
                  ? `<span class="text-xs text-amber-400 px-2 py-0.5 rounded-full" style="background:rgba(245,158,11,0.1);">Outro projeto</span>`
                  : `<button @click="assignAccount('${a.id}')"
                             class="px-3 py-1 rounded-lg text-xs font-medium text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all">
                       <i class="fas fa-link mr-1"></i>Vincular
                     </button>`}
            </div>`).join('')}
      </div>` : '';

    // --- BMs ---
    const bmRows = this.bms.length === 0
      ? `<p class="text-slate-500 text-sm py-3 text-center">Nenhum BM vinculado. <button class="text-blue-400 hover:underline" @click="$dispatch('navigate',{page:'bm'})">Gerenciar BMs</button></p>`
      : this.bms.map(bm => `
          <div class="flex items-center gap-3 py-3 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:rgba(24,119,242,0.1);">
              <i class="fas fa-building text-blue-400 text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200">${bm.name}</p>
              <p class="text-xs text-slate-500">ID: ${bm.bm_id}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" style="background:${bm.status==='connected'?'#22c55e':'#ef4444'};"></span>
              <span class="text-xs text-slate-500">${bm.status==='connected'?'Conectado':'Desconectado'}</span>
            </div>
          </div>`).join('');

    // --- Alertas ---
    const alertRows = this.alerts.length === 0
      ? `<p class="text-slate-500 text-sm py-3 text-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Sem alertas ativos</p>`
      : this.alerts.slice(0, 6).map(a => `
          <div class="flex items-start gap-3 py-3 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${this.severityColor(a.severity)};"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200 leading-snug">${a.message || a.rule_name || 'Alerta'}</p>
              <p class="text-xs text-slate-500">${a.campaign_name || ''}</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style="background:${this.severityColor(a.severity)}15; color:${this.severityColor(a.severity)};">
              ${a.severity}
            </span>
          </div>`).join('');

    // --- Regras ---
    const ruleRows = this.rules.length === 0
      ? `<p class="text-slate-500 text-sm py-3 text-center">Nenhuma regra criada ainda. <button class="text-blue-400 hover:underline" @click="$dispatch('navigate',{page:'rules'})">Criar regra</button></p>`
      : this.rules.slice(0, 5).map(r => `
          <div class="flex items-center gap-3 py-2.5 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${r.enabled ? '#22c55e' : '#64748b'};"></div>
            <p class="text-sm text-slate-300 flex-1 truncate">${r.name}</p>
            <span class="text-xs text-slate-500">${r.trigger_count || 0} disparos</span>
            <span class="text-xs px-2 py-0.5 rounded-full"
                  style="background:${r.enabled?'rgba(34,197,94,0.1)':'rgba(100,116,139,0.1)'}; color:${r.enabled?'#22c55e':'#64748b'};">
              ${r.enabled ? 'Ativa' : 'Pausada'}
            </span>
          </div>`).join('');

    return `
      <div class="space-y-5">

        <!-- ① Contas de Anúncios -->
        <div class="rounded-2xl overflow-hidden" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color:rgba(51,65,85,0.5);">
            <p class="font-semibold text-white text-sm">
              <i class="fab fa-meta text-blue-400 mr-2"></i>Contas de Anúncios
              <span class="ml-2 text-xs text-slate-500">${this.accounts.length} vinculada(s)</span>
            </p>
            <div class="flex items-center gap-2">
              <button @click="loadTab('meta')" title="Atualizar métricas"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                <i class="fas fa-rotate-right text-xs"></i>
              </button>
              <button @click="loadAllAccounts()"
                      class="px-3 py-1.5 rounded-xl text-xs font-medium text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all">
                <i class="fas fa-link mr-1"></i>Vincular conta
              </button>
            </div>
          </div>
          <div class="divide-y" style="divide-color:transparent;">
            <div class="p-4 space-y-3">${accountsSection}</div>
            ${allAccountsPanel}
          </div>
        </div>

        <!-- ② Business Managers -->
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-4">
            <p class="font-semibold text-white text-sm"><i class="fas fa-building text-slate-400 mr-2"></i>Business Managers</p>
            <button @click="$dispatch('navigate',{page:'bm'})" class="text-xs text-blue-400 hover:text-blue-300">Gerenciar</button>
          </div>
          ${bmRows}
        </div>

        <!-- ③ Alertas Meta -->
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-4">
            <p class="font-semibold text-white text-sm">
              <i class="fas fa-triangle-exclamation text-amber-400 mr-2"></i>Alertas
              ${this.alerts.length > 0 ? `<span class="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold text-amber-400" style="background:rgba(245,158,11,0.15);">${this.alerts.length}</span>` : ''}
            </p>
            <button @click="$dispatch('navigate',{page:'alerts'})" class="text-xs text-blue-400 hover:text-blue-300">Ver todos</button>
          </div>
          ${alertRows}
        </div>

        <!-- ④ Regras de Automação -->
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-4">
            <p class="font-semibold text-white text-sm">
              <i class="fas fa-shield-halved text-purple-400 mr-2"></i>Regras
              <span class="ml-1 text-xs text-slate-500">${(this.rules||[]).filter(r=>r.enabled).length} ativas</span>
            </p>
            <button @click="$dispatch('navigate',{page:'rules'})" class="text-xs text-blue-400 hover:text-blue-300">Gerenciar</button>
          </div>
          ${ruleRows}
        </div>

        <!-- ⑤ Atalhos rápidos Meta -->
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <p class="font-semibold text-white text-sm mb-4"><i class="fas fa-bolt text-yellow-400 mr-2"></i>Ações Meta Ads</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button @click="$dispatch('navigate',{page:'agent'})"
                    class="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-purple-500/40 hover:bg-purple-500/5"
                    style="border-color:rgba(51,65,85,0.5);">
              <i class="fas fa-robot text-purple-400 text-lg"></i>
              <span class="text-xs text-slate-300 font-medium">Gestor IA</span>
            </button>
            <button @click="$dispatch('navigate',{page:'reports'})"
                    class="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
                    style="border-color:rgba(51,65,85,0.5);">
              <i class="fas fa-chart-line text-blue-400 text-lg"></i>
              <span class="text-xs text-slate-300 font-medium">Análises</span>
            </button>
            <button @click="$dispatch('navigate',{page:'quickactions'})"
                    class="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-amber-500/40 hover:bg-amber-500/5"
                    style="border-color:rgba(51,65,85,0.5);">
              <i class="fas fa-wand-magic-sparkles text-amber-400 text-lg"></i>
              <span class="text-xs text-slate-300 font-medium">Ações em Massa</span>
            </button>
            <button @click="$dispatch('navigate',{page:'importar'})"
                    class="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-green-500/40 hover:bg-green-500/5"
                    style="border-color:rgba(51,65,85,0.5);">
              <i class="fas fa-file-import text-green-400 text-lg"></i>
              <span class="text-xs text-slate-300 font-medium">Importar Dados</span>
            </button>
          </div>
        </div>

      </div>`;
  },

  _tabGoogle() {
    return `
      <div class="space-y-4">
        <!-- Placeholder principal -->
        <div class="rounded-2xl p-10 flex flex-col items-center text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style="background:rgba(66,133,244,0.08);border:1px solid rgba(66,133,244,0.2);">
            <i class="fab fa-google text-2xl" style="color:#4285f4;"></i>
          </div>
          <p class="font-semibold text-slate-300 mb-2">Google Ads — Em desenvolvimento</p>
          <p class="text-sm text-slate-500 max-w-sm">Em breve você poderá gerenciar contas, campanhas, alertas e análises do Google Ads diretamente aqui.</p>
        </div>
        <!-- Prévia das seções futuras -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${['Contas Google', 'Campanhas', 'Alertas Google', 'Análises'].map((label, i) => `
            <div class="rounded-2xl p-4 opacity-40 text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
              <i class="${['fas fa-user-circle','fas fa-layer-group','fas fa-triangle-exclamation','fas fa-chart-bar'][i]} text-slate-500 text-xl mb-2 block"></i>
              <p class="text-xs text-slate-500">${label}</p>
            </div>`).join('')}
        </div>
      </div>`;
  },
}));


// ── TasksPage ────────────────────────────────────────────────────────────────
Alpine.data('TasksPage', () => ({
  tasks: [],
  projects: [],
  loading: false,
  filterProject: '',
  filterStatus: 'open',
  showForm: false,
  form: { title: '', project_id: '', priority: 'normal', due_date: '', description: '' },
  saving: false,

  async init() {
    window.addEventListener('page-refresh', () => this.load());
    await this.load();
  },

  async load() {
    this.loading = true;
    const [tasks, projects] = await Promise.all([
      API.get('/api/tasks'),
      API.get('/api/projects'),
    ]);
    this.tasks = tasks || [];
    this.projects = projects || [];
    this.loading = false;
  },

  get filtered() {
    return this.tasks.filter(t => {
      if (this.filterStatus && t.status !== this.filterStatus) return false;
      if (this.filterProject && t.project_id !== this.filterProject) return false;
      return true;
    });
  },

  async createTask() {
    if (!this.form.title.trim()) { toast('warning', 'Título obrigatório'); return; }
    this.saving = true;
    await API.post('/api/tasks', this.form);
    this.form = { title: '', project_id: '', priority: 'normal', due_date: '', description: '' };
    this.showForm = false;
    await this.load();
    toast('success', 'Tarefa criada!');
    this.saving = false;
  },

  async completeTask(tid) {
    await API.post('/api/tasks/' + tid + '/complete', {});
    await this.load();
  },

  async deleteTask(tid) {
    await API.del('/api/tasks/' + tid);
    await this.load();
  },

  projectName(pid) {
    return this.projects.find(p => p.id === pid)?.name || '';
  },

  priorityColor(p) {
    return { high: '#ef4444', normal: '#64748b', low: '#22c55e' }[p] || '#64748b';
  },

  originBadge(origin) {
    const map = {
      'rule-engine': { label: 'Regra', color: '#ef4444' },
      'ai-agent':    { label: 'IA',    color: '#a855f7' },
      'ai-idea':     { label: 'Ideia', color: '#f59e0b' },
      'alert':       { label: 'Alerta',color: '#f97316' },
      'platform':    { label: 'Manual',color: '#64748b' },
    };
    const b = map[origin] || map['platform'];
    return `<span class="px-1.5 py-0.5 rounded text-xs font-medium" style="background:${b.color}15; color:${b.color};">${b.label}</span>`;
  },

  renderPage() {
    if (this.loading) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;

    const projectOpts = this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    const formHtml = this.showForm ? `
      <div class="rounded-2xl p-5 mb-4" style="background:#1e293b; border:1px solid rgba(37,99,235,0.3);">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input x-model="form.title" type="text" placeholder="Título da tarefa *"
                 @keydown.enter="createTask()"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none sm:col-span-2" />
          <select x-model="form.project_id" class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="">Sem projeto</option>${projectOpts}
          </select>
          <select x-model="form.priority" class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="high">Alta prioridade</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
          <input x-model="form.due_date" type="date"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none" />
        </div>
        <div class="flex gap-2">
          <button @click="createTask()" :disabled="saving"
                  class="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
            <i x-show="saving" class="fas fa-spinner animate-spin mr-1"></i>Salvar
          </button>
          <button @click="showForm=false" class="px-4 py-2 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-500 transition-all">Cancelar</button>
        </div>
      </div>` : '';

    const rows = this.filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-circle-check"></i></div>
           <p class="font-semibold text-slate-300 mb-1">Nenhuma tarefa encontrada</p>
           <p class="text-sm text-slate-500 mb-4">Crie sua primeira tarefa ou ajuste os filtros</p></div>`
      : this.filtered.map(t => `
          <div class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-slate-800/40 group"
               style="border-bottom:1px solid rgba(51,65,85,0.3);">
            <button @click="completeTask('${t.id}')"
                    class="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-green-500 flex-shrink-0 transition-all"></button>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200 truncate">${t.title}</p>
              ${t.project_id ? `<p class="text-xs text-slate-500">${this.projectName(t.project_id)}</p>` : ''}
            </div>
            ${this.originBadge(t.origin)}
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${this.priorityColor(t.priority)};"></span>
            ${t.due_date ? `<span class="text-xs text-slate-500 hidden sm:block">${t.due_date}</span>` : ''}
            <button @click="deleteTask('${t.id}')"
                    class="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-600 hover:text-red-400 transition-all">
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>`).join('');

    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-bold text-white">Tarefas</h2>
            <p class="text-sm text-slate-400">${this.filtered.length} de ${this.tasks.length} tarefa(s)</p>
          </div>
          <button @click="showForm = !showForm"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style="background:linear-gradient(135deg,#2563eb,#3b82f6);">
            <i class="fas fa-plus"></i> Nova Tarefa
          </button>
        </div>
        ${formHtml}
        <div class="flex gap-2 mb-4 flex-wrap">
          <select x-model="filterStatus" class="px-3 py-1.5 rounded-xl text-xs text-slate-300 bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="open">Abertas</option>
            <option value="done">Concluídas</option>
            <option value="">Todas</option>
          </select>
          <select x-model="filterProject" class="px-3 py-1.5 rounded-xl text-xs text-slate-300 bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="">Todos os projetos</option>${projectOpts}
          </select>
        </div>
        <div class="rounded-2xl overflow-hidden" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          ${rows}
        </div>
      </div>`;
  },
}));


// ── IntegrationsPage — ferramentas externas (Notion/ClickUp/etc.) ─────────────
Alpine.data('IntegrationsPage', () => ({
  health: null,
  loading: false,

  async init() {
    await this.load();
  },

  async load() {
    this.loading = true;
    this.health = await API.get('/api/health');
    this.loading = false;
  },

  renderPage() {
    return `
      <div class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-bold text-white">Integrações Externas</h2>
          <p class="text-sm text-slate-400">Conecte o Ads Hub com ferramentas de gestão</p>
        </div>

        <!-- Ferramentas de gestão -->
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ferramentas de Gestão</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          ${this._card('Notion', 'fas fa-n', '#ffffff', 'notion',
            'Sincronize análises, produtos e resultados com bases Notion por projeto.',
            'Configurar por projeto →', 'project-detail')}
          ${this._card('ClickUp', 'fas fa-circle-check', '#7b68ee', 'clickup',
            'Importe tarefas do ClickUp e exporte decisões do Gestor IA.',
            'Configurar por projeto →', 'project-detail')}
          ${this._card('Google Sheets', 'fas fa-table', '#34a853', 'sheets',
            'Importe produtos via planilha Google Sheets e lance campanhas.',
            'Ir para Lançador →', 'importar')}
        </div>

        <!-- Plataformas de mídia -->
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Plataformas de Mídia</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${this._card('Meta Ads', 'fab fa-meta', '#1877f2', 'meta',
            'Gerencie Business Managers, contas de anúncios e campanhas.',
            'Gerenciar tokens →', 'connections')}
          ${this._card('Google Ads', 'fab fa-google', '#4285f4', 'google',
            'Integração com Google Ads — em desenvolvimento.',
            'Em breve', null)}
          ${this._card('TikTok Ads', 'fab fa-tiktok', '#000000', 'tiktok',
            'Integração com TikTok Ads — em desenvolvimento.',
            'Em breve', null)}
        </div>
      </div>`;
  },

  _card(name, icon, color, key, desc, action, targetPage) {
    const health = this.health;
    let statusLabel = 'Não configurado', statusColor = '#64748b';
    if (key === 'meta' && health?.meta_bms?.length > 0) {
      const ok = health.meta_bms.every(b => b.ok);
      statusLabel = ok ? `${health.meta_bms.length} BM(s) conectado(s)` : 'Erro em algum token';
      statusColor = ok ? '#22c55e' : '#ef4444';
    } else if (key === 'notion' && health?.notion) {
      statusLabel = health.notion.ok ? 'Conectado' : 'Token inválido';
      statusColor = health.notion.ok ? '#22c55e' : '#ef4444';
    } else if (key === 'clickup' && health?.clickup) {
      statusLabel = health.clickup.ok ? 'Conectado' : 'Token inválido';
      statusColor = health.clickup.ok ? '#22c55e' : '#ef4444';
    }

    const btn = targetPage
      ? `<button @click="$dispatch('navigate',{page:'${targetPage}'})"
                 class="mt-4 w-full px-3 py-2 rounded-xl text-xs text-center text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white transition-all">
           ${action}
         </button>`
      : `<div class="mt-4 px-3 py-2 rounded-xl text-xs text-center text-slate-600 border border-slate-800">
           ${action}
         </div>`;

    return `
      <div class="rounded-2xl p-5 flex flex-col" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style="background:${color}18; border:1px solid ${color}25;">
            <i class="${icon} text-sm" style="color:${color};"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white text-sm">${name}</p>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${statusColor};"></span>
              <span class="text-xs text-slate-400">${statusLabel}</span>
            </div>
          </div>
        </div>
        <p class="text-xs text-slate-500 flex-1">${desc}</p>
        ${btn}
      </div>`;
  },
}));


// ── IntelligencePage ─────────────────────────────────────────────────────────
Alpine.data('IntelligencePage', () => ({
  projects: [],
  selectedProject: '',
  risk: null,
  forecast: null,
  loading: false,

  async init() {
    const data = await API.get('/api/projects');
    this.projects = data || [];
    if (this.projects.length > 0) {
      this.selectedProject = this.projects.find(p => p.is_active)?.id || this.projects[0].id;
      await this.loadProject();
    }
  },

  async loadProject() {
    if (!this.selectedProject) return;
    this.loading = true;
    const [risk, forecast] = await Promise.all([
      API.get('/api/intelligence/risk/' + this.selectedProject),
      API.get('/api/intelligence/forecast/' + this.selectedProject + '?metric=spend'),
    ]);
    this.risk = risk;
    this.forecast = forecast;
    this.loading = false;
  },

  riskColor(level) { return { low: '#22c55e', warning: '#f59e0b', critical: '#ef4444' }[level] || '#64748b'; },
  riskLabel(level) { return { low: 'Baixo', warning: 'Médio', critical: 'Alto' }[level] || '-'; },

  renderPage() {
    const projectOpts = this.projects.map(p =>
      `<option value="${p.id}" ${p.id === this.selectedProject ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const riskCard = this.risk ? (() => {
      const color = this.riskColor(this.risk.level);
      return `
        <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="flex items-center justify-between mb-4">
            <p class="font-semibold text-white text-sm"><i class="fas fa-shield-halved mr-2" style="color:${color};"></i>Score de Risco</p>
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold" style="background:${color}20; color:${color};">${this.riskLabel(this.risk.level)}</span>
          </div>
          <div class="flex items-end gap-3 mb-4">
            <p class="text-4xl font-bold" style="color:${color};">${this.risk.score ?? '-'}</p>
            <p class="text-slate-500 text-sm mb-1">/100</p>
          </div>
          <div class="w-full rounded-full h-2 mb-4" style="background:rgba(51,65,85,0.6);">
            <div class="h-2 rounded-full" style="width:${this.risk.score ?? 0}%; background:${color};"></div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Alertas críticos</span>
              <span class="text-white font-medium">${this.risk.factors?.critical_alerts ?? 0}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Alertas de atenção</span>
              <span class="text-white font-medium">${this.risk.factors?.warning_alerts ?? 0}</span>
            </div>
          </div>
        </div>`;
    })() : '';

    const forecastCard = this.forecast ? `
      <div class="rounded-2xl p-5" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
        <p class="font-semibold text-white text-sm mb-4"><i class="fas fa-chart-line text-blue-400 mr-2"></i>Forecast de Investimento</p>
        ${!this.forecast.has_enough_data ? `
          <div class="flex flex-col items-center py-6 text-center">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.15);">
              <i class="fas fa-hourglass-half text-blue-400"></i>
            </div>
            <p class="text-slate-300 text-sm font-medium mb-1">Dados insuficientes</p>
            <p class="text-xs text-slate-500 max-w-xs">${this.forecast.message}</p>
          </div>` : `<p class="text-slate-400 text-sm">Forecast disponível.</p>`}
      </div>` : '';

    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-white">Inteligência</h2>
            <p class="text-sm text-slate-400">Score de risco e forecast por projeto</p>
          </div>
          <select x-model="selectedProject" @change="loadProject()"
                  class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none">
            ${projectOpts}
          </select>
        </div>
        ${this.loading ? '<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>' : `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          ${riskCard}${forecastCard}
        </div>
        <div class="flex gap-2">
          <button @click="$dispatch('navigate',{page:'analysis'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-chart-bar mr-2"></i>Análise Profunda
          </button>
          <button @click="$dispatch('navigate',{page:'intel'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-globe mr-2"></i>Pesquisa Web
          </button>
        </div>`}
      </div>`;
  },
}));


// ── AutomationPage ───────────────────────────────────────────────────────────
Alpine.data('AutomationPage', () => ({
  async init() {},
  renderPage() {
    return `
      <div class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-bold text-white">Automação</h2>
          <p class="text-sm text-slate-400">Regras, lançador e jobs automáticos</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="$dispatch('navigate',{page:'rules'})">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);">
              <i class="fas fa-shield-halved text-purple-400"></i>
            </div>
            <p class="font-semibold text-white text-sm mb-1">Regras de Automação</p>
            <p class="text-xs text-slate-500">Condições e ações automáticas para suas campanhas</p>
          </div>
          <div class="rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="$dispatch('navigate',{page:'importar'})">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);">
              <i class="fas fa-rocket text-green-400"></i>
            </div>
            <p class="font-semibold text-white text-sm mb-1">Lançador de Campanhas</p>
            <p class="text-xs text-slate-500">Importe produtos e lance campanhas com 1 clique</p>
          </div>
          <div class="rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="$dispatch('navigate',{page:'sync'})">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);">
              <i class="fas fa-arrows-rotate text-cyan-400"></i>
            </div>
            <p class="font-semibold text-white text-sm mb-1">Sync de Trabalho</p>
            <p class="text-xs text-slate-500">Registre sessões e publique no ClickUp & Notion</p>
          </div>
          <div class="rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="$dispatch('navigate',{page:'quickactions'})">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);">
              <i class="fas fa-bolt text-amber-400"></i>
            </div>
            <p class="font-semibold text-white text-sm mb-1">Ações Rápidas</p>
            <p class="text-xs text-slate-500">Pause ou ative campanhas em massa</p>
          </div>
          <div class="rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all"
               style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);"
               @click="$dispatch('navigate',{page:'bm'})">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);">
              <i class="fas fa-building text-blue-400"></i>
            </div>
            <p class="font-semibold text-white text-sm mb-1">Business Managers</p>
            <p class="text-xs text-slate-500">Gerencie seus BMs e contas conectadas</p>
          </div>
        </div>
      </div>`;
  },
}));


// ── Produtos (top-level) ──────────────────────────────────────────────────────
Alpine.data('ProductsTopPage', () => ({
  projects: [], products: [], activeProject: null, loading: false,
  async init() {
    this.loading = true;
    window.addEventListener('project-changed', () => this.load());
    window.addEventListener('page-refresh', () => this.load());
    await this.load();
  },
  async load() {
    this.loading = true;
    const [projects, products] = await Promise.all([API.get('/api/projects'), API.get('/api/products')]);
    this.projects = projects || [];
    this.products = products || [];
    this.activeProject = this.projects.find(p => p.is_active) || null;
    this.loading = false;
  },
  renderPage() {
    if (this.loading) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;
    const filtered = this.activeProject ? this.products.filter(p => p.project_id === this.activeProject.id) : this.products;
    const rows = filtered.length === 0
      ? `<div class="py-12 text-center text-slate-500">
           <i class="fas fa-box text-3xl mb-3 block opacity-30"></i>
           <p class="text-sm mb-3">Nenhum produto encontrado.</p>
           <button @click="$dispatch('navigate',{page:'importar'})" class="px-4 py-2 rounded-xl text-sm text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-all">
             <i class="fas fa-file-import mr-1.5"></i>Importar produtos
           </button>
         </div>`
      : `<div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-slate-500 border-b" style="border-color:rgba(51,65,85,0.5);">
            <th class="pb-3 pr-4 font-medium">Nome</th>
            <th class="pb-3 pr-4 font-medium hidden sm:table-cell">SKU</th>
            <th class="pb-3 pr-4 font-medium hidden md:table-cell">Categoria</th>
            <th class="pb-3 pr-4 font-medium">Preço</th>
            <th class="pb-3 font-medium hidden lg:table-cell">Landing</th>
          </tr></thead>
          <tbody>${filtered.map(p => `
            <tr class="border-b hover:bg-slate-800/30" style="border-color:rgba(51,65,85,0.3);">
              <td class="py-3 pr-4"><p class="text-slate-200 font-medium">${p.name}</p>${p.description?`<p class="text-xs text-slate-500">${p.description.slice(0,60)}</p>`:''}</td>
              <td class="py-3 pr-4 text-slate-500 font-mono text-xs hidden sm:table-cell">${p.sku||'—'}</td>
              <td class="py-3 pr-4 hidden md:table-cell">${p.category?`<span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(245,158,11,0.1);color:#f59e0b;">${p.category}</span>`:'<span class="text-slate-600">—</span>'}</td>
              <td class="py-3 pr-4 text-slate-200 font-medium">${p.price?'R$ '+Number(p.price).toFixed(2):'—'}</td>
              <td class="py-3 hidden lg:table-cell">${p.landing_url?`<a href="${p.landing_url}" target="_blank" class="text-xs text-blue-400 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>${p.landing_url.replace(/^https?:\/\//,'').slice(0,30)}</a>`:'<span class="text-slate-600 text-xs">—</span>'}</td>
            </tr>`).join('')}
          </tbody></table></div>`;
    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-white"><i class="fas fa-box text-amber-400 mr-2"></i>Produtos</h2>
            <p class="text-sm text-slate-400">${filtered.length} produto(s)${this.activeProject?' em '+this.activeProject.name:''}</p>
          </div>
          <div class="flex gap-2">
            <button @click="$dispatch('navigate',{page:'importar'})"
                    class="px-3 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-amber-500/30 hover:text-amber-300 transition-all">
              <i class="fas fa-file-import mr-1.5"></i>Importar
            </button>
          </div>
        </div>
        <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">${rows}</div>
      </div>`;
  },
}));


// ── Shared placeholder factory ────────────────────────────────────────────────
function _makePlaceholderPage(name, icon, color, title, desc, btnLabel, btnPage) {
  Alpine.data(name, () => ({
    init() {},
    renderPage() {
      return `
        <div class="p-6">
          <div class="mb-6 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${color}15; border:1px solid ${color}30;">
              <i class="${icon} text-sm" style="color:${color};"></i>
            </div>
            <div>
              <h2 class="text-xl font-bold text-white">${title}</h2>
              <p class="text-sm text-slate-400">${desc}</p>
            </div>
          </div>
          <div class="rounded-2xl p-8 text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <i class="${icon} text-3xl mb-4 block" style="color:${color}40;"></i>
            <p class="font-semibold text-slate-300 mb-2">${title}</p>
            <p class="text-sm text-slate-500 max-w-sm mx-auto mb-4">${desc}</p>
            ${btnLabel && btnPage ? `<button @click="$dispatch('navigate',{page:'${btnPage}'})"
                    class="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style="background:linear-gradient(135deg,${color},${color}cc);">
              <i class="${icon} mr-1.5"></i>${btnLabel}
            </button>` : ''}
          </div>
        </div>`;
    },
  }));
}

_makePlaceholderPage('AdsetsPage',         'fas fa-object-group', '#1877f2', 'Conjuntos de Anúncios', 'Ad sets das campanhas Meta Ads. Selecione uma campanha para ver seus conjuntos.', 'Ver Campanhas', 'campaigns');
_makePlaceholderPage('MetaAdsPage',        'fas fa-rectangle-ad', '#1877f2', 'Anúncios Meta', 'Criativos e anúncios individuais. Acesse via Campanhas → Conjunto → Anúncios.', 'Ver Campanhas', 'campaigns');
_makePlaceholderPage('MetaCountriesPage',  'fas fa-globe',        '#1877f2', 'Países — Meta Ads', 'Segmentação e performance por país. Disponível após integração Meta API com dados de insights por país.', null, null);
_makePlaceholderPage('ProductPerfPage',    'fas fa-chart-bar',    '#f59e0b', 'Performance por Produto', 'ROAS, receita e conversões atribuídas a cada produto via UTM parameters ou catálogo Meta.', 'Ver Produtos', 'products');
_makePlaceholderPage('ProductCountriesPage','fas fa-flag',        '#f59e0b', 'Produtos por País', 'Organize seu catálogo por país de veiculação e veja quais produtos performam melhor em cada mercado.', null, null);
_makePlaceholderPage('GoogleConnectPage',  'fab fa-google',       '#4285f4', 'Google Ads API', 'Configure as credenciais da Google Ads API (Developer Token + OAuth2) para integração completa.', null, null);
_makePlaceholderPage('ClickupIntPage',     'fas fa-circle-check', '#7b68ee', 'ClickUp', 'Importe tarefas e sincronize decisões do Gestor IA com o ClickUp.', null, null);
_makePlaceholderPage('NotionIntPage',      'fas fa-n',            '#ffffff', 'Notion', 'Sincronize análises, produtos e resultados com bases Notion por projeto.', null, null);
_makePlaceholderPage('AiIntPage',          'fas fa-robot',        '#a855f7', 'IA — Claude / ChatGPT', 'Configure as chaves de API para Claude (Anthropic) e OpenAI utilizadas no Gestor IA.', null, null);


// ── Google Ads placeholder pages ──────────────────────────────────────────────
const _GOOGLE_PAGES = {
  'google-overview':  { label: 'Visão Geral',        icon: 'fas fa-chart-pie' },
  'google-accounts':  { label: 'Contas',              icon: 'fas fa-wallet' },
  'google-campaigns': { label: 'Campanhas',           icon: 'fas fa-layer-group' },
  'google-adgroups':  { label: 'Grupos de Anúncios',  icon: 'fas fa-object-group' },
  'google-ads':       { label: 'Anúncios',            icon: 'fas fa-rectangle-ad' },
  'google-keywords':  { label: 'Palavras-chave',      icon: 'fas fa-key' },
  'google-analytics': { label: 'Análises',            icon: 'fas fa-chart-line' },
};
Alpine.data('GooglePlaceholderPage', () => ({
  get _pg() {
    const id = document.querySelector('[x-data="App"]')?._x_dataStack?.[0]?.currentPage || 'google-overview';
    return _GOOGLE_PAGES[id] || { label: 'Google Ads', icon: 'fab fa-google' };
  },
  init() {},
  renderPage() {
    const pg = this._pg;
    return `
      <div class="p-6">
        <div class="mb-6 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:rgba(66,133,244,0.1); border:1px solid rgba(66,133,244,0.2);">
            <i class="${pg.icon} text-sm" style="color:#4285f4;"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Google Ads — ${pg.label}</h2>
            <p class="text-sm text-slate-400">Integração em desenvolvimento</p>
          </div>
        </div>
        <div class="rounded-2xl p-8 text-center mb-6" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:rgba(66,133,244,0.08); border:1px solid rgba(66,133,244,0.2);">
            <i class="fab fa-google text-2xl" style="color:#4285f4;"></i>
          </div>
          <p class="font-semibold text-slate-300 mb-2">Google Ads — Em desenvolvimento</p>
          <p class="text-sm text-slate-500 max-w-sm mx-auto">
            A integração completa com Google Ads está sendo desenvolvida. Em breve terá gestão de campanhas, grupos, palavras-chave e análises.
          </p>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-7 gap-2">
          ${Object.entries(_GOOGLE_PAGES).map(([id, p]) => `
            <div class="rounded-xl p-3 text-center opacity-40" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
              <i class="${p.icon} text-slate-500 text-base mb-1 block"></i>
              <p class="text-xs text-slate-600">${p.label}</p>
            </div>`).join('')}
        </div>
      </div>`;
  },
}));


}); // alpine:init
