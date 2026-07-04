import { Link } from 'react-router-dom'
import LegalLayout from '@/pages/legal/LegalLayout'
import { LEGAL } from '@/config/legal'

export default function Terminos() {
  const mailto = `mailto:${LEGAL.email}`

  return (
    <LegalLayout title="Términos de Servicio">
      <h2>1. Aceptación de los Términos</h2>
      <p>
        Al crear una cuenta o utilizar {LEGAL.producto} (en adelante, “el Servicio”, “la Plataforma”
        o “{LEGAL.producto}”) aceptas estos Términos de Servicio (los “Términos”). Si no estás de
        acuerdo con ellos, no uses el Servicio.
      </p>
      <p>
        Estos Términos constituyen un acuerdo entre tú (el “Usuario”) y {LEGAL.responsable} (el
        “Responsable”, “nosotros”), titular y operador de {LEGAL.producto}.
      </p>

      <h2>2. Descripción del Servicio</h2>
      <p>
        {LEGAL.producto} es un software como servicio (SaaS) de <strong>gestión financiera y contable
        para pequeñas y medianas empresas (PYMES)</strong>, accesible desde un navegador web. Su
        finalidad es ofrecer una herramienta sencilla, sin necesidad de conocimientos técnicos, para
        organizar la operación de un negocio.
      </p>
      <p>El Servicio incluye, entre otras, las siguientes funcionalidades:</p>
      <ul>
        <li>
          <strong>Finanzas:</strong> registro de ingresos y gastos, métodos de pago, estados de
          cobro/pago (pagado, pendiente, parcial), cuentas por cobrar y por pagar, contactos (clientes
          y proveedores) y registro de ventas vinculadas al almacén.
        </li>
        <li>
          <strong>Almacén:</strong> catálogo de productos, entradas y salidas de existencias, costeo a
          costo promedio ponderado (WAC) y cálculo del costo de lo vendido (COGS).
        </li>
        <li>
          <strong>Inventario:</strong> áreas o depósitos configurables con campos personalizados.
        </li>
        <li>
          <strong>Reportes:</strong> flujo de efectivo, antigüedad de saldos, posición financiera y
          otros informes, con exportación a PDF, Excel y Word.
        </li>
        <li>
          <strong>Configuración:</strong> datos del negocio, monedas, equipo de trabajo y
          roles/permisos.
        </li>
        <li>
          <strong>Auditoría (Logs):</strong> registro de las acciones realizadas en la cuenta (qué se
          hizo, quién y cuándo). El acceso al historial de auditoría es una función del Plan Premium.
        </li>
        <li>
          <strong>Planes Gratuito y Premium</strong> con distintos límites y funciones.
        </li>
      </ul>
      <p>
        Podemos modificar, añadir, suspender o discontinuar funciones del Servicio en cualquier
        momento. Cuando un cambio sea relevante, procuraremos avisarte con antelación razonable.
      </p>

      <h2>3. Cuentas y registro</h2>
      <p>
        3.1. Para usar el Servicio debes crear una cuenta proporcionando un <strong>correo
        electrónico</strong> válido y una <strong>contraseña</strong>. El registro requiere{' '}
        <strong>confirmar tu correo</strong> mediante un enlace que te enviamos; el enlace de
        confirmación tiene una validez limitada (aproximadamente 1 hora).
      </p>
      <p>
        3.2. La contraseña debe cumplir requisitos mínimos de seguridad (al menos 8 caracteres e
        incluir letras y números). <strong>Eres responsable de mantener la confidencialidad de tu
        contraseña y de toda la actividad que ocurra en tu cuenta.</strong> Notifícanos de inmediato
        si detectas un uso no autorizado.
      </p>
      <p>
        3.3. Debes tener al menos <strong>18 años</strong> y capacidad legal para contratar. El
        Servicio está dirigido a negocios y a su gestión, no a uso personal de menores de edad.
      </p>
      <p>3.4. Te comprometes a proporcionar información veraz y a mantenerla actualizada.</p>
      <p>
        3.5. <strong>Equipo de trabajo:</strong> el titular de una cuenta (el “Propietario”) puede
        invitar a otras personas como miembros de su equipo (función disponible en el plan Premium).
        Las invitaciones se vinculan al correo de la persona invitada. El Propietario es responsable
        del uso que su equipo haga del Servicio.
      </p>

      <h2>4. Planes, límites y uso justo</h2>
      <p>
        4.1. {LEGAL.producto} ofrece un <strong>Plan Gratuito</strong> y un <strong>Plan
        Premium</strong>. Cada plan tiene límites de uso (por ejemplo: número de transacciones por
        mes, productos, áreas de inventario, monedas activas y miembros de equipo) que se muestran de
        forma actualizada dentro de la aplicación, en <strong>Configuración › Planes</strong>.
      </p>
      <p>
        4.2. A título informativo, el Plan Gratuito actualmente contempla límites como: 40
        transacciones por mes, 40 productos, 5 áreas de inventario, 1 moneda activa y sin miembros de
        equipo adicionales. El Plan Premium amplía o elimina estos límites (por ejemplo, hasta 5
        miembros de equipo). <strong>Los valores vigentes son siempre los indicados dentro de la
        aplicación</strong> y pueden variar.
      </p>
      <p>
        4.3. Al alcanzar los límites de tu plan, el Servicio puede impedir crear nuevos registros
        hasta que actualices tu plan o liberes espacio. Nos reservamos el derecho de aplicar límites
        razonables de uso para proteger la estabilidad del Servicio frente a un uso abusivo o
        automatizado.
      </p>

      <h2>5. Pago, activación y renovación del Plan Premium</h2>
      <p>
        <strong>{LEGAL.producto} no procesa pagos en línea ni almacena datos de tarjetas.</strong>
      </p>
      <p>
        5.1. <strong>Activación manual.</strong> El Plan Premium se activa <strong>únicamente</strong>{' '}
        tras: (a) tu solicitud desde <strong>Configuración › Planes</strong>, indicando el ciclo
        deseado y el medio de pago, y (b) la <strong>aprobación manual</strong> por parte del
        Responsable. No existe cobro automático ni pasarela de pago integrada.
      </p>
      <p>
        5.2. <strong>Pago fuera de la plataforma.</strong> El pago se realiza por transferencia
        bancaria u otro medio acordado, <strong>fuera del Servicio</strong>. {LEGAL.producto}{' '}
        únicamente registra datos de referencia (importe, ciclo, fecha y una referencia de pago en
        texto). <strong>No recogemos ni almacenamos números de tarjeta, CVV ni credenciales de
        pago.</strong>
      </p>
      <p>
        5.3. <strong>Sin renovación automática.</strong> El Plan Premium tiene una fecha de
        vencimiento. <strong>No se renueva automáticamente</strong> ni se generan cobros recurrentes.
        Para continuar con Premium debes solicitar de nuevo la activación y obtener una nueva
        aprobación.
      </p>
      <p>
        5.4. <strong>Avisos y periodo de gracia.</strong> Antes del vencimiento te mostraremos un
        aviso dentro de la aplicación (de forma orientativa, varios días antes). Tras el vencimiento
        existe un breve <strong>periodo de gracia</strong> durante el cual conservas el acceso
        Premium. Si finalizado ese periodo no se ha regularizado el pago, las funciones Premium quedan{' '}
        <strong>bloqueadas</strong>; podrás seguir usando el Plan Gratuito conservando tu información
        (ver sección 7).
      </p>
      <p>
        5.5. <strong>Precios e impuestos.</strong> Los precios y ciclos vigentes (por ejemplo, pago
        mensual o pago adelantado con descuento) se muestran en <strong>Configuración › Planes</strong>.
        Podemos modificar los precios avisándote con antelación razonable; los cambios no afectan a
        periodos ya pagados. Cualquier impuesto que corresponda según tu jurisdicción corre por tu
        cuenta.
      </p>

      <h2>6. Política de reembolsos</h2>
      <p>
        <strong>No ofrecemos reembolsos por periodos ya pagados.</strong> Dado que el Plan Premium no
        se cobra de forma automática y se activa solo a petición tuya, si decides no renovar
        simplemente dejarás de tener acceso a las funciones Premium al finalizar el periodo
        contratado, conservando tu información en el Plan Gratuito.
      </p>

      <h2>7. Cancelación y cambio a Plan Gratuito</h2>
      <p>7.1. Puedes dejar de usar el Servicio en cualquier momento.</p>
      <p>
        7.2. Puedes cambiar de Premium a <strong>Plan Gratuito</strong> desde la propia aplicación,
        mediante un asistente. Al hacerlo:
      </p>
      <ul>
        <li>
          <strong>Conservas tu información histórica</strong> (transacciones, productos, movimientos,
          etc.).
        </li>
        <li>
          Se <strong>restringen</strong> algunas funciones: queda activa 1 moneda (la que elijas), un
          máximo de áreas de inventario editables, se desactiva la exportación avanzada y el acceso al
          historial de auditoría, y <strong>se revoca el acceso de los miembros de tu equipo</strong>.
        </li>
      </ul>
      <p>
        7.3. <strong>Eliminación total de la cuenta.</strong> Si deseas eliminar por completo tu cuenta
        y todos tus datos, debes solicitarlo escribiendo a <a href={mailto}>{LEGAL.email}</a>.
        Actualmente este borrado total se realiza de forma asistida (no autoservicio) y es{' '}
        <strong>irreversible</strong>.
      </p>

      <h2>8. Uso aceptable</h2>
      <p>Al usar {LEGAL.producto} te comprometes a <strong>no</strong>:</p>
      <ul>
        <li>
          Utilizar el Servicio para actividades ilegales, fraudulentas o para registrar, ocultar o
          facilitar operaciones ilícitas (incluido el blanqueo de capitales o la evasión fiscal).
        </li>
        <li>
          Introducir datos personales de terceros (por ejemplo, clientes o proveedores) sin contar con
          una base legal o el consentimiento necesario para tratarlos (ver sección 9).
        </li>
        <li>
          Intentar acceder a datos de otros negocios o usuarios, ni vulnerar, sondear o eludir las
          medidas de seguridad de la Plataforma.
        </li>
        <li>
          Realizar ingeniería inversa, descompilar o extraer el código del Servicio, salvo en la
          medida que la ley lo permita expresamente.
        </li>
        <li>Usar medios automatizados (bots, scraping) que sobrecarguen o dañen la infraestructura.</li>
        <li>Enviar spam, contenido malicioso o software dañino.</li>
        <li>Revender, sublicenciar o ceder el acceso al Servicio sin nuestra autorización.</li>
      </ul>
      <p>
        El incumplimiento de esta sección puede dar lugar a la suspensión o cierre de la cuenta
        (sección 14).
      </p>

      <h2>9. Tu información y contenido</h2>
      <p>
        9.1. <strong>Propiedad.</strong> Conservas la titularidad de toda la información que introduces
        en el Servicio (datos financieros, productos, contactos, archivos, etc.).
      </p>
      <p>
        9.2. <strong>Licencia limitada.</strong> Nos otorgas una licencia limitada para alojar,
        almacenar y procesar tu información con el <strong>único fin de operar y prestarte el
        Servicio</strong> (incluido mostrarla, generar reportes y realizar copias de seguridad
        técnicas).
      </p>
      <p>
        9.3. <strong>Datos de terceros.</strong> Si introduces datos personales de terceros (por
        ejemplo, el nombre, teléfono o correo de tus clientes o proveedores), <strong>tú eres el
        responsable</strong> de dichos datos y de contar con la legitimación para tratarlos.{' '}
        {LEGAL.producto} actúa únicamente como proveedor que los procesa por tu cuenta y según tus
        instrucciones. Consulta la <Link to="/privacidad">Política de Privacidad</Link> para más
        detalle.
      </p>
      <p>
        9.4. <strong>Exportación.</strong> Puedes exportar tu información desde el módulo de Reportes.
        La exportación en <strong>PDF</strong> está disponible en todos los planes (en el Plan Gratuito
        el documento puede incluir una marca de agua identificativa); la exportación en{' '}
        <strong>Excel y Word</strong> es una función del Plan Premium.
      </p>
      <p>
        9.5. <strong>Respaldo.</strong> Aunque la infraestructura realiza copias de seguridad a nivel
        técnico, te recomendamos <strong>exportar y conservar tus propios respaldos</strong>{' '}
        periódicamente.
      </p>

      <h2>10. Propiedad intelectual</h2>
      <p>
        El software, la marca “{LEGAL.producto}”, el diseño, la interfaz y el resto de elementos de la
        Plataforma son propiedad del Responsable y están protegidos por las leyes aplicables. Estos
        Términos no te transfieren ningún derecho de propiedad sobre el Servicio, salvo el derecho
        limitado a usarlo conforme a lo aquí establecido.
      </p>

      <h2>11. La herramienta no sustituye la asesoría profesional</h2>
      <p>
        {LEGAL.producto} es una <strong>herramienta de apoyo</strong> a la gestión y el registro de la
        información de tu negocio. <strong>No constituye asesoría contable, fiscal, financiera ni
        legal.</strong> Los cálculos, reportes e indicadores que ofrece la Plataforma son orientativos
        y dependen de la información que tú introduces. Eres responsable de verificar tu información, de
        tus declaraciones y obligaciones fiscales, y de consultar a un profesional cualificado cuando
        lo necesites.
      </p>

      <h2>12. Disponibilidad del Servicio</h2>
      <p>
        El Servicio se ofrece <strong>“tal cual” y “según disponibilidad”</strong>. Procuramos
        mantenerlo operativo y seguro, pero no garantizamos que funcione de forma ininterrumpida, libre
        de errores o que esté siempre disponible. Pueden producirse interrupciones por mantenimiento,
        fallos técnicos o causas ajenas a nuestro control.
      </p>

      <h2>13. Limitación de responsabilidad</h2>
      <p>En la máxima medida permitida por la ley:</p>
      <ul>
        <li>
          No seremos responsables de daños indirectos, incidentales o consecuentes, ni de la pérdida de
          datos, ingresos o beneficios derivados del uso o la imposibilidad de uso del Servicio.
        </li>
        <li>
          Nuestra responsabilidad total acumulada, por cualquier concepto relacionado con el Servicio,
          se limita al <strong>importe que hayas pagado por el Servicio durante los 3 (tres) meses
          anteriores</strong> al hecho que origine la reclamación. Si usas el Plan Gratuito, dicho
          importe es cero.
        </li>
      </ul>

      <h2>14. Suspensión y terminación</h2>
      <p>
        14.1. Podemos suspender o cerrar cuentas que incumplan estos Términos, que pongan en riesgo la
        seguridad o el funcionamiento del Servicio, o cuando lo exija la ley.
      </p>
      <p>
        14.2. Cuando sea razonable y proporcionado, te avisaremos antes de suspender o cerrar tu cuenta
        y te daremos la oportunidad de subsanar el incumplimiento.
      </p>
      <p>
        14.3. Al terminar la relación, cesará tu derecho a usar el Servicio. Las disposiciones que por
        su naturaleza deban subsistir (propiedad intelectual, limitación de responsabilidad,
        indemnización, etc.) seguirán vigentes.
      </p>

      <h2>15. Indemnización</h2>
      <p>
        Aceptas mantenernos indemnes frente a reclamaciones, daños o gastos (incluidos honorarios
        legales razonables) derivados de: (a) tu uso indebido del Servicio; (b) el incumplimiento de
        estos Términos; o (c) el tratamiento de datos de terceros que hayas introducido sin la
        legitimación adecuada.
      </p>

      <h2>16. Ley aplicable y resolución de disputas</h2>
      <p>
        Estos Términos se rigen por las leyes aplicables en el lugar de residencia del Responsable.
        Para cualquier controversia, las partes se someten a los tribunales competentes de{' '}
        {LEGAL.ciudadPais}, salvo que una norma imperativa de protección al consumidor disponga otra
        cosa.
      </p>
      <p>
        Antes de acudir a la vía judicial, las partes intentarán resolver cualquier desacuerdo de buena
        fe, contactando a través de <a href={mailto}>{LEGAL.email}</a>.
      </p>

      <h2>17. Cambios en estos Términos</h2>
      <p>
        Podemos actualizar estos Términos. Cuando lo hagamos, modificaremos la fecha de “Última
        actualización” y, si los cambios son relevantes, te avisaremos por correo electrónico o
        mediante un aviso dentro de la aplicación. El uso continuado del Servicio tras la entrada en
        vigor de los cambios implica su aceptación.
      </p>

      <h2>18. Contacto</h2>
      <p>
        Para cualquier consulta sobre estos Términos puedes escribirnos a{' '}
        <a href={mailto}>{LEGAL.email}</a>.
      </p>
    </LegalLayout>
  )
}
