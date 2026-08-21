# REAL — UI Implementation Contract

**Estado:** Canónico para implementación  
**Alcance:** Toda la aplicación REAL  
**Propósito:** Convertir el blueprint F2–F9 en reglas de implementación transversales, concretas y reutilizables para Codex y cualquier colaborador técnico.

---

## 0. Jerarquía de autoridad

Este documento no redefine reglas de negocio ni sustituye los handoffs funcionales.

La prioridad de interpretación es:

1. **Reglas de negocio y arquitectura DB ya cerradas**
2. **Permisos, RLS, RPCs y contratos de datos existentes**
3. **Este `ui-implementation-contract.md` para decisiones transversales de UI/UX**
4. **F2–F9 para el detalle específico de cada módulo**
5. **Decisiones locales de implementación**

Si aparece una contradicción real entre implementación y reglas cerradas, **no improvisar**. Detener esa parte, describir el conflicto y pedir decisión antes de alterar reglas, DB, RLS, Auth, navegación principal o flujo funcional.

---

# 1. Principio general

REAL debe sentirse:

- limpio;
- muy blanco;
- moderno;
- rápido;
- mobile-first;
- consistente;
- predecible;
- accesible;
- sobrio;
- más cercano a una aplicación financiera moderna que a software escolar tradicional.

La complejidad debe vivir en las reglas y los datos, **no en la experiencia del usuario**.

La referencia visual principal define:

- abundancia de blanco;
- fondo gris casi blanco;
- jerarquía por spacing;
- bordes finos;
- tipografía limpia;
- densidad moderada;
- datos financieros compactos;
- poca elevación;
- pocas superficies coloreadas.

No copiar literalmente la cantidad de cards o paneles de la referencia.

---

# 2. Stack visual canónico

Usar como base:

- **shadcn/ui**
- **Base UI**
- preset **Nova**
- **Tailwind CSS v4**
- **Geist**
- **Lucide**

No introducir una segunda librería de componentes equivalente sin una razón técnica clara.

No mezclar familias de iconos.

---

# 3. Regla principal de componentes

## 3.1 Primero shadcn

Antes de construir un primitive nuevo, comprobar si shadcn ya resuelve el patrón.

Preferir componentes shadcn para:

- Button
- Input
- Label
- Textarea
- Checkbox
- RadioGroup
- Switch
- Select
- Combobox / Command
- Tabs
- Sheet
- Dialog
- DropdownMenu
- Popover
- Calendar
- Badge
- Separator
- Skeleton
- ScrollArea
- Tooltip
- Progress
- Sonner / Toast

## 3.2 No duplicar primitives

No crear wrappers o componentes propios que solo renombren un primitive sin aportar comportamiento de REAL.

Evitar:

```text
RealButton
CustomInput
AdminDialog
MySheet
CustomSelect
```

si únicamente replican shadcn.

## 3.3 Componentes propios

Los componentes propios deben representar:

- conceptos del dominio;
- composición reutilizable;
- comportamiento transversal específico de REAL.

Ejemplos válidos:

```text
StudentRow
FinancialStatus
AccountSummary
PaymentRow
PaymentDetail
EnrollmentRow
EnrollmentStepper
GradeEditor
CaptureStatus
ChildSelector
ReportKPI
```

## 3.4 Composición antes que duplicación

Preferir un componente base reutilizable con variantes antes que crear:

```text
AdminStudentRow
TeacherStudentRow
TutorStudentRow
```

si pueden compartir una misma base.

---

# 4. Tokens y estilos

Centralizar:

- colores;
- radius;
- spacing;
- sombras;
- tipografía;
- alturas;
- z-index;
- motion.

No hardcodear variaciones visuales arbitrarias por pantalla.

## 4.1 Superficies

### Fondo general

Gris extremadamente suave, casi blanco.

### Superficie principal

Blanco.

### Superficie secundaria

Gris tenue para:

- hover;
- selected;
- disabled;
- bloques secundarios;
- navegación activa.

## 4.2 Bordes

Preferencia:

```text
1px
gris muy claro
```

