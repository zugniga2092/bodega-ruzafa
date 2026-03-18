# Sommelier BR — Bot de Telegram de Bodega Ruzafa

Bot de IA con memoria de conversación para gestionar consultas, reservas y atención al cliente de Bodega Ruzafa.

## Requisitos locales

- Node.js 18+
- Cuenta de Telegram con un bot creado via @BotFather

## Ejecución local

```bash
cd bot
npm install
# Edita .env con tus credenciales
npm start
```

El bot arranca en modo polling (sin necesidad de URL pública).

---

## Despliegue en Render.com (gratuito) — 10 minutos

### 1. Subir el código a GitHub

El repositorio ya debe estar en GitHub. Asegúrate de que la carpeta `bot/` está incluida y que **`.env` NO está subido** (está en `.gitignore`).

### 2. Crear el servicio en Render

1. Ve a [render.com](https://render.com) e inicia sesión (o regístrate gratis).
2. Pulsa **New → Web Service**.
3. Conecta tu repositorio de GitHub (`bodega-ruzafa`).
4. Configura el servicio:
   - **Name:** `bodega-ruzafa-bot`
   - **Root Directory:** `bot`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free

### 3. Añadir las variables de entorno en Render

En la sección **Environment** añade estas tres variables:

| Key | Value |
|-----|-------|
| `TELEGRAM_TOKEN` | tu token de @BotFather |
| `ANTHROPIC_API_KEY` | tu API key de Anthropic |
| `ADMIN_CHAT_ID` | tu chat_id de Telegram |

> Todavía NO añadas `WEBHOOK_URL` — lo harás en el paso 5.

### 4. Desplegar

Pulsa **Create Web Service**. Render instalará las dependencias y arrancará el bot. El primer deploy tarda ~2 minutos.

### 5. Activar el webhook (importante para producción)

Una vez desplegado, Render te dará una URL del tipo:
```
https://bodega-ruzafa-bot.onrender.com
```

Vuelve a **Environment** y añade:

| Key | Value |
|-----|-------|
| `WEBHOOK_URL` | `https://bodega-ruzafa-bot.onrender.com` |

Guarda y Render reiniciará el servicio automáticamente. El bot registrará el webhook con Telegram y empezará a funcionar.

### 6. Verificar

Abre Telegram, busca tu bot y envía un mensaje. Deberías recibir respuesta en segundos.

---

## Comandos especiales

| Mensaje | Quién puede usarlo | Qué hace |
|---------|-------------------|----------|
| `/start` | Cualquier usuario | Reinicia la conversación |
| `JAIRO2024` | Admin (Jairo) | Lista las reservas registradas hoy |
| `PROMO` | Admin (Jairo) | Notifica al admin para enviar una oferta |

---

## Notas sobre el plan gratuito de Render

- El servicio se **duerme tras 15 minutos de inactividad**. El primer mensaje tras el sueño puede tardar ~30 segundos en responder.
- Para evitarlo, considera actualizar al plan Starter (7 $/mes) o usar un servicio de ping externo (UptimeRobot, cron-job.org) que haga una petición GET a tu URL cada 10 minutos.

---

## Arquitectura

```
index.js
├── Express + webhook Telegraf   ← recibe mensajes de Telegram
├── Map<chatId, messages[]>      ← memoria de conversación (máx. 10 msg)
├── Anthropic SDK                ← genera respuestas con Claude
├── Detección [RESERVA: ...]     ← notifica al admin y guarda en memoria
└── Modo polling (local)         ← para desarrollo sin URL pública
```
