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

Si ya tenías la base creada de antes, `npm run db:migrate` le aplica las
migraciones nuevas (por ejemplo, la de servicios) sin borrar datos.

La agenda funciona sin ninguna configuración externa. El bot de WhatsApp es
opcional y se levanta aparte (ver abajo).

### Bot de WhatsApp

```bash
docker compose --profile bot up -d bot   # o: cd bot && npm install && npm run dev
```

Después entrá a **WhatsApp** en el panel y escaneá el QR desde el celular del
consultorio (WhatsApp → Dispositivos vinculados). La sesión queda guardada en
`data/wa-auth/`. Para que el bot responda consultas con IA, poné
`OPENAI_API_KEY` en `.env.local` y completá `bot/project.md` con los datos del
consultorio; sin clave, el bot igual confirma turnos y deriva todo lo demás al
equipo. Detalle en `bot/README.md`.

## Qué hace

- **Pacientes:** alta, edición, búsqueda por nombre o teléfono, archivo y
  restauración. Solo datos de contacto y una nota administrativa: no guarda
  información clínica.
- **Turnos:** alta con paciente, fecha, hora, duración, profesional opcional y
  nota. Estados pendiente, confirmado, cancelado y realizado. Reprogramar
  (vuelve a pendiente), cancelar (con confirmación) y reactivar.
- **Servicios:** qué se ofrece (consulta, rinomodelación, tratamiento
  facial…), en qué lugar, con qué profesional a cargo, cuánto dura y cuánto
  sale. Además del precio de lista, cada servicio puede tener un precio
  distinto en efectivo y por transferencia. Los lugares (consultorios,
  clínicas o sedes) se cargan en Configuración y son opcionales: un servicio
  sin lugar vale en todos. Al dar un turno, elegir el servicio completa la
  duración y el profesional, y la agenda lo muestra. Los cambia quien
  administra; recepción los ve.
- **Horarios de atención:** franjas por día de la semana en Configuración
  (por ejemplo, lunes a viernes de 8 a 13 y de 14 a 20). Hay un horario
  general y cada profesional puede tener el suyo, opcionalmente en un lugar.
  La agenda no deja dar ni reprogramar un turno que no entre completo en el
  horario, y muestra el horario de cada día. Sin horarios cargados no hay
  restricción.
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
- **WhatsApp (bot opcional):** bandeja de conversaciones con la ficha del
  paciente al costado (lo reconoce por el teléfono; si no está cargado, se
  puede dar de alta desde el chat). Cada conversación está en modo Bot o
  Humano. El bot confirma el turno cuando el paciente responde «sí» a un
  recordatorio, y los pedidos de cancelar o reprogramar, o lo que no sabe
  contestar, los pasa a Humano y los marca como pendientes de atención (punto
  rojo en la bandeja y aviso en Inicio). Los recordatorios se pueden mandar por
  el bot desde la agenda, o en forma automática si se activa en Configuración.
  Ante un pedido de turno nuevo, el bot (con IA) pide nombre y apellido y el
  servicio antes de derivar; si en Configuración se prende "El bot puede dar
  turnos", busca lugar en la agenda y reserva el turno él mismo.
- **Configuración:** nombre del consultorio, zona horaria, duración por defecto,
  anticipación del recordatorio, horarios de atención, profesionales y lugares.

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
- `db/migrations/`: esquema. Postgres las corre al primer init; las
  posteriores al esquema inicial son idempotentes y `scripts/migrar.ts`
  (`npm run db:migrate`) las vuelve a correr sobre bases existentes.
  `scripts/seed.ts`: datos ficticios.
- `bot/`: servicio aparte (Baileys + OpenAI opcional), portado del bot de Sosa
  Drive y adaptado a turnos. Se comunica con el panel por Postgres (tablas
  `wa_*`) y Redis (colas `wa:outbox` y `wa:control`). Al arrancar aplica la
  migración `20261013000001_whatsapp.sql`, que es idempotente; por eso una base
  creada antes del bot no necesita re-sembrarse. `lib/data-whatsapp.ts` lee
  esas tablas desde el panel.

Tomado de la base de Sosa Drive (copiado, sin dependencia entre repos): auth (argon2 + sesión en Redis + cookie), proxy de
rutas, sidebar/topbar, componentes `ui/`, diálogo de formulario y campos,
manejo de errores de acciones, pool de Postgres y docker-compose.

## Limitaciones conocidas (decididas a propósito)

- **Un consultorio por instalación.** Sosa Drive no tenía multiempresa y no
  se simula aislamiento. Para varios consultorios en una misma base habría que
  agregar `consultorio_id` a cada tabla y filtrar por sesión.
- **El bot no agenda ni reprograma solo.** Confirma turnos existentes; los
  cambios los resuelve una persona desde la agenda.
- Baileys usa WhatsApp Web (no la API oficial de Meta): conviene un número
  dedicado al consultorio.
- La autorización por rol solo separa la configuración (administrador) del
  resto.

## Preguntas abiertas para la validación comercial

- ¿Quién administra hoy los turnos y con qué herramientas?
- ¿Qué provoca más trabajo o ausencias: agendar, confirmar, reprogramar o recordar?
- ¿Qué canal de recordatorio usan y aceptarían usar?
- ¿Qué tendría que resolver el producto para que el consultorio pague por probarlo?
