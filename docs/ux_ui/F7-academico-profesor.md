# F7 — Académico + Profesor

## Objetivo

Definir la experiencia UX/UI del módulo académico y de la experiencia específica del rol Profesor en REAL.

Este bloque no redefine reglas de negocio ni modifica la arquitectura de la base de datos. Parte de las reglas funcionales ya cerradas y se concentra exclusivamente en:

- estructura de pantallas;
- navegación;
- jerarquía visual;
- captura de calificaciones;
- visualización de grupos y materias;
- observaciones cualitativas;
- periodos;
- estados de captura;
- administración de profesores;
- asignaciones;
- correcciones administrativas;
- comportamiento mobile-first;
- adaptación desktop.

Incluye:

```text
Inicio Profesor
Mis grupos
Grupo / materia
Captura de calificaciones
Observaciones cualitativas
Histórico
Estado abierta/cerrada
Administración de profesores
Asignaciones
Grupos
Periodos
Correcciones administrativas
```

---

# 1. Principio UX del módulo académico

El módulo académico debe separar con claridad dos experiencias:

```text
Profesor
↓
captura rápida y consulta de sus grupos

Master / Administrativo
↓
supervisión, configuración y corrección
```

El Profesor no debe sentir que está usando un sistema administrativo complejo.

Su experiencia debe responder:

> ¿Qué grupo tengo que capturar y qué alumnos me faltan?

La experiencia administrativa debe responder:

> ¿Qué está abierto, qué está completo y dónde necesito intervenir?

---

# 2. Navegación Profesor — Mobile

Principal:

```text
Inicio
Grupos
Captura
Más
```

Dentro de `Más`:

```text
Histórico
Perfil
Cerrar sesión
```

La bottom navigation debe permanecer simple.

No incluir:

- configuración;
- reportes administrativos;
- profesores;
- usuarios;
- finanzas.

---

# 3. Navegación Profesor — Desktop

Sidebar simple:

```text
Inicio
Mis grupos
Calificaciones
Histórico
```

Puede compartir shell con REAL, pero con una navegación mucho más corta.

---

# 4. Inicio Profesor

Ruta conceptual:

```text
/inicio
```

para Profesor.

Objetivo:

mostrar la situación académica actual y accesos inmediatos.

---

# 5. Header Inicio Profesor

Mobile:

```text
Buenos días, Laura
```

Debajo:

```text
Ciclo 2026–2027
```

No hace falta mostrar demasiada información institucional.

---

# 6. Estado del periodo

Bloque principal:

```text
Periodo 1
Captura abierta
```

o:

```text
Periodo 1
Captura cerrada
```

El estado debe ser muy visible.

No depender únicamente del color.

---

# 7. Mis grupos en Inicio

Sección:

```text
Mis grupos
```

Ejemplo:

```text
3º A · Español
24 alumnos                           ›

4º A · Español
21 alumnos                           ›
```

Si el profesor tiene varias materias en un mismo grupo, cada asignación debe mostrarse como contexto separado si funcionalmente corresponde.

---

# 8. Progreso de captura

Puede mostrarse:

```text
3º A · Español
18 de 24 capturados
```

Con una barra de progreso muy discreta.

No convertirlo en una card colorida.

---

# 9. Pendientes

Sección opcional:

```text
Pendientes
```

Ejemplo:

```text
3º A · Español
6 alumnos sin capturar
```

Tocar lleva directamente al grupo.

---

# 10. Mis grupos

Ruta conceptual:

```text
/profesor/grupos
```

Lista:

```text
3º Primaria · Grupo A
Español
24 alumnos
```

Otra:

```text
4º Primaria · Grupo A
Español
21 alumnos
```

---

# 11. Mis grupos — Mobile

Fila:

```text
3º Primaria · Grupo A
Español
18/24 capturados                     ›
```

Toda la fila es interactiva.

No usar tabla.

---

# 12. Mis grupos — Desktop

Puede ser lista amplia o tabla ligera:

```text
Grupo           Materia        Alumnos     Capturados
-----------------------------------------------------
3º Primaria A   Español        24          18
4º Primaria A   Español        21          21
```

---

# 13. Detalle de grupo / materia

Ruta conceptual:

```text
/profesor/grupos/[assignment-id]
```

Header:

```text
3º Primaria · Grupo A
Español
Periodo 1
```

Estado:

```text
Captura abierta
```

---

# 14. Selector de periodo

Puede mostrarse:

```text
Periodo 1
Periodo 2
Periodo 3
```

Pero el profesor solo podrá editar cuando el periodo correspondiente esté abierto.

