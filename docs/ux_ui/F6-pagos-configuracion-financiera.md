# F6 — Pagos globales + configuración financiera

## Objetivo

Definir la experiencia UX/UI del módulo global de Pagos y de la configuración financiera de REAL.

Este bloque no redefine reglas de negocio ni modifica la arquitectura de la base de datos. Parte de los bloques funcionales ya cerrados y se concentra exclusivamente en:

- estructura de pantallas;
- jerarquía visual;
- navegación;
- acciones;
- filtros;
- formularios;
- confirmaciones;
- estados;
- comportamiento mobile-first;
- adaptación desktop.

Incluye:

```text
Módulo global de Pagos
Búsqueda y filtros
Registro de pago desde módulo global
Pago a nombre de otro receptor
Detalle de pago
Corrección de datos no financieros
Reversión
Recibos
Configuración financiera
Precios base
Categorías
Descuentos
Becas
Importe individual
Cambios de precio
Confirmaciones financieras
```

---

# 1. Principio UX del módulo Pagos

El módulo Pagos debe responder rápidamente:

> ¿Qué pagos se han registrado, quién los recibió y qué necesito consultar o corregir?

No debe sentirse como un sistema contable tradicional.

Debe priorizar:

- búsqueda;
- lectura rápida;
- trazabilidad;
- acceso inmediato al alumno;
- registro de pago;
- correcciones autorizadas;
- claridad de montos.

---

# 2. Ruta principal

Ruta conceptual:

```text
/pagos
```

Header:

```text
Pagos
```

Acción primaria:

```text
Registrar pago
```

En desktop a la derecha del header.

En móvil debe ser visible sin entrar en menús secundarios.

---

# 3. Diferencias por rol

## Master

Puede:

- consultar todos los pagos;
- registrar pagos;
- registrar un pago a nombre de otro receptor autorizado;
- corregir pagos ajenos;
- revertir pagos según reglas;
- acceder a configuración financiera.

## Administrativo

Puede:

- registrar pagos;
- consultar pagos en los contextos permitidos;
- corregir sus propios pagos;
- consultar pagos de otros al ver un alumno;
- no debe recibir acceso global a información que funcionalmente se haya restringido.

La interfaz debe adaptarse por permisos.

No mostrar acciones que terminarán siempre en error de autorización.

---

# 4. Inicio de Pagos

Jerarquía recomendada:

```text
Header
↓
Acción Registrar pago
↓
Búsqueda
↓
Filtros
↓
Resumen permitido por rol
↓
Pagos recientes / resultados
```

---

# 5. Header mobile

```text
Pagos                    +
```

El botón `+` puede representar Registrar pago solo si lleva label accesible.

Preferencia visual:

```text
[ Registrar pago ]
```

cuando el espacio lo permita.

Debajo:

```text
[⌕ Buscar pago o alumno...]
```

---

# 6. Header desktop

```text
Pagos                                  [Registrar pago]
```

Debajo:

```text
[ Buscar alumno, recibo o referencia... ]   [Filtros]
```

---

# 7. Búsqueda

Debe permitir encontrar pagos mediante información relevante como:

- alumno;
- recibo;
- referencia bancaria;
- receptor;
- fecha, cuando aplique mediante filtros.

Placeholder:

```text
Buscar alumno, recibo o referencia...
```

No mostrar IDs internos.

---

# 8. Resultados mobile

Fila:

```text
Ana López
$1,200 · Transferencia
Hoy · 10:42 · Recibió Fran             ›
```

Otra:

```text
Luis Pérez
$950 · Efectivo
Ayer · 12:15 · Recibió María           ›
```

Toda la fila es interactiva.

---

# 9. Resultados desktop

Tabla ligera:

```text
Alumno        Monto     Método          Fecha        Receptor
----------------------------------------------------------------
Ana López     $1,200    Transferencia   20 ago       Fran
Luis Pérez    $950      Efectivo        19 ago       María
```

Opcional:

```text
Referencia
```

solo si aporta y hay espacio.

---

# 10. Filtros

Filtros posibles:

- fecha;
- método;
- receptor;
- alumno;
- estado técnico visible solo si existe un concepto funcional correspondiente.

