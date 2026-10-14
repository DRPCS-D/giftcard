import { Route, Routes } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Canjear from '@/pages/Canjear'
import Inicio from '@/pages/Inicio'
import Login from '@/pages/Login'
import Nueva from '@/pages/Nueva'
import NoEncontrado from '@/pages/NoEncontrado'
import Sucursales from '@/pages/Sucursales'
import Tarjetas from '@/pages/Tarjetas'
import Usuarios from '@/pages/Usuarios'

/**
 * Dos zonas: `/login` publica, y todo lo demas dentro de `AppLayout` (exige
 * sesion). Sucursales y Usuarios son solo para admin; Nueva y Tarjetas para admin y gerente
 * (la propia pagina redirige); Canjear es para todos los roles.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route path="nueva" element={<Nueva />} />
        <Route path="tarjetas" element={<Tarjetas />} />
        <Route path="canjear" element={<Canjear />} />
        <Route path="sucursales" element={<Sucursales />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
