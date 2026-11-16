#!/usr/bin/env node
/**
 * MK Equipamientos — generador del catálogo estático.
 * Lee data/config.json + data/maquinas.json y genera /dist:
 *   dist/index.html                    → catálogo
 *   dist/maquinas/<slug>/index.html    → una página por máquina (con Open Graph propio)
 *   dist/404.html, sitemap.xml, robots.txt, assets/
 * Uso:  node build.js      (sin dependencias, Node 16+)
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/config.json"), "utf8"));
const maquinas = JSON.parse(fs.readFileSync(path.join(ROOT, "data/maquinas.json"), "utf8"));
const SITE = cfg.siteUrl.replace(/\/$/, "");
const VERSION = Date.now().toString(36); // cache-busting de css/js

/* ---------- validación de datos ---------- */
const errores = [];
const slugs = new Set();
maquinas.forEach((m, i) => {
  const id = m.slug || `#${i + 1}`;
  ["slug", "nombre", "modelo", "marca", "categoria", "descripcion"].forEach((k) => {
    if (!m[k]) errores.push(`${id}: falta el campo "${k}"`);
  });
  if (m.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug)) errores.push(`${id}: el slug solo puede tener minúsculas, números y guiones`);
  if (slugs.has(m.slug)) errores.push(`${id}: slug repetido`);
  slugs.add(m.slug);
  if (m.marca && !cfg.brands[m.marca]) errores.push(`${id}: marca "${m.marca}" no está en config.json → brands`);
  if (m.categoria && !cfg.categories[m.categoria]) errores.push(`${id}: categoría "${m.categoria}" no está en config.json → categories`);
  if (!m.imagenes || !m.imagenes.length) errores.push(`${id}: necesita al menos una imagen`);
  if (/\$\s?\d|\bprecio|\busd\b|\bars\b/i.test(JSON.stringify(m.specs || {}) + (m.descripcion || "") + (m.resumen || ""))) errores.push(`${id}: parece incluir un precio — el catálogo no muestra precios`);
  (m.imagenes || []).concat(m.pdf ? [m.pdf] : []).forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, "src", f))) errores.push(`${id}: no existe el archivo src/${f}`);
  });
});
if (errores.length) {
  console.error("\n✖ Hay errores en data/maquinas.json:\n  - " + errores.join("\n  - ") + "\n");
  process.exit(1);
}

/* ---------- helpers ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const marcaNombre = (m) => cfg.brands[m.marca].nombre;
const marcaLogo = (m, rel) => `${rel}${cfg.brands[m.marca].logo}`;
const catNombre = (slug) => cfg.categories[slug];
const urlMaquina = (m) => `${SITE}/maquinas/${m.slug}/`;
const titulo = (m) => `${m.nombre} ${marcaNombre(m)} ${m.modelo}`;
const limpiarEjemplo = (s) => s.replace(/^\[[^\]]+\]\s*/, "");
const waLink = (texto) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(texto)}`;
const waTextoMaquina = (m) => `Hola MK Equipamientos, quiero consultar por la ${titulo(m)}.\n${urlMaquina(m)}`;

const CAT_ORDEN = Object.keys(cfg.categories);
function ordenar(lista) {
  return [...lista].sort((a, b) =>
    CAT_ORDEN.indexOf(a.categoria) - CAT_ORDEN.indexOf(b.categoria) ||
    String(a.codigo || "9").localeCompare(String(b.codigo || "9"), "es", { numeric: true }) ||
    a.nombre.localeCompare(b.nombre, "es"));
}

/* ---------- íconos (SVG inline) ---------- */
const ico = {
  wa: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.5 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
  share: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  pdf: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6m-3-3 3 3 3-3"/></svg>',
  grid: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/></svg>',
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  search: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/></svg>',
  mail: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>',
  pin: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  clock: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  play: '<svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
};

/* Logo MK (imagen) */
const logoImg = (rel, cls = "logo-mark") => `<img class="${cls}" src="${rel}${cfg.logo}" alt="" width="240" height="184">`;
const brandLogos = (rel, cls = "ok-logos") => `<span class="${cls}">${Object.values(cfg.brands).map((b) => `<img src="${rel}${b.logo}" alt="${esc(b.nombre)}" width="44" height="56" loading="lazy">`).join("")}</span>`;

/* Recurso gráfico: corte de perfil de aluminio (línea técnica) */
const perfilSvg = `<svg class="perfil" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.4">
    <path d="M20 40h180v20h-14v120h14v20H20v-20h14V60H20z"/>
    <path d="M44 70h118v100H44z"/>
    <path d="M44 120h118M103 70v50"/>
    <path d="M186 60h48v30h-20v60h20v30h-48"/>
    <path d="M234 90h56v60h-56"/>
    <path d="M250 105h24v30h-24z"/>
  </g>
  <g fill="none" stroke="currentColor" stroke-width=".8" opacity=".7">
    <path d="M20 218h270M20 212v12M290 212v12"/>
    <path d="M302 40v160M296 40h12M296 200h12"/>
  </g>
  <g font-family="IBM Plex Mono, monospace" font-size="10" fill="currentColor">
    <text x="140" y="234" text-anchor="middle">270</text>
    <text x="312" y="124" transform="rotate(90 312 124)" text-anchor="middle">160</text>
  </g>
