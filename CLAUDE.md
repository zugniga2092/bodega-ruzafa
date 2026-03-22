# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Kamea Gastro Bar | Agente IA

## Contexto del Proyecto

Agente de IA conversacional para **Kamea Gastro Bar**, ubicado en C/ Olmos 7, San Antonio de Benagéber (Valencia). Proyecto independiente con su propia base de datos Supabase, su propio token de Telegram y sus propias variables de entorno.

**El restaurante:** Gastro bar de cocina mediterránea contemporánea en un pueblo a 15 minutos de Valencia. Abre de lunes a sábado (almuerzos y comidas), con cenas solo viernes y sábado. Cerrado domingos. Ofrece menú del día de lunes a jueves a 12€. Admite perros, tiene terraza, tronas para bebés y acceso para silla de ruedas. Pago con tarjeta y Bizum. El dueño y contacto admin es **Alex**.

**Propósito del agente:** Atiende clientes 24/7 por Telegram (migración a WhatsApp vía Twilio o 360dialog cuando esté listo), gestiona reservas, responde dudas sobre carta y alérgenos, aprende de cada conversación, y actúa como copiloto de Alex en modo admin.

**Diferencia clave con un bot:** Mantiene memoria real de conversación, entiende lenguaje natural sin comandos rígidos, aprende preguntas nuevas, toma decisiones contextuales y mejora con cada interacción. No sigue un árbol de decisiones fijo — razona.

---

## Comandos de Desarrollo

Todo el código está en el subdirectorio `kamea-bot/`.

```bash
cd kamea-bot
npm install          # instalar dependencias
npm run dev          # desarrollo con hot-reload (node --watch)
npm start            # producción
```

Requiere `.env` con las variables listadas abajo. Copiar de `.env.example` y rellenar.

---

## Stack Tecnológico

- **Runtime:** Node.js ≥18
- **Framework de mensajería:** Telegraf (Telegram) → migrar a Twilio o 360dialog para WhatsApp
- **Inteligencia:** Anthropic Claude API — modelos usados:
  - `claude-sonnet-4-6` — conversaciones con clientes (`agent.js`)
  - `claude-haiku-4-5` — extracción de menú y posts de Instagram (`admin.js`)
- **Memoria:** Supabase — historial persistente por chat_id, últimos 10 mensajes
- **Base de datos:** Supabase (instancia propia de Kamea — no compartida con ningún otro cliente)
- **Automatizaciones programadas:** n8n via endpoint REST /agent
- **Hosting:** Railway.app
- **Versionado:** GitHub (repositorio privado kamea-bot)

---

## Estructura de Archivos
```
kamea-bot/
├── CLAUDE.md                  ← Este archivo — leer siempre antes de tocar el código
├── index.js                   ← Entrada principal, inicializa agente y servidor Express
├── agent.js                   ← Núcleo del agente — llamada a Claude API con memoria y system prompt
├── messenger.js               ← Capa de mensajería (Telegraf ahora, Twilio después)
├── memory.js                  ← Gestión de memoria conversacional en Supabase
├── commands/
│   ├── cliente.js             ← Lógica modo cliente
│   └── admin.js               ← Lógica modo admin y todos los comandos #admin
├── workflows/
│   └── n8n-endpoints.js       ← Endpoints REST para automatizaciones de n8n
├── package.json
├── .env                       ← Variables de entorno reales (nunca subir a GitHub)
└── .env.example               ← Plantilla de variables sin valores reales
```

---

## Variables de Entorno
```env
ANTHROPIC_API_KEY=           # API key de Anthropic — cerebro del agente
TELEGRAM_BOT_TOKEN=          # Token del agente de Kamea creado con @BotFather
TELEGRAM_ADMIN_CHAT_ID=      # Chat ID de Alex para pruebas y notificaciones
SUPABASE_URL=                # URL del proyecto Supabase de Kamea
SUPABASE_ANON_KEY=           # Anon key del proyecto Supabase de Kamea
BUSINESS_ID=kamea            # Identificador del cliente — cambia por cliente
PORT=3000
```

**IMPORTANTE:** Nunca subir .env a GitHub. Está en .gitignore. Las variables se configuran directamente en Railway dashboard.

---

## Base de Datos Supabase

Todas las tablas incluyen business_id para arquitectura multi-cliente.

### conversaciones
Memoria del agente. Se recuperan los últimos 10 mensajes de cada chat_id antes de cada respuesta. Sin esto el agente no recuerda el contexto de la conversación.
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
chat_id text not null
role text not null -- 'user' o 'assistant'
content text not null
created_at timestamptz default now()
```

### reservas
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
chat_id text not null
nombre text not null
telefono text
fecha_visita date not null
hora text not null
personas integer not null
servicio text not null -- 'almuerzo', 'comida', 'cena'
estado text default 'pendiente' -- 'pendiente', 'confirmada', 'rechazada', 'completada', 'no_show'
notas text -- alergias, niños, carrito, celebración especial
created_at timestamptz default now()
```

