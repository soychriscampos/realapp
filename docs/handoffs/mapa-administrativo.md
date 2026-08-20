# Bloque E — Mapa administrativo y reportes

## 1. Navegación funcional principal

* Inicio
* Alumnos
* Matrícula
* Finanzas

  * Registrar pago
  * Deuda
  * Pagos
  * Mis ingresos
  * General de Ingresos — sólo Master
* Preinscripciones
* Familias / Tutores
* Académico

  * Profesores
  * Calificaciones
  * Seguimiento de captura
* Reportes
* Configuración

  * Ciclos
  * Tarifas / configuración financiera
  * Campañas de preinscripción
  * Usuarios y accesos

No define todavía layout visual, menús, tarjetas ni componentes.

---

## 2. Inicio

### Master

Debe mostrar o dar acceso directo a:

* ciclo activo;
* matrícula actual;
* cantidad de alumnos con deuda vencida;
* monto total de deuda vencida;
* información institucional de ingresos;
* pagos recientes;
* alertas operativas;
* seguimiento académico cuando corresponda.

Accesos rápidos mínimos:

* Registrar pago
* Buscar alumno
* Deuda
* Estado de cuenta
* Matrícula
* General de Ingresos
* Reportes

### Administrativo

Debe mostrar:

* ciclo activo;
* matrícula actual;
* cantidad de alumnos con deuda vencida;
* monto total equivalente;
* sus propios ingresos recibidos;
* sus operaciones recientes;
* alertas operativas;
* pendientes académicos relevantes.

Accesos rápidos mínimos:

* Registrar pago
* Buscar alumno
* Deuda
* Estado de cuenta
* Mis ingresos
* Matrícula
* Preinscripciones

Administrativo no accede al consolidado institucional de ingresos.

---

## 3. Alumnos

Es el directorio maestro y la vista 360° del alumno.

Filtros principales:

* nombre;
* ciclo;
* nivel;
* grado;
* grupo;
* estatus;
* matriculado/no matriculado;
* con deuda;
* con deuda vencida;
* al corriente.

Acciones:

* abrir alumno;
* registrar pago;
* consultar estado de cuenta.

### Detalle del alumno

Debe concentrar:

#### Resumen

* datos generales;
* estado;
* ciclo actual;
* grado/grupo;
* saldo pendiente;
* deuda vencida;
* último pago;
* tutores;
* configuración financiera individual relevante.

#### Matrícula / ciclos

* participaciones históricas;
* ciclo;
* grado;
* grupo;
* altas;
* bajas;
* estado de participación.

#### Estado de cuenta

Siempre por alumno.

Debe explicar:

* obligaciones;
* conceptos;
* descuentos/ajustes;
* pagos y abonos;
* devoluciones;
* saldo pendiente;
* saldo vencido;
* saldo no vencido;
* receptor de cada pago.

Acciones:

* registrar pago;
* descargar;
* enviar por correo;
* generar documento para compartir manualmente por WhatsApp;
* abrir detalle de pago.

El estado de cuenta no es un recibo.

#### Deuda

Muestra exclusivamente obligaciones pendientes:

* concepto;
* ciclo;
* monto original;
* ajustes;
* pagado;
* saldo;
* vencimiento;
* vencida/no vencida.

Incluye deuda histórica aunque el alumno ya no esté matriculado actualmente.

#### Pagos

Historial de operaciones:

* fecha real de recepción;
* fecha de captura;
* monto;
* método;
* receptor original;
* monetario/especie;
* estado;
* devoluciones relacionadas.

Administrativo puede ver pagos recibidos por otros usuarios cuando consulta el historial de un alumno, pero no modificarlos si no son propios.

#### Tutores

* tutores asociados;
* relación;
* datos de contacto;
* estado de acceso;
* otros alumnos vinculados al tutor.

#### Calificaciones

Consulta histórica por:

* ciclo;
* periodo académico;
* materia.

#### Preinscripciones

Historial de preinscripción del alumno.

#### Configuración financiera individual

Consulta de lo ya definido en C:

* tarifa/categoría;
* beca;
* descuento;
* monto particular;
* esquema aplicable.

---

## 4. Matrícula

Vista colectiva de participación escolar.

Debe permitir consultar:

* alumno;
* ciclo;
* nivel;
* grado;
* grupo;
* estado;
* alta;
* baja;
* oficial/no oficial;
* sexo H/M.

Filtros:

* ciclo;
* nivel;
* grado;
* grupo;
* estado;
* oficial/no oficial;
* H/M;
* búsqueda por alumno.

Debe mostrar agregados:

* total general;
* total por nivel;
* total por grado;
* total por grupo;
* hombres;
* mujeres;
* oficiales;
* no oficiales;
* altas;
* bajas;
* alumnos nuevos.

### Evolución de matrícula

