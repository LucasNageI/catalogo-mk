# Catálogo MK Equipamientos

Sitio estático: una página HTML por máquina, cada una con su propia vista previa (Open Graph) para WhatsApp.

## Estructura
```
data/config.json      → datos de la empresa: URL del sitio, WhatsApp, mail, dirección, horarios, redes, marcas y categorías
data/maquinas.json    → TODAS las máquinas (lo único que hay que tocar para cargar o editar)
src/assets/           → css, js, fotos (img/) y fichas (pdf/)
build.js              → genera el sitio en dist/
dist/                 → lo que se sube al hosting (se regenera en cada build)
```

## Antes de publicar (una sola vez)
1. Editá `data/config.json`: **siteUrl** (dominio real, sin barra final), **whatsapp** (solo números, con 549 + área, ej. `5491145678901`), mail, dirección, horarios y redes.
2. Revisá las 21 máquinas cargadas en `data/maquinas.json` (datos tomados de los manuales y folletos de fábrica).
3. Instalá Node.js (16 o superior) y corré `node build.js`.
4. Subí **el contenido** de la carpeta `dist/` a la raíz del hosting (Netlify, Vercel, GitHub Pages, Cloudflare Pages o cualquier hosting con FTP).

## Agregar una máquina nueva
1. Copiá las fotos a `src/assets/img/` (JPG, horizontal 4:3, ~1200×900 px, menos de 200 KB, fondo claro neutro). La **primera** foto es la que aparece en WhatsApp.
2. (Opcional) Copiá la ficha técnica a `src/assets/pdf/`.
3. En `data/maquinas.json` agregá un bloque nuevo (copiá uno existente y cambiá los valores):
```json
{
  "slug": "pok-rpt",
  "nombre": "Punzonadora POK RPT",
  "modelo": "POK RPT",
  "codigo": "100036",
  "marca": "ok-industrial",
  "categoria": "punzonadoras-manuales",
  "destacado": false,
  "resumen": "Una línea que se ve en WhatsApp y Google (sin precios).",
  "descripcion": "Texto comercial completo.",
  "specsClave": ["Líneas Módena, A40, A30", "Abrir y paño fijo", "RPT"],
  "specs": { "Tipo": "Punzonadora manual", "Código de fábrica": "100036" },
  "aplicaciones": ["Escuadras RPT", "Hojas y marcos de abrir"],
  "imagenes": ["assets/img/pok-rpt-1.jpg", "assets/img/pok-rpt-2.jpg"],
  "video": "",
  "pdf": ""
}
```
4. Corré `node build.js` y volvé a subir `dist/`. La máquina queda en `https://tudominio/maquinas/pok-rpt/`.

Reglas:
- **slug**: minúsculas, números y guiones. Es la URL: no lo cambies después de compartir links.
- **marca**: `ok-industrial` u `ok-engineering` (definidas en config.json → brands, con su logo).
- **categoria**: `punzonadoras-manuales`, `prensas-neumaticas`, `cortadoras`, `mesas-de-medicion` o `fresadoras-cnc`. Para una nueva, agregala en config.json → categories (el orden de ahí es el orden del catálogo).
- **Precios**: el catálogo no muestra precios. Si alguno se cuela en la descripción o las specs, el build se frena y avisa.
- **specs**: pares "nombre": "valor"; el orden se respeta en la tabla.
- **video** (opcional): link de YouTube o ID del video. **pdf** (opcional): vacío `""` oculta el botón.
- **destacado**: `true` la muestra primero con etiqueta "Destacada".
- Si falta un campo o una foto, el build se frena y te dice qué corregir.

## Vista previa en WhatsApp
Cada página tiene título, descripción e imagen propios. WhatsApp guarda la vista previa en caché: si cambiás la foto de una máquina ya compartida, la nueva puede tardar en aparecer. Para probar: https://developers.facebook.com/tools/debug/

## Publicación (GitHub + Vercel)
El repositorio está conectado a Vercel. Cada vez que se sube un cambio a GitHub, Vercel corre `node build.js` y publica la carpeta `dist/` (configurado en `vercel.json`).
Para agregar o editar una máquina alcanza con cambiar `data/maquinas.json` y subir las fotos a `src/assets/img/` desde GitHub: Vercel arma el sitio solo.
`vercel.json` también redirige los links viejos (por ejemplo `/maquinas/condor-550`) a la máquina nueva o al catálogo, para que no se rompan los links ya enviados por WhatsApp.

## Probar en tu computadora
`node build.js` y después `npx serve dist` (o `python3 -m http.server -d dist`), y abrí http://localhost:3000.
