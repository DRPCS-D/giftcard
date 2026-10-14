import { ALTO_TARJETA, ANCHO_TARJETA } from '@/components/giftcards/TarjetaVisual'

const OPCIONES = { pixelRatio: 3, cacheBust: true } as const

function descargar(url: string, nombre: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function descargarPng(nodo: HTMLElement, codigo: string): Promise<void> {
  const { toPng } = await import('html-to-image')
  const url = await toPng(nodo, OPCIONES)
  descargar(url, `giftcard-${codigo}.png`)
}

export async function descargarPdf(nodo: HTMLElement, codigo: string): Promise<void> {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const png = await toPng(nodo, OPCIONES)
  // Hoja A4 horizontal con la tarjeta centrada arriba.
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const ancho = 200
  const alto = (ancho * ALTO_TARJETA) / ANCHO_TARJETA
  pdf.addImage(png, 'PNG', (297 - ancho) / 2, 20, ancho, alto)
  pdf.save(`giftcard-${codigo}.pdf`)
}

/**
 * Comparte la tarjeta como imagen con el menú nativo del celular (WhatsApp
 * incluido). Devuelve false si el navegador no puede compartir archivos y
 * hay que usar el enlace wa.me.
 */
export async function compartirImagen(nodo: HTMLElement, codigo: string, texto: string): Promise<boolean> {
  const { toBlob } = await import('html-to-image')
  const blob = await toBlob(nodo, OPCIONES)
  if (!blob) return false
  const archivo = new File([blob], `giftcard-${codigo}.png`, { type: 'image/png' })
  if (!navigator.canShare?.({ files: [archivo] })) return false
  try {
    await navigator.share({ files: [archivo], text: texto })
  } catch (e) {
    // Cerrar el menú de compartir no es un error.
    if (!(e instanceof DOMException && e.name === 'AbortError')) throw e
  }
  return true
}
