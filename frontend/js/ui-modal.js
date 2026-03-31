/* ═══════════════════════════════════════════════════════════════════════════
   Global Modal System — ui-modal.js
   Renders into #overlay-root (body level) — escapes all stacking contexts.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Core Engine ───────────────────────────────────────────────────────────────
;(function () {
  var _esc = null;

  function root() { return document.getElementById('overlay-root'); }

  window.openModal = function ({ html = '', size = 'md', onClose } = {}) {
    var el = root();
    if (!el) { console.warn('[Modal] #overlay-root not found'); return; }

    var maxW = { sm: '26rem', md: '34rem', lg: '44rem' }[size] || '34rem';

    el.innerHTML =
      '<div id="modal-backdrop"' +
        ' style="position:fixed;inset:0;z-index:var(--z-modal);display:flex;align-items:center;justify-content:center;' +
                'padding:1rem;background:rgba(2,8,18,0.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
                'animation:backdropIn 0.18s ease both;">' +
        '<div id="modal-box"' +
          ' style="width:100%;max-width:' + maxW + ';max-height:90vh;overflow-y:auto;border-radius:18px;' +
                  'background:linear-gradient(160deg,rgba(22,32,52,0.99),rgba(10,16,30,0.99));' +
                  'border:1px solid rgba(71,85,105,0.45);' +
                  'box-shadow:0 48px 120px rgba(0,0,0,0.9),0 0 1px rgba(255,255,255,0.05);' +
                  'animation:modalIn 0.24s cubic-bezier(0.34,1.2,0.64,1) both;">' +
          html +
        '</div>' +
      '</div>';

    document.getElementById('modal-backdrop').addEventListener('click', function (e) {
      if (e.target === this) window.closeModal();
    });

    _esc = function (e) { if (e.key === 'Escape') window.closeModal(); };
    document.addEventListener('keydown', _esc);

    if (typeof onClose === 'function') el._onClose = onClose;

    // Initialize Alpine on dynamically injected content
    if (window.Alpine) Alpine.initTree(el);
  };

  window.closeModal = function () {
    var el = root();
    if (!el || !el.children.length) return;
    if (typeof el._onClose === 'function') { el._onClose(); delete el._onClose; }
    if (_esc) { document.removeEventListener('keydown', _esc); _esc = null; }
    el.innerHTML = '';
  };
})();


// ── Alpine Modal Components ────────────────────────────────────────────────────
document.addEventListener('alpine:init', function () {

  // ── BmModal ─────────────────────────────────────────────────────────────────
  Alpine.data('BmModal', function (init) {
    init = init || null;
    return {
      form: { name: init ? init.name : '', bm_id: init ? init.bm_id : '', access_token: '' },
      editId: init ? init.id : null,
      showToken: false,
      showHelp: false,
      testing: false,
      testResult: null,
      saving: false,

      async testConn() {
        if (!this.form.access_token) { toast('warning', 'Insira o access token primeiro'); return; }
        this.testing = true; this.testResult = null;
        var r = await API.post('/api/bm/test', { access_token: this.form.access_token, bm_id: this.form.bm_id });
        this.testing = false;
        this.testResult = (r && (r.status === 'success' || r.status === 'demo')) ? 'success' : 'error';
        toast(this.testResult === 'success' ? 'success' : 'error', (r && r.message) || 'Erro ao testar');
      },

      async saveBm() {
        if (!this.form.name || !this.form.bm_id || !this.form.access_token) {
          toast('warning', 'Preencha todos os campos obrigatórios'); return;
        }
        this.saving = true;
        var ok = false;
        if (this.editId) {
          var r1 = await API.put('/api/bm/' + this.editId, this.form);
          ok = !!r1;
          if (ok) toast('success', 'BM atualizado!');
        } else {
          var r2 = await API.post('/api/bm', this.form);
          ok = r2 && r2.status === 'success';
          if (ok) toast('success', (r2 && r2.message) || 'BM adicionado com sucesso!');
        }
        this.saving = false;
        if (ok) {
          window.dispatchEvent(new CustomEvent('bm-saved'));
          window.closeModal();
        } else {
          toast('error', 'Erro ao salvar. Verifique os dados e tente novamente.');
        }
      },
    };
  });


  // ── ProfileModal ─────────────────────────────────────────────────────────────
  Alpine.data('ProfileModal', function () {
    var u = (window.Auth && Auth.getUser) ? Auth.getUser() : null;
    return {
      form: {
        name: (u && u.name) || '',
        email: (u && u.email) || '',
        current_password: '',
        new_password: '',
      },
      saving: false,

      async save() {
        this.saving = true;
        var body = { name: this.form.name, email: this.form.email };
        if (this.form.new_password) {
          body.new_password = this.form.new_password;
          body.current_password = this.form.current_password;
        }
        var r = await API.put('/api/auth/me', body);
        if (r && r.ok) {
          var cur = Auth.getUser();
          Auth.setSession(Auth.getToken(), Object.assign({}, cur, { name: r.user.name, email: r.user.email }));
          window.dispatchEvent(new CustomEvent('auth-user-updated'));
          toast('success', 'Perfil atualizado!');
          window.closeModal();
        } else {
          toast('error', 'Erro ao salvar perfil');
        }
        this.saving = false;
      },
    };
  });


  // ── ProjectModal ─────────────────────────────────────────────────────────────
  Alpine.data('ProjectModal', function (init) {
    init = init || null;
    return {
      editId: init ? init.id : null,
      form: { name: init ? init.name : '', color: init ? init.color : '#3b82f6' },
      integrations: { notion_token: '', notion_analyses_db_id: '', notion_products_db_id: '', clickup_token: '', clickup_list_id: '' },
      showIntegrations: false,
      saving: false,
      saveError: '',
      COLORS: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'],

      async init() {
        if (this.editId) {
          var intg = await API.get('/api/projects/' + this.editId + '/integrations');
          if (intg) this.integrations = intg;
        }
      },

      async save() {
        if (!this.form.name.trim()) return;
        this.saving = true;
        this.saveError = '';
        try {
          var pid = this.editId;
          if (pid) {
            await API.put('/api/projects/' + pid, this.form);
          } else {
            var res = await API.post('/api/projects', this.form);
            if (!res || !res.id) throw new Error('Servidor não retornou o projeto. Tente novamente.');
            pid = res.id;
          }
          var hasIntg = Object.values(this.integrations).some(function (v) { return v && v.trim(); });
          if (pid && hasIntg) await API.put('/api/projects/' + pid + '/integrations', this.integrations);
          toast('success', this.editId ? 'Projeto atualizado!' : 'Projeto criado!');
          window.dispatchEvent(new CustomEvent('project-saved'));
          window.closeModal();
        } catch (e) {
          this.saveError = (e && e.message) || 'Erro ao salvar.';
          toast('error', this.saveError);
        } finally {
          this.saving = false;
        }
      },
    };
  });

}); // end alpine:init


// ── Convenience Openers ───────────────────────────────────────────────────────

window.openBmModal = function (bm) {
  var d = bm ? JSON.stringify({ id: bm.id, name: bm.name, bm_id: bm.bm_id }) : 'null';
  window.openModal({ size: 'lg', html: '<div x-data="BmModal(' + d + ')">' + _bmModalHtml() + '</div>' });
};

window.openProfileModal = function () {
  window.openModal({ size: 'md', html: '<div x-data="ProfileModal">' + _profileModalHtml() + '</div>' });
};

window.openProjectModal = function (project) {
  var d = project ? JSON.stringify({ id: project.id, name: project.name, color: project.color }) : 'null';
  window.openModal({ size: 'md', html: '<div x-data="ProjectModal(' + d + ')" x-init="init()">' + _projectModalHtml() + '</div>' });
};


// ── HTML Templates ────────────────────────────────────────────────────────────

function _hdr(icon, iconColor, title, subtitle) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.25rem 1rem;border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(18,28,48,0.98),rgba(12,20,38,0.98));border-radius:18px 18px 0 0;position:sticky;top:0;z-index:1;">' +
    '<div style="display:flex;align-items:center;gap:0.75rem;">' +
      '<div style="width:2.5rem;height:2.5rem;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);">' +
        '<i class="' + icon + '" style="color:' + iconColor + ';font-size:1rem;"></i>' +
      '</div>' +
      '<div>' +
        '<h2 style="color:white;font-weight:700;font-size:0.95rem;line-height:1.25;">' + title + '</h2>' +
        (subtitle ? '<p style="color:#64748b;font-size:0.7rem;margin-top:0.1rem;">' + subtitle + '</p>' : '') +
      '</div>' +
    '</div>' +
    '<button onclick="closeModal()" style="color:#64748b;background:transparent;border:none;cursor:pointer;padding:0.4rem;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#64748b\'">' +
      '<i class="fas fa-times" style="font-size:0.9rem;"></i>' +
    '</button>' +
  '</div>';
}

function _ftr(primaryLabel, primaryAction, cancelLabel) {
  cancelLabel = cancelLabel || 'Cancelar';
  return '<div style="padding:1rem 1.25rem;display:flex;gap:0.5rem;border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);border-radius:0 0 18px 18px;">' +
    '<button onclick="closeModal()" class="btn btn-secondary" style="flex:1;">' + cancelLabel + '</button>' +
    primaryAction +
  '</div>';
}

// ── BM Modal HTML ─────────────────────────────────────────────────────────────
function _bmModalHtml() {
  var perms = ['ads_read','ads_management','read_insights','business_management']
    .map(function(p) {
      return '<code style="font-size:0.68rem;padding:2px 8px;border-radius:6px;background:rgba(59,130,246,0.12);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);">' + p + '</code>';
    }).join('');

  return (
    // Header (dynamic title via Alpine)
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.25rem 1rem;border-bottom:1px solid rgba(51,65,85,0.3);background:linear-gradient(135deg,rgba(18,28,48,0.98),rgba(12,20,38,0.98));border-radius:18px 18px 0 0;position:sticky;top:0;z-index:1;">' +
      '<div style="display:flex;align-items:center;gap:0.75rem;">' +
        '<div style="width:2.5rem;height:2.5rem;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(29,78,216,0.2);border:1px solid rgba(59,130,246,0.3);">' +
          '<i class="fas fa-building" style="color:#60a5fa;font-size:1rem;"></i>' +
        '</div>' +
        '<div>' +
          '<h2 style="color:white;font-weight:700;font-size:0.95rem;line-height:1.25;" x-text="editId ? \'Editar Business Manager\' : \'Conectar Business Manager\'"></h2>' +
          '<p style="color:#64748b;font-size:0.7rem;">Preencha os dados para conectar seu BM</p>' +
        '</div>' +
      '</div>' +
      '<button onclick="closeModal()" style="color:#64748b;background:transparent;border:none;cursor:pointer;padding:0.4rem;border-radius:8px;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#64748b\'">' +
        '<i class="fas fa-times" style="font-size:0.9rem;"></i>' +
      '</button>' +
    '</div>' +

    // Help toggle
    '<div style="padding:1rem 1.25rem 0;">' +
      '<button @click="showHelp=!showHelp" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0.625rem 1rem;border-radius:12px;border:1px solid rgba(59,130,246,0.2);background:rgba(59,130,246,0.07);cursor:pointer;">' +
        '<span style="display:flex;align-items:center;gap:0.5rem;color:#93c5fd;font-size:0.8rem;font-weight:500;">' +
          '<i class="fas fa-circle-question" style="color:#60a5fa;"></i>' +
          'Como obter as credenciais do Meta?' +
        '</span>' +
        '<i class="fas" style="color:#60a5fa;font-size:0.7rem;" :class="showHelp ? \'fa-chevron-up\' : \'fa-chevron-down\'"></i>' +
      '</button>' +

      '<div x-show="showHelp" x-transition style="display:none;margin-top:0.5rem;border-radius:12px;overflow:hidden;border:1px solid rgba(51,65,85,0.4);background:rgba(8,14,28,0.7);">' +
        '<div style="padding:0.875rem;border-bottom:1px solid rgba(51,65,85,0.3);">' +
          '<p style="color:white;font-size:0.72rem;font-weight:600;margin-bottom:0.375rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#2563eb;display:inline-flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;font-weight:700;flex-shrink:0;">1</span>' +
            'Onde encontrar o ID do Business Manager' +
          '</p>' +
          '<div style="padding-left:1.75rem;">' +
            '<p style="color:#94a3b8;font-size:0.7rem;">Acesse <span style="color:#60a5fa;font-family:monospace;">business.facebook.com</span></p>' +
            '<p style="color:#94a3b8;font-size:0.7rem;">→ <strong style="color:#cbd5e1;">Configurações do Negócio</strong> → o ID aparece no topo</p>' +
            '<a href="https://business.facebook.com/settings" target="_blank" style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.7rem;color:#60a5fa;margin-top:0.25rem;">' +
              '<i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i> Abrir Configurações do BM' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div style="padding:0.875rem;border-bottom:1px solid rgba(51,65,85,0.3);">' +
          '<p style="color:white;font-size:0.72rem;font-weight:600;margin-bottom:0.375rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#2563eb;display:inline-flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;font-weight:700;flex-shrink:0;">2</span>' +
            'Gerar o Access Token' +
          '</p>' +
          '<div style="padding-left:1.75rem;">' +
            '<a href="https://developers.facebook.com/tools/explorer/" target="_blank" style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.7rem;color:#60a5fa;margin-bottom:0.25rem;">' +
              '<i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i> Abrir Graph API Explorer' +
            '</a>' +
            '<p style="color:#94a3b8;font-size:0.7rem;">Selecione seu App → "Generate Access Token" → marque as 4 permissões → copie o token</p>' +
          '</div>' +
        '</div>' +
        '<div style="padding:0.875rem;">' +
          '<p style="color:white;font-size:0.72rem;font-weight:600;margin-bottom:0.375rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#d97706;display:inline-flex;align-items:center;justify-content:center;font-size:0.6rem;color:white;font-weight:700;flex-shrink:0;">!</span>' +
            'Token de longa duração (60 dias)' +
          '</p>' +
          '<p style="color:#94a3b8;font-size:0.7rem;padding-left:1.75rem;">No Graph Explorer use "Extend Token" para converter para 60 dias. Tokens curtos expiram em 1h.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Form fields
    '<div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem;">' +
      // Nome
      '<div>' +
        '<label class="form-label">Nome do BM *</label>' +
        '<div style="position:relative;">' +
          '<i class="fas fa-tag" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#475569;font-size:0.7rem;pointer-events:none;"></i>' +
          '<input type="text" x-model="form.name" placeholder="Ex: BM Principal" class="form-input" style="padding-left:2.25rem;" />' +
        '</div>' +
        '<p style="color:#475569;font-size:0.7rem;margin-top:0.25rem;">Nome descritivo só para você identificar</p>' +
      '</div>' +

      // BM ID
      '<div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">' +
          '<label class="form-label" style="margin-bottom:0;">ID do Business Manager *</label>' +
          '<a href="https://business.facebook.com/settings" target="_blank" style="font-size:0.7rem;color:#60a5fa;display:flex;align-items:center;gap:0.25rem;">' +
            '<i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i> Onde encontrar?' +
          '</a>' +
        '</div>' +
        '<div style="position:relative;">' +
          '<i class="fas fa-hashtag" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#475569;font-size:0.7rem;pointer-events:none;"></i>' +
          '<input type="text" x-model="form.bm_id" placeholder="Ex: 123456789012345" class="form-input" style="padding-left:2.25rem;font-family:monospace;" inputmode="numeric" />' +
        '</div>' +
        '<p style="color:#475569;font-size:0.7rem;margin-top:0.25rem;">Número de 15 dígitos — encontrado nas Configurações do Negócio</p>' +
      '</div>' +

      // Token
      '<div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">' +
          '<label class="form-label" style="margin-bottom:0;">Access Token *</label>' +
          '<a href="https://developers.facebook.com/tools/explorer/" target="_blank" style="font-size:0.7rem;color:#60a5fa;display:flex;align-items:center;gap:0.25rem;">' +
            '<i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i> Graph Explorer' +
          '</a>' +
        '</div>' +
        '<div style="position:relative;">' +
          '<i class="fas fa-key" style="position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#475569;font-size:0.7rem;pointer-events:none;"></i>' +
          '<input :type="showToken ? \'text\' : \'password\'" x-model="form.access_token" placeholder="EAAxxxxxxxxxxxxxxx..." class="form-input" style="padding-left:2.25rem;padding-right:2.5rem;font-family:monospace;font-size:0.78rem;" />' +
          '<button @click="showToken=!showToken" type="button" style="position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);color:#64748b;background:none;border:none;cursor:pointer;">' +
            '<i :class="showToken ? \'fas fa-eye-slash\' : \'fas fa-eye\'" style="font-size:0.85rem;"></i>' +
          '</button>' +
        '</div>' +
        '<p style="color:#475569;font-size:0.7rem;margin-top:0.25rem;">Começa com <code style="color:#fbbf24;font-family:monospace;">EAA</code> — precisa das permissões ads_read e ads_management</p>' +
      '</div>' +

      // Permissions
      '<div style="padding:0.625rem 0.875rem;border-radius:10px;background:rgba(15,23,42,0.7);border:1px solid rgba(51,65,85,0.35);display:flex;flex-wrap:wrap;gap:0.375rem;align-items:center;">' +
        '<p style="color:#475569;font-size:0.7rem;width:100%;margin-bottom:0.25rem;font-weight:500;">Permissões necessárias no token:</p>' +
        perms +
      '</div>' +

      // Success banner
      '<div x-show="testResult === \'success\'" x-transition style="display:none;">' +
        '<div style="display:flex;align-items:center;gap:0.625rem;padding:0.75rem;border-radius:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);">' +
          '<div style="width:1.75rem;height:1.75rem;border-radius:8px;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<i class="fas fa-check" style="color:#4ade80;font-size:0.75rem;"></i>' +
          '</div>' +
          '<div>' +
            '<p style="color:#86efac;font-size:0.8rem;font-weight:600;">Conexão verificada com sucesso!</p>' +
            '<p style="color:#64748b;font-size:0.7rem;">Token válido. Clique em "Adicionar BM" para salvar.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Error banner
      '<div x-show="testResult === \'error\'" x-transition style="display:none;">' +
        '<div style="display:flex;align-items:flex-start;gap:0.625rem;padding:0.75rem;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);">' +
          '<div style="width:1.75rem;height:1.75rem;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.1rem;">' +
            '<i class="fas fa-times" style="color:#f87171;font-size:0.75rem;"></i>' +
          '</div>' +
          '<div>' +
            '<p style="color:#fca5a5;font-size:0.8rem;font-weight:600;">Token inválido ou sem permissão</p>' +
            '<p style="color:#64748b;font-size:0.7rem;">Verifique as 4 permissões e se o token não expirou.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Footer
    '<div style="padding:1rem 1.25rem;display:flex;gap:0.5rem;border-top:1px solid rgba(51,65,85,0.3);background:rgba(8,14,28,0.4);border-radius:0 0 18px 18px;">' +
      '<button @click="testConn()" :disabled="testing || !form.access_token" class="btn btn-secondary" style="flex:1;" :class="!form.access_token ? \'opacity-40 cursor-not-allowed\' : \'\'">' +
        '<i :class="testing ? \'fas fa-spinner fa-spin\' : \'fas fa-plug\'" class="text-xs"></i>' +
        '<span x-text="testing ? \'Testando...\' : \'Testar Conexão\'"></span>' +
      '</button>' +
      '<button @click="saveBm()" :disabled="saving" class="btn btn-primary" style="flex:1;">' +
        '<i :class="saving ? \'fas fa-spinner fa-spin\' : \'fas fa-check\'" class="text-xs"></i>' +
        '<span x-text="editId ? \'Salvar Alterações\' : \'Adicionar BM\'"></span>' +
      '</button>' +
    '</div>'
  );
}


// ── Profile Modal HTML ────────────────────────────────────────────────────────
function _profileModalHtml() {
  return (
    _hdr('fas fa-user-pen', '#60a5fa', 'Editar Perfil', 'Atualize suas informações de acesso') +
    '<div style="padding:1.25rem;display:flex;flex-direction:column;gap:0.875rem;">' +
      '<div>' +
        '<label class="form-label">Nome</label>' +
        '<input type="text" x-model="form.name" class="form-input" placeholder="Seu nome" autocomplete="name" />' +
      '</div>' +
      '<div>' +
        '<label class="form-label">Email</label>' +
        '<input type="email" x-model="form.email" class="form-input" placeholder="seu@email.com" autocomplete="email" />' +
      '</div>' +
      '<div style="padding-top:0.75rem;border-top:1px solid rgba(51,65,85,0.35);">' +
        '<p style="color:#475569;font-size:0.75rem;font-weight:500;margin-bottom:0.625rem;">Alterar senha (opcional)</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
          '<input type="password" x-model="form.current_password" class="form-input" placeholder="Senha atual" autocomplete="current-password" />' +
          '<input type="password" x-model="form.new_password" class="form-input" placeholder="Nova senha" autocomplete="new-password" />' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:1rem 1.25rem;display:flex;gap:0.5rem;border-top:1px solid rgba(51,65,85,0.3);border-radius:0 0 18px 18px;">' +
      '<button onclick="closeModal()" class="btn btn-secondary" style="flex:1;">Cancelar</button>' +
      '<button @click="save()" :disabled="saving" class="btn btn-primary" style="flex:1;">' +
        '<i :class="saving ? \'fas fa-spinner fa-spin\' : \'fas fa-save\'" class="text-xs"></i>' +
        '<span x-text="saving ? \'Salvando...\' : \'Salvar\'"></span>' +
      '</button>' +
    '</div>'
  );
}


// ── Project Modal HTML ────────────────────────────────────────────────────────
function _projectModalHtml() {
  return (
    // Dynamic header title via Alpine
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.25rem 1rem;border-bottom:1px solid rgba(51,65,85,0.3);border-radius:18px 18px 0 0;">' +
      '<div style="display:flex;align-items:center;gap:0.625rem;">' +
        '<div style="width:2rem;height:2rem;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);">' +
          '<i class="fas fa-folder-open" style="color:#60a5fa;font-size:0.8rem;"></i>' +
        '</div>' +
        '<h2 style="color:white;font-weight:700;font-size:0.95rem;" x-text="editId ? \'Editar Projeto\' : \'Novo Projeto\'"></h2>' +
      '</div>' +
      '<button onclick="closeModal()" style="color:#64748b;background:transparent;border:none;cursor:pointer;padding:0.4rem;border-radius:8px;" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'white\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#64748b\'">' +
        '<i class="fas fa-times" style="font-size:0.9rem;"></i>' +
      '</button>' +
    '</div>' +

    '<div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem;">' +
      '<div>' +
        '<label class="form-label">Nome do projeto</label>' +
        '<input type="text" x-model="form.name" placeholder="Ex: GTS, Hot, Ondelta..." @keydown.enter="save()" class="form-input" />' +
      '</div>' +

      '<div>' +
        '<label class="form-label">Cor</label>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<template x-for="c in COLORS" :key="c">' +
            '<button @click="form.color=c" style="width:1.75rem;height:1.75rem;border-radius:8px;border:none;cursor:pointer;transition:all 0.15s;" :style="\'background:\'+c+(form.color===c?\';outline:2px solid white;outline-offset:2px\':\'\')" ></button>' +
          '</template>' +
        '</div>' +
      '</div>' +

      // Integrations
      '<button @click="showIntegrations=!showIntegrations" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0.625rem 0.875rem;border-radius:10px;border:1px solid rgba(51,65,85,0.5);background:rgba(51,65,85,0.25);cursor:pointer;color:#94a3b8;font-size:0.8rem;">' +
        '<span style="display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-plug" style="font-size:0.7rem;"></i> Integrações (Notion / ClickUp)</span>' +
        '<i class="fas" style="font-size:0.7rem;" :class="showIntegrations ? \'fa-chevron-up\' : \'fa-chevron-down\'"></i>' +
      '</button>' +

      '<div x-show="showIntegrations" x-transition style="display:none;display:flex;flex-direction:column;gap:0.75rem;">' +
        '<p style="color:#475569;font-size:0.7rem;">Configure para sincronizar análises e tarefas deste projeto.</p>' +

        // Notion
        '<div style="border-radius:12px;padding:0.875rem;background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.4);">' +
          '<p style="color:#cbd5e1;font-size:0.75rem;font-weight:600;margin-bottom:0.625rem;display:flex;align-items:center;gap:0.375rem;">' +
            '<i class="fas fa-book" style="color:#a78bfa;font-size:0.8rem;"></i> Notion' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
            '<div><label style="color:#64748b;font-size:0.7rem;display:block;margin-bottom:0.2rem;">Token de integração</label>' +
              '<input x-model="integrations.notion_token" type="password" placeholder="secret_..." class="form-input" style="font-size:0.75rem;" /></div>' +
            '<div><label style="color:#64748b;font-size:0.7rem;display:block;margin-bottom:0.2rem;">ID — Análises Diárias</label>' +
              '<input x-model="integrations.notion_analyses_db_id" type="text" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" class="form-input" style="font-size:0.75rem;font-family:monospace;" /></div>' +
            '<div><label style="color:#64748b;font-size:0.7rem;display:block;margin-bottom:0.2rem;">ID — Produtos (opcional)</label>' +
              '<input x-model="integrations.notion_products_db_id" type="text" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" class="form-input" style="font-size:0.75rem;font-family:monospace;" /></div>' +
          '</div>' +
        '</div>' +

        // ClickUp
        '<div style="border-radius:12px;padding:0.875rem;background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.4);">' +
          '<p style="color:#cbd5e1;font-size:0.75rem;font-weight:600;margin-bottom:0.625rem;display:flex;align-items:center;gap:0.375rem;">' +
            '<i class="fas fa-check-circle" style="color:#f472b6;font-size:0.8rem;"></i> ClickUp' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
            '<div><label style="color:#64748b;font-size:0.7rem;display:block;margin-bottom:0.2rem;">API Token</label>' +
              '<input x-model="integrations.clickup_token" type="password" placeholder="pk_..." class="form-input" style="font-size:0.75rem;" /></div>' +
            '<div><label style="color:#64748b;font-size:0.7rem;display:block;margin-bottom:0.2rem;">List ID</label>' +
              '<input x-model="integrations.clickup_list_id" type="text" placeholder="123456789" class="form-input" style="font-size:0.75rem;font-family:monospace;" /></div>' +
          '</div>' +
        '</div>' +

        '<div x-show="saveError" style="display:none;padding:0.5rem 0.75rem;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);">' +
          '<p style="color:#fca5a5;font-size:0.75rem;" x-text="saveError"></p>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div style="padding:1rem 1.25rem;display:flex;gap:0.5rem;border-top:1px solid rgba(51,65,85,0.3);border-radius:0 0 18px 18px;">' +
      '<button onclick="closeModal()" class="btn btn-secondary" style="flex:1;">Cancelar</button>' +
      '<button @click="save()" :disabled="saving" class="btn btn-primary" style="flex:1;">' +
        '<i :class="saving ? \'fas fa-spinner fa-spin\' : \'fas fa-check\'" class="text-xs"></i>' +
        '<span x-text="saving ? \'Salvando...\' : \'Salvar\'"></span>' +
      '</button>' +
    '</div>'
  );
}
