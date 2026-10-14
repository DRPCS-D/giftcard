import { Building2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SucursalFormModal } from '@/components/sucursales/SucursalFormModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorBox, Vacio } from '@/components/ui/estado'
import { ConfirmModal } from '@/components/ui/modal'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { TablaScroll } from '@/components/ui/tabla-scroll'
import { useAuth } from '@/hooks/useAuth'
import { useSucursales } from '@/hooks/useSucursales'
import type { Sucursal } from '@/lib/tipos'

export default function Sucursales() {
  const { esAdmin } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch, crear, editar, eliminar } = useSucursales()

  const [modalForm, setModalForm] = useState<'nueva' | Sucursal | null>(null)
  const [modalBorrar, setModalBorrar] = useState<Sucursal | null>(null)
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    if (!esAdmin) navigate('/', { replace: true })
  }, [esAdmin, navigate])

  if (!esAdmin) return null

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sucursales</h1>
          <p className="text-sm text-muted-foreground">Sucursales donde se emiten y canjean gift cards.</p>
        </div>
        <Button onClick={() => setModalForm('nueva')}>
          <Plus /> Nueva
        </Button>
      </div>

      {loading ? (
        <TableSkeleton columnas={[30, 45, 15]} />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : data.length === 0 ? (
        <Vacio icono={Building2} titulo="Sin sucursales todavía" descripcion="Crea una para poder asignar usuarios." />
      ) : (
        <TablaScroll total={data.length} clave={''}>
          {(limite) => (
            <>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Nombre</th>
                  <th className="px-4 py-2.5 font-medium">Dirección</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, limite).map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setModalForm(s)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setModalForm(s)
                      }
                    }}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{s.nombre}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.direccion || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge tono={s.activo ? 'success' : 'neutral'}>{s.activo ? 'Activa' : 'Inactiva'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </TablaScroll>
      )}

      <SucursalFormModal
        abierto={modalForm !== null}
        sucursal={modalForm === 'nueva' ? null : modalForm}
        onCerrar={() => setModalForm(null)}
        onGuardado={() => {
          setModalForm(null)
          refetch()
        }}
        onBorrar={() => {
          setModalBorrar(modalForm === 'nueva' ? null : modalForm)
          setModalForm(null)
        }}
        crear={crear}
        editar={editar}
      />

      <ConfirmModal
        abierto={modalBorrar !== null}
        titulo="Borrar sucursal"
        textoConfirmar="Borrar"
        procesando={borrando}
        mensaje={
          <>
            ¿Borrar <strong>{modalBorrar?.nombre}</strong>? Si ya tiene gift cards o usuarios, desactívala en lugar de borrarla.
          </>
        }
        onCancelar={() => setModalBorrar(null)}
        onConfirmar={async () => {
          if (!modalBorrar) return
          setBorrando(true)
          const { error: err } = await eliminar(modalBorrar.id)
          setBorrando(false)
          if (err) toast.error(err)
          else {
            toast.success('Sucursal borrada.')
            refetch()
          }
          setModalBorrar(null)
        }}
      />
    </div>
  )
}
