import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.cwd();
const requested = process.argv.find(arg => arg.startsWith('--angular='))?.split('=')[1];
if (requested && !['20', '21', '22'].includes(requested)) throw new Error('Expected --angular=20, 21, or 22');
const versions = requested ? [requested] : ['20', '21', '22'];

function npm(args, cwd = root, capture = false) {
  // npm's JS entry point avoids shell interpolation on Windows and POSIX.
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8',
    env: {...process.env, ...(requested ? {COMPAT_ANGULAR: requested} : {})},
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

mkdirSync('dist/compatibility', {recursive: true});
const tarball = resolve('dist/library.tgz');
if (!process.argv.includes('--use-packed')) {
  const packed = JSON.parse(npm(['pack', './dist/drag-drop-layout', '--pack-destination', 'dist', '--json'], root, true))[0];
  cpSync(resolve('dist', packed.filename), tarball);
}
if (process.argv.includes('--pack-only')) process.exit(0);
const info = JSON.parse(readFileSync('projects/drag-drop-layout/package.json', 'utf8'));
for (const major of versions) {
  const directory = resolve('dist/compatibility', major);
  mkdirSync(directory, {recursive: true});
  cpSync('tests/compatibility/consumers/' + major, directory, {recursive: true});
  cpSync(tarball, resolve(directory, 'library.tgz'));
  for (const file of ['app.ts', 'app.html', 'main.ts', 'styles.css']) {
    cpSync('tests/compatibility/' + file, resolve(directory, file));
  }
  writeFileSync(resolve(directory, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><base href="/' + major + '/"></head><body><compat-app></compat-app></body></html>\n');
  writeFileSync(resolve(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {target: 'ES2022', module: 'preserve', moduleResolution: 'bundler', strict: true, experimentalDecorators: true, skipLibCheck: true, lib: ['ES2022', 'DOM']},
    angularCompilerOptions: {strictTemplates: true, strictInjectionParameters: true},
    files: ['main.ts'],
  }, null, 2));
  writeFileSync(resolve(directory, 'angular.json'), JSON.stringify({
    version: 1, projects: {consumer: {projectType: 'application', root: '', architect: {
      build: {builder: '@angular/build:application', options: {
        browser: 'main.ts', index: 'index.html', tsConfig: 'tsconfig.json', outputPath: 'build', styles: ['styles.css'], baseHref: '/' + major + '/',
        optimization: true, outputHashing: 'all',
      }},
    }}},
  }, null, 2));
  npm(['ci', '--no-audit', '--no-fund'], directory);
  npm(['install', './library.tgz', '--no-audit', '--no-fund'], directory);
  npm(['ls', '@skutam/drag-drop-layout', '@angular/core', '@angular/common', 'rxjs'], directory);
  const installed = JSON.parse(readFileSync(resolve(directory, 'node_modules/@skutam/drag-drop-layout/package.json'), 'utf8'));
  if (installed.version !== info.version || JSON.stringify(installed.peerDependencies) !== JSON.stringify(info.peerDependencies)) {
    throw new Error('Packed package version or peer dependencies differ from source metadata');
  }
  npm(['audit', '--audit-level=high'], directory);
  npm(['exec', '--', 'ng', 'build', 'consumer'], directory);
}
npm(['exec', '--', 'playwright', 'test', '--config=tests/compatibility/playwright.config.mjs']);
