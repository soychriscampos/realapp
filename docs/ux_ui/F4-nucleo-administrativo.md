# F4 — Diseño de pantallas del núcleo administrativo

## Objetivo

Definir en detalle las pantallas administrativas más importantes de REAL antes de programar funcionalidad pesada.

Este bloque se concentra en el flujo operativo principal:

```text
Inicio Administrativo
→ Buscar alumno
→ Ficha del alumno
→ Registrar pago
→ Estado de cuenta
```

El objetivo es validar que el sistema visual definido en F1–F3 funciona correctamente en:

- móvil;
- tablet;
- desktop;
- operación rápida;
- usuarios administrativos con poca experiencia tecnológica;
- uso intensivo desde teléfono.

Este documento no redefine reglas de negocio ni arquitectura de base de datos.

---

# 1. Principio general del flujo administrativo

El administrativo debe poder completar las tareas más frecuentes con muy poca navegación.

Las prioridades son:

1. encontrar a un alumno;
2. identificar rápidamente su estado;
3. registrar un pago;
4. revisar su cuenta;
5. confirmar que la operación se realizó correctamente.

REAL debe reducir al mínimo:

- profundidad de navegación;
- pantallas intermedias;
- acciones escondidas;
- necesidad de recordar dónde vive una función.

---

# 2. Flujo principal

El flujo ideal debe sentirse así:

```text
Inicio
↓
Buscar alumno
↓
Ana López
↓
Registrar pago
↓
Confirmar
↓
Pago registrado
```

y también:

```text
Inicio
↓
Alumno con deuda
↓
Estado de cuenta
↓
Registrar pago
```

No debe ser necesario navegar por varios módulos administrativos para cobrar.

---

# 3. Inicio Administrativo

Ruta conceptual:

```text
/inicio
```

## Objetivo

Responder en segundos:

> ¿Qué necesito atender ahora?

La pantalla no debe sentirse como un dashboard de BI.

Debe ser una pantalla operativa.

---

# 4. Jerarquía del Inicio Administrativo

Orden recomendado:

```text
Header
↓
Buscar alumno
↓
Acciones rápidas
↓
Requieren atención
↓
Pagos recientes
↓
Información secundaria
```

La búsqueda debe estar arriba porque será una de las acciones más frecuentes.

---

# 5. Header del Inicio

## Mobile

```text
Buenos días, Fran

Ciclo 2026–2027
```

A la derecha:

```text
[avatar / menú]
```

No agregar demasiada información.

## Desktop

Puede ser:

```text
Inicio

Ciclo 2026–2027
```

con acceso de usuario en la shell.

---

# 6. Búsqueda principal de alumno

Debe ser el elemento funcional más visible del Inicio.

Ejemplo:

```text
⌕ Buscar alumno
```

Placeholder:

```text
Nombre del alumno...
```

## Mobile

El campo puede ocupar todo el ancho.

Altura recomendada:

```text
48px
```

Al tocarlo, puede abrir una pantalla o Command/Dialog dedicado a búsqueda.

## Desktop

Puede buscar directamente en el mismo contexto o abrir Command.

---

# 7. Estado inicial de búsqueda

```text
Buscar alumno

[ Ana                          ]
```

Resultados:

```text
Ana López
3º Primaria · Grupo A
Al corriente                         ›

Ana Martínez
5º Primaria · Grupo B
$1,200 vencido                       ›
```

Toda la fila es clickeable.

No usar botones pequeños de “Ver”.

---

# 8. Resultados de búsqueda

Cada resultado debe mostrar solamente información relevante para distinguir alumnos:

- nombre;
- nivel/grado/grupo;
- estado;
- situación financiera resumida.

Ejemplo:

```text
Luis Pérez
1º Secundaria · Activa
$2,350 vencido                       ›
```

No llenar la búsqueda con:

- CURP;
- correo;
- teléfonos;
- identificadores internos;
- demasiadas etiquetas.

---

# 9. Sin resultados

Estado:

```text
No encontramos alumnos con “Ana P.”

Revisa el nombre e inténtalo de nuevo.
```

