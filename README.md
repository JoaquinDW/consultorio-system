# Turnos — agenda y recordatorios para consultorios

Demo para validar con profesionales y consultorios pequeños: pacientes, turnos
en agenda diaria y semanal, y recordatorios por WhatsApp. Nace de la base
técnica de Sosa Drive, pero es un proyecto independiente con dominio propio.

## Cómo arrancar la demo

Necesitás Docker corriendo.

```bash
npm install
cp .env.example .env.local   # los valores por defecto coinciden con docker-compose
npm run db:up                # PostgreSQL (puerto 5433) + Redis (puerto 6381)
npm run db:seed              # datos ficticios, con turnos relativos a hoy
npm run dev                  # http://localhost:3001
```

Usuarios del seed (contraseña `turnos2026`):

- `admin@consultorio.demo`: administrador, puede cambiar la configuración.
- `recepcion@consultorio.demo`: recepción, maneja pacientes, turnos y recordatorios.

Los puertos (3001, 5433, 6381) son distintos a los de Sosa Drive para poder
correr las dos apps a la vez. `npm run db:reset` recrea la base y re-siembra.

**No hace falta ninguna configuración externa**: ni claves de API ni
proveedores de mensajería.

## Qué hace

- **Pacientes:** alta, edición, búsqueda por nombre o teléfono, archivo y
  restauración. Solo datos de contacto y una nota administrativa: no guarda
  información clínica.
- **Turnos:** alta con paciente, fecha, hora, duración, profesional opcional y
  nota. Estados pendiente, confirmado, cancelado y realizado. Reprogramar
  (vuelve a pendiente), cancelar (con confirmación) y reactivar.
- **Agenda:** vista de día y de semana, filtro por profesional, y la zona
  horaria visible siempre.
- **Sin superposiciones:** lo impide la base con una exclusion constraint por
  profesional (los turnos sin profesional comparten una agenda única). Los
  cancelados y realizados no ocupan lugar.
- **Recordatorios:** lista de turnos dentro de la anticipación configurada
  (24 h por defecto). El mensaje se abre en WhatsApp (link `wa.me` con el texto
  listo) o se copia, y después se marca como enviado. No hay duplicados
  (unique por turno + horario). Si el turno se reprograma, hace falta un
  recordatorio nuevo.
- **Configuración:** nombre del consultorio, zona horaria, duración por defecto,
  anticipación del recordatorio y profesionales.

## Arquitectura

Igual que Sosa Drive: Next.js 16 (App Router) + React 19, PostgreSQL con `pg`
directo, Redis para sesiones, Tailwind v4 + shadcn/ui.

- `lib/data.ts`: capa de datos (`server-only`). Los turnos se guardan como
  `timestamptz` y Postgres los traduce a fecha/hora local con la zona del
  consultorio (`at time zone`), así no dependen de la zona del servidor ni del
  navegador.
- `lib/recordatorios.ts` y `lib/fechas.ts`: módulos puros (mensaje, link de
  WhatsApp, aritmética de fechas).
- `app/(app)/*/acciones.ts`: Server Actions.
- `db/migrations/`: esquema. `scripts/seed.ts`: datos ficticios.

Tomado de la base de Sosa Drive (copiado, sin dependencia entre repos): auth (argon2 + sesión en Redis + cookie), proxy de
rutas, sidebar/topbar, componentes `ui/`, diálogo de formulario y campos,
manejo de errores de acciones, pool de Postgres y docker-compose.

## Limitaciones conocidas (decididas a propósito)

- **Un consultorio por instalación.** Sosa Drive no tenía multiempresa y no
  se simula aislamiento. Para varios consultorios en una misma base habría que
  agregar `consultorio_id` a cada tabla y filtrar por sesión.
- **Recordatorio manual.** El bot de WhatsApp de Sosa Drive (Baileys) podría
  mandarlos solo, pero está atado a leads y al catálogo de motos. Desacoplarlo
  es el siguiente paso si la validación lo pide.
- La autorización por rol solo separa la configuración (administrador) del
  resto.

## Preguntas abiertas para la validación comercial

- ¿Quién administra hoy los turnos y con qué herramientas?
- ¿Qué provoca más trabajo o ausencias: agendar, confirmar, reprogramar o recordar?
- ¿Qué canal de recordatorio usan y aceptarían usar?
- ¿Qué tendría que resolver el producto para que el consultorio pague por probarlo?
