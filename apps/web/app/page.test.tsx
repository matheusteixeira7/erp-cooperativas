import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Page from "./page"

describe("Página inicial", () => {
  it("exibe o estado inicial do projeto", () => {
    render(<Page />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Project ready!" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Button" })).toBeTruthy()
  })
})
