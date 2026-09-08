<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:trpc-project-conventions -->
## tRPC

- Follow [`docs/trpc.md`](docs/trpc.md) for every new tRPC feature.
- Keep one `initTRPC` instance in `apps/web/server/trpc/init.ts`; add one router
  per business domain under `apps/web/server/trpc/routers/` and compose it in
  `root.ts`.
- Procedures validate inputs and API outputs with Zod. Prefer
  `protectedProcedure` for business data and throw typed `TRPCError`s.
- Do not import `appRouter` as a value into client code; import `AppRouter` with
  `import type` only.
<!-- END:trpc-project-conventions -->
