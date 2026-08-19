# Modelo académico

## Propósito

Define las reglas funcionales del dominio académico de App REAL.

Incluye estructura académica, materias, periodos, asignaciones docentes, calificaciones, publicación a familias, historial docente y reglas de acceso.

No define SQL, RLS ni frontend.

---

# 1. Estructura académica

La jerarquía es:

ciclo → nivel → grado → grupo

Los niveles y grados son catálogos institucionales.

Ejemplo:

Preescolar
- 1°
- 2°
- 3°

Primaria
- 1°
- 2°
- 3°
- 4°
- 5°
- 6°

Los grupos pertenecen a un ciclo específico.

Por tanto:

- 2025-26 / Primaria / 3° / A
- 2026-27 / Primaria / 3° / A

son grupos distintos.

Los grupos históricos se conservan.

El sistema debe permitir varios grupos por grado, por ejemplo A, B o C, aunque actualmente Colegio REAL normalmente utiliza sólo A.

---

# 2. Materias

Las materias o campos formativos pertenecen a un catálogo configurable.

Inicialmente pueden existir:

- Lenguajes;
- Saberes y pensamiento científico;
- Ética, naturaleza y sociedades;
- De lo humano y lo comunitario;
- Inglés;
- Educación Física.

El sistema debe permitir agregar materias futuras como Artes, Francés, Computación u otras sin modificar código.

Una materia puede configurarse por ciclo y aplicarse a determinados niveles o grados.

La configuración puede cambiar entre ciclos sin modificar historia académica anterior.

---

# 3. Evaluación

Cada materia puede permitir:

- evaluación cuantitativa;
- evaluación cualitativa;
- ambas.

## Cuantitativa

Para la operación actual:

- el profesor captura números enteros;
- rango normal: 6 a 10;
- no captura valores como 8.5 o 9.6.

Los promedios sí pueden contener decimales y son valores derivados.

## Cualitativa

Consiste en una observación por alumno, materia y periodo.

El límite actual es de 250 caracteres.

---

# 4. Periodos

Inicialmente existen tres periodos por ciclo.

Los periodos son configurables.

El periodo no es un módulo independiente del sistema; funciona como contexto y ventana de captura dentro del módulo `Evaluar`.

Estados de captura:

- `CLOSED`
- `OPEN`
- `CAPTURE_CLOSED`

## CLOSED

No permite captura.

## OPEN

Los profesores pueden capturar y modificar calificaciones de sus asignaciones activas.

## CAPTURE_CLOSED

Bloquea modificaciones ordinarias.

Master o administrativo autorizado abre y cierra periodos.

Esto permite cerrar calificaciones antes de generar archivos oficiales para SEP.

Master puede reabrir excepcionalmente un periodo cerrado, dejando auditoría de usuario, fecha y motivo.

Cerrar captura no publica calificaciones a familias.

---

# 5. Flujo del profesor

El profesor ve únicamente los grupos y materias que tiene asignados.

Flujo general:

1. entrar a `Evaluar`;
2. seleccionar periodo;
3. seleccionar materia;
4. cargar los alumnos del grupo;
5. capturar calificación cuantitativa y/o cualitativa;
6. guardar;
7. continuar con otra materia.

La evaluación pertenece a:

- matrícula;
- materia;
- periodo.

Debe existir una sola evaluación para cada combinación.

---

# 6. Asignaciones docentes

El acceso académico se determina mediante asignaciones explícitas.

Una asignación relaciona:

- profesor;
- materia;
- grupo;
- vigencia.

Ejemplos:

Laura
- Inglés → Primaria 1° A
- Inglés → Primaria 2° A
- Inglés → Primaria 3° A

Pedro
- Educación Física → Preescolar 1° A
- Educación Física → Primaria 1° A
- Educación Física → Primaria 2° A

María
- Lenguajes → Primaria 3° A
- Saberes y pensamiento científico → Primaria 3° A
- Ética, naturaleza y sociedades → Primaria 3° A
- De lo humano y lo comunitario → Primaria 3° A

No existen especialidades académicas hardcodeadas.

El sistema puede permitir seleccionar varios grupos en el frontend, pero cada relación profesor–materia–grupo debe conservarse explícitamente.

---

# 7. Historial docente

Las asignaciones docentes son históricas.

Cada asignación tiene:

- fecha de inicio;
- fecha de término opcional.

Si un profesor es sustituido durante el ciclo, no se modifica ni elimina su asignación anterior.

Ejemplo:

Primaria 3° A / Lenguajes / 2026-27

María
- 31-ago-2026 → 15-ene-2027

Laura
- 16-ene-2027 → fin de ciclo

Esto permite conocer:

- qué profesor tuvo cada grupo;
- qué materia impartía;
- en qué ciclo;
- durante qué fechas;
- qué alumnos estaban relacionados con ese grupo.

Los alumnos históricos de un profesor se obtienen mediante:

profesor → asignación → grupo → matrículas → alumnos

No se duplica una lista de alumnos dentro del perfil del profesor.

---

