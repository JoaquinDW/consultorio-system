# CLAUDE.md — consultorio-system

App de agenda y recordatorios para consultorios. Nació de la base de Sosa Drive
pero es independiente (repo, base y docker-compose propios). Ver `README.md`
para comandos y alcance.

- Next.js 16: el middleware vive en `proxy.ts`. Consultá `node_modules/next/dist/docs/` antes de usar APIs de Next.
- UI en español rioplatense (vos). Dominio en español: tablas `snake_case`, funciones y tipos en camelCase.
- No guardar datos clínicos (diagnósticos, tratamientos, historia clínica). Las notas son administrativas.
- Fechas de turnos: `timestamptz` en la base; la conversión a la zona del consultorio se hace en SQL (`lib/data.ts`). La UI trabaja con strings `YYYY-MM-DD` / `HH:MM`.
- Migraciones: después del esquema inicial, cada archivo de `db/migrations/` tiene que ser idempotente (`if not exists`), porque `npm run db:migrate` las corre todas de nuevo sobre bases existentes.
- Las superposiciones las impide la constraint `turnos_sin_superposicion` (error `23P01`).
- No hay tests: validá con `npm run lint` y `npm run build`.
- Bot de WhatsApp en `bot/` (paquete propio, fuera del lint y del tsconfig de la app; validalo con `cd bot && npx tsc --noEmit`). Su schema es `db/migrations/20261013000001_whatsapp.sql`, que el bot aplica al arrancar: mantenela idempotente. El panel tolera que las tablas `wa_*` no existan (`esquemaIncompleto` en `lib/data-whatsapp.ts`).
- El texto del recordatorio está duplicado en `lib/recordatorios.ts` y `bot/src/mensajes.ts`: si cambiás uno, cambiá el otro.
- Las reglas de horario de atención están duplicadas en `lib/horarios.ts` y `bot/src/agenda.ts` (el bot da turnos si está prendido en Configuración): si cambiás una, cambiá la otra.
