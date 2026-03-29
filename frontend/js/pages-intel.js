/* ═══════════════════════════════════════════════════════════════════════════
   Inteligência de Mercado — Web Research + AI Synthesis
   Searches Reddit, YouTube, X, blogs and synthesizes with Claude
   ═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('alpine:init', () => {

Alpine.data('IntelPage', () => ({
  // ── state ────────────────────────────────────────────────────────────────
  query: '',
  sources: ['all'],
  searching: false,
  result: null,
  history: [],
  historyLoading: false,
  view: 'search',     // 'search' | 'result' | 'history'
  hasSearchKey: false,
  settingsLoading: true,

  SOURCE_OPTIONS: [
    { id:'all',     label:'Geral',    icon:'fas fa-globe',          color:'#3b82f6' },
    { id:'reddit',  label:'Reddit',   icon:'fab fa-reddit-alien',   color:'#ff4500' },
    { id:'youtube', label:'YouTube',  icon:'fab fa-youtube',        color:'#ef4444' },
    { id:'x',       label:'Twitter/X',icon:'fab fa-x-twitter',     color:'#94a3b8' },
    { id:'news',    label:'Notícias', icon:'fas fa-newspaper',      color:'#f59e0b' },
    { id:'blogs',   label:'Blogs',    icon:'fas fa-rss',            color:'#22c55e' },
  ],

  QUICK_PROMPTS: [
    { label:'Melhores estratégias Meta Ads 2025',          icon:'fas fa-trophy' },
    { label:'Como reduzir CPM no Facebook Ads',            icon:'fas fa-arrow-trend-down' },
    { label:'Criativo que está convertendo agora',         icon:'fas fa-image' },
    { label:'Tendências de tráfego pago no Brasil',        icon:'fas fa-chart-line' },
    { label:'Advantage+ vs campanha manual - resultados',  icon:'fas fa-robot' },
    { label:'Como escalar campanhas sem perder ROAS',      icon:'fas fa-rocket' },
    { label:'Melhores nichos dropshipping 2025',           icon:'fas fa-boxes-stacked' },
    { label:'Erros mais comuns em campanhas de remarketing',icon:'fas fa-bug' },
  ],

  // ── init ─────────────────────────────────────────────────────────────────
  async init() {
    const s = await API.get('/api/settings');
    if (s) {
      this.hasSearchKey = !!(s.serper_api_key || s.brave_api_key);
    }
    this.settingsLoading = false;
    await this.loadHistory();
  },

  async loadHistory() {
    this.historyLoading = true;
    const h = await API.get('/api/intel/history?limit=15');
    if (h) this.history = h;
    this.historyLoading = false;
  },

  // ── source filter ─────────────────────────────────────────────────────────
  toggleSource(id) {
    if (id === 'all') { this.sources = ['all']; return; }
    this.sources = this.sources.filter(s => s !== 'all');
    if (this.sources.includes(id)) {
      this.sources = this.sources.filter(s => s !== id);
      if (!this.sources.length) this.sources = ['all'];
    } else {
      this.sources.push(id);
    }
  },

  isSource(id) { return this.sources.includes(id); },

  // ── search ────────────────────────────────────────────────────────────────
  async search(q) {
    const text = (q || this.query).trim();
    if (!text || this.searching) return;
    this.query = text;
    this.searching = true;
    this.result = null;
    this.view = 'result';

    const r = await API.post('/api/intel/research', {
      query: text,
      sources: this.sources,
    });

    if (r && !r.detail) {
      this.result = r;
      await this.loadHistory();
    } else {
      this.result = { error: r?.detail || 'Erro ao pesquisar. Configure sua chave de API em Configurações.' };
    }
    this.searching = false;
  },

  async deleteHistory(id) {
    await API.del(`/api/intel/history/${id}`);
    this.history = this.history.filter(h => h.id !== id);
  },

  viewResult(h) {
    // Reload full result from history
    this.result = {
      id: h.id,
      query: h.query,
      synthesis: h.synthesis,
      results: [],     // history only stores synthesis; re-run for full results
      result_count: h.result_count || 0,
      from_history: true,
    };
    this.query = h.query;
    this.view = 'result';
  },

  // ── helpers ───────────────────────────────────────────────────────────────
  sourceIcon(type) {
    const map = {
      reddit: 'fab fa-reddit-alien', youtube: 'fab fa-youtube',
      twitter: 'fab fa-x-twitter', blog: 'fas fa-rss',
      tiktok: 'fab fa-tiktok', instagram: 'fab fa-instagram',
      linkedin: 'fab fa-linkedin',
    };
    return map[type] || 'fas fa-link';
  },

  sourceColor(type) {
    const map = {
      reddit: '#ff4500', youtube: '#ef4444', twitter: '#94a3b8',
      blog: '#22c55e', tiktok: '#06b6d4', instagram: '#e1306c',
      linkedin: '#0a66c2',
    };
    return map[type] || '#64748b';
  },

  formatSynthesis(text) {
    if (!text) return '';
    return text
      .replace(/^## (.+)$/gm, '<h3 class="text-white font-bold text-base mt-4 mb-2">$1</h3>')
      .replace(/^### (.+)$/gm, '<h4 class="text-slate-200 font-semibold text-sm mt-3 mb-1">$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-slate-700/50 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-xs">$1</code>')
      .replace(/^\• (.+)$/gm, '<div class="flex gap-2 my-1"><span class="text-cyan-400 mt-0.5 flex-shrink-0">•</span><span class="text-slate-300 text-sm leading-relaxed">$1</span></div>')
      .replace(/^- (.+)$/gm, '<div class="flex gap-2 my-1"><span class="text-cyan-400 mt-0.5 flex-shrink-0">–</span><span class="text-slate-300 text-sm leading-relaxed">$1</span></div>')
      .replace(/\[(\d+)\]/g, '<sup class="text-cyan-400 font-bold text-xs">[$1]</sup>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  },

  timeSince(isoStr) {
    try {
      const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
      if (diff < 60) return 'agora';
      if (diff < 3600) return Math.floor(diff/60) + 'min atrás';
      if (diff < 86400) return Math.floor(diff/3600) + 'h atrás';
      return Math.floor(diff/86400) + 'd atrás';
    } catch { return ''; }
  },

  // ── render ────────────────────────────────────────────────────────────────
  renderPage() {
    return `
    <div class="space-y-5 fade-in">
      ${this.renderHeader()}
      ${this.settingsLoading ? this.renderLoading() :
        !this.hasSearchKey ? this.renderNoKey() :
        this.view === 'result' ? this.renderResult() :
        this.view === 'history' ? this.renderHistory() :
        this.renderHome()}
    </div>`;
  },

  renderHeader() {
    return `
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#0891b2,#0e7490);">
            <i class="fas fa-globe text-white text-sm"></i>
          </div>
          <h2 class="text-xl font-bold text-white">Inteligência de Mercado</h2>
        </div>
        <p class="text-slate-400 text-sm">Pesquise estratégias, tendências e insights do mundo todo — Reddit, YouTube, X, blogs e mais</p>
      </div>
      <div class="flex gap-2">
        <button @click="view='search'" :class="view!=='history'?'bg-slate-700 text-white':'text-slate-400 hover:text-white'" class="px-3 py-1.5 rounded-lg text-sm transition-all">
          <i class="fas fa-magnifying-glass mr-1"></i> Pesquisar
        </button>
        <button @click="view='history'; loadHistory()" :class="view==='history'?'bg-slate-700 text-white':'text-slate-400 hover:text-white'" class="px-3 py-1.5 rounded-lg text-sm transition-all">
          <i class="fas fa-clock-rotate-left mr-1"></i> Histórico
        </button>
      </div>
    </div>`;
  },

  renderLoading() {
    return `<div class="flex items-center gap-3 p-6 rounded-2xl" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
      <i class="fas fa-spinner animate-spin text-cyan-400"></i>
      <span class="text-slate-400 text-sm">Carregando...</span>
    </div>`;
  },

  renderNoKey() {
    return `
    <div class="rounded-2xl p-8 text-center" style="background:rgba(30,41,59,0.6); border:1px solid rgba(6,182,212,0.3);">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);">
        <i class="fas fa-key text-2xl text-cyan-400"></i>
      </div>
      <h3 class="text-lg font-bold text-white mb-2">Configure sua chave de busca</h3>
      <p class="text-slate-400 text-sm mb-2 max-w-md mx-auto">Para pesquisar na internet, você precisa de uma chave da <strong class="text-white">Serper API</strong> (Google Search).</p>
      <p class="text-slate-500 text-xs mb-5">É grátis: 2500 buscas/mês em <span class="text-cyan-400 font-medium">serper.dev</span></p>
      <div class="flex gap-3 justify-center flex-wrap">
        <a href="https://serper.dev" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background:rgba(6,182,212,0.2);border:1px solid rgba(6,182,212,0.4);">
          <i class="fas fa-external-link-alt text-xs"></i> Criar conta Serper
        </a>
        <button @click="$dispatch('navigate',{page:'settings'})" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 transition-all">
          <i class="fas fa-gear text-xs"></i> Ir para Configurações
        </button>
      </div>
    </div>`;
  },

  renderHome() {
    const sourceOpts = this.SOURCE_OPTIONS.map(o => `
    <button @click="toggleSource('${o.id}')"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border"
      :style="isSource('${o.id}')
        ? 'background:rgba(${this._hexToRgb(o.color)},0.15);border-color:${o.color};color:${o.color};'
        : 'background:rgba(30,41,59,0.5);border-color:rgba(51,65,85,0.5);color:#64748b;'">
      <i class="${o.icon} text-xs"></i>
      <span>${o.label}</span>
    </button>`).join('');

    const quickPrompts = this.QUICK_PROMPTS.map(p => `
    <button @click="search('${p.label}')"
      class="flex items-center gap-2.5 p-3.5 rounded-xl text-left transition-all group"
      style="background:rgba(30,41,59,0.5);border:1px solid rgba(51,65,85,0.4);"
      onmouseenter="this.style.borderColor='rgba(6,182,212,0.4)'"
      onmouseleave="this.style.borderColor='rgba(51,65,85,0.4)'">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(6,182,212,0.1);">
        <i class="${p.icon} text-xs text-cyan-400"></i>
      </div>
      <span class="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">${p.label}</span>
    </button>`).join('');

    return `
    <!-- Search bar -->
    <div class="rounded-2xl p-4" style="background:rgba(30,41,59,0.6); border:1px solid rgba(6,182,212,0.3);">
      <div class="flex gap-2 mb-4">
        <div class="flex-1 relative">
          <i class="fas fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
          <input type="text" x-model="query"
            placeholder="Pesquise estratégias, tendências, o que está funcionando no mundo..."
            class="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white bg-slate-800/70 border border-slate-700 focus:border-cyan-500 focus:outline-none transition-colors"
            @keydown.enter="search()" />
        </div>
        <button @click="search()" :disabled="!query.trim() || searching"
          class="px-5 py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50 flex items-center gap-2"
          style="background:linear-gradient(135deg,#0891b2,#0e7490);">
          <i :class="searching ? 'fas fa-spinner animate-spin' : 'fas fa-magnifying-glass'"></i>
          <span class="hidden sm:inline">${this.searching ? 'Buscando...' : 'Buscar'}</span>
        </button>
      </div>

      <!-- Source filters -->
      <div class="flex flex-wrap gap-2">
        ${sourceOpts}
      </div>
    </div>

    <!-- Quick prompts -->
    <div>
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Perguntas populares</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        ${quickPrompts}
      </div>
    </div>

    <!-- Recent history preview -->
    ${this.history.length > 0 ? `
    <div>
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pesquisas recentes</p>
        <button @click="view='history'" class="text-xs text-cyan-400 hover:text-cyan-300">Ver tudo →</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${this.history.slice(0,5).map(h => `
        <button @click="search('${h.query.replace(/'/g,"&#39;")}')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-400 hover:text-white transition-colors"
          style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
          <i class="fas fa-clock-rotate-left text-slate-600"></i>
          ${h.query.length > 40 ? h.query.substring(0,40)+'...' : h.query}
        </button>`).join('')}
      </div>
    </div>` : ''}`;
  },

  // helper for template string (can't use direct methods in template literals in methods)
  _hexToRgb(hex) {
    try {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return `${r},${g},${b}`;
    } catch { return '59,130,246'; }
  },

  renderResult() {
    if (this.searching) {
      return `
      <div class="rounded-2xl p-6" style="background:rgba(30,41,59,0.6);border:1px solid rgba(6,182,212,0.3);">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:rgba(6,182,212,0.15);">
            <i class="fas fa-spinner animate-spin text-cyan-400"></i>
          </div>
          <div>
            <p class="text-white font-semibold text-sm">Pesquisando na internet...</p>
            <p class="text-slate-400 text-xs">"${this.query}"</p>
          </div>
        </div>
        <div class="space-y-2">
          ${['Reddit & comunidades...', 'YouTube & vídeos...', 'Twitter/X...', 'Blogs & artigos...', 'Analisando com IA...'].map((s,i) => `
          <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg" style="background:rgba(15,23,42,0.4);">
            <div class="w-2 h-2 rounded-full animate-pulse" style="background:#0891b2;animation-delay:${i*200}ms"></div>
            <span class="text-sm text-slate-400">${s}</span>
          </div>`).join('')}
        </div>
      </div>`;
    }

    if (!this.result) return '';

    if (this.result.error) {
      return `
      <div class="rounded-2xl p-6 text-center" style="background:rgba(30,41,59,0.6);border:1px solid rgba(239,68,68,0.3);">
        <i class="fas fa-triangle-exclamation text-red-400 text-2xl mb-2"></i>
        <p class="text-red-300 text-sm">${this.result.error}</p>
        <button @click="view='search'; result=null" class="mt-3 text-xs text-slate-400 hover:text-white">← Voltar</button>
      </div>`;
    }

    const results = this.result.results || [];

    // Group results by type
    const groups = {};
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });

    const sourceCards = results.map(r => `
    <a href="${r.link}" target="_blank" rel="noopener"
      class="block p-3.5 rounded-xl transition-all group"
      style="background:rgba(15,23,42,0.6);border:1px solid rgba(51,65,85,0.4);"
      onmouseenter="this.style.borderColor='rgba(6,182,212,0.3)'"
      onmouseleave="this.style.borderColor='rgba(51,65,85,0.4)'">
      <div class="flex items-start gap-2.5">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:rgba(${this._hexToRgb(this.sourceColor(r.type))},0.15);">
          <i class="${this.sourceIcon(r.type)} text-xs" style="color:${this.sourceColor(r.type)};"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-200 group-hover:text-white transition-colors leading-snug line-clamp-2">${r.title || r.domain}</p>
          <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${r.snippet || ''}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-xs text-slate-600">${r.domain}</span>
            ${r.date ? `<span class="text-xs text-slate-700">• ${r.date}</span>` : ''}
          </div>
        </div>
        <i class="fas fa-arrow-up-right-from-square text-xs text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1"></i>
      </div>
    </a>`).join('');

    return `
    <!-- Back + query -->
    <div class="flex items-center gap-3 flex-wrap">
      <button @click="view='search'; result=null; query=''" class="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <i class="fas fa-arrow-left text-xs"></i> Nova pesquisa
      </button>
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <i class="fas fa-magnifying-glass text-slate-600 text-xs"></i>
        <span class="text-sm text-slate-300 truncate">"${this.result.query}"</span>
        <span class="text-xs text-slate-600 flex-shrink-0">${this.result.result_count || results.length} fontes</span>
      </div>
      <button @click="search(result.query)" class="text-xs text-cyan-400 hover:text-cyan-300 flex-shrink-0">
        <i class="fas fa-rotate-right mr-1"></i> Repetir
      </button>
    </div>

    <!-- AI Synthesis -->
    ${this.result.synthesis ? `
    <div class="rounded-2xl overflow-hidden" style="background:rgba(30,41,59,0.6);border:1px solid rgba(6,182,212,0.3);">
      <div class="flex items-center gap-3 p-4" style="background:linear-gradient(135deg,rgba(8,145,178,0.12),rgba(14,116,144,0.08));border-bottom:1px solid rgba(6,182,212,0.2);">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,#0891b2,#7c3aed);">
          <i class="fas fa-wand-magic-sparkles text-white text-sm"></i>
        </div>
        <div>
          <p class="text-white font-semibold text-sm">Síntese de IA</p>
          <p class="text-cyan-400/70 text-xs">Análise baseada em ${results.length} fontes encontradas</p>
        </div>
      </div>
      <div class="p-5">
        <div class="text-sm leading-relaxed" style="color:#cbd5e1;">${this.formatSynthesis(this.result.synthesis)}</div>
      </div>
    </div>` : ''}

    <!-- Source results -->
    ${results.length > 0 ? `
    <div>
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Fontes encontradas (${results.length})</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${sourceCards}
      </div>
    </div>` : this.result.from_history ? `
    <div class="p-4 rounded-xl text-center text-sm text-slate-500" style="background:rgba(15,23,42,0.4);">
      <i class="fas fa-clock-rotate-left mr-1"></i> Resultado do histórico — pesquise novamente para ver fontes atualizadas
    </div>` : ''}`;
  },

  renderHistory() {
    if (this.historyLoading) return this.renderLoading();

    if (!this.history.length) {
      return `
      <div class="rounded-2xl p-8 text-center" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
        <i class="fas fa-clock-rotate-left text-slate-600 text-3xl mb-3"></i>
        <p class="text-slate-400 text-sm">Nenhuma pesquisa ainda</p>
        <button @click="view='search'" class="mt-3 text-xs text-cyan-400 hover:text-cyan-300">Fazer primeira pesquisa →</button>
      </div>`;
    }

    const rows = this.history.map(h => `
    <div class="flex items-start gap-3 p-4 rounded-xl transition-all group"
      style="background:rgba(30,41,59,0.5);border:1px solid rgba(51,65,85,0.4);"
      onmouseenter="this.style.borderColor='rgba(6,182,212,0.25)'"
      onmouseleave="this.style.borderColor='rgba(51,65,85,0.4)'">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(6,182,212,0.1);">
        <i class="fas fa-magnifying-glass text-xs text-cyan-400"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-200 group-hover:text-white">${h.query}</p>
        ${h.synthesis ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${h.synthesis.replace(/<[^>]*>/g,'').substring(0,120)}...</p>` : ''}
        <p class="text-xs text-slate-600 mt-1">${this.timeSince(h.created_at)}</p>
      </div>
      <div class="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button @click="viewResult(${JSON.stringify(h).replace(/"/g,'&quot;')})" class="px-2.5 py-1 rounded-lg text-xs text-cyan-400 hover:bg-cyan-400/10 transition-colors">
          <i class="fas fa-eye mr-1"></i>Ver
        </button>
        <button @click="search('${h.query.replace(/'/g,"&#39;")}')" class="px-2.5 py-1 rounded-lg text-xs text-blue-400 hover:bg-blue-400/10 transition-colors">
          <i class="fas fa-rotate-right mr-1"></i>Repetir
        </button>
        <button @click="deleteHistory('${h.id}')" class="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`).join('');

    return `
    <div class="rounded-2xl overflow-hidden" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
      <div class="flex items-center justify-between p-4" style="border-bottom:1px solid rgba(51,65,85,0.4);">
        <h3 class="font-semibold text-white text-sm">Histórico de Pesquisas</h3>
        <button @click="view='search'" class="text-xs text-cyan-400 hover:text-cyan-300">Nova pesquisa →</button>
      </div>
      <div class="p-3 space-y-2">
        ${rows}
      </div>
    </div>`;
  },

}));

}); // alpine:init