</svg>`;

/* ---------- layout común ---------- */
function layout({ rel, title, description, canonical, ogImage, ogType = "website", jsonLd = [], body, pageClass = "" }) {
  const imgAbs = ogImage ? `${SITE}/${ogImage}` : `${SITE}/assets/img/og-default.jpg`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(imgAbs)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="900">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${rel}assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${rel}assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${rel}assets/css/styles.css?v=${VERSION}">
${jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body class="${pageClass}">
<a class="skip" href="#contenido">Saltar al contenido</a>
${header(rel)}
<main id="contenido">
${body}
</main>
${footer(rel)}
<div class="toast" role="status" aria-live="polite" hidden></div>
<script src="${rel}assets/js/app.js?v=${VERSION}" defer></script>
</body>
</html>`;
}

function header(rel) {
  return `<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${rel}index.html" aria-label="${esc(cfg.siteName)} — inicio">
      ${logoImg(rel)}
      <span class="brand-text"><span class="brand-name">MK Equipamientos</span><span class="brand-tag">${esc(cfg.tagline)}</span></span>
    </a>
    <nav class="header-nav" aria-label="Principal">
      <a class="nav-link" href="${rel}index.html#catalogo">Catálogo</a>
      <a class="nav-link" href="#contacto">Contacto</a>
      <a class="btn btn-wa btn-sm" href="${waLink("Hola MK Equipamientos, quiero hacer una consulta.")}" target="_blank" rel="noopener">${ico.wa}<span class="hide-xs">WhatsApp</span></a>
    </nav>
  </div>
</header>`;
}

function footer(rel) {
  const s = cfg.social;
  return `<footer class="site-footer" id="contacto">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="brand brand--footer">${logoImg(rel)}<span class="brand-text"><span class="brand-name">MK Equipamientos</span><span class="brand-tag">${esc(cfg.tagline)}</span></span></div>
        ${brandLogos(rel, "ok-logos ok-logos--footer")}
        <p class="footer-note">Venta, puesta en marcha, servicio técnico y repuestos de maquinaria para carpintería de aluminio de fabricación nacional.</p>
      </div>
      <div>
        <h2 class="footer-h">Contacto</h2>
        <ul class="footer-list">
          <li><a href="${waLink("Hola MK Equipamientos, quiero hacer una consulta.")}" target="_blank" rel="noopener">${ico.wa}<span class="mono">${esc(cfg.whatsappDisplay)}</span></a></li>
          ${cfg.email ? `<li><a href="mailto:${esc(cfg.email)}">${ico.mail}<span>${esc(cfg.email)}</span></a></li>` : ""}
          ${cfg.address ? `<li><a href="${esc(cfg.mapsUrl)}" target="_blank" rel="noopener">${ico.pin}<span>${esc(cfg.address)}</span></a></li>` : ""}
          ${cfg.hours ? `<li>${ico.clock}<span>${esc(cfg.hours)}</span></li>` : ""}
        </ul>
      </div>
      <div>
        <h2 class="footer-h">Catálogo</h2>
        <ul class="footer-list footer-list--plain">
          ${Object.entries(cfg.categories).map(([k, v]) => `<li><a href="${rel}index.html?cat=${k}#catalogo">${esc(v)}</a></li>`).join("")}
        </ul>
      </div>
      ${s.instagram || s.facebook || s.youtube ? `      <div>
        <h2 class="footer-h">Redes</h2>
        <ul class="footer-list footer-list--plain">
          ${s.instagram ? `<li><a href="${esc(s.instagram)}" target="_blank" rel="noopener">Instagram</a></li>` : ""}
          ${s.facebook ? `<li><a href="${esc(s.facebook)}" target="_blank" rel="noopener">Facebook</a></li>` : ""}
          ${s.youtube ? `<li><a href="${esc(s.youtube)}" target="_blank" rel="noopener">YouTube</a></li>` : ""}
        </ul>
      ` : ""}
</div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} MK Equipamientos</span><span class="mono">OK Engineering · OK Industrial son marcas de sus respectivos fabricantes.</span></div>
  </div>
</footer>`;
}