Si el rol puede dar de alta:

```text
+ Nuevo alumno
```

solo si esa acción realmente corresponde al flujo.

---

# 10. Acciones rápidas

Debajo de búsqueda.

Recomendación:

```text
Registrar pago
Nueva preinscripción
```

Puede existir una tercera acción si se valida como frecuente.

No usar cuatro o cinco grandes cards.

---

# 11. Diseño de acciones rápidas en mobile

Preferir botones/filas amplias.

Ejemplo:

```text
[ $ ] Registrar pago
```

```text
[ + ] Nueva preinscripción
```

Pueden estar lado a lado si hay espacio suficiente, pero deben seguir siendo fáciles de tocar.

Para Fran, priorizar targets de 48px o más.

---

# 12. Requieren atención

Sección principal del Inicio.

Header:

```text
Requieren atención
```

Opcional:

```text
Ver todos
```

Ejemplos:

```text
Luis Pérez
1º Secundaria
$2,350 vencido                       ›
```

```text
María Torres
2º Primaria
$1,200 vencido                       ›
```

No convertir cada alumno en una card elevada.

Usar lista limpia con separadores.

---

# 13. Indicadores financieros en listas

La situación financiera debe poder entenderse sin depender solo del color.

Correcto:

```text
$2,350 vencido
```

Correcto:

```text
Al corriente
```

Evitar:

```text
●
```

sin texto.

El color se usa únicamente como refuerzo.

---

# 14. Pagos recientes

Sección:

```text
Pagos recientes
```

Fila:

```text
Ana López
$1,200 · Transferencia
Hoy · 10:42                         ›
```

Otra:

```text
Carlos Ruiz
$950 · Efectivo
Hoy · 09:15                         ›
```

Al tocar puede abrir detalle rápido del pago.

---

# 15. Información secundaria del Inicio

Puede incluir información muy breve como:

- total de pagos del día;
- cantidad de alumnos con deuda vencida;
- preinscripciones pendientes.

Pero no debe desplazar la operación principal.

Ejemplo:

```text
Hoy
$12,450 cobrados
```

```text
8 alumnos con saldo vencido
```

---

# 16. Inicio Administrativo — Mobile

Wireframe conceptual:

```text
┌───────────────────────────┐
│ Buenos días, Fran      ◯  │
│ Ciclo 2026–2027           │
│                           │
│ [⌕ Buscar alumno...]      │
│                           │
│ [ Registrar pago ]        │
│ [ Preinscripción  ]       │
│                           │
│ Requieren atención        │
│                           │
│ Luis Pérez                │
│ 1º Secundaria             │
│ $2,350 vencido         ›  │
│ ------------------------- │
│ María Torres              │
│ 2º Primaria               │
│ $1,200 vencido         ›  │
│                           │
│ Pagos recientes           │
│                           │
│ Ana López                 │
│ $1,200 · Transferencia    │
│ Hoy · 10:42            ›  │
│                           │
├───────────────────────────┤
│ Inicio Alumnos Pagos Más  │
└───────────────────────────┘
```

---

# 17. Inicio Administrativo — Desktop

La misma jerarquía.

No se debe transformar en un mosaico completamente distinto.

Propuesta:

```text
Inicio

[ Buscar alumno................................ ]

[ Registrar pago ]   [ Nueva preinscripción ]

Requieren atención
------------------------------------------------
Alumno                Grado              Cuenta
Luis Pérez            1º Sec.            $2,350 vencido
María Torres          2º Prim.           $1,200 vencido

Pagos recientes
------------------------------------------------
Ana López             $1,200             Transferencia
Carlos Ruiz           $950               Efectivo
```

Puede existir una pequeña columna de resumen a la derecha si aporta valor.

---

# 18. Pantalla Alumnos

Ruta:

```text
/alumnos
```

Objetivo:

encontrar, filtrar y abrir alumnos.

No debe ser una pantalla de gestión masiva innecesariamente compleja.

---

# 19. Header Alumnos

## Mobile

```text
Alumnos                         +
```

Debajo:

