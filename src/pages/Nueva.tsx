import { Gift, Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { TarjetaAcciones } from '@/components/giftcards/TarjetaAcciones'
import { useAuth } from '@/hooks/useAuth'
import { crearGiftCard } from '@/hooks/useGiftCards'
import { FORM_VACIO, LIMITES, MONTO_MINIMO, MONTO_PASO, hoyISO, validarGiftCard, type DatosGiftCard } from '@/lib/giftcard'
import { sincronizar } from '@/lib/tablas'
import type { GiftCard } from '@/lib/tipos'

export default function Nueva() {
  const { puedeGestionar } = useAuth()
  const navigate = useNavigate()
  const [datos, setDatos] = useState<DatosGiftCard>(FORM_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [creada, setCreada] = useState<GiftCard | null>(null)

  useEffect(() => {
    if (!puedeGestionar) navigate('/', { replace: true })
  }, [puedeGestionar, navigate])

  if (!puedeGestionar) return null

  const set = (campo: keyof DatosGiftCard) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    const problema = validarGiftCard(datos)
    if (problema) {
      setError(problema)
      return
    }
    setError(null)
    setEnviando(true)
    const r = await crearGiftCard(datos)
    setEnviando(false)
    if (r.error || !('codigo' in r) || !r.codigo) {
      setError(r.error ?? 'No se pudo crear la gift card.')
      return
    }
    void sincronizar()
    if (datos.email.trim()) {
      if (r.emailEnviado) toast.success(`Gift card creada y enviada a ${datos.email.trim()}.`)
      else toast.warning(`Gift card creada, pero el email no salió: ${r.emailError ?? 'error desconocido'}. Podés reenviarlo desde Tarjetas.`)
    } else {
      toast.success('Gift card creada.')
    }
    setCreada({
      id: r.id,
      codigo: r.codigo,
      comprador: datos.comprador.trim(),
      destinatario: datos.destinatario.trim(),
      email: datos.email.trim(),
      telefono: datos.telefono.trim(),
      monto: Number(datos.monto),
      mensaje: datos.mensaje.trim(),
      notas: datos.notas.trim(),
      fechaEmision: hoyISO(),
      fechaVencimiento: datos.fechaVencimiento,
      estado: 'ACTIVA',
      fechaUso: '',
      canjeadoPor: '',
      sucursalCanje: '',
      creadoPor: '',
      sucursalId: '',
      fechaAnulacion: '',
      anuladoPor: '',
      motivoAnulacion: '',
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Nueva gift card</h1>
        <p className="text-sm text-muted-foreground">Se genera el código y, si cargás un email, se envía al instante.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Comprador *">
            <Input value={datos.comprador} onChange={set('comprador')} maxLength={LIMITES.comprador} required autoFocus />
          </Field>
          <Field label="Destinatario *">
            <Input value={datos.destinatario} onChange={set('destinatario')} maxLength={LIMITES.destinatario} required />
          </Field>
        </div>

        <Field label="Mensaje" hint="Aparece antes del nombre del comprador.">
          <Input value={datos.mensaje} onChange={set('mensaje')} maxLength={LIMITES.mensaje} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email del destinatario" hint="Opcional. Si se carga, se envía la tarjeta.">
            <Input type="email" value={datos.email} onChange={set('email')} autoComplete="off" />
          </Field>
          <Field label="WhatsApp del destinatario" hint="Opcional. Para compartir la tarjeta.">
            <Input type="tel" value={datos.telefono} onChange={set('telefono')} placeholder="0981 123 456" autoComplete="off" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto (Gs) *">
            <Input
              type="number"
              inputMode="numeric"
              min={MONTO_MINIMO}
              step={MONTO_PASO}
              value={datos.monto}
              onChange={set('monto')}
              required
            />
          </Field>
          <Field label="Válida hasta *">
            <Input type="date" min={hoyISO()} value={datos.fechaVencimiento} onChange={set('fechaVencimiento')} required />
          </Field>
        </div>

        <Field label="Notas internas" hint="Solo las ve el personal; no se imprimen en la tarjeta.">
          <Textarea value={datos.notas} onChange={set('notas')} maxLength={LIMITES.notas} rows={2} />
        </Field>

        {error && <ErrorBox mensaje={error} />}

        <Button type="submit" size="lg" className="w-full" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="animate-spin" /> Creando…
            </>
          ) : (
            <>
              <Gift /> Crear gift card
            </>
          )}
        </Button>
      </form>

      <Modal
        abierto={creada !== null}
        titulo="Gift card creada"
        descripcion={creada ? `Código ${creada.codigo}` : undefined}
        ancho="max-w-3xl"
        onCerrar={() => {
          setCreada(null)
          setDatos(FORM_VACIO)
        }}
      >
        {creada && <TarjetaAcciones gc={creada} puedeReenviar={false} />}
      </Modal>
    </div>
  )
}
