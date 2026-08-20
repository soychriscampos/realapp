# REAL — Bloque D: Profesores y Calificaciones

## 1. Profesores, staff y acceso

* Profesor/staff y cuenta de acceso son conceptos distintos.
* Un profesor puede existir como staff sin tener cuenta activa.
* Dar de alta a un profesor no crea automáticamente acceso.
* Master y Administrativo pueden:

  * dar de alta profesores;
  * editar datos básicos;
  * enviar onboarding/invitación;
  * deshabilitar/reactivar acceso.
* Estados conceptuales:

  * Staff: Activo / Inactivo.
  * Acceso: Sin invitación / Invitación enviada / Cuenta activa / Acceso deshabilitado.
* Deshabilitar acceso no elimina historial académico ni asignaciones anteriores.

## 2. Onboarding

* La invitación se envía desde el módulo de profesores.
* Se vincula al ID del staff ya existente.
* El profesor crea su correo/contraseña y activa la cuenta.
* Una vez activo, ve automáticamente lo permitido por sus asignaciones.
* Debe conservarse estado de onboarding y fechas básicas de envío/activación.

## 3. Asignaciones académicas

Una asignación relaciona:

**Profesor + ciclo + grado + grupo + materia + vigencia**

* Las asignaciones pertenecen a un ciclo.
* Conservan historial.
* Un profesor puede impartir:

  * varias materias;
  * varios grupos;
  * combinaciones distintas por ciclo.
* Cuando cambia un profesor, no se sobrescribe la asignación anterior:

  * se cierra su vigencia;
  * se crea una nueva.
* Master y Administrativo pueden crear, modificar y cerrar asignaciones.
* Profesor no puede autoasignarse.

### Profesor de grupo

* Cada grupo tiene un profesor principal vigente.
* Es el responsable académico principal y primer contacto para alumnos/tutores.
* Ser profesor de grupo es distinto de tener asignadas materias.
* Históricamente debe conservarse quién fue profesor principal y quién impartió cada materia.
* En información actual se muestra el profesor vigente.
* En históricos se muestra el profesor que correspondía en ese momento.

### Acceso histórico del profesor

Mientras el profesor siga activo y con acceso:

* puede consultar grupos/asignaciones en los que participó anteriormente;
* ese acceso histórico es sólo lectura;
* aunque posteriormente se reabra captura, el profesor histórico no recupera edición automáticamente.

## 4. Materias

Las materias son un catálogo reutilizable.

Una misma materia puede asignarse a cualquier cantidad de grupos simultáneamente.

Ejemplo: `Lenguajes` es una sola materia y puede utilizarse en 1.º A, 2.º A, 3.º A, etc.

Master y Administrativo pueden:

* crear;
* activar;
* desactivar materias.

Desactivar una materia no elimina historial.

Cada materia debe indicar si:

* participa en el promedio principal; o
* se evalúa por separado.

Actualmente participan en el promedio principal:

* Lenguajes
* Saberes y Pensamiento Científico
* Ética, Naturaleza y Sociedades
* De lo Humano y lo Comunitario

No participan:

* Inglés
* Educación Física

Materias futuras pueden configurarse bajo cualquiera de las dos reglas.

## 5. Periodos y captura

Existen tres periodos académicos.

La captura puede estar abierta o cerrada administrativamente.

El objetivo del cierre es:

* establecer fechas límite;
* evitar modificaciones después de entregar calificaciones;
* conservar evidencia consistente con lo enviado a SEP.

Master y Administrativo pueden abrir, cerrar y reabrir captura.

La apertura/cierre puede hacerse:

* masivamente;
* por profesor;
* por grupo;
* por materia;
* hasta granularidad de:
  **periodo + grupo + materia + profesor**.

También pueden abrir/cerrar todas las asignaciones de un profesor en un periodo de una sola vez.

### Permiso del profesor para editar

Para editar deben cumplirse simultáneamente:

1. tener asignación vigente;
2. tener captura abierta para esa combinación.