/* ---------- tarjeta ---------- */
function card(m, rel, { eager = false } = {}) {
  const href = `${rel}maquinas/${m.slug}/`;
  const search = [m.nombre, m.modelo, marcaNombre(m), catNombre(m.categoria), ...(m.specsClave || [])].join(" ");
  return `<article class="card" data-marca="${m.marca}" data-cat="${m.categoria}" data-search="${esc(search)}">
  <div class="card-media">
    <img src="${rel}${m.imagenes[0]}" alt="${esc(titulo(m))}" width="1200" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    ${m.destacado ? '<span class="tag tag--accent">Destacada</span>' : ""}
    <img class="card-brandlogo" src="${marcaLogo(m, rel)}" alt="${esc(marcaNombre(m))}" width="30" height="38" loading="lazy">
  </div>
  <div class="card-body">
    <p class="card-meta"><span>${esc(marcaNombre(m))}</span><span>${esc(catNombre(m.categoria))}</span></p>
    <h3 class="card-title"><a class="stretched" href="${href}">${esc(m.nombre)} <span class="card-model">${esc(m.modelo)}</span></a></h3>
    <ul class="card-specs">${(m.specsClave || []).slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <span class="card-cta">Ver detalle ${ico.arrow}</span>
  </div>
</article>`;
}

