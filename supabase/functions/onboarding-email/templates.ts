// {{key}} merge-field rendering for onboarding email templates.

export function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}
