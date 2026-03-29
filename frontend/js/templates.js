/* ═══════════════════════════════════════════════════════════════════════
   HTML Templates — injected via renderPage() on each Alpine component
   ═══════════════════════════════════════════════════════════════════════ */

document.addEventListener('alpine:init', () => {

// ── HELPERS shared inside templates ──────────────────────────────────────
// (bmName is now a method on AccountsPage component — uses this.bms at runtime)

// ══════════════════════════════════════════════════════════════════════════
//  BUSINESS MANAGERS — renderPage()
// ══════════════════════════════════════════════════════════════════════════
const _bmRender = Alpine.data('BmPage');  // grab existing registration — won't work this way

// Better: patch renderPage onto BmPage via a second alpine:init registration
// We'll use a different approach: add renderPage as a mixin

}); // end alpine:init for templates init

// ── Attach renderPage methods after alpine:init fires ────────────────────
// Alpine stores data factories; we patch them by re-registering with renderPage included.

document.addEventListener('alpine:init', () => {

// ── BmPage renderPage ─────────────────────────────────────────────────────
const _origBm = window.__BmPageDef;

Alpine.data('BmPage', function() {
  return {
    bms: [],
    accounts: [],
    expanded: {},
    showModal: false,
    showHelpBm: false,
    testing: false,
    testResult: null,
    showToken: false,
    saving: false,
    form: { name:'', bm_id:'', access_token:'' },
    editId: null,

    async init() {
      await this.loadData();
      window.addEventListener('page-refresh', () => this.loadData());
    },

    async loadData() {
      const [bms, accs] = await Promise.all([API.get('/api/bm'), API.get('/api/accounts')]);
      if (bms) this.bms = bms;
      if (accs) this.accounts = accs;
      await this.$store.meta.refresh();
    },

    toggleExpand(id) { this.expanded = {...this.expanded, [id]: !this.expanded[id]}; },
    getAccounts(bmId) { return this.accounts.filter(a => a.bm_id === bmId); },

    openModal(bm) {
      if (bm) { this.form = {name:bm.name, bm_id:bm.bm_id, access_token:''}; this.editId = bm.id; }
      else    { this.form = {name:'', bm_id:'', access_token:''}; this.editId = null; }
      this.testResult = null; this.showToken = false; this.showHelpBm = false; this.showModal = true;
    },

    async testConn() {
      if (!this.form.access_token) { toast('warning', 'Insira o access token primeiro'); return; }
      this.testing = true; this.testResult = null;
      const r = await API.post('/api/bm/test', { access_token: this.form.access_token, bm_id: this.form.bm_id });
      this.testing = false;
      this.testResult = (r?.status === 'success' || r?.status === 'demo') ? 'success' : 'error';
      toast(this.testResult === 'success' ? 'success' : 'error', r?.message || 'Erro ao testar conexão');
    },

    async saveBm() {
      if (!this.form.name || !this.form.bm_id || !this.form.access_token) { toast('warning', 'Preencha todos os campos'); return; }
      this.saving = true;
      if (this.editId) {
        const r = await API.put('/api/bm/' + this.editId, this.form);
        if (r) {
          const i = this.bms.findIndex(b => b.id === this.editId);
          if (i >= 0) this.bms[i] = {...this.bms[i], name:this.form.name, bm_id:this.form.bm_id, status:'connected'};
        }
        toast('success', 'BM atualizado!');
      } else {
        const r = await API.post('/api/bm', this.form);
        if (r?.status === 'success') {
          toast('success', r.message || 'BM adicionado!');
          await this.loadData();
        }
      }
      this.saving = false;
      this.showModal = false;
      await this.$store.meta.refresh();
    },

    async syncAccounts(bmId) {
      toast('info', 'Sincronizando contas...');
      const r = await API.post(`/api/bm/${bmId}/sync-accounts`, {});
      if (r?.status === 'success') {
        toast('success', r.message || 'Contas sincronizadas!');
        await this.loadData();
      } else {
        toast('error', 'Erro ao sincronizar contas');
      }
    },

    async deleteBm(id, name) {
      if (!confirm('Remover "' + name + '"? Esta ação não pode ser desfeita.')) return;
      await API.del('/api/bm/' + id);
      this.bms = this.bms.filter(b => b.id !== id);
      toast('success', 'BM removido!');
      await this.$store.meta.refresh();
    },

    renderPage() { return window.TPL.bm(this); },
  };
});

// ── AccountsPage renderPage ───────────────────────────────────────────────
Alpine.data('AccountsPage', function() {
  return {
    accounts: [],
    bms: [],
    metricsMap: {},
    metricsLoading: false,
    metricsPeriod: 'last_7d',
    customFrom: '', customTo: '', showCustom: false,
    search: '', filterBm: '', filterStatus: '',
    showModal: false, showHelpAcc: false, testing: false, testResult: null, showToken: false,
    saving: false,
    form: { name:'', account_id:'', bm_id:'', country:'BR', access_token:'' },
    editId: null,

    async init() {
      await this.loadData();
      window.addEventListener('page-refresh', () => this.loadData());
    },

    async loadData() {
      const [accs, bms] = await Promise.all([API.get('/api/accounts'), API.get('/api/bm')]);
      if (accs) this.accounts = accs;
      if (bms) this.bms = bms;
      this.loadMetrics();
    },

    async loadMetrics() {
      this.metricsLoading = true;
      let url = `/api/accounts/with-metrics?period=${this.metricsPeriod}`;
      if (this.metricsPeriod === 'custom' && this.customFrom && this.customTo) {
        url = `/api/accounts/with-metrics?period=custom&date_from=${this.customFrom}&date_to=${this.customTo}`;
      }
      const data = await API.get(url);
      if (data) {
        const map = {};
        data.forEach(a => { map[a.id] = a; });
        this.metricsMap = map;
      }
      this.metricsLoading = false;
    },

    async setMetricsPeriod(p) {
      this.metricsPeriod = p;
      this.showCustom = p === 'custom';
      if (p !== 'custom') { this.metricsMap = {}; await this.loadMetrics(); }
    },

    async applyCustom() {
      if (!this.customFrom || !this.customTo) { toast('warning', 'Selecione as datas'); return; }
      this.metricsMap = {};
      await this.loadMetrics();
      this.showCustom = false;
    },

    m(accId) { return this.metricsMap[accId] || {}; },

    viewAccount(acc) {
      window._selectedAccountId = acc.id;
      window._selectedAccountName = acc.name;
      this.$dispatch('navigate', { page: 'account-detail' });
    },

    get filtered() {
      return this.accounts.filter(a => {
        if (this.search && !a.name.toLowerCase().includes(this.search.toLowerCase()) && !a.account_id.includes(this.search)) return false;
        if (this.filterBm && a.bm_id !== this.filterBm) return false;
        if (this.filterStatus && a.status !== this.filterStatus) return false;
        return true;
      });
    },

    flagFor(code) {
      const map = {BR:'🇧🇷',US:'🇺🇸',MX:'🇲🇽',AR:'🇦🇷',CO:'🇨🇴',CL:'🇨🇱',PE:'🇵🇪',EC:'🇪🇨'};
      return map[code] || '🌍';
    },

    bmName(id) { return this.bms.find(b => b.id === id)?.name || id || '—'; },

    openModal(acc) {
      if (acc) { this.form = {name:acc.name, account_id:acc.account_id, bm_id:acc.bm_id||'', country:acc.country||'BR', access_token:''}; this.editId = acc.id; }
      else     { this.form = {name:'', account_id:'', bm_id:'', country:'BR', access_token:''}; this.editId = null; }
      this.testResult = null; this.showToken = false; this.showHelpAcc = false; this.showModal = true;
    },

    async testConn() {
      this.testing = true; this.testResult = null;
      const r = await API.post('/api/accounts/test', { account_id: this.form.account_id, access_token: this.form.access_token });
      this.testing = false;
      this.testResult = 'success';
      toast('success', r?.message || 'Conexão verificada!');
    },

    async saveAccount() {
      if (!this.form.name || !this.form.account_id || !this.form.access_token) { toast('warning', 'Preencha todos os campos obrigatórios'); return; }
      if (!this.form.account_id.startsWith('act_')) { toast('warning', 'ID deve começar com act_'); return; }
      const flag = this.flagFor(this.form.country);
      this.saving = true;
      if (this.editId) {
        const r = await API.put('/api/accounts/' + this.editId, this.form);
        if (r) {
          const i = this.accounts.findIndex(a => a.id === this.editId);
          if (i >= 0) this.accounts[i] = {...this.accounts[i], ...this.form, flag, status:'active'};
        }
        toast('success', 'Conta atualizada!');
      } else {
        const r = await API.post('/api/accounts', this.form);
        if (r?.id) this.accounts.push({ id:r.id, ...this.form, flag, status:'active', spend:0, conversions:0, roas:0, cpa:0 });
        toast('success', 'Conta "' + this.form.name + '" adicionada!');
      }
      this.saving = false;
      this.showModal = false;
      await this.$store.meta.refresh();
    },

    async deleteAccount(id, name) {
      if (!confirm('Remover "' + name + '"?')) return;
      await API.del('/api/accounts/' + id);
      this.accounts = this.accounts.filter(a => a.id !== id);
      toast('success', 'Conta removida!');
      await this.$store.meta.refresh();
    },

    renderPage() { return window.TPL.accounts(this); },
  };
});

// ── ProductsPage renderPage ───────────────────────────────────────────────
Alpine.data('ProductsPage', function() {
  return {
    period: 'last_7d',
    selected: null,
    chart: null,
    products: [],
    campaigns: [],

    async init() {
      const dash = await API.get(`/api/dashboard?period=${this.period}&view_by=product`);
      this.products = (dash && dash.by_product) || [];
      this.campaigns = (dash && dash.campaigns) || [];
      this.$nextTick(() => this.buildChart());
      this.$watch('period', async () => {
        const d = await API.get(`/api/dashboard?period=${this.period}&view_by=product`);
        this.products = (d && d.by_product) || [];
        this.campaigns = (d && d.campaigns) || [];
        this.$nextTick(() => this.buildChart());
      });
    },

    buildChart() {
      if (this.chart) { try { this.chart.destroy(); } catch {} }
      const el = document.getElementById('ch-products');
      if (!el || !this.products || !this.products.length) return;
      const prods = this.products;
      this.chart = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
          labels: prods.map(p => p.code || p.name || ''),
          datasets: [
            { label:'Investimento ($)', data: prods.map(p => p.invest||0), backgroundColor: hexToRgba('#3b82f6',0.75), borderColor:'#3b82f6', borderWidth:1, borderRadius:6 },
            { label:'Conversões x10', data: prods.map(p => (p.conversions||0)*10), backgroundColor: hexToRgba('#22c55e',0.75), borderColor:'#22c55e', borderWidth:1, borderRadius:6 },
            { label:'ROAS x100', data: prods.map(p => (p.roas||0)*100), backgroundColor: hexToRgba('#f59e0b',0.75), borderColor:'#f59e0b', borderWidth:1, borderRadius:6 },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{labels:{color:'#94a3b8',font:{size:11}}}, tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10} },
          scales:{ x:{grid:{display:false},ticks:{color:'#64748b',font:{size:13}}}, y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}} }
        }
      });
    },

    getCampaigns(code) { return (this.campaigns||[]).filter(c => (c.name||'').includes(code)); },

    renderPage() { return window.TPL.products(this); },
  };
});

