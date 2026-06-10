import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const target = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = path.resolve(root, `.${target}`);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function sendPlain(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(message);
}

const server = createServer(async (request, response) => {
  if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
    sendPlain(response, 405, "Method Not Allowed");
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    sendPlain(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendPlain(response, 404, "Not Found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Content-Length": fileStat.size,
      "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
        ? "public, max-age=3600"
        : "no-cache"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendPlain(response, 404, "Not Found");
      return;
    }

    sendPlain(response, 500, "Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Profile site listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
