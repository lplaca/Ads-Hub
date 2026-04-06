/* ═══════════════════════════════════════════════════════════════════════════
   Conexões de API — Alpine.js Page Component
   ═══════════════════════════════════════════════════════════════════════════ */

const CAP_META = {
  identity:            { label: 'Identidade verificada',  icon: 'fa-id-badge',       color: '#22c55e' },
  campaigns_read:      { label: 'Ver campanhas',           icon: 'fa-eye',            color: '#3b82f6' },
  insights_read:       { label: 'Ver métricas/insights',   icon: 'fa-chart-bar',      color: '#3b82f6' },
  campaigns_pause:     { label: 'Pausar campanhas',        icon: 'fa-pause-circle',   color: '#f59e0b' },
  campaigns_activate:  { label: 'Ativar campanhas',        icon: 'fa-play-circle',    color: '#22c55e' },
  budget_edit:         { label: 'Editar orçamentos',       icon: 'fa-dollar-sign',    color: '#a855f7' },
  campaigns_create:    { label: 'Criar campanhas',         icon: 'fa-plus-circle',    color: '#06b6d4' },
};

document.addEventListener('alpine:init', () => {

Alpine.data('ConnectionsPage', function() {
  return {
    connections: [],
    aggregate: { capabilities: [], has_full_access: false, has_readonly: false, connection_count: 0 },
    loading: false,
    showModal: false,
    form: { name: '', token: '', account_id: '', bm_id: '', token_type: 'full' },
    verifying: false,
    verified: null,
    saving: false,
    showToken: false,
    deleteConfirm: null,
    syncingId: null,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/connections'),
          fetch('/api/connections/capabilities'),
        ]);
        this.connections = await r1.json();
        this.aggregate   = await r2.json();
      } catch(e) {}
      this.loading = false;
    },

    async verify() {
      if (!this.form.token.trim()) {
        this.$dispatch('show-toast', {type:'error', message:'Insira o access token.'});
        return;
      }
      this.verifying = true;
      this.verified = null;
      try {
        const r = await fetch('/api/connections/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: this.form.token,
            account_id: this.form.account_id,
            token_type: this.form.token_type,
          }),
        });
        this.verified = await r.json();
      } catch(e) {
        this.verified = { valid: false, message: 'Erro de conexão com o servidor.' };
      }
      this.verifying = false;
    },

    async save() {
      if (!this.form.name.trim() || !this.form.token.trim()) {
        this.$dispatch('show-toast', {type:'error', message:'Nome e token são obrigatórios.'});
        return;
      }
      this.saving = true;
      try {
        const activeProject = window._activeProjectId || '';
        const r = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...this.form, verified_data: this.verified, project_id: activeProject }),
        });
        const d = await r.json();
        if (d.status === 'success') {
          this.$dispatch('show-toast', {type:'success', message:'Conexão adicionada!'});
          this.closeModal();
          await this.load();
        } else {
          this.$dispatch('show-toast', {type:'error', message: d.message || 'Erro ao salvar.'});
        }
      } catch(e) {
        this.$dispatch('show-toast', {type:'error', message:'Erro de conexão.'});
      }
      this.saving = false;
    },

    async del(id) {
      this.deleteConfirm = null;
      await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      this.$dispatch('show-toast', {type:'success', message:'Conexão removida.'});
      await this.load();
    },

    async syncAccounts(id) {
      this.syncingId = id;
      try {
        const r = await fetch(`/api/connections/${id}/sync-accounts`, { method: 'POST' });
        const d = await r.json();
        if (d.ok) {
          this.$dispatch('show-toast', {type:'success', message: d.message});
        } else {
          this.$dispatch('show-toast', {type:'error', message: d.detail || 'Erro ao sincronizar.'});
        }
      } catch(e) {
        this.$dispatch('show-toast', {type:'error', message:'Erro de conexão.'});
      }
      this.syncingId = null;
    },

    closeModal() {
      this.showModal = false;
      this.form = { name:'', token:'', account_id:'', bm_id:'', token_type:'full' };
      this.verified = null;
      this.showToken = false;
    },

    capInfo(cap) { return CAP_META[cap] || { label: cap, icon: 'fa-check', color: '#64748b' }; },

    capsForType(type) {
      if (type === 'readonly') return ['identity','campaigns_read','insights_read'];
      return Object.keys(CAP_META);
    },

    renderPage() { return window.TPL_CONNECTIONS(this); },
  };
});

}); // end alpine:init

