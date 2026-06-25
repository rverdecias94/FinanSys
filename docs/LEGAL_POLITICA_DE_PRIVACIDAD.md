# POLÍTICA DE PRIVACIDAD — GESTIA

**Última actualización: 24 de junio de 2026**

> *Nota: este documento describe el tratamiento real de datos de la aplicación (verificado en el código). No constituye asesoría jurídica; conviene que lo revise un profesional legal de tu país antes de publicarlo. La fuente viva de estos datos (responsable, correo y fecha) es `src/config/legal.js`.*

---

## 1. Quiénes somos

Roberto Verdecia Sánchez (el "Responsable", "nosotros") es el titular y operador de **GESTIA**, una plataforma de gestión financiera y contable para pequeñas y medianas empresas.

Esta Política explica qué datos recogemos, con qué finalidad, con quién los compartimos, cuánto tiempo los conservamos y qué derechos tienes.

**Contacto en materia de privacidad:** soporteprofesional247@gmail.com

---

## 2. Resumen rápido

Para que lo tengas claro desde el principio:

- ✅ Usamos tus datos **solo para prestarte el Servicio** (gestionar tu negocio) y para mantenerlo seguro.
- ✅ Tus contraseñas se guardan **cifradas** por nuestro proveedor de autenticación; **nunca las vemos ni se almacenan en texto legible**.
- ✅ Cada negocio está **aislado** del resto mediante seguridad a nivel de base de datos.
- ❌ **No vendemos** tus datos.
- ❌ **No mostramos publicidad** ni usamos rastreadores publicitarios de terceros.
- ❌ **No usamos herramientas de analítica de terceros** (como Google Analytics) ni inteligencia artificial sobre tus datos.
- ❌ **No recogemos ni almacenamos datos de tarjetas de crédito o débito.**

---

## 3. Qué datos recogemos

### 3.1. Datos de tu cuenta
- **Correo electrónico** (es tu identificador de acceso).
- **Contraseña**, almacenada de forma cifrada (con técnicas de *hashing*) por nuestro proveedor de autenticación. No tenemos acceso a tu contraseña en texto legible.

### 3.2. Datos del perfil de tu negocio (opcionales, los introduces tú)
En la configuración puedes añadir: nombre comercial, nombre legal, identificación fiscal (RFC/RUC/NIT), teléfono, correo de contacto del negocio, logotipo y región (país, provincia/estado y ciudad).

### 3.3. Información que tú introduces para gestionar tu negocio ("tu contenido")
- Transacciones financieras: importes, fechas, categorías, descripciones, estados de cobro/pago y vencimientos.
- Productos, existencias, costos, movimientos de almacén y ventas.
- **Contactos** (clientes y proveedores): nombre, correo, teléfono y notas. *(Ver sección 6 sobre datos de terceros.)*
- Saldos, monedas y tasas de cambio.
- **Archivos** que adjuntes (por ejemplo, comprobantes de transacciones) y tu logotipo, almacenados en nuestro proveedor de almacenamiento.

### 3.4. Datos de uso y técnicos
- **Dirección IP:** se obtiene a través de un servicio externo (`api.ipify.org`) y se guarda en los **registros de auditoría** de tu cuenta para fines de seguridad y trazabilidad. *(Es un dato "el mejor esfuerzo": si el servicio no responde, puede no registrarse.)*
- **Registros de auditoría (logs):** qué acción se realizó, sobre qué recurso, en qué área, el valor anterior y el nuevo, el correo de quien la hizo, la fecha/hora y la dirección IP.
- **Almacenamiento en tu navegador:** datos técnicos necesarios para que el Servicio funcione (ver sección 10).
- **No recogemos** el tipo de navegador/dispositivo (*user-agent*) ni tu geolocalización.

