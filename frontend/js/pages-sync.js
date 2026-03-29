/* ═══════════════════════════════════════════════════════════════════════════
   Sync Page — Work Session + ClickUp / Notion Publisher
   ═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('alpine:init', () => {

Alpine.data('SyncPage', () => ({
  /* ── state ─────────────────────────────────────────────────────────── */
  step: 'idle',       // idle | active | review | done
  session: null,
  loading: false,
  publishing: false,
  elapsed: 0,
  _timer: null,

  // settings check
  hasCK: false,
  hasNotion: false,
  settingsLoading: true,

  // finish data
  diff: null,
  todayMetrics: {},

  // product form
  notionProducts: [],
  productsLoading: false,
  productEntries: {},   // { product_id: { checked, spend, vendas, period, acao, obs } }

  // targets
  toClickup: true,
  toNotion: true,

  // done state
  results: [],

  // ── init ──────────────────────────────────────────────────────────────
  async init() {
    await this.loadSettings();
    await this.checkActive();
  },

  async loadSettings() {
    this.settingsLoading = true;
    const s = await API.get('/api/settings');
    if (s) {
      this.hasCK     = !!(s.clickup_api_key && s.clickup_list_id);
      this.hasNotion = !!(s.notion_token && s.notion_db_id);
    }
    this.settingsLoading = false;
  },

  async checkActive() {
    const r = await API.get('/api/sessions/active');
    if (r && r.id) {
      this.session = r;
      this.step = 'active';
      this.startTimer(r.started_at);
    }
  },

  // ── timer ──────────────────────────────────────────────────────────────
  startTimer(startedAt) {
    if (this._timer) clearInterval(this._timer);
    const t0 = new Date(startedAt).getTime();
    const tick = () => { this.elapsed = Math.floor((Date.now() - t0) / 1000); };
    tick();
    this._timer = setInterval(tick, 1000);
  },

  stopTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  fmtElapsed(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
    if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m ${ss.toString().padStart(2,'0')}s`;
    return `${m.toString().padStart(2,'0')}m ${ss.toString().padStart(2,'0')}s`;
  },

  // ── session actions ────────────────────────────────────────────────────
  async startSession() {
    this.loading = true;
    const r = await API.post('/api/sessions/start', {});
    if (r && r.id) {
      this.session = r;
      this.step = 'active';
      this.startTimer(r.started_at);
    } else {
      this.$dispatch('show-toast', { type:'error', message:'Erro ao iniciar sessão' });
    }
    this.loading = false;
  },

  async finishSession() {
    if (!this.session) return;
    this.loading = true;
    const r = await API.post(`/api/sessions/${this.session.id}/finish`, {});
    if (r && r.id) {
      this.stopTimer();
      this.session = r;
      this.diff = r.diff || {};
      this.todayMetrics = r.today_metrics || {};
      this.step = 'review';
      await this.loadNotionProducts();
    } else {
      this.$dispatch('show-toast', { type:'error', message:'Erro ao finalizar sessão' });
    }
    this.loading = false;
  },

  // ── notion products ────────────────────────────────────────────────────
  async loadNotionProducts() {
    this.productsLoading = true;
    const r = await API.get('/api/sessions/notion-products');
    if (r && r.products) {
      this.notionProducts = r.products;
      this.notionProducts.forEach(p => {
        this.productEntries[p.id] = {
          checked: false,
          spend: '',
          vendas: '',
          period: 'Manhã',
          acao: '',
          obs: '',
        };
      });
    }
    this.productsLoading = false;
  },

  checkedProducts() {
    return this.notionProducts.filter(p => this.productEntries[p.id]?.checked);
  },

  // ── publish ────────────────────────────────────────────────────────────
  async publish() {
    const checked = this.checkedProducts();
    if (!this.toClickup && !this.toNotion) {
      this.$dispatch('show-toast', { type:'error', message:'Selecione ao menos um destino (ClickUp ou Notion)' });
      return;
    }
    if (this.toNotion && checked.length === 0) {
      this.$dispatch('show-toast', { type:'error', message:'Selecione ao menos um produto para publicar no Notion' });
      return;
    }
    this.publishing = true;

    const products_data = {};
    checked.forEach(p => {
      const e = this.productEntries[p.id];
      products_data[p.id] = {
        name: p.name,
        spend: e.spend,
        vendas: e.vendas,
        period: e.period,
        acao: e.acao,
        obs: e.obs,
      };
    });

    const r = await API.post(`/api/sessions/${this.session.id}/publish`, {
      to_clickup: this.toClickup,
      to_notion:  this.toNotion,
      products_data,
      diff_summary: this.buildDiffSummary(),
    });

    if (r && r.ok) {
      this.results = r.results || [];
      this.step = 'done';
    } else {
      this.$dispatch('show-toast', { type:'error', message:'Erro ao publicar. Verifique as chaves de API nas configurações.' });
    }
    this.publishing = false;
  },

  buildDiffSummary() {
    if (!this.diff) return 'Sem alterações detectadas.';
    const lines = [];
    for (const [accId, d] of Object.entries(this.diff)) {
      const accName = d.account_name || accId;
      if (d.status_changes?.length)
        lines.push(`${accName}: ${d.status_changes.length} status alterado(s)`);
      if (d.new_campaigns?.length)
        lines.push(`${accName}: ${d.new_campaigns.length} campanha(s) nova(s)`);
      if (d.removed_campaigns?.length)
        lines.push(`${accName}: ${d.removed_campaigns.length} campanha(s) removida(s)`);
      if (d.budget_changes?.length)
        lines.push(`${accName}: ${d.budget_changes.length} alteração(ões) de orçamento`);
    }
    return lines.length ? lines.join('\n') : 'Sem alterações detectadas.';
  },

  reset() {
    this.step = 'idle';
    this.session = null;
    this.diff = null;
    this.todayMetrics = {};
    this.notionProducts = [];
    this.productEntries = {};
    this.results = [];
    this.elapsed = 0;
    this.stopTimer();
    this.loadSettings();
  },

  // ── helpers ────────────────────────────────────────────────────────────
  diffEntries() {
    if (!this.diff) return [];
    return Object.entries(this.diff).map(([id, d]) => ({ id, ...d }));
  },

  diffHasChanges(d) {
    return (d.status_changes?.length || d.new_campaigns?.length ||
            d.removed_campaigns?.length || d.budget_changes?.length) > 0;
  },

  // ── template ───────────────────────────────────────────────────────────
  renderPage() {
    return `
    <div class="space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-xl font-bold text-white">Sync de Trabalho</h2>
          <p class="text-slate-400 text-sm mt-0.5">Registre sua sessão e publique atualizações no ClickUp e Notion</p>
        </div>
        ${this.step !== 'idle' && this.step !== 'done' ? `
        <button @click="reset()" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all border border-slate-700/50">
          <i class="fas fa-xmark"></i> Cancelar
        </button>` : ''}
      </div>

      ${this.settingsLoading ? `
      <div class="flex items-center gap-3 p-4 rounded-xl" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
        <i class="fas fa-spinner animate-spin text-blue-400"></i>
        <span class="text-slate-400 text-sm">Verificando configurações...</span>
      </div>` : this.renderContent()}

    </div>`;
  },

  renderContent() {
    if (this.step === 'idle')   return this.renderIdle();
    if (this.step === 'active') return this.renderActive();
    if (this.step === 'review') return this.renderReview();
    if (this.step === 'done')   return this.renderDone();
    return '';
  },

  // ── IDLE ───────────────────────────────────────────────────────────────
  renderIdle() {
    const ck = this.hasCK;
    const no = this.hasNotion;
    return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

      <!-- Status Cards -->
      <div class="rounded-2xl p-4 flex items-start gap-3" style="background:rgba(30,41,59,0.6); border:1px solid rgba(${ck?'34,197,94':'239,68,68'},0.3);">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(${ck?'34,197,94':'239,68,68'},0.15);">
          <i class="fas fa-${ck?'check':'times'} text-sm" style="color:${ck?'#22c55e':'#ef4444'}"></i>
        </div>
        <div>
          <p class="text-sm font-semibold text-white">ClickUp</p>
          <p class="text-xs text-slate-400 mt-0.5">${ck ? 'Conectado e pronto' : 'Não configurado'}</p>
          ${!ck ? `<button @click="$dispatch('navigate',{page:'settings'})" class="text-xs text-blue-400 hover:text-blue-300 mt-1">Configurar →</button>` : ''}
        </div>
      </div>

      <div class="rounded-2xl p-4 flex items-start gap-3" style="background:rgba(30,41,59,0.6); border:1px solid rgba(${no?'34,197,94':'239,68,68'},0.3);">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(${no?'34,197,94':'239,68,68'},0.15);">
          <i class="fas fa-${no?'check':'times'} text-sm" style="color:${no?'#22c55e':'#ef4444'}"></i>
        </div>
        <div>
          <p class="text-sm font-semibold text-white">Notion</p>
          <p class="text-xs text-slate-400 mt-0.5">${no ? 'Conectado e pronto' : 'Não configurado'}</p>
          ${!no ? `<button @click="$dispatch('navigate',{page:'settings'})" class="text-xs text-blue-400 hover:text-blue-300 mt-1">Configurar →</button>` : ''}
        </div>
      </div>

      <div class="rounded-2xl p-4 flex items-start gap-3" style="background:rgba(30,41,59,0.6); border:1px solid rgba(59,130,246,0.3);">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(59,130,246,0.15);">
          <i class="fas fa-info text-sm text-blue-400"></i>
        </div>
        <div>
          <p class="text-sm font-semibold text-white">Como funciona</p>
          <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">Inicie a sessão, trabalhe nas campanhas, finalize e publique o resumo.</p>
        </div>
      </div>
    </div>

    <!-- Start Button -->
    <div class="rounded-2xl p-8 text-center" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2)); border:1px solid rgba(59,130,246,0.3);">
        <i class="fas fa-play text-2xl text-blue-400"></i>
      </div>
      <h3 class="text-lg font-bold text-white mb-1">Iniciar Nova Sessão</h3>
      <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">Registra um snapshot de todas as suas campanhas agora. Ao finalizar, detectamos o que mudou.</p>
      <button @click="startSession()" :disabled="loading" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50" style="background:linear-gradient(135deg,#2563eb,#7c3aed); box-shadow:0 4px 20px rgba(59,130,246,0.3);">
        <i :class="loading ? 'fas fa-spinner animate-spin' : 'fas fa-play'"></i>
        ${this.loading ? 'Iniciando...' : 'Iniciar Sessão'}
      </button>
    </div>`;
  },

  // ── ACTIVE ─────────────────────────────────────────────────────────────
  renderActive() {
    return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Timer -->
      <div class="lg:col-span-2 rounded-2xl p-6" style="background:rgba(30,41,59,0.6); border:1px solid rgba(34,197,94,0.3);">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-green-400 font-semibold text-sm">Sessão Ativa</span>
        </div>
        <div class="text-5xl font-bold text-white font-mono mb-2" x-text="fmtElapsed(elapsed)"></div>
        <p class="text-slate-400 text-sm">Trabalhe nas suas campanhas normalmente. Quando terminar, clique em Finalizar.</p>
        <p class="text-slate-500 text-xs mt-2">Iniciado em: ${this.session ? new Date(this.session.started_at).toLocaleString('pt-BR') : ''}</p>
      </div>

      <!-- Info -->
      <div class="rounded-2xl p-6 flex flex-col justify-between" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
        <div>
          <p class="text-sm font-semibold text-white mb-2">O que será registrado</p>
          <ul class="space-y-2 text-xs text-slate-400">
            <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-400 w-4"></i> Campanhas ativadas / pausadas</li>
            <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-400 w-4"></i> Novos orçamentos</li>
            <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-400 w-4"></i> Campanhas novas ou removidas</li>
            <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-400 w-4"></i> Métricas do dia por conta</li>
          </ul>
        </div>
        <button @click="finishSession()" :disabled="loading" class="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50" style="background:linear-gradient(135deg,#059669,#0d9488);">
          <i :class="loading ? 'fas fa-spinner animate-spin' : 'fas fa-stop'"></i>
          ${this.loading ? 'Finalizando...' : 'Finalizar Sessão'}
        </button>
      </div>
    </div>`;
  },

  // ── REVIEW ─────────────────────────────────────────────────────────────
  renderReview() {
    const entries = this.diffEntries();
    const hasChanges = entries.some(e => this.diffHasChanges(e));

    return `
    <div class="space-y-5">

      <!-- Diff summary -->
      <div class="rounded-2xl overflow-hidden" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
        <div class="flex items-center gap-3 p-4" style="border-bottom:1px solid rgba(51,65,85,0.4);">
          <i class="fas fa-code-compare text-blue-400"></i>
          <h3 class="font-semibold text-white text-sm">Alterações Detectadas</h3>
          <span class="text-xs px-2 py-0.5 rounded-full ml-auto" style="background:rgba(${hasChanges?'239,68,68':'34,197,94'},0.15); color:${hasChanges?'#f87171':'#4ade80'};">${hasChanges?'Mudanças encontradas':'Nenhuma mudança'}</span>
        </div>
        ${entries.length === 0 ? `
        <div class="p-6 text-center">
          <i class="fas fa-equals text-slate-600 text-2xl mb-2"></i>
          <p class="text-slate-400 text-sm">Nenhuma conta com dados para comparar</p>
        </div>` : `
        <div class="divide-y" style="divide-color:rgba(51,65,85,0.3);">
          ${entries.map(e => `
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="fas fa-credit-card text-slate-500 text-xs"></i>
              <span class="text-sm font-medium text-slate-200">${e.account_name || e.id}</span>
              ${this.todayMetrics[e.id] ? `<span class="text-xs text-slate-500 ml-auto">Gasto hoje: <span class="text-white font-semibold">$${Number(this.todayMetrics[e.id].spend||0).toFixed(2)}</span></span>` : ''}
            </div>
            ${e.status_changes?.length ? `
            <div class="mt-1.5 space-y-1">
              ${e.status_changes.map(c => `
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full" style="background:${c.new_status==='ACTIVE'?'#22c55e':'#f59e0b'};"></span>
                <span class="text-slate-400 truncate max-w-[200px]">${c.name}</span>
                <span class="text-slate-600 mx-1">→</span>
                <span style="color:${c.new_status==='ACTIVE'?'#4ade80':'#fbbf24'}">${c.new_status==='ACTIVE'?'Ativada':'Pausada'}</span>
              </div>`).join('')}
            </div>` : ''}
            ${e.budget_changes?.length ? `
            <div class="mt-1.5 space-y-1">
              ${e.budget_changes.map(c => `
              <div class="flex items-center gap-2 text-xs">
                <i class="fas fa-dollar-sign text-amber-400 w-3"></i>
                <span class="text-slate-400 truncate max-w-[180px]">${c.name}</span>
                <span class="text-slate-600 mx-1">$${c.old_budget}→$${c.new_budget}</span>
              </div>`).join('')}
            </div>` : ''}
            ${e.new_campaigns?.length ? `
            <div class="mt-1.5 flex flex-wrap gap-1">
              ${e.new_campaigns.map(c => `<span class="text-xs px-2 py-0.5 rounded-full" style="background:rgba(34,197,94,0.1);color:#4ade80;">+ ${c.name}</span>`).join('')}
            </div>` : ''}
            ${e.removed_campaigns?.length ? `
            <div class="mt-1.5 flex flex-wrap gap-1">
              ${e.removed_campaigns.map(c => `<span class="text-xs px-2 py-0.5 rounded-full" style="background:rgba(239,68,68,0.1);color:#f87171;">- ${c.name}</span>`).join('')}
            </div>` : ''}
            ${!this.diffHasChanges(e) ? `<p class="text-xs text-slate-600 mt-1">Sem alterações nesta conta</p>` : ''}
          </div>`).join('')}
        </div>`}
      </div>

      <!-- Products for Notion -->
      <div class="rounded-2xl overflow-hidden" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
        <div class="flex items-center gap-3 p-4" style="border-bottom:1px solid rgba(51,65,85,0.4);">
          <i class="fas fa-box text-purple-400"></i>
          <h3 class="font-semibold text-white text-sm">Dados por Produto (Notion)</h3>
          ${this.productsLoading ? `<i class="fas fa-spinner animate-spin text-slate-400 text-xs ml-auto"></i>` : `<span class="text-xs text-slate-500 ml-auto">${this.notionProducts.length} produtos encontrados</span>`}
        </div>
        ${this.notionProducts.length === 0 && !this.productsLoading ? `
        <div class="p-6 text-center">
          <i class="fas fa-box-open text-slate-600 text-2xl mb-2"></i>
          <p class="text-slate-400 text-sm">Nenhum produto encontrado no Notion</p>
          <p class="text-slate-500 text-xs mt-1">Configure notion_products_db_id nas configurações</p>
        </div>` : `
        <div class="divide-y" style="divide-color:rgba(51,65,85,0.3);">
          ${this.notionProducts.map(p => {
            const e = this.productEntries[p.id] || {};
            return `
          <div class="p-4" :class="'${e.checked ? '' : 'opacity-60'}'">
            <div class="flex items-center gap-3 mb-3">
              <input type="checkbox" id="pc_${p.id}" ${e.checked ? 'checked' : ''}
                @change="productEntries['${p.id}'].checked = $event.target.checked"
                class="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500">
              <label for="pc_${p.id}" class="text-sm font-semibold text-white cursor-pointer">${p.name}</label>
              <span class="text-xs px-2 py-0.5 rounded-full ml-auto" style="background:rgba(${p.status==='active'?'34,197,94':'100,116,139'},0.15);color:${p.status==='active'?'#4ade80':'#94a3b8'};">${p.status||'—'}</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 pl-7">
              <div>
                <label class="text-xs text-slate-500 block mb-1">Gasto ($)</label>
                <input type="number" step="0.01" placeholder="0.00"
                  :value="productEntries['${p.id}'].spend"
                  @input="productEntries['${p.id}'].spend = $event.target.value"
                  class="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-blue-500 focus:outline-none">
              </div>
              <div>
                <label class="text-xs text-slate-500 block mb-1">Vendas</label>
                <input type="number" placeholder="0"
                  :value="productEntries['${p.id}'].vendas"
                  @input="productEntries['${p.id}'].vendas = $event.target.value"
                  class="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-blue-500 focus:outline-none">
              </div>
              <div>
                <label class="text-xs text-slate-500 block mb-1">Período</label>
                <select :value="productEntries['${p.id}'].period"
                  @change="productEntries['${p.id}'].period = $event.target.value"
                  class="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-blue-500 focus:outline-none">
                  <option>Manhã</option><option>Tarde</option><option>Noite</option>
                </select>
              </div>
              <div class="col-span-2 md:col-span-3">
                <label class="text-xs text-slate-500 block mb-1">Ação tomada</label>
                <input type="text" placeholder="Ex: Pausei campanha X, aumentei orçamento Y..."
                  :value="productEntries['${p.id}'].acao"
                  @input="productEntries['${p.id}'].acao = $event.target.value"
                  class="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-blue-500 focus:outline-none">
              </div>
              <div class="col-span-2 md:col-span-3">
                <label class="text-xs text-slate-500 block mb-1">Observação</label>
                <input type="text" placeholder="Notas adicionais..."
                  :value="productEntries['${p.id}'].obs"
                  @input="productEntries['${p.id}'].obs = $event.target.value"
                  class="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-blue-500 focus:outline-none">
              </div>
            </div>
          </div>`;
          }).join('')}
        </div>`}
      </div>

      <!-- Publish targets + button -->
      <div class="rounded-2xl p-5" style="background:rgba(30,41,59,0.6); border:1px solid rgba(51,65,85,0.4);">
        <h3 class="font-semibold text-white text-sm mb-4">Publicar em</h3>
        <div class="flex flex-wrap gap-3 mb-5">
          <label class="flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-xl border transition-all" :style="toClickup ? 'border-color:#3b82f6;background:rgba(59,130,246,0.1)' : 'border-color:rgba(51,65,85,0.5);background:rgba(30,41,59,0.4)'">
            <input type="checkbox" :checked="toClickup" @change="toClickup = $event.target.checked" class="hidden">
            <div class="w-5 h-5 rounded flex items-center justify-center" :style="toClickup ? 'background:#3b82f6' : 'background:rgba(71,85,105,0.5)'">
              <i class="fas fa-check text-white text-xs" x-show="toClickup"></i>
            </div>
            <i class="fas fa-check-square text-blue-400 text-base"></i>
            <span class="text-sm font-medium text-white">ClickUp</span>
            ${!this.hasCK ? `<span class="text-xs text-red-400">(não configurado)</span>` : ''}
          </label>
          <label class="flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-xl border transition-all" :style="toNotion ? 'border-color:#8b5cf6;background:rgba(139,92,246,0.1)' : 'border-color:rgba(51,65,85,0.5);background:rgba(30,41,59,0.4)'">
            <input type="checkbox" :checked="toNotion" @change="toNotion = $event.target.checked" class="hidden">
            <div class="w-5 h-5 rounded flex items-center justify-center" :style="toNotion ? 'background:#8b5cf6' : 'background:rgba(71,85,105,0.5)'">
              <i class="fas fa-check text-white text-xs" x-show="toNotion"></i>
            </div>
            <i class="fas fa-n text-purple-400 text-base font-bold"></i>
            <span class="text-sm font-medium text-white">Notion</span>
            ${!this.hasNotion ? `<span class="text-xs text-red-400">(não configurado)</span>` : ''}
          </label>
        </div>
        <button @click="publish()" :disabled="publishing" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50" style="background:linear-gradient(135deg,#2563eb,#7c3aed); box-shadow:0 4px 20px rgba(59,130,246,0.25);">
          <i :class="publishing ? 'fas fa-spinner animate-spin' : 'fas fa-paper-plane'"></i>
          <span>${this.publishing ? 'Publicando...' : 'Publicar Agora'}</span>
        </button>
      </div>
    </div>`;
  },

  // ── DONE ───────────────────────────────────────────────────────────────
  renderDone() {
    return `
    <div class="rounded-2xl p-8 text-center" style="background:rgba(30,41,59,0.6); border:1px solid rgba(34,197,94,0.3);">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3);">
        <i class="fas fa-check text-3xl text-green-400"></i>
      </div>
      <h3 class="text-xl font-bold text-white mb-1">Publicado com Sucesso!</h3>
      <p class="text-slate-400 text-sm mb-6">Sua sessão foi registrada e os dados foram enviados.</p>

      ${this.results.length > 0 ? `
      <div class="rounded-xl overflow-hidden mb-6 text-left" style="background:rgba(15,23,42,0.6); border:1px solid rgba(51,65,85,0.4);">
        ${this.results.map(r => `
        <div class="flex items-center gap-3 p-3 border-b last:border-0" style="border-color:rgba(51,65,85,0.3);">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(${r.ok?'34,197,94':'239,68,68'},0.15);">
            <i class="fas fa-${r.ok?'check':'times'} text-xs" style="color:${r.ok?'#4ade80':'#f87171'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white">${r.target}: ${r.label || ''}</p>
            ${r.url ? `<a href="${r.url}" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 truncate block">${r.url}</a>` : ''}
            ${r.error ? `<p class="text-xs text-red-400">${r.error}</p>` : ''}
          </div>
        </div>`).join('')}
      </div>` : ''}

      <button @click="reset()" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
        <i class="fas fa-plus"></i> Nova Sessão
      </button>
    </div>`;
  },

}));

}); // alpine:init
