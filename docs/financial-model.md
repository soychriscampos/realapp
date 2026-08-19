# Modelo financiero

## Principio central

El saldo se obtiene de cargos persistentes, aplicaciones de pago, créditos,
ajustes y reversos.

Nunca se reconstruye el pasado multiplicando la tarifa actual por periodos
históricos.

Cada hecho financiero debe conservarse de forma que pueda reconstruirse qué
ocurrió, cuándo ocurrió, qué obligación afectó, cuánto valor estuvo involucrado
y quién autorizó o registró la operación.

---

## Moneda y precisión

- La moneda única es peso mexicano (`MXN`).
- Los importes persistentes usan decimales exactos con escala de dos; nunca
  tipos de punto flotante.
- No se contemplan conversión monetaria, tipos de cambio ni pagos en otra
  moneda.
- Fechas límite y estado vencido se calculan con el día local en
  `America/Mazatlan`.

---

## Componentes

- **Plan financiero:** plantilla configurable de obligaciones y fechas para un
  ciclo y nivel.
- **Acuerdo financiero:** condición individual de un alumno, con importe final,
  vigencia y explicación opcional.
- **Beneficio:** beca o descuento que puede expresarse como porcentaje o
  cantidad fija.
- **Cargo:** obligación congelada de un alumno por concepto, periodo cubierto y
  vencimiento.
- **Pago:** dinero o valor recibido en una fecha y por un método.
- **Aplicación:** cantidad de un pago destinada a un cargo concreto.
- **Crédito:** remanente disponible o reservado.
- **Ajuste:** modificación explícita y auditable del efecto económico de un
  cargo.
- **Reversión:** compensación auditable de una operación financiera incorrecta.
- **Devolución:** salida posterior de valor correspondiente a un pago que sí
  ocurrió.
- **Convenio especial de cuotas:** acuerdo cerrado que redistribuye el valor
  pactado en un calendario distinto al ordinario.
- **Convenio de deuda o pagaré:** compromiso de pago sobre deuda existente sin
  reemplazar los cargos originales.

---

## Tarifas base

La tarifa base institucional se define por:

`ciclo + nivel + concepto`

Ejemplo:

Ciclo 2025-26:

- Primaria / Colegiatura: $2,500
- Preescolar / Colegiatura: $2,400

Las tarifas de un ciclo son independientes de las de otros ciclos.

Modificar la tarifa base de un ciclo futuro no cambia obligaciones ni acuerdos
históricos.

La tarifa base funciona como referencia institucional. La obligación real del
alumno se genera a partir de su acuerdo financiero individual.

---

## Tarifas y beneficios individuales

Cada alumno puede tener un importe final acordado con vigencia.

Los beneficios configurables pueden expresarse como:

- porcentaje;
- cantidad fija.

Ejemplos:

- beca académica: 25%;
- beca hermanos: $1,250;
- beca total: 100%.

Ejemplo:

- tarifa base: $2,600;
- beneficio fijo: $1,250;
- importe individual acordado: $1,350.

El beneficio explica la diferencia frente a la tarifa base, pero el importe
individual final es la fuente para generar cargos.

El importe acordado puede ser `0.00`.

Cambiar la condición financiera del alumno crea una nueva vigencia.

Ejemplo:

- agosto-diciembre: $1,350;
- enero-julio: $1,100.

Los periodos históricos no se recalculan automáticamente.

Modificar cargos ya generados requiere una operación explícita y auditable.

---

## Fechas de un cargo

Cada cargo conserva al menos:

- periodo cubierto, con mes y año;
- fecha de generación;
- periodo o cargo ancla, si existe;
- fecha límite editable;
- ciclo destino;
- importe original;
- concepto;
- origen.

Ejemplo: julio de 2027 puede tener vencimiento en diciembre de 2026 sin dejar de
ser el cargo correspondiente a julio de 2027.

La fecha de vencimiento no determina el periodo que el cargo cubre.

---

## Obligaciones ordinarias

El plan ordinario contempla doce periodos de colegiatura:

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

Aunque dos periodos se cobren conjuntamente, nunca se convierten en una sola
obligación financiera.

---

## Obligaciones ancladas

Una obligación puede estar vinculada a otro periodo como obligación anclada.

Ejemplos actuales:

- diciembre / julio;
- marzo / agosto.

Cada periodo continúa siendo un cargo independiente.

La relación de ancla afecta la prioridad de cobro.

