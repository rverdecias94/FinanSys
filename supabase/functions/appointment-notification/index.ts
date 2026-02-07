import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente de Supabase con el contexto de la función
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    )

    // Obtener los datos del webhook
    const { type, table, record, old_record } = await req.json()
    
    console.log(`Webhook recibido: ${type} en tabla ${table}`, record)

    // Solo procesar inserciones en appointments_dynamic
    if (type !== 'INSERT' || table !== 'appointments_dynamic') {
      return new Response(JSON.stringify({ message: 'No es una inserción de cita' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Obtener información del proveedor y su token de notificación
    const { data: provider, error: providerError } = await supabaseClient
      .from('providers')
      .select('id, name, notification_token')
      .eq('uuid', record.provider_id)
      .single()

    if (providerError || !provider?.notification_token) {
      console.log('Proveedor no encontrado o sin token de notificación')
      return new Response(JSON.stringify({ message: 'Proveedor sin token de notificación' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Obtener información del usuario que hizo la reserva
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('name, email')
      .eq('id', record.user_id)
      .single()

    if (userError) {
      console.log('Usuario no encontrado')
    }

    // Obtener los servicios de la cita
    const { data: services, error: servicesError } = await supabaseClient
      .from('appointment_selected_services')
      .select(`
        service_id,
        provider_services!inner(name, duration, price)
      `)
      .eq('appointment_id', record.id)

    if (servicesError) {
      console.log('Error al obtener servicios:', servicesError)
    }

    // Preparar el mensaje de notificación
    const serviceNames = services?.map(s => s.provider_services.name).join(', ') || 'servicios'
    const userName = user?.name || 'Un cliente'
    const appointmentDate = new Date(record.appointment_date).toLocaleDateString('es-ES')
    const appointmentTime = record.start_time.substring(0, 5)

    const notification = {
      title: 'Nueva Reserva Recibida',
      body: `${userName} ha reservado ${serviceNames} para el ${appointmentDate} a las ${appointmentTime}`,
      data: {
        appointmentId: record.id,
        type: 'new_appointment',
        appointmentDate: record.appointment_date,
        appointmentTime: record.start_time,
        userName: userName,
        services: serviceNames,
        totalPrice: record.total_price
      }
    }

    // Enviar notificación push usando Firebase Cloud Messaging (FCM) - API v1
    const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${Deno.env.get("FIREBASE_PROJECT_ID")}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("FCM_ACCESS_TOKEN")}`,
      },
      body: JSON.stringify({
        message: {
          token: provider.notification_token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: notification.data,
          android: {
            notification: {
              icon: '/logo_ico.png',
              sound: 'default',
              vibrate: [200, 100, 200],
            },
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: 'default',
              },
            },
          },
        },
      }),
    })

    const fcmResult = await fcmResponse.json()

    if (!fcmResponse.ok) {
      console.error('Error al enviar notificación FCM:', fcmResult)
      throw new Error('Error al enviar notificación')
    }

    console.log('Notificación enviada exitosamente:', fcmResult)

    // Opcional: Guardar registro de notificación enviada
    const { error: logError } = await supabaseClient
      .from('notification_logs')
      .insert({
        provider_id: record.provider_id,
        appointment_id: record.id,
        notification_type: 'new_appointment',
        status: 'sent',
        response: fcmResult
      })

    if (logError) {
      console.log('Error al guardar log:', logError)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Notificación enviada exitosamente',
      fcmResult 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error en la función de notificaciones:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})