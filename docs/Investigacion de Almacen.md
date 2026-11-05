# Investigación avanzada para profesionalizar la gestión de almacenes en GESTIA

## Diagnóstico del sistema actual y objetivo de diseño

Las capturas muestran que GESTIA ya tiene una base útil para una pequeña empresa: catálogo de productos, existencias, alertas de stock bajo, movimientos de entrada/salida, coste unitario y una noción de “áreas” de inventario. El problema no es tanto la interfaz como el **modelo operativo subyacente**. En el estado actual, el sistema trata el almacén principalmente como “productos + cantidad + movimientos”, mientras que un sistema profesional de gestión de almacenes —WMS, *Warehouse Management System*— debe gestionar además **ubicaciones físicas, estados del stock, documentos de origen, tareas operativas, reservas, lotes/series, unidades logísticas, trazabilidad, conteos, aprobaciones y responsabilidades**. ASCM distingue precisamente la gestión de almacenes de la simple gestión de inventario: un WMS coordina recepción, almacenamiento, preparación, empaquetado y expedición, mientras que la gestión de inventario se centra en cuánto stock existe y dónde está dentro de la cadena. citeturn605955search8

Esa diferencia es fundamental para GESTIA. Tus pantallas actuales de **“Productos”** y **“Movimientos”** pueden conservarse como vistas sencillas, pero no deberían constituir el modelo de negocio principal. En un almacén profesional, una entrada rara vez debería ser simplemente “Producto A, +10”. Normalmente existe una causa: una orden de compra, devolución, transferencia, fabricación, regularización o recepción sin pedido; puede existir un lote, fecha de caducidad, número de serie, proveedor, almacén, ubicación de destino, estado de calidad y usuario que recibió físicamente la mercancía. Oracle, por ejemplo, estructura las operaciones de almacén en procesos de entrada, operaciones internas y salida e incluye ASN, órdenes de compra, recepción, cross-docking, putaway, reposición, picking, inventario cíclico, devoluciones y expedición. citeturn978246search3turn978246search2

La mejora más importante, por tanto, es separar conceptualmente **Inventario**, **Almacén** y **Operaciones**. “Inventario” debe responder a “qué tengo, cuánto, dónde y en qué estado”; “Almacén” debe representar la estructura física y las reglas operativas; y “Operaciones” debe responder a “qué debe hacerse, quién debe hacerlo, por qué documento y en qué estado está el trabajo”. Esa arquitectura permite que GESTIA siga siendo sencilla para una tienda pequeña y, al activar funciones avanzadas, pueda crecer hasta un entorno logístico profesional. Este enfoque coincide con los procesos descritos en WMS empresariales como Oracle y SAP. citeturn978246search2turn978246search3turn978246search6

Mi recomendación es adoptar un modelo de **“complejidad progresiva”**: una microempresa puede seguir registrando una entrada en segundos, mientras que una empresa profesional puede activar recepción contra pedido, lotes, ubicaciones, inspección, códigos de barras, aprobaciones y trazabilidad sin tener que cambiar de sistema.

## Terminología y modelo profesional que debería soportar GESTIA

El primer cambio importante es normalizar el lenguaje. En operaciones profesionales no basta con hablar genéricamente de “entrada”, “salida” y “área”. Deben existir conceptos que reflejen objetos físicos, documentos y estados distintos. GS1, SAP, Oracle y ASCM utilizan una terminología bastante convergente para estos procesos. citeturn605955search8turn978246search2turn978246search5

