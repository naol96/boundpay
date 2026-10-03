# BoundPay — Kanonik Özet (CANON.md)

> **Statü:** Onaylanmış L0/L1 Kanonik Referans (BP-00 tamamlandı).  
> Bu dosya, tüm geliştirici agent'ların ve alt sistemlerin uymak zorunda olduğu tek gerçeklik kaynağıdır (Single Source of Truth).  
> Çelişki durumunda: Master v1.1 > CANON.md > Diğer Dokümanlar.

---

## 1. Ne Yapıyoruz / Ne Yapmıyoruz

### 1.1 Ne Yapıyoruz
- **Konumlandırma:** Solana Foundation Payment Channels (`CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX`) + MPP/PayKit üzerine kurulu, OpenAI-compatible streaming için AI-native **uygulama katmanı ve provider-side middleware**.
- **Temel Özellikler:**
  - Gerçek zamanlı chunk / token usage metering (numbered chunk — ADR-001).
  - Pricing manifest integrity ve hash binding (oturum başında bağlanır, sabit kalır — G8).
  - 50-byte cumulative voucher ayrıştırma, doğrulama ve takip.
  - Durable ChannelStore (SQLite WAL) ile transactional persist-önce-sun mimarisi (G6).
  - İzole Settlement & Close Watcher servisi (`settle_and_seal`, `seal`, `distribute`).
  - Ephemeral test ortamı ve deterministik LLM SSE proxy.

### 1.2 Kesinlikle Yapılmayacaklar (Non-Goals)
- **Yeni On-Chain Program:** `programs/`, `Anchor.toml`, `#[program]` YOK (G1).
- **Voucher Format Modifikasyonu:** Voucher payload'ına yeni alan eklenemez, 50 bayttır (G2).
- **Özel Protokoller:** Özel WebSocket voucher aktarım protokolü icat edilmez; MPP/PayKit standartları kullanılır (G3).
- **v2 Özellikleri:** `settleBatch`, `rearm`, `settle_metered` denylist'tedir, kullanılmaz (G4).
- **Güvensiz Settlement:** Grace sonrası permissionless `settle` işlemine güvenilmez.
- **Gerçek LLM "Resume" İddiası:** Gerçek LLM'ler için "aynı token'dan resume" iddiasında bulunulamaz (G11).
- **Reseller Gateway:** Reseller gateway katmanı kurulamaz (G10).
- **Gizli Anahtar Sızıntısı:** Repo'da veya loglarda hiçbir zaman mainnet veya authority özel anahtarları yer alamaz (G14).

---

## 2. Voucher Formatı ve Doğrulama

- **Canonical Program ID:** `CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX`
- **Payload Uzunluğu:** Tam **50 bayt** (imzasız, binary, little-endian).
- **İmza:** Ed25519 (64 bayt).
- **Golden Vector Kuralı:** Golden vector'lar yalnızca Foundation generated client veya resmi referans çıktılarından alınır, uydurulamaz.

---

## 3. Sistem Akışı ve Invariants

### 3.1 Çekirdek Değişmezler (Invariants)

```text
on_chain_settled ≤ accepted_cumulative ≤ deposit
payout_watermark ≤ on_chain_settled
```

- `deposit`: Kanala yatırılmış toplam güvence tutarı.
- `accepted_cumulative`: Sunucunun onaylayıp diskte transactional olarak kaydettiği toplam kümülatif tutar.
- `on_chain_settled`: Zincir üzerinde onaylanmış settlement tutarı.
- `payout_watermark`: Sağlayıcıya ödenen en son seviye.

