/** Catalog every new cooperative starts with (EN-tipo-material.seed). */
export const DEFAULT_MATERIAL_TYPES = [
  { name: "PET Cristal", category: "plastic", defaultCondition: "baled" },
  { name: "PET Colorido", category: "plastic", defaultCondition: "baled" },
  { name: "PEAD (plástico duro)", category: "plastic", defaultCondition: "baled" },
  { name: "PP", category: "plastic", defaultCondition: "baled" },
  { name: "Papelão Ondulado", category: "paper", defaultCondition: "baled" },
  { name: "Papel Branco", category: "paper", defaultCondition: "baled" },
  { name: "Papel Misto", category: "paper", defaultCondition: "baled" },
  { name: "Alumínio (lata)", category: "metal", defaultCondition: "baled" },
  { name: "Ferro / Sucata", category: "metal", defaultCondition: "loose" },
  { name: "Cobre", category: "metal", defaultCondition: "loose" },
  { name: "Vidro", category: "glass", defaultCondition: "loose" },
  { name: "Rejeito", category: "waste", defaultCondition: "loose" },
] as const satisfies readonly { name: string; category: "plastic" | "paper" | "metal" | "glass" | "waste" | "other"; defaultCondition: "loose" | "baled" }[]
