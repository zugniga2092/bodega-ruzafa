require('dotenv').config();

const { Telegraf }     = require('telegraf');
const Anthropic        = require('@anthropic-ai/sdk');
const express          = require('express');
const { createClient } = require('@supabase/supabase-js');

// ====== CONFIGURACIÓN ======
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ADMIN_CHAT_ID  = process.env.ADMIN_CHAT_ID;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const PORT           = process.env.PORT || 3000;

if (!TELEGRAM_TOKEN || !ANTHROPIC_KEY || !ADMIN_CHAT_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno. Revisa TELEGRAM_TOKEN, ANTHROPIC_API_KEY, ADMIN_CHAT_ID, SUPABASE_URL y SUPABASE_KEY.');
  process.exit(1);
}

const bot       = new Telegraf(TELEGRAM_TOKEN);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
const app       = express();
app.use(express.json());

// ====== MEMORIA DE CONVERSACIÓN (RAM, por sesión) ======
const conversations = new Map();
const MAX_HISTORY   = 20; // más historial para manejar el flujo de confirmación

function getHistory(chatId) {
  if (!conversations.has(chatId)) conversations.set(chatId, []);
  return conversations.get(chatId);
}

function addToHistory(chatId, role, content) {
  const history = getHistory(chatId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

// ====== SUPABASE: CLIENTES ======
async function upsertCliente(chatId, nombre, telefono) {
  const update = { ultima_visita: new Date().toISOString() };
  if (nombre)   update.nombre   = nombre;
  if (telefono) update.telefono = telefono;
  await supabase
    .from('clientes')
    .upsert({ chat_id: chatId, ...update }, { onConflict: 'chat_id' });
}

// ====== SUPABASE: RESERVAS ======
async function guardarReserva(chatId, datos) {
  const { error } = await supabase.from('reservas').insert({
    chat_id:  chatId,
    nombre:   datos.nombre   || null,
    fecha:    datos.fecha    || null,
    hora:     datos.hora     || null,
    personas: datos.personas || null,
    telefono: datos.telefono || null,
    estado:   'confirmada',
  });
  if (error) console.error('Error guardando reserva:', error.message);
}

async function getReservasHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .gte('created_at', hoy.toISOString())
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error leyendo reservas:', error.message);
    return [];
  }
  return data || [];
}

// ====== HELPERS ======
function getFechaHoy() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function extractTag(text, tag) {
  const match = text.match(new RegExp(`\\[${tag}:\\s*([^\\]]+)\\]`, 'i'));
  return match ? match[1] : null;
}

function parseTagData(str) {
  const data = {};
  str.split(',').forEach(part => {
    const [key, ...rest] = part.split('=');
    if (key && rest.length) data[key.trim()] = rest.join('=').trim();
  });
  return data;
}

// ====== SUPABASE: VINOS ======
async function getVinos() {
  const { data, error } = await supabase
    .from('vinos')
    .select('nombre, variedad, precio, descripcion')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return data.map(v => `- ${v.nombre}, ${v.variedad}, ${v.precio} euros. ${v.descripcion}`).join('\n');
}

