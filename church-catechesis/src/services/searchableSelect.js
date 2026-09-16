// searchableSelect.js
// 네이티브 <select>를 검색 가능한 콤보박스로 감쌈 (값/required/change 이벤트 유지)

const registry = new WeakMap();

function normalize(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function optionMatches(label, query) {
  if (!query) return true;
  return normalize(label).includes(normalize(query));
}

/**
 * @param {HTMLSelectElement} selectEl
 * @param {{ placeholder?: string }} [opts]
 */
export function bindSearchableSelect(selectEl, opts = {}) {
  if (!selectEl || !(selectEl instanceof HTMLSelectElement)) return null;

  let state = registry.get(selectEl);
  if (!state) {
    state = mount(selectEl, opts);
    registry.set(selectEl, state);
  } else if (opts.placeholder && state.input) {
    state.input.placeholder = opts.placeholder;
  }
  state.syncFromSelect();
  return state;
}

/** 여러 select에 일괄 적용 */
export function bindSearchableSelects(root, selector, opts = {}) {
  const scope = root || document;
  scope.querySelectorAll(selector).forEach(el => bindSearchableSelect(el, opts));
}

function mount(selectEl, opts) {
  const placeholder = opts.placeholder || '이름·세례명 검색...';

  const wrap = document.createElement('div');
  wrap.className = 'ss-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control ss-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (selectEl.id) input.setAttribute('aria-controls', `${selectEl.id}_ss_list`);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');

  const list = document.createElement('div');
  list.className = 'ss-dropdown';
  list.hidden = true;
  list.setAttribute('role', 'listbox');
  if (selectEl.id) list.id = `${selectEl.id}_ss_list`;

  selectEl.classList.add('ss-native');
  selectEl.tabIndex = -1;
  selectEl.setAttribute('aria-hidden', 'true');

  const parent = selectEl.parentNode;
  parent.insertBefore(wrap, selectEl);
  wrap.appendChild(input);
  wrap.appendChild(list);
  wrap.appendChild(selectEl);

  const state = {
    selectEl,
    wrap,
    input,
    list,
    open: false,
    activeIndex: -1,
    filtered: [],
    syncFromSelect,
    setOpen,
    destroy,
  };

  function selectedLabel() {
    const opt = selectEl.selectedOptions?.[0];
    return opt ? opt.textContent.trim() : '';
  }

  function syncFromSelect() {
    const label = selectedLabel();
    if (!state.open) {
      input.value = label || '';
    }
    // required 표시를 위해 wrap에 상태 반영
    wrap.classList.toggle('is-empty', !selectEl.value);
  }

  function setOpen(next) {
    state.open = Boolean(next);
    list.hidden = !state.open;
    input.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    wrap.classList.toggle('is-open', state.open);
    if (state.open) {
      renderList(input.value);
      input.focus();
    } else {
      state.activeIndex = -1;
      syncFromSelect();
    }
  }

  function renderList(query) {
    const q = String(query || '').trim();
    const options = [...selectEl.options].map((opt, idx) => ({
      value: opt.value,
      label: opt.textContent.trim(),
      disabled: opt.disabled,
      index: idx,
    }));
    state.filtered = options.filter(o => !o.disabled && optionMatches(o.label, q));

    if (!state.filtered.length) {
      list.innerHTML = '<div class="ss-empty">검색 결과가 없습니다</div>';
      state.activeIndex = -1;
      return;
    }

    list.innerHTML = state.filtered.map((o, i) => {
      const selected = o.value === selectEl.value;
      return `
        <button type="button"
          class="ss-option${selected ? ' is-selected' : ''}${i === state.activeIndex ? ' is-active' : ''}"
          role="option"
          data-ss-value="${escapeAttr(o.value)}"
          data-ss-index="${i}"
          aria-selected="${selected ? 'true' : 'false'}">
          ${escapeHtml(o.label)}
        </button>
      `;
    }).join('');
  }

  function choose(value) {
    const prev = selectEl.value;
    selectEl.value = value;
    if (selectEl.value !== value) {
      // option 없을 때
      selectEl.value = prev;
      return;
    }
    setOpen(false);
    syncFromSelect();
    if (prev !== selectEl.value) {
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function moveActive(delta) {
    if (!state.filtered.length) return;
    if (!state.open) setOpen(true);
    const max = state.filtered.length - 1;
    state.activeIndex = state.activeIndex < 0
      ? (delta > 0 ? 0 : max)
      : Math.max(0, Math.min(max, state.activeIndex + delta));
    renderList(input.value);
    const active = list.querySelector('.ss-option.is-active');
    active?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => {
    setOpen(true);
    input.select();
  });

  input.addEventListener('input', () => {
    if (!state.open) setOpen(true);
    else renderList(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      if (state.open && state.activeIndex >= 0 && state.filtered[state.activeIndex]) {
        e.preventDefault();
        choose(state.filtered[state.activeIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  });

  list.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.ss-option');
    if (!btn) return;
    e.preventDefault();
    choose(btn.getAttribute('data-ss-value') || '');
  });

  // 외부에서 select.value 변경 시 표시 동기화
  selectEl.addEventListener('change', () => {
    if (!state.open) syncFromSelect();
  });

  function destroy() {
    parent.insertBefore(selectEl, wrap);
    wrap.remove();
    selectEl.classList.remove('ss-native');
    selectEl.removeAttribute('aria-hidden');
    selectEl.tabIndex = 0;
    registry.delete(selectEl);
  }

  syncFromSelect();
  return state;
}

if (typeof document !== 'undefined' && !document.documentElement.dataset.ssDocBound) {
  document.documentElement.dataset.ssDocBound = '1';
  document.addEventListener('mousedown', (e) => {
    document.querySelectorAll('.ss-wrap.is-open').forEach(wrap => {
      if (wrap.contains(e.target)) return;
      const selectEl = wrap.querySelector('select.ss-native');
      const state = selectEl ? registry.get(selectEl) : null;
      state?.setOpen(false);
    });
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