/* ---------- home ---------- */
function home() {
  const rel = "";
  const lista = ordenar(maquinas);
  const cuenta = (k, v) => maquinas.filter((m) => m[k] === v).length;
  const body = `
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tick"></span>Catálogo de maquinaria · Aluminio y PVC</p>
      <h1 class="hero-title">Máquinas argentinas para aberturas de aluminio, <em>con quien las conoce.</em></h1>
      <p class="hero-lead">Somos distribuidores oficiales de OK Engineering y OK Industrial. Te asesoramos en la elección, hacemos la puesta en marcha y te acompañamos con servicio técnico y repuestos.</p>
      <ul class="hero-points">
        <li><span class="mono">01</span>Fabricación nacional</li>
        <li><span class="mono">02</span>Servicio técnico propio</li>
        <li><span class="mono">03</span>Repuestos en stock</li>
      </ul>
      <div class="hero-brands-xs"><span>Distribuidor<br>oficial</span>${Object.values(cfg.brands).map((b) => `<img src="${b.logo}" alt="${esc(b.nombre)}" width="36" height="46">`).join("")}</div>
    </div>
    <div class="hero-art">
      <div class="dist-card">
        <p class="dist-label mono">Distribuidor oficial</p>
        <div class="dist-logos">${Object.values(cfg.brands).map((b) => `<figure><img src="${b.logo}" alt="${esc(b.nombre)}" width="110" height="140"><figcaption>${esc(b.nombre)}</figcaption></figure>`).join("")}</div>
      </div>
      ${perfilSvg}
    </div>
  </div>
</section>

<section class="catalogo" id="catalogo" aria-labelledby="cat-h">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="tick"></span>Catálogo</p>
      <h2 id="cat-h" class="section-title">Todas las máquinas</h2>
    </div>

    <form class="filters" role="search" onsubmit="return false">
      <label class="search">
        <span class="sr-only">Buscar por nombre o modelo</span>
        ${ico.search}
        <input type="search" id="q" name="q" placeholder="Buscar por nombre o modelo (ej: OK 500)" autocomplete="off">
      </label>
      <fieldset class="chips" aria-label="Marca">
        <legend class="chips-label">Marca</legend>
        <div class="chips-row">
        <button type="button" class="chip" data-filter="marca" data-value="" aria-pressed="true">Todas</button>
        ${Object.entries(cfg.brands).map(([k, v]) => `<button type="button" class="chip" data-filter="marca" data-value="${k}" aria-pressed="false"><img class="chip-logo" src="${v.logo}" alt="" width="18" height="22">${esc(v.nombre)} <span class="chip-n">${cuenta("marca", k)}</span></button>`).join("")}
        </div>
      </fieldset>
      <fieldset class="chips" aria-label="Categoría">
        <legend class="chips-label">Categoría</legend>
        <div class="chips-row chips-row--scroll">
        <button type="button" class="chip" data-filter="cat" data-value="" aria-pressed="true">Todas</button>
        ${Object.entries(cfg.categories).map(([k, v]) => `<button type="button" class="chip" data-filter="cat" data-value="${k}" aria-pressed="false">${esc(v)} <span class="chip-n">${cuenta("categoria", k)}</span></button>`).join("")}
        </div>
      </fieldset>
    </form>

    <p class="result-count mono" id="resultCount" aria-live="polite">${lista.length} máquinas</p>
    <div class="grid" id="grid">
      ${lista.map((m, i) => card(m, rel, { eager: i < 2 })).join("\n")}
    </div>
    <div class="empty" id="empty" hidden>
      <p><strong>No encontramos máquinas con esos filtros.</strong></p>
      <p>Probá con otra búsqueda o <button type="button" class="link-btn" id="resetFilters">limpiá los filtros</button>. Si buscás algo puntual, <a href="${waLink("Hola MK Equipamientos, estoy buscando una máquina que no encuentro en el catálogo.")}" target="_blank" rel="noopener">consultanos por WhatsApp</a>.</p>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap band-inner">
    <div>
      <h2 class="band-title">¿No sabés qué máquina necesita tu taller?</h2>
      <p>Contanos qué líneas de perfiles trabajás y cuántas aberturas hacés por mes. Te recomendamos el equipo justo.</p>
    </div>
    <a class="btn btn-wa btn-lg" href="${waLink("Hola MK Equipamientos, quiero asesoramiento para equipar mi taller.")}" target="_blank" rel="noopener">${ico.wa}Pedir asesoramiento</a>
  </div>
</section>`;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: cfg.siteName, url: SITE, email: cfg.email, telephone: "+" + cfg.whatsapp, address: cfg.address },
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: lista.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: urlMaquina(m), name: titulo(m) })) },
  ];
  const destacada = lista.find((m) => m.destacado) || lista[0];
  return layout({
    rel,
    title: `Catálogo de máquinas para carpintería de aluminio | ${cfg.siteName}`,
    description: "Punzonadoras, prensas neumáticas, cortadoras, mesas de medición y fresadoras CNC OK Industrial y OK Engineering. Distribuidor oficial con servicio técnico y repuestos.",
    canonical: `${SITE}/`,
    ogImage: destacada.imagenes[0],
    jsonLd,
    body,
    pageClass: "page-home",
  });
}

/* ---------- detalle ---------- */
function relacionadas(m) {
  const otras = maquinas.filter((x) => x.slug !== m.slug);
  const misma = ordenar(otras.filter((x) => x.categoria === m.categoria));
  const resto = ordenar(otras.filter((x) => x.categoria !== m.categoria && x.marca === m.marca));
  const resto2 = ordenar(otras.filter((x) => x.categoria !== m.categoria && x.marca !== m.marca));
  return { lista: [...misma, ...resto, ...resto2].slice(0, 3), hayMisma: misma.length > 0 };
}

function videoEmbed(v) {
  if (!v) return "";
  const yt = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || (/^[\w-]{11}$/.test(v) ? [0, v] : null);
  if (yt) {
    const id = yt[1];
    return `<button type="button" class="video-lite" data-yt="${id}" aria-label="Reproducir video">
      <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">
      <span class="video-play">${ico.play}</span>
    </button>`;
  }
  return `<video controls preload="none" playsinline src="${esc(v)}"></video>`;
}

