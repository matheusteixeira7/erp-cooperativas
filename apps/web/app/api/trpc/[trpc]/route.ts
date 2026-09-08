import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

import { createTRPCContext } from "@/server/trpc/context"
import { appRouter } from "@/server/trpc/root"

const endpoint = "/api/trpc"

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint,
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
    onError({ error, path }) {
      console.error(`tRPC failed on ${path ?? "<unknown>"}:`, error)
    },
  })
}

export { handler as GET, handler as POST }
