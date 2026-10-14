import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { DatosSucursal } from '@/hooks/useSucursales'
import type { Sucursal } from '@/lib/tipos'

export function SucursalFormModal({
  abierto,
  sucursal,
  onCerrar,
  onGuardado,
  onBorrar,
  crear,
  editar,
}: {
  abierto: boolean
  /** null = crear, con valor = editar */
  sucursal: Sucursal | null
  onCerrar: () => void
  onGuardado: () => void
  onBorrar: () => void
  crear: (datos: DatosSucursal) => Promise<{ error: string | null }>
  editar: (id: string, datos: DatosSucursal) => Promise<{ error: string | null }>
}) {
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(sucursal?.nombre ?? '')
    setDireccion(sucursal?.direccion ?? '')
    setActivo(sucursal?.activo ?? true)
    setError(null)
  }, [abierto, sucursal])

  async function onGuardar() {
    const n = nombre.trim()
    if (!n) return setError('El nombre es obligatorio.')
    setGuardando(true)
    setError(null)
    const datos: DatosSucursal = { nombre: n, direccion: direccion.trim(), activo }
    const { error: err } = sucursal ? await editar(sucursal.id, datos) : await crear(datos)
    setGuardando(false)
    if (err) return setError(err)
    toast.success(sucursal ? 'Sucursal actualizada.' : 'Sucursal creada.')
    onGuardado()
  }

  return (
    <Modal
      abierto={abierto}
      titulo={sucursal ? 'Editar sucursal' : 'Nueva sucursal'}
      onCerrar={onCerrar}
      footer={
        <>
          {sucursal && (
            <Button variant="outline" onClick={onBorrar} disabled={guardando}>
              <Trash2 className="text-destructive" /> Borrar
            </Button>
          )}
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : sucursal ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre *">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <Field label="Dirección">
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={150} />
        </Field>
        {sucursal && (
          <Field label="Estado" hint="Una sucursal inactiva no admite gift cards nuevas.">
            <Select value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')}>
              <option value="1">Activa</option>
              <option value="0">Inactiva</option>
            </Select>
          </Field>
        )}
        {error && <ErrorBox mensaje={error} />}
      </div>
    </Modal>
  )
}