El borde debe separar más que la sombra.

## 4.3 Sombras

Usar mínimamente y solo cuando comuniquen profundidad:

- Sheet
- Dialog
- Dropdown
- Popover
- Toast

No aplicar `shadow` por defecto a todas las cards.

## 4.4 Radius

Sistema compacto.

Referencia:

```text
sm    6px
md    8px
lg   12px
xl   16px
```

Evitar apariencia bubble UI.

---

# 5. Tipografía

Fuente canónica:

```text
Geist
```

No cambiar a otra fuente salvo problema real.

Jerarquía aproximada:

```text
Page title       22–28px / 600
Section title    16–18px / 600
Body             14–16px / 400
Labels           13–14px / 500
Muted            13–14px
KPI              28–36px / 500–600
```

En móvil no reducir texto importante solo para hacerlo caber.

Adaptar layout antes que miniaturizar tipografía.

---

# 6. Spacing

Base:

```text
4px
```

Escala preferida:

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

Usar principalmente:

```text
8
12
16
24
32
```

La consistencia de spacing importa más que ajustes locales arbitrarios.

---

# 7. Responsive

La misma lógica y los mismos datos pueden tener composiciones distintas.

No diseñar desktop y luego simplemente encogerlo.

## 7.1 Mobile

Referencia principal de QA:

```text
390px
```

Preferir:

- una columna;
- listas;
- pantallas dedicadas;
- bottom navigation;
- headers compactos;
- tabs scrollables;
- sheets full-screen para tareas;
- targets amplios;
- CTA accesible con una mano.

## 7.2 Tablet

Referencia:

```text
768px
```

Puede usar:

- dos columnas;
- drawer;
- sheet amplio;
- tabla simplificada;
- composición híbrida.

No asumir desktop completo.

## 7.3 Desktop

Referencia principal de QA:

```text
1440px
```

Preferir:

- sidebar;
- tablas cuando ayudan a comparar;
- sheets contextuales;
- más información simultánea;
- formularios centrados;
- contenido máximo razonable.

## 7.4 Tablas

Desktop:

```text
tabla ligera
```

Mobile:

```text
filas / cards planas
```

No usar scroll horizontal como solución principal.

---

# 8. Shell mobile

Debe considerar:

- `100dvh`;
- safe areas;
- header;
- contenido;
- bottom nav;
- scroll correcto;
- teclado móvil;
- overscroll.

No permitir scroll horizontal accidental.

Bottom navigation no debe tapar contenido.

Puede ocultarse temporalmente en flujos de tarea completa cuando distraiga.

---

# 9. Safe areas

