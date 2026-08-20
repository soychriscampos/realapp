# F8 — Tutor + Reportes administrativos

## Objetivo

Definir la experiencia UX/UI del rol Tutor y del módulo de Reportes administrativos de REAL.

Este bloque no redefine reglas de negocio ni modifica la arquitectura de la base de datos. Parte de los bloques funcionales ya cerrados y se concentra exclusivamente en:

- estructura de pantallas;
- navegación;
- jerarquía visual;
- experiencia mobile-first del Tutor;
- selección de hijos;
- estado de cuenta;
- pagos;
- calificaciones;
- disponibilidad de información;
- perfil/acceso;
- reportes administrativos;
- matrícula;
- evolución;
- distribución H/M;
- nivel/grado;
- oficial/no oficial;
- reportes SEP;
- filtros;
- visualizaciones;
- adaptación desktop.

Incluye:

```text
Inicio Tutor
Mis hijos
Ficha simplificada del hijo
Cuenta
Estado de cuenta
Pagos
Calificaciones
Perfil
Reportes
Matrícula actual
Evolución de matrícula
Distribución H/M
Nivel / grado
Oficial / no oficial
SEP por fechas
Visualizaciones
Filtros
Exportación cuando corresponda
```

---

# 1. Principio UX del rol Tutor

La experiencia del Tutor debe ser la más sencilla de REAL.

Debe responder principalmente:

> ¿Cómo está mi hijo y hay algo que necesite revisar?

No debe sentirse como una versión limitada del panel administrativo.

El Tutor no necesita conocer:

- estructuras internas;
- configuración;
- conceptos administrativos;
- estados técnicos;
- lógica financiera compleja.

La interfaz debe traducir todo a información clara y directa.

---

# 2. Uso principal: móvil

El Tutor utilizará REAL principalmente desde teléfono.

Por eso su experiencia debe diseñarse primero para:

```text
390px aprox.
```

y después escalar a tablet/desktop.

La app debe sentirse cercana a una app nativa:

- bottom navigation;
- headers compactos;
- scroll vertical limpio;
- targets táctiles amplios;
- safe areas;
- overscroll controlado;
- textos grandes y claros.

---

# 3. Navegación Tutor — Mobile

Principal:

```text
Inicio
Mis hijos
Pagos
Más
```

Dentro de `Más`:

```text
Calificaciones
Perfil
Cerrar sesión
```

Esta navegación debe mantenerse muy corta.

No agregar destinos poco frecuentes.

---

# 4. Navegación Tutor — Desktop

Sidebar simple:

```text
Inicio
Mis hijos
Pagos
Calificaciones
```

Perfil vive dentro del menú de usuario.

---

# 5. Inicio Tutor

Ruta conceptual:

```text
/inicio
```

para Tutor.

Objetivo:

mostrar el estado actual del hijo o hijos y cualquier información importante.

---

# 6. Header Inicio Tutor

Ejemplo:

```text
Hola, María
```

Debajo:

```text
Ciclo 2026–2027
```

Si tiene un solo hijo, mostrar contexto directamente.

Si tiene varios, mostrar selector.

---

# 7. Selector de hijo

Cuando hay varios hijos:

```text
Ana
Carlos
```

Puede ser:

- segmented control;
- tabs;
- select simple.

Preferencia mobile:

selector horizontal compacto.

Ejemplo:

```text
[Ana] [Carlos]
```

El hijo activo debe ser muy claro.

---

# 8. Estado principal del hijo

Ejemplo:

```text
Ana López
3º Primaria · Grupo A
```

Después:

```text
Cuenta
Al corriente
```

o:

```text
Cuenta
$1,200 vencido
```

La situación financiera debe verse sin entrar a otra pantalla.

---

# 9. Acciones principales Inicio Tutor

Ejemplos:

```text
Ver estado de cuenta
Ver calificaciones
```

No mostrar demasiados botones.

---

# 10. Bloque de Cuenta

Ejemplo al corriente:

```text
Cuenta

Al corriente

Saldo
$0
```

Ejemplo con saldo:

```text
Cuenta

$1,200 vencido

Saldo total
$2,400
```

CTA:

```text
Ver estado de cuenta
```

---

