const ALLOWED_METHODS = ["GET", "POST", "PATCH"] as const;
const ALLOWED_REQUEST_HEADERS = ["accept", "authorization", "content-type"];
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

function json(data: unknown, status: number, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  addCors(headers, origin);
  return new Response(JSON.stringify(data), { status, headers });
}

function addCors(headers: Headers, origin?: string): void {
  if (!origin) return;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", `${ALLOWED_METHODS.join(", ")}, OPTIONS`);
  headers.set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  headers.append("Vary", "Origin");
}

function configuredList(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function allowedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return undefined;
  return configuredList(env.ALLOWED_ORIGINS).has(origin) ? origin : undefined;
}

function targetUrl(request: Request, env: Env): URL | Response {
  const raw = new URL(request.url).searchParams.get("target");
  if (!raw) return json({ error: "Missing target URL" }, 400);

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json({ error: "Invalid target URL" }, 400);
  }

  const allowedOrigins = configuredList(env.ALLOWED_NETBOX_ORIGINS);
  if (target.protocol !== "https:" || !allowedOrigins.has(target.origin)) {
    return json({ error: "Target NetBox origin is not allowed" }, 403);
  }
  if (target.username || target.password || target.hash) {
    return json({ error: "Target URL must not contain credentials or a fragment" }, 400);
  }
  if (!/(^|\/)api\//.test(target.pathname)) {
    return json({ error: "Only NetBox API paths are allowed" }, 403);
  }
  return target;
}

function authHeader(request: Request): string | Response {
  const value = request.headers.get("Authorization") || "";
  if (!/^(Bearer|Token)\s+\S+$/i.test(value)) {
    return json({ error: "A NetBox Authorization header is required" }, 401);
  }
  return value;
}

function corsError(): Response {
  return json({ error: "This page origin is not allowed" }, 403);
}

function preflight(request: Request, origin: string): Response {
  const requestedMethod = (request.headers.get("Access-Control-Request-Method") || "").toUpperCase();
  if (requestedMethod && !(ALLOWED_METHODS as readonly string[]).includes(requestedMethod)) {
    return json({ error: "Method is not allowed" }, 405, origin);
  }

  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => !ALLOWED_REQUEST_HEADERS.includes(header))) {
    return json({ error: "Request header is not allowed" }, 400, origin);
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": `${ALLOWED_METHODS.join(", ")}, OPTIONS`,
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  return new Response(null, { status: 204, headers });
}

function upstreamHeaders(request: Request, authorization: string): Headers {
  const headers = new Headers({
    Accept: request.headers.get("Accept") || "application/json",
    Authorization: authorization,
  });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

function responseHeaders(upstream: Response, origin?: string): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  addCors(headers, origin);
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const originHeader = request.headers.get("Origin");
    const origin = allowedOrigin(request, env);
    if (!originHeader || !origin) return corsError();

    if (request.method === "OPTIONS") {
      return preflight(request, origin);
    }
    if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
      return json({ error: "Method is not allowed" }, 405, origin);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return json({ error: "Request body is too large" }, 413, origin);
    }

    const target = targetUrl(request, env);
    if (target instanceof Response) {
      addCors(target.headers, origin);
      return target;
    }
    const authorization = authHeader(request);
    if (authorization instanceof Response) {
      addCors(authorization.headers, origin);
      return authorization;
    }

    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers: upstreamHeaders(request, authorization),
        body: request.method === "GET" ? undefined : request.body,
        redirect: "manual",
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        return json({ error: "NetBox returned an unexpected redirect" }, 502, origin);
      }
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders(upstream, origin),
      });
    } catch (error) {
      console.error(JSON.stringify({
        message: "upstream request failed",
        error: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: "Unable to reach the NetBox upstream" }, 502, origin);
    }
  },
} satisfies ExportedHandler<Env>;
