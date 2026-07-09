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

  let requestedPath;
  try {
    requestedPath = fs.realpathSync(path.resolve(ROOT, "." + u));
  } catch {
    res.writeHead(404);
    return res.end("nf");
  }

  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (requestedPath !== ROOT && !requestedPath.startsWith(rootWithSep)) {
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