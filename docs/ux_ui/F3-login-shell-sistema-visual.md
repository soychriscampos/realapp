# F3 — Login + shell general + sistema visual base

## Objetivo

Definir la estructura visual base que compartirán todas las pantallas de REAL:

- login;
- shell desktop;
- shell móvil;
- sidebar;
- topbar;
- bottom navigation;
- drawers/sheets;
- tipografía;
- radios;
- bordes;
- densidad;
- comportamiento responsive.

Este bloque debe convertirse después en el sistema base sobre el que se construya toda la UI.

---

# 1. Dirección visual definitiva

La referencia visual principal sigue siendo la imagen 1.

REAL debe verse:

- muy claro;
- predominantemente blanco;
- con fondo gris extremadamente suave;
- bordes tenues;
- pocos colores;
- iconografía lineal;
- tipografía limpia;
- bastante espacio;
- componentes muy contenidos;
- sin sombras fuertes;
- sin apariencia de “dashboard template”.

El diseño debe sentirse más cerca de una aplicación financiera moderna que de un software escolar tradicional.

---

# 2. Sistema de superficies

Usar tres niveles visuales.

## Nivel 1 — Fondo general

Un gris casi blanco.

Ejemplo conceptual:

```text
#F7F7F8
```

No tiene que ser ese hexadecimal exacto todavía, pero sí una intensidad similar.

Sirve para:

- separar shell de contenido;
- hacer visibles los paneles blancos;
- evitar que todo sea blanco puro sin estructura.

## Nivel 2 — Superficie principal

Blanco.

```text
#FFFFFF
```

Para:

- sidebar;
- paneles;
- sheets;
- dialogs;
- bloques principales.

## Nivel 3 — Superficie secundaria

Gris muy tenue.

Para:

- hover;
- filas activas;
- inputs deshabilitados;
- tabs secundarias;
- bloques de información.

No usar gris oscuro como superficie principal.

---

# 3. Bordes y sombras

## Bordes

Principalmente:

```text
1px
gris muy claro
```

El borde debe hacer el trabajo de separación.

## Sombras

Muy mínimas.

Usarlas únicamente donde realmente ayudan a entender profundidad:

- sheet;
- dropdown;
- popover;
- dialog.

No usar `shadow` en cada card.

---

# 4. Border radius

Sistema corto:

```text
sm   6px
md   8px
lg   12px
xl   16px
```

Uso sugerido:

- inputs: 8px;
- botones: 8px;
- panels/cards: 12px;
- sheets/dialogs: 12–16px.

No usar radios enormes tipo 24–32px por toda la app.

REAL no debe sentirse como “bubble UI”.

---

# 5. Tipografía

Debe funcionar especialmente bien en móvil y para números.

Primera opción:

```text
Inter
```

Razones:

- excelente legibilidad;
- muy buena para UI;
- números claros;
- encaja con shadcn;
- no añade personalidad innecesaria.

Si el proyecto ya usa Geist, también es válida y no hace falta forzar un cambio.

## Jerarquía

### Page title

Desktop:

```text
24–28px
600
```

Mobile:

```text
22–24px
600
```

### Section title

```text
16–18px
600
```

### Body

```text
14–16px
400
```

Mobile no debería bajar sistemáticamente de 15–16px para información importante.

### Labels

```text
13–14px
500
```

### Texto secundario

```text
13–14px
color muted
```

### KPIs

```text
28–36px
500–600
```

Evitar pesos exagerados tipo 800.

---

# 6. Iconografía

Preferencia:

```text
Lucide
```

Encaja con shadcn y con la referencia visual.

Características:

- stroke fino;
- consistente;
- sin iconos rellenos pesados;
- sin mezclar distintas familias.

Tamaños habituales:

```text
16px
18px
20px
```

24px solo para casos concretos.

---

# 7. Color principal

El color institucional se utiliza como acento, no como superficie dominante.

Usos:

- botón primario;
- navegación activa;
- checkbox;
- radio;
- focus ring;
- algunos gráficos;
- links importantes.

No usar:

- sidebar completamente coloreada;
- header completamente coloreado;
- fondos intensos en todas las cards.

