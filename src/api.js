export async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch('/api' + path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new Error(data?.error?.message ?? 'The API is unavailable. Try again.');
  }
  return data;
}