## Mobile

Bottom sheet:

```text
Filtros

Fecha
[Hoy]

Método
[Todos]

Receptor
[Todos]

[Aplicar filtros]
```

Acción secundaria:

```text
Limpiar
```

---

# 11. Resumen financiero

Solo mostrar agregados permitidos por rol.

## Master

Puede incluir KPIs compactos:

```text
Hoy
$12,450

Este mes
$184,300

Pagos registrados
42
```

No usar cards grandes de colores.

## Administrativo

Si no tiene permitido un resumen global de ingresos, no mostrarlo.

Puede mostrarse únicamente información operativa autorizada.

---

# 12. Registro de pago desde módulo global

Al iniciar desde `/pagos`, primero debe seleccionarse el alumno.

Pantalla:

```text
Registrar pago

¿A quién corresponde el pago?

[⌕ Buscar alumno...]
```

Resultados:

```text
Ana López
3º Primaria · Grupo A
Al corriente                         ›

Luis Pérez
1º Secundaria · Grupo A
$2,350 vencido                       ›
```

---

# 13. Selección de alumno

Al tocar un alumno:

```text
Registrar pago

Ana López
3º Primaria · Grupo A

Saldo actual
$2,350 vencido
```

Después se presenta el mismo formulario de pago definido en F4.

No duplicar dos experiencias distintas.

---

# 14. Formulario de pago

Orden recomendado:

```text
Monto
Método
Fecha
Referencia
Observación
```

Campos secundarios deben aparecer de forma contextual.

---

# 15. Monto

Input principal:

```text
Monto

$ [1,200.00]
```

Mobile:

- teclado numérico;
- tamaño visible;
- input alto;
- símbolo de moneda persistente.

---

# 16. Método de pago

Opciones:

```text
○ Efectivo
○ Transferencia
○ Especie
```

RadioGroup es preferible a Select porque solo existen pocas opciones.

---

# 17. Transferencia

Si se selecciona:

```text
Transferencia
```

mostrar:

```text
Referencia bancaria
[________________]
```

Puede permanecer opcional si así está definido funcionalmente.

---

# 18. Pago en especie

Si se selecciona:

```text
Especie
```

mostrar únicamente los campos que funcionalmente correspondan.

No inventar campos nuevos.

---

# 19. Fecha del pago

```text
Fecha
[20 ago 2026]
```

Usar DatePicker/Calendar.

Debe permitir registrar la fecha permitida por las reglas existentes.

---

# 20. Observación

```text
Observación
[________________________]
```

Opcional.

No ocupar demasiado espacio al inicio.

---

# 21. Aplicación del pago

Antes de confirmar, mostrar cómo se aplicará el monto si la información está disponible.

Ejemplo:

```text
Aplicación

Saldo anterior
$400

Colegiatura septiembre
$800

Total
$1,200
```

Debe ser visualmente read-only.

---

# 22. Pago parcial

Si el monto no cubre toda la obligación:

```text
Pago parcial

Monto recibido
$500

Saldo pendiente
$700
```

No usar mensajes alarmistas.

---

# 23. Excedente / saldo a favor

Si el pago genera excedente:

```text
Saldo a favor resultante
$300
```

Debe quedar explícito antes de confirmar si esa información puede calcularse.

---

# 24. Pago primero a deuda anterior

La interfaz puede mostrar la aplicación resultante:

```text
Aplicación

Deuda anterior
$400

Colegiatura actual
$800
```

No necesita explicar la regla internamente.

Solo mostrar el resultado.

---

# 25. Excepción de aplicación

Cuando el flujo autorizado permita una excepción, debe aparecer como una acción secundaria explícita.

No mostrarla a usuarios sin permiso.

No convertirla en comportamiento ambiguo.

---

# 26. Master registrando a nombre de otro receptor

Solo Master.

Dentro del formulario:

```text
Recibido por
[Fran López]
```

Por defecto puede aparecer el usuario actual cuando corresponda.

Si Master necesita registrar a nombre de otra persona:

```text
Recibido por
[Seleccionar receptor]
```

El selector debe mostrar solo receptores autorizados.

---

# 27. Receptor original

Una vez registrado el pago, el receptor original no cambia por una corrección posterior.

