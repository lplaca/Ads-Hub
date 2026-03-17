/* ═══════════════════════════════════════════════════════════════════════════
   Meta Ads Control Center — Alpine.js App
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CHART.JS GLOBAL DEFAULTS ─────────────────────────────────────────────────
Chart.defaults.color = '#64748b';
Chart.defaults.borderColor = 'rgba(51,65,85,0.4)';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size = 12;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = {
  currency: v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  number:   v => Number(v || 0).toLocaleString('pt-BR'),
  roas:     v => Number(v || 0).toFixed(2) + 'x',
  pct:      v => (v > 0 ? '+' : '') + Number(v || 0).toFixed(1) + '%',
  cpa:      v => '$' + Number(v || 0).toFixed(2),
};

const CHART_COLORS = {
  blue:   '#3b82f6', green: '#22c55e', amber: '#f59e0b',
  red:    '#ef4444', purple:'#a855f7', cyan:  '#06b6d4',
  slate:  '#64748b', indigo:'#6366f1',
};

function makeGradient(ctx, color, alpha = 0.25) {
  try {
    const g = ctx.createLinearGradient(0, 0, 0, 280);
    g.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
    g.addColorStop(1, color.replace(')', ',0)').replace('rgb', 'rgba'));
    return g;
  } catch { return color; }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK = {
  bms: [
    { id:'bm_001', name:'BM Principal', bm_id:'123456789', status:'connected', accounts_count:4 },
    { id:'bm_002', name:'BM Secundário', bm_id:'987654321', status:'connected', accounts_count:2 },
    { id:'bm_003', name:'BM Internacional', bm_id:'456789123', status:'error', accounts_count:1 },
  ],
  accounts: [
    { id:'acc_001', name:'BR - PROD001', account_id:'act_123456', bm_id:'bm_001', country:'BR', flag:'🇧🇷', status:'active', spend:1250.50, conversions:45, roas:3.2, cpa:27.79 },
    { id:'acc_002', name:'US - PROD002', account_id:'act_789012', bm_id:'bm_001', country:'US', flag:'🇺🇸', status:'active', spend:890.00, conversions:23, roas:2.8, cpa:38.70 },
    { id:'acc_003', name:'MX - PROD003', account_id:'act_345678', bm_id:'bm_001', country:'MX', flag:'🇲🇽', status:'active', spend:620.00, conversions:18, roas:4.1, cpa:34.44 },
    { id:'acc_004', name:'AR - OLD', account_id:'act_555555', bm_id:'bm_002', country:'AR', flag:'🇦🇷', status:'error', spend:0, conversions:0, roas:0, cpa:0 },
    { id:'acc_005', name:'CO - PROD001', account_id:'act_111222', bm_id:'bm_002', country:'CO', flag:'🇨🇴', status:'active', spend:430.00, conversions:12, roas:2.5, cpa:35.83 },
    { id:'acc_006', name:'CL - PROD002', account_id:'act_333444', bm_id:'bm_003', country:'CL', flag:'🇨🇱', status:'active', spend:780.00, conversions:31, roas:3.8, cpa:25.16 },
    { id:'acc_007', name:'PE - PROD003', account_id:'act_666777', bm_id:'bm_001', country:'PE', flag:'🇵🇪', status:'active', spend:320.00, conversions:9, roas:2.9, cpa:35.56 },
  ],
  campaigns: [
    { id:'c01', name:'BR_PROD001_Conversao_01', account:'BR - PROD001', country:'BR', status:'active',  spend:156.50, conversions:12, roas:3.5, cpa:13.04, ctr:2.1 },
    { id:'c02', name:'BR_PROD001_Conversao_02', account:'BR - PROD001', country:'BR', status:'active',  spend:89.20,  conversions:0,  roas:0,   cpa:0,     ctr:0.8 },
    { id:'c03', name:'US_PROD002_Vendas_Test',  account:'US - PROD002', country:'US', status:'active',  spend:234.90, conversions:8,  roas:2.8, cpa:29.36, ctr:1.9 },
    { id:'c04', name:'MX_PROD003_Trafego',      account:'MX - PROD003', country:'MX', status:'paused', spend:45.00,  conversions:3,  roas:2.1, cpa:15.00, ctr:1.2 },
    { id:'c05', name:'BR_PROD001_Conv_05',      account:'BR - PROD001', country:'BR', status:'active',  spend:5.00,   conversions:0,  roas:0,   cpa:0,     ctr:0.4 },
    { id:'c06', name:'CO_PROD001_Retargeting',  account:'CO - PROD001', country:'CO', status:'active',  spend:123.00, conversions:5,  roas:3.1, cpa:24.60, ctr:2.4 },
    { id:'c07', name:'CL_PROD002_Awareness',    account:'CL - PROD002', country:'CL', status:'active',  spend:256.00, conversions:11, roas:3.7, cpa:23.27, ctr:3.1 },
    { id:'c08', name:'US_PROD002_Retargeting',  account:'US - PROD002', country:'US', status:'paused', spend:0,      conversions:0,  roas:0,   cpa:0,     ctr:0   },
    { id:'c09', name:'BR_PROD001_Lookalike',    account:'BR - PROD001', country:'BR', status:'active',  spend:2.50,   conversions:0,  roas:0,   cpa:0,     ctr:0.2 },
    { id:'c10', name:'MX_PROD003_Conv_01',      account:'MX - PROD003', country:'MX', status:'active',  spend:178.00, conversions:7,  roas:4.2, cpa:25.43, ctr:2.8 },
    { id:'c11', name:'CL_PROD002_Conv_01',      account:'CL - PROD002', country:'CL', status:'active',  spend:312.00, conversions:14, roas:4.0, cpa:22.29, ctr:3.5 },
    { id:'c12', name:'PE_PROD003_Vendas',       account:'PE - PROD003', country:'PE', status:'active',  spend:98.00,  conversions:3,  roas:2.9, cpa:32.67, ctr:1.7 },
  ],
  alerts: [
    { id:'al1', campaign:'BR_PROD001_Conversao_02', msg:'Gastou 100% do budget sem conversões',       severity:'critical', spend:89.20, conv:0 },
    { id:'al2', campaign:'BR_PROD001_Conv_05',       msg:'Gastou $5 sem nenhuma venda — regra acionada', severity:'critical', spend:5.00,  conv:0 },
    { id:'al3', campaign:'BR_PROD001_Lookalike',     msg:'Gastou 50% do budget sem checkouts',         severity:'warning',  spend:2.50,  conv:0 },
    { id:'al4', campaign:'US_PROD002_Vendas_Test',   msg:'ROAS abaixo de 3.0 — verificar criativo',    severity:'warning',  spend:234.90,conv:8 },
    { id:'al5', campaign:'PE_PROD003_Vendas',        msg:'CPA acima de $30 — acima da meta',           severity:'info',     spend:98.00, conv:3 },
    { id:'al6', campaign:'MX_PROD003_Trafego',       msg:'Campanha pausada automaticamente por ROAS baixo', severity:'info', spend:45.00,conv:3 },
  ],
  rules: [
    { id:'r01', name:'$5 Gastos Sem Venda — Pausar',    conditions:[{metric:'spend',operator:'>=',value:5},{metric:'conversions',operator:'==',value:0}], action:'pause',  enabled:true,  trigger_count:12 },
    { id:'r02', name:'50% Budget Sem Checkout — Alertar', conditions:[{metric:'spend_pct',operator:'>=',value:50},{metric:'checkouts',operator:'==',value:0}], action:'notify', enabled:true,  trigger_count:5 },
    { id:'r03', name:'ROAS Baixo — Pausar',             conditions:[{metric:'roas',operator:'<',value:2.0}], action:'pause',  enabled:false, trigger_count:0 },
  ],
  products: [
    { code:'PROD001', invest:1580.20, conversions:57, roas:3.2, cpa:27.72, campaigns:5, trend:+12 },
    { code:'PROD002', invest:1124.90, conversions:42, roas:3.0, cpa:26.78, campaigns:4, trend:-3  },
    { code:'PROD003', invest:643.00,  conversions:19, roas:3.7, cpa:33.84, campaigns:3, trend:+8  },
  ],
  timeSeries(days=7) {
    const labels=[], invest=[], conv=[], roas=[];
    for(let i=days-1;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
      const inv = 1200 + Math.random()*1800;
      const c   = Math.floor(20 + Math.random()*60);
      invest.push(+inv.toFixed(2));
      conv.push(c);
      roas.push(+(c*35/inv).toFixed(2));
    }
    return { labels, invest, conv, roas };
  }
};

// ── API CLIENT ────────────────────────────────────────────────────────────────
const API = {
  async get(path)      { try { const r=await fetch(path); return r.ok?r.json():null; } catch { return null; } },
  async post(path,body){ try { const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return r.ok?r.json():null; } catch { return null; } },
  async put(path,body) { try { const r=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return r.ok?r.json():null; } catch { return null; } },
  async del(path)      { try { const r=await fetch(path,{method:'DELETE'}); return r.ok?r.json():null; } catch { return null; } },
};

// ══════════════════════════════════════════════════════════════════════════════
//  ALPINE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('alpine:init', () => {

// ── GLOBAL STORE ─────────────────────────────────────────────────────────────
Alpine.store('meta', {
  demoMode: true,
  bmCount: 0,
  accountCount: 0,
  async refresh() {
    const s = await API.get('/api/status');
    if (s) { this.demoMode = s.demo_mode; this.bmCount = s.bm_count; this.accountCount = s.account_count; }
  },
});

// ── NAV CONFIG ────────────────────────────────────────────────────────────────
const NAV = [
  // ── Visão Geral ──
  { id:'dashboard',    label:'Dashboard',         icon:'fas fa-chart-pie',             subtitle:'Visão geral de todas as campanhas', group:'main' },
  { id:'campaigns',    label:'Campanhas',         icon:'fas fa-layer-group',           subtitle:'Lista detalhada de campanhas com saúde IA', group:'main' },

  // ── Gestor IA ──
  { id:'agent',        label:'Gestor IA',         icon:'fas fa-robot',                 subtitle:'Painel central do agente de IA 24/7', group:'ai', badge:'IA' },
  { id:'knowledge',    label:'Conhecimento',      icon:'fas fa-brain',                 subtitle:'Ensine o gestor sobre seu negócio', group:'ai' },
  { id:'chat',         label:'Conversar',         icon:'fas fa-comments',              subtitle:'Chat em tempo real com o gestor IA', group:'ai' },
  { id:'ideas',        label:'Ideias & Estratégias', icon:'fas fa-lightbulb',         subtitle:'Sugestões geradas pelo gestor IA', group:'ai' },
  { id:'analysis',     label:'Análise Profunda',  icon:'fas fa-magnifying-glass-chart', subtitle:'Gráficos e métricas avançadas', group:'ai' },

  // ── Gestão ──
  { id:'importar',     label:'Importar Produtos', icon:'fas fa-file-import',           subtitle:'Sync Google Sheets + lançar campanhas com 1 clique', group:'management', badge:'NOVO' },
  { id:'bm',           label:'Business Managers', icon:'fas fa-building',              subtitle:'Gerencie seus BMs conectados', group:'management' },
  { id:'accounts',     label:'Contas de Anúncio', icon:'fas fa-credit-card',           subtitle:'Todas as contas de anúncio', group:'management' },
  { id:'products',     label:'Produtos',          icon:'fas fa-box',                   subtitle:'Análise de performance por produto', group:'management' },
  { id:'rules',        label:'Regras',            icon:'fas fa-shield-halved',         subtitle:'Automações e regras de otimização', group:'management' },
  { id:'alerts',       label:'Alertas',           icon:'fas fa-bell',                  subtitle:'Campanhas que precisam de atenção', group:'management' },
  { id:'reports',      label:'Relatórios',        icon:'fas fa-file-chart-column',     subtitle:'Gere e exporte relatórios', group:'management' },
  { id:'quickactions', label:'Ações Rápidas',     icon:'fas fa-bolt',                  subtitle:'Pause ou ative campanhas rapidamente', group:'management' },
  { id:'settings',     label:'Configurações',     icon:'fas fa-gear',                  subtitle:'Preferências e integrações', group:'management' },
  { id:'manual',       label:'Manual',            icon:'fas fa-book-open',             subtitle:'Guia completo passo a passo da plataforma', group:'management' },
];

// ── MAIN APP ──────────────────────────────────────────────────────────────────
Alpine.data('App', () => ({
  currentPage: 'dashboard',
  navItems: NAV,
  sidebarOpen: false,
  sidebarCollapsed: false,
  isMobile: window.innerWidth < 1024,
  loading: false,
  notifOpen: false,
  toasts: [],
  toastQueue: [],
  notifLog: [],
  alertCount: 0,

  get pageTitle()    { return NAV.find(n=>n.id===this.currentPage)?.label    || ''; },
  get pageSubtitle() { return NAV.find(n=>n.id===this.currentPage)?.subtitle || ''; },

  async init() {
    window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 1024; });
    window.addEventListener('show-toast', e => this.addToast(e.detail));
    window.addEventListener('navigate', e => { if (e.detail?.page) this.navigate(e.detail.page); });
    // Fetch app status
    await this.$store.meta.refresh();
    // Fetch alert count
    const alerts = await API.get('/api/alerts');
    if (alerts) this.alertCount = alerts.filter(a => a.status === 'active').length;
  },

  navigate(page) {
    this.currentPage = page;
    this.sidebarOpen = false;
    window.scrollTo(0,0);
  },

  async refreshData() {
    this.loading = true;
    await this.$store.meta.refresh();
    const alerts = await API.get('/api/alerts');
    if (alerts) this.alertCount = alerts.filter(a => a.status === 'active').length;
    window.dispatchEvent(new CustomEvent('page-refresh'));
    this.loading = false;
    this.addToast({ type:'success', message:'Dados atualizados!' });
  },

  addToast({ type='info', message='' }) {
    const id = Date.now() + Math.random();
    const cfg = {
      success: { icon:'fas fa-check-circle', iconColor:'#22c55e', iconBg:'background:rgba(34,197,94,0.2)', style:'background:rgba(15,23,42,0.97);border:1px solid rgba(34,197,94,0.4);box-shadow:0 20px 60px rgba(0,0,0,0.6);' },
      error:   { icon:'fas fa-times-circle',  iconColor:'#ef4444', iconBg:'background:rgba(239,68,68,0.2)', style:'background:rgba(15,23,42,0.97);border:1px solid rgba(239,68,68,0.4);box-shadow:0 20px 60px rgba(0,0,0,0.6);' },
      warning: { icon:'fas fa-triangle-exclamation', iconColor:'#f59e0b', iconBg:'background:rgba(245,158,11,0.2)', style:'background:rgba(15,23,42,0.97);border:1px solid rgba(245,158,11,0.4);box-shadow:0 20px 60px rgba(0,0,0,0.6);' },
      info:    { icon:'fas fa-circle-info', iconColor:'#3b82f6', iconBg:'background:rgba(59,130,246,0.2)', style:'background:rgba(15,23,42,0.97);border:1px solid rgba(59,130,246,0.4);box-shadow:0 20px 60px rgba(0,0,0,0.6);' },
    };
    const c = cfg[type] || cfg.info;
    const toast = { id, message, visible: true, ...c };
    this.toasts.push(toast);
    this.toastQueue.push(id);

    // Auto-add to notif log
    this.notifLog.push({ id, message, icon:c.icon, color:c.iconColor, bg:c.iconBg.replace('background:',''), time:'Agora mesmo' });

    setTimeout(() => {
      const t = this.toasts.find(t=>t.id===id);
      if(t) t.visible = false;
      setTimeout(() => { this.toasts = this.toasts.filter(t=>t.id!==id); this.toastQueue = this.toastQueue.filter(q=>q!==id); }, 400);
    }, 4000);
  },

  removeToast(id) {
    const t = this.toasts.find(t=>t.id===id);
    if(t) t.visible = false;
    setTimeout(() => { this.toasts = this.toasts.filter(t=>t.id!==id); this.toastQueue = this.toastQueue.filter(q=>q!==id); }, 300);
  },
}));

// ── TOAST HELPER ──────────────────────────────────────────────────────────────
function toast(type, message) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { type, message } }));
}

// ══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('Dashboard', () => ({
  period: '7',
  viewBy: 'account',
  customFrom: '', customTo: '',
  showCustom: false,
  loading: false,
  ts: null,
  charts: {},
  tableSearch: '', tablePage: 0, tablePerPage: 10, tableSort: 'spend', tableSortDir: 'desc',
  apiData: null,

  async init() {
    await this.fetchDashboard();
    this.$watch('period', async v => { if(v!=='custom') { await this.fetchDashboard(); } });
    this.$watch('viewBy', () => this.$nextTick(()=>this.buildCharts()));
  },

  async fetchDashboard() {
    this.loading = true;
    const data = await API.get(`/api/dashboard?period=${parseInt(this.period)||7}&view_by=${this.viewBy}`);
    if (data) {
      this.apiData = data;
      this.ts = data.time_series || MOCK.timeSeries(parseInt(this.period)||7);
    } else {
      this.ts = MOCK.timeSeries(parseInt(this.period)||7);
    }
    this.loading = false;
    this.$nextTick(() => this.buildCharts());
  },

  get accounts() {
    if (this.apiData && this.apiData.by_account) return this.apiData.by_account;
    return MOCK.accounts;
  },

  get tableData() {
    let d = [...this.accounts];
    if(this.tableSearch) d = d.filter(r=>(r.name||'').toLowerCase().includes(this.tableSearch.toLowerCase())||(r.country||'').toLowerCase().includes(this.tableSearch.toLowerCase()));
    d.sort((a,b)=>{ const v=this.tableSortDir==='asc'?1:-1; return a[this.tableSort]>b[this.tableSort]?v:-v; });
    return d;
  },
  get tablePaged() { return this.tableData.slice(this.tablePage*this.tablePerPage,(this.tablePage+1)*this.tablePerPage); },
  get tablePages() { return Math.ceil(this.tableData.length/this.tablePerPage); },
  sortBy(col) { if(this.tableSort===col) this.tableSortDir=this.tableSortDir==='asc'?'desc':'asc'; else { this.tableSort=col; this.tableSortDir='desc'; } },

  buildCharts() {
    Object.values(this.charts).forEach(c => { try{c.destroy();}catch{} });
    this.charts = {};
    this.buildInvestChart();
    this.buildConvChart();
    this.buildPerfChart();
    this.buildDistChart();
  },

  buildInvestChart() {
    const el = document.getElementById('ch-invest');
    if(!el) return;
    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,220);
    grad.addColorStop(0, 'rgba(59,130,246,0.3)');
    grad.addColorStop(1, 'rgba(59,130,246,0)');
    this.charts.invest = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.ts.labels,
        datasets: [{ label:'Investimento', data:this.ts.invest, borderColor:'#3b82f6', backgroundColor:grad, fill:true, tension:0.4, pointBackgroundColor:'#3b82f6', pointBorderColor:'#1e293b', pointBorderWidth:2, pointRadius:4, pointHoverRadius:6 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(15,23,42,0.95)', borderColor:'rgba(51,65,85,0.8)', borderWidth:1, padding:10, callbacks:{ label:ctx=>' '+fmt.currency(ctx.raw) } } }, scales:{ x:{ grid:{color:'rgba(51,65,85,0.3)'}, ticks:{color:'#64748b',font:{size:11}} }, y:{ grid:{color:'rgba(51,65,85,0.3)'}, ticks:{color:'#64748b',font:{size:11},callback:v=>'$'+v.toLocaleString()} } } }
    });
  },

  buildConvChart() {
    const el = document.getElementById('ch-conv');
    if(!el) return;
    this.charts.conv = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: this.ts.labels,
        datasets: [{ label:'Conversões', data:this.ts.conv, backgroundColor: this.ts.conv.map(()=>hexToRgba('#22c55e',0.7)), borderColor:'#22c55e', borderWidth:1, borderRadius:6, borderSkipped:false }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(15,23,42,0.95)', borderColor:'rgba(51,65,85,0.8)', borderWidth:1, padding:10 } }, scales:{ x:{ grid:{display:false}, ticks:{color:'#64748b',font:{size:11}} }, y:{ grid:{color:'rgba(51,65,85,0.3)'}, ticks:{color:'#64748b',font:{size:11}} } } }
    });
  },

  buildPerfChart() {
    const el = document.getElementById('ch-perf');
    if(!el) return;
    let labels, invest, conv;
    const accs = this.accounts;
    const byCountry = this.apiData?.by_country || [];
    if(this.viewBy==='account')  { labels=accs.map(a=>(a.name||'').split(' - ').pop()||a.name); invest=accs.map(a=>a.spend||a.invest||0); conv=accs.map(a=>a.conversions||0); }
    else if(this.viewBy==='product') { const prods = this.apiData?.by_product || MOCK.products; labels=prods.map(p=>p.name||p.code); invest=prods.map(p=>p.invest||p.spend||0); conv=prods.map(p=>p.conversions||0); }
    else { labels=byCountry.map(c=>c.name); invest=byCountry.map(c=>c.invest||0); conv=byCountry.map(c=>c.conversions||0); }
    this.charts.perf = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Investimento', data:invest, backgroundColor:hexToRgba('#3b82f6',0.7), borderColor:'#3b82f6', borderWidth:1, borderRadius:4 },
          { label:'Conversões (x10)', data:conv.map(v=>v*10), backgroundColor:hexToRgba('#22c55e',0.7), borderColor:'#22c55e', borderWidth:1, borderRadius:4 },
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{color:'#94a3b8',font:{size:11}} }, tooltip:{ backgroundColor:'rgba(15,23,42,0.95)', borderColor:'rgba(51,65,85,0.8)', borderWidth:1, padding:10 } }, scales:{ x:{ grid:{display:false}, ticks:{color:'#64748b',font:{size:10},maxRotation:30} }, y:{ grid:{color:'rgba(51,65,85,0.3)'}, ticks:{color:'#64748b',font:{size:11}} } } }
    });
  },

  buildDistChart() {
    const el = document.getElementById('ch-dist');
    if(!el) return;
    const byCountry = this.apiData?.by_country || [{name:'Brasil',invest:1500},{name:'USA',invest:890},{name:'Chile',invest:780},{name:'Colômbia',invest:430},{name:'México',invest:620},{name:'Peru',invest:320}];
    const colors = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#06b6d4','#ef4444','#64748b','#6366f1'];
    this.charts.dist = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: byCountry.map(c=>c.name),
        datasets: [{ data:byCountry.map(c=>c.invest||0), backgroundColor:byCountry.map((_,i)=>colors[i%colors.length]), borderColor:'rgba(15,23,42,0.6)', borderWidth:3, hoverOffset:8 }]
      },
      options: { responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{ position:'bottom', labels:{ color:'#94a3b8', font:{size:11}, padding:12, usePointStyle:true } }, tooltip:{ backgroundColor:'rgba(15,23,42,0.95)', borderColor:'rgba(51,65,85,0.8)', borderWidth:1, padding:10, callbacks:{ label:ctx=>' '+fmt.currency(ctx.raw) } } } }
    });
  },

  renderPage() {
    const s = this.apiData?.stats || { total_investment:4290, total_conversions:63, avg_roas:3.28, active_alerts:6, investment_change:15.2, conversions_change:8.4, roas_change:-5.1 };
    const stats = [
      { label:'Investimento Total', value:fmt.currency(s.total_investment), change:(s.investment_change>=0?'+':'')+s.investment_change+'%', up:s.investment_change>=0, icon:'fas fa-dollar-sign', color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
      { label:'Conversões',         value:fmt.number(s.total_conversions), change:(s.conversions_change>=0?'+':'')+s.conversions_change+'%', up:s.conversions_change>=0, icon:'fas fa-bullseye',    color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
      { label:'ROAS Médio',         value:s.avg_roas+'x',                  change:(s.roas_change>=0?'+':'')+s.roas_change+'%', up:s.roas_change>=0,icon:'fas fa-chart-line',  color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
      { label:'Alertas Ativos',     value:fmt.number(s.active_alerts||0),  change:'',     up:false,icon:'fas fa-triangle-exclamation', color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
    ];

    return `
    <div class="fade-in space-y-6">

      <!-- Demo Banner (only in demo mode) -->
      <div class="demo-banner" x-show="$store.meta.demoMode">
        <i class="fas fa-flask text-amber-400 text-lg"></i>
        <div class="flex-1">
          <p class="text-amber-300 font-semibold text-sm">Modo Demonstração</p>
          <p class="text-amber-400/70 text-xs mt-0.5">Dados fictícios. Conecte suas contas reais em <strong>Business Managers</strong> para ver dados reais.</p>
        </div>
        <button @click="$dispatch('navigate',{page:'bm'})" class="btn btn-sm whitespace-nowrap" style="background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.4);color:#fbbf24;">
          <i class="fas fa-plus text-xs"></i> Conectar Conta
        </button>
      </div>

      <!-- Filters -->
      <div class="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 flex-1 min-w-[200px]">
          <label class="text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Visualizar por</label>
          <select @change="viewBy=$event.target.value" class="form-select flex-1">
            <option value="account">Por Conta</option>
            <option value="product">Por Produto</option>
            <option value="country">Por País</option>
          </select>
        </div>
        <div class="flex items-center gap-2 flex-1 min-w-[200px]">
          <label class="text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Período</label>
          <select @change="period=$event.target.value; showCustom=$event.target.value==='custom'" class="form-select flex-1">
            <option value="7">Últimos 7 dias</option>
            <option value="14">Últimos 14 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div x-show="showCustom" class="flex items-center gap-2 flex-wrap">
          <input type="date" x-model="customFrom" class="form-input" style="width:140px;" />
          <span class="text-slate-500 text-xs">até</span>
          <input type="date" x-model="customTo" class="form-input" style="width:140px;" />
        </div>
        <button @click="$dispatch('show-toast',{type:'success',message:'Dados atualizados!'})" class="btn btn-primary btn-sm whitespace-nowrap">
          <i class="fas fa-rotate-right"></i> Atualizar
        </button>
      </div>

      <!-- Metric Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in-children">
        ${stats.map(s=>`
        <div class="metric-card">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${s.bg}">
              <i class="${s.icon} text-lg" style="color:${s.color}"></i>
            </div>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${s.up?'text-green-400':'text-red-400'}" style="background:${s.up?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}">
              <i class="fas fa-arrow-${s.up?'up':'down'} text-xs mr-0.5"></i>${s.change}
            </span>
          </div>
          <p class="text-2xl font-bold text-white mb-0.5">${s.value}</p>
          <p class="text-slate-400 text-xs">${s.label}</p>
        </div>`).join('')}
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="glass rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-area text-blue-400"></i> Investimento Diário
          </h3>
          <div class="chart-container" style="height:200px;">
            <canvas id="ch-invest"></canvas>
          </div>
        </div>
        <div class="glass rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-bar text-green-400"></i> Conversões Diárias
          </h3>
          <div class="chart-container" style="height:200px;">
            <canvas id="ch-conv"></canvas>
          </div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="glass rounded-2xl p-5 lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <i class="fas fa-bars-staggered text-purple-400"></i> Performance por
              <select @change="viewBy=$event.target.value; $nextTick(()=>buildCharts())" class="form-select text-xs py-1" style="width:auto;padding:4px 8px;">
                <option value="account">Conta</option>
                <option value="product">Produto</option>
                <option value="country">País</option>
              </select>
            </h3>
          </div>
          <div class="chart-container" style="height:220px;">
            <canvas id="ch-perf"></canvas>
          </div>
        </div>
        <div class="glass rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-pie text-amber-400"></i> Distribuição por País
          </h3>
          <div class="chart-container" style="height:220px;">
            <canvas id="ch-dist"></canvas>
          </div>
        </div>
      </div>

      <!-- Summary Table -->
      <div class="glass rounded-2xl overflow-hidden">
        <div class="p-4 flex flex-wrap items-center justify-between gap-3" style="border-bottom:1px solid rgba(51,65,85,0.4);">
          <h3 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <i class="fas fa-table-list text-slate-400"></i> Resumo por Conta
          </h3>
          <div class="flex items-center gap-2">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
              <input type="text" x-model="tableSearch" placeholder="Buscar..." class="form-input pl-8" style="width:180px;" />
            </div>
            <select @change="tablePerPage=parseInt($event.target.value);tablePage=0" class="form-select" style="width:auto;">
              <option value="5">5</option>
              <option value="10" selected>10</option>
              <option value="25">25</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                ${['name','country','spend','conversions','cpa','roas'].map(col=>
                  `<th @click="sortBy('${col}')" class="cursor-pointer select-none hover:text-slate-300">
                    ${col==='name'?'Conta':col==='country'?'País':col==='spend'?'Investimento':col==='conversions'?'Conversões':col.toUpperCase()}
                    <i class="fas fa-sort ml-1 text-slate-600 text-xs"></i>
                  </th>`
                ).join('')}
                <th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              <template x-if="tablePaged.length === 0">
                <tr><td colspan="8" class="text-center text-slate-500 py-8">Nenhum resultado encontrado</td></tr>
              </template>
              <template x-for="row in tablePaged" :key="row.id">
                <tr>
                  <td class="font-medium text-white" x-text="row.name"></td>
                  <td><span class="font-medium" x-text="(row.flag||'🌍')+' '+row.country"></span></td>
                  <td class="font-mono text-blue-400" x-text="'$'+Number(row.spend).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})"></td>
                  <td x-text="row.conversions"></td>
                  <td x-text="row.cpa?'$'+Number(row.cpa).toFixed(2):'—'"></td>
                  <td :class="row.roas>=3?'text-green-400':row.roas>=2?'text-amber-400':'text-red-400'" x-text="row.roas?Number(row.roas).toFixed(2)+'x':'—'"></td>
                  <td>
                    <span :class="row.status==='active'?'badge-green':'badge-red'" class="badge">
                      <i :class="row.status==='active'?'fas fa-circle':'fas fa-times-circle'" class="text-xs"></i>
                      <span x-text="row.status==='active'?'Ativa':'Erro'"></span>
                    </span>
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button @click="toast('info','Abrindo detalhes de '+row.name)" class="btn btn-ghost btn-xs"><i class="fas fa-eye text-xs"></i></button>
                      <button @click="toast('warning','Pausando campanhas de '+row.name)" class="btn btn-ghost btn-xs"><i class="fas fa-pause text-xs"></i></button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="p-3 flex items-center justify-between" style="border-top:1px solid rgba(51,65,85,0.3);">
          <p class="text-xs text-slate-500" x-text="'Mostrando '+(tablePage*tablePerPage+1)+'-'+Math.min((tablePage+1)*tablePerPage,tableData.length)+' de '+tableData.length"></p>
          <div class="flex items-center gap-1">
            <button @click="tablePage=Math.max(0,tablePage-1)" :disabled="tablePage===0" class="btn btn-ghost btn-xs" :class="tablePage===0?'opacity-40 cursor-not-allowed':''"><i class="fas fa-chevron-left text-xs"></i></button>
            <template x-for="p in Array.from({length:tablePages},(v,i)=>i)" :key="p">
              <button @click="tablePage=p" :class="tablePage===p?'bg-blue-600 text-white':'text-slate-400 hover:text-white'" class="btn btn-ghost btn-xs min-w-[28px]" x-text="p+1"></button>
            </template>
            <button @click="tablePage=Math.min(tablePages-1,tablePage+1)" :disabled="tablePage===tablePages-1" class="btn btn-ghost btn-xs" :class="tablePage===tablePages-1?'opacity-40 cursor-not-allowed':''"><i class="fas fa-chevron-right text-xs"></i></button>
          </div>
        </div>
      </div>
    </div>`;
  }
}));

}); // end alpine:init — Dashboard + App loaded
// Pages: pages-bm-accounts.js, pages-rules-alerts.js, pages-reports-settings.js
