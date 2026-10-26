/**
 * Thin client for the Customer Feedback Tracker API.
 * Every failure is normalised into an ApiError with a user-facing message,
 * an HTTP status, a machine-readable code and optional per-field details.
 */

// `import.meta.env` is undefined under plain Node (used by the unit tests), hence the optional chaining.
const API_BASE = import.meta.env?.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", details = [], context = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.context = context;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request(path, { method = "GET", body, params } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Make sure the API is running on port 8000.");
  }

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(error.message || `The request failed with status ${response.status}.`, {
      status: response.status,
      code: error.code,
      details: error.details ?? [],
      context: error.context ?? {},
    });
  }
  return payload;
}

export const api = {
  getMeta: () => request("/meta"),
  getSummary: () => request("/feedback/summary"),
  getTrend: (weeks = 8) => request("/feedback/trend", { params: { weeks } }),
  listFeedback: (params) => request("/feedback", { params }),
  getFeedback: (id) => request(`/feedback/${encodeURIComponent(id)}`),
  createFeedback: (payload) => request("/feedback", { method: "POST", body: payload }),
  updateStatus: (id, status) =>
    request(`/feedback/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  deleteFeedback: (id) => request(`/feedback/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
