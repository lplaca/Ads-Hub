// ─── CRIAR CAMPANHA PAGE — Hub Unificado de Criação de Campanhas ─────────────
document.addEventListener('alpine:init', () => {

// ── Templates pré-definidos ───────────────────────────────────────────────────
const CAMPAIGN_TEMPLATES = [
  {
    name: 'ABO Brasil',
    icon: 'fas fa-flag',
    color: '#22c55e',
    description: '1 país, $20/dia, público amplo',
    defaults: { paises_raw: 'BR', budget_diario_usd: 20, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'Multi-País LATAM',
    icon: 'fas fa-globe-americas',
    color: '#3b82f6',
    description: 'BR + MX + CO + AR + CL, $50/dia',
    defaults: { paises_raw: 'BR,MX,CO,AR,CL', budget_diario_usd: 50, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'EUA + Canadá',
    icon: 'fas fa-globe',
    color: '#6366f1',
    description: 'Mercado norte-americano, $30/dia',
    defaults: { paises_raw: 'US,CA', budget_diario_usd: 30, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'Teste Criativo',
    icon: 'fas fa-flask',
    color: '#f59e0b',
    description: 'A/B de criativos, $10/dia, BR',
    defaults: { paises_raw: 'BR', budget_diario_usd: 10, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'LEARN_MORE' },
  },
  {
    name: 'Escala Internacional',
    icon: 'fas fa-rocket',
    color: '#a855f7',
    description: 'BR + MX + US + ES + PT, $100/dia',
    defaults: { paises_raw: 'BR,MX,US,ES,PT', budget_diario_usd: 100, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'Público Masculino',
    icon: 'fas fa-mars',
    color: '#0ea5e9',
    description: 'Homens 25-44, BR, $20/dia',
    defaults: { paises_raw: 'BR', budget_diario_usd: 20, genero: 'M', idade_min: 25, idade_max: 44, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'Público Feminino',
    icon: 'fas fa-venus',
    color: '#ec4899',
    description: 'Mulheres 18-45, BR, $20/dia',
    defaults: { paises_raw: 'BR', budget_diario_usd: 20, genero: 'F', idade_min: 18, idade_max: 45, cta_override: 'SHOP_NOW' },
  },
  {
    name: 'Remarketing',
    icon: 'fas fa-redo',
    color: '#14b8a6',
    description: 'Re-engajamento, $15/dia, LEARN MORE',
    defaults: { paises_raw: 'BR', budget_diario_usd: 15, genero: 'ALL', idade_min: 18, idade_max: 65, cta_override: 'LEARN_MORE' },
  },
];

Alpine.data('CriarCampanhaPage', () => ({
  method: 'manual',    // manual | upload | chat | templates

  // ── Tokens / Configurações compartilhadas ──────────────────────────────────
  tokens: [],
  tokensLoading: false,
  sharedToken: '',
  sharedAdAccountId: '',
  sharedPageId: '',
  sharedPixelId: '',
  sharedCta: 'SHOP_NOW',
  sharedHorario: '00:00',
  sharedSettingsOpen: true,

  // ── Tabela Manual ──────────────────────────────────────────────────────────
  rows: [],
  selectedRowIds: new Set(),

  // ── Upload de Planilha ─────────────────────────────────────────────────────
  isDragging: false,
  importLoading: false,
  importResult: null,
  importError: '',
  importSelectedRows: new Set(),
  dryRunResult: null,
  dryRunModal: false,
  batchLaunching: false,

  // ── Chat IA ────────────────────────────────────────────────────────────────
  chatMessages: [],
  chatInput: '',
  chatParsing: false,
  chatLaunching: false,
  chatLastParsed: null,
  chatInitialized: false,

  // ── Histórico de Jobs ──────────────────────────────────────────────────────
  jobs: [],
  jobsLoading: false,
  showJobs: false,

  // ── Templates ──────────────────────────────────────────────────────────────
  templates: CAMPAIGN_TEMPLATES,

  // ══════════════════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════════════════
  async init() {
    await this.loadTokens()
    this.addRow()         // começa com 1 linha vazia
    await this.loadJobs()
  },

  async loadTokens() {
    this.tokensLoading = true
    try {
      const data = await API.get('/api/assets/tokens')
      this.tokens = data || []
      if (this.tokens.length > 0) {
        this.sharedToken = this.tokens[0].access_token
        this._applySharedToken()
      }
    } catch(e) { this.tokens = [] }
    this.tokensLoading = false
  },

  _applySharedToken() {
    const t = this.tokens.find(t => t.access_token === this.sharedToken)
    if (t) {
      this.sharedAdAccountId = t.ad_account_id || ''
      this.sharedPageId = t.page_id || ''
    }
  },

  _tokenLabel(t) {
    const acct = 'act_' + (t.ad_account_id || '').replace('act_', '')
    return acct + (t.page_id ? ' · pág ' + t.page_id : '')
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TABELA MANUAL
  // ══════════════════════════════════════════════════════════════════════════
  _uid() { return Math.random().toString(36).substr(2, 9) },

  _newRow(defaults) {
    return Object.assign({
      _id: this._uid(),
      nome_produto: '',
      url_destino: '',
      urls_videos_raw: '',
      paises_raw: 'BR',
      budget_diario_usd: 20,
      texto_principal: '',
      titulo: '',
      descricao: '',
      cta_override: '',        // vazio = usa sharedCta
      horario_override: '',    // vazio = usa sharedHorario
      idade_min: 18,
      idade_max: 65,
      genero: 'ALL',
      overrideAccount: false,
      ad_account_id_ov: '',
      page_id_ov: '',
      pixel_id_ov: '',
      access_token_ov: '',
      expanded: false,
      _status: 'idle',         // idle | queued | running | done | error
      _jobId: null,
      _jobDetail: '',
      _error: '',
      _adCount: 0,
    }, defaults || {})
  },

  addRow(defaults) {
    this.rows.push(this._newRow(defaults || {}))
  },

  removeRow(id) {
    this.rows = this.rows.filter(r => r._id !== id)
    const s = new Set(this.selectedRowIds)
    s.delete(id)
    this.selectedRowIds = s
  },

  duplicateRow(id) {
    const orig = this.rows.find(r => r._id === id)
    if (!orig) return
    const copy = this._newRow({
      nome_produto: orig.nome_produto,
      url_destino: orig.url_destino,
      urls_videos_raw: orig.urls_videos_raw,
      paises_raw: orig.paises_raw,
      budget_diario_usd: orig.budget_diario_usd,
      texto_principal: orig.texto_principal,
      titulo: orig.titulo,
      descricao: orig.descricao,
      cta_override: orig.cta_override,
      horario_override: orig.horario_override,
      idade_min: orig.idade_min,
      idade_max: orig.idade_max,
      genero: orig.genero,
    })
    const idx = this.rows.findIndex(r => r._id === id)
    this.rows.splice(idx + 1, 0, copy)
  },

  clearTable() {
    if (!confirm('Limpar todas as linhas da tabela?')) return
    this.rows = []
    this.selectedRowIds = new Set()
    this.addRow()
  },

  toggleRowSelect(id) {
    const s = new Set(this.selectedRowIds)
    if (s.has(id)) { s.delete(id) } else { s.add(id) }
    this.selectedRowIds = s
  },

  get allRowsSelected() {
    return this.rows.length > 0 && this.rows.every(r => this.selectedRowIds.has(r._id))
  },
  toggleSelectAll() {
    if (this.allRowsSelected) this.selectedRowIds = new Set()
    else this.selectedRowIds = new Set(this.rows.map(r => r._id))
  },
  get selectedRows() { return this.rows.filter(r => this.selectedRowIds.has(r._id)) },

  _parseUrls(raw) {
    if (!raw) return []
    return (raw + '').split(/[\n,;|]+/).map(u => u.trim()).filter(u => /^https?:\/\//.test(u))
  },
  _parsePaises(raw) {
    return (raw || 'BR').split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
  },

  _effectiveAccount(row) {
    if (row.overrideAccount) {
      return {
        access_token: row.access_token_ov,
        ad_account_id: row.ad_account_id_ov,
        page_id: row.page_id_ov,
        pixel_id: row.pixel_id_ov,
      }
    }
    return {
      access_token: this.sharedToken,
      ad_account_id: this.sharedAdAccountId,
      page_id: this.sharedPageId,
      pixel_id: this.sharedPixelId,
    }
  },

  _rowErrors(row) {
    const errs = []
    if (!row.nome_produto.trim()) errs.push('nome do produto')
    if (!row.url_destino.trim()) errs.push('URL de destino')
    if (!this._parseUrls(row.urls_videos_raw).length) errs.push('URL(s) de vídeo')
    const acct = this._effectiveAccount(row)
    if (!acct.access_token) errs.push('token de acesso')
    if (!acct.ad_account_id) errs.push('conta de anúncios')
    return errs
  },

  rowIsValid(row) { return this._rowErrors(row).length === 0 },

  _rowPayload(row) {
    const acct = this._effectiveAccount(row)
    return {
      row_index: this.rows.indexOf(row) + 1,
      nome_produto: row.nome_produto,
      url_destino: row.url_destino,
      texto_principal: row.texto_principal,
      titulo: row.titulo,
      descricao: row.descricao,
      cta: row.cta_override || this.sharedCta,
      urls_videos: this._parseUrls(row.urls_videos_raw),
      paises: this._parsePaises(row.paises_raw),
      budget_diario_usd: Number(row.budget_diario_usd) || 20,
      horario_inicio: row.horario_override || this.sharedHorario || '00:00',
      idade_min: Number(row.idade_min) || 18,
      idade_max: Number(row.idade_max) || 65,
      genero: row.genero || 'ALL',
      access_token: acct.access_token,
      ad_account_id: acct.ad_account_id,
      page_id: acct.page_id,
      pixel_id: acct.pixel_id,
      missing_fields: [],
    }
  },

  async launchRow(row) {
    const errs = this._rowErrors(row)
    if (errs.length) {
      toast('error', 'Campos obrigatórios: ' + errs.join(', '))
      row.expanded = true
      return
    }
    row._status = 'queued'
    row._jobDetail = 'Enfileirando...'
    try {
      const r = await API.post('/api/import/launch-batch', {
        rows: [this._rowPayload(row)], dry_run: false,
      })
      const job = r && r.jobs && r.jobs[0]
      if (job && job.job_id) {
        row._jobId = job.job_id
        row._status = 'running'
        this._pollRow(row)
      } else {
        row._status = 'error'
        row._error = (job && job.error) || 'Erro ao enfileirar'
      }
    } catch(e) {
      row._status = 'error'
      row._error = e.message || 'Erro de conexão'
    }
  },

  _pollRow(row) {
    const iv = setInterval(async () => {
      try {
        const job = await API.get('/api/launcher/job/' + row._jobId)
        if (!job) return
        row._jobDetail = job.step_detail || job.step || ''
        if (job.status === 'completed') {
          row._status = 'done'
          row._adCount = (job.ad_ids || []).length
          clearInterval(iv)
          toast('success', '"' + row.nome_produto + '": ' + row._adCount + ' anúncio(s) criado(s)')
          await this.loadJobs()
          this.showJobs = true
        } else if (job.status === 'failed') {
          row._status = 'error'
          row._error = job.error || 'Falha no lançamento'
          clearInterval(iv)
          toast('error', '"' + row.nome_produto + '" falhou')
          await this.loadJobs()
        }
      } catch(e) { clearInterval(iv) }
    }, 3000)
  },

  async launchSelected() {
    const sel = this.selectedRows
    if (!sel.length) { toast('warning', 'Selecione ao menos uma linha'); return }
    const invalid = sel.filter(r => !this.rowIsValid(r))
    if (invalid.length) {
      toast('error', invalid.length + ' linha(s) com campos obrigatórios ausentes — verifique antes de lançar')
      invalid.forEach(r => { r.expanded = true })
      return
    }
    for (const row of sel) await this.launchRow(row)
  },

  rowStatusClass(row) {
    if (row._status === 'done')    return 'border-l-2 border-l-green-500'
    if (row._status === 'error')   return 'border-l-2 border-l-red-500'
    if (row._status === 'running') return 'border-l-2 border-l-blue-500'
    if (row._status === 'queued')  return 'border-l-2 border-l-yellow-500'
    return 'border-l-2 border-l-transparent'
  },

  rowStatusBadge(row) {
    if (row._status === 'done')    return '<span class="px-1.5 py-0.5 rounded text-xs bg-green-600/20 text-green-400"><i class="fas fa-check mr-1"></i>' + row._adCount + ' ads</span>'
    if (row._status === 'error')   return '<span class="px-1.5 py-0.5 rounded text-xs bg-red-600/20 text-red-400" title="' + row._error + '"><i class="fas fa-times mr-1"></i>Erro</span>'
    if (row._status === 'running') return '<span class="px-1.5 py-0.5 rounded text-xs bg-blue-600/20 text-blue-400"><i class="fas fa-spinner fa-spin mr-1"></i>Lançando</span>'
    if (row._status === 'queued')  return '<span class="px-1.5 py-0.5 rounded text-xs bg-yellow-600/20 text-yellow-400"><i class="fas fa-clock mr-1"></i>Fila</span>'
    const errs = this._rowErrors(row)
    if (errs.length)               return '<span class="px-1.5 py-0.5 rounded text-xs bg-orange-600/20 text-orange-400" title="' + errs.join(', ') + '"><i class="fas fa-triangle-exclamation mr-1"></i>Incompleto</span>'
    return '<span class="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-400">Pronto</span>'
  },

  urlCount(row) { return this._parseUrls(row.urls_videos_raw).length },

  // Templates
  useTemplate(tmpl) {
    this.addRow(Object.assign({}, tmpl.defaults))
    this.method = 'manual'
    toast('success', 'Template "' + tmpl.name + '" adicionado à tabela')
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  UPLOAD DE PLANILHA
  // ══════════════════════════════════════════════════════════════════════════
  handleDrop(e) {
    this.isDragging = false
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    if (f) this.processFile(f)
  },
  handleFileSelect(e) {
    const f = e.target.files && e.target.files[0]
    if (f) this.processFile(f)
    e.target.value = ''
  },
  async processFile(file) {
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
    } catch(e) { this.importError = 'Erro de conexão ao enviar arquivo' }
    this.importLoading = false
  },

  isImportRowSelected(ri) { return this.importSelectedRows.has(ri) },
  toggleImportRow(ri) {
    const s = new Set(this.importSelectedRows)
    if (s.has(ri)) { s.delete(ri) } else { s.add(ri) }
    this.importSelectedRows = s
  },
  get importAllSelected() {
    if (!this.importResult || !this.importResult.rows.length) return false
    return this.importResult.rows.every(r => this.importSelectedRows.has(r.row_index))
  },
  toggleImportAll() {
    if (this.importAllSelected) this.importSelectedRows = new Set()
    else this.importSelectedRows = new Set(this.importResult.rows.map(r => r.row_index))
  },
  get importSelectedValid() {
    if (!this.importResult) return []
    return this.importResult.rows.filter(r => this.importSelectedRows.has(r.row_index) && r.missing_fields.length === 0)
  },
  get importHasIncomplete() {
    if (!this.importResult) return false
    return this.importResult.rows.some(r => this.importSelectedRows.has(r.row_index) && r.missing_fields.length > 0)
  },
  importRowBadge(row) {
    if (!row.missing_fields.length)
      return '<span class="px-1.5 py-0.5 rounded text-xs bg-green-600/20 text-green-400">Pronto</span>'
    return '<span class="px-1.5 py-0.5 rounded text-xs bg-yellow-600/20 text-yellow-400" title="' + row.missing_fields.join(', ') + '">Incompleto</span>'
  },
  async runDryRun() {
    const rows = this.importResult ? this.importResult.rows.filter(r => this.importSelectedRows.has(r.row_index)) : []
    if (!rows.length) { toast('warning', 'Nenhuma linha selecionada'); return }
    this.batchLaunching = true
    try {
      const r = await API.post('/api/import/launch-batch', { rows, dry_run: true })
      this.dryRunResult = r
      this.dryRunModal = true
    } catch(e) { toast('error', 'Erro no dry run') }
    this.batchLaunching = false
  },
  async launchImportSelected() {
    if (!this.importSelectedValid.length) { toast('warning', 'Nenhuma linha válida selecionada'); return }
    if (this.importHasIncomplete) { toast('error', 'Desmarque linhas incompletas antes de lançar'); return }
    this.batchLaunching = true
    try {
      const r = await API.post('/api/import/launch-batch', { rows: this.importSelectedValid, dry_run: false })
      const q = (r.jobs || []).filter(j => j.status === 'queued').length
      const err = (r.jobs || []).filter(j => j.status === 'error').length
      toast('success', q + ' campanha(s) enfileirada(s)' + (err ? ' · ' + err + ' erro(s)' : ''))
      if (q > 0) { await this.loadJobs(); this.showJobs = true }
    } catch(e) { toast('error', 'Erro ao lançar em lote') }
    this.batchLaunching = false
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CHAT IA
  // ══════════════════════════════════════════════════════════════════════════
  ensureChatInit() {
    if (this.chatInitialized) return
    this.chatInitialized = true
    this.chatMessages.push({
      role: 'assistant', type: 'text',
      content: 'Olá! Descreva a campanha que deseja criar. Exemplo: "Quero lançar o produto Tênis Runner na conta act_123456, com 3 vídeos do Drive, para México e Brasil, pixel 9876, página 1234, budget $25/dia."',
    })
  },

  async chatSend() {
    const text = this.chatInput.trim()
    if (!text || this.chatParsing) return
    this.chatInput = ''
    this.chatMessages.push({ role: 'user', type: 'text', content: text })
    this.chatParsing = true

    // Acumula contexto completo da conversa
    let context = this.chatMessages.filter(m => m.role === 'user').map(m => m.content).join('\n')

    // Injeta conta selecionada se disponível
    if (this.sharedToken && this.sharedAdAccountId) {
      const hints = ['access_token: ' + this.sharedToken, 'ad_account_id: ' + this.sharedAdAccountId]
      if (this.sharedPageId)  hints.push('page_id: ' + this.sharedPageId)
      if (this.sharedPixelId) hints.push('pixel_id: ' + this.sharedPixelId)
      context += '\n[Configuração ativa: ' + hints.join(', ') + ']'
    }

    try {
      const resp = await fetch('/api/chat-launcher/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: context }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        this.chatMessages.push({ role: 'assistant', type: 'error', content: data.detail || 'Erro ao interpretar' })
      } else {
        this.chatLastParsed = data.parsed
        if (data.ready_to_launch) {
          this.chatMessages.push({
            role: 'assistant', type: 'parsed',
            parsed: data.parsed, confirmation: data.confirmation_text,
          })
        } else {
          const missing = (data.parsed.missing_required || [])
          const clari   = data.parsed.clarification_needed || ''
          let msg = 'Entendi parcialmente. '
          if (missing.length) msg += 'Ainda preciso de: **' + missing.join(', ') + '**. '
          if (clari) msg += clari
          else if (missing.length) msg += 'Por favor, forneça esses dados.'
          this.chatMessages.push({ role: 'assistant', type: 'text', content: msg })
        }
      }
    } catch(e) {
      this.chatMessages.push({ role: 'assistant', type: 'error', content: 'Erro de conexão' })
    }
    this.chatParsing = false
    this.$nextTick(() => {
      const el = document.getElementById('criar-chat-msgs')
      if (el) el.scrollTop = el.scrollHeight
    })
  },

  async chatConfirm() {
    if (!this.chatLastParsed) return
    this.chatLaunching = true
    try {
      const resp = await fetch('/api/chat-launcher/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: this.chatLastParsed }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        this.chatMessages.push({ role: 'assistant', type: 'error', content: data.detail || 'Erro ao lançar' })
      } else {
        this.chatMessages.push({ role: 'assistant', type: 'launched', jobId: data.job_id, productName: data.product_name })
        this.chatLastParsed = null
        await this.loadJobs()
        this.showJobs = true
      }
    } catch(e) {
      this.chatMessages.push({ role: 'assistant', type: 'error', content: 'Erro de conexão ao lançar' })
    }
    this.chatLaunching = false
    this.$nextTick(() => {
      const el = document.getElementById('criar-chat-msgs')
      if (el) el.scrollTop = el.scrollHeight
    })
  },

  chatCancel() {
    this.chatLastParsed = null
    this.chatMessages.push({ role: 'assistant', type: 'text', content: 'Lançamento cancelado. Posso ajudar com outra campanha?' })
  },

  _fmtCampName(p) {
    const country = (p.paises && p.paises[0]) || 'BR'
    const nome = (p.nome_produto || '').toUpperCase()
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return '[' + country + '] [ABO] [' + nome + '] [' + today + ']'
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  JOBS / HISTÓRICO
  // ══════════════════════════════════════════════════════════════════════════
  async loadJobs() {
    this.jobsLoading = true
    try { this.jobs = (await API.get('/api/launcher/jobs?limit=30')) || [] } catch(e) { this.jobs = [] }
    this.jobsLoading = false
  },

  jobIcon(j) {
    if (j.status === 'completed') return '<i class="fas fa-check-circle text-green-400"></i>'
    if (j.status === 'failed')    return '<i class="fas fa-times-circle text-red-400"></i>'
    if (j.status === 'running')   return '<i class="fas fa-spinner fa-spin text-blue-400"></i>'
    return '<i class="fas fa-clock text-gray-400"></i>'
  },

  fmtDate(iso) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════
  renderPage() {
    return `
<div class="p-5 space-y-5">

  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style="background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(59,130,246,0.2));border:1px solid rgba(34,197,94,0.3);">
        <i class="fas fa-plus-circle text-green-400"></i>
      </div>
      <div>
        <h1 class="text-xl font-bold text-white">Criar Campanha</h1>
        <p class="text-gray-400 text-sm">Tabela manual · upload de planilha · chat IA · templates</p>
      </div>
    </div>
    <!-- Jobs toggle -->
    <button @click="showJobs = !showJobs; if(showJobs) loadJobs()"
      class="btn-secondary text-sm flex items-center gap-2">
      <i class="fas fa-history"></i>
      Histórico
      <span x-show="jobs.length > 0" class="px-1.5 py-0.5 rounded-full text-xs bg-white/10" x-text="jobs.length"></span>
    </button>
  </div>

  <!-- ── CONFIGURAÇÕES COMPARTILHADAS ─────────────────────────────────────── -->
  <div class="glass rounded-xl overflow-hidden">
    <button @click="sharedSettingsOpen = !sharedSettingsOpen"
      class="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-300">
        <i class="fas fa-key text-yellow-400 text-xs"></i>
        Configurações Compartilhadas
        <span x-show="sharedAdAccountId" class="font-mono text-xs text-gray-500 ml-1"
          x-text="'act_' + sharedAdAccountId.replace('act_','')"></span>
      </div>
      <i :class="sharedSettingsOpen ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"
        class="text-gray-500 text-xs"></i>
    </button>
    <div x-show="sharedSettingsOpen" x-transition class="border-t border-gray-700/50 p-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Token -->
        <div class="lg:col-span-2">
          <label class="block text-xs text-gray-400 mb-1">Token de Acesso</label>
          <div x-show="tokens.length > 0">
            <select x-model="sharedToken" @change="_applySharedToken()"
              class="input-field w-full text-sm">
              <option value="">— Selecionar token —</option>
              <template x-for="t in tokens" :key="t.access_token">
                <option :value="t.access_token" x-text="_tokenLabel(t)"></option>
              </template>
            </select>
          </div>
          <div x-show="tokens.length === 0 && !tokensLoading">
            <input x-model="sharedToken" type="password" placeholder="Cole o access_token manualmente"
              class="input-field w-full text-sm" />
          </div>
          <p x-show="tokensLoading" class="text-xs text-gray-500 mt-1">
            <i class="fas fa-spinner fa-spin mr-1"></i>Carregando tokens...
          </p>
        </div>
        <!-- Pixel -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Pixel ID padrão</label>
          <input x-model="sharedPixelId" placeholder="Ex: 1234567890" class="input-field w-full text-sm" />
        </div>
        <!-- Account (read-only auto-fill) -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Conta de Anúncios</label>
          <input x-model="sharedAdAccountId" placeholder="act_XXXX ou XXXX" class="input-field w-full text-sm" />
        </div>
        <!-- Page -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Página padrão</label>
          <input x-model="sharedPageId" placeholder="ID da página" class="input-field w-full text-sm" />
        </div>
        <!-- CTA + Horário -->
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="block text-xs text-gray-400 mb-1">CTA padrão</label>
            <select x-model="sharedCta" class="input-field w-full text-sm">
              <option>SHOP_NOW</option><option>LEARN_MORE</option>
              <option>SIGN_UP</option><option>BUY_NOW</option><option>GET_OFFER</option>
            </select>
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-400 mb-1">Início padrão</label>
            <input x-model="sharedHorario" type="time" class="input-field w-full text-sm" />
          </div>
        </div>
      </div>
      <p class="text-xs text-gray-600 mt-3">
        <i class="fas fa-info-circle mr-1"></i>
        Todas as linhas da tabela usarão estas configurações, a menos que você ative "Substituir conta" por linha.
      </p>
    </div>
  </div>

  <!-- ── ABAS DE MÉTODO ──────────────────────────────────────────────────── -->
  <div class="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit flex-wrap">
    <button @click="method='manual'"
      :class="method==='manual' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
      <i class="fas fa-table-cells-large"></i> Tabela Manual
    </button>
    <button @click="method='upload'"
      :class="method==='upload' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
      <i class="fas fa-cloud-upload-alt"></i> Upload Planilha
    </button>
    <button @click="method='chat'; ensureChatInit()"
      :class="method==='chat' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
      <i class="fas fa-comments"></i> Chat IA
    </button>
    <button @click="method='templates'"
      :class="method==='templates' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
      <i class="fas fa-wand-magic-sparkles"></i> Templates
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       TABELA MANUAL
       ══════════════════════════════════════════════════════════════════════ -->
  <div x-show="method==='manual'" class="space-y-3">

    <!-- Toolbar -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2 text-sm text-gray-400">
        <span class="text-white font-semibold" x-text="rows.length"></span> produto(s) na tabela ·
        <span class="text-green-400" x-text="rows.filter(r=>rowIsValid(r)).length"></span> prontos
      </div>
      <div class="flex gap-2 flex-wrap">
        <button @click="addRow()"
          class="btn-secondary text-sm flex items-center gap-1.5">
          <i class="fas fa-plus"></i> Adicionar linha
        </button>
        <button @click="launchSelected()"
          :disabled="!selectedRows.length"
          class="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <i class="fas fa-rocket"></i>
          Lançar selecionados (<span x-text="selectedRows.length"></span>)
        </button>
        <button @click="clearTable()" class="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg" title="Limpar tabela">
          <i class="fas fa-trash text-sm"></i>
        </button>
      </div>
    </div>

    <!-- Rows -->
    <div class="space-y-2">
      <template x-for="row in rows" :key="row._id">
        <div :class="rowStatusClass(row)"
          class="glass rounded-xl transition-all"
          style="border-radius:12px;">

          <!-- Row header (sempre visível) -->
          <div class="grid gap-2 p-3 items-center"
            style="grid-template-columns: 28px 1fr 1fr auto auto auto auto auto;">

            <!-- Checkbox -->
            <input type="checkbox" :checked="selectedRowIds.has(row._id)"
              @change="toggleRowSelect(row._id)"
              class="rounded border-gray-600 text-green-600 bg-gray-700" />

            <!-- Nome do produto -->
            <input x-model="row.nome_produto" placeholder="Nome do produto *"
              class="input-field text-sm font-medium" />

            <!-- URL destino -->
            <input x-model="row.url_destino" placeholder="URL de destino *"
              class="input-field text-sm" />

            <!-- Vídeos (indicador) -->
            <div class="text-center">
              <span class="text-xs px-2 py-1 rounded-lg"
                :class="urlCount(row) > 0 ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700 text-gray-500'"
                x-text="urlCount(row) + ' vid'"></span>
            </div>

            <!-- Países -->
            <input x-model="row.paises_raw" placeholder="BR,MX"
              class="input-field text-sm w-24 text-center" title="Países (ex: BR,MX,CO)" />

            <!-- Budget -->
            <div class="flex items-center gap-1">
              <span class="text-gray-500 text-xs">$</span>
              <input x-model.number="row.budget_diario_usd" type="number" min="1" step="1"
                class="input-field text-sm w-20" title="Budget diário USD" />
            </div>

            <!-- Status badge -->
            <span x-html="rowStatusBadge(row)" class="flex-shrink-0"></span>

            <!-- Actions -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <button @click="row.expanded = !row.expanded"
                :class="row.expanded ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'"
                class="p-1.5 rounded-lg transition-colors" title="Expandir detalhes">
                <i :class="row.expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" class="text-xs"></i>
              </button>
              <button @click="launchRow(row)" :disabled="row._status === 'running' || row._status === 'queued'"
                class="p-1.5 rounded-lg text-green-500 hover:text-green-400 transition-colors disabled:opacity-40"
                title="Lançar esta linha">
                <i class="fas fa-rocket text-sm"></i>
              </button>
              <button @click="duplicateRow(row._id)"
                class="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 transition-colors" title="Duplicar">
                <i class="fas fa-copy text-xs"></i>
              </button>
              <button @click="removeRow(row._id)"
                class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 transition-colors" title="Remover">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>

          <!-- Job progress (when running) -->
          <div x-show="(row._status === 'running' || row._status === 'queued') && row._jobDetail"
            class="px-4 pb-2 text-xs text-blue-400 flex items-center gap-2">
            <i class="fas fa-spinner fa-spin"></i>
            <span x-text="row._jobDetail"></span>
          </div>
          <div x-show="row._status === 'error' && row._error"
            class="px-4 pb-2 text-xs text-red-400 flex items-center gap-2">
            <i class="fas fa-triangle-exclamation"></i>
            <span x-text="row._error"></span>
          </div>

          <!-- Expanded details -->
          <div x-show="row.expanded" x-transition class="border-t border-gray-700/40 px-4 pb-4 pt-3 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

              <!-- URLs dos vídeos -->
              <div class="sm:col-span-2">
                <label class="block text-xs text-gray-400 mb-1">URLs dos Vídeos * (um por linha ou separados por vírgula)</label>
                <textarea x-model="row.urls_videos_raw" rows="3"
                  placeholder="https://drive.google.com/file/...&#10;https://drive.google.com/file/..."
                  class="input-field w-full text-xs resize-none font-mono"></textarea>
                <p class="text-xs text-gray-500 mt-0.5" x-text="urlCount(row) + ' URL(s) detectada(s)'"></p>
              </div>

              <!-- Texto principal -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">Texto Principal</label>
                <textarea x-model="row.texto_principal" rows="3" placeholder="Copy do anúncio..."
                  class="input-field w-full text-xs resize-none"></textarea>
              </div>

              <!-- Título -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">Título / Headline</label>
                <input x-model="row.titulo" placeholder="Título do criativo" class="input-field w-full text-sm" />
              </div>

              <!-- Descrição -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">Descrição</label>
                <input x-model="row.descricao" placeholder="Descrição do anúncio" class="input-field w-full text-sm" />
              </div>

              <!-- CTA override -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">CTA (vazio = usa padrão)</label>
                <select x-model="row.cta_override" class="input-field w-full text-sm">
                  <option value="">Usar padrão (<span x-text="sharedCta"></span>)</option>
                  <option>SHOP_NOW</option><option>LEARN_MORE</option>
                  <option>SIGN_UP</option><option>BUY_NOW</option><option>GET_OFFER</option>
                </select>
              </div>

              <!-- Gênero -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">Gênero</label>
                <select x-model="row.genero" class="input-field w-full text-sm">
                  <option value="ALL">Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              <!-- Idade min / max -->
              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="block text-xs text-gray-400 mb-1">Idade mín</label>
                  <input x-model.number="row.idade_min" type="number" min="13" max="65"
                    class="input-field w-full text-sm text-center" />
                </div>
                <div class="flex-1">
                  <label class="block text-xs text-gray-400 mb-1">Idade máx</label>
                  <input x-model.number="row.idade_max" type="number" min="13" max="65"
                    class="input-field w-full text-sm text-center" />
                </div>
              </div>

              <!-- Horário override -->
              <div>
                <label class="block text-xs text-gray-400 mb-1">Horário início (vazio = usa padrão)</label>
                <input x-model="row.horario_override" type="time" class="input-field w-full text-sm" />
              </div>

            </div>

            <!-- Override de conta -->
            <div>
              <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                <input type="checkbox" x-model="row.overrideAccount"
                  class="rounded border-gray-600 text-green-600 bg-gray-700" />
                Substituir configurações de conta para este produto
              </label>
              <div x-show="row.overrideAccount" x-transition class="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Token</label>
                  <input x-model="row.access_token_ov" type="password" placeholder="access_token"
                    class="input-field w-full text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Conta</label>
                  <input x-model="row.ad_account_id_ov" placeholder="act_XXXX" class="input-field w-full text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Página</label>
                  <input x-model="row.page_id_ov" placeholder="Page ID" class="input-field w-full text-xs" />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Pixel</label>
                  <input x-model="row.pixel_id_ov" placeholder="Pixel ID" class="input-field w-full text-xs" />
                </div>
              </div>
            </div>

          </div><!-- /expanded -->
        </div>
      </template>
    </div>

    <!-- Add row footer -->
    <button @click="addRow()"
      class="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-all text-sm flex items-center justify-center gap-2">
      <i class="fas fa-plus"></i> Adicionar produto
    </button>
  </div><!-- /manual -->

  <!-- ══════════════════════════════════════════════════════════════════════
       UPLOAD DE PLANILHA
       ══════════════════════════════════════════════════════════════════════ -->
  <div x-show="method==='upload'" class="space-y-4">

    <!-- Drop zone -->
    <div class="glass rounded-xl p-5 space-y-4">
      <div
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop($event)"
        :class="isDragging ? 'border-blue-400 bg-blue-600/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/20'"
        class="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer"
        @click="$refs.planilhaFileInput.click()">
        <i class="fas fa-file-excel text-4xl mb-3" :class="isDragging ? 'text-blue-400' : 'text-gray-500'"></i>
        <p class="text-gray-300 font-medium" x-text="isDragging ? 'Solte aqui' : 'Arraste ou clique para selecionar'"></p>
        <p class="text-gray-500 text-sm mt-1">.csv ou .xlsx — colunas detectadas automaticamente</p>
      </div>
      <input x-ref="planilhaFileInput" type="file" accept=".csv,.xlsx" class="hidden" @change="handleFileSelect($event)" />

      <div x-show="importLoading" class="flex items-center gap-2 text-blue-400 text-sm">
        <i class="fas fa-spinner fa-spin"></i> Processando arquivo...
      </div>
      <div x-show="importError" class="flex gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
        <i class="fas fa-triangle-exclamation mt-0.5 flex-shrink-0"></i>
        <span x-text="importError"></span>
      </div>
    </div>

    <!-- Preview -->
    <div x-show="importResult && !importLoading" class="glass rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <span class="text-white font-semibold text-sm" x-text="importResult.total_rows + ' linha(s) detectada(s)'"></span>
          <span class="text-xs text-green-400" x-text="importResult.columns_mapped.length + ' colunas mapeadas'"></span>
        </div>
        <div x-show="importResult.columns_ignored.length > 0"
          class="text-xs text-gray-600"
          x-text="importResult.columns_ignored.length + ' ignorada(s): ' + importResult.columns_ignored.join(', ')">
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[640px]">
          <thead>
            <tr class="border-b border-gray-700/50">
              <th class="px-4 py-2 text-left w-8">
                <input type="checkbox" :checked="importAllSelected" @change="toggleImportAll()"
                  class="rounded border-gray-600 text-blue-600 bg-gray-700" />
              </th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Produto</th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Vídeos</th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Países</th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Budget</th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Conta</th>
              <th class="px-4 py-2 text-left text-gray-400 text-xs font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="row in importResult.rows" :key="row.row_index">
              <tr class="border-b border-gray-700/20 hover:bg-gray-800/30"
                :class="isImportRowSelected(row.row_index) ? 'bg-blue-600/5' : ''">
                <td class="px-4 py-2">
                  <input type="checkbox" :checked="isImportRowSelected(row.row_index)"
                    @change="toggleImportRow(row.row_index)"
                    class="rounded border-gray-600 text-blue-600 bg-gray-700" />
                </td>
                <td class="px-4 py-2 text-white font-medium text-sm" x-text="row.nome_produto || '—'"></td>
                <td class="px-4 py-2">
                  <span class="text-xs bg-gray-700 px-2 py-0.5 rounded"
                    x-text="(row.urls_videos||[]).length + ' url(s)'"></span>
                </td>
                <td class="px-4 py-2 text-gray-400 text-xs" x-text="(row.paises||[]).join(', ')||'—'"></td>
                <td class="px-4 py-2 text-gray-400 text-xs" x-text="'$'+(row.budget_diario_usd||10).toFixed(2)"></td>
                <td class="px-4 py-2 text-gray-500 font-mono text-xs" x-text="row.ad_account_id||'—'"></td>
                <td class="px-4 py-2"><span x-html="importRowBadge(row)"></span></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <!-- Actions -->
      <div class="px-5 py-3 border-t border-gray-700/50 flex items-center justify-between flex-wrap gap-2">
        <span class="text-sm text-gray-400">
          <span class="text-white font-medium" x-text="importSelectedRows.size"></span> selecionada(s) ·
          <span class="text-green-400" x-text="importSelectedValid.length"></span> válida(s)
        </span>
        <div class="flex gap-2">
          <button @click="runDryRun()" :disabled="batchLaunching || importSelectedRows.size === 0"
            class="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <i class="fas fa-flask" :class="batchLaunching ? 'fa-spin' : ''"></i> Testar
          </button>
          <button @click="launchImportSelected()"
            :disabled="batchLaunching || importSelectedValid.length === 0 || importHasIncomplete"
            class="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <i class="fas fa-rocket" :class="batchLaunching ? 'fa-spin' : ''"></i>
            Lançar (<span x-text="importSelectedValid.length"></span>)
          </button>
        </div>
      </div>
    </div>
  </div><!-- /upload -->

  <!-- ══════════════════════════════════════════════════════════════════════
       CHAT IA
       ══════════════════════════════════════════════════════════════════════ -->
  <div x-show="method==='chat'" class="space-y-3">
    <div class="glass rounded-xl p-3">
      <p class="text-xs text-gray-400">
        <i class="fas fa-info-circle text-blue-400 mr-1"></i>
        As configurações compartilhadas (conta, pixel, página) serão incluídas automaticamente no contexto enviado à IA.
      </p>
    </div>

    <!-- Messages -->
    <div id="criar-chat-msgs"
      class="glass rounded-xl p-4 space-y-4 overflow-y-auto"
      style="min-height:300px; max-height:420px;">

      <template x-for="(msg, idx) in chatMessages" :key="idx">
        <div :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">

          <!-- User -->
          <template x-if="msg.role === 'user'">
            <div class="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white"
              style="background:rgba(59,130,246,0.25);border:1px solid rgba(59,130,246,0.3);">
              <span x-text="msg.content"></span>
            </div>
          </template>

          <!-- Assistant: text / error -->
          <template x-if="msg.role === 'assistant' && (msg.type === 'text' || msg.type === 'error')">
            <div class="max-w-[85%] flex gap-3">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                :style="msg.type === 'error' ? 'background:rgba(239,68,68,0.2)' : 'background:rgba(168,85,247,0.2)'">
                <i :class="msg.type === 'error' ? 'fas fa-triangle-exclamation text-red-400' : 'fas fa-robot text-purple-400'" class="text-xs"></i>
              </div>
              <div class="px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex-1"
                :style="msg.type === 'error'
                  ? 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5'
                  : 'background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.4);color:#cbd5e1'">
                <span x-text="msg.content"></span>
              </div>
            </div>
          </template>

          <!-- Assistant: parsed card -->
          <template x-if="msg.role === 'assistant' && msg.type === 'parsed'">
            <div class="w-full space-y-2">
              <p class="text-sm text-green-400 font-medium flex items-center gap-2">
                <i class="fas fa-check-circle"></i>
                <span x-text="msg.confirmation"></span>
              </p>
              <div class="rounded-xl p-4 space-y-2"
                style="background:rgba(30,41,59,0.9);border:1px solid rgba(34,197,94,0.3);">
                <p class="text-white font-semibold text-sm mb-3">
                  <i class="fas fa-rocket text-green-400 mr-2"></i>Parâmetros Extraídos
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  <div><span class="text-gray-500">Campanha: </span><span class="text-white font-mono text-xs" x-text="_fmtCampName(msg.parsed)"></span></div>
                  <div><span class="text-gray-500">Vídeos: </span><span class="text-white" x-text="(msg.parsed.urls_videos||[]).length"></span></div>
                  <div><span class="text-gray-500">Países: </span><span class="text-white" x-text="(msg.parsed.paises||[]).join(', ')||'—'"></span></div>
                  <div><span class="text-gray-500">Budget: </span><span class="text-white" x-text="'$'+(msg.parsed.budget_diario_usd||10).toFixed(2)+'/dia'"></span></div>
                  <div><span class="text-gray-500">Conta: </span><span class="text-white font-mono text-xs" x-text="msg.parsed.ad_account_id||'—'"></span></div>
                  <div><span class="text-gray-500">Pixel: </span><span class="text-white font-mono text-xs" x-text="msg.parsed.pixel_id||'—'"></span></div>
                  <div><span class="text-gray-500">Página: </span><span class="text-white font-mono text-xs" x-text="msg.parsed.page_id||'—'"></span></div>
                  <div><span class="text-gray-500">CTA: </span><span class="text-white" x-text="msg.parsed.cta||'SHOP_NOW'"></span></div>
                  <div><span class="text-gray-500">Início: </span><span class="text-white" x-text="msg.parsed.horario_inicio||'00:00'"></span></div>
                </div>
              </div>
              <!-- Action buttons — only for the last parsed message -->
              <div x-show="chatLastParsed && idx === chatMessages.length - 1" class="flex gap-2">
                <button @click="chatConfirm()" :disabled="chatLaunching"
                  class="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                  <i class="fas fa-rocket" :class="chatLaunching ? 'fa-spin' : ''"></i>
                  <span x-text="chatLaunching ? 'Lançando...' : 'Confirmar e Lançar'"></span>
                </button>
                <button @click="chatCancel()" class="btn-secondary text-sm">Cancelar</button>
              </div>
            </div>
          </template>

          <!-- Assistant: launched -->
          <template x-if="msg.role === 'assistant' && msg.type === 'launched'">
            <div class="flex gap-3 max-w-[85%]">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style="background:rgba(34,197,94,0.2);">
                <i class="fas fa-check-circle text-green-400 text-xs"></i>
              </div>
              <div class="px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
                style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);">
                <p class="text-green-400 font-semibold">Campanha enfileirada!</p>
                <p class="text-gray-400 mt-0.5">Produto: <span class="text-white" x-text="msg.productName"></span></p>
                <p class="text-gray-500 text-xs font-mono mt-0.5" x-text="'Job: ' + msg.jobId"></p>
                <button @click="showJobs = true; loadJobs()" class="mt-1 text-xs text-blue-400 hover:underline">
                  Ver histórico de jobs ↓
                </button>
              </div>
            </div>
          </template>

        </div>
      </template>

      <!-- Typing indicator -->
      <div x-show="chatParsing" class="flex justify-start">
        <div class="flex gap-3">
          <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style="background:rgba(168,85,247,0.2);">
            <i class="fas fa-robot text-purple-400 text-xs"></i>
          </div>
          <div class="px-4 py-3 rounded-2xl rounded-tl-sm"
            style="background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.4);">
            <div class="flex gap-1 items-center">
              <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:0ms"></div>
              <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:150ms"></div>
              <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:300ms"></div>
              <span class="text-gray-400 text-xs ml-1">Interpretando...</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="flex gap-3">
      <textarea x-model="chatInput" @keydown.enter.prevent="if(!$event.shiftKey) chatSend()"
        :disabled="chatParsing || chatLaunching"
        placeholder="Descreva a campanha... (Enter envia · Shift+Enter nova linha)"
        rows="2"
        class="input-field flex-1 text-sm resize-none disabled:opacity-50"></textarea>
      <button @click="chatSend()" :disabled="chatParsing || chatLaunching || !chatInput.trim()"
        class="btn-primary px-4 flex-shrink-0 disabled:opacity-50 self-end" style="height:44px;">
        <i class="fas fa-paper-plane" :class="chatParsing ? 'fa-spin' : ''"></i>
      </button>
    </div>
  </div><!-- /chat -->

  <!-- ══════════════════════════════════════════════════════════════════════
       TEMPLATES
       ══════════════════════════════════════════════════════════════════════ -->
  <div x-show="method==='templates'">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <template x-for="tmpl in templates" :key="tmpl.name">
        <button @click="useTemplate(tmpl)"
          class="glass rounded-xl p-4 text-left hover:scale-[1.02] transition-all group border border-transparent hover:border-white/10">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
            :style="'background:' + tmpl.color + '20; border:1px solid ' + tmpl.color + '40'">
            <i :class="tmpl.icon" :style="'color:' + tmpl.color"></i>
          </div>
          <p class="text-white font-semibold text-sm" x-text="tmpl.name"></p>
          <p class="text-gray-400 text-xs mt-1 leading-relaxed" x-text="tmpl.description"></p>
          <div class="mt-3 flex items-center gap-1 text-xs"
            :style="'color:' + tmpl.color">
            <i class="fas fa-plus text-xs"></i> Adicionar à tabela
          </div>
        </button>
      </template>
    </div>
    <p class="text-xs text-gray-600 mt-4 text-center">
      <i class="fas fa-info-circle mr-1"></i>
      Clique em um template para adicioná-lo à Tabela Manual com as configurações pré-preenchidas.
      Você ainda poderá editar todos os campos.
    </p>
  </div><!-- /templates -->

  <!-- ══════════════════════════════════════════════════════════════════════
       HISTÓRICO DE JOBS (colapsável)
       ══════════════════════════════════════════════════════════════════════ -->
  <div x-show="showJobs" x-transition class="glass rounded-xl overflow-hidden">
    <div class="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between">
      <h3 class="text-white font-semibold text-sm flex items-center gap-2">
        <i class="fas fa-history text-gray-400"></i> Histórico de Lançamentos
      </h3>
      <div class="flex gap-2">
        <button @click="loadJobs()" class="text-gray-500 hover:text-gray-300 transition-colors p-1">
          <i class="fas fa-rotate text-xs" :class="jobsLoading ? 'fa-spin' : ''"></i>
        </button>
        <button @click="showJobs = false" class="text-gray-500 hover:text-gray-300 transition-colors p-1">
          <i class="fas fa-times text-xs"></i>
        </button>
      </div>
    </div>
    <div x-show="jobsLoading" class="px-5 py-4 text-sm text-gray-500">
      <i class="fas fa-spinner fa-spin mr-2"></i>Carregando...
    </div>
    <div x-show="!jobsLoading && jobs.length === 0" class="px-5 py-6 text-center text-gray-500 text-sm">
      Nenhum lançamento ainda
    </div>
    <div class="divide-y divide-gray-700/30 max-h-72 overflow-y-auto">
      <template x-for="j in jobs" :key="j.id">
        <div class="flex items-center justify-between px-5 py-2.5 hover:bg-gray-800/30 transition-colors">
          <div class="flex items-center gap-3">
            <span x-html="jobIcon(j)"></span>
            <div>
              <p class="text-white text-sm font-medium" x-text="j.product_name || j.product_id"></p>
              <p class="text-gray-500 text-xs" x-text="j.step_detail || j.step"></p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p x-show="j.ad_ids && j.ad_ids.length > 0" class="text-xs text-green-400">
              <i class="fas fa-ad mr-1"></i><span x-text="j.ad_ids.length"></span> anúncios
            </p>
            <p class="text-xs text-gray-600 mt-0.5" x-text="fmtDate(j.started_at)"></p>
          </div>
        </div>
      </template>
    </div>
  </div>

</div>

<!-- ── DRY RUN MODAL ── -->
<div x-show="dryRunModal" x-transition
  class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
  <div class="glass rounded-2xl w-full max-w-xl p-6 space-y-4 max-h-[80vh] flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-white font-bold"><i class="fas fa-flask text-blue-400 mr-2"></i>Dry Run — Preview</h3>
      <button @click="dryRunModal = false" class="text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <p class="text-gray-400 text-sm">Campanhas que seriam criadas:</p>
    <div class="overflow-y-auto flex-1 space-y-2">
      <template x-for="job in (dryRunResult && dryRunResult.jobs || [])" :key="job.row_index">
        <div class="bg-gray-800/60 rounded-lg p-3 text-sm">
          <p class="text-white font-semibold" x-text="job.preview && job.preview.campaign_name"></p>
          <div class="flex flex-wrap gap-3 mt-1.5 text-gray-400 text-xs">
            <span><i class="fas fa-film mr-1"></i><span x-text="job.preview && job.preview.videos || 0"></span> vídeo(s)</span>
            <span><i class="fas fa-globe mr-1"></i><span x-text="job.preview && (job.preview.countries||[]).join(', ')"></span></span>
            <span><i class="fas fa-dollar-sign mr-1"></i>$<span x-text="job.preview && (job.preview.budget_diario_usd||10).toFixed(2)"></span>/dia</span>
          </div>
        </div>
      </template>
    </div>
    <button @click="dryRunModal = false" class="btn-secondary w-full text-sm">Fechar</button>
  </div>
</div>
`
  },
}))

}) // end alpine:init
