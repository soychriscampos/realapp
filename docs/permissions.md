# Roles y permisos

## Principios

Todos usan Supabase Auth.

Los permisos deben aplicarse en:

- interfaz;
- servidor;
- políticas RLS cuando corresponda.

Cada persona usa una cuenta propia.

Una cuenta de tutor puede vincularse con varios alumnos.

Los permisos operativos no deben depender exclusivamente del nombre del rol.
El sistema debe trabajar con capacidades asignables a roles.

Master puede crear nuevos roles y asignarles capacidades.

Las reglas estructurales de seguridad y negocio no son permisos configurables.

Ejemplos:

- un pago de un alumno nunca puede aplicarse a un cargo de otro alumno;
- un tutor nunca puede consultar alumnos no vinculados a su acceso familiar;
- un profesor no puede consultar alumnos fuera de sus asignaciones vigentes.

---

## Roles iniciales

El sistema inicia con estos roles base:

- `MASTER`
- `ADMINISTRATIVO`
- `PROFESOR`
- `TUTOR`

Estos roles representan la configuración inicial, no un catálogo cerrado.

Master puede crear roles adicionales.

Ejemplo futuro:

- `CAJAS`

Un nuevo rol recibe únicamente las capacidades que Master le asigne.

---

## Capacidades

Las capacidades deben poder asignarse a roles cuando corresponda.

Entre otras, pueden existir:

### Alumnos y matrícula

- ver todos los alumnos;
- crear alumnos;
- editar alumnos;
- crear matrículas;
- editar matrículas;
- registrar bajas;
- reactivar alumnos;
- administrar preinscripciones.

### Finanzas

- registrar pagos;
- consultar pagos propios;
- consultar pagos de otros usuarios;
- consultar saldo;
- consultar cobranza;
- consultar ingresos institucionales;
- cancelar pagos propios;
- cancelar pagos de otros usuarios;
- realizar ajustes;
- realizar o autorizar devoluciones;
- administrar tarifas;
- administrar beneficios y descuentos;
- administrar convenios financieros;
- administrar campañas de preinscripción.

### Académico

- ver grupos asignados;
- capturar calificaciones;
- modificar calificaciones permitidas;
- aprobar publicación;
- consultar calificaciones publicadas;
- administrar asignaciones docentes.

### Configuración y seguridad

- administrar ciclos;
- administrar usuarios;
- crear roles;
- editar roles;
- asignar permisos.

No todas las capacidades tienen que exponerse desde la primera versión de la
aplicación, pero el modelo de autorización debe permitir incorporarlas sin
tener que redefinir la arquitectura.

---

# Matriz inicial recomendada

Esta matriz representa la configuración inicial de Colegio REAL.

Puede modificarse posteriormente mediante roles y capacidades, salvo reglas
estructurales que el sistema deba aplicar siempre.

| Capacidad | Master | Administrativo | Profesor | Tutor |
|---|---:|---:|---:|---:|
| Ver alumnos | Todos | Todos | Sólo asignados | Sólo vinculados |
| Crear/editar alumno y matrícula | Sí | Sí | No | No |
| Registrar bajas/reactivaciones | Sí | Sí | No | No |
| Administrar preinscripciones | Sí | Sí | No | No |
| Registrar pagos | Sí | Sí | No | No |
| Consultar pagos propios | Sí | Sí | No | No |
| Consultar pagos de otros usuarios | Sí | No | No | No |
| Editar/cancelar pago propio | Sí | Sí | No | No |
| Editar/cancelar pago ajeno | Sí | No | No | No |
| Realizar ajustes financieros | Sí | Según permiso | No | No |
| Autorizar devoluciones | Sí | No por defecto | No | No |
| Consultar saldo | Todos | Todos | No | Sólo vinculados |
| Ver matrícula | Sí | Sí | Sólo grupos asignados | No |
| Ver cobranza | Sí | Sí | No | No |
| Ver ingresos institucionales | Sí | No | No | No |
| Configurar tarifas y beneficios | Sí | No por defecto | No | No |
| Gestionar convenios financieros | Sí | Según permiso | No | No |
| Configurar ciclos y campañas | Sí | Operación delegable | No | No |
| Asignar profesores | Sí | Según permiso | No | No |
| Capturar calificaciones | No por defecto | No por defecto | Sólo asignadas | No |
| Aprobar publicación | Sí | Sí | No | No |
| Ver calificaciones publicadas | Sí | Sí | Sólo asignadas | Si no hay adeudo vencido |
| Administrar usuarios | Sí | No | No | No |
| Crear y editar roles | Sí | No | No | No |
| Asignar permisos a roles | Sí | No | No | No |

