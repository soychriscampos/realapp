## Alcance funcional cerrado

REAL manejará un único mecanismo de reducción sobre el precio institucional de colegiatura.

### Categorías

* Toda reducción debe pertenecer a una categoría.
* Las categorías pueden ser de:

  * cantidad fija;
  * porcentaje.
* En operación normal del colegio se usará principalmente cantidad fija.
* Un alumno puede tener como máximo una categoría vigente a la vez.
* Puede cambiar de categoría durante el ciclo.
* La categoría no queda ligada permanentemente al alumno: se asigna dentro de cada ciclo.
* En un nuevo ciclo puede conservar la misma, cambiar o quedar sin categoría.
* Si se necesita una reducción que no existe, se crea una nueva categoría y se asigna al alumno.
* Las categorías no tendrán fecha de fin automática; los cambios serán manuales.

### Cálculo

* Precio institucional base − reducción = monto mensual individual.
* Si la categoría es porcentual, el porcentaje se aplica sobre el precio base vigente.
* Categoría 100%: se genera la obligación con monto $0, conservando el registro de que existía una obligación y una reducción total.

### Cambios durante el ciclo

* El alumno puede cambiar de categoría durante el ciclo.
* Si el cambio ocurre a mitad de mes, quien autoriza decide si:

  * aplica al mes actual;
  * aplica al siguiente;
  * se calcula proporcional.
* REAL muestra el cálculo sugerido y la persona autorizada acepta o define el monto final.
* Los cambios futuros no reescriben automáticamente cargos anteriores.

### Cambio de valor de una categoría

* Todos los alumnos dentro de una misma categoría deben compartir la misma regla vigente.
* Si cambia el valor de una categoría, afecta a los alumnos asignados a ella desde la fecha efectiva definida.
* Los cargos ya generados conservan el valor histórico anterior.

### Alumnos pendientes

* Un alumno pendiente no genera cargos.
* Al activarlo se define precio base, categoría y monto correspondiente.
* Si su obligación debe comenzar desde una fecha anterior, los cargos pueden generarse en ese momento usando la categoría asignada al activarlo, aunque la categoría se haya creado después.

### Cambio de precio institucional

* Entre ciclos, cada ciclo puede tener su propio precio base.
* Si cambia durante un ciclo, quien autoriza define si aplica:

  * al mes actual;
  * al siguiente;
  * proporcionalmente.
* Los cargos anteriores no cambian automáticamente.

### Plan 12

* Se cobra el monto mensual individual resultante de precio base menos reducción.

### Plan 10

* Primero se obtiene el monto mensual individual.
* Luego:

  * monto individual × 12;
  * resultado ÷ 10.
* Ejemplo: base $1,000, reducción $200 → monto individual $800 → anual $9,600 → 10 pagos de $960.
* Si cambia categoría o precio durante el ciclo, lo ya cobrado permanece intacto y sólo se recalcula hacia adelante.
* Si ocurre a mitad de mes, quien autoriza define mes actual, siguiente o proporcional.

### Montos sugeridos y ajustes

* REAL calcula un monto sugerido.
* Master o Administrativo pueden aceptarlo o definir otro monto.
* Si se define un monto distinto, debe quedar auditado.

### Permisos

Master y Administrativo pueden:

* crear, editar y desactivar categorías;
* asignar o cambiar categorías;
* modificar precio base;
* definir fechas efectivas;
* aceptar o modificar montos sugeridos;
* autorizar proporcionalidades;
* modificar cargos ya generados mediante acción explícita.

### Auditoría

Todo cambio financiero relevante debe pedir motivo obligatorio y registrar:

* usuario;
* fecha/hora;
* valor anterior;
* valor nuevo;
* motivo.

Los cargos ya generados sólo pueden alterarse mediante acción explícita de Master o Administrativo; nunca como efecto automático de un cambio futuro.

## Pendiente real

**Condonación de deuda histórica:** si existen $4,000 de deuda y se acepta $3,500 para liquidarla, esto no debe resolverse mediante una categoría. Debe conservarse la deuda original y registrar el ajuste/condonación autorizado que deja saldo $0. Revisar si esta regla ya quedó cubierta en el bloque B; si no, agregarla allí.

## Revisión de DB al integrar

Sin proponer todavía cambios concretos de esquema, DB debe ser capaz de representar:

* categorías por ciclo;
* historial de asignaciones de categoría por alumno;
* cambios de categoría dentro del ciclo;
* versiones/vigencias del valor de una categoría;
* snapshots de precio base, reducción efectiva y monto aplicado;
* obligaciones de $0;
* auditoría completa de cambios financieros;
* modificaciones explícitas de cargos históricos sin destruir el valor anterior.

Si el esquema actual guarda una categoría permanente directamente en el alumno o no permite historial/vigencias, eso sería incompatible con estas reglas y deberá revisarse al integrar el bloque C.
