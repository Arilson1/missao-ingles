// app.js — navegação entre telas, estado do jogo e ponte com a API.
import * as game from "./game.js";
import { salvarMissao, listarMissoes, buscarMissao, contarErrosGlobais } from "./storage.js";

const $ = (id) => document.getElementById(id);

/* Cenários (o "value" precisa bater com a lista permitida no Worker). */
const CENARIOS = [
  { id: "casa", emoji: "🏠", nome: "Casa" },
  { id: "restaurante", emoji: "🍽️", nome: "Restaurante" },
  { id: "aeroporto", emoji: "✈️", nome: "Aeroporto" },
  { id: "escritorio", emoji: "💼", nome: "Escritório" },
  { id: "hotel", emoji: "🏨", nome: "Hotel" },
  { id: "mercado", emoji: "🛒", nome: "Mercado" },
  { id: "medico", emoji: "🏥", nome: "Médico" },
  { id: "praia", emoji: "🏖️", nome: "Praia" },
  { id: "escola", emoji: "🏫", nome: "Escola" },
  { id: "festa", emoji: "🎉", nome: "Festa" },
  { id: "viagem", emoji: "🧳", nome: "Viagem" },
  { id: "entrevista", emoji: "🤝", nome: "Entrevista" },
  { id: "livre", emoji: "🎯", nome: "Tema livre" },
  { id: "surpresa", emoji: "🎲", nome: "Surpresa" },
];
const emojiCenario = (id) => (CENARIOS.find((c) => c.id === id) || {}).emoji || "🎯";
const nomeCenario = (id) => (CENARIOS.find((c) => c.id === id) || {}).nome || id;

const estado = {
  cenario: "",
  nivel: "basico",
  ultimoPedido: null, // { tema, cenario, nivel }
};

/* ============================================================
   Navegação entre telas
   ============================================================ */
function go(tela) {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
  const el = $(`screen-${tela}`);
  if (el) el.classList.add("is-active");
  window.scrollTo(0, 0);
  if (tela === "inicio") {
    renderSalvas();
    atualizarBotaoRevisao();
  }
}

// Mostra/atualiza o botão "Revisar meus erros" conforme o banco de erros.
function atualizarBotaoRevisao() {
  const btn = $("btn-revisar-erros");
  const n = contarErrosGlobais();
  if (n > 0) {
    btn.hidden = false;
    btn.textContent = `🧠 Revisar meus erros (${n})`;
  } else {
    btn.hidden = true;
  }
}

// Mostra um aviso no início (erro por padrão; sucesso = verde).
function avisoInicio(texto, sucesso = false) {
  const a = $("aviso-inicio");
  a.textContent = texto;
  a.style.color = sucesso ? "var(--verde)" : "";
  a.hidden = false;
}

/* ============================================================
   Pronúncia (Web Speech API) — grátis, roda no navegador
   ============================================================ */
function speak(texto) {
  try {
    if (!("speechSynthesis" in window) || !texto) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* voz indisponível: silencioso */
  }
}

// Toca um diálogo em sequência, com vozes/tons diferentes por personagem.
// Chama aoFalar(i) ao iniciar cada fala e aoFim() no final.
function speakDialogo(linhas, aoFalar, aoFim) {
  try {
    if (!("speechSynthesis" in window)) {
      aoFim && aoFim();
      return;
    }
    window.speechSynthesis.cancel();
    const vozes = window.speechSynthesis.getVoices().filter((v) => /^en(-|_)/i.test(v.lang));
    const vozDe = {};
    const tomDe = {};
    let i = 0;
    function proxima() {
      if (i >= linhas.length) {
        aoFim && aoFim();
        return;
      }
      const idx = i++;
      const l = linhas[idx];
      const quem = l.quem || "A";
      if (!(quem in vozDe)) {
        const n = Object.keys(vozDe).length;
        vozDe[quem] = vozes.length ? vozes[n % vozes.length] : null;
        tomDe[quem] = n % 2 === 0 ? 1.0 : 1.35; // alterna o tom se só houver uma voz
      }
      aoFalar && aoFalar(idx);
      const u = new SpeechSynthesisUtterance(l.en);
      u.lang = "en-US";
      u.rate = 0.95;
      if (vozDe[quem]) u.voice = vozDe[quem];
      else u.pitch = tomDe[quem];
      u.onend = proxima;
      u.onerror = proxima;
      window.speechSynthesis.speak(u);
    }
    proxima();
  } catch {
    aoFim && aoFim();
  }
}