// ====== SYSTEM PROMPT (con fecha y vinos de la BD) ======
async function buildSystemPrompt() {
  const cartaVinos = await getVinos();
  const vinosTexto = cartaVinos || '- Consulta disponibilidad con el sommelier.';
  return `Eres BR, el sommelier de Bodega Ruzafa, una bodega boutique en C/ Cádiz 45, Ruzafa, Valencia.
La fecha de hoy es: ${getFechaHoy()}.

IDIOMA — REGLA ABSOLUTA NÚMERO UNO:
Detecta el idioma del primer mensaje del cliente y mantén ESE idioma en toda la conversación sin excepción.
- Si escribe en inglés → responde en inglés siempre, hasta el final
- Si escribe en español → responde en español siempre
- Si escribe en valenciano → responde en valenciano
- Si mezcla idiomas → usa el predominante
Esta regla tiene prioridad sobre cualquier otra. Nunca cambies de idioma a mitad de conversación.

QUIÉN ERES:
Eres una persona real que trabaja en la bodega, no un bot. Hablas como alguien que lleva años entre vinos y conoce a sus clientes por el nombre. Eres cálido, cercano, con carácter propio. A veces haces una pregunta de vuelta, muestras curiosidad genuina, recuerdas lo que te han dicho antes en la conversación.

CÓMO HABLAS:
- Sin emojis
- Frases cortas y naturales, como en una conversación real
- Nada de listas ni formatos robóticos salvo cuando sea útil de verdad
- Máximo 3 párrafos por respuesta
- Si alguien está eligiendo un vino, ayúdale con criterio, no con un catálogo
- Si alguien parece dudar, anímale con naturalidad

LÍMITES:
- Solo hablas de Bodega Ruzafa, vinos, catas, eventos y productos del negocio
- Si alguien pregunta algo completamente ajeno al negocio, dilo con naturalidad: "Eso se me escapa un poco, la verdad. ¿En qué puedo ayudarte con la bodega?"

INFORMACIÓN DEL NEGOCIO:
- Teléfono: 667 67 71 42
- Horario: Lunes a Sábado 10:00-14:30 y 17:00-20:30. Domingos cerrado.
- Servicios: venta de vinos, cavas, licores, aceites y productos gourmet. Catas semanales. Eventos privados.
- Próxima cata: sábado a las 18:00, 12 euros por persona, plazas limitadas.

RESERVAS:
Cuando alguien quiera reservar, recoge estos datos de forma natural en la conversación, sin hacer sentir que es un formulario:
1. Nombre
2. Fecha (el cliente puede decirla como quiera, tú la conviertes a DD/MM/YYYY)
3. Hora (pídela en formato 18:00 pero de forma natural: "¿A qué hora os viene bien?")
4. Número de personas
5. Teléfono de contacto

MEMORIA DURANTE LA RESERVA — MUY IMPORTANTE:
- Lleva un seguimiento interno de qué datos ya tienes y cuáles faltan
- NUNCA pidas un dato que el cliente ya te ha dado anteriormente en la conversación
- Si el cliente ya te dijo la fecha, no se la vuelvas a pedir aunque hayan pasado varios mensajes
- Si el cliente ya te dijo las personas, no se las vuelvas a pedir
- Antes de hacer el resumen, repasa mentalmente los 5 datos del historial de la conversación

Cuando tengas los 5 datos, muestra un resumen claro y pregunta si es correcto:

"Perfecto, te anoto esto:

Nombre:   [nombre]
Fecha:    [DD/MM/YYYY]
Hora:     [HH:MM]
Personas: [número]
Teléfono: [teléfono]

¿Todo bien o hay algo que cambiar?"

Solo cuando el cliente confirme (sí, ok, perfecto, correcto, bien, vale, yes, sure, perfect o similar en cualquier idioma), escribe ÚNICAMENTE esta etiqueta, sin ningún texto antes ni después:
[RESERVA: nombre=X, fecha=DD/MM/YYYY, hora=HH:MM, personas=X, telefono=X]

IMPORTANTE SOBRE RESERVAS:
- El resumen de datos solo se muestra UNA vez antes de pedir confirmación. Nunca lo repitas.
- Cuando escribas la etiqueta no escribas NADA más. Ni "perfecto", ni "anotado", ni despedida. Solo la etiqueta. El sistema envía la confirmación automáticamente.
- Una vez escrita la etiqueta la reserva está COMPLETADA. No la repitas nunca más.
- Si el cliente escribe algo después de confirmar, responde con naturalidad como en cualquier conversación.
- Si el cliente corrige algo antes de confirmar, actualiza los datos y muestra el resumen corregido.

VINOS DISPONIBLES:
${vinosTexto}`;
}

// ====== MANEJADORES DEL BOT ======

bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  conversations.delete(chatId);
  await upsertCliente(chatId, null, null);
  await ctx.reply(
    'Bienvenido a Bodega Ruzafa. Soy Sommelier BR, tu asistente.\n\n' +
    'Puedo ayudarte con información sobre nuestros vinos, próximas catas y eventos privados. ' +
    '¿En qué puedo ayudarte?'
  );
});