# 11. Bloque de Calificaciones

Si están disponibles:

```text
Calificaciones

Periodo 1
Promedio oficial 9.1
```

CTA:

```text
Ver calificaciones
```

Si no están disponibles:

```text
Calificaciones

Aún no disponibles
```

No exponer el motivo técnico.

---

# 12. Avisos de disponibilidad

Cuando corresponda:

```text
Periodo 1 disponible
```

o:

```text
Las calificaciones aún no están disponibles.
```

La UI no debe revelar reglas internas de autorización.

---

# 13. Inicio Tutor — Mobile

Wireframe conceptual:

```text
┌────────────────────────────┐
│ Hola, María            ◯   │
│ Ciclo 2026–2027            │
│                            │
│ [ Ana ] [ Carlos ]         │
│                            │
│ Ana López                  │
│ 3º Primaria · Grupo A      │
│                            │
│ Cuenta                     │
│ $1,200 vencido             │
│ Saldo total      $2,400    │
│ Ver estado de cuenta   ›   │
│                            │
│ Calificaciones             │
│ Periodo 1                  │
│ Promedio oficial 9.1       │
│ Ver calificaciones     ›   │
│                            │
├────────────────────────────┤
│ Inicio Hijos Pagos Más     │
└────────────────────────────┘
```

---

# 14. Mis hijos

Ruta conceptual:

```text
/tutor/hijos
```

Lista:

```text
Ana López
3º Primaria · Grupo A               ›

Carlos López
1º Secundaria · Grupo A             ›
```

Toda la fila es interactiva.

---

# 15. Ficha simplificada del hijo

Ruta conceptual:

```text
/tutor/hijos/[id]
```

No es la ficha administrativa.

Debe contener únicamente:

```text
Resumen
Cuenta
Calificaciones
```

---

# 16. Header hijo

Mobile:

```text
‹ Mis hijos

Ana López
3º Primaria · Grupo A
```

No mostrar estados administrativos internos.

---

# 17. Resumen del hijo

Contenido:

```text
Cuenta
Al corriente
```

```text
Calificaciones
Periodo 1 · Promedio 9.1
```

Puede incluir información académica básica adicional solo si ya está en alcance.

No duplicar demasiados datos personales.

---

# 18. Cuenta Tutor

Ruta conceptual:

```text
/tutor/hijos/[id]/cuenta
```

Debe ser una versión clara del estado de cuenta administrativo.

---

# 19. Resumen financiero Tutor

Ejemplo:

```text
Saldo total
$2,400

Vencido
$1,200

Saldo a favor
$0
```

El lenguaje debe ser comprensible.

No usar términos contables complejos.

---

# 20. Estado de cuenta

Agrupar por mes:

```text
Septiembre 2026

Colegiatura
$1,200

Pago recibido
-$1,200

Saldo
$0
```

Otro:

```text
Octubre 2026

Colegiatura
$1,200

Pago recibido
-$500

Saldo
$700
```

---

# 21. Historial de pagos Tutor

Ruta conceptual:

```text
/tutor/pagos
```

Puede mostrar todos los pagos de los hijos asociados.

Selector:

```text
Todos
Ana
Carlos
```

---

# 22. Lista de pagos Tutor — Mobile

```text
Ana López
$1,200 · Transferencia
20 ago 2026                          ›
```

Otra:

```text
Carlos López
$950 · Efectivo
15 ago 2026                          ›
```

---

# 23. Detalle de pago Tutor

Read-only.

```text
Pago

$1,200

Ana López
Transferencia
20 ago 2026
```

Puede mostrar:

```text
Referencia
123456
```

si corresponde.

Acción:

```text
Descargar recibo
```

---

# 24. Acciones de cuenta Tutor

Acciones permitidas:

```text
Descargar estado de cuenta
Descargar recibo
```

y compartir/enviar si está implementado.

El Tutor no debe ver:

- corregir;
- revertir;
- configuración financiera;
- historial administrativo.

---

# 25. Calificaciones Tutor

Ruta conceptual:

```text
/tutor/calificaciones
```

Selector de hijo:

```text
Ana López
```

Selector de periodo:

```text
Periodo 1
Periodo 2
Periodo 3
```

---

