// ─── ATIVOS PAGE — Meta Assets Summary ──────────────────────────────────────
document.addEventListener('alpine:init', () => {

Alpine.data('AssetsPage', () => ({
  // Token selector
  tokens: [],
  selectedToken: '',
  selectedTokenLabel: '',
  tokensLoading: false,

  // Summary state
  loading: false,
  error: '',
  summary: null,   // { business_managers, ad_accounts, pages, token_owner }

  async init() {
    await this.loadTokens()
  },

  async loadTokens() {
    this.tokensLoading = true
    try {
      const data = await API.get('/api/assets/tokens')
      this.tokens = data || []
      // Auto-select first token
      if (this.tokens.length > 0 && !this.selectedToken) {
        this.selectedToken = this.tokens[0].access_token
        this.selectedTokenLabel = this._tokenLabel(this.tokens[0])
        await this.loadSummary()
      }
    } catch(e) {
      this.tokens = []
    }
    this.tokensLoading = false
  },

  _tokenLabel(t) {
    const acct = t.ad_account_id ? `act_${t.ad_account_id.replace('act_', '')}` : t.config_id
    const page = t.page_id ? ` (página: ${t.page_id})` : ''
    return `Conta: ${acct}${page}`
  },

  async onTokenChange() {
    if (!this.selectedToken) return
    const found = this.tokens.find(t => t.access_token === this.selectedToken)
    this.selectedTokenLabel = found ? this._tokenLabel(found) : ''
    await this.loadSummary()
  },

  async loadSummary() {
    if (!this.selectedToken) return
    this.loading = true
    this.error = ''
    this.summary = null
    try {
      const resp = await fetch(`/api/assets/summary?token=${encodeURIComponent(this.selectedToken)}`)
      const data = await resp.json()
      if (!resp.ok) {
        this.error = data.detail || 'Erro ao buscar ativos'
      } else {
        this.summary = data
      }
    } catch(e) {
      this.error = 'Erro de conexão ao buscar ativos'
    }
    this.loading = false
  },

  // Status numérico Meta → texto
  adAccountStatusLabel(code) {
    const map = { 1: 'Ativo', 2: 'Desativado', 3: 'Não confirmado', 7: 'Pendente' }
    return map[code] || `Status ${code}`
  },
  adAccountStatusClass(code) {
    if (code === 1) return 'bg-green-600/20 text-green-400'
    if (code === 2) return 'bg-red-600/20 text-red-400'
    if (code === 3) return 'bg-yellow-600/20 text-yellow-400'
    return 'bg-gray-600/20 text-gray-400'
  },

  fmtDate(iso) {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
  },

  // ── Skeleton row helper ──
  get skeletonRows() { return [1, 2, 3] },

  renderPage() {
    return `
<div class="p-6 space-y-6">

  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-white">Ativos Conectados</h1>
      <p class="text-gray-400 text-sm mt-1">Business Managers, Contas de Anúncios e Páginas vinculadas ao token Meta</p>
    </div>
    <button @click="loadSummary()" :disabled="loading || !selectedToken"
      class="btn-primary flex items-center gap-2 disabled:opacity-50">
      <i class="fas fa-rotate" :class="loading ? 'fa-spin' : ''"></i>
      Atualizar
    </button>
  </div>

  <!-- Token selector -->
  <div class="glass rounded-xl p-5">
    <h3 class="text-white font-semibold mb-3"><i class="fas fa-key text-yellow-400 mr-2"></i>Selecionar Token</h3>

    <div x-show="tokensLoading" class="text-gray-400 text-sm flex items-center gap-2">
      <i class="fas fa-spinner fa-spin"></i> Carregando tokens...
    </div>

    <div x-show="!tokensLoading && tokens.length === 0" class="text-gray-400 text-sm">
      <i class="fas fa-info-circle mr-1"></i>
      Nenhum token configurado. Sincronize uma planilha primeiro em
      <button @click="$dispatch('navigate',{page:'importar'})" class="text-blue-400 hover:underline ml-1">Importar</button>.
    </div>

    <div x-show="!tokensLoading && tokens.length > 0" class="flex flex-col sm:flex-row gap-3">
      <select x-model="selectedToken" @change="onTokenChange()"
        class="input-field flex-1 text-sm">
        <option value="">— Selecione um token —</option>
        <template x-for="t in tokens" :key="t.access_token">
          <option :value="t.access_token" x-text="_tokenLabel(t)"></option>
        </template>
      </select>
    </div>

    <!-- Token owner info -->
    <div x-show="summary && summary.token_owner" class="mt-3 flex items-center gap-2 text-sm text-gray-400">
      <i class="fas fa-user-circle text-blue-400"></i>
      Conectado como:
      <span class="text-white font-medium" x-text="summary?.token_owner?.name"></span>
      <span class="font-mono text-gray-500 text-xs" x-text="'(ID: ' + (summary?.token_owner?.id || '') + ')'"></span>
    </div>
  </div>

  <!-- Error -->
  <div x-show="error" x-transition class="glass rounded-xl p-4 border border-red-500/40 flex items-start gap-3">
    <i class="fas fa-triangle-exclamation text-red-400 mt-0.5 flex-shrink-0"></i>
    <div>
      <p class="text-red-400 font-semibold text-sm">Erro ao buscar ativos</p>
      <p class="text-gray-400 text-sm mt-0.5" x-text="error"></p>
    </div>
  </div>

  <!-- ── BUSINESS MANAGERS ── -->
  <div class="glass rounded-xl overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-700/50 flex items-center gap-3">
      <i class="fas fa-building text-blue-400"></i>
      <h3 class="text-white font-semibold">Business Managers</h3>
      <span x-show="summary" class="ml-auto text-sm text-gray-400"
        x-text="(summary?.business_managers?.length || 0) + ' encontrado(s)'"></span>
    </div>

    <!-- Loading skeleton -->
    <div x-show="loading">
      <template x-for="i in skeletonRows" :key="i">
        <div class="flex gap-4 px-5 py-3 border-b border-gray-700/30 animate-pulse">
          <div class="h-4 bg-gray-700 rounded flex-1"></div>
          <div class="h-4 bg-gray-700 rounded w-32"></div>
          <div class="h-4 bg-gray-700 rounded w-24"></div>
        </div>
      </template>
    </div>

    <!-- Empty -->
    <div x-show="!loading && summary && summary.business_managers.length === 0"
      class="px-5 py-8 text-center text-gray-500">
      <i class="fas fa-building text-3xl mb-2"></i>
      <p>Nenhum Business Manager encontrado</p>
    </div>

    <!-- Table -->
    <div x-show="!loading && summary && summary.business_managers.length > 0" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-700/50">
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Nome</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">BM ID</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Criado em</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <template x-for="bm in (summary?.business_managers || [])" :key="bm.id">
            <tr class="border-b border-gray-700/20 hover:bg-gray-800/30 transition-colors">
              <td class="px-5 py-3 text-white font-medium" x-text="bm.name"></td>
              <td class="px-5 py-3 text-gray-400 font-mono text-xs" x-text="bm.id"></td>
              <td class="px-5 py-3 text-gray-400" x-text="fmtDate(bm.created_time)"></td>
              <td class="px-5 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs bg-green-600/20 text-green-400">Conectado</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── CONTAS DE ANÚNCIOS ── -->
  <div class="glass rounded-xl overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-700/50 flex items-center gap-3">
      <i class="fas fa-wallet text-purple-400"></i>
      <h3 class="text-white font-semibold">Contas de Anúncios</h3>
      <span x-show="summary" class="ml-auto text-sm text-gray-400"
        x-text="(summary?.ad_accounts?.length || 0) + ' encontrada(s)'"></span>
    </div>

    <!-- Loading skeleton -->
    <div x-show="loading">
      <template x-for="i in skeletonRows" :key="i">
        <div class="flex gap-4 px-5 py-3 border-b border-gray-700/30 animate-pulse">
          <div class="h-4 bg-gray-700 rounded flex-1"></div>
          <div class="h-4 bg-gray-700 rounded w-32"></div>
          <div class="h-4 bg-gray-700 rounded w-20"></div>
          <div class="h-4 bg-gray-700 rounded w-16"></div>
          <div class="h-4 bg-gray-700 rounded w-28"></div>
        </div>
      </template>
    </div>

    <!-- Empty -->
    <div x-show="!loading && summary && summary.ad_accounts.length === 0"
      class="px-5 py-8 text-center text-gray-500">
      <i class="fas fa-wallet text-3xl mb-2"></i>
      <p>Nenhuma conta de anúncios encontrada</p>
    </div>

    <!-- Table -->
    <div x-show="!loading && summary && summary.ad_accounts.length > 0" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-700/50">
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Nome</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">ID da Conta</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Status</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Moeda</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Fuso Horário</th>
          </tr>
        </thead>
        <tbody>
          <template x-for="acc in (summary?.ad_accounts || [])" :key="acc.id">
            <tr class="border-b border-gray-700/20 hover:bg-gray-800/30 transition-colors">
              <td class="px-5 py-3 text-white font-medium" x-text="acc.name"></td>
              <td class="px-5 py-3 text-gray-400 font-mono text-xs" x-text="acc.id"></td>
              <td class="px-5 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs"
                  :class="adAccountStatusClass(acc.account_status)"
                  x-text="adAccountStatusLabel(acc.account_status)"></span>
              </td>
              <td class="px-5 py-3 text-gray-400" x-text="acc.currency || '—'"></td>
              <td class="px-5 py-3 text-gray-400 text-xs" x-text="acc.timezone_name || '—'"></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── PÁGINAS ── -->
  <div class="glass rounded-xl overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-700/50 flex items-center gap-3">
      <i class="fas fa-flag text-green-400"></i>
      <h3 class="text-white font-semibold">Páginas</h3>
      <span x-show="summary" class="ml-auto text-sm text-gray-400"
        x-text="(summary?.pages?.length || 0) + ' encontrada(s)'"></span>
    </div>

    <!-- Loading skeleton -->
    <div x-show="loading">
      <template x-for="i in skeletonRows" :key="i">
        <div class="flex gap-4 px-5 py-3 border-b border-gray-700/30 animate-pulse">
          <div class="h-4 bg-gray-700 rounded flex-1"></div>
          <div class="h-4 bg-gray-700 rounded w-28"></div>
          <div class="h-4 bg-gray-700 rounded w-32"></div>
          <div class="h-4 bg-gray-700 rounded w-20"></div>
        </div>
      </template>
    </div>

    <!-- Empty -->
    <div x-show="!loading && summary && summary.pages.length === 0"
      class="px-5 py-8 text-center text-gray-500">
      <i class="fas fa-flag text-3xl mb-2"></i>
      <p>Nenhuma página encontrada</p>
    </div>

    <!-- Table -->
    <div x-show="!loading && summary && summary.pages.length > 0" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-700/50">
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Nome</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">ID</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Categoria</th>
            <th class="px-5 py-3 text-left text-gray-400 font-medium">Seguidores</th>
          </tr>
        </thead>
        <tbody>
          <template x-for="pg in (summary?.pages || [])" :key="pg.id">
            <tr class="border-b border-gray-700/20 hover:bg-gray-800/30 transition-colors">
              <td class="px-5 py-3 text-white font-medium" x-text="pg.name"></td>
              <td class="px-5 py-3 text-gray-400 font-mono text-xs" x-text="pg.id"></td>
              <td class="px-5 py-3 text-gray-400" x-text="pg.category || '—'"></td>
              <td class="px-5 py-3 text-gray-400" x-text="pg.fan_count != null ? Number(pg.fan_count).toLocaleString('pt-BR') : '—'"></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Initial empty state (no token selected) -->
  <div x-show="!loading && !error && !summary && tokens.length > 0" class="glass rounded-xl p-12 text-center">
    <i class="fas fa-circle-info text-4xl text-gray-600 mb-3"></i>
    <p class="text-gray-400">Selecione um token acima para visualizar os ativos conectados</p>
  </div>

</div>
`
  }
}))

}) // end alpine:init
