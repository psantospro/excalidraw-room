// Ponte de agente para o Excalidraw self-hosted (srgeek).
//
// Expoe a API imperativa em `window.__EXC` para que um agente consiga ler e
// escrever a cena de forma deterministica (updateScene / getSceneElements) em vez
// de simular cliques e arrastos no canvas.
//
// Roda no build (ver Dockerfile). Se o anchor nao existir, o build FALHA: melhor
// quebrar do que publicar uma imagem sem a ponte por causa de uma mudanca do upstream.

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "excalidraw-app/App.tsx";
const MARKER = "// >>> agent bridge (srgeek) >>>";
const ANCHOR = "  const renderCustomStats = (";

const BRIDGE = `${MARKER}
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    (window as any).__EXC = {
      version: 1,
      getSceneElements: () => excalidrawAPI.getSceneElements(),
      getSceneElementsIncludingDeleted: () =>
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      getAppState: () => excalidrawAPI.getAppState(),
      getFiles: () => excalidrawAPI.getFiles(),
      updateScene: (scene: any) => excalidrawAPI.updateScene(scene),
      scrollToContent: (target: any, opts?: any) =>
        excalidrawAPI.scrollToContent(target, opts),
      refresh: () => excalidrawAPI.refresh(),
      setToast: (message: string) => excalidrawAPI.setToast({ message }),
    };
  }, [excalidrawAPI]);
  // <<< agent bridge <<<

`;

const src = readFileSync(FILE, "utf8");

if (src.includes(MARKER)) {
  console.log("[agent-bridge] ja aplicado, nada a fazer");
  process.exit(0);
}

const occurrences = src.split(ANCHOR).length - 1;
if (occurrences !== 1) {
  console.error(
    `[agent-bridge] anchor "${ANCHOR.trim()}" encontrado ${occurrences}x (esperado 1). Abortando.`,
  );
  process.exit(1);
}

writeFileSync(FILE, src.replace(ANCHOR, BRIDGE + ANCHOR), "utf8");
console.log("[agent-bridge] window.__EXC exposto");
