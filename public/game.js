// game.js — lógica das fases do jogo.
// Fluxo: Aprender → Escutar → Praticar (completar + ordenar) → Desafio → Resultado.
// Extras: treino de Fala (speech recognition) e revisão de erros (no jogo e global).
// Todo conteúdo vindo da IA é inserido com textContent (nunca innerHTML).
import { salvarErroGlobal, proximaRevisaoGlobal, registrarRevisaoGlobal } from "./storage.js";

const $ = (id) => document.getElementById(id);

let ctx = null; // { go, speak, avisoInicio }
let jogo = null; // estado da partida atual
let revState = null; // estado de uma rodada de revisão em andamento

const PONTOS_QUIZ = 10;
const PONTOS_MISSAO = 20;

/* ---------- utilidades ---------- */
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function embaralharOpcoes(opcoes, correta) {
  const marcadas = opcoes.map((texto, i) => ({ texto, correta: i === correta }));
  const novas = embaralhar(marcadas);
  return { opcoes: novas.map((o) => o.texto), correta: novas.findIndex((o) => o.correta) };
}
function limpar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
function botaoOpcao(texto, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "opcao";
  b.textContent = texto;
  b.addEventListener("click", onClick);
  return b;
}
function palavrasDe(frase) {
  return (frase || "").replace(/[.?!,;:"]/g, "").trim().split(/\s+/).filter(Boolean);
}
function normalizar(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9'\s]/g, "").replace(/\s+/g, " ").trim();
}

/* ---------- contexto ---------- */
export function definirContexto(contexto) {
  ctx = contexto;
}

/* ============================================================
   Início da partida
   ============================================================ */
export function iniciarJogo(missao) {
  jogo = {
    missao,
    pontos: 0,
    vidas: 3,
    dialogo: dialogoValido(missao.dialogo) ? missao.dialogo : null,
    escutaFila: gerarEscuta(missao.aprender),
    escutaIdx: 0,
    escutaAcertos: 0,
    praticarFila: montarPraticar(missao),
    praticarIdx: 0,
    praticarAcertos: 0,
    etapaIdx: 0,
    missaoAcertos: 0,
    falarFila: gerarFalar(missao.aprender),
    falarIdx: 0,
    falarAcertos: 0,
    errosRevisao: [],
  };
  renderAprender();
  ctx.go("aprender");
}

export function jogarDeNovo() {
  if (jogo) iniciarJogo(jogo.missao);
}

/* ---------- geradores de conteúdo (client-side) ---------- */
function gerarEscuta(aprender) {
  const itens = (aprender || []).filter((a) => a.en && a.pt);
  if (itens.length < 4) return [];
  const pts = itens.map((a) => a.pt);
  return embaralhar(itens)
    .slice(0, Math.min(4, itens.length))
    .map((item) => {
      const distratores = embaralhar(pts.filter((p) => p !== item.pt)).slice(0, 3);
      const opcoes = embaralhar([item.pt, ...distratores]);
      return {
        en: item.en,
        opcoes,
        correta: opcoes.indexOf(item.pt),
        dica: `"${item.en}" significa ${item.pt}.`,
      };
    });
}

function gerarOrdenar(missao) {
  const frases = (missao.aprender || []).map((a) => a.exemplo).filter(Boolean);
  const boas = [...new Set(frases)].filter((f) => {
    const p = palavrasDe(f);
    return p.length >= 3 && p.length <= 8;
  });
  return embaralhar(boas)
    .slice(0, 2)
    .map((f) => {
      const p = palavrasDe(f);
      let emb = embaralhar(p);
      let t = 0;
      while (emb.join(" ") === p.join(" ") && t++ < 6) emb = embaralhar(p);
      return { tipo: "ordenar", palavras: emb, correta: p, fraseOriginal: f };
    });
}

function montarPraticar(missao) {
  const completar = (missao.praticar || []).map((p) => ({
    tipo: "completar",
    frase: p.frase,
    opcoes: p.opcoes,
    correta: p.correta,
    dica: p.dica,
  }));
  const ordenar = gerarOrdenar(missao);
  const nComp = Math.max(4, 6 - ordenar.length);
  const fila = embaralhar([...completar.slice(0, nComp), ...ordenar]);
  return fila.length ? fila : completar;
}

function gerarFalar(aprender) {
  return embaralhar((aprender || []).filter((a) => a.exemplo))
    .slice(0, 5)
    .map((a) => ({ alvo: a.exemplo, pt: a.pt, en: a.en }));
}

function dialogoValido(d) {
  return d && Array.isArray(d.linhas) && d.linhas.length >= 2 && d.linhas.every((l) => l && l.en);
}

/* ---------- registro de erros ---------- */
function registrarErroMC(texto, opcoes, correta, dica) {
  jogo.errosRevisao.push({ texto, opcoes: opcoes.slice(), correta, dica: dica || "" });
  salvarErroGlobal({ texto, opcoes, correta, dica, tema: jogo.missao.tema, cenario: jogo.missao.cenario });
}

/* ============================================================
   Fase 1 — Aprender
   ============================================================ */
function renderAprender() {
  const m = jogo.missao;
  $("aprender-titulo").textContent = m.titulo || m.tema;
  $("aprender-intro").textContent = m.introducao || "";

  const cont = $("aprender-cards");
  limpar(cont);
  m.aprender.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card-vocab";
    const emoji = document.createElement("div");
    emoji.className = "c-emoji";
    emoji.textContent = item.emoji || "📘";
    const en = document.createElement("div");
    en.className = "c-en";
    en.textContent = item.en || "";
    const pt = document.createElement("div");
    pt.className = "c-pt";
    pt.textContent = item.pt || "";
    const ex = document.createElement("div");
    ex.className = "c-ex";
    ex.textContent = item.exemplo || "";
    const audio = document.createElement("button");
    audio.type = "button";
    audio.className = "c-audio";
    audio.textContent = "🔊";
    audio.setAttribute("aria-label", `Ouvir "${item.en}"`);
    audio.addEventListener("click", () => ctx.speak(item.exemplo || item.en));
    card.append(emoji, en, pt, ex, audio);
    cont.appendChild(card);
  });

  $("btn-treinar-fala").onclick = () => treinarFala();
  $("btn-aprender-continuar").onclick = () => continuarDeAprender();
}