En detalle:

```text
Recibido por
Fran López
```

Y si hubo corrección:

```text
Última corrección
Christian · 20 ago 2026 · 12:42
```

Esto diferencia claramente:

- quién recibió;
- quién corrigió.

---

# 28. Confirmación antes de registrar

No necesariamente requiere un dialog adicional si existe un resumen claro.

Pantalla:

```text
Registrar pago

Ana López
$1,200
Transferencia
20 ago 2026

Aplicación
...
```

CTA:

```text
Registrar pago
```

---

# 29. Confirmación exitosa

```text
✓ Pago registrado

$1,200

Ana López
Transferencia
20 ago 2026

Recibido por
Fran López
```

Acciones:

```text
Descargar recibo
Enviar recibo
Volver al alumno
```

---

# 30. Recibos

REAL no debe mostrar flujo de almacenamiento de archivos de comprobantes si no existe funcionalmente.

Acciones:

```text
Descargar recibo
Enviar recibo
```

Si se envía por email:

```text
Enviar por correo
```

y mostrar confirmación mediante toast.

---

# 31. Toast de envío

```text
✓ Recibo enviado
```

Si falla:

```text
No pudimos enviar el recibo.
```

Puede ofrecer:

```text
Intentar de nuevo
```

---

# 32. Detalle de pago

Puede abrir como Sheet en desktop y pantalla/sheet amplio en mobile.

Contenido:

```text
Pago

$1,200

Ana López
Transferencia
20 ago 2026 · 10:42

Recibido por
Fran López

Referencia
123456
```

---

# 33. Aplicaciones del pago

Debajo:

```text
Aplicación

Saldo anterior
$400

Colegiatura septiembre
$800
```

Si existe saldo a favor generado:

```text
Saldo a favor
$300
```

---

# 34. Acciones del detalle

Primarias:

```text
Descargar recibo
Enviar recibo
```

Secundarias:

```text
···
```

Dentro:

```text
Corregir datos
Revertir pago
```

según permisos.

---

# 35. Corrección de datos no financieros

Solo campos permitidos.

Ejemplo:

```text
Corregir pago

Referencia bancaria
[123456]

Observación
[________________]

Concepto visible en recibo
[________________]
```

No permitir editar:

- monto;
- receptor original;
- aplicación financiera;

si las reglas existentes no lo permiten mediante este flujo.

---

# 36. Motivo de corrección

Cuando corresponda:

```text
Motivo de la corrección
[________________________]
```

Debe ser obligatorio si así está definido.

CTA:

```text
Guardar corrección
```

---

# 37. Confirmación de corrección

Toast:

```text
✓ Pago actualizado
```

El detalle debe mostrar:

```text
Corregido por
Christian
```

cuando corresponda.

---

# 38. Reversión

Acción sensible.

Ubicación:

```text
··· → Revertir pago
```

Nunca como botón rojo principal.

---

# 39. Dialog de reversión

```text
Revertir pago

Se revertirá el pago de $1,200
registrado a Ana López.

Motivo
[________________________]

[Cancelar]
[Revertir pago]
```

El motivo es obligatorio cuando la regla lo exige.

---

# 40. Pago revertido

Después:

```text
Pago revertido
```

El registro debe seguir visible como parte del historial.

No debe desaparecer visualmente como si nunca hubiera existido.

---

# 41. Visual de pago revertido

Ejemplo:

```text
$1,200
Transferencia
Revertido
```

Badge suave de estado.

En detalle:

```text
Revertido por
Christian

Motivo
Registro duplicado
```

---

# 42. Sin cierres de caja

El módulo Pagos no debe contener:

- Abrir caja;
- Cerrar caja;
- Arqueo;
- Turno de caja.

No diseñar elementos de ese tipo.

---

# 43. Pagos fuera de horario

La UI no debe presentar un concepto de “caja cerrada”.

Los pagos pueden registrarse conforme a las reglas existentes sin depender de un cierre diario.

---

# 44. Estado “al corriente”

En contextos de alumno:

```text
Al corriente
```

Debe derivarse de la lógica existente.

No crear botones manuales para marcar a un alumno “al corriente”.

---