```text
[⌕ Buscar alumno...]
```

Después:

```text
[Filtros]
```

## Desktop

```text
Alumnos                                   + Nuevo alumno

[ Buscar alumno... ]   [ Filtros ]
```

---

# 20. Filtros de alumnos

Filtros:

- ciclo;
- nivel;
- grado;
- grupo;
- estado;
- clasificación administrativa correspondiente.

## Mobile

Botón:

```text
Filtros
```

abre bottom sheet.

Ejemplo:

```text
Filtros

Ciclo
[2026–2027]

Nivel
[Todos]

Grado
[Todos]

Estado
[Activa]

[Aplicar filtros]
```

Acción secundaria:

```text
Limpiar
```

---

# 21. Lista de alumnos — Mobile

Fila:

```text
Ana López
3º Primaria · Grupo A
Activa · Al corriente                  ›
```

Fila con deuda:

```text
Luis Pérez
1º Secundaria · Grupo A
Activa · $2,350 vencido                ›
```

Altura aproximada:

```text
64–72px
```

Toda la fila es interactiva.

---

# 22. Lista de alumnos — Desktop

Tabla ligera:

```text
Alumno          Grado / Grupo      Estado      Cuenta
---------------------------------------------------------
Ana López       3º Primaria A      Activa      Al corriente
Luis Pérez      1º Secundaria A    Activa      $2,350 vencido
```

Puede existir una columna mínima de acción:

```text
···
```

pero abrir la fila debe ser suficiente para navegación normal.

---

# 23. Ficha del alumno

Ruta:

```text
/alumnos/[id]
```

Esta es la pantalla administrativa más importante del sistema.

Debe actuar como centro de contexto del alumno.

---

# 24. Header de alumno — Mobile

Ejemplo:

```text
‹ Alumnos                         ···

Ana López
3º Primaria · Grupo A
Activa
```

Debajo:

```text
Al corriente
```

o:

```text
$2,350 vencido
```

La acción financiera debe estar muy visible:

```text
[ Registrar pago ]
```

---

# 25. Header de alumno — Desktop

```text
← Alumnos

Ana López                                  [Registrar pago] [···]
3º Primaria · Grupo A
Activa · Al corriente
```

Acción primaria:

```text
Registrar pago
```

Acciones secundarias:

```text
···
```

---

# 26. Navegación interna del alumno

## Desktop

```text
Resumen
Cuenta
Matrícula
Académico
Familia
Historial
```

## Mobile

Preferencia:

```text
Resumen   Cuenta   Matrícula   Más
```

`Más`:

```text
Académico
Familia
Historial
```

No permitir que los tabs hagan wrap.

---

# 27. Alumno → Resumen

Debe mostrar una vista rápida.

Orden:

```text
Situación financiera
↓
Matrícula actual
↓
Familia
↓
Información académica resumida
↓
Actividad reciente
```

No es necesario mostrar todos los datos personales del alumno de inmediato.

---

# 28. Situación financiera en Resumen

Ejemplo al corriente:

```text
Cuenta

Al corriente

Saldo
$0
```

Ejemplo con deuda:

```text
Cuenta

$2,350 vencido

Saldo total
$3,550
```

Acciones:

```text
Registrar pago
Ver estado de cuenta
```

Esta sección debe ser una de las primeras.

---

# 29. Matrícula actual en Resumen

```text
Matrícula

Ciclo 2026–2027
3º Primaria · Grupo A
Activa
```

Acción:

```text
Ver matrícula
```

---

# 30. Familia en Resumen

```text
Tutores

María López
Madre

Carlos López
Padre
```

Puede mostrar icono de acceso familiar activo/invitado si aporta.

No llenar la vista con detalles de autenticación.

---

# 31. Académico resumido

Solo información útil:

```text
Académico

Periodo 1
Promedio oficial 9.1
```

Acción:

```text
Ver calificaciones
```

---

# 32. Actividad reciente

Timeline corta:

```text
Actividad reciente

20 ago
Pago registrado · $1,200

14 ago
Categoría financiera actualizada
```

