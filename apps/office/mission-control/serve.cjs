const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

http.createServer((req, res) => {
  let u;
  try {
    u = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end("bad request");
  }

  if (u === "/") u = "/index.html";

  // Defense-in-depth validation before filesystem path construction.
  // Requiring u to equal its own normalization rejects "..", "//", "./"
  // segments up front — a sanitizer pattern CodeQL recognizes.
  if (
    !u.startsWith("/") ||
    u !== path.posix.normalize(u) ||
    u.includes("\\") ||
    u.includes("\0")
  ) {
    res.writeHead(400);
    return res.end("bad request");
  }

  let requestedPath;
  try {
    const resolvedPath = path.resolve(ROOT, "." + u);
    requestedPath = fs.realpathSync(resolvedPath);
  } catch {
    res.writeHead(404);
    return res.end("nf");
  }

  // Root containment: after canonicalization (symlinks resolved),
  // requestedPath must live under ROOT. path.relative-based checks
  // are the analyzer-friendly way to express this.
  const relativeToRoot = path.relative(ROOT, requestedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    res.writeHead(403);
    return res.end("forbidden");
  }

  if (!fs.statSync(requestedPath).isFile()) {
    res.writeHead(404);
    return res.end("nf");
  }

  const ext = path.extname(requestedPath);
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "text/plain";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(requestedPath).pipe(res);
}).listen(3200, () => console.log("[mission-control] http://localhost:3200"));
