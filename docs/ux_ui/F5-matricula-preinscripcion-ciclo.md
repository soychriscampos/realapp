# F5 — Matrícula, preinscripción y ciclo

## Objetivo

Definir en detalle la experiencia UX/UI de los flujos de matrícula, preinscripción, continuidad e inicio de ciclo en REAL.

Este bloque no redefine reglas de negocio ni modifica arquitectura de base de datos. Parte de los bloques funcionales ya cerrados y se concentra exclusivamente en:

- estructura de pantallas;
- jerarquía visual;
- navegación;
- formularios;
- acciones;
- estados;
- comportamiento mobile-first;
- adaptación desktop.

Los flujos incluidos son:

```text
Matrícula actual
Preinscripciones
Nueva preinscripción
Campañas
Alta / activación al ciclo
Ingreso tardío
Configuración financiera durante matrícula
Cambio de estado
No continúa
Baja
Configuración del ciclo
```

---

# 1. Principio UX del módulo

El módulo de Matrícula debe responder a una pregunta sencilla:

> ¿En qué estado está cada alumno respecto al ciclo escolar y qué acción corresponde ahora?

La interfaz debe evitar mezclar en una sola vista:

- preinscripción;
- matrícula activa;
- configuración financiera;
- historial;
- bajas;
- continuidad.

Cada estado debe tener contexto y acciones claras.

---

# 2. Ruta principal

Ruta conceptual:

```text
/matricula
```

Header:

```text
Matrícula
Ciclo 2026–2027
```

Acciones principales:

```text
+ Nueva matrícula
+ Preinscripción
```

En desktop pueden mostrarse como botones.

En móvil, una acción principal visible y las demás dentro de `+` o menú contextual si hace falta.

---

# 3. Navegación interna de Matrícula

Tabs principales:

```text
Actual
Preinscripciones
Pendientes
No continúa
```

## Mobile

Tabs horizontalmente scrollables.

No permitir wrap.

Ejemplo:

```text
Actual   Preinscripciones   Pendientes   No continúa
```

## Desktop

Tabs horizontales debajo del header.

---

# 4. Matrícula → Actual

Objetivo:

mostrar alumnos pertenecientes al ciclo actual.

## Header contextual

```text
Actual
95 alumnos
```

Debajo:

```text
[⌕ Buscar alumno...]   [Filtros]
```

Filtros:

- nivel;
- grado;
- grupo;
- estado;
- clasificación administrativa correspondiente.

---

# 5. Lista Actual — Mobile

Fila:

```text
Ana López
3º Primaria · Grupo A
Activa                                  ›
```

Otra:

```text
Luis Pérez
1º Secundaria
Pendiente                               ›
```

Otra:

```text
Carlos Ruiz
2º Primaria · Grupo B
Baja                                    ›
```

Toda la fila es interactiva.

No usar una card elevada por alumno.

---

# 6. Lista Actual — Desktop

Tabla ligera:

```text
Alumno          Nivel / Grado       Grupo      Estado
------------------------------------------------------
Ana López       3º Primaria         A          Activa
Luis Pérez      1º Secundaria       —          Pendiente
Carlos Ruiz     2º Primaria         B          Baja
```

Puede incluir columna secundaria:

```text
Cuenta
```

solo si aporta operativamente.

---

# 7. Filtros de Matrícula

## Mobile

Botón:

```text
Filtros
```

abre bottom sheet.

Contenido:

```text
Filtros

Nivel
[Todos]

Grado
[Todos]

Grupo
[Todos]

Estado
[Todos]

[Aplicar]
```

Acción secundaria:

```text
Limpiar
```

---

# 8. Estado vacío

Ejemplo:

```text
No hay alumnos en esta vista.

Ajusta los filtros o registra una nueva matrícula.
```

CTA:

```text
Nueva matrícula
```

si corresponde.

---

# 9. Preinscripciones

Ruta conceptual:

```text
/matricula/preinscripciones
```

o como tab dentro de `/matricula`.

Objetivo:

gestionar alumnos que todavía no forman parte activa del ciclo.

---

# 10. Lista de Preinscripciones

Header:

```text
Preinscripciones
```

Acciones:

```text
+ Nueva preinscripción
Crear campaña
```

Búsqueda:

```text
[⌕ Buscar...]
```

Filtros posibles:

- nivel solicitado;
- estado;
- fecha;
- campaña;
- ciclo objetivo.

---

