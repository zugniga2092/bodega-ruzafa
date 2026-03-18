# CLAUDE.md — Bodega Ruzafa | Proyecto Web Premium

## Contexto del Proyecto

Construye una página web de una sola página (single-page) de nivel premium para **Bodega Ruzafa**, una bodega boutique ubicada en el icónico barrio de Ruzafa, Valencia (España). El objetivo es que esta web convenza al propietario de adquirirla inmediatamente por su calidad, sofisticación y valor percibido.

**Stack:** HTML5 + CSS3 + JavaScript vanilla. Todo en un único archivo `index.html` autocontenido.

---

## Identidad de Marca

- **Nombre:** Bodega Ruzafa
- **Dueño:** Jairo
- **Logo:** Las iniciales **BR** en tipografía serif clásica negra (ver `logo.png` en `/assets/`). Úsalo en el header y footer.
- **Descripción real:** Venta de vinos, cavas, licores, aceites y productos gourmet. Catas de los mejores vinos todas las semanas. Eventos privados.
- **Tagline:** *"Donde el vino encuentra su historia"*
- **Tono:** Aspiracional, cálido, sofisticado. Urbano pero con raíces. Elegante sin ser frío.
- **Idioma:** Todo el contenido en español de España.

---

## Paleta de Colores (Variables CSS obligatorias)

```css
:root {
  --color-primary: #1A0A00;        /* Negro vino profundo */
  --color-secondary: #6B1F1F;      /* Borgoña oscuro */
  --color-accent: #C9A84C;         /* Dorado cálido */
  --color-accent-light: #E8D5A3;   /* Dorado suave */
  --color-cream: #FAF6EF;          /* Crema cálida (fondo claro) */
  --color-white: #FFFFFF;
  --color-text: #1A0A00;
  --color-text-light: #6B5B4E;     /* Texto secundario */
  --color-border: #DDD0C0;
}
```

---

