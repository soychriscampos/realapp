# App REAL — Reglas de negocio

Este documento es la fuente principal de verdad funcional de App REAL.

Las reglas aquí descritas representan la operación real de Colegio REAL y tienen
prioridad sobre modelos, tablas, código o documentación previa.

Si el esquema de base de datos o la aplicación contradicen este documento,
se debe revisar la implementación; no modificar la regla para justificar el código.

---

# 1. Principios generales

- App REAL administra un solo colegio.
- La zona horaria operativa es `America/Mazatlan`.
- La moneda es MXN.
- Los importes financieros se manejan con dos decimales.
- Los hechos históricos no deben reconstruirse usando configuraciones actuales.
- Pagos, cargos, bajas, cambios de matrícula y demás hechos relevantes deben conservar historial.
- No se eliminan movimientos financieros históricos para corregir información; las correcciones deben ser auditables.
- Las reglas de negocio no deben depender exclusivamente del frontend.

---

# 2. Alumno

## 2.1 Identidad permanente

Un alumno representa a una persona y existe una sola vez en el sistema.

Debe conservar, entre otros datos:

- matrícula interna permanente y única;
- nombre;
- sexo;
- fecha de nacimiento;
- referencias heredadas cuando sean necesarias para migración.

La matrícula interna no cambia por ciclo, grado, baja, reingreso o egreso.

Nivel, grado, grupo, clasificación y estado escolar no son propiedades permanentes
del alumno; pertenecen a su participación en un ciclo escolar.

Dar de baja o egresar a un alumno nunca elimina su identidad ni su historial.

---

# 3. Ciclos e inscripción del alumno

## 3.1 Inscripción por ciclo

Un alumno puede tener como máximo una inscripción por ciclo escolar.

La inscripción contiene la situación del alumno dentro de ese ciclo:

- ciclo;
- grado;
- grupo;
- clasificación;
- estado;
- fecha administrativa de alta;
- fecha efectiva de inicio de clases;
- fecha de cierre cuando corresponda.

El alumno puede existir sin tener una inscripción activa.

## 3.2 Nuevo ingreso y reingreso

Nuevo ingreso y reingreso son condiciones relativas al historial del alumno.

Un alumno es de nuevo ingreso cuando participa por primera vez en el colegio.

Un alumno es de reingreso cuando ya tiene participación en uno o más ciclos
anteriores y se incorpora a un nuevo ciclo.

No se crea un nuevo registro de alumno al reingresar.

El sistema debe reconocer esta diferencia porque puede afectar:

- promoción de grado;
- preinscripciones previas;
- obligaciones ya cubiertas anticipadamente;
- condiciones financieras;
- tratamiento de meses iniciales del ciclo.

## 3.3 Estados de inscripción

Los estados base son:

- `PREINSCRITA`
- `PENDIENTE`
- `ACTIVA`
- `BAJA`
- `FINALIZADA`
- `NO_CONTINUA`
- `EGRESADA`

La preinscripción de un ciclo futuro puede coexistir con una inscripción `ACTIVA`
del ciclo actual.

---

# 4. Historial dentro de un ciclo

Cambios dentro de un mismo ciclo no crean una nueva inscripción.

Deben conservarse como hechos históricos, por ejemplo:

- alta;
- activación;
- cambio de grupo;
- cambio de clasificación;
- baja;
- reactivación;
- finalización;
- no continuidad;
- egreso.

Debe conservarse tanto la fecha efectiva del cambio como la fecha en la que fue
registrado.

---

# 5. Baja y reactivación

## 5.1 Baja

Una baja conserva:

- identidad del alumno;
- inscripción;
- pagos;
- cargos;
- adeudos;
- calificaciones;
- historial administrativo.

Debe registrar:

- fecha efectiva;
- motivo;
- observaciones cuando existan;
- usuario que realizó la operación.

## 5.2 Tratamiento financiero de una baja

Una baja no implica automáticamente cancelar todas las obligaciones futuras.

Al registrar la baja debe determinarse explícitamente uno de estos comportamientos:

### Detener obligaciones posteriores

Se conserva toda deuda existente hasta la fecha aplicable y no se generan o
mantienen colegiaturas posteriores.

