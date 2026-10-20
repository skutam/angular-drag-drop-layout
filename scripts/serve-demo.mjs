import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';

const root = resolve(process.env.DEMO_ROOT ?? 'dist/client');
const prefix = process.env.DEMO_BASE ?? '/';
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon'};
createServer(async (request, response) => {
  const {pathname} = new URL(request.url, 'http://localhost');
  if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
  const file = resolve(root, decodeURIComponent(pathname.slice(prefix.length)) || 'index.html');
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const contents = await readFile(file);
    response.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream'})
      .end(contents);
  } catch { response.writeHead(404).end(); }
}).listen(4180, '127.0.0.1');
