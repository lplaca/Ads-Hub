/* ═══════════════════════════════════════════════════════════════════════════
   AccountDetailPage — Visão completa de uma conta de anúncio
   Campanhas + Conjuntos + KPIs + Seletor de período
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('alpine:init', () => {

Alpine.data('AccountDetailPage', function() {
  const PERIODS = [
    { value: 'today',      label: 'Hoje' },
    { value: 'yesterday',  label: 'Ontem' },
    { value: 'last_7d',    label: 'Últimos 7 dias' },
    { value: 'last_14d',   label: 'Últimos 14 dias' },
    { value: 'last_30d',   label: 'Últimos 30 dias' },
    { value: 'last_90d',   label: 'Máximo (90d)' },
    { value: 'custom',     label: 'Personalizado' },
  ];

  return {
    account: null,
    campaigns: [],
    loading: false,
    period: 'last_7d',
    customFrom: '',
    customTo: '',
    showCustom: false,
    expandedCamp: {},
    adsets: {},
    adsetsLoading: {},
    PERIODS,

    async init() {
      const id = window._selectedAccountId;
      if (!id) {
        this.$dispatch('navigate', { page: 'accounts' });
        return;
      }
      window.addEventListener('navigate', (e) => {
        if (e.detail?.page === 'account-detail') {
          this.account = null;
          this.campaigns = [];
          this.expandedCamp = {};
          this.adsets = {};
          this.load();
        }
      });
      await this.load();
    },

    get accId() { return window._selectedAccountId; },

    periodLabel() {
      const p = PERIODS.find(p => p.value === this.period);
      return p ? p.label : this.period;
    },

    async load() {
      if (!this.accId) return;
      this.loading = true;
      this.campaigns = [];
      this.expandedCamp = {};
      this.adsets = {};

      let url = `/api/accounts/${this.accId}/overview?period=${this.period}`;
      if (this.period === 'custom' && this.customFrom && this.customTo) {
        url = `/api/accounts/${this.accId}/overview?period=custom&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      const data = await API.get(url);
      if (data) {
        this.account = data;
        this.campaigns = data.campaigns || [];
      }
      this.loading = false;
    },

    async setPeriod(val) {
      this.period = val;
      this.showCustom = val === 'custom';
      if (val !== 'custom') await this.load();
    },

    async applyCustom() {
      if (!this.customFrom || !this.customTo) { toast('warning', 'Selecione as datas de início e fim'); return; }
      await this.load();
      this.showCustom = false;
    },

    async toggleAdsets(campId) {
      const open = this.expandedCamp[campId];
      this.expandedCamp = { ...this.expandedCamp, [campId]: !open };
      if (!open && !this.adsets[campId]) {
        await this.loadAdsets(campId);
      }
    },

    async loadAdsets(campId) {
      this.adsetsLoading = { ...this.adsetsLoading, [campId]: true };
      let url = `/api/accounts/${this.accId}/campaigns/${campId}/adsets?period=${this.period}`;
      if (this.period === 'custom' && this.customFrom && this.customTo) {
        url = `/api/accounts/${this.accId}/campaigns/${campId}/adsets?period=custom&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      const data = await API.get(url);
      this.adsets = { ...this.adsets, [campId]: data || [] };
      this.adsetsLoading = { ...this.adsetsLoading, [campId]: false };
    },

    statusColor(s) {
      return s === 'active' ? '#10b981' : s === 'paused' ? '#64748b' : '#ef4444';
    },
    statusLabel(s) {
      return { active: 'Ativa', paused: 'Pausada', deleted: 'Excluída', archived: 'Arquivada' }[s] || s;
    },
    statusBadge(s) {
      return s === 'active' ? 'badge-green' : 'badge badge-gray';
    },

    fmt(n, decimals = 0) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toFixed(decimals);
    },

    fmtMoney(n) {
      if (!n) return '$0';
      return '$' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fmtBig(n) {
      if (!n) return '0';
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    },

    roasColor(r) {
      if (r >= 4) return '#10b981';
      if (r >= 2) return '#f59e0b';
      if (r > 0) return '#ef4444';
      return '#64748b';
    },

    async pauseCampaign(campId, campName) {
      const r = await API.post(`/api/campaigns/${campId}/pause`, {});
      if (r?.status === 'success') {
        const c = this.campaigns.find(x => x.id === campId);
        if (c) c.status = 'paused';
        toast('success', `"${campName}" pausada!`);
      } else {
        toast('error', r?.message || 'Erro ao pausar campanha');
      }
    },

    async activateCampaign(campId, campName) {
      const r = await API.post(`/api/campaigns/${campId}/activate`, {});
      if (r?.status === 'success') {
        const c = this.campaigns.find(x => x.id === campId);
        if (c) c.status = 'active';
        toast('success', `"${campName}" ativada!`);
      } else {
        toast('error', r?.message || 'Erro ao ativar campanha');
      }
    },

    renderPage() {
      const acc = this.account;
      const m = acc?.metrics || {};
      return `
<div class="fade-in space-y-5">

  <!-- Back + Header -->
  <div class="flex items-center gap-3 flex-wrap">
    <button @click="$dispatch('navigate',{page:'accounts'})" class="btn btn-ghost btn-sm gap-1.5">
      <i class="fas fa-arrow-left text-xs"></i> Contas
    </button>
    <div class="flex items-center gap-2.5 flex-1 min-w-0">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,rgba(29,78,216,0.3),rgba(59,130,246,0.2));border:1px solid rgba(59,130,246,0.3);">
        <i class="fas fa-credit-card text-blue-400"></i>
      </div>
      <div class="min-w-0">
        <h2 class="text-white font-bold text-lg leading-tight truncate" x-text="account?.name || '...'"></h2>
        <p class="text-slate-500 text-xs font-mono" x-text="account?.account_id || ''"></p>
      </div>
    </div>

    <!-- Period Selector -->
    <div class="flex items-center gap-2 flex-wrap">
      <template x-for="p in PERIODS.filter(x=>x.value!=='custom')" :key="p.value">
        <button
          @click="setPeriod(p.value)"
          :class="period===p.value ? 'bg-blue-600/30 text-blue-300 border-blue-500/50' : 'text-slate-400 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'"
          class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
        ><span x-text="p.label"></span></button>
      </template>
      <button
        @click="setPeriod('custom')"
        :class="period==='custom' ? 'bg-blue-600/30 text-blue-300 border-blue-500/50' : 'text-slate-400 border-slate-700/50 hover:text-slate-300'"
        class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
      >Personalizado</button>
    </div>
  </div>

  <!-- Custom date range -->
  <div x-show="showCustom" x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0 -translate-y-2" x-transition:enter-end="opacity-100 translate-y-0"
       class="glass rounded-xl p-4 flex items-center gap-3 flex-wrap" style="display:none;">
    <label class="text-slate-400 text-sm">De:</label>
    <input type="date" x-model="customFrom" class="form-input py-1.5 text-sm" style="width:auto;" />
    <label class="text-slate-400 text-sm">Até:</label>
    <input type="date" x-model="customTo" class="form-input py-1.5 text-sm" style="width:auto;" />
    <button @click="applyCustom()" class="btn btn-primary btn-sm">Aplicar</button>
    <button @click="showCustom=false" class="btn btn-ghost btn-sm">Cancelar</button>
  </div>

  <!-- Loading -->
  <div x-show="loading" class="flex items-center justify-center py-16">
    <div class="text-center">
      <i class="fas fa-circle-notch fa-spin text-blue-400 text-3xl mb-3"></i>
      <p class="text-slate-400 text-sm">Carregando dados da Meta API...</p>
    </div>
  </div>

  <!-- KPI Cards -->
  <div x-show="!loading && account" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-blue-400 font-bold text-lg" x-text="fmtMoney(account?.metrics?.spend)"></p>
      <p class="text-slate-500 text-xs mt-0.5">Gasto</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-slate-300 font-bold text-lg" x-text="fmtBig(account?.metrics?.impressions)"></p>
      <p class="text-slate-500 text-xs mt-0.5">Impressões</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-slate-300 font-bold text-lg" x-text="fmtBig(account?.metrics?.clicks)"></p>
      <p class="text-slate-500 text-xs mt-0.5">Cliques</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-slate-300 font-bold text-lg" x-text="fmt(account?.metrics?.ctr,2)+'%'"></p>
      <p class="text-slate-500 text-xs mt-0.5">CTR</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-green-400 font-bold text-lg" x-text="account?.metrics?.conversions||0"></p>
      <p class="text-slate-500 text-xs mt-0.5">Conversões</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-emerald-400 font-bold text-lg" x-text="fmtMoney(account?.metrics?.revenue)"></p>
      <p class="text-slate-500 text-xs mt-0.5">Receita</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="font-bold text-lg" :style="'color:'+roasColor(account?.metrics?.roas||0)" x-text="fmt(account?.metrics?.roas,2)+'x'"></p>
      <p class="text-slate-500 text-xs mt-0.5">ROAS</p>
    </div>
    <div class="glass rounded-xl p-3 text-center">
      <p class="text-amber-400 font-bold text-lg" x-text="(account?.metrics?.cpa||0)>0 ? fmtMoney(account?.metrics?.cpa) : '—'"></p>
      <p class="text-slate-500 text-xs mt-0.5">CPA</p>
    </div>
  </div>

  <!-- Campaigns Table -->
  <div x-show="!loading && campaigns.length > 0" class="glass rounded-2xl overflow-hidden">
    <div class="px-5 py-3 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.4);">
      <div class="flex items-center gap-2.5">
        <i class="fas fa-bullhorn text-blue-400 text-sm"></i>
        <h3 class="text-white font-semibold text-sm">Campanhas</h3>
        <span class="badge badge-blue text-xs" x-text="campaigns.length + ' total'"></span>
        <span class="badge badge-green text-xs" x-text="campaigns.filter(c=>c.status==='active').length + ' ativas'"></span>
      </div>
      <p class="text-slate-500 text-xs" x-text="'Período: ' + periodLabel()"></p>
    </div>

    <!-- Table header -->
    <div class="hidden lg:grid px-4 py-2 text-xs text-slate-500 font-semibold uppercase tracking-wider" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 100px; border-bottom:1px solid rgba(51,65,85,0.3);">
      <span>Campanha</span>
      <span class="text-right">Status</span>
      <span class="text-right">Gasto</span>
      <span class="text-right">Impr.</span>
      <span class="text-right">Cliques</span>
      <span class="text-right">CTR</span>
      <span class="text-right">Conv.</span>
      <span class="text-right">ROAS</span>
      <span class="text-right">Ações</span>
    </div>

    <!-- Campaign rows -->
    <template x-for="camp in campaigns" :key="camp.id">
      <div>
        <!-- Campaign row -->
        <div class="px-4 py-3 flex items-center gap-2 hover:bg-slate-800/30 transition-colors" style="border-bottom:1px solid rgba(51,65,85,0.2);">
          <!-- Expand toggle -->
          <button @click="toggleAdsets(camp.id)" class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all" style="background:rgba(59,130,246,0.08);" :title="expandedCamp[camp.id]?'Fechar conjuntos':'Ver conjuntos de anúncios'">
            <i class="fas text-blue-400 text-xs transition-transform" :class="expandedCamp[camp.id] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
          </button>

          <!-- Desktop grid layout -->
          <div class="flex-1 hidden lg:grid items-center gap-2" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 100px;">
            <div class="min-w-0">
              <p class="text-white text-sm font-medium truncate" x-text="camp.name"></p>
              <p x-show="camp.daily_budget" class="text-slate-500 text-xs" x-text="'Budget: ' + fmtMoney(camp.daily_budget) + '/dia'"></p>
            </div>
            <div class="text-right">
              <span class="badge text-xs" :class="camp.status==='active'?'badge-green':''" x-text="statusLabel(camp.status)"></span>
            </div>
            <p class="text-blue-400 font-semibold text-sm text-right" x-text="fmtMoney(camp.spend)"></p>
            <p class="text-slate-400 text-sm text-right" x-text="fmtBig(camp.impressions)"></p>
            <p class="text-slate-400 text-sm text-right" x-text="fmtBig(camp.clicks)"></p>
            <p class="text-slate-400 text-sm text-right" x-text="fmt(camp.ctr,2)+'%'"></p>
            <p class="text-green-400 font-semibold text-sm text-right" x-text="camp.conversions||0"></p>
            <p class="font-bold text-sm text-right" :style="'color:'+roasColor(camp.roas||0)" x-text="(camp.roas||0)>0 ? fmt(camp.roas,2)+'x' : '—'"></p>
            <div class="flex justify-end gap-1.5">
              <button x-show="camp.status==='active'" @click="pauseCampaign(camp.id, camp.name)"
                class="px-2 py-1 rounded-lg text-xs font-medium transition-all hover:bg-red-500/20 text-red-400 border border-red-500/20">
                <i class="fas fa-pause text-xs"></i>
              </button>
              <button x-show="camp.status==='paused'" @click="activateCampaign(camp.id, camp.name)"
                class="px-2 py-1 rounded-lg text-xs font-medium transition-all hover:bg-green-500/20 text-green-400 border border-green-500/20">
                <i class="fas fa-play text-xs"></i>
              </button>
              <button @click="toggleAdsets(camp.id)"
                class="px-2 py-1 rounded-lg text-xs font-medium transition-all text-slate-400 border border-slate-700/50 hover:text-blue-400 hover:border-blue-500/30">
                <i class="fas fa-layer-group text-xs"></i>
              </button>
            </div>
          </div>

          <!-- Mobile layout -->
          <div class="flex-1 lg:hidden">
            <div class="flex items-start justify-between gap-2 mb-2">
              <p class="text-white text-sm font-medium leading-snug" x-text="camp.name"></p>
              <span class="badge text-xs flex-shrink-0" :class="camp.status==='active'?'badge-green':''">
                <span x-text="statusLabel(camp.status)"></span>
              </span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div><p class="text-blue-400 font-bold text-sm" x-text="fmtMoney(camp.spend)"></p><p class="text-slate-500 text-xs">Gasto</p></div>
              <div><p class="text-green-400 font-bold text-sm" x-text="camp.conversions||0"></p><p class="text-slate-500 text-xs">Conv.</p></div>
              <div><p class="font-bold text-sm" :style="'color:'+roasColor(camp.roas||0)" x-text="(camp.roas||0)>0?fmt(camp.roas,2)+'x':'—'"></p><p class="text-slate-500 text-xs">ROAS</p></div>
            </div>
            <div class="flex gap-1.5 mt-2">
              <button x-show="camp.status==='active'" @click="pauseCampaign(camp.id,camp.name)" class="btn btn-ghost btn-xs text-red-400"><i class="fas fa-pause"></i> Pausar</button>
              <button x-show="camp.status==='paused'" @click="activateCampaign(camp.id,camp.name)" class="btn btn-ghost btn-xs text-green-400"><i class="fas fa-play"></i> Ativar</button>
            </div>
          </div>
        </div>

        <!-- Ad Sets rows (expanded) -->
        <div x-show="expandedCamp[camp.id]" x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" style="display:none;">
          <!-- Loading adsets -->
          <div x-show="adsetsLoading[camp.id]" class="px-8 py-4 flex items-center gap-2 text-slate-500 text-sm" style="background:rgba(15,23,42,0.4);">
            <i class="fas fa-circle-notch fa-spin text-blue-400"></i> Carregando conjuntos...
          </div>
          <!-- Adsets empty -->
          <div x-show="!adsetsLoading[camp.id] && adsets[camp.id] && adsets[camp.id].length === 0"
               class="px-8 py-3 text-slate-500 text-sm italic" style="background:rgba(15,23,42,0.4);">
            Nenhum conjunto encontrado nesta campanha.
          </div>
          <!-- Adsets list -->
          <template x-if="!adsetsLoading[camp.id] && adsets[camp.id] && adsets[camp.id].length > 0">
            <div>
              <div class="hidden lg:grid px-8 py-1.5 text-xs text-slate-600 font-semibold uppercase tracking-wider" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 100px; background:rgba(15,23,42,0.5);">
                <span>Conjunto de Anúncios</span>
                <span class="text-right">Status</span>
                <span class="text-right">Gasto</span>
                <span class="text-right">Impr.</span>
                <span class="text-right">Cliques</span>
                <span class="text-right">CTR</span>
                <span class="text-right">Conv.</span>
                <span class="text-right">ROAS</span>
                <span class="text-right">Budget/dia</span>
              </div>
              <template x-for="as in adsets[camp.id]" :key="as.id">
                <div class="hidden lg:grid px-8 py-2.5 items-center gap-2 hover:bg-blue-500/5 transition-colors" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 100px; background:rgba(15,23,42,0.3); border-bottom:1px solid rgba(51,65,85,0.15);">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-1 h-4 rounded-full flex-shrink-0" :style="'background:'+statusColor(as.status)"></div>
                    <p class="text-slate-300 text-xs truncate" x-text="as.name"></p>
                  </div>
                  <div class="text-right">
                    <span class="text-xs" :class="as.status==='active'?'text-emerald-400':'text-slate-500'" x-text="statusLabel(as.status)"></span>
                  </div>
                  <p class="text-blue-300 text-xs text-right" x-text="fmtMoney(as.spend)"></p>
                  <p class="text-slate-500 text-xs text-right" x-text="fmtBig(as.impressions)"></p>
                  <p class="text-slate-500 text-xs text-right" x-text="fmtBig(as.clicks)"></p>
                  <p class="text-slate-500 text-xs text-right" x-text="fmt(as.ctr,2)+'%'"></p>
                  <p class="text-green-300 text-xs text-right" x-text="as.conversions||0"></p>
                  <p class="text-xs text-right font-semibold" :style="'color:'+roasColor(as.roas||0)" x-text="(as.roas||0)>0?fmt(as.roas,2)+'x':'—'"></p>
                  <p class="text-slate-500 text-xs text-right" x-text="as.daily_budget ? fmtMoney(as.daily_budget) : '—'"></p>
                </div>
                <!-- Mobile adset -->
                <div class="lg:hidden px-6 py-2.5 flex items-center gap-2" style="background:rgba(15,23,42,0.3); border-bottom:1px solid rgba(51,65,85,0.15);">
                  <div class="w-1 h-6 rounded-full flex-shrink-0" :style="'background:'+statusColor(as.status)"></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-slate-300 text-xs truncate" x-text="as.name"></p>
                    <div class="flex gap-3 mt-1">
                      <span class="text-blue-300 text-xs" x-text="fmtMoney(as.spend)"></span>
                      <span class="text-green-300 text-xs" x-text="(as.conversions||0)+' conv'"></span>
                      <span class="text-xs font-semibold" :style="'color:'+roasColor(as.roas||0)" x-text="(as.roas||0)>0?fmt(as.roas,2)+'x ROAS':'—'"></span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>

  <!-- Empty campaigns -->
  <div x-show="!loading && campaigns.length === 0 && account" class="glass rounded-2xl p-12 text-center">
    <i class="fas fa-bullhorn text-slate-600 text-4xl mb-4 block"></i>
    <p class="text-slate-400 font-medium mb-1">Nenhuma campanha encontrada</p>
    <p class="text-slate-500 text-sm">Esta conta não possui campanhas no período selecionado.</p>
  </div>

  <!-- No account selected -->
  <div x-show="!loading && !account" class="glass rounded-2xl p-12 text-center">
    <i class="fas fa-circle-exclamation text-slate-600 text-4xl mb-4 block"></i>
    <p class="text-slate-400 font-medium mb-1">Nenhuma conta selecionada</p>
    <button @click="$dispatch('navigate',{page:'accounts'})" class="btn btn-primary btn-sm mt-3">Ir para Contas</button>
  </div>

</div>`;
    },
  };
});

}); // end alpine:init
