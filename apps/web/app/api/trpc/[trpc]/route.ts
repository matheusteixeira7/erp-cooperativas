import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

import { createTRPCContext } from "@/server/trpc/context"
import { appRouter } from "@/server/trpc/root"

const endpoint = "/api/trpc"

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint,
    req: request,
    router: appRouter,
    createContext: ({ resHeaders }) => createTRPCContext({ headers: request.headers, resHeaders }),
    onError({ error, path }) {
      // Expected business errors (409, 422, 404...) are not server failures.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`tRPC failed on ${path ?? "<unknown>"}:`, error)
      }
    },
  })
}

export { handler as GET, handler as POST }
