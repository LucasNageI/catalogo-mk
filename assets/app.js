// MK Equipamientos: filtros del catálogo, WhatsApp, compartir y menú.
// Para cambiar el número de WhatsApp de ventas, editá config.js.
(function () {
  const cfg = window.MK_CONFIG || {};
  const num = String(cfg.whatsapp || '').replace(/\D/g, '');
  const waUrl = text => (num ? `https://wa.me/${num}` : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
  const pageUrl = () => location.href.split('#')[0];

  // ---- enlaces de WhatsApp genéricos
  document.querySelectorAll('[data-wa]').forEach(a => {
    const msg = a.getAttribute('data-wa') || 'Hola MK Equipamientos, quiero hacer una consulta.';
    a.href = waUrl(msg);
    a.target = '_blank'; a.rel = 'noopener';
  });

  // ---- menú en pantallas chicas
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    });
    nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  // ---- ficha de máquina: versión elegida, consulta y compartir
  const ask = document.querySelector('[data-ask]');
  if (ask) {
    const name = ask.getAttribute('data-name');
    const pick = () => {
      const r = document.querySelector('input[name="version"]:checked');
      return r ? { code: r.value, label: r.getAttribute('data-label') } : { code: ask.getAttribute('data-code'), label: '' };
    };
    const update = () => {
      const v = pick();
      const what = name + (v.label && v.label !== name ? ` (${v.label})` : '') + (v.code ? `, código ${v.code}` : '');
      ask.href = waUrl(`Hola MK Equipamientos, quiero consultar precio y disponibilidad de: ${what}.\n${pageUrl()}`);
      ask.target = '_blank'; ask.rel = 'noopener';
    };
    document.querySelectorAll('input[name="version"]').forEach(r => r.addEventListener('change', update));
    update();

    const share = document.querySelector('[data-share]');
    const status = document.querySelector('.share-status');
    share?.addEventListener('click', async () => {
      const data = { title: document.title, text: `${name}, en el catálogo de MK Equipamientos`, url: pageUrl() };
      try {
        if (navigator.share) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(pageUrl());
        if (status) status.textContent = 'Link copiado. Pegalo en WhatsApp o en un mail.';
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        if (status) status.textContent = 'Copiá el link desde la barra de direcciones: ' + pageUrl();
      }
    });
  }

  // ---- catálogo: búsqueda y filtros
  const grid = document.querySelector('[data-catalog]');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('[data-item]')];
  const q = document.getElementById('q');
  const line = document.getElementById('linea');
  const count = document.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  const reset = document.querySelector('[data-reset]');
  const state = { cat: 'todas', brand: 'todas' };
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const params = new URLSearchParams(location.search);
  if (params.get('cat')) state.cat = params.get('cat');
  if (params.get('marca')) state.brand = params.get('marca');
  if (params.get('q') && q) q.value = params.get('q');
  if (params.get('linea') && line) line.value = params.get('linea');

  function setPressed(group, val) {
    document.querySelectorAll(`[data-${group}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(`data-${group}`) === val)));
  }
  function apply(push) {
    const words = norm(q?.value).split(/\s+/).filter(Boolean);
    const ln = line?.value || '';
    let n = 0;
    cards.forEach(c => {
      const ok = (state.cat === 'todas' || c.dataset.cat === state.cat)
        && (state.brand === 'todas' || c.dataset.brand === state.brand)
        && (!ln || (c.dataset.lines || '').split('|').includes(ln))
        && words.every(w => c.dataset.text.includes(w));
      c.hidden = !ok; if (ok) n++;
    });
    if (count) count.textContent = n === 1 ? '1 máquina' : `${n} máquinas`;
    if (empty) empty.hidden = n !== 0;
    setPressed('cat', state.cat); setPressed('brand', state.brand);
    if (push) {
      const p = new URLSearchParams();
      if (state.cat !== 'todas') p.set('cat', state.cat);
      if (state.brand !== 'todas') p.set('marca', state.brand);
      if (ln) p.set('linea', ln);
      if (q?.value.trim()) p.set('q', q.value.trim());
      history.replaceState(null, '', (p.toString() ? '?' + p : location.pathname) + '#catalogo');
    }
  }
  document.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { state.cat = b.dataset.cat; apply(true); }));
  document.querySelectorAll('[data-brand]').forEach(b => b.addEventListener('click', () => { state.brand = b.dataset.brand; apply(true); }));
  q?.addEventListener('input', () => apply(true));
  line?.addEventListener('change', () => apply(true));
  reset?.addEventListener('click', () => { state.cat = 'todas'; state.brand = 'todas'; if (q) q.value = ''; if (line) line.value = ''; apply(true); q?.focus(); });
  // los accesos de "Familias" filtran sin recargar
  document.querySelectorAll('[data-go-cat]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); state.cat = a.dataset.goCat; apply(true);
    document.getElementById('catalogo').scrollIntoView();
  }));
  apply(false);
  if (params.toString() && location.hash === '#catalogo') document.getElementById('catalogo').scrollIntoView();
})();