function detalle(m) {
  const rel = "../../";
  const t = titulo(m);
  const desc = m.resumen || limpiarEjemplo(m.descripcion).slice(0, 155);
  const rels = relacionadas(m);
  const imgs = m.imagenes;
  const catHref = `${rel}index.html?cat=${m.categoria}#catalogo`;

  const body = `
<div class="detail-top">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Ruta de navegación">
      <ol>
        <li><a href="${rel}index.html#catalogo">Catálogo</a></li>
        <li><a href="${catHref}">${esc(catNombre(m.categoria))}</a></li>
        <li aria-current="page">${esc(m.modelo)}</li>
      </ol>
    </nav>
    <a class="btn btn-ghost btn-sm all-link" href="${rel}index.html#catalogo">${ico.grid}Ver catálogo completo</a>
  </div>
</div>

<article class="product" data-slug="${m.slug}" data-title="${esc(t)}" data-wa="${cfg.whatsapp}">
  <div class="wrap product-grid">
    <div class="gallery" aria-roledescription="carrusel" aria-label="Fotos de ${esc(t)}">
      <div class="gallery-track" id="galleryTrack" tabindex="0">
        ${imgs.map((src, i) => `<figure class="gallery-slide" id="foto-${i + 1}" aria-label="Foto ${i + 1} de ${imgs.length}">
          <img src="${rel}${src}" alt="${esc(t)} — foto ${i + 1}" width="1200" height="900" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
        </figure>`).join("")}
      </div>
      ${imgs.length > 1 ? `<div class="gallery-bar">
        <div class="thumbs" role="tablist" aria-label="Elegir foto">
          ${imgs.map((src, i) => `<button type="button" class="thumb" role="tab" aria-selected="${i === 0}" aria-label="Ver foto ${i + 1}" data-index="${i}"><img src="${rel}${src}" alt="" width="120" height="90" loading="lazy"></button>`).join("")}
        </div>
        <span class="gallery-count mono" aria-hidden="true"><span id="galleryIdx">1</span> / ${imgs.length}</span>
      </div>` : ""}
    </div>

    <div class="product-info">
      <p class="product-brand"><span class="brand-pill"><img src="${marcaLogo(m, rel)}" alt="" width="20" height="26">${esc(marcaNombre(m))}</span><span class="mono">${esc(catNombre(m.categoria))}</span></p>
      <h1 class="product-title">${esc(m.nombre)}</h1>
      <p class="product-model mono">Modelo <strong>${esc(m.modelo)}</strong></p>
      ${m.resumen ? `<p class="product-lead">${esc(m.resumen)}</p>` : ""}
      ${(m.specsClave || []).length ? `<ul class="key-specs">${m.specsClave.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      <div class="product-actions">
        <a class="btn btn-wa btn-lg btn-block js-wa" href="${waLink(waTextoMaquina(m))}" target="_blank" rel="noopener">${ico.wa}Consultar por WhatsApp</a>
        <div class="actions-row">
          <button type="button" class="btn btn-outline js-share">${ico.share}Compartir</button>
          ${m.pdf ? `<a class="btn btn-outline" href="${rel}${m.pdf}" download target="_blank" rel="noopener">${ico.pdf}Folleto / ficha PDF</a>` : ""}
        </div>
      </div>
      <p class="product-note">Respondemos en horario comercial. Precio, disponibilidad y financiación por WhatsApp.</p>
    </div>
  </div>

  <div class="wrap product-sections">
    <section class="block" aria-labelledby="desc-h">
      <h2 class="block-title" id="desc-h"><span class="mono">01</span>Descripción</h2>
      <div class="prose"><p>${esc(m.descripcion)}</p></div>
    </section>

    <section class="block" aria-labelledby="specs-h">
      <h2 class="block-title" id="specs-h"><span class="mono">02</span>Especificaciones técnicas</h2>
      <table class="specs">
        <caption class="sr-only">Especificaciones técnicas de ${esc(t)}</caption>
        <tbody>
          ${Object.entries(m.specs || {}).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
        </tbody>
      </table>
      <p class="small-note">Datos según documentación del fabricante. Pueden variar sin previo aviso.</p>
    </section>

    ${(m.aplicaciones || []).length ? `<section class="block" aria-labelledby="apl-h">
      <h2 class="block-title" id="apl-h"><span class="mono">03</span>Aplicaciones</h2>
      <ul class="apps">${m.aplicaciones.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    </section>` : ""}

    ${m.video ? `<section class="block" aria-labelledby="vid-h">
      <h2 class="block-title" id="vid-h"><span class="mono">04</span>Video</h2>
      <div class="video">${videoEmbed(m.video)}</div>
    </section>` : ""}
  </div>
</article>

${rels.lista.length ? `<section class="related" aria-labelledby="rel-h">
  <div class="wrap">
    <div class="section-head section-head--row">
      <div>
        <p class="eyebrow"><span class="tick"></span>${rels.hayMisma ? esc(catNombre(m.categoria)) : "Seguí explorando"}</p>
        <h2 class="section-title" id="rel-h">${rels.hayMisma ? "Máquinas relacionadas" : "Otras máquinas del catálogo"}</h2>
      </div>
      <a class="btn btn-ghost" href="${rel}index.html#catalogo">${ico.grid}Ver catálogo completo</a>
    </div>
    <div class="grid grid--related">${rels.lista.map((r) => card(r, rel)).join("\n")}</div>
  </div>
</section>` : ""}

<div class="sticky-cta" aria-label="Acciones rápidas">
  <a class="btn btn-wa js-wa" href="${waLink(waTextoMaquina(m))}" target="_blank" rel="noopener">${ico.wa}Consultar</a>
  <button type="button" class="btn btn-dark js-share" aria-label="Compartir">${ico.share}</button>
  <a class="btn btn-dark" href="${rel}index.html#catalogo" aria-label="Ver catálogo completo">${ico.grid}</a>
</div>`;

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Product",
      name: t, model: m.modelo, sku: m.modelo,
      brand: { "@type": "Brand", name: marcaNombre(m) },
      category: catNombre(m.categoria),
      description: limpiarEjemplo(m.descripcion),
      image: m.imagenes.map((i) => `${SITE}/${i}`),
      url: urlMaquina(m),
      additionalProperty: Object.entries(m.specs || {}).map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Catálogo", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: catNombre(m.categoria), item: `${SITE}/?cat=${m.categoria}` },
        { "@type": "ListItem", position: 3, name: m.modelo, item: urlMaquina(m) },
      ],
    },
  ];

  return layout({
    rel,
    title: `${t} | ${cfg.siteName}`,
    description: desc,
    canonical: urlMaquina(m),
    ogImage: m.imagenes[0],
    ogType: "product",
    jsonLd,
    body,
    pageClass: "page-detail",
  });
}

/* ---------- 404 ---------- */
function notFound() {
  // 404 se sirve desde cualquier ruta: usamos rutas absolutas desde la raíz
  const html = layout({
    rel: "/",
    title: `Página no encontrada | ${cfg.siteName}`,
    description: "La página que buscás no existe.",
    canonical: `${SITE}/404.html`,
    ogImage: maquinas[0].imagenes[0],
    body: `<section class="wrap notfound"><p class="eyebrow mono">Error 404</p><h1 class="section-title">Esta máquina no está en el catálogo</h1><p>Puede que el link esté incompleto o que el modelo ya no esté disponible.</p><a class="btn btn-wa btn-lg" href="/index.html#catalogo">${ico.grid}Ver catálogo completo</a></section>`,
  });
  return html.replace("<head>", '<head>\n<meta name="robots" content="noindex">');
}

/* ---------- escritura ---------- */
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function write(rel, content) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

rmrf(DIST);
copyDir(path.join(ROOT, "src/assets"), path.join(DIST, "assets"));
write("index.html", home());
maquinas.forEach((m) => write(`maquinas/${m.slug}/index.html`, detalle(m)));
write("404.html", notFound());
const hoy = new Date().toISOString().slice(0, 10);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${hoy}</lastmod><priority>1.0</priority></url>
${maquinas.map((m) => `  <url><loc>${urlMaquina(m)}</loc><lastmod>${hoy}</lastmod><priority>0.8</priority></url>`).join("\n")}
</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`✔ Catálogo generado en dist/ — ${maquinas.length} máquinas`);
maquinas.forEach((m) => console.log(`   /maquinas/${m.slug}/`));
