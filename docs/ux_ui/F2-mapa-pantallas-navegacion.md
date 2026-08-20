# F2 — Mapa completo de pantallas y navegación por rol

## Objetivo

Definir qué pantallas existen en REAL, cómo se agrupan y cómo se navegan antes de diseñar cada interfaz en detalle.

Este mapa asume como cerrados los bloques funcionales A–E, la arquitectura de Supabase, las migraciones M0–M7 y el QA técnico. No introduce nuevas reglas de negocio.

La arquitectura debe funcionar primero en móvil y escalar limpiamente a desktop.

---

## 1. Principio general de navegación

REAL no debe exponer toda la complejidad del sistema desde el menú principal.

La navegación se divide en tres niveles:

### Nivel 1 — Destinos principales
Lo que aparece en sidebar, bottom navigation o menú principal.

### Nivel 2 — Pantallas de módulo
Ejemplo:

`Alumnos → Ficha del alumno → Estado de cuenta`

### Nivel 3 — Acciones contextuales
Ejemplos:

- Registrar pago
- Cambiar categoría
- Corregir calificación
- Enviar estado de cuenta
- Revertir pago
- Invitar tutor

Estas acciones no deben convertirse innecesariamente en nuevos elementos de navegación.

---

# 2. Shell general

## Desktop

Estructura base:

```text
┌───────────────────────────────────────────────────────────────┐
│ Logo REAL                              Usuario / menú          │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Navegación    │               Contenido                       │
│ lateral       │                                               │
│               │                                               │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

La sidebar debe ser estrecha, ligera y visualmente inspirada en la referencia principal.

No debe contener demasiadas opciones. Los destinos secundarios viven dentro de sus respectivos módulos.

## Mobile

Estructura base:

```text
┌───────────────────────┐
│ REAL        acciones  │
├───────────────────────┤
│                       │
│       contenido       │
│                       │
│                       │
├───────────────────────┤
│ navegación inferior   │
└───────────────────────┘
```

Cuando el rol tenga demasiados destinos:

```text
Inicio   Alumnos   Pagos   Más
```

`Más` abre un Sheet/Drawer, no otra pantalla intermedia.

El layout móvil debe respetar:

- safe areas
- barra inferior fija correctamente
- teclado móvil
- `100dvh`
- overscroll controlado
- scroll solo donde corresponda
- targets táctiles amplios
- acciones principales accesibles con una mano

---

# 3. Master

Master tiene acceso al sistema completo, pero eso no significa que todo deba estar visible simultáneamente.

## Navegación principal desktop

```text
Inicio

Alumnos
Matrícula
Pagos

Académico
Reportes

Configuración
```

Puede existir separación visual ligera entre bloques.

## Navegación principal móvil

```text
Inicio
Alumnos
Pagos
Más
```

Dentro de `Más`:

```text
Matrícula
Académico
Reportes
Configuración
Perfil
Cerrar sesión
```

---

# 4. Inicio Master

Ruta conceptual:

```text
/inicio
```

Objetivo:

> Entender rápidamente el estado operativo del colegio.

No debe ser un dashboard genérico de BI.

## Contenido

Zona superior:

```text
Buenos días
Ciclo 2026–2027
```

KPIs compactos:

```text
Alumnos activos
Pagos del día
Saldo vencido
Preinscripciones pendientes
```

Después:

```text
Requiere atención
```

Puede incluir:

- alumnos con deuda vencida
- procesos pendientes
- asuntos relevantes operativamente

Después:

```text
Actividad / panorama
```

Puede incluir:

- evolución de matrícula
- distribución por nivel
- H/M
- situación financiera resumida

## Acciones rápidas

```text
Registrar pago
Buscar alumno
Nueva preinscripción
```

No deben convertirse en grandes tarjetas decorativas.

---

# 5. Alumnos

Ruta:

```text
/alumnos
```

Este debe ser uno de los módulos centrales de REAL.

## Pantalla: listado de alumnos

Header:

```text
Alumnos                         + Nuevo
Buscar alumno...
```

Filtros mediante botón:

```text
Filtros
```

En móvil abre Sheet. En desktop puede abrir popover o panel.

Filtros:

- ciclo
- nivel
- grado
- grupo
- estado
- clasificación administrativa correspondiente

## Desktop

Puede ser tabla ligera:

```text
Alumno              Grado       Estado       Cuenta
Ana López           3º Prim.    Activa       Al corriente
Luis Pérez          1º Sec.     Activa       $2,350 vencido
```

## Mobile

No comprimir la tabla. Usar filas:

```text
Ana López
3º Primaria · Activa
Al corriente                          ›
```

```text
Luis Pérez
1º Secundaria · Activa
$2,350 vencido                        ›
```

Toda la fila es interactiva.

---

# 6. Ficha del alumno

Ruta:

```text
/alumnos/[id]
```

Debe convertirse en el centro operativo de REAL.

## Header

```text
← Alumnos

