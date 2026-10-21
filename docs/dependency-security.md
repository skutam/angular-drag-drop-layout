# Dependency security and Angular compatibility

Assessed on 2026-10-20 using npm's advisory service. Counts include inherited findings, rather than distinct exploitable vulnerabilities.

## Outcome and release gate

| Dependency set | Before tooling migration | After tooling migration |
| --- | --- | --- |
| Complete repository | 12 high entries from the unpatched braces advisory | 4 moderate entries; 0 high or critical |
| Root production dependencies | 0 findings | 0 findings |
| Angular 20.3.34 consumer, including build tools | 0 findings | 0 findings |
| Angular 21.2.25 consumer, including build tools | 0 findings | 0 findings |
| Angular 22.2.3 consumer, including build tools | 0 findings | 0 findings |

Before the earlier Angular upgrades, the repository contained 101 entries: 8 low, 24 moderate, 62 high, and 7 critical.

The existing high/critical release gate now passes. Development dependencies remain included; no advisory is suppressed or allowlisted. The remaining moderate advisory is reported below, so this is not a claim of a vulnerability-free dependency tree.

## Build and test remediation

- Replaced the demo's Webpack builder with Angular's esbuild application builder and Vite development server. LESS, public assets, Zone.js runtime behavior, and static GitHub Pages output at `dist/client` are preserved.
- Library packaging remains Angular 20 partial compilation through ng-packagr, now using the smaller `@angular/build` wrapper.
- Removed Karma/Jasmine and migrated all 120 unit tests to Vitest 3.2.7 in Playwright Chromium. TestBed uses zoneless change detection; production behavior is unchanged. Angular 20 marks this unit-test builder experimental.
- Removed build-angular and its Webpack/css-loader/SockJS overrides. The installed tree no longer contains braces, Karma, Webpack, or webpack-dev-server, removing the paths affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Added LESS as an explicit development dependency and retained normal peer resolution. No overrides are shipped in the library manifest.

## Remaining moderate advisory

[GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) affects Vitest's redirect mocking functionality. npm reports four moderate entries through Vitest, @vitest/mocker, @vitest/browser, and @angular/build. These are development dependencies; consumer fixtures and the root production tree have no audit findings.

The upstream fix starts at Vitest 4.1.11, while Angular 20's installed test builder declares Vitest ^3.1.1 and uses its browser-provider API. Moving to the patched major requires a separate compatible testing-toolchain upgrade. The moderate finding remains visible under the existing high/critical gate.

## Retained overrides

| Parent | Override | Reason and validation |
| --- | --- | --- |
| Angular CLI 20/21 | @modelcontextprotocol/sdk 1.32.1 | Fix session/redirect advisories while preserving its major; CLI builds exercised. |
| Angular build 20/21 | Vite 7.3.7 | Fix Windows editor-launch escaping within the required major. |
| Angular build 22 consumer | Vite 8.3.3 | Same advisory, patched within its required major. |
| Vitest 3 | tinypool 2.1.2 | Fix prototype-pollution worker-option advisories [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr). |

The Tinypool override crosses a major boundary: [v2 drops Node 18 support](https://github.com/tinylibs/tinypool/releases/tag/v2.0.0); this workspace uses Node 24.21.0. Validation included all browser tests and running the eight existing insertion tests through both Vitest thread and fork pools. Keep this override until the supported test runner selects a patched worker pool itself.

Consumer locks are committed separately from the root lock. All consumers install and audit the same packed library with normal peer resolution.

## Verification

- Clean npm ci and npm ls --all.
- 116 library and 4 demo unit tests in Playwright Chromium.
- All 54 packed-consumer browser checks across Angular 20/21/22 with Zone.js and zoneless change detection.
- Six demo browser checks against both the previous Webpack build and the new production build, plus the GitHub Pages subpath build. Desktop and mobile screenshots were byte-for-byte identical before and after migration.
- Production library/demo builds and local package inspection.
- Library source edit -> ng-packagr watch -> demo live refresh, including restoration of the source edit.
- Full high/critical audit gate and production dependency audit.

These are local verification results. GitHub Actions must run on the pushed commit before its pipeline status can be confirmed.

## Reproduction

Use Node 24.21.0. Run `npm ci`, `npx playwright install chromium`, and `npm run verify:release`. On Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`.

`npm run verify` builds production output, runs unit tests and demo browser checks, then audits all dependencies at the high/critical threshold. `npm run verify:release` additionally checks the packed library against Angular 20/21/22. `npm audit --omit=dev` checks production dependencies separately.

To check GitHub Pages, run `npm run build:client:github-pages`, then run `npm run test:demo` with `DEMO_BASE=/angular-drag-drop-layout/` in the environment. Use `CHROME_BIN` to select a different Chromium executable for the demo or consumer Playwright checks; unit tests use Playwright's installed Chromium.

The next release is v2 because Angular 18/19 support was removed. This tooling migration does not change public APIs, peer ranges, or package versions; standard-version performs the synchronized major bump during release.
