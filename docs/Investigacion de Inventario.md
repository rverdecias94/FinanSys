# Investigación avanzada: cómo diseñar un sistema profesional de inventario y gestión de activos

## El punto clave: “inventario” y “activos” no son exactamente lo mismo

Por lo que muestran tus pantallas, tu sistema actual está muy bien orientado a una primera necesidad: una empresa crea un **área** —por ejemplo, Electrodomésticos, Vajilla o Mobiliario—, define qué datos quiere capturar y registra elementos como “Aire acondicionado 2 T” o “Lavadora automática”. Sin embargo, desde el punto de vista profesional, ahí se están mezclando dos dominios que conviene separar desde el modelo de datos: **gestión de inventarios** y **gestión de activos**.

En contabilidad, un inventario es normalmente un bien mantenido para la venta, en proceso de producción o un material que será consumido en la producción o prestación de servicios. IAS 2 define precisamente esas tres categorías. Un aire acondicionado utilizado durante años en la oficina, en cambio, encaja normalmente en **propiedad, planta y equipo / activo fijo**, porque es un bien tangible mantenido para uso en las operaciones durante más de un período. IAS 16 cubre ese segundo caso. citeturn824810search7turn357955search4

Esta distinción afecta mucho más que al nombre de una pantalla. El inventario comercial se gestiona principalmente mediante **cantidades, entradas, salidas, costes, lotes, ubicaciones y reposición**; un activo fijo se gestiona mediante **identificación individual, custodio, ubicación, vida útil, depreciación, mantenimiento, estado y baja**. ISO 55000 trata precisamente la gestión de activos desde una perspectiva de ciclo de vida y valor para la organización. citeturn357955search0turn357955search1

Por tanto, para que GESTIA pueda crecer hacia empresas más formales, mi recomendación es que “Existencias” sea el dominio general, pero que internamente separe al menos:

| Dominio | Ejemplos | Unidad de control |
|---|---|---|
| **Mercancía / inventario comercial** | bebidas, alimentos, piezas, productos para vender | SKU + cantidad |
| **Materia prima** | harina, acero, componentes | SKU + cantidad/lote |
| **Producto en proceso** | producción parcialmente terminada | orden/lote + cantidad |
| **Producto terminado** | mercancía fabricada disponible | SKU + lote/cantidad |
| **Consumibles y suministros** | papel, detergente, guantes | SKU + cantidad |
| **Activos fijos** | aire acondicionado, computador, vehículo | activo individual |
| **Herramientas y equipo controlable** | taladro, cámara, equipo de medición | activo individual o cantidad |
| **Activos de terceros** | equipos en consignación o custodia | activo + propietario |

La necesidad que planteas de ofrecer **“modelos oficiales” junto con formularios personalizados** tiene mucho sentido, pero conviene redefinir “oficial”. No existe un único formulario universal de inventario válido para todas las empresas. Las normas internacionales establecen principios de reconocimiento, valoración, control, trazabilidad y documentación, mientras que los formularios concretos dependen del sector, del país y de los procedimientos internos. Incluso ISO 9001 permite que la organización determine la documentación necesaria para controlar sus procesos, mientras exige conservar determinadas evidencias cuando corresponda. citeturn525813search8turn525813search0

Eso sugiere una solución de producto más potente: en lugar de vender “el formulario oficial”, GESTIA debería incorporar **plantillas profesionales normalizadas**, basadas en los documentos y transacciones reconocidos en ERP, contabilidad, logística y gestión de activos, y permitir que el cliente las extienda sin destruir su estructura de control.

## Conceptos y terminología que debería dominar el sistema

La unidad básica del inventario comercial suele ser el **SKU —Stock Keeping Unit—**, es decir, una referencia identificable que una organización controla como artículo diferente. Encima del SKU puede existir una categoría y debajo pueden existir variantes, lotes, números de serie o unidades físicas. Para interoperabilidad externa pueden utilizarse identificadores GS1: un **GTIN** identifica artículos comerciales y un **SSCC** identifica unidades logísticas como pallets o contenedores; los códigos GS1 también pueden transportar datos como lote, número de serie y fechas. citeturn525813search1turn525813search9

