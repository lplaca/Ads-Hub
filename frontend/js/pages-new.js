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
  summary: null,
  health: null,
  loading: false,

  async init() {
    this.projectId = window._activeProjectId || null;
    if (this.projectId) await this.load();
    window.addEventListener('page-refresh', () => { if (this.projectId) this.load(); });
  },

  async load() {
    if (!this.projectId) return;
    this.loading = true;
    const [summary, health] = await Promise.all([
      API.get('/api/projects/' + this.projectId + '/summary'),
      API.get('/api/projects/' + this.projectId + '/health'),
    ]);
    this.summary = summary;
    this.health = health;
    this.loading = false;
  },

  healthColor(s) {
    return { healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444' }[s] || '#64748b';
  },

  healthLabel(s) {
    return { healthy: 'Saudável', warning: 'Atenção', critical: 'Crítico' }[s] || '-';
  },

  renderPage() {
    if (this.loading) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;
    if (!this.summary) return `<div class="p-8 text-center text-slate-500">Projeto não encontrado.</div>`;

    const p = this.summary.project;
    const hColor = this.health ? this.healthColor(this.health.status) : '#64748b';
    const hLabel = this.health ? this.healthLabel(this.health.status) : '-';
    const hScore = this.health ? this.health.score : '-';

    const alertCards = (this.summary.alerts || []).length === 0
      ? `<p class="text-slate-500 text-sm py-4 text-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Sem alertas ativos</p>`
      : (this.summary.alerts || []).map(a => `
          <div class="flex items-start gap-3 py-3 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${a.severity==='critical'?'#ef4444':'#f59e0b'};"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200 leading-snug">${a.message || a.rule_name || 'Alerta'}</p>
              <p class="text-xs text-slate-500 mt-0.5">${a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : ''}</p>
            </div>
          </div>`).join('');

    const taskCards = (this.summary.tasks || []).length === 0
      ? `<p class="text-slate-500 text-sm py-4 text-center"><i class="fas fa-circle-check text-slate-600 mr-2"></i>Sem tarefas pendentes</p>`
      : (this.summary.tasks || []).map(t => `
          <div class="flex items-center gap-3 py-2.5 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
            <button @click="completeTask('${t.id}')" class="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-green-500 transition-all flex-shrink-0"></button>
            <span class="text-sm text-slate-300 flex-1 truncate">${t.title}</span>
            <span class="text-xs text-slate-500">${t.priority}</span>
          </div>`).join('');

    return `
      <div class="p-6 max-w-4xl">
        <div class="flex items-center gap-3 mb-6">
          <button @click="$dispatch('navigate',{page:'projects'})" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <i class="fas fa-arrow-left text-sm"></i>
          </button>
          <div class="w-10 h-10 rounded-xl flex-shrink-0" style="background:${p.color || '#3b82f6'};"></div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold text-white">${p.name}</h2>
            <p class="text-sm text-slate-400">${p.client_name || 'Sem cliente definido'}</p>
          </div>
          <button @click="$dispatch('navigate',{page:'alerts'})"
                  class="px-3 py-1.5 rounded-xl text-xs text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
            <i class="fas fa-bell mr-1"></i>Alertas
          </button>
        </div>

        <!-- Score de saúde + métricas -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <p class="text-xs text-slate-500 mb-1">Saúde</p>
            <p class="text-2xl font-bold" style="color:${hColor};">${hScore}</p>
            <p class="text-xs mt-0.5" style="color:${hColor};">${hLabel}</p>
          </div>
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <p class="text-xs text-slate-500 mb-1">Alertas</p>
            <p class="text-2xl font-bold text-white">${this.summary.alert_count}</p>
            <p class="text-xs text-slate-500 mt-0.5">ativos</p>
          </div>
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <p class="text-xs text-slate-500 mb-1">Tarefas</p>
            <p class="text-2xl font-bold text-white">${this.summary.task_count}</p>
            <p class="text-xs text-slate-500 mt-0.5">pendentes</p>
          </div>
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <p class="text-xs text-slate-500 mb-1">Contas</p>
            <p class="text-2xl font-bold text-white">${this.summary.account_count}</p>
            <p class="text-xs text-slate-500 mt-0.5">ativas</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Alertas -->
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <div class="flex items-center justify-between mb-3">
              <p class="font-semibold text-white text-sm"><i class="fas fa-triangle-exclamation text-amber-400 mr-2"></i>Alertas Recentes</p>
            </div>
            ${alertCards}
          </div>
          <!-- Tarefas -->
          <div class="rounded-2xl p-4" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
            <div class="flex items-center justify-between mb-3">
              <p class="font-semibold text-white text-sm"><i class="fas fa-circle-check text-blue-400 mr-2"></i>Tarefas Pendentes</p>
              <button @click="$dispatch('navigate',{page:'tasks'})" class="text-xs text-blue-400 hover:text-blue-300">Ver todas</button>
            </div>
            ${taskCards}
          </div>
        </div>
      </div>`;
  },

  async completeTask(tid) {
    await API.post('/api/tasks/' + tid + '/complete', {});
    await this.load();
    toast('success', 'Tarefa concluída!');
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

  renderPage() {
    if (this.loading) return `<div class="p-8 text-center text-slate-500"><i class="fas fa-spinner animate-spin text-2xl"></i></div>`;

    const projectOpts = this.projects.map(p =>
      `<option value="${p.id}">${p.name}</option>`).join('');

    const formHtml = this.showForm ? `
      <div class="rounded-2xl p-5 mb-4" style="background:#1e293b; border:1px solid rgba(37,99,235,0.3);">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input x-model="form.title" type="text" placeholder="Título da tarefa *"
                 @keydown.enter="createTask()"
                 class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none sm:col-span-2" />
          <select x-model="form.project_id" class="px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="">Sem projeto</option>
            ${projectOpts}
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
          <button @click="showForm=false" class="px-4 py-2 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-500 transition-all">
            Cancelar
          </button>
        </div>
      </div>` : '';

    const rows = this.filtered.length === 0
      ? `<div class="empty-state">
           <div class="empty-state-icon"><i class="fas fa-circle-check"></i></div>
           <p class="font-semibold text-slate-300 mb-1">Nenhuma tarefa encontrada</p>
           <p class="text-sm text-slate-500 mb-4">Crie sua primeira tarefa ou ajuste os filtros</p>
         </div>`
      : this.filtered.map(t => `
          <div class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-slate-800/40 group"
               style="border-bottom:1px solid rgba(51,65,85,0.3);">
            <button @click="completeTask('${t.id}')"
                    class="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-green-500 flex-shrink-0 transition-all"
                    title="Marcar como feita"></button>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-200 truncate">${t.title}</p>
              ${t.project_id ? `<p class="text-xs text-slate-500">${this.projectName(t.project_id)}</p>` : ''}
            </div>
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${this.priorityColor(t.priority)};" title="${t.priority}"></span>
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
        <!-- Filtros -->
        <div class="flex gap-2 mb-4 flex-wrap">
          <select x-model="filterStatus" class="px-3 py-1.5 rounded-xl text-xs text-slate-300 bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="open">Abertas</option>
            <option value="done">Concluídas</option>
            <option value="">Todas</option>
          </select>
          <select x-model="filterProject" class="px-3 py-1.5 rounded-xl text-xs text-slate-300 bg-slate-800 border border-slate-700 focus:outline-none">
            <option value="">Todos os projetos</option>
            ${projectOpts}
          </select>
        </div>
        <div class="rounded-2xl overflow-hidden" style="background:#1e293b; border:1px solid rgba(51,65,85,0.5);">
          ${rows}
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

  riskColor(level) {
    return { low: '#22c55e', warning: '#f59e0b', critical: '#ef4444' }[level] || '#64748b';
  },

  riskLabel(level) {
    return { low: 'Baixo', warning: 'Médio', critical: 'Alto' }[level] || '-';
  },

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
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style="background:${color}20; color:${color};">
              ${this.riskLabel(this.risk.level)}
            </span>
          </div>
          <div class="flex items-end gap-3 mb-4">
            <p class="text-4xl font-bold" style="color:${color};">${this.risk.score ?? '-'}</p>
            <p class="text-slate-500 text-sm mb-1">/100</p>
          </div>
          <div class="w-full rounded-full h-2 mb-4" style="background:rgba(51,65,85,0.6);">
            <div class="h-2 rounded-full transition-all" style="width:${this.risk.score ?? 0}%; background:${color};"></div>
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
          ${this.risk.message ? `<p class="text-xs text-slate-500 mt-3 pt-3 border-t" style="border-color:rgba(51,65,85,0.4);">${this.risk.message}</p>` : ''}
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
          ${riskCard}
          ${forecastCard}
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
