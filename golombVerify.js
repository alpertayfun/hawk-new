/**
 * HawkVerify: HAWK signature verification (Algorithm 20)
 *
 * @param {Uint8Array|string} m    - Message
 * @param {*} pub                  - Public key (encoded)
 * @param {*} sig                  - Signature (encoded)
 * @param {number} n                - Ring dimension
 * @param {number} sigmaVerify      - Verification standard deviation (σ_verify)
 * @returns {boolean} true if valid, false otherwise
 */

function hawkVerify(m, pub, sig, n, sigmaVerify) {
  // Line 1-3: decode signature
  let r = decodeSignature(sig);
  if (r === null) {
    return false;
  }

  // Line 4
  const [salt, s1] = r;

  // Line 5-7: decode public key
  r = decodePublic(pub);
  if (r === null) {
    return false;
  }

  // Line 8
  const [q00, q01] = r;

  // Line 9-10
  const hpub = shake256(pub);
  const M = shake256(concatBytes(m, hpub));

  // Line 11: (h0, h1) <- SHAKE256(M || salt)[0 : 2n]
  const hBytes = shake256(concatBytes(M, salt), 2 * n);
  const h0 = hBytes.slice(0, n);
  const h1 = hBytes.slice(n, 2 * n);

  // Line 12
  const w1 = subtractPoly(h1, scalarMulPoly(2, s1)); // w1 = h1 - 2*s1

  // Line 13-14
  if (!symBreak(w1)) {
    return false;
  }

  // Line 15-17
  const w0 = rebuildS0(q00, q01, w1, h0);
  if (w0 === null) {
    return false;
  }

  // Line 18-19
  const r1 = polyQnorm(q00, q01, w0, w1, /* p1 */ P1);
  const r2 = polyQnorm(q00, q01, w0, w1, /* p2 */ P2);

  // Line 20-21
  if (r1 !== r2 || mod(r1, n) !== 0) {
    return false;
  }

  // Line 22
  const r1Reduced = r1 / n;

  // Line 23-24
  if (r1Reduced > 8 * n * sigmaVerify ** 2) {
    return false;
  }

  // Line 25
  return true;
}

// --- Yardımcı fonksiyonlar (implementasyonun eksik kısımları) ---

function decodeSignature(sig) {
  // TODO: sig'i decode et, [salt, s1] döndür ya da null
  throw new Error("decodeSignature not implemented");
}

function decodePublic(
  y,
  n,
  low00, high00,
  low01, high01,
  publenBits,
  DecompressGR,
  DecodeInt
) {
  const lenBits = (arr) => arr.length;

  if (lenBits(y) !== publenBits) {
    return null;
  }

  const v = 16 - high00;

  const r00 = DecompressGR(y, n / 2, low00, high00);
  if (r00 === null) {
    return null;
  }

  let [q00, j] = r00;

  if (lenBits(y) < j + v) {
    return null;
  }

  q00[0] = (2 ** v) * q00[0] + DecodeInt(y.slice(j, j + v));

  j = j + v;

  while (j % 8 !== 0) {
    if (j >= lenBits(y) || y[j] !== 0) {
      return null;
    }
    j = j + 1;
  }

  q00[n / 2] = 0;

  for (let i = n / 2 + 1; i <= n - 1; i++) {
    q00[i] = -q00[n - i];
  }

  const r01 = DecompressGR(y.slice(j, lenBits(y)), n, low01, high01);
  if (r01 === null) {
    return null;
  }

  const [q01, jPrime] = r01;

  j = j + jPrime;

  while (j < lenBits(y)) {
    if (y[j] !== 0) {
      return null;
    }
    j = j + 1;
  }

  return [q00, q01];
}

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

function rebuildS0({ q00, q01, w1, h0, n, highS1, high00, high01, highS0, fft, invFft }) {
  const toBig = (arr) => arr.map((x) => BigInt(x));
  q00 = toBig(q00);
  q01 = toBig(q01);
  w1 = toBig(w1);
  h0 = toBig(h0);

  const N = BigInt(n);

  // 1-3: sabitler
  const cw1 = pow2(29 - (1 + highS1));
  const cq00 = pow2(29 - high00);
  const cq01 = pow2(29 - high01);

  // 4: cs0 ← (2*cw1*cq01) / (n*cq00)
  const cs0 = (2n * cw1 * cq01) / (N * cq00);

  // 5: w1hat ← FFT(cw1 * w1)
  const w1hat = fft(w1.map((x) => cw1 * x), n);

  // 6-9: z00 ← q00 ; z00[0] < 0 ise ⊥ ; z00[0] ← 0
  const z00 = q00.slice();
  if (z00[0] < 0n) return null;
  z00[0] = 0n;

  // 10-11
  const q00hat = fft(z00.map((x) => cq00 * x), n);
  const q01hat = fft(q01.map((x) => cq01 * x), n);

  // 12: alpha ← (2*cq00*q00[0]) / n
  const alpha = (2n * cq00 * q00[0]) / N;

  const half = n / 2;
  const TWO_30 = pow2(30);
  const TWO_32 = pow2(32);

  // 13-24
  for (let u = 0; u < half; u++) {
    let Xre = q01hat[u] * w1hat[u] - q01hat[u + half] * w1hat[u + half];
    let Xim = q01hat[u] * w1hat[u + half] + q01hat[u + half] * w1hat[u];

    const zre = sgnBit(Xre);
    Xre = abs(Xre);
    const zim = sgnBit(Xim);
    Xim = abs(Xim);

    const v = alpha + q00hat[u];

    if (v <= 0n || v >= TWO_30 || Xre >= TWO_32 * v || Xim >= TWO_32 * v) {
      return null;
    }

    const yre = floorDiv(Xre, v);
    const yim = floorDiv(Xim, v);

    q01hat[u] = yre - 2n * zre * yre;
    q01hat[u + half] = yim - 2n * zim * yim;
  }

  // 25: t ← InvFFT(q01hat)
  const t = invFft(q01hat, n);

  // 26-31
  const w0 = new Array(n);
  const twoCs0 = 2n * cs0;
  const lowerBound = -pow2(highS0);
  const upperBound = pow2(highS0);

  for (let u = 0; u < n; u++) {
    const v = cs0 * h0[u] + t[u];
    const z = floorDiv(v + cs0, twoCs0); // z, rebuild edilen s0[u]

    if (z < lowerBound || z >= upperBound) {
      return null;
    }

    w0[u] = h0[u] - 2n * z;
  }

  // 32: return w0
  return w0;
}

function polyQnorm(q00, q01, w0, w1, p) {
  // TODO: PolyQnorm algoritması
  throw new Error("polyQnorm not implemented");
}

function symBreak(w1) {
  // TODO: sym-break kontrolü
  throw new Error("symBreak not implemented");
}

function concatBytes(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function subtractPoly(a, b) {
  // Polinom katsayı bazında çıkarma
  return a.map((val, i) => val - b[i]);
}

function scalarMulPoly(scalar, poly) {
  return poly.map(val => val * scalar);
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

module.exports = { hawkVerify }; 