# 26. Resumen académico Tutor

```text
Promedio oficial
9.1
```

Debajo:

```text
Materias oficiales
```

---

# 27. Materias oficiales

Ejemplo:

```text
Español
9.0
Laura Martínez

Matemáticas
9.4
Carlos Gómez
```

Profesor visible si corresponde.

---

# 28. Materias adicionales

Separar:

```text
Materias adicionales
```

Ejemplo:

```text
Inglés
9.2

Educación Física
10
```

No mezclarlas en el promedio oficial.

---

# 29. Observaciones

Debajo de materia, cuando exista:

```text
Observación

Excelente participación y avance...
```

No esconderla detrás de múltiples taps si cabe claramente.

---

# 30. Calificaciones no disponibles

Estado:

```text
Las calificaciones de este periodo aún no están disponibles.
```

No mostrar:

```text
Acceso bloqueado por RLS
```

ni explicar la lógica interna.

---

# 31. Sin calificaciones capturadas

```text
Aún no hay calificaciones disponibles para este periodo.
```

---

# 32. Perfil Tutor

Ruta:

```text
/perfil
```

Contenido:

```text
Nombre
Correo
```

Acciones:

```text
Cambiar contraseña
Cerrar sesión
```

No mostrar rol técnico si no aporta.

---

# 33. Acceso familiar

La UI de aceptación de invitación forma parte del sistema de acceso definido en F3.

Después de aceptar:

```text
✓ Acceso creado
```

CTA:

```text
Entrar a REAL
```

---

# 34. Responsive Tutor

## Mobile

Prioridad absoluta:

```text
listas
bottom navigation
una columna
acciones grandes
```

## Desktop

Puede mostrar:

```text
sidebar
contenido central
dos columnas ligeras
```

pero sin convertir el Tutor en dashboard.

---

# 35. Accesibilidad Tutor

Respetar:

- tipografía legible;
- targets de 44–48px;
- contraste;
- labels visibles;
- estados textuales;
- navegación simple;
- no depender de iconos;
- no depender de color.

---

# 36. Reportes administrativos

Ruta:

```text
/reportes
```

Disponible para roles autorizados.

Objetivo:

responder preguntas administrativas concretas, no crear un sistema BI complejo.

---

# 37. Landing Reportes

Secciones:

```text
Matrícula
Financieros
SEP / oficiales
```

Cada una abre un conjunto de vistas.

No mostrar quince cards independientes.

---

# 38. Reportes — Mobile

Filas:

```text
Matrícula                           ›
Financieros                         ›
SEP / oficiales                    ›
```

Simple.

---

# 39. Reportes — Desktop

Puede ser lista o grid de máximo 2–3 columnas, con cards muy contenidas si ayudan a escaneo.

No usar mosaico de dashboard colorido.

---

# 40. Reporte Matrícula

Ruta conceptual:

```text
/reportes/matricula
```

Objetivo:

mostrar el panorama actual de alumnos.

---

# 41. KPIs Matrícula

Ejemplo:

```text
Matrícula actual
95 alumnos
```

Después:

```text
Oficial
89

No oficial
6
```

si corresponde a las clasificaciones ya definidas.

---

# 42. Distribución por nivel

Visual recomendada:

barras horizontales.

Ejemplo:

```text
Preescolar     12
Primaria       54
Secundaria     29
```

La gráfica debe acompañar los números, no reemplazarlos.

---

# 43. Distribución por grado

Puede usar barras.

Ejemplo:

```text
1º Primaria      18
2º Primaria      16
3º Primaria      20
...
```

Si hay demasiados grados en móvil, usar scroll vertical natural.

---

# 44. Hombres / Mujeres

Mostrar:

```text
Hombres
48

Mujeres
47
```

Visual sugerida:

- donut simple;
- barras;
- stacked bar.

Preferencia: barras o stacked bar por claridad.

---

# 45. H/M por grado

Ejemplo:

```text
1º Primaria
H 9 · M 9

2º Primaria
H 8 · M 8
```

Puede representarse con stacked horizontal bars.

---

# 46. Oficial / no oficial

Mostrar como distribución clara.

Ejemplo:

```text
Oficial
89

No oficial
6
```