Ejemplo: un alumno se retira con tres meses vencidos y firma un convenio para
pagar únicamente esa deuda.

### Mantener obligaciones restantes

El alumno puede seguir obligado a pagar todo o parte del resto del ciclo aunque
ya no asista.

### Tratamiento individual

Administración puede decidir cuáles obligaciones conservar y cuáles cancelar.

Las obligaciones ya pagadas nunca se eliminan.

## 5.3 Reactivación dentro del mismo ciclo

Un alumno dado de baja puede regresar durante el mismo ciclo.

No se crea una segunda inscripción.

Ejemplo:

- activo hasta noviembre;
- baja en noviembre;
- reingresa en marzo.

El intervalo de diciembre a febrero debe conservarse como periodo sin participación.

Las colegiaturas de ese intervalo no se generan ordinariamente si la baja había
detenido obligaciones futuras.

Al reactivar al alumno se deben evaluar nuevamente:

- proporcionalidad del mes de regreso;
- cargos posteriores;
- obligaciones ancladas;
- condiciones financieras vigentes.

---

# 6. Clasificación escolar

La clasificación pertenece a la inscripción, no a la identidad permanente del alumno.

Debe ser posible distinguir, entre otras condiciones:

- alumno oficial SEP;
- alumno de plantel no oficial SEP;
- visitante.

Un visitante puede convertirse en alumno oficial durante el mismo ciclo.

El cambio debe conservar historial.

Por ejemplo:

- 31 de agosto a 14 de octubre: visitante;
- desde 15 de octubre: oficial SEP.

Este cambio no modifica automáticamente sus condiciones financieras.

---

# 7. Familia y tutores

## 7.1 Tutor como persona

Un tutor representa una persona real y puede existir aunque no tenga cuenta de usuario.

Un alumno puede relacionarse con múltiples tutores/contactos.

Un tutor puede relacionarse con múltiples alumnos.

La relación puede conservar datos como:

- parentesco;
- prioridad;
- preferencias de comunicación;
- autorización de mensajes;
- información administrativa necesaria.

## 7.2 Relación administrativa y acceso al portal

Ser tutor o contacto no concede automáticamente acceso al portal familiar.

La relación administrativa tutor-alumno y el acceso digital son conceptos separados.

Un alumno puede tener múltiples contactos administrativos pero como máximo dos
cuentas familiares activas con acceso al portal.

## 7.3 Invitación familiar

El acceso familiar se crea mediante invitación previamente asociada a un tutor y
a uno o más alumnos.

Flujo:

1. Master o Administrativo selecciona al tutor.
2. Selecciona los alumnos a los que podrá acceder.
3. El sistema genera un enlace de invitación.
4. El enlace se copia y se envía manualmente, normalmente por WhatsApp.
5. El tutor abre el enlace.
6. Captura su correo y contraseña.
7. Se crea su usuario mediante Supabase Auth.
8. Confirma su correo.
9. La cuenta queda vinculada al tutor.
10. Obtiene acceso exclusivamente a los alumnos autorizados.

No es necesario conocer previamente el correo del tutor para generar la invitación.

Las credenciales heredadas no se migran.

Una cuenta familiar pertenece a un tutor, no a un alumno. Si el mismo tutor está relacionado con varios hermanos, utiliza la misma cuenta para acceder a todos los alumnos autorizados. No se crean cuentas duplicadas del mismo tutor por cada hijo.

## 7.4 Revocación

El acceso puede revocarse por alumno.

Revocar el acceso a un hijo no elimina necesariamente el acceso a otros hijos.

La revocación debe ser explícita y conservar historial.

---

# 8. Estructura general financiera

El sistema debe separar:

- tarifa institucional;
- condiciones financieras individuales;
- cargos;
- pagos;
- aplicaciones de pagos;
- créditos;
- ajustes;
- convenios especiales.

El saldo de un alumno debe derivarse de hechos financieros persistentes.

Nunca debe reconstruirse la deuda histórica multiplicando la tarifa actual por
periodos anteriores.

---

# 9. Tarifas base

Las tarifas base pertenecen a:

`ciclo + nivel + concepto`

Ejemplo:

Ciclo 2025-26:

- Preescolar / Colegiatura: $2,400
- Primaria / Colegiatura: $2,500

