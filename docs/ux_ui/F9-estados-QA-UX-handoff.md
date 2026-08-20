# F9 — Estados transversales, QA UX y handoff de implementación

## Objetivo

Cerrar la etapa F de diseño/UX/UI de REAL definiendo los comportamientos transversales que deben repetirse de forma consistente en toda la aplicación y dejando un handoff claro para implementación.

Este bloque no redefine reglas de negocio ni modifica arquitectura de base de datos.

Su función es evitar que, durante programación, cada módulo resuelva de forma distinta:

- loading;
- errores;
- empty states;
- permisos;
- confirmaciones;
- toasts;
- sheets;
- dialogs;
- responsive;
- teclado móvil;
- safe areas;
- overscroll;
- accesibilidad;
- estados extremos;
- contenido largo;
- edge cases;
- inventario de componentes;
- rutas;
- prioridades de implementación.

Este documento cierra F y debe servir como referencia transversal para F2–F8.

---

# 1. Principio rector

REAL debe sentirse como una sola aplicación.

Eso significa que una misma situación debe resolverse siempre con el mismo patrón.

Ejemplo:

```text
Guardar
↓
loading
↓
éxito
↓
toast
```

no debe convertirse en:

```text
módulo A → toast
módulo B → alert()
módulo C → modal
módulo D → redirección silenciosa
```

La consistencia debe ser más importante que la creatividad local de cada pantalla.

---

# 2. Estados transversales obligatorios

Toda pantalla o acción relevante debe contemplar al menos:

```text
Loading
Éxito
Error
Vacío
Sin permiso
Disabled
Confirmación
Datos parciales
Contenido largo
Mobile
Desktop
```

No implementar únicamente el “happy path”.

---

# 3. Loading de pantalla

Preferencia:

```text
Skeleton
```

No:

```text
spinner centrado bloqueando toda la aplicación
```

El skeleton debe parecerse a la estructura final.

Ejemplo listado:

```text
████████████████
████████████
----------------
████████████████
██████████
----------------
████████████████
```

---

# 4. Loading parcial

Cuando solo una sección cambia:

- mantener shell;
- mantener header;
- mantener navegación;
- cargar únicamente el bloque afectado.

Ejemplo:

```text
Estado de cuenta
```

puede mantener nombre del alumno y tabs mientras carga el historial financiero.

---

# 5. Loading de acciones

Botones deben cambiar de:

```text
Registrar pago
```

a:

```text
Registrando...
```

o:

```text
Guardar
→ Guardando...
```

Reglas:

- botón disabled;
- evitar doble submit;
- conservar ancho;
- no mover layout;
- mostrar progreso textual.

---

# 6. No usar loaders infinitos silenciosos

Si una acción supera un tiempo razonable, debe seguir mostrando estado comprensible.

No hacer que el usuario piense que no pasó nada.

---

# 7. Empty states

Los estados vacíos deben:

- explicar qué falta;
- evitar dramatismo;
- ofrecer acción solo si existe una acción útil.

Ejemplo:

```text
No hay pagos registrados hoy.
```

Acción:

```text
Registrar pago
```

---

# 8. Empty state sin acción

Ejemplo:

```text
No hay calificaciones disponibles para este periodo.
```

No agregar un botón artificial.

---

# 9. Error de carga

Patrón:

```text
No pudimos cargar esta información.

[Intentar de nuevo]
```

No mostrar detalles internos.

---

# 10. Error de acción

Ejemplo:

```text
No pudimos registrar el pago.

Revisa la información e inténtalo de nuevo.
```

Preservar:

- monto;
- método;
- referencia;
- observación;
- selecciones;
- filtros.

No resetear el formulario.

---

# 11. Error inline

Cuando el error corresponde a un campo:

```text
Monto
[$_______]

Ingresa un monto válido.
```

No usar toast para errores de validación de campo.

---

# 12. Error global

Toast o bloque superior cuando no corresponde a un campo específico.

