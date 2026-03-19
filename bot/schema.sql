-- ====== BODEGA RUZAFA — SCHEMA ======

-- Clientes que han hablado con el bot
CREATE TABLE clientes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      text UNIQUE NOT NULL,
  nombre       text,
  telefono     text,
  created_at   timestamptz DEFAULT now(),
  ultima_visita timestamptz DEFAULT now()
);

-- Reservas detectadas por el bot
CREATE TABLE reservas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    text NOT NULL,
  nombre     text,
  fecha      text,
  personas   text,
  telefono   text,
  estado     text DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now()
);
