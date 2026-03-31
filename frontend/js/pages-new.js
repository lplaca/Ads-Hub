/* ═══════════════════════════════════════════════════════════════════════════
   Novas páginas — stubs expandidos nas ETAPAs 3-7
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
    Alpine.store('projectModal').show({
      editId: p.id, name: p.name, color: p.color, onSave: () => this.load(),
    });
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
          </div>
        `).join('');

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


// ── ProjectDetailPage ────────────────────────────────────────────────────────
Alpine.data('ProjectDetailPage', () => ({
  projectId: null,
  project: null,
  loading: false,

  async init() {
    this.projectId = window._activeProjectId || null;
    if (this.projectId) await this.load();
  },

  async load() {
    if (!this.projectId) return;
    this.loading = true;
    this.project = await API.get('/api/projects/' + this.projectId);
    this.loading = false;
  },

  renderPage() {
    if (this.loading || !this.project) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;
    return `
      <div class="p-6">
        <div class="flex items-center gap-3 mb-6">
          <button @click="$dispatch('navigate',{page:'projects'})" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <i class="fas fa-arrow-left text-sm"></i>
          </button>
          <div class="w-10 h-10 rounded-xl" style="background:${this.project.color || '#3b82f6'};"></div>
          <div>
            <h2 class="text-xl font-bold text-white">${this.project.name}</h2>
            <p class="text-sm text-slate-400">${this.project.client_name || 'Sem cliente definido'}</p>
          </div>
        </div>
        <div class="rounded-2xl p-6 text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <i class="fas fa-chart-bar text-slate-600 text-3xl mb-3"></i>
          <p class="text-slate-400 text-sm">Detalhe do projeto em construção — ETAPA 3</p>
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

  renderPage() {
    return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-white">Tarefas</h2>
            <p class="text-sm text-slate-400">${this.filtered.length} tarefa(s)</p>
          </div>
        </div>
        <div class="rounded-2xl p-6 text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <i class="fas fa-circle-check text-slate-600 text-3xl mb-3"></i>
          <p class="text-slate-400 text-sm">Módulo de tarefas em construção — ETAPA 5</p>
          <p class="text-xs text-slate-600 mt-1">${this.tasks.length} tarefa(s) no banco</p>
        </div>
      </div>`;
  },
}));


// ── IntegrationsPage ─────────────────────────────────────────────────────────
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
          <h2 class="text-xl font-bold text-white">Integrações</h2>
          <p class="text-sm text-slate-400">Meta, Google, TikTok, ClickUp, Notion</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          ${this._connectionCard('Meta Ads', 'fab fa-meta', '#1877f2', 'meta')}
          ${this._connectionCard('Google Ads', 'fab fa-google', '#4285f4', 'google')}
          ${this._connectionCard('TikTok Ads', 'fab fa-tiktok', '#010101', 'tiktok')}
          ${this._connectionCard('ClickUp', 'fas fa-circle-check', '#7b68ee', 'clickup')}
          ${this._connectionCard('Notion', 'fas fa-n', '#ffffff', 'notion')}
          ${this._connectionCard('Google Sheets', 'fas fa-table', '#34a853', 'sheets')}
        </div>
        <div class="flex gap-2">
          <button @click="$dispatch('navigate',{page:'connections'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-plug mr-2"></i>Configurar tokens Meta
          </button>
          <button @click="$dispatch('navigate',{page:'settings'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-gear mr-2"></i>Configurações gerais
          </button>
          <button @click="load()"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-rotate-right mr-2"></i>Verificar saúde
          </button>
        </div>
      </div>`;
  },

  _connectionCard(name, icon, color, key) {
    const metaBms = this.health?.meta_bms || [];
    let status = 'idle', statusLabel = 'Não configurado', statusColor = '#64748b';
    if (key === 'meta' && metaBms.length > 0) {
      const ok = metaBms.every(b => b.ok);
      status = ok ? 'ok' : 'error';
      statusLabel = ok ? `${metaBms.length} BM(s) conectado(s)` : 'Erro em algum token';
      statusColor = ok ? '#22c55e' : '#ef4444';
    } else if (key === 'notion' && this.health?.notion) {
      status = this.health.notion.ok ? 'ok' : 'error';
      statusLabel = this.health.notion.ok ? 'Conectado' : 'Token inválido';
      statusColor = this.health.notion.ok ? '#22c55e' : '#ef4444';
    } else if (key === 'clickup' && this.health?.clickup) {
      status = this.health.clickup.ok ? 'ok' : 'error';
      statusLabel = this.health.clickup.ok ? 'Conectado' : 'Token inválido';
      statusColor = this.health.clickup.ok ? '#22c55e' : '#ef4444';
    } else if (['google','tiktok'].includes(key)) {
      statusLabel = 'Em breve';
    }
    return `
      <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${color}20; border:1px solid ${color}30;">
            <i class="${icon} text-sm" style="color:${color};"></i>
          </div>
          <p class="font-semibold text-white text-sm">${name}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${statusColor};"></span>
          <span class="text-xs text-slate-400">${statusLabel}</span>
        </div>
      </div>`;
  },
}));


// ── IntelligencePage ─────────────────────────────────────────────────────────
Alpine.data('IntelligencePage', () => ({
  renderPage() {
    return `
      <div class="p-6">
        <div class="mb-6">
          <h2 class="text-xl font-bold text-white">Inteligência</h2>
          <p class="text-sm text-slate-400">Forecast, riscos e previsões por projeto</p>
        </div>
        <div class="rounded-2xl p-6 text-center" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          <i class="fas fa-brain text-slate-600 text-3xl mb-3"></i>
          <p class="text-slate-400 text-sm">Módulo de inteligência em construção — ETAPA 7</p>
          <p class="text-xs text-slate-600 mt-1">Forecast e score de risco baseados em dados reais</p>
        </div>
        <div class="mt-4 flex gap-2">
          <button @click="$dispatch('navigate',{page:'analysis'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-chart-bar mr-2"></i>Análise Profunda
          </button>
          <button @click="$dispatch('navigate',{page:'intel'})"
                  class="px-4 py-2 rounded-xl text-sm text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-globe mr-2"></i>Pesquisa Web
          </button>
        </div>
      </div>`;
  },
  async init() {},
}));


// ── AutomationPage ───────────────────────────────────────────────────────────
Alpine.data('AutomationPage', () => ({
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
  async init() {},
}));

}); // alpine:init
