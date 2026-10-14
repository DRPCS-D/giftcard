import { callApi, conCredenciales } from '@/lib/appsScript'
import { TABLAS } from '@/lib/tablas'
import type { Rol, UsuarioApp } from '@/lib/tipos'
import { useTabla } from './useTabla'

/** Lista plana de usuarios del sistema: no hay `empresa_id`, es una sola compañía. */
export function useUsuarios() {
  const lista = useTabla<UsuarioApp>(TABLAS.usuarios)

  async function crear(payload: {
    usuario: string
    nombre: string
    password: string
    rol: Rol
    activo: boolean
    sucursales: string[]
  }) {
    try {
      await callApi(
        'createUsuario',
        conCredenciales({
          nuevoUsuario: payload.usuario,
          nombre: payload.nombre,
          nuevaPassword: payload.password,
          rol: payload.rol,
          activo: payload.activo,
          sucursales: payload.sucursales,
        }),
      )
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo crear el usuario.' }
    }
  }

  /** Actualiza rol/activo, y opcionalmente nombre y contraseña (si se pasan). Devuelve el nombre final. */
  async function editar(
    usuario: string,
    payload: { rol: Rol; activo: boolean; sucursales: string[]; nombre: string; nuevoUsuario?: string; nuevaPassword?: string },
  ) {
    try {
      const data = await callApi<{ usuario: string }>(
        'updateUsuario',
        conCredenciales({
          targetUsuario: usuario,
          nuevoUsuario: payload.nuevoUsuario || '',
          nombre: payload.nombre,
          rol: payload.rol,
          activo: payload.activo,
          sucursales: payload.sucursales,
          nuevaPassword: payload.nuevaPassword || '',
        }),
      )
      return { error: null, usuario: data.usuario }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo guardar el usuario.', usuario: null }
    }
  }

  async function eliminar(usuario: string) {
    try {
      await callApi('deleteUsuario', conCredenciales({ targetUsuario: usuario }))
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo borrar el usuario.' }
    }
  }

  return { ...lista, crear, editar, eliminar }
}