# 45. Configuración financiera

Ruta conceptual:

```text
/configuracion/finanzas
```

Acceso para roles autorizados.

Landing:

```text
Configuración financiera
```

Secciones:

```text
Precios por nivel
Categorías
Descuentos y becas
Configuración por alumno
```

No es necesario que sean cuatro módulos de sidebar.

---

# 46. Pantalla de configuración financiera

Preferencia:

lista de secciones con navegación contextual.

Ejemplo:

```text
Configuración financiera

Precios por nivel                    ›
Categorías                           ›
Descuentos y becas                   ›
Configuración por alumno             ›
```

Inspirado en settings modernos.

---

# 47. Precios por nivel

Pantalla:

```text
Precios por nivel
Ciclo 2026–2027
```

Lista:

```text
Preescolar
$1,000

Primaria
$1,200

Secundaria
$1,350
```

Acción:

```text
Editar
```

---

# 48. Editar precios por nivel

Formulario:

```text
Primaria

Precio base
$ [1,200]
```

Antes de guardar, mostrar las consecuencias que correspondan según reglas ya cerradas.

No aplicar cambios silenciosos.

---

# 49. Confirmación de cambio de precio

Cuando cambiar un precio implique elegir alcance:

```text
Aplicar cambio

○ Presente
○ Siguiente periodo
○ Proporcional
```

Mostrar únicamente las opciones válidas para ese caso.

---

# 50. Resumen antes de confirmar precio

```text
Precio anterior
$1,200

Nuevo precio
$1,300

Aplicación
Siguiente periodo
```

CTA:

```text
Confirmar cambio
```

---

# 51. Categorías

Pantalla:

```text
Categorías
Ciclo 2026–2027
```

Ejemplo:

```text
Regular
$1,200

Beca 50%
$600

Beca 100%
$0
```

La UI debe mostrar cómo impacta cada categoría.

---

# 52. Crear categoría

Acción:

```text
+ Nueva categoría
```

Formulario conceptual:

```text
Nombre
[________________]

Tipo
○ Porcentaje
○ Monto fijo
○ Importe definido
```

Solo incluir tipos realmente soportados.

---

# 53. Categoría por ciclo

Debe quedar visualmente claro que la categoría corresponde al ciclo.

Ejemplo:

```text
Ciclo
2026–2027
```

No presentar categorías como configuraciones globales permanentes si funcionalmente no lo son.

---

# 54. Cambiar categoría de un alumno

Desde ficha del alumno:

```text
Cuenta / Configuración financiera
```

Acción:

```text
Cambiar categoría
```

Puede abrir pantalla o Sheet.

---

# 55. Flujo Cambiar categoría

```text
Categoría actual
Regular

Nueva categoría
[Beca 50%]

Fecha efectiva
[20 ago 2026]
```

Después mostrar:

```text
Nuevo importe
$600
```

CTA:

```text
Continuar
```

---

# 56. Confirmación explícita

Antes de aplicar:

```text
Cambiar categoría

Regular → Beca 50%

Fecha efectiva
20 ago 2026

Nuevo importe
$600

Motivo
[________________]
```

CTA:

```text
Confirmar cambio
```

---

# 57. Beca 100%

La interfaz debe mostrar:

```text
Beca 100%

Importe
$0
```

y mantener visible la obligación correspondiente en cero cuando aplique.

No ocultar el periodo como si no existiera.

---

# 58. Importe individual

Dentro de configuración financiera del alumno:

```text
Importe individual

Precio base
$1,200

Importe actual
$1,050
```

Acción:

```text
Modificar importe
```

---

# 59. Modificar importe individual

Formulario:

```text
Precio sugerido
$1,200

Importe acordado
$ [1,050]

Fecha efectiva
[20 ago 2026]

Motivo
[________________]
```

La persona autorizada debe aceptar o definir explícitamente el monto.

---

# 60. Resumen de cambio individual

```text
Importe anterior
$1,200

Nuevo importe
$1,050

Fecha efectiva
20 ago 2026
```

CTA:

```text
Confirmar cambio
```

---

# 61. Descuentos

Pantalla:

```text
Descuentos y becas
```

Listado:

