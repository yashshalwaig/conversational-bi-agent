import { QueryResponse, HealthResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function queryBI(
  question: string,
  sessionId?: string
): Promise<QueryResponse> {
  return fetchAPI<QueryResponse>("/api/query", {
    method: "POST",
    body: JSON.stringify({
      question,
      session_id: sessionId,
    }),
  });
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>("/api/health");
}

export async function getSuggestions(): Promise<{ suggestions: string[] }> {
  return fetchAPI<{ suggestions: string[] }>("/api/suggestions");
}
