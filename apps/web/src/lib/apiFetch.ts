export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || "Request failed";
    const code = data?.code || "UNKNOWN_ERROR";
    throw new ApiError(message, code, res.status);
  }

  // Handle unified response format: { success: true, data: ... }
  if (data && typeof data === "object" && "success" in data && "data" in data) {
    return data.data as T;
  }

  // Fallback for non-unified responses
  return data as T;
}

