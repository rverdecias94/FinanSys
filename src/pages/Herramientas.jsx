import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PremiumFeatureScreen } from '@/components/auth/PremiumFeatureScreen'
import { QuotaBadge } from '@/components/herramientas/QuotaBadge'
import { DocumentReader } from '@/components/herramientas/DocumentReader'
import { BusinessCalculator } from '@/components/herramientas/BusinessCalculator'
import { BusinessAssistant } from '@/components/herramientas/BusinessAssistant'
import { CashRadar } from '@/components/herramientas/CashRadar'
import { useSubscription } from '@/context/SubscriptionContext'
import { useBusiness } from '@/context/BusinessContext'
import { getAiUsage } from '@/services/aiTools'

export default function Herramientas() {
  const { canAccessFeature, subscription } = useSubscription()
  const { businessId } = useBusiness()
  const hasAi = canAccessFeature('ai_tools') || subscription?.plan_id === 'ultra'

  const usageQuery = useQuery({
    queryKey: ['ai-usage', businessId],
    queryFn: () => getAiUsage(businessId),
    enabled: !!businessId && hasAi,
    staleTime: 30_000,
  })

  if (!hasAi) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PremiumFeatureScreen
          title="Copiloto Ultra"
          description="Radar de caja a 30/60/90 días, asistente sobre tus números e importación de comprobantes con foto. Incluido en el plan Ultra."
          icon={Sparkles}
          ctaHint="Pasa a Ultra para ver si te alcanza el mes, preguntar por tus datos e importar con la cámara."
          ctaLabel="Ver plan Ultra"
        />
      </div>
    )
  }

  const usage = usageQuery.data || {}

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary shrink-0" />
          Copiloto
        </h1>
        <p className="text-sm text-muted-foreground">
          Radar de caja, preguntas sobre tu negocio e importación con foto. Cupos Ultra mensuales.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuotaBadge
          label="Páginas de importación"
          used={usage.doc_pages_used}
          limit={usage.doc_pages_limit ?? 100}
        />
        <QuotaBadge
          label="Consultas al asistente"
          used={usage.calc_queries_used}
          limit={usage.calc_queries_limit ?? 120}
        />
      </div>

      <Tabs defaultValue="radar" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="radar" className="text-xs sm:text-sm">Radar</TabsTrigger>
          <TabsTrigger value="asistente" className="text-xs sm:text-sm">Asistente</TabsTrigger>
          <TabsTrigger value="importar" className="text-xs sm:text-sm">Importar</TabsTrigger>
          <TabsTrigger value="escenarios" className="text-xs sm:text-sm">Escenarios</TabsTrigger>
        </TabsList>
        <TabsContent value="radar" className="mt-4">
          <CashRadar />
        </TabsContent>
        <TabsContent value="asistente" className="mt-4">
          <BusinessAssistant onQuotaChange={() => usageQuery.refetch()} />
        </TabsContent>
        <TabsContent value="importar" className="mt-4">
          <DocumentReader onQuotaChange={() => usageQuery.refetch()} />
        </TabsContent>
        <TabsContent value="escenarios" className="mt-4">
          <BusinessCalculator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