Ana López
3º Primaria · Activa
```

Puede mostrar indicador financiero discreto:

```text
● Al corriente
```

o:

```text
● $2,350 vencido
```

## Navegación interna desktop

```text
Resumen | Cuenta | Matrícula | Académico | Familia | Historial
```

## Navegación interna mobile

```text
Resumen   Cuenta   Matrícula   Más
```

Dentro de `Más`:

```text
Académico
Familia
Historial
```

---

# 7. Alumno → Resumen

Debe responder rápidamente:

- quién es
- dónde está inscrito
- cuál es su estado
- cómo está financieramente
- quiénes son sus tutores
- qué acciones pueden realizarse

Ejemplo:

```text
Ana López
3º Primaria · Grupo A

Estado
Activa

Cuenta
Al corriente

Próximo cargo
$X,XXX · 1 de septiembre
```

Acciones:

```text
Registrar pago
Ver estado de cuenta
```

Después:

```text
Matrícula
Ciclo 2026–2027
3º Primaria · Grupo A
```

```text
Tutores
María López
Carlos López
```

---

# 8. Alumno → Cuenta

Ruta:

```text
/alumnos/[id]/cuenta
```

## Encabezado financiero

```text
Saldo total
$2,350

Vencido
$1,200

Saldo a favor
$0
```

Sin necesidad de tres cards gigantes.

Acción:

```text
Registrar pago
```

Después:

```text
Septiembre
Colegiatura             $1,200
Pago transferencia     -$1,200
Saldo                         $0

Octubre
Colegiatura             $1,200
Pago parcial              -$50
Saldo                    $1,150
```

Debe ser extremadamente legible en móvil.

---

# 9. Alumno → Registrar pago

No aparece como sección permanente. Es una acción contextual.

Puede lanzarse desde:

- Inicio
- búsqueda de alumno
- ficha del alumno
- estado de cuenta
- módulo Pagos

## Mobile

Pantalla completa o bottom sheet amplio.

## Desktop

Sheet lateral o dialog amplio.

Flujo conceptual:

```text
Registrar pago

Alumno
Ana López

Monto
$ ________

Método
○ Efectivo
○ Transferencia
○ Especie

Fecha
[ 20 ago 2026 ]

Referencia
[ opcional ]

Observación
[ opcional ]
```

CTA:

```text
Registrar pago
```

Confirmación:

```text
Pago registrado

$1,200
Ana López

Descargar recibo
Enviar recibo
Cerrar
```

La prioridad es velocidad operativa.

---

# 10. Alumno → Matrícula

Contenido:

```text
Ciclo
2026–2027

Nivel
Primaria

Grado
3º

Grupo
A

Fecha efectiva de ingreso
31 ago 2026

Estado
Activa
```

Acciones según rol/contexto:

```text
Editar matrícula
Cambiar estado
```

No mezclar historial de todos los ciclos en el formulario actual.

---

# 11. Alumno → Académico

Resumen:

```text
Periodo 1
Promedio oficial      9.1
```

Materias:

```text
Español               9.0
Matemáticas           9.4
...
Inglés                9.2
Educación Física      10
```

Selector:

```text
Periodo 1 | Periodo 2 | Periodo 3
```

---

# 12. Alumno → Familia

Información de:

- tutores
- relación con alumno
- accesos familiares existentes
- estado de invitación/acceso

Acciones:

```text
Invitar tutor
Reenviar invitación
Desactivar acceso
```

No crear un módulo principal independiente de usuarios familiares salvo necesidad futura.

---

# 13. Alumno → Historial

Timeline administrativa ligera:

```text
20 ago
Pago registrado
$1,200 · Transferencia

14 ago
Categoría financiera actualizada

31 jul
Inscripción al ciclo 2026–2027
```

No mostrar logs técnicos de DB.

---

# 14. Matrícula

Ruta:

```text
/matricula
```

Objetivo: gestionar ingreso y continuidad.

Pantalla principal:

```text
Matrícula
Ciclo 2026–2027
```

Tabs:

```text
Actual
Preinscripciones
Pendientes
No continúa
```

---

# 15. Matrícula → Actual

Listado del ciclo actual.

Filtros:

- nivel
- grado
- grupo
- estado

Acción:

```text
Nueva matrícula
```

---

# 16. Matrícula → Preinscripciones

Listado:

```text
Nombre
Nivel solicitado
Estado
Fecha
```

Acciones:

```text
Nueva preinscripción
Crear campaña
```

La creación de campaña puede vivir como acción secundaria.

---

# 17. Matrícula → Alta / activación

Flujo guiado:

```text
Alumno
   ↓
