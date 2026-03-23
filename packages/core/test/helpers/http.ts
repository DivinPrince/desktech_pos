export async function readJson<T>(res: Response, expectedStatus: number): Promise<T> {
  const text = await res.text();
  if (res.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, got ${res.status}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}