Las tarifas del ciclo 2026-27 son independientes.

Modificar la tarifa de un ciclo nuevo no altera ciclos históricos.

Entre los conceptos pueden existir, por ejemplo:

- colegiatura;
- inscripción;
- otros conceptos institucionales configurables.

La preinscripción puede usar precios propios de campaña.

---

# 10. Becas, descuentos y tarifa individual

Un beneficio puede ser:

- porcentaje;
- cantidad fija.

Ejemplos:

- beca académica: 25%;
- beca hermanos: $1,250;
- beca total: 100%.

Si la tarifa base es $2,600 y existe un descuento fijo de $1,250:

- tarifa base: $2,600;
- beneficio: $1,250;
- importe individual acordado: $1,350.

El beneficio explica el cálculo, pero el importe individual acordado es el valor
que gobierna las obligaciones del alumno.

El importe individual puede ser `0.00`.

Un alumno puede recibir nuevos beneficios durante el ciclo.

La tarifa individual puede cambiar a partir de una fecha acordada.

Ejemplo:

- agosto-diciembre: $1,350;
- enero-julio: $1,100.

Los periodos históricos no se recalculan automáticamente.

---

# 11. Obligaciones y cargos

## 11.1 Cargo

Un cargo representa una obligación económica concreta del alumno.

Debe identificar, cuando corresponda:

- alumno;
- ciclo;
- concepto;
- periodo cubierto;
- fecha de vencimiento;
- importe original;
- origen;
- condiciones particulares.

Una vez creado, su importe histórico no cambia porque posteriormente cambie la tarifa.

Las modificaciones se realizan mediante ajustes explícitos.

## 11.2 Colegiaturas

El ciclo ordinario contempla doce periodos de colegiatura:

- agosto;
- septiembre;
- octubre;
- noviembre;
- diciembre;
- enero;
- febrero;
- marzo;
- abril;
- mayo;
- junio;
- julio.

Cada periodo representa una obligación independiente.

Aunque dos obligaciones se cobren juntas, continúan siendo obligaciones separadas.

---

# 12. Obligaciones ancladas

El colegio puede configurar obligaciones ancladas.

Ejemplos actuales:

- diciembre / julio;
- marzo / agosto.

Cuando una obligación anclada queda pendiente, tiene prioridad sobre la siguiente
colegiatura ordinaria.

Ejemplo:

Si queda saldo pendiente del bloque diciembre/julio y se recibe un pago en enero,
el sistema debe aplicar primero el saldo pendiente anclado antes de continuar con enero,
salvo aplicación manual autorizada.

## 12.1 Excepciones de ancla

La regla institucional de anclas puede modificarse para un alumno particular.

Esto ocurre especialmente en:

- nuevo ingreso a mitad de ciclo;
- reactivación después de una baja;
- alumnos que ingresan precisamente durante un mes anclado.

Al incorporar o reactivar al alumno, el sistema debe preguntar por cada ancla relevante:

- cobrarla ahora;
- cobrarla posteriormente;
- no cobrarla.

Si se cobrará posteriormente debe quedar definida su nueva condición de vencimiento.

No debe inferirse automáticamente.

---

# 13. Alumnos que ingresan a mitad de ciclo

Los meses anteriores a la fecha efectiva de ingreso no se consideran deuda.

Ejemplo:

Alumno inicia el 18 de septiembre:

- agosto: no aplica;
- septiembre: se calcula sugerencia proporcional;
- octubre en adelante: obligaciones ordinarias.

El sistema debe calcular una sugerencia proporcional utilizando días naturales,
pero el importe final lo determina la persona autorizada.

La diferencia entre sugerencia e importe acordado debe poder justificarse.

Si el alumno ingresa el 31 de agosto puede sugerirse cobrar únicamente ese día.

Si ingresa posteriormente, los meses anteriores no deben generarse como deuda.

---

# 14. Generación de cargos

Al confirmar las condiciones financieras del alumno se generan las obligaciones
conocidas del ciclo.

Esto permite pagos anticipados.

Para alumnos que ingresan después del comienzo del ciclo:

- los periodos anteriores se excluyen;
- el periodo de ingreso puede requerir proporcional;
- las anclas requieren confirmación;
- los periodos posteriores aplicables se generan normalmente.