/* ============================================================
   Tela de quiz (compartilhada por Escutar, Praticar e Revisão)
   ============================================================ */
function quizRenderMC(cfg) {
  // cfg: { tag, progresso, contador, audioTexto, prompt, opcoes, correta, dica,
  //        onResponder(acertou), aoProximo, rotuloProximo }
  $("quiz-tag").textContent = cfg.tag;
  $("quiz-progresso").style.width = `${cfg.progresso * 100}%`;
  $("quiz-contador").textContent = cfg.contador;

  const audio = $("quiz-audio");
  if (cfg.audioTexto) {
    audio.hidden = false;
    audio.onclick = () => ctx.speak(cfg.audioTexto);
  } else {
    audio.hidden = true;
    audio.onclick = null;
  }

  $("quiz-prompt").textContent = cfg.prompt || "";
  $("quiz-ordenar").hidden = true;
  $("btn-quiz-verificar").hidden = true;

  const fb = $("quiz-feedback");
  fb.className = "feedback";
  limpar(fb);
  $("btn-quiz-proximo").hidden = true;

  const cont = $("quiz-opcoes");
  cont.hidden = false;
  limpar(cont);
  cfg.opcoes.forEach((op, idx) => {
    cont.appendChild(
      botaoOpcao(op, (e) => {
        const botoes = [...cont.querySelectorAll(".opcao")];
        botoes.forEach((b) => (b.disabled = true));
        const acertou = idx === cfg.correta;
        if (acertou) {
          e.currentTarget.classList.add("correta", "balanca");
          fb.className = "feedback ok";
          fb.textContent = "✅ Muito bem! +10";
        } else {
          e.currentTarget.classList.add("errada", "treme");
          botoes[cfg.correta]?.classList.add("correta");
          fb.className = "feedback erro";
          const l = document.createElement("span");
          l.textContent = "❌ Veja a resposta certa.";
          const d = document.createElement("span");
          d.className = "dica";
          d.textContent = cfg.dica || "";
          fb.append(l, d);
        }
        cfg.onResponder && cfg.onResponder(acertou);
        const prox = $("btn-quiz-proximo");
        prox.hidden = false;
        prox.textContent = cfg.rotuloProximo || "Continuar ➡️";
        prox.onclick = cfg.aoProximo;
      })
    );
  });
}

