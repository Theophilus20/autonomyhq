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

  // Resolve against ROOT, then confirm the result is still *inside* ROOT.
  const requestedPath = path.normalize(path.join(ROOT, u));
  const relative = path.relative(ROOT, requestedPath);
  const isOutside = relative.startsWith("..") || path.isAbsolute(relative);

  if (isOutside) {
    res.writeHead(403);
    return res.end("forbidden");
  }

  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    res.writeHead(404);
    return res.end("nf");
  }

  const ext = path.extname(requestedPath);
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "text/plain";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(requestedPath).pipe(res);
}).listen(3200, () => console.log("[mission-control] http://localhost:3200"));