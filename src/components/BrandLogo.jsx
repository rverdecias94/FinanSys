/**
 * Logo horizontal de marca.
 * - Claro: /logo.png (texto oscuro)
 * - Oscuro: /logo_light.png (texto claro)
 */
export default function BrandLogo({
  className = 'h-8 w-auto object-contain',
  alt = 'Gestia',
}) {
  return (
    <>
      <img src="/logo.png" alt={alt} className={`dark:hidden ${className}`} />
      <img
        src="/logo_light.png"
        alt={alt}
        className={`hidden dark:block ${className}`}
      />
    </>
  )
}
