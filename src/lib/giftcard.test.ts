import { describe, expect, it } from 'vitest'
import {
  FORM_VACIO,
  codigoValido,
  fechaCorta,
  formatearCodigo,
  formatoGs,
  telefonoWhatsApp,
  validarGiftCard,
} from './giftcard'

describe('formatearCodigo', () => {
  it('da forma PAT-XXXX-XXXX', () => {
    expect(formatearCodigo('patab12cd34e')).toBe('PAT-AB12-CD34')
    expect(formatearCodigo('ab12cd34')).toBe('PAT-AB12-CD34')
    expect(formatearCodigo('PAT-AB12-CD34')).toBe('PAT-AB12-CD34')
  })
  it('formatea de forma incremental', () => {
    expect(formatearCodigo('')).toBe('')
    expect(formatearCodigo('ab')).toBe('PAT-AB')
    expect(formatearCodigo('ab12')).toBe('PAT-AB12-')
    expect(formatearCodigo('ab12c')).toBe('PAT-AB12-C')
  })
})

describe('codigoValido', () => {
  it('valida el formato completo', () => {
    expect(codigoValido('PAT-AB12-CD34')).toBe(true)
    expect(codigoValido('PAT-AB12-CD3')).toBe(false)
    expect(codigoValido('pat-ab12-cd34')).toBe(false)
  })
})

describe('formatoGs', () => {
  it('usa punto como separador de miles', () => {
    expect(formatoGs(150000)).toBe('150.000 Gs')
  })
})

describe('fechaCorta', () => {
  it('convierte yyyy-MM-dd a dd/mm/yyyy', () => {
    expect(fechaCorta('2026-03-14')).toBe('14/03/2026')
    expect(fechaCorta('')).toBe('—')
  })
})

describe('telefonoWhatsApp', () => {
  it('normaliza números paraguayos', () => {
    expect(telefonoWhatsApp('0984 105 482')).toBe('595984105482')
    expect(telefonoWhatsApp('+595 984 105 482')).toBe('595984105482')
  })
})

describe('validarGiftCard', () => {
  const ok = { ...FORM_VACIO, comprador: 'Ana', destinatario: 'Luis', monto: '50000', fechaVencimiento: '2999-01-01' }
  it('acepta datos correctos', () => expect(validarGiftCard(ok)).toBeNull())
  it('rechaza monto bajo', () => expect(validarGiftCard({ ...ok, monto: '500' })).toMatch(/monto/i))
  it('rechaza email inválido', () => expect(validarGiftCard({ ...ok, email: 'x' })).toMatch(/email/i))
  it('rechaza vencimiento pasado', () => expect(validarGiftCard({ ...ok, fechaVencimiento: '2000-01-01' })).toMatch(/anterior/))
})