### 3.5. Datos de suscripción y pagos
- Tu plan (Gratuito/Premium), ciclo, estado y fechas.
- En las solicitudes de Premium: el ciclo deseado, el medio de pago que declares, un teléfono y correo de contacto, notas y una **referencia de pago en texto**.
- Historial de pagos: importe, ciclo, periodo, fecha, método y referencia.
- **No recogemos ni almacenamos números de tarjeta, CVV ni credenciales bancarias.** El pago se realiza por transferencia u otro medio acordado, fuera de la Plataforma.

---

## 4. Para qué usamos tus datos

- **Prestar y mantener el Servicio:** autenticarte, mostrar y procesar tu información, generar reportes.
- **Gestionar tu suscripción:** procesar solicitudes de plan y registrar pagos.
- **Seguridad y trazabilidad:** registros de auditoría, prevención de accesos no autorizados y de abusos.
- **Soporte:** atender tus consultas e incidencias.
- **Cumplimiento legal:** atender obligaciones que nos resulten aplicables.

---

## 5. Base/legitimación del tratamiento

Tratamos tus datos sobre la base de:
- La **ejecución del acuerdo** contigo (prestarte el Servicio que solicitas).
- Tu **consentimiento**, cuando proceda.
- Nuestro **interés legítimo** en operar, asegurar y mejorar el Servicio.
- El **cumplimiento de obligaciones legales**.

---

## 6. Datos de terceros que tú introduces

Cuando registras a tus clientes o proveedores (nombre, teléfono, correo, etc.), **tú eres el responsable** de esos datos personales y de contar con la base legal para tratarlos. GESTIA actúa como **proveedor que procesa esa información por tu cuenta**, únicamente para prestarte el Servicio y según tus instrucciones. Eres tú quien debe atender los derechos que esas personas ejerzan sobre sus datos.

---

## 7. Con quién compartimos los datos

No vendemos tus datos. Para operar el Servicio nos apoyamos en **proveedores (subprocesadores)** que tratan datos por nuestra cuenta:

| Proveedor | Para qué | Dónde |
|-----------|----------|-------|
| **Supabase** (Supabase Inc.) | Base de datos, autenticación, almacenamiento de archivos y envío de correos del sistema (confirmación de cuenta y recuperación de contraseña). | EE. UU. |
| **Netlify** (Netlify Inc.) | Alojamiento (*hosting*) y distribución de la aplicación. | EE. UU. |
| **ipify** (api.ipify.org) | Obtención de la dirección IP pública para los registros de auditoría. | Internet |

Además, podremos divulgar datos si la ley nos obliga o para proteger derechos, la seguridad o la integridad del Servicio.

---

## 8. Transferencias internacionales

Algunos de nuestros proveedores procesan datos fuera de tu país (por ejemplo, en Estados Unidos). Al usar el Servicio, entiendes que tu información puede tratarse en esas ubicaciones. Procuramos trabajar con proveedores que ofrecen garantías adecuadas de seguridad y protección de datos.

---

## 9. Cuánto tiempo conservamos los datos

- Conservamos tu información **mientras tu cuenta esté activa**.
- Si cambias de Premium a **Plan Gratuito**, tu información histórica **se conserva** (solo se restringen algunas funciones).
- Los **registros de auditoría** se conservan durante la vida de tu negocio en la Plataforma; **no se borran automáticamente** (sirven para garantizar la integridad y trazabilidad de tu contabilidad).
- **No** realizamos borrados automáticos por inactividad.
- Si solicitas la **eliminación total** de tu cuenta (escribiendo a soporteprofesional247@gmail.com), se eliminarán tus datos, **incluidos los registros de auditoría**. Esta eliminación es **irreversible**.
- **Equipo de trabajo:** cuando se elimina a un miembro que no tiene datos propios en la Plataforma, su acceso (cuenta) puede eliminarse por completo. Si el miembro tiene información propia o pertenece a otro negocio, solo se revoca su acceso a tu negocio.

---

## 10. Cookies y almacenamiento local

