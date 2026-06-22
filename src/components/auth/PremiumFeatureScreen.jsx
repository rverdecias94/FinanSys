/* eslint-disable react/prop-types */
import { ArrowRight, Crown, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Pantalla inline (no overlay global) para secciones disponibles solo en Premium.
 * Se usa como early-return dentro de una página cuando el plan no incluye la
 * función. Mobile-first, tokens de color, respeta modo claro/oscuro.
 */
export function PremiumFeatureScreen({
  title = 'Función Premium',
  description = 'Esta sección está disponible en el plan Premium.',
  icon: Icon = Lock
}) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-6 text-center">
        <CardContent className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-left">
            <div className="flex items-start gap-2">
              <Crown className="mt-0.5 h-4 w-4 text-warning" />
              <p className="text-sm text-muted-foreground">
                Mejora a Premium para desbloquear esta función y muchas más.
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/configuracion')} className="w-full">
            Mejorar Plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
