import { callApi, conCredenciales } from './appsScript'

/** Ejecuta una acción de escritura y devuelve `{ error }` en vez de lanzar. */
export async function ejecutar(
  accion: string,
  payload: Record<string, unknown>,
  mensajeError: string,
): Promise<{ error: string | null }> {
  try {
    await callApi(accion, conCredenciales(payload))
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : mensajeError }
  }
}