Reporte indispensable desde día uno.

Debe responder cómo cambia la matrícula entre fechas.

Permite:

* ciclo completo;
* rango personalizado;
* consulta en una fecha exacta;
* evolución mensual tomando fotografía al cierre de cada mes.

Debe mostrar:

* matrícula inicial;
* altas;
* bajas;
* matrícula final.

Filtros:

* ciclo;
* nivel;
* grado;
* grupo;
* H/M;
* oficial/no oficial.

Debe permitir abrir los alumnos que explican las altas o bajas.

---

## 5. Finanzas

### Registrar pago

Acción global reutilizada desde:

* Inicio;
* alumno;
* deuda;
* estado de cuenta;
* preinscripción cuando corresponda.

Todos los accesos llevan al mismo flujo definido en B.

### Deuda

Responde:

> Quién debe, cuánto debe y desde cuándo.

Debe mostrar:

* alumno;
* ciclo;
* saldo pendiente;
* vencido;
* no vencido;
* obligación vencida más antigua;
* estatus;
* datos de contacto relevantes.

Filtros:

* ciclo;
* nivel;
* grado;
* grupo;
* estatus;
* deuda/deuda vencida;
* monto;
* antigüedad;
* concepto.

Acciones:

* abrir alumno;
* registrar pago;
* estado de cuenta;
* detalle de obligación.

### Pagos

Consulta de operaciones registradas.

Campos relevantes:

* alumno;
* fecha real de recepción;
* fecha de captura;
* monto;
* método;
* receptor;
* monetario/especie;
* estado;
* devolución.

Filtros:

* rango de fechas;
* alumno;
* receptor;
* método;
* tipo;
* estado;
* fecha real;
* fecha de captura.

### Mis ingresos

Disponible para Master y Administrativo.

Muestra exclusivamente las operaciones donde el usuario actual fue el receptor original.

Permite filtrar por:

* rango de fechas;
* alumno;
* método;
* ciclo cuando corresponda.

No existe cierre de caja ni arqueo.

### General de Ingresos

Sólo Master.

Representa únicamente operaciones efectivamente recibidas.

Debe permitir analizar:

* ingresos monetarios;
* pagos en especie separados;
* devoluciones;
* neto;
* receptor;
* método;
* concepto;
* fecha;
* ciclo.

No debe mezclar deuda u obligaciones pendientes con ingresos.

---

## 6. Familias / Tutores

Módulo propio.

Permite localizar tutores por:

* nombre;
* teléfono;
* correo;
* alumno relacionado.

Detalle del tutor:

* datos;
* alumnos asociados;
* relación con cada alumno;
* estado de acceso;
* vínculo a su usuario;
* navegación a cada alumno.

Tutor y usuario son entidades distintas.

No existe estado de cuenta consolidado familiar en fase uno.

---

## 7. Preinscripciones

Debe mostrar:

* alumno;
* ciclo objetivo;
* campaña;
* fecha;
* monto;
* estado;
* pago asociado;
* saldo cuando corresponda;
* si posteriormente se matriculó.

Filtros:

* ciclo;
* campaña;
* estado;
* fecha;
* grado destino;
* pagada/pendiente;
* matriculado/no matriculado;
* alumno.

Acciones:

* abrir alumno;
* registrar pago;
* consultar pago;
* continuar hacia matrícula cuando corresponda;
* ver detalle.

Debe existir acceso directo:

**Crear campaña**

Ese acceso lleva a la configuración correspondiente; no duplica la configuración dentro de Preinscripciones.

---

## 8. Académico

### Profesores

Consulta:

* profesor;
* activo/inactivo;
* ciclo;
* grupos;
* materias;
* asignaciones;
* usuario vinculado.

Filtros:

* ciclo;
* grado;
* grupo;
* materia;
* estado;
* nombre.

### Calificaciones

Vista administrativa de consulta y supervisión.

Filtros:

* ciclo;
* periodo académico;
* grado;
* grupo;
* materia;
* profesor;
* alumno.

Permite consultar:

* calificaciones;
* observaciones;
* estado de captura.

### Seguimiento de captura

Debe permitir detectar:

* grupos completos;
* grupos incompletos;
* materias pendientes;
* profesores pendientes;
* alumnos sin evaluación capturada.

---

## 9. Configuración

Debe centralizar reglas estructurales.

### Ciclos

Permite:

* crear ciclo;
* consultar ciclos;
* modificar parámetros permitidos;
* activar ciclo;
* conservar ciclos históricos.

No se eliminan ciclos con información histórica.

Crear ciclo debe conducir a la configuración del precio base de colegiatura por nivel correspondiente a ese ciclo, reutilizando la configuración financiera definida en C.

### Tarifas / configuración financiera

Consume lo definido en C.

Debe ser el hogar principal de:

* tarifas;
* precios base;
* categorías;
* descuentos;
* campañas;
* reglas financieras configurables.

### Usuarios y accesos

Campos:

* nombre;
* correo;
* rol;
* estado;
* entidad vinculada;
* acceso activo/inactivo.

Roles base:

* Master;
* Administrativo;
* Profesor;
* Tutor.

No habrá permisos granulares personalizados en fase uno.

Profesor, Tutor y Usuario son entidades conceptualmente separadas.

---

## 10. Reportes indispensables

### Matrícula

* matrícula actual;
* H/M;
* nivel;
* grado;
* grupo;
* oficiales/no oficiales;
* altas;
* bajas;
* evolución de matrícula por fechas.

### Deuda

* alumnos con deuda;
* alumnos con deuda vencida;
* monto pendiente;
* monto vencido;
* monto no vencido;
* ciclo;
* grado;
* grupo;
* concepto;
* antigüedad.

### Pagos

* fecha real;
* fecha de captura;
* alumno;
* concepto;
* receptor;
* método;
* monetario/especie;
* devoluciones.

### Receptor

Master puede comparar todos los receptores.

Administrativo sólo consulta sus propias operaciones desde Mis ingresos.

### Método

* efectivo;
* transferencia;
* otros métodos;
* pagos en especie separados.

### Ingresos

Sólo Master para el consolidado institucional.

### Académicos

* calificaciones por grupo;
* historial académico del alumno;
* seguimiento de captura;
* promedios básicos cuando corresponda.

---

## 11. Exportaciones

Exportación tabular desde día uno para:

* matrícula;
* evolución de matrícula;
* deuda;
* pagos;
* ingresos;
* receptor;
* método;
* académicos.

Preferencia: XLSX/CSV.

Documentos para familias:

* recibo;
* estado de cuenta.

El estado de cuenta debe poder descargarse y compartirse.

---

## 12. Diferencias por rol

### Master

* ve todo el ecosistema;
* General de Ingresos;
* comparativos institucionales;
* todos los receptores;
* puede intervenir operaciones financieras de cualquier usuario;
* administra ciclos;
* configuración;
* usuarios;
* accesos.

### Administrativo

* operación administrativa amplia;
* ve deuda vencida y monto total;
* ve finanzas completas de cada alumno;
* ve receptor de cada pago del alumno;
* puede consultar pagos ajenos únicamente dentro del contexto del alumno;
* Mis ingresos sólo muestra operaciones recibidas por él;
* no accede al General de Ingresos;
* sólo corrige/revierte/modifica sus propias operaciones financieras;
* puede consultar configuración necesaria para operar;
* no controla configuración estructural ni roles generales por defecto.

---

## 13. Acciones transversales

### Registrar pago

Disponible desde:

* Inicio;
* alumno;
* deuda;
* estado de cuenta;
* preinscripción.

### Estado de cuenta

Disponible desde:

* alumno;
* deuda;
* historial financiero del alumno.

### Abrir alumno

Disponible desde:

* matrícula;
* deuda;
* pagos;
* preinscripciones;
* tutores;
* calificaciones.

### Crear campaña

Disponible desde:

* Configuración;
* acceso contextual desde Preinscripciones.

### Ir al usuario

Disponible desde:

* Profesor;
* Tutor;
* Usuarios y accesos.

---

## 14. Día uno

Imprescindible:

* dashboards Master/Admin;
* alumnos y ficha 360°;
* matrícula colectiva;
* evolución de matrícula;
* deuda;
* pagos;
* registrar pago;
* Mis ingresos;
* General de Ingresos;
* estado de cuenta;
* tutores;
* preinscripciones;
* profesores;
* calificaciones;
* seguimiento de captura;
* ciclos;
* tarifas/configuración;
* usuarios/accesos;
* reportes esenciales;
* exportaciones.

Puede esperar:

* dashboards analíticos avanzados;
* comparaciones históricas sofisticadas;
* rankings académicos;
* timeline administrativa consolidada;
* reportes programados;
* automatización de cobranza;
* WhatsApp integrado;
* permisos personalizados;
* roles personalizados;
* auditoría avanzada de sesiones;
* constructor libre de reportes.

---

## 15. Pendientes reales

No quedan decisiones funcionales abiertas relevantes dentro del bloque E.

E consume definiciones ya existentes para:

* clasificación oficial/no oficial;
* sexo H/M;
* reglas de matrícula;
* tarifas;
* descuentos;
* preinscripciones;
* pagos;
* deuda;
* profesores;
* calificaciones.

Cualquier ajuste futuro sobre esas reglas debe resolverse en A, B, C o D y E únicamente reflejarlo en navegación, consulta o reportes.

**Bloque E funcionalmente cerrado y listo para integrarse al documento principal del proyecto.**