| Concepto recomendado | Significado operativo | Qué debería representar en GESTIA |
|---|---|---|
| **Almacén / Warehouse** | Instalación logística donde se controla stock | Una entidad física: Almacén Central, Tienda Norte, Depósito 2 |
| **Zona** | Agrupación funcional de ubicaciones | Recepción, reserva, picking, frío, devoluciones, cuarentena |
| **Ubicación / Bin / Locator** | Posición física donde se coloca stock | A-03-R02-N04, por ejemplo |
| **SKU** | Unidad diferenciada gestionada como artículo | Código interno del producto/variante |
| **GTIN** | Identificador GS1 de un artículo comercial | Código estándar opcional asociado al SKU |
| **Lote / Batch** | Grupo de unidades producido o recibido conjuntamente | Lote, fabricación, caducidad, proveedor |
| **Número de serie** | Identificador de una unidad individual | Equipos, electrónicos, activos de alto valor |
| **Unidad logística** | Caja, pallet, contenedor u otra agrupación logística | Objeto que puede almacenarse o transportarse como unidad |
| **SSCC** | Identificador GS1 único de una unidad logística | Etiqueta de pallet/caja logística |
| **HU / Handling Unit** | Unidad física de manipulación | Pallet/caja/contenedor con contenido y jerarquía |
| **Stock disponible** | Puede utilizarse o reservarse | Disponible para venta/consumo |
| **Stock reservado** | Disponible físicamente pero comprometido | Pedido, producción o transferencia pendiente |
| **Stock bloqueado** | No debe utilizarse | Avería, reclamación, investigación |
| **Stock en calidad** | Pendiente de inspección/liberación | Cuarentena o control de calidad |
| **Putaway / Ubicación** | Traslado desde recepción hasta almacenamiento | Tarea dirigida de colocación |
| **Picking / Preparación** | Recogida de artículos para una demanda | Pedido, requisición, producción o traslado |
| **Packing / Empaquetado** | Consolidación y embalaje | Cajas, pallets, etiquetas |
| **Staging** | Zona temporal antes de expedición | Mercancía preparada esperando carga |
| **Replenishment / Reposición** | Reabastecimiento de ubicaciones de picking | Reserva → ubicación de picking |
| **Cycle count / Conteo cíclico** | Conteo periódico sin inventario general | Programa de control por SKU/ubicación |
| **Cross-docking** | Flujo recepción → expedición con almacenamiento mínimo | Transferencia directa a salida |
| **ASN** | *Advance Shipping Notice* | Aviso anticipado de mercancía que llegará |
| **FEFO** | *First Expired, First Out* | Sacar primero el lote que antes caduca |
| **FIFO** | *First In, First Out* | Sacar primero el stock más antiguo |

GS1 define una **unidad logística** como cualquier combinación de artículos establecida para transporte o almacenamiento y establece el SSCC como identificador estándar de dicha unidad. También permite identificar ubicaciones físicas mediante GLN y códigos apropiados en una etiqueta o código de barras. citeturn978246search9turn978246search0turn978246search1 SAP utiliza el concepto de *handling unit* para cajas, pallets u otras unidades que pueden trasladarse, almacenarse y prepararse como una unidad, incluso conservando jerarquías de embalaje y números de serie. citeturn978246search5

Para productos profesionales, el registro maestro de un artículo debería ser significativamente más rico que el actual “nombre, categoría, precio y stock”. El artículo debería poder tener SKU, descripción, categoría, familia, marca, unidad base, unidades alternativas y conversiones, peso, volumen, dimensiones, código de barras, GTIN, control por lote, control por serie, control de caducidad, vida útil mínima, condiciones de almacenamiento, stock mínimo/máximo, punto de reposición, propietario del inventario cuando proceda y método de valoración. GS1 reserva identificadores de aplicación específicos para GTIN, lote, caducidad y serie: AI (01), AI (10), AI (17) y AI (21), respectivamente. citeturn285271search20turn285271search4

También conviene distinguir la **unidad de medida del producto** de la **unidad logística**. Por ejemplo: el artículo puede gestionarse por unidad, recibirse en cajas de 12 y almacenarse en pallets de 40 cajas. Esa estructura permite realizar movimientos como “2 pallets”, “8 cajas” o “96 unidades” sin perder la cantidad base. Los sistemas WMS empresariales trabajan precisamente con unidades de manipulación y distintas unidades de medida para ejecutar tareas físicas. citeturn978246search5turn605955search2

El concepto de stock también debe pasar de una cantidad única por producto a una combinación de dimensiones. Una estructura profesional sería aproximadamente:

`Stock = Producto + Almacén + Ubicación + Estado + Lote + Serie + Unidad logística + Propietario`

No todas las empresas utilizarán todas esas dimensiones, pero el modelo debe permitirlas. SAP EWM, por ejemplo, diferencia stock de libre utilización, inspección de calidad, bloqueado y devoluciones, además de atributos como lote, fecha de recepción y caducidad. citeturn211919search0turn211919search6