En un sistema serio conviene diferenciar **artículo maestro** de **existencia física**. “Lavadora automática 12 kg” puede ser un artículo maestro; “Lavadora número de serie 8H3198 localizada en habitación 203” sería una unidad individual. Del mismo modo, un artículo puede existir simultáneamente en varias ubicaciones, estados o lotes. Los ERP empresariales separan precisamente el maestro del material de sus movimientos y saldos. SAP, por ejemplo, diferencia recepción de mercancías, salida de mercancías, traslado de stock y cambio de categoría de stock. citeturn525813search2turn525813search3

También resulta fundamental diferenciar **stock físico**, **stock disponible** y **stock comprometido**. Una empresa puede tener físicamente 100 unidades, pero 20 estar reservadas para pedidos, 10 bloqueadas por calidad y 5 en tránsito. Por ello, un diseño empresarial no debería guardar simplemente `cantidad = 100`; debería poder derivar el saldo a partir de estados y movimientos. Los sistemas ERP permiten precisamente distinguir stock disponible, inspección de calidad, tránsito y otras categorías. citeturn525813search2turn525813search7

Otra distinción importante es la de **lote** frente a **número de serie**. Un lote identifica colectivamente una producción o recepción; el número de serie identifica una unidad concreta. Esto se vuelve crítico en alimentos, medicamentos, fabricación, electrónica, garantías y activos. GS1 contempla explícitamente lote, número de serie y fechas como atributos de identificación y trazabilidad. citeturn525813search1

Para activos deberías incorporar además conceptos como **custodio**, **propietario**, **centro de coste**, **ubicación**, **estado operativo**, **fecha de adquisición**, **fecha de puesta en servicio**, **vida útil**, **valor residual**, **depreciación acumulada**, **garantía**, **mantenimiento**, **transferencia**, **baja** y **disposición final**. IAS 16 exige controlar el reconocimiento inicial, valor contable, depreciación y deterioro de los activos tangibles mantenidos durante más de un período; ISO 55000 amplía esa visión hacia todo el ciclo de vida del activo y las relaciones entre coste, desempeño, riesgo y valor. citeturn357955search4turn357955search8

Para almacenes también aparecen términos operativos fundamentales: **receiving**, **put-away**, **bin/location**, **picking**, **packing**, **dispatch**, **stock transfer**, **adjustment**, **cycle count**, **physical inventory**, **shrinkage**, **obsolete stock**, **dead stock**, **lead time**, **safety stock**, **reorder point** y **fill rate**. Los procedimientos aduaneros británicos, por ejemplo, exigen documentar recepción, ubicación, movimiento, controles físicos, discrepancias, pérdidas y conciliaciones; los ERP empresariales formalizan las mismas operaciones como transacciones. citeturn824810search5turn824810search6turn525813search3

## Los “modelos oficiales” que deberías incorporar como plantillas del sistema

Una empresa formal no suele registrar un producto simplemente completando un formulario libre. Cada cambio del inventario debería originarse en un **documento o transacción identificable**, con número, fecha, usuario, motivo, referencias y trazabilidad. En SAP, por ejemplo, una recepción genera un documento de material y determinados movimientos pueden generar también documentos contables; las transferencias conservan su propio flujo documental. citeturn525813search6turn525813search7

GESTIA podría convertir este principio en un catálogo de **Plantillas Profesionales GESTIA**, bloqueando los campos estructurales importantes y permitiendo que el cliente añada campos propios.

