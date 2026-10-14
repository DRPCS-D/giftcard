import { callApi, conCredenciales } from '@/lib/appsScript'
import { ejecutar } from '@/lib/ejecutar'
import type { DatosGiftCard } from '@/lib/giftcard'
import { TABLAS } from '@/lib/tablas'
import type { GiftCard, ResultadoVerificacion } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Lista de gift cards (solo admin y gerente; el cajero no la usa). */
export function useGiftCards(activo = true) {
  return useTabla<GiftCard>(TABLAS.giftcards, {}, activo)
}

export async function crearGiftCard(datos: DatosGiftCard) {
  try {
    const r = await callApi<{ codigo: string; id: string; emailEnviado: boolean; emailError?: string }>(
      'crearGiftCard',
      conCredenciales({ ...datos, monto: Number(datos.monto) }),
    )
    return { error: null, ...r }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear la gift card.' }
  }
}

export const anularGiftCard = (id: string, motivo: string) =>
  ejecutar('anularGiftCard', { id, motivo }, 'No se pudo anular la gift card.')

export const reenviarEmailGiftCard = (id: string) =>
  ejecutar('reenviarEmail', { id }, 'No se pudo reenviar el email.')

export async function verificarGiftCard(codigo: string) {
  try {
    const r = await callApi<ResultadoVerificacion>('verificarGiftCard', conCredenciales({ codigo }))
    return { error: null, resultado: r }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo consultar el código.', resultado: null }
  }
}

export const canjearGiftCard = (codigo: string) =>
  ejecutar('canjearGiftCard', { codigo }, 'No se pudo canjear la gift card.')
