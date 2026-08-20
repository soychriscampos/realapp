## Estado

Bloque B funcionalmente cerrado. No se ha diseñado UI ni se han propuesto cambios de DB todavía.

## 1. Registrar pago

* Todo pago pertenece a un solo alumno.
* Un pago puede cubrir múltiples cargos y múltiples ciclos.
* La deuda conserva siempre su ciclo de origen.
* REAL propone aplicación automática con prioridad FIFO:

  1. deuda más antigua de ciclos anteriores;
  2. deuda vencida del ciclo actual;
  3. cargos actuales no vencidos;
  4. excedente a saldo a favor.
* El operador puede romper manualmente ese orden.
* Si rompe la prioridad automática, motivo obligatorio.
* Se permiten pagos parciales.
* Todo monto recibido debe quedar aplicado a cargos o convertido explícitamente en saldo a favor.

## 2. Saldo a favor

* Pertenece al alumno, no a un ciclo.
* No se aplica automáticamente sólo porque aparezca un nuevo cargo.
* Al registrar un pago, REAL puede proponer usar saldo disponible, pero el operador puede decidir no usarlo.
* Puede aplicarse saldo a favor sin recibir dinero nuevo.
* No se transfiere entre alumnos.
* Puede devolverse total o parcialmente al tutor.
* Usar saldo a favor no genera nuevo ingreso.

## 3. Correcciones, reversas y devoluciones

* Ningún pago confirmado se elimina.
* Pago al alumno equivocado → reversa completa + nuevo pago.
* Monto incorrecto → reversa + nueva captura correcta.
* Cargo equivocado → corrección de aplicación.
* Crédito mal aplicado → corrección/reversa de esa aplicación.
* Dinero realmente regresado → devolución.
* Toda reversa, corrección o devolución requiere motivo.
* Una devolución registra además cómo se devolvió el dinero.
* Operaciones ya revertidas o devueltas no se editan libremente.

## 4. Métodos de pago

Métodos base:

* efectivo;
* transferencia;
* depósito;
* tarjeta;
* especie;
* otro.

Todos pueden ser usados por Administrativo y Master.

Los métodos serán configurables por Master, conservando una clasificación que permita distinguir métodos monetarios de especie.

Transferencia/depósito pueden tener referencia textual opcional.

No se almacenan imágenes, comprobantes bancarios ni archivos asociados.

## 5. Pagos en especie

* Reducen deuda igual que un pago ordinario.
* No cuentan como ingreso monetario/caja.
* Requieren valor reconocido y descripción obligatoria.
* Pueden cubrir parcial o totalmente uno o varios cargos.

## 6. Fechas y pagos históricos

Se distinguen obligatoriamente:

* `received_at`: cuándo realmente se recibió el pago.
* `created_at`: cuándo fue capturado en REAL.

Se pueden registrar pagos atrasados sin límite de antigüedad.

Si `received_at < created_at`, queda identificado como captura histórica/tardía.

Los reportes de ingresos usan `received_at`.
Los reportes de captura/auditoría usan `created_at`.

## 7. Receptor vs capturista

Todo pago conserva:

* quién recibió realmente el dinero;
* quién lo capturó;
* cuándo fue recibido;
* cuándo fue capturado.

Administrativo:

* sólo registra pagos recibidos por sí mismo.

Master:

* puede registrar pagos a nombre de cualquier receptor autorizado.

Ejemplo:
Fran recibió el 12 de agosto y Christian captura el 19:

* receptor: Fran;
* `received_at`: 12 de agosto;
* capturista: Christian;
* `created_at`: 19 de agosto.

Una corrección nunca cambia automáticamente al receptor original. Sólo queda registrado quién realizó la corrección.

## 8. Recibos

* Todo pago confirmado puede generar recibo.
* El recibo no se almacena como archivo.
* Se genera bajo demanda desde los datos existentes.
* Puede regenerarse posteriormente para cualquier pago histórico.
* No se usa Supabase Storage para recibos.

El recibo muestra:

* alumno;
* folio único;
* fecha real de recepción;
* monto;
* método;
* receptor;
* desglose de aplicaciones;
* crédito utilizado o saldo a favor generado por ese pago, cuando aplique.