function quizRenderOrdenar(item, cfg) {
  $("quiz-tag").textContent = cfg.tag;
  $("quiz-progresso").style.width = `${cfg.progresso * 100}%`;
  $("quiz-contador").textContent = cfg.contador;
  $("quiz-audio").hidden = true;
  $("quiz-audio").onclick = null;
  $("quiz-prompt").textContent = "🔤 Toque nas palavras para formar a frase correta:";
  $("quiz-opcoes").hidden = true;
  limpar($("quiz-opcoes"));

  const fb = $("quiz-feedback");
  fb.className = "feedback";
  limpar(fb);
  $("btn-quiz-proximo").hidden = true;

  const wrap = $("quiz-ordenar");
  wrap.hidden = false;
  const resp = $("ordenar-resposta");
  const banco = $("ordenar-banco");
  const estado = { resposta: [], disponiveis: item.palavras.map((p) => ({ p, usado: false })), travado: false };

  function chip(texto, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = texto;
    b.addEventListener("click", onClick);
    return b;
  }
  function redraw() {
    limpar(resp);
    limpar(banco);
    estado.resposta.forEach((w, ri) => {
      resp.appendChild(
        chip(w.p, () => {
          if (estado.travado) return;
          w.usado = false;
          estado.resposta.splice(ri, 1);
          redraw();
        })
      );
    });
    estado.disponiveis.forEach((w) => {
      if (w.usado) return;
      banco.appendChild(
        chip(w.p, () => {
          if (estado.travado) return;
          w.usado = true;
          estado.resposta.push(w);
          redraw();
        })
      );
    });
  }
  redraw();

  const verificar = $("btn-quiz-verificar");
  verificar.hidden = false;
  verificar.textContent = "Verificar";
  verificar.onclick = () => {
    if (estado.resposta.length !== item.correta.length) {
      fb.className = "feedback erro";
      fb.textContent = "Use todas as palavras.";
      return;
    }
    estado.travado = true;
    const montada = estado.resposta.map((w) => w.p).join(" ");
    const acertou = normalizar(montada) === normalizar(item.correta.join(" "));
    if (acertou) {
      fb.className = "feedback ok";
      fb.textContent = "✅ Perfeito! +10";
    } else {
      fb.className = "feedback erro";
      const l = document.createElement("span");
      l.textContent = "❌ Quase! A frase certa é:";
      const d = document.createElement("span");
      d.className = "dica";
      d.textContent = `"${item.fraseOriginal}"`;
      fb.append(l, d);
    }
    cfg.onResponder && cfg.onResponder(acertou);
    verificar.hidden = true;
    const prox = $("btn-quiz-proximo");
    prox.hidden = false;
    prox.textContent = cfg.rotuloProximo || "Continuar ➡️";
    prox.onclick = cfg.aoProximo;
  };
}

/* ============================================================
   Fase 2 — Escutar
   ============================================================ */
function continuarDeAprender() {
  if (jogo.dialogo) {
    ctx.go("dialogo");
    renderDialogo();
  } else {
    irParaEscutarOuPraticar();
  }
}

function irParaEscutarOuPraticar() {
  if (jogo.escutaFila.length) {
    ctx.go("praticar");
    jogo.escutaIdx = 0;
    renderEscutar();
  } else {
    irParaPraticar();
  }
}

/* ============================================================
   Fase Diálogo (INTERATIVA) — o personagem fala, você responde
   montando a frase (arrastar palavras) ou falando no microfone.
   ============================================================ */

// É a vez do aluno? (campo voce, ou o "quem" indica "você")
function ehVoce(l) {
  if (typeof l.voce === "boolean") return l.voce;
  return /^(you|voc[eê]|eu|me|b|aluno|student)$/i.test((l.quem || "").trim());
}

function renderDialogo() {
  $("dialogo-titulo").textContent = jogo.dialogo.titulo || "Diálogo";
  limpar($("dialogo-chat"));
  jogo.dialogoIdx = 0;
  jogo.dialogoAcertos = 0;
  avancarDialogo();
}

