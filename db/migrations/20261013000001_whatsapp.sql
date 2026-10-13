-- Módulo WhatsApp (bot de Baileys + panel /whatsapp).
--
-- Mantener en sync con bot/src/db.ts (ensureSchema): el bot ejecuta este mismo
-- DDL idempotente en cada arranque, así las bases creadas antes de este módulo
-- lo reciben sin un migration runner. Por eso todo es "if not exists" y se usa
-- text + check en vez de enums.

create table if not exists public.wa_conversaciones (
  id bigserial primary key,
  telefono text not null unique,
  -- jid completo del chat (@s.whatsapp.net o @lid): hay que responder al mismo
  -- jid por el que llegó el mensaje.
  jid text,
  nombre text,
  modo text not null default 'ia' check (modo in ('ia', 'humano')),
  -- Paciente reconocido por teléfono (o creado desde el panel).
  paciente_id uuid references public.pacientes (id) on delete set null,
  -- El paciente pidió cancelar/reprogramar, o el bot derivó: lo tiene que ver
  -- una persona. Se apaga desde el panel.
  requiere_atencion boolean not null default false,
  ultimo_mensaje_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists wa_conversaciones_paciente_idx
  on public.wa_conversaciones (paciente_id);

create table if not exists public.wa_mensajes (
  id bigserial primary key,
  conversacion_id bigint not null references public.wa_conversaciones (id) on delete cascade,
  -- sistema = recordatorios de turno (el bot reconoce un "sí" como respuesta).
  rol text not null check (rol in ('cliente', 'ia', 'humano', 'sistema')),
  contenido text not null,
  creado_en timestamptz not null default now()
);

create index if not exists wa_mensajes_conversacion_idx
  on public.wa_mensajes (conversacion_id, creado_en);

-- Fila única (id = 1) con el estado de la conexión: el bot la escribe y el
-- panel la lee (polling).
create table if not exists public.wa_estado_conexion (
  id int primary key default 1 check (id = 1),
  estado text not null default 'desconectado'
    check (estado in ('desconectado', 'qr', 'conectando', 'conectado')),
  qr_string text,
  telefono text,
  actualizado_en timestamptz not null default now()
);

insert into public.wa_estado_conexion (id) values (1)
on conflict (id) do nothing;

-- Configuración del bot (fila única). Va aparte de `consultorio` para que la
-- app funcione igual en bases donde el bot nunca corrió.
create table if not exists public.wa_config (
  id int primary key default 1 check (id = 1),
  recordatorios_automaticos boolean not null default false
);

insert into public.wa_config (id) values (1)
on conflict (id) do nothing;

-- El bot puede dar turnos nuevos por su cuenta (con IA): pide nombre y
-- servicio, busca lugar en la agenda y lo reserva. Apagado = toma el pedido y
-- deriva al equipo, como siempre.
alter table public.wa_config
  add column if not exists agendar_turnos boolean not null default false;

-- Los recordatorios ahora también los puede mandar el bot.
alter table public.recordatorios drop constraint if exists recordatorios_canal_check;
alter table public.recordatorios add constraint recordatorios_canal_check
  check (canal in ('whatsapp_manual', 'copiado', 'whatsapp_bot'));

-- Los eventos del turno registran también lo que pasa por WhatsApp.
alter table public.eventos_turno drop constraint if exists eventos_turno_tipo_check;
alter table public.eventos_turno add constraint eventos_turno_tipo_check
  check (tipo in ('creado', 'reprogramado', 'estado', 'recordatorio', 'whatsapp'));
