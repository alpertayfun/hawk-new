/**
 * modp_div.js
 * -----------
 * Genel amaçlı, BigInt tabanlı modüler bölme (modp_div).
 *
 * Modüler aritmetikte "bölme" diye bir işlem doğrudan yoktur; a / b mod p
 * işlemi aslında şu şekilde tanımlanır:
 *
 *   a / b (mod p)  =  a * b^-1 (mod p)
 *
 * burada b^-1, b'nin p modülüne göre çarpımsal tersidir (modular inverse).
 * b^-1'in var olabilmesi için gcd(b, p) = 1 olması gerekir (p asal ise ve
 * b, p'nin katı değilse bu her zaman sağlanır).
 *
 * Bu dosya:
 *   1) modInverse(b, p)   -> genişletilmiş Öklid algoritmasıyla b^-1 mod p
 *   2) modp_div(a, b, p)  -> a / b mod p sonucunu döner
 * fonksiyonlarını sunar. Kurulum gerekmez, saf JavaScript (BigInt).
 */

"use strict";

// --- Yardımcı: a mod m (BigInt için her zaman pozitif sonuç döner) ---------
function mod(a, m) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

// --- Genişletilmiş Öklid algoritması ile modüler ters -----------------------
/**
 * b^-1 mod p değerini döner.
 * gcd(b, p) != 1 ise (yani ters yoksa) hata fırlatır.
 */
function modInverse(b, p) {
  if (p <= 0n) throw new Error("p pozitif olmalı");

  let [old_r, r] = [mod(b, p), p];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  if (old_r !== 1n) {
    throw new Error(
      `modp_div: b ile p aralarında asal değil (gcd = ${old_r}), ters eleman yok`
    );
  }

  return mod(old_s, p);
}

// --- Asıl fonksiyon: modüler bölme ------------------------------------------
/**
 * a / b mod p  ==  a * b^-1 mod p
 *
 * @param {bigint} a - pay (dividend)
 * @param {bigint} b - payda (divisor); gcd(b, p) = 1 olmalı
 * @param {bigint} p - modulus (genellikle asal sayı)
 * @returns {bigint} [0, p) aralığında sonuç
 */
function modp_div(a, b, p) {
  const bInv = modInverse(b, p);
  return mod(mod(a, p) * bInv, p);
}

// --- Kullanım örneği / doğrulama --------------------------------------------

if (require.main === module) {
  const p = 97n; // küçük bir asal modulus ile hızlı test

  const a = 55n;
  const b = 11n;

  const result = modp_div(a, b, p);
  console.log(`${a} / ${b} mod ${p} = ${result}`);

  // Doğrulama: (result * b) mod p, a'ya eşit olmalı
  const check = mod(result * b, p);
  console.log(`Doğrulama: (${result} * ${b}) mod ${p} = ${check}  (a = ${a} olmalı)`);
  console.log("Eşit mi?  :", check === mod(a, p));

  // Büyük sayılarla ikinci bir test
  const bigP = 0xfffffffffffffffffffffffffffffffeffffffffffffffn;
  const x = 123456789012345678901234567890n;
  const y = 987654321098765432109876543211n; // rastgele bir bölen

  const r = modp_div(x, y, bigP);
  const check2 = mod(r * y, bigP);
  console.log("\nBüyük sayı testi eşit mi?:", check2 === mod(x, bigP));

  // Ters eleman olmayan durum örneği (gcd != 1)
  try {
    modp_div(1n, 6n, 9n); // gcd(6, 9) = 3, ters yok
  } catch (err) {
    console.log("\nBeklenen hata yakalandı:", err.message);
  }
}

module.exports = { modp_div, modInverse, mod };