Esto resolvería una limitación visible de la pantalla actual de GESTIA: hoy “Stock: 5” responde cuánto existe, pero un usuario profesional necesita poder abrir ese número y ver algo parecido a:

| Ubicación | Estado | Lote | Caducidad | Disponible | Reservado |
|---|---|---|---|---:|---:|
| A-01-02 | Disponible | L24031 | 15/08/2027 | 120 | 24 |
| A-01-03 | Disponible | L24058 | 28/09/2027 | 80 | 0 |
| QA-01 | En inspección | L24061 | 30/09/2027 | 40 | 0 |

Así, el “stock total” continúa siendo sencillo para el usuario básico, pero existe profundidad cuando se necesita.

## Flujos operativos que convierten el sistema en un WMS

El proceso profesional no debería comenzar por “registrar movimiento”. Debería comenzar por una **necesidad o documento operativo**, y el movimiento de stock sería el resultado de ejecutar ese proceso. Oracle describe justamente las tareas de almacén como trabajo generado por recepción, putaway, picking, reposición, conteo, transferencias y cross-docking, que posteriormente se asigna a operarios. citeturn978246search2

### Flujo de recepción

El flujo profesional recomendado sería:

**Pedido/ASN → llegada → recepción → inspección → aceptación/rechazo → putaway → disponibilidad.**

Una recepción debería permitir introducir o escanear proveedor, orden de compra, ASN, producto, cantidad esperada, cantidad recibida, unidad, lote, fabricación/caducidad, seriales, pallet/SSCC, daños, diferencias y ubicación temporal. Después puede generarse una tarea de almacenamiento hasta una ubicación definitiva. ASCM describe recepción como llegada, inspección, escaneo y registro en WMS, seguida de *putaway* dirigido a una ubicación apropiada. citeturn605955search8

Un artículo no debería pasar necesariamente de “llegó” directamente a “disponible”. Puede quedar en **inspección**, **cuarentena**, **bloqueado** o **rechazado**. SAP EWM permite precisamente cambiar el stock recibido a inspección de calidad y mantener estados separados de disponibilidad. citeturn211919search6turn211919search14

Una máquina de estados apropiada podría ser:

`Previsto → Llegado → Recibiendo → Recibido → Pendiente de ubicación → Ubicado → Cerrado`

y, en paralelo:

`Pendiente de inspección → Aceptado | Rechazado | Bloqueado`.

### Operaciones internas

Después de la recepción aparecen cuatro procesos que hoy prácticamente no existen en GESTIA: **traslado interno, reposición, conteo y ajuste**. Oracle incluye explícitamente putaway, transferencias, replenishment y cycle counting entre las operaciones internas de un almacén. citeturn978246search2turn978246search3

Un traslado interno debería registrar origen y destino; no debería modelarse como una salida y una entrada independientes porque eso rompe la trazabilidad. La transacción debe mantener una única identidad:

`Ubicación A → Ubicación B`

con usuario, fecha, cantidad, lote/serie, unidad logística y motivo.

La reposición debería poder generarse automáticamente cuando una ubicación de picking cae por debajo de un mínimo: por ejemplo, mover una caja desde reserva hacia el frente de picking.

El ajuste de inventario debe ser distinto del movimiento físico. Si el sistema dice 10 unidades y el conteo encuentra 8, el proceso correcto es registrar un conteo, registrar una discrepancia de −2, solicitar aprobación cuando corresponda y finalmente contabilizar el ajuste. No debería bastar con editar la cantidad del artículo.

### Preparación y expedición

El flujo profesional recomendado sería:

**Demanda → reserva → liberación → picking → verificación → packing → staging → carga → expedición.**

El picking puede evolucionar posteriormente a estrategias por pedido, lote (*batch picking*), zona, ola (*wave picking*) o combinaciones. Oracle WMS utiliza *wave planning* para liberar grupos de tareas y gestionar cargas de trabajo de preparación. citeturn978246search2

La reserva es especialmente importante. “Existencias: 100” no significa necesariamente “100 disponibles”. Si 30 están comprometidas con pedidos, el sistema debería mostrar:

`Físico 100 | Reservado 30 | Disponible 70`