Mostrar solo 3–5 eventos.

Acción:

```text
Ver historial completo
```

---

# 33. Ficha alumno — Mobile

Wireframe:

```text
┌────────────────────────────┐
│ ‹ Alumnos              ··· │
│                            │
│ Ana López                  │
│ 3º Primaria · Grupo A      │
│ Activa                     │
│                            │
│ $2,350 vencido             │
│                            │
│ [ Registrar pago ]         │
│                            │
│ Resumen Cuenta Matrícula + │
│ -------------------------- │
│                            │
│ Cuenta                     │
│ Saldo total       $3,550   │
│ Vencido           $2,350   │
│ Ver estado de cuenta   ›   │
│                            │
│ Matrícula                  │
│ Ciclo 2026–2027            │
│ 3º Primaria · Grupo A      │
│                            │
│ Tutores                    │
│ María López                │
│ Carlos López               │
│                            │
└────────────────────────────┘
```

---

# 34. Registrar pago

Es el flujo administrativo más sensible a velocidad.

Debe poder iniciarse desde:

- Inicio;
- ficha del alumno;
- estado de cuenta;
- módulo Pagos;
- búsqueda global.

---

# 35. Decisión de patrón para Registrar pago

## Mobile

Preferencia:

**pantalla dedicada**.

Razones:

- teclado;
- inputs;
- claridad;
- personas mayores;
- evitar sheets demasiado largos;
- mejor confirmación.

## Desktop

Puede ser:

- Sheet lateral amplio;
- o pantalla dedicada.

Para consistencia operativa, una pantalla dedicada también es perfectamente válida.

---

# 36. Ruta conceptual

```text
/alumnos/[id]/registrar-pago
```

o equivalente interno.

La URL final puede decidirse durante implementación.

---

# 37. Header Registrar pago

Mobile:

```text
‹ Ana López

Registrar pago
```

Contexto:

```text
Ana López
3º Primaria · Grupo A
```

Saldo visible:

```text
Saldo actual
$2,350 vencido
```

---

# 38. Formulario Registrar pago

Orden recomendado:

```text
Monto
Método
Fecha
Referencia
Observación
```

No comenzar con campos secundarios.

---

# 39. Campo Monto

Debe ser el campo visualmente más importante.

Ejemplo:

```text
Monto

$ [ 1,200.00 ]
```

Input grande.

En mobile:

- teclado numérico;
- tamaño de texto claro;
- símbolo de moneda visible.

---

# 40. Método de pago

Opciones:

```text
○ Efectivo
○ Transferencia
○ Especie
```

Para 3 opciones, radio es mejor que Select.

Si se usa card-radio, debe seguir siendo sobrio.

---

# 41. Fecha de pago

```text
Fecha

20 ago 2026
```

La fecha actual puede venir preseleccionada cuando corresponda.

Debe poder modificarse según las reglas ya definidas.

---

# 42. Referencia

Visible principalmente para transferencia.

Ejemplo:

```text
Referencia bancaria

[_____________________]
```

Si el método no la necesita, puede:

- ocultarse;
- o mostrarse como opcional.

Preferencia: mostrar condicionalmente.

---

# 43. Observación

```text
Observación

[_____________________]
[_____________________]
```

Opcional.

No ocupar gran altura inicialmente.

---

# 44. Información de aplicación del pago

Antes de confirmar, si el sistema puede mostrar cómo se aplicará:

```text
Aplicación

Deuda anterior
$400

Colegiatura septiembre
$800
```

Total:

```text
Total
$1,200
```

Esto puede mostrarse dentro de un bloque secundario.

No debe parecer un formulario editable si no lo es.

---

# 45. CTA Registrar pago

Mobile:

```text
[ Registrar pago ]
```

Full-width.

Idealmente cerca del final del contenido.

Puede ser sticky en la parte inferior si:

- no tapa contenido;
- respeta safe area;
- facilita mucho la operación.

Esta opción debe evaluarse en prototipo.

---

# 46. Estado loading

Después de tocar:

```text
Registrando...
```

Botón disabled.

No permitir doble submit.

