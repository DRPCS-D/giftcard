import { CheckCircle2, Loader2, ScanLine, Search, XCircle } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { BadgeEstado } from '@/components/giftcards/badges'
import { EscanerQr } from '@/components/giftcards/EscanerQr'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { canjearGiftCard, verificarGiftCard } from '@/hooks/useGiftCards'
import { codigoValido, fechaCorta, fechaHoraCorta, formatearCodigo, formatoGs } from '@/lib/giftcard'
import { sincronizar } from '@/lib/tablas'
import type { ResultadoVerificacion } from '@/lib/tipos'

const MENSAJE_ESTADO = {
  USADA: 'Esta gift card ya fue canjeada.',
  VENCIDA: 'Esta gift card está vencida.',
  ANULADA: 'Esta gift card fue anulada.',
} as const

export default function Canjear() {
  const [codigo, setCodigo] = useState('')
  const [camara, setCamara] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<ResultadoVerificacion | null>(null)
  const [canjeando, setCanjeando] = useState(false)
  const [canjeada, setCanjeada] = useState(false)

  const consultar = useCallback(async (cod: string) => {
    setBuscando(true)
    setError(null)
    setRes(null)
    setCanjeada(false)
    const { error: err, resultado } = await verificarGiftCard(cod)
    setBuscando(false)
    if (err) setError(err)
    else setRes(resultado)
  }, [])

  const alEscanear = useCallback(
    (cod: string) => {
      setCamara(false)
      setCodigo(cod)
      void consultar(cod)
    },
    [consultar],
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!codigoValido(codigo)) {
      setError('El código debe tener el formato PAT-XXXX-XXXX.')
      return
    }
    void consultar(codigo)
  }

  async function confirmar() {
    if (!res?.codigo || canjeando) return
    setCanjeando(true)
    const { error: err } = await canjearGiftCard(res.codigo)
    setCanjeando(false)
    if (err) {
      toast.error(err)
      void consultar(res.codigo) // el estado real puede haber cambiado
      return
    }
    setCanjeada(true)
    setRes({ ...res, estado: 'USADA' })
    void sincronizar()
  }

  function nueva() {
    setCodigo('')
    setRes(null)
    setError(null)
    setCanjeada(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Canjear gift card</h1>
        <p className="text-sm text-muted-foreground">Escaneá el QR o escribí el código de la tarjeta.</p>
      </div>

      {camara ? (
        <EscanerQr onCodigo={alEscanear} onCerrar={() => setCamara(false)} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-xs">
          <Field label="Código">
            <Input
              value={codigo}
              onChange={(e) => {
                setCodigo(formatearCodigo(e.target.value))
                setRes(null)
                setError(null)
                setCanjeada(false)
              }}
              placeholder="PAT-XXXX-XXXX"
              maxLength={13}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-lg tracking-widest"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={buscando || !codigoValido(codigo)}>
              {buscando ? <Loader2 className="animate-spin" /> : <Search />} Consultar
            </Button>
            <Button type="button" variant="outline" onClick={() => setCamara(true)}>
              <ScanLine /> Escanear QR
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {res && !res.encontrada && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Código no encontrado</p>
            <p className="text-sm text-muted-foreground">Verificá que esté bien escrito.</p>
          </div>
        </div>
      )}

      {res?.encontrada && res.estado && (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="tabular font-mono text-sm font-medium">{res.codigo}</span>
            <BadgeEstado estado={res.estado} />
          </div>

          <p className="font-display text-3xl font-bold text-foreground">{formatoGs(res.monto ?? 0)}</p>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Para</dt>
              <dd className="text-foreground">{res.destinatario}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">De</dt>
              <dd className="text-foreground">{res.comprador}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Válida hasta</dt>
              <dd className="text-foreground">{fechaCorta(res.fechaVencimiento)}</dd>
            </div>
          </dl>

          {canjeada ? (
            <div className="flex items-center gap-2 rounded-md bg-success/12 px-3 py-3 text-success">
              <CheckCircle2 className="size-5" />
              <span className="font-medium">¡Canjeada con éxito!</span>
            </div>
          ) : res.estado === 'ACTIVA' ? (
            <Button size="lg" className="w-full" onClick={confirmar} disabled={canjeando}>
              {canjeando ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirmar canje de {formatoGs(res.monto ?? 0)}
            </Button>
          ) : (
            <div className="rounded-md bg-secondary px-3 py-3 text-sm text-secondary-foreground">
              <p className="font-medium">{MENSAJE_ESTADO[res.estado]}</p>
              {res.estado === 'USADA' && (
                <p className="text-xs text-muted-foreground">
                  {fechaHoraCorta(res.fechaUso)} · {res.canjeadoPor}
                  {res.sucursalCanje ? ` · ${res.sucursalCanje}` : ''}
                </p>
              )}
            </div>
          )}

          {(canjeada || res.estado !== 'ACTIVA') && (
            <Button variant="outline" className="w-full" onClick={nueva}>
              Canjear otra
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