// ── RulesPage renderPage ──────────────────────────────────────────────────
Alpine.data('RulesPage', function() {
  const METRICS = [
    { value:'spend',            label:'Gasto ($)',             group:'Básicas' },
    { value:'spend_pct',        label:'Gasto (% budget)',      group:'Básicas' },
    { value:'conversions',      label:'Conversões',             group:'Básicas' },
    { value:'checkouts',        label:'Checkouts',              group:'Básicas' },
    { value:'roas',             label:'ROAS',                   group:'Básicas' },
    { value:'cpa',              label:'CPA ($)',                group:'Básicas' },
    { value:'ctr',              label:'CTR (%)',                group:'Básicas' },
    { value:'created_today',    label:'Criada hoje',            group:'Temporal' },
    { value:'created_days_ago', label:'Criada há X dias',       group:'Temporal' },
    { value:'running_hours',    label:'Rodando há X horas',     group:'Temporal' },
    { value:'budget_remaining', label:'Budget restante ($)',    group:'Budget' },
    { value:'time_of_day',      label:'Horário do dia (0-23)', group:'Horário' },
    { value:'day_of_week',      label:'Dia da semana (0=Dom)', group:'Horário' },
  ];
  const OPERATORS = [
    { value:'>=', label:'>=' }, { value:'<=', label:'<=' },
    { value:'==', label:'=' }, { value:'>', label:'>' }, { value:'<', label:'<' },
  ];
  const ACTIONS = [
    { value:'pause',    label:'Pausar campanha',   icon:'fas fa-pause-circle', color:'#ef4444' },
    { value:'notify',   label:'Apenas notificar',  icon:'fas fa-bell',         color:'#f59e0b' },
    { value:'budget',   label:'Reduzir orçamento', icon:'fas fa-arrow-down',   color:'#a855f7' },
    { value:'activate', label:'Ativar campanha',   icon:'fas fa-play-circle',  color:'#22c55e' },
  ];
  return {
    rules: [],
    showModal: false,
    step: 1,
    saving: false,
    form: { name:'', conditions:[{metric:'spend',operator:'>=',value:5}], action:'pause', enabled:true },
    editId: null,
    METRICS, OPERATORS, ACTIONS,

    // AI Rule creation
    showAiModal: false,
    aiText: '',
    aiListening: false,
    aiLoading: false,
    aiError: '',
    aiPreview: null,
    aiConfigured: false,
    aiProvider: 'anthropic',
    _recognition: null,

    // Engine state
    engineRunning: false,
    engineResult: null,
    lastRun: null,

    async init() {
      await this.loadRules();
      window.addEventListener('page-refresh', () => this.loadRules());
      // Check if AI is configured
      const status = await API.get('/api/status');
      if (status) {
        this.aiConfigured = !!status.ai_configured;
        this.aiProvider = status.ai_provider || 'anthropic';
      }
      if (status?.last_engine_run) this.lastRun = status.last_engine_run;
    },

    async loadRules() {
      const data = await API.get('/api/rules');
      if (data) this.rules = data;
    },

    openModal(rule) {
      if (rule) {
        this.form = {name:rule.name, conditions:JSON.parse(JSON.stringify(rule.conditions)), action:rule.action, enabled:rule.enabled};
        this.editId = rule.id;
      } else {
        this.form = {name:'', conditions:[{metric:'spend',operator:'>=',value:5}], action:'pause', enabled:true};
        this.editId = null;
      }
      this.step = 1; this.showModal = true;
    },

    addCondition() { this.form.conditions.push({metric:'conversions',operator:'==',value:0}); },
    removeCondition(i) { if (this.form.conditions.length > 1) this.form.conditions.splice(i,1); },

    async toggleRule(id) {
      const r = this.rules.find(r => r.id===id);
      if (!r) return;
      r.enabled = !r.enabled;
      await API.put('/api/rules/' + id, { enabled: r.enabled });
      toast(r.enabled?'success':'info', '"'+r.name+'" '+(r.enabled?'ativada':'desativada')+'!');
    },

    async saveRule() {
      if (!this.form.name) { toast('warning','Dê um nome à regra'); return; }
      this.saving = true;
      if (this.editId) {
        await API.put('/api/rules/' + this.editId, this.form);
        const i = this.rules.findIndex(r => r.id===this.editId);
        if (i>=0) this.rules[i] = {...this.rules[i], ...this.form, conditions:JSON.parse(JSON.stringify(this.form.conditions))};
        toast('success','Regra atualizada!');
      } else {
        const r = await API.post('/api/rules', this.form);
        if (r?.id) this.rules.push({id:r.id, ...this.form, conditions:JSON.parse(JSON.stringify(this.form.conditions)), trigger_count:0});
        toast('success','Regra "'+this.form.name+'" criada!');
      }
      this.saving = false; this.showModal = false;
    },

    async deleteRule(id, name) {
      if (!confirm('Remover "'+name+'"?')) return;
      await API.del('/api/rules/' + id);
      this.rules = this.rules.filter(r => r.id!==id);
      toast('success','Regra removida!');
    },

    // ── AI Rule creation ──────────────────────────────────────────────────

    openAiModal() {
      this.aiText = ''; this.aiError = ''; this.aiPreview = null; this.aiLoading = false;
      this.showAiModal = true;
    },

    startListening() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { toast('warning','Seu navegador não suporta reconhecimento de voz. Use Chrome.'); return; }
      if (this.aiListening) { this._recognition?.stop(); this.aiListening = false; return; }
      this._recognition = new SpeechRecognition();
      this._recognition.lang = 'pt-BR';
      this._recognition.continuous = false;
      this._recognition.interimResults = false;
      this._recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        this.aiText = (this.aiText ? this.aiText + ' ' : '') + text;
        this.aiListening = false;
      };
      this._recognition.onerror = (e) => { this.aiListening = false; toast('error','Erro no microfone: '+e.error); };
      this._recognition.onend = () => { this.aiListening = false; };
      this._recognition.start();
      this.aiListening = true;
    },

    async parseWithAi() {
      if (!this.aiText.trim()) { this.aiError = 'Descreva a regra antes de continuar.'; return; }
      this.aiLoading = true; this.aiError = ''; this.aiPreview = null;
      const r = await fetch('/api/rules/parse-natural', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text: this.aiText, provider: this.aiProvider })
      });
      const data = await r.json();
      this.aiLoading = false;
      if (!r.ok) { this.aiError = data.detail || 'Erro ao processar com IA.'; return; }
      this.aiPreview = data.rule;
    },

    applyAiRule() {
      if (!this.aiPreview) return;
      this.form = {
        name: this.aiPreview.name || '',
        conditions: JSON.parse(JSON.stringify(this.aiPreview.conditions || [])),
        action: this.aiPreview.action || 'pause',
        enabled: true,
      };
      this.editId = null;
      this.showAiModal = false;
      this.step = 1;
      this.showModal = true;
      toast('success','Regra carregada! Revise e salve.');
    },

    // ── Rule Engine ───────────────────────────────────────────────────────

    async runEngine() {
      this.engineRunning = true; this.engineResult = null;
      const r = await API.post('/api/rules/run-engine', {});
      this.engineRunning = false;
      if (r) {
        this.engineResult = r;
        this.lastRun = { ran_at: new Date().toISOString(), actions_taken: r.actions_taken };
        if (r.actions_taken > 0) {
          toast('warning', r.actions_taken + ' ação(ões) tomada(s) pelo motor de regras!');
          await this.loadRules();
        } else {
          toast('success', 'Motor executado — nenhuma regra disparou.');
        }
      } else {
        toast('error', 'Erro ao executar motor de regras.');
      }
    },

    // ── Helpers ───────────────────────────────────────────────────────────

    metricLabel(v) { return METRICS.find(m => m.value===v)?.label||v; },
    actionLabel(v) { return ACTIONS.find(a => a.value===v)?.label||v; },
    actionIcon(v)  { return ACTIONS.find(a => a.value===v)?.icon||'fas fa-cog'; },
    actionColor(v) { return ACTIONS.find(a => a.value===v)?.color||'#64748b'; },
    condText(conds) { return conds.map(c => this.metricLabel(c.metric)+' '+c.operator+' '+c.value).join(' E '); },
    fmtDate(iso) {
      if (!iso) return 'Nunca';
      try { return new Date(iso).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch { return iso; }
    },

    renderPage() { return window.TPL.rules(this); },
  };
});

// ── AlertsPage renderPage ─────────────────────────────────────────────────
Alpine.data('AlertsPage', function() {
  return {
    alerts: [],
    filter: '',

    async init() {
      await this.loadAlerts();
      window.addEventListener('page-refresh', () => this.loadAlerts());
    },

    async loadAlerts() {
      const data = await API.get('/api/alerts');
      if (data) this.alerts = data;
    },

    get filtered() { return this.filter ? this.alerts.filter(a => a.severity===this.filter) : this.alerts; },
    get criticalCount() { return this.alerts.filter(a => a.severity==='critical').length; },
    get warningCount()  { return this.alerts.filter(a => a.severity==='warning').length; },

    sClass(s) { return s==='critical'?'alert-critical':s==='warning'?'alert-warning':'alert-info'; },
    sIcon(s)  { return s==='critical'?'fas fa-fire':s==='warning'?'fas fa-triangle-exclamation':'fas fa-circle-info'; },
    sColor(s) { return s==='critical'?'#ef4444':s==='warning'?'#f59e0b':'#3b82f6'; },
    sLabel(s) { return s==='critical'?'URGENTE':s==='warning'?'ATENÇÃO':'INFO'; },

    async pauseAlert(id) {
      const a = this.alerts.find(x => x.id===id);
      if (a) {
        const cid = a.campaign_id || id;
        await API.post('/api/campaigns/' + cid + '/pause', {});
        toast('success', '"' + (a.campaign_name || a.campaign || '') + '" pausada!');
        this.alerts = this.alerts.filter(x => x.id!==id);
      }
    },

    async ignoreAlert(id) {
      await API.post('/api/alerts/' + id + '/ignore', {});
      this.alerts = this.alerts.filter(x => x.id!==id);
      toast('info','Alerta ignorado.');
    },

    async sendAlertEmail() {
      const activeIds = this.filtered.filter(a => a.status === 'active').map(a => a.id);
      const r = await API.post('/api/alerts/send-email', { alert_ids: activeIds });
      if (r && r.ok) toast('success', 'Email de alertas enviado!');
      else toast('error', 'Erro ao enviar email: ' + (r?.error || 'configure SMTP em Configurações'));
    },

    async pauseAll() {
      const toProcess = [...this.filtered];
      for (const a of toProcess) {
        const cid = a.campaign_id || a.id;
        await API.post('/api/campaigns/' + cid + '/pause', {});
      }
      const ids = toProcess.map(a => a.id);
      this.alerts = this.alerts.filter(a => !ids.includes(a.id));
      toast('success', toProcess.length + ' campanha(s) pausada(s)!');
    },

    async ignoreAll() {
      const toProcess = [...this.filtered];
      for (const a of toProcess) await API.post('/api/alerts/' + a.id + '/ignore', {});
      const ids = toProcess.map(a => a.id);
      this.alerts = this.alerts.filter(a => !ids.includes(a.id));
      toast('info', 'Todos os alertas ignorados.');
    },

    renderPage() { return window.TPL.alerts(this); },
  };
});

// ── QuickActionsPage renderPage ───────────────────────────────────────────
Alpine.data('QuickActionsPage', function() {
  return {
    campaigns: [],
    selected: [],
    search: '',
    filterStatus: '',
    loading: false,

    async init() {
      await this.loadCampaigns();
      window.addEventListener('page-refresh', () => this.loadCampaigns());
    },

    async loadCampaigns() {
      const data = await API.get('/api/campaigns');
      if (data) this.campaigns = data;
    },

    get filtered() {
      return this.campaigns.filter(c => {
        if (this.search && !c.name.toLowerCase().includes(this.search.toLowerCase())) return false;
        if (this.filterStatus && c.status !== this.filterStatus) return false;
        return true;
      });
    },

    get selectedCount() { return this.selected.length; },
    get activeCount()   { return this.campaigns.filter(c => c.status==='active').length; },
    get pausedCount()   { return this.campaigns.filter(c => c.status==='paused').length; },

    isSelected(id) { return this.selected.includes(id); },

    toggleSelect(id) {
      if (this.selected.includes(id)) this.selected = this.selected.filter(s => s!==id);
      else this.selected.push(id);
    },

    allSelected() { return this.filtered.length>0 && this.filtered.every(c => this.selected.includes(c.id)); },

    toggleAll() {
      const ids = this.filtered.map(c => c.id);
      if (this.allSelected()) this.selected = this.selected.filter(id => !ids.includes(id));
      else this.selected = [...new Set([...this.selected, ...ids])];
    },

    async bulkAction(action) {
      if (!this.selected.length) { toast('warning','Selecione ao menos uma campanha'); return; }
      this.loading = true;
      const endpoint = action === 'pause' ? '/api/campaigns/bulk-pause' : '/api/campaigns/bulk-activate';
      const r = await API.post(endpoint, { ids: this.selected });
      const newStatus = action==='pause' ? 'paused' : 'active';
      this.campaigns = this.campaigns.map(c => this.selected.includes(c.id) ? {...c, status:newStatus} : c);
      const count = this.selected.length;
      this.selected = [];
      this.loading = false;
      toast('success', r?.message || count+' campanha(s) '+(action==='pause'?'pausada(s)':'ativada(s)')+'!');
    },

    renderPage() { return window.TPL.quickActions(this); },
  };
});

// ── ReportsPage renderPage ────────────────────────────────────────────────
Alpine.data('ReportsPage', function() {
  const _PERIOD_DAYS = {today:1,yesterday:1,last_7d:7,last_14d:14,last_30d:30,last_90d:90};
  return {
    reportType: 'account',
    period: 'last_7d',
    customFrom: '', customTo: '',
    showCustom: false,
    metrics: {invest:true, conversions:true, cpa:true, roas:true, ctr:true, impressions:false, clicks:false},
    email: '',
    generating: false,
    showPreview: false,
    chart: null,
    reportData: null,

    init() {},

    get selectedMetrics() { return Object.entries(this.metrics).filter(([,v])=>v).map(([k])=>k); },

    async generatePreview() {
      this.generating = true;
      const days = this.period === 'custom' ? 30 : (_PERIOD_DAYS[this.period] || 7);
      const result = await API.post('/api/reports/generate', {days});
      this.reportData = result && result.data ? result.data : null;
      this.generating = false; this.showPreview = true;
      this.$nextTick(() => this.buildChart());
      toast('success','Relatório gerado!');
    },

    buildChart() {
      if (this.chart) { try { this.chart.destroy(); } catch {} }
      const el = document.getElementById('ch-report');
      if (!el) return;
      const rawTs = (this.reportData && this.reportData.time_series) || [];
      const ts = { labels: rawTs.map(d=>d.date), invest: rawTs.map(d=>d.invest), conv: rawTs.map(d=>d.conversions) };
      this.chart = new Chart(el.getContext('2d'), {
        type:'line',
        data:{
          labels:ts.labels,
          datasets:[
            {label:'Investimento',data:ts.invest,borderColor:'#3b82f6',fill:false,tension:0.4,pointRadius:4,pointBackgroundColor:'#3b82f6'},
            {label:'Conversões x50',data:ts.conv.map(v=>v*50),borderColor:'#22c55e',fill:false,tension:0.4,pointRadius:4,pointBackgroundColor:'#22c55e'},

          ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10}},scales:{x:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}},y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}}}}
      });
    },

    exportPDF()  { toast('info','Exportando PDF... (integração em breve)'); },
    exportExcel(){ toast('info','Exportando Excel... (integração em breve)'); },

    async sendEmail() {
      if (!this.email) { toast('warning','Insira um email'); return; }
      await new Promise(r => setTimeout(r,700));
      toast('success','Relatório enviado para '+this.email+'!');
      this.email = '';
    },

    renderPage() { return window.TPL.reports(this); },
  };
});

// ── SettingsPage renderPage ───────────────────────────────────────────────
Alpine.data('SettingsPage', function() {
  return {
    tab: 'general',
    tabs: [
      {id:'general',       label:'Geral',       icon:'fas fa-sliders'},
      {id:'notifications', label:'Notificações', icon:'fas fa-bell'},
      {id:'integrations',  label:'Integrações',  icon:'fas fa-plug'},
      {id:'backup',        label:'Backup',       icon:'fas fa-database'},
      {id:'about',         label:'Sobre',        icon:'fas fa-circle-info'},
    ],
    cfg: {
      currency:'USD', timezone:'America/Sao_Paulo', language:'pt-BR',
      refreshInterval:'5', compactMode:false,
      notifEmail:true, notifSlack:false, notifWhatsapp:false,
      notifCritical:true, notifWarning:true, notifInfo:false,
      emailAddr:'', slackWebhook:'', whatsappNumber:'',
    },
    saving: false,

    async init() {
      try {
        const saved = localStorage.getItem('meta_ads_settings');
        if (saved) this.cfg = {...this.cfg, ...JSON.parse(saved)};
      } catch {}
      // Also load from backend
      const serverCfg = await API.get('/api/settings');
      if (serverCfg && Object.keys(serverCfg).length > 0) {
        this.cfg = {...this.cfg, ...serverCfg};
      }
    },

    async save() {
      this.saving = true;
      await API.post('/api/settings', this.cfg);
      this.saving = false;
      try { localStorage.setItem('meta_ads_settings', JSON.stringify(this.cfg)); } catch {}
      toast('success','Configurações salvas!');
    },

    async testInteg(name) {
      await new Promise(r => setTimeout(r,900));
      toast('success', name+' testado com sucesso!');
    },

    async testEmail() {
      await this.save();
      const r = await API.post('/api/alerts/test-email', { to: this.cfg.emailAddr });
      if (r && r.ok) toast('success', 'Email de teste enviado!');
      else toast('error', 'Erro: ' + (r?.error || 'verifique as configurações SMTP'));
    },

    async backup() {
      const [bms, accounts, rules] = await Promise.all([API.get('/api/bm'), API.get('/api/accounts'), API.get('/api/rules')]);
      const data = {bms: bms||[], accounts: accounts||[], rules: rules||[], settings: this.cfg, exported_at: new Date().toISOString()};
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='meta_ads_backup_'+Date.now()+'.json'; a.click();
      URL.revokeObjectURL(url);
      toast('success','Backup exportado!');
    },

    renderPage() { return window.TPL.settings(this); },
  };
});

}); // end alpine:init for templates.js

