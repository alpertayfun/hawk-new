/**
 * Algorithm 18 — RebuildS0: Rebuild s0 from public key and signature
 *
 * Pseudokodun birebir çevirisi. Fixed-point aritmetik büyük değerlere
 * gidebildiği (2^32 * v gibi) için tüm hesap BigInt ile yapılıyor.
 *
 * Require:
 *   q00, q01 : public polinomlar (n uzunluklu tam sayı dizileri)
 *   w1       : n uzunluklu tam sayı dizisi
 *   h0       : n uzunluklu tam sayı dizisi
 *   n        : dönüşüm boyutu
 *   highS1, high00, high01, highS0 : "high_*" üsleri (bit-genişliği parametreleri)
 *   fft(arr, n)    : Algorithm 17 (fixedPointFFT) gibi bir FFT fonksiyonu —
 *                    girdi: n uzunluklu tam sayı dizisi, çıktı: n uzunluklu
 *                    BigInt dizisi (ilk n/2: reel, son n/2: imajiner kısımlar)
 *   invFft(arr, n) : yukarıdakinin tersi (InvFFT)
 *
 * Ensure: w0 (BigInt[]) veya null (⊥, hata durumu)
 */

function floorDiv(a, b) {
  let q = a / b;
  if (a % b !== 0n && (a < 0n) !== (b < 0n)) q -= 1n;
  return q;
}

// sgn(x): işaret-büyüklük ayrıştırması için — negatifse 1, değilse 0 döner.
// (Xre, zre) = (|Xre|, sgn(Xre)) satırındaki kullanımla tutarlı: sonradan
// yre - 2*zre*yre = yre * (1 - 2*zre) ifadesi işareti geri kazandırıyor.
function sgnBit(x) {
  return x < 0n ? 1n : 0n;
}

function abs(x) {
  return x < 0n ? -x : x;
}

function pow2(exp) {
  // exp negatif olabilir teorik olarak; burada üslerin negatif olmadığı varsayılıyor.
  return 1n << BigInt(exp);
}

/**
 * @param {object} params
 * @param {number[]|bigint[]} params.q00
 * @param {number[]|bigint[]} params.q01
 * @param {number[]|bigint[]} params.w1
 * @param {number[]|bigint[]} params.h0
 * @param {number} params.n
 * @param {number} params.highS1
 * @param {number} params.high00
 * @param {number} params.high01
 * @param {number} params.highS0
 * @param {(arr: bigint[], n: number) => bigint[]} params.fft
 * @param {(arr: bigint[], n: number) => bigint[]} params.invFft
 * @returns {bigint[]|null} w0 veya null (⊥)
 */
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

module.exports = { rebuildS0, floorDiv, sgnBit, abs, pow2 };