Los cargos futuros existentes no son deuda vencida mientras no alcance su fecha
de vencimiento.

---

# 15. Pagos anticipados

Un pago puede recibirse antes del periodo que cubre.

Ejemplo:

- pago recibido en julio de 2026;
- cubre colegiatura de septiembre de 2026;
- pertenece al ciclo 2026-27.

Fecha del pago y periodo cubierto son conceptos independientes.

Esto permite, entre otros casos:

- pagar agosto durante marzo;
- pagar julio durante diciembre;
- pagar septiembre durante julio;
- cubrir inscripción del ciclo siguiente mediante preinscripción.

---

# 16. Pagos y aplicaciones

Un pago representa dinero o valor recibido.

Una aplicación representa cuánto de ese pago se destina a un cargo concreto.

Un pago puede cubrir varios cargos.

Un cargo puede recibir varios pagos.

Ejemplo:

Pago de $3,000:

- septiembre: $2,500;
- octubre: $500.

El saldo de octubre queda pendiente por la diferencia.

---

# 17. Aplicación automática de pagos

El sistema debe sugerir la aplicación del pago.

La prioridad general es:

1. obligaciones ancladas pendientes que deban bloquear avance;
2. deuda vencida anterior;
3. siguiente colegiatura pendiente;
4. obligaciones futuras.

La distribución sugerida puede modificarse explícitamente durante el cobro.

Un padre puede solicitar aplicar el pago a una obligación futura aun existiendo una
anterior, pero esa selección debe realizarse expresamente.

Por defecto el sistema no omite deuda o anclas pendientes.

---

# 18. Pagos parciales y excedentes

Un pago parcial reduce el saldo del cargo.

Ejemplo:

Cargo: $2,500  
Pago: $1,000  
Saldo: $1,500

Si el cargo ya venció, los $1,500 forman parte del adeudo vencido.

Si todavía no vence, permanecen como saldo futuro.

Si un pago excede los cargos seleccionados, el remanente se conserva como saldo a favor.

El excedente no se convierte artificialmente en otro pago.

Puede utilizarse posteriormente para nuevas obligaciones.

---

# 19. Inscripción y preinscripción

## 19.1 Inscripción

La inscripción es una obligación del ciclo escolar correspondiente.

Puede tener:

- tarifa institucional;
- descuento;
- importe individual;
- exención;
- saldo pendiente;
- cobertura mediante preinscripción.

## 19.2 Preinscripción

La preinscripción corresponde a un ciclo futuro.

Puede realizarla:

- un alumno actualmente activo;
- un alumno nuevo.

Una campaña de preinscripción puede tener precio propio.

Ejemplo:

- preinscripción febrero: $2,000;
- inscripción regular posterior: $3,000.

Si la campaña establece que los $2,000 cubren completamente la inscripción:

- se conserva que realmente se recibieron $2,000;
- la inscripción queda satisfecha;
- no se inventa un pago por $3,000;
- no se genera automáticamente una diferencia de $1,000.

El importe realmente recibido siempre debe conservarse.

---

# 20. Deuda entre ciclos

La deuda conserva su ciclo de origen.

Ejemplo:

Un alumno termina 25-26 con deuda de $3,500 y continúa en 26-27.

Debe existir:

- deuda 25-26: $3,500;
- obligaciones propias de 26-27.

La deuda anterior no se transforma artificialmente en un cargo nuevo del ciclo siguiente.

Un pago recibido durante 26-27 puede aplicarse a una obligación de 25-26.

---

# 21. Pagos posteriores a una baja

Un alumno dado de baja puede seguir realizando pagos.

No debe estar activo para que el colegio pueda cobrar adeudos existentes.

---

# 22. Planes especiales de pago

El modelo debe permitir convenios especiales que redistribuyan el costo acordado
en un número diferente de cuotas.

Ejemplo:

Tarifa mensual vigente al contratar:

$2,600 × 12 = $31,200

Convenio especial:

10 pagos × $3,120 = $31,200

Este tipo de convenio:

- debe contratarse normalmente al inicio del ciclo o antes de comenzar su calendario;
- congela el total pactado y su calendario;
- no se recalcula automáticamente por cambios posteriores en la tarifa individual;
- cualquier modificación posterior requiere una modificación explícita y auditada.