function appendBolha(l, lado) {
  const chat = $("dialogo-chat");
  const bolha = document.createElement("div");
  bolha.className = `bolha ${lado}`;

  const quem = document.createElement("div");
  quem.className = "bolha-quem";
  quem.textContent = l.quem || (lado === "dir" ? "Você" : "");
  const en = document.createElement("div");
  en.className = "bolha-en";
  en.textContent = l.en || "";
  const pt = document.createElement("div");
  pt.className = "bolha-pt";
  pt.textContent = l.pt || "";
  const audio = document.createElement("button");
  audio.type = "button";
  audio.className = "bolha-audio";
  audio.textContent = "🔊";
  audio.setAttribute("aria-label", "Ouvir esta fala");
  audio.addEventListener("click", () => ctx.speak(l.en));

  bolha.append(quem, en, pt, audio);
  chat.appendChild(bolha);
  bolha.scrollIntoView({ block: "end", behavior: "smooth" });
  return bolha;
}

function avancarDialogo() {
  const linhas = jogo.dialogo.linhas;
  const i = jogo.dialogoIdx;
  const resp = $("dialogo-responder");
  const cont = $("btn-dialogo-continuar");

  if (i >= linhas.length) {
    resp.hidden = true;
    cont.hidden = false;
    cont.textContent = "Continuar ➡️";
    cont.onclick = () => irParaEscutarOuPraticar();
    return;
  }

  const l = linhas[i];
  if (!ehVoce(l)) {
    // Turno do personagem: mostra a fala e toca o áudio.
    resp.hidden = true;
    appendBolha(l, "esq");
    ctx.speak(l.en);
    cont.hidden = false;
    const proxEhVoce = linhas[i + 1] && ehVoce(linhas[i + 1]);
    cont.textContent = proxEhVoce ? "Responder ✍️" : "Continuar ➡️";
    cont.onclick = () => {
      jogo.dialogoIdx++;
      avancarDialogo();
    };
  } else {
    // Turno do aluno: montar a resposta.
    cont.hidden = true;
    mostrarResponder(l);
  }
}

function mostrarResponder(l) {
  const resp = $("dialogo-responder");
  resp.hidden = false;
  $("dialogo-hint").textContent = `💬 Sua vez — responda: "${l.pt || ""}"`;

  const fb = $("dialogo-feedback");
  fb.className = "feedback";
  limpar(fb);

  const palavras = palavrasDe(l.en);
  const respArea = $("dialogo-resposta");
  const banco = $("dialogo-banco");
  const estado = { resposta: [], disp: [], travado: false };
  let emb = embaralhar(palavras);
  let t = 0;
  while (emb.join(" ") === palavras.join(" ") && t++ < 6) emb = embaralhar(palavras);
  estado.disp = emb.map((p) => ({ p, usado: false }));

  function chip(texto, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = texto;
    b.addEventListener("click", onClick);
    return b;
  }
  function redraw() {
    limpar(respArea);
    limpar(banco);
    estado.resposta.forEach((w, ri) => {
      respArea.appendChild(
        chip(w.p, () => {
          if (estado.travado) return;
          w.usado = false;
          estado.resposta.splice(ri, 1);
          redraw();
        })
      );
    });
    estado.disp.forEach((w) => {
      if (w.usado) return;
      banco.appendChild(
        chip(w.p, () => {
          if (estado.travado) return;
          w.usado = true;
          estado.resposta.push(w);
          redraw();
        })
      );
    });
  }
  redraw();

  $("btn-dialogo-verificar").onclick = () => {
    const montada = estado.resposta.map((w) => w.p).join(" ");
    if (estado.resposta.length !== palavras.length) {
      fb.className = "feedback erro";
      fb.textContent = "Use todas as palavras.";
      return;
    }
    if (normalizar(montada) === normalizar(l.en)) {
      concluirResposta(l, true);
    } else {
      fb.className = "feedback erro";
      fb.textContent = "❌ Quase! Tente reordenar as palavras.";
    }
  };

  $("btn-dialogo-mic").onclick = () => falarResposta(l);
  $("btn-dialogo-ver").onclick = () => concluirResposta(l, false);
}

