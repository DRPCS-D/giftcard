/** Utilidades puras del dominio gift card (códigos, montos, validación). */

export const PREFIJO_CODIGO = 'PAT'
export const MONTO_MINIMO = 1000
export const MONTO_PASO = 1000
export const MENSAJE_DEFECTO = 'Con cariño de:'

export const LIMITES = { comprador: 30, destinatario: 30, mensaje: 50, notas: 50 } as const

const RE_CODIGO = /^PAT-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/**
 * Da forma `PAT-XXXX-XXXX` a lo que se va tipeando o escaneando. Acepta el
 * código con o sin guiones y en cualquier caja; ignora todo lo que no sea
 * letra o número.
 */
export function formatearCodigo(entrada: string): string {
  let limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (limpio.startsWith(PREFIJO_CODIGO)) limpio = limpio.slice(PREFIJO_CODIGO.length)
  limpio = limpio.slice(0, 8)
  if (limpio === '') return ''
  const a = limpio.slice(0, 4)
  const b = limpio.slice(4)
  if (b) return `${PREFIJO_CODIGO}-${a}-${b}`
  return a.length === 4 ? `${PREFIJO_CODIGO}-${a}-` : `${PREFIJO_CODIGO}-${a}`
}

export function codigoValido(codigo: string): boolean {
  return RE_CODIGO.test(codigo)
}

/** 150000 → "150.000 Gs" (separador de miles de es-PY). */
export function formatoGs(monto: number): string {
  return `${new Intl.NumberFormat('es-PY').format(Math.round(monto))} Gs`
}

/** 'yyyy-MM-dd' de hoy en hora local (para el `min` del input date). */
export function hoyISO(): string {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/** 'yyyy-MM-dd' → 'dd/mm/yyyy'. */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}

/** 'yyyy-MM-dd HH:mm' → 'dd/mm/yyyy HH:mm'. */
export function fechaHoraCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : fechaCorta(iso)
}

export interface DatosGiftCard {
  comprador: string
  destinatario: string
  mensaje: string
  email: string
  telefono: string
  monto: string
  fechaVencimiento: string
  notas: string
}

export const FORM_VACIO: DatosGiftCard = {
  comprador: '',
  destinatario: '',
  mensaje: MENSAJE_DEFECTO,
  email: '',
  telefono: '',
  monto: '',
  fechaVencimiento: '',
  notas: '',
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Mensaje del primer problema del formulario, o null si está todo bien. */
export function validarGiftCard(d: DatosGiftCard): string | null {
  if (!d.comprador.trim()) return 'Falta el nombre del comprador.'
  if (!d.destinatario.trim()) return 'Falta el nombre del destinatario.'
  if (d.email.trim() && !RE_EMAIL.test(d.email.trim())) return 'El email no es válido.'
  const monto = Number(d.monto)
  if (!Number.isInteger(monto) || monto < MONTO_MINIMO) return `El monto mínimo es ${formatoGs(MONTO_MINIMO)}.`
  if (!d.fechaVencimiento) return 'Falta la fecha de vencimiento.'
  if (d.fechaVencimiento < hoyISO()) return 'La fecha de vencimiento no puede ser anterior a hoy.'
  return null
}

/** Teléfono para wa.me: solo dígitos; un 09xx paraguayo pasa a 5959xx. */
export function telefonoWhatsApp(telefono: string): string {
  const d = telefono.replace(/\D/g, '')
  if (d.startsWith('0')) return `595${d.slice(1)}`
  return d
}

export function textoCompartir(g: {
  destinatario: string
  comprador: string
  monto: number
  codigo: string
  fechaVencimiento: string
}): string {
  return [
    `🎁 ¡${g.destinatario}, ${g.comprador} te regaló una Gift Card Patachoca!`,
    `Valor: ${formatoGs(g.monto)}`,
    `Código: ${g.codigo}`,
    `Válida hasta el ${fechaCorta(g.fechaVencimiento)}.`,
    'Canjeala en cualquier sucursal Patachoca.',
  ].join('\n')
}