Los periodos cerrados deben seguir accesibles en modo lectura.

---

# 15. Lista de alumnos

Mobile:

```text
Ana López
9.5                                  ›

Carlos Pérez
8.7                                  ›

María Torres
Sin capturar                         ›
```

Otra posible fila:

```text
Luis Ruiz
Capturado
9.2                                  ›
```

---

# 16. Orden de alumnos

Preferencia:

orden alfabético por apellido/nombre según criterio institucional ya existente.

No inventar sorting académico adicional.

Puede existir filtro:

```text
Todos
Sin capturar
Capturados
```

---

# 17. Buscar alumno dentro del grupo

Si el grupo es grande:

```text
[⌕ Buscar alumno...]
```

No es necesario si todos los grupos son suficientemente pequeños, pero el patrón debe estar disponible.

---

# 18. Captura individual

Al tocar un alumno:

```text
Ana López

Español
Periodo 1
```

Campos:

```text
Calificación
[ 9.5 ]

Observación
[________________________]
[________________________]

[Guardar]
```

---

# 19. Calificación cuantitativa

Input:

```text
Calificación
[ 9.5 ]
```

Debe aceptar únicamente valores válidos según las reglas ya definidas.

La UI debe validar inline.

Ejemplo de error:

```text
Ingresa una calificación válida.
```

No mostrar error técnico.

---

# 20. Observación cualitativa

Campo:

```text
Observación
```

Textarea.

Máximo:

```text
250 caracteres
```

Mostrar contador:

```text
86 / 250
```

No impedir repetir observaciones si funcionalmente está permitido.

---

# 21. Guardado

CTA:

```text
Guardar calificación
```

Durante operación:

```text
Guardando...
```

disabled.

Después:

```text
✓ Calificación guardada
```

mediante toast.

---

# 22. Edición mientras captura está abierta

Si el periodo sigue abierto, al volver al alumno:

```text
Calificación
[9.5]

Observación
[...]
```

editable.

No mostrar advertencias innecesarias.

---

# 23. Captura cerrada

Si el periodo está cerrado:

```text
Periodo 1
Captura cerrada
```

Campos read-only.

Ejemplo:

```text
Calificación
9.5

Observación
Muy buen desempeño...
```

No mostrar botones de guardar.

---

# 24. Reapertura

Si la captura vuelve a abrirse según las reglas existentes, la misma pantalla vuelve a ser editable.

No crear un flujo alterno especial.

---

# 25. Captura rápida desde lista

Puede evaluarse en desktop una captura inline.

Ejemplo:

```text
Ana López       [9.5]
Carlos Pérez    [8.7]
María Torres    [   ]
```

Pero no debe reemplazar el flujo individual en móvil.

La prioridad es evitar una hoja de cálculo comprimida.

---

# 26. Mobile-first de captura

Regla:

> En móvil, un alumno a la vez.

Esto mejora:

- precisión;
- legibilidad;
- teclado;
- observaciones;
- accesibilidad;
- reducción de errores.

---

# 27. Navegación entre alumnos

Dentro de captura individual puede existir:

```text
Anterior
Siguiente
```

o un gesto/acción equivalente.

Preferencia:

botones claros:

```text
‹ Anterior     Siguiente ›
```

sin depender de swipe oculto.

---

# 28. Guardar y siguiente

Puede existir:

```text
Guardar y siguiente
```

como acción primaria en móvil si acelera mucho la captura.

Debe guardar primero antes de cambiar de alumno.

---

# 29. Estado de progreso

Dentro del grupo:

```text
18 de 24 capturados
```

Después de guardar, actualizar inmediatamente.

---

# 30. Grupo completo

Cuando todos estén capturados:

```text
✓ Captura completa

24 de 24 alumnos
```

No significa que el periodo esté cerrado.

Solo indica completitud de ese grupo/materia.

---

# 31. Histórico Profesor

Ruta:

```text
/profesor/historico
```

Debe mostrar información read-only de periodos anteriores.

Selector:

```text
Periodo 1
Periodo 2
Periodo 3
```

---

# 32. Histórico por grupo

Ejemplo:

```text
3º A · Español
Periodo 1

Ana López       9.5
Carlos Pérez    8.7
...
```

Tocar alumno abre detalle read-only.

---

# 33. Administración académica

Para Master / Administrativo:

Ruta conceptual:

```text
/academico
```

Landing:

```text
Académico
```

Secciones:

```text
Profesores
Grupos
Calificaciones
Periodos
```

No convertir cada una en ítem de sidebar principal.