Ciclo / grado / grupo
   ↓
Configuración financiera
   ↓
Ingreso / primer cobro
   ↓
Confirmación
```

Mobile: pantallas secuenciales.

Desktop: misma lógica aprovechando más espacio.

---

# 18. Pagos

Ruta:

```text
/pagos
```

Este módulo es operativo, no contable.

## Pantalla principal

```text
Pagos                         Registrar pago
```

KPIs compactos:

```text
Hoy
$12,450

Este mes
$184,300
```

La visibilidad de agregados depende del rol y reglas ya definidas.

Después:

```text
Pagos recientes
```

Filas:

```text
Ana López
$1,200 · Transferencia
Hoy 10:42                    ›
```

Búsqueda:

```text
Buscar alumno, recibo o referencia
```

Filtros:

```text
Fecha
Método
Receptor
```

---

# 19. Detalle de pago

Puede abrir como Sheet.

```text
Pago

$1,200

Ana López
Transferencia
20 ago 2026 · 10:42

Recibido por
Fran

Referencia
123456
```

Aplicaciones:

```text
Septiembre 2026      $800
Deuda anterior       $400
```

Acciones según permisos:

```text
Descargar recibo
Enviar recibo
Corregir datos
Revertir pago
```

Las acciones sensibles deben ir en menú `···`.

---

# 20. Académico

Para Master:

```text
Académico
```

Al entrar:

```text
Profesores
Grupos
Calificaciones
Periodos
```

No es necesario convertir cada uno en ítem de sidebar.

---

# 21. Profesores

Ruta:

```text
/academico/profesores
```

Listado:

```text
Profesor
Asignaciones
Estado
```

Ficha:

```text
Laura Martínez

Asignaciones
3º A · Español
4º A · Español
```

Acciones:

```text
Editar profesor
Administrar asignaciones
```

---

# 22. Grupos

Ruta:

```text
/academico/grupos
```

Listado:

```text
1º Primaria A
24 alumnos
```

Ficha:

```text
1º Primaria · Grupo A

24 alumnos

Profesor / materias
...
```

---

# 23. Calificaciones administrativas

Ruta:

```text
/academico/calificaciones
```

Primera selección:

```text
Ciclo
Periodo
Nivel
Grado
Grupo
```

Después:

```text
Captura del periodo
Abierta
```

Acción:

```text
Cerrar captura
```

Las correcciones administrativas deben ser contextuales.

---

# 24. Reportes

Ruta:

```text
/reportes
```

Landing:

```text
Reportes
```

Secciones:

```text
Matrícula
Financieros
SEP / oficiales
```

No convertir el menú en una lista de quince reportes.

---

# 25. Reportes → Matrícula

Vistas:

```text
Matrícula actual
Evolución
Por nivel
Por grado
Hombres / mujeres
Oficial / no oficial
```

Ejemplo:

```text
Matrícula actual
95 alumnos
```

Distribución:

```text
Primaria       54
Secundaria     29
Preescolar     12
```

H/M:

```text
Hombres   48
Mujeres   47
```

Gráficas sobrias.

---

# 26. Reportes → Evolución de matrícula

Debe responder:

> ¿Cómo cambió la matrícula entre dos fechas?

Selector:

```text
Desde [ Septiembre 2026 ]
Hasta [ Junio 2027 ]
```

Gráfica:

```text
Sep   91
Oct   94
Nov   96
...
Jun   89
```

Con detalle numérico debajo si aporta.

---

# 27. Reportes → SEP

Filtros:

```text
Fecha inicial
Fecha final
Nivel
```

Acción:

```text
Generar reporte
```

La información se deriva según las reglas ya cerradas.

---

# 28. Configuración Master

Ruta:

```text
/configuracion
```

Landing con filas:

```text
Ciclo escolar
Precios y colegiaturas
Categorías y descuentos
Usuarios y permisos
Configuración académica
```

Evitar grandes cards decorativas.

---

# 29. Configuración → Ciclo escolar

```text
Ciclo actual
2026–2027
31 ago 2026 — ...
```

Acciones:

```text
Ver configuración
Crear nuevo ciclo
```

---

# 30. Configuración → Finanzas

Agrupa:

```text
Precios por nivel
Categorías
Descuentos
Configuración de cobros
```

No crear múltiples ítems de sidebar.

---

# 31. Administrativo

Debe compartir componentes y rutas con Master siempre que sea posible. La diferencia principal es autorización.

## Desktop

```text
Inicio

