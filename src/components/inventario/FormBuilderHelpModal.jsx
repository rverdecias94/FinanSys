/* eslint-disable react/prop-types */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  HelpCircle,
  Lightbulb,
  ListOrdered,
  MessageCircleQuestion,
  ChevronDown,
  Type,
  Hash,
  List,
  Calendar,
  ToggleLeft,
  AlignLeft,
  Palette
} from 'lucide-react'

const STEPS = [
  {
    n: 1,
    title: 'Piensa en una cosa que quieres saber',
    body: 'Como cuando anotas en un cuaderno: “¿Cómo se llama?”, “¿Cuántos hay?”, “¿De qué color es?”. Esa es tu pregunta.'
  },
  {
    n: 2,
    title: 'Escríbela en “Nombre de la pregunta”',
    body: 'Pon palabras sencillas. Ejemplos buenos: Nombre, Cantidad, Marca, Ubicación. No hace falta código ni números raros.'
  },
  {
    n: 3,
    title: 'Elige cómo se responde',
    body: 'Toca la opción que mejor encaja. Si es un nombre → Texto corto. Si es “cuántos” → Cantidad o número. Si son elementos que se pueden elegir de una lista → Elegir de una lista.'
  },
  {
    n: 4,
    title: 'Decide si es obligatorio',
    body: 'Si marcas “Hay que llenarlo sí o sí”, nadie podrá guardar el artículo sin esa respuesta. Si no lo marcas, se puede dejar vacío.'
  },
  {
    n: 5,
    title: 'Pulsa “Agregar pregunta”',
    body: 'La pregunta se guarda arriba en “Tus preguntas”. Cuando vayas a Registrar, verás exactamente esas mismas preguntas.'
  }
]

const ANSWER_TYPES = [
  { Icon: Type, label: 'Texto corto', when: 'Para nombres, marcas o lugares.' },
  { Icon: Hash, label: 'Cantidad o número', when: 'Para contar: 3, 12, 100…' },
  { Icon: List, label: 'Elegir de una lista', when: 'Cuando solo hay pocas opciones (Nuevo / Usado).' },
  { Icon: Calendar, label: 'Fecha', when: 'Para días: compra, vencimiento…' },
  { Icon: ToggleLeft, label: 'Sí o no', when: 'Para una casilla simple: ¿Está listo?' },
  { Icon: AlignLeft, label: 'Notas largas', when: 'Para escribir mucho: observaciones.' },
  { Icon: Palette, label: 'Color', when: 'Para pintar un colorito que lo identifique.' }
]

const FAQS = [
  {
    q: '¿Qué es una “pregunta”?',
    a: 'Es un dato que quieres guardar de cada cosa. Como una fila en tu libreta. Ejemplo: “Nombre” o “Cantidad”.'
  },
  {
    q: '¿Esto es lo mismo que Almacén?',
    a: 'No. Almacén es para productos con stock y precios. Inventario (esta pantalla) es una libreta a tu medida: tú decides qué anotar.'
  },
  {
    q: '¿Tengo que agregar muchas preguntas?',
    a: 'No. Con 2 basta para empezar (Nombre y Cantidad). Luego puedes agregar más cuando quieras.'
  },
  {
    q: 'No sé qué tipo elegir. ¿Qué hago?',
    a: 'Si es palabras → Texto corto. Si es números → Cantidad o número. Si dudas, empieza con Texto corto: siempre funciona.'
  },
  {
    q: '¿Qué es “Elegir de una lista”?',
    a: 'En vez de escribir a mano, eliges un botón de una lista que tú armas. Ejemplo: Chico, Mediano, Grande. Separan las opciones con comas.'
  },
  {
    q: '¿Qué significa “Hay que llenarlo sí o sí”?',
    a: 'Que esa pregunta no se puede saltar. Úsalo para lo importante (como el nombre). Déjalo sin marcar para cosas opcionales (como notas).'
  },
  {
    q: '¿Puedo cambiar el orden de las preguntas?',
    a: 'Sí. Arrastra con el icono de puntitos o usa las flechitas ↑ ↓. El orden de arriba es el que verás al registrar.'
  },
  {
    q: '¿Puedo borrar una pregunta?',
    a: 'Sí, con el botón rojo de la basura. Los artículos que ya guardaste no se borran; solo deja de pedirse esa pregunta.'
  },
  {
    q: '¿Puedo renombrar una pregunta?',
    a: 'Sí. Toca el nombre, cámbialo y sal del cuadro (o pulsa fuera). Se actualiza solo.'
  },
  {
    q: '¿Para qué sirven los modelos de “Empieza en un toque”?',
    a: 'Son atajos. Un clic y ya tienes preguntas listas (por ejemplo Nombre + Cantidad). Luego las puedes editar.'
  },
  {
    q: 'Ya armé mi lista. ¿Qué sigue?',
    a: 'Pulsa “Listo — empezar a registrar” o la pestaña Registrar. Ahí llenas las preguntas y guardas cada artículo.'
  },
  {
    q: 'Me equivoqué al crear el área. ¿Pasa algo?',
    a: 'Puedes editar el nombre del área con el lápiz, o borrar el área si todavía no la necesitas. Las preguntas se configuran después, aquí.'
  },
  {
    q: '¿Mis datos se comparten con otros negocios?',
    a: 'No. Todo lo que anotas es de tu negocio. Solo lo ven tú y las personas de tu equipo (si tienes plan con equipo).'
  },
  {
    q: '¿Se puede romper algo si experimento?',
    a: 'Tranquilo: puedes agregar, quitar y reordenar preguntas. Si borras una pregunta, solo deja de pedirse; no borra tu negocio entero.'
  }
]

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-expanded={open}
      >
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{item.q}</span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-3 pl-6 text-sm text-muted-foreground leading-relaxed">
          {item.a}
        </p>
      )}
    </div>
  )
}

export function FormBuilderHelpModal({ open, onOpenChange }) {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Ayuda: armar tu lista
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Aquí te explicamos todo con palabras simples. Si te trabas, lee un paso y prueba: no se rompe nada.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 sm:px-6">
          {/* Idea clave */}
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">La idea en una frase</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tú decides las preguntas. Después, cada vez que registres un artículo, Gestia te las hace
                otra vez — como un formulario hecho a tu medida.
              </p>
            </div>
          </div>

          {/* Pasos */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListOrdered className="h-4 w-4 text-primary" />
              Pasos para agregar una pregunta
            </h3>
            <ol className="space-y-3">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {step.n}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Tipos */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">¿Cuál tarjeta de “cómo se responde” elijo?</h3>
            <ul className="space-y-2">
              {ANSWER_TYPES.map(({ Icon, label, when }) => (
                <li key={label} className="flex items-start gap-2.5 rounded-md border bg-card px-3 py-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="space-y-1">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Preguntas que casi todos hacen</h3>
            <div className="rounded-lg border px-3">
              {FAQS.map((item, i) => (
                <FaqItem
                  key={item.q}
                  item={item}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t px-5 py-3 sm:px-6">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Entendido, a practicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