Un alumno puede recibir descuentos adicionales después de firmado el convenio,
pero el efecto de ese nuevo beneficio sobre el convenio debe acordarse expresamente.

No se debe inferir automáticamente mediante una fórmula.

El plan ordinario de doce periodos continúa siendo la operación normal.

---

# 23. Registro de ingresos y reportes históricos

El sistema debe permitir distinguir:

- fecha real en que se recibió un pago;
- ciclo al que corresponde;
- concepto;
- cargo cubierto;
- alumno;
- método de pago;
- usuario que recibió el pago.

Debe ser posible consultar históricos como:

- ingresos por día, mes y ciclo;
- ingresos por colegiaturas;
- ingresos por inscripción;
- ingresos por método;
- ingresos por receptor;
- ingresos aplicados a ciclos anteriores;
- ingresos anticipados de ciclos futuros.

También debe ser posible analizar en el tiempo:

- matrícula activa;
- valor esperado de las obligaciones;
- cambios por nuevos ingresos;
- bajas;
- becas;
- descuentos;
- modificaciones de tarifa.

La visualización puede realizarse en frontend o herramientas de BI, pero los
datos históricos necesarios deben conservarse en el modelo.

---

# 24. Usuarios operativos y receptor del pago

Cada pago nuevo debe registrar al usuario autenticado que lo recibió.

No se utilizará únicamente un campo de texto libre como fuente de identidad.

Esto permitirá, entre otras cosas:

- auditoría;
- ingresos por receptor;
- restricciones entre Master y Administrativo.

---

# 25. Principios de auditoría financiera

Los siguientes cambios no deben borrar historia:

- modificación de tarifa;
- ajuste de cargo;
- cancelación o corrección de pago;
- baja;
- cambio de clasificación;
- modificación de convenio;
- revocación de acceso;
- cambio de aplicación financiera.

Los hechos financieros históricos deben permanecer reconstruibles.

---

# Roles y permisos

El sistema inicia con roles base:

- MASTER
- ADMINISTRATIVO
- PROFESOR
- TUTOR

Estos roles no representan un catálogo cerrado.

Master puede crear roles adicionales y asignarles permisos específicos desde la
administración del sistema.

Ejemplo de rol futuro:

CAJAS

Puede configurarse inicialmente para:

- registrar pagos;
- consultar únicamente los pagos registrados por su propia cuenta.

Sin permisos para:

- consultar pagos de otros usuarios;
- consultar ingresos institucionales;
- modificar alumnos;
- modificar configuración financiera;
- cancelar pagos;
- realizar devoluciones.

Los permisos operativos deben asignarse por capacidades y no depender
exclusivamente del nombre del rol.

Entre las capacidades configurables pueden existir:

- registrar pagos;
- consultar pagos propios;
- consultar pagos de otros usuarios;
- cancelar pagos;
- realizar o autorizar devoluciones;
- consultar cobranza;
- consultar ingresos institucionales;
- administrar alumnos;
- administrar ciclos;
- administrar configuración financiera;
- publicar calificaciones;
- administrar usuarios y roles.

Master conserva la capacidad de administrar roles y permisos.

Las reglas estructurales de seguridad y negocio no son permisos configurables.
Por ejemplo, un pago nunca puede aplicarse a un cargo perteneciente a otro alumno,
aunque el usuario tenga permisos financieros.

# Devoluciones

Una devolución es distinta de la cancelación de un pago.

La cancelación indica que el pago fue registrado incorrectamente o no debía
existir como movimiento válido.

La devolución indica que el pago sí ocurrió, pero posteriormente el colegio
entregó total o parcialmente el valor recibido.

Una devolución debe conservar:

- pago u origen relacionado;
- importe;
- fecha;
- motivo;
- usuario responsable;
- usuario autorizador cuando corresponda.

El pago original no se modifica para representar una devolución.

Los reportes deben poder distinguir:

- importe bruto recibido;
- devoluciones;
- importe neto.

Por defecto, Master tiene permiso para realizar o autorizar devoluciones.

Master puede conceder posteriormente este permiso a otros roles desde la
administración de roles y permisos.

# Convenios especiales de pago