### clientes
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
chat_id text not null unique
nombre text
telefono text
primera_visita date
ultima_visita date
visitas_total integer default 0
activo boolean default true
created_at timestamptz default now()
```

### preguntas_desconocidas
Aprendizaje activo del agente. Cuando no sabe responder algo lo guarda aquí, avisa al dueño, y cuando el dueño responde queda en la base de conocimiento para siempre.
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
chat_id text not null
pregunta text not null
respuesta text -- se rellena cuando el dueño responde via #admin respuesta [id]
estado text default 'pendiente' -- 'pendiente', 'respondida'
created_at timestamptz default now()
```

### menu_dia
El dueño actualiza esto cada día via #admin en lenguaje natural. El agente lo consulta en tiempo real.
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
fecha date not null
entrante text
plato_principal text
postre text
precio numeric default 12
activo boolean default true
created_at timestamptz default now()
```

### notificaciones
Log de mensajes automáticos enviados por n8n.
```sql
id uuid primary key default gen_random_uuid()
business_id text not null
tipo text not null -- 'recordatorio_24h', 'recordatorio_2h', 'resena', 'reactivacion', 'reporte_semanal'
contenido text
destinatario text
enviado boolean default false
created_at timestamptz default now()
```

---

## Arquitectura Clave

### Patrón de etiquetas (tags)
`agent.js` devuelve texto plano a `cliente.js`, que lo parsea buscando etiquetas especiales:

- `[RESERVA: nombre=X, fecha=DD/MM/YYYY, hora=HH:MM, personas=X, servicio=X, telefono=X, notas=X]` → guarda en Supabase + notifica al admin
- `[PREGUNTA_DESCONOCIDA: texto]` → guarda en `preguntas_desconocidas` + notifica al admin

Cuando Claude incluye una etiqueta, el sistema la intercepta y la etiqueta nunca llega al cliente. Este contrato entre el system prompt y `cliente.js` es central — si se cambia el formato de la etiqueta en uno hay que cambiarlo en el otro.

### Sesiones admin en memoria
Las sesiones admin activas se guardan en un `Map` en memoria (`admin.js:8`). Se pierden al reiniciar el servidor. El admin tendrá que usar `#admin` de nuevo para reactivar la sesión.

### Routing de comandos admin
La mayoría de comandos `#admin` usan **regex matching directo** en `admin.js`, sin pasar por Claude. Solo dos llaman a la API:
- `#admin menú hoy [descripción]` → Haiku extrae el JSON de platos
- `#admin post [tema]` → Haiku genera los posts de Instagram

---

## Lógica de Detección de Modo
```
Mensaje entrante
    ↓
¿Contiene #admin?
    ├── SÍ → Activar modo admin para este chat_id
    │         Persiste 30 minutos de inactividad
    │         O hasta que el dueño escriba "salir"
    └── NO → ¿Está en sesión admin activa?
                ├── SÍ → Continuar en modo admin
                └── NO → Modo cliente (por defecto)
```

---

## Modo Cliente — Comportamiento del Agente

- Responde en el idioma del cliente — español, inglés, valenciano u otro
- Nunca revela que es IA
- Consulta Supabase antes de responder: menú del día, platos agotados, notas del día, base de conocimiento
- Alérgenos: NUNCA en números, siempre en texto legible — "Este plato contiene gluten, huevos y lácteos"
- Si el cliente menciona una alergia el agente revisa todos los platos relevantes y advierte claramente
- Flujo de reserva conversacional y natural — recoge datos en orden sin parecer un formulario
- Al completar reserva: guarda en Supabase estado pendiente, notifica al dueño con todos los detalles, responde al cliente que está pendiente de confirmación
- Preguntas sin respuesta: guarda en preguntas_desconocidas, notifica al dueño, responde que va a consultarlo
- Si hay urgencia sugiere llamar al 960 81 18 48

---

## Modo Admin — Copiloto del Dueño

El agente actúa como copiloto inteligente. El dueño habla en lenguaje natural con #admin — no necesita recordar comandos exactos.

### Menú
| Comando | Acción |
|---|---|
| #admin menú hoy [descripción natural] | El agente extrae entrante/principal/postre y actualiza Supabase |
| #admin agotado [plato] | Marca plato como no disponible |
| #admin oferta [descripción] | Guarda oferta especial del día |
| #admin nota [texto] | Guarda nota del día visible para el agente |

### Reservas
| Comando | Acción |
|---|---|
| #admin reservas hoy | Lista reservas del día con estado |
| #admin reservas mañana | Lista reservas del día siguiente |
| #admin confirmar [nombre o id] | Confirma reserva y notifica automáticamente al cliente |
| #admin rechazar [nombre o id] [motivo] | Rechaza y notifica al cliente con disculpa |
| #admin no-show [nombre o id] | Marca como no_show en Supabase |

