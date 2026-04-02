/* ═══════════════════════════════════════════════════════════════════════════
   Ads Hub — Alpine.js App
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
  demoMode: false,
  bmCount: 0,
  accountCount: 0,
  async refresh() {
    const s = await API.get('/api/status');
    if (s) { this.demoMode = false; this.bmCount = s.bm_count; this.accountCount = s.account_count; }
  },
});

// ── NAV GROUPS ────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  { id: 'meta',         label: 'Meta Ads',      color: '#1877f2', bgColor: 'rgba(24,119,242,0.08)',  icon: 'fab fa-meta' },
  { id: 'google',       label: 'Google Ads',    color: '#4285f4', bgColor: 'rgba(66,133,244,0.08)',  icon: 'fab fa-google' },
  { id: 'products',     label: 'Produtos',      color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)',  icon: 'fas fa-box' },
  { id: 'intel',        label: 'Inteligência',  color: '#a855f7', bgColor: 'rgba(168,85,247,0.08)',  icon: 'fas fa-brain' },
  { id: 'ops',          label: 'Otimizações',   color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)',   icon: 'fas fa-chart-line' },
  { id: 'integrations', label: 'Integrações',   color: '#64748b', bgColor: 'rgba(100,116,139,0.08)', icon: 'fas fa-plug' },
  { id: 'config',       label: 'Configurações', color: '#94a3b8', bgColor: 'rgba(148,163,184,0.08)', icon: 'fas fa-gear' },
];

// ── NAV CONFIG ────────────────────────────────────────────────────────────────
const NAV = [
  // ── Meta Ads ──────────────────────────────────────────────────────────────
  { id: 'dashboard',         label: 'Visão Geral',        icon: 'fas fa-chart-pie',            subtitle: 'Overview das métricas Meta Ads',          group: 'meta' },
  { id: 'bm',                label: 'Business Managers',  icon: 'fas fa-building',             subtitle: 'Gerenciar Business Managers',              group: 'meta' },
  { id: 'accounts',          label: 'Contas de Anúncios', icon: 'fas fa-wallet',               subtitle: 'Todas as contas de anúncios vinculadas',   group: 'meta' },
  { id: 'campaigns',         label: 'Campanhas',          icon: 'fas fa-layer-group',          subtitle: 'Campanhas ativas e pausadas',               group: 'meta' },
  { id: 'adsets',            label: 'Conjuntos',          icon: 'fas fa-object-group',         subtitle: 'Ad sets / conjuntos de anúncios',          group: 'meta' },
  { id: 'meta-ads',          label: 'Anúncios',           icon: 'fas fa-rectangle-ad',         subtitle: 'Criativos e anúncios individuais',          group: 'meta' },
  { id: 'reports',           label: 'Análises',           icon: 'fas fa-chart-line',           subtitle: 'Relatórios e análises de desempenho',      group: 'meta' },
  { id: 'meta-countries',    label: 'Países',             icon: 'fas fa-globe',                subtitle: 'Segmentação e performance por país',       group: 'meta' },
  { id: 'rules',             label: 'Regras',             icon: 'fas fa-shield-halved',        subtitle: 'Automações e regras de otimização',        group: 'meta' },
  { id: 'quickactions',      label: 'Ações em Massa',     icon: 'fas fa-bolt',                 subtitle: 'Editar múltiplas campanhas de uma vez',    group: 'meta' },
  { id: 'criar-campanha',    label: 'Criar Campanha',     icon: 'fas fa-plus-circle',          subtitle: 'Lançar novas campanhas Meta Ads',          group: 'meta', badge: 'Novo' },

  // ── Google Ads ────────────────────────────────────────────────────────────
  { id: 'google-overview',   label: 'Visão Geral',        icon: 'fas fa-chart-pie',            subtitle: 'Overview das métricas Google Ads',         group: 'google' },
  { id: 'google-accounts',   label: 'Contas',             icon: 'fas fa-wallet',               subtitle: 'Contas do Google Ads',                     group: 'google' },
  { id: 'google-campaigns',  label: 'Campanhas',          icon: 'fas fa-layer-group',          subtitle: 'Campanhas Google Ads',                     group: 'google' },
  { id: 'google-adgroups',   label: 'Grupos de Anúncios', icon: 'fas fa-object-group',         subtitle: 'Ad groups do Google Ads',                  group: 'google' },
  { id: 'google-ads',        label: 'Anúncios',           icon: 'fas fa-rectangle-ad',         subtitle: 'Criativos Google Ads',                     group: 'google' },
  { id: 'google-keywords',   label: 'Palavras-chave',     icon: 'fas fa-key',                  subtitle: 'Gestão de keywords',                       group: 'google' },
  { id: 'google-analytics',  label: 'Análises',           icon: 'fas fa-chart-line',           subtitle: 'Relatórios Google Ads',                    group: 'google' },
  { id: 'google-criar',      label: 'Criar Campanha',     icon: 'fas fa-plus-circle',          subtitle: 'Lançar novas campanhas Google Ads',        group: 'google', badge: 'Novo' },

  // ── Produtos ──────────────────────────────────────────────────────────────
  { id: 'products',          label: 'Todos os Produtos',  icon: 'fas fa-box',                  subtitle: 'Catálogo completo de produtos',            group: 'products' },
  { id: 'importar',          label: 'Importar',           icon: 'fas fa-file-import',          subtitle: 'Importar via planilha ou Sheets',          group: 'products' },
  { id: 'product-perf',      label: 'Performance',        icon: 'fas fa-chart-bar',            subtitle: 'ROAS e métricas por produto',              group: 'products' },
  { id: 'product-countries', label: 'Por País',           icon: 'fas fa-flag',                 subtitle: 'Produtos segmentados por país',            group: 'products' },

  // ── Inteligência ──────────────────────────────────────────────────────────
  { id: 'agent',             label: 'Gestor IA',          icon: 'fas fa-robot',                subtitle: 'Agente autônomo de otimização',            group: 'intel', badge: 'IA' },
  { id: 'chat',              label: 'Chat IA',            icon: 'fas fa-comments',             subtitle: 'Conversa com o assistente IA',             group: 'intel' },
  { id: 'chat-launcher',     label: 'Lançar via Chat',    icon: 'fas fa-message',              subtitle: 'Criar campanha em linguagem natural',      group: 'intel' },
  { id: 'alerts',            label: 'Alertas',            icon: 'fas fa-triangle-exclamation', subtitle: 'Alertas que exigem atenção',               group: 'intel', badge: 'alertCount' },
  { id: 'ai-rules',          label: 'Regras do Gestor',   icon: 'fas fa-sliders',              subtitle: 'Regras automáticas para o Gestor IA',      group: 'intel' },
  { id: 'intelligence',      label: 'Previsões',          icon: 'fas fa-chart-mixed',          subtitle: 'Forecast e análise de risco',              group: 'intel' },
  { id: 'ideas',             label: 'Ideias',             icon: 'fas fa-lightbulb',            subtitle: 'Sugestões geradas pelo Gestor IA',         group: 'intel' },
  { id: 'knowledge',         label: 'Conhecimento',       icon: 'fas fa-book',                 subtitle: 'Base de conhecimento e arquivos',          group: 'intel' },

  // ── Otimizações ──────────────────────────────────────────────────────────
  { id: 'tasks',             label: 'Tarefas',            icon: 'fas fa-circle-check',         subtitle: 'Tarefas da operação + ClickUp',            group: 'ops' },
  { id: 'automation',        label: 'Automação',          icon: 'fas fa-shield-halved',        subtitle: 'Regras e jobs automáticos',                group: 'ops' },
  { id: 'sync',              label: 'Sincronização',      icon: 'fas fa-rotate',               subtitle: 'Sync com ClickUp e Notion',                group: 'ops' },

  // ── Integrações ───────────────────────────────────────────────────────────
  { id: 'integrations',      label: 'Visão Geral',        icon: 'fas fa-plug',                 subtitle: 'Status de todas as integrações',           group: 'integrations' },
  { id: 'connections',       label: 'Meta Ads API',       icon: 'fab fa-meta',                 subtitle: 'Tokens e contas Meta',                     group: 'integrations' },
  { id: 'google-connect',    label: 'Google Ads API',     icon: 'fab fa-google',               subtitle: 'Credenciais Google Ads',                   group: 'integrations' },
  { id: 'clickup-int',       label: 'ClickUp',            icon: 'fas fa-circle-check',         subtitle: 'Integração ClickUp',                       group: 'integrations' },
  { id: 'notion-int',        label: 'Notion',             icon: 'fas fa-n',                    subtitle: 'Integração Notion',                        group: 'integrations' },
  { id: 'ai-int',            label: 'IA (Claude/GPT)',    icon: 'fas fa-robot',                subtitle: 'Chaves de API para IA',                    group: 'integrations' },
  { id: 'assets',            label: 'Ativos Conectados',  icon: 'fas fa-boxes-stacked',        subtitle: 'BMs, contas e páginas Meta vinculados',    group: 'integrations' },

  // ── Configurações ─────────────────────────────────────────────────────────
  { id: 'projects',          label: 'Projetos',           icon: 'fas fa-folder-open',          subtitle: 'Gerenciar projetos e clientes',            group: 'config' },
  { id: 'settings',          label: 'Configurações',      icon: 'fas fa-gear',                 subtitle: 'Conta, preferências e segurança',          group: 'config' },
  { id: 'profile',           label: 'Meu Perfil',         icon: 'fas fa-user-circle',          subtitle: 'Dados pessoais e senha',                   group: 'config' },

  // ── Ocultos (navegação programática) ──────────────────────────────────────
  { id: 'project-detail', label: '', icon: '', subtitle: '', group: 'hidden' },
  { id: 'account-detail', label: '', icon: '', subtitle: '', group: 'hidden' },
];

// ── MAIN APP ──────────────────────────────────────────────────────────────────
Alpine.data('App', () => ({
  currentPage: 'dashboard',
  navItems: NAV,
  navGroups: NAV_GROUPS,
  openGroups: { meta: true, google: false, products: false, intel: true, ops: false, integrations: false, config: false },
  sidebarOpen: false,
  sidebarCollapsed: false,
  isMobile: window.innerWidth < 1024,
  loading: false,
  notifOpen: false,
  toasts: [],
  toastQueue: [],
  notifLog: [],
  alertCount: 0,
  // ── Live data ─────────────────────────────────────────────────────────────
  liveData: null,
  liveUpdatedAt: null,
  livePulse: false,
  _liveInterval: null,
  LIVE_INTERVAL_MS: 60_000,   // 60s default; pages can override per-page

  get pageTitle()    { return NAV.find(n=>n.id===this.currentPage)?.label    || ''; },
  get pageSubtitle() { return NAV.find(n=>n.id===this.currentPage)?.subtitle || ''; },
  get liveTimestamp() {
    if (!this.liveUpdatedAt) return '';
    try {
      return new Date(this.liveUpdatedAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    } catch { return ''; }
  },

  async init() {
    window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 1024; });
    window.addEventListener('show-toast', e => this.addToast(e.detail));
    window.addEventListener('navigate', e => { if (e.detail?.page) this.navigate(e.detail.page); });
    // Reset sidebar scroll to top on load (setTimeout needed — Alpine renders after nextTick)
    this.$nextTick(() => {
      document.querySelector('nav')?.scrollTo(0, 0);
      setTimeout(() => { document.querySelector('nav')?.scrollTo(0, 0); }, 100);
      setTimeout(() => { document.querySelector('nav')?.scrollTo(0, 0); }, 400);
    });
    await this.$store.meta.refresh();
    const alerts = await API.get('/api/alerts');
    if (alerts) this.alertCount = alerts.filter(a => a.status === 'active').length;
    // Start live polling
    await this.pollLive();
    this._liveInterval = setInterval(() => this.pollLive(), this.LIVE_INTERVAL_MS);
  },

  async pollLive() {
    if (this.$store.meta.accountCount === 0) return;
    const data = await API.get('/api/live?period=today');
    if (data) {
      this.liveData = data;
      this.liveUpdatedAt = data.updated_at;
      // Pulse animation
      this.livePulse = true;
      setTimeout(() => { this.livePulse = false; }, 1200);
      // Broadcast to pages that are listening
      window.dispatchEvent(new CustomEvent('live-update', { detail: data }));
    }
  },

  toggleGroup(g) {
    this.openGroups[g] = !this.openGroups[g];
  },

  navigate(page) {
    this.currentPage = page;
    this.sidebarOpen = false;
    window.scrollTo(0, 0);
    // Auto-expand the group of this page
    const item = NAV.find(n => n.id === page);
    if (item && item.group !== 'hidden') {
      this.openGroups[item.group] = true;
    }
    this.pollLive();
  },

  async refreshData() {
    this.loading = true;
    // Limpa cache do dashboard para forçar nova busca na Meta API
    await API.del('/api/dashboard/cache');
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
// ── WORLD CLOCK DATA ─────────────────────────────────────────────────────────
const ALL_TIMEZONES = [
  { code:'br',  flag:'🇧🇷', name:'Brasil',         tz:'America/Sao_Paulo'    },
  { code:'mx',  flag:'🇲🇽', name:'México',         tz:'America/Mexico_City'  },
  { code:'us',  flag:'🇺🇸', name:'EUA (NY)',        tz:'America/New_York'     },
  { code:'us-la',flag:'🇺🇸',name:'EUA (LA)',        tz:'America/Los_Angeles'  },
  { code:'ar',  flag:'🇦🇷', name:'Argentina',       tz:'America/Argentina/Buenos_Aires' },
  { code:'co',  flag:'🇨🇴', name:'Colômbia',        tz:'America/Bogota'       },
  { code:'cl',  flag:'🇨🇱', name:'Chile',           tz:'America/Santiago'     },
  { code:'pe',  flag:'🇵🇪', name:'Peru',            tz:'America/Lima'         },
  { code:'ec',  flag:'🇪🇨', name:'Equador',         tz:'America/Guayaquil'    },
  { code:'uy',  flag:'🇺🇾', name:'Uruguai',         tz:'America/Montevideo'   },
  { code:'py',  flag:'🇵🇾', name:'Paraguai',        tz:'America/Asuncion'     },
  { code:'bo',  flag:'🇧🇴', name:'Bolívia',         tz:'America/La_Paz'       },
  { code:'ve',  flag:'🇻🇪', name:'Venezuela',       tz:'America/Caracas'      },
  { code:'ca',  flag:'🇨🇦', name:'Canadá',          tz:'America/Toronto'      },
  { code:'es',  flag:'🇪🇸', name:'Espanha',         tz:'Europe/Madrid'        },
  { code:'pt',  flag:'🇵🇹', name:'Portugal',        tz:'Europe/Lisbon'        },
  { code:'gb',  flag:'🇬🇧', name:'Reino Unido',     tz:'Europe/London'        },
  { code:'de',  flag:'🇩🇪', name:'Alemanha',        tz:'Europe/Berlin'        },
  { code:'fr',  flag:'🇫🇷', name:'França',          tz:'Europe/Paris'         },
  { code:'it',  flag:'🇮🇹', name:'Itália',          tz:'Europe/Rome'          },
  { code:'au',  flag:'🇦🇺', name:'Austrália',       tz:'Australia/Sydney'     },
  { code:'jp',  flag:'🇯🇵', name:'Japão',           tz:'Asia/Tokyo'           },
  { code:'cn',  flag:'🇨🇳', name:'China',           tz:'Asia/Shanghai'        },
  { code:'in',  flag:'🇮🇳', name:'Índia',           tz:'Asia/Kolkata'         },
  { code:'ae',  flag:'🇦🇪', name:'Dubai',           tz:'Asia/Dubai'           },
];

const CLOCK_STORAGE_KEY = 'meta_clock_countries';

Alpine.data('Dashboard', () => ({
  period: 'last_7d',
  viewBy: 'account',
  customFrom: '', customTo: '',
  showCustom: false,
  loading: false,
  ts: null,
  charts: {},
  tableSearch: '', tablePage: 0, tablePerPage: 10, tableSort: 'spend', tableSortDir: 'desc',
  apiData: null,
  // ── World clock ──────────────────────────────────────────────────────────
  clockTick: 0,
  _clockInterval: null,
  clockPickerOpen: false,
  clockCodes: JSON.parse(localStorage.getItem(CLOCK_STORAGE_KEY) || '["br","mx","us","co","ar"]'),

  get clockCountries() {
    return this.clockCodes
      .map(c => ALL_TIMEZONES.find(t => t.code === c))
      .filter(Boolean);
  },
  get allTimezones() { return ALL_TIMEZONES; },

  clockTime(tz) {
    void this.clockTick; // reactive dependency
    try {
      return new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: tz });
    } catch { return '--:--:--'; }
  },
  clockDate(tz) {
    void this.clockTick;
    try {
      return new Date().toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short', timeZone: tz });
    } catch { return ''; }
  },
  clockIsNight(tz) {
    void this.clockTick;
    try {
      const h = parseInt(new Date().toLocaleString('en-US', { hour:'2-digit', hour12:false, timeZone: tz }));
      return h >= 22 || h < 6;
    } catch { return false; }
  },
  clockIsEarlyMorning(tz) {
    void this.clockTick;
    try {
      const h = parseInt(new Date().toLocaleString('en-US', { hour:'2-digit', hour12:false, timeZone: tz }));
      return h >= 6 && h < 9;
    } catch { return false; }
  },
  clockIsGoodTime(tz) {
    void this.clockTick;
    try {
      const h = parseInt(new Date().toLocaleString('en-US', { hour:'2-digit', hour12:false, timeZone: tz }));
      return h >= 9 && h < 22;
    } catch { return true; }
  },
  toggleClockCountry(code) {
    const idx = this.clockCodes.indexOf(code);
    if (idx === -1) this.clockCodes.push(code);
    else this.clockCodes.splice(idx, 1);
    localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(this.clockCodes));
  },

  async init() {
    await this.fetchDashboard();
    this.$watch('period', async v => { if(v!=='custom') { await this.fetchDashboard(); } });
    this.$watch('viewBy', () => this.$nextTick(()=>this.buildCharts()));
    // World clock — tick every second
    this._clockInterval = setInterval(() => { this.clockTick++; }, 1000);
  },

  async fetchDashboard(force = false) {
    this.loading = true;
    const url = `/api/dashboard?period=${this.period}&view_by=${this.viewBy}${force ? '&force=true' : ''}`;
    const data = await API.get(url);
    this.apiData = data || {};
    const rawTs = (data && data.time_series) || [];
    this.ts = {
      labels: rawTs.map(d => d.date),
      invest: rawTs.map(d => d.invest),
      conv:   rawTs.map(d => d.conversions),
      roas:   rawTs.map(d => d.roas),
    };
    this.loading = false;
    this.$nextTick(() => this.buildCharts());
  },

  get accounts() {
    return (this.apiData && this.apiData.by_account) || [];
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
    else if(this.viewBy==='product') { const prods = this.apiData?.by_product || []; labels=prods.map(p=>p.name||p.code); invest=prods.map(p=>p.invest||p.spend||0); conv=prods.map(p=>p.conversions||0); }
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

      <!-- Empty state — no accounts connected -->
      <div x-show="$store.meta.accountCount === 0" class="rounded-2xl p-5 flex items-center gap-4" style="background:rgba(30,41,59,0.8);border:1px solid rgba(59,130,246,0.3);">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(59,130,246,0.15);">
          <i class="fas fa-plug text-blue-400"></i>
        </div>
        <div class="flex-1">
          <p class="text-slate-200 font-semibold text-sm">Nenhuma conta conectada</p>
          <p class="text-slate-400 text-xs mt-0.5">Adicione um Business Manager para começar a ver dados reais das suas campanhas.</p>
        </div>
        <button @click="$dispatch('navigate',{page:'connections'})" class="btn btn-sm whitespace-nowrap" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;">
          <i class="fas fa-plus text-xs"></i> Conectar API
        </button>
      </div>

      <!-- ── World Clock Widget ──────────────────────────────────────────── -->
      <div class="glass rounded-2xl overflow-hidden">
        <!-- Header -->
        <div class="px-5 py-3 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.3);">
          <div class="flex items-center gap-2.5">
            <i class="fas fa-clock text-blue-400 text-sm"></i>
            <span class="text-white font-semibold text-sm">Fusos Horários</span>
            <span class="badge text-xs" style="background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.2);" x-text="clockCodes.length + ' países'"></span>
          </div>
          <!-- Add / manage button -->
          <button @click="clockPickerOpen=!clockPickerOpen"
            :class="clockPickerOpen ? 'bg-blue-600/30 text-blue-300 border-blue-500/40' : 'text-slate-400 border-slate-700/50 hover:text-blue-300 hover:border-blue-500/30'"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all">
            <i class="fas fa-plus text-xs"></i> Gerenciar países
          </button>
          <!-- Picker modal overlay -->
          <div x-show="clockPickerOpen" @click="clockPickerOpen=false"
               x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
               class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
               style="display:none;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);">
            <div @click.stop class="w-full max-w-sm rounded-2xl shadow-2xl"
                 style="background:rgba(15,23,42,0.99);border:1px solid rgba(59,130,246,0.25);">
              <div class="px-4 py-3 flex items-center justify-between" style="border-bottom:1px solid rgba(51,65,85,0.4);">
                <p class="text-white font-semibold text-sm">Selecionar Países</p>
                <div class="flex gap-3 items-center">
                  <button @click="clockCodes=['br','mx','us','co','ar']; localStorage.setItem('meta_clock_countries', JSON.stringify(clockCodes))" class="text-xs text-slate-500 hover:text-blue-400 transition-colors">Padrão</button>
                  <button @click="clockCodes=[]; localStorage.setItem('meta_clock_countries', JSON.stringify([]))" class="text-xs text-slate-500 hover:text-red-400 transition-colors">Limpar</button>
                  <button @click="clockPickerOpen=false" class="text-slate-500 hover:text-white transition-colors"><i class="fas fa-times text-xs"></i></button>
                </div>
              </div>
              <div class="p-3 grid grid-cols-2 gap-1.5 overflow-y-auto" style="max-height:400px;">
                <template x-for="tz in allTimezones" :key="tz.code">
                  <button @click="toggleClockCountry(tz.code)"
                    :class="clockCodes.includes(tz.code) ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-slate-700/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'"
                    class="flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all text-xs text-left">
                    <span class="text-base flex-shrink-0" x-text="tz.flag"></span>
                    <div class="min-w-0 flex-1">
                      <p class="font-medium truncate" x-text="tz.name"></p>
                    </div>
                    <i class="fas text-xs flex-shrink-0 transition-colors" :class="clockCodes.includes(tz.code) ? 'fa-check-circle text-blue-400' : 'fa-circle text-slate-700'"></i>
                  </button>
                </template>
              </div>
              <div class="px-4 py-3" style="border-top:1px solid rgba(51,65,85,0.4);">
                <button @click="clockPickerOpen=false" class="btn btn-primary btn-sm w-full">Fechar</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Clock cards -->
        <div class="p-4">
          <template x-if="clockCodes.length === 0">
            <div class="text-center py-6 text-slate-500 text-sm">
              <i class="fas fa-earth-americas text-slate-600 text-2xl mb-2 block"></i>
              Nenhum país adicionado. Clique em "Gerenciar países" para adicionar.
            </div>
          </template>
          <div class="flex flex-wrap gap-3">
            <template x-for="c in clockCountries" :key="c.code">
              <div class="rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                   :style="clockIsNight(c.tz) ? 'background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.4);' : clockIsEarlyMorning(c.tz) ? 'background:rgba(30,41,59,0.6);border:1px solid rgba(245,158,11,0.2);' : 'background:rgba(30,41,59,0.5);border:1px solid rgba(59,130,246,0.15);'">
                <!-- Flag + night/day icon -->
                <div class="relative flex-shrink-0">
                  <span class="text-2xl" x-text="c.flag"></span>
                  <span class="absolute -bottom-0.5 -right-1 text-xs"
                        x-text="clockIsNight(c.tz) ? '🌙' : clockIsEarlyMorning(c.tz) ? '🌅' : '☀️'"></span>
                </div>
                <!-- Info -->
                <div>
                  <p class="text-slate-400 text-xs leading-none mb-1" x-text="c.name"></p>
                  <p class="font-mono font-bold text-base leading-none tabular-nums"
                     :class="clockIsNight(c.tz) ? 'text-slate-400' : clockIsEarlyMorning(c.tz) ? 'text-amber-400' : 'text-white'"
                     x-text="clockTime(c.tz)"></p>
                  <p class="text-slate-600 text-xs mt-0.5 leading-none capitalize" x-text="clockDate(c.tz)"></p>
                </div>
                <!-- Traffic light indicator -->
                <div class="ml-1 w-2 h-2 rounded-full flex-shrink-0"
                     :style="clockIsGoodTime(c.tz) ? 'background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.6)' : clockIsEarlyMorning(c.tz) ? 'background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,0.6)' : 'background:#475569'""></div>
              </div>
            </template>
          </div>

          <!-- Legend -->
          <div x-show="clockCodes.length > 0" class="flex items-center gap-4 mt-3 px-1">
            <div class="flex items-center gap-1.5 text-xs text-slate-600">
              <div class="w-2 h-2 rounded-full" style="background:#22c55e;box-shadow:0 0 5px rgba(34,197,94,0.5)"></div>
              Boa hora para subir (9h–22h)
            </div>
            <div class="flex items-center gap-1.5 text-xs text-slate-600">
              <div class="w-2 h-2 rounded-full" style="background:#f59e0b"></div>
              Cedo (6h–9h)
            </div>
            <div class="flex items-center gap-1.5 text-xs text-slate-600">
              <div class="w-2 h-2 rounded-full" style="background:#475569"></div>
              Madrugada (22h–6h)
            </div>
          </div>
        </div>
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
        <div class="flex items-center gap-1.5 flex-wrap">
          ${[{v:'today',l:'Hoje'},{v:'yesterday',l:'Ontem'},{v:'last_7d',l:'7 dias'},{v:'last_14d',l:'14 dias'},{v:'last_30d',l:'30 dias'},{v:'last_90d',l:'Máximo'},{v:'custom',l:'Personalizado'}].map(p=>`
          <button @click="period='${p.v}'; showCustom='${p.v}'==='custom'" :class="period==='${p.v}'?'bg-blue-600/30 text-blue-300 border-blue-500/50':'text-slate-400 border-slate-700/50 hover:text-slate-300'" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all">${p.l}</button>`).join('')}
        </div>
        <div x-show="showCustom" class="flex items-center gap-2 flex-wrap">
          <input type="date" x-model="customFrom" class="form-input" style="width:140px;" />
          <span class="text-slate-500 text-xs">até</span>
          <input type="date" x-model="customTo" class="form-input" style="width:140px;" />
          <button @click="fetchDashboard(true)" class="btn btn-primary btn-sm">Aplicar</button>
        </div>
        <button @click="fetchDashboard(true)" class="btn btn-primary btn-sm whitespace-nowrap ml-auto">
          <i class="fas fa-rotate-right" :class="loading ? 'animate-spin' : ''"></i> Atualizar
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