bot.on('text', async (ctx) => {
  const chatId  = String(ctx.chat.id);
  const userMsg = ctx.message.text.trim();

  // ── SOLO ADMIN: verificar que es Jairo ──
  const esAdmin = chatId === String(ADMIN_CHAT_ID);

  // ── ADMIN: reservas de hoy ──
  if (userMsg === 'JAIRO2024') {
    if (!esAdmin) return ctx.reply('Solo puedo ayudarte con temas relacionados con Bodega Ruzafa. ¿En qué puedo ayudarte?');
    const reservas = await getReservasHoy();
    if (reservas.length === 0) return ctx.reply('No hay reservas registradas hoy.');
    const lista = reservas
      .map((r, i) => `${i + 1}. ${r.nombre || '—'} | ${r.fecha || '—'} a las ${r.hora || '—'} | ${r.personas || '—'} personas | Tel: ${r.telefono || '—'} | Estado: ${r.estado}`)
      .join('\n');
    return ctx.reply(`Reservas de hoy:\n\n${lista}`);
  }

  // ── ADMIN: reservas de la semana ──
  if (userMsg === 'SEMANA') {
    if (!esAdmin) return ctx.reply('Solo puedo ayudarte con temas relacionados con Bodega Ruzafa. ¿En qué puedo ayudarte?');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .gte('created_at', hoy.toISOString())
      .eq('estado', 'confirmada')
      .order('fecha', { ascending: true });
    if (error || !data || data.length === 0) return ctx.reply('No hay reservas confirmadas esta semana.');
    const lista = data
      .map((r, i) => `${i + 1}. ${r.nombre || '—'} | ${r.fecha || '—'} a las ${r.hora || '—'} | ${r.personas || '—'} personas | Tel: ${r.telefono || '—'}`)
      .join('\n');
    return ctx.reply(`Reservas de la semana:\n\n${lista}`);
  }

  // ── ADMIN: total de clientes ──
  if (userMsg === 'CLIENTES') {
    if (!esAdmin) return ctx.reply('Solo puedo ayudarte con temas relacionados con Bodega Ruzafa. ¿En qué puedo ayudarte?');
    const { count, error } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });
    if (error) return ctx.reply('Error consultando clientes.');
    return ctx.reply(`Clientes registrados en la BD: ${count}`);
  }

  // ── ADMIN: cancelar reserva ──
  if (esAdmin && userMsg.startsWith('CANCELAR ')) {
    const num = parseInt(userMsg.replace('CANCELAR ', '').trim(), 10);
    if (isNaN(num)) return ctx.reply('Uso correcto: CANCELAR 2 (número de la lista de hoy)');
    const reservas = await getReservasHoy();
    const reserva  = reservas[num - 1];
    if (!reserva) return ctx.reply(`No existe la reserva número ${num} de hoy.`);
    const { error } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reserva.id);
    if (error) return ctx.reply('Error al cancelar la reserva.');
    // Notificar al cliente
    try {
      await bot.telegram.sendMessage(
        reserva.chat_id,
        `Tu reserva en Bodega Ruzafa del ${reserva.fecha || '—'} a las ${reserva.hora || '—'} ha sido cancelada.\n\nPara cualquier consulta llámanos al 667 67 71 42.`
      );
    } catch (err) {
      console.error('Error notificando cancelación al cliente:', err.message);
    }
    return ctx.reply(`Reserva ${num} de ${reserva.nombre || '—'} cancelada. El cliente ha sido notificado.`);
  }

  // ── ADMIN: ayuda ──
  if (userMsg === 'AYUDA') {
    if (!esAdmin) return ctx.reply('Solo puedo ayudarte con temas relacionados con Bodega Ruzafa. ¿En qué puedo ayudarte?');
    return ctx.reply(
      'Comandos disponibles:\n\n' +
      'JAIRO2024  — Reservas de hoy\n' +
      'SEMANA     — Reservas de la semana\n' +
      'CLIENTES   — Total de clientes\n' +
      'CANCELAR 2 — Cancela la reserva nº 2 de hoy\n' +
      'PROMO      — Enviar notificación de oferta\n' +
      'AYUDA      — Ver esta lista\n\n' +
      `Tu chat_id: ${chatId}`
    );
  }

  // ── MODO PROMO ──
  if (userMsg === 'PROMO') {
    try {
      await bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        'Activacion de PROMO desde el bot.\n\nRedacta la oferta y envíala a tus clientes.'
      );
      return ctx.reply('Notificación enviada al administrador. La oferta se enviará en breve.');
    } catch (err) {
      console.error('Error enviando PROMO:', err.message);
      return ctx.reply('No se pudo contactar con el administrador. Inténtalo de nuevo.');
    }
  }

  // ── CONVERSACIÓN CON IA ──
  try {
    await ctx.sendChatAction('typing');
    addToHistory(chatId, 'user', userMsg);

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     await buildSystemPrompt(),
      messages:   getHistory(chatId),
    });

    const fullReply = response.content[0].text;
    addToHistory(chatId, 'assistant', fullReply);

    // Detectar confirmación de reserva
    const reservaStr = extractTag(fullReply, 'RESERVA');
    if (reservaStr) {
      const datos = parseTagData(reservaStr);

      // Guardar en Supabase
      await guardarReserva(chatId, datos);
      await upsertCliente(chatId, datos.nombre, datos.telefono);

      // Notificar al admin
      const adminMsg =
        `Nueva reserva confirmada — Bodega Ruzafa\n\n` +
        `Nombre:   ${datos.nombre   || 'N/A'}\n` +
        `Fecha:    ${datos.fecha    || 'N/A'}\n` +
        `Hora:     ${datos.hora     || 'N/A'}\n` +
        `Personas: ${datos.personas || 'N/A'}\n` +
        `Teléfono: ${datos.telefono || 'N/A'}`;
      try {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg);
      } catch (err) {
        console.error('Error notificando al admin:', err.message);
      }

      // Despedida natural al cliente
      await ctx.reply('Perfecto, todo anotado. Nos vemos pronto.');

      // Inyectar en el historial que la reserva está completada
      addToHistory(chatId, 'user', '[SISTEMA: Reserva registrada. No repitas los datos ni el tag [RESERVA:...]. Si el cliente escribe algo más, responde con normalidad.]');
      addToHistory(chatId, 'assistant', 'Entendido.');
    } else {
      // Respuesta normal al usuario
      const replyClean = fullReply.replace(/\[RESERVA:[^\]]+\]/gi, '').trim();
      await ctx.reply(replyClean);
    }

  } catch (err) {
    console.error('Error en conversación IA:', err.message);
    await ctx.reply('Ha ocurrido un error. Por favor, inténtalo de nuevo en un momento.');
  }
});

