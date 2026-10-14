import QRCode from 'qrcode'
import { forwardRef, useEffect, useState } from 'react'
import { fechaCorta, formatoGs } from '@/lib/giftcard'

export interface DatosTarjeta {
  codigo: string
  destinatario: string
  comprador: string
  mensaje: string
  monto: number
  fechaVencimiento: string
  notas?: string
}

/** QR del código generado en el navegador (sin servicios externos). */
export function useQr(codigo: string): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(codigo, { margin: 1, width: 300, errorCorrectionLevel: 'M' })
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(''))
    return () => {
      vivo = false
    }
  }, [codigo])
  return url
}

export const ANCHO_TARJETA = 640
export const ALTO_TARJETA = 360

/**
 * Diseño de la tarjeta. Usa estilos en línea y tamaño fijo para que la
 * exportación a PNG/PDF salga igual en cualquier pantalla.
 */
export const TarjetaVisual = forwardRef<HTMLDivElement, { datos: DatosTarjeta }>(function TarjetaVisual(
  { datos },
  ref,
) {
  const qr = useQr(datos.codigo)
  return (
    <div
      ref={ref}
      style={{
        width: ANCHO_TARJETA,
        height: ALTO_TARJETA,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        color: '#fff',
        fontFamily: 'Rubik, system-ui, sans-serif',
        background: 'linear-gradient(135deg, #0093D7 0%, #0a6fa8 60%, #221F32 130%)',
        boxSizing: 'border-box',
        padding: 28,
      }}
    >
      <div style={{ position: 'absolute', right: -70, top: -70, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', left: -50, bottom: -90, width: 220, height: 220, borderRadius: '50%', background: 'rgba(219,29,115,0.22)' }} />
      <div style={{ position: 'absolute', right: 150, bottom: -60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(237,166,51,0.22)' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/logo-blanco.png" alt="Patachoca" style={{ height: 24, width: 'auto' }} />
        <span
          style={{
            fontFamily: 'Poppins, Rubik, sans-serif',
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.18)',
            padding: '5px 12px',
            borderRadius: 999,
          }}
        >
          Gift Card
        </span>
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Para</div>
          <div style={{ fontFamily: 'Poppins, Rubik, sans-serif', fontWeight: 600, fontSize: 24, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
            {datos.destinatario}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9, overflowWrap: 'anywhere' }}>
            {datos.mensaje} <strong>{datos.comprador}</strong>
          </div>
          <div style={{ marginTop: 18, fontFamily: 'Poppins, Rubik, sans-serif', fontWeight: 700, fontSize: 44, lineHeight: 1 }}>
            {formatoGs(datos.monto)}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 8, width: 130, height: 130, boxSizing: 'border-box' }}>
            {qr && <img src={qr} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          bottom: 22,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>Código</div>
          <div style={{ fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>{datos.codigo}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <div style={{ opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>Válida hasta</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{fechaCorta(datos.fechaVencimiento)}</div>
          <div style={{ opacity: 0.75, marginTop: 2 }}>Personal e intransferible</div>
        </div>
      </div>
    </div>
  )
})