function concluirResposta(l, comPonto) {
  appendBolha(l, "dir");
  if (comPonto) {
    jogo.pontos += PONTOS_QUIZ;
    jogo.dialogoAcertos++;
  }
  $("dialogo-responder").hidden = true;
  jogo.dialogoIdx++;
  avancarDialogo();
}

function falarResposta(l) {
  const fb = $("dialogo-feedback");
  if (!reconhecimentoDisponivel()) {
    fb.className = "feedback";
    fb.textContent = "🎧 Voz indisponível aqui. Monte a resposta com as palavras.";
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 3;

  const btn = $("btn-dialogo-mic");
  btn.textContent = "🔴 Ouvindo…";
  btn.disabled = true;
  fb.className = "feedback";
  fb.textContent = "";

  rec.onresult = (e) => {
    const alts = [...e.results[0]].map((r) => r.transcript);
    const melhor = Math.max(...alts.map((a) => razaoFala(a, l.en)));
    btn.textContent = "🎤 Falar";
    btn.disabled = false;
    if (melhor >= 0.6) {
      concluirResposta(l, true);
    } else {
      fb.className = "feedback erro";
      const s = document.createElement("span");
      s.textContent = `Ouvi: "${alts[0] || "—"}". Tente de novo ou monte com as palavras.`;
      fb.append(s);
    }
  };
  rec.onerror = () => {
    fb.className = "feedback erro";
    fb.textContent = "Não consegui ouvir. Tente de novo.";
    btn.textContent = "🎤 Falar";
    btn.disabled = false;
  };
  rec.onend = () => {
    if (btn.textContent === "🔴 Ouvindo…") {
      btn.textContent = "🎤 Falar";
      btn.disabled = false;
    }
  };
  try {
    rec.start();
  } catch {
    btn.textContent = "🎤 Falar";
    btn.disabled = false;
  }
}

function renderEscutar() {
  const fila = jogo.escutaFila;
  const i = jogo.escutaIdx;
  if (i >= fila.length) {
    irParaPraticar();
    return;
  }
  const q = fila[i];
  ctx.speak(q.en); // toca ao mostrar
  quizRenderMC({
    tag: "Fase 2 · Escutar",
    progresso: i / fila.length,
    contador: `Escuta ${i + 1} de ${fila.length}`,
    audioTexto: q.en,
    prompt: "🎧 Ouça e escolha o significado:",
    opcoes: q.opcoes,
    correta: q.correta,
    dica: q.dica,
    rotuloProximo: i + 1 >= fila.length ? "Ir para praticar ➡️" : "Continuar ➡️",
    onResponder: (acertou) => {
      if (acertou) {
        jogo.pontos += PONTOS_QUIZ;
        jogo.escutaAcertos++;
      } else {
        registrarErroMC(`🎧 O que significa "${q.en}"?`, q.opcoes, q.correta, q.dica);
      }
    },
    aoProximo: () => {
      jogo.escutaIdx++;
      renderEscutar();
    },
  });
}

/* ============================================================
   Fase 3 — Praticar (completar + ordenar)
   ============================================================ */
function irParaPraticar() {
  ctx.go("praticar");
  jogo.praticarIdx = 0;
  renderPraticar();
}

function renderPraticar() {
  const fila = jogo.praticarFila;
  const i = jogo.praticarIdx;
  if (i >= fila.length) {
    iniciarMissaoFase();
    return;
  }
  const item = fila[i];
  const base = {
    tag: "Fase 3 · Praticar",
    progresso: i / fila.length,
    contador: `Pergunta ${i + 1} de ${fila.length}`,
    rotuloProximo: i + 1 >= fila.length ? "Ir para o desafio 🚀" : "Continuar ➡️",
    aoProximo: () => {
      jogo.praticarIdx++;
      renderPraticar();
    },
  };

  if (item.tipo === "ordenar") {
    quizRenderOrdenar(item, {
      ...base,
      onResponder: (acertou) => {
        if (acertou) {
          jogo.pontos += PONTOS_QUIZ;
          jogo.praticarAcertos++;
        }
      },
    });
  } else {
    quizRenderMC({
      ...base,
      audioTexto: null,
      prompt: item.frase,
      opcoes: item.opcoes,
      correta: item.correta,
      dica: item.dica,
      onResponder: (acertou) => {
        if (acertou) {
          jogo.pontos += PONTOS_QUIZ;
          jogo.praticarAcertos++;
        } else {
          registrarErroMC(item.frase, item.opcoes, item.correta, item.dica);
        }
      },
    });
  }
}

/* ============================================================
   Fase 4 — Desafio (a missão)
   ============================================================ */
function iniciarMissaoFase() {
  ctx.go("missao");
  renderVidas();
  renderMissao(true);
}

function renderVidas() {
  $("missao-vidas").textContent = "❤️".repeat(jogo.vidas) + "🖤".repeat(3 - jogo.vidas);
}

function renderMissao(comAbertura = false) {
  const etapas = jogo.missao.missao.etapas;
  const total = etapas.length;
  const i = jogo.etapaIdx;
  if (i >= total) {
    concluirMissao();
    return;
  }
  const etapa = etapas[i];
  $("missao-progresso").style.width = `${(i / total) * 100}%`;
  const abertura = comAbertura && i === 0 ? `${jogo.missao.missao.abertura}\n\n` : "";
  $("missao-narracao").textContent = abertura + (etapa.narracao || "");
  $("missao-pergunta").textContent = etapa.pergunta || "";

  const fb = $("missao-feedback");
  fb.className = "feedback";
  limpar(fb);
  $("btn-missao-proximo").hidden = true;

  const cont = $("missao-opcoes");
  limpar(cont);
  etapa.opcoes.forEach((op, idx) => {
    cont.appendChild(botaoOpcao(op, (e) => responderMissao(e.currentTarget, idx, etapa)));
  });
}

function responderMissao(botao, idx, etapa) {
  const botoes = [...$("missao-opcoes").querySelectorAll(".opcao")];
  botoes.forEach((b) => (b.disabled = true));
  const fb = $("missao-feedback");
  const acertou = idx === etapa.correta;

  if (acertou) {
    botao.classList.add("correta", "balanca");
    jogo.pontos += PONTOS_MISSAO;
    jogo.missaoAcertos++;
    fb.className = "feedback ok";
    fb.textContent = "✅ Boa! +20";
    avancarMissao();
  } else {
    botao.classList.add("errada", "treme");
    botoes[etapa.correta]?.classList.add("correta");
    jogo.vidas--;
    renderVidas();
    fb.className = "feedback erro";
    const linha = document.createElement("span");
    linha.textContent = jogo.vidas > 0 ? "❌ Você perdeu uma vida." : "❌ Última vida perdida…";
    const dica = document.createElement("span");
    dica.className = "dica";
    dica.textContent = etapa.feedback_erro || "";
    fb.append(linha, dica);
    registrarErroMC(`${etapa.narracao || ""} ${etapa.pergunta || ""}`.trim(), etapa.opcoes, etapa.correta, etapa.feedback_erro);

    if (jogo.vidas <= 0) {
      const prox = $("btn-missao-proximo");
      prox.hidden = false;
      prox.textContent = "Ver resultado";
      prox.onclick = () => ctx.go("fim");
      return;
    }
    avancarMissao();
  }
}

function avancarMissao() {
  const prox = $("btn-missao-proximo");
  prox.hidden = false;
  const ultima = jogo.etapaIdx + 1 >= jogo.missao.missao.etapas.length;
  prox.textContent = ultima ? "Concluir missão 🏁" : "Continuar ➡️";
  prox.onclick = () => {
    jogo.etapaIdx++;
    renderMissao();
  };
}

function concluirMissao() {
  $("missao-progresso").style.width = "100%";
  mostrarResultado();
}

/* ============================================================
   Resultado e revisão do jogo
   ============================================================ */
function calcularEstrelas() {
  const total = jogo.escutaFila.length + jogo.praticarFila.length + jogo.missao.missao.etapas.length;
  const acertos = jogo.escutaAcertos + jogo.praticarAcertos + jogo.missaoAcertos;
  const razao = total ? acertos / total : 0;
  if (razao >= 0.85) return 3;
  if (razao >= 0.6) return 2;
  return 1;
}

function mostrarResultado() {
  const estrelas = calcularEstrelas();
  $("resultado-estrelas").textContent = "⭐".repeat(estrelas) + "☆".repeat(3 - estrelas);
  $("resultado-narrativa-final").textContent = jogo.missao.missao.final || "Missão concluída!";
  $("resultado-pontos").textContent = `${jogo.pontos} pontos`;

  const det = $("resultado-detalhe");
  limpar(det);
  const linhas = [
    `Escutar: ${jogo.escutaAcertos}/${jogo.escutaFila.length} acertos`,
    `Praticar: ${jogo.praticarAcertos}/${jogo.praticarFila.length} acertos`,
    `Desafio: ${jogo.missaoAcertos}/${jogo.missao.missao.etapas.length} acertos`,
  ];
  linhas.forEach((t) => {
    const d = document.createElement("div");
    d.textContent = t;
    det.appendChild(d);
  });

  $("bloco-revisao").hidden = jogo.errosRevisao.length === 0;
  ctx.go("resultado");
}

/* ---------- Rodada de revisão (genérica) ---------- */
function rodarRevisao(itens, modo) {
  // itens: [{ chave?, texto, opcoes, correta, dica }]
  revState = { lista: itens, idx: 0, acertos: 0, modo };
  ctx.go("praticar");
  renderRevisao();
}

function renderRevisao() {
  const { lista, idx, modo } = revState;
  if (idx >= lista.length) {
    terminarRevisao();
    return;
  }
  const q = lista[idx];
  quizRenderMC({
    tag: "🔁 Revisão",
    progresso: idx / lista.length,
    contador: `Revisão ${idx + 1} de ${lista.length}`,
    audioTexto: null,
    prompt: q.texto,
    opcoes: q.opcoes,
    correta: q.correta,
    dica: q.dica,
    rotuloProximo: idx + 1 >= lista.length ? "Terminar revisão 🏁" : "Continuar ➡️",
    onResponder: (acertou) => {
      if (acertou) revState.acertos++;
      if (modo === "global" && q.chave) registrarRevisaoGlobal(q.chave, acertou);
    },
    aoProximo: () => {
      revState.idx++;
      renderRevisao();
    },
  });
}

function terminarRevisao() {
  const modo = revState.modo;
  const acertos = revState.acertos;
  const total = revState.lista.length;
  revState = null;
  if (modo === "global") {
    ctx.go("inicio");
    ctx.avisoInicio(`Revisão concluída: ${acertos}/${total} acertos. 👏`, true);
  } else {
    mostrarResultado();
  }
}

/** Revisão dos erros desta partida (chamada no resultado). */
export function iniciarRevisao() {
  if (!jogo || jogo.errosRevisao.length === 0) return;
  const itens = embaralhar(jogo.errosRevisao).map((q) => {
    const emb = embaralharOpcoes(q.opcoes, q.correta);
    return { texto: q.texto, opcoes: emb.opcoes, correta: emb.correta, dica: q.dica };
  });
  rodarRevisao(itens, "jogo");
}

/** Revisão dos erros acumulados de todas as partidas (chamada no início). */
export function iniciarRevisaoGlobal() {
  const lista = proximaRevisaoGlobal(10);
  if (!lista.length) {
    ctx.avisoInicio("Você ainda não tem erros para revisar. Jogue uma missão primeiro! 🎯");
    return;
  }
  const itens = lista.map((e) => {
    const emb = embaralharOpcoes(e.opcoes, e.correta);
    return { chave: e.chave, texto: e.texto, opcoes: emb.opcoes, correta: emb.correta, dica: e.dica };
  });
  rodarRevisao(itens, "global");
}

/* ============================================================
   Treino de Fala (Web Speech Recognition)
   ============================================================ */
function reconhecimentoDisponivel() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function razaoFala(transcricao, alvo) {
  const t = normalizar(transcricao).split(" ").filter(Boolean);
  const a = normalizar(alvo).split(" ").filter(Boolean);
  if (!a.length) return 0;
  const resto = [...t];
  let ok = 0;
  a.forEach((w) => {
    const idx = resto.indexOf(w);
    if (idx >= 0) {
      ok++;
      resto.splice(idx, 1);
    }
  });
  return ok / a.length;
}

function treinarFala() {
  jogo.falarIdx = 0;
  $("btn-falar-microfone").onclick = () => falarMicrofone();
  $("btn-falar-ouvir").onclick = () => ctx.speak(jogo.falarFila[jogo.falarIdx]?.alvo);
  $("btn-falar-pular").onclick = () => proximoFalar();
  $("btn-falar-proximo").onclick = () => proximoFalar();
  $("btn-falar-voltar").onclick = () => ctx.go("aprender");
  ctx.go("falar");
  renderFalar();
}

function renderFalar() {
  const fila = jogo.falarFila;
  const i = jogo.falarIdx;
  const fb = $("falar-feedback");
  fb.className = "feedback";
  fb.textContent = "";
  $("btn-falar-proximo").hidden = true;

  if (!fila.length) {
    $("falar-contador").textContent = "";
    $("falar-prompt").textContent = "Sem frases para treinar nesta missão.";
    $("falar-alvo").textContent = "";
    $("falar-traducao").textContent = "";
    ["btn-falar-microfone", "btn-falar-ouvir", "btn-falar-pular"].forEach((id) => ($(id).hidden = true));
    return;
  }
  if (i >= fila.length) {
    $("falar-contador").textContent = "";
    $("falar-prompt").textContent = `Treino concluído! 👏 (${jogo.falarAcertos}/${fila.length})`;
    $("falar-alvo").textContent = "";
    $("falar-traducao").textContent = "";
    ["btn-falar-microfone", "btn-falar-ouvir", "btn-falar-pular"].forEach((id) => ($(id).hidden = true));
    return;
  }
  const q = fila[i];
  $("falar-contador").textContent = `Fala ${i + 1} de ${fila.length}`;
  $("falar-prompt").textContent = "🎤 Leia em voz alta:";
  $("falar-alvo").textContent = q.alvo;
  $("falar-traducao").textContent = q.pt ? `(${q.pt})` : "";
  $("btn-falar-microfone").hidden = false;
  $("btn-falar-microfone").textContent = "🎤 Falar";
  $("btn-falar-microfone").disabled = false;
  $("btn-falar-ouvir").hidden = false;
  $("btn-falar-pular").hidden = false;
}

function proximoFalar() {
  jogo.falarIdx++;
  renderFalar();
}

function falarMicrofone() {
  const fb = $("falar-feedback");
  const alvo = jogo.falarFila[jogo.falarIdx]?.alvo;
  if (!alvo) return;

  if (!reconhecimentoDisponivel()) {
    fb.className = "feedback";
    fb.textContent = "🎧 Reconhecimento de voz indisponível neste navegador. Ouça e siga.";
    $("btn-falar-proximo").hidden = false;
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 3;

  const btn = $("btn-falar-microfone");
  btn.textContent = "🔴 Ouvindo…";
  btn.disabled = true;
  fb.className = "feedback";
  fb.textContent = "";

  rec.onresult = (e) => {
    const alts = [...e.results[0]].map((r) => r.transcript);
    const melhor = Math.max(...alts.map((a) => razaoFala(a, alvo)));
    if (melhor >= 0.6) {
      jogo.falarAcertos++;
      jogo.pontos += PONTOS_QUIZ;
      fb.className = "feedback ok";
      fb.textContent = `✅ Muito bem! Ouvi: "${alts[0]}"`;
    } else {
      fb.className = "feedback erro";
      const l = document.createElement("span");
      l.textContent = `Ouvi: "${alts[0] || "—"}". Tente de novo ou siga.`;
      const d = document.createElement("span");
      d.className = "dica";
      d.textContent = `Alvo: "${alvo}"`;
      fb.append(l, d);
    }
    $("btn-falar-proximo").hidden = false;
    btn.textContent = "🎤 Tentar de novo";
    btn.disabled = false;
  };
  rec.onerror = () => {
    fb.className = "feedback erro";
    fb.textContent = "Não consegui ouvir. Verifique o microfone e tente de novo.";
    btn.textContent = "🎤 Falar";
    btn.disabled = false;
    $("btn-falar-proximo").hidden = false;
  };
  rec.onend = () => {
    if (btn.textContent === "🔴 Ouvindo…") {
      btn.textContent = "🎤 Falar";
      btn.disabled = false;
    }
  };
  try {
    rec.start();
  } catch {
    btn.textContent = "🎤 Falar";
    btn.disabled = false;
  }
}