No usar terminología distinta a la ya definida.

---

# 47. Filtros de reporte Matrícula

Filtros:

```text
Ciclo
Fecha
Nivel
Grado
```

Solo mostrar los filtros que afecten realmente la consulta.

---

# 48. Selector de fecha

Para panorama histórico:

```text
Fecha
[20 ago 2026]
```

Debe permitir responder cuántos alumnos había en esa fecha si la información derivada lo soporta.

---

# 49. Evolución de matrícula

Ruta conceptual:

```text
/reportes/matricula/evolucion
```

Objetivo:

responder:

> ¿Cómo ha evolucionado la matrícula?

---

# 50. Selector de rango

```text
Desde
[Septiembre 2026]

Hasta
[Junio 2027]
```

Puede permitir fechas exactas si el reporte está definido por fechas.

---

# 51. Gráfica de evolución

Preferencia:

línea.

Ejemplo:

```text
Sep  91
Oct  94
Nov  96
Dic  95
Ene  97
...
Jun  89
```

La gráfica debe mostrar puntos claros.

---

# 52. Resumen de evolución

Debajo:

```text
Inicio del rango
91

Fin del rango
89

Cambio
-2
```

Puede mostrar porcentaje si realmente aporta.

---

# 53. Tooltip de gráfica

Al tocar/pasar:

```text
15 oct 2026
94 alumnos
```

En móvil debe funcionar por tap, no solo hover.

---

# 54. Tabla complementaria

Debajo de gráfica:

```text
Fecha          Matrícula
-------------------------
Sep 2026       91
Oct 2026       94
...
```

Esto ayuda para lectura exacta y accesibilidad.

---

# 55. Reportes financieros

Ruta conceptual:

```text
/reportes/financieros
```

Debe respetar permisos por rol.

---

# 56. KPIs financieros

Inspirados en la referencia visual financiera:

```text
Cobrado
$184,300

Saldo vencido
$42,500

Al corriente
78%
```

Solo mostrar indicadores ya soportados y autorizados.

---

# 57. Evolución financiera

Puede mostrar:

- pagos por periodo;
- saldo vencido;
- distribución por método;

si esos reportes están contemplados funcionalmente.

No inventar métricas nuevas.

---

# 58. Método de pago

Visual:

```text
Efectivo
$...

Transferencia
$...

Especie
$...
```

Barras horizontales o donut simple.

---

# 59. Filtros financieros

Ejemplos:

```text
Fecha inicial
Fecha final
Nivel
Grado
Método
```

Solo si realmente afectan el reporte.

---

# 60. Reportes SEP / oficiales

Ruta conceptual:

```text
/reportes/sep
```

Objetivo:

obtener la población correspondiente según rango de fechas y clasificación oficial definida.

---

# 61. Filtros SEP

```text
Fecha inicial
[________]

Fecha final
[________]

Nivel
[Todos]
```

Acción:

```text
Generar reporte
```

---

# 62. Resultado SEP

Resumen:

```text
Periodo
1 sep 2026 — 30 sep 2026

Alumnos considerados
89
```

Después puede mostrar:

- nivel;
- grado;
- sexo;
- clasificación correspondiente.

---

# 63. Distribución SEP por nivel

Ejemplo:

```text
Preescolar   11
Primaria     51
Secundaria   27
```

---

# 64. Distribución SEP H/M

```text
Hombres
45

Mujeres
44
```

---

# 65. Tabla detallada SEP

Cuando sea necesaria:

```text
Grado           Hombres    Mujeres    Total
--------------------------------------------
1º Primaria     9          9          18
2º Primaria     8          8          16
```

Desktop: tabla.

Mobile: filas agrupadas.

---

# 66. Mobile de reportes

No comprimir dashboards desktop.

Ejemplo:

```text
Matrícula actual
95

[gráfica]

Por nivel
Preescolar 12
Primaria   54
Secundaria 29

H/M
Hombres 48
Mujeres 47
```

Una sección debajo de otra.

---

# 67. Desktop de reportes

Puede aprovechar dos columnas.

Ejemplo:

```text
Matrícula actual        H/M
[gráfica]               [gráfica]

Por nivel
[gráfica amplia]
```

Mantener suficiente aire.

