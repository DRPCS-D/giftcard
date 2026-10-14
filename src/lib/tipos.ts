/**
 * Tipos del dominio. Se escriben a mano (no hay esquema que generar: el
 * backend es Apps Script sobre Google Sheets, no una base tipada).
 */

/** Coincide con lo que devuelve `normalizarRol_` en apps-script/Code.gs. */
export type Rol = 'admin' | 'gerente' | 'cajero'

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  cajero: 'Cajero',
}

export type EstadoGiftCard = 'ACTIVA' | 'USADA' | 'VENCIDA' | 'ANULADA'

export const ESTADOS_GIFTCARD: EstadoGiftCard[] = ['ACTIVA', 'USADA', 'VENCIDA', 'ANULADA']

export const ESTADO_LABEL: Record<EstadoGiftCard, string> = {
  ACTIVA: 'Activa',
  USADA: 'Usada',
  VENCIDA: 'Vencida',
  ANULADA: 'Anulada',
}

export interface GiftCard {
  id: string
  codigo: string
  comprador: string
  destinatario: string
  email: string
  telefono: string
  monto: number
  mensaje: string
  notas: string
  /** 'yyyy-MM-dd' */
  fechaEmision: string
  /** 'yyyy-MM-dd' */
  fechaVencimiento: string
  estado: EstadoGiftCard
  /** 'yyyy-MM-dd HH:mm' */
  fechaUso: string
  canjeadoPor: string
  sucursalCanje: string
  creadoPor: string
  /** Id de sucursal que la emitió. */
  sucursalId: string
  fechaAnulacion: string
  anuladoPor: string
  motivoAnulacion: string
}

/** Resultado de consultar un código en caja (`verificarGiftCard`). */
export interface ResultadoVerificacion {
  encontrada: boolean
  estado?: EstadoGiftCard
  codigo?: string
  comprador?: string
  destinatario?: string
  monto?: number
  fechaVencimiento?: string
  fechaUso?: string
  canjeadoPor?: string
  sucursalCanje?: string
}

export interface Sucursal {
  id: string
  nombre: string
  direccion: string
  activo: boolean
}

export interface UsuarioApp {
  /** Nombre de acceso (login). */
  usuario: string
  /** Nombre completo, opcional. */
  nombre: string
  rol: Rol
  activo: boolean
  /** Ids de sucursal: uno para gerente y cajero, ninguno para admin. */
  sucursales: string[]
}