El plan ordinario de colegiaturas continúa siendo la operación normal.

El colegio puede ofrecer convenios especiales que redistribuyan el valor
acordado del ciclo en un número diferente de cuotas.

Ejemplo:

- colegiatura individual vigente: $2,600;
- doce meses de cobertura;
- valor pactado al inicio: $31,200;
- convenio especial: diez cuotas de $3,120.

Estos convenios deben contratarse normalmente al inicio del ciclo o antes de
comenzar su calendario de pagos.

Una vez iniciado el convenio:

- el total pactado queda congelado;
- el calendario pactado queda congelado;
- un cambio posterior en la colegiatura individual no recalcula automáticamente
  el convenio.

El alumno puede recibir nuevos descuentos o beneficios posteriormente.

Cuando esto ocurra, el efecto sobre un convenio especial activo debe definirse
explícitamente mediante una modificación autorizada del convenio.

No debe inferirse automáticamente mediante una fórmula.

# Reactivación después de una baja

Un alumno puede darse de baja y posteriormente regresar durante el mismo ciclo.

No se crea una segunda inscripción para el mismo ciclo.

La misma inscripción conserva los distintos intervalos de participación.

Ejemplo:

- activo hasta noviembre;
- baja en noviembre;
- reactivación en marzo.

Los meses comprendidos entre baja y reactivación no generan nuevas obligaciones
ordinarias cuando la baja haya detenido los cargos futuros.

Al reactivar al alumno, el sistema debe revisar nuevamente:

- proporcionalidad del mes de regreso;
- obligaciones futuras;
- obligaciones ancladas;
- condiciones financieras vigentes.

Si el alumno regresa o ingresa durante un mes que contiene una obligación
anclada, el sistema debe solicitar una decisión explícita:

- cobrar la obligación anclada en ese momento;
- cobrarla posteriormente;
- no cobrarla.

Esta decisión no debe inferirse automáticamente.



# 26. Reglas todavía pendientes de cerrar

Antes de considerar este documento completamente definitivo falta definir:

- cancelación y corrección de pagos;
- devoluciones;
- pagos en especie y otros métodos especiales;
- convenios/pagarés para deuda ya vencida;
- política completa cuando una preinscripción se paga y el alumno finalmente no ingresa;
- recargos, si se utilizarán en el futuro;
- reglas finales de recibos;
- reglas académicas detalladas;
- permisos finales por rol.

Estas decisiones se agregarán directamente a este documento.

No se crearán documentos de fase independientes para cada decisión.


## Correo principal del tutor

Cada tutor mantiene un único correo electrónico principal en App REAL.

Este correo es la fuente de verdad para comunicaciones administrativas,
recordatorios, comprobantes y, cuando el tutor tiene una cuenta familiar,
también corresponde al correo utilizado para autenticación.

No deben mantenerse un correo administrativo y un correo de acceso como
destinatarios independientes para la misma persona.

Antes de que exista una cuenta familiar, Administración puede capturar y editar
el correo del tutor.

Cuando el tutor acepta una invitación, el correo existente debe mostrarse como
valor inicial.

Si durante el registro el tutor confirma un correo diferente, el correo
verificado utilizado para su cuenta pasa a ser su correo principal.

Posteriores cambios de correo deben actualizar de forma consistente tanto la
identidad de autenticación como el correo principal del tutor.

Los envíos de correo se determinan mediante las relaciones y preferencias de
contacto del alumno. La dirección almacenada en Supabase Auth no se agrega como
un destinatario adicional.

## Datos de una preinscripción

Toda preinscripción debe identificar:

- ciclo destino;
- nivel destino;
- grado destino;
- alumno;
- tutor o contacto principal;
- contactos adicionales cuando existan.

Cuando el alumno o tutor ya existen, el sistema debe reutilizar sus registros y
mostrar sus datos actuales en el formulario.

Cuando se trata de un alumno nuevo, la preinscripción crea o reutiliza desde ese
momento la identidad del alumno y de sus tutores, aunque todavía no exista una
matrícula formal para el ciclo destino.

Los datos de personas no deben duplicarse dentro de la preinscripción.

La preinscripción conserva principalmente la intención escolar y financiera:
ciclo, nivel, grado, campaña, estado y demás condiciones propias del proceso.