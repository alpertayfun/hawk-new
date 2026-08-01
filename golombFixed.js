/**
 * Fixed-point FFT (pseudokodun birebir çevirisi).
 *
 * Girdi:
 *   a      : Int32Array veya normal number[] uzunluğu n (fixed-point polinom katsayıları)
 *   n      : polinom derecesi / dönüşüm boyutu (2'nin kuvveti olmalı)
 *   delta  : Δ tablosu — { re: bigint, im: bigint }[] biçiminde, 2^31 ölçekli
 *            twiddle faktörleri (bit-reversed sırada). Δ[u+m] indeksiyle erişiliyor.
 *
 * Not: 2^31 * x gibi çarpımlar 32-bit sınırını kolayca aşıp JS'in
 * "safe integer" (2^53) sınırına da yaklaşabildiği için tüm aritmetik
 * BigInt ile yapılıyor; sonuçta Number'a geri çevriliyor.
 */

const TWO_31 = 1n << 31n;
const TWO_32 = 1n << 32n;

// floor(a / b) — BigInt'te negatif sayılarda da matematiksel floor davranışı
function floorDiv(a, b) {
  let q = a / b;
  if ((a % b !== 0n) && ((a < 0n) !== (b < 0n))) {
    q -= 1n;
  }
  return q;
}

/**
 * @param {number[]|BigInt64Array} a - uzunluk n, in-place güncellenir
 * @param {number} n
 * @param {{re: bigint, im: bigint}[]} delta - Δ tablosu
 * @returns {bigint[]} â (in-place değiştirilmiş a'nın kendisi)
 */
function fixedPointFFT(a, n, delta) {
  // â ← a  (kendi kopyamızı BigInt olarak tutuyoruz)
  const ahat = a.map((x) => BigInt(x));

  let t = n / 2;
  let m = 2;

  while (m < n) {
    let v0 = 0;

    for (let u = 0; u < m / 2; u++) {
      const eps = delta[u + m];
      const epsRe = eps.re;
      const epsIm = eps.im;

      for (let v = v0; v < v0 + t / 2; v++) {
        const x1re = ahat[v];
        const x1im = ahat[v + n / 2];
        const x2re = ahat[v + t / 2];
        const x2im = ahat[v + t / 2 + n / 2];

        const Tre = x2re * epsRe - x2im * epsIm;
        const Tim = x2re * epsIm + x2im * epsRe;

        ahat[v]                 = floorDiv(TWO_31 * x1re + Tre, TWO_32);
        ahat[v + n / 2]         = floorDiv(TWO_31 * x1im + Tim, TWO_32);
        ahat[v + t / 2]         = floorDiv(TWO_31 * x1re - Tre, TWO_32);
        ahat[v + t / 2 + n / 2] = floorDiv(TWO_31 * x1im - Tim, TWO_32);
      }

      v0 += t;
    }

    t = t / 2;
    m = 2 * m;
  }

  return ahat;
}

module.exports = { fixedPointFFT, floorDiv, TWO_31, TWO_32 };

// --- Basit kullanım örneği ---
if (require.main === module) {
  const n = 8;
  const a = [1, 2, 3, 4, 5, 6, 7, 8];

  // Δ tablosu burada sadece PLACEHOLDER — gerçek twiddle faktörlerini
  // (bit-reversed sırada, 2^31 ölçekli) kendi kaynağınızdan doldurmanız gerekir.
  const delta = new Array(n).fill(0).map(() => ({ re: 0n, im: 0n }));

  const result = fixedPointFFT(a, n, delta);
  console.log(result);
}