const ctx = { go, speak, avisoInicio, speakDialogo };

/* ============================================================
   Tela inicial
   ============================================================ */
function montarCenarios() {
  const grade = $("grade-cenarios");
  CENARIOS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cenario";
    b.dataset.cenario = c.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.setAttribute("aria-label", c.nome);

    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = c.emoji;
    const nome = document.createElement("span");
    nome.className = "nome";
    nome.textContent = c.nome;

    b.append(emoji, nome);
    b.addEventListener("click", () => selecionarCenario(c.id));
    grade.appendChild(b);
  });
}

function selecionarCenario(id) {
  estado.cenario = id;
  document.querySelectorAll(".cenario").forEach((b) => {
    const sel = b.dataset.cenario === id;
    b.classList.toggle("is-selected", sel);
    b.setAttribute("aria-checked", sel ? "true" : "false");
  });
}

function montarNiveis() {
  document.querySelectorAll(".nivel").forEach((b) => {
    b.addEventListener("click", () => {
      estado.nivel = b.dataset.nivel;
      document.querySelectorAll(".nivel").forEach((x) => {
        const sel = x === b;
        x.classList.toggle("is-selected", sel);
        x.setAttribute("aria-checked", sel ? "true" : "false");
      });
    });
  });
}

function montarContador() {
  const input = $("input-tema");
  const cont = $("tema-contador");
  input.addEventListener("input", () => {
    cont.textContent = `${input.value.length}/80`;
  });
}

/* ---------- Missões salvas ---------- */
function renderSalvas() {
  const bloco = $("bloco-salvas");
  const ul = $("lista-salvas");
  const salvas = listarMissoes();
  ul.replaceChildren();

  if (salvas.length === 0) {
    bloco.hidden = true;
    return;
  }
  bloco.hidden = false;

  salvas.forEach((s) => {
    const li = document.createElement("li");
    li.className = "item-salvo";

    const emoji = document.createElement("span");
    emoji.className = "emoji";
    emoji.textContent = emojiCenario(s.cenario);

    const info = document.createElement("div");
    info.className = "info";
    const titulo = document.createElement("b");
    titulo.textContent = s.tema;
    const sub = document.createElement("small");
    const data = new Date(s.data);
    sub.textContent = `${nomeCenario(s.cenario)} · ${s.nivel === "basico" ? "Básico" : "Intermediário"} · ${data.toLocaleDateString("pt-BR")}`;
    info.append(titulo, sub);

    const btn = document.createElement("button");
    btn.className = "jogar-salva";
    btn.type = "button";
    btn.textContent = "Jogar";
    btn.addEventListener("click", () => {
      const item = buscarMissao(s.chave);
      if (item && item.missao) game.iniciarJogo(item.missao);
    });

    li.append(emoji, info, btn);
    ul.appendChild(li);
  });
}

/* ============================================================
   Iniciar uma missão nova (API + fallback ao mock)
   ============================================================ */
function mostrarAvisoInicio(texto) {
  avisoInicio(texto, false);
}

async function jogar(pedido) {
  // Pedido novo a partir do formulário, ou repetição do último.
  let req = pedido;
  if (!req) {
    const tema = $("input-tema").value.trim();
    if (!tema) {
      mostrarAvisoInicio("Escreva o que você estudou na última aula.");
      return;
    }
    // Sem cenário escolhido → tema livre (para temas como números, ABC…).
    let cenario = estado.cenario || "livre";
    if (cenario === "surpresa") {
      const opcoes = CENARIOS.filter((c) => c.id !== "surpresa" && c.id !== "livre");
      cenario = opcoes[Math.floor(Math.random() * opcoes.length)].id;
    }
    req = { tema, cenario, nivel: estado.nivel };
  }

  $("aviso-inicio").hidden = true;

  if (!navigator.onLine) {
    mostrarAvisoInicio("Sem internet — jogue uma missão salva. 📴");
    return;
  }

  estado.ultimoPedido = req;
  mostrarCarregando(req.cenario);

  try {
    const missao = await pedirMissao(req);
    salvarMissao(missao);
    game.iniciarJogo(missao);
  } catch (e) {
    mostrarErroCarregando(e);
  }
}

function mostrarCarregando(cenario) {
  go("carregando");
  $("carregando-msg").hidden = false;
  $("carregando-msg").textContent =
    cenario === "livre"
      ? "Preparando sua missão sobre o tema… 🎯"
      : `Preparando sua missão no ${nomeCenario(cenario).toLowerCase()}… 🎯`;
  $("carregando-erro").hidden = true;
}