bot.on('message', async (ctx) => {
  await ctx.reply('Solo puedo procesar mensajes de texto. ¿En qué puedo ayudarte?');
});

// ====== RECORDATORIOS 24H ======
async function enviarRecordatorios() {
  // Buscar reservas de mañana que no hayan recibido recordatorio
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fechaManana = manana.toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '/'); // formato DD/MM/YYYY

  const { data: reservas, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('fecha', fechaManana)
    .eq('recordatorio_enviado', false)
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error leyendo reservas para recordatorio:', error.message);
    return 0;
  }

  if (!reservas || reservas.length === 0) return 0;

  let enviados = 0;
  for (const reserva of reservas) {
    try {
      const msg =
        `Recordatorio de tu reserva en Bodega Ruzafa\n\n` +
        `Nombre:   ${reserva.nombre   || '—'}\n` +
        `Fecha:    ${reserva.fecha    || '—'}\n` +
        `Hora:     ${reserva.hora     || '—'}\n` +
        `Personas: ${reserva.personas || '—'}\n\n` +
        `Te esperamos mañana. Cualquier cambio llámanos al 667 67 71 42.\n\n` +
        `Bodega Ruzafa — C/ Cádiz 45, Ruzafa, Valencia.`;

      await bot.telegram.sendMessage(reserva.chat_id, msg);

      // Marcar como enviado
      await supabase
        .from('reservas')
        .update({ recordatorio_enviado: true })
        .eq('id', reserva.id);

      enviados++;
    } catch (err) {
      console.error(`Error enviando recordatorio a ${reserva.chat_id}:`, err.message);
    }
  }

  return enviados;
}