No muestra:

* capturista;
* notas internas;
* auditoría;
* saldo actual completo del alumno.

El recibo representa únicamente ese pago, no funciona como estado de cuenta.

Después de confirmar:

* si existe correo asociado, se intenta enviar automáticamente;
* si el proveedor lo permite, puede enviarse HTML y/o PDF adjunto;
* si no existe correo, puede generarse/descargarse para envío manual por WhatsApp;
* un error de correo nunca revierte ni invalida el pago;
* el envío puede reintentarse.

## 9. Observaciones

Separar conceptualmente:

* nota interna;
* concepto/nota visible en recibo.

En pagos ordinarios son opcionales.

Son obligatorias cuando corresponda en:

* ruptura del orden automático;
* pago en especie;
* reversa;
* devolución;
* corrección.

Los datos no financieros como observación, referencia o concepto pueden corregirse después de confirmar, pero el cambio debe auditarse.

## 10. Caja / reportes diarios

REAL no tendrá cierre de caja ni arqueo físico.

Los reportes son regenerables y se basan en las operaciones vigentes.

Debe poder consultarse:

* ingresos por fecha de recepción;
* operaciones capturadas por fecha;
* pagos por receptor;
* pagos por método;
* resumen individual del receptor.

Pagos en especie se muestran separados del ingreso monetario.

Devoluciones reales disminuyen el neto monetario.

Reversas y correcciones de aplicación no representan por sí mismas salida de dinero.

Un pago recibido después del horario escolar sigue perteneciendo al día correspondiente según `received_at`.

## 11. Permisos

### Administrativo

Puede:

* registrar pagos propios;
* utilizar cualquier método, incluida especie;
* capturar pagos históricos propios;
* aplicar manualmente pagos;
* usar/aplicar saldo a favor;
* corregir, revertir o devolver únicamente operaciones propias;
* editar datos no financieros de operaciones propias;
* ver sus propias operaciones y resumen.

No puede:

* registrar pagos a nombre de otro receptor;
* modificar operaciones de otros usuarios;
* ver el módulo General de Ingresos.

### Master

Puede:

* realizar todo lo anterior;
* registrar pagos a nombre de otros receptores;
* corregir/revertir/devolver operaciones de cualquier usuario;
* editar datos no financieros de cualquier operación;
* consultar ingresos globales;
* filtrar por receptor, fecha y método;
* consultar historial completo.

## 12. Bloqueos posteriores a confirmación

Después de confirmar un pago quedan bloqueados como edición directa:

* alumno;
* monto;
* receptor;
* fecha recibida;
* método;
* aplicaciones financieras;
* créditos consumidos/generados.

Los cambios financieros requieren operación auditable.

Sí pueden modificarse datos descriptivos/no financieros, conservando historial del cambio.

## 13. Auditoría obligatoria

Debe conservarse como mínimo:

* creación del pago;
* receptor;
* capturista;
* `received_at`;
* `created_at`;
* alumno;
* monto;
* método;
* aplicación original;
* cambios de aplicación;
* generación y uso de créditos;
* reversas;
* devoluciones;
* correcciones;
* modificaciones de campos no financieros;
* usuario que ejecutó cada acción;
* fecha/hora;
* motivo cuando corresponda.

## 14. DB vs aplicación

### La DB debe garantizar

* persistencia del pago;
* integridad de montos;
* receptor y capturista separados;
* aplicaciones a cargos;
* créditos;
* reversas;
* devoluciones;
* correcciones;
* auditoría;
* imposibilidad de aplicar más dinero del disponible;
* imposibilidad de consumir crédito inexistente;
* conservación del historial.

### La aplicación debe resolver

* búsqueda de alumno;
* propuesta FIFO;
* aplicación manual;
* advertencias;
* validaciones previas;
* permisos visibles;
* flujo POS;
* generación dinámica del recibo;
* envío por correo;
* descarga;
* reportes y filtros.

## Pendientes reales

No quedan decisiones funcionales relevantes abiertas dentro del alcance definido para el bloque B.

Siguiente paso recomendado: comparar estas reglas contra el schema actual y detectar únicamente gaps reales de arquitectura/DB, sin rediseñar todavía la interfaz.