```text
Hermanos
10%

Beca académica
50%

Beca completa
100%
```

La presentación debe distinguir:

- porcentaje;
- monto fijo;
- importe resultante;

según el tipo soportado.

---

# 62. Crear descuento

Formulario:

```text
Nombre
[________________]

Tipo
○ Porcentaje
○ Monto fijo

Valor
[________]
```

Ciclo:

```text
2026–2027
```

si corresponde.

---

# 63. Asignar descuento

Desde alumno:

```text
Aplicar descuento
```

Flujo:

```text
Descuento
[Beca 50%]

Fecha efectiva
[20 ago 2026]

Motivo
[________________]
```

Resumen:

```text
Precio base
$1,200

Nuevo importe
$600
```

---

# 64. Historial financiero de configuración

En la ficha del alumno puede existir:

```text
Historial de configuración
```

Ejemplo:

```text
20 ago
Categoría cambiada
Regular → Beca 50%

15 ago
Importe individual actualizado
$1,200 → $1,050
```

No mostrar logs técnicos.

---

# 65. Configuración financiera mobile

No intentar mostrar una gran tabla de settings.

Usar filas:

```text
Precio base
$1,200                              ›

Categoría
Beca 50%                            ›

Importe individual
$600                                ›

Plan
12 pagos                            ›
```

Cada fila abre detalle o edición.

---

# 66. Configuración financiera desktop

Puede usar dos columnas:

```text
Configuración actual        Historial
```

pero sin saturar.

Preferencia general: sección principal + panel contextual.

---

# 67. Acciones sensibles financieras

Cambios como:

- importe individual;
- categoría;
- descuento;
- precio base;

deben tener:

- resumen previo;
- confirmación explícita;
- motivo cuando corresponda;
- fecha efectiva visible.

---

# 68. No usar auto-save en cambios sensibles

No guardar automáticamente cambios financieros apenas se selecciona una opción.

Debe existir:

```text
Confirmar cambio
```

---

# 69. Toasts financieros

Ejemplos:

```text
✓ Precio actualizado
```

```text
✓ Categoría actualizada
```

```text
✓ Descuento aplicado
```

```text
✓ Pago corregido
```

---

# 70. Error de cambio financiero

Preservar el formulario.

Mensaje:

```text
No pudimos aplicar el cambio.

Revisa la información e inténtalo de nuevo.
```

No borrar el motivo ni los valores.

---

# 71. Loading

Botones:

```text
Guardando...
Confirmando...
Registrando...
```

disabled durante la operación.

Evitar doble submit.

---

# 72. Empty states

Ejemplo de pagos:

```text
No hay pagos en este periodo.
```

Ejemplo de categorías:

```text
No hay categorías configuradas para este ciclo.
```

Acción:

```text
Nueva categoría
```

si corresponde.

---

# 73. Skeletons

Módulo Pagos:

- header;
- búsqueda;
- filtros;
- filas.

Configuración financiera:

- títulos;
- valores;
- acciones.

No usar spinner bloqueando toda la app.

---

# 74. Mobile-first

Pagos debe funcionar extremadamente bien desde teléfono.

Acciones críticas:

```text
Buscar alumno
Registrar pago
Confirmar
Descargar / enviar recibo
```

deben ser fáciles de alcanzar.

---

# 75. Targets táctiles

Mínimo:

```text
44px
```

Preferencia para acciones principales:

```text
48px
```

Especialmente importante para administrativos mayores.

---

# 76. Responsive de pagos

## Mobile

```text
listas
bottom sheets
pantallas dedicadas
acciones grandes
```

## Desktop

```text
tabla ligera
sidebar
sheets
más información simultánea
```

La lógica no cambia.

---

# 77. Accesibilidad

Respetar:

- labels visibles;
- focus claro;
- errores inline;
- no depender del color;
- botones descriptivos;
- montos con formato legible;
- menú `···` con labels completos;
- navegación por teclado en desktop.

---