# 11. Preinscripción — Mobile

Fila:

```text
María Torres
Primaria · 1º
Pendiente
12 ago 2026                           ›
```

Otra:

```text
Diego López
Preescolar
En revisión
15 ago 2026                           ›
```

No sobrecargar con demasiados datos.

---

# 12. Preinscripción — Desktop

Tabla ligera:

```text
Alumno          Nivel solicitado     Estado       Fecha
-------------------------------------------------------
María Torres    1º Primaria          Pendiente    12 ago
Diego López     Preescolar           En revisión  15 ago
```

---

# 13. Nueva preinscripción

La preinscripción debe ser un formulario simple.

## Mobile

Preferencia:

pantalla dedicada.

## Desktop

Puede ser Sheet amplio o pantalla dedicada.

Si el formulario crece, mantener pantalla dedicada.

---

# 14. Formulario de Nueva preinscripción

Debe respetar únicamente los datos funcionalmente requeridos.

No agregar campos “por si acaso”.

Estructura conceptual:

```text
Nueva preinscripción

Datos del alumno
[campos requeridos]

Nivel / grado solicitado
[selección]

Datos de contacto
[campos requeridos]

Observación
[opcional]

[Guardar preinscripción]
```

---

# 15. Jerarquía del formulario

Agrupar en secciones claras:

```text
Alumno
Escolar
Contacto
Observaciones
```

Evitar una card por sección si no hace falta.

Puede bastar con:

- título;
- separador;
- campos.

---

# 16. Confirmación de preinscripción

Después de guardar:

```text
✓ Preinscripción registrada

María Torres
1º Primaria

[Ver preinscripción]
[Volver a Matrícula]
```

Toast adicional opcional:

```text
✓ Preinscripción guardada
```

---

# 17. Detalle de Preinscripción

Debe mostrar:

```text
María Torres
1º Primaria

Estado
Pendiente

Ciclo objetivo
2026–2027

Fecha
12 ago 2026
```

Acciones:

```text
Activar matrícula
Editar
```

y acciones secundarias según permisos.

---

# 18. Activar una preinscripción

La acción principal debe ser:

```text
Activar matrícula
```

Esto inicia el flujo de alta al ciclo usando la información ya capturada.

No volver a pedir todos los datos.

---

# 19. Crear campaña

La campaña no debe ser un módulo principal separado.

Acceso desde Preinscripciones:

```text
Crear campaña
```

Preferencia:

Sheet o pantalla dedicada dependiendo de la cantidad de campos.

---

# 20. Pantalla Crear campaña

Estructura conceptual:

```text
Crear campaña

Nombre
[________________]

Ciclo
[2026–2027]

Nivel / alcance
[________________]

Vigencia
Desde [____]
Hasta [____]

[Crear campaña]
```

Solo incluir campos ya soportados funcionalmente.

---

# 21. Confirmación campaña

```text
✓ Campaña creada
```

Después:

```text
Ver campaña
Copiar acceso / enlace
```

si ese mecanismo ya forma parte del flujo existente.

---

# 22. Alta / activación al ciclo

Este es uno de los flujos principales del módulo.

Debe ser guiado.

No mostrar todo el proceso en un formulario gigante.

---

# 23. Flujo conceptual de activación

```text
1. Alumno
2. Ciclo y grupo
3. Configuración financiera
4. Fecha efectiva de ingreso
5. Primer cobro
6. Resumen
7. Confirmación
```

En mobile cada etapa debe sentirse claramente separada.

---

# 24. Stepper

## Mobile

Usar indicador compacto:

```text
Paso 2 de 6
```

o:

```text
Alumno → Ciclo → Finanzas → Ingreso → Resumen
```

si cabe.

Preferencia: `Paso X de Y` para evitar saturación.

## Desktop

Puede mostrarse stepper horizontal ligero.

---

# 25. Paso 1 — Alumno

Si viene desde preinscripción:

```text
Alumno

María Torres
```

No pedir de nuevo datos existentes.

Si inicia desde Nueva matrícula:

```text
Buscar alumno

[⌕ Nombre del alumno...]
```

Opciones:

- seleccionar existente;
- crear nuevo alumno si funcionalmente corresponde.

---

# 26. Paso 2 — Ciclo y grupo

Campos:

```text
Ciclo
[2026–2027]

Nivel
[Primaria]

Grado
[3º]

Grupo
[A]
```

La interfaz debe mostrar únicamente opciones válidas.