Si una obligación anclada queda pendiente, la aplicación automática de pagos
posteriores debe priorizar ese saldo antes de avanzar normalmente al siguiente
periodo.

Ejemplo:

- diciembre/julio conserva saldo pendiente;
- llega un pago en enero;
- el sistema propone cubrir primero el saldo pendiente anclado;
- después aplica el remanente a enero.

El usuario autorizado puede modificar explícitamente la aplicación sugerida.

### Excepciones individuales de ancla

La regla institucional de anclas puede modificarse para una matrícula concreta.

Esto aplica especialmente en:

- nuevo ingreso a mitad del ciclo;
- reactivación después de una baja;
- ingreso o reactivación durante un mes que contiene una obligación anclada.

Para cada obligación relevante debe poder definirse:

- cobrar ahora;
- cobrar posteriormente;
- no cobrar.

Si se cobrará posteriormente, debe definirse una nueva condición de vencimiento
o tratamiento.

La excepción individual tiene prioridad sobre la configuración general del
plan.

---

## Generación de obligaciones

Al confirmar las condiciones financieras de una matrícula se generan las
obligaciones conocidas del ciclo.

Esto permite aplicar pagos anticipados directamente a cargos futuros.

Los cargos futuros existentes no se consideran deuda vencida mientras no
alcancen su fecha de vencimiento y conserven saldo.

### Nuevo ingreso después del inicio del ciclo

Para alumnos que ingresan después del comienzo del ciclo:

- no se generan obligaciones ordinarias de periodos anteriores que nunca les
  aplicaron;
- el periodo de ingreso puede generar una obligación proporcional;
- las obligaciones ancladas requieren decisión explícita;
- los periodos posteriores aplicables se generan normalmente.

Ejemplo:

Alumno inicia el 18 de septiembre:

- agosto: no aplica;
- septiembre: sugerencia proporcional;
- octubre en adelante: obligaciones ordinarias.

### Baja y reactivación

Una baja puede detener las obligaciones futuras o conservarlas, según la
decisión administrativa registrada.

Si la baja detuvo obligaciones futuras y el alumno regresa durante el mismo
ciclo:

- los periodos de ausencia no se reconstruyen automáticamente;
- la misma inscripción continúa;
- se retoma la generación de obligaciones desde la nueva fecha efectiva;
- se revisa el proporcional del periodo de regreso;
- se resuelven nuevamente las obligaciones ancladas.

---

## Prorrateo

Sugerencia:

`tarifa mensual × días naturales cobrables restantes / días naturales del mes`

El sistema no redondea automáticamente.

Muestra el cálculo y el usuario captura la cifra final acordada.

El autorizador proviene de la sesión.

Si el importe final difiere de la sugerencia, se registra motivo.

La fecha de inicio sugiere un importe, pero nunca decide automáticamente cuánto
debe pagar el alumno.

---

## Pagos anticipados

Un pago puede recibirse antes del periodo que cubre.

Ejemplos:

- pagar septiembre durante julio;
- pagar agosto durante marzo;
- pagar julio durante diciembre;
- cubrir inscripción del ciclo siguiente mediante una campaña previa.

La fecha del pago y el periodo cubierto son conceptos independientes.

Un pago anticipado debe aplicarse al cargo futuro concreto cuando éste exista.

---

## Pagos y abonos

Se permiten pagos parciales.

Un pago puede aplicarse a varios cargos.

Un cargo puede recibir varios pagos.

Ejemplo:

Pago de $3,000:

- septiembre: $2,500;
- octubre: $500.

El saldo pendiente de octubre permanece abierto.

Un mismo pago puede aplicarse a cargos de distintos ciclos del mismo alumno.

La deuda conserva siempre el ciclo de origen.

---

## Aplicación sugerida de pagos

La aplicación automática debe seguir una prioridad general:

1. obligaciones ancladas pendientes que deban cubrirse antes de avanzar;
2. deuda vencida anterior;
3. siguiente colegiatura pendiente;
4. obligaciones futuras.

La aplicación es una sugerencia.

Master y usuarios con la capacidad correspondiente pueden modificarla antes de
confirmar.

Si el padre solicita pagar específicamente una mensualidad futura, puede
hacerse, pero debe seleccionarse expresamente durante el cobro.

Por defecto, el sistema no debe saltar una obligación pendiente sin que el
usuario lo indique.

---

## Créditos y excedentes

Si un pago excede el importe de los cargos seleccionados, el remanente se
conserva como crédito.