# 8. Cambios de grupo

La matrícula conserva el grupo correspondiente al ciclo.

Los cambios de grupo dentro del mismo ciclo se conservan mediante el historial de matrícula.

Al reconstruir relaciones históricas profesor–alumno deben considerarse:

- vigencia de la asignación docente;
- grupo del alumno;
- cambios históricos de grupo.

---

# 9. Calificaciones e historial de captura

Cada evaluación conserva:

- usuario que la creó;
- fecha de creación;
- usuario de última modificación;
- fecha de modificación.

Esto permite saber quién capturó o modificó una calificación.

La asignación docente y el usuario que capturó la evaluación son historiales complementarios.

---

# 10. Publicación a familias

Guardar una calificación no la hace visible automáticamente.

La publicación es una acción administrativa independiente.

Master o administrativo autorizado publica por:

grupo + periodo

Ejemplo:

Periodo 1

- Primaria 1° A → publicado
- Primaria 2° A → publicado
- Primaria 3° A → no publicado

Si existen A y B, cada grupo se publica independientemente.

Cerrar captura y publicar son operaciones distintas.

---

# 11. Portal familiar

El padre o tutor puede consultar:

- datos del alumno;
- situación financiera;
- historial de pagos;
- calificaciones.

Las calificaciones se muestran únicamente cuando:

1. existe acceso familiar activo;
2. el periodo está publicado para el grupo;
3. el alumno no tiene saldo vencido.

Los cargos futuros todavía no vencidos no bloquean.

Cuando el adeudo vencido se liquida, el acceso vuelve a habilitarse automáticamente.

No se guarda un campo manual como `can_view_grades`; el acceso se deriva.

---

# 12. Promedios y KPIs

El sistema puede mostrar:

- promedio por alumno;
- promedio por materia;
- promedio general del alumno;
- promedio del grupo;
- alumnos evaluados;
- alumnos pendientes.

Las calificaciones capturadas son enteras, pero los promedios pueden contener decimales.

Los promedios son derivados y no se almacenan como valores editables.

---

# 13. Calificación final

Los periodos forman parte del historial académico del ciclo.

Inicialmente la calificación final se obtiene mediante el promedio de los periodos correspondientes.

El promedio final puede contener decimales.

La regla podrá modificarse posteriormente si cambia la operación o normativa.

---

# 14. Visitantes

La clasificación administrativa y la participación académica son conceptos distintos.

Por defecto un visitante puede participar académicamente y recibir evaluación.

La participación debe poder configurarse por clasificación y, cuando sea necesario, sobrescribirse para una matrícula específica.

La participación académica no determina automáticamente la participación financiera.

---

# 15. Onboarding de profesores y personal

El personal interno crea su cuenta mediante onboarding administrativo.

Flujo general:

1. Master o usuario autorizado registra nombre, correo y rol inicial;
2. genera invitación;
3. el usuario abre el enlace;
4. crea sus credenciales;
5. se crea su usuario en Supabase Auth;
6. se crea su perfil;
7. se asigna el rol correspondiente;
8. posteriormente se crean sus asignaciones académicas.

El mecanismo debe servir para distintos roles:

- profesor;
- administrativo;
- cajas;
- coordinación;
- otros roles futuros.

No debe existir exclusivamente como onboarding de profesores.

---

# 16. Autorización académica

Tener rol `PROFESOR` no permite acceder a todos los alumnos.

El acceso académico depende de:

- rol válido;
- asignación docente vigente;
- grupo;
- materia;
- periodo abierto para captura.

Una asignación vencida permanece histórica, pero deja de conceder acceso operativo.

---

# 17. Entidades académicas previstas

## `subjects`

Catálogo reusable de materias.

## `curriculum_subjects`

Configuración de materias por ciclo y contexto académico.

## `evaluation_periods`

Periodos de evaluación y estado de captura.

## `teacher_assignments`

Relaciones históricas profesor–materia–grupo con vigencia.

## `student_evaluations`

Calificaciones por matrícula, materia y periodo.

## `group_period_publications`

Publicación administrativa por grupo y periodo.

---

# 18. Fuentes de verdad

| Dato | Fuente |
|---|---|
| Materia | `subjects` |
| Configuración por ciclo | `curriculum_subjects` |
| Grupo del alumno | `enrollments` + historial |
| Profesor asignado | `teacher_assignments` |
| Historial docente | `teacher_assignments` + grupos + matrículas |
| Calificación | `student_evaluations` |
| Promedios | derivados |
| Estado de captura | `evaluation_periods` |
| Publicación familiar | `group_period_publications` |
| Acceso familiar | `family_access` |
| Bloqueo por adeudo | derivado de finanzas |

---

# 19. Principios de historial

No se elimina historia académica relevante.

- las asignaciones docentes anteriores se conservan;
- un cambio de profesor crea otra asignación;
- las evaluaciones históricas no se reasignan;
- grupos y matrículas históricas se conservan;
- cambios de grupo quedan registrados;
- cerrar o publicar un periodo no modifica las evaluaciones existentes.