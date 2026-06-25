import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import LegalLayout, { Callout } from '@/pages/legal/LegalLayout'
import { LEGAL } from '@/config/legal'
import { cn } from '@/lib/utils'

const resumen = [
  { ok: true, text: 'Usamos tus datos solo para prestarte el Servicio (gestionar tu negocio) y para mantenerlo seguro.' },
  { ok: true, text: 'Tus contraseñas se guardan cifradas por nuestro proveedor de autenticación; nunca las vemos ni se almacenan en texto legible.' },
  { ok: true, text: 'Cada negocio está aislado del resto mediante seguridad a nivel de base de datos.' },
  { ok: false, text: 'No vendemos tus datos.' },
  { ok: false, text: 'No mostramos publicidad ni usamos rastreadores publicitarios de terceros.' },
  { ok: false, text: 'No usamos herramientas de analítica de terceros (como Google Analytics) ni inteligencia artificial sobre tus datos.' },
  { ok: false, text: 'No recogemos ni almacenamos datos de tarjetas de crédito o débito.' },
]

const subprocesadores = [
  {
    nombre: 'Supabase (Supabase Inc.)',
    uso: 'Base de datos, autenticación, almacenamiento de archivos y envío de correos del sistema (confirmación de cuenta y recuperación de contraseña).',
    lugar: 'EE. UU.',
  },
  {
    nombre: 'Netlify (Netlify Inc.)',
    uso: 'Alojamiento (hosting) y distribución de la aplicación.',
    lugar: 'EE. UU.',
  },
  {
    nombre: 'ipify (api.ipify.org)',
    uso: 'Obtención de la dirección IP pública para los registros de auditoría.',
    lugar: 'Internet',
  },
]