El hexadecimal definitivo puede fijarse después al validar branding/logo en contexto.

---

# 8. Colores semánticos

Muy controlados.

## Success

Para:

- al corriente;
- pago correcto;
- proceso terminado.

Verde apagado.

## Warning

Para:

- pendiente;
- próximo vencimiento;
- requiere atención.

Ámbar.

## Danger

Para:

- vencido;
- error;
- reversión;
- acción destructiva.

Rojo sobrio.

## Information

Azul o color primario suave.

Los estados nunca deben depender exclusivamente del color.

Correcto:

```text
● Vencido · $1,200
```

No:

```text
●
```

sin texto.

---

# 9. Login

El login debe ser probablemente la pantalla más simple de REAL.

## Desktop

Composición centrada.

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                    logo REAL                        │
│                                                     │
│                 Iniciar sesión                      │
│         Ingresa a tu cuenta de REAL                 │
│                                                     │
│            Correo                                   │
│            [____________________]                   │
│                                                     │
│            Contraseña                               │
│            [____________________]                   │
│                                                     │
│            [     Iniciar sesión     ]               │
│                                                     │
│             ¿Olvidaste tu contraseña?               │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

No incluir:

- ilustraciones decorativas;
- panel lateral de marketing;
- frases tipo SaaS;
- signup público.

---

# 10. Login mobile

Debe sentirse casi como una app nativa.

```text
┌───────────────────────┐
│                       │
│       logo REAL       │
│                       │
│    Iniciar sesión     │
│                       │
│ Correo                │
│ [_________________]   │
│                       │
│ Contraseña            │
│ [_________________]   │
│                       │
│ [ Iniciar sesión ]    │
│                       │
│ ¿Olvidaste tu         │
│ contraseña?           │
│                       │
└───────────────────────┘
```

Sin card exterior.

En móvil el formulario puede vivir directamente sobre el fondo.

Eso ayuda a que se sienta menos como página web y más como app.

---

# 11. Inputs del login

Altura:

```text
44–48px
```

No usar inputs pequeños.

Labels encima del campo.

Password con mostrar/ocultar.

Error inline:

```text
Correo o contraseña incorrectos
```

No usar toast para errores de login.

---

# 12. Botón primario

Altura:

```text
44px desktop
48px mobile
```

Full-width cuando la acción sea principal en formularios móviles.

Texto:

```text
Iniciar sesión
```

Evitar nombres vagos como:

```text
Entrar
Continuar
Submit
```

si no hay razón funcional.

---

# 13. Shell desktop

Inspirado directamente en la referencia principal.

```text
┌────────────────────────────────────────────────────────────┐
│ REAL                                            Usuario     │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│              │                                             │
│   Sidebar    │                  Main                       │
│              │                                             │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

REAL no necesita una topbar enorme.

---

# 14. Sidebar desktop

Ancho aproximado:

```text
220–240px
```

No 280–300px.

El contenido debe sentirse compacto.

## Parte superior

Logo REAL.

Debajo puede mostrarse:

```text
Colegio REAL
Ciclo 2026–2027
```

pero con mucha sutileza.

También puede mostrarse solo el logo y mover el ciclo al contenido principal.

## Items

Altura:

```text
36–40px
```

Cada item:

```text
[icon]  Alumnos
```

Estado activo:

- fondo gris suave;
- texto oscuro;
- posible acento institucional pequeño.

No usar un gran bloque de color.

---

# 15. Sidebar agrupada

Master podría verse así:

```text
GENERAL
Inicio

GESTIÓN
Alumnos
Matrícula
Pagos

ACADÉMICO
Académico

ANÁLISIS
Reportes

SISTEMA
Configuración
```

Los labels de grupo deben ser muy discretos.

Se pueden eliminar si generan ruido.

---

# 16. Bottom de sidebar

Al final puede aparecer:

```text
Ayuda
```

si existe funcionalmente.

Usuario:

```text
Fran López
Administrativo
```

Tocar abre menú:

```text
Perfil
Cambiar contraseña
Cerrar sesión
```

En Master:

```text
Christian
Master
```

---

# 17. Topbar desktop

Debe tener poco contenido.

Posible estructura:

```text
[Título de página]                          [buscar] [usuario]
```

Preferencia: que el título viva dentro del contenido principal.

Entonces la topbar podría ser simplemente:

```text
[Buscar alumno...]                             [usuario]
```

Incluso podría eliminarse en ciertas secciones.

---

# 18. Área de contenido desktop

No encerrar todo el contenido dentro de una card.

Correcto:

```text
Alumnos

