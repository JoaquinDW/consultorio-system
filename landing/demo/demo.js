/* Demo independiente: datos en memoria, sin API, almacenamiento ni envíos reales. */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-12 5 2 2 4-4"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
    service: '<path d="M3 12h4l4-4h5a2 2 0 0 1 0 4h-4m-5 0 6 6 8-6M3 12v8h4"/><circle cx="12" cy="4" r="2"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    chat: '<path d="M21 11.5a9 9 0 0 1-9 9 9 9 0 0 1-4-1L3 21l1.5-5a9 9 0 0 1-1-4.5 8.7 8.7 0 0 1 9-8.5 8.7 8.7 0 0 1 8.5 8.5z"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 3h4l1 3 3 1 3 3v4l-3 3-3 1-1 3h-4l-1-3-3-1-3-3v-4l3-3 3-1z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    reset: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    doctor: '<path d="M6 3v5a5 5 0 0 0 10 0V3M4 3h4M14 3h4M11 13v3a5 5 0 0 0 10 0v-3"/><circle cx="21" cy="11" r="2"/>',
    send: '<path d="m22 2-7 20-4-9L2 9zM22 2 11 13"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  };
  const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.calendar) + '</svg>';
  const hydrateIcons = () => document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  const sections = [
    ['inicio', 'Home', 'home'], ['agenda', 'Schedule', 'calendar'], ['pacientes', 'Patients', 'users'],
    ['servicios', 'Services', 'service'], ['recordatorios', 'Reminders', 'bell'],
    ['whatsapp', 'WhatsApp', 'chat'], ['configuracion', 'Settings', 'settings'],
  ];
  const professionals = ['Dr. Laura Méndez', 'Pablo Ferreyra'];
  const labels = { pendiente: 'Pending', confirmado: 'Confirmed', realizado: 'Completed', cancelado: 'Cancelled' };
  const dateParts = new Intl.DateTimeFormat('en', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => dateParts.find((p) => p.type === type).value;
  const today = part('year') + '-' + part('month') + '-' + part('day');
  const toDate = (date) => new Date(date + 'T12:00:00Z');
  const addDays = (date, days) => { const d = toDate(date); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const weekday = (date) => toDate(date).getUTCDay();
  const monday = (date) => addDays(date, -((weekday(date) + 6) % 7));
  const weekStart = monday(today);
  const formatDate = (date, options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(toDate(date));
  const longDate = (date) => { const value = formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }); return value[0].toUpperCase() + value.slice(1); };
  const shortDate = (date) => formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  const minutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const timeAt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const price = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ARS', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(amount);
  const active = (turn) => ['pendiente', 'confirmado'].includes(turn.status);
  let state;
  let view = 'agenda';
  let agendaDate = today;
  let agendaMode = 'semana';
  let professional = 'all';
  let query = '';
  let selectedChat = 0;
  let sequence = 100;
  let feedbackTimer;

  function initialState() {
    const names = ['Ana Belén Torres', 'Bruno Castillo', 'Camila Herrera', 'Diego Paz', 'Elena Suárez', 'Facundo Ríos', 'Gabriela Ortiz', 'Hernán Molina', 'Inés Villalba', 'Julián Acosta', 'Lucía Benítez', 'Mateo Sosa'];
    const patients = names.map((name, id) => ({ id, name, phone: '+54 9 351 555-' + String(100 + id).padStart(4, '0'), note: id === 0 ? 'Prefers afternoon appointments.' : id === 2 ? 'Contact via WhatsApp, do not call.' : '' }));
    const services = [
      { id: 0, name: 'Consultation', professional: 0, duration: 30, price: 25000, cash: 22000 },
      { id: 1, name: 'Dental cleaning', professional: 0, duration: 45, price: 40000, cash: 36000 },
      { id: 2, name: 'Teeth whitening', professional: 0, duration: 60, price: 120000, cash: 108000 },
      { id: 3, name: 'Physiotherapy session', professional: 1, duration: 45, price: 18000, cash: 18000 },
      { id: 4, name: 'Posture assessment', professional: 1, duration: 60, price: 30000, cash: 27000 },
    ];
    const seed = [
      [0, '11:30', 7, 3, 'realizado'], [0, '16:00', 8, 0, 'cancelado'],
      [1, '09:00', 0, 0, 'realizado'], [1, '10:00', 1, 0, 'confirmado'], [1, '11:00', 2, 3, 'pendiente'],
      [2, '09:30', 5, 0, 'pendiente'], [2, '10:00', 9, 3, 'confirmado'], [2, '12:00', 10, 0, 'pendiente'],
      [3, '10:00', 0, 3, 'pendiente'], [3, '14:00', 11, 0, 'pendiente'],
      [4, '09:00', 6, 3, 'pendiente'], [4, '19:00', 0, 0, 'pendiente'], [5, '10:30', 2, 0, 'pendiente'],
      [8, '11:00', 0, 0, 'pendiente'],
    ];
    const turns = seed.map(([day, time, patient, service, status], id) => ({ id, date: addDays(weekStart, day), time, patient, service, professional: services[service].professional, duration: services[service].duration, status, reminded: id === 6 }));
    // Aun si se visita un domingo, Inicio y Recordatorios tienen ejemplos para probar.
    if (!turns.some((t) => t.date === today)) {
      turns.push({ id: 20, date: addDays(today, 1), time: '09:00', patient: 5, service: 0, professional: 0, duration: 30, status: 'pendiente', reminded: false });
    }
    const chats = [
      { patient: 0, mode: 'ia', attention: false, messages: [
        { text: 'Hi, do you have an appointment available this week?', out: false },
        { text: 'Hi Ana! Yes, we have an opening on ' + shortDate(addDays(weekStart, 4)) + ' at 19:00 with Dr. Laura Méndez. Does that work for you?', out: true, author: 'Bot' },
        { text: 'Yes, perfect. Thank you.', out: false },
        { text: 'Your appointment is booked. We will send a reminder before your consultation.', out: true, author: 'Bot' },
      ] },
      { patient: 2, mode: 'humano', attention: true, messages: [
        { text: 'Hi, I need to change my appointment. Could we move it to another day?', out: false },
        { text: 'I will connect you with the front desk to help you reschedule.', out: true, author: 'Bot' },
      ] },
      { patient: 9, mode: 'ia', attention: false, messages: [
        { text: 'Hi Julián, this is a reminder of your appointment on ' + shortDate(addDays(weekStart, 2)) + ' at 10:00 with Pablo Ferreyra. Can you confirm?', out: true, author: 'Bot' },
        { text: 'Yes, I confirm.', out: false },
        { text: 'Thank you! Your appointment is confirmed.', out: true, author: 'Bot' },
      ] },
    ];
    return { patients, services, turns, chats, config: { name: 'Demo Clinic', hours: 24, automatic: true, bot: true } };
  }

  const patientOf = (turn) => state.patients.find((p) => p.id === turn.patient);
  const serviceOf = (turn) => state.services.find((s) => s.id === turn.service);
  const badge = (status) => '<span class="badge ' + status + '">' + labels[status] + '</span>';
  const button = (text, action, extra = '', kind = '') => '<button type="button" class="button ' + kind + '" data-action="' + action + '" ' + extra + '>' + text + '</button>';
  const empty = (title, description, symbol = 'calendar') => '<div class="empty">' + icon(symbol) + '<strong>' + title + '</strong><p>' + description + '</p></div>';
  const heading = (title, description, actions = '') => '<div class="page-heading"><div><h2>' + title + '</h2><p class="subtitle">' + description + '</p></div><div class="actions">' + actions + '</div></div>';
  const newTurn = () => button(icon('plus') + 'New appointment', 'new-turn', '', 'primary');
  const pendingReminders = () => state.turns.filter((t) => active(t) && !t.reminded && t.date >= today && t.date < addDays(today, Math.ceil(state.config.hours / 24)));
  const sortTurns = (turns) => turns.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  function turnCard(turn, compact = false, showDate = false) {
    const patient = patientOf(turn);
    const service = serviceOf(turn);
    return '<button type="button" class="appointment ' + (compact ? 'compact ' : '') + (!active(turn) ? 'inactive' : '') + '" data-action="turn-detail" data-id="' + turn.id + '" aria-label="View appointment for ' + escape(patient.name) + ', ' + shortDate(turn.date) + ', ' + turn.time + ', ' + labels[turn.status] + '">' +
      '<div class="time">' + turn.time + ' <span>– ' + timeAt(minutes(turn.time) + turn.duration) + '</span></div><div class="appointment-body"><div class="appointment-person"><span class="patient-name">' + escape(patient.name) + '</span>' + badge(turn.status) + '</div>' +
      (showDate ? '<div class="appointment-meta">' + shortDate(turn.date) + '</div>' : '') +
      '<div class="appointment-meta">' + icon('service') + escape(service.name) + '</div><div class="appointment-meta">' + icon('doctor') + escape(professionals[turn.professional]) + '</div>' +
      (turn.reminded ? '<div class="appointment-meta">' + icon('check') + 'Reminder sent</div>' : '') + '</div></button>';
  }

  function navigate(section, focus = true) {
    if (!sections.some(([id]) => id === section)) return;
    view = section;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) $('#content').focus({ preventScroll: true });
  }

  function render() {
    const section = sections.find(([id]) => id === view);
    $('#page-title').textContent = section[1];
    document.title = section[1] + ' · SmartTurnos Demo';
    $('#clinic-name').textContent = state.config.name;
    $('#navigation').innerHTML = sections.map(([id, name, symbol]) => '<a href="#' + id + '" class="nav-item" data-nav="' + id + '" ' + (id === view ? 'aria-current="page"' : '') + '>' + icon(symbol) + name + '</a>').join('');
    const pages = { inicio: renderHome, agenda: renderAgenda, pacientes: renderPatients, servicios: renderServices, recordatorios: renderReminders, whatsapp: renderWhatsapp, configuracion: renderSettings };
    $('#content').innerHTML = pages[view]();
  }

  function renderHome() {
    const turnsToday = sortTurns(state.turns.filter((t) => t.date === today));
    const upcoming = sortTurns(state.turns.filter((t) => t.date > today && active(t))).slice(0, 4);
    const attention = state.chats.filter((c) => c.attention).length;
    const stats = [
      ['Today’s appointments', turnsToday.filter(active).length, 'calendar', 'agenda'],
      ['Unconfirmed today', turnsToday.filter((t) => t.status === 'pendiente').length, 'clock', 'agenda'],
      ['Reminders to send', pendingReminders().length, 'bell', 'recordatorios'],
    ];
    return heading(longDate(today), escape(state.config.name) + ' · Argentina time (UTC−03:00)', button(icon('plus') + 'New patient', 'new-patient') + newTurn()) +
      (attention ? '<button class="alert-link" data-action="attention">' + icon('chat') + attention + ' WhatsApp conversation needs a reply from your team.' + icon('right') + '</button>' : '') +
      '<div class="stats">' + stats.map(([name, value, symbol, target]) => '<button class="stat" data-nav="' + target + '"><span>' + name + icon(symbol) + '</span><strong>' + value + '</strong></button>').join('') + '</div>' +
      '<div class="dashboard"><section class="panel"><div class="panel-heading"><h3>Today’s appointments</h3><p>Select an appointment to confirm it, reschedule it, or prepare a reminder.</p></div>' + (turnsToday.map((t) => turnCard(t)).join('') || empty('No appointments today', 'Create one using “New appointment”.')) + '</section>' +
      '<section class="panel"><div class="panel-heading"><h3>Coming up</h3><p>Your next active appointments.</p></div>' + (upcoming.map((t) => turnCard(t, true, true)).join('') || empty('Schedule is clear', 'Book an appointment for the coming days.')) + '<button class="text-link" data-nav="agenda">View the full week</button></section></div>';
  }

  function renderAgenda() {
    const start = agendaMode === 'semana' ? monday(agendaDate) : agendaDate;
    const days = agendaMode === 'semana' ? 7 : 1;
    const turns = sortTurns(state.turns.filter((t) => t.date >= start && t.date < addDays(start, days) && (professional === 'all' || t.professional === Number(professional))));
    const end = addDays(start, 6);
    const title = agendaMode === 'dia' ? longDate(start) : 'Week of ' + formatDate(start, { day: 'numeric', month: 'short' }) + ' to ' + formatDate(end, { day: 'numeric', month: 'short' });
    const controls = '<div class="toolbar"><div class="actions">' + button(icon('left'), 'previous', 'aria-label="' + (days === 7 ? 'Previous week' : 'Previous day') + '"') + button('Today', 'today') + button(icon('right'), 'next', 'aria-label="' + (days === 7 ? 'Next week' : 'Next day') + '"') + '</div>' +
      '<div class="segmented" role="group" aria-label="Schedule view">' + ['dia', 'semana'].map((mode) => '<button data-action="agenda-mode" data-value="' + mode + '" aria-pressed="' + (agendaMode === mode) + '">' + (mode === 'dia' ? 'Day' : 'Week') + '</button>').join('') + '</div>' +
      '<div class="filters" role="group" aria-label="Practitioner">' + [['all', 'All'], ['0', professionals[0]], ['1', professionals[1]]].map(([id, name]) => '<button class="filter" data-action="professional" data-value="' + id + '" aria-pressed="' + (professional === id) + '">' + name + '</button>').join('') + '</div></div>';
    let body;
    if (days === 1) {
      body = '<section class="panel">' + (turns.map((t) => turnCard(t)).join('') || empty('No appointments on this day', 'Choose another date or create an appointment.')) + '</section>';
    } else {
      body = '<div class="calendar-scroll" tabindex="0" role="region" aria-label="Weekly schedule, scroll horizontally"><div class="calendar">' + Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const dayTurns = turns.filter((t) => t.date === date);
        const hours = weekday(date) === 0 ? 'Closed' : weekday(date) === 6 ? '09:00–13:00' : '08:00–13:00 · 14:00–20:00';
        return '<section class="day ' + (date === today ? 'today' : '') + '"><button class="day-heading" data-action="day" data-date="' + date + '" aria-label="View ' + longDate(date) + '">' + shortDate(date) + (date === today ? '<small>Today</small>' : '') + '</button><p class="hours">' + hours + '</p>' + (dayTurns.map((t) => turnCard(t, true)).join('') || '<p class="empty-day">No appointments</p>') + '</section>';
      }).join('') + '</div></div><p class="subtitle">Select an appointment to see available actions. Scroll horizontally to browse the week.</p>';
    }
    return heading(title, 'Argentina time (UTC−03:00) · ' + turns.filter(active).length + ' active appointments', newTurn()) + controls + body;
  }

  function patientRows() {
    const normalized = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const patients = state.patients.filter((p) => normalized(p.name + ' ' + p.phone).includes(normalized(query)) || (query.replace(/\D/g, '').length > 2 && p.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))));
    if (!patients.length) return '<tr><td colspan="4">' + empty('No patients found', 'Try another name or phone number.', 'users') + '</td></tr>';
    return patients.map((p) => '<tr><td><strong>' + escape(p.name) + '</strong><small class="hide-narrow">' + (escape(p.note) || 'No administrative notes') + '</small></td><td>' + escape(p.phone) + '</td><td class="hide-narrow">' + state.turns.filter((t) => t.patient === p.id && active(t)).length + '</td><td>' + button(icon('edit'), 'patient-detail', 'data-id="' + p.id + '" aria-label="View patient ' + escape(p.name) + '"') + '</td></tr>').join('');
  }

  function renderPatients() {
    return heading('Patients', state.patients.length + ' patients · Contact details and administrative notes.', button(icon('plus') + 'New patient', 'new-patient', '', 'primary')) +
      '<div class="toolbar"><label class="sr" for="patient-query">Search patients</label><input type="search" class="search-field" id="patient-query" placeholder="Search by name or phone…" value="' + escape(query) + '" autocomplete="off" maxlength="100"></div>' +
      '<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Patient</th><th>Phone</th><th class="hide-narrow">Active appointments</th><th><span class="sr">Actions</span></th></tr></thead><tbody id="patient-rows">' + patientRows() + '</tbody></table></div></section>';
  }

  function renderServices() {
    return heading('Services', 'Sample durations and prices for each practitioner.', button(icon('plus') + 'New service', 'new-service', '', 'primary')) +
      '<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Service</th><th class="hide-narrow">Practitioner</th><th>Duration</th><th>Price</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' + state.services.map((s) => '<tr><td><strong>' + escape(s.name) + '</strong></td><td class="hide-narrow">' + professionals[s.professional] + '</td><td>' + s.duration + ' min</td><td><strong>' + price(s.price) + '</strong><small>Cash: ' + price(s.cash) + '</small></td><td>' + button(icon('edit'), 'edit-service', 'data-id="' + s.id + '" aria-label="Edit ' + escape(s.name) + '"') + '</td></tr>').join('') + '</tbody></table></div></section><p class="subtitle">Selecting a service in “New appointment” fills in its duration and practitioner.</p>';
  }

  function renderReminders() {
    const pending = pendingReminders();
    const sent = sortTurns(state.turns.filter((t) => t.reminded));
    return heading('Reminders', 'Appointments in the next ' + state.config.hours + ' hours. Sending is simulated in this demo.') +
      '<div class="stack"><section class="panel"><div class="panel-heading"><h3>Ready to send (' + pending.length + ')</h3><p>The message includes the patient’s name, date, time, and practitioner.</p></div>' +
      (pending.map((t) => '<div class="reminder-row"><div><strong>' + escape(patientOf(t).name) + '</strong><p>' + shortDate(t.date) + ' · ' + t.time + ' · ' + professionals[t.professional] + '</p></div>' + button(icon('bell') + 'Prepare', 'reminder', 'data-id="' + t.id + '"') + '</div>').join('') || empty('You are up to date', 'There are no pending reminders for this period.', 'check')) +
      '</section><section class="panel table-panel"><div class="panel-heading"><h3>Recently sent</h3></div><div class="table-scroll"><table><thead><tr><th>Patient</th><th>Appointment</th><th>Channel</th><th>Status</th></tr></thead><tbody>' +
      (sent.map((t) => '<tr><td>' + escape(patientOf(t).name) + '</td><td>' + shortDate(t.date) + ' · ' + t.time + '</td><td>WhatsApp bot</td><td><span class="badge sent">Simulated</span></td></tr>').join('') || '<tr><td colspan="4">' + empty('No reminders sent yet', 'Prepare one to see how it works.', 'bell') + '</td></tr>') + '</tbody></table></div></section></div>';
  }

  function renderWhatsapp() {
    const chat = state.chats[selectedChat];
    const patient = state.patients.find((p) => p.id === chat.patient);
    return heading('WhatsApp', 'Sample conversations · Bot and front desk in one place.', '<span class="badge sent">Connected · Demo</span>') +
      '<div class="chat-layout"><div class="conversations" role="group" aria-label="Conversations">' + state.chats.map((c, i) => '<button class="conversation" data-action="chat" data-id="' + i + '" aria-pressed="' + (selectedChat === i) + '"><strong>' + escape(state.patients.find((p) => p.id === c.patient).name) + '</strong><span class="badge ' + (c.attention ? 'attention' : '') + '">' + (c.attention ? 'Needs attention' : c.mode === 'ia' ? 'Bot' : 'Human') + '</span><p>' + escape(c.messages[c.messages.length - 1].text) + '</p></button>').join('') + '</div>' +
      '<section class="chat-main" aria-label="Chat with ' + escape(patient.name) + '"><div class="chat-header"><div><strong>' + escape(patient.name) + '</strong><small>' + escape(patient.phone) + '</small></div><div class="actions">' + button(chat.mode === 'ia' ? 'Take over' : 'Return to bot', 'chat-mode') + (chat.attention ? button(icon('check') + 'Mark as handled', 'chat-attended') : '') + '</div></div>' +
      '<div class="messages" id="messages">' + chat.messages.map((m) => '<div class="message ' + (m.out ? 'out' : '') + '">' + escape(m.text) + '<small>' + (m.out ? escape(m.author) + ' · ' : '') + '09:4' + (m.out ? '2' : '1') + '</small></div>').join('') + '</div>' +
      '<form class="composer" data-form="message"><label class="sr" for="chat-message">Front desk message</label><input id="chat-message" name="message" placeholder="' + (chat.mode === 'ia' ? 'Take over the conversation to reply' : 'Write a sample reply…') + '" required maxlength="1000" autocomplete="off" ' + (chat.mode === 'ia' ? 'disabled' : '') + '><button class="button primary" aria-label="Simulate sending the message" ' + (chat.mode === 'ia' ? 'disabled' : '') + '>' + icon('send') + '</button></form><p class="chat-disclaimer">Messages stay in this demo. They are not sent to any phone.</p></section></div>';
  }

  function renderSettings() {
    return heading('Settings', 'Try the clinic settings. Changes only affect this demo.') +
      '<div class="config-grid"><form class="panel" data-form="settings"><div class="panel-heading"><h3>Clinic and automation</h3></div><div class="form-fields"><label>Clinic name<input name="name" required maxlength="60" value="' + escape(state.config.name) + '"></label>' +
      '<label>Reminder timing<select name="hours">' + [24, 48, 72].map((h) => '<option value="' + h + '" ' + (h === state.config.hours ? 'selected' : '') + '>' + h + ' hours before</option>').join('') + '</select></label>' +
      '<label class="checkbox"><input type="checkbox" name="automatic" ' + (state.config.automatic ? 'checked' : '') + '>Automatic reminders (simulated)</label><label class="checkbox"><input type="checkbox" name="bot" ' + (state.config.bot ? 'checked' : '') + '>WhatsApp appointment booking bot (simulated)</label></div><div class="form-footer"><button class="button primary">Save changes</button></div></form>' +
      '<section class="panel"><div class="panel-heading"><h3>Opening hours</h3><p>Sample opening hours · Argentina (UTC−03:00)</p></div>' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => '<div class="schedule-row"><span>' + day + '</span><span>' + (i < 5 ? '08:00–13:00<br>14:00–20:00' : i === 5 ? '09:00–13:00' : 'Closed') + '</span></div>').join('') + '</section></div>';
  }

  function notify(message) {
    clearTimeout(feedbackTimer);
    $('#feedback').hidden = false;
    $('#feedback').textContent = message;
    feedbackTimer = setTimeout(() => { $('#feedback').hidden = true; }, 4500);
  }

  function openModal(title, body) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    hydrateIcons();
    if (!$('#modal').open) $('#modal').showModal();
    const first = $('#modal-body').querySelector('input, select, textarea, button');
    if (first) first.focus({ preventScroll: true });
  }
  const closeModal = () => $('#modal').close();
  const footer = (text) => '<p class="form-error" role="alert" id="form-error" hidden></p><div class="form-footer">' + button('Back', 'close') + '<button class="button primary">' + text + '</button></div>';
  const option = (id, label, selected) => '<option value="' + id + '" ' + (id === selected ? 'selected' : '') + '>' + escape(label) + '</option>';
  const error = (text) => { $('#form-error').textContent = text; $('#form-error').hidden = false; };

  function turnForm(turn = null, patientId = null) {
    const service = turn ? serviceOf(turn) : state.services[0];
    openModal(turn ? 'Reschedule appointment' : 'New appointment', '<p class="form-note">Sample data. The appointment is saved only in this demo.</p><form data-form="turn" ' + (turn ? 'data-id="' + turn.id + '"' : '') + '><div class="form-fields">' +
      '<label>Patient<select name="patient">' + state.patients.map((p) => option(p.id, p.name, turn?.patient ?? patientId ?? state.patients[0].id)).join('') + '</select></label>' +
      '<label>Service<select name="service" id="turn-service">' + state.services.map((s) => option(s.id, s.name, service.id)).join('') + '</select></label>' +
      '<label>Practitioner<select name="professional">' + professionals.map((p, i) => option(i, p, turn?.professional ?? service.professional)).join('') + '</select></label>' +
      '<div class="form-pair"><label>Date<input type="date" name="date" required value="' + (turn?.date ?? agendaDate) + '"></label><label>Time<input type="time" name="time" required step="300" value="' + (turn?.time ?? '15:00') + '"></label></div>' +
      '<label>Duration<select name="duration">' + [15, 20, 30, 40, 45, 60, 90, 120].map((d) => option(d, d + ' minutes', turn?.duration ?? service.duration)).join('') + '</select></label></div>' + footer(turn ? 'Save new time' : 'Create appointment') + '</form>');
  }

  function turnDetail(turn) {
    openModal('Appointment for ' + patientOf(turn).name, badge(turn.status) + '<dl class="detail"><dt>Date</dt><dd>' + longDate(turn.date) + '</dd><dt>Time</dt><dd>' + turn.time + '–' + timeAt(minutes(turn.time) + turn.duration) + '</dd><dt>Service</dt><dd>' + escape(serviceOf(turn).name) + '</dd><dt>Practitioner</dt><dd>' + professionals[turn.professional] + '</dd></dl><div class="actions">' +
      (turn.status === 'pendiente' ? button(icon('check') + 'Confirm', 'turn-status', 'data-id="' + turn.id + '" data-status="confirmado"', 'primary') : '') +
      (active(turn) ? button('Mark as completed', 'turn-status', 'data-id="' + turn.id + '" data-status="realizado"') + button('Reschedule', 'reschedule', 'data-id="' + turn.id + '"') + button(icon('bell') + (turn.reminded ? 'View reminder' : 'Prepare reminder'), 'reminder', 'data-id="' + turn.id + '"') + button('Cancel appointment', 'turn-status', 'data-id="' + turn.id + '" data-status="cancelado"', 'danger') : '') +
      (turn.status === 'cancelado' || turn.status === 'realizado' ? button('Return to pending', 'turn-status', 'data-id="' + turn.id + '" data-status="pendiente"') : '') + '</div>');
  }

  function patientForm(patient = null) {
    openModal(patient ? patient.name : 'New patient', '<p class="form-note">Use fictional data. Notes are administrative; do not include clinical information.</p><form data-form="patient" ' + (patient ? 'data-id="' + patient.id + '"' : '') + '><div class="form-fields"><label>Full name<input name="name" required maxlength="80" value="' + escape(patient?.name) + '" placeholder="e.g. Valentina Pérez"></label><label>Phone<input name="phone" type="tel" required maxlength="30" value="' + escape(patient?.phone) + '" placeholder="e.g. +54 9 351 555-0123"></label><label>Administrative note<textarea name="note" rows="3" maxlength="300" placeholder="e.g. Prefers afternoon appointments.">' + escape(patient?.note) + '</textarea></label></div>' + footer(patient ? 'Save changes' : 'Create patient') + '</form>' + (patient ? '<div class="form-footer">' + button(icon('calendar') + 'Book an appointment', 'patient-turn', 'data-id="' + patient.id + '"') + '</div>' : ''));
  }

  function serviceForm(service = null) {
    openModal(service ? 'Edit service' : 'New service', '<form data-form="service" ' + (service ? 'data-id="' + service.id + '"' : '') + '><div class="form-fields"><label>Name<input name="name" required maxlength="60" value="' + escape(service?.name) + '"></label><label>Practitioner<select name="professional">' + professionals.map((p, i) => option(i, p, service?.professional ?? 0)).join('') + '</select></label><label>Duration<select name="duration">' + [15, 20, 30, 40, 45, 60, 90, 120].map((d) => option(d, d + ' minutes', service?.duration ?? 30)).join('') + '</select></label><div class="form-pair"><label>List price (ARS)<input name="price" type="number" min="0" max="10000000" step="100" required value="' + (service?.price ?? 25000) + '"></label><label>Cash price (ARS)<input name="cash" type="number" min="0" max="10000000" step="100" required value="' + (service?.cash ?? 22000) + '"></label></div></div>' + footer('Save service') + '</form>');
  }

  function reminder(turn) {
    const text = 'Hi ' + patientOf(turn).name.split(' ')[0] + ', this is a reminder of your appointment on ' + longDate(turn.date) + ' at ' + turn.time + ' with ' + professionals[turn.professional] + '. Can you confirm your attendance?';
    openModal('WhatsApp reminder', '<p class="form-note">Message preview. It is not sent to any phone.</p><div class="message out">' + escape(text) + '</div><div class="form-footer">' + button('Back', 'close') + (turn.reminded ? '<span class="badge sent">Simulated send recorded</span>' : button(icon('send') + 'Simulate sending', 'send-reminder', 'data-id="' + turn.id + '"', 'primary')) + '</div>');
  }

  function collision(turn, ignoredId) {
    return state.turns.some((t) => t.id !== ignoredId && active(t) && t.date === turn.date && t.professional === turn.professional && minutes(t.time) < minutes(turn.time) + turn.duration && minutes(t.time) + t.duration > minutes(turn.time));
  }

  function validHours(turn) {
    const start = minutes(turn.time), end = start + turn.duration, day = weekday(turn.date);
    return day !== 0 && (day === 6 ? start >= 540 && end <= 780 : (start >= 480 && end <= 780) || (start >= 840 && end <= 1200));
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]');
    if (nav) { event.preventDefault(); navigate(nav.dataset.nav); return; }
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = Number(trigger.dataset.id);
    const turn = state.turns.find((t) => t.id === id);
    switch (action) {
      case 'reset':
        closeModal(); state = initialState(); query = ''; $('#global-query').value = ''; agendaDate = today; agendaMode = 'semana'; professional = 'all'; selectedChat = 0; navigate('agenda'); notify('Demo reset. The original sample data has been restored.'); break;
      case 'close': closeModal(); break;
      case 'new-turn': turnForm(); break;
      case 'turn-detail': turnDetail(turn); break;
      case 'reschedule': turnForm(turn); break;
      case 'new-patient': patientForm(); break;
      case 'patient-detail': patientForm(state.patients.find((p) => p.id === id)); break;
      case 'patient-turn': turnForm(null, id); break;
      case 'new-service': serviceForm(); break;
      case 'edit-service': serviceForm(state.services.find((s) => s.id === id)); break;
      case 'previous': agendaDate = addDays(agendaDate, agendaMode === 'semana' ? -7 : -1); render(); break;
      case 'next': agendaDate = addDays(agendaDate, agendaMode === 'semana' ? 7 : 1); render(); break;
      case 'today': agendaDate = today; render(); break;
      case 'agenda-mode': agendaMode = trigger.dataset.value; render(); break;
      case 'professional': professional = trigger.dataset.value; render(); break;
      case 'day': agendaDate = trigger.dataset.date; agendaMode = 'dia'; render(); break;
      case 'turn-status':
        if (trigger.dataset.status === 'pendiente' && collision(turn, turn.id)) { notify('This time is already booked. Reschedule the appointment to reactivate it.'); break; }
        turn.status = trigger.dataset.status; closeModal(); render(); notify('Appointment updated: ' + labels[turn.status].toLowerCase() + '.'); break;
      case 'reminder': reminder(turn); break;
      case 'send-reminder': turn.reminded = true; closeModal(); render(); notify('Reminder recorded. Sending was simulated.'); break;
      case 'chat': selectedChat = id; render(); break;
      case 'attention': selectedChat = state.chats.findIndex((c) => c.attention); navigate('whatsapp'); break;
      case 'chat-mode': state.chats[selectedChat].mode = state.chats[selectedChat].mode === 'ia' ? 'humano' : 'ia'; render(); notify(state.chats[selectedChat].mode === 'humano' ? 'The front desk is now handling this conversation. You can write a message.' : 'Conversation returned to the bot.'); break;
      case 'chat-attended': state.chats[selectedChat].attention = false; render(); notify('Conversation marked as handled.'); break;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'patient-query') {
      query = event.target.value;
      $('#patient-rows').innerHTML = patientRows();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'turn-service') {
      const service = state.services.find((s) => s.id === Number(event.target.value));
      const form = event.target.form;
      form.elements.professional.value = service.professional;
      form.elements.duration.value = service.duration;
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.id === 'global-search') {
      event.preventDefault(); query = $('#global-query').value.trim(); navigate('pacientes'); $('#patient-query').focus({ preventScroll: true }); return;
    }
    if (!form.dataset.form) return;
    event.preventDefault();
    const data = new FormData(form);
    const id = form.dataset.id === undefined ? null : Number(form.dataset.id);
    switch (form.dataset.form) {
      case 'turn': {
        const turn = { patient: Number(data.get('patient')), service: Number(data.get('service')), professional: Number(data.get('professional')), duration: Number(data.get('duration')), date: data.get('date'), time: data.get('time') };
        if (!validHours(turn)) { error('This appointment is outside opening hours. Choose Monday to Friday, 08:00–13:00 or 14:00–20:00; Saturday, 09:00–13:00.'); return; }
        if (collision(turn, id)) { error('This practitioner already has an appointment at that time. Choose another time or practitioner.'); return; }
        if (id === null) state.turns.push({ ...turn, id: ++sequence, status: 'pendiente', reminded: false });
        else Object.assign(state.turns.find((t) => t.id === id), turn, { reminded: false });
        agendaDate = turn.date; professional = 'all'; closeModal(); navigate('agenda'); notify(id === null ? 'Appointment created. It now appears in the schedule.' : 'Appointment rescheduled. You can prepare a new reminder.'); break;
      }
      case 'patient': {
        const patient = { name: data.get('name').trim(), phone: data.get('phone').trim(), note: data.get('note').trim() };
        if (!patient.name) { error('Enter the patient’s full name.'); return; }
        if (patient.phone.replace(/\D/g, '').length < 8) { error('Enter a sample phone number with at least 8 digits.'); return; }
        if (id === null) state.patients.push({ ...patient, id: ++sequence });
        else Object.assign(state.patients.find((p) => p.id === id), patient);
        query = ''; closeModal(); navigate('pacientes'); notify(id === null ? 'Patient created. You can now book an appointment for them.' : 'Patient details updated.'); break;
      }
      case 'service': {
        const service = { name: data.get('name').trim(), professional: Number(data.get('professional')), duration: Number(data.get('duration')), price: Number(data.get('price')), cash: Number(data.get('cash')) };
        if (!service.name) { error('Enter a service name.'); return; }
        if (id === null) state.services.push({ ...service, id: ++sequence });
        else Object.assign(state.services.find((s) => s.id === id), service);
        closeModal(); navigate('servicios'); notify('Service saved in the demo.'); break;
      }
      case 'settings': {
        const name = data.get('name').trim();
        if (!name) { notify('Enter a clinic name.'); return; }
        state.config = { name, hours: Number(data.get('hours')), automatic: data.has('automatic'), bot: data.has('bot') };
        render(); notify('Settings saved in this demo.'); break;
      }
      case 'message': {
        const text = data.get('message').trim();
        const chat = state.chats[selectedChat];
        if (!text || chat.mode !== 'humano') return;
        chat.messages.push({ text, out: true, author: 'Carla' });
        render(); $('#messages').scrollTop = $('#messages').scrollHeight; $('#chat-message').focus({ preventScroll: true }); notify('Message added to the demo. Nothing was sent.'); break;
      }
    }
  });

  $('#modal').addEventListener('click', (event) => {
    if (event.target === $('#modal')) {
      const box = $('#modal').getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeModal();
    }
  });

  state = initialState();
  const initialSection = window.location.hash.slice(1);
  if (sections.some(([id]) => id === initialSection)) view = initialSection;
  render();
  hydrateIcons();
})();
