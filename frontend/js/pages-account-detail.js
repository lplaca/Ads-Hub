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
    expandedAdset: {},
    ads: {},
    adsLoading: {},
    demographics: null,
    demographicsLoading: false,
    demoView: 'gender',
    demoPickerOpen: false,
    demoCols: ['impressions', 'clicks', 'ctr', 'conversions', 'cpa', 'roas', 'revenue'],
    PERIODS,

    async init() {
      // Load immediately if navigated here with an account already set
      if (window._selectedAccountId) {
        await this.load();
      }
    },

    onNav() {
      this.account = null;
      this.campaigns = [];
      this.expandedCamp = {};
      this.adsets = {};
      this.expandedAdset = {};
      this.ads = {};
      this.demographics = null;
      this.load();
    },

    get accId() { return window._selectedAccountId; },

    periodLabel() {
      const p = PERIODS.find(p => p.value === this.period);
      return p ? p.label : this.period;
    },

    async load() {
      if (!this.accId) { console.warn('[AccountDetail] load() called but no accId'); return; }
      this.loading = true;
      this.campaigns = [];
      this.expandedCamp = {};
      this.adsets = {};

      let url = `/api/accounts/${this.accId}/overview?period=${this.period}`;
      if (this.period === 'custom' && this.customFrom && this.customTo) {
        url = `/api/accounts/${this.accId}/overview?period=custom&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      console.log('[AccountDetail] fetching', url);
      const data = await API.get(url);
      console.log('[AccountDetail] data received:', data);
      if (data) {
        this.account = data;
        this.campaigns = data.campaigns || [];
        this.loadDemographics();
      } else {
        console.error('[AccountDetail] API.get returned null — check network tab for errors');
      }
      this.loading = false;
    },

    toggleDemoCol(key) {
      const idx = this.demoCols.indexOf(key);
      if (idx === -1) this.demoCols.push(key);
      else this.demoCols.splice(idx, 1);
    },

    async loadDemographics() {
      if (!this.accId) return;
      this.demographicsLoading = true;
      this.demographics = null;
      let url = `/api/accounts/${this.accId}/demographics?period=${this.period}`;
      if (this.period === 'custom' && this.customFrom && this.customTo) {
        url = `/api/accounts/${this.accId}/demographics?period=custom&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      const data = await API.get(url);
      this.demographics = data || null;
      this.demographicsLoading = false;
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

    async toggleAds(campId, adsetId) {
      const key = `${campId}_${adsetId}`;
      const open = this.expandedAdset[key];
      this.expandedAdset = { ...this.expandedAdset, [key]: !open };
      if (!open && !this.ads[key]) {
        await this.loadAds(campId, adsetId);
      }
    },

    async loadAds(campId, adsetId) {
      const key = `${campId}_${adsetId}`;
      this.adsLoading = { ...this.adsLoading, [key]: true };
      let url = `/api/accounts/${this.accId}/campaigns/${campId}/adsets/${adsetId}/ads?period=${this.period}`;
      if (this.period === 'custom' && this.customFrom && this.customTo) {
        url += `&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      const data = await API.get(url);
      this.ads = { ...this.ads, [key]: data || [] };
      this.adsLoading = { ...this.adsLoading, [key]: false };
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
                <div>
                <!-- Adset row desktop -->
                <div class="hidden lg:grid px-8 py-2.5 items-center gap-2 hover:bg-blue-500/5 transition-colors cursor-pointer" @click="toggleAds(camp.id, as.id)" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 100px; background:rgba(15,23,42,0.3); border-bottom:1px solid rgba(51,65,85,0.15);">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-1 h-4 rounded-full flex-shrink-0" :style="'background:'+statusColor(as.status)"></div>
                    <i class="fas text-slate-600 text-xs flex-shrink-0" :class="expandedAdset[camp.id+'_'+as.id]?'fa-chevron-down':'fa-chevron-right'"></i>
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
                <div class="lg:hidden px-6 py-2.5 flex items-center gap-2 cursor-pointer" @click="toggleAds(camp.id, as.id)" style="background:rgba(15,23,42,0.3); border-bottom:1px solid rgba(51,65,85,0.15);">
                  <div class="w-1 h-6 rounded-full flex-shrink-0" :style="'background:'+statusColor(as.status)"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <i class="fas text-slate-600 text-xs" :class="expandedAdset[camp.id+'_'+as.id]?'fa-chevron-down':'fa-chevron-right'"></i>
                      <p class="text-slate-300 text-xs truncate" x-text="as.name"></p>
                    </div>
                    <div class="flex gap-3 mt-1">
                      <span class="text-blue-300 text-xs" x-text="fmtMoney(as.spend)"></span>
                      <span class="text-green-300 text-xs" x-text="(as.conversions||0)+' conv'"></span>
                      <span class="text-xs font-semibold" :style="'color:'+roasColor(as.roas||0)" x-text="(as.roas||0)>0?fmt(as.roas,2)+'x ROAS':'—'"></span>
                    </div>
                  </div>
                </div>

                <!-- Ads rows (expanded from adset) -->
                <div x-show="expandedAdset[camp.id+'_'+as.id]" style="display:none;">
                  <div x-show="adsLoading[camp.id+'_'+as.id]" class="px-12 py-3 flex items-center gap-2 text-slate-500 text-xs" style="background:rgba(8,14,28,0.5);">
                    <i class="fas fa-circle-notch fa-spin text-purple-400"></i> Carregando anúncios...
                  </div>
                  <div x-show="!adsLoading[camp.id+'_'+as.id] && ads[camp.id+'_'+as.id] && ads[camp.id+'_'+as.id].length===0"
                       class="px-12 py-2.5 text-slate-600 text-xs italic" style="background:rgba(8,14,28,0.5);">
                    Nenhum anúncio encontrado.
                  </div>
                  <template x-if="!adsLoading[camp.id+'_'+as.id] && ads[camp.id+'_'+as.id] && ads[camp.id+'_'+as.id].length>0">
                    <div>
                      <!-- Ads header -->
                      <div class="hidden lg:grid px-12 py-1.5 text-xs text-slate-700 font-semibold uppercase tracking-wider" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 80px; background:rgba(8,14,28,0.6);">
                        <span>Anúncio</span>
                        <span class="text-right">Status</span>
                        <span class="text-right">Gasto</span>
                        <span class="text-right">Impr.</span>
                        <span class="text-right">Cliques</span>
                        <span class="text-right">CTR</span>
                        <span class="text-right">Conv.</span>
                        <span class="text-right">ROAS</span>
                        <span class="text-right">CPA</span>
                      </div>
                      <template x-for="ad in ads[camp.id+'_'+as.id]" :key="ad.id">
                        <div class="hidden lg:grid px-12 py-2 items-center gap-2 hover:bg-purple-500/5 transition-colors" style="grid-template-columns: 2fr 80px 90px 80px 80px 70px 80px 80px 80px; background:rgba(8,14,28,0.4); border-bottom:1px solid rgba(51,65,85,0.1);">
                          <div class="flex items-center gap-2 min-w-0">
                            <div class="w-1 h-3 rounded-full flex-shrink-0" :style="'background:'+statusColor(ad.status)"></div>
                            <p class="text-slate-400 text-xs truncate" x-text="ad.name"></p>
                          </div>
                          <div class="text-right">
                            <span class="text-xs" :class="ad.status==='active'?'text-purple-400':'text-slate-600'" x-text="statusLabel(ad.status)"></span>
                          </div>
                          <p class="text-purple-300 text-xs text-right" x-text="fmtMoney(ad.spend)"></p>
                          <p class="text-slate-600 text-xs text-right" x-text="fmtBig(ad.impressions)"></p>
                          <p class="text-slate-600 text-xs text-right" x-text="fmtBig(ad.clicks)"></p>
                          <p class="text-slate-600 text-xs text-right" x-text="fmt(ad.ctr,2)+'%'"></p>
                          <p class="text-green-400 text-xs text-right" x-text="ad.conversions||0"></p>
                          <p class="text-xs text-right font-semibold" :style="'color:'+roasColor(ad.roas||0)" x-text="(ad.roas||0)>0?fmt(ad.roas,2)+'x':'—'"></p>
                          <p class="text-amber-400 text-xs text-right" x-text="(ad.cpa||0)>0?fmtMoney(ad.cpa):'—'"></p>
                        </div>
                        <!-- Mobile ad -->
                        <div class="lg:hidden px-10 py-2 flex items-center gap-2" style="background:rgba(8,14,28,0.4); border-bottom:1px solid rgba(51,65,85,0.1);">
                          <div class="w-1 h-5 rounded-full flex-shrink-0" :style="'background:'+statusColor(ad.status)"></div>
                          <div class="flex-1 min-w-0">
                            <p class="text-slate-400 text-xs truncate" x-text="ad.name"></p>
                            <div class="flex gap-3 mt-0.5">
                              <span class="text-purple-300 text-xs" x-text="fmtMoney(ad.spend)"></span>
                              <span class="text-green-300 text-xs" x-text="(ad.conversions||0)+' conv'"></span>
                              <span class="text-xs font-semibold" :style="'color:'+roasColor(ad.roas||0)" x-text="(ad.roas||0)>0?fmt(ad.roas,2)+'x':'—'"></span>
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
          </template>
        </div>
      </div>
    </template>
  </div>

  <!-- ── Análise de Público ─────────────────────────────────────────────── -->
  <div x-show="!loading && account" class="glass rounded-2xl overflow-hidden">

    <!-- Header -->
    <div class="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style="border-bottom:1px solid rgba(51,65,85,0.4);">
      <div class="flex items-center gap-2.5">
        <i class="fas fa-users text-violet-400 text-sm"></i>
        <h3 class="text-white font-semibold text-sm">Análise de Público</h3>
        <span class="badge text-xs" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);">Meta Breakdowns</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Metrics picker button -->
          <button @click="demoPickerOpen=!demoPickerOpen"
            :class="demoPickerOpen ? 'bg-violet-600/30 text-violet-300 border-violet-500/40' : 'text-slate-400 border-slate-700/50 hover:text-violet-300 hover:border-violet-500/30'"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5">
            <i class="fas fa-sliders text-xs"></i>
            Métricas
            <span class="ml-0.5 px-1.5 py-0.5 rounded-md text-xs font-bold" style="background:rgba(139,92,246,0.25);color:#c4b5fd;" x-text="demoCols.length"></span>
          </button>

          <!-- Picker modal overlay -->
          <div x-show="demoPickerOpen" @click="demoPickerOpen=false"
               x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
               class="fixed inset-0 z-[200] flex items-center justify-center p-4"
               style="display:none;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);">
          <div @click.stop class="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
               style="background:rgba(15,23,42,0.99);border:1px solid rgba(139,92,246,0.3);">
            <div class="px-4 py-3 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.4);">
              <p class="text-white font-semibold text-sm">Selecionar Métricas</p>
              <div class="flex items-center gap-3">
                <button @click="demoCols=['impressions','clicks','ctr','conversions','cpa','roas','revenue']" class="text-xs text-slate-500 hover:text-violet-400 transition-colors">Padrão</button>
                <button @click="demoCols=[]" class="text-xs text-slate-500 hover:text-red-400 transition-colors">Limpar</button>
                <button @click="demoPickerOpen=false" class="text-slate-500 hover:text-white transition-colors"><i class="fas fa-times text-xs"></i></button>
              </div>
            </div>
            <div class="p-3 space-y-3 overflow-y-auto" style="max-height:420px;">

              <!-- Group: Alcance -->
              <div>
                <p class="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Alcance</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <template x-for="m in [{key:'impressions',label:'Impressões'},{key:'reach',label:'Alcance'},{key:'clicks',label:'Cliques'},{key:'link_clicks',label:'Cliques no Link'}]" :key="m.key">
                    <button @click="toggleDemoCol(m.key)"
                      :class="demoCols.includes(m.key) ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs text-left">
                      <i class="fas text-xs transition-colors" :class="demoCols.includes(m.key) ? 'fa-check-square text-violet-400' : 'fa-square'"></i>
                      <span x-text="m.label"></span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Group: Taxas -->
              <div>
                <p class="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Taxas</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <template x-for="m in [{key:'ctr',label:'CTR'},{key:'cpc_link',label:'CPC Link'},{key:'lp_view_rate',label:'Taxa LP View'},{key:'connect_rate',label:'Connect Rate'}]" :key="m.key">
                    <button @click="toggleDemoCol(m.key)"
                      :class="demoCols.includes(m.key) ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs text-left">
                      <i class="fas text-xs" :class="demoCols.includes(m.key) ? 'fa-check-square text-violet-400' : 'fa-square'"></i>
                      <span x-text="m.label"></span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Group: Funil -->
              <div>
                <p class="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Funil</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <template x-for="m in [{key:'lpv',label:'Visitas LP'},{key:'checkouts',label:'Checkouts'},{key:'conversions',label:'Conversões'},{key:'checkout_per_lpv',label:'Checkout/LPV'},{key:'purchase_per_ic',label:'Compra/Clique'}]" :key="m.key">
                    <button @click="toggleDemoCol(m.key)"
                      :class="demoCols.includes(m.key) ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs text-left">
                      <i class="fas text-xs" :class="demoCols.includes(m.key) ? 'fa-check-square text-violet-400' : 'fa-square'"></i>
                      <span x-text="m.label"></span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Group: Financeiro -->
              <div>
                <p class="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Financeiro</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <template x-for="m in [{key:'revenue',label:'Receita'},{key:'roas',label:'ROAS'},{key:'cpa',label:'CPA'},{key:'cost_per_checkout',label:'Custo/Checkout'},{key:'cost_per_lp',label:'Custo/LP View'}]" :key="m.key">
                    <button @click="toggleDemoCol(m.key)"
                      :class="demoCols.includes(m.key) ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs text-left">
                      <i class="fas text-xs" :class="demoCols.includes(m.key) ? 'fa-check-square text-violet-400' : 'fa-square'"></i>
                      <span x-text="m.label"></span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Group: Vídeo -->
              <div>
                <p class="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1.5 px-1">Vídeo</p>
                <div class="grid grid-cols-2 gap-1.5">
                  <template x-for="m in [{key:'video_3s',label:'Vídeo 3s'},{key:'video_thru',label:'ThruPlay'}]" :key="m.key">
                    <button @click="toggleDemoCol(m.key)"
                      :class="demoCols.includes(m.key) ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs text-left">
                      <i class="fas text-xs" :class="demoCols.includes(m.key) ? 'fa-check-square text-violet-400' : 'fa-square'"></i>
                      <span x-text="m.label"></span>
                    </button>
                  </template>
                </div>
              </div>

            </div>
            <div class="px-4 py-2.5 flex items-center justify-between" style="border-top:1px solid rgba(51,65,85,0.4);">
              <p class="text-slate-600 text-xs" x-text="demoCols.length + ' métrica(s) ativa(s)'"></p>
              <button @click="demoPickerOpen=false" class="btn btn-primary btn-xs">Aplicar</button>
            </div>
          </div>
          </div>

        <!-- Tab switcher -->
        <div class="flex items-center gap-1 p-1 rounded-lg" style="background:rgba(15,23,42,0.6);">
          <button @click="demoView='gender'"
            :class="demoView==='gender' ? 'bg-violet-600/40 text-violet-300 border-violet-500/40' : 'text-slate-500 border-transparent hover:text-slate-300'"
            class="px-3 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
            <i class="fas fa-venus-mars text-xs"></i> Gênero
          </button>
          <button @click="demoView='age'"
            :class="demoView==='age' ? 'bg-violet-600/40 text-violet-300 border-violet-500/40' : 'text-slate-500 border-transparent hover:text-slate-300'"
            class="px-3 py-1 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
            <i class="fas fa-chart-bar text-xs"></i> Faixa Etária
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div x-show="demographicsLoading" class="px-5 py-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
      <i class="fas fa-circle-notch fa-spin text-violet-400"></i> Carregando dados de público...
    </div>

    <!-- No data -->
    <div x-show="!demographicsLoading && demographics && demographics.by_gender.length === 0" class="px-5 py-8 text-center text-slate-500 text-sm">
      <i class="fas fa-users-slash text-slate-600 text-2xl mb-2 block"></i>
      Nenhum dado de público disponível para o período selecionado.
    </div>

    <!-- ── Gender view ── -->
    <div x-show="!demographicsLoading && demographics && demoView==='gender' && demographics.by_gender.length > 0" class="p-5">
      <template x-if="demographics && demographics.by_gender.length > 0">
        <div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <template x-for="row in demographics.by_gender" :key="row.gender">
              <div class="rounded-xl p-4" style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);">
                <!-- Card header -->
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       :style="row.gender==='male' ? 'background:rgba(59,130,246,0.2)' : row.gender==='female' ? 'background:rgba(236,72,153,0.2)' : 'background:rgba(100,116,139,0.2)'">
                    <i class="fas text-sm" :class="row.gender==='male' ? 'fa-mars text-blue-400' : row.gender==='female' ? 'fa-venus text-pink-400' : 'fa-genderless text-slate-400'"></i>
                  </div>
                  <div>
                    <p class="text-white font-semibold text-sm" x-text="row.gender_label"></p>
                    <p class="text-slate-500 text-xs" x-text="fmtMoney(row.spend) + ' gasto'"></p>
                  </div>
                </div>
                <!-- Spend bar -->
                <div class="mb-3">
                  <div class="h-1.5 rounded-full" style="background:rgba(51,65,85,0.5);">
                    <div class="h-full rounded-full transition-all"
                         :style="'width:' + (demographics.by_gender[0].spend > 0 ? Math.round(row.spend / demographics.by_gender[0].spend * 100) : 0) + '%;background:' + (row.gender==='male' ? 'rgba(59,130,246,0.7)' : row.gender==='female' ? 'rgba(236,72,153,0.7)' : 'rgba(100,116,139,0.5)')"></div>
                  </div>
                </div>
                <!-- Dynamic metric grid — only selected cols -->
                <div x-show="demoCols.length > 0" class="grid grid-cols-2 gap-1.5">
                  <div x-show="demoCols.includes('impressions')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.impressions)"></p><p class="text-slate-500 text-xs">Impressões</p></div>
                  <div x-show="demoCols.includes('reach')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.reach)"></p><p class="text-slate-500 text-xs">Alcance</p></div>
                  <div x-show="demoCols.includes('clicks')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.clicks)"></p><p class="text-slate-500 text-xs">Cliques</p></div>
                  <div x-show="demoCols.includes('link_clicks')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.link_clicks)"></p><p class="text-slate-500 text-xs">Cliques Link</p></div>
                  <div x-show="demoCols.includes('ctr')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmt(row.ctr,2)+'%'"></p><p class="text-slate-500 text-xs">CTR</p></div>
                  <div x-show="demoCols.includes('cpc_link')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="(row.cpc_link||0)>0?fmtMoney(row.cpc_link):'—'"></p><p class="text-slate-500 text-xs">CPC Link</p></div>
                  <div x-show="demoCols.includes('lp_view_rate')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmt(row.lp_view_rate,2)+'%'"></p><p class="text-slate-500 text-xs">Taxa LP View</p></div>
                  <div x-show="demoCols.includes('connect_rate')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmt(row.connect_rate,2)+'%'"></p><p class="text-slate-500 text-xs">Connect Rate</p></div>
                  <div x-show="demoCols.includes('lpv')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.lpv)"></p><p class="text-slate-500 text-xs">Visitas LP</p></div>
                  <div x-show="demoCols.includes('checkouts')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="row.checkouts||0"></p><p class="text-slate-500 text-xs">Checkouts</p></div>
                  <div x-show="demoCols.includes('conversions')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-green-400 font-semibold text-sm" x-text="row.conversions||0"></p><p class="text-slate-500 text-xs">Conversões</p></div>
                  <div x-show="demoCols.includes('checkout_per_lpv')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmt(row.checkout_per_lpv,2)+'%'"></p><p class="text-slate-500 text-xs">Checkout/LPV</p></div>
                  <div x-show="demoCols.includes('purchase_per_ic')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmt(row.purchase_per_ic,2)+'%'"></p><p class="text-slate-500 text-xs">Compra/Clique</p></div>
                  <div x-show="demoCols.includes('revenue')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-emerald-400 font-semibold text-sm" x-text="(row.revenue||0)>0?fmtMoney(row.revenue):'—'"></p><p class="text-slate-500 text-xs">Receita</p></div>
                  <div x-show="demoCols.includes('roas')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="font-semibold text-sm" :style="'color:'+roasColor(row.roas||0)" x-text="(row.roas||0)>0?fmt(row.roas,2)+'x':'—'"></p><p class="text-slate-500 text-xs">ROAS</p></div>
                  <div x-show="demoCols.includes('cpa')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-amber-400 font-semibold text-sm" x-text="(row.cpa||0)>0?fmtMoney(row.cpa):'—'"></p><p class="text-slate-500 text-xs">CPA</p></div>
                  <div x-show="demoCols.includes('cost_per_checkout')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-amber-400 font-semibold text-sm" x-text="(row.cost_per_checkout||0)>0?fmtMoney(row.cost_per_checkout):'—'"></p><p class="text-slate-500 text-xs">Custo/Checkout</p></div>
                  <div x-show="demoCols.includes('cost_per_lp')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-amber-400 font-semibold text-sm" x-text="(row.cost_per_lp||0)>0?fmtMoney(row.cost_per_lp):'—'"></p><p class="text-slate-500 text-xs">Custo/LP View</p></div>
                  <div x-show="demoCols.includes('video_3s')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.video_3s)"></p><p class="text-slate-500 text-xs">Vídeo 3s</p></div>
                  <div x-show="demoCols.includes('video_thru')" class="text-center p-1.5 rounded-lg" style="background:rgba(15,23,42,0.4);"><p class="text-slate-300 font-semibold text-sm" x-text="fmtBig(row.video_thru)"></p><p class="text-slate-500 text-xs">ThruPlay</p></div>
                </div>
                <p x-show="demoCols.length === 0" class="text-slate-600 text-xs text-center py-2">Nenhuma métrica selecionada</p>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Age view ── -->
    <div x-show="!demographicsLoading && demographics && demoView==='age' && demographics.by_age.length > 0" class="overflow-x-auto">
      <template x-if="demographics && demographics.by_age.length > 0">
        <table class="w-full text-xs">
          <thead>
            <tr style="background:rgba(15,23,42,0.4);border-bottom:1px solid rgba(51,65,85,0.4);">
              <th class="text-left px-5 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Faixa</th>
              <th class="text-left px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap" style="min-width:160px">Gasto / Share</th>
              <th x-show="demoCols.includes('impressions')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Impressões</th>
              <th x-show="demoCols.includes('reach')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Alcance</th>
              <th x-show="demoCols.includes('clicks')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Cliques</th>
              <th x-show="demoCols.includes('link_clicks')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Cliques Link</th>
              <th x-show="demoCols.includes('ctr')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">CTR</th>
              <th x-show="demoCols.includes('cpc_link')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">CPC Link</th>
              <th x-show="demoCols.includes('lp_view_rate')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Taxa LP</th>
              <th x-show="demoCols.includes('connect_rate')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Connect Rate</th>
              <th x-show="demoCols.includes('lpv')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Visitas LP</th>
              <th x-show="demoCols.includes('checkouts')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Checkouts</th>
              <th x-show="demoCols.includes('conversions')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Conv.</th>
              <th x-show="demoCols.includes('checkout_per_lpv')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Checkout/LPV</th>
              <th x-show="demoCols.includes('purchase_per_ic')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Compra/Clique</th>
              <th x-show="demoCols.includes('revenue')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Receita</th>
              <th x-show="demoCols.includes('roas')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">ROAS</th>
              <th x-show="demoCols.includes('cpa')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">CPA</th>
              <th x-show="demoCols.includes('cost_per_checkout')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Custo/Checkout</th>
              <th x-show="demoCols.includes('cost_per_lp')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Custo/LP View</th>
              <th x-show="demoCols.includes('video_3s')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">Vídeo 3s</th>
              <th x-show="demoCols.includes('video_thru')" class="text-right px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">ThruPlay</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="row in demographics.by_age" :key="row.age">
              <tr class="hover:bg-violet-500/5 transition-colors" style="border-bottom:1px solid rgba(51,65,85,0.12);">
                <td class="px-5 py-3 whitespace-nowrap">
                  <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold" style="background:rgba(139,92,246,0.15);color:#c4b5fd;border:1px solid rgba(139,92,246,0.25);" x-text="row.age"></span>
                </td>
                <td class="px-3 py-3" style="min-width:160px">
                  <div class="flex items-center gap-2">
                    <span class="text-violet-300 font-semibold whitespace-nowrap" x-text="fmtMoney(row.spend)"></span>
                    <div class="flex-1 h-1.5 rounded-full" style="background:rgba(51,65,85,0.4);">
                      <div class="h-full rounded-full" style="background:rgba(139,92,246,0.55);transition:width 0.4s;"
                           :style="'width:' + (demographics.by_age.reduce((mx,r)=>Math.max(mx,r.spend),0) > 0 ? Math.round(row.spend / demographics.by_age.reduce((mx,r)=>Math.max(mx,r.spend),0) * 100) : 0) + '%'"></div>
                    </div>
                  </div>
                </td>
                <td x-show="demoCols.includes('impressions')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.impressions)"></td>
                <td x-show="demoCols.includes('reach')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.reach)"></td>
                <td x-show="demoCols.includes('clicks')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.clicks)"></td>
                <td x-show="demoCols.includes('link_clicks')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.link_clicks)"></td>
                <td x-show="demoCols.includes('ctr')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmt(row.ctr,2)+'%'"></td>
                <td x-show="demoCols.includes('cpc_link')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="(row.cpc_link||0)>0?fmtMoney(row.cpc_link):'—'"></td>
                <td x-show="demoCols.includes('lp_view_rate')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmt(row.lp_view_rate,2)+'%'"></td>
                <td x-show="demoCols.includes('connect_rate')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmt(row.connect_rate,2)+'%'"></td>
                <td x-show="demoCols.includes('lpv')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.lpv)"></td>
                <td x-show="demoCols.includes('checkouts')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="row.checkouts||0"></td>
                <td x-show="demoCols.includes('conversions')" class="px-3 py-3 text-right font-semibold text-green-400 whitespace-nowrap" x-text="row.conversions||0"></td>
                <td x-show="demoCols.includes('checkout_per_lpv')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmt(row.checkout_per_lpv,2)+'%'"></td>
                <td x-show="demoCols.includes('purchase_per_ic')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmt(row.purchase_per_ic,2)+'%'"></td>
                <td x-show="demoCols.includes('revenue')" class="px-3 py-3 text-right font-semibold text-emerald-400 whitespace-nowrap" x-text="(row.revenue||0)>0?fmtMoney(row.revenue):'—'"></td>
                <td x-show="demoCols.includes('roas')" class="px-3 py-3 text-right font-semibold whitespace-nowrap" :style="'color:'+roasColor(row.roas||0)" x-text="(row.roas||0)>0?fmt(row.roas,2)+'x':'—'"></td>
                <td x-show="demoCols.includes('cpa')" class="px-3 py-3 text-right text-amber-400 whitespace-nowrap" x-text="(row.cpa||0)>0?fmtMoney(row.cpa):'—'"></td>
                <td x-show="demoCols.includes('cost_per_checkout')" class="px-3 py-3 text-right text-amber-400 whitespace-nowrap" x-text="(row.cost_per_checkout||0)>0?fmtMoney(row.cost_per_checkout):'—'"></td>
                <td x-show="demoCols.includes('cost_per_lp')" class="px-3 py-3 text-right text-amber-400 whitespace-nowrap" x-text="(row.cost_per_lp||0)>0?fmtMoney(row.cost_per_lp):'—'"></td>
                <td x-show="demoCols.includes('video_3s')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.video_3s)"></td>
                <td x-show="demoCols.includes('video_thru')" class="px-3 py-3 text-right text-slate-400 whitespace-nowrap" x-text="fmtBig(row.video_thru)"></td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
    </div>
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
