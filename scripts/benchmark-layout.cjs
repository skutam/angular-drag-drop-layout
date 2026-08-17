// Run with: node scripts/benchmark-layout.cjs
// Compile the pure engine in memory, without producing build files or loading Angular.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const {outputText} = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
  });
  module._compile(outputText, filename);
};
const {LayoutEngine} = require('../projects/drag-drop-layout/src/lib/layout/layout-engine.ts');
const engine = new LayoutEngine();
for (const count of [12, 48, 120]) {
  const items = Array.from({length: count}, (_, index) => ({
    id: `widget-${index}`, x: index % 12 + 1, y: Math.floor(index / 12) + 1, width: 1, height: 1,
  }));
  const request = {
    items, columns: 12, rows: Math.ceil(count / 12),
    active: {id: 'new', x: 6, y: Math.max(1, Math.floor(count / 24)), width: 1, height: 1},
    operation: 'insert', movePriority: ['bottom', 'left', 'right', 'top'], allowRowGrowth: true,
  };
  engine.resolvePlacement(request);
  const timings = [];
  let result;
  for (let iteration = 0; iteration < 20; iteration++) {
    const start = performance.now();
    result = engine.resolvePlacement(request);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  console.log(JSON.stringify({
    widgets: count,
    medianMs: +timings[10].toFixed(2),
    p95Ms: +timings[18].toFixed(2),
    ok: result.ok,
    rows: result.ok ? result.rows : undefined,
    reason: result.ok ? undefined : result.reason,
  }));
}