---

# 47. Confirmación de pago

Después de registrar:

```text
✓ Pago registrado

$1,200

Ana López
Transferencia
20 ago 2026
```

Acciones:

```text
Descargar recibo
Enviar recibo
```

CTA principal de salida:

```text
Volver al alumno
```

No es necesario mandar inmediatamente al usuario a otra pantalla sin confirmación.

---

# 48. Toast después del pago

Al salir de la confirmación puede mostrarse:

```text
✓ Pago registrado correctamente
```

Pero el toast no reemplaza la confirmación principal.

---

# 49. Error al registrar

Debe preservar el formulario.

Mensaje:

```text
No pudimos registrar el pago.

Revisa la información e inténtalo de nuevo.
```

Si existe un error en campo específico, mostrarlo inline.

No vaciar monto, referencia u observación tras un fallo.

---

# 50. Estado de cuenta

Ruta:

```text
/alumnos/[id]/cuenta
```

Debe ser una pantalla financiera clara y fácil de explicar al tutor.

No debe parecer una tabla contable compleja.

---

# 51. Header Estado de cuenta

Mobile:

```text
‹ Ana López

Estado de cuenta
```

Desktop:

```text
Estado de cuenta                             [Registrar pago]
Ana López
```

---

# 52. Resumen financiero

Orden:

```text
Saldo total
Vencido
Saldo a favor
```

Ejemplo:

```text
Saldo total
$3,550

Vencido
$2,350

Saldo a favor
$0
```

Puede presentarse como 3 KPIs compactos.

No usar tres cards grandes con fondos distintos.

---

# 53. Estado financiero

Indicador:

```text
Estado
Con saldo vencido
```

o:

```text
Estado
Al corriente
```

Este mensaje debe ser comprensible para administrativos y tutores.

---

# 54. Acciones del Estado de cuenta

Primaria:

```text
Registrar pago
```

Secundarias:

```text
Descargar
Enviar por correo
Enviar por WhatsApp
```

según alcance y canales disponibles.

En mobile, las secundarias pueden vivir en menú:

```text
···
```

---

# 55. Historial financiero por mes

Preferencia:

agrupar por periodo/mes.

Ejemplo:

```text
Septiembre 2026

Colegiatura
Cargo                         $1,200

Pago · Transferencia
20 sep 2026                  -$1,200

Saldo                              $0
```

Después:

```text
Octubre 2026

Colegiatura
Cargo                         $1,200

Pago parcial
15 oct 2026                    -$500

Saldo                            $700
```

---

# 56. Deuda anterior

Cuando exista:

```text
Saldo anterior

Cargo pendiente
$400
```

Debe distinguirse visualmente del mes actual.

---

# 57. Saldo a favor

Cuando exista:

```text
Saldo a favor
$500
```

Puede utilizar indicador semántico positivo.

No confundirlo con “pago completado”.

---

# 58. Pagos parciales

Debe quedar visualmente claro que varios pagos pueden corresponder a un cargo.

Ejemplo:

```text
Colegiatura octubre
$1,200

Pagos
- $500 · 10 oct
- $300 · 15 oct

Pendiente
$400
```

---

# 59. Estado de cuenta Mobile

Wireframe:

```text
┌────────────────────────────┐
│ ‹ Ana López            ··· │
│                            │
│ Estado de cuenta           │
│                            │
│ Saldo total                │
│ $3,550                     │
│                            │
│ Vencido        Saldo favor │
│ $2,350         $0          │
│                            │
│ [ Registrar pago ]         │
│                            │
│ Septiembre 2026            │
│ -------------------------- │
│ Colegiatura       $1,200   │
│ Pago             -$1,200   │
│ Saldo                  $0  │
│                            │
│ Octubre 2026              │
│ -------------------------- │
│ Colegiatura       $1,200   │
│ Pago parcial       -$500   │
│ Saldo                $700  │
│                            │
└────────────────────────────┘
```

---

# 60. Estado de cuenta Desktop

Puede usar dos zonas:

```text
Resumen financiero
------------------------------------------------

Historial financiero
```

