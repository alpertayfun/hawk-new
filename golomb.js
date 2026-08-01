
class BitWriter {
  constructor() {
    this.bits = []; // Bitleri saklamak için bir dizi
  }

  pushBit(bit) {
    this.bits.push(bit & 1); // Bit değerini 0 veya 1 olarak sakla
  }

  encodeInt(x, n) {
    if (n === 0) return; // 0 bitlik alan varsa hiçbir şey yazılmaz
    for (let bitPos = n - 1; bitPos >= 0; bitPos--) {
      this.pushBit((x >> bitPos) & 1); 
    }
  }

  decodeInt(n) {
    if (n === 0) return;
    let x = 0;
    for(let bitPos = n - 1; bitPos >= 0; bitPos--) {
        x |= (this.bits.shift() << bitPos);
    }
    return x;
  }

  toBitString() {
    return this.bits.join(''); // Bitleri birleştirerek string olarak döndür
  }

    toStringtoBit(){
        return "";  
    }

  get length() {
    return this.bits.length; // Bit uzunluğunu döndür
  }
}


function compressGR(x, low, high) {

  const k = x.length; //girdi arrayinin uzunluğunu al
  const writer = new BitWriter(); //bit yazdır...
  const v = new Array(k); //v arrayini oluştur
  const highLimit = 2 ** high; //high limitini al
  const lowMod = 2 ** low; //bunu almayı unutma

  for (let i = 0; i < k; i++) {
    const s = x[i] < 0 ? 1 : 0;
    writer.pushBit(s);

    const vi = x[i] - s * (2 * x[i] + 1); 
    v[i] = vi;

    if (vi >= highLimit) {
      return null; //return et
    }
  }

  for (let i = 0; i < k; i++) {
    const remainder = v[i] % lowMod; 
    writer.encodeInt(remainder, low); //low bitlik alanı yazdır
  }

  for (let i = 0; i < k; i++) {
    const quotient = Math.floor(v[i] / lowMod);
    for (let j = 0; j < quotient; j++) {
      writer.pushBit(0);
    }
    writer.pushBit(1); // sonlandırıcı '1' biti
  }

  return writer.toBitString(); 
}


// Örnek yaptım...

const x = [-5, 3, -1, 0, 7, -12]; //örnek array
const low = 3; //low 3 al
const high = 8;  //high 8 al

const encoded = compressGR(x, low, high); //encode et geri cagir

if (encoded === null) {
  console.log('Sıkıştırma başarısız (⊥): bir değer üst sınırı aştı.');
} else {
  console.log('Girdi x       :', x); //girdi arrayini yazdır
  console.log('Kodlanmış y   :', encoded); //kodlanmış arrayi yazdır
  console.log('Bit uzunluğu  :', encoded.length); //bit uzunluğunu yazdır
}

module.exports = { compressGR, BitWriter }; //compressGR ve BitWriter'ı dışa aktar.


// devam et

const crypto = require('crypto');

 var a = crypto.createHash('shake256', { outputLength: 32 }) // byte cinsinden çıktı uzunluğu
    .update('merhaba dünya')
    .digest('hex');


console.log(a.toString());