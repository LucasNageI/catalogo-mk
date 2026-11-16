# Catálogo MK Equipamientos

Sitio estático (HTML, CSS y JavaScript). No necesita base de datos ni servidor: Vercel lo publica tal cual.

## Qué hay en esta carpeta

- `index.html`: el catálogo completo, con buscador y filtros.
- `maquinas/`: una página por máquina. Ese es el link que se le manda al cliente.
- `fotos/`: fotos grandes de las máquinas y logos. `fotos-medianas/` y `fotos-chicas/`: las mismas fotos en tamaño mediano y chico, para las tarjetas.
- `assets/`: estilos, tipografías y scripts.
- `assets/config.js`: el número de WhatsApp de ventas.
- `datos/maquinas.json`: la lista de máquinas con sus datos (referencia).
- `vercel.json`: links sin ".html" (por ejemplo `/maquinas/condor-550`).

## Publicar con GitHub y Vercel

GitHub, desde la web, deja subir hasta 100 archivos por vez. Por eso las fotos están repartidas en tres carpetas (`fotos`, `fotos-medianas` y `fotos-chicas`) y el sitio se sube en 4 tandas.

1. En GitHub, creá un repositorio nuevo (por ejemplo `catalogo-mk`).
2. Subí el contenido en estas 4 tandas, siempre desde la página principal del repositorio con "Add file" → "Upload files" y "Commit changes" al final de cada una:
   - Tanda 1: `index.html`, `README.md`, `vercel.json` y las carpetas `assets`, `datos` y `fotos-medianas`.
   - Tanda 2: la carpeta `maquinas`.
   - Tanda 3: la carpeta `fotos`.
   - Tanda 4: la carpeta `fotos-chicas`.
3. En Vercel, "Add New" → "Project", elegí el repositorio y tocá "Deploy". No hay que configurar nada: Framework "Other", sin comando de build.
4. Vercel te da una dirección del tipo `catalogo-mk.vercel.app`. Si después conectás un dominio propio, se configura en Settings → Domains.

## Importante para la vista previa en WhatsApp

Cada ficha avisa a WhatsApp qué foto mostrar usando la dirección completa del sitio.
Hoy está cargada `https://mk-equipamientos.vercel.app`. Cuando tengas la dirección definitiva, hay que regenerar las páginas con esa dirección (pedíselo a Claude y te devuelve los archivos actualizados).

## Cambiar el WhatsApp

Editá `assets/config.js` y cambiá el número (código de país + área + número, sin espacios).
