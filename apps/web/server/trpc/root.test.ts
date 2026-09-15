// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createInnerTRPCContext } from "./context"
import { appRouter } from "./root"

describe("tRPC", () => {
  it("responde ao health check sem depender do transporte HTTP nem do banco", async () => {
    // system.ping never touches the database, so a placeholder client is enough.
    const caller = appRouter.createCaller(createInnerTRPCContext({ db: {} as never }))

    await expect(caller.system.ping()).resolves.toEqual({ ok: true })
  })

  it("bloqueia procedures protegidas sem sessão (ERR-AUTH-001)", async () => {
    const caller = appRouter.createCaller(createInnerTRPCContext({ db: {} as never }))

    await expect(caller.members.list({ includeInactive: false })).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
