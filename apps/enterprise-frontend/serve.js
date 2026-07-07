// Zero-dependency static server for the Athanor frontend.
// Serves index.html + /public assets on :3000. Use when you don't want the
// Next.js toolchain — `node serve.js`.
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const PUB = path.join(ROOT, "public");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
  ".png":"image/png", ".css":"text/css", ".svg":"image/svg+xml" };
http.createServer((req,res)=>{
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  // try public first (sprites, engine, world), then root (index.html)
  let file = fs.existsSync(path.join(PUB,url)) ? path.join(PUB,url) : path.join(ROOT,url);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
  const ext = path.extname(file);
  res.writeHead(200, {"Content-Type": MIME[ext]||"application/octet-stream"});
  fs.createReadStream(file).pipe(res);
}).listen(3000, ()=>console.log("[frontend] Athanor office live on http://localhost:3000"));
