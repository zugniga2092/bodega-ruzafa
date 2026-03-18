require('dotenv').config();

const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');

// ====== CONFIGURACIÓN ======
const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const ADMIN_CHAT_ID   = process.env.ADMIN_CHAT_ID;
const WEBHOOK_URL     = process.env.WEBHOOK_URL; // Render lo pone automático si lo configuras
const PORT            = process.env.PORT || 3000;

if (!TELEGRAM_TOKEN || !ANTHROPIC_KEY || !ADMIN_CHAT_ID) {
  console.error('Faltan variables de entorno. Revisa TELEGRAM_TOKEN, ANTHROPIC_API_KEY y ADMIN_CHAT_ID.');
  process.exit(1);
}

const bot       = new Telegraf(TELEGRAM_TOKEN);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const app       = express();
app.use(express.json());

// ====== MEMORIA DE CONVERSACIÓN ======
// Map<chatId, { messages: [], firstSeen: Date }>
const conversations = new Map();
const MAX_HISTORY   = 10; // máximo 10 mensajes (5 intercambios)

function getHistory(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, { messages: [], firstSeen: new Date() });
  }
  return conversations.get(chatId).messages;
}

function addToHistory(chatId, role, content) {
  const history = getHistory(chatId);
  history.push({ role, content });
  // Recortar al máximo configurado (mensajes más recientes)
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

// ====== RESERVAS EN MEMORIA ======
// Array de { nombre, fecha, personas, telefono, chatId, timestamp }
const reservations = [];

function extractReservation(text) {
  const match = text.match(/\[RESERVA:\s*([^\]]+)\]/i);
  return match ? match[1] : null;
}

function parseReservation(str) {
  const data = {};
  str.split(',').forEach(part => {
    const [key, ...rest] = part.split('=');
    if (key && rest.length) {
      data[key.trim()] = rest.join('=').trim();
    }
  });
  return data;
}

// ====== SYSTEM PROMPT ======
const SYSTEM_PROMPT = `Eres Sommelier BR, el asistente virtual de Bodega Ruzafa, ubicada en C/ Cádiz 45, Ruzafa, Valencia.

REGLAS ABSOLUTAS:
- Cero emojis en todos tus mensajes
- No saludes después del primer mensaje
- Ve directo al punto
- Máximo 3 párrafos cortos
- Responde siempre en español de España
- Tono experto, cálido, cercano

INFORMACIÓN DEL NEGOCIO:
- Teléfono: 667 67 71 42
- Horario: Lunes a Sábado 10:00-14:30 y 17:00-20:30. Domingos cerrado.
- Servicios: venta de vinos, cavas, licores, aceites y productos gourmet. Catas semanales. Eventos privados.
- Próxima cata: sábado a las 18:00, 12 euros por persona, plazas limitadas.

PROTOCOLO DE RESERVAS:
- Para gestionar una reserva (cata, evento o visita), pide en orden: nombre, fecha, número de personas y teléfono.
- Cuando tengas todos los datos, escribe EXACTAMENTE esta etiqueta al final de tu respuesta (sin modificar el formato):
  [RESERVA: nombre=X, fecha=X, personas=X, telefono=X]
- Tras escribir la etiqueta, confirma al cliente que la reserva está registrada y que os pondremos en contacto.

MODO ADMIN:
- Si el mensaje es exactamente JAIRO2024, mostrar las reservas del día que te proporcione el sistema.
- Si el mensaje es exactamente PROMO, confirmar que se enviará la oferta al administrador.

VINOS DISPONIBLES:
- Ruzafa Reserva Tinto 2019, Monastrell, 18 euros. Fruta negra, especias, mineral.
- El Barrio Blanco 2022, Verdejo, 12 euros. Cítrico, fresco, floral.
- Carmen Crianza 2018, Tempranillo, 28 euros. Roble, cuero, cereza negra.
- Calle Sueca Rosado 2023, Bobal, 10 euros. Ligero, fresa, melocotón.
- Gran Ruzafa 2016, Blend, 55 euros. Nuestra joya exclusiva.`;

// ====== MANEJADORES DEL BOT ======

// /start — primera presentación
bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  conversations.delete(chatId); // Reiniciar historial en /start
  await ctx.reply(
    'Bienvenido a Bodega Ruzafa. Soy Sommelier BR, tu asistente.\n\n' +
    'Puedo ayudarte con información sobre nuestros vinos, próximas catas y eventos privados. ' +
    '¿En qué puedo ayudarte?'
  );
});

