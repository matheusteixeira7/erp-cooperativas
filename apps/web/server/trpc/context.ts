/**
 * Contexto mínimo e independente do transporte.
 *
 * Quando a autenticação for adicionada, resolva a sessão em
 * `createTRPCContext` e mantenha `createInnerTRPCContext` simples para testes
 * e chamadas internas do servidor.
 */
export type Session = {
  user: {
    id: string
    cooperativeId: string
    roles: string[]
  }
} | null

export function createInnerTRPCContext(options?: { session?: Session }) {
  return {
    session: options?.session ?? null,
  }
}

export async function createTRPCContext(options: { headers: Headers }) {
  // TODO(auth): derive the session from options.headers / cookies here.
  // Keeping this at the transport edge prevents routers from parsing headers.
  void options.headers

  return createInnerTRPCContext()
}

export type TRPCContext = Awaited<ReturnType<typeof createInnerTRPCContext>>
