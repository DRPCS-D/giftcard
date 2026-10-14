import { fechaCorta, fechaHoraCorta } from './giftcard'
import type { GiftCard } from './tipos'

/** Escapa una celda; además neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
function celda(valor: string | number): string {
  let t = String(valor ?? '')
  if (/^[=+\-@]/.test(t)) t = `'${t}`
  return `"${t.replace(/"/g, '""')}"`
}

export function exportarCsv(filas: GiftCard[], sucursales: Map<string, string>): void {
  const cab = ['Código', 'Comprador', 'Destinatario', 'Email', 'Teléfono', 'Monto (Gs)', 'Emisión', 'Vencimiento', 'Estado', 'Sucursal', 'Creado por', 'Fecha uso', 'Canjeado por', 'Sucursal canje']
  const lineas = filas.map((g) =>
    [
      g.codigo,
      g.comprador,
      g.destinatario,
      g.email,
      g.telefono,
      g.monto,
      fechaCorta(g.fechaEmision),
      fechaCorta(g.fechaVencimiento),
      g.estado,
      sucursales.get(g.sucursalId) ?? '',
      g.creadoPor,
      g.fechaUso ? fechaHoraCorta(g.fechaUso) : '',
      g.canjeadoPor,
      g.sucursalCanje,
    ]
      .map(celda)
      .join(';'),
  )
  const csv = '﻿' + [cab.map(celda).join(';'), ...lineas].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `giftcards-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
