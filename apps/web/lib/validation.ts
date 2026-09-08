// Field validations (30-regras/validacoes.json). Messages in pt-BR.

export function isValidCpf(input: string) {
  const digits = input.replace(/\D/g, "")
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  const calc = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
}

export function onlyDigits(input: string) {
  return input.replace(/\D/g, "")
}

/** CPF(11) | CNPJ(14) | e-mail | +55 phone | uuid (VL-012) */
export function isValidPixKey(input: string) {
  const value = input.trim()
  if (!value) return false
  if (/^\d{11}$/.test(value) || /^\d{14}$/.test(value)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true
  if (/^\+55\d{10,11}$/.test(value.replace(/\s/g, ""))) return true
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
  return false
}

export function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())
}