Aplicar cuando corresponda:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
```

Especialmente en:

- mobile header;
- bottom nav;
- sticky actions;
- sheets full-screen;
- dialogs adaptados a móvil.

---

# 10. Touch targets

Mínimo:

```text
44 × 44px
```

Preferencia para acciones importantes:

```text
48px
```

Aplica a:

- botones;
- icon buttons;
- filas;
- tabs;
- checkbox;
- radio;
- controles de navegación.

---

# 11. Sheets — regla canónica

Esta sección prevalece sobre recomendaciones más abiertas de F2–F9.

## 11.1 Desktop

Un Sheet contextual debe abrir normalmente desde la derecha y ocupar aproximadamente:

```text
50% del viewport
```

No debe sentirse como una mini-card estrecha ni como una página completa.

Debe:

- tener header claro;
- permitir scroll interno;
- mostrar acción primaria;
- mostrar Cancelar/Cerrar cuando aplique;
- preservar contexto de la pantalla detrás.

Si la tarea necesita más espacio del razonable, convertirla en pantalla dedicada.

## 11.2 Tablet

Usar aproximadamente:

```text
60–75% del viewport
```

según contenido.

## 11.3 Mobile

Los Sheets de tarea o detalle importante se comportan como:

```text
full-screen
```

Deben incluir:

- header propio;
- Regresar o Cerrar;
- título;
- acción principal;
- Cancelar cuando corresponda;
- scroll interno;
- safe area;
- correcto comportamiento con teclado.

No usar una hoja estrecha lateral en teléfono para formularios o detalle relevante.

## 11.4 Sheet vs pantalla

Si existe:

- formulario largo;
- múltiples secciones;
- stepper;
- tarea primaria;
- captura sensible;
- mucho teclado;

preferir pantalla dedicada.

Ejemplos:

```text
Registrar pago mobile     → pantalla
Matrícula                  → pantalla
Captura de calificación    → pantalla
Detalle rápido de pago     → Sheet
Filtros                    → Sheet
Edición corta              → Sheet
```

---

# 12. Bottom sheets

Reservar principalmente para:

- filtros;
- selectores;
- acciones rápidas;
- menús contextuales;
- decisiones breves.

Deben:

- tener scroll propio;
- respetar teclado;
- bloquear el fondo;
- poder cerrarse con gesto solo cuando no haya cambios sensibles.

No usar bottom sheet largo como sustituto automático de una pantalla.

---

# 13. Dialogs

Usar para:

- confirmaciones;
- decisiones pequeñas;
- acciones sensibles breves.

Desktop:

```text
aprox. 400–560px
```

Mobile:

si el contenido deja de ser cómodo, adaptar a full-screen o Sheet.

No usar Dialog para:

- matrícula completa;
- registrar pago largo;
- flujos multipaso;
- formularios densos.

---

# 14. Toasts — regla canónica

La posición global de los toasts en REAL es:

```text
top-center
```

Deben sentirse como una notificación de celular.

## 14.1 Apariencia

- centrados horizontalmente;
- debajo de safe area/header;
- ancho contenido;
- fondo limpio;
- borde/sombra sutil;
- icono + mensaje corto;
- sin párrafos;
- sin grandes bloques de color.

Ejemplos:

```text
✓ Pago registrado
✓ Calificación guardada
✓ Matrícula actualizada
! No pudimos guardar
```

## 14.2 Comportamiento

- duración breve;
- no tapar navegación;
- no tapar CTA sticky;
- evitar acumulaciones largas;
- no usar toast para validación de campos;
- no usar toast como sustituto de una confirmación importante.

## 14.3 Confirmación principal

Un flujo sensible puede tener:

```text
pantalla de confirmación
+
toast al salir
```

Ejemplo:

```text
Pago registrado
```

La confirmación principal no debe reemplazarse solo por toast.

---

# 15. Navegación atrás y cerrar

Toda vista contextual debe tener una salida inequívoca.

## Mobile

Preferir:

```text
‹ Regresar
```

o:

```text
Cerrar
```

según contexto.

## Formularios

Si hay cambios no guardados y salir implicaría perderlos:

```text
¿Salir sin guardar?

Los cambios se perderán.

