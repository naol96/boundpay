# Stream402 — Kalan Açık Noktalar ve İyileştirme Notları

> **Amaç:** Bu doküman, Stream402 araştırma ve mimari dokümantasyonundaki mevcut kararları tamamlamak, protokol uyumluluğunu netleştirmek ve MVP öncesi kalan teknik/ürün açıklarını kapatmak için hazırlanmıştır.

## 1. Genel Değerlendirme

Stream402, Solana Payment Channels, x402 ve MPP üzerine kurulan bir **AI streaming payment application layer** olarak konumlandırılmalıdır. Proje yeni bir payment-channel protokolü icat etmemelidir.

Stream402’nin ana katkısı şu bileşenlerin birleşimidir:

- OpenAI/Anthropic uyumlu streaming API proxy
- Gerçek zamanlı usage metering
- Pricing integrity
- Cumulative voucher yönetimi
- Delivery ve recovery süreçleri
- Provider ve agent crash recovery
- Geliştirici deneyimi ve operasyon paneli

Önerilen proje tanımı:

> **Stream402, Solana payment-channels, x402 ve MPP altyapısını OpenAI/Anthropic uyumlu AI streaming API’leri için kullanılabilir hâle getiren; token kullanımını gerçek zamanlı ölçen, cumulative voucher’ları yöneten ve settlement/refund/recovery süreçlerini yöneten AI-native ödeme katmanıdır.**

## 2. Kritik Açık: Voucher İmza Modeli

Voucher’ı kimin imzaladığı, hangi anahtarın hangi kanala bağlı olduğu ve anahtar çalındığında ne olacağı kesinleştirilmelidir.

### Çözülmesi gereken sorular

| Soru | Karar alınmalı |
|---|---|
| Voucher’ı kim imzalar? | Client session key veya provider authorizer |
| İmzacı anahtar kanala nasıl bağlanır? | `authorizedSigner` alanı |
| Anahtar ne kadar süre geçerli? | Session expiry |
| Anahtarın maksimum zararı nedir? | Escrow ceiling ile sınırlı |
| Anahtar çalınırsa ne olur? | Channel revoke, close veya recovery |
| Provider voucher’ı neyi doğrular? | Signature, channel, cumulative amount, expiry, signer |

### Önerilen MVP kararı

MVP için en güvenli model:

```text
Client-controlled ephemeral session key
+ düşük escrow ceiling
+ kısa expiry
+ channel-bound domain separation
```

Bu modelde provider ödeme miktarını kendi başına artıramaz; yalnızca client’ın imzaladığı geçerli cumulative voucher’ı settle edebilir.

Provider/operator-authorized imza modeli sonraki aşamada ayrı bir mod olarak eklenebilir.

## 3. Voucher Formatı ve Uygulama Metadata’sı

Stream402 kendi özel voucher formatını doğrudan blockchain voucher’ına eklememelidir. Solana Payment Channels’ın settlement voucher formatı korunmalıdır.

### Settlement voucher

Blockchain programının anlayacağı minimum format:

```text
channel_id
cumulative_amount
expiry
signature
```

### Application envelope veya receipt

Stream402’nin uygulama seviyesinde tutması gereken bilgiler:

```text
stream_id
request_id
model
endpoint
pricing_manifest_hash
input_tokens
output_tokens
meter_version
close_reason
```

Bu alanlar settlement voucher’ına eklenmemeli; ayrı bir imzalı application envelope veya receipt içinde tutulmalıdır.

Böylece:

- Foundation payment-channel programı ile uyumluluk korunur.
- Pricing ve metering bilgisi değiştirilemez şekilde bağlanabilir.
- Cross-language serialization testleri daha kolay yapılır.
- Replay ve domain separation riski azalır.

## 4. Ödeme Yetkilendirmesi ve Teslimat Ayrımı

“Ödeme yetkilendirildi” ile “veri eksiksiz teslim edildi” aynı şey değildir. Bu iki durum açıkça ayrılmalıdır.

### Örnek risk senaryosu

```text
Provider chunk üretir
↓
Client chunk’ı alır
↓
Client voucher imzalar
↓
Provider voucher’ı kabul eder
↓
Bağlantı kopar
```

Bu durumda client, verinin tamamını alamamış olabilir.

### Önerilen durum makinesi

```text
REQUESTED
  ↓
PAYMENT_AUTHORIZED
  ↓
DELIVERY_STARTED
  ↓
DELIVERY_COMMITTED
  ↓
SETTLEMENT_PENDING
  ↓
SETTLED
```

Hata durumları:

```text
DELIVERY_FAILED
PAYMENT_REJECTED
REDELIVERY_REQUIRED
REFUND_PENDING
```

### MVP sınırı

MVP, AI çıktısının kullanıcı tarafından eksiksiz alındığını kriptografik olarak kanıtlamaz. Bu sınır açıkça belirtilmelidir:

> “Stream402 ödeme yetkilendirmesini ve settlement’ı doğrular; AI çıktısının kullanıcı tarafından eksiksiz alındığını kriptografik olarak kanıtlamaz.”

