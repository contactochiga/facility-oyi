# Wave 9 dependency review — 2026-09-26

Next's nested PostCSS 8.4.31 is replaced by a scoped override to 8.5.28. `npm install --package-lock-only --ignore-scripts`, `npm ci --ignore-scripts`, `npm ls postcss --all`, production build, lint, release checks and Core-loader smoke pass. All PostCSS paths resolve to 8.5.28. Audit findings fall from five to three (two high, one critical); this is not a security-clean release.

The critical remaining installer path is Capacitor CLI 6.2.2 → tar 6.2.1. The traced CLI consumer extracts its bundled native templates, not arbitrary web-request uploads. That narrows exposure but does not waive the advisory or supply-chain risk. An experimental tar 7.5.22 override broke the actual CLI extractor's default-import contract and was removed completely. Do not force this override merely to clear audit output. A maintained compatible CLI/extractor upgrade and native-project validation remain required. `node scripts/wave9-capacitor-template-smoke.mjs` now exercises all five bundled archives; its passing result is compatibility evidence only.

Remaining audit nodes are Capacitor CLI, tar and sharp. No major Capacitor/native-platform migration is claimed here. No machine-local Twin dependency was introduced. No deployment or default-branch merge was performed.