| Plantilla estándar | Uso | Campos esenciales |
|---|---|---|
| **Ficha maestra de artículo** | Crear un SKU | código, descripción, categoría, unidad, código de barras, método de valoración, seguimiento por lote/serie |
| **Recepción de mercancía** | Entrada desde proveedor | número, proveedor, orden de compra, fecha, almacén, SKU, cantidad esperada, recibida, rechazada, lote/serie |
| **Entrada extraordinaria** | Entrada sin compra | motivo, origen, artículo, cantidad, valoración, autorización |
| **Salida de almacén** | Consumo/entrega | destino, solicitante, artículo, cantidad, centro de coste, autorización |
| **Transferencia entre ubicaciones** | Mover stock | origen, destino, SKU/lote/serie, cantidad, responsable |
| **Devolución a proveedor** | Retornar mercancía | recepción original, proveedor, motivo, cantidad, estado |
| **Devolución interna** | Reingresar artículo | salida original, usuario, estado, cantidad |
| **Ajuste de inventario** | Corregir diferencia | saldo anterior, conteo, diferencia, motivo, autorización |
| **Conteo físico** | Inventario general | ubicación, artículo, saldo sistema, conteo físico, diferencia |
| **Conteo cíclico** | Control periódico | clase ABC, frecuencia, conteo, reconteo, aprobación |
| **Merma / pérdida / deterioro** | Registrar disminución | cantidad, causa, evidencia, responsable, aprobación |
| **Alta de activo fijo** | Incorporar activo | etiqueta, serie, factura, coste, custodio, ubicación, vida útil |
| **Transferencia de activo** | Cambiar custodio/ubicación | activo, origen, destino, entrega, recepción |
| **Mantenimiento de activo** | Registrar intervención | activo, avería, proveedor/técnico, coste, fecha |
| **Baja de activo** | Retirar activo | motivo, valor, aprobación, disposición |
| **Asignación / entrega de activo** | Custodia personal | activo, empleado, fecha, condición, firma |
| **Retorno de activo** | Fin de custodia | condición inicial/final, accesorios, fecha, responsable |

Estas plantillas reflejan bastante bien cómo funcionan sistemas empresariales reales. SAP formaliza recepciones, salidas, transferencias y cambios de stock; Oracle incorpora conteos, reposición y ajustes; los procesos aduaneros y de almacén de HMRC exigen mantener un rastro de auditoría sobre entradas, salidas, ubicaciones, pérdidas y correcciones. citeturn525813search2turn525813search3turn525813search4turn824810search5

Aquí hay una diferencia importante con tu interfaz actual. Hoy el usuario diseña:

> Nombre → texto  
> Cantidad → número  
> Color → color

En un sistema empresarial, una plantilla profesional debería incluir además **campos semánticos**. Por ejemplo, el campo “Cantidad” no debería ser solamente un número; debería ser del tipo `quantity`, asociado a una **unidad de medida**. “Proveedor” debería ser una referencia a una entidad `Supplier`, “Ubicación” una referencia a `Location`, “Artículo” una referencia a `Item`, “Empleado” a `Person`, y “Centro de coste” a `CostCenter`.

Eso permite que el dato pueda después analizarse, auditarse e integrarse. Si “Proveedor” es simplemente una caja de texto personalizada, “Coca Cola”, “Coca-Cola” y “CocaCola SA” podrían acabar siendo tres proveedores diferentes. Un sistema profesional debería preservar las relaciones maestras.

Tu constructor de formularios puede seguir existiendo, pero convendría separar tres clases de campos:

**Campos del sistema** serían elementos como SKU, cantidad, ubicación, lote o responsable que poseen significado funcional y no pueden eliminarse cuando son necesarios para una transacción. **Campos de plantilla** serían campos que GESTIA incorpora para un determinado proceso o sector. **Campos personalizados** serían los creados libremente por la empresa. Esta arquitectura mantiene la flexibilidad que ya tienes sin sacrificar consistencia.

## Cómo funciona el control profesional del inventario

El principio contable básico de IAS 2 es que los inventarios se valoran al **menor entre coste y valor neto realizable**. El coste incluye adquisición, transformación y otros costes necesarios para llevar el inventario a su ubicación y condición actuales. Para artículos intercambiables, IAS 2 permite fórmulas como FIFO o coste promedio ponderado; para bienes no intercambiables puede utilizarse identificación específica. citeturn824810search0turn824810search7

Eso significa que el maestro de artículos de GESTIA debería poder configurar un **método de valoración**. Aunque una pyme puede empezar únicamente con cantidades, el modelo de datos debería estar preparado desde el principio para almacenar coste unitario, moneda, coste de recepción y valoración del saldo.