Ejemplo:

```text
No pudimos guardar los cambios.
```

---

# 13. Mensajes técnicos

Nunca mostrar directamente:

```text
PostgREST
RLS
SQLSTATE
RPC failed
constraint violation
500
JWT expired
```

El usuario debe ver lenguaje funcional.

---

# 14. Sesión expirada

Patrón:

```text
Tu sesión terminó.

Inicia sesión nuevamente para continuar.
```

CTA:

```text
Iniciar sesión
```

Si hay datos no guardados, intentar preservarlos cuando sea viable.

---

# 15. Sin permiso

No mostrar acciones que el rol no puede ejecutar.

Si el usuario llega a una ruta sin autorización:

```text
No tienes acceso a esta sección.
```

CTA:

```text
Volver
```

No mostrar error técnico.

---

# 16. Disabled

Un botón disabled debe usarse cuando:

- falta información requerida;
- la acción está procesándose;
- el estado actual impide la acción.

No usar disabled como sustituto de permisos.

Si el usuario no puede hacer algo por rol, preferir ocultarlo.

---

# 17. Tooltip de disabled

Solo si aporta contexto.

Ejemplo:

```text
Captura cerrada
```

No usar tooltips en móvil como única explicación.

---

# 18. Confirmaciones

Requerir confirmación para acciones con consecuencias importantes:

- reversión de pago;
- baja;
- no continúa;
- cerrar captura;
- desactivar acceso;
- cambios financieros sensibles;
- abandonar formulario con cambios no guardados.

---

# 19. Acciones sin confirmación

No confirmar:

- navegar;
- buscar;
- filtrar;
- cambiar tab;
- guardar observación editable;
- seleccionar alumno;
- abrir detalle.

Evitar fatiga de confirmaciones.

---

# 20. Dialog de confirmación

Estructura:

```text
Título claro

Explicación breve de la consecuencia.

[Cancelar]
[Confirmar acción]
```

Ejemplo:

```text
Revertir pago

Se revertirá el pago de $1,200 registrado a Ana López.

[Cancelar]
[Revertir pago]
```

---

# 21. Acción destructiva

Botón destructivo:

- rojo sobrio;
- texto explícito;
- nunca solo icono.

No usar:

```text
Aceptar
```

Usar:

```text
Revertir pago
Dar de baja
Cerrar captura
```

---

# 22. Toasts

Usar para confirmaciones breves.

Ejemplos:

```text
✓ Pago registrado
✓ Calificación guardada
✓ Matrícula actualizada
✓ Recibo enviado
```

Errores:

```text
! No pudimos guardar
```

---

# 23. Duración de toast

Debe ser suficiente para lectura breve.

No usar textos largos.

Si requiere explicación, usar pantalla/dialog.

---

# 24. Posición de toast

Desktop:

- esquina superior o inferior consistente.

Mobile:

- no tapar bottom navigation;
- no tapar CTA sticky;
- respetar safe area.

La posición debe fijarse globalmente.

---

# 25. Sheets

Usar para:

- filtros;
- navegación móvil;
- detalle rápido;
- acciones secundarias;
- edición corta.

No usar Sheet para formularios largos por defecto.

---

# 26. Bottom sheet

Preferido en móvil para:

- filtros;
- selectores;
- acciones rápidas;
- menús contextuales.

Debe:

- permitir swipe/close si no hay cambios sensibles;
- respetar teclado;
- tener scroll propio.

---

# 27. Side sheet

Preferido para:

- navegación;
- detalle amplio;
- configuración contextual;
- desktop.

---

# 28. Dialogs

Usar para:

- confirmaciones;
- acciones pequeñas;
- consecuencias importantes.

No usar para:

- matrícula completa;
- registro largo de pago;
- formularios multipaso.

---

# 29. Dropdown menus

Usar para acciones secundarias.

Ejemplo:

```text
···
```

abre:

