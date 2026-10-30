import { useMemo } from 'react'
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
  const planId = subscription?.plan_id || 'free'
  const hasAi = canAccessFeature('ai_tools')
  const isElite = planId === 'ultra'
  const isNegocio = planId === 'premium'
  const hasRadar = isElite || isNegocio
  const defaultTab = hasRadar ? 'radar' : 'asistente'
  const tabCols = useMemo(() => {
    if (isElite) return 'grid-cols-2 sm:grid-cols-4'
    if (isNegocio) return 'grid-cols-3'
    return 'grid-cols-2'
  }, [isElite, isNegocio])

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
          title="Copiloto"
          description="Importa comprobantes con OCR, pregunta por tus números y usa el Radar de caja (15 días en Negocio; 30/60/90 en Élite)."
          icon={Sparkles}
          ctaHint="Pasa a Negocio o Élite para activar el Copiloto."
          ctaLabel="Ver planes"
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
          {isElite
            ? 'Radar 30/60/90, preguntas sobre tu negocio e importación con foto. Cupos Élite mensuales.'
            : 'Radar a 15 días, asistente e importación con foto. Horizontes 30/60/90 en Élite.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuotaBadge
          label="Páginas de importación"
          used={usage.doc_pages_used}
          limit={usage.doc_pages_limit ?? (isElite ? 100 : 20)}
        />
        <QuotaBadge
          label="Consultas al asistente"
          used={usage.calc_queries_used}
          limit={usage.calc_queries_limit ?? (isElite ? 50 : 15)}
        />
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid h-auto w-full gap-1 ${tabCols}`}>
          {hasRadar && <TabsTrigger value="radar" className="text-xs sm:text-sm">Radar</TabsTrigger>}
          <TabsTrigger value="asistente" className="text-xs sm:text-sm">Asistente</TabsTrigger>
          <TabsTrigger value="importar" className="text-xs sm:text-sm">Importar</TabsTrigger>
          {isElite && <TabsTrigger value="escenarios" className="text-xs sm:text-sm">Escenarios</TabsTrigger>}
        </TabsList>
        {hasRadar && (
          <TabsContent value="radar" className="mt-4">
            <CashRadar isElite={isElite} />
          </TabsContent>
        )}
        <TabsContent value="asistente" className="mt-4">
          <BusinessAssistant onQuotaChange={() => usageQuery.refetch()} />
        </TabsContent>
        <TabsContent value="importar" className="mt-4">
          <DocumentReader onQuotaChange={() => usageQuery.refetch()} />
        </TabsContent>
        {isElite && (
          <TabsContent value="escenarios" className="mt-4">
            <BusinessCalculator />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
