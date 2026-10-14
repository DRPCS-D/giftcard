import { Ban, CheckCircle2, Clock, Gift, List, PlusCircle, ScanLine } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useGiftCards } from '@/hooks/useGiftCards'
import { formatoGs } from '@/lib/giftcard'

function Tarjeta({ icono: Icono, titulo, valor, detalle }: { icono: typeof Gift; titulo: string; valor: string | number; detalle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icono className="size-4 text-primary" /> {titulo}
      </div>
      <p className="font-display text-2xl font-bold text-foreground">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  )
}

export default function Inicio() {
  const { nombre, puedeGestionar } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useGiftCards(puedeGestionar)

  const r = useMemo(() => {
    const por = { ACTIVA: 0, USADA: 0, VENCIDA: 0, ANULADA: 0 }
    let pendiente = 0
    let canjeado = 0
    for (const g of data) {
      por[g.estado]++
      if (g.estado === 'ACTIVA') pendiente += g.monto
      if (g.estado === 'USADA') canjeado += g.monto
    }
    return { por, pendiente, canjeado }
  }, [data])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Hola, {nombre}</h1>
        <p className="text-sm text-muted-foreground">Gift Cards Patachoca</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {puedeGestionar && (
          <>
            <Button onClick={() => navigate('/nueva')}>
                <PlusCircle /> Nueva gift card
              </Button>
            <Button variant="outline" onClick={() => navigate('/tarjetas')}>
                <List /> Ver tarjetas
              </Button>
          </>
        )}
        <Button variant={puedeGestionar ? 'outline' : 'primary'} size={puedeGestionar ? 'md' : 'lg'} onClick={() => navigate('/canjear')}>
            <ScanLine /> Canjear
          </Button>
      </div>

      {puedeGestionar && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tarjeta icono={Gift} titulo="Activas" valor={loading ? '…' : r.por.ACTIVA} detalle={loading ? undefined : `${formatoGs(r.pendiente)} sin canjear`} />
          <Tarjeta icono={CheckCircle2} titulo="Usadas" valor={loading ? '…' : r.por.USADA} detalle={loading ? undefined : `${formatoGs(r.canjeado)} canjeados`} />
          <Tarjeta icono={Clock} titulo="Vencidas" valor={loading ? '…' : r.por.VENCIDA} />
          <Tarjeta icono={Ban} titulo="Anuladas" valor={loading ? '…' : r.por.ANULADA} />
        </div>
      )}
    </div>
  )
}
