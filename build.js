#!/usr/bin/env node
/**
 * MK Equipamientos — generador del catálogo estático.
 * Lee data/config.json + data/maquinas.json y genera /dist:
 *   dist/index.html                    → catálogo
 *   dist/maquinas/<slug>/index.html    → una página por máquina (con Open Graph propio)
 *   dist/404.html, sitemap.xml, robots.txt, assets/
 * Uso:  node build.js                     (usa el diseño de config.json → theme)
 *       node build.js --theme=b --out=x   (genera otra variante de diseño en la carpeta x)
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const DIST = path.join(ROOT, arg("out") || "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data/config.json"), "utf8"));
const maquinas = JSON.parse(fs.readFileSync(path.join(ROOT, "data/maquinas.json"), "utf8"));
const SITE = cfg.siteUrl.replace(/\/$/, "");
const VERSION = Date.now().toString(36);

/* Diseños disponibles: cambiá "theme" en data/config.json */
const THEMES = {
  a: { nombre: "Taller claro", fonts: "family=Archivo:wdth,wght@62..125,500..800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500", color: "#ffffff" },
  b: { nombre: "Grafito", fonts: "family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500", color: "#111417" },
  c: { nombre: "Ficha técnica", fonts: "family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600", color: "#f3f1ec" },
};
const THEME = arg("theme") || cfg.theme || "a";
if (!THEMES[THEME]) { console.error(`✖ Diseño "${THEME}" no existe. Opciones: ${Object.keys(THEMES).join(", ")}`); process.exit(1); }

/* ---------- validación de datos ---------- */
const errores = [];
const slugs = new Set();
maquinas.forEach((m, i) => {
  const id = m.slug || `#${i + 1}`;
  ["slug", "nombre", "modelo", "categoria", "descripcion"].forEach((k) => { if (!m[k]) errores.push(`${id}: falta el campo "${k}"`); });
  if (m.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug)) errores.push(`${id}: el slug solo puede tener minúsculas, números y guiones`);
  if (slugs.has(m.slug)) errores.push(`${id}: slug repetido`);
  slugs.add(m.slug);
  if (m.categoria && !cfg.categories[m.categoria]) errores.push(`${id}: categoría "${m.categoria}" no está en config.json → categories`);
  (m.lineas || []).forEach((l) => { if (!(cfg.lineas || {})[l]) errores.push(`${id}: línea "${l}" no está en config.json → lineas`); });
  if (!m.imagenes || !m.imagenes.length) errores.push(`${id}: necesita al menos una imagen`);
  if (/\$\s?\d|\bprecio|\busd\b|\bars\b/i.test(JSON.stringify(m.specs || {}) + (m.descripcion || "") + (m.resumen || ""))) errores.push(`${id}: parece incluir un precio — el catálogo no muestra precios`);
  (m.imagenes || []).concat(m.pdf ? [m.pdf] : []).forEach((f) => { if (!fs.existsSync(path.join(ROOT, "src", f))) errores.push(`${id}: no existe el archivo src/${f}`); });
});
if (errores.length) { console.error("\n✖ Hay errores en data/maquinas.json:\n  - " + errores.join("\n  - ") + "\n"); process.exit(1); }