En pantallas amplias puede existir una columna lateral de resumen, pero no debe fragmentarse excesivamente.

---

# 61. Detalle de pago desde Estado de cuenta

Tocar un pago puede abrir Sheet:

```text
Pago

$1,200
Transferencia
20 ago 2026 · 10:42

Recibido por
Fran

Referencia
123456

Aplicación
Septiembre              $800
Deuda anterior          $400
```

Acciones:

```text
Descargar recibo
Enviar recibo
```

Y según permisos:

```text
Corregir datos
Revertir pago
```

---

# 62. Corrección de pago

No debe ser una opción primaria visible.

Vive en:

```text
···
```

Flujo:

```text
Corregir datos del pago
```

Solo campos permitidos.

Debe solicitar motivo cuando la regla lo exija.

---

# 63. Reversión de pago

Acción destructiva.

Ubicación:

```text
···
→ Revertir pago
```

Confirmación:

```text
Revertir pago

Esta acción revertirá el pago de $1,200
registrado a Ana López.

Motivo
[________________________]

[Cancelar] [Revertir pago]
```

Botón destructivo claramente diferenciado.

---

# 64. Buscar alumno desde Registrar pago

Si el administrativo inicia desde:

```text
Pagos → Registrar pago
```

sin alumno seleccionado:

primer paso:

```text
¿A quién corresponde el pago?

[⌕ Buscar alumno...]
```

Selecciona alumno y continúa al mismo formulario.

No crear un segundo formulario distinto.

---

# 65. Navegación después de registrar pago

Preferencia:

```text
Confirmación
↓
Volver al alumno
```

La ficha se actualiza mostrando el nuevo estado financiero.

Alternativas visibles:

```text
Registrar otro pago
```

solo si operativamente aporta.

---

# 66. Patrón de acciones en mobile

En pantallas con una acción primaria:

- botón grande;
- texto claro;
- no depender de icono;
- cerca del pulgar cuando sea posible.

Ejemplo:

```text
Registrar pago
```

No:

```text
+
```

como único indicador de la acción.

---

# 67. Patrón de acciones en desktop

Primaria a la derecha del header:

```text
Registrar pago
```

Secundarias en:

```text
···
```

Esto mantiene la interfaz limpia.

---

# 68. Empty state de alumnos con deuda

```text
No hay alumnos con saldo vencido.

Todo está al corriente por ahora.
```

Sin ilustración grande.

---

# 69. Empty state de pagos recientes

```text
Aún no hay pagos registrados hoy.
```

Puede ofrecer:

```text
Registrar pago
```

---

# 70. Loading del Inicio

Skeletons específicos:

```text
████████████████████

████████████
████████████

████████████████
████████████████
```

No spinner central bloqueando toda la pantalla.

---

# 71. Loading de ficha de alumno

Skeleton:

- nombre;
- contexto;
- estado financiero;
- tabs;
- bloques de resumen.

El shell debe permanecer estable.

---

# 72. Accesibilidad

Los flujos críticos deben considerar:

- labels visibles;
- focus claro;
- contraste suficiente;
- targets de mínimo 44px;
- botones descriptivos;
- no depender exclusivamente de iconos;
- no depender exclusivamente del color;
- mensajes de error junto al campo;
- navegación correcta con teclado en desktop.

---

# 73. Reglas específicas para Fran

El diseño debe optimizar especialmente:

```text
Buscar alumno
Registrar pago
Confirmar pago
```

Por tanto:

- botones de 48px en móvil cuando sea posible;
- tipografía mínima cómoda;
- lenguaje directo;
- no requerir gestos ocultos;
- no esconder Registrar pago dentro de `···`;
- no usar íconos sin etiqueta en acciones importantes;
- evitar formularios densos;
- mantener secuencia vertical simple.

---

# 74. Prueba de éxito del flujo

F4 debe considerarse visualmente correcto si un administrativo puede:

1. abrir REAL;
2. encontrar un alumno;
3. identificar cuánto debe;
4. registrar un pago;
5. confirmar el registro;

sin instrucciones externas.