Ejemplo:

- cargo: $2,500;
- pago: $3,000;
- aplicación: $2,500;
- crédito disponible: $500.

El excedente no se convierte artificialmente en otro pago.

El crédito puede:

- quedar disponible para la siguiente obligación;
- reservarse para un cargo específico.

Si el cargo futuro ya existe, es preferible aplicar directamente el pago al
cargo en lugar de crear un crédito reservado innecesario.

El saldo disponible de un crédito debe conservar trazabilidad de su origen y sus
aplicaciones.

---

## Correcciones de pagos

Un pago confirmado no se elimina físicamente.

Si un pago fue registrado incorrectamente, se crea una reversión o cancelación
auditable.

La reversión conserva:

- pago original;
- motivo;
- usuario;
- fecha;
- efectos financieros compensados.

Si el pago tenía aplicaciones, éstas deben quedar compensadas.

Si generó crédito, el crédito originado debe compensarse también.

Un crédito no puede sobrevivir como saldo disponible si el pago que lo originó
fue cancelado.

Administrativo puede corregir únicamente pagos registrados por sí mismo cuando
posea la capacidad correspondiente.

Master puede corregir cualquier pago.

Las capacidades pueden delegarse mediante el sistema de roles y permisos.

Fallar el envío de un correo o recibo nunca revierte un pago confirmado.

---

## Devoluciones

Una devolución es diferente de una cancelación.

La cancelación representa un pago incorrectamente registrado.

La devolución representa que el pago sí ocurrió, pero posteriormente el colegio
entregó total o parcialmente el valor recibido.

El pago original se conserva.

La devolución debe registrar:

- pago u origen relacionado;
- importe;
- fecha;
- motivo;
- usuario responsable;
- usuario autorizador cuando corresponda.

Los reportes deben distinguir:

- importe bruto recibido;
- devoluciones;
- importe neto.

Por defecto, Master tiene capacidad para realizar o autorizar devoluciones.

Master puede asignar posteriormente esta capacidad a otros roles.

---

## Métodos de pago

Métodos mínimos:

- efectivo;
- transferencia;
- tarjeta;
- especie;
- otro.

`Especie` y `otro` requieren comentario.

Un pago en especie:

- reduce el saldo por el valor autorizado;
- cuenta como ingreso reconocido;
- tiene flujo de efectivo igual a cero.

Esto permite distinguir ingreso económico de entrada real de efectivo.

---

## Convenios especiales de cuotas

El plan ordinario de doce periodos es la operación normal.

El sistema puede soportar convenios especiales que redistribuyan el valor
acordado en un número diferente de cuotas.

Ejemplo:

- colegiatura individual vigente: $2,600;
- valor de doce meses: $31,200;
- convenio especial: diez cuotas de $3,120.

Estos convenios deben contratarse normalmente al inicio del ciclo o antes de que
comience su calendario de pagos.

Una vez iniciado:

- el total pactado queda congelado;
- el calendario queda congelado;
- las cuotas ya pactadas no se recalculan automáticamente;
- un cambio posterior en la tarifa individual no altera el convenio por
  inferencia.

El alumno puede recibir nuevos beneficios o descuentos después de haber firmado
el convenio.

En ese caso, el efecto económico sobre el convenio debe acordarse explícitamente.

La modificación debe conservar:

- convenio original;
- motivo;
- nuevo efecto económico acordado;
- saldo o calendario resultante cuando corresponda;
- fecha;
- autorizador.

No se deben recalcular automáticamente cuotas históricas ni pagadas.

---

## Convenios de deuda y pagarés

Un convenio de deuda o pagaré no reemplaza los cargos originales.

Ejemplo:

El alumno debe:

- octubre: $2,600;
- noviembre: $2,600;
- diciembre: $2,600.

Total adeudado: $7,800.

Puede acordarse un convenio:

- marzo: $2,600;
- abril: $2,600;
- mayo: $2,600.

Los cargos originales permanecen como fuente del saldo.

El convenio representa el compromiso para liquidarlos.

Debe conservar:

- cargos incluidos;
- saldo acordado;
- calendario prometido;
- cuotas;
- fecha;
- observaciones;
- estado;
- usuario autorizador.

Los pagos realizados dentro del convenio continúan aplicándose a los cargos
originales.

Si el colegio acepta reducir una deuda:

- la deuda original no se sobrescribe;
- la reducción se registra mediante un ajuste explícito;
- después puede crearse el convenio sobre el saldo resultante.