export default function Privacidad() {
  const mailto = `mailto:${LEGAL.email}`

  return (
    <LegalLayout title="Política de Privacidad">
      <h2>1. Quiénes somos</h2>
      <p>
        {LEGAL.responsable} (el “Responsable”, “nosotros”) es el titular y operador de{' '}
        <strong>{LEGAL.producto}</strong>, una plataforma de gestión financiera y contable para
        pequeñas y medianas empresas.
      </p>
      <p>
        Esta Política explica qué datos recogemos, con qué finalidad, con quién los compartimos, cuánto
        tiempo los conservamos y qué derechos tienes.
      </p>
      <p>
        <strong>Contacto en materia de privacidad:</strong> <a href={mailto}>{LEGAL.email}</a>
      </p>

      <h2>2. Resumen rápido</h2>
      <p>Para que lo tengas claro desde el principio:</p>
      <Callout>
        <div className="space-y-2.5">
          {resumen.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              {item.ok ? (
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <X className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              )}
              <span className="text-[15px] leading-relaxed text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
      </Callout>

      <h2>3. Qué datos recogemos</h2>

      <h3>3.1. Datos de tu cuenta</h3>
      <ul>
        <li>
          <strong>Correo electrónico</strong> (es tu identificador de acceso).
        </li>
        <li>
          <strong>Contraseña</strong>, almacenada de forma cifrada (con técnicas de <em>hashing</em>)
          por nuestro proveedor de autenticación. No tenemos acceso a tu contraseña en texto legible.
        </li>
      </ul>

      <h3>3.2. Datos del perfil de tu negocio (opcionales, los introduces tú)</h3>
      <p>
        En la configuración puedes añadir: nombre comercial, nombre legal, identificación fiscal
        (RFC/RUC/NIT), teléfono, correo de contacto del negocio, logotipo y región (país,
        provincia/estado y ciudad).
      </p>

      <h3>3.3. Información que tú introduces para gestionar tu negocio (“tu contenido”)</h3>
      <ul>
        <li>
          Transacciones financieras: importes, fechas, categorías, descripciones, estados de
          cobro/pago y vencimientos.
        </li>
        <li>Productos, existencias, costos, movimientos de almacén y ventas.</li>
        <li>
          <strong>Contactos</strong> (clientes y proveedores): nombre, correo, teléfono y notas (ver
          sección 6 sobre datos de terceros).
        </li>
        <li>Saldos, monedas y tasas de cambio.</li>
        <li>
          <strong>Archivos</strong> que adjuntes (por ejemplo, comprobantes de transacciones) y tu
          logotipo, almacenados en nuestro proveedor de almacenamiento.
        </li>
      </ul>

      <h3>3.4. Datos de uso y técnicos</h3>
      <ul>
        <li>
          <strong>Dirección IP:</strong> se obtiene a través de un servicio externo
          (api.ipify.org) y se guarda en los <strong>registros de auditoría</strong> de tu cuenta para
          fines de seguridad y trazabilidad. Es un dato “al mejor esfuerzo”: si el servicio no
          responde, puede no registrarse.
        </li>
        <li>
          <strong>Registros de auditoría (logs):</strong> qué acción se realizó, sobre qué recurso, en
          qué área, el valor anterior y el nuevo, el correo de quien la hizo, la fecha/hora y la
          dirección IP.
        </li>
        <li>
          <strong>Almacenamiento en tu navegador:</strong> datos técnicos necesarios para que el
          Servicio funcione (ver sección 10).
        </li>
        <li>
          <strong>No recogemos</strong> el tipo de navegador/dispositivo (<em>user-agent</em>) ni tu
          geolocalización.
        </li>
      </ul>

      <h3>3.5. Datos de suscripción y pagos</h3>
      <ul>
        <li>Tu plan (Gratuito/Premium), ciclo, estado y fechas.</li>
        <li>
          En las solicitudes de Premium: el ciclo deseado, el medio de pago que declares, un teléfono y
          correo de contacto, notas y una referencia de pago en texto.
        </li>
        <li>Historial de pagos: importe, ciclo, periodo, fecha, método y referencia.</li>
        <li>
          <strong>No recogemos ni almacenamos números de tarjeta, CVV ni credenciales bancarias.</strong>{' '}
          El pago se realiza por transferencia u otro medio acordado, fuera de la Plataforma.
        </li>
      </ul>

      <h2>4. Para qué usamos tus datos</h2>
      <ul>
        <li>
          <strong>Prestar y mantener el Servicio:</strong> autenticarte, mostrar y procesar tu
          información, generar reportes.
        </li>
        <li>
          <strong>Gestionar tu suscripción:</strong> procesar solicitudes de plan y registrar pagos.
        </li>
        <li>
          <strong>Seguridad y trazabilidad:</strong> registros de auditoría, prevención de accesos no
          autorizados y de abusos.
        </li>
        <li>
          <strong>Soporte:</strong> atender tus consultas e incidencias.
        </li>
        <li>
          <strong>Cumplimiento legal:</strong> atender obligaciones que nos resulten aplicables.
        </li>
      </ul>

      <h2>5. Base/legitimación del tratamiento</h2>
      <p>Tratamos tus datos sobre la base de:</p>
      <ul>
        <li>La <strong>ejecución del acuerdo</strong> contigo (prestarte el Servicio que solicitas).</li>
        <li>Tu <strong>consentimiento</strong>, cuando proceda.</li>
        <li>Nuestro <strong>interés legítimo</strong> en operar, asegurar y mejorar el Servicio.</li>
        <li>El <strong>cumplimiento de obligaciones legales</strong>.</li>
      </ul>

      <h2>6. Datos de terceros que tú introduces</h2>
      <p>
        Cuando registras a tus clientes o proveedores (nombre, teléfono, correo, etc.), <strong>tú eres
        el responsable</strong> de esos datos personales y de contar con la base legal para tratarlos.{' '}
        {LEGAL.producto} actúa como <strong>proveedor que procesa esa información por tu cuenta</strong>,
        únicamente para prestarte el Servicio y según tus instrucciones. Eres tú quien debe atender los
        derechos que esas personas ejerzan sobre sus datos.
      </p>

      <h2>7. Con quién compartimos los datos</h2>
      <p>
        No vendemos tus datos. Para operar el Servicio nos apoyamos en <strong>proveedores
        (subprocesadores)</strong> que tratan datos por nuestra cuenta:
      </p>
      <div className="my-6 space-y-3">
        {subprocesadores.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-foreground">{s.nombre}</span>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {s.lugar}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.uso}</p>
          </div>
        ))}
      </div>
      <p>
        Además, podremos divulgar datos si la ley nos obliga o para proteger derechos, la seguridad o la
        integridad del Servicio.
      </p>

      <h2>8. Transferencias internacionales</h2>
      <p>
        Algunos de nuestros proveedores procesan datos fuera de tu país (por ejemplo, en Estados
        Unidos). Al usar el Servicio, entiendes que tu información puede tratarse en esas ubicaciones.
        Procuramos trabajar con proveedores que ofrecen garantías adecuadas de seguridad y protección
        de datos.
      </p>

      <h2>9. Cuánto tiempo conservamos los datos</h2>
      <ul>
        <li>Conservamos tu información <strong>mientras tu cuenta esté activa</strong>.</li>
        <li>
          Si cambias de Premium a <strong>Plan Gratuito</strong>, tu información histórica{' '}
          <strong>se conserva</strong> (solo se restringen algunas funciones).
        </li>
        <li>
          Los <strong>registros de auditoría</strong> se conservan durante la vida de tu negocio en la
          Plataforma; <strong>no se borran automáticamente</strong> (sirven para garantizar la
          integridad y trazabilidad de tu contabilidad).
        </li>
        <li><strong>No</strong> realizamos borrados automáticos por inactividad.</li>
        <li>
          Si solicitas la <strong>eliminación total</strong> de tu cuenta (escribiendo a{' '}
          <a href={mailto}>{LEGAL.email}</a>), se eliminarán tus datos, incluidos los registros de
          auditoría. Esta eliminación es <strong>irreversible</strong>.
        </li>
        <li>
          <strong>Equipo de trabajo:</strong> cuando se elimina a un miembro que no tiene datos propios
          en la Plataforma, su acceso (cuenta) puede eliminarse por completo. Si el miembro tiene
          información propia o pertenece a otro negocio, solo se revoca su acceso a tu negocio.
        </li>
      </ul>

      <h2>10. Cookies y almacenamiento local</h2>
      <p>
        {LEGAL.producto} <strong>no usa cookies de rastreo ni de terceros</strong>. Para funcionar,
        guarda datos técnicos en el almacenamiento local de tu navegador (<em>localStorage</em>):
      </p>
      <ul>
        <li>
          El <strong>token de tu sesión</strong> (para mantenerte conectado), gestionado por nuestro
          proveedor de autenticación.
        </li>
        <li>Tu <strong>preferencia de tema</strong> (claro/oscuro).</li>
        <li>
          Una <strong>caché</strong> de algunos datos de tu negocio para que la aplicación responda
          mejor y pueda mostrar información cuando la conexión es intermitente.
        </li>
      </ul>
      <p>
        Estos datos se eliminan al cerrar sesión. Dado que se guardan en tu navegador, te recomendamos
        usar dispositivos de confianza.
      </p>

      <h2>11. Seguridad</h2>
      <p>Aplicamos medidas técnicas y organizativas para proteger tu información, entre ellas:</p>
      <ul>
        <li><strong>Cifrado en tránsito</strong> (HTTPS/TLS) en las comunicaciones con la Plataforma.</li>
        <li>
          <strong>Contraseñas cifradas</strong> (<em>hashing</em>) gestionadas por el proveedor de
          autenticación; no se almacenan en texto legible.
        </li>
        <li>
          <strong>Aislamiento entre negocios</strong> mediante seguridad a nivel de fila en la base de
          datos (<em>Row Level Security</em>): un negocio no puede ver los datos de otro.
        </li>
        <li>
          <strong>Control de acceso por roles y permisos</strong> (RBAC): cada miembro de tu equipo ve
          únicamente lo que su rol permite.
        </li>
        <li><strong>Registros de auditoría</strong> de las acciones realizadas en la cuenta.</li>
        <li><strong>Validación de los datos</strong> que se introducen.</li>
        <li>
          <strong>Gestión de secretos</strong> mediante variables de entorno (las claves no se incluyen
          en el código).
        </li>
      </ul>
      <p>Qué conviene que sepas, con transparencia:</p>
      <ul>
        <li>
          Actualmente <strong>no está disponible la verificación en dos pasos (2FA)</strong>. La
          protección frente a intentos masivos de adivinar contraseñas la aplica nuestro proveedor de
          autenticación a nivel de plataforma.
        </li>
        <li>El almacenamiento de tu navegador no está cifrado; usa equipos de confianza.</li>
        <li>
          Ningún sistema es 100 % infalible. Te pedimos que uses una contraseña única y robusta y que
          la mantengas en secreto.
        </li>
      </ul>

      <h2>12. Seguridad de tu cuenta de correo y tu contraseña</h2>
      <p>
        Como tu <strong>correo electrónico es la llave de acceso</strong> a tu cuenta y a tu
        información financiera, aplicamos lo siguiente:
      </p>
      <ul>
        <li>
          El registro requiere <strong>confirmar tu correo</strong> mediante un enlace temporal (válido
          aproximadamente 1 hora).
        </li>
        <li>La contraseña debe tener <strong>al menos 8 caracteres</strong> e incluir letras y números.</li>
        <li>
          La <strong>recuperación de contraseña</strong> se realiza por correo, mediante un enlace
          temporal (válido aproximadamente 1 hora); la nueva contraseña no puede ser igual a la
          anterior.
        </li>
        <li>
          Nunca te pediremos tu contraseña por correo, teléfono ni ningún otro canal. Si recibes un
          mensaje sospechoso, no respondas y avísanos.
        </li>
        <li>
          Eres responsable de la confidencialidad de tu contraseña y de cerrar sesión en equipos
          compartidos.
        </li>
      </ul>

      <h2>13. Tus derechos</h2>
      <p>Puedes solicitar en cualquier momento:</p>
      <ul>
        <li><strong>Acceso</strong> a los datos que tenemos sobre ti.</li>
        <li>
          <strong>Rectificación</strong> de datos inexactos (muchos puedes editarlos tú directamente en
          la aplicación).
        </li>
        <li><strong>Eliminación</strong> de tus datos o de tu cuenta.</li>
        <li><strong>Oposición</strong> o limitación a ciertos tratamientos.</li>
        <li>
          <strong>Portabilidad:</strong> puedes exportar tu información en formatos estándar (PDF, Excel
          y Word) desde el módulo de Reportes.
        </li>
      </ul>
      <p>
        Para ejercer estos derechos, escríbenos a <a href={mailto}>{LEGAL.email}</a>. Atenderemos tu
        solicitud en un plazo razonable. Para proteger tu información, podremos verificar tu identidad
        antes de actuar.
      </p>

      <h2>14. Menores de edad</h2>
      <p>
        El Servicio está dirigido a la gestión de negocios y <strong>no está destinado a menores de 18
        años</strong>. No recogemos conscientemente datos de menores de edad.
      </p>

      <h2>15. Cambios en esta Política</h2>
      <p>
        Podemos actualizar esta Política. Cuando lo hagamos, modificaremos la fecha de “Última
        actualización” y, si los cambios son relevantes, te lo comunicaremos por correo electrónico o
        mediante un aviso dentro de la aplicación.
      </p>

      <h2>16. Contacto</h2>
      <p>
        Para cualquier consulta sobre privacidad o para ejercer tus derechos, escríbenos a{' '}
        <a href={mailto}>{LEGAL.email}</a>.
      </p>
    </LegalLayout>
  )
}