Esto evita prometer mercancía que ya está comprometida.

Para artículos con caducidad, la estrategia de asignación puede ser FEFO; para los demás, FIFO puede ser apropiado según política empresarial. Oracle permite reglas que seleccionan lotes por fecha de creación FIFO o fecha de vencimiento FEFO; SAP también admite estrategias basadas en la fecha de expiración más próxima. citeturn211919search9turn211919search5

### Conteos e inventarios

Un WMS profesional necesita al menos tres modalidades: **inventario general**, **conteo cíclico** y **conteo dirigido por excepción**. Oracle puede generar tareas de conteo para artículo, ubicación, lote o serie y distribuirlas a operarios móviles. citeturn978246search2turn978246search4

GESTIA debería permitir “conteo ciego”, en el que el operario no ve la cantidad del sistema antes de contar. La secuencia recomendable es:

`Programado → En conteo → Primera cuenta → Recuento si existe diferencia → Aprobación → Ajuste contabilizado`.

Esto separa el acto de contar del permiso para modificar existencias.

### Devoluciones y excepciones

Las devoluciones deberían tener su propio proceso:

`Autorizada → Recibida → Inspeccionada → Reintegrar | Reparar | Bloquear | Devolver proveedor | Desechar`.

Nunca conviene tratar una devolución simplemente como “entrada +1”, porque se pierde información sobre su origen y disposición.

Del mismo modo, daños, caducidades, mermas, pérdidas, roturas y diferencias deben tener **códigos de motivo**, no texto libre únicamente. Esa estructuración posteriormente permite análisis confiables.

## Vales, formularios, órdenes y documentación

Aquí hay una distinción muy importante: **“vale” no es una categoría logística universal**. En muchos países se utiliza informalmente “vale de entrada”, “vale de salida” o “vale de almacén”, pero en software profesional conviene modelar el concepto genérico como **documento de almacén** y permitir que cada empresa configure el nombre visible. El documento puede llamarse vale, comprobante, parte, acta, nota, orden o requisición según el país y sector.

También debes separar **documentos internos**, **documentos comerciales** y **documentos de transporte**. UN/CEFACT reconoce, entre otros, Purchase Order, Commercial Invoice, Packing List, Bill of Lading, distintos documentos de transporte y Warehouse Receipt como documentos comerciales/logísticos estructurados. citeturn605955search4 Asimismo, define el *Despatch Advice / Delivery Note* como una comunicación del expedidor que detalla el contenido enviado y que puede acompañar físicamente la mercancía. citeturn605955search5

El catálogo mínimo que recomendaría implementar es este:

| Documento / formulario | Uso | Datos esenciales |
|---|---|---|
| **Orden de compra** | Autoriza compra | Proveedor, artículos, cantidades, precios, fechas |
| **ASN / aviso de expedición** | Informa lo que llegará antes de recibirlo | Proveedor, PO, bultos, SSCC, artículos, cantidades |
| **Parte/acta de recepción** | Evidencia recepción física | Pedido, proveedor, recibido, diferencias, usuario |
| **Informe de discrepancias** | Documenta faltantes, sobrantes o daños | Esperado, recibido, diferencia, fotografías, motivo |
| **Informe de inspección** | Aceptación de calidad | Lote, criterios, resultado, inspector |
| **Orden de ubicación / putaway** | Mueve recepción a almacenamiento | Origen, destino sugerido, artículo, HU/lote |
| **Requisición interna** | Solicitud de material | Solicitante, centro de coste, artículos, aprobación |
| **Orden/lista de picking** | Indica qué recoger | Pedido, ubicación, SKU, lote, cantidad |
| **Vale/comprobante de salida** | Evidencia salida de inventario | Motivo, destinatario, artículos, cantidades |
| **Packing list** | Contenido de un envío | Bultos, contenido, peso, referencias |
| **Nota de expedición / delivery note** | Acompaña o documenta despacho | Cliente, envío, contenido, fecha |
| **Orden de transferencia** | Mueve stock entre almacenes | Origen, destino, artículos |
| **Documento de traslado interno** | Mueve stock entre ubicaciones | Ubicación origen/destino |
| **Vale de ajuste** | Corrige inventario | Diferencia, motivo, evidencia, aprobación |
| **Hoja de conteo** | Soporta inventario físico | Ubicaciones/SKU, cantidades contadas |
| **Autorización de devolución** | Controla devolución | Documento origen, cliente/proveedor, motivo |
| **Acta de daño/merma** | Documenta pérdida o deterioro | Producto, lote, cantidad, causa |
| **Orden de cuarentena/liberación** | Cambia condición del stock | Stock, motivo, responsable, aprobación |
| **Orden de desecho** | Autoriza destrucción/baja | Artículos, lote/serie, motivo, autorización |
| **Warehouse receipt** | Documento formal de depósito en determinados contextos | Depositante, almacén, mercancía y condiciones |

