// sw.js — service worker do Missão Inglês.
// Cache-first para os arquivos estáticos; a API vai sempre à rede.

const CACHE_VERSION = "v6";
const CACHE_NOME = `missao-ingles-${CACHE_VERSION}`;

const ARQUIVOS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/game.js",
  "/storage.js",
  "/mock-missao.json",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE_NOME).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // NUNCA fazer cache da API nem do analytics: sempre rede.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_vercel/")) {
    return; // deixa o navegador tratar (vai à rede)
  }

  // Apenas GET é cacheável.
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cacheado) => {
      if (cacheado) return cacheado;
      return fetch(req)
        .then((res) => {
          // Cacheia respostas boas do mesmo domínio.
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NOME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline e sem cache: para navegação, devolve a página inicial.
          if (req.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        });
    })
  );
});
