import type { Metadata } from "next"

import { SignupForm } from "@/components/signup-form"

export const metadata: Metadata = { title: "Criar conta" }

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  )
}
