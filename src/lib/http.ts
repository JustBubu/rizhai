import { connection } from "next/server";

export async function beginRequest(): Promise<void> {
  await connection();
}

export function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "出错了";
  return Response.json({ error: message }, { status });
}