[Seguir editando]
[Salir]
```

No mostrar si no hubo cambios.

---

# 16. Botones

Acciones principales deben usar texto explícito.

Preferir:

```text
Registrar pago
Confirmar matrícula
Guardar calificación
Revertir pago
```

Evitar:

```text
Aceptar
Continuar
Submit
```

cuando puede nombrarse la acción.

En móvil, acciones principales pueden ser full-width.

Durante submit:

```text
Registrar pago
→ Registrando...
```

Reglas:

- disabled;
- ancho estable;
- evitar doble submit;
- no marcar éxito antes de confirmación backend.

---

# 17. Acciones destructivas

No mostrarlas permanentemente salvo que la pantalla exista para esa acción.

Preferir:

```text
···
```

y destructivas al final.

Ejemplo:

```text
Editar
Ver historial
────────────
Revertir pago
```

La acción destructiva debe:

- usar texto completo;
- usar rojo sobrio;
- pedir confirmación cuando corresponda;
- nunca depender solo de icono.

---

# 18. Formularios

## Desktop

Máximo dos columnas cuando los campos se relacionen claramente.

## Mobile

Una sola columna.

Todos los inputs deben tener label visible.

No depender de placeholder como label.

Campos opcionales pueden indicar:

```text
Opcional
```

sin llenar la UI de asteriscos.

---

# 19. Inputs y teclado móvil

Usar tipo/inputmode correcto.

Ejemplos:

```text
email
tel
numeric
decimal
```

Probar específicamente teclado abierto en:

- login;
- pagos;
- matrícula;
- preinscripción;
- calificaciones;
- correcciones.

El teclado no debe tapar:

- input activo;
- CTA;
- navegación necesaria.

---

# 20. Selectores

Para pocas opciones:

- RadioGroup;
- Select.

Para listas largas:

- Combobox;
- Command;
- búsqueda dedicada;
- Sheet en móvil.

No usar selects nativos inconsistentes si el patrón shadcn resuelve mejor el caso.

---

# 21. Tabs

Desktop:

```text
tabs horizontales discretos
```

Mobile:

```text
scroll horizontal
```

Reglas:

- no wrap;
- mantener activo visible;
- preservar contexto;
- no transformar todos los tabs en pills grandes.

---

# 22. Search

La búsqueda administrativa debe sentirse inmediata.

Preferir:

```text
⌕ Buscar alumno...
```

Debounce corto cuando aplique.

No exigir botón “Buscar” si no es necesario.

Al entrar a detalle y volver, preservar cuando sea razonable:

- búsqueda;
- filtros;
- scroll.

---

# 23. Filtros

Desktop:

- barra compacta;
- popover;
- Sheet si son numerosos.

Mobile:

```text
Sheet / bottom sheet
```

Mostrar cantidad cuando existan filtros activos:

```text
Filtros · 2
```

Ofrecer:

```text
Limpiar
```

---

# 24. Loading

## Pantalla

Usar Skeleton.

Debe imitar el layout final.

No usar spinner central bloqueante como patrón principal.

## Parcial

Mantener:

- shell;
- header;
- navegación;
- contexto.

Solo recargar el bloque afectado.

## Acción

Mostrar texto:

```text
Guardando...
Confirmando...
Registrando...
```

No producir saltos de layout.

---

# 25. Empty states

Simples y funcionales.

Ejemplo:

```text
No hay pagos registrados hoy.

Los pagos aparecerán aquí cuando se registren.
```

Mostrar acción solo si realmente existe una acción útil.

No usar ilustraciones grandes.

---

# 26. Errores

Nunca mostrar al usuario:

```text
PostgREST
RLS
SQLSTATE
JWT
constraint
RPC
500
```

Traducir a lenguaje funcional.

## Campo

Mostrar error inline.

## Acción global

Toast o bloque contextual.

## Carga

```text
No pudimos cargar esta información.

