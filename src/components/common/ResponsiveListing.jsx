import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger'

// Patrón ÚNICO de listado de la plataforma (uniformidad visual):
// - Desktop: lista de "tarjetas-fila" (estilo Finanzas) con 5 elementos por página
//   y paginación Anterior/Siguiente.
// - Móvil: scroll infinito (como Auditoría), cargando en bloques.
// Cada pantalla aporta su `queryFn` ({page,pageSize}) -> {data,count} y su `renderItem`.
// Así todos los listados se ven y se comportan igual, y futuros listados lo heredan.
export const LISTING_PAGE_SIZE = 5
export const LISTING_MOBILE_PAGE_SIZE = 15

export function ResponsiveListing({
  queryKey,
  queryFn,
  enabled = true,
  renderItem,
  getItemKey,
  emptyMessage = 'No hay elementos para mostrar',
  loadingMessage,
  desktopPageSize = LISTING_PAGE_SIZE,
  mobilePageSize = LISTING_MOBILE_PAGE_SIZE,
  showSummary = true,
  onMeta,
  className,
}) {
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)

  // Reiniciar a la página 1 cuando cambian los filtros (queryKey) o el modo.
  const keyStr = useMemo(() => JSON.stringify(queryKey), [queryKey])
  useEffect(() => {
    setPage(1)
  }, [keyStr])

  const desktop = useQuery({
    queryKey: [...queryKey, 'rl-page', page, desktopPageSize],
    queryFn: () => queryFn({ page, pageSize: desktopPageSize }),
    enabled: enabled && !isMobile,
    placeholderData: (prev) => prev, // mantener datos previos al cambiar de página
  })

  const mobile = useInfiniteQuery({
    queryKey: [...queryKey, 'rl-infinite', mobilePageSize],
    queryFn: ({ pageParam = 1 }) => queryFn({ page: pageParam, pageSize: mobilePageSize }),
    enabled: enabled && isMobile,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const count = Number(allPages?.[0]?.count ?? lastPage?.count ?? 0)
      const loaded = allPages.reduce((acc, p) => acc + Number(p?.data?.length || 0), 0)
      if (!count || loaded >= count) return undefined
      return allPages.length + 1
    },
  })

  const items = useMemo(() => {
    if (isMobile) return (mobile.data?.pages || []).flatMap((p) => p?.data || [])
    return desktop.data?.data || []
  }, [isMobile, mobile.data, desktop.data])

  const totalCount = isMobile
    ? Number(mobile.data?.pages?.[0]?.count || 0)
    : Number(desktop.data?.count || 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / desktopPageSize))
  const isLoading = isMobile ? mobile.isLoading : desktop.isLoading
  const isFetchingMore = isMobile ? mobile.isFetchingNextPage : false
  const hasMore = isMobile ? !!mobile.hasNextPage : false

  // Exponer el total a la pantalla (p. ej. para badges/contadores) sin acoplar la query.
  const onMetaRef = useRef(onMeta)
  onMetaRef.current = onMeta
  useEffect(() => {
    onMetaRef.current?.({ count: totalCount })
  }, [totalCount])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        {loadingMessage ? <span className="text-sm">{loadingMessage}</span> : null}
      </div>
    )
  }

  if (items.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showSummary && (
        <div className="text-sm text-muted-foreground">
          Mostrando {items.length} de {totalCount}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => {
          const key = getItemKey ? getItemKey(item, index) : (item?.id ?? index)
          return <div key={key}>{renderItem(item, index)}</div>
        })}
      </div>

      {isMobile ? (
        <>
          <InfiniteScrollTrigger
            onLoadMore={() => mobile.fetchNextPage()}
            disabled={!hasMore || isFetchingMore}
            className="mt-2"
          />
          {isFetchingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      ) : (
        totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  )
}