### 3.2 Temel Mimari Prensipler
- **Persist-önce-sun (Verify-then-Commit):** `doğrula → transactional yaz → ack → sonraki pencere` (G6).
- **Fiyat Otoritesi:** Meter ve fiyat otoritesi sağlayıcı (provider) tarafındadır; istemci (client) yalnızca gözlemler ve `Ack()` döner.
- **Tek Kanal = Tek Akış (Mutex):** Aynı ödeme kanalı üzerinde aynı anda yalnızca tek bir aktif stream bulunabilir (G12).
- **Preflight Kontrolü:** `giriş_maliyeti + (max_tokens × output_fiyatı) ≤ kalan_kanal_tavanı` (G13).

---

## 4. Persist Sırası ve İki Watermark

1. **Verify:** Gelen cumulative voucher imzası, kanal ID'si ve tutarı doğrulanır (`v_new > v_current`).
2. **Transactional Write:** SQLite WAL modunda `accepted_cumulative` atomik olarak güncellenir.
3. **Ack:** İstemciye doğrulama bildirimi (Ack) iletilir.
4. **Emit:** Sonraki token / chunk penceresi istemciye aktarılır.

İki watermark seviyesi:
- **Off-chain Watermark (`accepted_cumulative`):** Çökme (crash) durumunda bile geri alınamaz.
- **On-chain Watermark (`on_chain_settled`):** Settlement işlemi tamamlandıkça zincir üstünde güncellenir.

---

## 5. Close Semantiği ve Grace Yönetimi

1. **Cooperative Close:** İki taraf da mutabıksa anında kapatma ve dağıtım yapılır.
2. **Unilateral Close (Grace Period):**
   - Grace periyodu içinde: `settle_and_seal` instruction'ı çalıştırılır.
   - Grace süresi dolduktan sonra: `seal` + `distribute` instruction'ları çalıştırılır.
   - Watcher bağımsız bir bileşen olarak kanalları dinler ve grace süresi dolmadan önce en son `accepted_cumulative` voucher'ı ile settlement'ı güvenceye alır.

---

## 6. Recovery ve Hata Dayanıklılığı

- `MemoryChannelStore` yalnızca test dosyalarında kullanılabilir (G9).
- Üretimde ve entegrasyon testlerinde SQLite WAL adapter (`packages/store`) zorunludur.
- Ani süreç sonlanmalarında (`kill -9`) recovery sonrası invariant'lar doğrulanır; onaylanmış veri geri alınamaz.

---

## 7. Kullanılmayacak Özellikler Denylist

- ❌ `settleBatch`
- ❌ `rearm`
- ❌ `settle_metered`
- ❌ `initialize` (Doğrusu `open`)

---

## 8. Guard Kuralları Özeti (G1–G14)

| ID | Kural | Denetim Yöntemi |
|---|---|---|
| **G1** | `programs/`, `Anchor.toml`, `#[program]` YOK | CI grep denetimi |
| **G2** | Voucher payload tam 50 bayt | Unit & Golden test |
| **G3** | Özel WebSocket voucher protokolü YOK (MPP/PayKit kullanılır) | Import boundary lint |
| **G4** | v2 denylist fonksiyonları YOK | CI grep denylist |
| **G5** | `client` paketi `watcher`/`chain`/`store` import edemez | ESLint import boundary |
| **G6** | Persist-önce-sun: verify → persist → ack | Fault-injection testleri |
| **G7** | `on_chain_settled ≤ accepted_cumulative ≤ deposit` | Invariant / Property testleri |
| **G8** | Pricing manifest hash oturum başında bağlanır, değişmez | E2E & Preflight testleri |
| **G9** | `MemoryChannelStore` yalnızca unit testlerde | CI lint |
| **G10** | Reseller gateway YOK | Mimari inceleme |
| **G11** | Gerçek LLM için aynı token'dan resume iddiası YOK | Doküman ve kod taraması |
| **G12** | Tek kanal = tek aktif akış (mutex) | Concurrency testleri |
| **G13** | Preflight bütçe tavanı kontrolü | Preflight unit testleri |
| **G14** | Repo'da mainnet/authority gizli anahtarı YOK | Secret scan (CI & pre-commit) |
