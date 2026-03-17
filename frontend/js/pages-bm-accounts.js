document.addEventListener('alpine:init', () => {

// ══════════════════════════════════════════════════════════════════════════════
//  BUSINESS MANAGERS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('BmPage', () => ({
  bms: JSON.parse(JSON.stringify(MOCK.bms)),
  expanded: {},
  showModal: false,
  testing: false,
  testResult: null,
  showToken: false,
  form: { name:'', bm_id:'', access_token:'' },
  editId: null,

  init() {},

  toggleExpand(id) { this.expanded = {...this.expanded, [id]: !this.expanded[id]}; },

  getAccounts(bmId) { return MOCK.accounts.filter(a => a.bm_id === bmId); },

  openModal(bm) {
    if (bm) { this.form = {name:bm.name, bm_id:bm.bm_id, access_token:''}; this.editId = bm.id; }
    else    { this.form = {name:'', bm_id:'', access_token:''}; this.editId = null; }
    this.testResult = null; this.showToken = false; this.showModal = true;
  },

  async testConn() {
    if (!this.form.access_token) { toast('warning', 'Insira o access token primeiro'); return; }
    this.testing = true; this.testResult = null;
    await new Promise(r => setTimeout(r, 1300));
    this.testing = false; this.testResult = 'success';
    toast('success', 'Conexão testada com sucesso!');
  },

  saveBm() {
    if (!this.form.name || !this.form.bm_id || !this.form.access_token) { toast('warning', 'Preencha todos os campos'); return; }
    if (this.editId) {
      const i = this.bms.findIndex(b => b.id === this.editId);
      if (i >= 0) { this.bms[i] = {...this.bms[i], name:this.form.name, bm_id:this.form.bm_id, status:'connected'}; }
      toast('success', 'BM atualizado com sucesso!');
    } else {
      this.bms.push({ id:'bm_'+Date.now(), name:this.form.name, bm_id:this.form.bm_id, status:'connected', accounts_count:0 });
      toast('success', 'BM "'+this.form.name+'" adicionado!');
    }
    this.showModal = false;
  },

  deleteBm(id, name) {
    if (!confirm('Remover "'+name+'"? Esta ação não pode ser desfeita.')) return;
    this.bms = this.bms.filter(b => b.id !== id);
    toast('success', 'BM removido com sucesso!');
  },
}));

// ══════════════════════════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════
Alpine.data('AccountsPage', () => ({
  accounts: JSON.parse(JSON.stringify(MOCK.accounts)),
  search: '', filterBm: '', filterStatus: '',
  showModal: false, testing: false, testResult: null, showToken: false,
  form: { name:'', account_id:'', bm_id:'', country:'BR', access_token:'' },
  editId: null,

  init() {},

  get filtered() {
    return this.accounts.filter(a => {
      if (this.search && !a.name.toLowerCase().includes(this.search.toLowerCase()) && !a.account_id.includes(this.search)) return false;
      if (this.filterBm && a.bm_id !== this.filterBm) return false;
      if (this.filterStatus && a.status !== this.filterStatus) return false;
      return true;
    });
  },

  flagFor(code) {
    const map = {BR:'🇧🇷',US:'🇺🇸',MX:'🇲🇽',AR:'🇦🇷',CO:'🇨🇴',CL:'🇨🇱',PE:'🇵🇪',EC:'🇪🇨'};
    return map[code] || '🌍';
  },

  openModal(acc) {
    if (acc) { this.form = {name:acc.name, account_id:acc.account_id, bm_id:acc.bm_id||'', country:acc.country||'BR', access_token:''}; this.editId = acc.id; }
    else     { this.form = {name:'', account_id:'', bm_id:'', country:'BR', access_token:''}; this.editId = null; }
    this.testResult = null; this.showToken = false; this.showModal = true;
  },

  async testConn() {
    this.testing = true; this.testResult = null;
    await new Promise(r => setTimeout(r, 1300));
    this.testing = false; this.testResult = 'success';
    toast('success', 'Conexão verificada!');
  },

  saveAccount() {
    if (!this.form.name || !this.form.account_id || !this.form.access_token) { toast('warning', 'Preencha todos os campos obrigatórios'); return; }
    if (!this.form.account_id.startsWith('act_')) { toast('warning', 'ID da conta deve começar com act_'); return; }
    const flag = this.flagFor(this.form.country);
    if (this.editId) {
      const i = this.accounts.findIndex(a => a.id === this.editId);
      if (i >= 0) this.accounts[i] = {...this.accounts[i], ...this.form, flag, status:'active'};
      toast('success', 'Conta atualizada!');
    } else {
      this.accounts.push({ id:'acc_'+Date.now(), ...this.form, flag, status:'active', spend:0, conversions:0, roas:0, cpa:0 });
      toast('success', 'Conta "'+this.form.name+'" adicionada!');
    }
    this.showModal = false;
  },

  deleteAccount(id, name) {
    if (!confirm('Remover a conta "'+name+'"?')) return;
    this.accounts = this.accounts.filter(a => a.id !== id);
    toast('success', 'Conta removida!');
  },
}));

}); // end alpine:init
