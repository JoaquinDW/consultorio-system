# Bot de WhatsApp (Baileys + OpenAI opcional)

Servicio Node que conecta el número de WhatsApp del consultorio vía
[Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web por QR, sin
Meta API ni Twilio). El panel para verlo y manejarlo es la sección
**WhatsApp** de la app (misma auth). Viene del bot de Sosa Drive, adaptado a
turnos: sin leads ni catálogo.

## Qué hace

- **Guarda todas las charlas** en las tablas `wa_*` y las muestra en el panel.
- **Reconoce al paciente** por teléfono (últimos 10 dígitos) y vincula la
  conversación a su ficha.
- **Recordatorios por WhatsApp:** desde el panel ("Enviar por el bot") o
  automáticos, si los activás en Configuración. Respeta la anticipación
  configurada y nunca manda dos veces el mismo (unique por turno + horario).
- **Confirmación:** si el paciente contesta "sí", "confirmo", "dale"… dentro de
  las 48 h de un recordatorio, el turno pasa a **confirmado** y el bot le
  responde. Ante la duda no confirma nada.
- **Turnos nuevos:** antes de pasarle la charla al equipo, el bot pide nombre
  y apellido, qué servicio quiere (nunca síntomas ni datos clínicos) y con qué
  profesional. Si en Configuración prendés **"El bot puede dar turnos"** (y hay
  `OPENAI_API_KEY`), además busca lugar en la agenda respetando los horarios
  de atención y los turnos ya dados, ofrece opciones y, cuando el paciente
  confirma, reserva el turno (queda pendiente, como uno dado desde el panel).
  Si quien escribe no era paciente, lo da de alta con su teléfono; si ya tiene
  un turno próximo, no le da otro y deriva. Sin horarios de atención cargados
  no ofrece turnos.
- **Pedidos de cambio o cancelación:** el bot no toca el turno. Responde que le
  pasa el mensaje al equipo, deja la conversación en modo humano y marcada
  "Requiere atención" en el panel, y lo anota en el historial del turno.
- **Charla libre (opcional, con OpenAI):** responde consultas administrativas
  con lo que dice [`project.md`](project.md) más los datos en vivo (consultorio,
  profesionales, turnos del paciente). Nunca da consejos médicos. Cuando hay
  que derivar, pasa la charla a humano. **Sin `OPENAI_API_KEY` no improvisa:**
  marca la charla para que la responda una persona.
- Cada conversación tiene modo **IA** (responde el bot) o **Humano** (responde
  una persona desde el panel).

## Levantarlo

1. Opcional, para respuestas con IA, agregá a `.env.local` de la raíz:
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```
2. Con la base levantada (`npm run db:up`):
   ```bash
   docker compose up -d --build bot
   docker compose logs -f bot
   ```
3. En la app, entrá a **WhatsApp** y escaneá el QR desde el teléfono
   (WhatsApp → Dispositivos vinculados). En los logs aparece el mismo QR.

La sesión persiste en `data/wa-auth/` (gitignored). Al arrancar, el bot aplica
`db/migrations/20261013000001_whatsapp.sql` (idempotente), así que también
funciona sobre una base creada antes de este módulo.

## Personalizar

Editá [`project.md`](project.md): dirección, horarios, qué traer, qué no decir.
Aplica en el próximo mensaje, sin reiniciar.

## Ojo

Baileys usa WhatsApp Web de forma no oficial: WhatsApp puede bloquear números
que mandan mucho a contactos que no los tienen agendados. Usá el número del
consultorio (no uno personal) y evitá envíos masivos. El bot espacia los
recordatorios automáticos.
