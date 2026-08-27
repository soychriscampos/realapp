export const GUARDIAN_RELATIONSHIPS = [
  "Mamá",
  "Papá",
  "Abuelo",
  "Abuela",
  "Tía",
  "Tío",
  "Prima",
  "Primo",
  "Hermana",
  "Hermano",
  "Tutor",
  "Otro",
] as const

export function isGuardianRelationship(value: string): boolean {
  return GUARDIAN_RELATIONSHIPS.includes(value as (typeof GUARDIAN_RELATIONSHIPS)[number])
}