Buscar...
Filtros

------------------------------------------------

Ana López
...
```

Evitar:

```text
┌────────────────────────────┐
│ Alumnos                    │
│ ┌────────────────────────┐ │
│ │ buscar                 │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ tabla                  │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

Ese patrón genera carditis.

---

# 19. Contenedor de página

Desktop:

```text
padding horizontal: 24–32px
padding vertical: 24px
```

En pantallas amplias:

```text
max-width: 1400–1500px
```

según módulo.

No hacer formularios absurdamente anchos.

---

# 20. Shell mobile

Es uno de los componentes más importantes.

```text
┌──────────────────────┐
│ título        acción │
├──────────────────────┤
│                      │
│                      │
│      contenido       │
│                      │
│                      │
├──────────────────────┤
│ Inicio Alumnos Pagos │
│           Más        │
└──────────────────────┘
```

---

# 21. Header mobile

Altura aproximada:

```text
52–56px
```

Sticky.

Fondo:

```text
white / casi white
```

Con `border-bottom` sutil cuando haga falta.

Ejemplo:

```text
Alumnos                 +
```

o:

```text
‹ Ana López             ···
```

No repetir logo en cada pantalla interna.

---

# 22. Bottom navigation

Altura útil:

```text
56–64px
+
safe-area-inset-bottom
```

Debe sentirse nativa.

Ejemplo Administrativo:

```text
Inicio
Alumnos
Pagos
Más
```

Cada elemento:

```text
icon
label
```

Nunca solo icono.

Estado activo:

- icono/texto más oscuro o color primario;
- sin fondos gigantes.

---

# 23. Bottom nav por rol

## Master

```text
Inicio
Alumnos
Pagos
Más
```

## Administrativo

```text
Inicio
Alumnos
Pagos
Más
```

## Profesor

```text
Inicio
Grupos
Captura
Más
```

## Tutor

```text
Inicio
Mis hijos
Pagos
Más
```

---

# 24. Drawer “Más”

Mobile.

Para navegación se prefiere Sheet lateral.

Ejemplo:

```text
REAL

Matrícula
Académico
Reportes
Configuración

----------------

Perfil
Cerrar sesión
```

Para roles simples:

```text
Calificaciones
Perfil
Cerrar sesión
```

---

# 25. Sheet lateral vs bottom sheet

Diferenciar usos.

## Sheet lateral

Para:

- navegación;
- detalle con bastante contenido;
- configuración.

## Bottom sheet

Para:

- acciones rápidas;
- selectores;
- filtros;
- registrar algo sencillo;
- menús contextuales en móvil.

Esto ayuda a mantener consistencia.

---

# 26. Overscroll

Reglas técnicas desde diseño.

Mobile shell:

```css
html,
body {
  overscroll-behavior: none;
}
```

No bloquear scroll indiscriminadamente.

Objetivo:

- evitar rebote extraño de toda la app;
- permitir scroll propio de sheets;
- mantener bottom nav estable;
- evitar scroll horizontal accidental.

Usar:

```text
100dvh
```

en vez de depender de `100vh`.

---

# 27. Safe areas

Bottom navigation:

```css
padding-bottom: env(safe-area-inset-bottom);
```

Header cuando corresponda:

```css
padding-top: env(safe-area-inset-top);
```

Especialmente importante si se usa como PWA o desde iPhone.

---

# 28. Touch targets

Mínimo:

```text
44 × 44px
```

Especialmente:

- botones;
- filas;
- icon buttons;
- tabs;
- checkbox/radio;
- acciones de menú.

Para acciones críticas y usuarios mayores, preferir:

```text
48px
```

---

# 29. Densidad mobile

Minimalismo no significa miniatura.

En móvil:

- texto legible;
- filas de 56–64px;
- botones grandes;
- buen padding;
- labels claros.