Alumnos
Matrícula
Pagos

Académico
Reportes
```

## Mobile

```text
Inicio
Alumnos
Pagos
Más
```

Dentro de `Más`:

```text
Matrícula
Académico
Reportes
Perfil
Cerrar sesión
```

---

# 32. Inicio Administrativo

Prioridad:

> ¿A quién necesito cobrar o atender?

Primera sección:

```text
Buscar alumno...
```

Acciones rápidas:

```text
Registrar pago
Preinscripción
```

Después:

```text
Requieren atención
```

Ejemplo:

```text
Luis Pérez
1º Secundaria
$2,350 vencido                     ›
```

Otro bloque:

```text
Pagos recientes
```

No sobrecargar con analytics innecesarios.

Buscar y registrar pago deben ser acciones inmediatas.

---

# 33. Profesor

La navegación debe sentirse como una app móvil dedicada.

## Mobile

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

## Desktop

```text
Inicio
Mis grupos
Calificaciones
Histórico
```

---

# 34. Inicio Profesor

```text
Buenos días, Laura
```

Información principal:

```text
Captura actual

Periodo 1
Abierta
```

Después:

```text
Mis grupos
```

Ejemplo:

```text
3º A · Español
24 alumnos                       ›
```

Si está cerrada:

```text
Periodo 1
Captura cerrada
```

---

# 35. Profesor → Mis grupos

Listado:

```text
3º Primaria · Grupo A
Español
24 alumnos
```

Al tocar:

```text
3º Primaria A
Español
```

Listado de alumnos.

---

# 36. Profesor → Captura

Debe evitar parecer una hoja de cálculo comprimida.

Selector:

```text
3º A
Español
Periodo 1
```

Lista:

```text
Ana López
9.5                                  ›

Carlos Pérez
8.7                                  ›

María Torres
Sin capturar                          ›
```

Tocar alumno:

```text
Ana López

Calificación
[ 9.5 ]

Observación
[ ______________________ ]
[ ______________________ ]

Guardar
```

Toast:

```text
✓ Calificación guardada
```

---

# 37. Profesor → Histórico

```text
Periodo 1
Periodo 2
Periodo 3
```

Read-only cuando corresponda.

---

# 38. Tutor

La navegación más sencilla.

## Mobile

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

## Desktop

```text
Inicio
Mis hijos
Pagos
Calificaciones
```

---

# 39. Inicio Tutor

Debe responder:

> ¿Hay algo importante relacionado con mis hijos?

Si tiene un alumno:

```text
Ana López
3º Primaria
```

Si tiene varios, selector sencillo.

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

Acción:

```text
Ver estado de cuenta
```

Después:

```text
Calificaciones
Periodo 1 publicado
Promedio 9.1
```

Cuando funcionalmente esté disponible.

---

# 40. Tutor → Mis hijos

Lista:

```text
Ana López
3º Primaria · Grupo A              ›

Carlos López
1º Secundaria · Grupo A            ›
```

Ficha simplificada:

```text
Resumen
Cuenta
Calificaciones
```

El tutor no ve la ficha administrativa completa.

---

# 41. Tutor → Pagos / Estado de cuenta

```text
Ana López

Estado
Al corriente

Saldo
$0
```

Historial:

```text
Agosto
Pago recibido
$1,200 · Transferencia

Julio
Pago recibido
$1,200 · Efectivo
```

Acción:

```text
Descargar estado de cuenta
```

---

# 42. Tutor → Calificaciones

Selector:

```text
Ana López
Periodo 1
```

Resumen:

```text
Promedio oficial
9.1
```

Materias:

```text
Español
9.0

Matemáticas
9.4
```

Mostrar observaciones y profesor cuando corresponda.

---

# 43. Login y acceso

Ruta:

```text
/login
```

Pantallas relacionadas:

```text
Login
Olvidé mi contraseña
Restablecer contraseña
Aceptar invitación de tutor
Crear acceso familiar
Confirmación
```

No habrá signup público general.

---

# 44. Perfil

Ruta:

```text
/perfil
```

Contenido:

```text
Nombre
Correo
Rol
```

Acciones:

```text
Cambiar contraseña
Cerrar sesión
```

En desktop puede vivir dentro del menú de usuario.

---

# 45. Búsqueda global

En Master y Administrativo debe ser un patrón disponible casi desde cualquier lugar.

## Desktop

```text
⌕ Buscar alumno...
```

Puede vivir en topbar o activarse mediante Command.

## Mobile

La lupa abre:

```text
Buscar alumno

