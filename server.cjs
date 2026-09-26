const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const allowed = new Set(['index.html','experiment.js','style.css','vendor/datapipe-client-0.2.0.js','vendor/LICENSE.txt']);
http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if(!allowed.has(name)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,name),(error,data)=>{
    res.writeHead(error ? 500 : 200, {'Content-Type':types[path.extname(name)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(error ? 'Read error' : data);
  });
}).listen(8000,'127.0.0.1',()=>console.log('Number Line: http://127.0.0.1:8000'));