Para controlar existencias físicas aparecen dos técnicas fundamentales: **inventario físico completo** y **conteo cíclico**. Oracle define el conteo cíclico como el conteo periódico de grupos de artículos durante el año para comprobar cantidades y valores, y permite usarlo junto con inventarios físicos completos. citeturn525813search4

Habitualmente, el conteo cíclico se relaciona con una **clasificación ABC**. Oracle describe ABC como una clasificación basada en la importancia relativa de los artículos: los artículos A reciben controles más estrictos y mayor precisión, los B un nivel intermedio y los C controles más simples. Esa clasificación puede utilizarse para definir frecuencias de conteo diferentes. citeturn525813search5

Por ejemplo, GESTIA podría permitir:

| Clase | Política ilustrativa |
|---|---|
| A | contar mensualmente |
| B | contar trimestralmente |
| C | contar semestral/anualmente |

Las frecuencias exactas no deberían imponerse como norma universal; deberían configurarse según valor, riesgo, velocidad, criticidad y requisitos regulatorios. Oracle señala precisamente que pueden considerarse criticidad, coste, lead time e historial de movimientos. citeturn525813search5

También deberías incorporar el concepto de **punto de pedido —Reorder Point—**. El objetivo es establecer un nivel a partir del cual debe iniciarse la reposición. Los sistemas Oracle permiten combinar punto de pedido con stock de seguridad; también permiten políticas **Min-Max**, donde se define un mínimo que dispara la reposición y un máximo al que se quiere volver. citeturn642468search0turn642468search3

Una formulación habitual es:

\[
ROP = demanda\ durante\ lead\ time + stock\ de\ seguridad
\]

Oracle utiliza implementaciones de esta lógica y permite definir stock de seguridad a partir de previsiones o introducirlo manualmente. citeturn642468search1turn642468search7

Otro modelo importante es **EOQ —Economic Order Quantity / Cantidad Económica de Pedido—**, que busca una cantidad fija de pedido que minimice conjuntamente los costes de realizar pedidos y mantener inventario. Los sistemas Oracle implementan EOQ precisamente con ese objetivo. citeturn642468search1turn642468search4

Para empresas manufactureras aparecen además **MRP —Material Requirements Planning—**, **MPS —Master Production Schedule—** y **BOM —Bill of Materials—**. Oracle distingue MPS para artículos importantes con demanda independiente y MRP para planificar necesidades de materiales, especialmente cuando existe demanda dependiente. citeturn642468search5

No necesitas implementar estos modelos avanzados inmediatamente, pero tu arquitectura debería evitar impedirlos en el futuro.

## El modelo de datos que convertiría GESTIA en un sistema empresarial

El cambio más importante sería dejar de pensar en “un formulario que crea una fila” y empezar a pensar en **maestros + documentos + movimientos + saldos**.

La estructura central podría ser:

```text
Organization
 ├── Site
 │    └── Warehouse
 │          └── Location / Bin
 │
 ├── Item
 │    ├── SKU
 │    ├── Category
 │    ├── UnitOfMeasure
 │    ├── Barcode / GTIN
 │    ├── LotControl
 │    └── SerialControl
 │
 ├── Asset
 │    ├── AssetTag
 │    ├── SerialNumber
 │    ├── Custodian
 │    └── Location
 │
 ├── InventoryDocument
 │    └── InventoryDocumentLine
 │
 ├── InventoryMovement
 │
 ├── InventoryBalance
 │
 ├── StockCount
 │
 ├── Supplier
 ├── Customer
 ├── Employee
 └── CostCenter
```

Una recepción sería algo parecido a:

```text
Documento GR-2026-000184
Tipo: RECEPCIÓN

Proveedor: Comercial ABC
Orden de compra: PO-9481
Almacén: Central

Líneas:
SKU       Lote        Cantidad
COKE-330  L241108     100
WATER-1L  L241011      60
```

Al aprobarlo, el sistema generaría movimientos:

```text
+100 COKE-330 → Almacén Central
 +60 WATER-1L → Almacén Central
```

Y el saldo se actualizaría a partir de esos movimientos.

