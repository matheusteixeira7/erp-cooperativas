"use client"

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

import { MATERIAL_CATEGORY_LABEL, type MaterialCategory, type MaterialCondition } from "@/lib/domain/enums"

export type MaterialOption = {
  id: string
  name: string
  category: MaterialCategory
  defaultCondition: MaterialCondition
  active: boolean
}

/** Select of active material types grouped by category. Shared by the sale and purchase forms. */
export function MaterialSelect({
  id,
  materials,
  value,
  onValueChange,
  disabled,
  invalid,
  loading = false,
}: {
  id: string
  materials: MaterialOption[]
  value: string | null
  onValueChange: (materialTypeId: string | null) => void
  disabled?: boolean
  invalid?: boolean
  loading?: boolean
}) {
  const items = materials.map((m) => ({ value: m.id, label: m.name }))
  const categories = (Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[]).filter((category) =>
    materials.some((m) => m.category === category),
  )
  return (
    <Select items={items} value={value} onValueChange={onValueChange} disabled={disabled || loading}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid ? true : undefined}>
        <SelectValue placeholder={loading ? "Carregando materiais…" : "Escolha o material"} />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectGroup key={category}>
            <SelectLabel>{MATERIAL_CATEGORY_LABEL[category]}</SelectLabel>
            {materials
              .filter((m) => m.category === category)
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
