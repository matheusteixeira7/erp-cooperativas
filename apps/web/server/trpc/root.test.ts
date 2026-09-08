// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createInnerTRPCContext } from "./context"
import { appRouter } from "./root"

describe("tRPC", () => {
  it("responde ao health check sem depender do transporte HTTP", async () => {
    const caller = appRouter.createCaller(createInnerTRPCContext())

    await expect(caller.system.ping()).resolves.toEqual({ ok: true })
  })
})
