/** Matches by title: catalogue entries carry no stable Bloodborne id. */
export const isBloodborne = (title?: string | null) =>
  /^bloodborne\b/i.test(title?.trim() ?? "");
