import { Download, FileText, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { reenviarEmailGiftCard } from '@/hooks/useGiftCards'
import { descargarPdf, descargarPng, compartirImagen } from '@/lib/exportar'
import { telefonoWhatsApp, textoCompartir } from '@/lib/giftcard'
import type { GiftCard } from '@/lib/tipos'
import { TarjetaVisual } from './TarjetaVisual'

/** Vista de la tarjeta con sus acciones: PNG, PDF, compartir por WhatsApp y reenviar el email. */
export function TarjetaAcciones({ gc, puedeReenviar }: { gc: GiftCard; puedeReenviar: boolean }) {
  const nodo = useRef<HTMLDivElement>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function correr(clave: string, fn: () => Promise<void>) {
    if (!nodo.current || ocupado) return
    setOcupado(clave)
    try {
      await fn()
    } catch {
      toast.error('No se pudo generar la imagen. Intenta de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  const texto = textoCompartir(gc)

  async function compartir() {
    const el = nodo.current
    if (!el) return
    const hecho = await compartirImagen(el, gc.codigo, texto)
    if (!hecho) {
      const tel = telefonoWhatsApp(gc.telefono)
      const base = tel ? `https://wa.me/${tel}` : 'https://wa.me/'
      window.open(`${base}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <TarjetaVisual
          ref={nodo}
          datos={{
            codigo: gc.codigo,
            destinatario: gc.destinatario,
            comprador: gc.comprador,
            mensaje: gc.mensaje,
            monto: gc.monto,
            fechaVencimiento: gc.fechaVencimiento,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!!ocupado} onClick={() => correr('png', () => descargarPng(nodo.current!, gc.codigo))}>
          <Download /> PNG
        </Button>
        <Button variant="outline" size="sm" disabled={!!ocupado} onClick={() => correr('pdf', () => descargarPdf(nodo.current!, gc.codigo))}>
          <FileText /> PDF
        </Button>
        <Button variant="outline" size="sm" disabled={!!ocupado} onClick={() => correr('share', compartir)}>
          {typeof navigator.share === 'function' ? <Share2 /> : <MessageCircle />} Compartir por WhatsApp
        </Button>
        {puedeReenviar && gc.email && (
          <Button
            variant="outline"
            size="sm"
            disabled={!!ocupado}
            onClick={async () => {
              setOcupado('mail')
              const { error } = await reenviarEmailGiftCard(gc.id)
              setOcupado(null)
              if (error) toast.error(error)
              else toast.success(`Email reenviado a ${gc.email}.`)
            }}
          >
            <Mail /> Reenviar email
          </Button>
        )}
      </div>
    </div>
  )
}