---

## Master

Master tiene acceso administrativo completo al sistema.

Entre sus capacidades iniciales:

- consultar todos los alumnos;
- administrar alumnos y matrículas;
- administrar pagos;
- consultar ingresos institucionales;
- realizar ajustes;
- cancelar cualquier pago;
- realizar o autorizar devoluciones;
- administrar tarifas, beneficios y convenios;
- administrar ciclos;
- administrar usuarios;
- crear y editar roles;
- asignar capacidades a roles.

Master no debe quedar limitado por la matriz inicial de otros roles.

La capacidad de administrar roles y permisos pertenece a Master.

---

## Administrativo

El rol Administrativo representa al personal que opera el colegio de forma
general.

Inicialmente puede operar:

- alumnos;
- matrículas;
- altas;
- bajas;
- reactivaciones;
- pagos;
- saldos;
- cobranza;
- preinscripciones.

Puede ver sus propios totales operativos del día.

No puede consultar por defecto:

- ingresos institucionales consolidados;
- comparaciones entre receptores;
- movimientos agregados de otros usuarios;
- configuración financiera sensible.

Puede modificar o cancelar sus propios pagos cuando posea la capacidad
correspondiente.

No puede modificar o cancelar pagos registrados por otra persona salvo que
Master le conceda explícitamente esa capacidad.

Las capacidades adicionales pueden delegarse mediante roles y permisos.

---

## Rol Cajas

`CAJAS` no necesariamente existe desde la primera versión, pero el sistema debe
permitir crearlo posteriormente.

Una configuración posible es:

### Puede

- registrar pagos;
- consultar pagos registrados por su propia cuenta;
- consultar la información mínima del alumno necesaria para realizar el cobro;
- generar el recibo correspondiente.

### No puede por defecto

- consultar pagos registrados por otros usuarios;
- consultar ingresos institucionales;
- consultar totales de otros receptores;
- editar alumnos;
- modificar matrículas;
- configurar tarifas;
- modificar beneficios;
- administrar convenios;
- cancelar pagos ajenos;
- realizar devoluciones;
- administrar usuarios.

Master puede modificar estas capacidades posteriormente.

---

## Devoluciones

Realizar o autorizar devoluciones es una capacidad específica.

Por defecto:

- Master posee esta capacidad.
- Administrativo no la posee.
- Profesor no la posee.
- Tutor no la posee.

Master puede concederla posteriormente a otro rol.

Por ejemplo, podría existir en el futuro un rol administrativo financiero con
permiso para autorizar devoluciones.

Una devolución debe seguir las reglas financieras de auditoría aunque el usuario
tenga permiso para realizarla.

Tener el permiso no elimina la obligación de registrar:

- importe;
- motivo;
- fecha;
- pago relacionado;
- responsable;
- autorizador cuando corresponda.

---

## Profesor

El acceso del profesor depende de asignaciones activas.

Tener el rol `PROFESOR` no concede acceso general a alumnos o calificaciones.

El profesor sólo puede acceder a:

- grupos asignados;
- alumnos pertenecientes a sus asignaciones;
- materias o campos académicos autorizados;
- periodos habilitados para captura.

Las asignaciones deben tener vigencia.

Si la asignación deja de ser válida, el acceso derivado de ella también debe
terminar.

El profesor no tiene acceso a información financiera del alumno.

---

## Tutor

El tutor puede consultar únicamente alumnos vinculados mediante accesos
familiares activos.