// ====== SOLICITUD DE VALORACIÓN 48H DESPUÉS ======
async function enviarSolicitudesReview() {
  // Buscar reservas de hace 2 días sin review enviado
  const hace2dias = new Date();
  hace2dias.setDate(hace2dias.getDate() - 2);
  const fechaObjetivo = hace2dias.toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '/');

  const { data: reservas, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('fecha', fechaObjetivo)
    .eq('review_enviado', false)
    .eq('estado', 'confirmada');

  if (error) {
    console.error('Error leyendo reservas para review:', error.message);
    return 0;
  }

  if (!reservas || reservas.length === 0) return 0;

  let enviados = 0;
  for (const reserva of reservas) {
    try {
      const msg =
        `Hola ${reserva.nombre || 'de nuevo'}.\n\n` +
        `Esperamos que disfrutaras de tu visita a Bodega Ruzafa.\n\n` +
        `Si tienes un momento, tu opinión en Google nos ayuda mucho a seguir mejorando:\n` +
        `https://www.google.com/maps/search/Bodega+Ruzafa+Calle+Cadiz+45+Valencia\n\n` +
        `Muchas gracias. Hasta pronto,\n` +
        `Bodega Ruzafa — 667 67 71 42`;

      await bot.telegram.sendMessage(reserva.chat_id, msg);

      await supabase
        .from('reservas')
        .update({ review_enviado: true })
        .eq('id', reserva.id);

      enviados++;
    } catch (err) {
      console.error(`Error enviando review a ${reserva.chat_id}:`, err.message);
    }
  }

  return enviados;
}

// ====== REACTIVACIÓN DE CLIENTES INACTIVOS ======
async function reactivarClientes() {
  // Clientes sin reserva en los últimos 30 días
  // y sin mensaje de reactivación en los últimos 30 días
  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*')
    .lt('ultima_visita', hace30dias.toISOString())
    .or(`ultima_reactivacion.is.null,ultima_reactivacion.lt.${hace30dias.toISOString()}`)
    .not('nombre', 'is', null);

  if (error) {
    console.error('Error leyendo clientes inactivos:', error.message);
    return 0;
  }

  if (!clientes || clientes.length === 0) return 0;

  let enviados = 0;
  for (const cliente of clientes) {
    try {
      const msg =
        `Hola ${cliente.nombre.split(' ')[0]}.\n\n` +
        `Hace tiempo que no te vemos por Bodega Ruzafa. Esta semana tenemos cata el sábado a las 18:00, ` +
        `12 euros por persona y plazas limitadas.\n\n` +
        `Si te apetece volver, escríbenos aquí o llámanos al 667 67 71 42. ` +
        `Estaremos encantados de verte.`;

      await bot.telegram.sendMessage(cliente.chat_id, msg);

      await supabase
        .from('clientes')
        .update({ ultima_reactivacion: new Date().toISOString() })
        .eq('id', cliente.id);

      enviados++;
    } catch (err) {
      console.error(`Error reactivando cliente ${cliente.chat_id}:`, err.message);
    }
  }

  return enviados;
}

// ====== ARRANQUE ======
async function start() {
  app.get('/', (_, res) => res.send('OK'));

  // Endpoint recordatorios 24h — llamado cada hora desde cron-job.org
  app.get('/recordatorios', async (req, res) => {
    try {
      const enviados = await enviarRecordatorios();
      res.json({ ok: true, recordatorios_enviados: enviados });
    } catch (err) {
      console.error('Error en /recordatorios:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint reviews 48h después — llamado cada hora desde cron-job.org
  app.get('/reviews', async (req, res) => {
    try {
      const enviados = await enviarSolicitudesReview();
      res.json({ ok: true, reviews_enviados: enviados });
    } catch (err) {
      console.error('Error en /reviews:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Endpoint reactivación — llamado una vez a la semana desde cron-job.org
  app.get('/reactivar', async (req, res) => {
    try {
      const enviados = await reactivarClientes();
      res.json({ ok: true, clientes_reactivados: enviados });
    } catch (err) {
      console.error('Error en /reactivar:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  await new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
      resolve();
    });
  });

  console.log('Iniciando bot en modo polling...');
  bot.launch();
  console.log('Bot iniciado. Esperando mensajes...');
}

start().catch(err => {
  console.error('Error al iniciar el bot:', err);
  process.exit(1);
});

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