Una asignación histórica sólo permite consulta.

Cerrar captura no exige que todas las evaluaciones estén completas. El sistema puede advertir faltantes, pero no impedir el cierre.

## 6. Correcciones después del cierre

Master y Administrativo pueden corregir directamente una calificación cerrada.

No necesitan reabrirla al profesor.

Toda corrección cuantitativa posterior al cierre debe registrar:

* valor anterior;
* valor nuevo;
* usuario;
* fecha/hora;
* motivo obligatorio.

También pueden optar por reabrir granularmente al profesor para que haga la corrección.

El historial original no debe perderse.

## 7. Publicación

La publicación es independiente de la captura.

Se maneja por:

**grupo + periodo**

Master y Administrativo pueden:

* publicar;
* despublicar.

Si se despublica, desaparece inmediatamente del portal del Tutor.

Puede publicarse aunque existan evaluaciones faltantes.

Las materias pendientes aparecen como **sin calificación**.

Si posteriormente se captura o corrige una calificación y el periodo sigue publicado, el Tutor ve automáticamente el valor actualizado.

No es necesario volver a publicar.

## 8. Evaluaciones

La unidad de evaluación es:

**Alumno + periodo + materia**

Cada evaluación requiere obligatoriamente:

* calificación cuantitativa;
* evaluación cualitativa.

### Cuantitativa

* Enteros de 6 a 10.
* No admite decimales.

### Cualitativa

* Texto libre.
* Máximo 250 caracteres.
* Obligatoria.
* Puede repetirse entre alumnos.

No puede confirmarse una evaluación con sólo uno de los dos campos.

El profesor sí puede trabajar parcialmente:

* guardar alumnos ya completados;
* dejar otros pendientes;
* continuar posteriormente.

## 9. Promedios

### Promedio principal del alumno

Sólo incluye las cuatro materias principales.

No incluye Inglés, Educación Física ni otras materias configuradas fuera del promedio principal.

### Promedio por periodo

Cada alumno obtiene promedio de las cuatro materias principales del periodo.

### Promedio general del grupo

Se calcula usando los promedios de los alumnos.

No debe mostrarse como definitivo mientras falten evaluaciones obligatorias de alumnos activos que deben ser evaluados.

### Acumulados

* Después de Periodo II: promedio entre Periodo I y II.
* Después de Periodo III: promedio entre los tres periodos.

Los promedios son calculados, no capturados manualmente.

### Inglés, Educación Física y materias adicionales

Se promedian de manera independiente.

El profesor puede consultar, por ejemplo, el promedio de Inglés de cada grupo.

No alteran el promedio académico principal.

## 10. Altas tardías y bajas

### Alumno que ingresa tarde

El alumno debe contar con evaluación de los periodos correspondientes.

Si trae calificaciones de otra escuela:

* Master;
* Administrativo; o
* Profesor

pueden capturarlas según corresponda.

Si no trae calificaciones, el colegio deberá resolver operativamente la evaluación.

La fecha tardía de ingreso no vuelve automáticamente un periodo “no aplicable”.

### Alumno dado de baja

Si sale antes de ser evaluado:

* REAL no obliga a generar evaluación;
* deja de aparecer como alumno activo del grupo;
* deja de afectar completitud y promedios posteriores.

Las calificaciones ya existentes se conservan históricamente.

## 11. Qué puede hacer el Profesor

Puede:

* ver grupos y materias vigentes;
* ver alumnos correspondientes;
* capturar cuantitativa y cualitativa con captura abierta;
* modificar mientras tenga autorización de captura;
* consultar promedios correspondientes;
* consultar históricamente asignaciones anteriores mientras siga activo;
* consultar nombre y teléfono de contactos autorizados de alumnos vigentes.

Puede ver de los contactos:

* nombre;
* teléfono del contacto 1;
* teléfono del contacto 2, si existe.

No puede ver:

* información financiera;
* domicilio;
* documentos familiares;
* datos personales adicionales no necesarios.

El acceso a teléfonos aplica a asignaciones vigentes, no al histórico académico.

No puede:

* abrir/cerrar periodos;
* publicar/despublicar;
* cambiar asignaciones;
* modificar cuando captura esté cerrada;
* desbloquear calificaciones por adeudo.

## 12. Qué ve el Tutor

Por cada hijo puede consultar:

* datos registrados del alumno;
* grado;
* profesor principal actual;
* teléfono del profesor;
* histórico académico;
* profesor correspondiente en periodos/ciclos anteriores;
* calificaciones cuantitativas;
* evaluaciones cualitativas;
* promedio principal de las cuatro materias;
* Inglés;
* Educación Física;
* materias adicionales;
* historial financiero correspondiente al alumno.

No ve:

* fecha de captura;
* usuario que capturó;
* historial de cambios;
* valores anteriores;
* motivos de corrección;
* auditoría interna.

## 13. Bloqueo de calificaciones por adeudo

La evaluación financiera es **individual por alumno**, nunca por familia.

“Estar al corriente” significa:

**no tener saldo vencido pendiente.**

Ejemplo:

* obligación vence día 5;
* hasta día 5 sigue al corriente;
* día 6 sin pagar = adeudo;
* si paga día 7 y cubre lo vencido = vuelve a estar al corriente.

Un saldo vencido de cualquier monto, incluso $0.01 o $0.02, bloquea.

### Regla por periodo

Cuando un periodo está publicado:

* si el alumno está al corriente, puede verlo;
* si tiene saldo vencido, queda bloqueado;
* si posteriormente paga y vuelve a estar al corriente, se habilita.

Una vez que un alumno obtuvo acceso a un periodo, una deuda posterior **no vuelve a bloquear ese periodo anterior**.

Ejemplo:

* Periodo I habilitado estando al corriente.
* Posteriormente genera deuda.
* Periodo I permanece visible.
* Periodo II publicado con deuda → bloqueado.
* Paga → Periodo II se habilita.
* Deuda futura no vuelve a ocultar P1 ni P2.

No existen excepciones manuales de desbloqueo.

Hermanos se evalúan individualmente.

Para mostrar un periodo al Tutor deben cumplirse ambas condiciones:

1. periodo publicado;
2. alumno con derecho financiero adquirido para ese periodo.

## 14. Auditoría

Debe auditarse obligatoriamente:

* altas/cambios relevantes de asignaciones;
* cambio de profesor principal;
* aperturas;
* cierres;
* reaperturas;
* publicación;
* despublicación;
* cambios cuantitativos;
* correcciones administrativas posteriores al cierre;
* activación/desactivación de accesos de profesores.

Para cuantitativas:

* valor anterior;
* valor nuevo;
* usuario;
* fecha/hora.

Para cualitativas no se requiere versionado exhaustivo de cada typo.

Debe conservarse trazabilidad básica de última modificación y, si una corrección ocurre después del cierre por Master/Administrativo, motivo obligatorio.

## 15. Pendientes técnicos a validar contra arquitectura/DB

No implican todavía una decisión de cambio de DB. Debe verificarse si la arquitectura actual soporta:

* separación real entre staff y usuario de autenticación;
* teléfono del profesor dentro de staff;
* vigencia e historial de asignaciones;
* profesor principal por grupo;
* catálogo reutilizable de materias;
* bandera de materia que indica participación en promedio principal;
* apertura/cierre granular por profesor + periodo + grupo + materia;
* histórico de cambios cuantitativos;
* auditoría de cierres, reaperturas y publicación;
* conservación del profesor histórico por grupo/materia;
* persistencia del derecho financiero adquirido por alumno + periodo para evitar bloqueos retroactivos.

## Estado

**Bloque D funcionalmente cerrado.**

No quedan reglas de negocio relevantes pendientes antes de revisar la arquitectura y determinar los ajustes necesarios de DB/aplicación.
