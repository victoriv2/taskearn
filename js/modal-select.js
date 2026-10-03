/**
 * TaskEarn - Universal Modal Select Component
 * Transforms native dropdown select menus into straightforward, responsive modals
 * ("modula") for both mobile (bottom-sheet) and desktop (centered dialog).
 * ZERO emojis, strictly SVG icons, zero hover lifts.
 */

(function () {
  'use strict';

  let currentTargetSelect = null;
  let allModalOptions = [];

  const TITLE_MAP = {
    'taskStatusFilter': 'Filter Tasks',
    'taskSortFilter': 'Sort Tasks',
    'wdrBankSelect': 'Select Nigerian Bank',
    'admUserStatusFilter': 'Filter User Status',
    'admUserSortFilter': 'Sort Users',
    'admTaskCategoryFilter': 'Filter by Platform',
    'admTaskStatusFilter': 'Filter Task Status',
    'admTaskSortFilter': 'Sort Tasks',
    'taskCategory': 'Select Platform',
    'editTaskStatus': 'Select Task Status'
  };

  function ensureModalInDOM() {
    if (document.getElementById('selectOptionModal')) return;

    const modalHtml = `
      <div id="selectOptionModal" class="modal-backdrop" onclick="window.TaskEarnModalSelect.handleBackdropClick(event)">
        <div class="modal-dialog" style="max-width: 440px;">
          <div class="modal-header">
            <h3 id="selectOptionModalTitle" class="modal-title" style="font-size: 1.05rem; font-weight: 700; margin: 0;">Select Option</h3>
            <button type="button" class="btn btn-icon modal-close" onclick="window.TaskEarnModalSelect.closeModal()" aria-label="Close modal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div id="selectOptionModalSearchWrap" class="modal-select-search-wrap" style="display: none;">
            <span class="modal-select-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input type="text" id="selectOptionModalSearch" class="modal-select-search-input" placeholder="Type to filter..." oninput="window.TaskEarnModalSelect.filterOptions(this.value)">
          </div>
          <div id="selectOptionModalList" class="modal-select-list"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('selectOptionModal');
        if (modal && modal.classList.contains('open')) {
          closeModal();
        }
      }
    });
  }

  function getSelectTitle(select) {
    if (select.getAttribute('data-modal-title')) {
      return select.getAttribute('data-modal-title');
    }
    if (select.id && TITLE_MAP[select.id]) {
      return TITLE_MAP[select.id];
    }
    if (select.id) {
      const label = document.querySelector(`label[for="${select.id}"]`);
      if (label) {
        return label.textContent.replace('*', '').trim();
      }
    }
    const parentFormGroup = select.closest('.form-group');
    if (parentFormGroup) {
      const groupLabel = parentFormGroup.querySelector('.form-label');
      if (groupLabel) {
        return groupLabel.textContent.replace('*', '').trim();
      }
    }
    return 'Select Option';
  }

  function getSelectedText(select) {
    const selectedOption = select.options[select.selectedIndex];
    return selectedOption ? selectedOption.text : '-- Select --';
  }

  function syncTrigger(select) {
    if (typeof select === 'string') {
      select = document.getElementById(select);
    }
    if (!select) return;

    const trigger = document.querySelector(`[data-modal-select-for="${select.id || select.name}"]`);
    if (!trigger) return;

    const textEl = trigger.querySelector('.modal-select-trigger-text');
    if (textEl) {
      textEl.textContent = getSelectedText(select);
    }
  }

  function openModalFor(select) {
    if (typeof select === 'string') {
      select = document.getElementById(select);
    }
    if (!select) return;

    ensureModalInDOM();
    currentTargetSelect = select;

    const modal = document.getElementById('selectOptionModal');
    const titleEl = document.getElementById('selectOptionModalTitle');
    const searchWrap = document.getElementById('selectOptionModalSearchWrap');
    const searchInput = document.getElementById('selectOptionModalSearch');
    const listEl = document.getElementById('selectOptionModalList');

    titleEl.textContent = getSelectTitle(select);

    // Collect options
    allModalOptions = [];
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      allModalOptions.push({
        value: opt.value,
        text: opt.text,
        disabled: opt.disabled,
        selected: opt.value === select.value || opt.selected
      });
    }

    // Long lists (> 7 options, e.g. Banks list) get a quick filter search box
    if (allModalOptions.length > 7) {
      searchWrap.style.display = 'block';
      searchInput.value = '';
    } else {
      searchWrap.style.display = 'none';
      searchInput.value = '';
    }

    renderOptionList(allModalOptions);

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Update trigger aria-expanded
    const trigger = document.querySelector(`[data-modal-select-for="${select.id || select.name}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');

    if (searchWrap.style.display !== 'none') {
      setTimeout(() => searchInput.focus(), 100);
    }
  }

  function renderOptionList(options) {
    const listEl = document.getElementById('selectOptionModalList');
    if (!listEl) return;

    if (options.length === 0) {
      listEl.innerHTML = `<div class="modal-select-empty">No matching options found.</div>`;
      return;
    }

    const checkSvg = `
      <svg class="modal-select-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    listEl.innerHTML = options.map(opt => {
      const isSelected = opt.selected || (currentTargetSelect && opt.value === currentTargetSelect.value);
      return `
        <button type="button" 
          class="modal-select-item ${isSelected ? 'selected' : ''}" 
          data-value="${escapeHtmlAttr(opt.value)}"
          ${opt.disabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
          onclick="window.TaskEarnModalSelect.selectItem('${escapeHtmlAttr(opt.value)}')">
          <span style="flex: 1; text-align: left;">${escapeHtml(opt.text)}</span>
          ${isSelected ? checkSvg : ''}
        </button>
      `;
    }).join('');
  }

  function filterOptions(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      renderOptionList(allModalOptions);
      return;
    }
    const filtered = allModalOptions.filter(o => o.text.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    renderOptionList(filtered);
  }

  function selectItem(value) {
    if (!currentTargetSelect) return;

    currentTargetSelect.value = value;
    for (let i = 0; i < currentTargetSelect.options.length; i++) {
      if (currentTargetSelect.options[i].value === value) {
        currentTargetSelect.options[i].selected = true;
      } else {
        currentTargetSelect.options[i].selected = false;
      }
    }

    syncTrigger(currentTargetSelect);

    // Dispatch change and input events so all listeners update immediately
    currentTargetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    currentTargetSelect.dispatchEvent(new Event('input', { bubbles: true }));

    if (typeof currentTargetSelect.onchange === 'function') {
      currentTargetSelect.onchange();
    }

    closeModal();
  }

  function closeModal() {
    const modal = document.getElementById('selectOptionModal');
    if (modal) {
      modal.classList.remove('open');
    }
    document.body.style.overflow = '';

    if (currentTargetSelect) {
      const trigger = document.querySelector(`[data-modal-select-for="${currentTargetSelect.id || currentTargetSelect.name}"]`);
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    }
    currentTargetSelect = null;
  }

  function handleBackdropClick(event) {
    if (event.target.id === 'selectOptionModal') {
      closeModal();
    }
  }

  function enhanceSelect(select) {
    if (select.getAttribute('data-no-modal') === 'true') return;
    if (select.dataset.modalEnhanced === 'true') {
      syncTrigger(select);
      return;
    }

    const selectId = select.id || select.name || ('select_' + Math.random().toString(36).substr(2, 9));
    if (!select.id) select.id = selectId;

    select.classList.add('modal-select-hidden');
    select.dataset.modalEnhanced = 'true';

    // Create trigger button
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'modal-select-trigger';
    if (select.classList.contains('form-control') || select.closest('.form-group')) {
      trigger.classList.add('full-width');
    }

    // Preserve custom sizing if present on parent
    trigger.setAttribute('data-modal-select-for', selectId);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');

    const textSpan = document.createElement('span');
    textSpan.className = 'modal-select-trigger-text';
    textSpan.textContent = getSelectedText(select);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'modal-select-trigger-icon';
    iconSpan.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    trigger.appendChild(textSpan);
    trigger.appendChild(iconSpan);

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModalFor(select);
    });

    // Insert trigger right next to select
    select.parentNode.insertBefore(trigger, select.nextSibling);

    // Keep trigger updated on native changes
    select.addEventListener('change', function () {
      textSpan.textContent = getSelectedText(select);
    });

    if (select.form) {
      select.form.addEventListener('reset', function () {
        setTimeout(function () {
          textSpan.textContent = getSelectedText(select);
        }, 10);
      });
    }

    try {
      const nativeValueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      if (nativeValueDesc && nativeValueDesc.set) {
        Object.defineProperty(select, 'value', {
          get: function () {
            return nativeValueDesc.get.call(this);
          },
          set: function (newVal) {
            nativeValueDesc.set.call(this, newVal);
            syncTrigger(this);
          },
          configurable: true
        });
      }
    } catch (e) {
      // Fallback to manual sync
    }
  }

  function initModalSelects() {
    ensureModalInDOM();
    const selects = document.querySelectorAll('select');
    selects.forEach(enhanceSelect);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalSelects);
  } else {
    initModalSelects();
  }

  // Expose API
  window.TaskEarnModalSelect = {
    init: initModalSelects,
    open: openModalFor,
    closeModal: closeModal,
    handleBackdropClick: handleBackdropClick,
    selectItem: selectItem,
    filterOptions: filterOptions,
    sync: syncTrigger
  };

  // Re-run after window load to ensure all dynamic options/elements are captured
  window.addEventListener('load', function () {
    setTimeout(initModalSelects, 50);
  });
})();