## Tipografía (Google Fonts — cargar en `<head>`)

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
```

- **Títulos H1, H2:** `Playfair Display` — Serif elegante, peso 700
- **Subtítulos H3, citas:** `Cormorant Garamond` — Serif refinado, peso 300-400
- **Cuerpo, nav, botones:** `Montserrat` — Sans-serif limpio, peso 300-500

---

## Arquitectura del Sitio

### Navegación fija (sticky nav)
Logo BR a la izquierda. Links a la derecha: `Nosotros | Experiencias | Vinos | Galería | Reservas | Contacto`. Fondo transparente que se vuelve sólido (`--color-primary`) al hacer scroll. Hamburger menu en mobile.

---

## Secciones Obligatorias (en orden)

### 1. Hero Section
- **Imagen de fondo:** Placeholder con `background: linear-gradient(135deg, #1A0A00 0%, #4A1515 50%, #6B1F1F 100%)` más una textura de ruido CSS sutil. Imagen ideal: interior de bodega con barricas de roble, iluminación cálida y dramática.
- **Contenido centrado:**
  - Logo BR grande (80px) en dorado
  - H1: *"Una experiencia más allá del vino"*
  - Subtítulo (Cormorant Garamond italic 22px): *"Catas privadas, eventos exclusivos y la mejor selección de vinos en la Plaza Barón de Cortés, Ruzafa"*
  - CTA principal: Botón dorado `Reserva tu Experiencia` con hover elegante
  - CTA secundario: Link texto `Descubre nuestra selección ↓`
- **Efecto:** Parallax suave en el scroll. Partículas flotantes muy sutiles (pequeños puntos dorados, CSS animations).
- **Altura:** 100vh

### 2. Sobre Nosotros / Nuestra Historia
- **Layout:** 2 columnas (60% texto / 40% imagen decorativa con marco dorado)
- **Imagen placeholder:** Un sommelier sirviendo vino en ambiente íntimo, iluminación cálida.
- **Texto narrativo:**
  > *"Bodega Ruzafa nació de la pasión de Jairo por el vino: convertir cada copa en un momento memorable. En la Calle Cádiz, en el corazón del barrio más vibrante de Valencia, creamos un espacio donde la tradición vitivinícola española se encuentra con el espíritu moderno y artístico de Ruzafa.*
  >
  > *Seleccionamos personalmente cada botella de vino, cava, licor y producto gourmet. Cada semana organizamos catas para que descubras nuevos vinos en compañía. Y si buscas un espacio único para tu evento privado, aquí lo encontrarás. Porque para nosotros, el vino no es solo una bebida: es una conversación, un recuerdo, una historia que merece ser contada bien."*
- **Stats destacados** (3 números animados con CountUp al entrar en viewport):
  - `+350` Vinos de bodega
  - `+1.200` Eventos realizados
  - `15` Años en Ruzafa
- **Separador decorativo:** Línea dorada con icono de hoja de vid centrado.

### 3. Experiencias / Servicios
- **Título:** *"Vive el Vino de Otra Manera"*
- **Layout:** Grid 2x2 de cards con hover effect sofisticado (elevación + overlay de color borgoña semitransparente)
- **4 Servicios:**

  **Catas Semanales**
  - Icono: copa de vino (SVG inline elegante)
  - *"Cada semana organizamos catas guiadas para descubrir nuevos vinos, cavas y licores. Sesiones íntimas de 6 a 14 personas. Perfectas tanto para iniciarse como para profundizar. Incluye maridaje con productos gourmet de nuestra selección."*
  - CTA: `Reservar Cata`

  **Eventos Privados**
  - Icono: brindis/copa doble
  - *"Cumpleaños, aniversarios, despedidas, cenas de empresa o cualquier celebración que merezca un escenario único. Nos encargamos de todo: selección de vinos, decoración y atención personalizada durante todo el evento."*
  - CTA: `Organizar Evento`

  **Tienda Gourmet**
  - Icono: botella/bolsa
  - *"Más de 350 referencias de vinos, cavas, licores, aceites y productos gourmet seleccionados a mano por Jairo. Encuentra desde etiquetas cotidianas hasta joyas de bodega difíciles de encontrar en otro lugar de Valencia."*
  - CTA: `Ver Selección`

  **Regalos y Cestas**
  - Icono: caja/lazo
  - *"Cestas gourmet y selecciones de vino personalizadas para regalar en cualquier ocasión. Asesoramiento personalizado para encontrar el regalo perfecto para cada persona y cada presupuesto."*
  - CTA: `Consultar Opciones`

### 4. Selección de Vinos Destacados
- **Título:** *"Nuestra Selección"*
- **Subtítulo:** *"Cada botella, una historia elegida con precisión"*
- **Layout:** Carrusel horizontal (scroll snap) de 5 wine cards con efecto 3D hover sutil
- **5 Vinos ficticios pero realistas:**

  1. **Ruzafa Reserva 2019** | Monastrell & Garnacha | D.O. Utiel-Requena
     *"Profundo borgoña con aromas a fruta madura, tabaco y especias. Elegante en boca, con taninos sedosos y un final interminable."*
     — Precio: 38€ | ⭐ Puntuación: 94 pts

  2. **El Barrio Blanco 2022** | Verdejo & Viura | D.O. Rueda
     *"Fresco y mineral con toques cítricos y florales. Ideal para mariscos y arroces valencianos."*
     — Precio: 22€ | ⭐ Puntuación: 91 pts

  3. **Carmen de Ruzafa 2018** | Tempranillo Crianza | D.O. Ribera del Duero
     *"18 meses en barrica de roble francés. Complejidad máxima: cuero, vainilla y cereza negra en perfecta armonía."*
     — Precio: 65€ | ⭐ Puntuación: 96 pts

  4. **Calle Sueca Rosado 2023** | Bobal Rosado | D.O. Utiel-Requena
     *"Vino fresco y veraniego de color salmón brillante. Fresa, melocotón y un punto floral irresistible."*
     — Precio: 18€ | ⭐ Puntuación: 88 pts

  5. **Gran Ruzafa Magnum 2016** | Blend | Vino de España
     *"Nuestra joya. Blend secreto de cinco variedades. Crianza de 30 meses. Solo 600 botellas al año."*
     — Precio: 120€ | ⭐ Puntuación: 97 pts

- **Cada card incluye:** Placeholder imagen botella + descripción sensorial + precio + botón `Reservar para Cata`

### 5. Galería Visual
- **Título:** *"El Espacio"*
- **Layout:** Masonry grid (CSS columns: 3 en desktop, 2 en tablet, 1 en mobile)
- **9 imágenes placeholder** con gradientes y etiquetas descriptivas elegantes:
  1. Interior bodega, barricas iluminadas
  2. Evento corporativo, 30 personas brindando
  3. Detalle copa de vino tinto con luz lateral
  4. Sommelier explicando a grupo pequeño
  5. Tabla de quesos y embutidos ibéricos
  6. Vista exterior local, Ruzafa de noche
  7. Cata privada, pareja, ambiente íntimo
  8. Detalle etiqueta vino artesanal
  9. Celebración cumpleaños con decoración dorada
- **Hover effect:** Overlay oscuro con nombre de la imagen en Cormorant Garamond

### 6. Testimonios
- **Título:** *"Lo Que Dicen Nuestros Clientes"*
- **Layout:** Slider/carrusel de 4 testimonios con navegación por puntos
- **4 testimonios realistas:**

  > *"Organizamos la cena anual de empresa aquí y fue absolutamente mágico. El sommelier explicó cada vino con una pasión contagiosa. Nuestros clientes todavía hablan de esa noche."*
  — **Carlos M.**, Director Comercial, Valencia ⭐⭐⭐⭐⭐

  > *"Para mi aniversario quería algo especial y Bodega Ruzafa superó todas mis expectativas. La atención personalizada, la selección de vinos, el ambiente... Perfecto en cada detalle."*
  — **Lucía & Javier**, Valencia ⭐⭐⭐⭐⭐

  > *"Soy sommelier profesional y exijo mucho. Esta bodega tiene una de las selecciones más cuidadas de la Comunidad Valenciana. Los Ribera del Duero y los vinos locales son una revelación."*
  — **Andrés T.**, Sommelier Certificado ⭐⭐⭐⭐⭐

  > *"La cata de iniciación fue perfecta para nosotros. Sin snobismo, con humor y mucho conocimiento. Salimos con una nueva pasión por el vino y con tres botellas bajo el brazo."*
  — **Marta G.**, Google Reviews ⭐⭐⭐⭐⭐

### 7. Sección de Reservas
- **Título:** *"Reserva Tu Experiencia"*
- **Subtítulo:** *"Cuéntanos qué tienes en mente. Nos encargamos del resto."*
- **Layout:** 2 columnas — formulario elegante (izquierda) + información de contacto y horarios (derecha)
- **Formulario con campos:**
  - Nombre completo
  - Email
  - Teléfono
  - Tipo de experiencia (select): Cata Privada / Evento Corporativo / Celebración Privada / Maridaje / Otro
  - Número de personas
  - Fecha preferida (date picker)
  - Mensaje/detalles adicionales (textarea)
  - Botón: `Enviar Solicitud` (dorado, fullwidth)
- **Info lateral:**
  - 📍 C/ Cádiz 45, Valencia (frente a la Iglesia de San Valero, Ruzafa)
  - 📞 667 67 71 42
  - ✉️ [EMAIL PENDIENTE — añadir cuando se confirme el dominio]
  - **Horarios:** Lun-Sáb 10:00-14:30 y 17:00-20:30 | Domingos cerrado
  - **Aviso:** Se recomienda confirmar horarios estacionales. Reservas mínimo 48h de antelación para catas privadas.

### 8. Ubicación y Contacto
- **Mapa placeholder:** `div` con gradiente oscuro simulando un mapa, con pin dorado centrado animado y texto "C/ Cádiz 45, Ruzafa, Valencia". Incluir enlace a Google Maps: `https://maps.google.com/?q=Calle+Cadiz+45,+Valencia`
- **Datos de contacto repetidos** con iconos SVG inline elegantes

### 9. Footer
- Logo BR pequeño + tagline
- 4 columnas: Navegación | Servicios | Legal | Redes Sociales
- Newsletter: input email + botón `Suscribirme`
- Copyright: `© 2025 Bodega Ruzafa. Todos los derechos reservados.`
- `Aviso Legal | Política de Privacidad | Política de Cookies`
- Iconos redes sociales (SVG): 
  - Instagram: `https://www.instagram.com/bodegaruzafa/`
  - Facebook: `https://www.facebook.com/bodegaruzafavalencia/`

---

## Elementos de Diseño Premium Obligatorios

### Animaciones y Micro-interacciones
- **Scroll reveal:** Todos los elementos entran con `opacity: 0 → 1` + `translateY(30px → 0)` usando `IntersectionObserver`. Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. Duración: 600-800ms.
- **Hover en botones:** Scale(1.02) + sombra dorada `box-shadow: 0 8px 30px rgba(201, 168, 76, 0.4)`. Transición 300ms.
- **Hover en nav links:** Subrayado que se expande desde el centro (CSS pseudo-element).
- **CountUp animation:** Los stats de "Sobre Nosotros" se cuentan desde 0 cuando entran en viewport.
- **Cursor personalizado:** Círculo pequeño (12px) dorado semitransparente que sigue el cursor. Al hover sobre links, se expande a 40px.
- **Loading screen:** Pantalla inicial (1.5s) con logo BR que aparece y se desvanece. Fondo oscuro.

### Texturas y Fondos
- **Hero:** Gradient oscuro borgoña + ruido CSS (`filter: url(#noise)` SVG o `background-image` con pseudo-element)
- **Sección vinos:** Fondo `--color-primary` con textura sutil de madera (CSS repeating-linear-gradient simulando vetas)
- **Galería:** Fondo `--color-cream`
- **Testimonios:** Fondo oscuro con pattern de rombos muy sutil

### Separadores Decorativos
Entre secciones, usar: `<div class="divider">` con línea dorada fina (1px) y ornamento central (flor de vid SVG inline o símbolo ❧).

### Línea Decorativa en Headings
Los `H2` de cada sección llevan una línea dorada de 60px debajo, centrada, con 8px de margen.

---

## Responsive Breakpoints

```css
/* Mobile: < 768px */
/* Tablet: 768px - 1024px */  
/* Desktop: > 1024px */
/* Wide: > 1440px — max-width: 1400px centrado */
```

- Nav: hamburger en mobile (menú fullscreen oscuro)
- Grid 2x2 de servicios → stack vertical en mobile
- Carrusel de vinos → scroll horizontal en mobile
- Formulario de reservas → una columna en mobile

---

## Código JavaScript Requerido

```javascript
// 1. Sticky nav con cambio de fondo al scroll
// 2. Smooth scroll para anchor links
// 3. IntersectionObserver para scroll reveal animations
// 4. CountUp para estadísticas
// 5. Hamburger menu toggle
// 6. Cursor personalizado
// 7. Loading screen con timeout
// 8. Carrusel de testimonios (autoplay cada 5s + navegación manual)
// 9. Wine cards carousel (scroll snap + botones prev/next)
// 10. Form validation básica con feedback visual
```

---

## Estructura de Archivos

```
/
├── index.html          ← TODO el HTML, CSS y JS en un único archivo autocontenido
└── assets/
    └── logo.png        ← Logo BR (ya disponible)
```

**Importante:** Todo el CSS va en `<style>` en el `<head>` y todo el JS al final del `<body>`. El archivo debe funcionar abriendo directamente en el navegador sin servidor.

---

## Placeholders de Imágenes

Como no hay fotografías reales, implementa los placeholders así:

```css
.img-placeholder-hero {
  background: linear-gradient(135deg, #1A0A00 0%, #3D1010 40%, #6B2020 100%);
  /* Descripción: "Interior de bodega, barricas de roble, luz cálida y dramática" */
}

.img-placeholder-person {
  background: linear-gradient(160deg, #2D1810 0%, #4A2820 100%);
  /* Añadir texto descriptor con font Cormorant en dorado */
}
```

Cada placeholder debe tener en su centro un texto descriptivo en Cormorant Garamond italic 14px color `rgba(201, 168, 76, 0.5)` indicando qué foto iría ahí.

---

## Copy Adicional para SEO (meta tags)

```html
<title>Bodega Ruzafa | Vinos, Catas y Eventos Privados en Valencia</title>
<meta name="description" content="Bodega boutique en Ruzafa, Valencia. Vinos, cavas, licores y productos gourmet. Catas semanales y eventos privados. C/ Cádiz 45. Tel: 667 67 71 42.">
<meta name="keywords" content="Bodega Ruzafa, vinos Ruzafa Valencia, catas de vino Valencia, eventos privados Valencia, tienda vinos Valencia, calle Cadiz Valencia, productos gourmet Valencia">
<meta property="og:title" content="Bodega Ruzafa | Vinos, Cavas y Experiencias en Valencia">
<meta property="og:description" content="Tu bodega de referencia en Ruzafa. Vinos, cavas, licores, gourmet, catas semanales y eventos privados. C/ Cádiz 45, Valencia.">
```

---

## Restricciones Absolutas

❌ **NO usar:**
- Bootstrap, Tailwind ni ningún framework CSS externo
- jQuery ni librerías JS externas (solo vanilla JS)
- Diseños genéricos o plantillas visualmente reconocibles
- Colores brillantes, neones o combinaciones juveniles
- Navegación confusa o elementos sin propósito
- Código sin comentarios en secciones clave

✅ **SIEMPRE:**
- Variables CSS para todos los colores y tipografías
- Comentarios en CSS separando cada sección: `/* ====== HERO SECTION ====== */`
- Semántica HTML correcta: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- `aria-label` en botones icónicos y navegación
- Coherencia visual total entre secciones
- Mobile-first approach en el CSS

---

## Criterio de Calidad Final

Antes de considerar el trabajo terminado, verifica:

1. ¿El diseño comunica **lujo accesible** en los primeros 3 segundos?
2. ¿Todos los CTAs son visibles y persuasivos?
3. ¿El móvil se ve tan bien como el desktop?
4. ¿Las animaciones son suaves y no molestas?
5. ¿Hay coherencia tipográfica total?
6. ¿El código está limpio y comentado?
7. ¿Los textos venden la experiencia, no solo describen?

Si la respuesta a alguna pregunta es "no", revisa antes de entregar.

---

*Este archivo fue creado como brief de proyecto. El objetivo es que el propietario de Bodega Ruzafa vea esta web y piense: "Esto es exactamente lo que necesito para llevar mi negocio al siguiente nivel."*
