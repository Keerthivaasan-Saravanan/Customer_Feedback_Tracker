import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/api.js";

const originalFetch = globalThis.fetch;

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let calls;

function mockFetch(responder) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return responder(url, init);
  };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("successful JSON responses are returned as parsed payloads", async () => {
  mockFetch(() => jsonResponse(200, { total: 3 }));
  const summary = await api.getSummary();
  assert.deepEqual(summary, { total: 3 });
  assert.equal(calls[0].url, "/api/feedback/summary");
});

test("204 responses resolve to null", async () => {
  mockFetch(() => new Response(null, { status: 204 }));
  const result = await api.deleteFeedback("FB-0001");
  assert.equal(result, null);
  assert.equal(calls[0].init.method, "DELETE");
});

test("error payloads become ApiError with code, details and context", async () => {
  mockFetch(() =>
    jsonResponse(409, {
      error: {
        code: "invalid_status_transition",
        message: "Cannot move from Resolved to New.",
        details: null,
        context: { current_status: "Resolved", requested_status: "New", allowed_next_status: null },
      },
    }),
  );

  await assert.rejects(api.updateStatus("FB-0001", "New"), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "invalid_status_transition");
    assert.equal(error.message, "Cannot move from Resolved to New.");
    assert.deepEqual(error.details, []);
    assert.equal(error.context.current_status, "Resolved");
    assert.equal(error.context.allowed_next_status, null);
    return true;
  });
});

test("validation details are passed through unchanged", async () => {
  const details = [{ field: "rating", message: "Input should be less than or equal to 5" }];
  mockFetch(() => jsonResponse(422, { error: { code: "validation_error", message: "Invalid rating.", details } }));

  await assert.rejects(api.createFeedback({}), (error) => {
    assert.deepEqual(error.details, details);
    assert.deepEqual(error.context, {});
    return true;
  });
});

test("non-JSON error responses fall back to a status-based message", async () => {
  mockFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(api.getMeta(), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.message, "The request failed with status 502.");
    return true;
  });
});

test("network failures produce a friendly ApiError", async () => {
  mockFetch(() => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(api.getSummary(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.code, "network_error");
    assert.match(error.message, /Cannot reach the server/);
    return true;
  });
});

test("list query skips empty, null and undefined parameters", async () => {
  mockFetch(() => jsonResponse(200, { items: [], total: 0, limit: 25, offset: 0 }));
  await api.listFeedback({ product: "", category: undefined, status: null, rating: 4, limit: 25, offset: 0 });
  const url = new URL(calls[0].url, "http://localhost");
  assert.equal(url.pathname, "/api/feedback");
  assert.equal(url.searchParams.has("product"), false);
  assert.equal(url.searchParams.has("category"), false);
  assert.equal(url.searchParams.has("status"), false);
  assert.equal(url.searchParams.get("rating"), "4");
  assert.equal(url.searchParams.get("offset"), "0");
});

test("trend requests send the weeks parameter with a default of 8", async () => {
  mockFetch(() => jsonResponse(200, []));
  await api.getTrend();
  await api.getTrend(12);
  assert.equal(new URL(calls[0].url, "http://localhost").searchParams.get("weeks"), "8");
  assert.equal(new URL(calls[1].url, "http://localhost").searchParams.get("weeks"), "12");
});

test("record IDs are URL-encoded in path segments", async () => {
  mockFetch(() => jsonResponse(200, { id: "a/b" }));
  await api.getFeedback("a/b");
  assert.equal(calls[0].url, "/api/feedback/a%2Fb");
});

test("JSON bodies are sent with the correct content type", async () => {
  mockFetch(() => jsonResponse(201, { id: "FB-0016" }));
  await api.updateStatus("FB-0001", "Reviewed");
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { status: "Reviewed" });
});
