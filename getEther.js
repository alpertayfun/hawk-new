/**
 * Ethereum Blok Bilgisi ve Son İşlemler
 * ---------------------------------------
 * Bu script ethers.js kullanarak Ethereum ağına bağlanır ve:
 *  - Son bloğun detaylarını (boyut, gas kullanımı, zaman damgası vb.)
 *  - Bloktaki son işlemlerin özetini
 * konsola yazdırır.
 *
 * KURULUM:
 *   npm install ethers
 *
 * ÇALIŞTIRMA:
 *   node ethereum-block-info.js
 *
 * NOT: Cloudflare'in public RPC'si ("cloudflare-eth.com") zaman zaman
 * "Cannot fulfill request" hatası verebiliyor (rate-limit / erişim kısıtı).
 * Bu yüzden aşağıda birkaç güvenilir public endpoint sırayla denenir.
 * Kendi Infura/Alchemy API key'iniz varsa en üste ekleyip kullanabilirsiniz.
 */

const { ethers } = require("ethers");

// --- Ayarlar -------------------------------------------------------------

// Sırayla denenecek public RPC'ler (key gerekmez). İlk çalışan kullanılır.
// Kendi key'iniz varsa listenin başına ekleyin:
//   "https://mainnet.infura.io/v3/YOUR_API_KEY",
//   "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
const RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
];

// Kaç adet son işlemi göstermek istediğiniz (bloktan)
const TX_LIMIT = 10;

// --------------------------------------------------------------------------

async function getWorkingProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      // Bağlantıyı test etmek için basit bir çağrı yap
      await provider.getBlockNumber();
      console.log(`Bağlanıldı: ${url}\n`);
      return provider;
    } catch (err) {
      console.log(`Başarısız (${url}): ${err.shortMessage || err.message}`);
    }
  }
  throw new Error("Hiçbir RPC endpoint'ine bağlanılamadı. Kendi API key'inizi eklemeyi deneyin.");
}

async function main() {
  console.log("Ethereum ağına bağlanılıyor...\n");
  const provider = await getWorkingProvider();

  // Ağ bilgisi
  const network = await provider.getNetwork();
  console.log(`Ağ: ${network.name} (chainId: ${network.chainId})`);

  // Son blok numarası
  const latestBlockNumber = await provider.getBlockNumber();
  console.log(`Son blok numarası: ${latestBlockNumber}\n`);

  // Blok detaylarını, içindeki tüm işlem objeleriyle birlikte al
  const block = await provider.getBlock(latestBlockNumber, true);

  if (!block) {
    console.log("Blok bulunamadı.");
    return;
  }

  // Blok boyutunu hesapla (ethers v6 'size' alanını doğrudan vermez,
  // bu yüzden ham RPC çağrısıyla alıyoruz)
  const rawBlock = await provider.send("eth_getBlockByNumber", [
    "0x" + latestBlockNumber.toString(16),
    false,
  ]);

  const sizeInBytes = rawBlock.size ? parseInt(rawBlock.size, 16) : null;

  console.log("=== BLOK BİLGİLERİ ===");
  console.log(`Hash: ${block.hash}`);
  console.log(`Numara: ${block.number}`);
  console.log(`Zaman: ${new Date(Number(block.timestamp) * 1000).toLocaleString("tr-TR")}`);
  console.log(`Boyut: ${sizeInBytes !== null ? sizeInBytes + " byte" : "alınamadı"}`);
  console.log(`Gas Limiti: ${block.gasLimit.toString()}`);
  console.log(`Gas Kullanımı: ${block.gasUsed.toString()}`);
  console.log(
    `Doluluk Oranı: ${((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(2)}%`
  );
  if (block.baseFeePerGas) {
    console.log(
      `Base Fee: ${ethers.formatUnits(block.baseFeePerGas, "gwei")} gwei`
    );
  }
  console.log(`Miner / Validator: ${block.miner}`);
  console.log(`Parent Hash: ${block.parentHash}`);
  console.log(`Nonce: ${block.nonce}`);
  console.log(`İşlem Sayısı: ${block.transactions.length}\n`);

  // console.log(`=== SON ${TX_LIMIT} İŞLEM ===`);

  // const txs = block.transactions.slice(0, TX_LIMIT);

  // txs.forEach((tx, i) => {
  //   // tx bir object (getBlock ile prefetch:true kullandık)
  //   console.log(`\n--- İşlem ${i + 1} ---`);
  //   console.log(`Hash: ${tx.hash}`);
  //   console.log(`Gönderen: ${tx.from}`);
  //   console.log(`Alıcı: ${tx.to ?? "(kontrat oluşturma)"}`);
  //   console.log(`Değer: ${ethers.formatEther(tx.value)} ETH`);
  //   console.log(`Gas Limiti: ${tx.gasLimit?.toString() ?? "-"}`);
  //   if (tx.gasPrice) {
  //     console.log(`Gas Fiyatı: ${ethers.formatUnits(tx.gasPrice, "gwei")} gwei`);
  //   }
  //   console.log(`Nonce: ${tx.nonce}`);
  // });
  
}

main().catch((err) => {
  console.error("Hata oluştu:", err);
  process.exit(1);
});