```text
Editar
Ver historial
Descargar
────────────
Revertir
```

---

# 30. Menú `···`

Reglas:

- solo acciones del objeto actual;
- destructivas al final;
- labels completos;
- iconos opcionales;
- no más opciones de las necesarias.

---

# 31. Search

La búsqueda debe sentirse inmediata.

Patrones:

```text
⌕ Buscar alumno...
```

```text
⌕ Buscar pago...
```

Mobile puede abrir búsqueda dedicada.

---

# 32. Estado de búsqueda

Mientras escribe:

- mostrar resultados rápidos;
- conservar input;
- permitir cerrar;
- no recargar toda la pantalla.

---

# 33. Sin resultados

```text
No encontramos resultados para “Ana P.”
```

No borrar la búsqueda.

---

# 34. Debounce

La implementación puede usar debounce corto.

La UX no debe sentirse lenta ni exigir botón “Buscar” si no hace falta.

---

# 35. Filtros

Regla:

> Los filtros secundarios no deben ocupar permanentemente demasiado espacio.

Desktop:

- barra compacta;
- o botón `Filtros`.

Mobile:

- bottom sheet.

---

# 36. Filtros activos

Mostrar estado visible:

```text
Filtros · 2
```

o chips discretos:

```text
Primaria ×
Activa ×
```

No saturar.

---

# 37. Limpiar filtros

Siempre disponible cuando haya filtros activos:

```text
Limpiar
```

---

# 38. Preservación de filtros

Al entrar al detalle y volver:

- conservar búsqueda;
- conservar filtros;
- conservar posición de scroll cuando sea razonable.

Esto es importante en operaciones repetitivas.

---

# 39. Navegación atrás

Debe devolver al contexto anterior.

Ejemplo:

```text
Alumnos
↓
Ana López
↓
Atrás
```

debe volver a la lista filtrada, no reiniciar el módulo.

---

# 40. Deep links

Las pantallas principales deben poder abrirse directamente por URL cuando corresponda.

Ejemplo:

```text
/alumnos/[id]
/pagos/[id]
```

Sin depender de haber navegado previamente.

---

# 41. Mobile shell

Debe mantener:

- header;
- contenido;
- bottom navigation;
- safe area;
- altura dinámica.

Usar:

```text
100dvh
```

No depender exclusivamente de:

```text
100vh
```

---

# 42. Safe areas

