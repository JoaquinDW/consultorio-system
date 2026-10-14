# Landing de SmartTurnos (smartturnos.com)

Página estática para la campaña de Meta Ads. Objetivo: que la persona escriba
por WhatsApp. `index.html` incluye una demo interactiva en
`demo/`. No depende de la app, de una base de datos ni de un build.

## Idiomas

- `/` abre en español por defecto, incluso si el navegador está en inglés.
- `/en/` ofrece la landing completa en inglés. El selector Español / English
  del encabezado permite cambiar de idioma y conservar la sección actual.
- Ambas páginas son HTML estático y comparten `landing.css` y `landing.js`.
  El selector también funciona sin JavaScript. Cada versión tiene sus propios
  metadatos, mensajes de WhatsApp e imagen social; `hreflang` vincula las páginas.
- La demo usa español por defecto y acepta `/demo/?lang=en` para inglés.
  `demo.js` comparte la lógica; `locales.js` contiene los textos en español.
  Fechas y precios se formatean según el idioma y conservan la zona horaria
  de Argentina (UTC−03:00) y la moneda ARS.
- Esta configuración no cambia el idioma del panel de producción.

## Demo interactiva

La landing embebe `demo/index.html`, con sus estilos y lógica en `demo.css`
y `demo.js`. También se puede abrir `/demo/` en una pestaña independiente.
Replica la navegación y el aspecto del panel real: Inicio, Agenda, Pacientes,
Servicios, Recordatorios, WhatsApp y Configuración.

- Datos ficticios en memoria; cada visitante tiene su propia demo. Recargar
  o usar «Reiniciar» restaura el ejemplo. No usa cookies ni localStorage.
- Los turnos de ejemplo se ubican en la semana actual de Argentina.
- Permite buscar, crear y editar pacientes y servicios; crear, confirmar,
  cancelar y reprogramar turnos. Valida horarios y superposiciones por profesional.
- Los recordatorios y mensajes de WhatsApp se simulan: no hay conexiones a
  la API ni envíos reales. Los ajustes de automatización son ilustrativos.
- El iframe usa `sandbox="allow-scripts allow-forms"` para aislar la demo de la landing.
- `agenda-semana.webp` y `agenda-semana-en.webp` se usan como imágenes sociales
  en español e inglés. La primera también es el fallback de la demo sin JavaScript.

Publicá la carpeta `landing/` completa, incluyendo `demo/`.

## Antes de publicar

En `landing.js`, bloque `window.TURNOS` (compartido por ambos idiomas):

- `whatsapp`: número del consultorio con código de país, solo dígitos
  (ej. `5493794721825`).
- `pixelId`: ID del píxel de Meta. Vacío no carga nada. Con ID manda
  `PageView` al cargar y `Contact` en cada clic a WhatsApp (con `content_name`
  = botón: `header`, `hero`, `dolores`, `dock`, `faq-precio`, `cierre`).
- `posthog.key` / `posthog.host`: key pública del proyecto de PostHog
  (`phc_…`, es pública por diseño) y host de ingesta (`https://us.i.posthog.com`).
  Key vacía no carga nada. Con key registra `$pageview` al cargar y
  `whatsapp_click` en cada clic a WhatsApp, con la propiedad `boton` (los
  mismos valores que `content_name`).

Cada botón tiene su mensaje precargado en `data-wa-msg`.

## Publicar

Cualquier hosting estático sirve (Vercel, Netlify, Cloudflare Pages, GitHub
Pages): subí la carpeta `landing/` tal cual. Para probar local:

```bash
npx serve landing
```