No mostrar IDs ni códigos internos.

---

# 27. Paso 3 — Configuración financiera

Debe reflejar las reglas ya definidas sin introducir nuevas decisiones.

Contenido conceptual:

```text
Configuración financiera

Precio base del nivel
$1,200

Categoría
[Regular]

Importe individual
$1,200

Plan
○ 12 pagos
○ 10 pagos
```

Mostrar información derivada de forma clara.

---

# 28. Precio sugerido

Cuando exista un importe sugerido:

```text
Precio sugerido
$1,200
```

y después:

```text
Importe acordado
[ $1,200 ]
```

El usuario autorizado termina aceptando o definiendo el monto.

---

# 29. Descuento / beca

Si aplica:

```text
Categoría
[Beca 50%]

Precio base
$1,200

Importe resultante
$600
```

Para beca 100%:

```text
Importe
$0
```

La UI no debe ocultar la obligación por ser cero.

---

# 30. Plan 10 / 12 pagos

Cuando sea elegible:

```text
Plan de pagos

○ 12 pagos
   $1,000 cada uno

○ 10 pagos
   $1,200 cada uno
```

La opción debe ser muy clara antes del primer cobro.

No esconderla dentro de configuración avanzada.

---

# 31. Paso 4 — Fecha efectiva de ingreso

Campo:

```text
Fecha efectiva de ingreso

[31 ago 2026]
```

Texto de ayuda breve:

```text
Puede ser diferente a la fecha en que se captura la matrícula.
```

No añadir explicación legal/técnica.

---

# 32. Ingreso tardío

Cuando la fecha efectiva sea posterior al inicio del ciclo, la interfaz debe detectar el contexto y mostrar el bloque correspondiente.

Ejemplo:

```text
Ingreso tardío

Fecha efectiva
15 oct 2026
```

Después:

```text
Primer cobro
```

---

# 33. Primer cobro en ingreso tardío

La UI debe mostrar claramente las opciones ya definidas.

Ejemplo conceptual:

```text
Primer cobro

○ Cobro completo
○ Cobro proporcional
```

Si se selecciona proporcional:

```text
Monto proporcional sugerido
$645

Monto a cobrar
[ $645 ]
```

La cantidad sugerida debe poder aceptarse o modificarse según las reglas ya cerradas.

---

# 34. Opción de no cobrar primer día

Cuando corresponda:

```text
Cobrar primer día

○ Sí
○ No
```

La interfaz debe mostrar esta decisión solo cuando el flujo la requiera.

No mostrarla indiscriminadamente en todas las matrículas.

---

# 35. Cálculo proporcional

Debe presentarse como información, no como fórmula técnica.

Ejemplo:

```text
Monto proporcional sugerido
$645
```

Opcionalmente:

```text
Basado en la fecha efectiva de ingreso.
```

No mostrar cálculos complejos al usuario salvo que sean útiles.

---

# 36. Paso 5 — Resumen

Antes de confirmar:

```text
Resumen de matrícula

Alumno
María Torres

Ciclo
2026–2027

Grado
3º Primaria · Grupo A

Fecha efectiva
15 oct 2026

Plan
12 pagos

Importe mensual
$1,200

Primer cobro
$645 proporcional
```

Todo en una sola pantalla clara.

---

# 37. Confirmación final

CTA:

```text
Confirmar matrícula
```

No usar:

```text
Guardar
```

porque la acción tiene peso administrativo.

---

# 38. Loading de confirmación

```text
Confirmando matrícula...
```

Botón disabled.

Evitar doble envío.

---

# 39. Confirmación exitosa

```text
✓ Matrícula activada

María Torres
3º Primaria · Grupo A
Ciclo 2026–2027
```

Acciones:

```text
Ver alumno
Volver a Matrícula
```

---

# 40. Error durante activación

Preservar la información del flujo.

Mensaje:

```text
No pudimos completar la matrícula.

Revisa la información e inténtalo de nuevo.
```

No regresar al paso 1 automáticamente.

---

# 41. Pendientes

Tab:

```text
Pendientes
```

Debe mostrar matrículas que requieren una acción antes de quedar activas.

Fila:

```text
Luis Pérez
1º Secundaria
Pendiente
Falta completar configuración              ›
```

El texto exacto depende del estado real disponible.

---

# 42. Detalle de matrícula pendiente

Debe indicar:

```text
Estado
Pendiente
```

