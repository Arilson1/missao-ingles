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
