import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Límite de error global. Captura errores de render de cualquier parte del árbol
 * y muestra un fallback amigable (en español, mobile-first, respeta modo claro/oscuro)
 * en lugar de dejar la pantalla en blanco al usuario.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Registro para depuración (no se expone nada técnico al usuario).
    console.error('ErrorBoundary capturó un error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleHome = () => {
    // Navegación dura para reiniciar el árbol de React por completo.
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
        <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ocurrió un error inesperado y no pudimos mostrar esta sección. Tus datos están a salvo.
              Puedes recargar la página o volver al inicio.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button onClick={this.handleReload} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Recargar la página
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="w-full">
              <Home className="mr-2 h-4 w-4" /> Volver al inicio
            </Button>
          </div>

          {this.state.error?.message && (
            <details className="text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Detalles técnicos
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                {String(this.state.error.message)}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