y debajo:

```text
Qué falta
```

con la acción primaria correspondiente.

No mostrar estados técnicos.

---

# 43. No continúa

Tab:

```text
No continúa
```

Objetivo:

mostrar alumnos del ciclo anterior que no ingresarán al nuevo ciclo.

---

# 44. Lista No continúa

Mobile:

```text
Carlos Ruiz
6º Primaria · Ciclo 2025–2026
No continúa                             ›
```

Desktop:

```text
Alumno          Ciclo anterior      Estado
------------------------------------------
Carlos Ruiz     2025–2026           No continúa
```

---

# 45. Marcar “No continúa”

Debe ser una acción contextual.

No botón primario permanente.

Puede vivir en:

```text
···
```

Confirmación:

```text
Marcar como “No continúa”

Carlos Ruiz no se incluirá en la matrícula del ciclo 2026–2027.

[Cancelar]
[Confirmar]
```

No inventar consecuencias fuera de las reglas definidas.

---

# 46. Baja

La baja corresponde a un alumno que deja de continuar dentro del ciclo.

Debe mostrarse como acción sensible.

Ubicación:

```text
··· → Dar de baja
```

No como botón rojo visible permanentemente.

---

# 47. Confirmación de baja

Dialog:

```text
Dar de baja

Alumno
Carlos Ruiz

Fecha efectiva
[20 oct 2026]

Motivo
[_____________________]

[Cancelar]
[Dar de baja]
```

Solo incluir motivo si funcionalmente ya está requerido o previsto.

---

# 48. Estado finalizado / egresado

La UI debe distinguir:

```text
Finalizada
Egresada
No continúa
Baja
```

con texto visible.

No depender solo de color.

---

# 49. Cambiar estado de matrícula

Acción contextual:

```text
Cambiar estado
```

Puede abrir Sheet/Dialog con únicamente las transiciones válidas.

Ejemplo:

```text
Nuevo estado

○ Activa
○ Baja
○ No continúa
```

No mostrar estados imposibles.

---

# 50. Ficha del alumno → Matrícula

Dentro de la ficha:

```text
Matrícula
```

debe mostrar:

```text
Ciclo 2026–2027
3º Primaria · Grupo A
Activa
Fecha efectiva: 31 ago 2026
```

Acciones:

```text
Editar matrícula
Cambiar estado
```

---

# 51. Histórico de matrícula

No mezclar historial de ciclos dentro del formulario actual.

Puede existir una sección:

```text
Ciclos anteriores
```

Ejemplo:

```text
2025–2026
2º Primaria · Grupo A
Finalizada
```

Tocar abre vista read-only.

---

# 52. Configuración de ciclo

Ruta conceptual:

```text
/configuracion/ciclos
```

Solo para roles autorizados.

---

# 53. Landing Ciclos

```text
Ciclos escolares
```

Ciclo actual:

```text
2026–2027
Actual
31 ago 2026 — ...
```

Ciclos anteriores:

```text
2025–2026
Finalizado
```

Acción:

```text
+ Crear ciclo
```

---

# 54. Crear ciclo

Preferencia:

pantalla dedicada.

Flujo:

```text
Datos del ciclo
↓
Estructura académica
↓
Precios por nivel
↓
Resumen
↓
Crear ciclo
```

No mezclarlo con otras configuraciones administrativas.

---

# 55. Paso 1 — Datos del ciclo

Campos:

```text
Nombre / ciclo
2026–2027

Fecha de inicio
[31 ago 2026]

Fecha de fin
[________]
```

Solo los campos realmente requeridos por el modelo actual.

---

# 56. Paso 2 — Estructura académica

Debe permitir seleccionar/configurar lo que corresponda al ciclo.

Ejemplo conceptual:

```text
Niveles

☑ Preescolar
☑ Primaria
☑ Secundaria
```

Grados/grupos según catálogo existente.

No inventar estructura distinta a la soportada.

---

# 57. Paso 3 — Precios por nivel

Aquí sí se define el precio base del ciclo por nivel.

Ejemplo:

```text
Preescolar
$ [________]

Primaria
$ [________]

Secundaria
$ [________]
```

Puede mostrarse:

```text
Precio base de colegiatura
```

como label.

---

# 58. Resumen de ciclo

```text
Ciclo
2026–2027

Inicio
31 ago 2026

Precios base
Preescolar   $...
Primaria     $...
Secundaria   $...
```

CTA:

```text
Crear ciclo
```

---

# 59. Confirmación de creación

```text
✓ Ciclo creado
```

Acciones:

```text
Ver ciclo
Configurar matrícula
```

solo si tienen sentido en el flujo real.

---

# 60. Configuración del ciclo actual

Pantalla:

```text
Ciclo 2026–2027
```

Secciones:

```text
General
Precios
Grupos
Estado
```

Evitar convertir cada una en módulo principal del sidebar.

---

# 61. Precios del ciclo

Debe mostrar:

```text
Preescolar
$X,XXX

Primaria
$X,XXX

Secundaria
$X,XXX
```

Acción:

```text
Editar precios
```

si el rol tiene permiso.

Las consecuencias de cambios posteriores se manejan según reglas ya definidas en el bloque financiero, no se redefinen aquí.

---

# 62. Campañas desde Matrícula

En la pantalla de preinscripciones debe existir acceso:

```text
Campañas
```

como sección secundaria o botón.

No necesariamente como tab principal de toda Matrícula.

---

# 63. Lista de campañas

```text
Campaña 2026–2027
Activa
12 preinscripciones                 ›
```

Otra:

```text
Preescolar agosto
Finalizada
8 preinscripciones                  ›
```

---

# 64. Detalle de campaña

Puede mostrar:

```text
Nombre
Ciclo
Vigencia
Estado
Cantidad de preinscripciones
```

Acciones:

```text
Editar
Cerrar / desactivar
Copiar acceso
```

solo cuando estén funcionalmente disponibles.

---

# 65. Mobile-first del flujo de matrícula

Regla:

> En móvil, una matrícula debe sentirse como una secuencia de decisiones, no como un formulario administrativo enorme.

Usar:

- una columna;
- pasos;
- headers claros;
- botones grandes;
- resumen antes de confirmar.

---

# 66. CTA móvil

En pasos largos, puede usarse una barra inferior sticky:

```text
[ Continuar ]
```

respetando:

```text
safe-area-inset-bottom
```

Solo si no tapa contenido.

---

# 67. Navegación atrás en el flujo

Debe existir:

```text
‹ Atrás
```

y conservar información capturada.

No borrar campos al cambiar de paso.

---

# 68. Abandonar flujo

Si hay información no guardada y el usuario intenta salir:

Dialog:

```text
¿Salir de la matrícula?

Los cambios no guardados se perderán.

[Seguir editando]
[Salir]
```

Solo si realmente hay datos modificados.

---

# 69. Desktop del flujo de matrícula

Desktop puede mostrar:

```text
Stepper horizontal
+
formulario centrado
+
resumen lateral opcional
```

Ejemplo:

```text
Alumno → Ciclo → Finanzas → Ingreso → Resumen

Formulario                         Resumen
-----------------------------------------
...
```

No hacer el formulario de ancho completo.

---

# 70. Tablet

Tablet puede usar:

- formulario de una columna amplia;
- stepper compacto;
- drawer para ayuda/filtros;
- tablas convertidas a listas si el ancho no es suficiente.

---

# 71. Badges y estados

Estados:

```text
Preinscrita
Pendiente
Activa
Baja
Finalizada
No continúa
Egresada
```

Usar badges suaves.

El texto es obligatorio.

Color solo como apoyo.

---

# 72. Acciones sensibles

No mostrar permanentemente:

```text
Dar de baja
No continúa
Cambiar estado
```

como botones principales.

Preferencia:

```text
···
```

excepto cuando la pantalla esté dedicada específicamente a completar ese estado.

---

# 73. Toasts

Ejemplos:

```text
✓ Preinscripción guardada
```

```text
✓ Matrícula actualizada
```

```text
✓ Ciclo creado
```

```text
! No se pudo guardar
```

Breves y con icono.

---

# 74. Skeletons

Para Matrícula:

- header;
- tabs;
- búsqueda;
- filas.

Para detalle:

- nombre;
- estado;
- bloques principales.

No spinner central para toda la app.

---

# 75. Empty states

Ejemplo Actual:

```text
No hay alumnos en esta vista.
```

Ejemplo Preinscripciones:

```text
Aún no hay preinscripciones.

Las nuevas solicitudes aparecerán aquí.
```

Acción:

```text
Nueva preinscripción
```

si corresponde.

---

# 76. Error states

Ejemplo:

```text
No pudimos cargar la matrícula.

Intentar de nuevo
```