Aplicar:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
```

especialmente en:

- header;
- bottom nav;
- CTA sticky;
- sheets.

---

# 43. Overscroll

Objetivo:

evitar sensación de página web rebotando detrás de la app.

Reglas:

- controlar overscroll del shell;
- permitir scroll natural del contenido;
- impedir scroll horizontal accidental;
- bloquear fondo cuando Sheet/Dialog esté abierto.

---

# 44. Teclado móvil

Debe probarse específicamente en:

- Login;
- registrar pago;
- preinscripción;
- matrícula;
- calificaciones;
- correcciones.

El teclado no debe:

- tapar CTA;
- cortar input activo;
- mover bottom nav de forma errática.

---

# 45. CTA sticky

Puede usarse en mobile para flujos como:

- matrícula;
- registrar pago;
- guardar calificación.

Debe:

- respetar teclado;
- respetar safe area;
- no tapar contenido;
- mantener separación visual.

---

# 46. Bottom navigation

Debe permanecer estable.

No mostrarla durante algunos flujos de pantalla completa si distrae.

Ejemplo:

```text
Registrar pago
```

puede ocultar temporalmente bottom nav si el flujo lo requiere.

---

# 47. Responsive

Tres comportamientos conceptuales:

```text
Mobile
Tablet
Desktop
```

No solo breakpoints numéricos.

---

# 48. Mobile

Preferir:

- listas;
- una columna;
- pantallas dedicadas;
- bottom sheets;
- tabs scrollables;
- targets grandes.

---

# 49. Tablet

Puede usar:

- dos columnas;
- drawer;
- tabla simplificada;
- navegación híbrida.

No asumir desktop completo.

---

# 50. Desktop

Preferir:

- sidebar;
- tablas ligeras;
- más información simultánea;
- sheets contextuales;
- formularios centrados.

---

# 51. Tablas

Desktop:

tabla cuando aporta comparación.

Mobile:

convertir a filas.

No crear scroll horizontal como solución principal.

---

# 52. Contenido largo

Debe probarse:

- nombres de alumno largos;
- nombres de tutor largos;
- conceptos largos;
- observaciones;
- nombres de categorías;
- referencias bancarias.

---

# 53. Truncado

Usar truncado solo cuando el dato completo sea recuperable fácilmente.

Ejemplo:

```text
María Fernanda Rodríguez...
```

al tocar/ver detalle:

nombre completo.

No truncar montos ni estados.

---

# 54. Wrapping

En listas mobile:

- nombre puede wrap a 2 líneas;
- metadata debajo;
- acción `›` debe permanecer clara.

---

# 55. Montos grandes

Probar:

```text
$0
$950
$12,450
$184,300
$1,250,000
```

Los KPIs no deben romper layout.

---

# 56. Valores negativos

Mostrar consistentemente:

```text
-$1,200
```

para pagos/créditos cuando corresponda.

No mezclar:

```text
$-1,200
```

---

# 57. Fechas

Formato consistente en español:

```text
20 ago 2026
```

y cuando haya hora:

```text
20 ago 2026 · 10:42
```

No mezclar formatos arbitrariamente.

---

# 58. Periodos escolares

Mostrar siempre con nomenclatura clara:

```text
Periodo 1
Periodo 2
Periodo 3
```

No códigos internos.

---

# 59. Ciclos

Formato consistente:

```text
2026–2027
```

Si internamente existe otro formato, no exponerlo.

---

# 60. Estados

Todos deben mostrarse con:

```text
texto
+
color opcional
```

Ejemplos:

```text
Activa
Pendiente
Baja
Vencido
Al corriente
Captura abierta
Captura cerrada
```

---

# 61. Badges

No abusar.

Usarlos cuando ayudan a escanear.

No convertir cada dato en badge.

---

# 62. Color

Mantener sistema de F3:

- primario;
- success;
- warning;
- danger;
- info;
- neutros.

No agregar colores por módulo.

---

# 63. Tipografía

Mantener jerarquía definida en F3.

No reducir tamaño solo para “hacer caber”.

Primero adaptar layout.

---

# 64. Accesibilidad

Mínimos:

- contraste suficiente;
- focus visible;
- labels;
- targets 44px;
- teclado;
- textos alternativos cuando corresponda;
- no depender de color;
- orden semántico.

---

# 65. Icon buttons

Todo icon button importante debe tener:

- `aria-label`;
- tooltip en desktop si aporta;
- target 44px.

---

# 66. Formularios

Todos los inputs deben tener label visible.

No depender únicamente de placeholder.

Correcto:

```text
Correo
[usuario@correo.com]
```

No:

```text
[Escribe tu correo]
```

sin label.

---

# 67. Required

No llenar la interfaz de asteriscos si casi todo es requerido.

Puede indicarse:

```text
Opcional
```

en campos opcionales.

---

# 68. Validación

Validar:

- al salir del campo;
- al intentar continuar;
- o en tiempo real cuando sea útil.

No mostrar error antes de que el usuario interactúe.

---

# 69. Inputs numéricos

Para:

- montos;
- calificaciones;

usar teclado adecuado en móvil.

---

# 70. Textarea

Debe crecer razonablemente.

No usar una línea para observaciones largas.

---

# 71. Selectores largos

Usar:

```text
Combobox / Command
```

cuando haya muchas opciones.

Ejemplos:

- alumno;
- receptor;
- grupo;
- profesor.

---

# 72. Confirmación de cambios no guardados

Si el usuario intenta salir de un formulario modificado:

```text
¿Salir sin guardar?

