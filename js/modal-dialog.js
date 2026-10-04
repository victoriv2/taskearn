/**
 * TaskEarn - Custom Modal Dialogs (Alert, Confirm, Prompt)
 * Replaces native JavaScript popups (alert, confirm, prompt) with sleek, responsive modals
 * matching the mobile bottom-sheet and desktop centered-card design pattern of modal-select.
 * ZERO emojis, strictly SVG icons, fully accessible and Promise-based.
 */

(function () {
  'use strict';

  let activeResolver = null;
  let activeRejecter = null;
  let currentDialogType = null;

  const ICONS = {
    info: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `,
    success: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `,
    warning: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `,
    danger: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `,
    question: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `,
    prompt: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `
  };

  function ensureModalInDOM() {
    if (document.getElementById('customDialogModal')) return;

    const modalHtml = `
      <div id="customDialogModal" class="modal-backdrop custom-dialog-backdrop" onclick="window.TaskEarnModal.handleBackdropClick(event)">
        <div class="modal-dialog custom-dialog-card" role="dialog" aria-modal="true" aria-labelledby="customDialogTitle" style="max-width: 440px;">
          <div class="modal-header custom-dialog-header">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <div id="customDialogIconContainer" class="custom-dialog-icon-badge info">
                ${ICONS.info}
              </div>
              <h3 id="customDialogTitle" class="modal-title" style="font-size: 1.05rem; font-weight: 700; margin: 0; line-height: 1.3;">Notification</h3>
            </div>
            <button type="button" class="btn btn-icon modal-close" onclick="window.TaskEarnModal.close(null)" aria-label="Close dialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div id="customDialogBody" class="custom-dialog-body"></div>
          <div id="customDialogInputWrap" class="custom-dialog-input-wrap" style="display: none;">
            <input type="text" id="customDialogInput" class="custom-dialog-input" autocomplete="off" />
          </div>
          <div id="customDialogActions" class="custom-dialog-actions"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.addEventListener('keydown', function (e) {
      const modal = document.getElementById('customDialogModal');
      if (!modal || !modal.classList.contains('open')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        window.TaskEarnModal.close(currentDialogType === 'confirm' ? false : null);
      } else if (e.key === 'Enter') {
        const inputWrap = document.getElementById('customDialogInputWrap');
        if (inputWrap && inputWrap.style.display !== 'none') {
          // In prompt modal, pressing Enter submits prompt
          e.preventDefault();
          window.TaskEarnModal.resolvePrompt();
        }
      }
    });
  }

  function handleBackdropClick(event) {
    if (event.target && event.target.id === 'customDialogModal') {
      window.TaskEarnModal.close(currentDialogType === 'confirm' ? false : null);
    }
  }

  function close(value) {
    const modal = document.getElementById('customDialogModal');
    if (modal) {
      modal.classList.remove('open');
    }
    if (activeResolver) {
      const resolver = activeResolver;
      activeResolver = null;
      activeRejecter = null;
      resolver(value);
    }
    currentDialogType = null;
  }

  function resolve(value) {
    close(value);
  }

  function resolvePrompt() {
    const input = document.getElementById('customDialogInput');
    const val = input ? input.value : '';
    close(val);
  }

  function setupDialog(config) {
    ensureModalInDOM();

    const modal = document.getElementById('customDialogModal');
    const iconContainer = document.getElementById('customDialogIconContainer');
    const titleEl = document.getElementById('customDialogTitle');
    const bodyEl = document.getElementById('customDialogBody');
    const inputWrap = document.getElementById('customDialogInputWrap');
    const inputEl = document.getElementById('customDialogInput');
    const actionsEl = document.getElementById('customDialogActions');

    // Title
    titleEl.textContent = config.title || 'Notification';

    // Body
    bodyEl.textContent = config.message || '';

    // Icon & Badge Theme
    const iconType = config.icon || 'info';
    iconContainer.className = `custom-dialog-icon-badge ${config.badgeTheme || iconType}`;
    iconContainer.innerHTML = ICONS[iconType] || ICONS.info;

    // Input wrap
    if (config.type === 'prompt') {
      inputWrap.style.display = 'block';
      inputEl.value = config.defaultValue || '';
      inputEl.placeholder = config.placeholder || '';
    } else {
      inputWrap.style.display = 'none';
      inputEl.value = '';
    }

    // Actions
    actionsEl.innerHTML = '';
    if (config.type === 'alert') {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn btn-primary';
      okBtn.textContent = config.confirmText || 'OK';
      okBtn.onclick = () => resolve(true);
      actionsEl.appendChild(okBtn);
    } else if (config.type === 'confirm') {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = config.cancelText || 'Cancel';
      cancelBtn.onclick = () => resolve(false);

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = `btn ${config.danger ? 'btn-danger' : 'btn-primary'}`;
      confirmBtn.textContent = config.confirmText || 'Confirm';
      confirmBtn.onclick = () => resolve(true);

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(confirmBtn);
    } else if (config.type === 'prompt') {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = config.cancelText || 'Cancel';
      cancelBtn.onclick = () => resolve(null);

      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = `btn ${config.danger ? 'btn-danger' : 'btn-primary'}`;
      submitBtn.textContent = config.confirmText || 'Submit';
      submitBtn.onclick = () => resolvePrompt();

      actionsEl.appendChild(cancelBtn);
      actionsEl.appendChild(submitBtn);
    }

    currentDialogType = config.type;
    modal.classList.add('open');

    // Auto-focus appropriate element
    setTimeout(() => {
      if (config.type === 'prompt' && inputEl) {
        inputEl.focus();
        inputEl.select();
      } else {
        const primaryBtn = actionsEl.querySelector('.btn-primary, .btn-danger');
        if (primaryBtn) primaryBtn.focus();
      }
    }, 50);
  }

  /**
   * Show Custom Alert Dialog
   * @param {string} message
   * @param {Object|string} options
   * @returns {Promise<void>}
   */
  function alertModal(message, options = {}) {
    if (typeof options === 'string') {
      options = { title: options };
    }
    const type = options.type || 'info';
    let icon = 'info';
    let badgeTheme = 'info';

    if (type === 'success' || (options.title && options.title.toLowerCase().includes('success'))) {
      icon = 'success';
      badgeTheme = 'success';
    } else if (type === 'error' || type === 'danger' || (options.title && (options.title.toLowerCase().includes('error') || options.title.toLowerCase().includes('fail')))) {
      icon = 'danger';
      badgeTheme = 'danger';
    } else if (type === 'warning' || (options.title && options.title.toLowerCase().includes('warning'))) {
      icon = 'warning';
      badgeTheme = 'warning';
    }

    return new Promise((resolvePromise) => {
      activeResolver = resolvePromise;
      setupDialog({
        type: 'alert',
        title: options.title || 'Notification',
        message: String(message || ''),
        confirmText: options.confirmText || 'OK',
        icon: options.icon || icon,
        badgeTheme: options.badgeTheme || badgeTheme
      });
    });
  }

  /**
   * Show Custom Confirm Dialog
   * @param {string} message
   * @param {Object|string} options
   * @returns {Promise<boolean>}
   */
  function confirmModal(message, options = {}) {
    if (typeof options === 'string') {
      options = { title: options };
    }
    const danger = options.danger || false;
    const icon = options.icon || (danger ? 'danger' : 'question');
    const badgeTheme = options.badgeTheme || (danger ? 'danger' : 'info');

    return new Promise((resolvePromise) => {
      activeResolver = resolvePromise;
      setupDialog({
        type: 'confirm',
        title: options.title || 'Please Confirm',
        message: String(message || ''),
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        danger: danger,
        icon: icon,
        badgeTheme: badgeTheme
      });
    });
  }

  /**
   * Show Custom Prompt Dialog
   * @param {string} message
   * @param {string} defaultValue
   * @param {Object|string} options
   * @returns {Promise<string|null>}
   */
  function promptModal(message, defaultValue = '', options = {}) {
    if (typeof options === 'string') {
      options = { title: options };
    }
    const danger = options.danger || false;

    return new Promise((resolvePromise) => {
      activeResolver = resolvePromise;
      setupDialog({
        type: 'prompt',
        title: options.title || 'Input Required',
        message: String(message || ''),
        defaultValue: defaultValue,
        placeholder: options.placeholder || '',
        confirmText: options.confirmText || 'Submit',
        cancelText: options.cancelText || 'Cancel',
        danger: danger,
        icon: options.icon || (danger ? 'danger' : 'prompt'),
        badgeTheme: options.badgeTheme || (danger ? 'danger' : 'info')
      });
    });
  }

  window.TaskEarnModal = {
    alert: alertModal,
    confirm: confirmModal,
    prompt: promptModal,
    close: close,
    resolve: resolve,
    resolvePrompt: resolvePrompt,
    handleBackdropClick: handleBackdropClick
  };

  window.showCustomAlert = alertModal;
  window.showCustomConfirm = confirmModal;
  window.showCustomPrompt = promptModal;

  // Safe global polyfill: redirects native invocations to the sleek custom modal
  window.alert = function (message) {
    return alertModal(message);
  };
  window.confirm = function (message) {
    return confirmModal(message);
  };
  window.prompt = function (message, defaultValue) {
    return promptModal(message, defaultValue);
  };

})();