// ══════════════════════════════════════════════════════════════════════════════
//  HTML TEMPLATE FUNCTIONS  window.TPL.*
// ══════════════════════════════════════════════════════════════════════════════
window.TPL = {

// ── BM Page ───────────────────────────────────────────────────────────────
bm(s) {
  const bmRows = s.bms.map(bm => {
    const accs = s.getAccounts(bm.id);
    return `
    <div class="glass rounded-2xl overflow-hidden glass-hover">
      <div class="p-4 flex flex-wrap items-center gap-4">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${bm.status==='connected'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)'}">
          <i class="fas fa-building text-xl" style="color:${bm.status==='connected'?'#22c55e':'#ef4444'}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-white font-bold text-base">${bm.name}</h3>
            <span class="badge ${bm.status==='connected'?'badge-green':'badge-red'}">
              <i class="fas fa-circle text-xs"></i> ${bm.status==='connected'?'Conectado':'Erro'}
            </span>
          </div>
          <p class="text-slate-400 text-xs mt-0.5">ID: <span class="font-mono text-slate-300">${bm.bm_id}</span> &nbsp;•&nbsp; ${accs.length} conta(s)</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button @click="syncAccounts('${bm.id}')" class="btn btn-secondary btn-sm" title="Sincronizar contas de anúncio">
            <i class="fas fa-rotate-right text-xs"></i>
            <span class="hidden sm:inline">Sincronizar</span>
          </button>
          <button @click="toggleExpand('${bm.id}')" class="btn btn-secondary btn-sm">
            <i :class="expanded['${bm.id}']?'fas fa-chevron-up':'fas fa-chevron-down'" class="text-xs"></i>
            <span class="hidden sm:inline" x-text="expanded['${bm.id}']?'Recolher':'Expandir'"></span>
          </button>
          <button @click="openModal(${JSON.stringify(bm).replace(/"/g,"'")})" class="btn btn-ghost btn-sm" title="Editar">
            <i class="fas fa-pen text-xs"></i>
          </button>
          <button @click="deleteBm('${bm.id}','${bm.name}')" class="btn btn-danger btn-sm" title="Remover">
            <i class="fas fa-trash text-xs"></i>
          </button>
        </div>
      </div>
      <div x-show="expanded['${bm.id}']" x-transition style="border-top:1px solid rgba(51,65,85,0.4); display:none;">
        <div class="p-4">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Contas neste BM</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            ${accs.length ? accs.map(a=>`
            <div class="flex items-center gap-2.5 p-3 rounded-xl" style="background:rgba(15,23,42,0.6);border:1px solid rgba(51,65,85,0.4);">
              <span class="text-xl flex-shrink-0">${a.flag||'🌍'}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white font-medium truncate">${a.name}</p>
                <p class="text-xs text-slate-400 font-mono">${a.account_id}</p>
              </div>
              <span class="badge ${a.status==='active'?'badge-green':'badge-red'}">${a.status==='active'?'Ativa':'Erro'}</span>
            </div>`).join('') : '<p class="text-slate-500 text-sm col-span-3 py-2">Nenhuma conta cadastrada neste BM.</p>'}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="fade-in space-y-5">
    <div class="flex items-center justify-between">
      <p class="text-slate-400 text-sm">${s.bms.length} Business Manager(s) configurado(s)</p>
      <button @click="openModal(null)" class="btn btn-primary"><i class="fas fa-plus"></i> Adicionar BM</button>
    </div>
    <div class="space-y-3">${bmRows || '<div class="glass rounded-2xl p-12 text-center"><i class="fas fa-building text-slate-600 text-4xl mb-3 block"></i><p class="text-slate-400">Nenhum BM configurado. Clique em "Adicionar BM" para começar.</p></div>'}</div>

    <!-- Modal BM -->
    <div x-show="showModal" @click="showModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
      <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
      <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">

        <!-- Header -->
        <div class="p-5 flex items-center justify-between sticky top-0 z-10" style="border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(18,28,48,0.98),rgba(12,20,38,0.98));">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(29,78,216,0.3),rgba(59,130,246,0.2));border:1px solid rgba(59,130,246,0.3);">
              <i class="fas fa-building text-blue-400"></i>
            </div>
            <div>
              <h2 class="text-white font-bold text-base leading-tight" x-text="editId?'Editar Business Manager':'Conectar Business Manager'"></h2>
              <p class="text-slate-500 text-xs">Preencha os dados abaixo para conectar seu BM</p>
            </div>
          </div>
          <button @click="showModal=false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg"><i class="fas fa-times text-xs"></i></button>
        </div>

        <!-- Help banner (toggle) -->
        <div class="px-5 pt-4">
          <button @click="showHelpBm = !showHelpBm"
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
                  style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);">
            <span class="flex items-center gap-2.5 text-blue-300 font-medium">
              <i class="fas fa-circle-question text-blue-400"></i>
              Como obter as credenciais do Meta?
            </span>
            <i class="fas text-blue-400 text-xs transition-transform" :class="showHelpBm ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <!-- Help content -->
          <div x-show="showHelpBm" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 -translate-y-2" x-transition:enter-end="opacity-100 translate-y-0" class="mt-2 rounded-xl overflow-hidden" style="display:none;border:1px solid rgba(51,65,85,0.4);background:rgba(8,14,28,0.6);">

            <!-- Step 1: BM ID -->
            <div class="p-4 border-b" style="border-color:rgba(51,65,85,0.3);">
              <p class="text-white font-semibold text-xs mb-2 flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
                Onde encontrar o ID do Business Manager
              </p>
              <div class="pl-7 space-y-1">
                <p class="text-slate-400 text-xs">Acesse <span class="text-blue-400 font-mono">business.facebook.com</span></p>
                <p class="text-slate-400 text-xs">→ <strong class="text-slate-300">Configurações do Negócio</strong> (ícone de engrenagem)</p>
                <p class="text-slate-400 text-xs">→ O ID aparece abaixo do nome do seu BM, no topo da página</p>
                <a href="https://business.facebook.com/settings" target="_blank"
                   class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1">
                  <i class="fas fa-arrow-up-right-from-square text-xs"></i> Abrir Configurações do BM
                </a>
              </div>
            </div>

            <!-- Step 2: Token -->
            <div class="p-4 border-b" style="border-color:rgba(51,65,85,0.3);">
              <p class="text-white font-semibold text-xs mb-2 flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                Como gerar o Access Token (recomendado: User Token)
              </p>
              <div class="pl-7 space-y-1">
                <p class="text-slate-400 text-xs">Acesse o <strong class="text-slate-300">Graph API Explorer</strong>:</p>
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank"
                   class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <i class="fas fa-arrow-up-right-from-square text-xs"></i> Abrir Graph API Explorer
                </a>
                <p class="text-slate-400 text-xs mt-1.5">No Explorer:</p>
                <p class="text-slate-400 text-xs">1. Selecione ou crie seu <strong class="text-slate-300">App Meta</strong></p>
                <p class="text-slate-400 text-xs">2. Clique em <strong class="text-slate-300">"Generate Access Token"</strong></p>
                <p class="text-slate-400 text-xs">3. Marque as permissões: <code class="font-mono text-amber-300">ads_read</code> <code class="font-mono text-amber-300">ads_management</code> <code class="font-mono text-amber-300">read_insights</code> <code class="font-mono text-amber-300">business_management</code></p>
                <p class="text-slate-400 text-xs">4. Copie o token gerado e cole abaixo</p>
              </div>
            </div>

            <!-- Step 3: Long-lived token -->
            <div class="p-4">
              <p class="text-white font-semibold text-xs mb-2 flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">!</span>
                Token de longa duração (60 dias) — recomendado
              </p>
              <div class="pl-7 space-y-1">
                <p class="text-slate-400 text-xs">O token do Explorer expira em 1h. Para criar um de 60 dias, use a URL abaixo no browser (substitua os valores):</p>
                <div class="mt-2 px-3 py-2 rounded-lg font-mono text-xs text-amber-300 select-all overflow-x-auto" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);word-break:break-all;">
                  graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&amp;client_id=<span class="text-white">SEU_APP_ID</span>&amp;client_secret=<span class="text-white">SEU_APP_SECRET</span>&amp;fb_exchange_token=<span class="text-white">TOKEN_CURTO</span>
                </div>
                <p class="text-slate-500 text-xs mt-1.5">App ID e Secret: <a href="https://developers.facebook.com/apps/" target="_blank" class="text-blue-400 hover:text-blue-300">developers.facebook.com/apps</a> → seu app → Configurações Básicas</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Form fields -->
        <div class="p-5 space-y-4">
          <div>
            <label class="form-label">Nome do BM *</label>
            <div class="relative">
              <i class="fas fa-tag absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
              <input type="text" x-model="form.name" placeholder="Ex: BM Principal" class="form-input pl-9" />
            </div>
            <p class="text-slate-600 text-xs mt-1">Nome descritivo só para você identificar</p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="form-label mb-0">ID do Business Manager *</label>
              <a href="https://business.facebook.com/settings" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                <i class="fas fa-arrow-up-right-from-square text-xs"></i> Onde encontrar?
              </a>
            </div>
            <div class="relative">
              <i class="fas fa-hashtag absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
              <input type="text" x-model="form.bm_id" placeholder="Ex: 123456789012345" class="form-input pl-9 font-mono" inputmode="numeric" />
            </div>
            <p class="text-slate-600 text-xs mt-1">Número de 15 dígitos — encontrado nas Configurações do Negócio</p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="form-label mb-0">Access Token *</label>
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                <i class="fas fa-arrow-up-right-from-square text-xs"></i> Graph Explorer
              </a>
            </div>
            <div class="relative">
              <i class="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
              <input :type="showToken?'text':'password'" x-model="form.access_token" placeholder="EAAxxxxxxxxxxxxxxx..." class="form-input pl-9 pr-10 font-mono" style="font-size:0.8rem;" />
              <button @click="showToken=!showToken" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <i :class="showToken?'fas fa-eye-slash':'fas fa-eye'" class="text-sm"></i>
              </button>
            </div>
            <p class="text-slate-600 text-xs mt-1">Começa com <code class="font-mono text-amber-400">EAA</code> — precisa das permissões ads_read e ads_management</p>
          </div>

          <!-- Permissões rápidas -->
          <div class="px-3 py-2.5 rounded-xl flex flex-wrap gap-2" style="background:rgba(15,23,42,0.6);border:1px solid rgba(51,65,85,0.3);">
            <p class="text-slate-500 text-xs w-full mb-0.5 font-medium">Permissões necessárias no token:</p>
            ${['ads_read','ads_management','read_insights','business_management'].map(p=>`<code class="text-xs font-mono px-2 py-0.5 rounded-md" style="background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.2);">${p}</code>`).join('')}
          </div>

          <!-- Result banners -->
          <div x-show="testResult==='success'" x-transition class="flex items-center gap-2.5 p-3 rounded-xl" style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);display:none;">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(34,197,94,0.15);">
              <i class="fas fa-check text-green-400 text-xs"></i>
            </div>
            <div>
              <p class="text-green-300 text-sm font-semibold">Conexão verificada com sucesso!</p>
              <p class="text-slate-400 text-xs mt-0.5">Token válido. Clique em "Adicionar BM" para salvar.</p>
            </div>
          </div>
          <div x-show="testResult==='error'" x-transition class="flex items-start gap-2.5 p-3 rounded-xl" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);display:none;">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:rgba(239,68,68,0.15);">
              <i class="fas fa-times text-red-400 text-xs"></i>
            </div>
            <div>
              <p class="text-red-300 text-sm font-semibold">Token inválido ou sem permissão</p>
              <p class="text-slate-400 text-xs mt-0.5">Verifique se o token tem as 4 permissões necessárias e se não expirou. Clique em "Como obter as credenciais" acima para ajuda.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 flex flex-col sm:flex-row gap-2" style="border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);">
          <button @click="testConn()" :disabled="testing || !form.access_token" class="btn btn-secondary flex-1"
                  :class="!form.access_token ? 'opacity-40 cursor-not-allowed' : ''">
            <i :class="testing?'fas fa-spinner fa-spin':'fas fa-plug'" class="text-xs"></i>
            <span x-text="testing?'Testando...':'Testar Conexão'"></span>
          </button>
          <button @click="saveBm()" :disabled="saving" class="btn btn-primary flex-1">
            <i :class="saving?'fas fa-spinner fa-spin':'fas fa-check'" class="text-xs"></i>
            <span x-text="editId?'Salvar Alterações':'Adicionar BM'"></span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </div>`;
},

// ── Accounts Page ─────────────────────────────────────────────────────────
accounts(s) {
  const COUNTRY_OPTIONS = [
    {code:'BR',flag:'🇧🇷',name:'Brasil'},{code:'US',flag:'🇺🇸',name:'USA'},
    {code:'MX',flag:'🇲🇽',name:'México'},{code:'AR',flag:'🇦🇷',name:'Argentina'},
    {code:'CO',flag:'🇨🇴',name:'Colômbia'},{code:'CL',flag:'🇨🇱',name:'Chile'},
    {code:'PE',flag:'🇵🇪',name:'Peru'},{code:'EC',flag:'🇪🇨',name:'Equador'},
  ];
  return `
  <div class="fade-in space-y-5">
    <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[180px]">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
        <input type="text" x-model="search" @input="$el.dispatchEvent(new Event('change'))" placeholder="Buscar conta ou ID..." class="form-input pl-8" />
      </div>
      <select x-model="filterBm" class="form-select" style="width:auto;">
        <option value="">Todos os BMs</option>
        <template x-for="bm in bms" :key="bm.id">
          <option :value="bm.id" x-text="bm.name"></option>
        </template>
      </select>
      <select x-model="filterStatus" class="form-select" style="width:auto;">
        <option value="">Todos os status</option>
        <option value="active">Ativas</option>
        <option value="error">Com erro</option>
      </select>
      <button @click="openModal(null)" class="btn btn-primary whitespace-nowrap">
        <i class="fas fa-plus"></i> Adicionar Conta
      </button>
    </div>

    <div class="flex items-center gap-3 flex-wrap">
      <p class="text-slate-400 text-sm" x-text="filtered.length+' conta(s)'"></p>
      <div class="flex gap-2">
        <span class="badge badge-green"><i class="fas fa-circle text-xs"></i> <span x-text="accounts.filter(a=>a.status==='active').length"></span> ativas</span>
        <span class="badge badge-red"><i class="fas fa-times-circle text-xs"></i> <span x-text="accounts.filter(a=>a.status==='error').length"></span> erro</span>
      </div>
      <div x-show="metricsLoading" class="flex items-center gap-1.5 text-xs text-slate-500">
        <i class="fas fa-circle-notch fa-spin text-blue-400"></i> Carregando...
      </div>
    </div>

    <!-- Period selector pills -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-slate-500 text-xs mr-1">Período:</span>
      ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'},{v:'custom',l:'Personalizado'}].map(p=>`<button @click="setMetricsPeriod('${p.v}')" :class="metricsPeriod==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
      <span x-show="metricsLoading" class="ml-1 text-xs text-slate-500"><i class="fas fa-circle-notch fa-spin"></i></span>
    </div>
    <div x-show="showCustom" x-transition class="flex items-center gap-2 flex-wrap glass rounded-xl p-3">
      <label class="text-slate-400 text-xs">De:</label>
      <input type="date" x-model="customFrom" class="form-input py-1.5 text-sm" style="width:auto;" />
      <label class="text-slate-400 text-xs">Até:</label>
      <input type="date" x-model="customTo" class="form-input py-1.5 text-sm" style="width:auto;" />
      <button @click="applyCustom()" class="btn btn-primary btn-sm">Aplicar</button>
      <button @click="showCustom=false; metricsPeriod='last_7d'" class="btn btn-ghost btn-sm">Cancelar</button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 fade-in-children">
      <template x-for="acc in filtered" :key="acc.id">
        <div class="glass rounded-2xl p-4 glass-hover flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl" x-text="acc.flag||flagFor(acc.country)||'🌍'"></span>
              <div class="min-w-0">
                <p class="text-white font-semibold text-sm leading-tight truncate" x-text="acc.name"></p>
                <p class="text-slate-500 text-xs font-mono" x-text="acc.account_id"></p>
              </div>
            </div>
            <span :class="acc.status==='active'?'badge-green':'badge-red'" class="badge flex-shrink-0">
              <i :class="acc.status==='active'?'fas fa-circle':'fas fa-times-circle'" class="text-xs"></i>
              <span x-text="acc.status==='active'?'Ativa':'Erro'"></span>
            </span>
          </div>
          <div x-show="acc.status==='error'" class="flex items-center gap-1.5 p-2.5 rounded-xl text-xs text-red-300" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);">
            <i class="fas fa-exclamation-triangle text-red-400"></i> Token expirado ou inválido
          </div>
          <!-- Metrics from with-metrics endpoint -->
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center p-2 rounded-xl" style="background:rgba(59,130,246,0.08);">
              <p class="text-blue-400 font-bold text-sm" x-text="metricsLoading && !m(acc.id).spend ? '...' : '$'+Number(m(acc.id).spend||0).toFixed(0)"></p>
              <p class="text-slate-500 text-xs">Gasto</p>
            </div>
            <div class="text-center p-2 rounded-xl" style="background:rgba(34,197,94,0.08);">
              <p class="text-green-400 font-bold text-sm" x-text="metricsLoading && !m(acc.id).conversions ? '...' : (m(acc.id).conversions||0)"></p>
              <p class="text-slate-500 text-xs">Conv.</p>
            </div>
            <div class="text-center p-2 rounded-xl" style="background:rgba(245,158,11,0.08);">
              <p class="text-amber-400 font-bold text-sm" x-text="metricsLoading && !m(acc.id).roas ? '...' : Number(m(acc.id).roas||0).toFixed(1)+'x'"></p>
              <p class="text-slate-500 text-xs">ROAS</p>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-xs text-slate-500 truncate" x-text="'BM: '+bmName(acc.bm_id)"></p>
            <p class="text-xs text-slate-600" x-text="(m(acc.id).campaign_count||0)+' camp.'"></p>
          </div>
          <div class="flex gap-1.5 mt-auto pt-1" style="border-top:1px solid rgba(51,65,85,0.3);">
            <button @click="viewAccount(acc)" class="btn btn-primary btn-sm flex-1">
              <i class="fas fa-chart-bar text-xs"></i> Ver Detalhe
            </button>
            <button @click="openModal(acc)" class="btn btn-ghost btn-sm px-2.5" title="Editar">
              <i class="fas fa-gear text-xs"></i>
            </button>
            <button @click="deleteAccount(acc.id, acc.name)" class="btn btn-ghost btn-sm px-2.5 hover:text-red-400" title="Remover">
              <i class="fas fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      </template>
      <template x-if="filtered.length===0">
        <div class="col-span-4 glass rounded-2xl p-12 text-center">
          <i class="fas fa-credit-card text-slate-600 text-5xl mb-4 block"></i>
          <p class="text-slate-400 font-medium mb-1">Nenhuma conta encontrada</p>
          <p class="text-slate-500 text-sm">Tente ajustar os filtros ou adicione uma nova conta.</p>
        </div>
      </template>
    </div>

    <!-- Modal Add/Edit Account -->
    <div x-show="showModal" @click="showModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
      <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
      <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <!-- Header -->
        <div class="p-5 flex items-center justify-between sticky top-0 z-10" style="border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(18,28,48,0.98),rgba(12,20,38,0.98));">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(29,78,216,0.3),rgba(59,130,246,0.2));border:1px solid rgba(59,130,246,0.3);">
              <i class="fas fa-credit-card text-blue-400"></i>
            </div>
            <div>
              <h2 class="text-white font-bold text-base leading-tight" x-text="editId?'Editar Conta de Anúncio':'Conectar Conta de Anúncio'"></h2>
              <p class="text-slate-500 text-xs">Adicione uma conta de anúncio do Meta Ads</p>
            </div>
          </div>
          <button @click="showModal=false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg"><i class="fas fa-times text-xs"></i></button>
        </div>

        <!-- Help toggle -->
        <div class="px-5 pt-4">
          <button @click="showHelpAcc = !showHelpAcc"
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
                  style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);">
            <span class="flex items-center gap-2.5 text-blue-300 font-medium">
              <i class="fas fa-circle-question text-blue-400"></i>
              Onde encontro o ID da conta e o token?
            </span>
            <i class="fas text-blue-400 text-xs transition-transform" :class="showHelpAcc ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>
          <div x-show="showHelpAcc" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 -translate-y-2" x-transition:enter-end="opacity-100 translate-y-0" class="mt-2 rounded-xl overflow-hidden" style="display:none;border:1px solid rgba(51,65,85,0.4);background:rgba(8,14,28,0.6);">
            <div class="p-4 border-b" style="border-color:rgba(51,65,85,0.3);">
              <p class="text-white font-semibold text-xs mb-2 flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
                Onde encontrar o ID da Conta (act_XXXXXXX)
              </p>
              <div class="pl-7 space-y-1">
                <p class="text-slate-400 text-xs">Acesse <span class="text-blue-400 font-mono">adsmanager.facebook.com</span></p>
                <p class="text-slate-400 text-xs">→ O ID aparece na URL: <code class="font-mono text-amber-300">act_123456789</code></p>
                <p class="text-slate-400 text-xs">→ Ou em: <strong class="text-slate-300">Configurações da Conta</strong> → ID da Conta de Anúncios</p>
                <a href="https://adsmanager.facebook.com/" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1">
                  <i class="fas fa-arrow-up-right-from-square text-xs"></i> Abrir Gerenciador de Anúncios
                </a>
              </div>
            </div>
            <div class="p-4">
              <p class="text-white font-semibold text-xs mb-2 flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                Access Token — use o mesmo do BM ou gere um novo
              </p>
              <div class="pl-7 space-y-1">
                <p class="text-slate-400 text-xs">Pode usar o mesmo token cadastrado no BM acima, ou gerar um novo no Graph Explorer com as permissões:</p>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  ${['ads_read','ads_management','read_insights'].map(p=>`<code class="text-xs font-mono px-2 py-0.5 rounded-md" style="background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.2);">${p}</code>`).join('')}
                </div>
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1">
                  <i class="fas fa-arrow-up-right-from-square text-xs"></i> Abrir Graph API Explorer
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Nome da Conta *</label>
              <div class="relative">
                <i class="fas fa-tag absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
                <input type="text" x-model="form.name" placeholder="Ex: BR - PROD001" class="form-input pl-9" />
              </div>
              <p class="text-slate-600 text-xs mt-1">Nome descritivo para identificar a conta</p>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="form-label mb-0">ID da Conta *</label>
                <a href="https://adsmanager.facebook.com/" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <i class="fas fa-arrow-up-right-from-square text-xs"></i> Onde encontrar?
                </a>
              </div>
              <div class="relative">
                <i class="fas fa-hashtag absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
                <input type="text" x-model="form.account_id" placeholder="act_123456789" class="form-input pl-9 font-mono" />
              </div>
              <p class="text-slate-600 text-xs mt-1">Formato: <code class="text-amber-400 font-mono">act_</code> seguido dos números</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Business Manager</label>
              <div class="relative">
                <i class="fas fa-building absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none z-10"></i>
                <select x-model="form.bm_id" class="form-select pl-9">
                  <option value="">Selecionar BM (opcional)</option>
                  <template x-for="bm in bms" :key="bm.id">
                    <option :value="bm.id" x-text="bm.name"></option>
                  </template>
                </select>
              </div>
            </div>
            <div>
              <label class="form-label">País</label>
              <div class="relative">
                <i class="fas fa-globe absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none z-10"></i>
                <select x-model="form.country" class="form-select pl-9">
                  ${COUNTRY_OPTIONS.map(c=>`<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="form-label mb-0">Access Token *</label>
              <a href="https://developers.facebook.com/tools/explorer/" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <i class="fas fa-arrow-up-right-from-square text-xs"></i> Graph Explorer
              </a>
            </div>
            <div class="relative">
              <i class="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none"></i>
              <input :type="showToken?'text':'password'" x-model="form.access_token" placeholder="EAAxxxxxxxxxxxxxxx..." class="form-input pl-9 pr-10 font-mono" style="font-size:0.8rem;" />
              <button @click="showToken=!showToken" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <i :class="showToken?'fas fa-eye-slash':'fas fa-eye'" class="text-sm"></i>
              </button>
            </div>
            <p class="text-slate-600 text-xs mt-1">Começa com <code class="font-mono text-amber-400">EAA</code> — pode ser o mesmo token do BM</p>
          </div>
          <div x-show="testResult==='success'" x-transition class="flex items-center gap-2.5 p-3 rounded-xl" style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);display:none;">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(34,197,94,0.15);">
              <i class="fas fa-check text-green-400 text-xs"></i>
            </div>
            <div>
              <p class="text-green-300 text-sm font-semibold">Conta verificada com sucesso!</p>
              <p class="text-slate-400 text-xs mt-0.5">Clique em "Adicionar Conta" para salvar.</p>
            </div>
          </div>
          <div x-show="testResult==='error'" x-transition class="flex items-start gap-2.5 p-3 rounded-xl" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);display:none;">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style="background:rgba(239,68,68,0.15);">
              <i class="fas fa-times text-red-400 text-xs"></i>
            </div>
            <div>
              <p class="text-red-300 text-sm font-semibold">Não foi possível verificar a conta</p>
              <p class="text-slate-400 text-xs mt-0.5">Verifique se o ID está no formato <code class="font-mono text-amber-400">act_XXXXXXX</code> e se o token tem as permissões necessárias.</p>
            </div>
          </div>
        </div>

        <div class="p-4 flex flex-col sm:flex-row gap-2" style="border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);">
          <button @click="testConn()" :disabled="testing || !form.access_token || !form.account_id" class="btn btn-secondary flex-1"
                  :class="(!form.access_token || !form.account_id) ? 'opacity-40 cursor-not-allowed' : ''">
            <i :class="testing?'fas fa-spinner fa-spin':'fas fa-plug'" class="text-xs"></i>
            <span x-text="testing?'Testando...':'Testar Conexão'"></span>
          </button>
          <button @click="saveAccount()" :disabled="saving" class="btn btn-primary flex-1">
            <i :class="saving?'fas fa-spinner fa-spin':'fas fa-check'" class="text-xs"></i>
            <span x-text="editId?'Salvar Alterações':'Adicionar Conta'"></span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </div>`;
},

// ── Products Page ─────────────────────────────────────────────────────────
products(s) {
  const medals = ['🥇','🥈','🥉'];
  const prods = s.products || [];
  const camps = s.campaigns || [];

  const rows = prods.length === 0
    ? `<tr><td colspan="7" class="text-center py-8 text-slate-500"><i class="fas fa-box-open mr-2"></i>Nenhum produto encontrado — conecte contas de anúncio.</td></tr>`
    : prods.map((p,i) => `
    <tr @click="selected=selected==='${p.code||p.name}'?null:'${p.code||p.name}'" class="cursor-pointer" :class="selected==='${p.code||p.name}'?'bg-blue-600/10':''">
      <td class="font-bold text-white">${medals[i]||''} ${p.code||p.name||'-'}</td>
      <td class="text-blue-400 font-mono">$${(p.invest||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td class="text-green-400 font-semibold">${p.conversions||0}</td>
      <td class="${(p.roas||0)>=3.5?'text-green-400':(p.roas||0)>=2.5?'text-amber-400':'text-red-400'} font-semibold">${(p.roas||0).toFixed(2)}x</td>
      <td class="text-slate-300">$${(p.cpa||0).toFixed(2)}</td>
      <td>${p.campaigns||0} camps.</td>
      <td class="${(p.trend||0)>0?'text-green-400':'text-red-400'} font-semibold">
        <i class="fas fa-arrow-${(p.trend||0)>0?'up':'down'} text-xs"></i> ${Math.abs(p.trend||0)}%
      </td>
    </tr>`).join('');

  const campRows = s.selected ? camps.filter(c=>(c.name||'').includes(s.selected)).map(c=>`
    <div class="flex items-center gap-3 p-3 rounded-xl" style="background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.3);">
      <span class="badge ${c.status==='active'?'badge-green':'badge-slate'}">${c.status==='active'?'Ativa':'Pausada'}</span>
      <span class="text-sm text-white flex-1 font-medium truncate">${c.name}</span>
      <span class="text-slate-400 text-xs">$${(c.spend||0).toFixed(2)}</span>
      <span class="${(c.roas||0)>=3?'text-green-400':(c.roas||0)>=2?'text-amber-400':!c.roas?'text-slate-500':'text-red-400'} text-xs font-semibold">${c.roas>0?c.roas.toFixed(2)+'x':'—'}</span>
    </div>`).join('') : '';

  return `
  <div class="fade-in space-y-5">
    <div class="flex flex-wrap items-center gap-2">
      ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'}].map(p=>`
      <button @click="period='${p.v}'" :class="period==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
      <button @click="init(); $dispatch('show-toast',{type:'success',message:'Dados atualizados!'})" class="btn btn-secondary btn-sm ml-auto">
        <i class="fas fa-rotate-right"></i> Atualizar
      </button>
    </div>

    <!-- Chart -->
    <div class="glass rounded-2xl p-5">
      <h3 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <i class="fas fa-chart-bar text-purple-400"></i> Comparativo de Produtos
      </h3>
      <div class="chart-container" style="height:240px;">
        ${prods.length === 0 ? '<div class="flex items-center justify-center h-full text-slate-600 text-sm"><i class="fas fa-chart-bar mr-2"></i>Sem dados — conecte uma conta de anúncio</div>' : '<canvas id="ch-products"></canvas>'}
      </div>
    </div>

    <!-- Products Table -->
    <div class="glass rounded-2xl overflow-hidden">
      <div class="p-4 border-b" style="border-color:rgba(51,65,85,0.4);">
        <h3 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <i class="fas fa-box text-amber-400"></i> Performance por Produto
          <span class="badge badge-slate text-xs">${prods.length} produtos</span>
        </h3>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr>
            <th>Produto</th><th>Investimento</th><th>Conversões</th>
            <th>ROAS</th><th>CPA</th><th>Campanhas</th><th>Tendência</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <!-- Campaign Drill-down -->
    <div x-show="selected" x-transition class="glass rounded-2xl p-5" style="display:none;">
      <h3 class="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <i class="fas fa-layer-group text-blue-400"></i>
        Campanhas do produto <span class="text-blue-400 ml-1" x-text="selected"></span>
        <button @click="selected=null" class="ml-auto btn btn-ghost btn-xs"><i class="fas fa-times text-xs"></i></button>
      </h3>
      <div class="space-y-2">${campRows}</div>
    </div>
  </div>`;
},

// ── Rules Page ────────────────────────────────────────────────────────────
rules(s) {
  const active = s.rules.filter(r => r.enabled).length;
  const ruleCards = s.rules.map(r => `
    <div class="glass rounded-2xl p-4 glass-hover">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style="background:rgba(${r.enabled?'59,130,246':'100,116,139'},0.1);">
          <i class="${s.actionIcon(r.action)} text-lg" style="color:${r.enabled?s.actionColor(r.action):'#475569'}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <h3 class="text-white font-semibold text-sm">${r.name}</h3>
            <span class="badge ${r.enabled?'badge-green':'badge-slate'}">${r.enabled?'Ativa':'Inativa'}</span>
          </div>
          <p class="text-slate-400 text-xs mb-0.5"><i class="fas fa-filter text-slate-500 mr-1"></i>${s.condText(r.conditions)}</p>
          <p class="text-slate-400 text-xs"><i class="${s.actionIcon(r.action)} text-xs mr-1" style="color:${s.actionColor(r.action)}"></i>${s.actionLabel(r.action)}</p>
          ${r.trigger_count>0?`<p class="text-slate-500 text-xs mt-1"><i class="fas fa-bolt text-amber-400 text-xs mr-1"></i>Acionada ${r.trigger_count}x</p>`:''}
          ${r.last_run?`<p class="text-slate-600 text-xs">Última execução: ${r.last_run}</p>`:''}
        </div>
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
          <label class="toggle-wrapper" title="${r.enabled?'Desativar':'Ativar'}">
            <input type="checkbox" ${r.enabled?'checked':''} @change="toggleRule('${r.id}')" class="toggle-input" />
            <div class="toggle-track"></div>
            <div class="toggle-thumb"></div>
          </label>
          <div class="flex gap-1">
            <button @click="openModal(${JSON.stringify(r).replace(/"/g,"'")})" class="btn btn-ghost btn-xs" title="Editar"><i class="fas fa-pen text-xs"></i></button>
            <button @click="deleteRule('${r.id}','${r.name}')" class="btn btn-ghost btn-xs hover:text-red-400" title="Remover"><i class="fas fa-trash text-xs"></i></button>
          </div>
        </div>
      </div>
    </div>`).join('');

  const metricOptions = s.METRICS.map(m=>`<option value="${m.value}">${m.label}</option>`).join('');
  const operOptions   = s.OPERATORS.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');

  return `
  <div class="fade-in space-y-5">

    <!-- Stats + Engine row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-white">${s.rules.length}</p>
        <p class="text-slate-400 text-xs mt-0.5">Total de Regras</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-green-400">${active}</p>
        <p class="text-slate-400 text-xs mt-0.5">Ativas</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-amber-400">${s.rules.reduce((a,r)=>a+(r.trigger_count||0),0)}</p>
        <p class="text-slate-400 text-xs mt-0.5">Acionamentos</p>
      </div>
      <!-- Engine panel -->
      <div class="glass rounded-2xl p-4 flex flex-col gap-2" style="border:1px solid rgba(99,102,241,0.25);">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fas fa-gear text-indigo-400"></i> Motor de Regras
        </p>
        <p class="text-slate-500 text-xs" x-text="lastRun ? 'Última execução: '+fmtDate(lastRun.ran_at) : 'Nunca executado'"></p>
        <button @click="runEngine()" :disabled="engineRunning" class="btn btn-sm w-full" style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;">
          <i :class="engineRunning?'fas fa-spinner fa-spin':'fas fa-play'" class="text-xs"></i>
          <span x-text="engineRunning?'Executando...':'Executar Agora'"></span>
        </button>
      </div>
    </div>

    <!-- Engine result -->
    <div x-show="engineResult" x-transition class="glass rounded-2xl p-4" style="display:none;border:1px solid rgba(99,102,241,0.3);">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:rgba(99,102,241,0.15);">
          <i class="fas fa-check-circle text-indigo-400"></i>
        </div>
        <div>
          <p class="text-white font-semibold text-sm">Motor executado com sucesso</p>
          <p class="text-slate-400 text-xs" x-text="engineResult?.campaigns_checked+' campanhas verificadas · '+engineResult?.rules_checked+' regras avaliadas · '+engineResult?.actions_taken+' ação(ões) tomada(s)'"></p>
        </div>
        <button @click="engineResult=null" class="ml-auto btn btn-ghost btn-xs"><i class="fas fa-times text-xs"></i></button>
      </div>
      <template x-if="engineResult?.log?.length > 0">
        <div class="space-y-1">
          <template x-for="(entry, i) in engineResult.log" :key="i">
            <p class="text-xs text-amber-300 flex items-start gap-2">
              <i class="fas fa-bolt text-amber-400 mt-0.5 flex-shrink-0"></i>
              <span x-text="entry"></span>
            </p>
          </template>
        </div>
      </template>
      <template x-if="!engineResult?.log?.length">
        <p class="text-xs text-slate-500">Nenhuma regra disparou — tudo dentro dos parâmetros.</p>
      </template>
    </div>

    <!-- Actions bar -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-slate-300 font-semibold text-sm flex items-center gap-2">
        <i class="fas fa-robot text-blue-400"></i> Regras Configuradas
        <span class="badge badge-slate">${s.rules.length}</span>
      </h3>
      <div class="flex gap-2 flex-wrap">
        <!-- AI Rule button -->
        <button @click="openAiModal()" class="btn btn-sm" style="background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(99,102,241,0.2));border:1px solid rgba(168,85,247,0.4);color:#c4b5fd;">
          <i class="fas fa-wand-magic-sparkles text-xs"></i> Criar com IA
        </button>
        <button @click="openModal(null)" class="btn btn-primary btn-sm"><i class="fas fa-plus text-xs"></i> Nova Regra</button>
      </div>
    </div>

    <!-- Rule cards -->
    <div class="space-y-3">${ruleCards || '<div class="glass rounded-2xl p-12 text-center"><i class="fas fa-robot text-slate-600 text-4xl mb-3 block"></i><p class="text-slate-400 mb-4">Nenhuma regra criada ainda.</p><button @click="openAiModal()" class="btn btn-primary"><i class="fas fa-wand-magic-sparkles"></i> Criar minha primeira regra com IA</button></div>'}</div>

    <!-- ═══ AI RULE MODAL ══════════════════════════════════════════════════ -->
    <div x-show="showAiModal" @click="showAiModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
      <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
      <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <!-- Header -->
        <div class="p-5 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(124,58,237,0.12),rgba(79,70,229,0.06));">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(124,58,237,0.35),rgba(79,70,229,0.25));border:1px solid rgba(124,58,237,0.4);">
              <i class="fas fa-wand-magic-sparkles text-purple-300"></i>
            </div>
            <div>
              <h2 class="text-white font-bold text-base leading-tight">Criar Regra com IA</h2>
              <p class="text-slate-500 text-xs">Descreva em linguagem natural</p>
            </div>
          </div>
          <button @click="showAiModal=false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg"><i class="fas fa-times text-xs"></i></button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Intro -->
          <p class="text-slate-300 text-sm">Descreva a regra que você quer criar em linguagem natural. Pode usar texto ou falar pelo microfone.</p>

          <!-- Provider badge (when configured) -->
          <div x-show="aiConfigured" x-transition class="flex items-center gap-2 p-2.5 rounded-xl text-xs" style="display:none;" :style="aiProvider==='openai'?'background:rgba(16,163,127,0.1);border:1px solid rgba(16,163,127,0.3);':'background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);'">
            <i :class="aiProvider==='openai'?'fas fa-robot text-emerald-400':'fas fa-wand-magic-sparkles text-purple-400'"></i>
            <span :class="aiProvider==='openai'?'text-emerald-300':'text-purple-300'" class="font-semibold" x-text="aiProvider==='openai'?'OpenAI GPT':'Claude (Anthropic)'"></span>
            <span class="text-slate-500">ativo</span>
            <button @click="$dispatch('navigate',{page:'settings'}); showAiModal=false" class="ml-auto text-slate-500 hover:text-slate-300 text-xs underline">Trocar</button>
          </div>

          <!-- AI not configured warning -->
          <div x-show="!aiConfigured" class="flex items-start gap-2 p-3 rounded-xl text-xs" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);">
            <i class="fas fa-triangle-exclamation text-amber-400 mt-0.5 flex-shrink-0"></i>
            <div>
              <p class="text-amber-300 font-semibold">Nenhuma IA configurada</p>
              <p class="text-amber-400/70 mt-0.5">Vá em <strong>Configurações → Integrações</strong> e configure Claude (Anthropic) ou OpenAI GPT.</p>
            </div>
          </div>

          <!-- Examples -->
          <div class="space-y-1.5">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exemplos de descrição:</p>
            <div class="flex flex-wrap gap-2">
              ${[
                'Pausar quando gastar $5 sem conversões',
                'Alertar se ROAS cair abaixo de 2.5',
                'Pausar se gastar 50% do budget sem checkout',
                'Notificar se CPA passar de $40',
                'Pausar campanhas com CTR abaixo de 0.5%',
              ].map(ex=>`<button @click="aiText='${ex}'" class="text-xs px-2.5 py-1 rounded-lg transition-colors" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;" @mouseenter="$el.style.background='rgba(99,102,241,0.25)'" @mouseleave="$el.style.background='rgba(99,102,241,0.12)'">${ex}</button>`).join('')}
            </div>
          </div>

          <!-- Text input + mic -->
          <div>
            <label class="form-label">Descreva a regra</label>
            <div class="relative">
              <textarea
                x-model="aiText"
                placeholder="Ex: Pausar a campanha automaticamente quando gastar mais de $10 sem nenhuma venda..."
                class="form-input resize-none pr-12"
                style="min-height:100px;"
                @keydown.ctrl.enter="parseWithAi()"
              ></textarea>
              <button
                @click="startListening()"
                :title="aiListening?'Parar gravação':'Falar pelo microfone'"
                class="absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                :style="aiListening?'background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);color:#f87171;':'background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;'"
              >
                <i :class="aiListening?'fas fa-stop text-xs':'fas fa-microphone text-sm'"></i>
              </button>
            </div>
            <p class="text-slate-600 text-xs mt-1">Dica: Ctrl+Enter para processar</p>
          </div>

          <!-- Listening indicator -->
          <div x-show="aiListening" x-transition class="flex items-center gap-2 p-3 rounded-xl" style="display:none;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);">
            <div class="flex gap-1 items-end">
              <span class="w-1 bg-red-400 rounded-full animate-bounce" style="height:12px;animation-delay:0ms"></span>
              <span class="w-1 bg-red-400 rounded-full animate-bounce" style="height:18px;animation-delay:150ms"></span>
              <span class="w-1 bg-red-400 rounded-full animate-bounce" style="height:10px;animation-delay:300ms"></span>
              <span class="w-1 bg-red-400 rounded-full animate-bounce" style="height:16px;animation-delay:100ms"></span>
            </div>
            <p class="text-red-300 text-sm font-medium">Ouvindo... Fale agora.</p>
          </div>

          <!-- Error -->
          <div x-show="aiError" x-transition class="flex items-start gap-2 p-3 rounded-xl text-sm" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);">
            <i class="fas fa-circle-xmark text-red-400 mt-0.5 flex-shrink-0"></i>
            <p class="text-red-300" x-text="aiError"></p>
          </div>

          <!-- AI Preview result -->
          <div x-show="aiPreview" x-transition class="p-4 rounded-xl space-y-2" style="display:none;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);">
            <p class="text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <i class="fas fa-check-circle"></i> Regra Identificada pela IA
            </p>
            <p class="text-white font-semibold text-sm" x-text="aiPreview?.name"></p>
            <div class="space-y-1">
              <template x-for="(c, i) in (aiPreview?.conditions||[])" :key="i">
                <p class="text-slate-300 text-xs flex items-center gap-1.5">
                  <span class="text-slate-500" x-text="i===0?'SE':'E'"></span>
                  <span class="font-mono text-blue-300" x-text="c.metric"></span>
                  <span class="text-slate-500" x-text="c.operator"></span>
                  <span class="font-mono text-amber-300" x-text="c.value"></span>
                </p>
              </template>
            </div>
            <p class="text-slate-300 text-xs flex items-center gap-1.5">
              <span class="text-slate-500">ENTÃO</span>
              <span class="font-semibold" x-text="aiPreview?.action"></span>
            </p>
            <p class="text-slate-500 text-xs mt-1">Clique em "Usar esta regra" para revisar e salvar.</p>
          </div>
        </div>

        <div class="p-4 flex gap-2" style="border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);">
          <button @click="parseWithAi()" :disabled="aiLoading||!aiText.trim()||!aiConfigured" class="btn btn-primary flex-1">
            <i :class="aiLoading?'fas fa-spinner fa-spin':'fas fa-wand-magic-sparkles'" class="text-xs"></i>
            <span x-text="aiLoading?'Processando...':'Interpretar com IA'"></span>
          </button>
          <button x-show="aiPreview" @click="applyAiRule()" class="btn btn-sm" style="background:rgba(34,197,94,0.2);border:1px solid rgba(34,197,94,0.4);color:#4ade80;">
            <i class="fas fa-check text-xs"></i> Usar esta regra
          </button>
        </div>
      </div>
      </div>
    </div>

    <!-- ═══ CREATE/EDIT RULE MODAL ════════════════════════════════════════ -->
    <div x-show="showModal" @click="showModal=false" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:9999;display:none;overflow-y:auto;">
      <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:1.5rem;">
      <div @click.stop style="width:100%;max-width:540px;max-height:90vh;overflow-y:auto;border-radius:16px;background:linear-gradient(160deg,rgba(22,32,52,0.98),rgba(12,18,36,0.99));border:1px solid rgba(71,85,105,0.4);box-shadow:0 48px 120px rgba(0,0,0,0.85),0 0 80px rgba(59,130,246,0.06);animation:modalIn 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <!-- Header -->
        <div class="p-5 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(29,78,216,0.12),rgba(59,130,246,0.06));">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(29,78,216,0.3),rgba(59,130,246,0.2));border:1px solid rgba(59,130,246,0.3);">
              <i class="fas fa-robot text-blue-400"></i>
            </div>
            <div>
              <h2 class="text-white font-bold text-base leading-tight" x-text="editId?'Editar Regra de Automação':'Nova Regra de Automação'"></h2>
              <p class="text-slate-500 text-xs" x-text="'Passo '+step+' de 3 — '+(step===1?'Nome':step===2?'Condições':'Ação')"></p>
            </div>
          </div>
          <button @click="showModal=false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg"><i class="fas fa-times text-xs"></i></button>
        </div>

        <!-- Steps indicator -->
        <div class="px-5 pt-4">
          <div class="step-indicator mb-4">
            <div :class="step>=1?'active':''" class="step-dot">1</div>
            <div :class="step>=2?'done':''" class="step-line"></div>
            <div :class="step>=2?'active':''" class="step-dot">2</div>
            <div :class="step>=3?'done':''" class="step-line"></div>
            <div :class="step>=3?'active':''" class="step-dot">3</div>
          </div>
          <div class="flex justify-between text-xs text-slate-600 -mt-2 mb-2 px-0.5">
            <span :class="step>=1?'text-blue-400 font-semibold':''">Nome</span>
            <span :class="step>=2?'text-blue-400 font-semibold':''">Condições</span>
            <span :class="step>=3?'text-blue-400 font-semibold':''">Ação</span>
          </div>
        </div>

        <div class="p-5 space-y-4">
          <!-- Step 1: Name -->
          <div x-show="step===1" x-transition>
            <label class="form-label text-base text-white mb-2 block">Nome da Regra</label>
            <input type="text" x-model="form.name" placeholder="Ex: $5 Gastos Sem Venda — Pausar" class="form-input text-base" @keydown.enter="form.name&&step++" />
            <p class="text-slate-500 text-xs mt-2">Dê um nome claro e descritivo para identificar a regra rapidamente.</p>
          </div>

          <!-- Step 2: Conditions -->
          <div x-show="step===2" x-transition>
            <p class="text-slate-300 font-semibold text-sm mb-3">SE a campanha atender a estas condições:</p>
            <div class="space-y-2">
              <template x-for="(cond, idx) in form.conditions" :key="idx">
                <div class="flex items-center gap-2 p-3 rounded-xl" style="background:rgba(15,23,42,0.6);border:1px solid rgba(51,65,85,0.4);">
                  <select x-model="cond.metric" class="form-select flex-1">
                    ${metricOptions}
                  </select>
                  <select x-model="cond.operator" class="form-select" style="width:70px;">
                    ${operOptions}
                  </select>
                  <input type="number" x-model.number="cond.value" class="form-input text-center" style="width:80px;" step="0.01" min="0" />
                  <button @click="removeCondition(idx)" :disabled="form.conditions.length<=1" class="btn btn-ghost btn-xs hover:text-red-400 flex-shrink-0" :class="form.conditions.length<=1?'opacity-30 cursor-not-allowed':''">
                    <i class="fas fa-times text-xs"></i>
                  </button>
                </div>
              </template>
            </div>
            <button @click="addCondition()" class="btn btn-secondary btn-sm mt-2">
              <i class="fas fa-plus text-xs"></i> Adicionar condição
            </button>
          </div>

          <!-- Step 3: Action -->
          <div x-show="step===3" x-transition>
            <p class="text-slate-300 font-semibold text-sm mb-3">ENTÃO executar esta ação:</p>
            <div class="space-y-2">
              ${s.ACTIONS.map(a=>`
              <label class="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all" :style="form.action==='${a.value}'?'background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.4);':'background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.4);'">
                <input type="radio" x-model="form.action" value="${a.value}" class="sr-only" />
                <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(${a.color==='#ef4444'?'239,68,68':a.color==='#f59e0b'?'245,158,11':a.color==='#a855f7'?'168,85,247':'34,197,94'},0.15);">
                  <i class="${a.icon} text-lg" style="color:${a.color}"></i>
                </div>
                <div class="flex-1">
                  <p class="text-white font-semibold text-sm">${a.label}</p>
                </div>
                <i :class="form.action==='${a.value}'?'fas fa-circle-dot text-blue-400':'far fa-circle text-slate-600'" class="text-lg"></i>
              </label>`).join('')}
            </div>
          </div>
        </div>

        <div class="p-4 flex gap-2" style="border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);">
          <button x-show="step>1" @click="step--" class="btn btn-secondary">
            <i class="fas fa-chevron-left text-xs"></i> Anterior
          </button>
          <button x-show="step<3" @click="step++" :disabled="step===1&&!form.name" class="btn btn-primary flex-1"
            :class="step===1&&!form.name?'opacity-50 cursor-not-allowed':''">
            Próximo <i class="fas fa-chevron-right text-xs"></i>
          </button>
          <button x-show="step===3" @click="saveRule()" :disabled="saving" class="btn btn-primary flex-1">
            <i :class="saving?'fas fa-spinner fa-spin':'fas fa-check'" class="text-xs"></i>
            <span x-text="editId?'Salvar Alterações':'Criar Regra'"></span>
          </button>
        </div>
      </div>
      </div>
    </div>

  </div>`;
},

// ── Alerts Page ───────────────────────────────────────────────────────────
alerts(s) {
  return `
  <div class="fade-in space-y-5">
    <!-- Summary -->
    <div class="grid grid-cols-3 gap-4">
      <div class="glass rounded-2xl p-4 text-center alert-critical rounded-2xl">
        <p class="text-2xl font-bold text-red-400" x-text="criticalCount"></p>
        <p class="text-slate-400 text-xs mt-0.5">Urgentes</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center alert-warning rounded-2xl">
        <p class="text-2xl font-bold text-amber-400" x-text="warningCount"></p>
        <p class="text-slate-400 text-xs mt-0.5">Atenção</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-white" x-text="alerts.length"></p>
        <p class="text-slate-400 text-xs mt-0.5">Total</p>
      </div>
    </div>

    <!-- Filters + bulk actions -->
    <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div class="flex gap-2 flex-wrap">
        <button @click="filter=''" :class="filter===''?'bg-blue-600 text-white border-blue-600':''" class="btn btn-secondary btn-sm">Todos</button>
        <button @click="filter='critical'" :class="filter==='critical'?'bg-red-600/30 text-red-300 border-red-500/40':''" class="btn btn-secondary btn-sm">
          <i class="fas fa-fire text-xs text-red-400"></i> Urgentes
        </button>
        <button @click="filter='warning'" :class="filter==='warning'?'bg-amber-600/30 text-amber-300 border-amber-500/40':''" class="btn btn-secondary btn-sm">
          <i class="fas fa-triangle-exclamation text-xs text-amber-400"></i> Atenção
        </button>
        <button @click="filter='info'" :class="filter==='info'?'bg-blue-600/30 text-blue-300 border-blue-500/40':''" class="btn btn-secondary btn-sm">
          <i class="fas fa-circle-info text-xs text-blue-400"></i> Info
        </button>
      </div>
      <div class="ml-auto flex gap-2 flex-wrap">
        <button @click="sendAlertEmail()" class="btn btn-secondary btn-sm" :disabled="filtered.length===0" title="Enviar alertas por email">
          <i class="fas fa-envelope text-xs"></i> Email
        </button>
        <button @click="pauseAll()" class="btn btn-danger btn-sm" :disabled="filtered.length===0">
          <i class="fas fa-pause text-xs"></i> Pausar Todas
        </button>
        <button @click="ignoreAll()" class="btn btn-ghost btn-sm" :disabled="filtered.length===0">
          <i class="fas fa-eye-slash text-xs"></i> Ignorar Todas
        </button>
      </div>
    </div>

    <!-- Alert List -->
    <div class="space-y-3">
      <template x-for="al in filtered" :key="al.id">
        <div :class="sClass(al.severity)" class="glass rounded-2xl p-4 fade-in">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                 :style="'background:'+( al.severity==='critical'?'rgba(239,68,68,0.15)':al.severity==='warning'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.15)')">
              <i :class="sIcon(al.severity)+' text-lg'" :style="'color:'+sColor(al.severity)"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="badge text-xs font-bold"
                      :style="'background:'+(al.severity==='critical'?'rgba(239,68,68,0.15)':al.severity==='warning'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.15)')+';color:'+(al.severity==='critical'?'#f87171':al.severity==='warning'?'#fbbf24':'#60a5fa')+';border:1px solid '+(al.severity==='critical'?'rgba(239,68,68,0.3)':al.severity==='warning'?'rgba(245,158,11,0.3)':'rgba(59,130,246,0.3)')">
                  <span x-text="sLabel(al.severity)"></span>
                </span>
                <span class="text-white font-semibold text-sm truncate" x-text="al.campaign_name||al.campaign||'—'"></span>
              </div>
              <p class="text-slate-300 text-sm" x-text="al.message||al.msg||''"></p>
              <div class="flex items-center gap-3 mt-1.5">
                <span class="text-xs text-slate-500"><i class="fas fa-dollar-sign text-xs mr-1"></i>Gasto: <span class="text-slate-300 font-medium" x-text="'$'+Number(al.spend||0).toFixed(2)"></span></span>
                <span class="text-xs text-slate-500"><i class="fas fa-bullseye text-xs mr-1"></i>Conv.: <span class="text-slate-300 font-medium" x-text="al.conversions!==undefined?al.conversions:al.conv||0"></span></span>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
              <button @click="pauseAlert(al.id)" class="btn btn-danger btn-sm" title="Pausar campanha">
                <i class="fas fa-pause text-xs"></i> <span class="hidden sm:inline">Pausar</span>
              </button>
              <button @click="$dispatch('show-toast',{type:'info',message:'Abrindo '+(al.campaign_name||al.campaign||'')})" class="btn btn-secondary btn-sm" title="Ver campanha">
                <i class="fas fa-eye text-xs"></i>
              </button>
              <button @click="ignoreAlert(al.id)" class="btn btn-ghost btn-sm" title="Ignorar">
                <i class="fas fa-times text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </template>
      <template x-if="filtered.length===0">
        <div class="glass rounded-2xl p-12 text-center">
          <i class="fas fa-shield-check text-green-500 text-5xl mb-4 block"></i>
          <p class="text-white font-semibold text-lg mb-1">Tudo certo!</p>
          <p class="text-slate-400 text-sm">Nenhum alerta ativo no momento.</p>
        </div>
      </template>
    </div>
  </div>`;
},

// ── Quick Actions Page ────────────────────────────────────────────────────
quickActions(s) {
  return `
  <div class="fade-in space-y-5">
    <!-- Stats -->
    <div class="grid grid-cols-3 gap-4">
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-white" x-text="campaigns.length"></p>
        <p class="text-slate-400 text-xs mt-0.5">Total</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-green-400" x-text="activeCount"></p>
        <p class="text-slate-400 text-xs mt-0.5">Ativas</p>
      </div>
      <div class="glass rounded-2xl p-4 text-center">
        <p class="text-2xl font-bold text-slate-400" x-text="pausedCount"></p>
        <p class="text-slate-400 text-xs mt-0.5">Pausadas</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
        <input type="text" x-model="search" placeholder="Buscar campanha..." class="form-input pl-8" />
      </div>
      <select x-model="filterStatus" class="form-select" style="width:auto;">
        <option value="">Todas</option>
        <option value="active">Ativas</option>
        <option value="paused">Pausadas</option>
      </select>
      <label class="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400 hover:text-white">
        <input type="checkbox" @change="toggleAll()" :checked="allSelected()" class="w-4 h-4 rounded" />
        Selecionar todas
      </label>
    </div>

    <!-- Bulk Actions (visible when selected) -->
    <div x-show="selectedCount>0" x-transition class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3" style="border:1px solid rgba(59,130,246,0.3);display:none;">
      <span class="text-blue-400 font-semibold text-sm" x-text="selectedCount+' campanha(s) selecionada(s)'"></span>
      <div class="ml-auto flex gap-2">
        <button @click="bulkAction('pause')" :disabled="loading" class="btn btn-danger">
          <i :class="loading?'fas fa-spinner fa-spin':'fas fa-pause'" class="text-sm"></i>
          <span x-text="loading?'Pausando...':'Pausar Selecionadas'"></span>
        </button>
        <button @click="bulkAction('activate')" :disabled="loading" class="btn btn-success">
          <i :class="loading?'fas fa-spinner fa-spin':'fas fa-play'" class="text-sm"></i>
          Ativar Selecionadas
        </button>
        <button @click="selected=[]" class="btn btn-ghost btn-sm">
          <i class="fas fa-times text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Campaigns List -->
    <div class="glass rounded-2xl overflow-hidden">
      <template x-for="camp in filtered" :key="camp.id">
        <div class="flex items-center gap-3 p-3.5 border-b hover:bg-slate-800/40 transition-colors cursor-pointer" style="border-color:rgba(51,65,85,0.3);" @click="toggleSelect(camp.id)">
          <input type="checkbox" :checked="isSelected(camp.id)" @click.stop="toggleSelect(camp.id)" class="w-4 h-4 rounded flex-shrink-0" />
          <div class="w-2 h-2 rounded-full flex-shrink-0" :style="'background:'+( camp.status==='active'?'#22c55e':'#64748b')"></div>
          <div class="flex-1 min-w-0">
            <p class="text-white font-medium text-sm truncate" x-text="camp.name"></p>
            <p class="text-slate-500 text-xs" x-text="camp.account+' • '+camp.country"></p>
          </div>
          <div class="hidden sm:flex items-center gap-4 text-xs text-slate-400">
            <span class="font-mono" x-text="'$'+Number(camp.spend).toFixed(2)"></span>
            <span :class="camp.roas>=3?'text-green-400':camp.roas>=2?'text-amber-400':camp.roas===0?'text-slate-500':'text-red-400'" x-text="camp.roas>0?camp.roas.toFixed(2)+'x':'—'"></span>
          </div>
          <span class="badge" :class="camp.status==='active'?'badge-green':'badge-slate'" x-text="camp.status==='active'?'Ativa':'Pausada'"></span>
          <div class="flex gap-1 flex-shrink-0" @click.stop>
            <button @click="campaigns=campaigns.map(c=>c.id===camp.id?{...c,status:'paused'}:c); $dispatch('show-toast',{type:'success',message:'Campanha pausada!'})" x-show="camp.status==='active'" class="btn btn-ghost btn-xs hover:text-red-400" title="Pausar">
              <i class="fas fa-pause text-xs"></i>
            </button>
            <button @click="campaigns=campaigns.map(c=>c.id===camp.id?{...c,status:'active'}:c); $dispatch('show-toast',{type:'success',message:'Campanha ativada!'})" x-show="camp.status==='paused'" class="btn btn-ghost btn-xs hover:text-green-400" title="Ativar">
              <i class="fas fa-play text-xs"></i>
            </button>
          </div>
        </div>
      </template>
      <template x-if="filtered.length===0">
        <div class="p-10 text-center text-slate-500">
          <i class="fas fa-bolt text-4xl mb-3 block"></i>
          Nenhuma campanha encontrada.
        </div>
      </template>
    </div>
  </div>`;
},

// ── Reports Page ──────────────────────────────────────────────────────────
reports(s) {
  const metricLabels = {invest:'Investimento',conversions:'Conversões',cpa:'CPA',roas:'ROAS',ctr:'CTR',impressions:'Impressões',clicks:'Cliques'};
  return `
  <div class="fade-in">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Config Panel -->
      <div class="space-y-4">
        <div class="glass rounded-2xl p-5 space-y-4">
          <h3 class="text-white font-semibold flex items-center gap-2"><i class="fas fa-sliders text-blue-400"></i> Configurar Relatório</h3>

          <div>
            <label class="form-label">Tipo de Relatório</label>
            <div class="space-y-2">
              ${[['bm','Business Manager','fas fa-building'],['account','Conta de Anúncio','fas fa-credit-card'],['product','Por Produto','fas fa-box'],['country','Por País','fas fa-globe']].map(([v,l,ic])=>`
              <label class="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all"
                     :style="reportType==='${v}'?'background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);':'background:rgba(15,23,42,0.4);border:1px solid rgba(51,65,85,0.3);'">
                <input type="radio" x-model="reportType" value="${v}" class="sr-only" />
                <i class="${ic} text-sm" :style="reportType==='${v}'?'color:#60a5fa':'color:#64748b'"></i>
                <span class="text-sm" :class="reportType==='${v}'?'text-white':'text-slate-400'">${l}</span>
                <i :class="reportType==='${v}'?'fas fa-circle-dot text-blue-400':'far fa-circle text-slate-600'" class="ml-auto text-sm"></i>
              </label>`).join('')}
            </div>
          </div>

          <div>
            <label class="form-label">Período</label>
            <div class="flex flex-wrap gap-1.5 mt-1">
              ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'},{v:'custom',l:'Personalizado'}].map(p=>`
              <button @click="period='${p.v}'; showCustom='${p.v}'==='custom'" :class="period==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
            </div>
            <div x-show="showCustom" x-transition class="mt-2 space-y-2">
              <input type="date" x-model="customFrom" class="form-input" />
              <input type="date" x-model="customTo" class="form-input" />
            </div>
          </div>

          <div>
            <label class="form-label">Métricas</label>
            <div class="space-y-1.5">
              ${Object.entries(metricLabels).map(([k,l])=>`
              <label class="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" x-model="metrics.${k}" class="w-4 h-4 rounded" />
                <span class="text-sm text-slate-300 group-hover:text-white transition-colors">${l}</span>
              </label>`).join('')}
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <button @click="generatePreview()" :disabled="generating" class="btn btn-primary w-full btn-lg">
            <i :class="generating?'fas fa-spinner fa-spin':'fas fa-eye'" class="text-sm"></i>
            <span x-text="generating?'Gerando...':'Visualizar Relatório'"></span>
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button @click="exportPDF()" class="btn btn-secondary">
              <i class="fas fa-file-pdf text-red-400 text-sm"></i> PDF
            </button>
            <button @click="exportExcel()" class="btn btn-secondary">
              <i class="fas fa-file-excel text-green-400 text-sm"></i> Excel
            </button>
          </div>
          <div class="flex gap-2">
            <input type="email" x-model="email" placeholder="email@exemplo.com" class="form-input flex-1" />
            <button @click="sendEmail()" class="btn btn-secondary flex-shrink-0">
              <i class="fas fa-paper-plane text-blue-400"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="lg:col-span-2">
        <div x-show="!showPreview" class="glass rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center gap-4">
          <div class="w-20 h-20 rounded-2xl flex items-center justify-center" style="background:rgba(59,130,246,0.1);">
            <i class="fas fa-chart-area text-blue-400 text-3xl"></i>
          </div>
          <p class="text-white font-semibold text-lg">Configure e gere seu relatório</p>
          <p class="text-slate-400 text-sm text-center max-w-xs">Selecione o tipo, período e métricas desejadas, depois clique em "Visualizar Relatório".</p>
        </div>

        <div x-show="showPreview" x-transition class="space-y-4" style="display:none;">
          <!-- Summary cards (dynamic) -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="glass rounded-xl p-3 text-center"><i class="fas fa-dollar-sign text-2xl mb-1 block" style="color:#3b82f6"></i><p class="text-white font-bold text-lg" x-text="reportData && reportData.summary ? '$'+(reportData.summary.total_invest||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'"></p><p class="text-slate-400 text-xs">Investimento</p></div>
            <div class="glass rounded-xl p-3 text-center"><i class="fas fa-bullseye text-2xl mb-1 block" style="color:#22c55e"></i><p class="text-white font-bold text-lg" x-text="reportData && reportData.summary ? (reportData.summary.total_conversions||0) : '—'"></p><p class="text-slate-400 text-xs">Conversões</p></div>
            <div class="glass rounded-xl p-3 text-center"><i class="fas fa-chart-line text-2xl mb-1 block" style="color:#f59e0b"></i><p class="text-white font-bold text-lg" x-text="reportData && reportData.summary ? (reportData.summary.avg_roas||0).toFixed(2)+'x' : '—'"></p><p class="text-slate-400 text-xs">ROAS Médio</p></div>
            <div class="glass rounded-xl p-3 text-center"><i class="fas fa-coins text-2xl mb-1 block" style="color:#a855f7"></i><p class="text-white font-bold text-lg" x-text="reportData && reportData.summary ? '$'+(reportData.summary.avg_cpa||0).toFixed(2) : '—'"></p><p class="text-slate-400 text-xs">CPA Médio</p></div>
          </div>
          <!-- Chart -->
          <div class="glass rounded-2xl p-5">
            <h3 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <i class="fas fa-chart-line text-blue-400"></i> Evolução no Período
            </h3>
            <div class="chart-container" style="height:240px;">
              <canvas id="ch-report"></canvas>
            </div>
          </div>
          <!-- Table preview -->
          <div class="glass rounded-2xl overflow-hidden">
            <div class="p-4 border-b" style="border-color:rgba(51,65,85,0.4);">
              <h3 class="text-sm font-semibold text-slate-300">Dados Detalhados por Conta</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead><tr><th>Conta</th><th>Invest.</th><th>Conv.</th></tr></thead>
                <tbody>
                  <template x-if="reportData && reportData.by_account && reportData.by_account.length">
                    <template x-for="a in reportData.by_account" :key="a.name">
                      <tr>
                        <td class="font-medium text-white" x-text="a.name"></td>
                        <td class="font-mono text-blue-400" x-text="'$'+(a.spend||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})"></td>
                        <td class="text-green-400" x-text="a.conversions||0"></td>
                      </tr>
                    </template>
                  </template>
                  <template x-if="!reportData || !reportData.by_account || !reportData.by_account.length">
                    <tr><td colspan="3" class="text-center py-4 text-slate-500">Sem dados para exibir</td></tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
},