Los cambios se perderán.

[Seguir editando]
[Salir]
```

No mostrar si no hubo cambios.

---

# 73. Auto-save

No usar auto-save en:

- pagos;
- matrícula;
- cambios financieros;
- correcciones;
- cambios de estado.

Puede evaluarse para preferencias menores, pero no es necesario en esta etapa.

---

# 74. Optimistic UI

Usar con cuidado.

No marcar como exitoso:

- pago;
- matrícula;
- corrección;
- calificación;

hasta que backend confirme.

---

# 75. Datos sensibles a doble submit

Bloquear segunda acción en:

- registrar pago;
- confirmar matrícula;
- revertir;
- corregir;
- guardar calificación.

---

# 76. Back button del navegador

Debe funcionar correctamente.

No romper flujos.

En multipaso, definir si:

```text
Back
```

vuelve al paso anterior o abandona.

Debe ser consistente.

---

# 77. Refresh

Al refrescar una pantalla de detalle:

- debe seguir funcionando;
- debe recuperar contexto desde URL;
- no depender de estado temporal invisible.

---

# 78. PWA / sensación de app

Aunque no se fuerce PWA en esta etapa, la UI debe cuidar:

- `dvh`;
- safe areas;
- bottom nav;
- overscroll;
- standalone-like spacing.

---

# 79. Scroll restoration

Idealmente:

- al volver de detalle, restaurar posición;
- al cambiar tab, mantener contexto cuando tenga sentido.

No es obligatorio en todos los casos, pero sí en listados largos.

---

# 80. Componentes globales

Inventario sugerido:

```text
AppShell
DesktopSidebar
MobileBottomNav
MobileHeader
UserMenu
PageHeader
EntityHeader
SectionHeader
SearchField
FilterSheet
EmptyState
ErrorState
PermissionState
LoadingSkeleton
StatusBadge
ConfirmDialog
ActionMenu
FormField
MoneyInput
DateField
Combobox
StickyActionBar
```

---

# 81. Componentes de alumno

```text
StudentRow
StudentSummary
FinancialStatus
TutorRow
EnrollmentSummary
AcademicSummary
ActivityTimeline
```

---

# 82. Componentes de pagos

```text
PaymentRow
PaymentDetail
PaymentApplicationSummary
AccountSummary
ReceiptActions
FinancialSettingRow
PriceChangeSummary
```

---

# 83. Componentes de matrícula

```text
EnrollmentRow
EnrollmentStatus
EnrollmentStepper
EnrollmentSummary
LateEnrollmentSummary
CycleRow
CampaignRow
```

---

# 84. Componentes académicos

```text
TeacherAssignmentRow
GradeRow
GradeEditor
CaptureStatus
CaptureProgress
TeacherRow
SubjectGradeSummary
```

---

# 85. Componentes Tutor

```text
ChildSelector
ChildSummary
TutorAccountSummary
TutorGradeSummary
TutorPaymentRow
```

---

# 86. Componentes Reportes

```text
ReportKPI
ReportFilterBar
EnrollmentDistribution
EnrollmentEvolution
GenderDistribution
ReportTable
```

---

# 87. Evitar componentes duplicados

No crear:

```text
AdminStudentRow
TeacherStudentRow
TutorStudentRow
```

si pueden compartir una base común con variantes.

Preferir:

```text
StudentRow
```

con composición/control por contexto.

---

# 88. Tokens visuales

Centralizar:

- colores;
- radius;
- spacing;
- tipografía;
- shadows;
- heights;
- z-index;
- motion.

No hardcodear estilos distintos en cada pantalla.

---

# 89. Motion

Animaciones mínimas:

- sheet open/close;
- dropdown;
- toast;
- tab indicator.

Duración breve.

No animaciones decorativas innecesarias.

---

# 90. Reduce motion

Respetar:

```text
prefers-reduced-motion
```

cuando aplique.

---

# 91. Z-index

Definir escala consistente para:

```text
header
bottom nav
dropdown
sheet
dialog
toast
```

Evitar conflictos locales.

---

# 92. Orden de implementación recomendado

## Fase UI-1 — Fundaciones

```text
tokens
tipografía
buttons
inputs
labels
badges
toasts
dialogs
sheets
```

## Fase UI-2 — Shell

```text
login
desktop sidebar
mobile header
bottom navigation
user menu
```

## Fase UI-3 — Núcleo administrativo

```text
Inicio
Alumnos
Ficha
Cuenta
Registrar pago
```

## Fase UI-4 — Matrícula

```text
Matrícula
Preinscripciones
Activación
Ciclo
```

## Fase UI-5 — Finanzas

```text
Pagos globales
Detalle
Corrección
Configuración financiera
```

## Fase UI-6 — Académico

```text
Profesor
Grupos
Captura
Administración académica
```

## Fase UI-7 — Tutor

```text
Inicio
Hijos
Cuenta
Pagos
Calificaciones
```

## Fase UI-8 — Reportes

```text
Matrícula
Evolución
Financieros
SEP
```

---

# 93. Regla de implementación

No programar toda la lógica pesada de una pantalla antes de validar:

```text
layout
responsive
navegación
estados
```

Primero construir el patrón visual con datos controlados/mock si hace falta.

Después conectar lógica real.

---

# 94. QA visual por pantalla

Cada pantalla debe revisarse al menos en:

```text
390px
768px
1280–1440px
```

No basta con desktop.

---

# 95. QA mobile mínimo

Probar:

- iPhone pequeño;
- iPhone moderno;
- Android equivalente;
- teclado abierto;
- landscape cuando sea razonable.

---

# 96. QA de navegación

Validar:

- tabs;
- back;
- direct URL;
- refresh;
- bottom nav;
- drawer Más;
- links contextuales.

---

# 97. QA de formularios

Validar:

- vacío;
- valores válidos;
- error;
- submit doble;
- teclado;
- scroll;
- abandonar;
- reintentar.

---

# 98. QA de listas

Validar:

- 0 elementos;
- 1 elemento;
- pocos;
- muchos;
- nombres largos;
- filtros;
- búsqueda sin resultados.

---

# 99. QA de montos

Probar:

```text
$0
$1
$950
$12,450
$184,300
$1,000,000+
```

También:

- saldo a favor;
- vencido;
- pago parcial;
- negativo cuando corresponda.

---

# 100. QA académico

Probar:

- sin grupos;
- 1 grupo;
- muchos grupos;
- periodo abierto;
- periodo cerrado;
- todos capturados;
- ninguno capturado;
- comentario en 250 caracteres;
- corrección administrativa.

---

# 101. QA Tutor

Probar:

- 1 hijo;
- 2 hijos;
- al corriente;
- saldo vencido;
- saldo a favor;
- calificaciones disponibles;
- no disponibles;
- varios periodos.

---

# 102. QA Reportes

Probar:

- sin datos;
- pocos datos;
- muchos datos;
- rango corto;
- rango largo;
- mobile touch;
- tooltip;
- tabla complementaria;
- filtros persistentes.

---

# 103. QA de permisos

Por cada rol, revisar que:

```text
Master
Administrativo
Profesor
Tutor
```

vea solo:

- navegación correspondiente;
- acciones permitidas;
- datos permitidos.

No validar permisos solo visualmente: la UI debe reflejar los permisos reales, pero backend sigue siendo autoridad.

---

# 104. QA de accesibilidad

Checklist:

```text
[ ] navegación por teclado
[ ] focus visible
[ ] labels
[ ] aria-label en icon buttons
[ ] contraste
[ ] targets 44px
[ ] estados no dependen de color
[ ] gráficos tienen datos equivalentes
[ ] dialogs manejan focus
[ ] sheets manejan focus
```

---

# 105. QA de responsive

Checklist:

```text
[ ] no overflow horizontal accidental
[ ] tabs no hacen wrap
[ ] tablas se transforman en listas
[ ] bottom nav no tapa contenido
[ ] keyboard no tapa CTA
[ ] sheets tienen scroll propio
[ ] header permanece usable
[ ] contenido respeta safe area
```

---

# 106. QA de overscroll

Checklist:

```text
[ ] body no rebota detrás de sheet
[ ] dialog bloquea fondo
[ ] bottom nav permanece estable
[ ] no aparece scroll lateral
[ ] contenido principal sí puede desplazarse
```

---

# 107. QA de errores

Checklist:

```text
[ ] error de fetch
[ ] error de submit
[ ] sesión expirada
[ ] sin permiso
[ ] timeout
[ ] reintento
[ ] formulario conserva datos
```

---

# 108. QA de estados extremos

Probar:

- nombres muy largos;
- categoría con nombre largo;
- observación máxima;
- muchos hijos;
- muchos pagos;
- muchos grupos;
- montos grandes;
- periodos sin datos;
- alumnos sin tutor;
- alumno sin grupo cuando el estado lo permita.

---

# 109. QA visual de referencia

Toda pantalla debe revisarse contra la dirección visual definida:

```text
Imagen 1 como base
+
información escolar de Imagen 2
+
KPIs financieros de Imagen 3
+
simplicidad de Login de Imagen 4
```

Preguntas:

- ¿se ve demasiado cargado?
- ¿parece template?
- ¿hay demasiadas cards?
- ¿hay demasiados colores?
- ¿se siente moderno?
- ¿se siente app en mobile?

---

# 110. Criterios de rechazo visual

Una pantalla debe volver a diseño si:

- parece software escolar antiguo;
- necesita zoom en móvil;
- obliga a scroll horizontal;
- tiene demasiadas cards;
- es difícil identificar la acción principal;
- usa iconos sin texto para acciones críticas;
- muestra demasiados colores;
- tiene más información que contexto;
- obliga a abrir varios modales para completar una tarea simple.

---

# 111. Criterios de aceptación mobile

Debe ser posible:

- leer sin zoom;
- tocar acciones con una mano;
- entender estado;
- navegar sin perder contexto;
- completar formularios con teclado abierto;
- regresar sin perder filtros;
- usar app sin instrucciones.

---

# 112. Criterios de aceptación desktop

Debe:

- aprovechar espacio sin sobredensidad;
- mostrar tablas cuando aporten;
- mantener jerarquía;
- evitar carditis;
- conservar el mismo lenguaje que móvil.

---

# 113. Handoff para Codex / implementación

Cada tarea de implementación debe incluir:

```text
Pantalla
Rol
Ruta
Referencia F2–F9
Estados
Mobile
Desktop
Componentes reutilizables
Restricciones
```

Ejemplo:

```text
Implementar /alumnos.