---

# 34. Landing Académico — Mobile

Filas:

```text
Profesores                         ›
Grupos                             ›
Calificaciones                     ›
Periodos                           ›
```

Simple y limpia.

---

# 35. Landing Académico — Desktop

Puede mostrar filas en dos columnas o lista vertical.

No usar grandes cards decorativas.

---

# 36. Profesores

Ruta:

```text
/academico/profesores
```

Header:

```text
Profesores
```

Acción:

```text
+ Profesor
```

si corresponde.

---

# 37. Lista de profesores — Mobile

```text
Laura Martínez
3 asignaciones
Activa                                ›
```

Otra:

```text
Carlos Gómez
2 asignaciones
Activo                                ›
```

---

# 38. Lista de profesores — Desktop

```text
Profesor          Asignaciones      Estado
------------------------------------------
Laura Martínez    3                 Activa
Carlos Gómez      2                 Activo
```

---

# 39. Ficha de profesor

Ruta:

```text
/academico/profesores/[id]
```

Header:

```text
Laura Martínez
Profesora
```

Secciones:

```text
Asignaciones
Información básica
Historial
```

si corresponde.

---

# 40. Asignaciones

Ejemplo:

```text
3º A · Español
4º A · Español
5º A · Español
```

Acción:

```text
Administrar asignaciones
```

---

# 41. Administrar asignaciones

Pantalla o Sheet amplio.

Debe permitir seleccionar combinaciones válidas de:

- grupo;
- materia;
- ciclo.

No restringir una materia a un solo grupo si funcionalmente puede reutilizarse.

---

# 42. Selector de asignación

Ejemplo:

```text
Grupo
[3º A]

Materia
[Español]
```

CTA:

```text
Agregar asignación
```

---

# 43. Lista de asignaciones actuales

```text
3º A · Español                         ···
4º A · Español                         ···
```

Menú:

```text
Editar
Eliminar asignación
```

según permisos.

---

# 44. Grupos

Ruta:

```text
/academico/grupos
```

Lista:

```text
1º Primaria · Grupo A
24 alumnos                              ›

2º Primaria · Grupo A
22 alumnos                              ›
```

---

# 45. Detalle de grupo

Ruta:

```text
/academico/grupos/[id]
```

Header:

```text
1º Primaria · Grupo A
```

Contenido:

```text
24 alumnos
```

Secciones:

```text
Alumnos
Materias / profesores
```

---

# 46. Alumnos del grupo

Mobile:

```text
Ana López
Activa                                  ›
```

Desktop:

tabla ligera.

No duplicar toda la ficha administrativa del alumno.

Tocar abre la ficha del alumno.

---

# 47. Materias / profesores del grupo

Ejemplo:

```text
Español
Laura Martínez

Matemáticas
Carlos Gómez
```

Las materias base y extras deben representarse según las reglas ya cerradas.

---

# 48. Calificaciones administrativas

Ruta:

```text
/academico/calificaciones
```

Objetivo:

supervisar captura y corregir cuando sea necesario.

---

# 49. Selección inicial

Filtros:

```text
Ciclo
Periodo
Nivel
Grado
Grupo
Materia
```

No mostrar todos simultáneamente si se pueden encadenar.

---

# 50. Estado de captura

Header contextual:

```text
Periodo 1
Captura abierta
```

Acción:

```text
Cerrar captura
```

cuando el rol tenga permiso.

---

# 51. Resumen administrativo

Puede mostrar:

```text
24 alumnos
21 capturados
3 pendientes
```

Gráfica/progreso discreto.

No usar dashboard excesivo.

---

# 52. Lista administrativa de alumnos

Mobile:

```text
Ana López
9.5
Capturada                               ›

María Torres
Sin capturar                            ›
```

Desktop:

```text
Alumno          Calificación      Estado
---------------------------------------
Ana López       9.5               Capturada
María Torres    —                 Pendiente
```

---

# 53. Corrección administrativa

Cuando el periodo está cerrado, Master/Administrativo autorizado puede corregir.

Acción:

```text
Corregir calificación
```

No debe aparecer al Profesor en periodo cerrado.

---

# 54. Flujo de corrección

Pantalla/Sheet:

```text
Corregir calificación

Ana López
Español · Periodo 1

Calificación actual
9.5

Nueva calificación
[9.0]

Observación
[________________________]

Motivo de corrección
[________________________]
```

CTA:

```text
Confirmar corrección
```

---

# 55. Confirmación de corrección

Antes de aplicar puede mostrarse resumen:

```text
9.5 → 9.0
```

Motivo:

