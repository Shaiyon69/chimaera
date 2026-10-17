// Never show a raw SDK/network error to the user; map the few cases we can
// name to calm copy and fall back to one generic message otherwise.
export const isNetworkError = (err: unknown) =>
  err instanceof Error && /failed to fetch|network/i.test(err.message);

export type AuthErrorKind = "invalid_credentials" | "network" | "unknown";

export const classifyAuthError = (err: unknown): AuthErrorKind => {
  if (isNetworkError(err)) return "network";
  if (err instanceof Error && err.message === "Invalid login credentials") {
    return "invalid_credentials";
  }
  return "unknown";
};
