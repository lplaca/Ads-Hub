document.addEventListener('alpine:init', () => {

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('ProductsPage', () => ({
  period: '7',
  selected: null,
  chart: null,

  init() {
    this.$nextTick(() => this.buildChart());
    this.$watch('period', () => this.$nextTick(() => this.buildChart()));
  },

  buildChart() {
    if (this.chart) { try { this.chart.destroy(); } catch {} }
    const el = document.getElementById('ch-products');
    if (!el) return;
    this.chart = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: MOCK.products.map(p => p.code),
        datasets: [
          { label:'Investimento', data: MOCK.products.map(p => p.invest), backgroundColor: hexToRgba('#3b82f6', 0.7), borderColor:'#3b82f6', borderWidth:1, borderRadius:6 },
          { label:'Conversões (x10)', data: MOCK.products.map(p => p.conversions * 10), backgroundColor: hexToRgba('#22c55e', 0.7), borderColor:'#22c55e', borderWidth:1, borderRadius:6 },
          { label:'ROAS (x100)', data: MOCK.products.map(p => p.roas * 100), backgroundColor: hexToRgba('#f59e0b', 0.7), borderColor:'#f59e0b', borderWidth:1, borderRadius:6 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#94a3b8', font:{size:11} } }, tooltip: { backgroundColor:'rgba(15,23,42,0.95)', borderColor:'rgba(51,65,85,0.8)', borderWidth:1, padding:10 } },
        scales: { x:{ grid:{display:false}, ticks:{color:'#64748b'} }, y:{ grid:{color:'rgba(51,65,85,0.3)'}, ticks:{color:'#64748b'} } }
      }
    });
  },

  getCampaigns(code) {
    return MOCK.campaigns.filter(c => c.name.includes(code));
  },
}));

// ══════════════════════════════════════════════════════════════════════════════
//  RULES
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('RulesPage', () => ({
  rules: JSON.parse(JSON.stringify(MOCK.rules)),
  showModal: false,
  step: 1,
  form: {
    name: '',
    conditions: [{ metric:'spend', operator:'>=', value:5 }],
    action: 'pause',
    enabled: true,
  },
  editId: null,

  METRICS: [
    { value:'spend',       label:'Gasto ($)' },
    { value:'spend_pct',   label:'Gasto (% do budget)' },
    { value:'conversions', label:'Conversões' },
    { value:'checkouts',   label:'Checkouts' },
    { value:'roas',        label:'ROAS' },
    { value:'cpa',         label:'CPA ($)' },
    { value:'ctr',         label:'CTR (%)' },
  ],
  OPERATORS: [
    { value:'>=', label:'>=' }, { value:'<=', label:'<=' },
    { value:'==', label:'=' }, { value:'>', label:'>' },
    { value:'<',  label:'<' },
  ],
  ACTIONS: [
    { value:'pause',  label:'Pausar campanha',     icon:'fas fa-pause', color:'#ef4444' },
    { value:'notify', label:'Apenas notificar',    icon:'fas fa-bell',  color:'#f59e0b' },
    { value:'budget', label:'Reduzir orçamento',   icon:'fas fa-minus-circle', color:'#a855f7' },
  ],

  init() {},

  openModal(rule) {
    if (rule) {
      this.form = { name:rule.name, conditions:JSON.parse(JSON.stringify(rule.conditions)), action:rule.action, enabled:rule.enabled };
      this.editId = rule.id;
    } else {
      this.form = { name:'', conditions:[{metric:'spend',operator:'>=',value:5}], action:'pause', enabled:true };
      this.editId = null;
    }
    this.step = 1; this.showModal = true;
  },

  addCondition() {
    this.form.conditions.push({ metric:'conversions', operator:'==', value:0 });
  },

  removeCondition(i) {
    if (this.form.conditions.length > 1) this.form.conditions.splice(i, 1);
  },

  async toggleRule(id) {
    const r = this.rules.find(r => r.id === id);
    if (r) { r.enabled = !r.enabled; toast(r.enabled ? 'success' : 'info', 'Regra "'+r.name+'" '+(r.enabled?'ativada':'desativada')+'!'); }
  },

  saveRule() {
    if (!this.form.name) { toast('warning', 'Dê um nome à regra'); return; }
    if (this.editId) {
      const i = this.rules.findIndex(r => r.id === this.editId);
      if (i >= 0) this.rules[i] = {...this.rules[i], ...this.form};
      toast('success', 'Regra atualizada!');
    } else {
      this.rules.push({ id:'r_'+Date.now(), ...this.form, trigger_count:0 });
      toast('success', 'Regra "'+this.form.name+'" criada!');
    }
    this.showModal = false;
  },

  deleteRule(id, name) {
    if (!confirm('Remover a regra "'+name+'"?')) return;
    this.rules = this.rules.filter(r => r.id !== id);
    toast('success', 'Regra removida!');
  },

  conditionText(conds) {
    return conds.map(c => {
      const m = this.METRICS.find(x => x.value === c.metric)?.label || c.metric;
      return m + ' ' + c.operator + ' ' + c.value;
    }).join(' E ');
  },

  actionLabel(a) { return this.ACTIONS.find(x => x.value === a)?.label || a; },
  actionIcon(a)  { return this.ACTIONS.find(x => x.value === a)?.icon || 'fas fa-cog'; },
  actionColor(a) { return this.ACTIONS.find(x => x.value === a)?.color || '#64748b'; },
}));

// ══════════════════════════════════════════════════════════════════════════════
//  ALERTS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('AlertsPage', () => ({
  alerts: JSON.parse(JSON.stringify(MOCK.alerts)),
  filter: '',
  selected: [],

  init() {},

  get filtered() {
    if (!this.filter) return this.alerts;
    return this.alerts.filter(a => a.severity === this.filter);
  },

  get criticalCount() { return this.alerts.filter(a => a.severity === 'critical').length; },
  get warningCount()  { return this.alerts.filter(a => a.severity === 'warning').length; },

  severityClass(s) {
    return s === 'critical' ? 'alert-critical' : s === 'warning' ? 'alert-warning' : 'alert-info';
  },

  severityIcon(s)  { return s === 'critical' ? 'fas fa-fire' : s === 'warning' ? 'fas fa-triangle-exclamation' : 'fas fa-circle-info'; },
  severityColor(s) { return s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#3b82f6'; },
  severityLabel(s) { return s === 'critical' ? 'URGENTE' : s === 'warning' ? 'ATENÇÃO' : 'INFO'; },

  pauseAlert(id) {
    const a = this.alerts.find(x => x.id === id);
    if (a) toast('success', 'Campanha "'+a.campaign+'" pausada!');
    this.alerts = this.alerts.filter(x => x.id !== id);
  },

  ignoreAlert(id) {
    this.alerts = this.alerts.filter(x => x.id !== id);
    toast('info', 'Alerta ignorado.');
  },

  pauseAll() {
    const count = this.filtered.length;
    this.alerts = this.alerts.filter(a => this.filter ? a.severity !== this.filter : false);
    if (!this.filter) this.alerts = [];
    toast('success', count + ' campanha(s) pausada(s)!');
  },

  ignoreAll() {
    if (this.filter) this.alerts = this.alerts.filter(a => a.severity !== this.filter);
    else this.alerts = [];
    toast('info', 'Todos os alertas ignorados.');
  },
}));

}); // end alpine:init