/* ---------- helpers ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const catNombre = (slug) => cfg.categories[slug].nombre;
const catBajada = (slug) => cfg.categories[slug].bajada || "";
const LIN_ORDEN = Object.keys(cfg.lineas || {});
const linNombre = (k) => cfg.lineas[k];
const lineasTxt = (m) => (m.lineas || []).length ? "Línea " + m.lineas.map(linNombre).join(" · ") : "Todas las líneas";
const urlMaquina = (m) => `${SITE}/maquinas/${m.slug}/`;
const titulo = (m) => m.nombre;
const waLink = (texto) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(texto)}`;
const waTextoMaquina = (m) => `Hola MK Equipamientos, quiero consultar por la ${titulo(m)} (${m.modelo}).\n${urlMaquina(m)}`;
const CAT_ORDEN = Object.keys(cfg.categories);
const ordenar = (lista) => [...lista].sort((a, b) =>
  CAT_ORDEN.indexOf(a.categoria) - CAT_ORDEN.indexOf(b.categoria) ||
  String(a.codigo || "9").localeCompare(String(b.codigo || "9"), "es", { numeric: true }) ||
  a.nombre.localeCompare(b.nombre, "es"));
const porCat = (c) => ordenar(maquinas.filter((m) => m.categoria === c));
const pad2 = (n) => String(n).padStart(2, "0");
/* imágenes livianas para celular: si existe assets/img/sm/<foto>, se usa con srcset */
const smOf = (src) => { const s = src.replace("assets/img/", "assets/img/sm/"); return s !== src && fs.existsSync(path.join(ROOT, "src", s)) ? s : null; };
const smSrc = (src) => smOf(src) || src;
const imgSet = (rel, src, sizes) => { const s = smOf(src); return s ? `src="${rel}${s}" srcset="${rel}${s} 600w, ${rel}${src} 1200w" sizes="${sizes}"` : `src="${rel}${src}"`; };

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

ico.wrench = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.6-.4-.4-2.6z"/></svg>';
ico.chat = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
ico.bolt = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M13 3 5 13h6l-1 8 8-10h-6z"/></svg>';
ico.box = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>';

const logoImg = (rel, cls = "logo-mark") => `<img class="${cls}" src="${rel}${cfg.logo}" alt="" width="200" height="153">`;
const partnerLogos = (rel, cls = "partners") => `<span class="${cls}">${cfg.partners.map((b) => `<img src="${rel}${b.logo}" alt="${esc(b.nombre)}" width="44" height="58">`).join("")}</span>`;

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
  const imgAbs = `${SITE}/${ogImage}`;
  return `<!doctype html>
<html lang="es-AR" data-theme="${THEME}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="${THEMES[THEME].color}">
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
<link rel="stylesheet" href="${rel}assets/css/base.css?v=${VERSION}">
<link rel="stylesheet" href="${rel}assets/css/theme-${THEME}.css?v=${VERSION}">
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
    <a class="brand" href="${rel}index.html" aria-label="${esc(cfg.siteName)}: ir al catálogo">
      ${logoImg(rel)}
      <span class="brand-text"><span class="brand-name">MK Equipamientos</span><span class="brand-tag">${esc(cfg.tagline)}</span></span>
    </a>
    <nav class="header-nav" aria-label="Principal">
      <a class="nav-link" href="${rel}index.html#catalogo">Catálogo</a>
      <a class="nav-link" href="#contacto">Contacto</a>
      <a class="btn btn-cta btn-sm" href="${waLink("Hola MK Equipamientos, quiero hacer una consulta.")}" target="_blank" rel="noopener">${ico.wa}<span class="hide-xs">WhatsApp</span></a>
    </nav>
  </div>
</header>`;
}

function footer(rel) {
  const s = cfg.social || {};
  const redes = [["Instagram", s.instagram], ["Facebook", s.facebook], ["YouTube", s.youtube]].filter((r) => r[1]);
  return `<footer class="site-footer" id="contacto">
  <div class="wrap">
    <div class="footer-cta">
      <div>
        <p class="eyebrow">Asesoramiento sin cargo</p>
        <h2 class="footer-cta-title">¿No sabés qué máquina necesita tu taller?</h2>
        <p class="footer-cta-text">Contanos qué líneas de perfiles trabajás y cuántas aberturas hacés por mes. Te recomendamos el equipo justo.</p>
      </div>
      <a class="btn btn-cta btn-lg" href="${waLink("Hola MK Equipamientos, quiero asesoramiento para equipar mi taller.")}" target="_blank" rel="noopener">${ico.wa}Hablar con un asesor</a>
    </div>
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="brand">${logoImg(rel)}<span class="brand-text"><span class="brand-name">MK Equipamientos</span><span class="brand-tag">${esc(cfg.tagline)}</span></span></div>
        <p class="footer-note">Venta, puesta en marcha, servicio técnico y repuestos de maquinaria nacional para carpintería de aluminio y PVC.</p>
        ${partnerLogos(rel, "partners partners--footer")}
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
          ${CAT_ORDEN.map((k) => `<li><a href="${rel}index.html?cat=${k}#catalogo">${esc(catNombre(k))}</a></li>`).join("")}
        </ul>
      </div>
      ${redes.length ? `<div><h2 class="footer-h">Redes</h2><ul class="footer-list footer-list--plain">${redes.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${n}</a></li>`).join("")}</ul></div>` : ""}
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} MK Equipamientos</span><span class="mono">Fabricación nacional · OK Industrial · OK Engineering</span></div>
  </div>
