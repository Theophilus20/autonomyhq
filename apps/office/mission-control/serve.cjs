const http=require("http"),fs=require("fs"),path=require("path");
const ROOT=__dirname;
http.createServer((req,res)=>{
  let u=req.url.split("?")[0]; if(u==="/")u="/index.html";
  const f=path.join(ROOT,u);
  if(!fs.existsSync(f)){res.writeHead(404);return res.end("nf");}
  const ext=path.extname(f);
  const mime={".html":"text/html",".js":"text/javascript",".css":"text/css"}[ext]||"text/plain";
  res.writeHead(200,{"Content-Type":mime});fs.createReadStream(f).pipe(res);
}).listen(3200,()=>console.log("[mission-control] http://localhost:3200"));