---

# 68. Gráficas

Reglas:

- responder una pregunta;
- pocas series;
- colores sobrios;
- etiquetas legibles;
- tooltip;
- números visibles;
- versión usable en touch.

Preferidas:

```text
Bar
Line
Stacked Bar
Donut solo cuando aporte
```

Evitar:

```text
3D
radar
pie con muchas categorías
gradientes decorativos
```

---

# 69. Colores en gráficas

Usar la paleta definida en F3.

No introducir nuevos colores arbitrarios.

Para H/M, categorías o estados:

- mantener consistencia;
- no usar estereotipos visuales innecesarios;
- priorizar contraste y lectura.

---

# 70. Exportación

Cuando el reporte lo permita:

```text
Descargar
```

o:

```text
Exportar
```

Puede abrir menu:

```text
PDF
Excel / CSV
```

solo si esos formatos están implementados.

No mostrar opciones ficticias.

---

# 71. Mobile export

Acción secundaria en:

```text
···
```

o botón:

```text
Descargar
```

si es una tarea frecuente.

---

# 72. Estado vacío de reportes

Ejemplo:

```text
No hay datos para este rango.
```

Acción:

```text
Cambiar filtros
```

---

# 73. Loading de reportes

Skeleton para:

- KPIs;
- gráficas;
- filas.

No spinner central bloqueante.

---

# 74. Error de reporte

```text
No pudimos generar el reporte.

Inténtalo de nuevo.
```

Preservar filtros seleccionados.

---

# 75. Filtros mobile

Bottom sheet:

```text
Filtros

Ciclo
[2026–2027]

Nivel
[Todos]

Fecha inicial
[________]

Fecha final
[________]

[Aplicar]
```

---

# 76. Filtros desktop

Barra horizontal si caben:

```text
[Ciclo] [Nivel] [Fecha inicial] [Fecha final] [Aplicar]
```

Si son demasiados, usar botón `Filtros`.

---

# 77. Preservación de contexto

Al cambiar entre vistas de un mismo reporte, preservar:

- ciclo;
- rango;
- nivel;

cuando tenga sentido.

No obligar a configurar filtros repetidamente.

---

# 78. Navegación entre reportes

Dentro de Matrícula:

```text
Resumen
Evolución
Por nivel
Por grado
```

Puede usarse tab/segmented control.

No crear rutas completamente desconectadas visualmente.

---

# 79. Reporte desde Inicio Master

El Inicio puede mostrar un preview.

Ejemplo:

```text
Matrícula actual
95 alumnos

Ver reporte
```

No duplicar todo el módulo de Reportes en Inicio.

---

# 80. Reporte desde ficha del alumno

No mezclar reportes globales dentro de la ficha.

La ficha mantiene contexto individual.

---

# 81. Accesibilidad de gráficas

Cada gráfica debe tener equivalente textual o numérico.

Ejemplo:

```text
Primaria 54
Secundaria 29
Preescolar 12
```

No depender únicamente de forma/color.

---

# 82. Componentes shadcn sugeridos

Para Tutor:

```text
Button
Tabs
Badge
Sheet
DropdownMenu
Separator
Skeleton
ScrollArea
```

Para Reportes:

```text
Button
Tabs
Select / Combobox
Calendar
Popover
Sheet
Badge
Separator
Skeleton
Tooltip
```

Y librería de gráficas compatible con el stack existente.

---

# 83. Componentes propios recomendados — Tutor

## ChildSelector

```text
children
activeChild
```

## ChildSummary

```text
name
grade
group
```

## TutorAccountSummary

```text
totalBalance
overdueBalance
creditBalance
status
```

## TutorGradeSummary

```text
period
officialAverage
availability
```

## TutorPaymentRow

```text
child
amount
method
date
```

---

# 84. Componentes propios recomendados — Reportes

## ReportKPI

```text
label
value
secondary
```

## ReportFilterBar

```text
cycle
dateRange
level
grade
```

## EnrollmentDistribution

```text
categories
values
```

## EnrollmentEvolution

```text
dates
totals
```

## GenderDistribution

```text
male
female
```

## ReportTable

Versión desktop y mobile adaptada.

---

# 85. Rutas conceptuales Tutor

