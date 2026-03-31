// ─── MANUAL PAGE — Guia Completo da Plataforma ────────────────────────────────
document.addEventListener('alpine:init', () => {

Alpine.data('ManualPage', () => ({
  activeSection: 'inicio',
  searchQuery: '',

  sections: [
    { id:'inicio',       label:'Início Rápido',          icon:'fas fa-rocket',           group:'Primeiros Passos' },
    { id:'prereqs',      label:'Pré-requisitos',          icon:'fas fa-clipboard-check',  group:'Primeiros Passos' },
    { id:'settings',     label:'Configurar API Keys',     icon:'fas fa-key',              group:'Primeiros Passos' },
    { id:'bm',              label:'Business Managers',          icon:'fas fa-building',         group:'Conectar à Plataforma' },
    { id:'accounts',        label:'Contas de Anúncio',          icon:'fas fa-credit-card',      group:'Conectar à Plataforma' },
    { id:'token',           label:'Tokens Meta (Renovar)',      icon:'fas fa-rotate',           group:'Conectar à Plataforma' },
    { id:'meta_bm_setup',   label:'Criar Business Manager',     icon:'fab fa-facebook',         group:'Painel do Meta' },
    { id:'meta_app',        label:'Criar App de Desenvolvedor', icon:'fas fa-code',             group:'Painel do Meta' },
    { id:'meta_token_gen',  label:'Gerar Access Token',         icon:'fas fa-key',              group:'Painel do Meta' },
    { id:'meta_pixel',      label:'Pixel e Events Manager',     icon:'fas fa-bullseye',         group:'Painel do Meta' },
    { id:'meta_ids',        label:'Encontrar IDs (BM, Conta, Página, Pixel)', icon:'fas fa-magnifying-glass', group:'Painel do Meta' },
    { id:'meta_adsmanager', label:'Gerenciador de Anúncios',    icon:'fas fa-chart-bar',        group:'Painel do Meta' },
    { id:'meta_review',     label:'Revisar e Ativar Campanhas', icon:'fas fa-play-circle',      group:'Painel do Meta' },
    { id:'importar',        label:'Importar do Google Sheets',  icon:'fas fa-file-import',      group:'Produtos & Campanhas' },
    { id:'launch',       label:'Lançar Campanhas',        icon:'fas fa-rocket',           group:'Produtos & Campanhas' },
    { id:'campaigns',    label:'Gerenciar Campanhas',     icon:'fas fa-layer-group',      group:'Produtos & Campanhas' },
    { id:'quickactions', label:'Ações Rápidas',           icon:'fas fa-bolt',             group:'Produtos & Campanhas' },
    { id:'agent',        label:'Gestor IA (Agente)',      icon:'fas fa-robot',            group:'Gestor IA' },
    { id:'knowledge',    label:'Base de Conhecimento',    icon:'fas fa-brain',            group:'Gestor IA' },
    { id:'chat',         label:'Chat com a IA',           icon:'fas fa-comments',         group:'Gestor IA' },
    { id:'ideas',        label:'Ideias & Estratégias',    icon:'fas fa-lightbulb',        group:'Gestor IA' },
    { id:'projects',             label:'Projetos',                    icon:'fas fa-folder-open',      group:'Projetos & Integrações' },
    { id:'project_integrations', label:'Configurar Notion / ClickUp', icon:'fas fa-plug',             group:'Projetos & Integrações' },
    { id:'sync_notion',          label:'Puxar Dados do Notion',       icon:'fas fa-book',             group:'Projetos & Integrações' },
    { id:'sync_clickup',         label:'Puxar Tarefas do ClickUp',    icon:'fas fa-check-circle',     group:'Projetos & Integrações' },
    { id:'auto_products',        label:'Criar Produtos por País',     icon:'fas fa-wand-magic-sparkles', group:'Projetos & Integrações' },
    { id:'session_secret',       label:'Sessão Persistente (Render)', icon:'fas fa-shield-halved',    group:'Projetos & Integrações' },
    { id:'rules',        label:'Regras de Automação',     icon:'fas fa-shield-halved',    group:'Automação' },
    { id:'alerts',       label:'Alertas',                 icon:'fas fa-bell',             group:'Automação' },
    { id:'dashboard',    label:'Dashboard',               icon:'fas fa-chart-pie',        group:'Análise' },
    { id:'analysis',     label:'Análise Profunda',        icon:'fas fa-magnifying-glass-chart', group:'Análise' },
    { id:'reports',      label:'Relatórios',              icon:'fas fa-file-chart-column', group:'Análise' },
    { id:'products',     label:'Produtos (Performance)',  icon:'fas fa-box',              group:'Análise' },
    { id:'sheets_create',  label:'Criar a Planilha',            icon:'fas fa-table',              group:'Google Sheets' },
    { id:'sheets_config_tab', label:'Preencher aba Configurações', icon:'fas fa-sliders',           group:'Google Sheets' },
    { id:'sheets_ads_tab', label:'Preencher aba Anúncios',      icon:'fas fa-film',               group:'Google Sheets' },
    { id:'sheets_videos',  label:'Links de Vídeo do Drive',     icon:'fab fa-google-drive',       group:'Google Sheets' },
    { id:'gcloud_project', label:'Criar Projeto no Google Cloud', icon:'fab fa-google',           group:'Google Cloud' },
    { id:'gcloud_api',     label:'Ativar Sheets API',           icon:'fas fa-plug',               group:'Google Cloud' },
    { id:'gcloud_sa',      label:'Criar Conta de Serviço',      icon:'fas fa-user-shield',        group:'Google Cloud' },
    { id:'n8n_install',    label:'Instalar e Acessar o n8n',    icon:'fas fa-server',             group:'n8n (Workflow)' },
    { id:'n8n_import',     label:'Importar o Workflow',         icon:'fas fa-file-import',        group:'n8n (Workflow)' },
    { id:'n8n_configure',  label:'Configurar os Nodes',         icon:'fas fa-gear',               group:'n8n (Workflow)' },
    { id:'n8n_test',       label:'Testar e Ativar o Workflow',  icon:'fas fa-play',               group:'n8n (Workflow)' },
    { id:'troubleshoot', label:'Solução de Problemas',          icon:'fas fa-wrench',             group:'Suporte' },
  ],

  get filteredSections() {
    if (!this.searchQuery) return this.sections
    return this.sections.filter(s => s.label.toLowerCase().includes(this.searchQuery.toLowerCase()))
  },

  get groupedSections() {
    const groups = {}
    for (const s of this.filteredSections) {
      if (!groups[s.group]) groups[s.group] = []
      groups[s.group].push(s)
    }
    return groups
  },

  scrollToTop() {
    document.querySelector('#manual-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  },

  navigate(id) {
    this.activeSection = id
    this.scrollToTop()
  },

  // ── HTML HELPERS ──────────────────────────────────────────────────────────

  step(n, title, content) {
    return `<div class="flex gap-4 mb-5">
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">${n}</div>
      <div class="flex-1 pt-0.5">
        <p class="text-white font-semibold mb-1">${title}</p>
        <div class="text-gray-300 text-sm leading-relaxed">${content}</div>
      </div>
    </div>`
  },

  tip(content) {
    return `<div class="flex gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
      <i class="fas fa-lightbulb text-blue-400 mt-0.5 flex-shrink-0"></i>
      <p class="text-blue-200 text-sm leading-relaxed">${content}</p>
    </div>`
  },

  warn(content) {
    return `<div class="flex gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <i class="fas fa-triangle-exclamation text-yellow-400 mt-0.5 flex-shrink-0"></i>
      <p class="text-yellow-200 text-sm leading-relaxed">${content}</p>
    </div>`
  },

  danger(content) {
    return `<div class="flex gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
      <i class="fas fa-ban text-red-400 mt-0.5 flex-shrink-0"></i>
      <p class="text-red-200 text-sm leading-relaxed">${content}</p>
    </div>`
  },

  ok(content) {
    return `<div class="flex gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
      <i class="fas fa-circle-check text-green-400 mt-0.5 flex-shrink-0"></i>
      <p class="text-green-200 text-sm leading-relaxed">${content}</p>
    </div>`
  },

  code(text) {
    return `<code class="bg-gray-900 text-green-400 px-2 py-0.5 rounded text-xs font-mono">${text}</code>`
  },

  codeBlock(text) {
    return `<pre class="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto mb-4 leading-relaxed">${text}</pre>`
  },

  badge(text, color='purple') {
    const colors = { purple:'bg-purple-600/30 text-purple-300', green:'bg-green-600/30 text-green-300', blue:'bg-blue-600/30 text-blue-300', yellow:'bg-yellow-600/30 text-yellow-300', red:'bg-red-600/30 text-red-300', gray:'bg-gray-700 text-gray-300' }
    return `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[color]||colors.purple}">${text}</span>`
  },

  h2(title, icon='') {
    return `<h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">${icon ? `<i class="${icon} text-purple-400"></i>` : ''} ${title}</h2>`
  },

  h3(title) {
    return `<h3 class="text-base font-semibold text-white mt-6 mb-3 border-b border-gray-700 pb-2">${title}</h3>`
  },

  p(text) {
    return `<p class="text-gray-300 text-sm leading-relaxed mb-3">${text}</p>`
  },

  // ── SECTION RENDERERS ────────────────────────────────────────────────────

  renderSection(id) {
    const map = {
      inicio:       () => this.sInicio(),
      prereqs:      () => this.sPrereqs(),
      settings:     () => this.sSettings(),
      bm:           () => this.sBm(),
      accounts:     () => this.sAccounts(),
      token:        () => this.sToken(),
      meta_bm_setup:   () => this.sMetaBmSetup(),
      meta_app:        () => this.sMetaApp(),
      meta_token_gen:  () => this.sMetaTokenGen(),
      meta_pixel:      () => this.sMetaPixel(),
      meta_ids:        () => this.sMetaIds(),
      meta_adsmanager: () => this.sMetaAdsManager(),
      meta_review:     () => this.sMetaReview(),
      importar:     () => this.sImportar(),
      launch:       () => this.sLaunch(),
      campaigns:    () => this.sCampaigns(),
      quickactions: () => this.sQuickActions(),
      agent:        () => this.sAgent(),
      knowledge:    () => this.sKnowledge(),
      chat:         () => this.sChat(),
      ideas:        () => this.sIdeas(),
      rules:        () => this.sRules(),
      alerts:       () => this.sAlerts(),
      dashboard:    () => this.sDashboard(),
      analysis:     () => this.sAnalysis(),
      reports:      () => this.sReports(),
      products:     () => this.sProducts(),
      sheets_create:    () => this.sSheetsCreate(),
      sheets_config_tab:() => this.sSheetsConfigTab(),
      sheets_ads_tab:   () => this.sSheetsAdsTab(),
      sheets_videos:    () => this.sSheetsVideos(),
      gcloud_project:   () => this.sGCloudProject(),
      gcloud_api:       () => this.sGCloudApi(),
      gcloud_sa:        () => this.sGCloudSa(),
      n8n_install:      () => this.sN8nInstall(),
      n8n_import:       () => this.sN8nImport(),
      n8n_configure:    () => this.sN8nConfigure(),
      n8n_test:         () => this.sN8nTest(),
      troubleshoot: () => this.sTroubleshoot(),
      projects:             () => this.sProjects(),
      project_integrations: () => this.sProjectIntegrations(),
      sync_notion:          () => this.sSyncNotion(),
      sync_clickup:         () => this.sSyncClickup(),
      auto_products:        () => this.sAutoProducts(),
      session_secret:       () => this.sSessionSecret(),
    }
    return (map[id] || map['inicio'])()
  },

  // ════════════════════════════════════════════════════════════════════════
  // PAINEL DO META — seções detalhadas sobre navegação no Meta Ads
  // ════════════════════════════════════════════════════════════════════════

  sMetaBmSetup() {
    return `
<div>
  ${this.h2('Criar e Configurar o Business Manager', 'fab fa-facebook')}
  ${this.p('O Business Manager (BM) é o ambiente central do Meta para gerenciar páginas, contas de anúncio, pixels e pessoas. Tudo na plataforma de anúncios passa por ele.')}

  ${this.h3('O que é o Business Manager?')}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
    ${[
      ['Organização', 'Agrupa contas de anúncio, páginas e pixels de um mesmo negócio ou cliente'],
      ['Controle de acesso', 'Permite adicionar colaboradores com diferentes níveis de permissão'],
      ['Segurança', 'Separa os ativos profissionais do perfil pessoal do Facebook'],
    ].map(([t,d]) => `<div class="bg-gray-800/50 rounded-lg p-4"><p class="text-white text-sm font-semibold mb-1">${t}</p><p class="text-gray-400 text-xs">${d}</p></div>`).join('')}
  </div>

  ${this.h3('Como criar um Business Manager do zero')}
  ${this.step(1, 'Acesse o Meta Business Suite', 'Vá em: <strong>business.facebook.com</strong><br>Faça login com seu Facebook pessoal (necessário para criar um BM).')}
  ${this.step(2, 'Clique em "Criar conta"', 'Se ainda não tiver um BM, aparecerá o botão <strong>"Criar conta"</strong> no centro da tela ou em <strong>"Configurações" → "Criar conta de empresa"</strong>.')}
  ${this.step(3, 'Preencha os dados do negócio', `
    <div class="mt-2 space-y-2 text-xs">
      ${[['Nome do negócio','Nome da empresa ou cliente. Ex: "Sierra Cosmetics"'],['Seu nome','Seu nome completo'],['E-mail comercial','E-mail profissional do negócio']].map(([f,d]) => `<div class="bg-gray-900/50 rounded p-2"><span class="text-green-400 font-mono">${f}:</span> <span class="text-gray-400">${d}</span></div>`).join('')}
    </div>`)}
  ${this.step(4, 'Confirme o e-mail', 'O Meta enviará um e-mail de confirmação. Clique no link antes de continuar.')}
  ${this.step(5, 'BM criado!', 'Você será redirecionado ao painel do Business Manager. Anote o BM ID que aparece nas Configurações.')}

  ${this.h3('Como adicionar uma Conta de Anúncio ao BM')}
  ${this.step(1, 'Acesse as Configurações do Negócio', 'No BM, clique em <strong>"Configurações"</strong> (ícone de engrenagem no menu lateral).')}
  ${this.step(2, 'Vá em Contas → Contas de Anúncio', 'No menu esquerdo: <strong>Contas → Contas de anúncio</strong>.')}
  ${this.step(3, 'Clique em "Adicionar"', 'Você tem três opções:')}
  <div class="ml-12 space-y-2 mb-4 text-sm">
    ${[
      ['Adicionar uma conta de anúncio', 'Se você já tem uma conta de anúncio com o ID (act_XXXXX), adicione aqui'],
      ['Solicitar acesso a uma conta', 'Se a conta pertence a outro BM (ex: conta do cliente)'],
      ['Criar uma nova conta de anúncio', 'Para criar uma conta nova do zero dentro deste BM'],
    ].map(([o,d]) => `<div class="bg-gray-800/50 rounded p-3"><p class="text-white font-medium text-xs">${o}</p><p class="text-gray-400 text-xs mt-0.5">${d}</p></div>`).join('')}
  </div>
  ${this.step(4, 'Para criar conta nova', 'Clique em <strong>"Criar uma nova conta de anúncio"</strong> → preencha nome, fuso horário e moeda → confirme.')}

  ${this.h3('Como adicionar uma Página ao BM')}
  ${this.step(1, 'Vá em Contas → Páginas', 'No menu do BM: <strong>Contas → Páginas</strong>.')}
  ${this.step(2, 'Clique em "Adicionar"', 'Escolha <strong>"Adicionar uma página"</strong> (se você é admin) ou <strong>"Solicitar acesso"</strong> (se é do cliente).')}
  ${this.step(3, 'Digite o nome ou URL da Página', 'Busque pelo nome da Página do Facebook ou cole o link.')}

  ${this.h3('Como dar acesso a outra pessoa no BM')}
  ${this.step(1, 'Vá em Usuários → Pessoas', 'Menu do BM: <strong>Usuários → Pessoas</strong>.')}
  ${this.step(2, 'Clique em "Adicionar"', 'Digite o e-mail da pessoa.')}
  ${this.step(3, 'Defina o acesso', 'Escolha o que essa pessoa pode ver/editar: Contas de Anúncio, Páginas, Pixels específicos.')}

  ${this.tip('Cada cliente deve ter seu próprio BM. Nunca misture campanhas de clientes diferentes no mesmo BM — isso dificulta o controle e pode causar problemas de faturamento.')}
  ${this.warn('Para criar um BM, você precisa de um perfil Facebook pessoal. Uma pessoa pode criar no máximo 2 BMs pessoais.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaApp() {
    return `
<div>
  ${this.h2('Criar App no Meta para Desenvolvedores', 'fas fa-code')}
  ${this.p('O App é necessário para gerar os tokens de acesso de longa duração (60 dias) usados pela plataforma. Você precisa criar apenas um App e pode usá-lo para todas as contas.')}

  ${this.h3('Passo a passo para criar o App')}
  ${this.step(1, 'Acesse o Meta for Developers', 'Vá em: <strong>developers.facebook.com</strong><br>Clique em <strong>"Meus Apps"</strong> no menu superior direito e faça login.')}
  ${this.step(2, 'Clique em "Criar App"', 'Botão verde no canto superior direito.')}
  ${this.step(3, 'Escolha o tipo de App', 'Selecione <strong>"Negócios"</strong> (Business). Isso permite acesso às APIs de Marketing.')}
  ${this.step(4, 'Preencha os dados do App', `
    <div class="mt-2 space-y-2 text-xs">
      ${[
        ['Nome do App', 'Algo descritivo. Ex: "MetaAds Platform Token" ou "Sierra API"'],
        ['E-mail de contato', 'Seu e-mail profissional'],
        ['Conta de Negócios', 'Selecione o BM ao qual este App pertence'],
      ].map(([f,d]) => `<div class="bg-gray-900/50 rounded p-2"><span class="text-green-400 font-mono">${f}:</span> <span class="text-gray-400">${d}</span></div>`).join('')}
    </div>`)}
  ${this.step(5, 'Clique em "Criar App"', 'Confirme e aguarde alguns segundos.')}
  ${this.step(6, 'Anote o App ID e App Secret', 'Na tela inicial do App (Painel → Configurações → Básico), você verá o <strong>App ID</strong> e o <strong>App Secret</strong> (clique em "Mostrar" para ver). Salve ambos — você vai precisar deles na planilha de Configurações.')}

  ${this.ok('App criado! Agora você pode gerar tokens de acesso usando este App. O App ID e App Secret ficam na aba Configurações da sua planilha Google Sheets.')}

  ${this.h3('Verificar se o App está no modo "Live"')}
  ${this.p('O App precisa estar em modo <strong>Live</strong> (não em Desenvolvimento) para funcionar corretamente.')}
  ${this.step(1, 'Acesse o App', 'Em developers.facebook.com → Meus Apps → clique no App.')}
  ${this.step(2, 'Verifique o toggle no topo', 'No menu superior, procure o toggle <strong>"Em desenvolvimento"</strong>. Troque para <strong>"Ativo"</strong> (Live).')}
  ${this.step(3, 'Confirme', 'Uma janela pedirá confirmação. Clique em <strong>"Mudar para Ativo"</strong>.')}

  ${this.warn('Se o App ficar em modo "Em desenvolvimento", os tokens gerados só funcionam para usuários administradores do App. No modo Live, funcionam para qualquer conta autorizada.')}

  ${this.h3('Adicionar permissões ao App')}
  ${this.step(1, 'Vá em Configurações → Avançado', 'No menu lateral do App: <strong>Configurações → Avançado</strong>.')}
  ${this.step(2, 'Ative as permissões necessárias', 'As permissões que precisam estar ativas são: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">ads_management</code>, <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">ads_read</code>, <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">business_management</code>.<br>Essas permissões são solicitadas na hora de gerar o token pelo Explorador da API.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaTokenGen() {
    return `
<div>
  ${this.h2('Gerar o Access Token (Passo a Passo)', 'fas fa-key')}
  ${this.p('O Access Token é a "senha" que permite à plataforma acessar suas campanhas. Este guia mostra como gerar um token de 60 dias passo a passo, com telas e cliques detalhados.')}

  ${this.warn('O token padrão dura apenas 1-2 horas. Você PRECISA seguir o passo de extensão para 60 dias, caso contrário vai precisar trocar o token todo dia.')}

  ${this.h3('Parte 1: Gerar o token no Explorador da API')}
  ${this.step(1, 'Acesse o Explorador da API', 'Abra em uma nova aba: <strong>developers.facebook.com/tools/explorer</strong><br>Faça login com o Facebook que tem acesso ao BM.')}
  ${this.step(2, 'Selecione o App correto', 'No topo da página, existe um dropdown chamado <strong>"Meta App"</strong>. Selecione o App que você criou no passo anterior (Ex: "MetaAds Platform Token").<br>⚠️ Se selecionar o app errado, o token não vai funcionar.')}
  ${this.step(3, 'Selecione o usuário', 'Ao lado do App, no dropdown <strong>"User or Page"</strong>, mantenha <strong>"User Token"</strong> selecionado.')}
  ${this.step(4, 'Adicione as permissões', 'Clique em <strong>"Add a Permission"</strong> (botão azul). Uma lista de permissões aparecerá. Busque e adicione as três abaixo, uma por uma:')}
  <div class="ml-12 space-y-2 mb-4">
    ${[
      ['ads_management', 'Permite criar e editar campanhas, conjuntos e anúncios'],
      ['ads_read', 'Permite ler métricas e dados das campanhas'],
      ['business_management', 'Permite acessar recursos do Business Manager'],
    ].map(([p,d]) => `
      <div class="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
        <code class="text-green-400 bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-shrink-0">${p}</code>
        <span class="text-gray-400 text-xs">${d}</span>
      </div>`).join('')}
  </div>
  ${this.step(5, 'Clique em "Generate Access Token"', 'Botão azul no centro da tela. Uma janela popup do Facebook vai aparecer pedindo autorização.')}
  ${this.step(6, 'Autorize no popup', 'Clique em <strong>"Continuar como [seu nome]"</strong> e depois <strong>"OK"</strong>. Se aparecer uma lista de contas, selecione todas as que quer acessar.')}
  ${this.step(7, 'Token gerado!', 'Você verá um token longo no campo "Access Token". Mas <strong>não copie ainda</strong> — ele dura apenas 1 hora! Siga para a Parte 2 para estender.')}

  ${this.h3('Parte 2: Estender o token para 60 dias')}
  ${this.step(1, 'Clique no ícone de informação do token', 'Ao lado do campo do Access Token, existe um ícone azul de <strong>informação (ℹ)</strong>. Clique nele.')}
  ${this.step(2, 'Clique em "Open in Access Token Tool"', 'Um link azul aparecerá. Clique em <strong>"Open in Access Token Tool"</strong>. Isso abre a ferramenta de debug de tokens em uma nova aba.')}
  ${this.step(3, 'Clique em "Extend Access Token"', 'No final da página da ferramenta, existe um botão <strong>"Extend Access Token"</strong>. Clique nele.')}
  ${this.step(4, 'Confirme', 'Pode pedir para fazer login novamente. Confirme.')}
  ${this.step(5, 'Copie o novo token longo', 'Um token novo e longo aparecerá no campo abaixo. Este é o seu token de <strong>60 dias</strong>. Ele começa com <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">EAAxxxxx...</code> e tem centenas de caracteres.')}
  ${this.step(6, 'Verifique a validade', 'Ainda na ferramenta, clique em <strong>"Debug"</strong> com o novo token. Na seção "Data Access Expires", a data deve ser ~60 dias no futuro.')}

  ${this.ok('Token gerado e estendido! Agora copie e cole na plataforma em Business Managers → Editar → Access Token → Salvar.')}

  ${this.h3('Parte 3: Verificar as permissões do token')}
  ${this.step(1, 'Na ferramenta de debug', 'Com o token já no campo da ferramenta, clique em <strong>"Debug"</strong>.')}
  ${this.step(2, 'Verifique as permissões listadas', 'Procure a seção <strong>"Scopes"</strong>. Você deve ver na lista:')}
  <div class="ml-12 mb-4">
    ${['ads_management ✓', 'ads_read ✓', 'business_management ✓'].map(p =>
      `<div class="flex items-center gap-2 text-sm text-green-400 mb-1"><i class="fas fa-check-circle"></i>${p}</div>`
    ).join('')}
  </div>
  ${this.p('Se alguma permissão estiver faltando, volte ao Explorador da API e gere um novo token com ela adicionada.')}

  ${this.h3('Onde usar o token na plataforma')}
  <div class="space-y-2 mb-4">
    ${[
      ['Business Manager', 'Em: Business Managers → Editar BM → campo "Access Token"'],
      ['Conta de Anúncio', 'Em: Contas de Anúncio → Editar Conta → campo "Access Token"'],
      ['Planilha Google Sheets', 'Na aba "Configurações" da planilha, coluna "Access Token" de cada linha'],
    ].map(([w,d]) => `<div class="flex gap-3 bg-gray-800/50 rounded-lg p-3"><span class="text-white text-sm font-medium w-40 flex-shrink-0">${w}</span><span class="text-gray-400 text-xs">${d}</span></div>`).join('')}
  </div>

  ${this.warn('Nunca compartilhe o Access Token em chats, emails ou arquivos públicos. Quem tiver o token tem acesso total às suas campanhas e pode criar anúncios e gastar seu orçamento.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaPixel() {
    return `
<div>
  ${this.h2('Pixel e Events Manager', 'fas fa-bullseye')}
  ${this.p('O Pixel é o código que rastreia as conversões (compras, cadastros etc.) no seu site. Sem ele configurado corretamente, as campanhas de conversão não funcionam e o CPA/ROAS não são calculados.')}

  ${this.h3('Criar um Pixel novo')}
  ${this.step(1, 'Acesse o Events Manager', 'No Meta Business Suite: <strong>Todas as ferramentas → Events Manager</strong><br>Ou acesse diretamente: <strong>business.facebook.com/events_manager</strong>')}
  ${this.step(2, 'Clique em "Conectar fontes de dados"', 'Botão verde no canto superior esquerdo (ou o ícone +).')}
  ${this.step(3, 'Selecione "Web"', 'Escolha <strong>"Web"</strong> como tipo de fonte de dados.')}
  ${this.step(4, 'Escolha "Meta Pixel"', 'Selecione <strong>"Meta Pixel"</strong> e clique em <strong>"Conectar"</strong>.')}
  ${this.step(5, 'Dê um nome ao Pixel', 'Exemplo: <em>"Pixel Sierra MX"</em> ou <em>"Pixel Loja Principal"</em>. Clique em <strong>"Criar Pixel"</strong>.')}
  ${this.step(6, 'Copie o Pixel ID', 'Após criado, o Pixel ID aparecerá. É um número de 15 dígitos. Salve!')}

  ${this.h3('Instalar o Pixel no site')}
  ${this.step(1, 'No Events Manager, clique no seu Pixel', 'Selecione o Pixel recém-criado na lista.')}
  ${this.step(2, 'Clique em "Adicionar eventos"', 'Depois em <strong>"Instalar código manualmente"</strong>.')}
  ${this.step(3, 'Copie o código base do Pixel', 'Um bloco de código JavaScript aparecerá. Copie todo o bloco.')}
  ${this.step(4, 'Cole no site', 'Esse código vai no <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">&lt;head&gt;</code> de todas as páginas do site, <strong>antes</strong> do fechamento <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">&lt;/head&gt;</code>.')}
  ${this.tip('Se o site é Shopify: Acesse Admin → Preferências → Facebook Pixel → cole apenas o Pixel ID (sem o código completo).')}
  ${this.tip('Se usa Google Tag Manager: Adicione uma tag do tipo "Facebook Pixel" no GTM com o Pixel ID.')}

  ${this.h3('Configurar o evento de Compra (Purchase)')}
  ${this.p('Para rastrear conversões de compra (o que a plataforma usa para calcular CPA e ROAS), o evento <strong>Purchase</strong> precisa disparar na página de confirmação de pedido.')}
  ${this.step(1, 'No Events Manager, clique no Pixel → "Adicionar eventos"', 'Selecione <strong>"Usando o Pixel do Meta"</strong> → <strong>"Abrir ferramenta de configuração de eventos"</strong>.')}
  ${this.step(2, 'Use a ferramenta visual', 'A ferramenta abre no seu site. Clique em "Rastrear novo botão" na página de confirmação de pedido.')}
  ${this.step(3, 'Selecione "Compra"', 'Escolha o evento <strong>"Purchase"</strong> e configure o valor (revenue) se disponível.')}
  ${this.step(4, 'Confirme e salve', 'A ferramenta irá criar o evento automaticamente.')}

  ${this.h3('Verificar se o Pixel está funcionando')}
  ${this.step(1, 'Instale a extensão "Meta Pixel Helper"', 'No Chrome, instale a extensão gratuita <strong>"Meta Pixel Helper"</strong> da Chrome Web Store.')}
  ${this.step(2, 'Acesse seu site', 'Vá ao seu site. O ícone da extensão vai mostrar se o Pixel está disparando.')}
  ${this.step(3, 'Verifique no Events Manager', 'Em <strong>Events Manager → seu Pixel → Visão geral</strong>, você verá os eventos recebidos em tempo real.')}
  ${this.step(4, 'Faça um pedido de teste', 'Finalize um pedido de teste e verifique se o evento <strong>"Purchase"</strong> aparece no Events Manager em até 5 minutos.')}

  ${this.danger('Se o Pixel ID estiver errado na planilha de Configurações ou na plataforma, as campanhas serão criadas mas as conversões não serão rastreadas. Sempre verifique!')}

  ${this.h3('Vincular o Pixel a uma Conta de Anúncio')}
  ${this.step(1, 'No Events Manager, selecione o Pixel', 'Clique no Pixel que quer vincular.')}
  ${this.step(2, 'Clique na aba "Configurações"', 'Procure a seção <strong>"Contas de anúncio conectadas"</strong>.')}
  ${this.step(3, 'Clique em "Conectar ativos"', 'Selecione a conta de anúncio correta e confirme.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaIds() {
    return `
<div>
  ${this.h2('Encontrar os IDs no Painel do Meta', 'fas fa-magnifying-glass')}
  ${this.p('Veja exatamente onde encontrar cada ID necessário para configurar a plataforma e a planilha Google Sheets.')}

  ${this.h3('1. BM ID — ID do Business Manager')}
  ${this.step(1, 'Acesse o BM', 'Vá em: <strong>business.facebook.com</strong>')}
  ${this.step(2, 'Vá em Configurações do Negócio', 'Menu lateral → ícone de engrenagem → <strong>"Configurações do negócio"</strong>.')}
  ${this.step(3, 'Clique em "Informações do Negócio"', 'No menu esquerdo, clique em <strong>"Informações do negócio"</strong>. O <strong>BM ID</strong> aparece abaixo do nome da empresa, é um número de 15-16 dígitos.')}
  ${this.codeBlock('Exemplo: 123456789012345')}

  ${this.h3('2. Ad Account ID — ID da Conta de Anúncio')}
  ${this.step(1, 'Método 1: Pela URL', 'Acesse o Gerenciador de Anúncios: <strong>adsmanager.facebook.com</strong><br>A URL vai mostrar o ID assim:')}
  ${this.codeBlock('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1234567890\n                                                                     ↑↑↑↑↑↑↑↑↑↑\n                                                     Este número é o Account ID\nO ID completo com prefixo: act_1234567890')}
  ${this.step(2, 'Método 2: Pelas configurações do BM', 'Em <strong>Configurações do Negócio → Contas → Contas de anúncio</strong>, o ID aparece ao clicar na conta.')}
  ${this.warn('O Account ID na plataforma SEMPRE deve ter o prefixo "act_". Exemplo correto: act_1234567890')}

  ${this.h3('3. Page ID — ID da Página do Facebook')}
  ${this.step(1, 'Acesse a Página do Facebook', 'Vá até a Página do Facebook que será usada nos anúncios.')}
  ${this.step(2, 'Clique em "Sobre"', 'No menu da Página, clique em <strong>"Sobre"</strong>.')}
  ${this.step(3, 'Role até o final', 'Role a página até o fundo. O <strong>Page ID</strong> aparece na seção <strong>"Mais informações sobre esta Página"</strong>, com o texto "Número de identificação da Página:"')}
  ${this.codeBlock('Exemplo: 102345678901234')}
  ${this.tip('Método alternativo: acesse a Página e veja a URL. Para páginas com nome personalizado (não numérico), a URL não mostra o ID. Nesse caso use a seção "Sobre".')}

  ${this.h3('4. Pixel ID')}
  ${this.step(1, 'Acesse o Events Manager', 'Vá em: <strong>business.facebook.com/events_manager</strong>')}
  ${this.step(2, 'Selecione a fonte de dados correta', 'Na lista de fontes de dados (Pixels), clique no Pixel do site que quer usar.')}
  ${this.step(3, 'Veja o Pixel ID', 'O ID aparece logo abaixo do nome do Pixel, em destaque. É um número de 15-16 dígitos.')}
  ${this.codeBlock('Exemplo: 111222333444555')}

  ${this.h3('5. App ID e App Secret')}
  ${this.step(1, 'Acesse developers.facebook.com', 'Vá em <strong>Meus Apps</strong> e clique no seu App.')}
  ${this.step(2, 'Vá em Configurações → Básico', 'No menu lateral: <strong>Configurações → Básico</strong>.')}
  ${this.step(3, 'App ID está no topo', 'O <strong>App ID</strong> está no primeiro campo da página.')}
  ${this.step(4, 'App Secret — clique em "Mostrar"', 'O <strong>App Secret</strong> está oculto. Clique no botão <strong>"Mostrar"</strong> e confirme sua senha do Facebook para visualizá-lo.')}
  ${this.codeBlock('App ID exemplo: 987654321012345\nApp Secret exemplo: a1b2c3d4e5f6g7h8i9j0...')}
  ${this.danger('Nunca exponha o App Secret publicamente. Ele dá acesso total ao App e pode ser usado para gerar tokens. Guarde em local seguro.')}

  ${this.h3('Tabela de referência rápida')}
  <div class="overflow-x-auto">
    <table class="w-full text-sm text-left mb-4">
      <thead><tr class="text-gray-400 border-b border-gray-700">
        <th class="pb-2 pr-4">ID</th><th class="pb-2 pr-4">Onde encontrar</th><th class="pb-2">Formato</th>
      </tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['BM ID', 'business.facebook.com → Configurações → Informações do Negócio', '15-16 dígitos numéricos'],
          ['Ad Account ID', 'URL do Gerenciador de Anúncios (?act=XXXXX)', 'act_ + 10-16 dígitos'],
          ['Page ID', 'Página Facebook → Sobre → rolar até o final', '15-16 dígitos numéricos'],
          ['Pixel ID', 'Events Manager → selecionar o Pixel', '15-16 dígitos numéricos'],
          ['App ID', 'developers.facebook.com → App → Configurações → Básico', '15-16 dígitos numéricos'],
          ['App Secret', 'developers.facebook.com → App → Configurações → Básico → Mostrar', '32 caracteres alfanuméricos'],
        ].map(([id, where, fmt]) => `
          <tr class="border-b border-gray-800">
            <td class="py-2 pr-4 font-medium text-white text-xs">${id}</td>
            <td class="py-2 pr-4 text-xs text-gray-400">${where}</td>
            <td class="py-2 text-xs text-gray-500 font-mono">${fmt}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaAdsManager() {
    return `
<div>
  ${this.h2('Gerenciador de Anúncios — Navegação', 'fas fa-chart-bar')}
  ${this.p('O Gerenciador de Anúncios (Ads Manager) é o painel oficial do Meta onde você visualiza, edita e controla todas as campanhas. Esta seção ensina a navegar nele para complementar o uso da plataforma.')}

  ${this.h3('Como acessar o Gerenciador de Anúncios')}
  ${this.step(1, 'Acesse pelo navegador', 'Vá em: <strong>adsmanager.facebook.com</strong>')}
  ${this.step(2, 'Selecione a conta correta', 'No canto superior esquerdo, existe um seletor de conta. Certifique-se de estar na conta certa antes de fazer qualquer alteração.')}
  ${this.step(3, 'Navegue entre os níveis', 'O Ads Manager tem 3 níveis: <strong>Campanhas → Conjuntos de Anúncios → Anúncios</strong>. Clique nos nomes para descer os níveis.')}

  ${this.h3('Entender a estrutura de campanhas')}
  <div class="space-y-2 mb-5">
    ${[
      ['Campanha', 'fas fa-flag', 'Define o objetivo (Conversões, Tráfego, etc.) e o orçamento geral (se for CBO). Nível mais alto.'],
      ['Conjunto de Anúncios', 'fas fa-layer-group', 'Define o público, orçamento (se ABO), horário, posicionamentos. Um campanha pode ter vários conjuntos.'],
      ['Anúncio', 'fas fa-ad', 'O criativo real que aparece para o usuário: imagem, vídeo, texto, CTA. Um conjunto pode ter vários anúncios.'],
    ].map(([t,icon,d]) => `
      <div class="flex gap-3 bg-gray-800/50 rounded-lg p-4">
        <i class="${icon} text-purple-400 mt-1 w-5 flex-shrink-0"></i>
        <div><p class="text-white font-semibold text-sm">${t}</p><p class="text-gray-400 text-xs mt-1">${d}</p></div>
      </div>`).join('')}
  </div>

  ${this.h3('Colunas importantes no Ads Manager')}
  <div class="overflow-x-auto">
    <table class="w-full text-xs text-left mb-5">
      <thead><tr class="text-gray-400 border-b border-gray-700">
        <th class="pb-2 pr-3">Coluna</th><th class="pb-2">O que significa</th>
      </tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['Veiculação', 'Status da campanha: Ativo, Pausado, Em análise, Reprovado'],
          ['Resultados', 'Número de conversões (compras) no período'],
          ['Alcance', 'Pessoas únicas que viram o anúncio'],
          ['Impressões', 'Total de vezes que o anúncio foi exibido (inclui mesma pessoa)'],
          ['Cliques', 'Total de cliques no anúncio'],
          ['CTR', 'Taxa de cliques = Cliques / Impressões × 100'],
          ['CPC', 'Custo por clique'],
          ['CPM', 'Custo por mil impressões'],
          ['Valor conv. resultados', 'Receita gerada pelas conversões (para calcular ROAS)'],
          ['ROAS das conversões', 'Receita / Gasto × 100 (não é %)'],
          ['Custo por resultado', 'Quanto você pagou por cada conversão = CPA'],
          ['Orçamento', 'Orçamento diário ou total do conjunto/campanha'],
          ['Valor usado', 'Quanto foi gasto no período selecionado'],
        ].map(([c,d]) => `<tr class="border-b border-gray-800"><td class="py-1.5 pr-3 font-medium text-white">${c}</td><td class="py-1.5 text-gray-400">${d}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  ${this.h3('Personalizar as colunas exibidas')}
  ${this.step(1, 'Clique em "Colunas"', 'No canto superior direito da tabela de campanhas, clique no botão <strong>"Colunas"</strong>.')}
  ${this.step(2, 'Escolha um preset ou personalize', 'Selecione <strong>"Desempenho e cliques"</strong> para ver CTR, CPC e CPM. Ou clique em <strong>"Personalizar colunas"</strong> para escolher exatamente o que ver.')}
  ${this.step(3, 'Recomendação de colunas', 'Para monitorar performance: Veiculação, Resultados, Gasto, CPA (Custo por resultado), ROAS, CTR, CPM.')}

  ${this.h3('Filtrar e buscar campanhas')}
  ${this.step(1, 'Use a barra de busca', 'No topo da lista, digite parte do nome da campanha para filtrar.')}
  ${this.step(2, 'Filtre por status', 'Clique em <strong>"Filtros"</strong> → <strong>"Veiculação"</strong> → selecione "Ativo", "Pausado", etc.')}
  ${this.step(3, 'Mude o período', 'Clique na data no canto superior direito para mudar o período de análise (hoje, ontem, últimos 7 dias, etc.).')}

  ${this.h3('Editar uma campanha no Ads Manager')}
  ${this.step(1, 'Clique no nome da campanha', 'Isso abre a edição da campanha.')}
  ${this.step(2, 'Ou use o lápis de edição', 'Passe o mouse sobre a campanha → aparece o ícone de lápis → clique para editar.')}
  ${this.step(3, 'Edite o que precisar', 'Nome, status (ativo/pausado), orçamento, datas.')}
  ${this.step(4, 'Clique em "Publicar"', 'Sempre confirme as alterações clicando em <strong>"Publicar"</strong>.')}

  ${this.tip('As campanhas criadas pela nossa plataforma aparecem exatamente aqui no Ads Manager. Você pode usar as duas ferramentas em conjunto — nossa plataforma para monitoramento e ações em massa, e o Ads Manager para edições detalhadas.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sMetaReview() {
    return `
<div>
  ${this.h2('Revisar e Ativar Campanhas Lançadas pela Plataforma', 'fas fa-play-circle')}
  ${this.p('Toda campanha lançada pela plataforma é criada como <strong>PAUSADA</strong> no Meta. Isso é intencional — você revisa antes de ativar. Esta seção mostra exatamente o que verificar e como ativar.')}

  ${this.ok('Campanhas pausadas não gastam dinheiro. Você tem todo o tempo do mundo para revisar sem correr o risco de gastar orçamento em algo errado.')}

  ${this.h3('Passo 1: Encontrar as campanhas criadas')}
  ${this.step(1, 'Acesse o Gerenciador de Anúncios', 'Vá em: <strong>adsmanager.facebook.com</strong> → selecione a conta de anúncio correta.')}
  ${this.step(2, 'Filtre por "Pausado"', 'Clique em <strong>"Filtros"</strong> → <strong>"Veiculação"</strong> → <strong>"Pausado"</strong>. As campanhas criadas pela plataforma aparecerão na lista.')}
  ${this.step(3, 'Identifique pelo nome', 'As campanhas criadas têm o formato: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">[MX] [ABO] [NOME PRODUTO] [DD/MM]</code>. Fácil de identificar.')}

  ${this.h3('Passo 2: O que verificar antes de ativar')}
  <div class="space-y-3 mb-5">
    ${[
      ['Nome da campanha', 'Confira se o país, produto e data estão corretos no nome.'],
      ['Objetivo da campanha', 'Deve estar como "Conversões" (OUTCOME_SALES). Clique na campanha e verifique.'],
      ['Conjunto de anúncios — Orçamento', 'Clique no Conjunto → verifique o orçamento diário. Deve bater com o que estava na planilha.'],
      ['Conjunto — Público-alvo', 'Verifique países, faixa etária e gênero no conjunto de anúncios.'],
      ['Conjunto — Pixel', 'No conjunto, verifique se o Pixel e o evento "Purchase" estão selecionados.'],
      ['Conjunto — Posicionamentos', 'Deve mostrar Facebook e Instagram selecionados.'],
      ['Anúncios — Vídeo', 'Clique em cada anúncio → verifique se o vídeo carregou corretamente na prévia.'],
      ['Anúncios — Texto e CTA', 'Confira o texto principal, título e botão de CTA de cada anúncio.'],
      ['Anúncios — Link de destino', 'Clique no anúncio → verifique se o link do produto está correto.'],
    ].map(([item, desc]) => `
      <div class="flex items-start gap-3">
        <input type="checkbox" class="mt-1 flex-shrink-0 rounded" disabled>
        <div>
          <p class="text-white text-sm font-medium">${item}</p>
          <p class="text-gray-400 text-xs">${desc}</p>
        </div>
      </div>`).join('')}
  </div>

  ${this.h3('Passo 3: Ver a prévia do anúncio')}
  ${this.step(1, 'Vá até o nível de Anúncios', 'Clique na campanha → clique no conjunto → você verá os anúncios.')}
  ${this.step(2, 'Clique nos 3 pontinhos (⋮)', 'Em cada anúncio, clique nos 3 pontos no final da linha.')}
  ${this.step(3, 'Selecione "Visualizar"', 'Clique em <strong>"Visualizar"</strong> para ver como o anúncio vai aparecer no feed do Facebook e Instagram.')}
  ${this.step(4, 'Teste o link', 'Na prévia, clique no botão de CTA (SHOP NOW, etc.) para confirmar que o link leva para a página correta do produto.')}

  ${this.h3('Passo 4: Ativar a campanha')}
  ${this.p('Depois de revisar e estar satisfeito com tudo:')}
  ${this.step(1, 'Ative pelo toggle', 'Na lista de campanhas, o toggle ao lado do nome está cinza (pausado). Clique nele para ficar azul (ativo).')}
  ${this.step(2, 'Ou ative pelo status', 'Clique nos 3 pontinhos da campanha → <strong>"Ativar"</strong>.')}
  ${this.step(3, 'Confirme se necessário', 'Pode aparecer um aviso de confirmação. Clique em <strong>"Continuar"</strong>.')}
  ${this.step(4, 'Verifique o status', 'A campanha deve mostrar <strong>"Ativo"</strong> ou <strong>"Em análise"</strong>. Em análise significa que o Meta está revisando os anúncios (normal, geralmente leva minutos).')}

  ${this.h3('Possíveis status após ativar')}
  <div class="space-y-2 mb-4">
    ${[
      ['Ativo', 'green', 'Campanha rodando normalmente.'],
      ['Em análise', 'blue', 'Meta está revisando os criativos. Normal — espere 5-30 minutos.'],
      ['Reprovado', 'red', 'O criativo foi reprovado pelas políticas do Meta. Veja o motivo e edite o anúncio.'],
      ['Limitado', 'yellow', 'Conta pode ter restrições de veiculação. Verifique no Account Quality.'],
    ].map(([s,c,d]) => `<div class="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">${this.badge(s,c)}<span class="text-gray-300 text-sm">${d}</span></div>`).join('')}
  </div>

  ${this.h3('O que fazer se um anúncio for reprovado')}
  ${this.step(1, 'Veja o motivo da reprovação', 'Clique no anúncio reprovado → procure o aviso em vermelho com o motivo.')}
  ${this.step(2, 'Motivos comuns e soluções', '')}
  <div class="ml-12 space-y-2 mb-4 text-xs">
    ${[
      ['Texto com promessas exageradas', 'Remova superlativos como "melhor do mundo", "100% garantido", "elimina em X dias"'],
      ['Imagem/vídeo com muito texto', 'O Meta limita texto em criativos. Reduza o texto sobreposto no vídeo/imagem'],
      ['Produto restrito (suplementos, saúde)', 'Alguns produtos precisam de aprovação especial. Verifique as políticas de publicidade'],
      ['Link quebrado ou redirecionamento suspeito', 'Verifique se a URL de destino está funcionando e não tem redirecionamentos estranhos'],
    ].map(([m,s]) => `<div class="bg-gray-800/50 rounded p-2 mb-1"><p class="text-red-400 font-medium">${m}</p><p class="text-gray-400 mt-0.5">${s}</p></div>`).join('')}
  </div>
  ${this.step(3, 'Edite o anúncio', 'Clique em editar → corrija o problema → salve. O anúncio vai automaticamente para nova análise.')}

  ${this.tip('Hábito recomendado: Verificar as campanhas lançadas sempre no dia seguinte ao lançamento. Confirme se estão ativas, verifique se os primeiros dados de impressão estão chegando.')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // FIM DAS SEÇÕES DO META
  // ════════════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────────────────
  sInicio() {
    return `
<div>
  ${this.h2('Início Rápido', 'fas fa-rocket')}
  ${this.p('Bem-vindo ao <strong>Meta Ads Control Center</strong> — sua central de comando para gerenciar, automatizar e otimizar campanhas no Meta Ads com ajuda de inteligência artificial.')}
  ${this.ok('Se você está vendo esta tela, a plataforma já está rodando. Parabéns — o mais difícil já passou!')}

  ${this.h3('O que a plataforma faz?')}
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
    ${['📊 Dashboard centralizado com todas as campanhas de todas as contas',
       '🤖 Agente IA que analisa e otimiza automaticamente 24/7',
       '🚀 Lança campanhas completas direto do Google Sheets com 1 clique',
       '📋 Regras automáticas que pausam campanhas ruins sem você olhar',
       '💬 Chat em tempo real com a IA para tirar dúvidas sobre as campanhas',
       '💡 Gera ideias de estratégia personalizadas para o seu negócio'].map(f =>
      `<div class="flex items-start gap-2 bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300">${f}</div>`
    ).join('')}
  </div>

  ${this.h3('Ordem recomendada de configuração')}
  ${this.step(1, 'Verificar pré-requisitos', 'Certifique-se de ter tudo que é necessário antes de começar. <a href="#" @click.prevent="navigate(\'prereqs\')" class="text-purple-400 hover:text-purple-300 underline">Ver pré-requisitos →</a>')}
  ${this.step(2, 'Configurar as chaves de API', 'Adicione a chave da Anthropic (ou OpenAI) para ativar a inteligência artificial. <a href="#" @click.prevent="navigate(\'settings\')" class="text-purple-400 hover:text-purple-300 underline">Como configurar →</a>')}
  ${this.step(3, 'Conectar um Business Manager', 'Adicione seu BM do Meta para que a plataforma possa acessar as campanhas. <a href="#" @click.prevent="navigate(\'bm\')" class="text-purple-400 hover:text-purple-300 underline">Como conectar →</a>')}
  ${this.step(4, 'Adicionar Contas de Anúncio', 'Registre as contas de anúncio (act_XXXXX) que você quer monitorar. <a href="#" @click.prevent="navigate(\'accounts\')" class="text-purple-400 hover:text-purple-300 underline">Como adicionar →</a>')}
  ${this.step(5, 'Importar produtos do Google Sheets', 'Sincronize sua planilha e comece a lançar campanhas com 1 clique. <a href="#" @click.prevent="navigate(\'importar\')" class="text-purple-400 hover:text-purple-300 underline">Como importar →</a>')}
  ${this.step(6, 'Configurar o Gestor IA', 'Ensine a IA sobre o seu negócio e defina o nível de autonomia. <a href="#" @click.prevent="navigate(\'agent\')" class="text-purple-400 hover:text-purple-300 underline">Como configurar →</a>')}
  ${this.step(7, 'Criar regras de automação', 'Configure regras para pausar campanhas ruins automaticamente. <a href="#" @click.prevent="navigate(\'rules\')" class="text-purple-400 hover:text-purple-300 underline">Como criar regras →</a>')}

  ${this.h3('Como iniciar a plataforma')}
  ${this.p('Abra o terminal (Prompt de Comando ou PowerShell) e execute:')}
  ${this.codeBlock('cd C:\\Users\\A1000TO\\Desktop\\Meta-analise\npython start.py')}
  ${this.p('Depois, abra o navegador e acesse: <strong class="text-white">http://localhost:8000</strong>')}
  ${this.tip('Mantenha o terminal aberto enquanto usa a plataforma. Se fechar, a plataforma para.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sPrereqs() {
    return `
<div>
  ${this.h2('Pré-requisitos', 'fas fa-clipboard-check')}
  ${this.p('Antes de começar a usar a plataforma, certifique-se de ter os itens abaixo.')}

  ${this.h3('1. Python 3.10 ou superior')}
  ${this.p('A plataforma roda em Python. Para verificar se você tem:')}
  ${this.codeBlock('python --version\n# Deve mostrar Python 3.10.x ou superior')}
  ${this.p('Se não tiver, baixe em: <span class="text-purple-400">python.org/downloads</span>')}

  ${this.h3('2. Dependências instaladas')}
  ${this.p('Na pasta do projeto, execute uma vez:')}
  ${this.codeBlock('pip install -r requirements.txt')}
  ${this.ok('Isso instala FastAPI, Anthropic, Google API e tudo mais necessário automaticamente.')}

  ${this.h3('3. Chaves e IDs do Meta Ads')}
  <div class="space-y-3 mb-4">
    ${[
      ['Business Manager ID', 'O número de 15 dígitos do seu BM. Encontre em: business.facebook.com → Configurações de Negócios → Info do Negócio'],
      ['Ad Account ID', 'Formato: act_XXXXXXXXXX. Encontre no Gerenciador de Anúncios na URL do navegador'],
      ['Access Token', 'Token de acesso gerado no Explorador da API do Meta (developers.facebook.com/tools/explorer)'],
      ['Page ID', 'ID da Página do Facebook associada às campanhas'],
      ['Pixel ID', 'ID do Pixel de Conversão. Encontre em: Events Manager → Pixels'],
    ].map(([title, desc]) => `
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-white text-sm font-medium">${this.badge(title)}</p>
        <p class="text-gray-400 text-xs mt-1">${desc}</p>
      </div>`).join('')}
  </div>

  ${this.h3('4. Chave da API de IA (Anthropic ou OpenAI)')}
  ${this.p('Para as funcionalidades de inteligência artificial (Gestor IA, Chat, Regras por linguagem natural), você precisa de uma chave de API.')}
  ${this.p('<strong class="text-white">Anthropic (recomendado):</strong> Acesse console.anthropic.com → API Keys → Criar nova chave')}
  ${this.p('<strong class="text-white">OpenAI (alternativo):</strong> Acesse platform.openai.com → API Keys → Create new secret key')}

  ${this.h3('5. Para Importação do Google Sheets (opcional)')}
  ${this.p('Se quiser usar a funcionalidade de importar produtos do Google Sheets e lançar campanhas automaticamente, você também precisa:')}
  ${['Uma conta Google com acesso ao Google Cloud Console',
     'Uma planilha Google Sheets com as abas "Configurações" e "Anúncios" no formato correto',
     'Uma Conta de Serviço do Google Cloud com a Sheets API ativada'].map(item =>
    `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-check-circle text-green-400 mt-0.5 flex-shrink-0"></i>${item}</div>`
  ).join('')}
  ${this.p('<a href="#" @click.prevent="navigate(\'importar\')" class="text-purple-400 hover:text-purple-300 underline">Ver guia completo de configuração do Google Sheets →</a>')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sSettings() {
    return `
<div>
  ${this.h2('Configurar API Keys', 'fas fa-key')}
  ${this.p('As chaves de API conectam a plataforma aos serviços de inteligência artificial. Sem isso, o Gestor IA, o Chat e a criação de Regras por linguagem natural não funcionam.')}

  ${this.h3('Como adicionar a chave da Anthropic')}
  ${this.step(1, 'Acesse as Configurações', 'No menu lateral esquerdo, clique em <strong>Configurações</strong> (ícone de engrenagem, lá no final do menu).')}
  ${this.step(2, 'Vá para a aba Integrações', 'Clique na aba <strong>"Integrações"</strong> dentro da tela de Configurações.')}
  ${this.step(3, 'Cole a chave Anthropic', 'No campo <strong>"Anthropic API Key"</strong>, cole sua chave que começa com <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">sk-ant-...</code>')}
  ${this.step(4, 'Teste a conexão', 'Clique em <strong>"Testar"</strong> ao lado do campo. Deve aparecer uma mensagem verde de sucesso.')}
  ${this.step(5, 'Salve', 'Clique em <strong>"Salvar Configurações"</strong>.')}

  ${this.ok('Com a chave salva, o Gestor IA, o Chat e a criação de Regras por IA ficam totalmente funcionais.')}

  ${this.h3('Onde obter a chave Anthropic')}
  ${this.step(1, 'Acesse console.anthropic.com', 'Faça login na sua conta Anthropic.')}
  ${this.step(2, 'Vá em API Keys', 'No menu lateral, clique em <strong>"API Keys"</strong>.')}
  ${this.step(3, 'Crie uma nova chave', 'Clique em <strong>"Create Key"</strong>, dê um nome (ex: "Meta Ads Platform") e confirme.')}
  ${this.step(4, 'Copie imediatamente', 'A chave só aparece uma vez. Copie e salve em local seguro.')}
  ${this.warn('Nunca compartilhe sua chave de API com ninguém. Ela dá acesso à sua conta e tem custo de uso.')}

  ${this.h3('Outras configurações disponíveis')}
  <div class="space-y-2 mb-4">
    ${[
      ['Moeda', 'Selecione USD (dólar) ou BRL (real) para exibição dos valores'],
      ['Fuso Horário', 'Configure o fuso horário dos seus clientes para os relatórios serem precisos'],
      ['Notificações por Email', 'Adicione seu email para receber alertas de campanhas críticas'],
      ['Webhook do Slack', 'Cole a URL do webhook do Slack para receber alertas no canal da sua equipe'],
    ].map(([title, desc]) => `
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-sm font-medium text-white">${title}</p>
        <p class="text-xs text-gray-400 mt-0.5">${desc}</p>
      </div>`).join('')}
  </div>
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sBm() {
    return `
<div>
  ${this.h2('Business Managers', 'fas fa-building')}
  ${this.p('O Business Manager (BM) é como a plataforma se conecta à sua conta Meta para acessar campanhas. Você precisa adicionar pelo menos um BM para sair do modo demo.')}

  ${this.h3('Como adicionar um Business Manager')}
  ${this.step(1, 'Acesse a página de BMs', 'No menu lateral, clique em <strong>"Business Managers"</strong>.')}
  ${this.step(2, 'Clique em "Adicionar BM"', 'Clique no botão verde <strong>"+ Adicionar BM"</strong> no canto superior direito.')}
  ${this.step(3, 'Preencha o BM ID', 'Cole o ID numérico do seu BM. Exemplo: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">123456789012345</code>')}
  ${this.step(4, 'Dê um nome ao BM', 'Use um nome descritivo. Exemplo: <em>"BM México - Sierra"</em> ou <em>"BM Principal"</em>.')}
  ${this.step(5, 'Cole o Access Token', 'Cole o token de acesso gerado no Explorador da API do Meta.')}
  ${this.step(6, 'Teste a conexão', 'Clique em <strong>"Testar Conexão"</strong>. Deve aparecer um check verde com seu nome no Meta.')}
  ${this.step(7, 'Salve', 'Clique em <strong>"Salvar"</strong>.')}

  ${this.h3('Como obter o BM ID')}
  ${this.step(1, 'Acesse business.facebook.com', 'Faça login na conta Meta Business Suite.')}
  ${this.step(2, 'Vá em Configurações', 'Clique em <strong>"Configurações"</strong> no menu lateral.')}
  ${this.step(3, 'Clique em "Informações do Negócio"', 'O BM ID aparece logo abaixo do nome do negócio. É um número de 15 dígitos.')}

  ${this.h3('Como gerar o Access Token')}
  ${this.step(1, 'Acesse o Explorador da API', 'Vá em: <strong>developers.facebook.com/tools/explorer</strong>')}
  ${this.step(2, 'Selecione seu App', 'No canto superior direito, selecione o App que você criou para este projeto.')}
  ${this.step(3, 'Adicione as permissões', 'Clique em <strong>"Add a Permission"</strong> e adicione as 3 permissões: <br><code class="text-green-400 bg-gray-900 px-1 rounded text-xs">ads_management</code>, <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">ads_read</code>, <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">business_management</code>')}
  ${this.step(4, 'Gere o token', 'Clique em <strong>"Generate Access Token"</strong> e autorize no popup.')}
  ${this.step(5, 'Estenda para 60 dias', 'Por padrão o token dura 1 hora. Clique no ícone de relógio (ℹ) → <strong>"Open in Access Token Tool"</strong> → <strong>"Extend Access Token"</strong>.')}
  ${this.step(6, 'Copie o token longo', 'O token estendido começa com <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">EAAxxxxx...</code> e tem centenas de caracteres.')}

  ${this.warn('O token expira em 60 dias. Você precisa renová-lo antes do prazo. <a href="#" @click.prevent="navigate(\'token\')" class="text-yellow-300 hover:text-white underline">Ver como renovar →</a>')}
  ${this.tip('Se você tiver múltiplos BMs (para clientes diferentes), adicione todos aqui. A plataforma gerencia tudo de forma centralizada.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sAccounts() {
    return `
<div>
  ${this.h2('Contas de Anúncio', 'fas fa-credit-card')}
  ${this.p('As Contas de Anúncio são onde as campanhas realmente vivem. Cada conta tem seu próprio orçamento, pixel e campanhas. Você pode ter quantas quiser cadastradas na plataforma.')}

  ${this.h3('Como adicionar uma Conta de Anúncio')}
  ${this.step(1, 'Acesse Contas de Anúncio', 'No menu lateral, clique em <strong>"Contas de Anúncio"</strong>.')}
  ${this.step(2, 'Clique em "Adicionar Conta"', 'Clique no botão <strong>"+ Adicionar Conta"</strong>.')}
  ${this.step(3, 'Dê um nome descritivo', 'Exemplo: <em>"MX - Barbateadora 2X1"</em> ou <em>"BR - PROD001"</em>. Use o padrão PAÍS - PRODUTO para facilitar.')}
  ${this.step(4, 'Preencha o Account ID', 'O ID deve estar no formato <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">act_XXXXXXXXXX</code>. Não esqueça o "act_" no início!')}
  ${this.step(5, 'Selecione o Business Manager', 'Escolha a qual BM esta conta pertence.')}
  ${this.step(6, 'Selecione o país', 'Escolha o país desta conta (BR, MX, AR, etc.).')}
  ${this.step(7, 'Cole o Access Token', 'Use o mesmo token do BM ou um token específico para esta conta.')}
  ${this.step(8, 'Teste e salve', 'Clique em <strong>"Testar Conexão"</strong> para verificar, depois <strong>"Salvar"</strong>.')}

  ${this.h3('Como encontrar o Account ID')}
  ${this.p('O Account ID fica na URL do Gerenciador de Anúncios:')}
  ${this.codeBlock('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1234567890\n                                                                  ^^^^^^^^^^^^\n                                                                  Este é o Account ID')}
  ${this.p('O ID que você usa na plataforma deve ter o prefixo: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">act_1234567890</code>')}

  ${this.warn('Cada conta de anúncio precisa ter seu próprio token com as permissões corretas. Se a conta pertence a um BM diferente, o token precisa ter acesso a esse BM.')}
  ${this.ok('Com pelo menos uma conta conectada, a plataforma sai do modo demo e começa a mostrar dados reais das suas campanhas.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sToken() {
    return `
<div>
  ${this.h2('Renovar Tokens do Meta', 'fas fa-rotate')}
  ${this.p('O Access Token do Meta dura <strong>60 dias</strong>. Depois disso, todas as integrações param de funcionar. Esta seção explica como renovar antes que isso aconteça.')}

  ${this.danger('Se o token expirar, a plataforma para de sincronizar campanhas, o Gestor IA para de executar e os lançamentos de campanhas falham. Renove sempre antes do dia 55.')}

  ${this.h3('Método 1: Renovar manualmente pelo Explorador da API (recomendado)')}
  ${this.step(1, 'Acesse o Explorador da API', 'Vá em: <strong>developers.facebook.com/tools/explorer</strong>')}
  ${this.step(2, 'Clique em "Generate Access Token"', 'Selecione as mesmas permissões de antes: ads_management, ads_read, business_management.')}
  ${this.step(3, 'Abra a ferramenta de token', 'Clique no ícone de informação (ℹ) ao lado do token gerado → <strong>"Open in Access Token Tool"</strong>.')}
  ${this.step(4, 'Estenda para 60 dias', 'Clique em <strong>"Extend Access Token"</strong>. O novo token dura mais 60 dias a partir de hoje.')}
  ${this.step(5, 'Copie o novo token', 'Copie o token longo gerado.')}
  ${this.step(6, 'Atualize na plataforma', 'Vá em <strong>Business Managers</strong> → Edite o BM correspondente → Cole o novo token → Salve.')}

  ${this.h3('Método 2: Via endpoint da API (avançado)')}
  ${this.p('Você pode renovar programaticamente usando a URL abaixo:')}
  ${this.codeBlock('GET https://graph.facebook.com/v19.0/oauth/access_token\n  ?grant_type=fb_exchange_token\n  &client_id=SEU_APP_ID\n  &client_secret=SEU_APP_SECRET\n  &fb_exchange_token=TOKEN_ATUAL')}
  ${this.p('Cole essa URL no navegador (substituindo os valores) e o retorno terá o novo token.')}

  ${this.h3('Como criar um lembrete para não esquecer')}
  ${this.p('Configure um lembrete no calendário para o dia 50 após a criação do token. Use o título: <em>"Renovar Token Meta Ads"</em>.')}
  ${this.tip('No futuro, você pode criar um workflow no n8n ou usar a função de renovação automática a cada 50 dias para nunca precisar fazer isso manualmente.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sImportar() {
    return `
<div>
  ${this.h2('Importar Produtos do Google Sheets', 'fas fa-file-import')}
  ${this.p('Esta é a funcionalidade mais poderosa da plataforma: você mantém uma planilha Google Sheets com todos os produtos e configurações, e com um clique a plataforma importa tudo e prepara o lançamento das campanhas.')}

  ${this.h3('Parte 1: Preparar o Google Cloud (fazer apenas uma vez)')}
  ${this.step(1, 'Acesse o Google Cloud Console', 'Vá em: <strong>console.cloud.google.com</strong>. Se não tiver projeto, crie um novo com o nome que quiser.')}
  ${this.step(2, 'Ative a Sheets API', 'No menu de busca, procure por <strong>"Google Sheets API"</strong> → clique nela → clique em <strong>"Enable"</strong>.')}
  ${this.step(3, 'Crie uma Conta de Serviço', 'Vá em: <strong>IAM & Admin → Service Accounts → Create Service Account</strong>.<br>Dê um nome (ex: "meta-ads-platform") e clique em <strong>"Create and Continue"</strong>.')}
  ${this.step(4, 'Baixe o arquivo JSON', 'Na lista de contas de serviço, clique na que você criou → aba <strong>"Keys"</strong> → <strong>"Add Key" → "Create new key" → "JSON"</strong>.<br>Um arquivo JSON será baixado. <strong>Guarde com segurança!</strong>')}
  ${this.step(5, 'Anote o e-mail da conta', 'Na lista de contas de serviço, copie o e-mail que termina em <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">...@...iam.gserviceaccount.com</code>. Você vai precisar dele no próximo passo.')}

  ${this.h3('Parte 2: Preparar a Planilha Google Sheets')}
  ${this.step(1, 'Abra ou crie sua planilha', 'A planilha deve ter <strong>duas abas</strong>: uma chamada <strong>"Configurações"</strong> e outra chamada <strong>"Anúncios"</strong> (exatamente assim, com acento).')}
  ${this.step(2, 'Estruture a aba Configurações', 'A primeira linha deve ter os cabeçalhos exatamente assim (sem erros de digitação):')}
  ${this.codeBlock('Config_ID | Ad Account ID | Page ID | Access Token | App ID | App Secret | Pixel ID')}
  ${this.step(3, 'Preencha a aba Configurações', 'Uma linha por conta Meta. O Config_ID é a chave — use algo como <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">CA1_MX</code> ou <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">BR_LOJA1</code>.')}
  ${this.step(4, 'Estruture a aba Anúncios', 'A primeira linha deve ter os cabeçalhos:')}
  ${this.codeBlock('Status | Config_ID | ID_Shopify | Nome_Produto | URL_Destino | Texto_Principal\nTitulo | Descricao | CTA | URLs_Videos | Paises | Idade_Min | Idade_Max\nGenero | Budget_Diario_USD | Horario_Inicio')}
  ${this.step(5, 'Preencha a aba Anúncios', 'Uma linha por produto. Deixe a coluna Status vazia (a plataforma preenche depois).')}
  ${this.step(6, 'Compartilhe com a conta de serviço', 'Clique em <strong>"Compartilhar"</strong> (botão azul no canto superior direito) → Cole o e-mail da conta de serviço (<code class="text-green-400 bg-gray-900 px-1 rounded text-xs">...@...iam.gserviceaccount.com</code>) → <strong>Permissão: Visualizador</strong> → Enviar.')}

  ${this.warn('O campo URLs_Videos aceita múltiplos vídeos. Coloque um link por linha dentro da célula (use Alt+Enter para quebrar linha dentro da célula no Sheets). Cada link = 1 anúncio.')}

  ${this.h3('Parte 3: Configurar na Plataforma')}
  ${this.step(1, 'Acesse Importar Produtos', 'No menu lateral, clique em <strong>"Importar Produtos"</strong> (badge NOVO).')}
  ${this.step(2, 'Copie o ID da planilha', 'Na URL do seu Google Sheets:<br><code class="text-green-400 bg-gray-900 px-1 rounded text-xs">docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit</code><br>Copie apenas a parte do ID.')}
  ${this.step(3, 'Cole o ID no campo', 'No campo <strong>"ID da Planilha"</strong>, cole o ID copiado.')}
  ${this.step(4, 'Cole o JSON da conta de serviço', 'Abra o arquivo JSON que você baixou no Passo 4 da Parte 1 com um editor de texto (Bloco de Notas). Selecione tudo → Copie → Cole no campo <strong>"JSON da Conta de Serviço"</strong>.')}
  ${this.step(5, 'Salve a configuração', 'Clique em <strong>"Salvar Configuração"</strong>. Deve aparecer uma confirmação verde.')}
  ${this.step(6, 'Sincronize', 'Clique em <strong>"Sincronizar Planilha"</strong>. A plataforma vai ler as duas abas e importar tudo.')}
  ${this.step(7, 'Veja os produtos', 'Clique na aba <strong>"Produtos"</strong> para ver todos os produtos importados.')}

  ${this.ok('Pronto! Agora você pode lançar qualquer produto com 1 clique. Veja a próxima seção para entender como lançar.')}

  ${this.h3('Campos da aba Anúncios — Referência Rápida')}
  <div class="overflow-x-auto">
    <table class="w-full text-sm text-left mb-4">
      <thead><tr class="text-gray-400 border-b border-gray-700">
        <th class="pb-2 pr-4">Campo</th><th class="pb-2 pr-4">Exemplo</th><th class="pb-2">Descrição</th>
      </tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['Config_ID', 'CA1_MX', 'Deve bater com a aba Configurações (case sensitive!)'],
          ['Nome_Produto', 'Barb 2X1', 'Nome do produto — vira maiúsculo no nome da campanha'],
          ['Paises', 'MX', 'Código ISO. Múltiplos: MX, AR, CL (separados por vírgula)'],
          ['Budget_Diario_USD', '5.04', 'Orçamento diário em dólares americanos'],
          ['CTA', 'SHOP_NOW', 'SHOP_NOW / BUY_NOW / LEARN_MORE / SIGN_UP / GET_OFFER'],
          ['Genero', 'Todos', 'Todos / M / F'],
          ['Horario_Inicio', '07:00', 'Horário de início no fuso do cliente (HH:MM)'],
          ['URLs_Videos', 'https://drive.google.com/uc?...', 'Um link por linha. Cada link = 1 anúncio criado'],
        ].map(([f, e, d]) => `
          <tr class="border-b border-gray-800">
            <td class="py-2 pr-4 font-mono text-xs text-green-400">${f}</td>
            <td class="py-2 pr-4 text-xs">${e}</td>
            <td class="py-2 text-xs text-gray-400">${d}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sLaunch() {
    return `
<div>
  ${this.h2('Lançar Campanhas com 1 Clique', 'fas fa-rocket')}
  ${this.p('Após importar os produtos do Google Sheets, você pode criar uma campanha completa no Meta Ads (campanha + conjunto + todos os anúncios) com um único clique.')}

  ${this.h3('O que é criado automaticamente?')}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
    ${[
      ['Campanha', 'fas fa-flag', 'Nome automático: [PAÍS] [ABO] [PRODUTO] [DATA]. Objetivo: Conversões (OUTCOME_SALES)'],
      ['Conjunto de Anúncios', 'fas fa-layer-group', 'Nome automático com gênero, idade, país e orçamento. Targeting configurado, pixel conectado'],
      ['Anúncios', 'fas fa-ad', 'Um anúncio por vídeo da planilha. Upload automático, aguarda processamento, cria criativo'],
    ].map(([t, icon, d]) => `
      <div class="bg-gray-800/50 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <i class="${icon} text-purple-400"></i>
          <span class="text-white font-medium text-sm">${t}</span>
        </div>
        <p class="text-gray-400 text-xs leading-relaxed">${d}</p>
      </div>`).join('')}
  </div>

  ${this.ok('Tudo é criado como PAUSADO. Você revisa no Gerenciador de Anúncios do Meta antes de ativar. Segurança garantida!')}

  ${this.h3('Passo a passo para lançar')}
  ${this.step(1, 'Vá para Importar Produtos', 'Menu lateral → <strong>"Importar Produtos"</strong>.')}
  ${this.step(2, 'Clique na aba "Produtos"', 'Você verá a lista de todos os produtos importados da planilha.')}
  ${this.step(3, 'Encontre o produto que quer lançar', 'Use a busca ou os filtros para encontrar o produto. Produtos com status <strong>"Não lançado"</strong> têm o botão verde <strong>"Lançar"</strong>.')}
  ${this.step(4, 'Clique em "Lançar"', 'Um modal de progresso vai abrir mostrando cada etapa em tempo real.')}
  ${this.step(5, 'Acompanhe o progresso', 'O modal mostra: Criando Campanha → Criando Conjunto → Upload de Vídeos → Criando Criativos → Criando Anúncios.')}
  ${this.step(6, 'Aguarde a conclusão', 'Dependendo do número de vídeos, pode levar de 2 a 15 minutos. O modal atualiza automaticamente a cada 3 segundos.')}
  ${this.step(7, 'Revise no Meta', 'Quando aparecer "Campanha lançada com sucesso!", vá ao Gerenciador de Anúncios do Meta para revisar e ativar quando quiser.')}

  ${this.h3('Status dos produtos')}
  <div class="space-y-2 mb-4">
    ${[
      ['Não lançado', 'gray', 'Produto importado mas ainda não lançou. Botão "Lançar" disponível.'],
      ['Lançando...', 'blue', 'Processo em andamento. Não feche o modal — o processo continua em background mesmo se fechar.'],
      ['Lançado', 'green', 'Campanha criada com sucesso. Revise no Meta Ads Manager.'],
      ['Erro', 'red', 'Algo deu errado. O botão "Lançar" volta a aparecer para tentar novamente. Veja o detalhe do erro.'],
    ].map(([s, c, d]) => `
      <div class="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">
        ${this.badge(s, c)}
        <p class="text-gray-300 text-sm">${d}</p>
      </div>`).join('')}
  </div>

  ${this.warn('Se um vídeo do Google Drive tiver problema (formato não suportado, link quebrado), a plataforma pula aquele vídeo e continua com os outros. Você verá isso no Histórico.')}

  ${this.h3('Ver histórico de lançamentos')}
  ${this.p('Na aba <strong>"Histórico"</strong> da página Importar Produtos você vê todos os lançamentos já feitos, com data, status e IDs de campanha criados.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sCampaigns() {
    return `
<div>
  ${this.h2('Gerenciar Campanhas', 'fas fa-layer-group')}
  ${this.p('A página de Campanhas mostra todas as suas campanhas com indicadores de saúde calculados pela IA. É o lugar para monitorar e tomar ações individuais.')}

  ${this.h3('Indicadores de saúde')}
  <div class="space-y-2 mb-5">
    ${[
      ['Crítica', 'red', 'Gastou mais de $10 sem nenhuma conversão. Ação urgente necessária.'],
      ['Atenção', 'yellow', 'ROAS abaixo de 2 ou CPA acima de $50. Monitorar de perto.'],
      ['Saudável', 'green', 'ROAS ≥ 3 ou conversões ≥ 5. Campanha performando bem.'],
      ['Pausada', 'gray', 'Campanha não está rodando.'],
    ].map(([s, c, d]) => `
      <div class="flex items-start gap-3">
        <span class="w-3 h-3 rounded-full mt-1 flex-shrink-0 ${c==='red'?'bg-red-500':c==='yellow'?'bg-yellow-500':c==='green'?'bg-green-500':'bg-gray-500'}"></span>
        <div><span class="text-white text-sm font-medium">${s}:</span> <span class="text-gray-300 text-sm">${d}</span></div>
      </div>`).join('')}
  </div>

  ${this.h3('Ações disponíveis')}
  ${this.step(1, 'Pausar/Ativar campanha individualmente', 'Clique no card da campanha para expandi-lo → clique em <strong>"Pausar"</strong> ou <strong>"Ativar"</strong>.')}
  ${this.step(2, 'Analisar com IA', 'Clique em <strong>"Analisar com IA"</strong> para abrir o Chat com um contexto pré-preenchido sobre aquela campanha.')}
  ${this.step(3, 'Filtrar por saúde', 'Use o filtro de saúde no topo para ver apenas as campanhas Críticas e agir rapidamente.')}
  ${this.step(4, 'Ordenar por métricas', 'Clique nos botões de ordenação para ver as campanhas ordenadas por Gasto, ROAS, CPA, etc.')}

  ${this.tip('Comece sempre pelos filtros "Crítica" e "Atenção". Foque seu tempo e orçamento onde mais importa.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sQuickActions() {
    return `
<div>
  ${this.h2('Ações Rápidas', 'fas fa-bolt')}
  ${this.p('Use esta página quando precisar pausar ou ativar muitas campanhas de uma vez, sem precisar abrir cada uma individualmente.')}

  ${this.h3('Como fazer ações em massa')}
  ${this.step(1, 'Acesse Ações Rápidas', 'Menu lateral → <strong>"Ações Rápidas"</strong>.')}
  ${this.step(2, 'Filtre as campanhas', 'Use a busca ou o filtro de status para encontrar o grupo de campanhas que quer alterar.')}
  ${this.step(3, 'Selecione as campanhas', 'Marque as checkboxes ao lado de cada campanha. Ou clique em <strong>"Selecionar Todas"</strong>.')}
  ${this.step(4, 'Escolha a ação', 'Clique em <strong>"Pausar Selecionados"</strong> ou <strong>"Ativar Selecionados"</strong>.')}
  ${this.step(5, 'Confirme', 'Uma notificação aparecerá confirmando quantas campanhas foram alteradas.')}

  ${this.tip('Caso de uso típico: ao final da semana, pausar todas as campanhas ativas para revisar o desempenho antes de continuar na segunda-feira.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sAgent() {
    return `
<div>
  ${this.h2('Gestor IA — Agente Automático', 'fas fa-robot')}
  ${this.p('O Gestor IA é um agente de inteligência artificial que analisa suas campanhas automaticamente, detecta problemas e toma ações com base no nível de autonomia que você definir.')}

  ${this.warn('Para o Gestor IA funcionar, você precisa ter a chave da Anthropic configurada em Configurações → Integrações.')}

  ${this.h3('Níveis de Autonomia')}
  <div class="space-y-2 mb-5">
    ${[
      ['1', 'Apenas Sugere', 'A IA analisa e sugere o que fazer. Você decide e executa manualmente. Ideal para quem está começando.'],
      ['2', 'Pausa Automática', 'A IA pausa automaticamente campanhas com performance crítica. Você ainda controla orçamentos.'],
      ['3', 'Pausa + Orçamento', 'A IA pausa e ajusta orçamentos de campanhas. Mais poder de otimização.'],
      ['4', 'Controle Total', 'A IA toma todas as decisões: pausa, ativa, redistribui orçamento. Para usuários avançados com total confiança na IA.'],
    ].map(([n, t, d]) => `
      <div class="flex gap-3 bg-gray-800/50 rounded-lg p-3">
        <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${n}</div>
        <div>
          <p class="text-white text-sm font-medium">${t}</p>
          <p class="text-gray-400 text-xs mt-0.5">${d}</p>
        </div>
      </div>`).join('')}
  </div>

  ${this.h3('Como configurar o Gestor IA')}
  ${this.step(1, 'Acesse o Gestor IA', 'Menu lateral → <strong>"Gestor IA"</strong> (ícone de robô, badge IA).')}
  ${this.step(2, 'Defina o nível de autonomia', 'Arraste o slider para o nível desejado. Recomendamos começar com Nível 1 e ir aumentando conforme ganha confiança.')}
  ${this.step(3, 'Configure o intervalo de ciclos', 'Escolha com que frequência a IA analisa: 1h, 2h, 4h, 6h, 12h ou 24h. Começamos com 6h para não sobrecarregar.')}
  ${this.step(4, 'Configure os produtos e metas', 'Vá em <strong>Conhecimento</strong> e adicione seus produtos com as metas de CPA e ROAS. Isso é essencial para a IA saber o que é "bom" ou "ruim" para o seu negócio.')}
  ${this.step(5, 'Execute um ciclo manual', 'Clique em <strong>"Executar Agora"</strong> para ver a IA em ação. Veja as sugestões e decisões no Feed.')}
  ${this.step(6, 'Acompanhe o Feed', 'A aba <strong>"Feed de Ações"</strong> mostra cada decisão tomada, com o motivo. A aba <strong>"Histórico"</strong> mostra todos os ciclos executados.')}

  ${this.tip('Comece com Nível 1 por pelo menos 1 semana. Veja as sugestões da IA, compare com o que você faria, e aumente o nível quando confiar nas decisões.')}

  ${this.h3('O que acontece em cada ciclo')}
  ${this.p('Quando um ciclo executa (manual ou automático):')}
  ${['1. A IA busca todas as campanhas e suas métricas', '2. Analisa contra as metas dos seus produtos (CPA, ROAS)', '3. Consulta a base de conhecimento para contexto do negócio', '4. Gera análise completa: insights, alertas, ações', '5. Executa as ações (se autonomia >= 2)', '6. Salva tudo no histórico para auditoria'].map(item =>
    `<div class="flex items-start gap-2 text-sm text-gray-300 mb-1.5"><i class="fas fa-arrow-right text-purple-400 mt-1 flex-shrink-0 text-xs"></i>${item}</div>`
  ).join('')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sKnowledge() {
    return `
<div>
  ${this.h2('Base de Conhecimento', 'fas fa-brain')}
  ${this.p('A Base de Conhecimento é onde você ensina a IA sobre o seu negócio. Quanto mais informações você fornecer, mais precisa e relevante será a análise do Gestor IA.')}

  ${this.h3('Aba 1: Produtos & Metas')}
  ${this.p('Registre seus produtos com as metas de performance. A IA usa esses dados para saber o que é uma campanha boa ou ruim para o seu negócio específico.')}

  ${this.step(1, 'Acesse Conhecimento', 'Menu lateral → <strong>"Conhecimento"</strong>.')}
  ${this.step(2, 'Clique em "Adicionar Produto"', 'Na aba <strong>"Produtos & Metas"</strong>, clique no botão verde.')}
  ${this.step(3, 'Preencha as informações', `
    <div class="mt-2 space-y-1.5">
      ${[
        ['Nome do Produto', 'PROD001 ou "Barbadora 2X1 MX" — como você quer identificar'],
        ['Meta de CPA ($)', 'Quanto no máximo você quer pagar por conversão. Ex: 27.00'],
        ['Meta de ROAS', 'Retorno mínimo esperado. Ex: 3.2 (significa $3.20 de retorno por $1 investido)'],
        ['Ticket Médio ($)', 'Valor médio de cada venda. Ajuda a calcular ROAS real'],
        ['Países', 'BR, MX, AR — onde este produto roda'],
        ['Notas Estratégicas', 'Qualquer contexto relevante: sazonalidade, público, o que já funcionou'],
      ].map(([f, d]) => `<div class="bg-gray-900/50 rounded p-2"><span class="text-green-400 text-xs font-mono">${f}:</span> <span class="text-gray-400 text-xs">${d}</span></div>`).join('')}
    </div>`)}
  ${this.step(4, 'Salve', 'Clique em <strong>"Salvar Produto"</strong>.')}

  ${this.h3('Aba 2: Base de Conhecimento')}
  ${this.p('Adicione informações textuais que a IA deve levar em conta ao analisar suas campanhas.')}

  ${this.step(1, 'Escolha uma categoria', 'Clique em um dos botões de categoria para começar com um template:')}
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
    ${[
      ['Mercado', 'Contexto do seu nicho de mercado'],
      ['Público', 'Quem compra seus produtos'],
      ['Criativos', 'Que tipo de criativo funciona'],
      ['Estratégia', 'Abordagens de campanha que funcionam'],
    ].map(([c, d]) => `<div class="bg-gray-800 rounded p-2"><p class="text-white font-medium">${c}</p><p class="text-gray-500 mt-0.5">${d}</p></div>`).join('')}
  </div>
  ${this.step(2, 'Edite o conteúdo', 'Substitua o texto do template com suas informações reais e específicas.')}
  ${this.step(3, 'Salve', 'Clique em <strong>"Adicionar"</strong>.')}

  ${this.h3('Aba 3: Preview do Prompt')}
  ${this.p('Esta aba mostra exatamente o que a IA "lê" antes de analisar suas campanhas. Use para verificar se as informações estão sendo capturadas corretamente.')}

  ${this.tip('Exemplo de boa entrada na base de conhecimento: <em>"Produto principal: Barbadora 2X1. Público: homens 25-45 anos. CPA meta: $15. Melhor horário: 19h-23h. Criativos UGC performam 40% melhor. Evitar sábado/domingo para o México."</em>')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sChat() {
    return `
<div>
  ${this.h2('Chat com a IA', 'fas fa-comments')}
  ${this.p('O Chat é um assistente de IA em tempo real que conhece todas as suas campanhas e pode responder perguntas, analisar problemas e sugerir otimizações.')}

  ${this.warn('O Chat usa a Anthropic API. Certifique-se de ter a chave configurada em Configurações → Integrações.')}

  ${this.h3('Como usar o Chat')}
  ${this.step(1, 'Acesse o Chat', 'Menu lateral → <strong>"Conversar"</strong>.')}
  ${this.step(2, 'Digite sua pergunta', 'Use linguagem natural, em português. Seja específico para obter respostas melhores.')}
  ${this.step(3, 'Envie', 'Pressione Enter ou clique no botão de enviar.')}
  ${this.step(4, 'Leia a análise', 'A IA responde com análise baseada nos dados reais das suas campanhas.')}

  ${this.h3('Exemplos de perguntas que você pode fazer')}
  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
    ${[
      '"Qual campanha está com pior desempenho hoje?"',
      '"Por que o CPA está alto no México esta semana?"',
      '"Quais campanhas posso pausar sem perder muito resultado?"',
      '"Como posso melhorar o ROAS do produto PROD001?"',
      '"Qual país está trazendo melhor retorno?"',
      '"O que fazer com campanhas que gastaram mais de $10 sem venda?"',
    ].map(q => `<div class="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 italic">${q}</div>`).join('')}
  </div>

  ${this.tip('Para análises mais precisas, configure bem a Base de Conhecimento com os dados do seu negócio. A IA usa essas informações para contextualizar as respostas.')}

  ${this.h3('Análise de campanha específica')}
  ${this.p('Na página de Campanhas, você pode clicar em <strong>"Analisar com IA"</strong> em qualquer campanha. Isso abre o Chat com um contexto pré-preenchido sobre aquela campanha específica, economizando tempo.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sIdeas() {
    return `
<div>
  ${this.h2('Ideias & Estratégias', 'fas fa-lightbulb')}
  ${this.p('A página de Ideias mostra sugestões geradas pela IA para melhorar suas campanhas. A IA cria ideias baseadas nas suas métricas, produtos e base de conhecimento.')}

  ${this.h3('Como gerar novas ideias')}
  ${this.step(1, 'Acesse Ideias & Estratégias', 'Menu lateral → <strong>"Ideias & Estratégias"</strong>.')}
  ${this.step(2, 'Clique em "Gerar Ideias"', 'A IA analisa o estado atual das campanhas e gera sugestões personalizadas.')}
  ${this.step(3, 'Revise as ideias', 'Cada ideia tem: título, descrição detalhada, por que funciona e nível de impacto (baixo/médio/alto).')}

  ${this.h3('Gerenciar ideias')}
  <div class="space-y-2 mb-4">
    ${[
      ['Nova', 'gray', 'Ideia recém-gerada, ainda não avaliada.'],
      ['Em Andamento', 'blue', 'Você está implementando esta estratégia.'],
      ['Implementada', 'green', 'Estratégia colocada em prática.'],
      ['Rejeitada', 'red', 'Estratégia descartada para este momento.'],
    ].map(([s, c, d]) => `<div class="flex items-center gap-3">${this.badge(s, c)}<span class="text-gray-300 text-sm">${d}</span></div>`).join('')}
  </div>
  ${this.p('Clique no status de uma ideia para alterá-lo. Você também pode deletar ideias que não fazem sentido para o seu negócio.')}

  ${this.tip('Use as ideias como checklist semanal. Reserve 30 minutos toda segunda-feira para revisar as ideias geradas e implementar pelo menos uma.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sRules() {
    return `
<div>
  ${this.h2('Regras de Automação', 'fas fa-shield-halved')}
  ${this.p('As Regras são automações que monitoram suas campanhas 24/7 e tomam ações automaticamente quando determinadas condições são atingidas — sem você precisar verificar manualmente.')}

  ${this.h3('Como criar uma regra')}
  ${this.step(1, 'Acesse Regras', 'Menu lateral → <strong>"Regras"</strong>.')}
  ${this.step(2, 'Clique em "Nova Regra"', 'Clique no botão <strong>"+ Nova Regra"</strong>.')}
  ${this.step(3, 'Dê um nome à regra', 'Use um nome descritivo. Exemplo: <em>"$5 Sem Venda — Pausar"</em>.')}
  ${this.step(4, 'Escolha a ação', 'O que deve acontecer quando as condições forem cumpridas:')}
  <div class="grid grid-cols-2 gap-2 mb-4 text-xs">
    ${[
      ['Pausar Campanha', 'Pausa automaticamente'],
      ['Apenas Notificar', 'Cria um alerta para você ver'],
      ['Reduzir Orçamento', 'Diminui o budget diário'],
      ['Ativar Campanha', 'Ativa uma campanha pausada'],
    ].map(([a, d]) => `<div class="bg-gray-800 rounded p-2"><p class="text-white font-medium">${a}</p><p class="text-gray-500">${d}</p></div>`).join('')}
  </div>
  ${this.step(5, 'Adicione as condições', 'Uma regra pode ter múltiplas condições (todas precisam ser verdadeiras para a ação executar):')}
  <div class="overflow-x-auto mb-3">
    <table class="w-full text-xs text-left">
      <thead><tr class="text-gray-400 border-b border-gray-700"><th class="pb-2 pr-3">Métrica</th><th class="pb-2">O que verifica</th></tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['spend ($)', 'Total gasto hoje'],
          ['spend_pct (%)', '% do orçamento diário já gasto'],
          ['conversions', 'Número de conversões hoje'],
          ['roas', 'Retorno sobre investimento (3.0 = 300%)'],
          ['cpa ($)', 'Custo por conversão'],
          ['ctr (%)', 'Taxa de cliques'],
          ['running_hours', 'Há quantas horas a campanha está rodando'],
        ].map(([m, d]) => `<tr class="border-b border-gray-800"><td class="py-1.5 pr-3 font-mono text-green-400">${m}</td><td class="py-1.5">${d}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${this.step(6, 'Salve e ative', 'Clique em <strong>"Salvar Regra"</strong>. Certifique-se de que o toggle da regra está <strong>ativado</strong> (verde).')}

  ${this.h3('Criar regra com linguagem natural (IA)')}
  ${this.step(1, 'Clique em "Criar com IA"', 'Abre um modal com campo de texto livre.')}
  ${this.step(2, 'Descreva a regra em português', 'Exemplo: <em>"Pausar se gastar $5 sem nenhuma conversão"</em> ou <em>"Alertar quando ROAS ficar abaixo de 2 por mais de 3 horas"</em>.')}
  ${this.step(3, 'A IA converte automaticamente', 'Clique em <strong>"Converter"</strong>. A IA interpreta e preenche o formulário com as condições corretas.')}
  ${this.step(4, 'Revise e confirme', 'Verifique se o resultado faz sentido e clique em <strong>"Usar esta Regra"</strong>.')}

  ${this.h3('Executar o motor de regras')}
  ${this.p('Clique em <strong>"Executar Agora"</strong> para checar todas as regras contra todas as campanhas imediatamente. O resultado mostra quantas regras foram verificadas e quantas ações foram tomadas.')}

  ${this.h3('Regras recomendadas para começar')}
  ${this.codeBlock('Regra 1: Gasto sem conversão\n  SE: spend >= 5 E conversions == 0\n  AÇÃO: Pausar\n\nRegra 2: Budget sem checkout\n  SE: spend_pct >= 50 E conversions == 0\n  AÇÃO: Notificar\n\nRegra 3: ROAS muito baixo\n  SE: roas < 1.5 E running_hours >= 12\n  AÇÃO: Pausar')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sAlerts() {
    return `
<div>
  ${this.h2('Alertas', 'fas fa-bell')}
  ${this.p('Os Alertas são notificações automáticas geradas quando uma Regra de Automação é acionada. Eles aparecem no menu lateral com um número mostrando quantos estão ativos.')}

  ${this.h3('Severidade dos alertas')}
  <div class="space-y-2 mb-4">
    ${[
      ['Urgente (Crítico)', 'red', 'Requer ação imediata. Ex: campanha gastando sem nenhuma conversão.'],
      ['Atenção (Warning)', 'yellow', 'Monitorar de perto. Ex: ROAS abaixo da meta.'],
      ['Info', 'blue', 'Informativo. Ex: campanha pausada automaticamente por regra.'],
    ].map(([s, c, d]) => `<div class="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3">${this.badge(s,c)}<span class="text-gray-300 text-sm">${d}</span></div>`).join('')}
  </div>

  ${this.h3('O que fazer com um alerta')}
  ${this.step(1, 'Acesse Alertas', 'Menu lateral → <strong>"Alertas"</strong>. Você verá o número de alertas ativos.')}
  ${this.step(2, 'Filtre por urgência', 'Use o filtro para ver primeiro os alertas <strong>"Urgente"</strong>.')}
  ${this.step(3, 'Avalie cada alerta', 'Veja qual campanha disparou, qual regra foi acionada e as métricas atuais.')}
  ${this.step(4, 'Tome uma ação', 'Clique em <strong>"Pausar Campanha"</strong> se concordar com a recomendação, ou <strong>"Ignorar"</strong> se não for necessário agir.')}

  ${this.tip('Alertas são gerados automaticamente pelas Regras. Para receber alertas, você precisa ter ao menos uma Regra ativa com ação "Notificar".')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sDashboard() {
    return `
<div>
  ${this.h2('Dashboard', 'fas fa-chart-pie')}
  ${this.p('O Dashboard é a tela principal. Ele agrega os dados de todas as suas contas em um único painel com gráficos e métricas atualizados.')}

  ${this.h3('Métricas exibidas')}
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
    ${[
      ['Total Investido', 'Soma de gasto em todas as contas no período'],
      ['Conversões', 'Total de compras registradas pelo Pixel'],
      ['ROAS Médio', 'Retorno médio sobre investimento'],
      ['Alertas Ativos', 'Quantas campanhas precisam de atenção'],
    ].map(([m, d]) => `<div class="bg-gray-800/50 rounded-lg p-3 text-center"><p class="text-white text-sm font-medium">${m}</p><p class="text-gray-500 text-xs mt-1">${d}</p></div>`).join('')}
  </div>

  ${this.h3('Como interpretar os gráficos')}
  ${this.p('<strong class="text-white">Gráfico de Investimento Diário:</strong> Linha que mostra quanto você gastou por dia. Quedas bruscas = algo foi pausado. Subidas = orçamento aumentado.')}
  ${this.p('<strong class="text-white">Gráfico de Conversões Diárias:</strong> Barras mostrando vendas por dia. Compare com o gráfico de investimento — se investimento sobe mas conversões caem, atenção!')}
  ${this.p('<strong class="text-white">Performance por Conta/Produto/País:</strong> Barras comparativas. Mostra onde está o melhor e pior desempenho.')}
  ${this.p('<strong class="text-white">Distribuição Geográfica:</strong> Pizza mostrando onde o orçamento está concentrado.')}

  ${this.h3('Filtros do Dashboard')}
  ${this.step(1, 'Ver por conta/produto/país', 'Use o seletor <strong>"Ver por"</strong> para mudar a perspectiva dos gráficos.')}
  ${this.step(2, 'Mudar período', 'Clique em 7, 14 ou 30 dias para ver o histórico.')}
  ${this.step(3, 'Atualizar dados', 'Clique no botão de atualizar para buscar dados mais recentes da API do Meta.')}

  ${this.tip('O Dashboard em modo demo (sem contas reais) mostra dados fictícios para você explorar a interface. Assim que conectar uma conta real, os dados reais aparecem automaticamente.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sAnalysis() {
    return `
<div>
  ${this.h2('Análise Profunda', 'fas fa-magnifying-glass-chart')}
  ${this.p('A Análise Profunda oferece visualizações avançadas dos últimos 30 dias, com breakdown por produto, país e campanha.')}

  ${this.h3('O que você encontra aqui')}
  ${['Séries temporais completas de 30 dias de investimento, conversões e ROAS',
     'Performance detalhada por produto (qual produto traz mais resultado)',
     'Comparativo entre campanhas: as top performers e as problemáticas',
     'Resumo consolidado: total investido, total de conversões, ROAS médio'].map(item =>
    `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-chart-bar text-purple-400 mt-1 flex-shrink-0 text-xs"></i>${item}</div>`
  ).join('')}

  ${this.tip('Use esta página ao final de cada semana para ter uma visão completa do desempenho e preparar sua estratégia para a próxima semana.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sReports() {
    return `
<div>
  ${this.h2('Relatórios', 'fas fa-file-chart-column')}
  ${this.p('Gere relatórios personalizados para compartilhar com clientes ou para uso interno.')}

  ${this.h3('Como gerar um relatório')}
  ${this.step(1, 'Acesse Relatórios', 'Menu lateral → <strong>"Relatórios"</strong>.')}
  ${this.step(2, 'Escolha o tipo', 'Por Conta, Por Produto ou Por País.')}
  ${this.step(3, 'Selecione o período', 'Últimos 7, 14 ou 30 dias.')}
  ${this.step(4, 'Escolha as métricas', 'Marque as métricas que quer incluir: Investimento, Conversões, CPA, ROAS, CTR, Impressões, Cliques.')}
  ${this.step(5, 'Gere a prévia', 'Clique em <strong>"Gerar Relatório"</strong> para ver o gráfico.')}
  ${this.step(6, 'Exporte', 'Clique em <strong>"Exportar PDF"</strong> ou <strong>"Exportar Excel"</strong> conforme sua necessidade.')}
  ${this.step(7, 'Envie por e-mail (opcional)', 'Digite o e-mail do cliente e clique em <strong>"Enviar por E-mail"</strong>.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sProducts() {
    return `
<div>
  ${this.h2('Produtos — Performance', 'fas fa-box')}
  ${this.p('A página de Produtos (na seção Gestão) mostra o desempenho histórico por produto ou SKU. É diferente da página de Conhecimento — aqui você vê métricas, não configurações.')}

  ${this.h3('O que você vê aqui')}
  ${this.p('Um gráfico de barras comparando todos os produtos em termos de investimento, conversões e ROAS. Abaixo, uma tabela com as métricas detalhadas por produto.')}

  ${this.tip('Use esta página para identificar qual produto tem o melhor ROI e merece mais investimento, e qual está drenando orçamento sem retorno.')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // GOOGLE SHEETS
  // ════════════════════════════════════════════════════════════════════════

  sSheetsCreate() {
    return `
<div>
  ${this.h2('Criar a Planilha Google Sheets', 'fas fa-table')}
  ${this.p('A planilha é o coração da automação. É onde você cadastra os produtos, as configurações de cada conta Meta e os vídeos que serão usados nos anúncios. Uma planilha bem estruturada garante lançamentos sem erros.')}

  ${this.h3('Criar a planilha do zero')}
  ${this.step(1, 'Acesse o Google Sheets', 'Vá em: <strong>sheets.google.com</strong> → Faça login com a conta Google que tem acesso ao Google Cloud.')}
  ${this.step(2, 'Crie uma nova planilha', 'Clique no botão <strong>"+"</strong> (Em branco) ou acesse: <strong>sheets.new</strong>')}
  ${this.step(3, 'Renomeie a planilha', 'Clique em "Planilha sem título" no topo e dê um nome. Ex: <em>"Meta Ads Automation"</em> ou <em>"Gestão de Campanhas"</em>.')}
  ${this.step(4, 'Crie a aba Configurações', 'Clique no "+" no rodapé para adicionar uma aba. Dê duplo-clique no nome e renomeie para <strong>Configurações</strong> (exatamente assim, com acento).')}
  ${this.step(5, 'Crie a aba Anúncios', 'Clique em "+" novamente e renomeie para <strong>Anúncios</strong> (com acento).')}
  ${this.step(6, 'Opcional: aba Países', 'Você pode criar uma terceira aba chamada <strong>Países</strong> com os códigos ISO para referência. Não é obrigatória.')}

  ${this.ok('Planilha criada! Agora você precisa estruturar as duas abas com os cabeçalhos corretos. Continue nas próximas seções.')}

  ${this.h3('Como copiar o ID da planilha')}
  ${this.p('Você vai precisar do ID da planilha para configurar a plataforma e o n8n. O ID fica na URL:')}
  ${this.codeBlock('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit\n                                        ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑\n                                        Este é o Spreadsheet ID (copie apenas esta parte)')}

  ${this.h3('Permissões da planilha')}
  ${this.p('A planilha não precisa ser pública. Você vai compartilhá-la apenas com a conta de serviço do Google Cloud (que age como um "robô" autorizado).')}
  ${this.tip('Se quiser ter mais de uma pessoa editando a planilha (ex: você e um assistente), adicione os emails diretamente no compartilhamento do Sheets. A conta de serviço só precisa de acesso de Visualizador.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sSheetsConfigTab() {
    return `
<div>
  ${this.h2('Preencher a Aba Configurações', 'fas fa-sliders')}
  ${this.p('A aba <strong>Configurações</strong> guarda as credenciais de cada conta Meta. Uma linha por conta. O campo <strong>Config_ID</strong> é a chave que liga esta aba à aba Anúncios.')}

  ${this.h3('Cabeçalhos (linha 1 — exatamente assim)')}
  ${this.codeBlock('Config_ID | País/Conta | Ad Account ID | Page ID | Access Token | App ID | App Secret | Pixel ID')}
  ${this.warn('Os nomes dos cabeçalhos são case-sensitive. Escreva exatamente como mostrado, com underscore e maiúsculas corretas.')}

  ${this.h3('Como preencher cada coluna')}
  <div class="overflow-x-auto">
    <table class="w-full text-xs text-left mb-5">
      <thead><tr class="text-gray-400 border-b border-gray-700">
        <th class="pb-2 pr-3">Coluna</th><th class="pb-2 pr-3">Exemplo</th><th class="pb-2">Como obter</th>
      </tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['Config_ID', 'CA1_MX', 'Você cria. Use letras e números, sem espaços. Ex: CA1_MX (conta 1 México), BR_LOJA (loja Brasil)'],
          ['País/Conta', 'México - Sierra', 'Descrição livre para você se identificar. Não é usada pela automação'],
          ['Ad Account ID', 'act_1234567890', 'Gerenciador de Anúncios → URL do navegador → número após "act="'],
          ['Page ID', '102345678901234', 'Página Facebook → Sobre → role até o final da página'],
          ['Access Token', 'EAAxxxxx...', 'developers.facebook.com/tools/explorer → gerar token de 60 dias'],
          ['App ID', '987654321', 'developers.facebook.com → seu App → Configurações → Básico'],
          ['App Secret', 'abc123def456...', 'developers.facebook.com → seu App → Configurações → Básico → Mostrar'],
          ['Pixel ID', '111222333444555', 'business.facebook.com/events_manager → selecione o Pixel → ID'],
        ].map(([c,e,d]) => `
          <tr class="border-b border-gray-800">
            <td class="py-2 pr-3 font-mono text-green-400 font-medium">${c}</td>
            <td class="py-2 pr-3 text-gray-300">${e}</td>
            <td class="py-2 text-gray-500">${d}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  ${this.h3('Exemplo de linha preenchida')}
  ${this.codeBlock('Config_ID   | País/Conta        | Ad Account ID  | Page ID          | Access Token | App ID      | App Secret | Pixel ID\nCA1_MX      | México - Sierra   | act_9876543210 | 102345678901234  | EAAxxxxx...  | 98765432101 | abc123...  | 111222333\nBR_LOJA1    | Brasil - Loja     | act_1234567890 | 987654321098765  | EAAyyyyy...  | 98765432101 | abc123...  | 444555666')}

  ${this.tip('Se você usa o mesmo App para todas as contas (recomendado), o App ID e App Secret são iguais em todas as linhas. Só o Access Token, Ad Account ID, Page ID e Pixel ID mudam por conta.')}
  ${this.warn('O Access Token fica visível na planilha. Nunca compartilhe a planilha com pessoas que não deveriam ter acesso às suas contas Meta. Revogue o acesso de pessoas que saírem da equipe.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sSheetsAdsTab() {
    return `
<div>
  ${this.h2('Preencher a Aba Anúncios', 'fas fa-film')}
  ${this.p('A aba <strong>Anúncios</strong> é onde você cadastra cada produto que quer anunciar. Uma linha por produto. Quando a plataforma ou o n8n detecta uma linha com Status vazio, ela é processada e a campanha é criada.')}

  ${this.h3('Cabeçalhos (linha 1 — exatamente assim)')}
  ${this.codeBlock('Status | Config_ID | ID_Shopify | Nome_Produto | URL_Destino | Texto_Principal | Titulo | Descricao | CTA | URLs_Videos | Paises | Idade_Min | Idade_Max | Genero | Budget_Diario_USD | Horario_Inicio | Nome_Campanha | Data_Processamento | ID_Campanha | ID_Conjunto | IDs_Anuncios | Detalhes_Erro')}

  ${this.h3('Campos que VOCÊ preenche (ao cadastrar um produto novo)')}
  <div class="overflow-x-auto mb-5">
    <table class="w-full text-xs text-left">
      <thead><tr class="text-gray-400 border-b border-gray-700">
        <th class="pb-2 pr-3">Campo</th><th class="pb-2 pr-3">Exemplo</th><th class="pb-2">Dicas</th>
      </tr></thead>
      <tbody class="text-gray-300">
        ${[
          ['Status', '(deixe vazio)', 'IMPORTANTE: deixe em branco. A automação preenche "Processando", "Concluída" ou "Erro"'],
          ['Config_ID', 'CA1_MX', 'Deve ser idêntico ao Config_ID da aba Configurações. É case-sensitive!'],
          ['ID_Shopify', '9534683644184', 'Opcional. ID do produto no Shopify. Aparece no nome da campanha se preenchido'],
          ['Nome_Produto', 'Barb 2X1', 'Nome curto do produto. Vira MAIÚSCULO no nome da campanha automaticamente'],
          ['URL_Destino', 'https://loja.com/products/...', 'Link completo do produto onde o cliente vai após clicar no anúncio'],
          ['Texto_Principal', 'Esta es la mejor barbadora...', 'Texto que aparece acima do vídeo. Máx 125 caracteres recomendado'],
          ['Titulo', 'SOLO HOY: Compra 1 lleva 2', 'Headline em negrito. Máx 40 caracteres para não cortar'],
          ['Descricao', 'Aprobado por 13.413 clientes', 'Texto menor abaixo do título. Máx 30 caracteres'],
          ['CTA', 'SHOP_NOW', 'SHOP_NOW / BUY_NOW / LEARN_MORE / SIGN_UP / GET_OFFER / BOOK_NOW'],
          ['URLs_Videos', 'https://drive.google.com/...', 'Um link por linha (Alt+Enter). Cada link = 1 anúncio criado'],
          ['Paises', 'MX', 'Código ISO de 2 letras. Múltiplos separados por vírgula: MX, AR, CL'],
          ['Idade_Min', '18', 'Número inteiro. Mínimo: 18'],
          ['Idade_Max', '65', 'Número inteiro. Máximo: 65'],
          ['Genero', 'Todos', 'Todos / M / F (ou: Homens / Mulheres / ALL)'],
          ['Budget_Diario_USD', '5.04', 'Orçamento em dólares. Use ponto para decimal'],
          ['Horario_Inicio', '07:00', 'Horário de início da campanha no fuso do cliente. Formato: HH:MM'],
        ].map(([c,e,d]) => `
          <tr class="border-b border-gray-800">
            <td class="py-2 pr-3 font-mono text-green-400">${c}</td>
            <td class="py-2 pr-3 text-gray-300">${e}</td>
            <td class="py-2 text-gray-500">${d}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  ${this.h3('Campos preenchidos automaticamente (deixe em branco)')}
  <div class="grid grid-cols-2 gap-2 mb-5 text-xs">
    ${['Nome_Campanha','Data_Processamento','ID_Campanha','ID_Conjunto','IDs_Anuncios','Detalhes_Erro'].map(f =>
      `<div class="bg-gray-800/50 rounded p-2"><span class="font-mono text-yellow-400">${f}</span><p class="text-gray-500 mt-0.5">Preenchido pela automação</p></div>`
    ).join('')}
  </div>

  ${this.h3('Como adicionar múltiplos países')}
  ${this.p('Na coluna Paises, separe os códigos por vírgula: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">MX, AR, CL</code>')}
  ${this.p('A campanha será segmentada para todos esses países simultaneamente dentro de um único conjunto de anúncios.')}

  ${this.h3('Códigos ISO dos países principais')}
  <div class="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs mb-4">
    ${[['BR','Brasil'],['MX','México'],['AR','Argentina'],['CL','Chile'],['CO','Colômbia'],['PE','Peru'],['EC','Equador'],['UY','Uruguai'],['PY','Paraguai'],['BO','Bolívia'],['US','Estados Unidos'],['ES','Espanha'],['PT','Portugal'],['VE','Venezuela'],['PA','Panamá']].map(([c,n]) =>
      `<div class="bg-gray-800/50 rounded p-2 text-center"><span class="text-white font-bold">${c}</span><p class="text-gray-500">${n}</p></div>`
    ).join('')}
  </div>
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sSheetsVideos() {
    return `
<div>
  ${this.h2('Links de Vídeo do Google Drive', 'fab fa-google-drive')}
  ${this.p('Os vídeos dos anúncios ficam no Google Drive e são referenciados na planilha. A plataforma e o n8n fazem o upload para o Meta automaticamente usando esses links.')}

  ${this.h3('Passo 1: Fazer upload do vídeo no Drive')}
  ${this.step(1, 'Acesse o Google Drive', 'Vá em: <strong>drive.google.com</strong> → faça login.')}
  ${this.step(2, 'Crie uma pasta organizada', 'Recomendado: crie pastas por produto. Ex: <em>"Meta Ads / Sierra / Videos"</em>. Facilita o gerenciamento.')}
  ${this.step(3, 'Faça o upload do vídeo', 'Clique em <strong>"+ Novo"</strong> → <strong>"Upload de arquivo"</strong> → selecione o vídeo.')}
  ${this.step(4, 'Aguarde o processamento', 'O Drive pode levar de segundos a minutos para processar vídeos maiores. Aguarde até aparecer a prévia.')}

  ${this.h3('Passo 2: Obter o link correto do vídeo')}
  ${this.warn('O link de compartilhamento padrão do Drive NÃO funciona diretamente para upload no Meta. Você precisa do link de download direto.')}
  ${this.step(1, 'Clique com botão direito no vídeo', 'No Google Drive, clique com o botão direito no arquivo de vídeo.')}
  ${this.step(2, 'Clique em "Compartilhar"', 'Depois em <strong>"Gerenciar acesso"</strong>.')}
  ${this.step(3, 'Defina o acesso como "Qualquer pessoa com o link"', 'No dropdown de permissões, selecione <strong>"Qualquer pessoa com o link"</strong> → permissão <strong>"Visualizador"</strong>.')}
  ${this.step(4, 'Copie o link de compartilhamento', 'Clique em <strong>"Copiar link"</strong>. O link tem este formato:')}
  ${this.codeBlock('https://drive.google.com/file/d/1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef/view?usp=sharing')}
  ${this.step(5, 'Converta para link de download direto', 'Substitua o final do link conforme abaixo:')}
  ${this.codeBlock('LINK ORIGINAL:\nhttps://drive.google.com/file/d/1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef/view?usp=sharing\n\nLINK PARA USAR NA PLANILHA:\nhttps://drive.google.com/uc?export=download&id=1ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef\n                                                   ↑ ID do arquivo (entre /d/ e /view)')}
  ${this.ok('Use sempre o formato <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">drive.google.com/uc?export=download&id=ID_DO_ARQUIVO</code> na planilha.')}

  ${this.h3('Como adicionar múltiplos vídeos na mesma célula')}
  ${this.p('Cada linha da célula URLs_Videos representa um vídeo diferente → um anúncio diferente. Para adicionar múltiplos:')}
  ${this.step(1, 'Clique na célula da coluna URLs_Videos', '')}
  ${this.step(2, 'Cole o primeiro link de vídeo', '')}
  ${this.step(3, 'Para adicionar o segundo', 'Pressione <strong>Alt + Enter</strong> (Windows) ou <strong>Ctrl + Enter</strong> (alguns sistemas). Isso quebra a linha dentro da célula.')}
  ${this.step(4, 'Cole o segundo link', 'O segundo link fica na linha abaixo dentro da mesma célula.')}
  ${this.step(5, 'Repita', 'Para cada vídeo adicional. Uma célula pode ter quantos links quiser.')}
  ${this.codeBlock('Exemplo da célula URLs_Videos com 3 vídeos:\nhttps://drive.google.com/uc?export=download&id=1AAA...\nhttps://drive.google.com/uc?export=download&id=1BBB...\nhttps://drive.google.com/uc?export=download&id=1CCC...')}

  ${this.h3('Formatos de vídeo aceitos pelo Meta')}
  <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-4">
    ${[['MP4','Recomendado — melhor compatibilidade'],['MOV','Aceito — gerado por iPhone/Mac'],['AVI','Aceito'],['MKV','Aceito'],['3GP','Aceito'],['FLV','Aceito']].map(([f,d]) =>
      `<div class="bg-gray-800/50 rounded p-2"><span class="font-mono text-white font-bold">.${f}</span><p class="text-gray-500 mt-0.5">${d}</p></div>`
    ).join('')}
  </div>
  ${this.p('<strong class="text-white">Especificações recomendadas:</strong>')}
  ${this.codeBlock('Resolução mínima: 1080 x 1080 px (quadrado) ou 1080 x 1920 px (vertical/stories/reels)\nTamanho máximo: 4 GB\nDuração: 1 segundo a 241 minutos (recomendado: 15-60 segundos para feed)\nÁudio: AAC, taxa de bits mínima 128 kbps')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // GOOGLE CLOUD
  // ════════════════════════════════════════════════════════════════════════

  sGCloudProject() {
    return `
<div>
  ${this.h2('Criar Projeto no Google Cloud', 'fab fa-google')}
  ${this.p('O Google Cloud é onde você cria a "chave de acesso" que permite à plataforma ler sua planilha Google Sheets automaticamente. Você faz isso uma vez e nunca mais precisa mexer.')}

  ${this.h3('Criar uma conta no Google Cloud (se ainda não tiver)')}
  ${this.step(1, 'Acesse console.cloud.google.com', 'Use a mesma conta Google do Google Sheets.')}
  ${this.step(2, 'Se for a primeira vez', 'Aceite os termos de serviço. O Google oferece $300 em créditos gratuitos, mas para a API do Sheets o custo é zero dentro dos limites normais de uso.')}

  ${this.h3('Criar um novo projeto')}
  ${this.step(1, 'Clique no seletor de projetos', 'No topo da página, ao lado do logo do Google Cloud, tem um dropdown mostrando o projeto atual (ou "Selecione um projeto"). Clique nele.')}
  ${this.step(2, 'Clique em "Novo projeto"', 'No canto superior direito do popup, clique em <strong>"Novo projeto"</strong>.')}
  ${this.step(3, 'Dê um nome ao projeto', 'Exemplo: <em>"meta-ads-automation"</em> ou <em>"planilha-meta"</em>. O nome não pode ter espaços — use hífens.')}
  ${this.step(4, 'Clique em "Criar"', 'Aguarde alguns segundos para o projeto ser criado.')}
  ${this.step(5, 'Selecione o projeto criado', 'Depois que aparecer a notificação de criação, clique em <strong>"Selecionar projeto"</strong> ou escolha no dropdown no topo.')}

  ${this.ok('Projeto criado! Agora você vai ativar a Sheets API dentro desse projeto. Continue na próxima seção.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sGCloudApi() {
    return `
<div>
  ${this.h2('Ativar a Google Sheets API', 'fas fa-plug')}
  ${this.p('Após criar o projeto, você precisa ativar a API do Google Sheets para que a conta de serviço possa ler os dados da planilha.')}

  ${this.h3('Como ativar a API')}
  ${this.step(1, 'No console do Google Cloud', 'Certifique-se de estar no projeto correto (aparece no topo).')}
  ${this.step(2, 'Clique em "APIs e serviços"', 'No menu lateral esquerdo (ícone de três barras), clique em <strong>"APIs e serviços"</strong> → <strong>"Biblioteca"</strong>.')}
  ${this.step(3, 'Busque "Google Sheets API"', 'Na barra de busca, digite <strong>"Google Sheets"</strong> e pressione Enter.')}
  ${this.step(4, 'Clique na "Google Sheets API"', 'Clique no card azul que aparece nos resultados.')}
  ${this.step(5, 'Clique em "Ativar"', 'Botão azul no topo. Aguarde alguns segundos.')}
  ${this.ok('API ativada! Agora crie a Conta de Serviço para ter as credenciais de acesso.')}

  ${this.tip('Se o botão mostrar "Gerenciar" em vez de "Ativar", significa que a API já está ativa neste projeto.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sGCloudSa() {
    return `
<div>
  ${this.h2('Criar a Conta de Serviço e Baixar o JSON', 'fas fa-user-shield')}
  ${this.p('A Conta de Serviço é como um "usuário robô" do Google. Ela tem um email próprio e você vai compartilhar a planilha com esse email, permitindo que a plataforma leia os dados automaticamente.')}

  ${this.h3('Criar a Conta de Serviço')}
  ${this.step(1, 'No Google Cloud, vá em IAM e administrador', 'Menu lateral → <strong>"IAM e administrador"</strong> → <strong>"Contas de serviço"</strong>.')}
  ${this.step(2, 'Clique em "Criar conta de serviço"', 'Botão azul no topo da página.')}
  ${this.step(3, 'Preencha o nome', `<div class="mt-2 space-y-1.5 text-xs">
    ${[['Nome da conta de serviço','meta-ads-sheets (use hífens, sem espaços, minúsculas)'],['ID da conta de serviço','Preenchido automaticamente baseado no nome'],['Descrição','Opcional: "Acesso à planilha de automação Meta Ads"']].map(([f,d]) => `<div class="bg-gray-900/50 rounded p-2"><span class="text-green-400 font-mono">${f}:</span> <span class="text-gray-400">${d}</span></div>`).join('')}
  </div>`)}
  ${this.step(4, 'Clique em "Criar e continuar"', 'Na próxima tela, é perguntado sobre roles/permissões. <strong>Pode pular</strong> — clique em "Continuar" e depois em "Concluído". Para leitura de Sheets, não é necessário nenhum role no Google Cloud.')}
  ${this.step(5, 'Você voltará para a lista de contas de serviço', 'Sua conta recém-criada aparece na lista.')}

  ${this.h3('Copiar o email da conta de serviço')}
  ${this.step(1, 'Na lista de contas de serviço', 'Você verá o email da conta no formato: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">nome@projeto.iam.gserviceaccount.com</code>')}
  ${this.step(2, 'Copie este email', 'Você vai precisar dele para compartilhar a planilha. Anote ou cole em algum lugar.')}

  ${this.h3('Baixar o arquivo de chave JSON')}
  ${this.step(1, 'Clique no email/nome da conta', 'Abre os detalhes da conta de serviço.')}
  ${this.step(2, 'Vá na aba "Chaves"', 'Clique na aba <strong>"Chaves"</strong>.')}
  ${this.step(3, 'Clique em "Adicionar chave"', 'Clique em <strong>"Adicionar chave"</strong> → <strong>"Criar nova chave"</strong>.')}
  ${this.step(4, 'Selecione "JSON"', 'Mantenha <strong>"JSON"</strong> selecionado e clique em <strong>"Criar"</strong>.')}
  ${this.step(5, 'Arquivo baixado automaticamente', 'Um arquivo <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">.json</code> será baixado para o seu computador. Este é o arquivo que você vai colar na plataforma.')}

  ${this.danger('Guarde este arquivo JSON com segurança! Ele é como uma senha. Se alguém tiver acesso a ele, pode ler suas planilhas. Nunca o suba para GitHub ou compartilhe em chats.')}

  ${this.h3('Compartilhar a planilha com a conta de serviço')}
  ${this.step(1, 'Abra a planilha Google Sheets', '')}
  ${this.step(2, 'Clique em "Compartilhar"', 'Botão azul no canto superior direito.')}
  ${this.step(3, 'Cole o email da conta de serviço', 'Cole o email: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">nome@projeto.iam.gserviceaccount.com</code>')}
  ${this.step(4, 'Defina a permissão como "Visualizador"', 'Mude de "Editor" para <strong>"Visualizador"</strong> — a conta só precisa ler, não editar.')}
  ${this.step(5, 'Desmarque "Notificar pessoas"', 'Não precisa notificar — é um robô, não vai ler o email.')}
  ${this.step(6, 'Clique em "Compartilhar"', 'Confirme.')}

  ${this.ok('Pronto! Agora a plataforma consegue ler sua planilha usando o arquivo JSON. Vá em Importar Produtos → Configuração → cole o ID da planilha e o conteúdo do arquivo JSON.')}

  ${this.h3('Como abrir e copiar o conteúdo do arquivo JSON')}
  ${this.step(1, 'Localize o arquivo baixado', 'O arquivo fica na pasta de Downloads com nome tipo: <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">projeto-abc123-def456.json</code>')}
  ${this.step(2, 'Abra com o Bloco de Notas', 'Clique com botão direito no arquivo → <strong>"Abrir com"</strong> → <strong>"Bloco de Notas"</strong> (Windows) ou <strong>"TextEdit"</strong> (Mac).')}
  ${this.step(3, 'Selecione tudo', 'Pressione <strong>Ctrl+A</strong> para selecionar todo o conteúdo.')}
  ${this.step(4, 'Copie', 'Pressione <strong>Ctrl+C</strong>.')}
  ${this.step(5, 'Cole na plataforma', 'No campo "JSON da Conta de Serviço" em Importar Produtos → Configuração, pressione <strong>Ctrl+V</strong>.')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // n8n
  // ════════════════════════════════════════════════════════════════════════

  sN8nInstall() {
    return `
<div>
  ${this.h2('Instalar e Acessar o n8n', 'fas fa-server')}
  ${this.p('O n8n é a ferramenta de automação que roda o workflow de criação de campanhas. Ele complementa a plataforma, rodando em segundo plano a cada 6 horas para processar produtos novos da planilha automaticamente.')}

  ${this.h3('Opção 1: n8n na Nuvem (mais fácil)')}
  ${this.p('A forma mais simples — sem precisar configurar servidor.')}
  ${this.step(1, 'Acesse n8n.io/cloud', 'Vá em: <strong>n8n.io</strong> → clique em <strong>"Start for free"</strong>.')}
  ${this.step(2, 'Crie sua conta', 'Use seu email e crie uma senha. O plano gratuito permite até 2 workflows ativos.')}
  ${this.step(3, 'Acesse o painel', 'Você já está dentro do n8n cloud. Pule para a seção de Importar Workflow.')}

  ${this.h3('Opção 2: n8n no computador/servidor (mais controle)')}
  ${this.p('Use se já tiver Node.js instalado ou uma VPS.')}
  ${this.step(1, 'Instale o Node.js', 'Baixe em: <strong>nodejs.org</strong> → instale a versão LTS. Node.js 18 ou superior.')}
  ${this.step(2, 'Abra o terminal', 'No Windows: clique no menu Iniciar → busque "cmd" → abra o Prompt de Comando.')}
  ${this.step(3, 'Instale o n8n globalmente', 'Cole e execute o comando:')}
  ${this.codeBlock('npm install -g n8n')}
  ${this.step(4, 'Aguarde a instalação', 'Pode levar 1-5 minutos dependendo da conexão.')}
  ${this.step(5, 'Inicie o n8n', 'Execute o comando:')}
  ${this.codeBlock('n8n start')}
  ${this.step(6, 'Acesse no navegador', 'Abra: <strong>http://localhost:5678</strong>')}
  ${this.step(7, 'Configure a senha inicial', 'Na primeira vez, o n8n pede para criar um usuário e senha. Preencha.')}

  ${this.h3('Opção 3: n8n via Docker (VPS/servidor)')}
  ${this.p('Para quem tem um servidor com Docker rodando.')}
  ${this.codeBlock('docker run -it --rm \\\n  --name n8n \\\n  -p 5678:5678 \\\n  -v ~/.n8n:/home/node/.n8n \\\n  n8nio/n8n')}
  ${this.tip('Para que o n8n rode permanentemente em background no servidor, use <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">-d</code> ao invés de <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">-it --rm</code>.')}

  ${this.ok('n8n instalado! Agora importe o workflow na próxima seção.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sN8nImport() {
    return `
<div>
  ${this.h2('Importar o Workflow no n8n', 'fas fa-file-import')}
  ${this.p('O workflow é o arquivo JSON que contém toda a lógica de automação: leitura da planilha, criação de campanhas no Meta, upload de vídeos e atualização de status.')}

  ${this.h3('Onde está o arquivo do workflow')}
  ${this.p('O arquivo <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">meta_ads_v4_filename.json</code> é o workflow completo. Ele foi entregue junto com a planilha.')}

  ${this.h3('Como importar')}
  ${this.step(1, 'Acesse o n8n', 'Abra: <strong>localhost:5678</strong> (local) ou o link da sua instância cloud.')}
  ${this.step(2, 'Clique em "Workflows"', 'Menu lateral → <strong>"Workflows"</strong>.')}
  ${this.step(3, 'Clique em "Adicionar workflow"', 'Botão no canto superior direito ou <strong>"+ New workflow"</strong>.')}
  ${this.step(4, 'Clique no menu de 3 pontos (⋮)', 'No topo direito da tela do editor, clique no ícone de três pontos.')}
  ${this.step(5, 'Clique em "Import from File"', 'Selecione o arquivo <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">meta_ads_v4_filename.json</code>.')}
  ${this.step(6, 'Workflow importado!', 'Você verá todos os 25 nodes do workflow no canvas. Agora precisa configurar as credenciais e IDs.')}

  ${this.tip('Se aparecer mensagens de erro em nodes após importar, é normal — os IDs da planilha e as credenciais ainda precisam ser configurados. Continue para a próxima seção.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sN8nConfigure() {
    return `
<div>
  ${this.h2('Configurar os Nodes do Workflow', 'fas fa-gear')}
  ${this.p('Após importar o workflow, você precisa substituir os placeholders com seus dados reais. São 4 nodes de Google Sheets e as credenciais do Google.')}

  ${this.h3('Passo 1: Conectar o Google Sheets ao n8n')}
  ${this.step(1, 'Clique em qualquer node do Google Sheets', 'Nodes com ícone verde de planilha. Exemplo: "📋 Ler linhas sem Status".')}
  ${this.step(2, 'Clique em "Credential for Google Sheets API"', 'Aparecerá um dropdown para selecionar ou criar uma credencial.')}
  ${this.step(3, 'Clique em "Create new"', 'Para adicionar uma nova credencial.')}
  ${this.step(4, 'Selecione o tipo de autenticação', 'Escolha <strong>"Service Account"</strong>.')}
  ${this.step(5, 'Cole o conteúdo do JSON', 'No campo <strong>"Service Account JSON"</strong>, cole o conteúdo completo do arquivo JSON da conta de serviço do Google Cloud.')}
  ${this.step(6, 'Clique em "Save"', 'A credencial é salva e pode ser reutilizada em todos os outros nodes do Sheets.')}
  ${this.step(7, 'Selecione a credencial nos outros nodes', 'Para os outros 3 nodes do Google Sheets, selecione a credencial que você acabou de criar no dropdown.')}

  ${this.h3('Passo 2: Substituir o Spreadsheet ID nos 4 nodes')}
  ${this.p('Há 4 nodes que leem ou escrevem na planilha. Em cada um, você precisa substituir o placeholder pelo ID real da sua planilha.')}
  <div class="space-y-2 mb-4">
    ${[
      '📋 Ler linhas sem Status',
      '⚙️ Buscar Config da Conta',
      '✏️ Marcar como Processando',
      '✅ Gravar resultado no Sheets',
    ].map((n,i) => `<div class="flex items-center gap-2 bg-gray-800/50 rounded-lg p-3 text-sm"><span class="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${i+1}</span><span class="text-gray-300">${n}</span></div>`).join('')}
  </div>
  ${this.step(1, 'Clique em cada um desses nodes', 'Um por um.')}
  ${this.step(2, 'Procure o campo "Spreadsheet ID"', 'Deve ter o valor <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">SEU_SHEETS_ID_AQUI</code> como placeholder.')}
  ${this.step(3, 'Substitua pelo ID real', 'Cole o ID da sua planilha (aquele que está na URL do Google Sheets).')}
  ${this.step(4, 'Clique em "Save" ou feche', 'Cada node salva automaticamente ao fechar.')}

  ${this.h3('Passo 3: Verificar os nomes das abas')}
  ${this.p('Nos nodes de Google Sheets, verifique se o nome das abas está correto:')}
  <div class="space-y-1.5 mb-4 text-sm">
    ${[
      ['"📋 Ler linhas sem Status"', '"Anúncios"'],
      ['"⚙️ Buscar Config da Conta"', '"Configurações"'],
      ['"✏️ Marcar como Processando"', '"Anúncios"'],
      ['"✅ Gravar resultado no Sheets"', '"Anúncios"'],
    ].map(([node, sheet]) => `<div class="flex gap-3 bg-gray-800/50 rounded p-2"><span class="text-gray-300">${node}</span><span class="text-gray-500">→ aba:</span><span class="text-green-400 font-mono text-xs">${sheet}</span></div>`).join('')}
  </div>

  ${this.h3('Passo 4: Verificar o intervalo de agendamento')}
  ${this.step(1, 'Clique no node "⏰ Agendamento"', 'É o primeiro node do workflow, no canto esquerdo.')}
  ${this.step(2, 'Verifique o intervalo', 'O padrão é <strong>a cada 6 horas</strong>. Você pode mudar para 1h, 2h, 4h, 12h ou 24h conforme sua necessidade.')}

  ${this.ok('Tudo configurado! Agora faça um teste antes de ativar o workflow completamente.')}
</div>`
  },

  // ────────────────────────────────────────────────────────────────────────
  sN8nTest() {
    return `
<div>
  ${this.h2('Testar e Ativar o Workflow', 'fas fa-play')}
  ${this.p('Antes de deixar o workflow rodar automaticamente, faça um teste manual com 1-2 produtos para garantir que tudo está funcionando corretamente.')}

  ${this.h3('Passo 1: Preparar o teste')}
  ${this.step(1, 'Adicione 2 linhas de teste na aba Anúncios', 'Preencha todas as colunas de 2 produtos com dados reais. Deixe Status vazio.')}
  ${this.step(2, 'Use orçamento mínimo', 'Para o teste, coloque <code class="text-green-400 bg-gray-900 px-1 rounded text-xs">Budget_Diario_USD = 1</code> para minimizar risco.')}
  ${this.step(3, 'Use apenas 1 vídeo por linha', 'Para o primeiro teste, coloque apenas 1 URL de vídeo para ser mais rápido.')}

  ${this.h3('Passo 2: Executar o teste manualmente')}
  ${this.step(1, 'No n8n, abra o workflow', 'Acesse o workflow importado.')}
  ${this.step(2, 'Clique em "Test workflow"', 'Botão laranja no canto inferior. Isso executa o workflow uma vez manualmente.')}
  ${this.step(3, 'Acompanhe a execução', 'Cada node vai ficando verde (sucesso) ou vermelho (erro) conforme executa. Acompanhe o progresso.')}
  ${this.step(4, 'Verifique os dados de cada node', 'Clique em cada node para ver os dados de entrada e saída. Isso ajuda a debugar problemas.')}

  ${this.h3('O que verificar após o teste')}
  ${this.step(1, 'Na planilha Google Sheets', 'As linhas processadas devem ter a coluna Status preenchida com <strong>"Concluída"</strong> e os IDs de campanha, conjunto e anúncios preenchidos.')}
  ${this.step(2, 'No Meta Ads Manager', 'Acesse a conta de anúncio → verifique se a campanha, conjunto e anúncios foram criados (em status PAUSADO).')}
  ${this.step(3, 'Se houver erro', 'A coluna "Detalhes_Erro" na planilha mostrará o motivo. Veja também o node vermelho no n8n para mais detalhes.')}

  ${this.h3('Possíveis erros no teste e como resolver')}
  <div class="space-y-2 mb-5">
    ${[
      ['Node Sheets retorna vazio', 'O Config_ID da aba Anúncios não bate com a aba Configurações. Verifique maiúsculas e espaços.'],
      ['Erro no node de campanha', 'Token sem permissão ou expirado. Regere o token com as 3 permissões corretas.'],
      ['Erro: Invalid pixel ID', 'O Pixel ID na aba Configurações está incorreto. Verifique no Events Manager.'],
      ['Vídeo não sobe', 'O link do Drive não está no formato correto ou o arquivo não tem acesso público. Verifique o link.'],
    ].map(([e,s]) => `
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-red-400 text-xs font-mono">${e}</p>
        <p class="text-gray-300 text-xs mt-1"><strong class="text-green-400">Solução:</strong> ${s}</p>
      </div>`).join('')}
  </div>

  ${this.h3('Passo 3: Ativar o workflow (automático)')}
  ${this.step(1, 'Após o teste com sucesso', 'Clique no toggle <strong>"Active"</strong> no canto superior direito do workflow. Ele vai de cinza para verde.')}
  ${this.step(2, 'Workflow ativo!', 'A partir de agora, a cada 6 horas (ou o intervalo configurado), o n8n vai automaticamente verificar se há linhas novas na planilha e processar.')}
  ${this.step(3, 'Para adicionar novos produtos', 'Basta adicionar uma nova linha na aba Anúncios com Status vazio e aguardar o próximo ciclo. Ou clique em "Test workflow" para processar imediatamente.')}

  ${this.ok('Workflow ativo! Agora a automação completa está funcionando: você adiciona produtos na planilha, o n8n cria as campanhas no Meta, e a plataforma monitora e otimiza tudo com IA.')}

  ${this.h3('Como executar imediatamente (sem esperar o agendamento)')}
  ${this.p('Quando adicionar produtos novos e quiser processar na hora, sem esperar o próximo ciclo automático:')}
  ${this.step(1, 'Abra o workflow no n8n', '')}
  ${this.step(2, 'Clique em "Test workflow"', 'Isso executa o workflow imediatamente, independente do agendamento.')}
  ${this.step(3, 'Ou use o webhook (avançado)', 'Você pode criar um endpoint de webhook no n8n para acionar o workflow via URL, permitindo disparar de qualquer lugar.')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // FIM DO n8n
  // ════════════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────────────────
  sTroubleshoot() {
    return `
<div>
  ${this.h2('Solução de Problemas', 'fas fa-wrench')}
  ${this.p('Se algo não estiver funcionando, consulte esta lista de problemas comuns e suas soluções.')}

  ${this.h3('Problemas de Conexão com o Meta')}
  <div class="space-y-3 mb-5">
    ${[
      ['Erro: #200 Permissions error',
       'O token não tem as permissões necessárias.',
       'Regere o token no Explorador da API com as permissões: ads_management, ads_read, business_management'],
      ['Erro: Invalid account ID',
       'O Account ID está no formato errado.',
       'Certifique-se de incluir o prefixo "act_". Formato correto: act_1234567890'],
      ['Erro: Token expired / Session has expired',
       'O token de 60 dias expirou.',
       'Gere um novo token e atualize no Business Manager correspondente. Ver seção "Renovar Tokens".'],
      ['Erro: Invalid pixel ID',
       'O Pixel ID está incorreto.',
       'Verifique no Meta Events Manager: Configurações → Fontes de Dados → Pixels. Copie o ID correto.'],
    ].map(([e, c, s]) => `
      <div class="bg-gray-800/50 rounded-lg p-4">
        <p class="text-red-400 text-sm font-mono mb-1">${e}</p>
        <p class="text-gray-400 text-xs mb-2"><strong class="text-gray-300">Causa:</strong> ${c}</p>
        <p class="text-gray-300 text-xs"><strong class="text-green-400">Solução:</strong> ${s}</p>
      </div>`).join('')}
  </div>

  ${this.h3('Problemas com o Google Sheets')}
  <div class="space-y-3 mb-5">
    ${[
      ['Erro: google-api-python-client não instalado',
       'As bibliotecas necessárias não estão instaladas.',
       'Execute no terminal: pip install google-auth google-api-python-client'],
      ['Erro: 403 Permission denied',
       'A planilha não foi compartilhada com a conta de serviço.',
       'Abra a planilha → Compartilhar → Cole o e-mail da conta de serviço → Permissão: Visualizador'],
      ['Erro: JSON inválido',
       'O arquivo JSON da conta de serviço foi copiado incorretamente.',
       'Abra o arquivo .json com o Bloco de Notas, selecione TUDO (Ctrl+A) e copie novamente'],
      ['Produtos importados mas sem conta Meta',
       'O Config_ID da aba Anúncios não bate com nenhum da aba Configurações.',
       'Verifique se o Config_ID é idêntico nas duas abas (maiúsculas, sem espaços). É case-sensitive!'],
    ].map(([e, c, s]) => `
      <div class="bg-gray-800/50 rounded-lg p-4">
        <p class="text-red-400 text-sm font-mono mb-1">${e}</p>
        <p class="text-gray-400 text-xs mb-2"><strong class="text-gray-300">Causa:</strong> ${c}</p>
        <p class="text-gray-300 text-xs"><strong class="text-green-400">Solução:</strong> ${s}</p>
      </div>`).join('')}
  </div>

  ${this.h3('Problemas com o Gestor IA')}
  <div class="space-y-3 mb-5">
    ${[
      ['IA não responde / erro de API',
       'A chave da Anthropic não está configurada ou é inválida.',
       'Acesse Configurações → Integrações → Anthropic API Key → Cole a chave → Teste → Salve'],
      ['Análise muito genérica',
       'A Base de Conhecimento está vazia.',
       'Acesse Conhecimento → adicione seus produtos com metas de CPA e ROAS, e adicione informações sobre seu mercado'],
      ['Agente não executa automaticamente',
       'O intervalo de ciclos está configurado para muito tempo.',
       'No Gestor IA, ajuste o Intervalo para 1h ou 2h. O ciclo automático só funciona enquanto a plataforma estiver rodando.'],
    ].map(([e, c, s]) => `
      <div class="bg-gray-800/50 rounded-lg p-4">
        <p class="text-red-400 text-sm font-mono mb-1">${e}</p>
        <p class="text-gray-400 text-xs mb-2"><strong class="text-gray-300">Causa:</strong> ${c}</p>
        <p class="text-gray-300 text-xs"><strong class="text-green-400">Solução:</strong> ${s}</p>
      </div>`).join('')}
  </div>

  ${this.h3('Lançamento de campanhas com problemas')}
  <div class="space-y-3 mb-5">
    ${[
      ['Vídeo não processa (loop infinito)',
       'O vídeo está corrompido ou em formato não suportado pelo Meta.',
       'Teste o link do Google Drive manualmente. Formatos aceitos: MP4, MOV, AVI. A plataforma pula automaticamente após 3 minutos.'],
      ['Erro: page_id inválido',
       'O Page ID na aba Configurações está incorreto.',
       'Acesse sua Página do Facebook → Sobre → Página → rolar até o fim para ver o Page ID numérico'],
      ['Campanha criada mas sem anúncios',
       'Todos os vídeos tiveram algum problema no upload.',
       'Verifique os links de vídeo na planilha. Os links do Google Drive devem ter compartilhamento público e estar no formato: drive.google.com/uc?id=...'],
    ].map(([e, c, s]) => `
      <div class="bg-gray-800/50 rounded-lg p-4">
        <p class="text-red-400 text-sm font-mono mb-1">${e}</p>
        <p class="text-gray-400 text-xs mb-2"><strong class="text-gray-300">Causa:</strong> ${c}</p>
        <p class="text-gray-300 text-xs"><strong class="text-green-400">Solução:</strong> ${s}</p>
      </div>`).join('')}
  </div>

  ${this.h3('A plataforma para de funcionar')}
  ${this.p('Se o servidor parar, a plataforma fica inacessível. Isso acontece se:')}
  ${['O terminal onde você rodou "python start.py" foi fechado → Abra o terminal novamente e execute "python start.py"',
     'O computador foi reiniciado → Execute "python start.py" novamente',
     'Erro de Python no terminal → Leia a mensagem de erro e consulte este manual'].map(item =>
    `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-arrow-right text-red-400 mt-1 flex-shrink-0 text-xs"></i>${item}</div>`
  ).join('')}

  ${this.tip('Para que a plataforma inicie automaticamente com o Windows, consulte como adicionar um script ao "Iniciar com o Windows" ou use um gerenciador de processos como NSSM.')}
</div>`
  },

  // ════════════════════════════════════════════════════════════════════════
  // PROJETOS & INTEGRAÇÕES
  // ════════════════════════════════════════════════════════════════════════

  sProjects() {
    return `
<div>
  ${this.h2('Projetos', 'fas fa-folder-open')}
  ${this.p('Projetos são a unidade principal de organização da plataforma. Cada projeto agrupa seus próprios Business Managers, contas de anúncio, Notion e ClickUp — tudo isolado dos demais projetos.')}

  ${this.h3('Para que serve um projeto?')}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
    ${[
      ['Isolamento', 'BMs e contas de um projeto não aparecem em outro. Dados 100% separados.'],
      ['Múltiplos clientes', 'Gerencie vários clientes ou marcas na mesma plataforma sem misturar dados.'],
      ['Integração própria', 'Cada projeto conecta seu próprio Notion ou ClickUp independente.'],
    ].map(([t,d]) => `<div class="bg-gray-800/50 rounded-lg p-4"><p class="text-white text-sm font-semibold mb-1">${t}</p><p class="text-gray-400 text-xs">${d}</p></div>`).join('')}
  </div>

  ${this.h3('Criar um projeto')}
  ${this.step(1, 'Clique no seletor de projeto', 'No topo da barra lateral, clique na área que mostra o projeto ativo (com o ícone de pasta). Um dropdown abre com todos os projetos.')}
  ${this.step(2, 'Clique em "Novo Projeto"', 'Um modal abre. Preencha o nome (ex: GTS, Ondelta, Cliente X) e escolha uma cor para identificação visual.')}
  ${this.step(3, 'Expanda "Integrações" (opcional)', 'Ainda no mesmo modal, clique no botão <strong>"Integrações (Notion / ClickUp)"</strong> para já configurar a conexão do projeto. Pode fazer depois também.')}
  ${this.step(4, 'Clique em Salvar', 'O projeto é criado e automaticamente ativado. Tudo que você fizer agora pertence a ele.')}
  ${this.ok('Ao criar um projeto, ele é ativado imediatamente. O nome na barra lateral muda para refletir o projeto ativo.')}

  ${this.h3('Trocar de projeto')}
  ${this.step(1, 'Clique no seletor', 'O dropdown mostra todos os projetos. O ativo tem um indicador colorido à esquerda.')}
  ${this.step(2, 'Clique no projeto desejado', 'A plataforma recarrega os dados (BMs, contas, campanhas) do projeto selecionado automaticamente.')}
  ${this.tip('Ao trocar de projeto, todas as páginas (Dashboard, Contas, Campanhas, etc.) mostram apenas os dados daquele projeto. Não há mistura.')}

  ${this.h3('Editar ou remover um projeto')}
  ${this.p('No dropdown de projetos, cada projeto tem ícones de editar (lápis) e remover (lixeira):')}
  ${['<strong>Editar</strong>: altera o nome, cor e integrações do projeto.', '<strong>Remover</strong>: apaga o projeto. <em>As contas de anúncio continuam existindo</em>, mas ficam sem projeto vinculado.'].map(i => `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-arrow-right text-purple-400 mt-1 flex-shrink-0 text-xs"></i>${i}</div>`).join('')}
  ${this.warn('Remover um projeto não apaga os BMs ou contas de anúncio — eles ficam "soltos" e podem ser migrados para outro projeto.')}
</div>`
  },

  sProjectIntegrations() {
    return `
<div>
  ${this.h2('Configurar Notion / ClickUp por Projeto', 'fas fa-plug')}
  ${this.p('Cada projeto pode ter sua própria conexão independente com o Notion e o ClickUp. Assim, projetos de clientes diferentes apontam para workspaces/listas diferentes.')}

  ${this.h3('Acessar as configurações de integração')}
  ${this.step(1, 'Abra o seletor de projetos', 'Clique no nome do projeto ativo na barra lateral.')}
  ${this.step(2, 'Clique no ícone de editar', 'O lápis ao lado do projeto abre o modal de edição.')}
  ${this.step(3, 'Clique em "Integrações (Notion / ClickUp)"', 'O painel expande mostrando os campos de token e ID para Notion e ClickUp.')}
  ${this.step(4, 'Preencha os campos e salve', 'As integrações são salvas junto com as demais configurações do projeto ao clicar em Salvar.')}

  ${this.h3('Campos do Notion')}
  <div class="space-y-3 mb-5">
    ${[
      ['Token de integração', 'secret_...', 'Gerado em notion.so/my-integrations. Crie uma integração, copie o token Internal Integration Secret.'],
      ['ID — Análises Diárias', 'xxxxxxxx...', 'ID do banco de dados onde as análises diárias serão salvas. Veja como obter o ID abaixo.'],
      ['ID — Produtos (opcional)', 'xxxxxxxx...', 'ID do banco de dados de produtos. Usado para puxar produtos do Notion para a plataforma.'],
    ].map(([label, placeholder, desc]) => `
    <div class="bg-gray-800/40 rounded-lg p-3">
      <p class="text-white text-sm font-semibold">${label} <code class="text-green-400 text-xs font-mono ml-1">${placeholder}</code></p>
      <p class="text-gray-400 text-xs mt-1">${desc}</p>
    </div>`).join('')}
  </div>

  ${this.h3('Como obter o ID de um banco de dados Notion')}
  ${this.step(1, 'Abra o banco de dados no Notion', 'Navegue até a database desejada (ex: Análises Diárias).')}
  ${this.step(2, 'Copie a URL', 'A URL terá o formato: <code class="text-green-400 text-xs">notion.so/workspace/<strong>abc123def456...</strong>?v=...</code>')}
  ${this.step(3, 'Extraia o ID', 'O ID é a sequência de 32 caracteres hexadecimais antes do <code class="text-xs text-green-400">?v=</code>. Ex: <code class="text-xs text-green-400">94732954e8dd4cc4b80a6a2a95b3d8e1</code>')}
  ${this.tip('Você pode colar a URL completa no campo — a plataforma aceita o ID no formato com ou sem hífens.')}

  ${this.h3('Campos do ClickUp')}
  <div class="space-y-3 mb-5">
    ${[
      ['API Token', 'pk_...', 'Obtido em: ClickUp → Configurações pessoais → Apps → API Token.'],
      ['List ID', '901322010985', 'O ID da lista onde as tarefas estão. Aparece na URL: app.clickup.com/TEAM/v/li/<strong>ID_AQUI</strong>'],
    ].map(([label, placeholder, desc]) => `
    <div class="bg-gray-800/40 rounded-lg p-3">
      <p class="text-white text-sm font-semibold">${label} <code class="text-green-400 text-xs font-mono ml-1">${placeholder}</code></p>
      <p class="text-gray-400 text-xs mt-1">${desc}</p>
    </div>`).join('')}
  </div>

  ${this.h3('Compartilhar o banco de dados com a integração Notion')}
  ${this.step(1, 'Abra o banco de dados no Notion', 'Clique nos três pontos "..." no canto superior direito.')}
  ${this.step(2, 'Clique em "Connections" (Conexões)', 'Procure por "Add connections" ou "Conectar a".')}
  ${this.step(3, 'Selecione sua integração', 'Escolha a integração criada em notion.so/my-integrations. Sem esse passo, a plataforma recebe erro 403.')}
  ${this.danger('Se a integração não tiver acesso ao banco de dados, as sincronizações vão falhar com erro de permissão. Faça esse passo para cada banco de dados que for usar.')}
</div>`
  },

  sSyncNotion() {
    return `
<div>
  ${this.h2('Puxar Dados do Notion', 'fas fa-book')}
  ${this.p('A plataforma pode importar produtos cadastrados no seu banco de dados Notion diretamente para a lista de Produtos da IA. Assim você mantém os dados no Notion e sincroniza quando precisar.')}

  ${this.h3('Pré-requisito')}
  ${this.p('O projeto ativo precisa ter o <strong>Token Notion</strong> e o <strong>ID do banco de dados de Produtos</strong> configurados. Veja a seção <strong>Configurar Notion / ClickUp por Projeto</strong>.')}

  ${this.h3('Como puxar os produtos')}
  ${this.step(1, 'Vá em Configurações', 'Menu lateral → <strong>Configurações</strong>.')}
  ${this.step(2, 'Abra a aba "Integrações"', 'Clique na aba Integrações no topo da página.')}
  ${this.step(3, 'Localize o painel "Sincronizar Projeto Ativo"', 'O painel no topo mostra o projeto ativo e o status de cada integração (Conectado / Não config.).')}
  ${this.step(4, 'Clique em "Puxar Produtos" (roxo)', 'O botão Notion — Produtos dispara a importação. Aguarde a confirmação.')}
  ${this.ok('Aparecerá a mensagem "X produto(s) importado(s)" em verde quando concluído.')}

  ${this.h3('O que é importado')}
  <div class="overflow-x-auto mb-4">
    <table class="w-full text-xs text-gray-300 border-collapse">
      <thead><tr class="border-b border-gray-700">${['Campo Notion','Campo na Plataforma','Obs'].map(h=>`<th class="text-left py-2 px-3 text-gray-400 font-semibold">${h}</th>`).join('')}</tr></thead>
      <tbody>${[
        ['Produto / Nome / Name', 'Nome do produto', 'Obrigatório. Sem ele, o registro é ignorado.'],
        ['CPA Alvo / CPA Target', 'CPA Alvo', 'Meta de custo por aquisição para a IA'],
        ['ROAS Alvo / ROAS Target', 'ROAS Alvo', 'Meta de retorno sobre gasto para a IA'],
        ['Ticket Médio / Ticket', 'Ticket Médio', 'Ticket médio do produto'],
        ['Status, Plataforma, CPA Máximo, Breakeven', 'Observações', 'Concatenados no campo notas'],
      ].map(([a,b,c])=>`<tr class="border-b border-gray-800"><td class="py-2 px-3">${a}</td><td class="py-2 px-3 text-purple-300">${b}</td><td class="py-2 px-3 text-gray-400">${c}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  ${this.h3('Regra de atualização')}
  ${this.p('Se um produto com o mesmo nome já existe na plataforma, ele é <strong>atualizado</strong> (CPA, ROAS, Ticket, Notas). Se não existe, é <strong>criado</strong>. A comparação de nome é case-insensitive.')}
  ${this.tip('Rode a sincronização sempre que atualizar metas ou dados dos produtos no Notion. A plataforma não sincroniza automaticamente — é sempre manual por segurança.')}
</div>`
  },

  sSyncClickup() {
    return `
<div>
  ${this.h2('Puxar Tarefas do ClickUp', 'fas fa-check-circle')}
  ${this.p('A plataforma importa as tarefas de uma lista ClickUp como <strong>Ideias & Estratégias</strong>. Isso permite usar o ClickUp como fonte de idéias de campanha, testes e estratégias de tráfego.')}

  ${this.h3('Pré-requisito')}
  ${this.p('O projeto ativo precisa ter o <strong>API Token ClickUp</strong> e o <strong>List ID</strong> configurados. Veja a seção <strong>Configurar Notion / ClickUp por Projeto</strong>.')}

  ${this.h3('Como puxar as tarefas')}
  ${this.step(1, 'Vá em Configurações → Integrações', 'Menu lateral → Configurações → aba Integrações.')}
  ${this.step(2, 'Clique em "Puxar Tarefas" (rosa)', 'O botão ClickUp — Tarefas dispara a importação das tasks da lista configurada.')}
  ${this.step(3, 'Confirme o resultado', 'Aparecerá "X tarefa(s) importada(s)". Vá em Gestor IA → Ideias & Estratégias para ver as tarefas importadas.')}

  ${this.h3('Mapeamento de status')}
  <div class="overflow-x-auto mb-4">
    <table class="w-full text-xs text-gray-300 border-collapse">
      <thead><tr class="border-b border-gray-700">${['Status ClickUp','Status na Plataforma'].map(h=>`<th class="text-left py-2 px-3 text-gray-400 font-semibold">${h}</th>`).join('')}</tr></thead>
      <tbody>${[
        ['done, complete, closed, aprovado', 'Aprovado'],
        ['in progress, doing, em andamento', 'Testando'],
        ['rejected, cancel, recusado', 'Rejeitado'],
        ['Qualquer outro', 'Nova'],
      ].map(([a,b])=>`<tr class="border-b border-gray-800"><td class="py-2 px-3 text-green-300 font-mono">${a}</td><td class="py-2 px-3 text-purple-300">${b}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  ${this.tip('Tarefas que já existem na plataforma (mesmo título) não são duplicadas. A sincronização só insere novidades.')}
  ${this.warn('Apenas as tarefas da lista configurada são importadas — até 100 tarefas por sincronização.')}
</div>`
  },

  sAutoProducts() {
    return `
<div>
  ${this.h2('Criar Produtos por País Automaticamente', 'fas fa-wand-magic-sparkles')}
  ${this.p('Esta função analisa os nomes de todas as campanhas do projeto ativo e cria automaticamente um <strong>produto por combinação de produto + país</strong>. Útil para quem tem campanhas rodando em vários países e quer que a IA tenha contexto de cada um.')}

  ${this.h3('Como funciona')}
  ${this.p('O algoritmo varre cada campanha de todas as contas do projeto e extrai:')}
  ${['O <strong>nome do produto</strong>: remove códigos de país, palavras genéricas (cold, CBO, conversão, retargeting, etc.) e datas.', 'O <strong>código do país</strong>: detecta BR, US, MX, AR, CL, CO, PT, ES, etc. como palavra separada no nome da campanha.'].map(i => `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-arrow-right text-blue-400 mt-1 flex-shrink-0 text-xs"></i>${i}</div>`).join('')}

  ${this.h3('Exemplos de detecção')}
  <div class="overflow-x-auto mb-4">
    <table class="w-full text-xs text-gray-300 border-collapse">
      <thead><tr class="border-b border-gray-700">${['Nome da Campanha','Produto Extraído','País'].map(h=>`<th class="text-left py-2 px-3 text-gray-400 font-semibold">${h}</th>`).join('')}</tr></thead>
      <tbody>${[
        ['GTS - BR - Conversão - Cold', 'GTS', 'BR'],
        ['Ondelta | US | CBO | Video', 'Ondelta', 'US'],
        ['Hot_MX_Retargeting_2024', 'Hot', 'MX'],
        ['NovoProduto - PT - Awareness', 'NovoProduto', 'PT'],
        ['TesteCampanha sem país', 'TesteCampanha sem país', '(nenhum)'],
      ].map(([a,b,c])=>`<tr class="border-b border-gray-800"><td class="py-2 px-3 font-mono text-xs">${a}</td><td class="py-2 px-3 text-purple-300">${b}</td><td class="py-2 px-3 text-blue-300">${c}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  ${this.h3('Como usar')}
  ${this.step(1, 'Verifique se há contas conectadas no projeto', 'O projeto ativo precisa ter pelo menos uma conta de anúncio com BM e token válido.')}
  ${this.step(2, 'Vá em Configurações → Integrações', 'Menu lateral → Configurações → aba Integrações.')}
  ${this.step(3, 'Clique em "Criar Produtos" (azul)', 'O botão "Produtos por País" dispara a varredura. Pode demorar alguns segundos dependendo da quantidade de campanhas.')}
  ${this.step(4, 'Confira os produtos criados', 'Vá em Gestor IA → Produtos IA para ver os novos produtos. Edite as metas de CPA e ROAS de cada um.')}
  ${this.ok('Produtos já existentes (mesmo nome + país) não são duplicados. Só cria os que ainda não existem.')}

  ${this.h3('Palavras removidas do nome do produto')}
  ${this.p('As seguintes palavras são ignoradas ao extrair o nome do produto:')}
  <div class="flex flex-wrap gap-1.5 mb-4">
    ${['cold','warm','hot','conversão','tráfego','retargeting','lookalike','lal','cbo','abo','prospecção','remarketing','awareness','reach','vendas','video','imagem','carrossel','test','scale','v2','v3','v4'].map(w=>`<span class="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-400">${w}</span>`).join('')}
  </div>
  ${this.tip('Depois de criar os produtos automaticamente, preencha as metas de CPA e ROAS de cada produto. A IA usa essas metas para avaliar se uma campanha está performando bem ou mal para aquele país específico.')}
</div>`
  },

  sSessionSecret() {
    return `
<div>
  ${this.h2('Sessão Persistente no Render', 'fas fa-shield-halved')}
  ${this.p('Por padrão, o Render (plano gratuito) suspende o servidor após 15 minutos de inatividade. Quando o servidor reinicia, as sessões salvas no banco de dados são apagadas e você precisa fazer login novamente.')}
  ${this.p('A solução é usar tokens <strong>sem estado (stateless)</strong>: a sessão fica <em>dentro do próprio token</em>, assinada com uma chave secreta. Não depende do banco de dados e sobrevive a qualquer restart.')}

  ${this.h3('Configurar o SESSION_SECRET no Render')}
  ${this.step(1, 'Acesse o Render', 'Vá em <strong>render.com</strong> e abra o painel do seu serviço (o backend da plataforma).')}
  ${this.step(2, 'Abra "Environment"', 'No menu lateral do serviço, clique em <strong>Environment</strong>.')}
  ${this.step(3, 'Adicione a variável', 'Clique em <strong>Add Environment Variable</strong> e preencha:<br><br><code class="text-green-400 text-xs">Key: SESSION_SECRET</code><br><code class="text-green-400 text-xs">Value: (qualquer string longa e aleatória)</code>')}
  ${this.step(4, 'Gere um valor seguro', 'Use qualquer gerador de strings aleatórias. Exemplo de valor: <code class="text-green-400 text-xs">a8f3k2m9x1p0q7r6s5t4u3v2w1y0z9</code>. Pode ser qualquer coisa — o importante é ser único e secreto.')}
  ${this.step(5, 'Salve e faça o deploy', 'Clique em <strong>Save Changes</strong>. O Render vai reimplantar o serviço automaticamente.')}
  ${this.step(6, 'Faça login novamente', 'Após o deploy, faça login uma vez. O novo token gerado será stateless e <strong>não expirará com restarts</strong>.')}

  ${this.ok('Depois de configurado, você nunca mais precisará fazer login após o servidor acordar. A sessão dura 30 dias a partir do último login.')}

  ${this.h3('Como funciona por baixo')}
  ${this.p('Quando SESSION_SECRET está definido:')}
  ${['O login gera um token no formato <code class="text-xs text-green-400">sl.{payload_base64}.{assinatura_hmac}</code>', 'O payload contém: ID do usuário, email, nome e data de expiração (30 dias)', 'A assinatura HMAC-SHA256 garante que o token não pode ser forjado', 'Ao receber uma requisição, o backend valida a assinatura — sem consultar o banco'].map(i => `<div class="flex items-start gap-2 text-sm text-gray-300 mb-2"><i class="fas fa-arrow-right text-purple-400 mt-1 flex-shrink-0 text-xs"></i>${i}</div>`).join('')}

  ${this.warn('Nunca compartilhe o valor do SESSION_SECRET. Quem tiver essa chave pode forjar tokens de sessão válidos.')}
  ${this.tip('Se suspeitar que o SESSION_SECRET foi comprometido, troque o valor no Render. Todos os tokens antigos ficam inválidos instantaneamente e todos os usuários precisarão logar novamente.')}
</div>`
  },

  // ── RENDER PAGE ───────────────────────────────────────────────────────────

  renderPage() {
    const groups = this.groupedSections
    const sidebarGroups = Object.entries(groups).map(([group, items]) => `
      <div class="mb-4">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 px-2">${group}</p>
        ${items.map(s => `
          <button @click="navigate('${s.id}')"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${s.id === this.activeSection ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}"
            :class="activeSection === '${s.id}' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'">
            <i class="${s.icon} w-4 text-center"></i>
            <span>${s.label}</span>
          </button>`).join('')}
      </div>`).join('')

    const activeInfo = this.sections.find(s => s.id === this.activeSection)

    return `
<div class="flex h-full" style="height: calc(100vh - 60px)">

  <!-- Sidebar -->
  <div class="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col" style="height:100%">
    <div class="p-4 border-b border-gray-800">
      <div class="flex items-center gap-2 mb-3">
        <i class="fas fa-book-open text-purple-400"></i>
        <h2 class="text-white font-bold text-sm">Manual da Plataforma</h2>
      </div>
      <input x-model="searchQuery" placeholder="Buscar no manual..."
        class="input-field w-full text-xs" />
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      ${sidebarGroups}
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto" id="manual-content">
    <div class="max-w-3xl mx-auto p-8">

      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <i class="fas fa-book-open"></i>
        <span>Manual</span>
        <i class="fas fa-chevron-right text-gray-700"></i>
        <span class="text-gray-300">${activeInfo?.group || ''}</span>
        <i class="fas fa-chevron-right text-gray-700"></i>
        <span class="text-purple-400">${activeInfo?.label || ''}</span>
      </div>

      <!-- Section content -->
      <div class="prose-dark">
        ${this.renderSection(this.activeSection)}
      </div>

      <!-- Navigation footer -->
      <div class="flex justify-between items-center mt-10 pt-6 border-t border-gray-800">
        ${(() => {
          const idx = this.sections.findIndex(s => s.id === this.activeSection)
          const prev = this.sections[idx - 1]
          const next = this.sections[idx + 1]
          return `
            ${prev ? `<button @click="navigate('${prev.id}')" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <i class="fas fa-arrow-left"></i> ${prev.label}
            </button>` : '<div></div>'}
            ${next ? `<button @click="navigate('${next.id}')" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              ${next.label} <i class="fas fa-arrow-right"></i>
            </button>` : '<div></div>'}`
        })()}
      </div>
    </div>
  </div>

</div>`
  }

}))

}) // end alpine:init
