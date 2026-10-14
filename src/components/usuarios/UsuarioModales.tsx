import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { useUsuarios } from '@/hooks/useUsuarios'
import { ROL_LABEL, type Rol, type Sucursal, type UsuarioApp } from '@/lib/tipos'

const ROLES: Rol[] = ['cajero', 'gerente', 'admin']

function SelectorDeRol({ valor, onCambiar }: { valor: Rol; onCambiar: (rol: Rol) => void }) {
  return (
    <Field label="Rol">
      <Select value={valor} onChange={(e) => onCambiar(e.target.value as Rol)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROL_LABEL[r]}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/** Gerente y cajero: una sola sucursal (select). Admin: no lleva sucursal. */
function SelectorDeSucursales({
  rol,
  sucursales,
  valor,
  onCambiar,
}: {
  rol: Rol
  sucursales: Sucursal[]
  valor: string[]
  onCambiar: (ids: string[]) => void
}) {
  if (rol === 'admin') return null

  // Las inactivas solo se muestran si ya estaban elegidas, para no perderlas al guardar.
  const opciones = sucursales.filter((s) => s.activo || valor.includes(s.id))

  return (
    <Field label="Sucursal *">
      <Select value={valor[0] ?? ''} onChange={(e) => onCambiar(e.target.value ? [e.target.value] : [])}>
        <option value="">Elegir sucursal…</option>
        {opciones.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/** Mensaje de validación de sucursales según el rol, o null si está bien. */
function errorSucursales(rol: Rol, ids: string[]): string | null {
  if (rol !== 'admin' && ids.length !== 1) return 'Elige la sucursal del usuario.'
  return null
}

/** Gerente y cajero tienen una sola sucursal: se conserva como mucho una. */
function sucursalesAlCambiarRol(rol: Rol, actuales: string[]): string[] {
  return rol !== 'admin' && actuales.length > 1 ? actuales.slice(0, 1) : actuales
}

export function NuevoUsuarioModal({
  abierto,
  sucursales,
  onCerrar,
  onCreado,
  crear,
}: {
  abierto: boolean
  sucursales: Sucursal[]
  onCerrar: () => void
  onCreado: () => void
  crear: ReturnType<typeof useUsuarios>['crear']
}) {
  const [usuario, setUsuario] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<Rol>('cajero')
  const [suc, setSuc] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setUsuario('')
      setNombreCompleto('')
      setPassword('')
      setRol('cajero')
      setSuc([])
      setError(null)
    }
  }, [abierto])

  async function onGuardar() {
    if (!usuario.trim() || !password) {
      setError('Completa todos los campos.')
      return
    }
    const errSuc = errorSucursales(rol, suc)
    if (errSuc) {
      setError(errSuc)
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await crear({
      usuario: usuario.trim(),
      nombre: nombreCompleto.trim(),
      password,
      rol,
      activo: true,
      sucursales: rol === 'admin' ? [] : suc,
    })
    setGuardando(false)
    if (err) setError(err)
    else {
      toast.success('Usuario creado')
      onCreado()
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Nuevo usuario"
      onCerrar={onCerrar}
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Usuario *" hint="No distingue mayúsculas/minúsculas.">
          <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <Field label="Nombre completo" hint="Se muestra en la app en lugar del usuario.">
          <Input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Contraseña inicial *">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <SelectorDeRol
          valor={rol}
          onCambiar={(r) => {
            setRol(r)
            setSuc(sucursalesAlCambiarRol(r, suc))
          }}
        />
        <SelectorDeSucursales rol={rol} sucursales={sucursales} valor={suc} onCambiar={setSuc} />
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}

export function EditarUsuarioModal({
  usuario,
  sucursales,
  puedeBorrar,
  onCerrar,
  onGuardado,
  onBorrar,
  editar,
}: {
  usuario: UsuarioApp | null
  sucursales: Sucursal[]
  /** false para el propio usuario logueado: no puede borrarse a sí mismo (lo rechaza también el backend). */
  puedeBorrar: boolean
  onCerrar: () => void
  /** Recibe el nombre final (puede haber cambiado si se renombró). */
  onGuardado: (nombreFinal: string) => void
  onBorrar: () => void
  editar: ReturnType<typeof useUsuarios>['editar']
}) {
  const [nombre, setNombre] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [rol, setRol] = useState<Rol>('cajero')
  const [suc, setSuc] = useState<string[]>([])
  const [activo, setActivo] = useState(true)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setNombre(usuario.usuario)
    setNombreCompleto(usuario.nombre)
    setRol(usuario.rol)
    setSuc(usuario.sucursales)
    setActivo(usuario.activo)
    setNuevaPassword('')
    setError(null)
  }, [usuario])

  async function onGuardar() {
    if (!usuario) return
    if (!nombre.trim()) {
      setError('El nombre de usuario es obligatorio.')
      return
    }
    const errSuc = errorSucursales(rol, suc)
    if (errSuc) {
      setError(errSuc)
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err, usuario: nombreFinal } = await editar(usuario.usuario, {
      rol,
      activo,
      sucursales: rol === 'admin' ? [] : suc,
      nombre: nombreCompleto.trim(),
      nuevoUsuario: nombre.trim(),
      nuevaPassword,
    })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Datos actualizados')
    onGuardado(nombreFinal ?? nombre.trim())
  }

  return (
    <Modal
      abierto={usuario !== null}
      titulo={`Editar — ${usuario?.usuario ?? ''}`}
      onCerrar={onCerrar}
      footer={
        <>
          {puedeBorrar && (
            <Button variant="outline" onClick={onBorrar} disabled={guardando}>
              <Trash2 className="text-destructive" /> Borrar
            </Button>
          )}
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Usuario" hint="No distingue mayúsculas/minúsculas.">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" autoFocus />
        </Field>
        <Field label="Nombre completo" hint="Se muestra en la app en lugar del usuario.">
          <Input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} maxLength={80} />
        </Field>
        <SelectorDeRol
          valor={rol}
          onCambiar={(r) => {
            setRol(r)
            setSuc(sucursalesAlCambiarRol(r, suc))
          }}
        />
        <SelectorDeSucursales rol={rol} sucursales={sucursales} valor={suc} onCambiar={setSuc} />
        <Field label="Estado">
          <Select value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </Select>
        </Field>
        <Field label="Nueva contraseña" hint="Dejar vacío para no cambiarla.">
          <Input
            type="password"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