Referencia:
- F2 navegación
- F3 shell
- F4 listado de alumnos
- F9 estados transversales

Debe incluir:
- mobile list
- desktop table
- search
- filter sheet
- empty
- loading
- error
```

---

# 114. Evitar prompts ambiguos de implementación

No usar:

```text
Haz la pantalla de alumnos bonita.
```

Preferir:

```text
Implementa la pantalla /alumnos respetando F2, F3, F4 y F9.
No cambies lógica ni DB.
Mobile-first.
Desktop tabla ligera.
Mobile lista.
Incluye loading, empty, error y filtros.
```

---

# 115. Separación de responsabilidades

DB:

- integridad;
- permisos;
- reglas transaccionales;
- derivaciones críticas.

App:

- navegación;
- presentación;
- estados;
- interacción;
- composición responsive.

No mover reglas de negocio a UI durante implementación.

---

# 116. Mock data durante UI

Se permite usar datos mock/controlados para validar:

- layout;
- responsive;
- estados;
- edge cases;

antes de conectar Supabase.

Pero deben parecerse a los datos reales.

---

# 117. Orden de conexión a backend

Después de validar UI:

```text
read
↓
filters/search
↓
mutations simples
↓
mutations sensibles
↓
errores/permisos
```

No conectar todo simultáneamente.

---

# 118. Handoff de diseño por pantalla

Cada pantalla debe quedar documentada con:

```text
Objetivo
Rol
Ruta
Contenido
Acción primaria
Acciones secundarias
Mobile
Desktop
Loading
Empty
Error
Permisos
```

F2–F8 ya cubren la mayor parte.

F9 agrega la norma transversal.

---

# 119. Mapa final de documentos F

```text
F2 — Mapa de pantallas y navegación por rol
F3 — Login + shell + sistema visual
F4 — Núcleo administrativo
F5 — Matrícula + preinscripción + ciclo
F6 — Pagos + configuración financiera
F7 — Académico + Profesor
F8 — Tutor + Reportes
F9 — Estados transversales + QA UX + handoff
```

No hace falta crear un F1 independiente si la dirección visual ya está absorbida entre F2 y F3.

---

# 120. Qué queda cerrado al terminar F9

Con F9 queda cerrado el bloque F de diseño/UX/UI a nivel de blueprint.

Quedan definidos:

- lenguaje visual;
- navegación;
- shell;
- responsive;
- login;
- núcleo administrativo;
- matrícula;
- pagos;
- configuración financiera;
- académico;
- Profesor;
- Tutor;
- reportes;
- estados transversales;
- accesibilidad;
- QA;
- componentes;
- rutas conceptuales;
- orden de implementación.

---

# 121. Qué no significa “cerrado”

Cerrar F no significa que:

- cada píxel sea inmutable;
- no pueda ajustarse spacing;
- no pueda cambiar un icono;
- no pueda refinarse una gráfica;
- no puedan descubrirse pequeños problemas al prototipar.

Sí significa que:

> Codex no debe inventar arquitectura de navegación, patrones UX o flujos principales durante implementación.

Los ajustes posteriores deben ser refinamientos, no rediseños.

---

# 122. Criterio para reabrir diseño

Solo reabrir una decisión mayor si aparece:

- contradicción real con reglas funcionales;
- limitación técnica real;
- problema grave de accesibilidad;
- flujo móvil claramente inutilizable;
- inconsistencia entre roles;
- dato necesario que no puede presentarse con el modelo actual.

No rediseñar por preferencia estética menor.

---

# 123. Primer piloto recomendado

Antes de implementar todo REAL, construir un piloto completo de:

```text
Login
↓
Inicio Administrativo
↓
Buscar alumno
↓
Ficha
↓
Estado de cuenta
↓
Registrar pago
↓
Confirmación
```

En:

```text
390px
+
1440px
```

Si ese piloto se siente correcto, la base visual está validada.

---

# 124. Segundo piloto recomendado

Después:

```text
Profesor
↓
Grupo
↓
Alumno
↓
Captura
↓
Guardar y siguiente
```

principalmente en móvil.

Esto valida la segunda experiencia de uso más sensible.

---

# 125. Tercer piloto recomendado

Después:

```text
Tutor
↓
Seleccionar hijo
↓
Estado de cuenta
↓
Calificaciones
```

Esto valida la experiencia familiar.

---

# 126. Cierre final de F

El principio global de REAL queda:

> La complejidad debe existir en las reglas y en los datos, no en la experiencia del usuario.

La interfaz debe sentirse:

```text
limpia
moderna
rápida
mobile-first
consistente
predecible
accesible
```

sin parecer software administrativo antiguo ni un dashboard genérico.

Con este documento queda preparado el handoff para comenzar implementación visual por fases sin volver a inventar UX durante desarrollo.
