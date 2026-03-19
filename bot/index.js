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

// ====== SYSTEM PROMPT (con fecha actual inyectada) ======
function buildSystemPrompt() {
  return `Eres Sommelier BR, el asistente virtual de Bodega Ruzafa, ubicada en C/ Cádiz 45, Ruzafa, Valencia.
La fecha de hoy es: ${getFechaHoy()}.

REGLAS ABSOLUTAS:
- Cero emojis en todos tus mensajes
- No saludes después del primer mensaje
- Ve directo al punto
- Máximo 3 párrafos cortos
- Responde siempre en español de España
- Tono experto, cálido, cercano
- Si el usuario pregunta algo que no tenga que ver con Bodega Ruzafa, vinos, reservas, catas, eventos o productos del negocio, responde únicamente: "Solo puedo ayudarte con temas relacionados con Bodega Ruzafa. ¿En qué puedo ayudarte?"

INFORMACIÓN DEL NEGOCIO:
- Teléfono: 667 67 71 42
- Horario: Lunes a Sábado 10:00-14:30 y 17:00-20:30. Domingos cerrado.
- Servicios: venta de vinos, cavas, licores, aceites y productos gourmet. Catas semanales. Eventos privados.
- Próxima cata: sábado a las 18:00, 12 euros por persona, plazas limitadas.

PROTOCOLO DE RESERVAS — sigue estos pasos en orden:
1. Pide el nombre completo.
2. Pide la fecha. El cliente puede escribirla como quiera ("el sábado", "el 22", "la próxima semana"). Tú la conviertes a formato DD/MM/YYYY usando la fecha de hoy como referencia.
3. Pide la hora en formato militar (ejemplo: 18:00, 20:00). Indica al cliente que use ese formato.
4. Pide el número de personas.
5. Pide el teléfono de contacto.

Una vez tengas los 5 datos, muestra el siguiente resumen EXACTAMENTE así y pregunta si es correcto:

"Antes de confirmar, revisa los datos de tu reserva:

Nombre:   [nombre]
Fecha:    [DD/MM/YYYY]
Hora:     [HH:MM]
Personas: [número]
Teléfono: [teléfono]

¿Es todo correcto? Responde SI para confirmar o indícame qué cambiar."

IMPORTANTE — solo cuando el cliente confirme con SI, sí, ok, correcto, perfecto, confirmado o similar, escribe al final de tu respuesta la etiqueta:
[RESERVA: nombre=X, fecha=DD/MM/YYYY, hora=HH:MM, personas=X, telefono=X]

Si el cliente dice que algo está mal, actualiza el dato, muestra el resumen corregido y vuelve a preguntar si es correcto. No escribas la etiqueta [RESERVA] hasta que el cliente confirme.

MODO ADMIN:
- Si el mensaje es exactamente JAIRO2024, mostrar las reservas del día que te proporcione el sistema.
- Si el mensaje es exactamente PROMO, confirmar que se enviará la oferta al administrador.

VINOS DISPONIBLES:
- Ruzafa Reserva Tinto 2019, Monastrell, 18 euros. Fruta negra, especias, mineral.
- El Barrio Blanco 2022, Verdejo, 12 euros. Cítrico, fresco, floral.
- Carmen Crianza 2018, Tempranillo, 28 euros. Roble, cuero, cereza negra.
- Calle Sueca Rosado 2023, Bobal, 10 euros. Ligero, fresa, melocotón.
- Gran Ruzafa 2016, Blend, 55 euros. Nuestra joya exclusiva.`;
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

  // ── MODO ADMIN: reservas del día ──
  if (userMsg === 'JAIRO2024') {
    const reservas = await getReservasHoy();
    if (reservas.length === 0) {
      return ctx.reply('No hay reservas registradas hoy.');
    }
    const lista = reservas
      .map((r, i) =>
        `${i + 1}. ${r.nombre || '—'} | ${r.fecha || '—'} a las ${r.hora || '—'} | ${r.personas || '—'} personas | Tel: ${r.telefono || '—'}`
      )
      .join('\n');
    return ctx.reply(`Reservas de hoy:\n\n${lista}`);
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
      system:     buildSystemPrompt(),
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

      // Confirmación final al cliente
      const confirmMsg =
        `Reserva confirmada en Bodega Ruzafa\n\n` +
        `Nombre:   ${datos.nombre   || '—'}\n` +
        `Fecha:    ${datos.fecha    || '—'}\n` +
        `Hora:     ${datos.hora     || '—'}\n` +
        `Personas: ${datos.personas || '—'}\n` +
        `Teléfono: ${datos.telefono || '—'}\n\n` +
        `Nos pondremos en contacto contigo para confirmar los detalles.\n` +
        `Para cualquier cambio llámanos al 667 67 71 42.\n\n` +
        `Hasta pronto, Bodega Ruzafa.`;
      await ctx.reply(confirmMsg);
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
        `https://g.page/r/bodega-ruzafa/review\n\n` +
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
