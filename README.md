# 🎯 Missão Inglês

Jogo web (PWA) de reforço de inglês para alunos brasileiros. O aluno digita o
**tema da última aula** (ex.: "verb to be", "parts of the house"), escolhe um
**cenário** (casa, restaurante, aeroporto, praia, escola, festa, viagem,
entrevista…) e joga uma **missão** gerada por IA — tudo pensado para celular.

### Recursos
- **Aprender** → **Escutar** (ouça e escolha o significado) → **Praticar**
  (completar lacunas + **ordenar palavras**) → **Desafio** (a missão, com 3 vidas).
- **🎤 Treinar a fala**: leia em voz alta e o reconhecimento de voz confere a pronúncia.
- **🧠 Revisar meus erros**: repetição espaçada com os erros de todas as partidas.
- **📤 Compartilhar**: manda um link que já abre o app com o tema preenchido.
- **Missões salvas** jogáveis offline (PWA instalável).

- **Sem framework e sem build**: HTML, CSS e JavaScript puros (ES modules).
- **Sem banco de dados e sem login.**
- **Custo zero**: Vercel (plano Hobby grátis) + Gemini Flash (chave grátis do Google AI Studio).
- **A chave da IA nunca vai ao navegador** — só a função de servidor chama o Gemini.

> **Por que não é 100% front?** Para a chave do Gemini ficar secreta, é preciso
> uma pequena função de servidor (senão a chave apareceria no navegador). Na
> Vercel isso é a Serverless Function em `api/missao.js`. O restante é estático.

## Estrutura

```
missao-ingles/
├── package.json
├── api/
│   └── missao.js        # Serverless Function da Vercel (API /api/missao)
├── public/              # arquivos estáticos (a Vercel serve na raiz "/")
│   ├── index.html
│   ├── styles.css
│   ├── app.js           # navegação e estado do jogo
│   ├── game.js          # lógica das 3 fases + revisão
│   ├── storage.js       # missões salvas e erros (localStorage)
│   ├── mock-missao.json # missão de exemplo (jogar sem IA)
│   ├── manifest.json
│   ├── sw.js            # service worker (offline)
│   └── icons/           # ícones 192/512 + maskable
├── wrangler.toml        # (alternativa) config do Cloudflare Workers
├── src/worker.js        # (alternativa) mesma API para Cloudflare Workers
└── README.md
```

## Rodar localmente

Pré-requisito: Node.js 18+.

### Opção A — jogo com mock (sem IA)

Serve só a pasta `public/`. A tela inicial, as 3 fases e a revisão funcionam
com `mock-missao.json` (o app detecta que não há Worker e usa o mock):

```bash
npx serve public
```

Abra o endereço mostrado (ex.: `http://localhost:3000`).

### Opção B — front + função serverless (Vercel)

Roda a página **e** a API `/api/missao` juntas, como em produção:

```bash
npx vercel dev
```

Para a IA responder de verdade, defina a chave antes (veja abaixo). Sem chave,
`vercel dev` ainda serve a página, mas `/api/missao` responde erro — use a
Opção A para testar o jogo sem IA.

## Criar a chave do Gemini (Google AI Studio)

1. Acesse **https://aistudio.google.com/apikey** e faça login com uma conta Google.
2. Clique em **Create API key** e copie a chave.
3. Confira em **https://aistudio.google.com/** o nome de um modelo **Flash**
   disponível no plano gratuito (ex.: `gemini-3.6-flash`). Para trocar o modelo,
   defina a variável `GEMINI_MODEL` (o padrão já é `gemini-3.6-flash`; a função
   ainda tenta modelos alternativos automaticamente se o configurado sair do ar).

## Publicar na Vercel

Não precisa de cartão. Você pode publicar de duas formas:

### Pelo terminal (mais rápido, sem GitHub)

```bash
npx vercel            # 1º deploy (faz login e cria o projeto)
```

Defina a chave como **variável de ambiente** (fica no servidor, nunca no navegador):

```bash
npx vercel env add GEMINI_API_KEY
```

Cole a chave e escolha os ambientes (Production, Preview, Development). Depois:

```bash
npx vercel --prod     # publica em produção
```

### Pelo painel (conectando o GitHub)

1. Suba a pasta para um repositório no GitHub.
2. Em **vercel.com → Add New → Project**, importe o repositório.
   O framework é **Other** (nenhum) — deixe o build vazio.
3. Em **Settings → Environment Variables**, adicione `GEMINI_API_KEY`
   (e, se quiser, `GEMINI_MODEL`).
4. Clique em **Deploy**.

A Vercel serve `public/` na raiz e a função em `/api/missao` no mesmo domínio
`*.vercel.app`. Compartilhe esse endereço com a turma.

> **Alternativa — Cloudflare Workers:** o projeto também traz `wrangler.toml` e
> `src/worker.js` com a mesma API. Para usar: `npx wrangler login`,
> `npx wrangler secret put GEMINI_API_KEY` e `npx wrangler deploy`.

## Como funciona a IA

`POST /api/missao` com `{ "tema", "cenario", "nivel" }`:

1. Valida a entrada (tema ≤ 80 caracteres, cenário permitido, nível válido).
2. Chama o Gemini com `responseMimeType: application/json` e um `responseSchema`
   fixo (o formato da missão).
3. Valida a resposta (campos, quantidades, 4 opções por pergunta, `correta`
   entre 0 e 3, frases de `praticar` com `___`).
4. Se a validação falhar, tenta **uma** vez de novo; se falhar de novo, devolve
   erro 502 amigável.
5. O limite 429 do Gemini é repassado como 429 para o app.

## PWA / offline

- Instalável pelo "Adicionar à tela inicial" (manifest + service worker).
- Os arquivos estáticos ficam em cache (cache-first); `/api/*` nunca é cacheado.
- Offline, a tela inicial abre e as **missões salvas** continuam jogáveis.
  Um tema novo sem internet mostra "Sem internet — jogue uma missão salva".

## Segurança e privacidade

- Todo conteúdo vindo da IA é inserido com `textContent` (nunca `innerHTML`).
- O corpo da requisição é limitado na função de servidor.
- Nenhum dado pessoal é registrado ou armazenado.
- O tema digitado é tratado como assunto de estudo, não como instrução à IA.
