// gen-icons.js — gera os ícones PWA (alvo sobre gradiente) usando só o
// zlib do Node, sem dependências. Rode com: npm run icons
//
// Para personalizar: mude as cores (TOPO/BASE/VERMELHO) ou o desenho em
// corPonto(). Saída padrão: public/icons/.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const TOPO = hex("#6c5ce7"); // roxo (cor de tema do app)
const BASE = hex("#0984e3"); // azul
const VERMELHO = hex("#ff5252");
const BRANCO = [255, 255, 255];

// cor de um sub-ponto (coordenadas 0..1)
function corPonto(fx, fy, maskable) {
  const bg = [lerp(TOPO[0], BASE[0], fy), lerp(TOPO[1], BASE[1], fy), lerp(TOPO[2], BASE[2], fy)];

  if (!maskable) {
    // cantos arredondados: transparência fora do retângulo arredondado
    const r = 0.22;
    const dx = Math.max(r - fx, fx - (1 - r), 0);
    const dy = Math.max(r - fy, fy - (1 - r), 0);
    if (Math.hypot(dx, dy) > r) return [0, 0, 0, 0];
  }

  // alvo centralizado (maskable usa raio menor = zona segura)
  const Rt = maskable ? 0.3 : 0.36;
  const d = Math.hypot(fx - 0.5, fy - 0.5) / Rt;
  let cor = null;
  if (d <= 1.0) {
    if (d < 0.22) cor = VERMELHO;
    else if (d < 0.44) cor = BRANCO;
    else if (d < 0.66) cor = VERMELHO;
    else if (d < 0.88) cor = BRANCO;
    else cor = VERMELHO;
  }
  if (cor) return [cor[0], cor[1], cor[2], 255];
  return [bg[0], bg[1], bg[2], 255];
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling 4x4 por pixel (bordas suaves)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const p = corPonto((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, maskable);
          r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
        }
      const af = a / (SS * SS);
      const o = (y * size + x) * 4;
      if (af === 0) { buf[o] = buf[o + 1] = buf[o + 2] = buf[o + 3] = 0; }
      else {
        buf[o] = Math.round(r / a);
        buf[o + 1] = Math.round(g / a);
        buf[o + 2] = Math.round(b / a);
        buf[o + 3] = Math.round(af);
      }
    }
  }
  return buf;
}

// --- codificador PNG mínimo (RGBA, filtro 0) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function toPNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // byte de filtro
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function salvar(nome, size, maskable) {
  fs.writeFileSync(path.join(OUT, nome), toPNG(size, render(size, maskable)));
  console.log("gerado:", nome);
}

salvar("icon-192.png", 192, false);
salvar("icon-512.png", 512, false);
salvar("icon-maskable-512.png", 512, true);
console.log("OK em", OUT);
