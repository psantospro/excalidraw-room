// Injeta o painel "Texto -> diagrama" no index.html gerado pelo build do app.
// Roda na etapa de build (node disponivel). Falha se o HTML nao tiver </body>.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HTML = "excalidraw-app/build/index.html";
const TAG = '<script src="/gerador.js" defer></script>';

if (!existsSync(HTML)) {
  console.error(`[gerador] ${HTML} nao encontrado; o build mudou de layout?`);
  process.exit(1);
}

let html = readFileSync(HTML, "utf8");

if (html.includes("/gerador.js")) {
  console.log("[gerador] ja injetado");
  process.exit(0);
}

if (!html.includes("</body>")) {
  console.error("[gerador] index.html sem </body>; abortando para nao publicar sem o painel");
  process.exit(1);
}

html = html.replace("</body>", `${TAG}\n  </body>`);
writeFileSync(HTML, html, "utf8");
console.log("[gerador] script injetado no index.html");