Este patrón es importante porque una empresa formal necesita poder reconstruir **quién cambió el inventario, cuándo, mediante qué documento y por qué**. HMRC exige que los registros permitan seguir el movimiento de mercancía e identificar los cambios y ajustes; SAP utiliza documentos de material para registrar los movimientos. citeturn824810search5turn525813search6

Por eso, una regla de diseño muy recomendable sería:

**Nunca editar directamente una cantidad histórica.**

Si alguien tiene 10 unidades y descubre que realmente existen 8, no debería cambiar:

```text
cantidad: 10 → 8
```

Debería generarse:

```text
AJUSTE INV-2026-0042
Saldo sistema: 10
Conteo físico: 8
Diferencia: -2
Motivo: rotura
Aprobado por: ...
```

Así aparece un movimiento de `-2` y se preserva la historia. Los procedimientos formales de almacén exigen precisamente investigar pérdidas y mantener un rastro de auditoría para los ajustes. citeturn824810search5

Además, los documentos deberían tener estados. Una estructura útil sería:

```text
BORRADOR
   ↓
PENDIENTE DE APROBACIÓN
   ↓
APROBADO
   ↓
CONTABILIZADO
   ↓
CERRADO
```

y alternativamente:

```text
RECHAZADO
CANCELADO
REVERSADO
```

No se debería borrar físicamente un documento contabilizado; debería realizarse una reversión. De esa forma se mantiene la trazabilidad.

## Qué convertiría tus formularios actuales en algo verdaderamente diferencial

Tu constructor visual de preguntas tiene una ventaja clara: empresas pequeñas pueden adaptar el inventario a su realidad sin configurar un ERP complejo. Yo no eliminaría ese enfoque. Lo transformaría en un sistema de **plantillas con tres niveles**.

**Nivel simple** serviría para negocios pequeños. El usuario seguiría viendo prácticamente lo que ya tiene: “crea un área → decide qué quieres registrar → comienza a añadir elementos”.

**Nivel profesional** ofrecería plantillas prediseñadas:

```text
Nuevo inventario

¿Qué quieres controlar?

○ Mercancía para venta
○ Materias primas
○ Suministros
○ Activos y equipos
○ Herramientas
○ Inventario de hotel/restaurante
○ Inventario de oficina
○ Crear desde cero
```

Al elegir **Activos y equipos**, GESTIA podría crear automáticamente:

```text
Código de activo *
Nombre *
Categoría *
Marca
Modelo
Número de serie
Fecha de adquisición
Coste
Proveedor
Ubicación *
Responsable/custodio
Estado *
Garantía
Notas
Fotografía
```

Al elegir **Mercancía para venta**:

```text
SKU *
Nombre *
Categoría *
Unidad de medida *
Código de barras
Coste
Precio
Stock mínimo
Stock máximo
Control por lote
Control por serie
Fecha de caducidad
Proveedor habitual
```

Y el **nivel avanzado/ERP** activaría documentos, almacenes, movimientos, aprobaciones, valoración, conteo cíclico, planificación y auditoría.

ISO 55001 resulta especialmente interesante para esta evolución porque su edición 2024 refuerza temas como decisiones sobre activos, creación de valor, planificación, riesgo, datos y operaciones durante el ciclo de vida. ISO 55013, también publicada en 2024, se centra específicamente en la gestión de datos relacionados con activos. citeturn357955search1turn357955search3

También añadiría nuevos tipos de campo a tu constructor. Además de texto, número, lista, fecha, sí/no, notas y color, un producto profesional necesitaría:

| Tipo de campo | Ejemplo |
|---|---|
| Cantidad + unidad | `12 kg`, `4 cajas`, `20 L` |
| Moneda | `$ 1.250` |
| SKU / artículo | vínculo al catálogo |
| Proveedor | vínculo al maestro |
| Persona | custodio |
| Ubicación | almacén / estante |
| Código de barras | EAN/UPC/GS1 |
| QR | etiqueta interna |
| Número de serie | activo individual |
| Lote | trazabilidad |
| Fecha de caducidad | alimentos/medicamentos |
| Archivo | factura/manual |
| Fotografía | condición del activo |
| Firma | entrega/recepción |
| Relación | referencia a otro registro |
| Fórmula | coste × cantidad |
| Autonúmero | INV-000184 |

