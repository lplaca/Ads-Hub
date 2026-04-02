// ─── CHAT LAUNCHER PAGE — Lançar Campanhas via Linguagem Natural ─────────────
document.addEventListener('alpine:init', () => {

Alpine.data('ChatLauncherPage', () => ({
  messages: [],        // { role: 'user'|'assistant', content: '...', type: '...' }
  inputText: '',
  parsing: false,
  launching: false,
  lastParsed: null,    // last parsed object from API
  lastJobId: null,
  lastProductName: '',

  // Token selector (optional — user can also include token in message)
  availableTokens: [],
  selectedToken: '',

  async init() {
    await this.loadTokens()
    this._pushAssistant(
      'Olá! Descreva a campanha que deseja criar em linguagem natural. ' +
      'Exemplo: "Quero subir uma campanha para o produto X na conta act_123456, ' +
      'com 3 vídeos, segmentado para México e Colômbia, budget de $20/dia, ' +
      'pixel 987654321, página 111222333."',
      'intro'
    )
  },

  async loadTokens() {
    try {
      const data = await API.get('/api/assets/tokens')
      this.availableTokens = data || []
      if (this.availableTokens.length > 0) {
        this.selectedToken = this.availableTokens[0].access_token
      }
    } catch(e) { this.availableTokens = [] }
  },

  _tokenLabel(t) {
    const acct = t.ad_account_id ? 'act_' + t.ad_account_id.replace('act_', '') : t.config_id
    return 'Conta: ' + acct + (t.page_id ? ' (pág: ' + t.page_id + ')' : '')
  },

  _pushUser(text) {
    this.messages.push({ role: 'user', content: text, type: 'text' })
  },
  _pushAssistant(text, type) {
    this.messages.push({ role: 'assistant', content: text, type: type || 'text' })
  },
  _pushParsed(parsed, confirmation) {
    this.messages.push({ role: 'assistant', content: '', type: 'parsed', parsed, confirmation })
  },
  _pushLaunched(jobId, productName) {
    this.messages.push({ role: 'assistant', content: '', type: 'launched', jobId, productName })
  },

  // Build full context from conversation for the parse endpoint
  _buildContext() {
    const parts = this.messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
    return parts.join('\n')
  },

  async sendMessage() {
    const text = this.inputText.trim()
    if (!text || this.parsing) return
    this.inputText = ''
    this._pushUser(text)
    await this.parseMessage()
  },

  async parseMessage() {
    this.parsing = true
    // Build accumulated context
    const context = this._buildContext()

    // Optionally inject selected token
    let message = context
    if (this.selectedToken) {
      // Find matching account info to inject
      const t = this.availableTokens.find(t => t.access_token === this.selectedToken)
      if (t && !message.includes(t.ad_account_id || 'NADA')) {
        const acctHint = []
        if (t.ad_account_id) acctHint.push('ad_account_id: ' + t.ad_account_id)
        if (t.page_id)       acctHint.push('page_id: ' + t.page_id)
        if (t.access_token)  acctHint.push('access_token: ' + t.access_token)
        if (acctHint.length) message = message + '\n[Contexto de conta selecionada: ' + acctHint.join(', ') + ']'
      }
    }

    try {
      const resp = await fetch('/api/chat-launcher/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      const data = await resp.json()
      if (!resp.ok) {
        this._pushAssistant('Erro: ' + (data.detail || 'Falha ao interpretar mensagem'), 'error')
        this.parsing = false
        return
      }

      this.lastParsed = data.parsed

      if (data.ready_to_launch) {
        this._pushParsed(data.parsed, data.confirmation_text)
      } else {
        const missing = data.parsed.missing_required || []
        const clarification = data.parsed.clarification_needed || ''

        let msg = 'Entendi parte das informações. '
        if (missing.length) msg += 'Ainda preciso de: **' + missing.join(', ') + '**. '
        if (clarification) msg += clarification
        else if (missing.length) msg += 'Por favor, forneça essas informações.'

        // Show partial parsed as summary
        this._pushAssistant(msg, 'clarification')

        // Also push extracted fields summary
        const extracted = Object.entries(data.parsed)
          .filter(([k]) => !['missing_required','clarification_needed','confidence'].includes(k))
          .filter(([_, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
          .map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v))
          .join(' · ')
        if (extracted) {
          this.messages.push({ role: 'assistant', content: extracted, type: 'fields' })
        }
      }
    } catch(e) {
      this._pushAssistant('Erro de conexão ao interpretar mensagem.', 'error')
    }
    this.parsing = false
    this.$nextTick(() => this._scrollToBottom())
  },

  async confirmLaunch() {
    if (!this.lastParsed) return
    this.launching = true
    try {
      const resp = await fetch('/api/chat-launcher/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: this.lastParsed })
      })
      const data = await resp.json()
      if (!resp.ok) {
        this._pushAssistant('Erro ao lançar: ' + (data.detail || 'Erro desconhecido'), 'error')
      } else {
        this.lastJobId = data.job_id
        this.lastProductName = data.product_name
        this._pushLaunched(data.job_id, data.product_name)
        this.lastParsed = null
      }
    } catch(e) {
      this._pushAssistant('Erro de conexão ao lançar campanha.', 'error')
    }
    this.launching = false
    this.$nextTick(() => this._scrollToBottom())
  },

  cancelLaunch() {
    this._pushAssistant('Lançamento cancelado. Posso ajudar com outra campanha?', 'text')
    this.lastParsed = null
    this.$nextTick(() => this._scrollToBottom())
  },

  _scrollToBottom() {
    const el = document.getElementById('chat-launcher-messages')
    if (el) el.scrollTop = el.scrollHeight
  },

  fmtBudget(v) { return '$' + Number(v || 10).toFixed(2) },
  fmtCampName(p) {
    const nome = (p.nome_produto || '').toUpperCase()
    const country = (p.paises && p.paises[0]) || 'BR'
    const today = new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})
    return '[' + country + '] [ABO] [' + nome + '] [' + today + ']'
  },

  renderPage() {
    return `
<div class="p-6 space-y-5 max-w-3xl mx-auto">

  <!-- Header -->
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);">
      <i class="fas fa-comments text-purple-400"></i>
    </div>
    <div>
      <h1 class="text-xl font-bold text-white">Lançar via Chat</h1>
      <p class="text-gray-400 text-sm">Descreva sua campanha em linguagem natural e a IA extrai os parâmetros</p>
    </div>
  </div>

  <!-- Token selector -->
  <div x-show="availableTokens.length > 0" class="glass rounded-xl p-4">
    <div class="flex items-center gap-3">
      <i class="fas fa-key text-yellow-400 text-sm flex-shrink-0"></i>
      <label class="text-sm text-gray-400 whitespace-nowrap">Conta padrão:</label>
      <select x-model="selectedToken" class="input-field flex-1 text-sm">
        <option value="">Sem pré-seleção (informe no chat)</option>
        <template x-for="t in availableTokens" :key="t.access_token">
          <option :value="t.access_token" x-text="_tokenLabel(t)"></option>
        </template>
      </select>
    </div>
    <p class="text-xs text-gray-500 mt-2 ml-6">As informações desta conta serão incluídas automaticamente no contexto enviado à IA</p>
  </div>

  <!-- Chat messages -->
  <div id="chat-launcher-messages" class="glass rounded-xl p-4 space-y-4 overflow-y-auto" style="max-height:480px;">
    <template x-for="(msg, idx) in messages" :key="idx">
      <div :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">

        <!-- User message -->
        <template x-if="msg.role === 'user'">
          <div class="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white"
            style="background:rgba(59,130,246,0.25);border:1px solid rgba(59,130,246,0.3);">
            <span x-text="msg.content"></span>
          </div>
        </template>

        <!-- Assistant: text / intro / clarification / error -->
        <template x-if="msg.role === 'assistant' && ['text','intro','clarification','error','fields'].includes(msg.type)">
          <div class="max-w-[85%] flex gap-3">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              :style="msg.type === 'error' ? 'background:rgba(239,68,68,0.2)' : 'background:rgba(168,85,247,0.2)'">
              <i :class="msg.type === 'error' ? 'fas fa-triangle-exclamation text-red-400' : 'fas fa-robot text-purple-400'" class="text-xs"></i>
            </div>
            <div class="px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex-1"
              :style="msg.type === 'error'
                ? 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5'
                : msg.type === 'fields'
                  ? 'background:rgba(51,65,85,0.4);border:1px solid rgba(51,65,85,0.5);color:#94a3b8;font-family:monospace;font-size:11px'
                  : 'background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.4);color:#cbd5e1'">
              <span x-text="msg.content"></span>
            </div>
          </div>
        </template>

        <!-- Assistant: parsed confirmation card -->
        <template x-if="msg.role === 'assistant' && msg.type === 'parsed'">
          <div class="max-w-[90%] w-full space-y-3">
            <div class="flex gap-3">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style="background:rgba(34,197,94,0.2);">
                <i class="fas fa-check text-green-400 text-xs"></i>
              </div>
              <p class="text-sm text-green-400 font-medium mt-1" x-text="msg.confirmation"></p>
            </div>

            <!-- Parameters card -->
            <div class="rounded-xl p-4 space-y-3 ml-10"
              style="background:rgba(30,41,59,0.9);border:1px solid rgba(34,197,94,0.3);">
              <p class="text-white font-semibold text-sm">
                <i class="fas fa-rocket text-green-400 mr-2"></i>
                Parâmetros Extraídos
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Nome da Campanha</span>
                  <span class="text-white font-mono" x-text="fmtCampName(msg.parsed)"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Vídeos</span>
                  <span class="text-white" x-text="(msg.parsed.urls_videos || []).length + ' vídeo(s)'"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Países</span>
                  <span class="text-white" x-text="(msg.parsed.paises || []).join(', ') || '—'"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Budget Diário</span>
                  <span class="text-white" x-text="fmtBudget(msg.parsed.budget_diario_usd)"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Conta de Anúncios</span>
                  <span class="text-white font-mono" x-text="msg.parsed.ad_account_id || '—'"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">ID da Página</span>
                  <span class="text-white font-mono" x-text="msg.parsed.page_id || '—'"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Pixel</span>
                  <span class="text-white font-mono" x-text="msg.parsed.pixel_id || '—'"></span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-gray-500">Horário de Início</span>
                  <span class="text-white" x-text="msg.parsed.horario_inicio || '00:00'"></span>
                </div>
                <div x-show="msg.parsed.texto_principal" class="flex flex-col gap-0.5 col-span-2">
                  <span class="text-gray-500">Texto Principal</span>
                  <span class="text-white" x-text="msg.parsed.texto_principal"></span>
                </div>
              </div>
            </div>

            <!-- Action buttons (only for the last parsed message) -->
            <div x-show="lastParsed && idx === messages.length - 1" class="flex gap-2 ml-10">
              <button @click="confirmLaunch()" :disabled="launching"
                class="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                <i class="fas fa-rocket" :class="launching ? 'fa-spin' : ''"></i>
                <span x-text="launching ? 'Lançando...' : 'Confirmar e Lançar'"></span>
              </button>
              <button @click="cancelLaunch()" :disabled="launching"
                class="btn-secondary text-sm disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        </template>

        <!-- Assistant: launched confirmation -->
        <template x-if="msg.role === 'assistant' && msg.type === 'launched'">
          <div class="max-w-[85%] flex gap-3">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style="background:rgba(34,197,94,0.2);">
              <i class="fas fa-check-circle text-green-400 text-xs"></i>
            </div>
            <div class="px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
              style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);">
              <p class="text-green-400 font-semibold">Campanha enfileirada com sucesso!</p>
              <p class="text-gray-400 mt-1">Produto: <span class="text-white" x-text="msg.productName"></span></p>
              <p class="text-gray-400 text-xs mt-1 font-mono">Job ID: <span x-text="msg.jobId"></span></p>
              <button @click="$dispatch('navigate',{page:'importar'})"
                class="mt-2 text-blue-400 hover:text-blue-300 text-xs underline">
                Acompanhar em Importar → Histórico
              </button>
            </div>
          </div>
        </template>

      </div>
    </template>

    <!-- Typing indicator -->
    <div x-show="parsing" class="flex justify-start">
      <div class="flex gap-3">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style="background:rgba(168,85,247,0.2);">
          <i class="fas fa-robot text-purple-400 text-xs"></i>
        </div>
        <div class="px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
          style="background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.4);">
          <div class="flex gap-1 items-center">
            <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:0ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:150ms"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style="animation-delay:300ms"></div>
            <span class="text-gray-400 ml-1 text-xs">Interpretando...</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Input area -->
  <div class="flex gap-3">
    <textarea
      x-model="inputText"
      @keydown.enter.prevent="if(!$event.shiftKey) sendMessage()"
      :disabled="parsing || launching"
      placeholder="Descreva a campanha... (Enter para enviar, Shift+Enter para nova linha)"
      rows="2"
      class="input-field flex-1 text-sm resize-none disabled:opacity-50"></textarea>
    <button @click="sendMessage()" :disabled="parsing || launching || !inputText.trim()"
      class="btn-primary px-4 flex-shrink-0 disabled:opacity-50 self-end"
      style="height:44px;">
      <i class="fas fa-paper-plane" :class="parsing ? 'fa-spin' : ''"></i>
    </button>
  </div>

  <p class="text-xs text-gray-600 text-center">
    <i class="fas fa-info-circle mr-1"></i>
    Campos obrigatórios para lançar: nome_produto, urls_videos, url_destino, access_token, ad_account_id
  </p>

</div>
`
  }
}))

}) // end alpine:init