## 5. Provider ve Agent Crash Recovery

Provider ve agent çökme senaryoları ayrı ayrı tasarlanmalıdır.

### Provider crash recovery

Gerekli durum:

```text
session_id
channel_id
latest_accepted_voucher
latest_cumulative_amount
settlement_watermark
pricing_manifest_hash
status
```

Davranış:

- Provider restart sonrası son accepted watermark yüklenir.
- Eski voucher tekrar settle edilmez.
- Akış yeniden başlatılır veya session kapatılır.
- Aynı final voucher ikinci kez settle edilemez.
- Settlement işlemleri idempotent olmalıdır.

### Agent crash recovery

Gerekli durum:

```text
channel_id
session_id
last_accepted_voucher
spending_limit
session_key_reference
expiry
```

Davranış:

- Agent yeni instance ile session’a devam edebilmelidir.
- Veya session’ı güvenli biçimde kapatıp kalan bakiyeyi reclaim edebilmelidir.
- Session key kaybolursa provider’ın fonları sonsuza kadar kilitli kalmamalıdır.

### Zorunlu seçeneklerden en az biri

- Session key backup/recovery.
- Wallet tarafından yeniden üretilebilir session key.
- Expiry sonrası permissionless reclaim.
- Agent’ın channel ID üzerinden session durumunu yeniden keşfetmesi.

## 6. Timeout, Idle Close ve Forced Close

Kanalın ne zaman kapanacağı net tanımlanmalıdır.

### Çözülmesi gereken sorular

- Client kaç saniye voucher göndermezse provider akışı durdurur?
- Provider kaç saniye cevap vermezse client close başlatır?
- Kanal ne zaman idle-close olur?
- Final voucher gelmeden kalan para ne zaman reclaim edilebilir?
- Forced close başladıktan sonra provider’ın son voucher’ı sunması için ne kadar süresi vardır?

### Önerilen MVP değerleri

```text
Voucher heartbeat: 100–500 ms
Provider payment timeout: 2 saniye
Session idle timeout: 30 saniye
Forced-close grace period: protokolün onayladığı değer
```

Bu değerler sabit kodlanmamalı; session manifest veya provider policy içinde tanımlanmalıdır.

## 7. Top-up ve Düşük Bakiye Davranışı

Uzun AI streaming oturumlarında bakiye bitmeden önce davranış belirlenmelidir.

### Örnek senaryo

```text
Ceiling = $1.00
Usage = $0.98
Yeni chunk maliyeti = $0.05
```

### Seçenekler

1. Akışı durdur.
2. Client’tan top-up iste.
3. Otomatik top-up yap.
4. Son geçerli voucher’da akışı kapat.

### Önerilen MVP davranışı

```text
remaining_balance < next_chunk_estimated_cost
→ stream durur
→ client top-up veya close seçer
```

Otomatik top-up MVP’de önerilmez. Otomatik harcama, agent wallet güvenliği açısından ek risk yaratır.

## 8. Pricing Manifest Integrity

Provider, akış sırasında fiyatı değiştirememelidir.

### Yasak olmalı olan senaryo

```text
Stream başlarken:
1,000 output token = $0.01

Akış sırasında:
1,000 output token = $0.10
```

### Çözüm

Session veya channel açılırken fiyat bilgisi hash’lenmelidir:

```text
pricing_manifest_hash
```

### Örnek pricing manifest

```json
{
  "provider": "provider-id",
  "model": "model-id",
  "inputPrice": "0.001",
  "outputPrice": "0.002",
  "currency": "USDC",
  "meterUnit": "output_token",
  "meterVersion": "1",
  "endpoint": "/v1/chat/completions",
  "validUntil": "..."
}
```

Akış sırasında provider yalnızca bu manifest’e göre hesap yapmalıdır. Manifest değişirse yeni session açılmalıdır.

## 9. Token Metering Kararı

MVP için tek bir metering stratejisi seçilmelidir.

### Önerilen yaklaşım

| Kullanım alanı | Önerilen yöntem |
|---|---|
| Hackathon demo | Deterministic chunk veya output-token meter |
| Gerçek entegrasyon | Provider-reported usage + local streaming meter + final reconciliation |

### Dikkat edilmesi gereken fiyat alanları

- Input token fiyatı
- Output token fiyatı
- Cached token
- Reasoning token
- Tool call
- Görsel veya multimodal input
- Tokenizer versiyonu
- Model değişikliği

İlk MVP’de yalnızca output token veya numaralı chunk desteklenmelidir. “Her modeli ve her fiyat modelini destekliyoruz” iddiasında bulunulmamalıdır.

## 10. x402, MPP, PayKit ve Stream402 Sınırları

Bu sistemlerin görevleri ayrı ayrı tanımlanmalıdır.

| Katman | Görevi |
|---|---|
| x402 | HTTP üzerinden ödeme challenge ve payment proof |
| MPP | Session, metered usage ve payment receipt |
| Solana Payment Channels | Escrow, cumulative voucher ve settlement |
| PayKit | Genel ödeme SDK ve entegrasyon altyapısı |
| Stream402 | AI proxy, metering, pricing, recovery ve developer experience |

