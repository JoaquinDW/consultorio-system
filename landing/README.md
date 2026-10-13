# Landing de SmartTurnos (smartturnos.com)

Página estática para la campaña de Meta Ads. Objetivo: que la persona escriba
por WhatsApp. Un solo `index.html` (CSS y JS inline) más la captura
`agenda-semana.webp`; no depende de la app ni de un build.

## Antes de publicar

En `index.html`, bloque `window.TURNOS`:

- `whatsapp`: número del consultorio con código de país, solo dígitos
  (ej. `5493794721825`).
- `pixelId`: ID del píxel de Meta. Vacío no carga nada. Con ID manda
  `PageView` al cargar y `Contact` en cada clic a WhatsApp (con `content_name`
  = botón: `header`, `hero`, `dock`, `faq-precio`, `cierre`).

Cada botón tiene su mensaje precargado en `data-wa-msg`.

## Publicar

Cualquier hosting estático sirve (Vercel, Netlify, Cloudflare Pages, GitHub
Pages): subí la carpeta `landing/` tal cual. Para probar local:

```bash
npx serve landing
```
