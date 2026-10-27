export class ApiError extends Error {}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: string }) : {};
  if (!response.ok) {
    throw new ApiError(typeof data.error === "string" ? data.error : `请求失败（${response.status}）`);
  }
  return data as T;
}
