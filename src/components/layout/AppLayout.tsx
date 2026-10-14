import { KeyRound, LogOut, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CambiarMiPasswordModal } from '@/components/cuenta/CambiarMiPasswordModal'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/hooks/useAuth'
import { useForzarActualizacion } from '@/hooks/useTabla'
import { ROL_LABEL } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const NAV_INICIO = { to: '/', label: 'Inicio', end: true }
const NAV_NUEVA = { to: '/nueva', label: 'Nueva', end: false }
const NAV_TARJETAS = { to: '/tarjetas', label: 'Tarjetas', end: false }
const NAV_CANJEAR = { to: '/canjear', label: 'Canjear', end: false }
const NAV_SUCURSALES = { to: '/sucursales', label: 'Sucursales', end: false }
const NAV_USUARIOS = { to: '/usuarios', label: 'Usuarios', end: false }

export default function AppLayout() {
  const { usuario, nombre, rol, esAdmin, puedeGestionar, signOut } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)
  const { forzando, forzar } = useForzarActualizacion()

  const NAV = [
    NAV_INICIO,
    ...(puedeGestionar ? [NAV_NUEVA, NAV_TARJETAS] : []),
    NAV_CANJEAR,
    ...(esAdmin ? [NAV_SUCURSALES, NAV_USUARIOS] : []),
  ]

  useEffect(() => {
    if (!usuario) navigate('/login', { replace: true })
  }, [usuario, navigate])

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <span className="flex min-w-0 items-center gap-2">
            <img src="/logo.png" alt="Patachoca" className="h-5 w-auto shrink-0 dark:hidden" />
            <img src="/logo-blanco.png" alt="" className="hidden h-5 w-auto shrink-0 dark:block" />
            <span className="hidden truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary sm:inline">
              Gift Card
            </span>
          </span>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-foreground">{nombre}</p>
              <p className="text-[11px] text-muted-foreground">{rol ? ROL_LABEL[rol] : ''}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={forzando}
              title="Actualizar datos"
              aria-label="Actualizar datos"
              onClick={async () => {
                const ok = await forzar()
                if (ok) toast.success('Datos actualizados.')
                else toast.error('No se pudo actualizar todo. Revisa tu conexión.')
              }}
            >
              <RefreshCw className={cn(forzando && 'animate-spin')} />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setModalPassword(true)} title="Cambiar mi contraseña">
              <KeyRound />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
              <LogOut />
            </Button>
          </div>
        </div>

        {/* Navegacion en mobile: la fila de arriba se queda sin lugar */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm',
                  isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <CambiarMiPasswordModal abierto={modalPassword} onCerrar={() => setModalPassword(false)} />
    </div>
  )
}