# 78. Componentes shadcn sugeridos

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
Checkbox
Textarea
Calendar
Popover
Select / Combobox
Toast / Sonner
Skeleton
ScrollArea
```

---

# 79. Componentes propios recomendados

## PaymentRow

```text
student
amount
method
date
receiver
status
```

## PaymentDetail

```text
amount
student
method
date
receiver
reference
applications
```

## PaymentApplicationSummary

```text
charges
credits
remaining
```

## FinancialStatus

```text
current
overdue
credit
```

## FinancialSettingRow

```text
label
value
action
```

## PriceChangeSummary

```text
previousPrice
newPrice
effectiveMode
effectiveDate
```

## CategoryRow

```text
name
type
value
effectiveAmount
```

---

# 80. Rutas conceptuales

```text
/pagos
/pagos/nuevo
/pagos/[id]

/configuracion/finanzas
/configuracion/finanzas/precios
/configuracion/finanzas/categorias
/configuracion/finanzas/descuentos

/alumnos/[id]/cuenta
/alumnos/[id]/configuracion-financiera
```

La implementación final puede adaptar las rutas.

---

# 81. Flujo resumido de pago

```text
Pagos
↓
Registrar pago
↓
Buscar alumno
↓
Monto / método / fecha
↓
Aplicación
↓
Confirmar
↓
Pago registrado
↓
Recibo / alumno
```

---

# 82. Flujo resumido de corrección

```text
Pago
↓
Detalle
↓
···
↓
Corregir datos
↓
Motivo
↓
Confirmar
```

---

# 83. Flujo resumido de reversión

```text
Pago
↓
Detalle
↓
···
↓
Revertir pago
↓
Motivo
↓
Confirmación
↓
Pago revertido
```

---

# 84. Flujo resumido de cambio financiero

```text
Alumno
↓
Configuración financiera
↓
Seleccionar cambio
↓
Nuevo valor
↓
Fecha efectiva
↓
Motivo
↓
Resumen
↓
Confirmar
```

---

# 85. Qué NO hacer

No:

- diseñar cierres de caja;
- crear arqueos;
- bloquear pagos por horario;
- esconder Registrar pago;
- permitir edición directa de valores financieros sensibles sin confirmación;
- cambiar receptor original mediante corrección;
- borrar visualmente pagos revertidos;
- mostrar al Administrativo información global que no le corresponde;
- crear tablas ilegibles en móvil;
- llenar la pantalla con KPIs;
- usar auto-save en cambios financieros;
- inventar conceptos contables no definidos;
- mostrar errores técnicos al usuario.

---

# 86. Prueba de éxito del módulo Pagos

F6 debe considerarse correcto si un administrativo puede:

1. abrir Pagos;
2. buscar un alumno;
3. registrar un pago;
4. entender cómo se aplicó;
5. entregar o enviar recibo;

sin necesitar explicación externa.

Y si Master puede:

1. localizar un pago;
2. identificar receptor original;
3. corregir datos permitidos;
4. revertir cuando corresponda;
5. cambiar configuración financiera;

sin ambigüedad entre recepción, corrección y autorización.

---

# 87. Resultado esperado de F6

Al finalizar este bloque quedan diseñados conceptualmente:

- módulo global Pagos;
- búsqueda;
- filtros;
- KPIs permitidos;
- registro desde módulo global;
- selección de alumno;
- pago parcial;
- saldo a favor;
- aplicación a deuda anterior;
- receptor original;
- Master registrando a nombre de otro;
- detalle de pago;
- recibos;
- corrección;
- reversión;
- precios base;
- categorías;
- descuentos;
- becas;
- importe individual;
- cambios efectivos;
- historial financiero;
- mobile/tablet/desktop.

---

# 88. Cierre de F6

El principio rector es:

> Pagos debe optimizar la operación diaria, mientras que la configuración financiera debe hacer explícitos los cambios sensibles antes de aplicarlos.

La interfaz debe mantener separados:

```text
Registrar
Consultar
Corregir
Configurar
```

sin convertirlos en módulos desconectados.

---

# 89. Siguiente bloque recomendado

**F7 — Académico + Profesor**

Incluyendo:

- inicio Profesor;
- mis grupos;
- materias;
- captura de calificaciones;
- observaciones cualitativas;
- histórico;
- periodos;
- captura abierta/cerrada;
- administración de profesores;
- asignaciones;
- grupos;
- correcciones administrativas;
- mobile/desktop.
