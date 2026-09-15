// @vitest-environment node

import { describe, expect, it } from "vitest"

import { hashPassword, verifyPassword } from "./password"

describe("password hashing (scrypt)", () => {
  it("verifica a senha correta e rejeita a errada", async () => {
    const hash = await hashPassword("demo123")
    expect(hash.startsWith("scrypt$")).toBe(true)
    await expect(verifyPassword("demo123", hash)).resolves.toBe(true)
    await expect(verifyPassword("demo124", hash)).resolves.toBe(false)
  })

  it("gera hashes diferentes para a mesma senha (salt aleatório)", async () => {
    const a = await hashPassword("x")
    const b = await hashPassword("x")
    expect(a).not.toBe(b)
  })

  it("rejeita formatos desconhecidos sem lançar", async () => {
    await expect(verifyPassword("x", "plain-text")).resolves.toBe(false)
  })
})