```text
/tutor
/tutor/hijos
/tutor/hijos/[id]
/tutor/hijos/[id]/cuenta
/tutor/pagos
/tutor/calificaciones
/perfil
```

---

# 86. Rutas conceptuales Reportes

```text
/reportes
/reportes/matricula
/reportes/matricula/evolucion
/reportes/financieros
/reportes/sep
```

La implementación final puede adaptar las rutas.

---

# 87. Flujo resumido Tutor

```text
Inicio
↓
Seleccionar hijo
↓
Cuenta o Calificaciones
↓
Consultar información
```

La navegación debe ser extremadamente corta.

---

# 88. Flujo resumido Reporte Matrícula

```text
Reportes
↓
Matrícula
↓
Seleccionar ciclo / filtros
↓
Resumen
↓
Evolución / distribución
```

---

# 89. Flujo resumido SEP

```text
Reportes
↓
SEP / oficiales
↓
Rango de fechas
↓
Nivel
↓
Generar
↓
Resumen + detalle
↓
Descargar si corresponde
```

---

# 90. Qué NO hacer — Tutor

No:

- mostrar navegación administrativa;
- mostrar estados técnicos;
- enseñar configuración financiera;
- permitir correcciones;
- saturar Inicio con datos;
- usar tablas estrechas en móvil;
- esconder información importante tras demasiados taps;
- mostrar materias adicionales dentro del promedio oficial;
- explicar internamente por qué una calificación no está disponible.

---

# 91. Qué NO hacer — Reportes

No:

- construir dashboard BI genérico;
- usar demasiadas gráficas;
- añadir métricas no definidas;
- usar 3D;
- depender de hover;
- ocultar cifras exactas detrás de gráficas;
- comprimir tablas desktop en móvil;
- pedir filtros repetidamente;
- mezclar reportes globales con ficha individual;
- mostrar información agregada a roles no autorizados.

---

# 92. Prueba de éxito Tutor

F8 debe considerarse correcto si un Tutor puede:

1. abrir REAL desde el teléfono;
2. cambiar entre hijos si tiene varios;
3. saber si existe un saldo pendiente;
4. abrir su estado de cuenta;
5. revisar pagos;
6. consultar calificaciones disponibles;

sin instrucciones externas.

---

# 93. Prueba de éxito Reportes

Debe ser posible que Master/Administrativo autorizado:

1. abra Reportes;
2. elija una pregunta concreta;
3. seleccione rango/ciclo;
4. interprete rápidamente los números;
5. cambie entre resumen y detalle;
6. descargue cuando corresponda;

sin tener que conocer nombres de tablas ni conceptos técnicos.

---

# 94. Resultado esperado de F8

Al finalizar este bloque quedan diseñados conceptualmente:

- experiencia completa Tutor;
- Inicio Tutor;
- selector de hijos;
- ficha simplificada;
- cuenta;
- pagos;
- estado de cuenta;
- recibos;
- calificaciones;
- observaciones;
- materias oficiales/adicionales;
- perfil;
- módulo Reportes;
- matrícula actual;
- evolución;
- distribución por nivel;
- distribución por grado;
- H/M;
- oficial/no oficial;
- financieros;
- SEP por fechas;
- visualizaciones;
- filtros;
- exportación;
- mobile/tablet/desktop.

---

# 95. Cierre de F8

El principio rector del Tutor es:

> Mostrar únicamente lo que necesita para entender la situación de sus hijos, con una experiencia simple y móvil.

El principio rector de Reportes es:

> Cada vista debe responder una pregunta administrativa concreta y mostrar el dato con la menor fricción posible.

---

# 96. Siguiente bloque recomendado

**F9 — Estados transversales + QA UX + handoff de implementación**

Incluyendo:

- loading;
- skeletons;
- empty states;
- errores;
- permisos;
- disabled;
- confirmaciones;
- toasts;
- dialogs;
- sheets;
- teclado móvil;
- safe areas;
- overscroll;
- responsive final;
- accesibilidad;
- datos largos;
- nombres largos;
- montos grandes;
- edge cases;
- inventario final de componentes;
- mapa de rutas;
- checklist de QA UX;
- orden recomendado de implementación.
