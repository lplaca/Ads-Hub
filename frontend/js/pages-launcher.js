// ─── IMPORTAR PAGE — Google Sheets Sync + Campaign Launcher ───────────────────
document.addEventListener('alpine:init', () => {

Alpine.data('ImportarPage', () => ({
  tab: 'setup',
  // Setup
  spreadsheet_id: '',
  service_account_json: '',
  config_tab: 'Configurações',
  ads_tab: 'Anúncios',
  configSaved: false,
  configLoading: false,
  // Sync
  syncing: false,
  syncResult: null,
  lastSyncedAt: null,
  syncStatus: 'never',
  // Products
  products: [],
  accounts: [],
  productsLoading: false,
  filterLaunch: '',
  searchQ: '',
  // Launch modal
  launchModal: false,
  currentJob: null,
  pollTimer: null,
  // History
  jobs: [],
  jobsLoading: false,

  // Spreadsheet import
  importFile: null,
  importLoading: false,
  importResult: null,
  importError: '',
  importSelectedRows: new Set(),
  isDragging: false,
  dryRunResult: null,
  dryRunModal: false,
  batchLaunching: false,

  async init() {
    await this.loadConfig()
    if (this.configSaved) {
      await Promise.all([this.loadProducts(), this.loadAccounts()])
    }
    this.$watch('tab', async (t) => {
      if (t === 'produtos') await this.loadProducts()
      if (t === 'historico') await this.loadJobs()
    })
  },

  async loadConfig() {
    try {
      const d = await API.get('/api/sheets/config')
      if (d.configured) {
        this.spreadsheet_id = d.spreadsheet_id || ''
        this.config_tab = d.config_tab || 'Configurações'
        this.ads_tab = d.ads_tab || 'Anúncios'
        this.service_account_json = ''  // never expose back to UI
        this.configSaved = true
        this.lastSyncedAt = d.last_synced_at || null
        this.syncStatus = d.sync_status || 'never'
      }
    } catch(e) {}
  },

  async saveConfig() {
    if (!this.spreadsheet_id.trim()) { toast('warning', 'Informe o ID da planilha'); return }
    if (!this.service_account_json.trim()) { toast('warning', 'Cole o JSON da conta de serviço'); return }
    try {
      JSON.parse(this.service_account_json)
    } catch(e) {
      toast('error', 'JSON inválido — verifique se copiou o arquivo completo'); return
    }
    this.configLoading = true
    try {
      await API.post('/api/sheets/config', {
        spreadsheet_id: this.spreadsheet_id,
        service_account_json: this.service_account_json,
        config_tab: this.config_tab,
        ads_tab: this.ads_tab,
      })
      this.configSaved = true
      toast('success', 'Configuração salva!')
      this.service_account_json = ''
    } catch(e) {
      toast('error', 'Erro ao salvar: ' + (e.message || e))
    }
    this.configLoading = false
  },

  async runSync() {
    if (!this.configSaved) { toast('warning', 'Configure a planilha primeiro'); return }
    this.syncing = true
    this.syncResult = null
    try {
      const r = await API.post('/api/sheets/sync', {})
      this.syncResult = r
      this.syncStatus = 'ok'
      this.lastSyncedAt = new Date().toISOString()
      toast('success', `Sincronizado! ${r.synced_products} produtos · ${r.synced_accounts} contas`)
      await Promise.all([this.loadProducts(), this.loadAccounts()])
      this.tab = 'produtos'
    } catch(e) {
      toast('error', 'Erro na sincronização: ' + (e.message || e))
      this.syncStatus = 'error'
    }
    this.syncing = false
  },

  async loadProducts() {
    this.productsLoading = true
    try {
      this.products = await API.get('/api/imported-products')
    } catch(e) { this.products = [] }
    this.productsLoading = false
  },

  async loadAccounts() {
    try { this.accounts = await API.get('/api/sheets-accounts') } catch(e) {}
  },

  async loadJobs() {
    this.jobsLoading = true
    try { this.jobs = await API.get('/api/launcher/jobs') } catch(e) { this.jobs = [] }
    this.jobsLoading = false
  },

  get filteredProducts() {
    return this.products.filter(p => {
      const matchSearch = !this.searchQ || p.nome_produto.toLowerCase().includes(this.searchQ.toLowerCase()) || p.config_id.toLowerCase().includes(this.searchQ.toLowerCase())
      const matchFilter = !this.filterLaunch || p.launch_status === this.filterLaunch
      return matchSearch && matchFilter
    })
  },

  countByStatus(s) { return this.products.filter(p => p.launch_status === s).length },

  async launchProduct(product) {
    if (product.launch_status === 'launching') { toast('warning', 'Já está sendo lançado'); return }
    const acct = this.accounts.find(a => a.config_id === product.config_id)
    if (!acct) {
      toast('error', `Conta Meta não encontrada para Config_ID: ${product.config_id}`)
      return
    }
    try {
      const r = await API.post('/api/launcher/launch', { product_id: product.id })
      product.launch_status = 'launching'
      this.currentJob = { id: r.job_id, product_name: r.product_name, status: 'queued', step: 'starting', step_detail: 'Preparando...', total_videos: product.video_count, completed_videos: 0, ad_ids: [] }
      this.launchModal = true
      this.startPolling(r.job_id)
    } catch(e) {
      toast('error', 'Erro ao iniciar lançamento: ' + (e.message || e))
    }
  },

  startPolling(job_id) {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(async () => {
      try {
        const job = await API.get(`/api/launcher/job/${job_id}`)
        this.currentJob = job
        // Refresh product in list
        const idx = this.products.findIndex(p => p.id === job.product_id)
        if (idx >= 0) this.products[idx].launch_status = job.status === 'completed' ? 'launched' : job.status === 'failed' ? 'failed' : 'launching'
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(this.pollTimer)
          this.pollTimer = null
          if (job.status === 'completed') toast('success', `Lançado! ${job.ad_ids.length} anúncios criados.`)
          else toast('error', 'Erro no lançamento: ' + job.error)
        }
      } catch(e) { clearInterval(this.pollTimer) }
    }, 3000)
  },

  closeModal() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.launchModal = false
    this.currentJob = null
  },

  async deleteProduct(id) {
    if (!confirm('Remover este produto da plataforma?')) return
    try {
      await API.del(`/api/imported-products/${id}`)
      this.products = this.products.filter(p => p.id !== id)
      toast('success', 'Produto removido')
    } catch(e) { toast('error', 'Erro ao remover') }
  },

  launchStatusBadge(s) {
    const map = {
      not_launched: '<span class="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">Não lançado</span>',
      launching:    '<span class="px-2 py-0.5 rounded-full text-xs bg-blue-600/30 text-blue-300 animate-pulse">Lançando...</span>',
      launched:     '<span class="px-2 py-0.5 rounded-full text-xs bg-green-600/30 text-green-400">Lançado</span>',
      failed:       '<span class="px-2 py-0.5 rounded-full text-xs bg-red-600/30 text-red-400">Erro</span>',
    }
    return map[s] || map['not_launched']
  },

  jobStatusIcon(s) {
    if (s === 'completed') return '<i class="fas fa-check-circle text-green-400"></i>'
    if (s === 'failed')    return '<i class="fas fa-times-circle text-red-400"></i>'
    if (s === 'running')   return '<i class="fas fa-spinner fa-spin text-blue-400"></i>'
    return '<i class="fas fa-clock text-gray-400"></i>'
  },

  stepProgress() {
    if (!this.currentJob) return 0
    const steps = ['queued','running','creating_campaign','creating_adset','uploading','waiting','creating_creative','creating_ad','done','completed']
    const s = this.currentJob.status
    if (s === 'completed') return 100
    if (s === 'failed') return 100
    const total = this.currentJob.total_videos || 1
    const done = this.currentJob.completed_videos || 0
    const base = 30  // 30% for campaign+adset
    return Math.min(95, base + Math.floor((done / total) * 70))
  },

  fmtDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
  },

  // ── Spreadsheet import helpers ────────────────────────────────────────────
  handleDrop(e) {
    this.isDragging = false
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    if (file) this.processImportFile(file)
  },
  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0]
    if (file) this.processImportFile(file)
    e.target.value = ''
  },
  async processImportFile(file) {
    const name = (file.name || '').toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      toast('error', 'Apenas arquivos .csv e .xlsx são aceitos')
      return
    }
    this.importLoading = true
    this.importError = ''
    this.importResult = null
    this.importSelectedRows = new Set()
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await fetch('/api/import/upload', { method: 'POST', body: fd })
      const data = await resp.json()
      if (!resp.ok) {
        this.importError = data.detail || 'Erro ao processar arquivo'
      } else {
        this.importResult = data
        this.importSelectedRows = new Set(
          data.rows.filter(r => r.missing_fields.length === 0).map(r => r.row_index)
        )
      }
    } catch(e) {
      this.importError = 'Erro de conexão ao enviar arquivo'
    }
    this.importLoading = false
  },
  isRowSelected(ri) { return this.importSelectedRows.has(ri) },
  toggleRow(ri) {
    const s = new Set(this.importSelectedRows)
    if (s.has(ri)) s.delete(ri) else s.add(ri)
    this.importSelectedRows = s
  },
  get allRowsSelected() {
    if (!this.importResult || !this.importResult.rows.length) return false
    return this.importResult.rows.every(r => this.importSelectedRows.has(r.row_index))
  },
  toggleAllRows() {
    if (this.allRowsSelected) {
      this.importSelectedRows = new Set()
    } else {
      this.importSelectedRows = new Set((this.importResult ? this.importResult.rows : []).map(r => r.row_index))
    }
  },
  get selectedValidRows() {
    if (!this.importResult) return []
    return this.importResult.rows.filter(r => this.importSelectedRows.has(r.row_index) && r.missing_fields.length === 0)
  },
  get selectedRowsCount() { return this.importSelectedRows.size },
  get hasIncompleteSelected() {
    if (!this.importResult) return false
    return this.importResult.rows.some(r => this.importSelectedRows.has(r.row_index) && r.missing_fields.length > 0)
  },
  async runDryRun() {
    if (!this.importResult) return
    const rows = this.importResult.rows.filter(r => this.importSelectedRows.has(r.row_index))
    if (!rows.length) { toast('warning', 'Nenhuma linha selecionada'); return }
    this.batchLaunching = true
    try {
      const r = await API.post('/api/import/launch-batch', { rows, dry_run: true })
      this.dryRunResult = r
      this.dryRunModal = true
    } catch(e) { toast('error', 'Erro ao executar teste') }
    this.batchLaunching = false
  },
  async launchSelected() {
    const rows = this.selectedValidRows
    if (!rows.length) { toast('warning', 'Nenhuma linha válida selecionada'); return }
    if (this.hasIncompleteSelected) { toast('error', 'Desmarque as linhas com campos obrigatórios ausentes antes de lançar'); return }
    this.batchLaunching = true
    try {
      const r = await API.post('/api/import/launch-batch', { rows, dry_run: false })
      const queued = (r.jobs || []).filter(j => j.status === 'queued').length
      const errs   = (r.jobs || []).filter(j => j.status === 'error').length
      toast('success', queued + ' campanha(s) enfileirada(s)' + (errs > 0 ? ' · ' + errs + ' erro(s)' : ''))
      if (queued > 0) { this.tab = 'historico'; await this.loadJobs() }
    } catch(e) { toast('error', 'Erro ao lançar: ' + (e.message || e)) }
    this.batchLaunching = false
  },
  importRowBadge(row) {
    if (row.missing_fields.length === 0)
      return '<span class="px-2 py-0.5 rounded-full text-xs bg-green-600/20 text-green-400">Pronto</span>'
    return '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-600/20 text-yellow-400" title="' + row.missing_fields.join(', ') + '">Incompleto: ' + row.missing_fields.join(', ') + '</span>'
  },

  renderPage() {
    return `
<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Importar Produtos</h1>
      <p class="text-gray-400 text-sm mt-1">Sincronize o Google Sheets e lance campanhas com um clique</p>
    </div>
    <div class="flex items-center gap-3">
      <span x-show="syncStatus === 'ok'" class="flex items-center gap-1.5 text-sm text-green-400">
        <i class="fas fa-circle-check"></i>
        Sincronizado <span x-text="lastSyncedAt ? fmtDate(lastSyncedAt) : ''"></span>
      </span>
      <span x-show="syncStatus === 'error'" class="text-sm text-red-400"><i class="fas fa-triangle-exclamation mr-1"></i>Erro na última sync</span>
      <button @click="runSync()" :disabled="syncing || !configSaved"
        class="btn-primary flex items-center gap-2 disabled:opacity-50">
        <i class="fas fa-rotate" :class="syncing ? 'fa-spin' : ''"></i>
        <span x-text="syncing ? 'Sincronizando...' : 'Sincronizar Planilha'"></span>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
    <button @click="tab='setup'" :class="tab==='setup' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all">
      <i class="fas fa-gear mr-1.5"></i>Configuração
    </button>
    <button @click="tab='produtos'" :class="tab==='produtos' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all relative">
      <i class="fas fa-box mr-1.5"></i>Produtos
      <span x-show="products.length > 0" class="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full" x-text="products.length"></span>
    </button>
    <button @click="tab='historico'" :class="tab==='historico' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all">
      <i class="fas fa-history mr-1.5"></i>Histórico
    </button>
    <button @click="tab='planilha'" :class="tab==='planilha' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all">
      <i class="fas fa-table mr-1.5"></i>Importar Planilha
    </button>
  </div>

  <!-- ── TAB: SETUP ── -->
  <div x-show="tab==='setup'" class="space-y-6">

    <!-- Steps guide -->
    <div class="glass rounded-xl p-5">
      <h3 class="text-white font-semibold mb-4"><i class="fas fa-list-check text-purple-400 mr-2"></i>Como conectar o Google Sheets</h3>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white mb-2">1</div>
          <p class="text-sm text-gray-300 font-medium">Criar Projeto Google Cloud</p>
          <p class="text-xs text-gray-500 mt-1">Acesse console.cloud.google.com → Novo projeto</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white mb-2">2</div>
          <p class="text-sm text-gray-300 font-medium">Ativar Google Sheets API</p>
          <p class="text-xs text-gray-500 mt-1">APIs &amp; Services → Library → Google Sheets API → Enable</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white mb-2">3</div>
          <p class="text-sm text-gray-300 font-medium">Criar Conta de Serviço</p>
          <p class="text-xs text-gray-500 mt-1">IAM &amp; Admin → Service Accounts → Criar → Baixar JSON</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-4">
          <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white mb-2">4</div>
          <p class="text-sm text-gray-300 font-medium">Compartilhar a planilha</p>
          <p class="text-xs text-gray-500 mt-1">Abrir a planilha → Compartilhar → colar e-mail da conta de serviço (Viewer)</p>
        </div>
      </div>
    </div>

    <!-- Config form -->
    <div class="glass rounded-xl p-6 space-y-4">
      <h3 class="text-white font-semibold"><i class="fas fa-table-cells text-green-400 mr-2"></i>Dados da Planilha</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">ID da Planilha *</label>
          <input x-model="spreadsheet_id" placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            class="input-field w-full text-sm" />
          <p class="text-xs text-gray-500 mt-1">Na URL: docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Aba Configurações</label>
            <input x-model="config_tab" class="input-field w-full text-sm" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Aba Anúncios</label>
            <input x-model="ads_tab" class="input-field w-full text-sm" />
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">
          JSON da Conta de Serviço *
          <span x-show="configSaved" class="ml-2 text-green-400 text-xs"><i class="fas fa-check-circle"></i> Salvo</span>
        </label>
        <textarea x-model="service_account_json" rows="6"
          :placeholder="configSaved ? 'Cole novamente apenas se quiser atualizar o JSON...' : 'Cole aqui o conteúdo completo do arquivo JSON baixado do Google Cloud...'"
          class="input-field w-full text-xs font-mono resize-none"></textarea>
      </div>
      <button @click="saveConfig()" :disabled="configLoading"
        class="btn-primary flex items-center gap-2 disabled:opacity-50">
        <i class="fas fa-floppy-disk" :class="configLoading ? 'fa-spin' : ''"></i>
        <span x-text="configLoading ? 'Salvando...' : (configSaved ? 'Atualizar Configuração' : 'Salvar Configuração')"></span>
      </button>
    </div>

    <!-- Sync result -->
    <div x-show="syncResult" x-transition class="glass rounded-xl p-5 border border-green-500/30">
      <div class="flex items-center gap-3">
        <i class="fas fa-circle-check text-green-400 text-2xl"></i>
        <div>
          <p class="text-white font-semibold">Sincronização concluída!</p>
          <p class="text-sm text-gray-400">
            <span x-text="syncResult?.synced_products"></span> produtos importados ·
            <span x-text="syncResult?.synced_accounts"></span> contas Meta sincronizadas
          </p>
        </div>
        <button @click="tab='produtos'" class="ml-auto btn-primary text-sm">Ver Produtos →</button>
      </div>
    </div>
  </div>

  <!-- ── TAB: PRODUTOS ── -->
  <div x-show="tab==='produtos'" class="space-y-4">

    <!-- Stats bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="glass rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-white" x-text="products.length"></p>
        <p class="text-xs text-gray-400 mt-0.5">Total importado</p>
      </div>
      <div class="glass rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-green-400" x-text="countByStatus('launched')"></p>
        <p class="text-xs text-gray-400 mt-0.5">Lançados</p>
      </div>
      <div class="glass rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-blue-400" x-text="countByStatus('launching')"></p>
        <p class="text-xs text-gray-400 mt-0.5">Em andamento</p>
      </div>
      <div class="glass rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-gray-300" x-text="countByStatus('not_launched')"></p>
        <p class="text-xs text-gray-400 mt-0.5">Aguardando</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <input x-model="searchQ" placeholder="Buscar produto ou Config_ID..."
        class="input-field flex-1 text-sm" />
      <select x-model="filterLaunch" class="input-field text-sm w-auto">
        <option value="">Todos os status</option>
        <option value="not_launched">Não lançados</option>
        <option value="launching">Em lançamento</option>
        <option value="launched">Lançados</option>
        <option value="failed">Com erro</option>
      </select>
      <button @click="loadProducts()" class="btn-secondary text-sm flex items-center gap-1.5">
        <i class="fas fa-rotate" :class="productsLoading ? 'fa-spin' : ''"></i> Atualizar
      </button>
    </div>

    <!-- Products list -->
    <div x-show="productsLoading" class="text-center text-gray-500 py-8">
      <i class="fas fa-spinner fa-spin text-2xl"></i>
    </div>
    <div x-show="!productsLoading && filteredProducts.length === 0" class="glass rounded-xl p-12 text-center">
      <i class="fas fa-box text-4xl text-gray-600 mb-3"></i>
      <p class="text-gray-400">Nenhum produto encontrado</p>
      <button x-show="products.length === 0" @click="tab='setup'" class="mt-3 btn-primary text-sm">
        Configurar Planilha
      </button>
    </div>

    <div class="space-y-3">
      <template x-for="p in filteredProducts" :key="p.id">
        <div class="glass rounded-xl p-4 hover:border-purple-500/30 transition-all">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-white font-semibold" x-text="p.nome_produto"></h3>
                <span class="px-2 py-0.5 rounded text-xs bg-purple-600/20 text-purple-300 font-mono" x-text="p.config_id"></span>
                <span x-html="launchStatusBadge(p.launch_status)"></span>
              </div>
              <div class="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                <span><i class="fas fa-globe mr-1"></i><span x-text="(p.paises || []).join(', ') || '—'"></span></span>
                <span><i class="fas fa-dollar-sign mr-1"></i>$<span x-text="p.budget_diario_usd?.toFixed(2)"></span>/dia</span>
                <span><i class="fas fa-film mr-1"></i><span x-text="p.video_count"></span> vídeo(s)</span>
                <span x-show="p.shopify_id"><i class="fas fa-tag mr-1"></i><span x-text="p.shopify_id"></span></span>
                <span><i class="fas fa-users mr-1"></i><span x-text="p.idade_min"></span>-<span x-text="p.idade_max"></span> anos</span>
              </div>
              <p x-show="p.titulo" class="text-xs text-gray-500 mt-1 truncate" x-text="'💬 ' + p.titulo"></p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Launch button -->
              <button
                x-show="p.launch_status === 'not_launched' || p.launch_status === 'failed'"
                @click="launchProduct(p)"
                class="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all">
                <i class="fas fa-rocket"></i> Lançar
              </button>
              <button
                x-show="p.launch_status === 'launching'"
                disabled
                class="flex items-center gap-1.5 px-3 py-2 bg-blue-600/40 text-blue-300 rounded-lg text-sm font-medium opacity-70 cursor-not-allowed">
                <i class="fas fa-spinner fa-spin"></i> Lançando...
              </button>
              <button
                x-show="p.launch_status === 'launched'"
                disabled
                class="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium cursor-default">
                <i class="fas fa-check-circle"></i> Lançado
              </button>
              <button @click="deleteProduct(p.id)" class="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg">
                <i class="fas fa-trash text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- ── TAB: HISTÓRICO ── -->
  <div x-show="tab==='historico'" class="space-y-4">
    <div class="flex justify-between items-center">
      <h3 class="text-white font-semibold">Histórico de Lançamentos</h3>
      <button @click="loadJobs()" class="btn-secondary text-sm flex items-center gap-1.5">
        <i class="fas fa-rotate" :class="jobsLoading ? 'fa-spin' : ''"></i> Atualizar
      </button>
    </div>
    <div x-show="jobsLoading" class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-xl"></i></div>
    <div x-show="!jobsLoading && jobs.length === 0" class="glass rounded-xl p-10 text-center">
      <i class="fas fa-history text-3xl text-gray-600 mb-2"></i>
      <p class="text-gray-400">Nenhum lançamento ainda</p>
    </div>
    <div class="space-y-2">
      <template x-for="j in jobs" :key="j.id">
        <div class="glass rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span x-html="jobStatusIcon(j.status)"></span>
              <div>
                <p class="text-white text-sm font-medium" x-text="j.product_name || j.product_id"></p>
                <p class="text-xs text-gray-500" x-text="j.step_detail || j.step"></p>
              </div>
            </div>
            <div class="text-right">
              <p x-show="j.ad_ids.length > 0" class="text-xs text-green-400"><i class="fas fa-ad mr-1"></i><span x-text="j.ad_ids.length"></span> anúncios</p>
              <p x-show="j.campaign_id" class="text-xs text-gray-500 font-mono" x-text="j.campaign_id"></p>
              <p class="text-xs text-gray-600 mt-0.5" x-text="fmtDate(j.started_at)"></p>
            </div>
          </div>
          <div x-show="j.error" class="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2" x-text="j.error"></div>
        </div>
      </template>
    </div>
  </div>
  <!-- ── TAB: IMPORTAR PLANILHA ── -->
  <div x-show="tab==='planilha'" class="space-y-5">

    <!-- Upload zone -->
    <div class="glass rounded-xl p-5 space-y-4">
      <h3 class="text-white font-semibold"><i class="fas fa-table text-purple-400 mr-2"></i>Upload de Planilha</h3>
      <div
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop($event)"
        :class="isDragging ? 'border-purple-400 bg-purple-600/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'"
        class="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer"
        @click="$refs.importFileInput.click()">
        <i class="fas fa-cloud-upload-alt text-4xl text-gray-500 mb-3" :class="isDragging ? 'text-purple-400' : ''"></i>
        <p class="text-gray-300 font-medium" x-text="isDragging ? 'Solte o arquivo aqui' : 'Arraste e solte ou clique para selecionar'"></p>
        <p class="text-gray-500 text-sm mt-1">Aceita .csv e .xlsx</p>
      </div>
      <input x-ref="importFileInput" type="file" accept=".csv,.xlsx" class="hidden" @change="handleFileSelect($event)" />

      <div x-show="importLoading" class="flex items-center gap-3 text-blue-400 text-sm">
        <i class="fas fa-spinner fa-spin"></i> Processando arquivo...
      </div>
      <div x-show="importError" class="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
        <i class="fas fa-triangle-exclamation mt-0.5 flex-shrink-0"></i>
        <span x-text="importError"></span>
      </div>
    </div>

    <!-- Preview table -->
    <div x-show="importResult && !importLoading" class="glass rounded-xl overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <h3 class="text-white font-semibold">Pré-visualização</h3>
          <span class="text-sm text-gray-400" x-text="(importResult?.total_rows || 0) + ' linhas detectadas'"></span>
        </div>
        <div class="text-xs text-gray-400 space-y-0.5">
          <div>
            <span class="text-green-400 font-medium" x-text="(importResult?.columns_mapped?.length || 0) + ' colunas mapeadas'"></span>:
            <span x-text="(importResult?.columns_mapped || []).join(', ')"></span>
          </div>
          <div x-show="importResult?.columns_ignored?.length > 0" class="text-gray-600">
            <span x-text="(importResult?.columns_ignored?.length || 0) + ' ignoradas'"></span>:
            <span x-text="(importResult?.columns_ignored || []).join(', ')"></span>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead>
            <tr class="border-b border-gray-700/50">
              <th class="px-4 py-3 text-left w-8">
                <input type="checkbox" :checked="allRowsSelected" @change="toggleAllRows()"
                  class="rounded border-gray-600 text-purple-600 bg-gray-700" />
              </th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Produto</th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Vídeos</th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Países</th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Budget/dia</th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Conta</th>
              <th class="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="row in (importResult?.rows || [])" :key="row.row_index">
              <tr class="border-b border-gray-700/20 hover:bg-gray-800/30 transition-colors"
                :class="isRowSelected(row.row_index) ? 'bg-purple-600/5' : ''">
                <td class="px-4 py-3">
                  <input type="checkbox" :checked="isRowSelected(row.row_index)"
                    @change="toggleRow(row.row_index)"
                    class="rounded border-gray-600 text-purple-600 bg-gray-700" />
                </td>
                <td class="px-4 py-3 text-white font-medium" x-text="row.nome_produto || '—'"></td>
                <td class="px-4 py-3 text-gray-400">
                  <span class="px-2 py-0.5 rounded bg-gray-700 text-xs" x-text="(row.urls_videos || []).length + ' url(s)'"></span>
                </td>
                <td class="px-4 py-3 text-gray-400 text-xs" x-text="(row.paises || []).join(', ') || '—'"></td>
                <td class="px-4 py-3 text-gray-400" x-text="'$' + (row.budget_diario_usd || 10).toFixed(2)"></td>
                <td class="px-4 py-3 text-gray-500 font-mono text-xs" x-text="row.ad_account_id || '—'"></td>
                <td class="px-4 py-3"><span x-html="importRowBadge(row)"></span></td>
              </tr>
              <!-- Warnings row -->
              <tr x-show="row.warnings && row.warnings.length > 0" class="bg-yellow-500/5">
                <td></td>
                <td colspan="6" class="px-4 pb-2 text-xs text-yellow-400">
                  <i class="fas fa-triangle-exclamation mr-1"></i>
                  <span x-text="row.warnings.join(' · ')"></span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Action panel -->
    <div x-show="importResult && !importLoading" class="glass rounded-xl p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-gray-400">
          <span class="text-white font-semibold" x-text="selectedRowsCount"></span> linha(s) selecionada(s)
          <span x-show="hasIncompleteSelected" class="text-yellow-400 ml-2">
            <i class="fas fa-triangle-exclamation mr-1"></i>Algumas linhas têm campos obrigatórios ausentes
          </span>
        </div>
        <div class="flex gap-2">
          <button @click="runDryRun()" :disabled="batchLaunching || selectedRowsCount === 0"
            class="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
            <i class="fas fa-flask" :class="batchLaunching ? 'fa-spin' : ''"></i>
            Testar (Dry Run)
          </button>
          <button @click="launchSelected()"
            :disabled="batchLaunching || selectedValidRows.length === 0 || hasIncompleteSelected"
            class="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
            <i class="fas fa-rocket" :class="batchLaunching ? 'fa-spin' : ''"></i>
            Lançar Selecionados (<span x-text="selectedValidRows.length"></span>)
          </button>
        </div>
      </div>
    </div>

  </div><!-- /tab planilha -->

</div>

<!-- ── DRY RUN MODAL ── -->
<div x-show="dryRunModal" x-transition class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
  <div class="glass rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[80vh] flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-white font-bold text-lg"><i class="fas fa-flask text-blue-400 mr-2"></i>Resultado do Dry Run</h3>
      <button @click="dryRunModal = false" class="text-gray-400 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
    </div>
    <p class="text-gray-400 text-sm">O que seria criado para cada linha selecionada:</p>
    <div class="overflow-y-auto flex-1 space-y-2">
      <template x-for="job in (dryRunResult?.jobs || [])" :key="job.row_index">
        <div class="bg-gray-800/60 rounded-lg p-3 text-sm">
          <p class="text-white font-semibold" x-text="job.preview?.campaign_name || job.nome_produto"></p>
          <div class="flex flex-wrap gap-3 mt-1.5 text-gray-400 text-xs">
            <span><i class="fas fa-film mr-1"></i><span x-text="job.preview?.videos || 0"></span> vídeo(s)</span>
            <span><i class="fas fa-globe mr-1"></i><span x-text="(job.preview?.countries || []).join(', ')"></span></span>
            <span><i class="fas fa-dollar-sign mr-1"></i>$<span x-text="(job.preview?.budget_diario_usd || 10).toFixed(2)"></span>/dia</span>
            <span><i class="fas fa-wallet mr-1"></i><span x-text="job.preview?.ad_account_id || '—'"></span></span>
          </div>
        </div>
      </template>
    </div>
    <button @click="dryRunModal = false" class="btn-secondary w-full text-sm">Fechar</button>
  </div>
</div>

<!-- ── LAUNCH MODAL ── -->
<div x-show="launchModal" x-transition class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
  <div class="glass rounded-2xl w-full max-w-lg p-6 space-y-5">
    <div class="flex items-center justify-between">
      <h3 class="text-white font-bold text-lg"><i class="fas fa-rocket text-green-400 mr-2"></i>Lançando Campanha</h3>
      <button @click="closeModal()" class="text-gray-400 hover:text-white transition-colors">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Product name -->
    <p class="text-gray-300 text-sm" x-text="currentJob?.product_name"></p>

    <!-- Progress bar -->
    <div>
      <div class="flex justify-between text-xs text-gray-400 mb-1.5">
        <span x-text="currentJob?.step_detail || currentJob?.step || 'Aguardando...'"></span>
        <span x-text="stepProgress() + '%'"></span>
      </div>
      <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500"
          :class="currentJob?.status === 'failed' ? 'bg-red-500' : currentJob?.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'"
          :style="'width:' + stepProgress() + '%'"></div>
      </div>
    </div>

    <!-- Steps -->
    <div class="space-y-2">
      <template x-for="(step, i) in [
        {label: 'Criar Campanha', key: 'creating_campaign'},
        {label: 'Criar Conjunto de Anúncios', key: 'creating_adset'},
        {label: 'Upload de Vídeos', key: 'uploading'},
        {label: 'Criar Criativos', key: 'creating_creative'},
        {label: 'Criar Anúncios', key: 'creating_ad'},
      ]" :key="i">
        <div class="flex items-center gap-2.5 text-sm">
          <template x-if="currentJob?.step?.includes(step.key) && currentJob?.status !== 'completed'">
            <i class="fas fa-spinner fa-spin text-blue-400 w-4"></i>
          </template>
          <template x-if="currentJob?.status === 'completed' || (currentJob && !currentJob.step?.includes(step.key) && currentJob.step !== 'starting' && currentJob.step !== 'queued' && i < 2)">
            <i class="fas fa-check-circle text-green-400 w-4"></i>
          </template>
          <template x-if="currentJob?.step === 'starting' || currentJob?.step === 'queued' || (!currentJob?.step?.includes(step.key) && currentJob?.status !== 'completed' && i >= 2)">
            <i class="fas fa-circle text-gray-600 w-4"></i>
          </template>
          <span :class="currentJob?.step?.includes(step.key) ? 'text-white' : 'text-gray-400'" x-text="step.label"></span>
          <template x-if="step.key === 'uploading' || step.key === 'creating_creative' || step.key === 'creating_ad'">
            <span x-show="currentJob?.total_videos > 0" class="text-xs text-gray-500">
              (<span x-text="currentJob?.completed_videos"></span>/<span x-text="currentJob?.total_videos"></span>)
            </span>
          </template>
        </div>
      </template>
    </div>

    <!-- Result -->
    <div x-show="currentJob?.status === 'completed'" x-transition class="bg-green-600/20 rounded-lg p-4 text-center">
      <i class="fas fa-party-horn text-2xl text-green-400 mb-2"></i>
      <p class="text-green-400 font-semibold">Campanha lançada com sucesso!</p>
      <p class="text-sm text-gray-400 mt-1"><span x-text="currentJob?.ad_ids?.length"></span> anúncios criados · Status: PAUSADO (revise antes de ativar)</p>
      <p x-show="currentJob?.campaign_id" class="text-xs text-gray-500 font-mono mt-1" x-text="'Campaign ID: ' + currentJob?.campaign_id"></p>
    </div>
    <div x-show="currentJob?.status === 'failed'" x-transition class="bg-red-600/20 rounded-lg p-4">
      <p class="text-red-400 font-semibold"><i class="fas fa-triangle-exclamation mr-1"></i>Erro no lançamento</p>
      <p class="text-sm text-gray-400 mt-1" x-text="currentJob?.error"></p>
    </div>

    <button @click="closeModal()"
      :class="currentJob?.status === 'completed' || currentJob?.status === 'failed' ? 'btn-primary w-full' : 'btn-secondary w-full'"
      x-text="currentJob?.status === 'completed' || currentJob?.status === 'failed' ? 'Fechar' : 'Minimizar (continua em background)'">
    </button>
  </div>
</div>
`
  }
}))

}) // end alpine:init
