import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';

const root = resolve('dist/compatibility');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const match = /^\/(20|21|22)\/(.*)$/.exec(url.pathname);
  if (!match) { response.writeHead(404).end(); return; }
  const base = resolve(root, match[1], 'build/browser');
  const file = resolve(base, match[2] || 'index.html');
  if (!file.startsWith(base + sep)) { response.writeHead(403).end(); return; }
  try {
    const contents = await readFile(file);
    response.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream'}).end(contents);
  } catch { response.writeHead(404).end(); }
}).listen(4179, '127.0.0.1');
