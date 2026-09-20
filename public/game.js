// game.js — lógica das fases do jogo.
// Recebe um "ctx" do app.js com: go(tela), speak(texto), aoResultado().
// Todo conteúdo vindo da IA é inserido com textContent (nunca innerHTML).

const $ = (id) => document.getElementById(id);

let ctx = null; // { go, speak }
let jogo = null; // estado da partida atual

const PONTOS_PRATICAR = 10;
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

// Embaralha opções mantendo a referência da resposta correta.
function embaralharOpcoes(opcoes, correta) {
  const marcadas = opcoes.map((texto, i) => ({ texto, correta: i === correta }));
  const novas = embaralhar(marcadas);
  return {
    opcoes: novas.map((o) => o.texto),
    correta: novas.findIndex((o) => o.correta),
  };
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

/* ============================================================
   Início da partida
   ============================================================ */

export function iniciarJogo(missao, contexto) {
  ctx = contexto;
  jogo = {
    missao,
    pontos: 0,
    vidas: 3,
    praticarIdx: 0,
    praticarAcertos: 0,
    etapaIdx: 0,
    missaoAcertos: 0,
    errosRevisao: [], // { texto, opcoes, correta, dica }
    revisao: null, // { lista, idx, acertos } quando na rodada de revisão
  };
  renderAprender();
  ctx.go("aprender");
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
}

/* ============================================================
   Fase 2 — Praticar
   ============================================================ */

function renderPraticar() {
  const lista = jogo.missao.praticar;
  const total = lista.length;
  const i = jogo.praticarIdx;

  if (i >= total) {
    iniciarMissaoFase();
    return;
  }

  const q = lista[i];
  $("praticar-progresso").style.width = `${(i / total) * 100}%`;
  $("praticar-contador").textContent = `Pergunta ${i + 1} de ${total}`;
  $("praticar-frase").textContent = q.frase;

  const fb = $("praticar-feedback");
  fb.className = "feedback";
  limpar(fb);
  $("btn-praticar-proximo").hidden = true;

  const cont = $("praticar-opcoes");
  limpar(cont);
  q.opcoes.forEach((op, idx) => {
    cont.appendChild(botaoOpcao(op, (e) => responderPraticar(e.currentTarget, idx, q)));
  });
}

function responderPraticar(botao, idx, q) {
  const cont = $("praticar-opcoes");
  const botoes = [...cont.querySelectorAll(".opcao")];
  botoes.forEach((b) => (b.disabled = true));

  const fb = $("praticar-feedback");
  const acertou = idx === q.correta;

  if (acertou) {
    botao.classList.add("correta", "balanca");
    jogo.pontos += PONTOS_PRATICAR;
    jogo.praticarAcertos++;
    fb.className = "feedback ok";
    fb.textContent = "✅ Muito bem! +10";
  } else {
    botao.classList.add("errada", "treme");
    botoes[q.correta]?.classList.add("correta");
    fb.className = "feedback erro";
    const linha = document.createElement("span");
    linha.textContent = "❌ Ops! A resposta certa está marcada.";
    const dica = document.createElement("span");
    dica.className = "dica";
    dica.textContent = q.dica || "";
    fb.append(linha, dica);
    registrarErro(q.frase, q.opcoes, q.correta, q.dica);
  }

  const prox = $("btn-praticar-proximo");
  prox.hidden = false;
  prox.textContent = jogo.praticarIdx + 1 >= jogo.missao.praticar.length ? "Ir para o desafio 🚀" : "Continuar ➡️";
}

/* ============================================================
   Fase 3 — Desafio (a missão)
   ============================================================ */

function iniciarMissaoFase() {
  ctx.go("missao");
  renderVidas();
  // mostra a abertura na primeira etapa via narração combinada
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
    registrarErro(
      `${etapa.narracao || ""} ${etapa.pergunta || ""}`.trim(),
      etapa.opcoes,
      etapa.correta,
      etapa.feedback_erro
    );

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
   Resultado e revisão
   ============================================================ */

function calcularEstrelas() {
  const total = jogo.missao.praticar.length + jogo.missao.missao.etapas.length;
  const acertos = jogo.praticarAcertos + jogo.missaoAcertos;
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
  const l1 = document.createElement("div");
  l1.textContent = `Praticar: ${jogo.praticarAcertos}/${jogo.missao.praticar.length} acertos`;
  const l2 = document.createElement("div");
  l2.textContent = `Desafio: ${jogo.missaoAcertos}/${jogo.missao.missao.etapas.length} acertos`;
  det.append(l1, l2);

  const blocoRev = $("bloco-revisao");
  blocoRev.hidden = jogo.errosRevisao.length === 0;

  ctx.go("resultado");
}

function registrarErro(texto, opcoes, correta, dica) {
  jogo.errosRevisao.push({ texto, opcoes: opcoes.slice(), correta, dica: dica || "" });
}

/** Inicia a rodada de revisão: só os erros, opções embaralhadas. */
export function iniciarRevisao() {
  if (!jogo || jogo.errosRevisao.length === 0) return;
  const lista = jogo.errosRevisao.map((q) => {
    const emb = embaralharOpcoes(q.opcoes, q.correta);
    return { texto: q.texto, opcoes: emb.opcoes, correta: emb.correta, dica: q.dica };
  });
  jogo.revisao = { lista: embaralhar(lista), idx: 0, acertos: 0 };
  ctx.go("praticar");
  renderRevisao();
}

function renderRevisao() {
  const r = jogo.revisao;
  const total = r.lista.length;
  const i = r.idx;

  if (i >= total) {
    // Terminou a revisão: volta ao resultado.
    jogo.revisao = null;
    mostrarResultado();
    return;
  }

  const q = r.lista[i];
  $("praticar-progresso").style.width = `${(i / total) * 100}%`;
  $("praticar-contador").textContent = `Revisão ${i + 1} de ${total}`;
  $("praticar-frase").textContent = q.texto;

  const fb = $("praticar-feedback");
  fb.className = "feedback";
  limpar(fb);
  $("btn-praticar-proximo").hidden = true;

  const cont = $("praticar-opcoes");
  limpar(cont);
  q.opcoes.forEach((op, idx) => {
    cont.appendChild(botaoOpcao(op, (e) => responderRevisao(e.currentTarget, idx, q)));
  });
}

function responderRevisao(botao, idx, q) {
  const botoes = [...$("praticar-opcoes").querySelectorAll(".opcao")];
  botoes.forEach((b) => (b.disabled = true));
  const fb = $("praticar-feedback");

  if (idx === q.correta) {
    botao.classList.add("correta", "balanca");
    jogo.revisao.acertos++;
    fb.className = "feedback ok";
    fb.textContent = "✅ Agora sim!";
  } else {
    botao.classList.add("errada", "treme");
    botoes[q.correta]?.classList.add("correta");
    fb.className = "feedback erro";
    const linha = document.createElement("span");
    linha.textContent = "❌ Ainda não. Veja a resposta certa.";
    const dica = document.createElement("span");
    dica.className = "dica";
    dica.textContent = q.dica || "";
    fb.append(linha, dica);
  }

  const prox = $("btn-praticar-proximo");
  prox.hidden = false;
  prox.textContent = jogo.revisao.idx + 1 >= jogo.revisao.lista.length ? "Terminar revisão 🏁" : "Continuar ➡️";
}

/* ---------- ligações dos botões "Continuar" ---------- */

export function proximoPraticar() {
  if (jogo.revisao) {
    jogo.revisao.idx++;
    renderRevisao();
  } else {
    jogo.praticarIdx++;
    renderPraticar();
  }
}

export function irParaPraticar() {
  ctx.go("praticar");
  renderPraticar();
}

/** Reinicia a mesma missão do zero. */
export function jogarDeNovo() {
  iniciarJogo(jogo.missao, ctx);
}

export function temMissaoAtual() {
  return !!jogo;
}
export function missaoAtual() {
  return jogo ? jogo.missao : null;
}
