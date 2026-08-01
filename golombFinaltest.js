/**
 * Falcon/FN-DSA tarzı KeyGen adımı: f ve g polinomlarını
 * kgseed'den SHAKE256 çıktısı üzerinden merkezi binom dağılımıyla örnekler.
 *
 * Algoritma (görselden):
 *   1: b <- n/64                          // b = 4, 8 veya 16 (n'e bağlı)
 *   2: y <- SHAKE256x4(kgseed)[0 : 2bn]   // f ve g'nin her katsayısı için b bit
 *   3: for i = 0..n-1: f[i] = (sum_{j=0}^{b-1} y[i*b+j]) - b/2
 *   5: for i = 0..n-1: g[i] = (sum_{j=0}^{b-1} y[(i+n)*b+j]) - b/2
 *   7: return (f, g)
 *
 * Not: "SHAKE256x4" referans implementasyonlarda (AVX2) SHAKE256'nin 4 lane'de
 * paralel çalıştırılmış halidir; fonksiyonel olarak tek SHAKE256 çağrısıyla
 * aynı bit akışını üretir. Burada standart SHAKE256 kullanılıyor.
 */

'use strict';

/* ======================= Keccak-f[1600] çekirdeği ======================= */

const MASK64 = (1n << 64n) - 1n;

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// r[x][y] rotasyon miktarları (indeks = x + 5*y)
const ROTATION_OFFSETS = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

function rotl64(x, n) {
  n = BigInt(n % 64);
  if (n === 0n) return x & MASK64;
  return ((x << n) | (x >> (64n - n))) & MASK64;
}

function keccakF1600(state) {
  const C = new Array(5);
  const D = new Array(5);
  const B = new Array(25);

  for (let round = 0; round < 24; round++) {
    // Theta
    for (let x = 0; x < 5; x++) {
      C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] ^= D[x];
      }
    }

    // Rho + Pi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const newX = y;
        const newY = (2 * x + 3 * y) % 5;
        B[newX + 5 * newY] = rotl64(state[x + 5 * y], ROTATION_OFFSETS[x + 5 * y]);
      }
    }

    // Chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] =
          B[x + 5 * y] ^ (~B[(x + 1) % 5 + 5 * y] & B[(x + 2) % 5 + 5 * y] & MASK64);
      }
    }

    // Iota
    state[0] ^= ROUND_CONSTANTS[round];
  }
}

/* ============================ SHAKE256 sünger ============================ */

const SHAKE256_RATE_BYTES = 136; // (1600 - 2*256) / 8

function shake256(inputBytes, outputByteLen) {
  const state = new BigUint64Array(25);

  // --- Absorb ---
  let offset = 0;
  const input = inputBytes;
  while (offset + SHAKE256_RATE_BYTES <= input.length) {
    xorBlockIntoState(state, input, offset, SHAKE256_RATE_BYTES);
    keccakF1600(state);
    offset += SHAKE256_RATE_BYTES;
  }

  // Son blok + SHAKE padding (0x1F ... 0x80)
  const rem = input.length - offset;
  const block = new Uint8Array(SHAKE256_RATE_BYTES);
  block.set(input.subarray(offset), 0);
  block[rem] ^= 0x1f;
  block[SHAKE256_RATE_BYTES - 1] ^= 0x80;
  xorBlockIntoState(state, block, 0, SHAKE256_RATE_BYTES);
  keccakF1600(state);

  // --- Squeeze ---
  const output = new Uint8Array(outputByteLen);
  let produced = 0;
  while (produced < outputByteLen) {
    const chunk = Math.min(SHAKE256_RATE_BYTES, outputByteLen - produced);
    const stateBytes = stateToBytes(state);
    output.set(stateBytes.subarray(0, chunk), produced);
    produced += chunk;
    if (produced < outputByteLen) keccakF1600(state);
  }
  return output;
}

function xorBlockIntoState(state, bytes, byteOffset, len) {
  for (let i = 0; i < len; i += 8) {
    let lane = 0n;
    for (let k = 7; k >= 0; k--) {
      lane = (lane << 8n) | BigInt(bytes[byteOffset + i + k]);
    }
    state[i / 8] ^= lane;
  }
}

function stateToBytes(state) {
  const out = new Uint8Array(SHAKE256_RATE_BYTES);
  for (let i = 0; i < SHAKE256_RATE_BYTES / 8; i++) {
    let lane = state[i];
    for (let k = 0; k < 8; k++) {
      out[i * 8 + k] = Number(lane & 0xffn);
      lane >>= 8n;
    }
  }
  return out;
}

/* ============================== Bit erişimi ============================== */

// bit k: byte[floor(k/8)] içindeki LSB-first k. bit
function getBit(bytes, k) {
  return (bytes[k >> 3] >> (k & 7)) & 1;
}

/* ================================ KeyGen ================================ */

/**
 * @param {Uint8Array} kgseed  Anahtar üretim seed'i (bayt dizisi)
 * @param {number} n           Polinom derecesi (ör. 512, 1024 ...)
 * @returns {{f: number[], g: number[]}}
 */
function keygenFG(kgseed, n) {
  if (n % 64 !== 0) {
    throw new Error('n, 64 ile bolunebilmeli (b = n/64)');
  }
  const b = n / 64; // 4, 8 veya 16

  const totalBits = 2 * b * n;
  const totalBytes = Math.ceil(totalBits / 8);
  const y = shake256(kgseed, totalBytes);

  const f = new Array(n);
  const g = new Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < b; j++) sum += getBit(y, i * b + j);
    f[i] = sum - b / 2;
  }

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < b; j++) sum += getBit(y, (i + n) * b + j);
    g[i] = sum - b / 2;
  }

  return { f, g };
}

/* ================================= Örnek ================================= */

function textToBytes(str) {
  return new TextEncoder().encode(str);
}

// Örnek kullanım:
const kgseed = textToBytes('deneme-seed-degeri');
const n = 512; // b = 512/64 = 8
const { f, g } = keygenFG(kgseed, n);

console.log('b =', n / 64);
console.log('f[0..9] =', f.slice(0, 10));
console.log('g[0..9] =', g.slice(0, 10));

module.exports = { keygenFG, shake256 };