[Intentar de nuevo]
```

Preservar inputs, filtros y selecciones cuando sea posible.

---

# 27. Sesión y permisos

No usar disabled para representar falta de permiso.

Si el usuario no puede ejecutar una acción por rol:

```text
ocultarla
```

El backend sigue siendo autoridad.

Si entra por URL a un contexto no autorizado, redirigir según el contrato de Auth existente o mostrar un estado funcional apropiado.

No modificar Auth/RLS durante implementación UI sin aprobación.

---

# 28. Auto-save y optimistic UI

## No auto-save en operaciones sensibles

No usar auto-save en:

- pagos;
- matrícula;
- configuración financiera;
- correcciones;
- estados;
- calificaciones.

## Optimistic UI

No declarar éxito de:

- pago;
- matrícula;
- reversión;
- corrección;
- calificación;

hasta que backend confirme.

Puede optimizarse la percepción de velocidad sin falsear éxito.

---

# 29. Rendimiento y uso de recursos

REAL debe mantenerse ligero y rápido.

Principios:

- minimizar round-trips;
- evitar fetches duplicados;
- traer solo columnas necesarias;
- no usar `SELECT *` indiscriminadamente;
- no descargar datasets completos para filtrar en cliente;
- no hacer polling constante;
- no habilitar Realtime por defecto;
- no crear API routes innecesarias;
- no añadir dependencias grandes sin valor claro;
- no precargar módulos completos innecesariamente;
- mantener bundle y render razonables.

Usar Server Components, Server Actions, clientes Supabase y RPCs existentes cuando corresponda.

No crear una capa:

```text
browser → API route → Supabase
```

para cada operación sin necesidad.

---

# 30. DB ↔ app

La DB existente es autoridad para:

- integridad;
- permisos;
- transacciones;
- reglas financieras;
- derivaciones críticas.

La app es responsable de:

- navegación;
- presentación;
- interacción;
- responsive;
- estados;
- composición.

## 30.1 Mutaciones sensibles

Preferir:

```text
App → RPC transaccional existente
```

No reimplementar una operación financiera crítica con múltiples inserts/updates separados desde la UI.

## 30.2 Lecturas

Preferir:

- vistas;
- funciones canónicas;
- RPCs;
- consultas específicas.

No duplicar lógica derivada crítica en cliente.

---

# 31. Motion

Animaciones mínimas.

Permitidas principalmente para:

- Sheet;
- Dialog;
- Dropdown;
- Toast;
- indicador de tab.

Duración breve.

No usar animaciones decorativas.

Respetar:

```text
prefers-reduced-motion
```

---

# 32. Z-index

Mantener una escala consistente para:

```text
header
bottom nav
dropdown
sheet
dialog
toast
```

No resolver conflictos agregando valores locales arbitrarios.

---

# 33. Estados y badges

Todos los estados deben mostrar texto.

Ejemplos:

```text
Activa
Pendiente
Baja
Al corriente
Vencido
Captura abierta
Captura cerrada
```

El color solo refuerza.

No convertir cada dato en badge.

---

# 34. Montos y fechas

Montos:

```text
$0
$950
$12,450
$184,300
$1,250,000
```

Negativos:

```text
-$1,200
```

No:

```text
$-1,200
```

Fechas:

```text
20 ago 2026
```

Con hora:

```text
20 ago 2026 · 10:42
```

Mantener formato consistente en español.

---

# 35. Contenido largo

Probar:

- nombres largos;
- tutores largos;
- observaciones;
- referencias;
- categorías;
- montos grandes.

En mobile:

- nombres pueden wrap a dos líneas;
- metadata debajo;
- acción permanece visible.

No truncar montos ni estados.

---

# 36. Accesibilidad

Obligatorio:

- focus visible;
- labels;
- aria-label en icon buttons;
- contraste suficiente;
- targets de 44px;
- navegación por teclado en desktop;
- no depender del color;
- dialogs y sheets con manejo correcto de focus;
- gráficas con equivalente textual o numérico;
- acciones críticas con texto.

---

# 37. Gráficas

Toda gráfica debe responder una pregunta.

Preferir:

- bar;
- line;
- stacked bar;
- donut solo cuando aporta.

Evitar:

- 3D;
- radar;
- demasiadas series;
- gradients decorativos.

En móvil debe funcionar por tap, no depender de hover.

Siempre mostrar datos numéricos equivalentes.

---

# 38. Carditis

No encerrar cada bloque en una card.

Priorizar:

- jerarquía tipográfica;
- spacing;
- separadores;
- fondo;
- agrupación natural.

Usar una card/superficie solo cuando:

- realmente agrupa;
- necesita contexto propio;
- mejora escaneo;
- comunica una unidad funcional.

---

# 39. Referencia visual

Usar `docs/ux_ui/desing-inspo.png` como referencia canónica de:

- proporción de blancos;
- densidad;
- bordes;
- spacing;
- jerarquía;
- sobriedad;
- composición financiera.

No copiar:

- marca;
- contenido;
- cantidad exacta de paneles;
- estructura literal.

La referencia inspira el lenguaje visual, no el layout completo.

---

# 40. Fuente específica por módulo

No leer F2–F9 completos en cada tarea.

Usar solo lo necesario:

```text
Navegación global / rutas        → F2
Login / shell / visual           → F3
Admin / alumnos / cuenta         → F4
Matrícula / preinscripción       → F5
Pagos / configuración financiera → F6
Académico / Profesor             → F7
Tutor / Reportes                 → F8
Estados / QA transversal         → F9
```

Este documento debe leerse como contrato transversal.

---

# 41. Orden de implementación recomendado

## UI-1 — Fundaciones

```text
tokens
tipografía
componentes shadcn necesarios
toast global
dialog
sheet
```

## UI-2 — Shell

```text
login
sidebar
mobile header
bottom nav
user menu
```

## UI-3 — Primer vertical slice

```text
Login
→ Inicio Administrativo
→ Buscar alumno
→ Ficha
→ Estado de cuenta
→ Registrar pago
→ Confirmación
```

Validar en:

```text
390px
1440px
```

## UI-4 en adelante

Continuar por módulos según F5–F8.

---

# 42. Workflow de implementación

Preferir un flujo secuencial y vertical.

Por defecto:

```text
1 tarea vertical
→ implementar
→ validar
→ build/lint/QA proporcional
→ revisión
→ commit manual
→ siguiente tarea
```

No usar múltiples worktrees/subagentes por defecto.

Usar worktree únicamente cuando exista una razón clara:

- experimento aislado;
- refactor grande;
- trabajo verdaderamente independiente;
- reducción real de riesgo.

Evitar paralelizar tareas pequeñas si eso duplica lectura, QA, contexto y merges.

---

# 43. Autonomía del agente

El agente puede decidir:

- organización interna de componentes;
- hooks;
- composición React;
- separación server/client;
- pequeñas optimizaciones;
- refactors locales;
- nombres internos;
- reutilización;
- detalles visuales menores dentro de este contrato.

El agente no puede cambiar sin aprobación:

- reglas de negocio;
- modelo de datos;
- RLS;
- permisos;
- RPCs;
- Auth;
- roles;
- navegación principal;
- flujos funcionales cerrados;
- semántica financiera;
- alcance de cada rol.

Si una limitación técnica real exige cambiar algo anterior, debe:

1. detener esa parte;
2. explicar el conflicto;
3. proponer opciones;
4. pedir decisión.

---

# 44. QA mínimo por pantalla

Toda pantalla relevante debe revisarse en:

```text
390px
768px
1440px
```

Comprobar:

```text
[ ] no overflow horizontal
[ ] tabs no wrap
[ ] mobile no comprime tablas
[ ] keyboard no tapa CTA
[ ] sheet/dialog funciona
[ ] safe areas correctas
[ ] focus visible
[ ] loading
[ ] empty
[ ] error
[ ] permisos
[ ] nombres largos
[ ] montos grandes
[ ] back/refresh/direct URL
```

---

# 45. Criterios de rechazo

Revisar/rediseñar si:

- parece software escolar antiguo;
- parece dashboard template genérico;
- hay demasiadas cards;
- hay demasiados colores;
- mobile necesita zoom;
- hay scroll horizontal;
- acción principal es difícil de identificar;
- acciones críticas dependen solo de icono;
- hay formularios largos dentro de modales pequeños;
- se pierde contexto al volver;
- se introduce lógica de negocio nueva en UI.

---

# 46. Criterios de aceptación

REAL debe permitir:

- entender estado rápidamente;
- encontrar acciones sin entrenamiento;
- cambiar de módulo con fluidez;
- abrir/cerrar sheets con rapidez;
- usar teléfono con una mano;
- completar formularios con teclado abierto;
- navegar atrás sin perder contexto razonable;
- operar sin conocer la arquitectura interna.

La interfaz debe sentirse:

```text
limpia
rápida
sobria
responsive
consistente
moderna
```

---

# 47. Cierre

Este documento define el contrato transversal de implementación visual de REAL.

F2–F9 siguen siendo la fuente de detalle por módulo, pero este archivo fija de forma canónica:

- uso de shadcn;
- comportamiento de componentes;
- sheets;
- dialogs;
- toasts;
- responsive;
- accesibilidad;
- performance;
- DB ↔ app;
- autonomía del agente;
- workflow;
- QA.

Durante implementación, los refinamientos visuales están permitidos.

Los rediseños de arquitectura, navegación, reglas de negocio o flujos cerrados no lo están sin aprobación.
