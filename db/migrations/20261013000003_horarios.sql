-- Horarios de atención: franjas semanales en las que se pueden dar turnos.
--
-- Idempotente ("if not exists"): `npm run db:migrate` la vuelve a correr sobre
-- bases existentes.
--
-- Reglas (ver lib/horarios.ts):
-- - Un profesional con franjas propias atiende solo en esas.
-- - Si no tiene, vale el horario general del consultorio (profesional_id nulo).
-- - Sin ninguna franja cargada no hay restricción (como antes de este módulo).
-- - El lugar es opcional: si la franja tiene lugar, solo admite turnos de
--   servicios de ese lugar (o sin lugar).
create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  -- ISO: 1 = lunes … 7 = domingo.
  dia_semana int not null check (dia_semana between 1 and 7),
  desde time not null,
  hasta time not null,
  profesional_id uuid references public.profesionales (id) on delete cascade,
  lugar_id uuid references public.lugares (id) on delete cascade,
  creado_en timestamptz not null default now(),
  check (hasta > desde)
);

create index if not exists horarios_profesional_idx on public.horarios (profesional_id);