Una cuenta puede incluir varios hijos.

Cada alumno admite como máximo dos cuentas familiares activas distintas.

El acceso familiar se concede por relación tutor-alumno.

Por lo tanto, el acceso a un hijo puede revocarse sin necesariamente revocar el
acceso a otros hijos.

El tutor puede consultar, cuando corresponda:

- información básica del alumno;
- historial permitido;
- saldo vencido;
- próximo pago;
- calificaciones publicadas.

El tutor sólo puede consultar calificaciones publicadas cuando el alumno no
tenga adeudo vencido, conforme a las reglas académicas y financieras.

Cada pago continúa perteneciendo a un alumno concreto aunque un tutor tenga
varios hijos.

---

## Acceso familiar e invitaciones

Ser contacto o tutor administrativo no concede automáticamente acceso digital.

El acceso al portal requiere una autorización explícita.

El flujo general es:

1. Master o Administrativo selecciona un tutor existente.
2. Selecciona uno o más alumnos autorizados.
3. El sistema genera una invitación.
4. La invitación se envía manualmente al tutor.
5. El tutor captura su correo y contraseña.
6. Se crea su identidad en Supabase Auth.
7. Confirma su correo.
8. La cuenta queda vinculada al tutor.
9. Se activan únicamente los accesos previamente autorizados.

El tutor no puede buscar o reclamar alumnos por nombre, matrícula u otros datos.

Las credenciales heredadas de sistemas anteriores no se reutilizan.

---

## Revocación de acceso familiar

El acceso familiar puede revocarse por alumno.

Ejemplo:

Un tutor tiene acceso a dos hijos.

Puede revocarse:

- acceso al alumno A;

sin revocar:

- acceso al alumno B.

La revocación debe conservar historial.

Eliminar o modificar una relación administrativa tutor-alumno no debe
necesariamente implicar una revocación silenciosa del acceso digital.

Las operaciones sensibles deben resolverse explícitamente.

---

## Autorización por alcance

Además de una capacidad, algunas operaciones dependen del alcance de los datos.

Ejemplos:

### Profesor

Puede tener capacidad de ver alumnos, pero sólo dentro de sus asignaciones
vigentes.

### Tutor

Puede tener capacidad de ver información familiar, pero sólo de los alumnos
vinculados.

### Cajas

Puede tener capacidad de consultar pagos, pero limitada a:

- `propios`

en lugar de:

- `todos`.

### Administrativo

Puede tener capacidad de cancelar pagos propios, pero no pagos ajenos.

Por tanto, el sistema de permisos debe poder representar tanto:

- qué acción puede realizar una persona;
- sobre qué conjunto de registros puede realizarla.

---

## Interfaz, servidor y RLS

Ocultar una acción en la interfaz no constituye seguridad suficiente.

Las restricciones deben verificarse también en servidor.

Cuando las tablas sean accesibles mediante Supabase, las políticas RLS deben
aplicar el alcance correspondiente.

Ejemplos:

- Tutor sólo puede consultar alumnos con acceso familiar activo.
- Profesor sólo puede consultar información académica dentro de asignaciones
  vigentes.
- Un usuario de Cajas no debe obtener mediante una consulta directa los pagos
  registrados por otros receptores si su alcance es únicamente `propios`.

Las políticas de autorización deben construirse a partir de la identidad
autenticada y las relaciones persistidas en la base de datos.

---

## Auditoría

Las acciones sensibles guardan:

- usuario autenticado;
- fecha y hora;
- entidad afectada;
- acción;
- valores relevantes anteriores;
- valores nuevos;
- motivo cuando corresponda.

Entre las acciones auditables se incluyen:

- creación o modificación de roles;
- cambios de permisos;
- altas y bajas;
- reactivaciones;
- cambios de matrícula;
- pagos;
- cancelaciones;
- devoluciones;
- ajustes financieros;
- modificaciones de convenios;
- cambios de acceso familiar;
- publicación de calificaciones.

No debe dependerse de nombres escritos manualmente para identificar al
responsable cuando existe una cuenta autenticada.