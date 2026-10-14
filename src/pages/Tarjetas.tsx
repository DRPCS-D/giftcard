import { Ban, Download, Gift, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BadgeEstado } from '@/components/giftcards/badges'
import { TarjetaAcciones } from '@/components/giftcards/TarjetaAcciones'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { anularGiftCard, useGiftCards } from '@/hooks/useGiftCards'
import { useSucursales } from '@/hooks/useSucursales'
import { normalizar } from '@/lib/format'
import { fechaCorta, fechaHoraCorta, formatoGs } from '@/lib/giftcard'
import { exportarCsv } from '@/lib/csv'
import { ESTADOS_GIFTCARD, ESTADO_LABEL, type EstadoGiftCard, type GiftCard } from '@/lib/tipos'

export default function Tarjetas() {
  const { puedeGestionar, esAdmin, sucursales: misSucursales } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useGiftCards(puedeGestionar)
  const { nombres: nombreSucursal } = useSucursales()

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoGiftCard | ''>('')
  const [detalle, setDetalle] = useState<GiftCard | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!puedeGestionar) navigate('/', { replace: true })
  }, [puedeGestionar, navigate])

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    return data.filter((g) => {
      if (estado && g.estado !== estado) return false
      if (!q) return true
      return normalizar([g.codigo, g.comprador, g.destinatario, g.email, nombreSucursal.get(g.sucursalId) ?? ''].join(' ')).includes(q)
    })
  }, [data, busqueda, estado, nombreSucursal])

  const conteo = useMemo(() => {
    const c: Record<EstadoGiftCard, number> = { ACTIVA: 0, USADA: 0, VENCIDA: 0, ANULADA: 0 }
    for (const g of data) c[g.estado]++
    return c
  }, [data])

  if (!puedeGestionar) return null

  // El detalle se relee de la lista para reflejar cambios (anulación) al instante.
  const actual = detalle ? (data.find((g) => g.id === detalle.id) ?? detalle) : null
  // El gerente ve todas, pero solo opera (anular/reenviar) sobre las de su sucursal.
  const puedeOperar = actual !== null && (esAdmin || misSucursales.includes(actual.sucursalId))

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tarjetas</h1>
          <p className="text-sm text-muted-foreground">
            {data.length} en total · {conteo.ACTIVA} activas · {conteo.USADA} usadas · {conteo.VENCIDA} vencidas · {conteo.ANULADA} anuladas
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={filtradas.length === 0} onClick={() => exportarCsv(filtradas, nombreSucursal)}>
          <Download /> Exportar CSV
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código, nombre, email…" className="pl-9" />
        </div>
        <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoGiftCard | '')} className="w-40">
          <option value="">Todos los estados</option>
          {ESTADOS_GIFTCARD.map((s) => (
            <option key={s} value={s}>
              {ESTADO_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <TableSkeleton columnas={[16, 20, 18, 14, 12, 12, 8]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : filtradas.length === 0 ? (
        <Vacio icono={Gift} titulo={data.length === 0 ? 'Todavía no hay gift cards' : 'Sin resultados'} descripcion={data.length === 0 ? 'Creá la primera desde «Nueva».' : 'Probá con otra búsqueda o filtro.'} />
      ) : (
        <TablaScroll total={filtradas.length} clave={`${busqueda}|${estado}`}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Destinatario</th>
                  <th className="px-4 py-2.5 font-medium">Comprador</th>
                  <th className="px-4 py-2.5 font-medium">Sucursal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                  <th className="px-4 py-2.5 font-medium">Vence</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, limite).map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setDetalle(g)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetalle(g)
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="tabular px-4 py-2.5 font-mono text-xs font-medium text-foreground">{g.codigo}</td>
                    <td className="px-4 py-2.5 text-foreground">{g.destinatario}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{g.comprador}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{nombreSucursal.get(g.sucursalId) ?? '—'}</td>
                    <td className="tabular px-4 py-2.5 text-right text-foreground">{formatoGs(g.monto)}</td>
                    <td className="tabular px-4 py-2.5 text-muted-foreground">{fechaCorta(g.fechaVencimiento)}</td>
                    <td className="px-4 py-2.5">
                      <BadgeEstado estado={g.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <Modal
        abierto={actual !== null}
        titulo="Gift card"
        descripcion={actual?.codigo}
        ancho="max-w-3xl"
        onCerrar={() => {
          setDetalle(null)
          setAnulando(false)
          setMotivo('')
        }}
      >
        {actual && (
          <div className="space-y-5">
            <TarjetaAcciones gc={actual} puedeReenviar={puedeOperar} />

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Dato k="Estado" v={<BadgeEstado estado={actual.estado} />} />
              <Dato k="Sucursal emisora" v={nombreSucursal.get(actual.sucursalId) ?? '—'} />
              <Dato k="Emitida" v={`${fechaCorta(actual.fechaEmision)} por ${actual.creadoPor || '—'}`} />
              <Dato k="Email" v={actual.email || '—'} />
              <Dato k="WhatsApp" v={actual.telefono || '—'} />
              {actual.notas && <Dato k="Notas" v={actual.notas} />}
              {actual.estado === 'USADA' && (
                <Dato k="Canjeada" v={`${fechaHoraCorta(actual.fechaUso)} por ${actual.canjeadoPor} (${actual.sucursalCanje || '—'})`} />
              )}
              {actual.estado === 'ANULADA' && (
                <Dato k="Anulada" v={`${fechaHoraCorta(actual.fechaAnulacion)} por ${actual.anuladoPor}${actual.motivoAnulacion ? ` — ${actual.motivoAnulacion}` : ''}`} />
              )}
            </dl>

            {actual.estado === 'ACTIVA' &&
              puedeOperar &&
              (anulando ? (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <Field label="Motivo de la anulación">
                    <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={100} rows={2} />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAnulando(false)} disabled={procesando}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={procesando}
                      onClick={async () => {
                        setProcesando(true)
                        const { error: err } = await anularGiftCard(actual.id, motivo)
                        setProcesando(false)
                        if (err) toast.error(err)
                        else {
                          toast.success('Gift card anulada.')
                          setAnulando(false)
                          setMotivo('')
                          refetch()
                        }
                      }}
                    >
                      Confirmar anulación
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setAnulando(true)}>
                  <Ban /> Anular tarjeta
                </Button>
              ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}