[ Escribe un nombre... ]
```

Resultados:

```text
Ana López
3º Primaria · Activa
Al corriente

Luis Pérez
1º Secundaria · Activa
$2,350 vencido
```

Tocar abre la ficha del alumno.

---

# 46. Acciones rápidas

En móvil administrativo puede existir una acción contextual visible.

Preferencia:

```text
+ Registrar pago
```

Dentro del header cuando corresponda.

En Inicio:

```text
Registrar pago
```

como CTA principal.

Evitar FAB permanente si ensucia la estética.

---

# 47. Uso de Sheet, Drawer, Dialog y pantalla

| Patrón | Uso en REAL |
|---|---|
| Sheet / Drawer | Filtros, detalle rápido, menú móvil, acciones cortas |
| Dialog | Confirmaciones y acciones sensibles |
| Pantalla dedicada | Flujos importantes o complejos |
| Popover | Selectores pequeños y opciones |
| Toast | Confirmación breve |
| Dropdown menu | Acciones secundarias sobre una entidad |

## Ejemplos

### Sheet
- filtros de alumnos
- detalle rápido de pago
- menú `Más`

### Dialog
- confirmar reversión
- cerrar captura
- desactivar acceso

### Pantalla dedicada
- ficha del alumno
- matrícula
- estado de cuenta
- captura de calificaciones cuando lo requiera

---

# 48. Arquitectura responsive

La misma información cambia de composición, no de lógica.

## Desktop

```text
sidebar
+
contenido amplio
+
tablas
+
sheets contextuales
```

## Tablet

```text
sidebar compacta / drawer
+
listas/tablas adaptadas
```

## Mobile

```text
bottom navigation
+
headers compactos
+
listas
+
sheets
+
acciones táctiles
```

La composición móvil debe diseñarse deliberadamente; no debe ser simplemente una pantalla desktop reducida.

---

# 49. Mapa compacto de REAL

```text
REAL
│
├── Acceso
│   ├── Login
│   ├── Recuperación
│   └── Invitación tutor
│
├── Master
│   ├── Inicio
│   ├── Alumnos
│   │   └── Alumno
│   │       ├── Resumen
│   │       ├── Cuenta
│   │       ├── Matrícula
│   │       ├── Académico
│   │       ├── Familia
│   │       └── Historial
│   ├── Matrícula
│   │   ├── Actual
│   │   ├── Preinscripciones
│   │   ├── Pendientes
│   │   └── No continúa
│   ├── Pagos
│   │   └── Detalle de pago
│   ├── Académico
│   │   ├── Profesores
│   │   ├── Grupos
│   │   └── Calificaciones
│   ├── Reportes
│   │   ├── Matrícula
│   │   ├── Evolución
│   │   └── SEP
│   └── Configuración
│       ├── Ciclos
│       ├── Finanzas
│       ├── Académico
│       └── Usuarios
│
├── Administrativo
│   ├── Inicio
│   ├── Alumnos
│   ├── Matrícula
│   ├── Pagos
│   ├── Académico
│   └── Reportes
│
├── Profesor
│   ├── Inicio
│   ├── Mis grupos
│   ├── Captura
│   └── Histórico
│
└── Tutor
    ├── Inicio
    ├── Mis hijos
    ├── Pagos
    └── Calificaciones
```

---

# 50. Decisión de arquitectura de información

REAL queda orientado alrededor de cuatro objetos mentales principales:

```text
Alumno → Matrícula → Pago → Académico
```

Reportes y Configuración se mantienen como herramientas administrativas secundarias.

Esto evita fragmentar la aplicación en módulos redundantes como:

```text
Alumnos
Pagos
Cobranza
Estado de cuenta
Adeudos
Finanzas
Cargos
```

cuando gran parte de esa información pertenece al contexto del alumno o del pago.

---

# 51. Cierre de F2

Con F2 queda definida la arquitectura informacional inicial de REAL:

- navegación por rol
- shell general conceptual
- módulos principales
- pantallas contextuales
- patrón mobile-first
- uso de Sheet, Drawer, Dialog y Toast
- ubicación de búsqueda y acciones rápidas
- jerarquía de pantallas administrativas
- separación entre experiencia Master, Administrativo, Profesor y Tutor

El siguiente bloque recomendado es:

**F3 — Login + shell general + navegación móvil/desktop + sistema visual base.**
