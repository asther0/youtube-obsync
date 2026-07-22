import http from "node:http";
import https from "node:https";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type VaultRequest =
  | {
      action: "test";
      obsidianUrl: string;
      obsidianToken: string;
    }
  | {
      action: "put";
      obsidianUrl: string;
      obsidianToken: string;
      path: string;
      contentType: string;
      body: string;
      encoding: "text" | "base64";
    };

export async function OPTIONS() {
  return corsResponse(null);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as VaultRequest;

  if (!payload.obsidianUrl || !payload.obsidianToken) {
    return corsResponse({ error: "Falta URL o token de Obsidian." }, 400);
  }

  try {
    const target = parseAllowedLocalUrl(payload.obsidianUrl);
    if (!target.ok) {
      return corsResponse({ error: target.error }, 400);
    }

    if (payload.action === "test") {
      const response = await localRestRequest({
        baseUrl: target.url,
        token: payload.obsidianToken,
        method: "GET",
        pathname: "/"
      });
      const status = parseStatus(response.body);

      return corsResponse({
        ok: response.statusCode >= 200 && response.statusCode < 300 && status.authenticated === true,
        status: response.statusCode,
        authenticated: status.authenticated
      });
    }

    if (payload.action === "put") {
      if (!payload.path || !payload.contentType) {
        return corsResponse({ error: "Falta path o contentType." }, 400);
      }

      const body =
        payload.encoding === "base64" ? Buffer.from(payload.body, "base64") : Buffer.from(payload.body);
      const response = await localRestRequest({
        baseUrl: target.url,
        token: payload.obsidianToken,
        method: "PUT",
        pathname: `/vault/${encodeVaultPath(payload.path)}`,
        contentType: payload.contentType,
        body
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return corsResponse({ error: statusMessage(response.statusCode), status: response.statusCode }, 502);
      }

      return corsResponse({ ok: true, status: response.statusCode });
    }

    return corsResponse({ error: "Accion invalida." }, 400);
  } catch (error) {
    return corsResponse(
      {
        error: error instanceof Error ? error.message : "No se pudo conectar con Obsidian."
      },
      502
    );
  }
}

function localRestRequest({
  baseUrl,
  token,
  method,
  pathname,
  contentType,
  body
}: {
  baseUrl: string;
  token: string;
  method: "GET" | "PUT";
  pathname: string;
  contentType?: string;
  body?: Buffer;
}) {
  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const url = new URL(pathname, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method,
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(contentType ? { "Content-Type": contentType } : {}),
          ...(body ? { "Content-Length": String(body.byteLength) } : {})
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function encodeVaultPath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function statusMessage(status: number) {
  if (status === 401 || status === 403) return "Token rechazado. Pega el token sin la palabra Bearer.";
  if (status === 404) return "No se pudo escribir en esa ruta del vault.";
  return `Obsidian respondio con status ${status}.`;
}

function parseAllowedLocalUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const url = new URL(input);
    const allowedHosts = new Set(["127.0.0.1", "localhost"]);
    const allowedPorts = new Set(["27123", "27124"]);

    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, error: "El endpoint de Obsidian debe usar http o https." };
    }

    if (!allowedHosts.has(url.hostname)) {
      return { ok: false, error: "Por seguridad, Obsidian debe apuntar a localhost o 127.0.0.1." };
    }

    if (!allowedPorts.has(url.port)) {
      return { ok: false, error: "Usa el puerto local 27123 o 27124 para Obsidian." };
    }

    return { ok: true, url: `${url.protocol}//${url.host}` };
  } catch {
    return { ok: false, error: "URL de Obsidian inválida." };
  }
}

function parseStatus(body: string) {
  try {
    return JSON.parse(body) as { authenticated?: boolean };
  } catch {
    return {};
  }
}

function corsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
