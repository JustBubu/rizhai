export class ApiError extends Error {}

function parseBody(text: string): { error?: string } {
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string };
  } catch {
    return {};
  }
}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok) {
    throw new ApiError(typeof data.error === "string" ? data.error : `请求失败（${response.status}）`);
  }
  return data as T;
}