GS1 es particularmente útil para los identificadores porque permite representar producto, ubicación, envío, lote, serie y fechas mediante identificadores y códigos legibles por máquina. citeturn525813search1turn525813search9

Finalmente, añadiría un **motor de reglas**, por ejemplo:

```text
SI categoría = "Equipo informático"
ENTONCES número_de_serie = obligatorio

SI artículo controla_lote = true
ENTONCES lote = obligatorio

SI diferencia_conteo > 5 %
ENTONCES requiere aprobación del gerente

SI cantidad_disponible <= punto_de_pedido
ENTONCES generar alerta de reposición
```

Eso es mucho más potente que limitar la personalización al diseño del formulario.

## Cómo debería quedar la visión de producto de GESTIA

La evolución más sólida no sería construir “un inventario con formularios oficiales”, sino crear una plataforma con **procesos estándar y extensibilidad**.

El núcleo debería proporcionar maestros, documentos, movimientos, auditoría y controles que el usuario no pueda romper. Encima de ese núcleo existirían **plantillas GESTIA** basadas en prácticas de ERP, contabilidad, activos y supply chain. Y encima de ellas continuarían existiendo tus **campos personalizados**.

Conceptualmente:

```text
┌───────────────────────────────────────┐
│ CAMPOS PERSONALIZADOS DEL CLIENTE     │
│ Color, habitación, observaciones...   │
├───────────────────────────────────────┤
│ PLANTILLAS PROFESIONALES GESTIA       │
│ Recepción, salida, activos, conteo... │
├───────────────────────────────────────┤
│ MOTOR DE INVENTARIO                   │
│ documentos · movimientos · saldos     │
├───────────────────────────────────────┤
│ MAESTROS                              │
│ artículo · proveedor · ubicación...   │
├───────────────────────────────────────┤
│ AUDITORÍA Y PERMISOS                  │
│ quién · cuándo · qué cambió           │
└───────────────────────────────────────┘
```

Este planteamiento también resuelve tu preocupación original: **una pyme puede seguir creando su propio formulario**, mientras que una empresa formal puede seleccionar procesos estructurados, conservar trazabilidad y aplicar políticas de control. La documentación formal no tiene por qué significar formularios rígidos en papel; las normas y organismos reguladores aceptan registros electrónicos siempre que mantengan integridad, acceso y trazabilidad apropiados. HMRC, por ejemplo, admite sistemas electrónicos y códigos de barras cuando permiten establecer un rastro de auditoría, y ISO 9001 admite información documentada en distintos formatos y medios. citeturn824810search5turn525813search0

A medio plazo, los indicadores que más valor aportarían al panel serían **exactitud del inventario, rotación, días de inventario, fill rate, artículos agotados, existencias envejecidas u obsoletas, diferencias de conteo y cumplimiento del conteo cíclico**. ASCM incorpora métricas como Inventory Days of Supply y fill rate dentro de su modelo SCOR y considera la precisión física, rotación y otros indicadores elementos centrales del desempeño del almacén. citeturn642468search20turn642468search18turn642468search32

La arquitectura te permitiría además evolucionar progresivamente hacia reposición Min-Max, puntos de pedido, stock de seguridad, clasificación ABC, EOQ, MRP, códigos GS1 y gestión completa del ciclo de vida de activos, sin obligar a una empresa pequeña a utilizar ninguna de esas funciones. Oracle demuestra que estos modelos pueden coexistir dentro del mismo sistema de inventario y activarse según las necesidades de cada artículo u organización. citeturn642468search2turn642468search5

La conclusión más importante para tu producto es que **el formulario no debería ser el centro del modelo**. El centro debería ser la transacción que representa un hecho empresarial: *recibí mercancía, entregué un equipo, trasladé un activo, conté el almacén, encontré una diferencia, retiré un activo*. El formulario es simplemente la interfaz mediante la cual se captura ese hecho. Esa diferencia conceptual es la que separa una aplicación flexible de registro de datos de un verdadero sistema profesional de gestión de inventario y activos. citeturn525813search3turn357955search0