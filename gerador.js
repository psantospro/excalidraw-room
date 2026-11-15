// Gerador "texto -> diagrama" para o Excalidraw self-hosted.
// O modelo devolve JSON (titulo + passos + ligacoes); este arquivo calcula o
// posicionamento e aplica via window.__EXC. O modelo nunca decide coordenada.
(() => {
  if (window.__GERADOR) return;

  const FS = 20;            // fonte do corpo
  const LH = 1.25;          // altura de linha
  const W = 760;            // largura da caixa
  const H = 80;             // altura da caixa
  const GAP = 24;           // espaco entre caixas
  const X = 40;             // margem esquerda
  const Y0 = 100;           // topo da primeira caixa

  let seq = 0;
  const uid = (p) => `${p}-${Date.now().toString(36)}-${seq++}`;
  const rnd = () => Math.floor(Math.random() * 2 ** 31);

  function el(type, x, y, w, h, extra) {
    return Object.assign(
      {
        id: uid(type), type, x, y, width: w, height: h, angle: 0,
        strokeColor: "#1e1e1e", backgroundColor: "transparent",
        fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
        roughness: 1, opacity: 100, groupIds: [], frameId: null,
        roundness: null, seed: rnd(), version: 1, versionNonce: rnd(),
        isDeleted: false, boundElements: null, updated: Date.now(),
        link: null, locked: false,
      },
      extra || {},
    );
  }

  const textW = (lines, fs) => Math.round(Math.max(...lines.map((l) => l.length)) * fs * 0.56);
  const textH = (n, fs) => Math.round(n * fs * LH);

  function layout(spec) {
    const steps = (spec.steps || []).slice(0, 12);
    const ys = steps.map((_, i) => Y0 + i * (H + GAP));
    const els = [];

    const title = (spec.title || "").trim();
    if (title) {
      els.push(el("text", X, Y0 - 48, W, textH(1, 20), {
        text: title, originalText: title, fontSize: 20, fontFamily: 1,
        textAlign: "center", verticalAlign: "top", containerId: null, lineHeight: LH,
      }));
    }

    steps.forEach((s, i) => {
      const rid = uid("rect");
      const tid = uid("txt");
      els.push(el("rectangle", X, ys[i], W, H, {
        id: rid, roundness: { type: 3 },
        boundElements: [{ type: "text", id: tid }],
      }));
      const label = /^\d+[.)]\s/.test(s.label || "") ? s.label : `${i + 1}. ${s.label || ""}`;
      const lines = [label, s.detail || ""].filter(Boolean);
      const h = textH(lines.length, FS);
      els.push(el("text", X + 8, ys[i] + (H - h) / 2, W - 16, h, {
        id: tid,
        text: lines.join("\n"), originalText: lines.join("\n"),
        fontSize: FS, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
        containerId: rid, lineHeight: LH,
      }));
    });

    const links = (spec.links && spec.links.length)
      ? spec.links
      : steps.slice(1).map((_, i) => ({ from: i + 1, to: i + 2 }));

    let elbow = 0;
    for (const lk of links) {
      const a = Number(lk.from) - 1;
      const b = Number(lk.to) - 1;
      if (a < 0 || b < 0 || a >= steps.length || b >= steps.length || a === b) continue;

      if (b === a + 1) {
        const y1 = ys[a] + H;
        els.push(el("arrow", X + W / 2, y1, 0, ys[b] - y1, {
          points: [[0, 0], [0, ys[b] - y1]], lastCommittedPoint: null,
          startBinding: null, endBinding: null,
          startArrowhead: null, endArrowhead: "arrow", roundness: { type: 2 },
        }));
      } else {
        const rx = X + W + 70 + elbow * 54;
        elbow += 1;
        const y1 = ys[a] + H / 2;
        const y2 = ys[b] + H / 2;
        els.push(el("arrow", X + W, y1, rx - (X + W), Math.abs(y2 - y1), {
          points: [[0, 0], [rx - (X + W), 0], [rx - (X + W), y2 - y1], [0, y2 - y1]],
          lastCommittedPoint: null, startBinding: null, endBinding: null,
          startArrowhead: null, endArrowhead: "arrow", roundness: { type: 2 },
        }));
        if (lk.label) {
          const w = textW([lk.label], FS);
          els.push(el("text", rx + 12, (y1 + y2) / 2 - textH(1, FS) / 2, w, textH(1, FS), {
            text: lk.label, originalText: lk.label, fontSize: FS, fontFamily: 1,
            textAlign: "left", verticalAlign: "top", containerId: null, lineHeight: LH,
          }));
        }
      }
    }
    return els;
  }

  // ---------- historico local (protege contra geracao que substitui tudo) ----------
  const HIST = "__G_hist_v1";

  function readHist() {
    try { return JSON.parse(localStorage.getItem(HIST) || "[]"); } catch { return []; }
  }

  function pushHist() {
    const api = window.__EXC;
    if (!api) return;
    const items = readHist();
    items.push({
      t: Date.now(),
      elements: api.getSceneElements(),
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
    });
    localStorage.setItem(HIST, JSON.stringify(items.slice(-5)));
  }

  function popHist() {
    const items = readHist();
    const last = items.pop() || null;
    localStorage.setItem(HIST, JSON.stringify(items));
    return last;
  }

  function apply(spec) {
    const api = window.__EXC;
    if (!api) throw new Error("ponte __EXC ausente");
    if (!spec.steps || !spec.steps.length) throw new Error("nenhum passo");
    pushHist();
    const els = layout(spec);
    api.updateScene({
      elements: els,
      appState: { viewBackgroundColor: "#ffffff" },
      captureUpdate: "IMMEDIATELY",
    });
    try { api.scrollToContent(els, { fitToContent: true, animate: true }); } catch (_) {}
    setTimeout(() => {
      try { api.scrollToContent(els, { fitToContent: true, animate: true }); } catch (_) {}
    }, 180);
    return els.length;
  }

  // Fallback sem IA: cada linha vira uma caixa; "Rotulo - detalhe" separa os dois.
  function parseText(text) {
    const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const steps = lines.map((l) => {
      const m = l.split(/\s+[-–—]\s+/);
      return { label: m[0], detail: m.slice(1).join(" ") };
    });
    return { title: "", steps };
  }

  async function callAI(text) {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: buildMessages(text),
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${body.slice(0, 120)}`);
    const content = JSON.parse(body)?.choices?.[0]?.message?.content ?? "";
    return normalize(JSON.parse(content));
  }

  function buildMessages(text) {
    const system = [
      "Voce transforma documentos em diagramas de fluxo enxutos.",
      "Responda SOMENTE com JSON valido, sem markdown, neste formato exato:",
      '{"title":"...","steps":[{"label":"...","detail":"..."}],"links":[{"from":1,"to":2,"label":""}]}',
      "Regras obrigatorias:",
      "- Entre 3 e 7 passos. O diagrama precisa caber numa coluna unica sem aperto.",
      "- title: ate 55 caracteres, sem ponto final.",
      "- label: ate 45 caracteres, sem numeracao (ela e adicionada depois).",
      "- detail: ate 60 caracteres; deixe vazio quando o label ja bastar.",
      "- Extraia apenas as ideias essenciais. Descarte exemplos, datas, nomes e detalhes acessorios.",
      "- links: apenas quando o fluxo NAO for sequencial (retorno, atalho). from/to sao numeros 1-based.",
      "- Use o idioma do documento.",
    ].join("\n");
    return [
      { role: "system", content: system },
      { role: "user", content: "Documento:\n\n" + String(text || "").slice(0, 12000) },
    ];
  }

  // Garante os limites mesmo se o modelo desobedecer.
  function normalize(spec) {
    const clean = (s, max) =>
      String(s ?? "").replace(/^\s*\d+[.)]\s*/, "").replace(/\s+/g, " ").trim().slice(0, max);

    const steps = (spec.steps || [])
      .slice(0, 7)
      .map((s) => ({ label: clean(s.label, 45), detail: clean(s.detail, 60) }))
      .filter((s) => s.label);

    if (steps.length < 2) throw new Error("o modelo devolveu passos insuficientes");

    const links = (spec.links || [])
      .filter((l) => Number.isFinite(+l.from) && Number.isFinite(+l.to))
      .filter((l) => +l.from >= 1 && +l.from <= steps.length && +l.to >= 1 && +l.to <= steps.length)
      .slice(0, 4)
      .map((l) => ({ from: +l.from, to: +l.to, label: clean(l.label, 28) }));

    return { title: clean(spec.title, 55), steps, links };
  }

  // ---------- interface ----------
  const btn = document.createElement("button");
  btn.textContent = "Texto → diagrama";
  Object.assign(btn.style, {
    position: "fixed", right: "16px", bottom: "76px", zIndex: 1000,
    padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
    background: "#6965db", color: "#fff", border: "none",
    font: "600 14px system-ui, sans-serif", boxShadow: "0 4px 14px rgba(0,0,0,.35)",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed", right: "16px", bottom: "124px", zIndex: 1000,
    width: "340px", display: "none", padding: "12px", borderRadius: "12px",
    background: "#232329", color: "#e6e6e6", border: "1px solid #3a3a44",
    font: "13px system-ui, sans-serif", boxShadow: "0 8px 28px rgba(0,0,0,.45)",
  });
  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">Texto → diagrama</div>
    <textarea id="__G_txt" rows="7" placeholder="Cole ou escreva o texto. Uma ideia por linha." style="width:100%;box-sizing:border-box;background:#1b1b20;color:#e6e6e6;border:1px solid #3a3a44;border-radius:8px;padding:8px;font:13px ui-monospace,monospace;resize:vertical"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button id="__G_ai" style="flex:1;padding:8px;border-radius:8px;border:none;background:#6965db;color:#fff;font-weight:600;cursor:pointer">Gerar com IA</button>
      <button id="__G_plain" style="padding:8px;border-radius:8px;border:1px solid #3a3a44;background:transparent;color:#e6e6e6;cursor:pointer">Sem IA</button>
    </div>
    <button id="__G_back" style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:1px solid #3a3a44;background:transparent;color:#b9b9c6;cursor:pointer;font-size:12px">Voltar versão anterior</button>
    <div id="__G_msg" style="margin-top:8px;opacity:.75;min-height:18px"></div>
  `;

  const txt = panel.querySelector("#__G_txt");
  const msg = panel.querySelector("#__G_msg");
  const say = (t) => { msg.textContent = t; };

  btn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  panel.querySelector("#__G_plain").addEventListener("click", () => {
    try {
      say(`desenhado (${apply(parseText(txt.value || ""))} elementos)`);
    } catch (e) { say("erro: " + e.message); }
  });

  panel.querySelector("#__G_back").addEventListener("click", () => {
    const prev = popHist();
    if (!prev) { say("não há versão anterior"); return; }
    try {
      window.__EXC.updateScene({
        elements: prev.elements,
        appState: prev.appState,
        captureUpdate: "IMMEDIATELY",
      });
      say(`versão de ${new Date(prev.t).toLocaleTimeString("pt-BR")} restaurada`);
    } catch (e) { say("erro: " + e.message); }
  });

  panel.querySelector("#__G_ai").addEventListener("click", async () => {
    say("gerando…");
    try {
      const spec = await callAI(txt.value || "");
      say(`desenhado (${apply(spec)} elementos)`);
    } catch (e) { say("erro: " + e.message); }
  });

  document.body.append(btn, panel);
  window.__GERADOR = { apply, parseText, layout, callAI };
})();