### Conocimiento
| Comando | Acción |
|---|---|
| #admin preguntas | Lista preguntas de clientes sin responder |
| #admin respuesta [id] [respuesta] | Guarda en base de conocimiento y notifica al cliente si sigue activo |
| #admin resumen | Resumen completo del día |
| #admin cierre de hoy | Igual que resumen |

### Contenido
| Comando | Acción |
|---|---|
| #admin post hoy | 3 ideas de post Instagram con el menú del día, emojis y hashtags de Valencia |
| #admin post [tema] | Post sobre el tema indicado |

---

## Endpoint REST para n8n
```
POST /agent
Body: { businessId, action, data }
```

### Acciones disponibles
| Acción | Descripción |
|---|---|
| recordatorio_24h | Envía recordatorio a clientes con reserva mañana |
| recordatorio_2h | Envía recordatorio 2h antes de cada reserva |
| aviso_menu | Avisa al dueño si el menú no está actualizado a las 12:30 |
| solicitar_resena | Solicita reseña Google el día después de la visita |
| reactivar_clientes | Mensaje personalizado a clientes inactivos más de 30 días |
| reporte_semanal | Resumen semanal al dueño cada lunes a las 9:00 |

---

## Automatizaciones n8n

| Automatización | Trigger | Acción |
|---|---|---|
| Recordatorio 24h | Cada día 11:00 | Busca reservas confirmadas para mañana, mensaje personalizado |
| Recordatorio 2h | 2h antes de cada reserva | Mensaje final anti no-show |
| Aviso menú vacío | Cada día 12:30 | Si menu_dia hoy está vacío avisa al dueño |
| Solicitud reseña | Día siguiente a reserva completada | Mensaje con link Google Maps |
| Reactivación | Cada lunes | Clientes con ultima_visita hace más de 30 días |
| Reporte semanal | Lunes 9:00 | Resumen de la semana al dueño |

---

## Información del Restaurante
```
Nombre: Kamea Gastro Bar
Dirección: C/ Olmos 7, San Antonio de Benagéber, Valencia
Teléfono: 960 81 18 48
Instagram: @kameagastro
Google Maps: https://maps.app.goo.gl/WAnsjwWDfNgfmoAy9

Horarios:
- Almuerzos: Lunes-Sábado 9:00-12:00
- Comidas: Lunes-Sábado 13:00-16:00 (cocina cierra 15:30)
- Cenas: Viernes-Sábado 20:00-00:00 (cocina cierra 23:30)
- Domingos: Cerrado
- Menú del día: Lunes-Jueves en comidas, 12€ incluye entrante, plato principal, postre y bebida

Instalaciones:
- Terraza: Sí
- Admiten perros: Sí
- Trona bebés: Sí
- Acceso silla de ruedas: Sí
- Aparcamiento: No propio, buscar en el pueblo
- Wifi: Sí
- Zona privada: No, pero hacemos eventos privados
- Tarjeta: Sí — Bizum: Sí
```

---

## Deploy en Railway

1. Conectar repositorio GitHub kamea-bot a Railway
2. Railway detecta Node.js automáticamente
3. Configurar todas las variables de entorno en Railway dashboard
4. Cada push a main despliega automáticamente sin intervención manual
5. La URL del servicio es el webhook de Telegram y el endpoint de n8n

---

## Cómo Clonar para un Nuevo Cliente

1. Clonar este repositorio con nuevo nombre
2. Cambiar BUSINESS_ID en .env
3. Actualizar system prompt en agent.js con información del nuevo cliente
4. Crear nuevo agente en Telegram con @BotFather
5. Crear nuevo proyecto en Supabase y ejecutar el SQL de las tablas
6. Crear nuevo repositorio privado en GitHub
7. Crear nuevo servicio en Railway conectado al nuevo repositorio
8. Configurar variables de entorno del nuevo cliente en Railway

El código no cambia — solo cambian las variables de entorno y el system prompt.

---

## Migración a WhatsApp

Cuando esté listo para migrar de Telegram a WhatsApp:
1. Contratar número en 360dialog (más barato para agencias) o Twilio
2. Cambiar módulo Telegraf por cliente WhatsApp en messenger.js
3. El resto del sistema no cambia — agent.js, memory.js, commands/ se mantienen intactos
4. Actualizar variables de entorno en Railway

---

## Estado del Proyecto

- [ ] Agente Telegram funcionando en local
- [ ] Conexión Supabase verificada
- [ ] Modo cliente probado con conversación real
- [ ] Modo admin probado con todos los comandos
- [ ] Deploy en Railway
- [ ] Pruebas end-to-end con Alex como admin
- [ ] Migración a WhatsApp (pendiente SIM de Alex)
- [ ] Automatizaciones n8n configuradas