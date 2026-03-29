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
  period: 'last_7d',
  search: '',
  filterStatus: 'all',
  filterHealth: 'all',
  sortBy: 'spend',
  sortDir: 'desc',
  selectedId: null,
  actionLoading: {},
  lastUpdated: null,

  // Which columns are visible (user can toggle)
  visibleCols: ['spend','revenue','roas','cpa','impressions','reach','link_clicks',
                'cpc_link','lpv','cost_per_lp','checkouts','cost_per_checkout',
                'conversions','connect_rate','lp_view_rate','checkout_per_lpv','purchase_per_ic'],
  showColMenu: false,

  COL_LABELS: {
    spend:'Gasto', revenue:'Receita', roas:'ROAS', cpa:'Custo/Compra',
    impressions:'Impressões', reach:'Alcance',
    link_clicks:'Cliques Link', cpc_link:'CPC Link',
    ctr:'CTR', lpv:'Page Views', cost_per_lp:'Custo/PV',
    checkouts:'Finalizações', cost_per_checkout:'Custo/Final.',
    conversions:'Compras', connect_rate:'Connect Rate',
    lp_view_rate:'LPV Rate', checkout_per_lpv:'IC/LPV', purchase_per_ic:'Compra/IC',
    video_3s:'Views 3s', video_thru:'ThruPlay',
  },

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
    // Live update from global poller
    window.addEventListener('live-update', () => {
      this.lastUpdated = new Date().toLocaleTimeString('pt-BR');
    });
  },

  async load() {
    this.loading = true;
    const data = await API.get(`/api/campaigns?period=${this.period}`);
    if (data) {
      this.campaigns = data;
      this.lastUpdated = new Date().toLocaleTimeString('pt-BR');
    }
    this.loading = false;
  },

  async setPeriod(p) { this.period = p; await this.load(); },

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

  fmtMetric(k, v) {
    const n = Number(v || 0);
    if (k==='spend'||k==='revenue'||k==='cpa'||k==='cpc_link'||k==='cost_per_lp'||k==='cost_per_checkout') return '$'+n.toFixed(2);
    if (k==='roas') return n.toFixed(2)+'x';
    if (k==='ctr'||k==='connect_rate'||k==='lp_view_rate'||k==='checkout_per_lpv'||k==='purchase_per_ic') return n.toFixed(2)+'%';
    if (k==='impressions'||k==='reach'||k==='video_3s'||k==='video_thru') return n.toLocaleString('pt-BR');
    return String(n);
  },

  metricColor(k, v) {
    const n = Number(v || 0);
    if (k==='roas') return n>=3?'color:#10b981':n>0&&n<1.5?'color:#ef4444':n>0&&n<2.5?'color:#f59e0b':'';
    if (k==='cpa'||k==='cost_per_lp'||k==='cost_per_checkout'||k==='cpc_link') return n>0?'color:#fbbf24':'';
    if (k==='revenue'||k==='conversions'||k==='checkouts') return n>0?'color:#34d399':'';
    if (k==='connect_rate') return n>=20?'color:#10b981':n>0&&n<5?'color:#f59e0b':'';
    if (k==='purchase_per_ic') return n>=30?'color:#10b981':n>0&&n<10?'color:#ef4444':'';
    return '';
  },

  renderPage() {
    const stats = {
      total: this.campaigns.length,
      active: this.campaigns.filter(c=>c.status==='active').length,
      paused: this.campaigns.filter(c=>c.status==='paused').length,
      critical: this.campaigns.filter(c=>this.health(c)==='critical').length,
      spend: this.campaigns.reduce((s,c)=>s+(c.spend||0),0),
      revenue: this.campaigns.reduce((s,c)=>s+(c.revenue||0),0),
      conversions: this.campaigns.reduce((s,c)=>s+(c.conversions||0),0),
    };
    const avgRoas = stats.spend > 0 ? stats.revenue / stats.spend : 0;

    const allCols = Object.keys(this.COL_LABELS);
    const vis = this.visibleCols;

    return `
<div class="fade-in space-y-4">

  <!-- Totals bar -->
  <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
    ${[
      {k:'total',   l:'Campanhas',  v:stats.total,              fmt:v=>v,            color:'#3b82f6'},
      {k:'active',  l:'Ativas',     v:stats.active,             fmt:v=>v,            color:'#10b981'},
      {k:'paused',  l:'Pausadas',   v:stats.paused,             fmt:v=>v,            color:'#64748b'},
      {k:'critical',l:'Críticas',   v:stats.critical,           fmt:v=>v,            color:'#ef4444'},
      {k:'spend',   l:'Gasto Total',v:stats.spend,              fmt:v=>'$'+v.toFixed(2), color:'#f59e0b'},
      {k:'revenue', l:'Receita',    v:stats.revenue,            fmt:v=>'$'+v.toFixed(2), color:'#34d399'},
      {k:'roas_avg',l:'ROAS Médio', v:avgRoas,                  fmt:v=>v.toFixed(2)+'x', color: avgRoas>=3?'#10b981':avgRoas>0&&avgRoas<2?'#ef4444':'#94a3b8'},
      {k:'conv',    l:'Compras',    v:stats.conversions,        fmt:v=>v,            color:'#a78bfa'},
    ].map(s=>`
    <div class="rounded-xl p-3 flex flex-col" style="background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.4);">
      <p class="text-xs text-slate-500 truncate">${s.l}</p>
      <p class="text-base font-bold font-mono mt-0.5 truncate" style="color:${s.color};">${s.fmt(s.v)}</p>
    </div>`).join('')}
  </div>

  <!-- Controls row -->
  <div class="rounded-2xl p-3 space-y-2.5" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
    <!-- Period pills -->
    <div class="flex items-center gap-1.5 flex-wrap">
      ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'}].map(p=>`
      <button @click="setPeriod('${p.v}')" :class="period==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
      <span x-show="loading" class="ml-1 text-xs text-slate-500"><i class="fas fa-circle-notch fa-spin"></i> atualizando...</span>
      ${this.lastUpdated ? `<span class="ml-auto text-xs text-slate-600 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>atualizado ${this.lastUpdated}</span>` : ''}
    </div>
    <!-- Filters + columns -->
    <div class="flex flex-wrap gap-2 items-center">
      <div class="relative flex-1 min-w-[140px]">
        <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
        <input x-model="search" type="text" placeholder="Buscar campanha ou conta..." class="w-full bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/50 placeholder-slate-600">
      </div>
      <select x-model="filterStatus" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
        <option value="all">Status: Todos</option>
        <option value="active">Ativas</option>
        <option value="paused">Pausadas</option>
      </select>
      <select x-model="filterHealth" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
        <option value="all">Saúde: Todas</option>
        <option value="good">Saudável</option>
        <option value="warning">Atenção</option>
        <option value="critical">Crítica</option>
      </select>
      <select x-model="sortBy" class="bg-slate-800/60 border border-slate-700/50 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">
        <option value="spend">Ordenar: Gasto</option>
        <option value="revenue">Receita</option>
        <option value="roas">ROAS</option>
        <option value="cpa">Custo/Compra</option>
        <option value="conversions">Compras</option>
        <option value="checkouts">Finalizações</option>
        <option value="link_clicks">Cliques Link</option>
        <option value="impressions">Impressões</option>
        <option value="connect_rate">Connect Rate</option>
        <option value="purchase_per_ic">Taxa Compra/IC</option>
      </select>
      <!-- Column picker toggle -->
      <div class="relative">
        <button @click="showColMenu=!showColMenu" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-700/50 bg-slate-800/60 transition-all">
          <i class="fas fa-table-columns"></i> Colunas
        </button>
        <div x-show="showColMenu" @click.outside="showColMenu=false"
          class="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-2xl z-50 p-2 overflow-y-auto"
          style="background:#1e293b;border:1px solid rgba(51,65,85,0.7);max-height:280px;display:none;">
          ${allCols.map(k=>`
          <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/40 cursor-pointer text-xs text-slate-300">
            <input type="checkbox" :checked="visibleCols.includes('${k}')"
              @change="visibleCols.includes('${k}') ? visibleCols=visibleCols.filter(c=>c!=='${k}') : visibleCols.push('${k}')"
              class="accent-blue-500 w-3.5 h-3.5">
            ${this.COL_LABELS[k]}
          </label>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div x-show="loading" class="flex items-center justify-center py-16">
    <div class="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
  </div>

  <!-- Full Metrics Table -->
  <div x-show="!loading" class="rounded-2xl overflow-hidden" style="background:rgba(30,41,59,0.6);border:1px solid rgba(51,65,85,0.4);">
    <div class="overflow-x-auto">
      <table class="w-full text-xs" style="min-width:900px;">
        <thead>
          <tr style="background:rgba(15,23,42,0.8);border-bottom:1px solid rgba(51,65,85,0.5);">
            <th class="text-left px-3 py-2.5 text-slate-400 font-semibold sticky left-0 z-10 min-w-[200px]" style="background:rgba(15,23,42,0.95);">Campanha</th>
            <th class="px-2 py-2.5 text-slate-500 font-medium">Status</th>
            ${vis.map(k=>`<th @click="toggleSort('${k}')" class="px-2.5 py-2.5 text-slate-400 font-semibold cursor-pointer hover:text-white whitespace-nowrap text-right">
              ${this.COL_LABELS[k]}
              <i class="fas fa-sort ml-0.5 text-slate-600 text-xs" :class="sortBy==='${k}'?(sortDir==='desc'?'fa-sort-down text-blue-400':'fa-sort-up text-blue-400'):'fa-sort'"></i>
            </th>`).join('')}
            <th class="px-2 py-2.5 text-slate-500 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          <template x-if="filtered.length===0">
            <tr><td :colspan="${vis.length+3}" class="text-center py-12 text-slate-500">
              <i class="fas fa-inbox text-2xl mb-2 block"></i>Nenhuma campanha encontrada
            </td></tr>
          </template>
          <template x-for="c in filtered" :key="c.id">
            <tr class="border-b transition-colors cursor-pointer group" style="border-color:rgba(51,65,85,0.3);"
              :class="selectedId===c.id?'bg-blue-500/5':'hover:bg-slate-800/30'"
              @click="selectedId=selectedId===c.id?null:c.id">
              <!-- Name cell (sticky) -->
              <td class="px-3 py-2.5 sticky left-0 z-10" :style="selectedId===c.id?'background:rgba(59,130,246,0.07)':'background:rgba(30,41,59,0.97)'">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" :class="healthDot(health(c))"></span>
                  <div class="min-w-0">
                    <p class="text-white font-medium truncate max-w-[160px]" x-text="c.name"></p>
                    <p class="text-slate-500 truncate max-w-[160px]" x-text="c.account||''"></p>
                  </div>
                </div>
              </td>
              <!-- Status -->
              <td class="px-2 py-2.5 text-center">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold"
                  :style="c.status==='active'?'background:rgba(16,185,129,0.12);color:#10b981':'background:rgba(100,116,139,0.12);color:#94a3b8'">
                  <span class="w-1 h-1 rounded-full" :class="c.status==='active'?'bg-emerald-500':'bg-slate-500'"></span>
                  <span x-text="c.status==='active'?'Ativa':'Pausada'"></span>
                </span>
              </td>
              <!-- Metric cells -->
              ${vis.map(k=>`<td class="px-2.5 py-2.5 text-right font-mono whitespace-nowrap" :style="'${this.metricColor(k,0)}'" x-text="fmtMetric('${k}', c['${k}'])"></td>`).join('')}
              <!-- Actions -->
              <td class="px-2 py-2.5 text-center">
                <div class="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="c.status==='active'?pauseCampaign(c.id):activateCampaign(c.id)"
                    :disabled="actionLoading[c.id]"
                    class="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                    :class="c.status==='active'?'bg-red-500/15 text-red-400 hover:bg-red-500/25':'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'">
                    <i :class="actionLoading[c.id]?'fas fa-spinner animate-spin':c.status==='active'?'fas fa-pause':'fas fa-play'"></i>
                  </button>
                  <button @click.stop="$dispatch('navigate',{page:'chat'})" class="px-2 py-1 rounded-lg text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all">
                    <i class="fas fa-robot"></i>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div class="px-4 py-2 text-xs text-slate-600 border-t" style="border-color:rgba(51,65,85,0.3);">
      <span x-text="filtered.length+' de '+campaigns.length+' campanhas'"></span>
      <span class="ml-3">• Clique na linha para mais detalhes • Arraste para ver mais colunas →</span>
    </div>
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
Alpine.data('KnowledgePage', () => {

  // ── Country metadata ──────────────────────────────────────────────────────
  const COUNTRY_INFO = {
    mx:{flag:'🇲🇽',name:'México'},
    br:{flag:'🇧🇷',name:'Brasil'},
    us:{flag:'🇺🇸',name:'Estados Unidos'},
    ar:{flag:'🇦🇷',name:'Argentina'},
    co:{flag:'🇨🇴',name:'Colômbia'},
    cl:{flag:'🇨🇱',name:'Chile'},
    pe:{flag:'🇵🇪',name:'Peru'},
    ec:{flag:'🇪🇨',name:'Equador'},
    uy:{flag:'🇺🇾',name:'Uruguai'},
    py:{flag:'🇵🇾',name:'Paraguai'},
    bo:{flag:'🇧🇴',name:'Bolívia'},
    ve:{flag:'🇻🇪',name:'Venezuela'},
    ca:{flag:'🇨🇦',name:'Canadá'},
    es:{flag:'🇪🇸',name:'Espanha'},
    pt:{flag:'🇵🇹',name:'Portugal'},
    gb:{flag:'🇬🇧',name:'Reino Unido'},
    de:{flag:'🇩🇪',name:'Alemanha'},
    fr:{flag:'🇫🇷',name:'França'},
    it:{flag:'🇮🇹',name:'Itália'},
    au:{flag:'🇦🇺',name:'Austrália'},
    other:{flag:'🌍',name:'Outros'},
  };

  const EMPTY_PRODUCT = { name:'', country:'', shopify_code:'', campaign_type:'', cpa_target:0, roas_target:0, avg_ticket:0, peak_months:'', creative_types:'', notes:'' };

  return {
    activeTab: 'products',
    products: [],
    knowledge: [],
    campaigns: [],
    selectedCountry: null,
    productSearch: '',
    expandedCamps: {},
    showProductModal: false,
    showKnowledgeModal: false,
    editProductId: null,
    editKnowledgeId: null,
    productForm: {...EMPTY_PRODUCT},
    knowledgeForm: { category:'market', title:'', content:'' },
    saving: false,

    async init() {
      await this.load();
      window.addEventListener('page-refresh', () => this.load());
    },

    async load() {
      const [products, knowledge, camps] = await Promise.all([
        API.get('/api/ai-products'),
        API.get('/api/knowledge-base'),
        API.get('/api/campaigns?period=last_30d'),
      ]);
      if (products) this.products = products;
      if (knowledge) this.knowledge = knowledge;
      if (camps) this.campaigns = camps;
    },

    // ── Country helpers ─────────────────────────────────────────────────────
    countryInfo(code) {
      return COUNTRY_INFO[(code||'').toLowerCase()] || COUNTRY_INFO.other;
    },

    get byCountry() {
      const map = {};
      this.products.forEach(p => {
        const c = (p.country || '').trim().toLowerCase() || 'other';
        if (!map[c]) map[c] = { code: c, ...this.countryInfo(c), products: [], totalCpaTarget: 0, totalRoasTarget: 0 };
        map[c].products.push(p);
        map[c].totalCpaTarget += Number(p.cpa_target) || 0;
        map[c].totalRoasTarget += Number(p.roas_target) || 0;
      });
      return Object.values(map).sort((a,b) => b.products.length - a.products.length);
    },

    get currentCountryInfo() {
      if (!this.selectedCountry) return null;
      return this.countryInfo(this.selectedCountry);
    },

    get filteredProducts() {
      const prods = this.selectedCountry
        ? this.products.filter(p => (p.country||'').toLowerCase() === this.selectedCountry)
        : this.products;
      if (!this.productSearch) return prods;
      const q = this.productSearch.toLowerCase();
      return prods.filter(p =>
        (p.name||'').toLowerCase().includes(q) ||
        (p.shopify_code||'').toLowerCase().includes(q)
      );
    },

    // ── Campaign name parser ────────────────────────────────────────────────
    // Format: [country] [type] [product name] [start date] - shopify_code
    parseCampaignName(name) {
      const brackets = (name.match(/\[([^\]]+)\]/g) || []).map(m => m.slice(1,-1).trim());
      const dashIdx = name.lastIndexOf(' - ');
      const shopify_code = dashIdx >= 0 ? name.slice(dashIdx + 3).trim() : '';
      return {
        country:      (brackets[0] || '').toLowerCase(),
        type:         (brackets[1] || '').toLowerCase(),
        product_name: brackets[2] || '',
        start_date:   brackets[3] || '',
        shopify_code,
      };
    },

    matchedCampaigns(product) {
      if (!this.campaigns.length) return [];
      const pCountry = (product.country || '').toLowerCase();
      const pCode    = (product.shopify_code || '').toLowerCase();
      const pName    = (product.name || '').toLowerCase();
      return this.campaigns.filter(c => {
        const parsed = this.parseCampaignName(c.name || '');
        const countryMatch = !pCountry || parsed.country === pCountry;
        const codeMatch    = pCode && parsed.shopify_code.toLowerCase() === pCode;
        const nameMatch    = pName.length >= 3 && parsed.product_name.toLowerCase().includes(pName.substring(0, Math.min(pName.length, 8)));
        return countryMatch && (codeMatch || nameMatch);
      });
    },

    toggleCamps(prodId) {
      this.expandedCamps = { ...this.expandedCamps, [prodId]: !this.expandedCamps[prodId] };
    },

    fmtMoney(n) {
      if (!n) return '$0';
      return '$' + Number(n).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2});
    },

    roasColor(r) {
      if (r >= 4) return '#10b981';
      if (r >= 2) return '#f59e0b';
      if (r > 0)  return '#ef4444';
      return '#64748b';
    },

    campStatusColor(s) {
      return s==='active'?'#10b981':s==='paused'?'#64748b':'#ef4444';
    },

    // ── Product CRUD ────────────────────────────────────────────────────────
    openProductModal(p) {
      if (p) { this.productForm = {...EMPTY_PRODUCT, ...p}; this.editProductId = p.id; }
      else {
        this.productForm = {...EMPTY_PRODUCT, country: this.selectedCountry || ''};
        this.editProductId = null;
      }
      this.showProductModal = true;
    },

    async saveProduct() {
      if (!this.productForm.name)    { toast('warning','Nome do produto é obrigatório'); return; }
      if (!this.productForm.country) { toast('warning','País é obrigatório'); return; }
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

    // ── Knowledge CRUD ──────────────────────────────────────────────────────
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
        toast('success','Conhecimento salvo!');
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

  <!-- ── Tabs ────────────────────────────────────────────────────────────── -->
  <div class="glass rounded-2xl overflow-hidden">
    <div class="flex flex-wrap border-b border-slate-700/40">
      ${[
        {id:'products', label:'Produtos por País', icon:'fa-box'},
        {id:'knowledge',label:'Base de Conhecimento',icon:'fa-brain'},
        {id:'preview',  label:'Preview do Prompt',   icon:'fa-eye'},
      ].map(t=>`
      <button @click="activeTab='${t.id}'; selectedCountry=null" class="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px"
              :class="activeTab==='${t.id}' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'">
        <i class="fas ${t.icon} text-xs"></i>${t.label}
      </button>`).join('')}
    </div>

    <!-- ══ PRODUCTS TAB ══════════════════════════════════════════════════ -->
    <div x-show="activeTab==='products'">

      <!-- Header bar -->
      <div class="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style="border-bottom:1px solid rgba(51,65,85,0.3);">
        <div class="flex items-center gap-3 min-w-0">
          <!-- Breadcrumb -->
          <template x-if="!selectedCountry">
            <div class="flex items-center gap-2">
              <i class="fas fa-earth-americas text-blue-400"></i>
              <span class="text-white font-semibold">Todos os Países</span>
              <span class="badge badge-blue text-xs" x-text="byCountry.length + ' países'"></span>
              <span class="badge text-xs" style="background:rgba(51,65,85,0.5);color:#94a3b8;" x-text="products.length + ' produtos'"></span>
            </div>
          </template>
          <template x-if="selectedCountry">
            <div class="flex items-center gap-2">
              <button @click="selectedCountry=null; productSearch=''" class="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                <i class="fas fa-chevron-left text-xs"></i> Países
              </button>
              <span class="text-slate-600">/</span>
              <span class="text-2xl" x-text="currentCountryInfo?.flag"></span>
              <span class="text-white font-semibold" x-text="currentCountryInfo?.name"></span>
              <span class="badge badge-blue text-xs" x-text="filteredProducts.length + ' produtos'"></span>
            </div>
          </template>
        </div>
        <div class="flex items-center gap-2">
          <!-- Search (only in country view) -->
          <template x-if="selectedCountry">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input x-model="productSearch" type="text" placeholder="Buscar produto ou código..." class="input-field pl-8 py-1.5 text-sm" style="width:220px;">
            </div>
          </template>
          <button @click="openProductModal(null)"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all flex-shrink-0"
                  style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
            <i class="fas fa-plus text-xs"></i> Novo Produto
          </button>
        </div>
      </div>

      <!-- ── Countries grid view ── -->
      <div x-show="!selectedCountry" class="p-5">
        <template x-if="byCountry.length === 0">
          <div class="text-center py-16 border border-dashed border-slate-700/50 rounded-2xl">
            <i class="fas fa-earth-americas text-slate-600 text-5xl mb-4 block"></i>
            <p class="text-slate-400 font-medium mb-1">Nenhum produto cadastrado ainda</p>
            <p class="text-slate-500 text-sm">Comece adicionando um produto e definindo o país de veiculação</p>
          </div>
        </template>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          <template x-for="c in byCountry" :key="c.code">
            <div @click="selectedCountry=c.code; productSearch=''"
                 class="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] group"
                 style="background:rgba(30,41,59,0.5);border:1px solid rgba(51,65,85,0.5);"
                 onmouseover="this.style.borderColor='rgba(59,130,246,0.4)';this.style.background='rgba(30,41,59,0.8)'"
                 onmouseout="this.style.borderColor='rgba(51,65,85,0.5)';this.style.background='rgba(30,41,59,0.5)'">
              <!-- Flag -->
              <div class="text-4xl mb-3 text-center" x-text="c.flag"></div>
              <!-- Country name -->
              <p class="text-white font-bold text-sm text-center mb-1" x-text="c.name"></p>
              <p class="text-slate-500 text-xs text-center uppercase tracking-widest mb-3" x-text="c.code === 'other' ? '' : c.code.toUpperCase()"></p>
              <!-- Stats -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500">Produtos</span>
                  <span class="text-blue-400 font-bold" x-text="c.products.length"></span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500">CPA Médio</span>
                  <span class="text-amber-400 font-mono" x-text="c.products.length > 0 ? '$'+(c.totalCpaTarget/c.products.length).toFixed(2) : '—'"></span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500">ROAS Médio</span>
                  <span class="font-mono font-bold" :style="'color:'+roasColor(c.products.length>0?c.totalRoasTarget/c.products.length:0)" x-text="c.products.length > 0 ? (c.totalRoasTarget/c.products.length).toFixed(1)+'x' : '—'"></span>
                </div>
              </div>
              <!-- Arrow -->
              <div class="mt-3 flex justify-center">
                <i class="fas fa-chevron-right text-slate-600 group-hover:text-blue-400 text-xs transition-colors"></i>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ── Products list for selected country ── -->
      <div x-show="selectedCountry" class="p-5 space-y-3">
        <template x-if="filteredProducts.length === 0">
          <div class="text-center py-12 border border-dashed border-slate-700/50 rounded-2xl">
            <i class="fas fa-box-open text-slate-600 text-4xl mb-3 block"></i>
            <p class="text-slate-400 text-sm" x-text="productSearch ? 'Nenhum produto encontrado para a busca.' : 'Nenhum produto neste país ainda.'"></p>
          </div>
        </template>

        <template x-for="p in filteredProducts" :key="p.id">
          <div class="rounded-2xl overflow-hidden transition-all" style="background:rgba(22,32,52,0.6);border:1px solid rgba(51,65,85,0.4);">

            <!-- Product header -->
            <div class="px-5 py-4">
              <div class="flex items-start gap-3">
                <!-- Icon -->
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                     style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.2);">
                  <i class="fas fa-box text-blue-400"></i>
                </div>

                <!-- Name + badges -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p class="text-white font-bold text-base leading-tight" x-text="p.name"></p>
                      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        <!-- Shopify code -->
                        <template x-if="p.shopify_code">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold" style="background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.25);">
                            <i class="fas fa-tag text-xs"></i>
                            <span x-text="p.shopify_code"></span>
                          </span>
                        </template>
                        <!-- Campaign type -->
                        <template x-if="p.campaign_type">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold uppercase" style="background:rgba(139,92,246,0.12);color:#a78bfa;border:1px solid rgba(139,92,246,0.25);" x-text="p.campaign_type"></span>
                        </template>
                        <!-- Country badge -->
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs" style="background:rgba(51,65,85,0.5);color:#94a3b8;" x-text="(countryInfo(p.country).flag + ' ' + (p.country||'').toUpperCase())"></span>
                      </div>
                    </div>
                    <!-- Actions -->
                    <div class="flex gap-1.5 flex-shrink-0">
                      <button @click="openProductModal(p)" class="w-8 h-8 rounded-lg bg-slate-700/40 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 flex items-center justify-center transition-all">
                        <i class="fas fa-pencil text-xs"></i>
                      </button>
                      <button @click="deleteProduct(p.id)" class="w-8 h-8 rounded-lg bg-slate-700/40 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all">
                        <i class="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Metrics grid -->
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">CPA Meta</p>
                  <p class="text-amber-400 font-mono font-bold text-sm" x-text="(p.cpa_target||0)>0?fmtMoney(p.cpa_target):'—'"></p>
                </div>
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">ROAS Meta</p>
                  <p class="font-mono font-bold text-sm" :style="'color:'+roasColor(p.roas_target||0)" x-text="(p.roas_target||0)>0?Number(p.roas_target).toFixed(1)+'x':'—'"></p>
                </div>
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">Ticket Médio</p>
                  <p class="text-slate-300 font-mono font-bold text-sm" x-text="(p.avg_ticket||0)>0?fmtMoney(p.avg_ticket):'—'"></p>
                </div>
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">Tipo Camp.</p>
                  <p class="text-violet-400 font-bold text-sm uppercase" x-text="p.campaign_type||'—'"></p>
                </div>
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">Pico</p>
                  <p class="text-slate-400 text-xs font-medium" x-text="p.peak_months||'—'"></p>
                </div>
                <div class="rounded-xl p-3 text-center" style="background:rgba(15,23,42,0.5);">
                  <p class="text-slate-500 text-xs mb-0.5">Criativos</p>
                  <p class="text-slate-400 text-xs font-medium line-clamp-1" x-text="p.creative_types||'—'"></p>
                </div>
              </div>

              <!-- Notes -->
              <template x-if="p.notes">
                <div class="mt-3 px-3 py-2 rounded-lg text-xs text-slate-400 italic" style="background:rgba(51,65,85,0.2);border-left:2px solid rgba(59,130,246,0.3);" x-text="p.notes"></div>
              </template>
            </div>

            <!-- ── Campaign analysis section ── -->
            <div style="border-top:1px solid rgba(51,65,85,0.3);">
              <button @click="toggleCamps(p.id)"
                      class="w-full flex items-center justify-between px-5 py-3 text-xs font-medium transition-colors hover:bg-slate-700/20"
                      :class="expandedCamps[p.id] ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'">
                <div class="flex items-center gap-2">
                  <i class="fas fa-chart-bar text-xs"></i>
                  <span>Campanhas relacionadas</span>
                  <span class="px-1.5 py-0.5 rounded-md font-bold" style="background:rgba(59,130,246,0.15);color:#60a5fa;" x-text="matchedCampaigns(p).length"></span>
                  <span class="text-slate-600 text-xs" x-show="matchedCampaigns(p).length > 0">• últimos 30d</span>
                </div>
                <i class="fas transition-transform" :class="expandedCamps[p.id]?'fa-chevron-up':'fa-chevron-down'"></i>
              </button>

              <!-- Campaigns list -->
              <div x-show="expandedCamps[p.id]" x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" style="display:none;">
                <template x-if="matchedCampaigns(p).length === 0">
                  <div class="px-5 pb-4 text-center">
                    <p class="text-slate-600 text-xs italic">Nenhuma campanha com esse código/nome nos últimos 30 dias.</p>
                    <p class="text-slate-700 text-xs mt-1">Verifique se o código Shopify ou nome do produto bate com os nomes de campanha.</p>
                  </div>
                </template>
                <template x-if="matchedCampaigns(p).length > 0">
                  <div class="px-4 pb-4 space-y-2">
                    <!-- Campaign name parser guide -->
                    <div class="px-3 py-2 rounded-lg text-xs mb-3" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);">
                      <div class="flex items-center gap-2 flex-wrap text-slate-500">
                        <span class="text-blue-400 font-bold font-mono">[país]</span>
                        <span class="text-violet-400 font-bold font-mono">[tipo]</span>
                        <span class="text-green-400 font-bold font-mono">[produto]</span>
                        <span class="text-amber-400 font-bold font-mono">[data]</span>
                        <span class="text-slate-500 font-mono">- shopify_code</span>
                      </div>
                    </div>

                    <template x-for="camp in matchedCampaigns(p)" :key="camp.id">
                      <div class="rounded-xl p-3" style="background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.3);">
                        <!-- Parsed name display -->
                        <div class="flex items-start justify-between gap-2 mb-2.5">
                          <div class="min-w-0 flex-1">
                            <!-- Rendered parts -->
                            <div class="flex items-center gap-1 flex-wrap text-xs font-mono mb-1">
                              <template x-if="parseCampaignName(camp.name).country">
                                <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(59,130,246,0.15);color:#60a5fa;" x-text="'['+parseCampaignName(camp.name).country+']'"></span>
                              </template>
                              <template x-if="parseCampaignName(camp.name).type">
                                <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(139,92,246,0.15);color:#a78bfa;" x-text="'['+parseCampaignName(camp.name).type+']'"></span>
                              </template>
                              <template x-if="parseCampaignName(camp.name).product_name">
                                <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(16,185,129,0.12);color:#34d399;" x-text="'['+parseCampaignName(camp.name).product_name+']'"></span>
                              </template>
                              <template x-if="parseCampaignName(camp.name).start_date">
                                <span class="px-1.5 py-0.5 rounded" style="background:rgba(245,158,11,0.12);color:#fbbf24;" x-text="'['+parseCampaignName(camp.name).start_date+']'"></span>
                              </template>
                              <template x-if="parseCampaignName(camp.name).shopify_code">
                                <span class="text-slate-600">-</span>
                                <span class="px-1.5 py-0.5 rounded font-bold" style="background:rgba(51,65,85,0.4);color:#94a3b8;" x-text="parseCampaignName(camp.name).shopify_code"></span>
                              </template>
                            </div>
                            <p class="text-slate-600 text-xs truncate" x-text="camp.name"></p>
                          </div>
                          <span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0" :style="'background:'+campStatusColor(camp.status)+'20;color:'+campStatusColor(camp.status)" x-text="camp.status==='active'?'Ativa':camp.status==='paused'?'Pausada':'Inativa'"></span>
                        </div>
                        <!-- Metrics row -->
                        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          <div class="text-center p-1.5 rounded-lg" style="background:rgba(51,65,85,0.2);">
                            <p class="text-blue-300 font-bold text-xs" x-text="'$'+Number(camp.spend||0).toFixed(2)"></p>
                            <p class="text-slate-600 text-xs">Gasto</p>
                          </div>
                          <div class="text-center p-1.5 rounded-lg" style="background:rgba(51,65,85,0.2);">
                            <p class="text-green-400 font-bold text-xs" x-text="camp.conversions||0"></p>
                            <p class="text-slate-600 text-xs">Conv.</p>
                          </div>
                          <div class="text-center p-1.5 rounded-lg" style="background:rgba(51,65,85,0.2);">
                            <p class="font-bold text-xs" :style="'color:'+roasColor(camp.roas||0)" x-text="(camp.roas||0)>0?Number(camp.roas).toFixed(2)+'x':'—'"></p>
                            <p class="text-slate-600 text-xs">ROAS</p>
                          </div>
                          <div class="text-center p-1.5 rounded-lg" style="background:rgba(51,65,85,0.2);">
                            <p class="text-amber-400 font-bold text-xs" x-text="(camp.cpa||0)>0?'$'+Number(camp.cpa).toFixed(2):'—'"></p>
                            <p class="text-slate-600 text-xs">CPA</p>
                          </div>
                          <div class="text-center p-1.5 rounded-lg hidden sm:block" style="background:rgba(51,65,85,0.2);">
                            <p class="text-slate-400 font-bold text-xs" x-text="Number(camp.ctr||0).toFixed(2)+'%'"></p>
                            <p class="text-slate-600 text-xs">CTR</p>
                          </div>
                          <div class="text-center p-1.5 rounded-lg hidden sm:block" style="background:rgba(51,65,85,0.2);">
                            <p class="text-emerald-400 font-bold text-xs" x-text="(camp.revenue||0)>0?'$'+Number(camp.revenue).toFixed(2):'—'"></p>
                            <p class="text-slate-600 text-xs">Receita</p>
                          </div>
                        </div>
                        <!-- CPA vs target comparison -->
                        <template x-if="(camp.cpa||0) > 0 && (p.cpa_target||0) > 0">
                          <div class="mt-2 flex items-center gap-2 text-xs">
                            <span class="text-slate-500">CPA atual vs meta:</span>
                            <span :class="(camp.cpa||0) <= (p.cpa_target||0) ? 'text-green-400' : 'text-red-400'" class="font-bold"
                                  x-text="(camp.cpa<=p.cpa_target ? '✓ dentro da meta' : '✗ acima da meta +'+((camp.cpa-p.cpa_target)/p.cpa_target*100).toFixed(0)+'%')"></span>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>

          </div>
        </template>
      </div>
    </div>

    <!-- ══ KNOWLEDGE TAB ═════════════════════════════════════════════════ -->
    <div x-show="activeTab==='knowledge'" class="p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-white font-semibold">Base de Conhecimento</p>
          <p class="text-slate-400 text-xs mt-0.5">Informações que o gestor IA usará nas análises</p>
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
          <div class="flex flex-wrap gap-2 justify-center mt-4">
            ${[
              {cat:'market',  label:'Mercado',    ex:'E-commerce de suplementos, nicho fitness'},
              {cat:'audience',label:'Público',    ex:'Mulheres 25-45, interesse em saúde'},
              {cat:'creative',label:'Criativos',  ex:'UGC com depoimentos funciona melhor'},
              {cat:'strategy',label:'Estratégia', ex:'CBO com 3-5 adsets por campanha'},
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

    <!-- ══ PREVIEW TAB ═══════════════════════════════════════════════════ -->
    <div x-show="activeTab==='preview'" class="p-5">
      <p class="text-slate-400 text-sm mb-4">Resumo do que o gestor IA sabe sobre o seu negócio:</p>
      <div class="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-4 font-mono text-xs text-slate-300 leading-relaxed max-h-96 overflow-y-auto space-y-3">
        <div x-show="products.length > 0">
          <p class="text-blue-400 font-semibold">## PRODUTOS E METAS (por país):</p>
          <template x-for="p in products" :key="p.id">
            <p x-text="'• ['+((p.country||'?').toUpperCase())+'] '+p.name+(p.shopify_code?' ('+p.shopify_code+')':'')+': CPA $'+Number(p.cpa_target).toFixed(2)+' | ROAS '+Number(p.roas_target).toFixed(1)+'x | Ticket $'+Number(p.avg_ticket).toFixed(0)+(p.campaign_type?' | '+p.campaign_type.toUpperCase():'')"></p>
          </template>
        </div>
        <div x-show="knowledge.length > 0">
          <p class="text-emerald-400 font-semibold">## CONHECIMENTO DO NEGÓCIO:</p>
          <template x-for="k in knowledge" :key="k.id">
            <p x-text="'['+catLabel(k.category)+'] '+k.title+': '+k.content"></p>
          </template>
        </div>
        <template x-if="products.length===0 && knowledge.length===0">
          <p class="text-slate-500 italic">Nenhum conhecimento cadastrado ainda.</p>
        </template>
      </div>
    </div>
  </div>

  <!-- ══ PRODUCT MODAL ══════════════════════════════════════════════════════ -->
  <div x-show="showProductModal" @click="showProductModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
    <div @click.stop style="width:100%;max-width:580px;max-height:92vh;overflow-y:auto;border-radius:16px;padding:1.5rem;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-white font-bold text-lg" x-text="editProductId ? 'Editar Produto' : 'Novo Produto'"></h3>
        <button @click="showProductModal=false" class="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-400 hover:text-white flex items-center justify-center"><i class="fas fa-times text-sm"></i></button>
      </div>
      <div class="space-y-4">

        <!-- Section: Identificação -->
        <div class="rounded-xl p-3 space-y-3" style="background:rgba(15,23,42,0.4);border:1px solid rgba(51,65,85,0.3);">
          <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">Identificação</p>
          <div>
            <label class="text-slate-400 text-xs font-medium block mb-1.5">Nome do Produto *</label>
            <input x-model="productForm.name" type="text" placeholder="Ex: Suplemento XYZ" class="input-field w-full">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">País *</label>
              <input x-model="productForm.country" type="text" placeholder="mx, br, us, ar..."
                     class="input-field w-full font-mono uppercase"
                     style="text-transform:lowercase;">
              <p class="text-slate-600 text-xs mt-1">Código ISO do país (ex: mx, br, co)</p>
            </div>
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">Código Shopify</label>
              <input x-model="productForm.shopify_code" type="text" placeholder="Ex: 123456789" class="input-field w-full font-mono">
            </div>
          </div>
          <div>
            <label class="text-slate-400 text-xs font-medium block mb-1.5">Tipo de Campanha</label>
            <div class="flex gap-2 flex-wrap">
              ${['ABO','CBO','ABO Alpha','CBO Alpha','Remarketing','Prospecting'].map(t=>`
              <button type="button" @click="productForm.campaign_type = productForm.campaign_type==='${t}' ? '' : '${t}'"
                      :class="productForm.campaign_type==='${t}' ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all">${t}</button>`).join('')}
              <input x-model="productForm.campaign_type" type="text" placeholder="outro..." class="input-field py-1.5 text-xs" style="width:90px;">
            </div>
          </div>
        </div>

        <!-- Section: Metas financeiras -->
        <div class="rounded-xl p-3 space-y-3" style="background:rgba(15,23,42,0.4);border:1px solid rgba(51,65,85,0.3);">
          <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">Metas Financeiras</p>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">CPA Meta ($)</label>
              <input x-model.number="productForm.cpa_target" type="number" step="0.01" min="0" class="input-field w-full">
            </div>
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">ROAS Meta</label>
              <input x-model.number="productForm.roas_target" type="number" step="0.1" min="0" class="input-field w-full">
            </div>
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">Ticket Médio ($)</label>
              <input x-model.number="productForm.avg_ticket" type="number" step="0.01" min="0" class="input-field w-full">
            </div>
          </div>
        </div>

        <!-- Section: Contexto -->
        <div class="rounded-xl p-3 space-y-3" style="background:rgba(15,23,42,0.4);border:1px solid rgba(51,65,85,0.3);">
          <p class="text-slate-400 text-xs font-semibold uppercase tracking-wider">Contexto Estratégico</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">Meses de Pico</label>
              <input x-model="productForm.peak_months" type="text" placeholder="Nov, Dez, Jan" class="input-field w-full">
            </div>
            <div>
              <label class="text-slate-400 text-xs font-medium block mb-1.5">Tipos de Criativo</label>
              <input x-model="productForm.creative_types" type="text" placeholder="UGC, VSL, Carrossel" class="input-field w-full">
            </div>
          </div>
          <div>
            <label class="text-slate-400 text-xs font-medium block mb-1.5">Notas Estratégicas</label>
            <textarea x-model="productForm.notes" rows="3" placeholder="Informações importantes para o gestor sobre este produto..." class="input-field w-full resize-none"></textarea>
          </div>
        </div>

      </div>
      <div class="flex gap-3 mt-5">
        <button @click="showProductModal=false" class="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm">Cancelar</button>
        <button @click="saveProduct()" :disabled="saving" class="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all" style="background:linear-gradient(135deg,#3b82f6,#2563eb);">
          <span x-text="saving ? 'Salvando...' : 'Salvar Produto'"></span>
        </button>
      </div>
    </div>
    </div>
  </div>

  <!-- ══ KNOWLEDGE MODAL ══════════════════════════════════════════════════ -->
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
          <textarea x-model="knowledgeForm.content" rows="5" placeholder="Descreva este conhecimento em detalhes..." class="input-field w-full resize-none"></textarea>
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
    },
  };
});

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
  period: 'last_30d',
  loading: false,
  charts: {},
  activeTab: 'overview',
  _periodDays: {today:1,yesterday:1,last_7d:7,last_14d:14,last_30d:30,last_90d:90},

  async init() {
    await this.load();
    window.addEventListener('page-refresh', () => this.load());
  },

  async setPeriod(p) { this.period = p; await this.load(); },

  async load() {
    this.loading = true;
    const days = this._periodDays[this.period] || 30;
    const r = await API.get(`/api/analysis/overview?days=${days}`);
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
    <div class="flex gap-1.5 flex-wrap">
      ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'}].map(p=>`
      <button @click="setPeriod('${p.v}')" :class="period==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
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