Stream402, x402 ve MPP’yi rakip olarak değil, desteklenebilecek protokol seçenekleri olarak konumlandırmalıdır.

### Önerilen discovery sonucu

```text
Client supports:
- x402
- MPP
- Stream402-native session

Provider advertises:
- supported protocols
- supported assets
- supported meter
- maximum session duration
```

## 11. Ölçülebilir Başarı Kriterleri

“AI-native”, “kolay” ve “düşük gecikmeli” gibi ifadeler ölçülebilir hedeflere bağlanmalıdır.

| Hedef | Başarı kriteri |
|---|---|
| SDK entegrasyonu | OpenAI client kodunda en fazla 3–5 satır değişiklik |
| Voucher doğrulama | 100 voucher/sn’de belirlenen P99 süresinin altında kalma |
| Streaming overhead | Upstream latency’ye belirlenen sınırdan fazla eklenmemesi |
| Recovery | Provider restart sonrası 2 saniye içinde state yüklenmesi |
| Settlement | Aynı final voucher iki kez settle edilememesi |
| Pricing integrity | Stream sırasında fiyat değiştirilememesi |
| Ceiling enforcement | Hiçbir durumda escrow tavanı aşılmaması |
| Demo | 5.000 chunk akışında yalnızca beklenen on-chain işlemler |

Solana’nın payment-channel primitive performansı, Stream402 proxy, database, tokenizer ve API katmanının performansıyla aynı değildir. Bu nedenle altyapı benchmark’ları doğrudan Stream402 performansı olarak sunulmamalıdır.

## 12. Hukuki ve Ekonomik Sınırlar

MVP’de kapsam dışı bırakılabilir; ancak dokümantasyonda sınır olarak belirtilmelidir.

- Stablecoin kullanımı
- Custody/non-custody ayrımı
- Provider’ın fonları ne kadar süre kontrol ettiği
- İade ve tüketici koruması
- Vergi ve fatura
- API sağlayıcının hizmet sorumluluğu
- USDC mint ve network seçimi

Önerilen ifade:

> “MVP devnet ve non-custodial prototiptir; production kullanımı için stablecoin, custody, veri koruma, vergi ve yargı alanına özgü hukuki inceleme gereklidir.”

## 13. Demo Tasarımı

Demo yalnızca “ödeme çalıştı” göstermemelidir. Stream402’nin mevcut altyapının üzerine ne kattığını göstermelidir.

### Baseline akışı

```text
x402 exact veya klasik prepaid model
→ maksimum tutar önceden ödenir
→ erken iptal
→ kullanılmayan tutar ekonomik olarak verimsiz
```

### Stream402 akışı

```text
$10 ceiling
→ 300 token tüketildi
→ provider crash
→ restart
→ final voucher $0.42
→ $9.58 reclaim
```

### Demo’da gösterilmesi gereken metrikler

- Üretilen chunk sayısı
- On-chain transaction sayısı
- Kullanılan tutar
- İade edilen tutar
- Son watermark
- Provider restart süresi
- Duplicate voucher sonucu
- Invalid signature sonucu

## 14. Önceliklendirilmiş Kontrol Listesi

### P0 — Mutlaka kapatılmalı

- [ ] Voucher imzalayan taraf kesinleştirildi.
- [ ] Session key ile channel arasındaki bağ tanımlandı.
- [ ] Foundation voucher formatı ile Stream402 application metadata ayrıldı.
- [ ] Pricing manifest hash eklendi.
- [ ] Provider crash ve agent crash ayrı tasarlandı.
- [ ] Timeout, idle close ve forced close değerleri belirlendi.
- [ ] Delivery ile payment authorization ayrımı dokümante edildi.
- [ ] x402/MPP/Stream402 görev sınırları yazıldı.
- [ ] Ceiling aşımı ve duplicate settlement testleri eklendi.

### P1 — Hackathon’u güçlendirir

- [ ] Top-up veya düşük bakiye davranışı belirlendi.
- [ ] MPP receipt formatı desteklendi.
- [ ] OpenAI-compatible endpoint çalıştı.
- [ ] Provider dashboard hazırlandı.
- [ ] 5.000 chunk benchmark yapıldı.
- [ ] Provider restart canlı gösterildi.
- [ ] Final receipt üretildi.

### P2 — Sonraki sürüm

- [ ] Anthropic adapter.
- [ ] Rust SDK.
- [ ] Multi-provider routing.
- [ ] Token-2022 desteği.
- [ ] Otomatik top-up.
- [ ] Fee sponsorship.
- [ ] Production monitoring ve audit.

## 15. Nihai Konumlandırma

Stream402’nin en doğru teknik kimliği:

> **Stream402 yeni bir payment-channel protokolü değildir. Solana payment-channels, x402 ve MPP üzerine kurulan; AI streaming proxy, usage metering, pricing integrity, delivery/recovery ve geliştirici deneyimi sağlayan bir uygulama katmanıdır.**

Kısa değer önerisi:

> **Stream402 lets AI agents stream first, meter usage continuously, and settle once on Solana.**