</footer>`;
}

/* ---------- tarjeta ---------- */
function card(m, rel, { eager = false, n } = {}) {
  const href = `${rel}maquinas/${m.slug}/`;
  const search = [m.nombre, m.modelo, catNombre(m.categoria), m.codigo, lineasTxt(m), m.specs && m.specs["Líneas compatibles"], ...(m.specsClave || [])].join(" ");
  return `<article class="card" data-cat="${m.categoria}" data-lineas="${(m.lineas || []).join(" ") || "todas"}" data-search="${esc(search)}">
  <div class="card-media">
    <img ${imgSet(rel, m.imagenes[0], "(max-width: 979px) 50vw, 320px")} alt="${esc(titulo(m))}" width="1200" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    ${m.destacado ? '<span class="tag">Destacada</span>' : ""}
  </div>
  <div class="card-body">
    <p class="card-meta"><span class="card-cat">${esc(catNombre(m.categoria))}</span>${n ? `<span class="card-n mono">${pad2(n)}</span>` : ""}</p>
    <h3 class="card-title"><a class="stretched" href="${href}">${esc(m.nombre)}</a></h3>
    <p class="card-model mono">${esc(m.modelo)}</p>
    <p class="card-linea${(m.lineas || []).length ? "" : " card-linea--todas"}">${esc(lineasTxt(m))}</p>
    <ul class="card-specs">${(m.specsClave || []).slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <span class="card-cta">Ver detalle ${ico.arrow}</span>
  </div>
</article>`;
}

/* tarjeta compacta (recomendadas) */
function mini(m, rel) {
  return `<li class="mini">
  <a href="${rel}maquinas/${m.slug}/">
    <span class="mini-media"><img src="${rel}${smSrc(m.imagenes[0])}" alt="" width="160" height="120" loading="lazy" decoding="async"></span>
    <span class="mini-body">
      <span class="mini-cat">${esc(catNombre(m.categoria))}${(m.lineas || []).length ? " · " + esc(m.lineas.map(linNombre).join(" · ")) : ""}</span>
      <span class="mini-title">${esc(m.nombre)}</span>
      <span class="mini-model mono">${esc(m.modelo)}</span>
    </span>
    <span class="mini-arrow">${ico.arrow}</span>
  </a>
</li>`;
}

/* ---------- home ---------- */
function home() {
  const rel = "";
  const lista = ordenar(maquinas);
  const destacadas = lista.filter((m) => m.destacado);
  const hero = destacadas.find((m) => m.slug.startsWith("condor")) || destacadas[0] || lista[0];
  const body = `
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tick"></span>Maquinaria para aberturas de aluminio y PVC</p>
      <h1 class="hero-title">Equipá tu taller con <em>máquinas argentinas</em> y respaldo real.</h1>
      <p class="hero-lead">Somos distribuidores oficiales de OK Industrial y OK Engineering. Te asesoramos en la elección, hacemos la puesta en marcha y te acompañamos con servicio técnico y repuestos.</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="#catalogo">${ico.grid}Ver las ${maquinas.length} máquinas</a>
        <a class="btn btn-ghost btn-lg" href="${waLink("Hola MK Equipamientos, quiero asesoramiento para equipar mi taller.")}" target="_blank" rel="noopener">${ico.wa}Pedir asesoramiento</a>
      </div>
      <div class="hero-partners">${partnerLogos(rel)}<span>Distribuidor oficial<br><strong>OK Industrial · OK Engineering</strong></span></div>
    </div>
    <div class="hero-show" data-interval="5000" aria-roledescription="carrusel" aria-label="Máquinas del catálogo">
      <div class="hero-show-stage">
        ${[hero, ...lista.filter((x) => x.slug !== hero.slug)].map((m, i, arr) => `<a class="hero-feature hs-slide${i === 0 ? " is-active" : ""}" href="maquinas/${m.slug}/" aria-label="${esc(m.nombre)}"${i === 0 ? "" : ' aria-hidden="true" tabindex="-1"'}>
        <span class="hero-feature-media"><img ${i === 0 ? `${imgSet("", m.imagenes[0], "(max-width: 979px) 100vw, 600px")} fetchpriority="high"` : `data-src="${smSrc(m.imagenes[0])}"${smOf(m.imagenes[0]) ? ` data-srcset="${smOf(m.imagenes[0])} 600w, ${m.imagenes[0]} 1200w" sizes="(max-width: 979px) 100vw, 600px"` : ""}`} alt="${esc(m.nombre)}" width="1200" height="900" decoding="async"></span>
        <span class="hero-feature-cap">
          <span class="hero-feature-label">${esc(catNombre(m.categoria))}<span class="mono hs-n">${pad2(i + 1)} / ${pad2(arr.length)}</span></span>
          <span class="hero-feature-name">${esc(m.nombre)}</span>
          <span class="hero-feature-specs mono">${(m.specsClave || []).map(esc).join(" · ")}</span>
        </span>
        <span class="hero-feature-go">${ico.arrow}</span>
      </a>`).join("\n        ")}
      </div>
      <div class="hs-controls">
        <button type="button" class="hs-btn hs-prev" aria-label="Máquina anterior"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m5-5-5 5 5 5"/></svg></button>
        <button type="button" class="hs-btn hs-toggle" aria-label="Pausar"><svg class="i-pause" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg><svg class="i-play" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></button>
        <button type="button" class="hs-btn hs-next" aria-label="Máquina siguiente">${ico.arrow}</button>
      </div>
    </div>
  </div>
  <div class="wrap">
    <ul class="hero-stats">
      <li><strong>${maquinas.length}</strong><span>máquinas en catálogo</span></li>
      <li><strong>${CAT_ORDEN.length}</strong><span>etapas del taller</span></li>
      <li><strong>100%</strong><span>fabricación nacional</span></li>
      <li><strong>Post-venta</strong><span>servicio técnico y repuestos</span></li>
    </ul>
  </div>
</section>

<section class="cats" aria-labelledby="cats-h">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="tick"></span>Por etapa del taller</p>
      <h2 id="cats-h" class="section-title">¿Qué parte del taller querés equipar?</h2>
      <p class="section-sub">Ordenadas como trabaja una carpintería: primero se corta, después se punzona y se mecaniza.</p>
    </div>
    <ul class="cat-tiles">
      ${CAT_ORDEN.map((k, i) => { const ms = porCat(k); const img = (ms.find((m) => m.destacado) || ms[0]).imagenes[0]; return `<li><a class="cat-tile" href="?cat=${k}#catalogo" data-cat-link="${k}">
        <span class="cat-tile-media"><img src="${smSrc(img)}" alt="" width="600" height="450" loading="lazy"></span>
        <span class="cat-tile-n mono">${pad2(i + 1)}</span>
        <span class="cat-tile-name">${esc(catNombre(k))}</span>
        <span class="cat-tile-sub">${esc(catBajada(k))}</span>
        <span class="cat-tile-count mono">${ms.length} ${ms.length === 1 ? "modelo" : "modelos"} ${ico.arrow}</span>
      </a></li>`; }).join("")}
    </ul>
    <div class="lineas-box">
      <div class="lineas-head">
        <p class="eyebrow"><span class="tick"></span>Por línea de perfiles</p>
        <h3 class="lineas-title">¿Qué línea fabricás?</h3>
        <p class="section-sub">Te mostramos las punzonadoras y prensas para esa línea, más el corte, las mesas y el CNC que sirven para todas.</p>
      </div>
      <ul class="lineas-list">
        ${LIN_ORDEN.map((k) => { const n = maquinas.filter((m) => (m.lineas || []).includes(k)).length; return `<li><a class="linea-btn" href="?linea=${k}#catalogo" data-linea-link="${k}"><span class="linea-name">${esc(linNombre(k))}</span><span class="linea-n mono">${n} ${n === 1 ? "específica" : "específicas"} ${ico.arrow}</span></a></li>`; }).join("")}
      </ul>
    </div>
  </div>
</section>

<section class="catalogo" id="catalogo" aria-labelledby="cat-h">
  <div class="wrap">
    <div class="section-head section-head--row">
      <div>
        <p class="eyebrow"><span class="tick"></span>Catálogo</p>
        <h2 id="cat-h" class="section-title">Todas las máquinas</h2>
      </div>
      <p class="result-count mono" id="resultCount" aria-live="polite">${lista.length} máquinas</p>
    </div>
    <form class="filters" role="search" onsubmit="return false">
      <label class="search">
        <span class="sr-only">Buscar por nombre o modelo</span>
        ${ico.search}
        <input type="search" id="q" name="q" placeholder="Buscar: Módena, A40, Cóndor…" autocomplete="off">
      </label>
      <div class="chip-groups">
        <div class="chip-group">
          <span class="chip-label mono">Etapa</span>
          <div class="chips" role="group" aria-label="Filtrar por etapa del taller">
            <button type="button" class="chip" data-filter="cat" data-value="" aria-pressed="true">Todas</button>
            ${CAT_ORDEN.map((k) => `<button type="button" class="chip" data-filter="cat" data-value="${k}" aria-pressed="false">${esc(catNombre(k))} <span class="chip-n">${porCat(k).length}</span></button>`).join("")}
          </div>
        </div>
        <div class="chip-group">
          <span class="chip-label mono">Línea</span>
          <div class="chips" role="group" aria-label="Filtrar por línea de perfiles">
            <button type="button" class="chip" data-filter="linea" data-value="" aria-pressed="true">Todas</button>
            ${LIN_ORDEN.map((k) => `<button type="button" class="chip" data-filter="linea" data-value="${k}" aria-pressed="false">${esc(linNombre(k))}</button>`).join("")}
          </div>
        </div>
      </div>
    </form>
    <p class="filter-note" id="filterNote" hidden></p>
    <div class="grid" id="grid">
      ${lista.map((m, i) => card(m, rel, { n: i + 1 })).join("\n")}
    </div>
    <div class="empty" id="empty" hidden>
      <p><strong>No encontramos máquinas con esa búsqueda.</strong></p>
      <p>Probá con otra palabra o <button type="button" class="link-btn" id="resetFilters">mostrá todas</button>. Si buscás algo puntual, <a href="${waLink("Hola MK Equipamientos, estoy buscando una máquina que no encuentro en el catálogo.")}" target="_blank" rel="noopener">consultanos por WhatsApp</a>: trabajamos muchos equipos a pedido.</p>
    </div>
  </div>
</section>

<section class="services" aria-labelledby="srv-h">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="tick"></span>Por qué MK</p>
      <h2 id="srv-h" class="section-title">Mucho más que vender la máquina</h2>
    </div>
    <ul class="services-grid">
      <li><span class="srv-ico">${ico.chat}</span><h3>Asesoramiento</h3><p>Te ayudamos a elegir según las líneas que trabajás y tu volumen de producción.</p></li>
      <li><span class="srv-ico">${ico.bolt}</span><h3>Puesta en marcha</h3><p>Instalamos la máquina y te mostramos cómo sacarle el máximo desde el primer día.</p></li>
      <li><span class="srv-ico">${ico.wrench}</span><h3>Servicio técnico</h3><p>Respaldo directo de fábrica para mantenimiento y reparaciones.</p></li>
      <li><span class="srv-ico">${ico.box}</span><h3>Repuestos y matrices</h3><p>Repuestos originales y matrices para las líneas de perfiles más usadas.</p></li>
    </ul>
  </div>
</section>`;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: cfg.siteName, url: SITE, telephone: "+" + cfg.whatsapp, address: cfg.address },
    { "@context": "https://schema.org", "@type": "ItemList", itemListElement: lista.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: urlMaquina(m), name: titulo(m) })) },
  ];
  return layout({
    rel,
    title: `Catálogo de máquinas para carpintería de aluminio | ${cfg.siteName}`,
    description: "Punzonadoras, prensas neumáticas, cortadoras, mesas de medición y fresadoras CNC de fabricación nacional. Distribuidor oficial OK Industrial · OK Engineering, con servicio técnico y repuestos.",
    canonical: `${SITE}/`,
    ogImage: hero.imagenes[0],
    jsonLd, body, pageClass: "page-home",
  });
}

/* ---------- detalle ---------- */
function recomendadas(m) {
  // Lógica de taller: primero lo que sirve para la misma línea (o la misma etapa),
  // después una máquina de cada etapa que falta para completar el proceso.
  const otras = maquinas.filter((x) => x.slug !== m.slug);
  const comparteLinea = (x) => (x.lineas || []).some((l) => (m.lineas || []).includes(l));
  const prio = (x) => (comparteLinea(x) ? 0 : 2) + (x.destacado ? 0 : 1);
  let g1 = [], t1 = "";
  if ((m.lineas || []).length) { g1 = ordenar(otras.filter(comparteLinea)); t1 = `Más para ${lineasTxt(m).replace("Línea", "línea")}`; }
  if (!g1.length) { g1 = ordenar(otras.filter((x) => x.categoria === m.categoria)).sort((a, b) => prio(a) - prio(b)); t1 = `Más de ${catNombre(m.categoria).toLowerCase()}`; }
  g1 = g1.slice(0, 3);
  const usados = new Set(g1.map((x) => x.slug));
  // si la máquina es de una línea, no recomendamos punzonadoras de otra línea
  const sirve = (x) => !(m.lineas || []).length || !(x.lineas || []).length || comparteLinea(x);
  const g2 = CAT_ORDEN.filter((c) => c !== m.categoria).map((c) => ordenar(otras.filter((x) => x.categoria === c && !usados.has(x.slug) && sirve(x))).sort((a, b) => prio(a) - prio(b))[0]).filter(Boolean);
  return { t1, misma: g1, otras: g2 };
}

function videoEmbed(v) {
  if (!v) return "";
  const yt = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || (/^[\w-]{11}$/.test(v) ? [0, v] : null);
  if (yt) return `<button type="button" class="video-lite" data-yt="${yt[1]}" aria-label="Reproducir video"><img src="https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span class="video-play">${ico.play}</span></button>`;
  return `<video controls preload="none" playsinline src="${esc(v)}"></video>`;
}

