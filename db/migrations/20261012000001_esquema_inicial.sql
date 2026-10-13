-- Consultorios — esquema inicial (Postgres puro, sin RLS).
--
-- Una instalación = un consultorio. No hay multiempresa: la base de Sosa Drive
-- no la tenía y simular aislamiento entre clientes sin implementarlo es peor
-- que no tenerlo. Si se agrega, cada tabla de dominio suma `consultorio_id`.
--
-- Este MVP NO guarda datos clínicos: ni diagnósticos, ni tratamientos, ni
-- historia clínica. Las notas son administrativas.

-- Para la exclusion constraint de turnos (igualdad de uuid dentro de un índice gist).
create extension if not exists btree_gist;

create type rol_usuario as enum ('administrador', 'recepcion');
create type estado_turno as enum ('pendiente', 'confirmado', 'cancelado', 'realizado');

-- ===========================================================
-- Configuración del consultorio (fila única, id = 1)
-- ===========================================================
create table public.consultorio (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'Mi consultorio',
  -- Zona IANA con la que se cargan y muestran todos los turnos.
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  duracion_turno_min int not null default 30 check (duracion_turno_min between 5 and 480),
  -- Cuántas horas antes del turno aparece en "Recordatorios para enviar".
  recordatorio_horas_antes int not null default 24 check (recordatorio_horas_antes between 1 and 168),
  actualizado_en timestamptz not null default now()
);

insert into public.consultorio (id) values (1);

-- ===========================================================
-- Usuarios (misma auth que Sosa Drive: argon2 + sesión en Redis)
-- ===========================================================
create table public.perfiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  nombre text not null,
  rol rol_usuario not null default 'recepcion',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ===========================================================
-- Profesionales (opcional: con uno solo, la agenda es una)
-- ===========================================================
create table public.profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ===========================================================
-- Pacientes (solo datos de contacto)
-- ===========================================================
create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  email text,
  nota text check (char_length(nota) <= 500),
  archivado boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index pacientes_nombre_idx on public.pacientes (lower(nombre));
create index pacientes_telefono_idx on public.pacientes (telefono);

-- ===========================================================
-- Turnos
-- ===========================================================
create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes (id),
  profesional_id uuid references public.profesionales (id),
  inicio timestamptz not null,
  -- `fin` se guarda (no es columna generada): timestamptz + interval no es
  -- inmutable para Postgres y la exclusion constraint lo necesita así.
  fin timestamptz not null,
  estado estado_turno not null default 'pendiente',
  nota text check (char_length(nota) <= 500),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (fin > inicio),
  -- Sin superposiciones en la agenda de un mismo profesional. Los turnos sin
  -- profesional comparten una agenda única (uuid nulo). Cancelados y
  -- realizados no ocupan lugar.
  constraint turnos_sin_superposicion exclude using gist (
    (coalesce(profesional_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    tstzrange(inicio, fin) with &&
  ) where (estado in ('pendiente', 'confirmado'))
);

create index turnos_inicio_idx on public.turnos (inicio);
create index turnos_paciente_idx on public.turnos (paciente_id);

-- Historial de cambios del turno (creación, reprogramación, estados).
create table public.eventos_turno (
  id bigserial primary key,
  turno_id uuid not null references public.turnos (id) on delete cascade,
  tipo text not null check (tipo in ('creado', 'reprogramado', 'estado', 'recordatorio')),
  descripcion text not null,
  actor text,
  creado_en timestamptz not null default now()
);

create index eventos_turno_idx on public.eventos_turno (turno_id, creado_en);

-- ===========================================================
-- Recordatorios
-- ===========================================================
-- Uno por turno y por horario: si el turno se reprograma, el recordatorio
-- viejo deja de valer y hace falta uno nuevo. El unique evita duplicados
-- cuando se reintenta "Marcar como enviado".
create table public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos (id) on delete cascade,
  turno_inicio timestamptz not null,
  canal text not null default 'whatsapp_manual'
    check (canal in ('whatsapp_manual', 'copiado')),
  mensaje text not null,
  enviado_por uuid references public.perfiles (id),
  enviado_en timestamptz not null default now(),
  unique (turno_id, turno_inicio)
);
