import { Badge, type TonoBadge } from '@/components/ui/badge'
import { ESTADO_LABEL, type EstadoGiftCard } from '@/lib/tipos'

export const TONO_ESTADO: Record<EstadoGiftCard, TonoBadge> = {
  ACTIVA: 'success',
  USADA: 'neutral',
  VENCIDA: 'warning',
  ANULADA: 'danger',
}

export function BadgeEstado({ estado }: { estado: EstadoGiftCard }) {
  return <Badge tono={TONO_ESTADO[estado]}>{ESTADO_LABEL[estado]}</Badge>
}