```text
Corrección de captura
```

CTA:

```text
Confirmar
```

---

# 56. Toast de corrección

```text
✓ Calificación corregida
```

---

# 57. Historial de correcciones

En detalle:

```text
Historial

20 ago 2026
9.5 → 9.0
Corregido por Christian
Motivo: ...
```

No mostrar logs técnicos.

---

# 58. Periodos

Ruta:

```text
/academico/periodos
```

Lista:

```text
Periodo 1
Abierto

Periodo 2
Cerrado

Periodo 3
Cerrado
```

---

# 59. Detalle de periodo

```text
Periodo 1

Estado
Abierto
```

Puede mostrar:

```text
Inicio de captura
...
```

solo si esos datos existen funcionalmente.

---

# 60. Abrir / cerrar captura

Acción:

```text
Cerrar captura
```

o:

```text
Abrir captura
```

según estado y permisos.

---

# 61. Confirmación de cierre

Dialog:

```text
Cerrar captura

Los profesores ya no podrán editar las calificaciones de este periodo hasta que vuelva a abrirse.

[Cancelar]
[Cerrar captura]
```

No introducir consecuencias adicionales.

---

# 62. Confirmación de apertura

Dialog:

```text
Abrir captura

Los profesores podrán volver a editar las calificaciones del periodo.

[Cancelar]
[Abrir captura]
```

---

# 63. Estado visible para Profesor

Cuando cambia:

```text
Captura abierta
```

o:

```text
Captura cerrada
```

debe actualizarse en:

- Inicio;
- grupo;
- captura individual.

---

# 64. Materias oficiales y extras

La UI debe distinguir de forma sobria:

```text
Materias oficiales
```

y:

```text
Materias adicionales
```

cuando sea útil.

No convertir esta diferencia en una explicación técnica extensa.

---

# 65. Promedio oficial

En vistas de alumno / tutor / administrativo:

```text
Promedio oficial
9.1
```

Debe corresponder únicamente a las materias definidas para el promedio.

Las extras se muestran separadas.

---

# 66. Inglés y Educación Física

Pueden aparecer bajo:

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

sin mezclarse en el promedio oficial.

---

# 67. Vista administrativa por alumno

Desde ficha del alumno:

```text
Académico
```

puede mostrar:

```text
Periodo 1
Promedio oficial 9.1

Materias oficiales
...

Adicionales
...
```

---

# 68. Profesor visible al Tutor

En la futura vista Tutor:

```text
Español
9.0
Laura Martínez
```

La UI académica debe soportar este patrón.

---

# 69. Publicación / disponibilidad

La UI debe representar si las calificaciones están disponibles para Tutor según las reglas ya cerradas.

No redefinir aquí la lógica financiera que condiciona su visualización.

Puede existir estado administrativo:

```text
Disponible para tutor
```

o:

```text
No disponible para tutor
```

solo si ya puede derivarse funcionalmente.

---

# 70. Empty states

Profesor sin grupos:

```text
No tienes grupos asignados.
```

Grupo sin alumnos:

```text
Este grupo no tiene alumnos.
```

Sin captura:

```text
Aún no hay calificaciones capturadas.
```

---

# 71. Loading

Skeletons:

- header;
- grupo;
- alumnos;
- inputs.

No bloquear toda la aplicación con spinner central.

---

# 72. Error states

Ejemplo:

```text
No pudimos cargar las calificaciones.

Intentar de nuevo
```

Preservar cambios no guardados cuando sea posible.

---

# 73. Offline / conexión inestable

No diseñar sincronización offline si no está en alcance.

Pero si una operación falla:

```text
No pudimos guardar la calificación.
Revisa tu conexión e inténtalo de nuevo.
```

No marcarla como guardada hasta confirmación real.

---

# 74. Accesibilidad

Especialmente en captura:

- input numérico grande;
- labels visibles;
- textarea cómoda;
- contador de caracteres;
- botones de 44–48px;
- focus claro;
- navegación por teclado en desktop;
- no depender de color;
- estados de captura con texto.

---

# 75. Teclado móvil

Para calificación:

```text
inputmode="decimal"
```

o equivalente.

La interfaz debe facilitar pasar rápidamente entre campo y acción Guardar.

---

# 76. Sticky action móvil

En captura individual puede evaluarse:

```text
[Guardar y siguiente]
```

sticky abajo.

Debe respetar safe area y teclado.

No debe tapar el textarea.

---

# 77. Overscroll

Mantener las reglas de F3:

- shell estable;
- no scroll horizontal accidental;
- sheets con scroll propio;
- bottom nav estable;
- `100dvh`.