Esto es especialmente importante para usuarios mayores.

---

# 30. Tabs

Desktop:

```text
Resumen   Cuenta   Matrícula   Académico
```

Con underline o pill muy discreto.

Mobile:

- scroll horizontal;
- no permitir wrap a dos líneas;
- mantener el tab activo visible.

Ejemplo:

```text
Resumen  Cuenta  Matrícula  Más
```

---

# 31. Dropdown menus

Usarlos para acciones secundarias.

Ejemplo:

```text
···
```

abre:

```text
Editar
Ver historial
Descargar
----------------
Revertir
```

Las destructivas deben ir abajo y diferenciadas.

---

# 32. Toasts

Usar toasts con moderación.

Ejemplos:

```text
✓ Pago registrado
```

```text
✓ Calificación guardada
```

```text
! No se pudo guardar
```

Con icono.

Duración breve.

No usar párrafos largos.

---

# 33. Confirmaciones

No pedir confirmación para todo.

Sí para:

- reversión;
- cerrar captura;
- baja;
- desactivar acceso;
- cambios financieros sensibles.

No para:

- guardar observación;
- cambiar filtro;
- navegar;
- capturar algo editable.

---

# 34. Dialogs

Desktop:

- centrados;
- ancho 400–560px normalmente.

Mobile:

un dialog puede convertirse en bottom sheet o pantalla completa si necesita demasiado espacio.

No comprimir formularios largos dentro de modales pequeños.

---

# 35. Formularios

Desktop:

máximo dos columnas cuando los campos tengan sentido juntos.

Mobile:

una sola columna.

Ejemplo:

```text
Nombre
[____________]

Apellido
[____________]

Fecha de nacimiento
[____________]
```

No intentar mantener dos columnas en móvil.

---

# 36. Selects

Evitar selects HTML nativos inconsistentes si shadcn ofrece un patrón mejor.

En mobile, para listas largas:

- searchable command;
- sheet;
- combobox.

Ejemplo:

```text
Seleccionar alumno
```

puede abrir búsqueda completa.

---

# 37. Calendarios

DatePicker con Popover en desktop.

En móvil puede abrir:

- bottom sheet;
- calendar full width;
- input date si ofrece mejor experiencia.

No usar calendarios diminutos.

---

# 38. Checkbox, Radio y Switch

Checkbox para decisiones múltiples:

```text
☑ Enviar recibo por correo
```

Radio para decisiones exclusivas:

```text
○ Efectivo
○ Transferencia
○ Especie
```

Switch únicamente para estados claramente on/off.

No usar switch como sustituto de checkbox.

---

# 39. Badges

Usarlos con moderación.

Ejemplos:

```text
Activa
Al corriente
Vencido
Pendiente
```

Deben ser pequeños y suaves.

No usar grandes píldoras saturadas.

---

# 40. KPI component

Inspirado en la referencia financiera.

Desktop:

```text
Pagos hoy
$12,450
↑ 8% vs ayer
```

No necesita ser una tarjeta colorida.

También puede verse:

```text
Pagos hoy

$12,450
+8% vs ayer
```

dentro de un bloque blanco con borde ligero.

En mobile pueden apilarse 2×2 o desplazarse horizontalmente si tiene sentido.

---

# 41. Gráficas

Regla:

> La gráfica debe responder una pregunta.

No agregar gráficos solo porque se ven bonitos.

Preferencias:

- barras;
- línea;
- donut solo cuando realmente sea útil;
- stacked bars para distribución.

Evitar:

- 3D;
- gradients decorativos;
- demasiadas series;
- leyendas complejas.

---

# 42. Skeletons

Sí usar skeletons.

Deben imitar el layout real.

Ejemplo:

```text
██████████
██████

████████████████
█████████████
```

No usar spinner central de pantalla completa para todo.

---

# 43. Empty states

Simples.

Ejemplo:

```text
No hay pagos registrados

Los pagos aparecerán aquí cuando se registren.
```

Acción si aplica:

```text
Registrar pago
```

No usar ilustraciones gigantes.

---

# 44. Error states

Ejemplo:

```text
No pudimos cargar los alumnos.

Intentar de nuevo
```

