-- Servicios: qué se atiende, dónde, con quién, cuánto dura y cuánto sale.
--
-- Idempotente ("if not exists"): `npm run db:migrate` la vuelve a correr sobre
-- bases creadas antes de este módulo. Al primer init la corre Postgres junto
-- con las demás (orden alfabético).
--
-- Un servicio es administrativo (nombre comercial, precio, duración): no se
-- guarda qué se le hizo a cada paciente.

-- ===========================================================
-- Lugares (consultorio, clínica, sede): dónde se presta el servicio
-- ===========================================================
create table if not exists public.lugares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  direccion text check (char_length(direccion) <= 200),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ===========================================================
-- Servicios
-- ===========================================================
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  -- Null = se ofrece en todos los lugares.
  lugar_id uuid references public.lugares (id),
  -- Null = lo puede atender cualquiera.
  profesional_id uuid references public.profesionales (id),
  duracion_min int not null check (duracion_min between 5 and 480),
  -- Precio de lista. Los diferenciados son opcionales: null = se cobra el de lista.
  precio numeric(12, 2) not null check (precio >= 0),
  precio_efectivo numeric(12, 2) check (precio_efectivo >= 0),
  precio_transferencia numeric(12, 2) check (precio_transferencia >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists servicios_lugar_idx on public.servicios (lugar_id);

-- El turno puede decir qué servicio es (opcional; los turnos viejos quedan sin).
alter table public.turnos
  add column if not exists servicio_id uuid references public.servicios (id);