Meta conceptual:

```text
muy pocos taps
+
sin decisiones ambiguas
+
sin necesidad de conocer la arquitectura interna
```

---

# 75. Responsive: misma tarea, distinta composición

## Mobile

```text
listas
pantallas dedicadas
bottom navigation
bottom sheets
acciones grandes
```

## Desktop

```text
tablas ligeras
sidebar
sheets contextuales
más información simultánea
```

La lógica del flujo debe ser la misma.

---

# 76. Qué NO hacer

No:

- mostrar demasiados KPIs en Inicio;
- poner Registrar pago en un menú escondido;
- comprimir tablas desktop en móvil;
- usar cards grandes para cada fila;
- llenar ficha de alumno con todos sus datos personales;
- mezclar cuenta, matrícula y académico sin jerarquía;
- abrir formularios largos en dialogs pequeños;
- usar múltiples colores para estados;
- usar texto menor de lo necesario;
- depender de hover para descubrir acciones;
- pedir confirmación para operaciones triviales.

---

# 77. Componentes shadcn sugeridos

Para estas pantallas:

```text
Button
Input
Command
Sheet
Dialog
DropdownMenu
Tabs
Badge
Separator
RadioGroup
Textarea
Calendar
Popover
Toast / Sonner
Skeleton
ScrollArea
```

Usarlos como base visual, no como obligación rígida.

---

# 78. Componentes propios que conviene crear

## StudentRow

Para listas mobile y desktop simplificadas.

Props conceptuales:

```text
name
grade
group
status
financialStatus
```

## FinancialStatus

Renderiza:

```text
Al corriente
$2,350 vencido
$500 a favor
```

## PaymentRow

```text
student
amount
method
date
```

## AccountSummary

```text
totalBalance
overdueBalance
creditBalance
```

## SectionHeader

```text
title
action
```

## EmptyState

```text
title
description
action
```

Esto ayudará a mantener consistencia durante implementación.

---

# 79. Rutas conceptuales de F4

```text
/inicio

/alumnos
/alumnos/[id]
/alumnos/[id]/cuenta
/alumnos/[id]/registrar-pago

/pagos
```

La estructura exacta de rutas puede cambiar si la implementación existente lo requiere.

---

# 80. Flujo completo resumido

```text
Inicio Administrativo
│
├── Buscar alumno
│   └── Ficha del alumno
│       ├── Resumen
│       ├── Estado de cuenta
│       │   └── Detalle de pago
│       └── Registrar pago
│           └── Confirmación
│
├── Registrar pago
│   ├── Buscar alumno
│   ├── Formulario
│   └── Confirmación
│
├── Requieren atención
│   └── Ficha del alumno
│
└── Pagos recientes
    └── Detalle del pago
```

---

# 81. Resultado esperado de F4

Al finalizar este bloque deben quedar diseñadas conceptualmente las pantallas que sostienen la mayor parte de la operación administrativa diaria:

- Inicio Administrativo;
- búsqueda de alumno;
- listado de alumnos;
- ficha del alumno;
- resumen del alumno;
- registro de pago;
- confirmación de pago;
- estado de cuenta;
- detalle de pago;
- corrección/reversión contextual.

Estas pantallas deben convertirse en el primer piloto real de la nueva UI de REAL.

---

# 82. Cierre de F4

F4 debe validarse primero visualmente en:

```text
390px aprox.
```

para móvil, y después en:

```text
desktop 1280–1440px
```

La prioridad es demostrar que el flujo:

```text
Buscar alumno → Registrar pago
```

funciona extremadamente bien desde un teléfono.

Una vez validado este núcleo, el resto de módulos puede heredar sus patrones.

---

# 83. Siguiente bloque recomendado

**F5 — Matrícula, preinscripción y configuración del ciclo**

Incluyendo:

- listado de matrícula;
- preinscripciones;
- nueva preinscripción;
- alta/activación;
- flujo de ingreso tardío;
- configuración financiera durante matrícula;
- cambio de estado;
- creación/configuración de ciclo;
- adaptación mobile/desktop.