UN/CEFACT ya publica modelos estructurados para documentos como *Warehouse Receipt* y *Despatch Advice*, lo que puede servirte como referencia semántica si más adelante GESTIA necesita intercambio electrónico con terceros. citeturn605955search6turn605955search5

Todos los documentos de almacén deberían compartir un encabezado normalizado:

| Campo | Recomendación |
|---|---|
| ID interno | UUID técnico |
| Número visible | Ej. `REC-ALM01-2026-000184` |
| Tipo | Recepción, salida, ajuste, transferencia… |
| Estado | Borrador, pendiente, aprobado, ejecutado, anulado |
| Almacén | Almacén responsable |
| Fecha documento | Fecha empresarial |
| Fecha/hora real | Momento de ejecución |
| Creado por | Usuario |
| Ejecutado por | Operario |
| Aprobado por | Supervisor, si aplica |
| Documento origen | PO, pedido, requisición, devolución… |
| Referencia externa | Factura, guía, documento proveedor |
| Observaciones | Texto |
| Adjuntos | Foto, PDF, evidencia |
| Motivo | Código estructurado |
| Firma/confirmación | Cuando la política lo requiera |

Cada línea debería contener artículo, cantidad, unidad, ubicación, lote, serie, caducidad, estado de stock y, cuando corresponda, coste.

ISO trata los registros como evidencia de actividades realizadas y contempla instrucciones, formularios, modelos, diagramas y listas de comprobación como formas de información documentada. Esto respalda un enfoque en el que cada operación importante del almacén deje un registro reconstruible en lugar de limitarse a modificar una cantidad. citeturn978246search8turn978246search7

Un principio especialmente importante para GESTIA es **no borrar movimientos ejecutados**. Una operación errónea debería corregirse mediante una reversión o documento compensatorio. Esto mantiene una historia auditable. Para aplicaciones profesionales, OWASP también recomienda mantener registros de auditoría de actividades relevantes y preservar información suficiente para reconstruir transacciones. citeturn211919search26turn211919search1

## Modelo de datos, trazabilidad, seguridad y controles

El núcleo técnico debería ser un **libro mayor de inventario** o *stock ledger*. En lugar de calcular existencias a partir de un campo editable `producto.stock`, cada operación confirmada genera una transacción inmutable y el saldo se deriva o materializa a partir de esas transacciones.

Un movimiento profesional podría contener conceptualmente:

`movement_id`
`document_id`
`movement_type`
`item_id`
`warehouse_id`
`from_location_id`
`to_location_id`
`lot_id`
`serial_id`
`handling_unit_id`
`stock_status_from`
`stock_status_to`
`quantity`
`uom`
`unit_cost`
`reason_code`
`event_time`
`created_by`
`approved_by`

Eso hace posible responder preguntas que el modelo actual no puede contestar con fiabilidad: quién movió el producto, desde qué ubicación, hacia dónde, en qué lote, a partir de qué documento, por qué motivo y qué cantidad existía antes/después.

Para trazabilidad avanzada, GS1 EPCIS es especialmente relevante. EPCIS está diseñado para compartir eventos de visibilidad sobre objetos de la cadena de suministro y modela eventos de agregación, transformación y movimiento; su vocabulario incluye pasos empresariales como receiving, picking, packing, storing, stock taking, loading y shipping. citeturn605955search0turn605955search1turn605955search2 Esto no significa que debas implementar EPCIS completo desde la primera versión, pero sí conviene diseñar el modelo de eventos de GESTIA de manera compatible con conceptos como **qué objeto, cuándo, dónde y en qué contexto empresarial ocurrió un evento**.