// ── Template ──────────────────────────────────────────────────────────────────
window.TPL_CONNECTIONS = function(c) {
  const allCaps = Object.keys(CAP_META);

  // Aggregate capability rows
  const aggCapRows = allCaps.map(cap => {
    const m = CAP_META[cap];
    const has = c.aggregate.capabilities.includes(cap);
    return `
      <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg ${has ? '' : 'opacity-40'}" style="background:${has ? 'rgba(34,197,94,0.07)' : 'rgba(51,65,85,0.2)'}; border:1px solid ${has ? 'rgba(34,197,94,0.2)' : 'rgba(51,65,85,0.3)'};">
        <i class="fas ${m.icon} text-xs w-4 text-center" style="color:${has ? m.color : '#475569'}"></i>
        <span class="text-xs font-medium ${has ? 'text-slate-200' : 'text-slate-500'}">${m.label}</span>
        <span class="ml-auto text-xs font-bold ${has ? 'text-green-400' : 'text-slate-600'}">${has ? '✓' : '✗'}</span>
      </div>`;
  }).join('');

  // Connection cards
  const connCards = c.connections.length === 0
    ? `<div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);">
          <i class="fas fa-plug text-blue-400 text-2xl"></i>
        </div>
        <p class="text-slate-300 font-semibold text-base mb-1">Nenhuma conexão ainda</p>
        <p class="text-slate-500 text-sm">Adicione sua primeira API para começar a usar a plataforma</p>
      </div>`
    : c.connections.map(conn => {
        const caps = JSON.parse(conn.capabilities || '[]');
        const isFull = conn.token_type === 'full';
        const capChips = caps.map(cap => {
          const m = CAP_META[cap] || { label: cap, icon: 'fa-check', color: '#64748b' };
          return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium" style="background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.2);">
            <i class="fas ${m.icon} text-xs"></i>${m.label}
          </span>`;
        }).join('');

        return `
        <div class="rounded-2xl p-5 transition-all hover:translate-y-[-2px]" style="background:rgba(30,41,59,0.8);border:1px solid rgba(51,65,85,0.6);">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${isFull ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,#0369a1,#3b82f6)'};">
                <i class="fas ${isFull ? 'fa-key' : 'fa-glasses'} text-white text-sm"></i>
              </div>
              <div>
                <p class="text-white font-semibold text-sm">${conn.name}</p>
                <p class="text-slate-500 text-xs mt-0.5">${conn.user_name ? `@${conn.user_name}` : conn.token_masked}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold" style="background:${isFull ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)'}; color:${isFull ? '#c084fc' : '#60a5fa'}; border:1px solid ${isFull ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'};">
                ${isFull ? 'Acesso Total' : 'Somente Leitura'}
              </span>
              <button @click="deleteConfirm = deleteConfirm === '${conn.id}' ? null : '${conn.id}'"
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>

          ${conn.account_id ? `<p class="text-xs text-slate-500 mb-3"><i class="fas fa-fingerprint mr-1"></i>Account: <span class="text-slate-400 font-mono">${conn.account_id}</span></p>` : ''}

          <div class="flex flex-wrap gap-1.5 mb-3">${capChips}</div>

          <div class="flex items-center justify-between">
            <p class="text-xs text-slate-600"><i class="fas fa-clock mr-1"></i>${conn.created_at ? conn.created_at.slice(0,10) : ''}</p>
            <div class="flex items-center gap-2">
              <button @click="syncAccounts('${conn.id}')"
                :disabled="syncingId === '${conn.id}'"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                :class="syncingId === '${conn.id}' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'"
                style="background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.2);">
                <i class="fas text-xs" :class="syncingId === '${conn.id}' ? 'fa-circle-notch fa-spin' : 'fa-rotate'"></i>
                <span x-text="syncingId === '${conn.id}' ? 'Sincronizando...' : 'Sincronizar Contas'"></span>
              </button>
              <div class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                <span class="text-xs text-green-400 font-medium">Ativa</span>
              </div>
            </div>
          </div>

          <!-- Delete confirm -->
          <div x-show="deleteConfirm === '${conn.id}'" x-transition class="mt-3 p-3 rounded-xl" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);">
            <p class="text-red-300 text-xs font-medium mb-2">Remover esta conexão?</p>
            <div class="flex gap-2">
              <button @click="del('${conn.id}')" class="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition-all" style="background:#ef4444;">Remover</button>
              <button @click="deleteConfirm = null" class="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors" style="background:rgba(51,65,85,0.5);">Cancelar</button>
            </div>
          </div>
        </div>`;
      }).join('');

  // Verification result block
  const verifiedBlock = `
    <div x-show="verified" x-transition class="mt-3 p-3 rounded-xl" :style="verified && verified.valid ? 'background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25)' : 'background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25)'">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas text-sm" :class="verified && verified.valid ? 'fa-circle-check text-green-400' : 'fa-circle-xmark text-red-400'"></i>
        <span class="text-sm font-medium" :class="verified && verified.valid ? 'text-green-300' : 'text-red-300'" x-text="verified && verified.message"></span>
      </div>
      <template x-if="verified && verified.valid && verified.capabilities">
        <div class="flex flex-wrap gap-1.5 mt-2">
          <template x-for="cap in verified.capabilities" :key="cap">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium" style="background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2);">
              <i class="fas fa-check text-xs"></i>
              <span x-text="capInfo(cap).label"></span>
            </span>
          </template>
        </div>
      </template>
    </div>`;

  return `
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-bold text-white">Conexões de API</h2>
        <p class="text-slate-400 text-sm mt-0.5">Gerencie seus tokens Meta e veja o que cada um permite fazer</p>
      </div>
      <button @click="showModal = true"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
        style="background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 4px 16px rgba(59,130,246,0.3);">
        <i class="fas fa-plus text-sm"></i>
        Adicionar Conexão
      </button>
    </div>

    <!-- Capability summary -->
    <div class="rounded-2xl p-5" style="background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.5);">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#0369a1,#2563eb);">
          <i class="fas fa-shield-halved text-white text-sm"></i>
        </div>
        <div>
          <p class="text-white font-semibold text-sm">O que você pode fazer agora</p>
          <p class="text-slate-500 text-xs">${c.aggregate.connection_count} conexão(ões) ativa(s) — capacidades agregadas</p>
        </div>
        ${c.aggregate.connection_count === 0 ? `<span class="ml-auto px-3 py-1 rounded-lg text-xs font-semibold" style="background:rgba(245,158,11,0.1);color:#fbbf24;border:1px solid rgba(245,158,11,0.2);">Nenhuma API conectada</span>` : ''}
        ${c.aggregate.has_full_access ? `<span class="ml-auto px-3 py-1 rounded-lg text-xs font-semibold" style="background:rgba(168,85,247,0.1);color:#c084fc;border:1px solid rgba(168,85,247,0.2);"><i class="fas fa-key mr-1"></i>Acesso total disponível</span>` : ''}
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        ${aggCapRows}
      </div>
    </div>

    <!-- Connections grid -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-white font-semibold text-sm">Conexões cadastradas</h3>
        <button @click="load()" class="text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1" :class="loading ? 'animate-pulse' : ''">
          <i class="fas fa-rotate-right text-xs"></i> Atualizar
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${connCards}
      </div>
    </div>

    <!-- Two-column guide -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-2xl p-5" style="background:rgba(30,41,59,0.7);border:1px solid rgba(59,130,246,0.2);">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:rgba(59,130,246,0.15);">
            <i class="fas fa-glasses text-blue-400 text-sm"></i>
          </div>
          <p class="text-white font-semibold text-sm">Somente Leitura</p>
        </div>
        <p class="text-slate-400 text-xs leading-relaxed mb-3">Ideal para tokens com permissão <code class="bg-slate-700 px-1 rounded text-blue-300">ads_read</code>. O token pode apenas <strong class="text-slate-300">ver dados</strong> — nunca altera nada nas suas campanhas.</p>
        <ul class="space-y-1.5">
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Ver campanhas e métricas</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Gerar relatórios</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Análise por IA</li>
          <li class="flex items-center gap-2 text-xs text-red-500/60"><i class="fas fa-times w-3"></i>Pausar/ativar campanhas</li>
          <li class="flex items-center gap-2 text-xs text-red-500/60"><i class="fas fa-times w-3"></i>Editar orçamentos</li>
        </ul>
      </div>
      <div class="rounded-2xl p-5" style="background:rgba(30,41,59,0.7);border:1px solid rgba(168,85,247,0.2);">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:rgba(168,85,247,0.15);">
            <i class="fas fa-key text-purple-400 text-sm"></i>
          </div>
          <p class="text-white font-semibold text-sm">Acesso Total</p>
        </div>
        <p class="text-slate-400 text-xs leading-relaxed mb-3">Requer permissão <code class="bg-slate-700 px-1 rounded text-purple-300">ads_management</code>. Habilita todas as ações automatizadas da plataforma.</p>
        <ul class="space-y-1.5">
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Tudo do Somente Leitura</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Pausar/ativar campanhas</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Editar orçamentos</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Criar campanhas (via planilha)</li>
          <li class="flex items-center gap-2 text-xs text-slate-400"><i class="fas fa-check text-green-400 w-3"></i>Regras automáticas</li>
        </ul>
      </div>
    </div>

  </div>

  <!-- ── ADD CONNECTION MODAL ────────────────────────────────────────────── -->
  <div x-show="showModal" x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
    class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    style="background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:none;">
    <div @click.stop x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100"
      class="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      style="background:#1e293b;border:1px solid rgba(51,65,85,0.8);">

      <!-- Modal Header -->
      <div class="flex items-center justify-between p-5" style="border-bottom:1px solid rgba(51,65,85,0.5);">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#2563eb,#7c3aed);">
            <i class="fas fa-plug text-white text-sm"></i>
          </div>
          <div>
            <p class="text-white font-bold text-sm">Nova Conexão de API</p>
            <p class="text-slate-500 text-xs">Conecte um token Meta à plataforma</p>
          </div>
        </div>
        <button @click="closeModal()" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all">
          <i class="fas fa-times text-xs"></i>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

        <!-- Name -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Nome da Conexão *</label>
          <input x-model="form.name" type="text" placeholder="Ex: Conta BR - Produto 01"
            class="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none transition-all"
            style="background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.6);" />
        </div>

        <!-- Token type -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Tipo de Acesso *</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
              :style="form.token_type === 'readonly' ? 'background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4)' : 'background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.4)'">
              <input type="radio" x-model="form.token_type" value="readonly" class="mt-0.5 accent-blue-500" @change="verified=null" />
              <div>
                <p class="text-slate-200 text-xs font-semibold"><i class="fas fa-glasses mr-1 text-blue-400"></i>Somente Leitura</p>
                <p class="text-slate-500 text-xs mt-0.5">ads_read — só visualiza dados</p>
              </div>
            </label>
            <label class="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
              :style="form.token_type === 'full' ? 'background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4)' : 'background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.4)'">
              <input type="radio" x-model="form.token_type" value="full" class="mt-0.5 accent-purple-500" @change="verified=null" />
              <div>
                <p class="text-slate-200 text-xs font-semibold"><i class="fas fa-key mr-1 text-purple-400"></i>Acesso Total</p>
                <p class="text-slate-500 text-xs mt-0.5">ads_management — gerencia tudo</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Token -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Access Token Meta *</label>
          <div class="relative">
            <input x-model="form.token" :type="showToken ? 'text' : 'password'" placeholder="EAAxxxxx..."
              class="w-full px-3 py-2.5 pr-10 rounded-xl text-sm text-white placeholder-slate-600 outline-none font-mono transition-all"
              style="background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.6);" @input="verified=null" />
            <button @click="showToken=!showToken" type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              <i :class="showToken ? 'fas fa-eye-slash' : 'fas fa-eye'" class="text-xs"></i>
            </button>
          </div>
          <p class="text-slate-600 text-xs mt-1">Obtenha em: Meta for Developers → Ferramentas → Graph API Explorer</p>
        </div>

        <!-- Account ID (optional) -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">ID da Conta de Anúncio <span class="text-slate-600 normal-case font-normal">(opcional — para verificar acesso)</span></label>
          <input x-model="form.account_id" type="text" placeholder="act_123456789 ou 123456789"
            class="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none font-mono transition-all"
            style="background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.6);" @input="verified=null" />
        </div>

        <!-- BM ID (optional) -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">ID do Business Manager <span class="text-slate-600 normal-case font-normal">(opcional)</span></label>
          <input x-model="form.bm_id" type="text" placeholder="123456789"
            class="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 outline-none font-mono transition-all"
            style="background:rgba(15,23,42,0.8);border:1px solid rgba(51,65,85,0.6);" />
        </div>

        <!-- Verify result -->
        ${verifiedBlock}

        <!-- What this connection unlocks (preview) -->
        <div class="p-3 rounded-xl" style="background:rgba(15,23,42,0.5);border:1px solid rgba(51,65,85,0.3);">
          <p class="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Capacidades que serão liberadas</p>
          <div class="flex flex-wrap gap-1.5">
            <template x-for="cap in capsForType(form.token_type)" :key="cap">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium" style="background:rgba(59,130,246,0.08);color:#7dd3fc;border:1px solid rgba(59,130,246,0.15);">
                <i class="fas text-xs" :class="capInfo(cap).icon"></i>
                <span x-text="capInfo(cap).label"></span>
              </span>
            </template>
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="flex items-center gap-3 p-5" style="border-top:1px solid rgba(51,65,85,0.5);">
        <button @click="verify()" :disabled="verifying || !form.token"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          :class="verifying || !form.token ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'"
          style="background:rgba(51,65,85,0.6);color:#94a3b8;border:1px solid rgba(51,65,85,0.5);">
          <i class="fas text-sm" :class="verifying ? 'fa-circle-notch fa-spin' : 'fa-bolt'"></i>
          <span x-text="verifying ? 'Verificando...' : 'Verificar Token'"></span>
        </button>
        <button @click="save()" :disabled="saving || !form.name || !form.token"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          :class="saving || !form.name || !form.token ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'"
          style="background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 4px 16px rgba(59,130,246,0.3);">
          <i class="fas text-sm" :class="saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'"></i>
          <span x-text="saving ? 'Salvando...' : 'Salvar Conexão'"></span>
        </button>
        <button @click="closeModal()" class="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all">
          Cancelar
        </button>
      </div>

    </div>
  </div>
  `;
};