GESTIA **no usa cookies de rastreo ni de terceros**. Para funcionar, guarda datos técnicos en el almacenamiento local de tu navegador (*localStorage*):

- El **token de tu sesión** (para mantenerte conectado), gestionado por nuestro proveedor de autenticación.
- Tu **preferencia de tema** (claro/oscuro).
- Una **caché** de algunos datos de tu negocio para que la aplicación responda mejor y pueda mostrar información cuando la conexión es intermitente.

Estos datos se eliminan al cerrar sesión. Dado que se guardan en tu navegador, te recomendamos usar dispositivos de confianza.

---

## 11. Seguridad

Aplicamos medidas técnicas y organizativas para proteger tu información, entre ellas:

- **Cifrado en tránsito** (HTTPS/TLS) en las comunicaciones con la Plataforma.
- **Contraseñas cifradas** (*hashing*) gestionadas por el proveedor de autenticación; no se almacenan en texto legible.
- **Aislamiento entre negocios** mediante seguridad a nivel de fila en la base de datos (*Row Level Security*): un negocio no puede ver los datos de otro.
- **Control de acceso por roles y permisos** (RBAC): cada miembro de tu equipo ve únicamente lo que su rol permite.
- **Registros de auditoría** de las acciones realizadas en la cuenta.
- **Validación de los datos** que se introducen.
- **Gestión de secretos** mediante variables de entorno (las claves no se incluyen en el código).

**Qué conviene que sepas, con transparencia:**
- Actualmente **no está disponible la verificación en dos pasos (2FA)**. La protección frente a intentos masivos de adivinar contraseñas la aplica nuestro proveedor de autenticación a nivel de plataforma.
- El almacenamiento de tu navegador no está cifrado; usa equipos de confianza.
- Ningún sistema es 100 % infalible. Te pedimos que uses una contraseña única y robusta y que la mantengas en secreto.

---

## 12. Seguridad de tu cuenta de correo y tu contraseña

Como tu **correo electrónico es la llave de acceso** a tu cuenta y a tu información financiera, aplicamos lo siguiente:

- El registro requiere **confirmar tu correo** mediante un enlace temporal (válido aproximadamente 1 hora).
- La contraseña debe tener **al menos 8 caracteres** e incluir letras y números.
- La **recuperación de contraseña** se realiza por correo, mediante un enlace temporal (válido aproximadamente 1 hora); la nueva contraseña no puede ser igual a la anterior.
- Nunca te pediremos tu contraseña por correo, teléfono ni ningún otro canal. Si recibes un mensaje sospechoso, no respondas y avísanos.
- Eres responsable de la confidencialidad de tu contraseña y de cerrar sesión en equipos compartidos.

---

## 13. Tus derechos

Puedes solicitar en cualquier momento:
- **Acceso** a los datos que tenemos sobre ti.
- **Rectificación** de datos inexactos (muchos puedes editarlos tú directamente en la aplicación).
- **Eliminación** de tus datos o de tu cuenta.
- **Oposición** o limitación a ciertos tratamientos.
- **Portabilidad:** puedes exportar tu información en formatos estándar (PDF, Excel y Word) desde el módulo de Reportes.

Para ejercer estos derechos, escríbenos a soporteprofesional247@gmail.com. Atenderemos tu solicitud en un plazo razonable. Para proteger tu información, podremos verificar tu identidad antes de actuar.

---

## 14. Menores de edad

El Servicio está dirigido a la gestión de negocios y **no está destinado a menores de 18 años**. No recogemos conscientemente datos de menores de edad.

---

## 15. Cambios en esta Política

Podemos actualizar esta Política. Cuando lo hagamos, modificaremos la fecha de "Última actualización" y, si los cambios son relevantes, te lo comunicaremos por correo electrónico o mediante un aviso dentro de la aplicación.

---

## 16. Contacto

Para cualquier consulta sobre privacidad o para ejercer tus derechos, escríbenos a:

**soporteprofesional247@gmail.com**