function mostrarErroCarregando(e) {
  $("carregando-msg").hidden = true;
  $("carregando-erro").hidden = false;
  let msg = "Algo deu errado ao preparar a missão. Tente de novo.";
  if (e && e.tipo === "limite") {
    msg = "Muita gente jogando agora, tente em 1 minuto. ⏳";
  } else if (e && e.tipo === "rede") {
    msg = "Sem conexão. Verifique a internet e tente de novo.";
  } else if (e && e.tipo === "servidor") {
    // Usa a mensagem amigável do servidor quando houver (ex.: chave não configurada).
    msg = e.mensagem || "A missão não pôde ser gerada agora. Tente de novo em instantes.";
  }
  $("carregando-erro-msg").textContent = msg + " Enquanto isso, jogue a missão de exemplo abaixo. 👇";
}

// Joga uma missão de exemplo (mock) — garante que o jogo nunca fica sem funcionar.
async function jogarExemplo() {
  try {
    const req = estado.ultimoPedido || { tema: "missão de exemplo", cenario: "casa", nivel: "basico" };
    const missao = await carregarMock(req);
    game.iniciarJogo(missao);
  } catch {
    mostrarAvisoInicio("Não foi possível carregar o exemplo.");
    go("inicio");
  }
}

/**
 * Chama /api/missao. Em ambiente de desenvolvimento sem Worker
 * (404/405), cai no mock-missao.json para permitir testar o jogo.
 */
async function pedirMissao(req) {
  let res;
  try {
    res = await fetch("/api/missao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw { tipo: "rede" };
  }

  if (res.status === 429) throw { tipo: "limite" };
  if (res.status === 404 || res.status === 405) {
    return await carregarMock(req); // sem função de servidor: modo mock/dev
  }
  if (!res.ok) {
    let mensagem = null;
    try {
      const j = await res.json();
      mensagem = j && j.erro;
    } catch {}
    throw { tipo: "servidor", status: res.status, mensagem };
  }

  let dados;
  try {
    dados = await res.json();
  } catch {
    throw { tipo: "servidor" };
  }
  if (!validarMissao(dados)) throw { tipo: "servidor" };
  return dados;
}

async function carregarMock(req) {
  const res = await fetch("/mock-missao.json");
  const mock = await res.json();
  // Ajusta os rótulos para refletir o pedido (conteúdo é de exemplo).
  return { ...mock, tema: req.tema, cenario: req.cenario, nivel: req.nivel };
}

/* Validação defensiva no cliente: JSON inválido não quebra o jogo. */
function validarMissao(m) {
  try {
    if (!m || typeof m !== "object") return false;
    if (!Array.isArray(m.aprender) || m.aprender.length < 1) return false;
    if (!Array.isArray(m.praticar) || m.praticar.length < 1) return false;
    for (const p of m.praticar) {
      if (!Array.isArray(p.opcoes) || p.opcoes.length !== 4) return false;
      if (typeof p.correta !== "number" || p.correta < 0 || p.correta > 3) return false;
    }
    if (!m.missao || !Array.isArray(m.missao.etapas) || m.missao.etapas.length < 1) return false;
    for (const e of m.missao.etapas) {
      if (!Array.isArray(e.opcoes) || e.opcoes.length !== 4) return false;
      if (typeof e.correta !== "number" || e.correta < 0 || e.correta > 3) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ============================================================
   Instalação (PWA) — card que aparece só quando é possível instalar
   e some ao instalar ou fechar.
   ============================================================ */
let promptInstalar = null;

function jaFechouDica() {
  try { return localStorage.getItem("missao-ingles:dica-instalar") === "1"; }
  catch { return false; }
}
function marcarDicaFechada() {
  try { localStorage.setItem("missao-ingles:dica-instalar", "1"); } catch {}
}

function estaInstalado() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function configurarInstalacao() {
  const dica = $("dica-instalar");
  const btnInstalar = $("btn-instalar");
  const texto = $("dica-instalar-texto");

  // Já instalado (aberto como app): nunca mostra e marca como resolvido.
  if (estaInstalado()) {
    marcarDicaFechada();
    return;
  }

  $("btn-fechar-dica").addEventListener("click", () => {
    dica.hidden = true;
    marcarDicaFechada();
  });

  // Chromium/Android: o navegador avisa quando dá para instalar.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptInstalar = e;
    if (jaFechouDica()) return;
    btnInstalar.hidden = false;
    dica.hidden = false;
  });

  btnInstalar.addEventListener("click", async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    try { await promptInstalar.userChoice; } catch {}
    promptInstalar = null;
    dica.hidden = true;
  });

  // Ao concluir a instalação, esconde de vez.
  window.addEventListener("appinstalled", () => {
    dica.hidden = true;
    marcarDicaFechada();
  });

  // iOS/Safari: não existe beforeinstallprompt — mostra o passo manual.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !jaFechouDica()) {
    texto.textContent = '📲 Para instalar: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
    btnInstalar.hidden = true;
    dica.hidden = false;
  }
}