function detalle(m) {
  const rel = "../../";
  const t = titulo(m);
  const desc = m.resumen || m.descripcion.slice(0, 155);
  const rec = recomendadas(m);
  const imgs = m.imagenes;
  const catHref = `${rel}index.html?cat=${m.categoria}#catalogo`;
  const idx = ordenar(maquinas).findIndex((x) => x.slug === m.slug);
  const lista = ordenar(maquinas);
  const prev = lista[(idx - 1 + lista.length) % lista.length], next = lista[(idx + 1) % lista.length];

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

<div class="wrap detail-layout">
  <article class="product" data-slug="${m.slug}" data-title="${esc(t)} (${esc(m.modelo)})" data-wa="${cfg.whatsapp}">
    <div class="product-top">
      <div class="gallery" aria-roledescription="carrusel" aria-label="Fotos de ${esc(t)}">
        <div class="gallery-track" id="galleryTrack" tabindex="0">
          ${imgs.map((src, i) => `<figure class="gallery-slide" aria-label="Imagen ${i + 1} de ${imgs.length}"><img ${imgSet(rel, src, "(max-width: 759px) 100vw, 640px")} alt="${esc(t)}, imagen ${i + 1}" width="1200" height="900" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>`).join("")}
        </div>
        ${imgs.length > 1 ? `<div class="gallery-bar">
          <div class="thumbs" role="tablist" aria-label="Elegir imagen">
            ${imgs.map((src, i) => `<button type="button" class="thumb" role="tab" aria-selected="${i === 0}" aria-label="Ver imagen ${i + 1}" data-index="${i}"><img src="${rel}${smSrc(src)}" alt="" width="120" height="90" loading="lazy"></button>`).join("")}
          </div>
          <span class="gallery-count mono" aria-hidden="true"><span id="galleryIdx">1</span> / ${imgs.length}</span>
        </div>` : ""}
      </div>

      <div class="product-info">
        <p class="product-cat"><a href="${catHref}">${esc(catNombre(m.categoria))}</a>${m.codigo ? `<span class="mono">Cód. ${esc(m.codigo)}</span>` : ""}</p>
        <p class="product-lineas">${(m.lineas || []).length ? m.lineas.map((l) => `<a class="linea-chip" href="${rel}index.html?linea=${l}#catalogo">Línea ${esc(linNombre(l))}</a>`).join("") : `<span class="linea-chip linea-chip--todas">Sirve para todas las líneas</span>`}</p>
        <h1 class="product-title">${esc(m.nombre)}</h1>
        <p class="product-model mono">Modelo <strong>${esc(m.modelo)}</strong></p>
        ${m.resumen ? `<p class="product-lead">${esc(m.resumen)}</p>` : ""}
        ${(m.specsClave || []).length ? `<ul class="key-specs">${m.specsClave.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        <div class="product-actions">
          <a class="btn btn-cta btn-lg btn-block js-wa" href="${waLink(waTextoMaquina(m))}" target="_blank" rel="noopener">${ico.wa}Consultar por WhatsApp</a>
          <div class="actions-row">
            <button type="button" class="btn btn-outline js-share">${ico.share}Compartir</button>
            ${m.pdf ? `<a class="btn btn-outline" href="${rel}${m.pdf}" download target="_blank" rel="noopener">${ico.pdf}Folleto PDF</a>` : ""}
          </div>
        </div>
        <p class="product-note">Precio, disponibilidad y financiación por WhatsApp. ${partnerLogos(rel, "partners partners--inline")}</p>
      </div>
    </div>

    <div class="product-sections">
      <section class="block" aria-labelledby="desc-h">
        <h2 class="block-title" id="desc-h"><span class="mono">01</span>Descripción</h2>
        <div class="prose"><p>${esc(m.descripcion)}</p></div>
      </section>
      <section class="block" aria-labelledby="specs-h">
        <h2 class="block-title" id="specs-h"><span class="mono">02</span>Especificaciones</h2>
        <div>
          <table class="specs"><caption class="sr-only">Especificaciones técnicas de ${esc(t)}</caption><tbody>
            ${Object.entries(m.specs || {}).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
          </tbody></table>
          <p class="small-note">Datos según documentación del fabricante. Pueden variar sin previo aviso.</p>
        </div>
      </section>
      ${(m.aplicaciones || []).length ? `<section class="block" aria-labelledby="apl-h">
        <h2 class="block-title" id="apl-h"><span class="mono">03</span>${m.categoria.includes("punzon") || m.categoria.includes("prensa") ? "Mecanizados" : "Aplicaciones"}</h2>
        <ul class="apps">${m.aplicaciones.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      </section>` : ""}
      ${m.video ? `<section class="block" aria-labelledby="vid-h"><h2 class="block-title" id="vid-h"><span class="mono">04</span>Video</h2><div class="video">${videoEmbed(m.video)}</div></section>` : ""}
    </div>

    <nav class="prevnext" aria-label="Otras máquinas">
      <a class="pn pn--prev" href="${rel}maquinas/${prev.slug}/"><span class="pn-label mono">← Anterior</span><span class="pn-name">${esc(prev.nombre)}</span></a>
      <a class="pn pn--all" href="${rel}index.html#catalogo">${ico.grid}<span>Catálogo</span></a>
      <a class="pn pn--next" href="${rel}maquinas/${next.slug}/"><span class="pn-label mono">Siguiente →</span><span class="pn-name">${esc(next.nombre)}</span></a>
    </nav>
  </article>

  <aside class="reco" aria-labelledby="reco-h">
    <div class="reco-inner">
      <h2 class="reco-title" id="reco-h">Recomendadas para vos</h2>
      ${rec.misma.length ? `<p class="reco-sub">${esc(rec.t1)}</p><ul class="reco-list">${rec.misma.map((x) => mini(x, rel)).join("")}</ul>` : ""}
      ${rec.otras.length ? `<p class="reco-sub">Completá el proceso del taller</p><ul class="reco-list">${rec.otras.map((x) => mini(x, rel)).join("")}</ul>` : ""}
      <a class="btn btn-primary btn-block reco-all" href="${rel}index.html#catalogo">${ico.grid}Ver las ${maquinas.length} máquinas</a>
    </div>
  </aside>
</div>

<div class="sticky-cta" aria-label="Acciones rápidas">
  <a class="btn btn-cta js-wa" href="${waLink(waTextoMaquina(m))}" target="_blank" rel="noopener">${ico.wa}Consultar</a>
  <button type="button" class="btn btn-dark js-share" aria-label="Compartir">${ico.share}</button>
  <a class="btn btn-dark" href="${rel}index.html#catalogo" aria-label="Ver catálogo completo">${ico.grid}</a>
</div>`;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Product", name: t, model: m.modelo, sku: m.codigo || m.modelo,
      brand: { "@type": "Brand", name: "OK Industrial" }, category: catNombre(m.categoria), description: m.descripcion,
      image: m.imagenes.map((i) => `${SITE}/${i}`), url: urlMaquina(m),
      additionalProperty: Object.entries(m.specs || {}).map(([name, value]) => ({ "@type": "PropertyValue", name, value })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Catálogo", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: catNombre(m.categoria), item: `${SITE}/?cat=${m.categoria}` },
      { "@type": "ListItem", position: 3, name: m.modelo, item: urlMaquina(m) } ] },
  ];
  return layout({ rel, title: `${t} · ${m.modelo} | ${cfg.siteName}`, description: desc, canonical: urlMaquina(m), ogImage: m.imagenes[0], ogType: "product", jsonLd, body, pageClass: "page-detail" });
}

/* ---------- 404 ---------- */
function notFound() {
  const html = layout({
    rel: "/", title: `Página no encontrada | ${cfg.siteName}`, description: "La página que buscás no existe.",
    canonical: `${SITE}/404.html`, ogImage: maquinas[0].imagenes[0],
    body: `<section class="wrap notfound"><p class="eyebrow">Error 404</p><h1 class="section-title">Esta máquina no está en el catálogo</h1><p>Puede que el link esté incompleto o que el modelo ya no esté disponible.</p><a class="btn btn-primary btn-lg" href="/index.html#catalogo">${ico.grid}Ver catálogo completo</a></section>`,
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