---

## Preinscripciones

Una campaña establece un precio propio para adquirir el derecho de inscripción
del siguiente ciclo.

No es necesariamente un anticipo contra un precio regular ya conocido.

La campaña define:

- ciclo destino;
- vigencia;
- precio promocional;
- concepto cubierto;
- si admite abonos;
- política por no continuidad;
- estado.

Si la campaña se paga completamente, la inscripción del ciclo destino queda
cubierta aunque después su precio regular sea mayor.

Ejemplo:

- preinscripción pagada: $2,000;
- inscripción regular posterior: $3,000.

Si la campaña cubría totalmente la inscripción:

- se conservan los $2,000 realmente recibidos;
- la inscripción queda cubierta;
- no se registra artificialmente un pago por $3,000;
- no se genera una diferencia ficticia de $1,000.

Campañas posteriores pueden ofrecer otro precio.

Si el alumno no continúa, se aplica la política configurada:

- no reembolsable;
- reembolsable;
- transferible;
- reasignable;
- decisión manual.

Una excepción conserva resolución, desglose, motivo y autorizador.

---

## Recargos

Inicialmente desactivados.

Si se habilitan, guardan:

- fecha de vigencia;
- importe fijo o porcentaje;
- forma de aplicación.

No son retroactivos por defecto.

Se registran como cargos separados y nunca alteran silenciosamente el importe
original de una colegiatura.

---

## Recibos

El recibo debe mostrar, como mínimo:

- monto recibido;
- fecha;
- método;
- alumno;
- aplicaciones realizadas;
- saldo vencido resultante;
- usuario receptor.

El recibo representa el pago realmente registrado.

Una falla al generar, enviar o entregar el recibo no modifica el estado
financiero del pago.

---

## Reportes

Cobranza responde:

> quién tiene adeudo vencido y cuánto debe.

Finanzas responde:

> qué valor ingresó, cuándo ingresó, por qué concepto, mediante qué método y
> quién lo recibió.

Los reportes deben permitir distinguir:

- ingresos por colegiaturas;
- ingresos por inscripción;
- ingresos por preinscripción;
- otros conceptos;
- fecha real de recepción;
- ciclo al que se aplicó;
- método de pago;
- usuario receptor;
- pagos anticipados;
- pagos aplicados a ciclos anteriores;
- pagos en especie;
- devoluciones;
- ingreso bruto;
- ingreso neto.

También debe ser posible analizar históricos de:

- matrícula activa;
- nuevos ingresos;
- bajas;
- cambios de tarifa;
- becas y descuentos;
- obligaciones generadas;
- valor financiero esperado del ciclo.

La visualización puede realizarse en frontend o herramientas de BI, pero los
datos necesarios para reconstruir estos indicadores deben conservarse en el
modelo.

---

## Roles financieros

Las operaciones financieras sensibles se controlan mediante capacidades
asignables a roles.

Entre otras, pueden existir capacidades para:

- registrar pagos;
- consultar pagos propios;
- consultar pagos de otros usuarios;
- cancelar pagos;
- autorizar devoluciones;
- administrar ajustes;
- consultar cobranza;
- consultar ingresos institucionales;
- administrar configuración financiera.

Master posee inicialmente todas las capacidades financieras y puede asignarlas a
otros roles.

Ejemplo futuro:

`CAJAS`

puede configurarse para:

- registrar pagos;
- consultar únicamente los pagos registrados por su propia cuenta.

Sin acceso automático a ingresos institucionales, pagos de otros usuarios,
devoluciones o configuración financiera.

Las reglas de integridad financiera no son delegables mediante permisos.

Por ejemplo, ningún rol puede autorizar que un pago de un alumno se aplique a
un cargo de otro alumno.

---

## Auditoría

Las operaciones financieras sensibles deben conservar trazabilidad.

Entre ellas:

- cambios de tarifa;
- cambios de beneficio;
- ajustes de cargos;
- reversión de pagos;
- devoluciones;
- modificaciones de aplicaciones;
- modificaciones de convenios;
- condonaciones;
- decisiones excepcionales sobre anclas;
- cambios relacionados con bajas y reactivaciones.

Cuando corresponda deben registrarse:

- usuario;
- fecha;
- motivo;
- valores anteriores;
- valores nuevos;
- entidad afectada.

Los hechos financieros no deben borrarse para ocultar o corregir errores.