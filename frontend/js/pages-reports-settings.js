document.addEventListener('alpine:init', () => {

// ══════════════════════════════════════════════════════════════════════════════
//  QUICK ACTIONS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('QuickActionsPage', () => ({
  campaigns: JSON.parse(JSON.stringify(MOCK.campaigns)),
  selected: [],
  search: '',
  filterStatus: '',
  loading: false,

  init() {},

  get filtered() {
    return this.campaigns.filter(c => {
      if (this.search && !c.name.toLowerCase().includes(this.search.toLowerCase())) return false;
      if (this.filterStatus && c.status !== this.filterStatus) return false;
      return true;
    });
  },

  get selectedCount() { return this.selected.length; },
  get activeCount()   { return this.campaigns.filter(c => c.status === 'active').length; },
  get pausedCount()   { return this.campaigns.filter(c => c.status === 'paused').length; },

  toggleSelect(id) {
    if (this.selected.includes(id)) this.selected = this.selected.filter(s => s !== id);
    else this.selected.push(id);
  },

  toggleAll() {
    const ids = this.filtered.map(c => c.id);
    const allSelected = ids.every(id => this.selected.includes(id));
    if (allSelected) this.selected = this.selected.filter(id => !ids.includes(id));
    else this.selected = [...new Set([...this.selected, ...ids])];
  },

  allFilteredSelected() {
    return this.filtered.length > 0 && this.filtered.every(c => this.selected.includes(c.id));
  },

  async bulkAction(action) {
    if (this.selected.length === 0) { toast('warning', 'Selecione ao menos uma campanha'); return; }
    this.loading = true;
    await new Promise(r => setTimeout(r, 1000));
    this.campaigns = this.campaigns.map(c =>
      this.selected.includes(c.id) ? {...c, status: action === 'pause' ? 'paused' : 'active'} : c
    );
    const count = this.selected.length;
    this.selected = [];
    this.loading = false;
    toast('success', count + ' campanha(s) ' + (action === 'pause' ? 'pausada(s)' : 'ativada(s)') + ' com sucesso!');
  },
}));

// ══════════════════════════════════════════════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('ReportsPage', () => ({
  reportType: 'account',
  period: '7',
  customFrom: '', customTo: '',
  showCustom: false,
  metrics: { invest:true, conversions:true, cpa:true, roas:true, ctr:true, impressions:false, clicks:false },
  email: '',
  generating: false,
  showPreview: false,
  chart: null,

  init() {},

  get selectedMetrics() { return Object.entries(this.metrics).filter(([,v]) => v).map(([k]) => k); },

  async generatePreview() {
    this.generating = true;
    await new Promise(r => setTimeout(r, 1200));
    this.generating = false;
    this.showPreview = true;
    this.$nextTick(() => this.buildPreviewChart());
    toast('success', 'Relatório gerado com sucesso!');
  },

  buildPreviewChart() {
    if (this.chart) { try { this.chart.destroy(); } catch {} }
    const el = document.getElementById('ch-report');
    if (!el) return;
    const ts = MOCK.timeSeries(parseInt(this.period) || 7);
    this.chart = new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        labels: ts.labels,
        datasets: [
          { label:'Investimento', data:ts.invest, borderColor:'#3b82f6', fill:false, tension:0.4, pointRadius:4 },
          { label:'Conversões x50', data:ts.conv.map(v=>v*50), borderColor:'#22c55e', fill:false, tension:0.4, pointRadius:4 },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{labels:{color:'#94a3b8',font:{size:11}}}, tooltip:{backgroundColor:'rgba(15,23,42,0.95)',borderColor:'rgba(51,65,85,0.8)',borderWidth:1,padding:10} },
        scales:{ x:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}}, y:{grid:{color:'rgba(51,65,85,0.3)'},ticks:{color:'#64748b'}} }
      }
    });
  },

  exportPDF() { toast('info', 'Exportando PDF... (feature em desenvolvimento)'); },
  exportExcel() { toast('info', 'Exportando Excel... (feature em desenvolvimento)'); },

  async sendEmail() {
    if (!this.email) { toast('warning', 'Insira um email'); return; }
    await new Promise(r => setTimeout(r, 800));
    toast('success', 'Relatório enviado para ' + this.email + '!');
    this.email = '';
  },
}));

// ══════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('SettingsPage', () => ({
  tab: 'general',
  tabs: [
    { id:'general',       label:'Geral',         icon:'fas fa-sliders' },
    { id:'notifications', label:'Notificações',   icon:'fas fa-bell' },
    { id:'integrations',  label:'Integrações',    icon:'fas fa-plug' },
    { id:'backup',        label:'Backup',         icon:'fas fa-database' },
    { id:'about',         label:'Sobre',          icon:'fas fa-circle-info' },
  ],
  settings: {
    currency: 'USD',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    refreshInterval: '5',
    darkMode: true,
    compactMode: false,
    notifEmail: true,
    notifSlack: false,
    notifWhatsapp: false,
    notifCritical: true,
    notifWarning: true,
    notifInfo: false,
    emailAddr: '',
    slackWebhook: '',
    whatsappNumber: '',
  },
  saving: false,

  init() {},

  async save() {
    this.saving = true;
    await new Promise(r => setTimeout(r, 800));
    this.saving = false;
    toast('success', 'Configurações salvas!');
    try { localStorage.setItem('meta_ads_settings', JSON.stringify(this.settings)); } catch {}
  },

  async testIntegration(name) {
    await new Promise(r => setTimeout(r, 900));
    toast('success', name + ' testado com sucesso!');
  },

  async backup() {
    const data = { bms: MOCK.bms, accounts: MOCK.accounts, rules: MOCK.rules, settings: this.settings, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'meta_ads_backup_'+Date.now()+'.json'; a.click();
    URL.revokeObjectURL(url);
    toast('success', 'Backup exportado com sucesso!');
  },
}));

// Close the alpine:init
}); // end alpine:init
