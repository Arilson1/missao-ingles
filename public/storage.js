// storage.js — missões salvas e histórico de erros no localStorage.
// Toda leitura/escrita é protegida por try/catch: o app precisa
// funcionar mesmo que o armazenamento esteja indisponível.

const CHAVE_MISSOES = "missao-ingles:missoes";
const MAX_MISSOES = 20;

/** Monta a chave única de uma missão a partir de tema+cenario+nivel. */
export function chaveMissao(tema, cenario, nivel) {
  return `${(tema || "").trim().toLowerCase()}|${cenario}|${nivel}`;
}

function lerLista() {
  try {
    const bruto = localStorage.getItem(CHAVE_MISSOES);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravarLista(lista) {
  try {
    localStorage.setItem(CHAVE_MISSOES, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

/**
 * Salva (ou atualiza) uma missão gerada, mantendo no máximo 20,
 * a mais recente primeiro.
 */
export function salvarMissao(missao) {
  if (!missao || !missao.tema) return;
  try {
    const chave = chaveMissao(missao.tema, missao.cenario, missao.nivel);
    const lista = lerLista().filter((m) => m.chave !== chave);
    lista.unshift({
      chave,
      tema: missao.tema,
      cenario: missao.cenario,
      nivel: missao.nivel,
      titulo: missao.titulo || missao.tema,
      data: Date.now(),
      missao,
    });
    gravarLista(lista.slice(0, MAX_MISSOES));
  } catch {
    /* silencioso: salvar é opcional */
  }
}

/** Retorna a lista de missões salvas (metadados + missão completa). */
export function listarMissoes() {
  return lerLista();
}

/** Busca uma missão salva pela chave. */
export function buscarMissao(chave) {
  return lerLista().find((m) => m.chave === chave) || null;
}

/** Remove uma missão salva pela chave. */
export function removerMissao(chave) {
  const lista = lerLista().filter((m) => m.chave !== chave);
  gravarLista(lista);
}

/* ============================================================
   Banco de erros global (para a revisão entre partidas)
   Cada erro é uma pergunta de múltipla escolha que o aluno errou.
   Repetição espaçada simples: acerto na revisão sobe "acertos";
   com 2 acertos o erro é considerado aprendido e sai do banco.
   ============================================================ */
const CHAVE_ERROS = "missao-ingles:erros";
const MAX_ERROS = 100;

function lerErros() {
  try {
    const b = localStorage.getItem(CHAVE_ERROS);
    const l = b ? JSON.parse(b) : [];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}
function gravarErros(l) {
  try {
    localStorage.setItem(CHAVE_ERROS, JSON.stringify(l.slice(0, MAX_ERROS)));
  } catch {
    /* silencioso */
  }
}

/** Guarda um erro (pergunta MC) no banco, sem duplicar. */
export function salvarErroGlobal(erro) {
  if (!erro || !erro.texto || !Array.isArray(erro.opcoes) || erro.opcoes.length !== 4) return;
  try {
    const chave = erro.texto.trim().toLowerCase();
    const lista = lerErros();
    if (lista.some((e) => e.chave === chave)) return;
    lista.unshift({
      chave,
      texto: erro.texto,
      opcoes: erro.opcoes.slice(),
      correta: erro.correta,
      dica: erro.dica || "",
      tema: erro.tema || "",
      cenario: erro.cenario || "",
      acertos: 0,
      ts: Date.now(),
    });
    gravarErros(lista);
  } catch {
    /* silencioso */
  }
}

/** Quantos erros há para revisar. */
export function contarErrosGlobais() {
  return lerErros().length;
}

/** Próximos N erros a revisar (prioriza os menos acertados e mais antigos). */
export function proximaRevisaoGlobal(n = 10) {
  const lista = lerErros().slice();
  lista.sort((a, b) => a.acertos - b.acertos || a.ts - b.ts);
  return lista.slice(0, n);
}

/** Atualiza um erro após a revisão. Aprendido (2 acertos) sai do banco. */
export function registrarRevisaoGlobal(chave, acertou) {
  try {
    const lista = lerErros();
    const i = lista.findIndex((e) => e.chave === chave);
    if (i < 0) return;
    if (acertou) {
      lista[i].acertos = (lista[i].acertos || 0) + 1;
      if (lista[i].acertos >= 2) lista.splice(i, 1);
      else lista[i].ts = Date.now();
    } else {
      lista[i].acertos = 0;
      lista[i].ts = Date.now();
    }
    gravarErros(lista);
  } catch {
    /* silencioso */
  }
}