---

# 78. Componentes shadcn sugeridos

```text
Button
Input
Textarea
Tabs
Badge
Sheet
Dialog
DropdownMenu
Command
Select / Combobox
Toast / Sonner
Skeleton
Separator
Progress
ScrollArea
```

---

# 79. Componentes propios recomendados

## TeacherAssignmentRow

```text
group
subject
studentCount
captureProgress
```

## GradeRow

```text
student
grade
status
```

## GradeEditor

```text
grade
comment
maxCommentLength
editable
```

## CaptureStatus

```text
open
closed
```

## CaptureProgress

```text
captured
total
```

## TeacherRow

```text
name
assignmentCount
status
```

## SubjectGradeSummary

```text
subject
grade
teacher
comment
official
```

---

# 80. Rutas conceptuales Profesor

```text
/profesor
/profesor/grupos
/profesor/grupos/[assignment-id]
/profesor/captura/[student-id]
/profesor/historico
```

---

# 81. Rutas conceptuales administrativas

```text
/academico
/academico/profesores
/academico/profesores/[id]
/academico/grupos
/academico/grupos/[id]
/academico/calificaciones
/academico/periodos
```

La implementación final puede adaptar rutas.

---

# 82. Flujo resumido Profesor

```text
Inicio
↓
Mis grupos
↓
Grupo / materia
↓
Alumno
↓
Calificación + observación
↓
Guardar y siguiente
```

---

# 83. Flujo resumido administrativo

```text
Académico
↓
Calificaciones
↓
Periodo / grupo / materia
↓
Estado de captura
↓
Alumno
↓
Corregir si corresponde
```

---

# 84. Flujo resumido de periodo

```text
Académico
↓
Periodos
↓
Periodo 1
↓
Abrir / cerrar captura
↓
Confirmar
```

---

# 85. Qué NO hacer

No:

- mostrar al Profesor módulos administrativos que no necesita;
- comprimir una hoja de cálculo desktop en móvil;
- mezclar materias extras en el promedio oficial;
- permitir edición al Profesor cuando la captura está cerrada;
- esconder el estado abierto/cerrado;
- usar auto-save silencioso para calificaciones;
- borrar observaciones al cambiar de alumno;
- obligar a reescribir datos al reabrir;
- restringir una materia a un único grupo si funcionalmente puede reutilizarse;
- mostrar logs técnicos;
- utilizar únicamente color para estados;
- crear una experiencia distinta para cada grupo cuando puede reutilizarse el mismo patrón.

---

# 86. Prueba de éxito Profesor

F7 debe considerarse correcto si un profesor puede:

1. abrir REAL desde el teléfono;
2. identificar el periodo actual;
3. entrar a un grupo;
4. identificar alumnos pendientes;
5. capturar calificación y observación;
6. guardar;
7. pasar al siguiente alumno;

sin instrucciones externas.

---

# 87. Prueba de éxito administrativo

Debe ser posible:

1. seleccionar periodo y grupo;
2. identificar progreso de captura;
3. abrir/cerrar captura;
4. localizar una calificación;
5. corregirla con motivo cuando corresponda;
6. consultar historial;

sin navegar por múltiples módulos desconectados.

---

# 88. Resultado esperado de F7

Al finalizar este bloque quedan diseñados conceptualmente:

- experiencia completa Profesor;
- Inicio Profesor;
- Mis grupos;
- grupo/materia;
- lista de alumnos;
- captura individual;
- observación de 250 caracteres;
- guardado y navegación;
- histórico;
- estado abierta/cerrada;
- administración académica;
- profesores;
- asignaciones;
- grupos;
- calificaciones administrativas;
- periodos;
- correcciones;
- historial de correcciones;
- promedio oficial vs adicionales;
- mobile/tablet/desktop.

---

# 89. Cierre de F7

El principio rector es:

> La captura académica debe sentirse como una tarea móvil simple y secuencial para el Profesor, mientras que la administración conserva supervisión y capacidad de corrección sin contaminar esa experiencia.

---

# 90. Siguiente bloque recomendado

**F8 — Tutor + Reportes**

Incluyendo:

- Inicio Tutor;
- selector de hijos;
- cuenta;
- estado de cuenta;
- pagos;
- calificaciones;
- profesor visible;
- disponibilidad de calificaciones;
- perfil/acceso;
- reportes de matrícula;
- evolución;
- H/M;
- nivel/grado;
- oficial/no oficial;
- SEP por fechas;
- visualizaciones;
- mobile/desktop.
