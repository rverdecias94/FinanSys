import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Loader2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSession } from '@/hooks/useSession'
import { useSubscription } from '@/context/SubscriptionContext'
import { supabase } from '@/config/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function Logs() {
  const { session } = useSession()
  const { canAccessFeature, activateTrial } = useSubscription()
  const userId = session?.user?.id

  // We only fetch if the user has access or we want to show empty state/error
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs') // Ensure this table exists or use whatever table stores logs
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data
    },
    enabled: !!userId && canAccessFeature('audit_logs')
  })

  if (!canAccessFeature('audit_logs')) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Logs de Auditoría</h1>
        <Alert className="bg-yellow-50 border-yellow-200">
          <ShieldAlert className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Acceso Restringido</AlertTitle>
          <AlertDescription className="text-yellow-700 flex flex-col gap-2">
            <span>
              El historial de auditoría y trazabilidad es una función exclusiva del Plan Premium.
              Actualiza tu cuenta para ver quién hizo qué y cuándo.
            </span>
          </AlertDescription>
        </Alert>

        {/* Mock/Blur UI to show what it looks like */}
        <Card className="opacity-50 pointer-events-none select-none filter blur-[1px]">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Hace 2 horas</TableCell>
                  <TableCell>Actualización</TableCell>
                  <TableCell>Producto #123</TableCell>
                  <TableCell>192.168.1.1</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Hace 5 horas</TableCell>
                  <TableCell>Eliminación</TableCell>
                  <TableCell>Movimiento #456</TableCell>
                  <TableCell>192.168.1.1</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-primary" />
          Logs de Auditoría
        </h1>
        <p className="text-muted-foreground">Registro detallado de seguridad y acciones en tu cuenta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Actividad</CardTitle>
          <CardDescription>Mostrando los últimos 100 eventos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No hay registros de auditoría aún.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.resource}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {log.ip_address || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