Para códigos de barras, una evolución profesional debería admitir EAN/UPC donde corresponda y, progresivamente, GS1-128 o códigos 2D capaces de transportar GTIN junto a lote, serie o caducidad. GS1 confirma que GS1-128, GS1 DataMatrix y GS1 QR pueden contener GTIN y atributos adicionales, y utiliza AIs normalizados para lote, caducidad y serial. citeturn285271search7turn285271search3

Una lectura única podría, por ejemplo, obtener automáticamente:

`GTIN = 09520123456788`
`Lote = ABC1`
`Caducidad = 2027-12-31`
`Serie = 12345`

en vez de obligar al operario a escribir cuatro campos.

También necesitas un modelo serio de permisos. RBAC —control de acceso basado en roles— está pensado precisamente para asignar permisos a funciones organizativas en lugar de configurar usuario por usuario, y NIST contempla además separación de funciones para impedir combinaciones incompatibles. citeturn211919search2turn211919search17

Para GESTIA propondría esta matriz:

| Rol | Función principal | Restricciones recomendadas |
|---|---|---|
| Operario de recepción | Recibir y escanear | No aprobar ajustes |
| Operario de almacén | Putaway, traslados, picking | No modificar costes |
| Preparador | Picking/packing | Sólo tareas asignadas |
| Inventarista | Conteos | No aprobar su propia diferencia |
| Supervisor | Liberar tareas y aprobar excepciones | Acceso operativo amplio |
| Control de calidad | Bloquear/liberar lotes | Sin acceso financiero |
| Responsable de almacén | Configuración y supervisión | Aprobaciones de alto nivel |
| Compras | PO/proveedores | No ejecutar conteos |
| Auditor | Lectura y trazabilidad | Sin cambios |
| Administrador | Configuración técnica | Sus acciones deben auditarse |

La separación entre quien cuenta, quien solicita el ajuste y quien lo aprueba es especialmente valiosa. NIST identifica la separación de funciones como un control que puede aplicarse mediante roles incompatibles o dinámicamente durante el acceso. citeturn211919search17turn211919search51

La valoración económica también debe separarse del movimiento físico. La pantalla actual indica que al introducir coste unitario se recalcula el coste promedio. Esa opción es razonable, pero debería convertirse en una **política contable explícita**, no en un efecto secundario opcional de una entrada manual. IAS 2 admite para inventarios intercambiables FIFO o promedio ponderado y requiere identificación específica para determinados artículos no intercambiables o asociados a proyectos específicos. citeturn605955search10turn605955search7 La fiscalidad y contabilidad concreta dependerá del país donde opere cada cliente, por lo que GESTIA debería hacer configurable la política y no imponer una única lógica global.

## Rediseño recomendado de GESTIA

La estructura actual puede evolucionar sin destruir la simplicidad que ya tienes. La navegación que propondría para **Existencias** sería:

| Módulo | Función |
|---|---|
| **Productos** | Maestro de artículos |
| **Stock** | Existencias agregadas y detalladas |
| **Almacenes** | Instalaciones y estructura física |
| **Recepciones** | Entrada profesional |
| **Preparación y salidas** | Picking, packing y expedición |
| **Transferencias** | Entre almacenes |
| **Movimientos** | Diario histórico, no pantalla principal de operación |
| **Conteos** | Inventarios y ciclos |
| **Ajustes** | Diferencias y regularizaciones |
| **Devoluciones** | Clientes/proveedores |
| **Tareas** | Trabajo pendiente de operarios |
| **Documentos** | Vales, partes, órdenes y formularios |
| **Trazabilidad** | Lotes, series y unidades logísticas |
| **Configuración** | Motivos, reglas, ubicaciones, permisos |

La pantalla **Productos** que ya tienes debería seguir funcionando, pero en lugar de mostrar únicamente `Stock: 5`, una tarjeta profesional podría mostrar:

`Físico 120 · Disponible 86 · Reservado 24 · Calidad 10`

y permitir abrir el detalle por almacén, ubicación, lote o serie.