// ── Settings Page ─────────────────────────────────────────────────────────
settings(s) {
  return `
  <div class="fade-in">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Tabs sidebar -->
      <div class="space-y-1">
        <template x-for="t in tabs" :key="t.id">
          <button @click="tab=t.id" class="sidebar-item" :class="tab===t.id?'active':''">
            <i :class="t.icon+' icon'"></i>
            <span x-text="t.label"></span>
          </button>
        </template>
      </div>

      <!-- Tab Content -->
      <div class="lg:col-span-3">

        <!-- GENERAL -->
        <div x-show="tab==='general'" x-transition class="space-y-4">
          <div class="glass rounded-2xl p-5 space-y-4">
            <h3 class="text-white font-semibold border-b pb-3" style="border-color:rgba(51,65,85,0.4);">Preferências Gerais</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Moeda Padrão</label>
                <select x-model="cfg.currency" class="form-select">
                  <option value="USD">USD — Dólar</option>
                  <option value="BRL">BRL — Real</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div>
                <label class="form-label">Fuso Horário</label>
                <select x-model="cfg.timezone" class="form-select">
                  <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                  <option value="Europe/London">London (GMT+0)</option>
                </select>
              </div>
              <div>
                <label class="form-label">Idioma</label>
                <select x-model="cfg.language" class="form-select">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label class="form-label">Atualização Automática</label>
                <select x-model="cfg.refreshInterval" class="form-select">
                  <option value="0">Desativada</option>
                  <option value="5">A cada 5 min</option>
                  <option value="15">A cada 15 min</option>
                  <option value="30">A cada 30 min</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl" style="background:rgba(15,23,42,0.5);">
              <div>
                <p class="text-white text-sm font-medium">Modo Compacto</p>
                <p class="text-slate-400 text-xs">Reduz espaçamento para mais informações na tela</p>
              </div>
              <label class="toggle-wrapper">
                <input type="checkbox" x-model="cfg.compactMode" class="toggle-input" />
                <div class="toggle-track"></div>
                <div class="toggle-thumb"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- NOTIFICATIONS -->
        <div x-show="tab==='notifications'" x-transition class="space-y-4">
          <div class="glass rounded-2xl p-5 space-y-4">
            <h3 class="text-white font-semibold border-b pb-3" style="border-color:rgba(51,65,85,0.4);">Canais de Notificação</h3>
            ${[['notifEmail','Email','fas fa-envelope','Receber alertas por email'],['notifSlack','Slack','fab fa-slack','Integrar com workspace do Slack'],['notifWhatsapp','WhatsApp','fab fa-whatsapp','Enviar alertas via WhatsApp']].map(([k,l,ic,desc])=>`
            <div class="flex items-center justify-between p-3.5 rounded-xl" style="background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.3);">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background:rgba(59,130,246,0.1);">
                  <i class="${ic} text-blue-400"></i>
                </div>
                <div>
                  <p class="text-white text-sm font-medium">${l}</p>
                  <p class="text-slate-400 text-xs">${desc}</p>
                </div>
              </div>
              <label class="toggle-wrapper">
                <input type="checkbox" x-model="cfg.${k}" class="toggle-input" />
                <div class="toggle-track"></div>
                <div class="toggle-thumb"></div>
              </label>
            </div>`).join('')}
            <h3 class="text-white font-semibold border-b pb-3 pt-2" style="border-color:rgba(51,65,85,0.4);">Tipos de Alerta</h3>
            ${[['notifCritical','Alertas Críticos','fas fa-fire','#ef4444'],['notifWarning','Alertas de Atenção','fas fa-triangle-exclamation','#f59e0b'],['notifInfo','Alertas Informativos','fas fa-circle-info','#3b82f6']].map(([k,l,ic,co])=>`
            <div class="flex items-center justify-between p-3 rounded-xl" style="background:rgba(15,23,42,0.4);">
              <div class="flex items-center gap-2">
                <i class="${ic} text-sm" style="color:${co}"></i>
                <span class="text-sm text-slate-300">${l}</span>
              </div>
              <label class="toggle-wrapper">
                <input type="checkbox" x-model="cfg.${k}" class="toggle-input" />
                <div class="toggle-track"></div>
                <div class="toggle-thumb"></div>
              </label>
            </div>`).join('')}
          </div>
        </div>

        <!-- INTEGRATIONS -->
        <div x-show="tab==='integrations'" x-transition class="space-y-4">
          <!-- AI Provider Config -->
          <div class="glass rounded-2xl p-5 space-y-4" style="border:1px solid rgba(168,85,247,0.2);">
            <h3 class="text-white font-semibold border-b pb-3 flex items-center gap-2" style="border-color:rgba(51,65,85,0.4);">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);">
                <i class="fas fa-wand-magic-sparkles text-white text-xs"></i>
              </div>
              Inteligência Artificial (Criar Regras)
            </h3>
            <p class="text-slate-400 text-xs">Escolha o provedor de IA para criar regras em linguagem natural.</p>

            <!-- Provider selector -->
            <div>
              <label class="form-label">Provedor de IA</label>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                       :style="(cfg.ai_provider||'anthropic')==='anthropic'?'background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.4);':'background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.4);'">
                  <input type="radio" x-model="cfg.ai_provider" value="anthropic" class="sr-only" />
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);">
                    <i class="fas fa-wand-magic-sparkles text-white text-xs"></i>
                  </div>
                  <div>
                    <p class="text-white text-sm font-semibold">Claude</p>
                    <p class="text-slate-500 text-xs">Anthropic</p>
                  </div>
                  <i :class="(cfg.ai_provider||'anthropic')==='anthropic'?'fas fa-circle-dot text-purple-400':'far fa-circle text-slate-600'" class="ml-auto text-sm"></i>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                       :style="cfg.ai_provider==='openai'?'background:rgba(16,163,127,0.12);border:1px solid rgba(16,163,127,0.4);':'background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.4);'">
                  <input type="radio" x-model="cfg.ai_provider" value="openai" class="sr-only" />
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg,#10a37f,#0d8a6c);">
                    <i class="fas fa-robot text-white text-xs"></i>
                  </div>
                  <div>
                    <p class="text-white text-sm font-semibold">GPT</p>
                    <p class="text-slate-500 text-xs">OpenAI</p>
                  </div>
                  <i :class="cfg.ai_provider==='openai'?'fas fa-circle-dot text-emerald-400':'far fa-circle text-slate-600'" class="ml-auto text-sm"></i>
                </label>
              </div>
            </div>

            <!-- Anthropic key -->
            <div x-show="(cfg.ai_provider||'anthropic')==='anthropic'" x-transition>
              <label class="form-label"><i class="fas fa-key text-purple-400 mr-1"></i>Chave Claude API (Anthropic)</label>
              <input type="password" x-model="cfg.anthropic_api_key" placeholder="sk-ant-api03-..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1.5"><i class="fas fa-circle-info text-blue-400 mr-1"></i>Obtenha em <span class="text-blue-400">console.anthropic.com</span></p>
            </div>

            <!-- OpenAI key -->
            <div x-show="cfg.ai_provider==='openai'" x-transition>
              <label class="form-label"><i class="fas fa-key text-emerald-400 mr-1"></i>Chave OpenAI API</label>
              <input type="password" x-model="cfg.openai_api_key" placeholder="sk-proj-..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1.5"><i class="fas fa-circle-info text-blue-400 mr-1"></i>Obtenha em <span class="text-blue-400">platform.openai.com/api-keys</span></p>
            </div>

            <div class="flex items-center gap-2 p-3 rounded-xl text-xs" style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);">
              <i class="fas fa-shield-halved text-purple-400 flex-shrink-0"></i>
              <p class="text-slate-400">Chaves armazenadas apenas localmente (SQLite). Nunca enviadas a terceiros.</p>
            </div>
          </div>

          <!-- Web Intelligence Search APIs -->
          <div class="glass rounded-2xl p-5 space-y-4" style="border:1px solid rgba(6,182,212,0.2);">
            <h3 class="text-white font-semibold border-b pb-3 flex items-center gap-2" style="border-color:rgba(51,65,85,0.4);">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(6,182,212,0.15);">
                <i class="fas fa-globe text-cyan-400 text-xs"></i>
              </div>
              Inteligência de Mercado (Busca Web)
            </h3>
            <p class="text-slate-400 text-xs">Necessário para pesquisas de mercado, estratégias e tendências de Reddit, YouTube, X e blogs.</p>
            <div>
              <label class="form-label"><i class="fas fa-magnifying-glass text-cyan-400 mr-1"></i>Serper API Key <span class="text-slate-500 font-normal">(Google Search)</span></label>
              <input type="password" x-model="cfg.serper_api_key" placeholder="Chave da API Serper..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1">Grátis: 2500 buscas/mês em <span class="text-cyan-400">serper.dev</span></p>
            </div>
            <div>
              <label class="form-label"><i class="fas fa-shield text-cyan-400 mr-1"></i>Brave Search API Key <span class="text-slate-500 font-normal">(alternativo)</span></label>
              <input type="password" x-model="cfg.brave_api_key" placeholder="BSA..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1">Alternativa ao Serper em <span class="text-cyan-400">api.search.brave.com</span></p>
            </div>
          </div>

          <!-- ClickUp -->
          <div class="glass rounded-2xl p-5 space-y-4" style="border:1px solid rgba(59,130,246,0.2);">
            <h3 class="text-white font-semibold border-b pb-3 flex items-center gap-2" style="border-color:rgba(51,65,85,0.4);">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(59,130,246,0.15);">
                <i class="fas fa-check-square text-blue-400 text-xs"></i>
              </div>
              ClickUp
            </h3>
            <div>
              <label class="form-label"><i class="fas fa-key text-blue-400 mr-1"></i>API Key do ClickUp</label>
              <input type="password" x-model="cfg.clickup_api_key" placeholder="pk_..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1">Obtenha em: Configurações → Apps → API Token</p>
            </div>
            <div>
              <label class="form-label"><i class="fas fa-list text-blue-400 mr-1"></i>ID da Lista (clickup_list_id)</label>
              <input type="text" x-model="cfg.clickup_list_id" placeholder="901322010985" class="form-input" />
              <p class="text-slate-500 text-xs mt-1">URL da lista: app.clickup.com/TEAM/v/li/<strong>ID_AQUI</strong></p>
            </div>
          </div>

          <!-- Notion -->
          <div class="glass rounded-2xl p-5 space-y-4" style="border:1px solid rgba(139,92,246,0.2);">
            <h3 class="text-white font-semibold border-b pb-3 flex items-center gap-2" style="border-color:rgba(51,65,85,0.4);">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(139,92,246,0.15);">
                <i class="fas fa-n text-purple-400 text-xs font-bold"></i>
              </div>
              Notion
            </h3>
            <div>
              <label class="form-label"><i class="fas fa-key text-purple-400 mr-1"></i>Token de Integração Notion</label>
              <input type="password" x-model="cfg.notion_token" placeholder="secret_..." class="form-input" />
              <p class="text-slate-500 text-xs mt-1">Crie uma integração em: notion.so/my-integrations</p>
            </div>
            <div>
              <label class="form-label"><i class="fas fa-database text-purple-400 mr-1"></i>ID do DB — Análises Diárias</label>
              <input type="text" x-model="cfg.notion_db_id" placeholder="2bef5bb421844beaac57ccec4f744822" class="form-input" />
              <p class="text-slate-500 text-xs mt-1">ID da database onde serão criadas as análises</p>
            </div>
            <div>
              <label class="form-label"><i class="fas fa-box text-purple-400 mr-1"></i>ID do DB — Produtos</label>
              <input type="text" x-model="cfg.notion_products_db_id" placeholder="91fc0fc4501149c59dfe21a10b8cf434" class="form-input" />
              <p class="text-slate-500 text-xs mt-1">ID da database de produtos (para lista de seleção)</p>
            </div>
          </div>

          <!-- Other integrations -->
          <div class="glass rounded-2xl p-5 space-y-4">
            <h3 class="text-white font-semibold border-b pb-3" style="border-color:rgba(51,65,85,0.4);">Outras Integrações</h3>
            <div>
              <label class="form-label"><i class="fas fa-envelope text-blue-400 mr-1"></i>Email para Alertas / Relatórios</label>
              <input type="email" x-model="cfg.emailAddr" placeholder="seu@email.com" class="form-input" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label"><i class="fas fa-server text-slate-400 mr-1"></i>SMTP Host</label>
                <input type="text" x-model="cfg.smtp_host" placeholder="smtp.gmail.com" class="form-input" />
              </div>
              <div>
                <label class="form-label"><i class="fas fa-hashtag text-slate-400 mr-1"></i>SMTP Porta</label>
                <input type="number" x-model="cfg.smtp_port" placeholder="587" class="form-input" />
              </div>
              <div>
                <label class="form-label"><i class="fas fa-user text-slate-400 mr-1"></i>SMTP Usuário</label>
                <input type="email" x-model="cfg.smtp_user" placeholder="seu@gmail.com" class="form-input" />
              </div>
              <div>
                <label class="form-label"><i class="fas fa-key text-slate-400 mr-1"></i>SMTP Senha / App Password</label>
                <input type="password" x-model="cfg.smtp_pass" placeholder="••••••••" class="form-input" />
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 rounded-xl text-xs" style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.15);">
              <i class="fas fa-circle-info text-blue-400 flex-shrink-0"></i>
              <p class="text-slate-400">Para Gmail: ative a verificação em 2 etapas e crie uma <strong class="text-blue-300">Senha de App</strong> em myaccount.google.com/apppasswords</p>
            </div>
            <button @click="testEmail()" class="btn btn-secondary btn-sm w-fit">
              <i class="fas fa-paper-plane text-xs mr-1"></i> Enviar email de teste
            </button>
            <div>
              <label class="form-label"><i class="fab fa-slack text-purple-400 mr-1"></i>Slack Webhook URL</label>
              <div class="flex gap-2">
                <input type="text" x-model="cfg.slackWebhook" placeholder="https://hooks.slack.com/..." class="form-input flex-1" />
                <button @click="testInteg('Slack')" class="btn btn-secondary btn-sm flex-shrink-0">Testar</button>
              </div>
            </div>
            <div>
              <label class="form-label"><i class="fab fa-whatsapp text-green-400 mr-1"></i>WhatsApp (número)</label>
              <div class="flex gap-2">
                <input type="tel" x-model="cfg.whatsappNumber" placeholder="+55 11 99999-9999" class="form-input flex-1" />
                <button @click="testInteg('WhatsApp')" class="btn btn-secondary btn-sm flex-shrink-0">Testar</button>
              </div>
            </div>
          </div>
        </div>

        <!-- BACKUP -->
        <div x-show="tab==='backup'" x-transition class="space-y-4">
          <div class="glass rounded-2xl p-5 space-y-4">
            <h3 class="text-white font-semibold border-b pb-3" style="border-color:rgba(51,65,85,0.4);">Backup & Restauração</h3>
            <div class="p-4 rounded-xl" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);">
              <p class="text-blue-300 text-sm font-medium mb-1"><i class="fas fa-circle-info mr-1.5"></i>O backup exporta todas as configurações</p>
              <p class="text-slate-400 text-xs">Inclui BMs, contas, regras e preferências em formato JSON.</p>
            </div>
            <button @click="backup()" class="btn btn-primary w-full btn-lg">
              <i class="fas fa-download"></i> Exportar Backup (JSON)
            </button>
            <div>
              <label class="form-label">Restaurar Backup</label>
              <div class="p-4 rounded-xl text-center cursor-pointer transition-all" style="background:rgba(15,23,42,0.5);border:2px dashed rgba(51,65,85,0.6);" @dragover.prevent @drop.prevent="$dispatch('show-toast',{type:'info',message:'Restauração em breve!'})">
                <i class="fas fa-upload text-slate-500 text-2xl mb-2 block"></i>
                <p class="text-slate-400 text-sm">Arraste um arquivo .json aqui ou clique para selecionar</p>
                <input type="file" accept=".json" class="hidden" @change="$dispatch('show-toast',{type:'info',message:'Restauração em breve!'})" />
              </div>
            </div>
          </div>
        </div>

        <!-- ABOUT -->
        <div x-show="tab==='about'" x-transition>
          <div class="glass rounded-2xl p-8 text-center space-y-4">
            <div class="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto" style="background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 8px 32px rgba(59,130,246,0.4);">
              <i class="fas fa-chart-line text-white text-3xl"></i>
            </div>
            <div>
              <h2 class="text-white font-bold text-2xl">Meta Ads Control Center</h2>
              <p class="text-blue-400 font-medium">v1.0.0</p>
            </div>
            <p class="text-slate-400 text-sm max-w-md mx-auto">Plataforma profissional de gestão de campanhas Meta Ads. Monitore, analise e otimize suas campanhas em tempo real.</p>
            <div class="grid grid-cols-3 gap-4 pt-2">
              <div class="glass rounded-xl p-3 text-center">
                <p class="text-white font-bold text-lg" x-text="$store.meta.bmCount"></p>
                <p class="text-slate-400 text-xs">BMs</p>
              </div>
              <div class="glass rounded-xl p-3 text-center">
                <p class="text-white font-bold text-lg" x-text="$store.meta.accountCount"></p>
                <p class="text-slate-400 text-xs">Contas</p>
              </div>
              <div class="glass rounded-xl p-3 text-center">
                <p class="text-white font-bold text-lg">—</p>
                <p class="text-slate-400 text-xs">Campanhas</p>
              </div>
            </div>
            <div class="pt-2 flex flex-col items-center gap-2">
              <span class="badge badge-green"><i class="fas fa-circle text-xs"></i> Sistema Operacional</span>
              <p class="text-slate-500 text-xs">Powered by FastAPI + Alpine.js + Tailwind CSS</p>
            </div>
          </div>
        </div>

        <!-- Save button -->
        <div x-show="tab!=='about' && tab!=='backup'" class="pt-2">
          <button @click="save()" :disabled="saving" class="btn btn-primary btn-lg w-full sm:w-auto">
            <i :class="saving?'fas fa-spinner fa-spin':'fas fa-save'" class="text-sm"></i>
            <span x-text="saving?'Salvando...':'Salvar Configurações'"></span>
          </button>
        </div>
      </div>
    </div>
  </div>`;
},

}; // end window.TPL
