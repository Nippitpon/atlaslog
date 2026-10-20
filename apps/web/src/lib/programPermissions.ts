// Built-in programs (STRUCTURED_PROGRAMS) are admin-only; custom ones also open to coaches.
export function canEditProgram(isCustom: boolean, role: { isAdmin: boolean; isCoach: boolean }): boolean {
  return isCustom ? role.isAdmin || role.isCoach : role.isAdmin
}