La actual ventana **Registrar Movimiento**, que solicita producto, tipo, cantidad y coste, debería sobrevivir exclusivamente como **“Movimiento rápido”** para empresas pequeñas o situaciones autorizadas. En modo profesional, el botón principal debería ser contextual: “Recibir mercancía”, “Transferir”, “Ajustar”, “Preparar pedido”, etc. Así evitas que el usuario tenga que conocer la contabilidad interna de inventario para ejecutar una tarea física.

La pantalla que actualmente denominas **Inventario** y en la que aparecen áreas como “Electrodomésticos”, “Vajilla” o “Lavandería” tiene una idea interesante pero mezcla dos conceptos: ubicación física y agrupación semántica. Recomendaría convertirla en un **Mapa de ubicaciones** con una jerarquía configurable:

`Empresa → Centro → Almacén → Zona → Pasillo → Estantería → Nivel → Ubicación`

Una empresa pequeña podría usar únicamente:

`Almacén → Área`

mientras una operación profesional podría usar todos los niveles. GS1 contempla incluso la identificación normalizada de ubicaciones físicas mediante GLN, incluidos puntos como puertas de muelle o ubicaciones de almacenamiento. citeturn978246search1

La creación de ubicaciones debería poder usar códigos como:

`A01-P03-R02-N04`

y configurar capacidades de peso, volumen, tipo de producto, temperatura, bloqueo, prioridad de picking y reglas de mezcla.

En paralelo, deberías introducir una **unidad de trabajo de almacén**. El usuario profesional no debería tener que navegar por documentos para descubrir qué hacer. Una vista tipo “Mis tareas” podría decir:

| Prioridad | Tarea | Origen → destino | Producto | Cantidad |
|---|---|---|---|---:|
| Alta | Putaway | RECEP-01 → A-01-02 | Producto A | 20 |
| Alta | Picking | B-04-02 → PACK-02 | Producto X | 5 |
| Normal | Reposición | RES-03 → PICK-01 | Producto Y | 12 |
| Normal | Conteo | A-03-04 | Producto Z | — |

Oracle WMS trata estas actividades precisamente como tareas que pueden generarse a partir de recepción, picking, reposición, transferencias y conteos y después distribuirse entre los recursos del almacén. citeturn978246search2 SAP también contempla ejecución móvil/RF para descarga, recepción, putaway, picking, packing, carga y conteo. citeturn978246search6

Esto abre el camino para una aplicación móvil o PWA muy simple para operarios:

`Escanear ubicación → escanear producto → introducir/confirmar cantidad → escanear destino → confirmar`.

La complejidad queda en el motor; el operario ve una tarea guiada.

## Arquitectura funcional, indicadores y hoja de ruta

No intentaría construir un SAP EWM reducido de una sola vez. El salto profesional debería realizarse en capas para evitar que GESTIA pierda su ventaja actual de facilidad de uso.

| Etapa | Implementación | Resultado |
|---|---|---|
| **Fundación profesional** | Maestro de almacenes, ubicaciones, unidades de medida, libro de movimientos, motivos, estados de stock, documentos, RBAC y auditoría | Inventario fiable y trazable |
| **Operación estructurada** | Recepciones, putaway, transferencias, salidas, reservas, devoluciones, conteos y ajustes aprobables | Flujo de almacén real |
| **Identificación avanzada** | Lotes, seriales, caducidades, códigos de barras, HU/LPN, SSCC | Trazabilidad física |
| **Optimización WMS** | Reposición, reglas FIFO/FEFO, estrategias de picking, tareas, olas, slotting, cross-docking | Productividad operativa |
| **Integración empresarial** | Compras, ventas, producción, contabilidad, API, EDI, transportistas | Operación integrada |
| **Verticales regulados** | Calidad, frío, cuarentena, sensores, compliance sectorial | Farmacia, alimentación, salud, etc. |

La primera etapa es la más importante. Si el **ledger de inventario, documentos y ubicaciones** quedan mal diseñados, cada función futura será difícil de implementar. Si quedan bien diseñados, picking, FEFO, códigos de barras o tareas serán capas adicionales sobre la misma base.

GESTIA debería incorporar desde esa primera etapa indicadores operativos. ASCM destaca que la gestión profesional del almacén depende de control preciso del inventario, almacenamiento y cumplimiento de pedidos, y que el WMS mantiene los datos necesarios para gestionar esas operaciones. citeturn605955search8 Recomiendo como mínimo estos KPI:

| KPI | Cálculo sugerido | Utilidad |
|---|---|---|
| Exactitud de inventario | Líneas sin diferencia / líneas contadas | Fiabilidad del stock |
| Exactitud de picking | Líneas correctas / líneas preparadas | Calidad de preparación |
| Tiempo recepción→stock | Hora disponible − hora recepción | Velocidad de entrada |
| Tiempo de preparación | Fin picking − liberación | Productividad |
| Variación de inventario | Diferencia física vs. teórica | Pérdidas y errores |
| Stock inmovilizado | Stock sin movimiento por N días | Capital retenido |
| Riesgo de caducidad | Stock que caduca en N días | Prevención de pérdidas |
| Ocupación | Capacidad utilizada / capacidad disponible | Uso del espacio |
| Tareas por operario/hora | Tareas confirmadas / horas | Productividad |
| Nivel de servicio | Demanda atendida / demanda solicitada | Disponibilidad |
| Devoluciones | Unidades devueltas / enviadas | Calidad logística |

Para sectores regulados debes añadir extensiones, no contaminar el núcleo. En productos farmacéuticos, por ejemplo, las buenas prácticas de almacenamiento contemplan estados como cuarentena, liberado, rechazado y devuelto, además de condiciones controladas de almacenamiento; la OMS recomienda FEFO y controles de temperatura cuando proceda. citeturn200863search24turn200863search25turn200863search4 Para determinados alimentos, los modelos regulatorios modernos también evolucionan hacia trazabilidad por lote asociada a eventos críticos como recepción y expedición. citeturn200863search0turn200863search26

Por tanto, el modelo debería permitir activar características por producto o industria:

| Característica | Comercio general | Alimentación | Farmacia | Manufactura | 3PL |
|---|---:|---:|---:|---:|---:|
| Ubicaciones | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lotes | Opcional | ✓ | ✓ | ✓ | Opcional |
| Seriales | Opcional | Opcional | Según producto | ✓ | Opcional |
| Caducidad | Opcional | ✓ | ✓ | Opcional | Según cliente |
| FEFO | Opcional | ✓ | ✓ | Opcional | Configurable |
| Calidad/cuarentena | Opcional | ✓ | ✓ | ✓ | Configurable |
| Temperatura | — | Según producto | Frecuente | Según producto | Según cliente |
| Propietario del stock | — | — | — | — | ✓ |
| SSCC/HU | Opcional | ✓ | ✓ | ✓ | ✓ |
| Trazabilidad completa | Opcional | Alta | Muy alta | Alta | Alta |

El resultado ideal no sería que GESTIA pareciera “más complicado”, sino que su arquitectura fuese profesional mientras su interfaz siguiera siendo accesible. Un empleado no técnico debería poder recibir mercancía siguiendo una secuencia de escaneo y confirmación, mientras un gerente, auditor o responsable de logística pueda reconstruir todo el recorrido del producto.

La decisión de producto más importante sería, por ello, transformar el actual concepto de **“Registrar movimiento”** en un modelo de **“ejecutar operación respaldada por documento”**. En modo simple, GESTIA puede crear automáticamente ese documento detrás de escena; en modo profesional, el usuario verá recepción, traslado, picking, ajuste, conteo o devolución como procesos independientes. Esa única decisión de arquitectura separa un sistema de inventario básico de una plataforma que realmente puede evolucionar hacia WMS.

Como modelo objetivo, GESTIA debería poder responder de forma inmediata a seis preguntas sobre cualquier unidad de inventario: **qué es, cuánto hay, dónde está, en qué estado está, de dónde vino y qué operaciones han ocurrido sobre ella**. Con lotes o seriales debería añadir una séptima: **a qué destinos fue después**. GS1 construye precisamente sus estándares de trazabilidad alrededor de la identificación de objetos y eventos que permiten relacionar movimiento físico e información durante la cadena de suministro. citeturn978246search9turn605955search9

Con esa base, GESTIA dejaría de ser únicamente un gestor de existencias para pequeñas empresas y tendría una arquitectura viable para almacenes profesionales sin renunciar a su enfoque de facilidad de uso.