/* ============================================================
   Ligações de eventos
   ============================================================ */
function ligarEventos() {
  $("btn-jogar").addEventListener("click", () => jogar());
  $("btn-tentar-novo").addEventListener("click", () => jogar(estado.ultimoPedido));
  $("btn-exemplo").addEventListener("click", () => jogarExemplo());
  $("btn-refazer-missao").addEventListener("click", () => game.jogarDeNovo());
  $("btn-revisao").addEventListener("click", () => game.iniciarRevisao());
  $("btn-jogar-de-novo").addEventListener("click", () => game.jogarDeNovo());
  $("btn-nova-missao").addEventListener("click", () => jogar(estado.ultimoPedido));
  $("btn-revisar-erros").addEventListener("click", () => game.iniciarRevisaoGlobal());
  $("btn-compartilhar").addEventListener("click", () => compartilhar(pedidoAtual()));
  $("btn-compartilhar-res").addEventListener("click", () => compartilhar(estado.ultimoPedido));

  document.querySelectorAll("[data-voltar-inicio]").forEach((b) =>
    b.addEventListener("click", () => go("inicio"))
  );
}

/* ============================================================
   Compartilhar missão (Web Share API + link que preenche o tema)
   ============================================================ */
function pedidoAtual() {
  const tema = $("input-tema").value.trim();
  if (!tema || !estado.cenario || estado.cenario === "surpresa") return null;
  return { tema, cenario: estado.cenario, nivel: estado.nivel };
}

function linkDaMissao(req) {
  const url = new URL(location.origin + "/");
  url.searchParams.set("tema", req.tema);
  url.searchParams.set("cenario", req.cenario);
  url.searchParams.set("nivel", req.nivel);
  return url.toString();
}

async function compartilhar(req) {
  if (!req) {
    avisoInicio("Escreva um tema e escolha um cenário para compartilhar.");
    return;
  }
  const url = linkDaMissao(req);
  const texto = `Vamos treinar inglês? Missão: "${req.tema}" (${nomeCenario(req.cenario)}).`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Missão Inglês", text: texto, url });
      return;
    }
  } catch {
    return; // usuário cancelou o compartilhamento
  }
  // Sem Web Share: copia o link.
  try {
    await navigator.clipboard.writeText(url);
    avisoInicio("Link copiado! Cole no grupo da turma. 🔗", true);
  } catch {
    avisoInicio(`Link da missão: ${url}`);
  }
}

// Lê ?tema=&cenario=&nivel= do link e pré-preenche o início.
function aplicarParametrosURL() {
  try {
    const p = new URLSearchParams(location.search);
    const tema = (p.get("tema") || "").slice(0, 80);
    if (!tema) return;
    $("input-tema").value = tema;
    $("tema-contador").textContent = `${tema.length}/80`;
    const cenario = p.get("cenario");
    if (cenario && CENARIOS.some((c) => c.id === cenario)) selecionarCenario(cenario);
    const nivel = p.get("nivel");
    if (nivel === "basico" || nivel === "intermediario") {
      estado.nivel = nivel;
      document.querySelectorAll(".nivel").forEach((x) => {
        const sel = x.dataset.nivel === nivel;
        x.classList.toggle("is-selected", sel);
        x.setAttribute("aria-checked", sel ? "true" : "false");
      });
    }
    avisoInicio("Missão sugerida por um colega — toque em Jogar! 🎯", true);
  } catch {
    /* silencioso */
  }
}

/* ============================================================
   Boot
   ============================================================ */
function init() {
  game.definirContexto(ctx);
  montarCenarios();
  montarNiveis();
  montarContador();
  ligarEventos();
  renderSalvas();
  atualizarBotaoRevisao();
  configurarInstalacao();
  aplicarParametrosURL();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

init();