No mostrar detalles técnicos de Supabase/Postgres.

---

# 77. Accesibilidad

El módulo debe respetar:

- labels visibles;
- focus states claros;
- targets de 44–48px;
- radio/checkbox con área táctil grande;
- errores inline;
- no depender del color;
- orden lógico del teclado;
- selectores cómodos en móvil.

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

## EnrollmentRow

```text
student
grade
group
status
```

## EnrollmentStatus

```text
Preinscrita
Pendiente
Activa
Baja
Finalizada
No continúa
Egresada
```

## EnrollmentStepper

Para el flujo guiado.

## FinancialAgreementSummary

```text
basePrice
category
individualAmount
paymentPlan
```

## LateEnrollmentSummary

```text
effectiveDate
firstChargeMode
suggestedAmount
confirmedAmount
```

## CycleRow

```text
cycle
dates
status
```

## CampaignRow

```text
name
cycle
status
count
```

---

# 80. Rutas conceptuales de F5

```text
/matricula
/matricula/preinscripciones
/matricula/preinscripciones/[id]
/matricula/nueva
/matricula/[id]

/configuracion/ciclos
/configuracion/ciclos/nuevo
/configuracion/ciclos/[id]
```

La estructura exacta puede adaptarse a la implementación existente.

---

# 81. Flujo resumido de Preinscripción

```text
Matrícula
│
└── Preinscripciones
    ├── Nueva preinscripción
    │   └── Confirmación
    │
    ├── Detalle
    │   └── Activar matrícula
    │
    └── Campañas
```

---

# 82. Flujo resumido de Activación

```text
Seleccionar alumno
↓
Ciclo / grado / grupo
↓
Configuración financiera
↓
Fecha efectiva
↓
Primer cobro
↓
Resumen
↓
Confirmar matrícula
↓
Alumno activo en el ciclo
```

---

# 83. Flujo resumido de Ciclo

```text
Configuración
↓
Ciclos
↓
Crear ciclo
↓
Datos
↓
Estructura
↓
Precios por nivel
↓
Resumen
↓
Crear
```

---

# 84. Qué NO hacer

No:

- crear un formulario único gigantesco;
- pedir datos ya existentes;
- esconder el estado de la matrícula;
- mezclar matrícula actual con historial;
- meter campañas como módulo principal del sistema;
- mostrar opciones de estado inválidas;
- usar tablas desktop comprimidas en móvil;
- ocultar la fecha efectiva de ingreso;
- esconder el plan 10/12 cuando sea elegible;
- aplicar automáticamente un monto sugerido sin mostrarlo;
- hacer de la baja una acción primaria visible;
- introducir nuevas reglas financieras desde UI.

---

# 85. Prueba de éxito del flujo

F5 debe considerarse correcto si un administrativo puede:

1. localizar una preinscripción;
2. activarla;
3. seleccionar ciclo, grado y grupo;
4. entender la configuración financiera;
5. establecer la fecha efectiva;
6. resolver el primer cobro cuando sea tardío;
7. revisar el resumen;
8. confirmar la matrícula;

sin necesitar explicación externa.

---

# 86. Resultado esperado de F5

Al finalizar este bloque quedan diseñados conceptualmente:

- módulo Matrícula;
- matrícula actual;
- filtros;
- preinscripciones;
- nueva preinscripción;
- detalle de preinscripción;
- campañas;
- activación al ciclo;
- ingreso tardío;
- configuración financiera de alta;
- plan 10/12;
- fecha efectiva;
- primer cobro;
- cambios de estado;
- no continúa;
- baja;
- histórico por ciclo;
- creación de ciclo;
- precios base por nivel;
- adaptación móvil, tablet y desktop.

---

# 87. Cierre de F5

El principio rector de este módulo es:

> Matrícula debe guiar al usuario por decisiones claras y secuenciales, mostrando solo la información necesaria en cada momento.

La complejidad administrativa y financiera debe permanecer debajo del flujo.

---

# 88. Siguiente bloque recomendado

**F6 — Pagos globales + configuración financiera**

Incluyendo:

- listado global de pagos;
- búsqueda y filtros;
- detalle de pago;
- registro desde módulo Pagos;
- Master registrando a nombre de otro receptor;
- corrección y reversión;
- precios por nivel;
- categorías;
- descuentos;
- becas;
- importe individual;
- cambios efectivos de precio;
- confirmaciones financieras;
- mobile/desktop.
