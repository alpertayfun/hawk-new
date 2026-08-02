/**
 * modp_montymul.js
 * -----------------
 * Genel amaçlı, keyfi büyüklükte tek sayılar için BigInt tabanlı
 * Montgomery çarpma (Montgomery multiplication mod p) implementasyonu.
 *
 * Montgomery çarpımı, modüler üs alma (modpow / RSA-DH gibi) işlemlerinde
 * pahalı olan `mod p` bölme işlemini, sabit bir R (2^k) tabanına göre
 * kaydırma ve çarpma işlemlerine indirger. Bu, donanımda / büyük sayı
 * kütüphanelerinde klasik yöntemden çok daha hızlıdır.
 *
 * Temel fikir:
 *   R          : p'den büyük, 2'nin kuvveti bir sayı (R = 2^k, gcd(R, p) = 1)
 *   p'         : p * p'  ≡ -1 (mod R)   (n0inv / negatif tersi)
 *   MontyMul(a, b) = a * b * R^-1 mod p
 *
 * Bir sayıyı "Montgomery formuna" çevirmek için:
 *   aMonty = a * R mod p
 * Formdan çıkarmak için:
 *   a = aMonty * R^-1 mod p  (== MontyMul(aMonty, 1))
 *
 * Bu dosya iki API sunar:
 *   1) montySetup(p)                -> bağlam (context) nesnesi üretir
 *   2) ctx.modp_montymul(aR, bR)    -> Montgomery formundaki iki sayıyı çarpar
 *
 * Kurulum gerekmez, saf JavaScript (BigInt), Node.js veya tarayıcıda çalışır.
 */

"use strict";

// --- Yardımcı fonksiyonlar -------------------------------------------------

/**
 * Genişletilmiş Öklid algoritması ile modüler ters (a^-1 mod m) bulur.
 * BigInt ile çalışır. m > 0 ve gcd(a, m) = 1 varsayılır.
 */
function modInverse(a, m) {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  if (old_r !== 1n) {
    throw new Error("modInverse: gcd(a, m) != 1, ters eleman yok");
  }

  // old_s negatif olabilir, m ile pozitife çevir
  return ((old_s % m) + m) % m;
}

/** a mod m (BigInt için her zaman pozitif sonuç döner) */
function mod(a, m) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

/** En küçük 2^k biçimindeki R değerini bulur; R > p ve gcd(R, p) = 1 olmalı (p tek sayı olmalı) */
function chooseR(p) {
  if (p <= 0n) throw new Error("p pozitif olmalı");
  if ((p & 1n) === 0n) {
    throw new Error("Montgomery aritmetiği için p tek (odd) bir sayı olmalı");
  }
  let bits = 1n;
  let R = 2n;
  while (R <= p) {
    R <<= 1n;
    bits += 1n;
  }
  return { R, bits };
}

// --- Montgomery bağlamı (context) ------------------------------------------

/**
 * Verilen modulus p için bir Montgomery aritmetik bağlamı kurar.
 * p tek (odd) bir sayı olmalıdır (RSA/DH modüllerinde her zaman böyledir).
 *
 * @param {bigint} p - modulus
 * @returns {object} ctx - montySetup çıktısı; aşağıdaki metodları içerir:
 *    ctx.toMonty(a)              a'yı Montgomery formuna çevirir (a*R mod p)
 *    ctx.fromMonty(aR)           Montgomery formundan normal forma çevirir
 *    ctx.modp_montymul(aR, bR)   iki Montgomery-form sayıyı çarpar
 *    ctx.modpow(base, exp)       base^exp mod p (Montgomery merdiveni ile)
 */
function montySetup(p) {
  const { R, bits } = chooseR(p);

  // p' değeri: p * pInv ≡ -1 (mod R)  <=>  pInv = -p^-1 mod R
  const pInvModR = modInverse(p, R);
  const pPrime = mod(-pInvModR, R); // n0' (negatif ters)

  const Rmod = mod(R, p);      // R mod p  (toMonty için kullanılabilir kısayol)
  const R2mod = mod(R * R, p); // R^2 mod p (toMonty'de tek çarpımla dönüşüm için)

  /**
   * Ham Montgomery çarpımı: (aR * bR) / R mod p
   * aR ve bR, [0, p) aralığında Montgomery-form sayılar olmalı.
   */
  function modp_montymul(aR, bR) {
    // t = aR * bR  (Montgomery form olmayan, R^2 katı büyüklüğünde ara sonuç)
    const t = aR * bR;

    // m = (t mod R) * p' mod R   -> t'yi R'ye bölünebilir hale getirecek katsayı
    const m = mod(t * pPrime, R);

    // u = (t + m*p) / R   -> tam bölünür, çünkü m seçimi bunu garanti eder
    const u = (t + m * p) / R;

    // Sonuç [0, 2p) aralığında olabilir, tek bir koşullu çıkarma yeterli
    return u >= p ? u - p : u;
  }

  /** Normal sayıyı Montgomery formuna çevirir: a -> a*R mod p */
  function toMonty(a) {
    return modp_montymul(mod(a, p), R2mod);
  }

  /** Montgomery formundaki sayıyı normale çevirir: aR -> aR*R^-1 mod p */
  function fromMonty(aR) {
    return modp_montymul(aR, 1n);
  }

  /**
   * Montgomery merdiveniyle modüler üs alma: base^exp mod p
   * (RSA/DH gibi kullanım senaryoları için pratik yardımcı fonksiyon)
   */
  function modpow(base, exp) {
    if (exp < 0n) throw new Error("Negatif üs desteklenmiyor");

    let resultR = toMonty(1n);
    let baseR = toMonty(mod(base, p));
    let e = exp;

    while (e > 0n) {
      if (e & 1n) {
        resultR = modp_montymul(resultR, baseR);
      }
      baseR = modp_montymul(baseR, baseR);
      e >>= 1n;
    }

    return fromMonty(resultR);
  }

  return {
    p,
    R,
    bits,
    modp_montymul,
    toMonty,
    fromMonty,
    modpow,
  };
}

// --- Kullanım örneği ---------------------------------------------------------

if (require.main === module) {
  // Küçük bir asal modulus ile hızlı bir doğrulama
  const p = 0xfffffffffffffffffffffffffffffffeffffffffffffffn; // örnek: büyük tek sayı
  const ctx = montySetup(p);

  const a = 123456789012345678901234567890n;
  const b = 987654321098765432109876543210n;

  // Normal (klasik) modüler çarpım
  const expected = mod(a * b, p);

  // Montgomery yoluyla aynı çarpımı hesapla
  const aR = ctx.toMonty(a);
  const bR = ctx.toMonty(b);
  const resultR = ctx.modp_montymul(aR, bR);
  const result = ctx.fromMonty(resultR);

  console.log("a * b mod p (klasik) :", expected.toString());
  console.log("a * b mod p (monty)  :", result.toString());
  console.log("Eşit mi?             :", expected === result);

  // modpow doğrulaması: base^exp mod p
  const base = 2n;
  const exp = 65537n;
  console.log("\n2^65537 mod p        :", ctx.modpow(base, exp).toString());
}

module.exports = { montySetup, modInverse, mod };
