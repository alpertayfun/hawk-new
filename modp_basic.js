/**
 * modp_basic.js
 * -------------
 * Temel modüler aritmetik fonksiyonları (modp_ ailesi): norm, add, sub, neg.
 * BigInt tabanlı, saf JavaScript, kurulum gerekmez.
 *
 * Notlar:
 *  - Tüm fonksiyonlar sonucu her zaman [0, p) aralığında döner
 *    (JS'in `%` operatörü negatif sayılarda negatif sonuç verebildiği için
 *    bu dosyadaki her fonksiyon normalize edilmiş sonuç garantisi verir).
 *  - p > 0 varsayılır. Asal olması zorunlu değildir (add/sub/neg/norm için
 *    p'nin asal olması gerekmez; sadece pozitif bir modulus yeterlidir).
 */

"use strict";

// --- modp_norm ---------------------------------------------------------
/**
 * a değerini [0, p) aralığına normalize eder.
 * a herhangi bir tam sayı olabilir (negatif dahil), p pozitif olmalı.
 *
 *   modp_norm(-1, 7)  -> 6
 *   modp_norm(15, 7)  -> 1
 *   modp_norm(7, 7)   -> 0
 */
function modp_norm(a, p) {
  if (p <= 0n) throw new Error("modp_norm: p pozitif olmalı");
  const r = a % p;
  return r >= 0n ? r : r + p;
}

// --- modp_add ------------------------------------------------------------
/**
 * (a + b) mod p
 * a ve b [0, p) aralığında olmasa bile doğru sonucu verir (önce normalize eder).
 */
function modp_add(a, b, p) {
  return modp_norm(modp_norm(a, p) + modp_norm(b, p), p);
}

// --- modp_sub ------------------------------------------------------------
/**
 * (a - b) mod p
 * Sonuç her zaman [0, p) aralığında, negatif değer dönmez.
 */
function modp_sub(a, b, p) {
  return modp_norm(modp_norm(a, p) - modp_norm(b, p), p);
}

// --- modp_neg ------------------------------------------------------------
/**
 * (-a) mod p
 * a == 0 ise sonuç 0 olur; aksi halde p - (a mod p) döner.
 */
function modp_neg(a, p) {
  return modp_norm(-modp_norm(a, p), p);
}

// --- Kullanım örneği / doğrulama --------------------------------------------

if (require.main === module) {
  const p = 97n;

  console.log("=== modp_norm ===");
  console.log("modp_norm(-1, 97)  =", modp_norm(-1n, p).toString());   // 96
  console.log("modp_norm(150, 97) =", modp_norm(150n, p).toString());  // 53
  console.log("modp_norm(97, 97)  =", modp_norm(97n, p).toString());   // 0

  console.log("\n=== modp_add ===");
  console.log("modp_add(90, 20, 97) =", modp_add(90n, 20n, p).toString()); // (110 mod 97) = 13

  console.log("\n=== modp_sub ===");
  console.log("modp_sub(5, 20, 97)  =", modp_sub(5n, 20n, p).toString());  // (-15 mod 97) = 82

  console.log("\n=== modp_neg ===");
  console.log("modp_neg(5, 97)      =", modp_neg(5n, p).toString());       // 92
  console.log("modp_neg(0, 97)      =", modp_neg(0n, p).toString());       // 0

  // Tutarlılık kontrolü: a - b === a + (-b)  (mod p)
  const a = 40n, b = 55n;
  const sub = modp_sub(a, b, p);
  const addNeg = modp_add(a, modp_neg(b, p), p);
  console.log("\nTutarlılık: a - b === a + (-b) ?", sub === addNeg, `(${sub} === ${addNeg})`);

  // Büyük sayı testi
  const bigP = 0xfffffffffffffffffffffffffffffffeffffffffffffffn;
  const x = -123456789012345678901234567890n;
  console.log("\nBüyük negatif norm:", modp_norm(x, bigP) >= 0n && modp_norm(x, bigP) < bigP);
}

module.exports = { modp_norm, modp_add, modp_sub, modp_neg };
