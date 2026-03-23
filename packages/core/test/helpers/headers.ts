export function jsonHeaders(sessionHeaders: Headers): Headers {
  const h = new Headers(sessionHeaders);
  h.set("Content-Type", "application/json");
  return h;
}