No mostrar errores técnicos como:

```text
PostgREST Error 42501
```

---

# 45. Mobile tables

Regla:

> No intentar preservar tablas de desktop cuando dejan de ser legibles.

Desktop:

```text
Alumno | Grado | Estado | Cuenta
```

Mobile:

```text
Ana López
3º Primaria
Al corriente              ›
```

Esto debe aplicarse en casi toda REAL.

---

# 46. Search

Componente crítico para administrativos.

Desktop:

```text
⌕ Buscar alumno...
```

Mobile:

tocar icono o campo abre búsqueda dedicada.

Debe admitir:

- nombre;
- identificadores relevantes si aplica;
- resultados rápidos.

Visualmente puede inspirarse en `Command` de shadcn.

---

# 47. Acciones destructivas

Nunca botón rojo permanente si no es necesario.

Ejemplo:

```text
···
```

abre:

```text
Editar
Historial
────────────
Revertir pago
```

`Revertir pago` en rojo.

---

# 48. Loading de acciones

Botón:

```text
Registrar pago
```

pasa a:

```text
Registrando...
```

y queda disabled.

Evitar doble submit.

---

# 49. Sistema de spacing

Base 4px.

Escala conceptual:

```text
4
8
12
16
20
24
32
40
48
```

Usar mayormente:

```text
8
12
16
24
32
```

Esto ayuda a mantener consistencia en toda la app.

---

# 50. Breakpoints conceptuales

Sin volverlos dogma todavía:

```text
mobile      < 768
tablet      768–1024
desktop     > 1024
```

Lo importante es diseñar por comportamiento, no solo por ancho.

---

# 51. Comportamiento tablet

Tablet no debe ser simplemente desktop pequeño.

Puede usar:

- drawer en vez de sidebar;
- tablas simplificadas;
- layouts de dos columnas;
- contenido más cercano a mobile.

Especialmente útil para iPad.

---

# 52. Estado activo de navegación

Inspirado en la referencia principal:

```text
[ icon ] Alumnos
```

con fondo:

```text
gris muy claro
```

Texto:

```text
semibold
```

Puede existir un pequeño indicador institucional.

No usar fondos intensos.

---

# 53. Header de entidad

Para pantallas como alumno:

```text
← Alumnos

Ana López
3º Primaria · Grupo A
```

Desktop puede mostrar acciones a la derecha:

```text
Registrar pago     ···
```

Mobile:

```text
‹ Ana López       ···
```

con el contexto debajo.

---

# 54. Decisión importante sobre mobile

No hacer que cada acción abra siempre un modal.

En móvil, cuando una tarea sea principal:

> debe convertirse en una pantalla.

Ejemplo:

Registrar pago puede empezar desde un bottom sheet si es extremadamente corto, pero si necesita varios campos o confirmaciones, mejor pantalla dedicada.

Esto mejora:

- teclado;
- accesibilidad;
- scroll;
- claridad.

---

# 55. Resultado visual esperado

La combinación final debería sentirse como:

```text
Imagen 1
+
estructura financiera clara de Imagen 3
+
visualizaciones amigables de Imagen 2
+
simplicidad del login de Imagen 4
+
patrones shadcn
+
mobile UX cercana a una app nativa
```

Sin copiar literalmente ninguna referencia.

---

# 56. Qué queda cerrado con F3

Con este bloque quedan definidas las bases de:

- login;
- shell desktop;
- shell mobile;
- sidebar;
- bottom nav;
- topbar;
- drawers;
- sheets;
- dialogs;
- toasts;
- inputs;
- radios;
- checkbox;
- tabs;
- calendars;
- búsqueda;
- KPIs;
- gráficas;
- tablas responsive;
- spacing;
- tipografía;
- radios;
- bordes;
- comportamiento mobile.

---

# 57. Siguiente bloque recomendado

**F4 — Diseño pantalla por pantalla del núcleo administrativo**

Flujo inicial:

```text
Inicio Administrativo
→ Buscar alumno
→ Ficha de alumno
→ Registrar pago
→ Estado de cuenta
```

Este flujo debe ser el primer piloto visual serio para validar que el sistema funciona extremadamente bien tanto en móvil como en desktop.