// Mensajes de texto
bot.on('text', async (ctx) => {
  const chatId  = String(ctx.chat.id);
  const userMsg = ctx.message.text.trim();

  // ── MODO ADMIN: listar reservas del día ──
  if (userMsg === 'JAIRO2024') {
    const hoy = new Date().toLocaleDateString('es-ES');
    const hoyReservas = reservations.filter(r => r.fecha_registro === hoy);
    if (hoyReservas.length === 0) {
      return ctx.reply(`No hay reservas registradas hoy (${hoy}).`);
    }
    const lista = hoyReservas
      .map((r, i) =>
        `${i + 1}. ${r.nombre || '—'} | ${r.fecha || '—'} | ${r.personas || '—'} personas | Tel: ${r.telefono || '—'}`
      )
      .join('\n');
    return ctx.reply(`Reservas del ${hoy}:\n\n${lista}`);
  }

  // ── MODO PROMO ──
  if (userMsg === 'PROMO') {
    try {
      await bot.telegram.sendMessage(
        ADMIN_CHAT_ID,
        'Activacion de PROMO desde el bot.\n\nRedacta la oferta y envíala a tus clientes desde @BodegaRuzafaBot.'
      );
      return ctx.reply('Notificación enviada al administrador. La oferta se enviará en breve.');
    } catch (err) {
      console.error('Error enviando PROMO al admin:', err.message);
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
      system:     SYSTEM_PROMPT,
      messages:   getHistory(chatId),
    });

    const fullReply = response.content[0].text;

    // Guardar respuesta en historial
    addToHistory(chatId, 'assistant', fullReply);

    // Detectar y procesar reserva
    const reservaStr = extractReservation(fullReply);
    if (reservaStr) {
      const datos = parseReservation(reservaStr);
      datos.fecha_registro = new Date().toLocaleDateString('es-ES');
      datos.chatId         = chatId;
      datos.timestamp      = new Date().toISOString();
      reservations.push(datos);

      // Notificar al admin
      const adminMsg =
        `Nueva reserva en Bodega Ruzafa\n\n` +
        `Nombre:   ${datos.nombre   || 'N/A'}\n` +
        `Fecha:    ${datos.fecha    || 'N/A'}\n` +
        `Personas: ${datos.personas || 'N/A'}\n` +
        `Teléfono: ${datos.telefono || 'N/A'}\n\n` +
        `Registrada: ${datos.fecha_registro}`;

      try {
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg);
      } catch (err) {
        console.error('Error notificando al admin:', err.message);
      }
    }

    // Enviar respuesta limpia al usuario (sin la etiqueta [RESERVA: ...])
    const replyClean = fullReply.replace(/\[RESERVA:[^\]]+\]/gi, '').trim();
    await ctx.reply(replyClean);

  } catch (err) {
    console.error('Error en conversación IA:', err.message);
    await ctx.reply('Ha ocurrido un error. Por favor, inténtalo de nuevo en un momento.');
  }
});

// Mensajes no-texto (fotos, stickers, etc.)
bot.on('message', async (ctx) => {
  await ctx.reply('Solo puedo procesar mensajes de texto. ¿En qué puedo ayudarte?');
});

// ====== ARRANQUE: WEBHOOK (producción) o POLLING (local) ======
async function start() {
  if (WEBHOOK_URL) {
    // Modo webhook — recomendado en Render.com
    const webhookPath = `/webhook/${TELEGRAM_TOKEN}`;
    app.use(bot.webhookCallback(webhookPath));

    await bot.telegram.setWebhook(`${WEBHOOK_URL}${webhookPath}`);
    console.log(`Webhook registrado en ${WEBHOOK_URL}${webhookPath}`);

    // Health check para Render
    app.get('/', (_, res) => res.send('Sommelier BR operativo.'));

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } else {
    // Modo polling — para desarrollo local
    console.log('Iniciando en modo polling (local)...');
    await bot.launch();
    console.log('Bot iniciado. Esperando mensajes...');
  }
}

start().catch(err => {
  console.error('Error al iniciar el bot:', err);
  process.exit(1);
});

// Parada limpia
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
