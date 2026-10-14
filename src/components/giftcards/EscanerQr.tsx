import { Camera, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { formatearCodigo, codigoValido } from '@/lib/giftcard'

/**
 * Escáner de QR con la cámara trasera. Decodifica con jsQR cuadro a cuadro
 * (no depende de BarcodeDetector, que no existe en iOS). Llama a `onCodigo`
 * una sola vez con un código PAT-XXXX-XXXX válido.
 */
export function EscanerQr({ onCodigo, onCerrar }: { onCodigo: (codigo: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    let stream: MediaStream | null = null
    let raf = 0
    let jsQR: typeof import('jsqr').default | null = null
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })

    function leer() {
      const v = video.current
      if (!activo || !v || !ctx || !jsQR) return
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
        lienzo.width = v.videoWidth
        lienzo.height = v.videoHeight
        ctx.drawImage(v, 0, 0)
        const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height)
        const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (r) {
          const codigo = formatearCodigo(r.data)
          if (codigoValido(codigo)) {
            activo = false
            onCodigo(codigo)
            return
          }
        }
      }
      raf = requestAnimationFrame(leer)
    }

    void import('jsqr').then((m) => {
      jsQR = m.default
    })

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!activo) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
        raf = requestAnimationFrame(leer)
      })
      .catch(() => setError('No se pudo usar la cámara. Revisa el permiso del navegador o escribe el código a mano.'))

    if (!navigator.mediaDevices) setError('Este navegador no permite usar la cámara. Escribe el código a mano.')

    return () => {
      activo = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCodigo])

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Camera className="size-4" /> Apuntá al QR de la tarjeta
        </p>
        <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar cámara">
          <X />
        </Button>
      </div>
      {error ? (
        <ErrorBox mensaje={error} />
      ) : (
        <div className="relative overflow-hidden rounded-md bg-black">
          <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/80" />
        </div>
      )}
    </div>
  )
}
