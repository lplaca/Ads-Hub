/* ═══════════════════════════════════════════════════════════════════════════
   Gestor IA — Alpine.js page components
   Páginas: CampaignsPage | AgentPage | KnowledgePage | ChatPage | IdeasPage | AnalysisPage
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('alpine:init', () => {

// ══════════════════════════════════════════════════════════════════════════════
//  CAMPAIGNS PAGE — Visão detalhada de campanhas com saúde e análise IA
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('CampaignsPage', () => ({
  campaigns: [],
  loading: false,
  search: '',
  filterStatus: 'all',
  filterHealth: 'all',
  sortBy: 'spend',
  sortDir: 'desc',
  selectedId: null,
  actionLoading: {},

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    this.loading = true;
    const data = await API.get('/api/campaigns');
    if (data) this.campaigns = data;
    this.loading = false;
  },

  health(c) {
    if (c.status === 'paused') return 'paused';
    if (c.spend > 0 && c.conversions === 0 && c.spend > 10) return 'critical';
    if (c.roas > 0 && c.roas < 2) return 'warning';
    if (c.cpa > 0 && c.cpa > 50) return 'warning';
    if (c.roas >= 3 || c.conversions >= 5) return 'good';
    return 'neutral';
  },

  healthLabel(h) {
    return { good:'Saudável', warning:'Atenção', critical:'Crítica', paused:'Pausada', neutral:'Normal' }[h] || 'Normal';
  },

  healthColor(h) {
    return { good:'#10b981', warning:'#f59e0b', critical:'#ef4444', paused:'#64748b', neutral:'#3b82f6' }[h] || '#64748b';
  },

  healthDot(h) {
    return { good:'bg-emerald-500', warning:'bg-amber-500', critical:'bg-red-500 animate-pulse', paused:'bg-slate-500', neutral:'bg-blue-500' }[h] || 'bg-slate-500';
  },

  get filtered() {
    let d = [...this.campaigns];
    if (this.search) d = d.filter(c => c.name.toLowerCase().includes(this.search.toLowerCase()) || (c.account||'').toLowerCase().includes(this.search.toLowerCase()));
    if (this.filterStatus !== 'all') d = d.filter(c => c.status === this.filterStatus);
    if (this.filterHealth !== 'all') d = d.filter(c => this.health(c) === this.filterHealth);
    d.sort((a,b) => {
      const v = this.sortDir === 'asc' ? 1 : -1;
      return (a[this.sortBy] || 0) > (b[this.sortBy] || 0) ? v : -v;
    });
    return d;
  },

  toggleSort(col) {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'desc'; }
  },

  async pauseCampaign(id) {
    this.actionLoading[id] = 'pause';
    const r = await API.post(`/api/campaigns/${id}/pause`, {});
    if (r?.status === 'success') {
      const c = this.campaigns.find(x => x.id === id);
      if (c) c.status = 'paused';
      toast('success', r.message || 'Campanha pausada!');
    } else {
      toast('error', r?.message || 'Erro ao pausar campanha');
    }
    delete this.actionLoading[id];
  },

  async activateCampaign(id) {
    this.actionLoading[id] = 'activate';
    const r = await API.post(`/api/campaigns/${id}/activate`, {});
    if (r?.status === 'success') {
      const c = this.campaigns.find(x => x.id === id);
      if (c) c.status = 'active';
      toast('success', r.message || 'Campanha ativada!');
    } else {
      toast('error', r?.message || 'Erro ao ativar campanha');
    }
    delete this.actionLoading[id];
  },

  sparkData() {
    return Array.from({length:7}, () => Math.random() * 100);
  },

  drawSparkline(canvas, data, color = '#3b82f6') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const max = Math.max(...data, 1);
    ctx.clearRect(0,0,w,h);
    ctx.beginPath();
    data.forEach((v,i) => {
      const x = (i/(data.length-1))*w;
      const y = h - (v/max)*h*0.8 - h*0.1;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },

  renderPage() {
    const stats = {
      total: this.campaigns.length,
      active: this.campaigns.filter(c=>c.status==='active').length,
      paused: this.campaigns.filter(c=>c.status==='paused').length,
      critical: this.campaigns.filter(c=>this.health(c)==='critical').length,
    };
    return `
<div class="fade-in space-y-5">

  <!-- Stats strip -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    ${[
      {label:'Total', val:stats.total, icon:'fa-layer-group', color:'#3b82f6'},
      {label:'Ativas', val:stats.active, icon:'fa-circle-play', color:'#10b981'},
      {label:'Pausadas', val:stats.paused, icon:'fa-circle-pause', color:'#64748b'},
      {label:'Críticas', val:stats.critical, icon:'fa-triangle-exclamation', color:'#ef4444'},
    ].map(s=>`
    <div class="glass rounded-2xl p-4 flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${s.color}20;">
        <i class="fas ${s.icon}" style="color:${s.color};font-size:15px;"></i>
      </div>
      <div><p class="text-2xl font-bold text-white font-mono">${s.val}</p><p class="text-xs text-slate-400">${s.label}</p></div>
    </div>`).join('')}
  </div>

  <!-- Filters -->
  <div class="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
    <div class="flex-1 relative">
      <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
      <input x-model="search" type="text" placeholder="Buscar campanha..." class="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500">
    </div>
    <select x-model="filterStatus" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50">
      <option value="all">Todos os status</option>
      <option value="active">Ativas</option>
      <option value="paused">Pausadas</option>
    </select>
    <select x-model="filterHealth" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50">
      <option value="all">Todas as saúdes</option>
      <option value="good">Saudável</option>
      <option value="warning">Atenção</option>
      <option value="critical">Crítica</option>
      <option value="paused">Pausada</option>
    </select>
    <select x-model="sortBy" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50">
      <option value="spend">Ordenar: Gasto</option>
      <option value="roas">Ordenar: ROAS</option>
      <option value="cpa">Ordenar: CPA</option>
      <option value="conversions">Ordenar: Conversões</option>
      <option value="ctr">Ordenar: CTR</option>
    </select>
  </div>

  <!-- Loading -->
  <div x-show="loading" class="flex items-center justify-center py-20">
    <div class="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
  </div>

  <!-- Campaign list -->
  <div x-show="!loading" class="space-y-2 fade-in-children">
    <template x-if="filtered.length === 0">
      <div class="glass rounded-2xl p-12 text-center">
        <i class="fas fa-inbox text-slate-600 text-4xl mb-3"></i>
        <p class="text-slate-400">Nenhuma campanha encontrada</p>
      </div>
    </template>
    <template x-for="c in filtered" :key="c.id">
      <div class="glass rounded-2xl overflow-hidden transition-all hover:border-slate-600/60 cursor-pointer"
           :class="selectedId === c.id ? 'border-blue-500/40' : ''"
           @click="selectedId = selectedId === c.id ? null : c.id">
        <!-- Main row -->
        <div class="p-4 flex items-center gap-4">
          <!-- Health dot -->
          <div class="flex-shrink-0">
            <span class="w-3 h-3 rounded-full block" :class="healthDot(health(c))"></span>
          </div>
          <!-- Name + account -->
          <div class="flex-1 min-w-0">
            <p class="text-white font-medium text-sm truncate" x-text="c.name"></p>
            <p class="text-slate-500 text-xs" x-text="c.account || 'Conta desconhecida'"></p>
          </div>
          <!-- Status badge -->
          <span class="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                :style="c.status==='active' ? 'background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25)' : 'background:rgba(100,116,139,0.12);color:#94a3b8;border:1px solid rgba(100,116,139,0.25)'">
            <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="c.status==='active'?'bg-emerald-500':'bg-slate-500'"></span>
            <span x-text="c.status==='active'?'Ativa':'Pausada'"></span>
          </span>
          <!-- Health badge -->
          <span class="hidden lg:inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                :style="'background:'+healthColor(health(c))+'18;color:'+healthColor(health(c))+';border:1px solid '+healthColor(health(c))+'35'">
            <span x-text="healthLabel(health(c))"></span>
          </span>
          <!-- KPIs -->
          <div class="hidden md:flex items-center gap-5 flex-shrink-0">
            <div class="text-right"><p class="text-white font-mono text-sm font-semibold" x-text="'$'+Number(c.spend||0).toFixed(2)"></p><p class="text-slate-500 text-xs">Gasto</p></div>
            <div class="text-right"><p class="text-white font-mono text-sm font-semibold" :style="c.roas>=3?'color:#10b981':c.roas>0&&c.roas<2?'color:#ef4444':''" x-text="Number(c.roas||0).toFixed(2)+'x'"></p><p class="text-slate-500 text-xs">ROAS</p></div>
            <div class="text-right"><p class="text-white font-mono text-sm font-semibold" x-text="'$'+Number(c.cpa||0).toFixed(2)"></p><p class="text-slate-500 text-xs">CPA</p></div>
            <div class="text-right"><p class="text-white font-mono text-sm font-semibold" x-text="Number(c.ctr||0).toFixed(2)+'%'"></p><p class="text-slate-500 text-xs">CTR</p></div>
            <div class="text-right"><p class="text-white font-mono text-sm font-semibold" x-text="c.conversions||0"></p><p class="text-slate-500 text-xs">Conversões</p></div>
          </div>
          <!-- Expand arrow -->
          <i class="fas fa-chevron-down text-slate-500 text-xs transition-transform flex-shrink-0" :class="selectedId===c.id?'rotate-180':''"></i>
        </div>
        <!-- Expanded row -->
        <div x-show="selectedId === c.id" x-transition class="border-t border-slate-700/40 p-4 bg-slate-900/40">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            ${['spend','roas','cpa','ctr','conversions','status'].map(k=>`
            <div class="bg-slate-800/40 rounded-xl p-3">
              <p class="text-slate-400 text-xs mb-1">${{spend:'Gasto',roas:'ROAS',cpa:'CPA',ctr:'CTR',conversions:'Conversões',status:'Status'}[k]||k}</p>
              <p class="text-white font-mono text-sm font-bold">-</p>
            </div>`).join('')}
          </div>
          <div class="flex flex-wrap gap-2">
            <button @click.stop="c.status==='active' ? pauseCampaign(c.id) : activateCampaign(c.id)"
                    :disabled="actionLoading[c.id]"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    :class="c.status==='active' ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/25'">
              <i :class="actionLoading[c.id] ? 'fas fa-spinner animate-spin' : (c.status==='active'?'fas fa-pause':'fas fa-play')"></i>
              <span x-text="c.status==='active'?'Pausar':'Ativar'"></span>
            </button>
            <button @click.stop="$dispatch('navigate',{page:'chat'})"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/25 transition-all">
              <i class="fas fa-robot"></i>
              <span>Analisar com IA</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</div>`;
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
//  AGENT PAGE — Cockpit do gestor IA
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('AgentPage', () => ({
  agentStatus: null,
  decisions: [],
  cycles: [],
  loading: false,
  running: false,
  autonomy: 1,
  interval: 4,
  activeTab: 'feed',
  countdown: '',
  _countdownTimer: null,

  async init() {
    await this.load();
    this.startCountdown();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    const [status, decisions, cycles] = await Promise.all([
      API.get('/api/agent/status'),
      API.get('/api/agent/decisions?limit=30'),
      API.get('/api/agent/cycles?limit=10'),
    ]);
    if (status) {
      this.agentStatus = status;
      this.autonomy = status.autonomy_level || 1;
      this.interval = status.cycle_interval_hours || 4;
    }
    if (decisions) this.decisions = decisions;
    if (cycles) this.cycles = cycles;
    this.startCountdown();
  },

  startCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    const updateCountdown = () => {
      if (!this.agentStatus?.next_cycle_at) { this.countdown = '—'; return; }
      const diff = new Date(this.agentStatus.next_cycle_at) - new Date();
      if (diff <= 0) { this.countdown = 'Em breve'; return; }
      const h = Math.floor(diff/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      this.countdown = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    updateCountdown();
    this._countdownTimer = setInterval(updateCountdown, 1000);
  },

  async runNow() {
    this.running = true;
    toast('info', 'Iniciando análise... Aguarde.');
    const r = await API.post('/api/agent/run', {});
    if (r?.status === 'success') {
      toast('success', `Análise concluída! ${r.actions_taken} ação(ões) tomada(s), ${r.campaigns_analyzed} campanhas analisadas.`);
      await this.load();
    } else {
      toast('error', r?.detail || 'Erro ao executar análise. Verifique a chave Anthropic nas Configurações.');
    }
    this.running = false;
  },

  async saveConfig() {
    const r = await API.post('/api/agent/config', {
      autonomy_level: String(this.autonomy),
      cycle_interval_hours: String(this.interval),
    });
    if (r?.status === 'success') toast('success', 'Configuração salva!');
  },

  autonomyLabel() {
    return ['','Apenas Sugere','Pausa Automática','Pausa + Orçamento','Controle Total'][this.autonomy] || '';
  },

  autonomyDesc() {
    return [
      '',
      'O gestor analisa campanhas e apresenta sugestões. Você toma todas as decisões.',
      'O gestor pausa automaticamente campanhas com performance ruim.',
      'O gestor pausa campanhas e ajusta orçamentos automaticamente.',
      'Controle total: pausa, ajusta orçamentos e redistribui budget entre campanhas.',
    ][this.autonomy] || '';
  },

  autonomyColor() {
    return ['','#3b82f6','#f59e0b','#f97316','#ef4444'][this.autonomy] || '#3b82f6';
  },

  statusColor() {
    const s = this.agentStatus?.last_cycle_status;
    if (s === 'bom') return '#10b981';
    if (s === 'atencao') return '#f59e0b';
    if (s === 'critico') return '#ef4444';
    return '#64748b';
  },

  statusIcon() {
    const s = this.agentStatus?.last_cycle_status;
    if (s === 'bom') return 'fa-circle-check';
    if (s === 'atencao') return 'fa-triangle-exclamation';
    if (s === 'critico') return 'fa-circle-exclamation';
    return 'fa-circle-question';
  },

  actionLabel(a) {
    return {pause:'Campanha Pausada',adjust_budget:'Orçamento Ajustado',notify:'Alerta Gerado',suggest:'Sugestão para Você',activate:'Campanha Ativada'}[a] || a;
  },

  actionIcon(a) {
    return {pause:'fa-pause-circle',adjust_budget:'fa-sliders',notify:'fa-bell',suggest:'fa-lightbulb',activate:'fa-play-circle'}[a] || 'fa-bolt';
  },

  actionColor(a) {
    return {pause:'#ef4444',adjust_budget:'#f59e0b',notify:'#3b82f6',suggest:'#a855f7',activate:'#10b981'}[a] || '#64748b';
  },

  fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    } catch { return iso; }
  },

  renderPage() {
    return `
<div class="fade-in space-y-5">

  <!-- Agent Status Banner -->
  <div class="glass rounded-2xl p-5" style="border: 1px solid ${this.autonomyColor()}35; background: linear-gradient(135deg, ${this.autonomyColor()}08, rgba(15,23,42,0.95));">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4">
        <!-- Animated AI orb -->
        <div class="relative w-16 h-16 flex-shrink-0">
          <div class="absolute inset-0 rounded-full opacity-30 animate-ping" style="background:${this.autonomyColor()};animation-duration:2s;"></div>
          <div class="relative w-full h-full rounded-full flex items-center justify-center" style="background:linear-gradient(135deg,${this.autonomyColor()}40,${this.autonomyColor()}20);border:1.5px solid ${this.autonomyColor()}60;">
            <i class="fas fa-robot text-2xl" style="color:${this.autonomyColor()};"></i>
          </div>
        </div>
        <div>
          <p class="text-white font-bold text-lg">Gestor IA ${this.running ? '<span class="text-blue-400 text-sm font-normal ml-2 animate-pulse">analisando...</span>' : ''}</p>
          <p class="text-slate-400 text-sm mt-0.5">${this.agentStatus?.last_cycle_summary || 'Aguardando primeira análise.'}</p>
          <div class="flex items-center gap-3 mt-2">
            <span class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg" style="background:${this.autonomyColor()}15;color:${this.autonomyColor()};border:1px solid ${this.autonomyColor()}30;">
              <i class="fas fa-shield-halved text-xs"></i> Nível ${this.autonomy}: ${this.autonomyLabel()}
            </span>
            ${this.agentStatus?.last_cycle_at ? `
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <i class="fas fa-clock text-xs"></i>
              Último ciclo: ${this.fmtDate(this.agentStatus.last_cycle_at)}
            </span>` : ''}
          </div>
        </div>
      </div>
      <!-- Action buttons -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <div class="text-center">
          <p class="text-slate-500 text-xs mb-0.5">Próximo ciclo</p>
          <p class="text-white font-mono text-lg font-bold" x-text="countdown"></p>
        </div>
        <button @click="runNow()" :disabled="running"
                class="flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-white transition-all text-sm"
                style="background:linear-gradient(135deg,#3b82f6,#2563eb);box-shadow:0 4px 20px rgba(59,130,246,0.3);"
                :class="running ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-blue-500/40 hover:scale-[1.02]'">
          <i :class="running ? 'fas fa-spinner animate-spin' : 'fas fa-bolt'"></i>
          <span x-text="running ? 'Analisando...' : 'Analisar Agora'"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Config + Stats -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

    <!-- Autonomy config -->
    <div class="glass rounded-2xl p-5 lg:col-span-2">
      <h3 class="text-white font-semibold mb-4 flex items-center gap-2"><i class="fas fa-sliders text-blue-400"></i> Configuração do Gestor</h3>
      <div class="space-y-5">
        <!-- Autonomy slider -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-slate-300 text-sm font-medium">Nível de Autonomia</label>
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg" :style="'background:'+autonomyColor()+'15;color:'+autonomyColor()+';border:1px solid '+autonomyColor()+'30'" x-text="'Nível '+autonomy+' — '+autonomyLabel()"></span>
          </div>
          <input type="range" min="1" max="4" x-model.number="autonomy" @change="saveConfig()"
                 class="w-full h-2 rounded-full appearance-none cursor-pointer agent-slider"
                 :style="'background:linear-gradient(to right,'+autonomyColor()+' '+((autonomy-1)/3*100)+'%,rgba(51,65,85,0.5) '+((autonomy-1)/3*100)+'%)'">
          <div class="grid grid-cols-4 mt-2">
            ${[1,2,3,4].map(n=>`<div class="text-center"><p class="text-xs text-slate-500">N${n}</p></div>`).join('')}
          </div>
          <p class="text-slate-400 text-xs mt-2" x-text="autonomyDesc()"></p>
        </div>
        <!-- Cycle interval -->
        <div>
          <label class="text-slate-300 text-sm font-medium block mb-2">Ciclo de Análise</label>
          <div class="flex gap-2 flex-wrap">
            ${[1,2,4,6,12,24].map(h=>`
            <button @click="interval=${h}; saveConfig()" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    :class="interval===${h} ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-400 border-slate-700/50 hover:border-slate-600'">
              ${h}h
            </button>`).join('')}
          </div>
          <p class="text-slate-500 text-xs mt-2">O gestor analisa suas campanhas automaticamente a cada <span class="text-slate-300" x-text="interval"></span>h</p>
        </div>
      </div>
    </div>

    <!-- Stats panel -->
    <div class="glass rounded-2xl p-5 space-y-4">
      <h3 class="text-white font-semibold flex items-center gap-2"><i class="fas fa-chart-bar text-purple-400"></i> Desempenho do Gestor</h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-slate-700/30">
          <span class="text-slate-400 text-sm">Ciclos executados</span>
          <span class="text-white font-mono font-bold" x-text="cycles.length"></span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-700/30">
          <span class="text-slate-400 text-sm">Ações executadas</span>
          <span class="text-white font-mono font-bold" x-text="agentStatus?.total_decisions_executed || 0"></span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-700/30">
          <span class="text-slate-400 text-sm">Status atual</span>
          <span class="text-xs font-semibold px-2 py-1 rounded-lg"
                :style="'background:'+statusColor()+'15;color:'+statusColor()+';border:1px solid '+statusColor()+'30'"
                x-text="agentStatus?.last_cycle_status ? {bom:'Bom',atencao:'Atenção',critico:'Crítico'}[agentStatus.last_cycle_status]||agentStatus.last_cycle_status : 'Sem dados'"></span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-slate-400 text-sm">Sugestões geradas</span>
          <span class="text-white font-mono font-bold" x-text="decisions.filter(d=>d.action==='suggest').length"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="glass rounded-2xl overflow-hidden">
    <div class="flex border-b border-slate-700/40">
      ${[{id:'feed',label:'Feed de Ações',icon:'fa-list-check'},{id:'insights',label:'Últimos Insights',icon:'fa-brain'},{id:'history',label:'Histórico de Ciclos',icon:'fa-clock-rotate-left'}].map(t=>`
      <button @click="activeTab='${t.id}'" class="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px"
              :class="activeTab==='${t.id}' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'">
        <i class="fas ${t.icon} text-xs"></i>${t.label}
      </button>`).join('')}
    </div>

    <!-- Feed de Ações -->
    <div x-show="activeTab==='feed'" class="p-5">
      <template x-if="decisions.length===0">
        <div class="text-center py-12">
          <i class="fas fa-robot text-slate-700 text-4xl mb-3"></i>
          <p class="text-slate-400">Nenhuma ação registrada. Execute o gestor para começar.</p>
        </div>
      </template>
      <div class="space-y-2 max-h-96 overflow-y-auto">
        <template x-for="d in decisions" :key="d.id">
          <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                 :style="'background:'+actionColor(d.action)+'15;border:1px solid '+actionColor(d.action)+'30'">
              <i class="fas text-xs" :class="actionIcon(d.action)" :style="'color:'+actionColor(d.action)"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold" :style="'color:'+actionColor(d.action)" x-text="actionLabel(d.action)"></span>
                <span x-show="d.executed" class="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Executada</span>
                <span x-show="!d.executed && d.action!=='suggest'" class="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">Sugerida</span>
              </div>
              <p class="text-slate-300 text-sm mt-0.5" x-text="d.reason || d.campaign_name"></p>
              <p class="text-slate-500 text-xs mt-1" x-text="fmtDate(d.created_at)"></p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Insights -->
    <div x-show="activeTab==='insights'" class="p-5">
      <template x-if="cycles.length===0">
        <div class="text-center py-12">
          <i class="fas fa-brain text-slate-700 text-4xl mb-3"></i>
          <p class="text-slate-400">Nenhum insight ainda. Execute o gestor para gerar análises.</p>
        </div>
      </template>
      <div class="space-y-4">
        <template x-for="cycle in cycles.slice(0,3)" :key="cycle.id">
          <div x-show="cycle.insights && cycle.insights.length > 0">
            <p class="text-slate-500 text-xs mb-2" x-text="'Ciclo — '+fmtDate(cycle.started_at)"></p>
            <div class="space-y-2">
              <template x-for="(insight, i) in cycle.insights" :key="i">
                <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div class="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i class="fas fa-lightbulb text-blue-400 text-xs"></i>
                  </div>
                  <p class="text-slate-300 text-sm" x-text="insight"></p>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- History -->
    <div x-show="activeTab==='history'" class="p-5">
      <template x-if="cycles.length===0">
        <div class="text-center py-12">
          <i class="fas fa-clock text-slate-700 text-4xl mb-3"></i>
          <p class="text-slate-400">Nenhum ciclo executado ainda.</p>
        </div>
      </template>
      <div class="space-y-2">
        <template x-for="cycle in cycles" :key="cycle.id">
          <div class="flex items-center gap-4 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div class="w-2 h-2 rounded-full flex-shrink-0" :class="cycle.status==='completed'?'bg-emerald-500':'cycle.status==='error'?'bg-red-500':'bg-amber-500 animate-pulse'"></div>
            <div class="flex-1">
              <p class="text-slate-300 text-sm font-medium" x-text="fmtDate(cycle.started_at)"></p>
              <p class="text-slate-500 text-xs" x-text="cycle.campaigns_analyzed+' campanhas analisadas · '+cycle.actions_taken+' ações tomadas'"></p>
            </div>
            <span class="text-xs px-2 py-1 rounded-lg" :class="cycle.status==='completed'?'bg-emerald-500/15 text-emerald-400':'bg-amber-500/15 text-amber-400'" x-text="cycle.status"></span>
          </div>
        </template>
      </div>
    </div>
  </div>

</div>`;
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
//  KNOWLEDGE PAGE — Base de conhecimento do gestor
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('KnowledgePage', () => ({
  activeTab: 'products',
  products: [],
  knowledge: [],
  showProductModal: false,
  showKnowledgeModal: false,
  editProductId: null,
  editKnowledgeId: null,
  productForm: { name:'', cpa_target:0, roas_target:0, avg_ticket:0, countries:'', peak_months:'', creative_types:'', notes:'' },
  knowledgeForm: { category:'market', title:'', content:'' },
  saving: false,

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    const [products, knowledge] = await Promise.all([
      API.get('/api/ai-products'),
      API.get('/api/knowledge-base'),
    ]);
    if (products) this.products = products;
    if (knowledge) this.knowledge = knowledge;
  },

  openProductModal(p) {
    if (p) { this.productForm = {...p}; this.editProductId = p.id; }
    else { this.productForm = { name:'', cpa_target:0, roas_target:0, avg_ticket:0, countries:'', peak_months:'', creative_types:'', notes:'' }; this.editProductId = null; }
    this.showProductModal = true;
  },

  async saveProduct() {
    if (!this.productForm.name) { toast('warning','Nome do produto é obrigatório'); return; }
    this.saving = true;
    let r;
    if (this.editProductId) r = await API.put('/api/ai-products/'+this.editProductId, this.productForm);
    else r = await API.post('/api/ai-products', this.productForm);
    if (r?.status === 'success') {
      toast('success', this.editProductId ? 'Produto atualizado!' : 'Produto adicionado!');
      await this.load();
      this.showProductModal = false;
    }
    this.saving = false;
  },

  async deleteProduct(id) {
    if (!confirm('Remover este produto?')) return;
    const r = await API.del('/api/ai-products/'+id);
    if (r?.status === 'success') { toast('success','Produto removido!'); await this.load(); }
  },

  openKnowledgeModal(k) {
    if (k) { this.knowledgeForm = {...k}; this.editKnowledgeId = k.id; }
    else { this.knowledgeForm = { category:'market', title:'', content:'' }; this.editKnowledgeId = null; }
    this.showKnowledgeModal = true;
  },

  async saveKnowledge() {
    if (!this.knowledgeForm.title || !this.knowledgeForm.content) { toast('warning','Preencha título e conteúdo'); return; }
    this.saving = true;
    let r;
    if (this.editKnowledgeId) r = await API.put('/api/knowledge-base/'+this.editKnowledgeId, this.knowledgeForm);
    else r = await API.post('/api/knowledge-base', this.knowledgeForm);
    if (r?.status === 'success') {
      toast('success', 'Conhecimento salvo!');
      await this.load();
      this.showKnowledgeModal = false;
    }
    this.saving = false;
  },

  async deleteKnowledge(id) {
    if (!confirm('Remover este conhecimento?')) return;
    const r = await API.del('/api/knowledge-base/'+id);
    if (r?.status === 'success') { toast('success','Removido!'); await this.load(); }
  },

  catLabel(c) {
    return {market:'Mercado',preference:'Preferências',strategy:'Estratégia',audience:'Público',creative:'Criativos'}[c]||c;
  },

  catColor(c) {
    return {market:'#3b82f6',preference:'#a855f7',strategy:'#10b981',audience:'#f59e0b',creative:'#f97316'}[c]||'#64748b';
  },

  get knowledgeByCategory() {
    const groups = {};
    this.knowledge.forEach(k => { groups[k.category] = groups[k.category] || []; groups[k.category].push(k); });
    return groups;
  },

  renderPage() {
    return `
<div class="fade-in space-y-5">

  <!-- Tabs -->
  <div class="glass rounded-2xl overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-700/40">
      ${[
        {id:'products',label:'Produtos & Metas',icon:'fa-box'},
        {id:'knowledge',label:'Base de Conhecimento',icon:'fa-brain'},
        {id:'preview',label:'Preview do Prompt',icon:'fa-eye'},
      ].map(t=>`
      <button @click="activeTab='${t.id}'" class="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px"
              :class="activeTab==='${t.id}' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'">
        <i class="fas ${t.icon} text-xs"></i>${t.label}
      </button>`).join('')}
    </div>

    <!-- Products Tab -->
    <div x-show="activeTab==='products'" class="p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-white font-semibold">Produtos Cadastrados</p>
          <p class="text-slate-400 text-xs mt-0.5">Define metas de CPA e ROAS que o gestor usará nas análises</p>
        </div>
        <button @click="openProductModal(null)"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
          <i class="fas fa-plus"></i> Novo Produto
        </button>
      </div>
      <template x-if="products.length===0">
        <div class="text-center py-12 border border-dashed border-slate-700/50 rounded-2xl">
          <i class="fas fa-box text-slate-600 text-4xl mb-3"></i>
          <p class="text-slate-400 mb-2">Nenhum produto cadastrado</p>
          <p class="text-slate-500 text-xs">Cadastre seus produtos para que o gestor tenha metas de CPA e ROAS</p>
        </div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <template x-for="p in products" :key="p.id">
          <div class="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 hover:border-slate-600/60 transition-all">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <i class="fas fa-box text-blue-400 text-sm"></i>
                </div>
                <div>
                  <p class="text-white font-semibold text-sm" x-text="p.name"></p>
                  <p class="text-slate-500 text-xs" x-text="p.countries || 'Todos os países'"></p>
                </div>
              </div>
              <div class="flex gap-1">
                <button @click="openProductModal(p)" class="w-7 h-7 rounded-lg bg-slate-700/40 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-all">
                  <i class="fas fa-pencil text-xs"></i>
                </button>
                <button @click="deleteProduct(p.id)" class="w-7 h-7 rounded-lg bg-slate-700/40 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all">
                  <i class="fas fa-trash text-xs"></i>
                </button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="bg-slate-900/40 rounded-xl p-2.5 text-center">
                <p class="text-slate-400 text-xs">CPA Meta</p>
                <p class="text-white font-mono font-bold text-sm" x-text="'$'+Number(p.cpa_target||0).toFixed(2)"></p>
              </div>
              <div class="bg-slate-900/40 rounded-xl p-2.5 text-center">
                <p class="text-slate-400 text-xs">ROAS Meta</p>
                <p class="text-white font-mono font-bold text-sm" x-text="Number(p.roas_target||0).toFixed(1)+'x'"></p>
              </div>
              <div class="bg-slate-900/40 rounded-xl p-2.5 text-center">
                <p class="text-slate-400 text-xs">Ticket</p>
                <p class="text-white font-mono font-bold text-sm" x-text="'$'+Number(p.avg_ticket||0).toFixed(0)"></p>
              </div>
            </div>
            <template x-if="p.notes">
              <p class="text-slate-500 text-xs mt-3 line-clamp-2" x-text="p.notes"></p>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Knowledge Tab -->
    <div x-show="activeTab==='knowledge'" class="p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-white font-semibold">Base de Conhecimento</p>
          <p class="text-slate-400 text-xs mt-0.5">Informações sobre mercado, público, criativos e estratégias que o gestor usará</p>
        </div>
        <button @click="openKnowledgeModal(null)"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
          <i class="fas fa-plus"></i> Adicionar
        </button>
      </div>
      <template x-if="knowledge.length===0">
        <div class="text-center py-12 border border-dashed border-slate-700/50 rounded-2xl">
          <i class="fas fa-brain text-slate-600 text-4xl mb-3"></i>
          <p class="text-slate-400 mb-2">Base de conhecimento vazia</p>
          <p class="text-slate-500 text-xs">Adicione informações sobre seu nicho, público, concorrentes e estratégias</p>
          <div class="flex flex-wrap gap-2 justify-center mt-4">
            ${[
              {cat:'market',label:'Mercado',ex:'E-commerce de suplementos, nicho fitness'},
              {cat:'audience',label:'Público',ex:'Mulheres 25-45, interesse em saúde'},
              {cat:'creative',label:'Criativos',ex:'UGC com depoimentos funciona melhor'},
              {cat:'strategy',label:'Estratégia',ex:'CBO com 3-5 adsets por campanha'},
            ].map(e=>`
            <button @click="knowledgeForm={category:'${e.cat}',title:'${e.label}',content:'${e.ex}'}; showKnowledgeModal=true"
                    class="text-xs px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all">
              + ${e.label}: "${e.ex}"
            </button>`).join('')}
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <template x-for="(items, cat) in knowledgeByCategory" :key="cat">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-lg" :style="'background:'+catColor(cat)+'15;color:'+catColor(cat)+';border:1px solid '+catColor(cat)+'30'" x-text="catLabel(cat)"></span>
            </div>
            <div class="space-y-2">
              <template x-for="k in items" :key="k.id">
                <div class="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-all">
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-medium" x-text="k.title"></p>
                    <p class="text-slate-400 text-xs mt-1 line-clamp-2" x-text="k.content"></p>
                  </div>
                  <div class="flex gap-1 flex-shrink-0">
                    <button @click="openKnowledgeModal(k)" class="w-7 h-7 rounded-lg bg-slate-700/40 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-all">
                      <i class="fas fa-pencil text-xs"></i>
                    </button>
                    <button @click="deleteKnowledge(k.id)" class="w-7 h-7 rounded-lg bg-slate-700/40 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all">
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Preview Tab -->
    <div x-show="activeTab==='preview'" class="p-5">
      <p class="text-slate-400 text-sm mb-4">Resumo do que o gestor IA sabe sobre o seu negócio:</p>
      <div class="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-4 font-mono text-xs text-slate-300 leading-relaxed max-h-96 overflow-y-auto space-y-3">
        <div x-show="products.length > 0">
          <p class="text-blue-400 font-semibold">## PRODUTOS E METAS:</p>
          <template x-for="p in products" :key="p.id">
            <p x-text="'• '+p.name+': CPA $'+Number(p.cpa_target).toFixed(2)+' | ROAS '+Number(p.roas_target).toFixed(1)+'x | Ticket $'+Number(p.avg_ticket).toFixed(0)+(p.countries?' | '+p.countries:'')"></p>
          </template>
        </div>
        <div x-show="knowledge.length > 0">
          <p class="text-emerald-400 font-semibold">## CONHECIMENTO DO NEGÓCIO:</p>
          <template x-for="k in knowledge" :key="k.id">
            <p x-text="'['+catLabel(k.category)+'] '+k.title+': '+k.content"></p>
          </template>
        </div>
        <template x-if="products.length===0 && knowledge.length===0">
          <p class="text-slate-500 italic">Nenhum conhecimento cadastrado ainda. Adicione produtos e informações nas abas acima.</p>
        </template>
      </div>
    </div>
  </div>

  <!-- Product Modal -->
  <div x-show="showProductModal" @click="showProductModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
    <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;padding:1.5rem;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-white font-bold text-lg" x-text="editProductId ? 'Editar Produto' : 'Novo Produto'"></h3>
        <button @click="showProductModal=false" class="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-400 hover:text-white flex items-center justify-center"><i class="fas fa-times text-sm"></i></button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Nome do Produto *</label>
          <input x-model="productForm.name" type="text" placeholder="Ex: PROD001 — Suplemento XYZ" class="input-field w-full">
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">CPA Meta ($)</label>
            <input x-model.number="productForm.cpa_target" type="number" step="0.01" class="input-field w-full">
          </div>
          <div>
            <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">ROAS Meta</label>
            <input x-model.number="productForm.roas_target" type="number" step="0.1" class="input-field w-full">
          </div>
          <div>
            <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Ticket Médio ($)</label>
            <input x-model.number="productForm.avg_ticket" type="number" step="0.01" class="input-field w-full">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Países</label>
            <input x-model="productForm.countries" type="text" placeholder="BR, US, MX" class="input-field w-full">
          </div>
          <div>
            <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Meses de Pico</label>
            <input x-model="productForm.peak_months" type="text" placeholder="Nov, Dez, Jan" class="input-field w-full">
          </div>
        </div>
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Tipos de Criativo</label>
          <input x-model="productForm.creative_types" type="text" placeholder="UGC, VSL, Carrossel" class="input-field w-full">
        </div>
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Notas Estratégicas</label>
          <textarea x-model="productForm.notes" rows="3" placeholder="Informações importantes para o gestor sobre este produto..." class="input-field w-full resize-none"></textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="showProductModal=false" class="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm">Cancelar</button>
        <button @click="saveProduct()" :disabled="saving" class="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all" style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
          <span x-text="saving ? 'Salvando...' : 'Salvar Produto'"></span>
        </button>
      </div>
    </div>
    </div>
  </div>

  <!-- Knowledge Modal -->
  <div x-show="showKnowledgeModal" @click="showKnowledgeModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
    <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;padding:1.5rem;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-white font-bold text-lg" x-text="editKnowledgeId ? 'Editar Conhecimento' : 'Novo Conhecimento'"></h3>
        <button @click="showKnowledgeModal=false" class="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-400 hover:text-white flex items-center justify-center"><i class="fas fa-times text-sm"></i></button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Categoria</label>
          <select x-model="knowledgeForm.category" class="input-field w-full">
            <option value="market">Mercado & Nicho</option>
            <option value="audience">Público-alvo</option>
            <option value="creative">Criativos</option>
            <option value="strategy">Estratégia</option>
            <option value="preference">Preferências</option>
          </select>
        </div>
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Título *</label>
          <input x-model="knowledgeForm.title" type="text" placeholder="Ex: Segmento do negócio" class="input-field w-full">
        </div>
        <div>
          <label class="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-1.5">Conteúdo *</label>
          <textarea x-model="knowledgeForm.content" rows="5" placeholder="Descreva este conhecimento em detalhes. Quanto mais específico, melhor o gestor entenderá seu negócio..." class="input-field w-full resize-none"></textarea>
        </div>
      </div>
      <div class="flex gap-3 mt-6">
        <button @click="showKnowledgeModal=false" class="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm">Cancelar</button>
        <button @click="saveKnowledge()" :disabled="saving" class="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all" style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
          <span x-text="saving ? 'Salvando...' : 'Salvar'"></span>
        </button>
      </div>
    </div>
    </div>
  </div>

</div>`;
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT PAGE — Conversar com o gestor IA
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('ChatPage', () => ({
  messages: [],
  input: '',
  sending: false,
  loading: false,

  quickPrompts: [
    { label:'Como estão minhas campanhas hoje?', icon:'fa-chart-line' },
    { label:'O que devo pausar agora?', icon:'fa-pause-circle' },
    { label:'Por que meu CPA subiu essa semana?', icon:'fa-arrow-trend-up' },
    { label:'Quais campanhas têm melhor ROAS?', icon:'fa-trophy' },
    { label:'Qual estratégia me recomenda para escalar?', icon:'fa-rocket' },
    { label:'Analise meu portfólio de campanhas', icon:'fa-magnifying-glass-chart' },
  ],

  async init() {
    await this.load();
    this.scrollToBottom();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    this.loading = true;
    const msgs = await API.get('/api/chat/messages?limit=40');
    if (msgs) this.messages = msgs;
    this.loading = false;
    await this.$nextTick();
    this.scrollToBottom();
  },

  async send(msg) {
    const text = (msg || this.input).trim();
    if (!text || this.sending) return;
    this.input = '';
    // Optimistic UI
    const tempId = 'temp_' + Date.now();
    this.messages.push({ id: tempId, role: 'user', content: text, created_at: new Date().toISOString() });
    await this.$nextTick();
    this.scrollToBottom();

    this.sending = true;
    const r = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.detail || 'Erro'); })).catch(e => ({ error: e.message }));

    if (r.error) {
      // Remove temp and show error
      this.messages = this.messages.filter(m => m.id !== tempId);
      toast('error', r.error.includes('Anthropic') ? 'Chave Anthropic não configurada. Vá em Configurações.' : r.error);
      this.input = text;
    } else {
      // Replace temp + add reply
      const userIdx = this.messages.findIndex(m => m.id === tempId);
      if (userIdx >= 0) this.messages[userIdx].id = 'user_' + Date.now();
      this.messages.push({ id: r.message_id, role: 'assistant', content: r.reply, created_at: new Date().toISOString() });
    }
    this.sending = false;
    await this.$nextTick();
    this.scrollToBottom();
  },

  async clearHistory() {
    if (!confirm('Limpar todo o histórico de conversa?')) return;
    await API.del('/api/chat/clear');
    this.messages = [];
    toast('info', 'Histórico limpo.');
  },

  scrollToBottom() {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  },

  fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; }
  },

  formatContent(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">$1</code>')
      .replace(/\n/g, '<br>');
  },

  renderPage() {
    return `
<div class="fade-in flex flex-col" style="height:calc(100vh - 130px);">

  <!-- Header -->
  <div class="glass rounded-2xl p-4 mb-4 flex items-center justify-between flex-shrink-0">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
        <i class="fas fa-robot text-blue-400"></i>
      </div>
      <div>
        <p class="text-white font-semibold">Gestor IA</p>
        <p class="text-emerald-400 text-xs flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
          Online — tem acesso a todas as suas campanhas
        </p>
      </div>
    </div>
    <button @click="clearHistory()" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 border border-slate-700/50 hover:border-red-500/30 transition-all">
      <i class="fas fa-trash"></i> Limpar
    </button>
  </div>

  <!-- Messages area -->
  <div class="flex-1 overflow-hidden glass rounded-2xl flex flex-col">
    <div id="chat-messages" class="flex-1 overflow-y-auto p-5 space-y-4">

      <!-- Loading -->
      <div x-show="loading" class="flex items-center justify-center py-10">
        <div class="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>

      <!-- Empty state -->
      <template x-if="!loading && messages.length===0">
        <div class="flex flex-col items-center justify-center h-full py-10 text-center">
          <div class="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <i class="fas fa-robot text-blue-400 text-3xl"></i>
          </div>
          <h3 class="text-white font-semibold text-lg mb-2">Olá! Sou seu gestor de tráfego IA</h3>
          <p class="text-slate-400 text-sm max-w-md">Tenho acesso a todas as suas campanhas em tempo real. Pergunte qualquer coisa sobre performance, estratégias ou otimizações.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-lg">
            <template x-for="p in quickPrompts" :key="p.label">
              <button @click="send(p.label)" class="flex items-center gap-2.5 p-3 rounded-xl text-left text-sm bg-slate-800/40 border border-slate-700/40 text-slate-300 hover:border-blue-500/40 hover:text-white hover:bg-slate-800/70 transition-all">
                <i class="fas text-blue-400 flex-shrink-0" :class="p.icon"></i>
                <span x-text="p.label"></span>
              </button>
            </template>
          </div>
        </div>
      </template>

      <!-- Messages -->
      <template x-for="msg in messages" :key="msg.id">
        <div class="flex" :class="msg.role==='user' ? 'justify-end' : 'justify-start'">
          <!-- AI avatar -->
          <div x-show="msg.role==='assistant'" class="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
            <i class="fas fa-robot text-blue-400 text-xs"></i>
          </div>
          <!-- Bubble -->
          <div class="max-w-[80%] group">
            <div class="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                 :class="msg.role==='user'
                   ? 'bg-blue-600 text-white rounded-br-sm'
                   : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm'">
              <span x-html="formatContent(msg.content)"></span>
            </div>
            <p class="text-slate-600 text-xs mt-1" :class="msg.role==='user'?'text-right':''" x-text="fmtTime(msg.created_at)"></p>
          </div>
          <!-- User avatar -->
          <div x-show="msg.role==='user'" class="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 ml-3 mt-0.5">
            <i class="fas fa-user text-slate-300 text-xs"></i>
          </div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div x-show="sending" class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
          <i class="fas fa-robot text-blue-400 text-xs"></i>
        </div>
        <div class="px-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700/50 rounded-bl-sm">
          <div class="flex gap-1 items-center h-4">
            <div class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay:0ms"></div>
            <div class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay:150ms"></div>
            <div class="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style="animation-delay:300ms"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick prompts bar (when has messages) -->
    <div x-show="messages.length>0 && !sending" class="px-4 pb-2 pt-1 border-t border-slate-700/30 overflow-x-auto">
      <div class="flex gap-2 min-w-max">
        <template x-for="p in quickPrompts.slice(0,4)" :key="p.label">
          <button @click="send(p.label)" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 border border-slate-700/40 text-slate-400 hover:border-blue-500/40 hover:text-blue-400 transition-all whitespace-nowrap">
            <i class="fas text-xs" :class="p.icon"></i>
            <span x-text="p.label"></span>
          </button>
        </template>
      </div>
    </div>

    <!-- Input -->
    <div class="p-4 border-t border-slate-700/40 flex-shrink-0">
      <div class="flex gap-3">
        <input
          x-model="input"
          @keydown.enter.prevent="send()"
          :disabled="sending"
          type="text"
          placeholder="Pergunte qualquer coisa sobre suas campanhas..."
          class="flex-1 bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500 transition-all"
        >
        <button @click="send()" :disabled="sending || !input.trim()"
                class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                :class="input.trim() && !sending ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'">
          <i :class="sending ? 'fas fa-spinner animate-spin' : 'fas fa-paper-plane'" class="text-sm"></i>
        </button>
      </div>
      <p class="text-slate-600 text-xs mt-2 text-center">Gestor com acesso real às suas campanhas • Powered by Claude</p>
    </div>
  </div>

</div>`;
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
//  IDEAS PAGE — Ideias e estratégias geradas pela IA
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('IdeasPage', () => ({
  ideas: [],
  products: [],
  loading: false,
  generating: false,
  filterProduct: '',
  filterStatus: 'all',
  filterCategory: 'all',

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    this.loading = true;
    const [ideas, products] = await Promise.all([
      API.get('/api/ideas'),
      API.get('/api/ai-products'),
    ]);
    if (ideas) this.ideas = ideas;
    if (products) this.products = products;
    this.loading = false;
  },

  async generate() {
    this.generating = true;
    toast('info', 'Gerando ideias com IA... Aguarde.');
    const r = await API.post('/api/ideas/generate', { product: this.filterProduct });
    if (r?.status === 'success') {
      toast('success', `${r.count} novas ideias geradas!`);
      await this.load();
    } else {
      toast('error', r?.detail || 'Erro ao gerar ideias. Verifique a chave Anthropic.');
    }
    this.generating = false;
  },

  async updateStatus(id, status) {
    const r = await API.put(`/api/ideas/${id}/status`, { status });
    if (r?.status === 'success') {
      const idea = this.ideas.find(i => i.id === id);
      if (idea) idea.status = status;
      toast('success', { saved:'Ideia salva!', testing:'Marcada como testando!', worked:'Marcada como funcionou!', failed:'Marcada como não funcionou.' }[status] || 'Atualizado!');
    }
  },

  async deleteIdea(id) {
    const r = await API.del(`/api/ideas/${id}`);
    if (r?.status === 'success') { this.ideas = this.ideas.filter(i => i.id !== id); toast('info', 'Ideia removida.'); }
  },

  get filtered() {
    let d = [...this.ideas];
    if (this.filterProduct) d = d.filter(i => i.product_name === this.filterProduct || i.product_name === 'Geral');
    if (this.filterStatus !== 'all') d = d.filter(i => i.status === this.filterStatus);
    if (this.filterCategory !== 'all') d = d.filter(i => i.category === this.filterCategory);
    return d;
  },

  catLabel(c) {
    return {creative:'Criativo',strategy:'Estratégia',audience:'Público',budget:'Orçamento',trend:'Tendência',market:'Mercado'}[c]||c;
  },

  catColor(c) {
    return {creative:'#f97316',strategy:'#10b981',audience:'#a855f7',budget:'#f59e0b',trend:'#3b82f6',market:'#06b6d4'}[c]||'#64748b';
  },

  catIcon(c) {
    return {creative:'fa-wand-magic-sparkles',strategy:'fa-chess',audience:'fa-users',budget:'fa-coins',trend:'fa-arrow-trend-up',market:'fa-globe'}[c]||'fa-lightbulb';
  },

  impactColor(i) {
    return {high:'#10b981',medium:'#f59e0b',low:'#64748b'}[i]||'#64748b';
  },

  statusConfig(s) {
    return {
      new:     {label:'Nova',       color:'#3b82f6', bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.25)'},
      saved:   {label:'Salva',      color:'#a855f7', bg:'rgba(168,85,247,0.1)',  border:'rgba(168,85,247,0.25)'},
      testing: {label:'Testando',   color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)'},
      worked:  {label:'Funcionou',  color:'#10b981', bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.25)'},
      failed:  {label:'Não Funcionou', color:'#ef4444', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.25)'},
    }[s] || {label:s, color:'#64748b', bg:'rgba(100,116,139,0.1)', border:'rgba(100,116,139,0.25)'};
  },

  renderPage() {
    const stats = {
      total: this.ideas.length,
      saved: this.ideas.filter(i=>i.status==='saved').length,
      testing: this.ideas.filter(i=>i.status==='testing').length,
      worked: this.ideas.filter(i=>i.status==='worked').length,
    };
    return `
<div class="fade-in space-y-5">

  <!-- Header + stats -->
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-white font-bold text-xl">Ideias & Estratégias</h2>
      <p class="text-slate-400 text-sm mt-0.5">${stats.total} ideias · ${stats.saved} salvas · ${stats.testing} testando · ${stats.worked} funcionaram</p>
    </div>
    <button @click="generate()" :disabled="generating"
            class="flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-white text-sm transition-all flex-shrink-0"
            style="background:linear-gradient(135deg,#a855f7,#7c3aed);box-shadow:0 4px 20px rgba(168,85,247,0.3);"
            :class="generating ? 'opacity-60' : 'hover:scale-[1.02]'">
      <i :class="generating ? 'fas fa-spinner animate-spin' : 'fas fa-wand-magic-sparkles'"></i>
      <span x-text="generating ? 'Gerando ideias...' : 'Gerar Novas Ideias com IA'"></span>
    </button>
  </div>

  <!-- Filters -->
  <div class="glass rounded-2xl p-4 flex flex-wrap gap-3">
    <select x-model="filterProduct" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none flex-1 min-w-[160px]">
      <option value="">Todos os produtos</option>
      <template x-for="p in products" :key="p.id">
        <option :value="p.name" x-text="p.name"></option>
      </template>
    </select>
    <select x-model="filterCategory" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none flex-1 min-w-[160px]">
      <option value="all">Todas as categorias</option>
      <option value="creative">Criativos</option>
      <option value="strategy">Estratégia</option>
      <option value="audience">Público</option>
      <option value="budget">Orçamento</option>
      <option value="trend">Tendências</option>
    </select>
    <select x-model="filterStatus" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none flex-1 min-w-[160px]">
      <option value="all">Todos os status</option>
      <option value="new">Novas</option>
      <option value="saved">Salvas</option>
      <option value="testing">Testando</option>
      <option value="worked">Funcionou</option>
      <option value="failed">Não Funcionou</option>
    </select>
  </div>

  <!-- Loading -->
  <div x-show="loading" class="flex items-center justify-center py-20">
    <div class="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
  </div>

  <!-- Empty -->
  <template x-if="!loading && filtered.length===0">
    <div class="glass rounded-2xl p-16 text-center">
      <div class="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-lightbulb text-purple-400 text-3xl"></i>
      </div>
      <p class="text-white font-semibold mb-2">Nenhuma ideia ainda</p>
      <p class="text-slate-400 text-sm mb-4">Clique em "Gerar Novas Ideias com IA" para receber sugestões personalizadas baseadas nas suas campanhas e conhecimento cadastrado.</p>
    </div>
  </template>

  <!-- Ideas grid -->
  <div x-show="!loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 fade-in-children">
    <template x-for="idea in filtered" :key="idea.id">
      <div class="glass rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-600/60 transition-all">
        <!-- Header -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  :style="'background:'+catColor(idea.category)+'15;color:'+catColor(idea.category)+';border:1px solid '+catColor(idea.category)+'30'">
              <i class="fas text-xs" :class="catIcon(idea.category)"></i>
              <span x-text="catLabel(idea.category)"></span>
            </span>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-lg"
                  :style="'background:'+statusConfig(idea.status).bg+';color:'+statusConfig(idea.status).color+';border:1px solid '+statusConfig(idea.status).border"
                  x-text="statusConfig(idea.status).label"></span>
          </div>
          <button @click="deleteIdea(idea.id)" class="w-6 h-6 rounded-lg text-slate-600 hover:text-red-400 flex items-center justify-center transition-all flex-shrink-0">
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h4 class="text-white font-semibold text-sm mb-2" x-text="idea.title"></h4>
          <p class="text-slate-400 text-xs leading-relaxed" x-text="idea.description"></p>
          <template x-if="idea.why_it_works">
            <div class="mt-3 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <p class="text-emerald-400 text-xs font-medium mb-0.5">Por que pode funcionar:</p>
              <p class="text-slate-400 text-xs" x-text="idea.why_it_works"></p>
            </div>
          </template>
        </div>

        <!-- Impact + product -->
        <div class="flex items-center gap-2 text-xs">
          <span class="text-slate-500">Impacto:</span>
          <span class="font-semibold" :style="'color:'+impactColor(idea.impact)" x-text="{high:'Alto',medium:'Médio',low:'Baixo'}[idea.impact]||idea.impact"></span>
          <span x-show="idea.product_name && idea.product_name!=='Geral'" class="ml-auto text-slate-500" x-text="idea.product_name"></span>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-1.5 flex-wrap">
          <button x-show="idea.status==='new'" @click="updateStatus(idea.id,'saved')"
                  class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25 transition-all">
            <i class="fas fa-bookmark mr-1"></i>Salvar
          </button>
          <button x-show="['new','saved'].includes(idea.status)" @click="updateStatus(idea.id,'testing')"
                  class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all">
            <i class="fas fa-flask mr-1"></i>Testando
          </button>
          <button x-show="idea.status==='testing'" @click="updateStatus(idea.id,'worked')"
                  class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all">
            <i class="fas fa-check mr-1"></i>Funcionou
          </button>
          <button x-show="idea.status==='testing'" @click="updateStatus(idea.id,'failed')"
                  class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all">
            <i class="fas fa-xmark mr-1"></i>Não Funcionou
          </button>
        </div>
      </div>
    </template>
  </div>
</div>`;
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
//  ANALYSIS PAGE — Análise profunda das campanhas
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('AnalysisPage', () => ({
  data: null,
  period: 30,
  loading: false,
  charts: {},
  activeTab: 'overview',

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
  },

  async load() {
    this.loading = true;
    const r = await API.get(`/api/analysis/overview?days=${this.period}`);
    if (r) {
      this.data = r;
      await this.$nextTick();
      this.buildCharts();
    }
    this.loading = false;
  },

  buildCharts() {
    Object.values(this.charts).forEach(c => { try{c.destroy();}catch{} });
    this.charts = {};
    if (!this.data) return;
    this.buildCpaChart();
    this.buildRoasChart();
    this.buildCtrChart();
    this.buildProductChart();
  },

  buildCpaChart() {
    const el = document.getElementById('ch-analysis-cpa');
    if (!el || !this.data) return;
    const ts = this.data.time_series;
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0,0,0,200);
    g.addColorStop(0,'rgba(239,68,68,0.3)'); g.addColorStop(1,'rgba(239,68,68,0)');
    this.charts.cpa = new Chart(ctx, {
      type:'line',
      data:{ labels:ts.map(d=>d.date), datasets:[{ label:'CPA Médio', data:ts.map(d=>(d.invest/Math.max(d.conversions,1)).toFixed(2)), borderColor:'#ef4444', backgroundColor:g, fill:true, tension:0.4, pointBackgroundColor:'#ef4444', pointRadius:3, pointHoverRadius:5 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10,callbacks:{label:c=>' $'+Number(c.raw).toFixed(2)}}}, scales:{x:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b',font:{size:10}}},y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b',font:{size:10},callback:v=>'$'+v}}} }
    });
  },

  buildRoasChart() {
    const el = document.getElementById('ch-analysis-roas');
    if (!el || !this.data) return;
    const ts = this.data.time_series;
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0,0,0,200);
    g.addColorStop(0,'rgba(16,185,129,0.3)'); g.addColorStop(1,'rgba(16,185,129,0)');
    this.charts.roas = new Chart(ctx, {
      type:'line',
      data:{ labels:ts.map(d=>d.date), datasets:[{ label:'ROAS', data:ts.map(d=>d.roas), borderColor:'#10b981', backgroundColor:g, fill:true, tension:0.4, pointBackgroundColor:'#10b981', pointRadius:3 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10,callbacks:{label:c=>' '+Number(c.raw).toFixed(2)+'x'}}}, scales:{x:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b',font:{size:10}}},y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b',font:{size:10},callback:v=>v+'x'}}} }
    });
  },

  buildCtrChart() {
    const el = document.getElementById('ch-analysis-ctr');
    if (!el || !this.data) return;
    const ts = this.data.time_series;
    const ctx = el.getContext('2d');
    this.charts.ctr = new Chart(ctx, {
      type:'bar',
      data:{ labels:ts.map(d=>d.date), datasets:[{ label:'Investimento', data:ts.map(d=>d.invest), backgroundColor:ts.map(()=>'rgba(59,130,246,0.6)'), borderColor:'#3b82f6', borderWidth:1, borderRadius:4 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false},ticks:{color:'#64748b',font:{size:10}}},y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b',font:{size:10},callback:v=>'$'+v.toLocaleString()}}} }
    });
  },

  buildProductChart() {
    const el = document.getElementById('ch-analysis-products');
    if (!el || !this.data?.by_product) return;
    const bp = this.data.by_product;
    this.charts.products = new Chart(el.getContext('2d'), {
      type:'bar',
      data:{ labels:bp.map(p=>p.name), datasets:[
        { label:'ROAS', data:bp.map(p=>p.roas), backgroundColor:'rgba(16,185,129,0.7)', borderColor:'#10b981', borderWidth:1, borderRadius:4 },
        { label:'CPA ($)', data:bp.map(p=>p.cpa), backgroundColor:'rgba(239,68,68,0.7)', borderColor:'#ef4444', borderWidth:1, borderRadius:4 },
      ] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true,labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10}}, scales:{x:{grid:{display:false},ticks:{color:'#64748b'}},y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}}} }
    });
  },

  renderPage() {
    const sum = this.data?.summary || {};
    const bp = this.data?.by_product || [];
    const camps = this.data?.campaigns || [];
    return `
<div class="fade-in space-y-5">

  <!-- Controls -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-white font-bold text-xl">Análise Profunda</h2>
      <p class="text-slate-400 text-sm mt-0.5">Performance detalhada com evolução histórica</p>
    </div>
    <div class="flex gap-2">
      ${[7,14,30,60,90].map(d=>`
      <button @click="period=${d}; load()" class="px-3 py-1.5 rounded-xl text-xs font-medium transition-all border"
              :class="period===${d} ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-400 border-slate-700/50 hover:border-slate-600'">
        ${d}d
      </button>`).join('')}
    </div>
  </div>

  <!-- Summary KPIs -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    ${[
      {label:'Investimento Total', val:'$'+Number(sum.total_invest||4290).toLocaleString('en-US',{minimumFractionDigits:2}), icon:'fa-dollar-sign', color:'#3b82f6'},
      {label:'Total Conversões', val:Number(sum.total_conv||63).toLocaleString(), icon:'fa-cart-shopping', color:'#10b981'},
      {label:'ROAS Médio', val:Number(sum.avg_roas||3.28).toFixed(2)+'x', icon:'fa-chart-line', color:'#a855f7'},
      {label:'Campanhas', val:camps.length||8, icon:'fa-layer-group', color:'#f59e0b'},
    ].map(s=>`
    <div class="glass rounded-2xl p-4">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background:${s.color}18;">
          <i class="fas ${s.icon} text-xs" style="color:${s.color};"></i>
        </div>
        <p class="text-slate-400 text-xs">${s.label}</p>
      </div>
      <p class="text-white font-mono font-bold text-xl">${s.val}</p>
    </div>`).join('')}
  </div>

  <!-- Loading -->
  <div x-show="loading" class="flex items-center justify-center py-16">
    <div class="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
  </div>

  <!-- Charts grid -->
  <div x-show="!loading" class="grid grid-cols-1 lg:grid-cols-2 gap-5 fade-in-children">
    <div class="glass rounded-2xl p-5">
      <h3 class="text-white font-semibold text-sm mb-4 flex items-center gap-2"><i class="fas fa-arrow-trend-down text-red-400"></i> Evolução do CPA</h3>
      <div style="height:220px;"><canvas id="ch-analysis-cpa"></canvas></div>
    </div>
    <div class="glass rounded-2xl p-5">
      <h3 class="text-white font-semibold text-sm mb-4 flex items-center gap-2"><i class="fas fa-arrow-trend-up text-emerald-400"></i> Evolução do ROAS</h3>
      <div style="height:220px;"><canvas id="ch-analysis-roas"></canvas></div>
    </div>
    <div class="glass rounded-2xl p-5">
      <h3 class="text-white font-semibold text-sm mb-4 flex items-center gap-2"><i class="fas fa-dollar-sign text-blue-400"></i> Investimento Diário</h3>
      <div style="height:220px;"><canvas id="ch-analysis-ctr"></canvas></div>
    </div>
    <div class="glass rounded-2xl p-5">
      <h3 class="text-white font-semibold text-sm mb-4 flex items-center gap-2"><i class="fas fa-box text-amber-400"></i> ROAS vs CPA por Produto</h3>
      <div style="height:220px;"><canvas id="ch-analysis-products"></canvas></div>
    </div>
  </div>

  <!-- Product table -->
  <div x-show="!loading" class="glass rounded-2xl overflow-hidden">
    <div class="p-5 border-b border-slate-700/40">
      <h3 class="text-white font-semibold flex items-center gap-2"><i class="fas fa-table text-slate-400"></i> Performance por Produto</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-700/40">
            ${['Produto','Investimento','Conversões','ROAS','CPA','CTR','CPM'].map(h=>`<th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${bp.map(p=>`
          <tr class="border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors">
            <td class="px-4 py-3 text-white font-medium text-sm">${p.name}</td>
            <td class="px-4 py-3 text-slate-300 font-mono text-sm">$${Number(p.invest).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td class="px-4 py-3 text-slate-300 font-mono text-sm">${p.conversions}</td>
            <td class="px-4 py-3 font-mono text-sm font-semibold" style="color:${p.roas>=3?'#10b981':p.roas>=2?'#f59e0b':'#ef4444'}">${Number(p.roas).toFixed(2)}x</td>
            <td class="px-4 py-3 text-slate-300 font-mono text-sm">$${Number(p.cpa).toFixed(2)}</td>
            <td class="px-4 py-3 text-slate-300 font-mono text-sm">${Number(p.ctr||0).toFixed(2)}%</td>
            <td class="px-4 py-3 text-slate-300 font-mono text-sm">$${Number(p.cpm||0).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

</div>`;
  }
}));

}); // end alpine:init
