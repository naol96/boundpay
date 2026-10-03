2. Kalan Açık Noktalar
2.1 Voucher transport ve ödenmemiş maruziyet penceresi (P0)

Sorun. SSE tek yönlüdür (sunucu → istemci). İstemcinin akış sırasında imzaladığı voucher'ları sunucuya nasıl göndereceği tanımlı değildir.

Referans. Tempo'nun streamed payments tasarımında sunucu bir "voucher gerekli" eventi yayar; istemci yeni voucher'ı ayrı bir istekle gönderir ve akış devam eder.

Karar verilmesi gerekenler:

Konu	Karar
Transport	Ayrı HTTP POST mu, WebSocket mi?
Voucher sıklığı	Her token mı, her N token mı, zaman bazlı mı? (rapor4: 100–500 ms heartbeat, ama kural değil)
Ödenmemiş pencere	Provider en fazla kaç token/kaç birim tutarı kredili üretir?
Sıralama	Önce teslim sonra voucher mı, yoksa bir pencere ileriden voucher mı?
Geri basınç	Voucher gecikirse akış ne zaman durur?

Riski kimin taşıdığı (istemci mi provider mı) bu sıralamaya bağlıdır; bu nedenle açıkça yazılmalıdır.

2.2 Kullanım ölçümünün kaynağı ve istemci tarafı doğrulama (P0)

Sorun. İstemci imzalı modelde provider kullanımı bildirir, istemci buna göre imzalar. İstemcinin bu bildirimi bağımsız doğrulaması tasarlanmamıştır; bu, over-metering riskini açık bırakır. rapor4 §9 "provider-reported usage" önerir ancak tek başına yeterli değildir.

Gerçek LLM metering'inde bilinen zorluklar:

Kullanım bilgisi akışın sonunda tek parça gelmeyebilir; stream içine dağılabilir. Yalnızca son chunk'a bakmak eksik sayıma yol açar. Doğru desen, akıştaki tüm usage payload'larını biriktirip fiyatlamayı sonda yapmaktır.
Tek istek; text input, cached input, cache write, output, reasoning ve tool gibi birden fazla farklı fiyatlı bileşen üretebilir.
Post-paid ölçüm + streaming, güvenilmeyen tarafın döngüsünü finanse etme riski taşır. Bu nedenle istek başında en kötü durum maliyeti tahmin edilmelidir.

Önerilen kararlar:

İstemci, aldığı chunk sayısını kendisi sayar; provider bildirimi ile karşılaştırır.
Preflight kontrolü: prompt_tokens × input_fiyat + max_tokens × output_fiyat ≤ kalan_tavan. Karşılanamıyorsa istek reddedilir. (rapor4 §7 yalnızca "sonraki chunk maliyeti"ne bakıyor; istek başındaki max_tokens kontrolü eksik.)
MVP yalnızca output token veya numaralı chunk ile sınırlı kalır (rapor4 §9 ile uyumlu).
2.3 "Aynı noktadan devam" gerçek LLM'de mümkün değil (P0)

Tutarsızlık. Ana doküman Senaryo 3 ve rapor1 §28, provider çökmesinden sonra akışın aynı noktadan devam ettiğini anlatır. rapor4 §5 daha doğru bir ifade kullanır: "akış yeniden başlatılır veya session kapatılır."

Gerçek: Upstream LLM üretimi sürdürülemez. Yeniden üretim, ek upstream maliyeti ve "yeniden üretilen token'ı kim öder" sorusunu getirir.

Öneri: İki modu ayrı yazın:

Mod	Davranış
Deterministik demo meter	Akış aynı sequence'ten devam edebilir
Gerçek upstream	Son kabul edilen voucher settle edilir, session kapatılır veya yeni session açılır; yeniden üretim maliyeti için politika belirlenir
2.4 Kalıcı yazma sırası ve ölçülebilir hedefler (P0)

Sorun. Durable store hedefi var, ancak sıra tanımlı değil.

Önerilen sıra (persist-önce-sun):

text
Voucher alınır
→ doğrulanır
→ kalıcı olarak yazılır (transactional)
→ ancak sonra bir sonraki chunk serbest bırakılır

Tersi sırada çökme, ödenmemiş chunk üretilmesine yol açar.

Ölçüm notu. Foundation'ın benchmark şablonu, varsayılan bellek içi depo yeniden başlatıldığında kabul edilmiş ama settle edilmemiş voucher'ların kaybolabileceğini belirtir ve kalıcı depolamanın isteğe ek maliyet getirdiğini, bunun ayrıca ölçülmesi gerektiğini söyler. Bu, Stream402'nin gerçek farklılaştırıcılarından biridir.

Eksik sayılar. rapor4 §11'de "belirlenen P99" ifadeleri placeholder olarak kalmıştır. Gerçek hedefler yazılmalıdır, örneğin:

Metrik	Hedef (doldurulacak)
Voucher doğrulama P99	___ ms
Kalıcı yazma P99 (durable)	___ ms
Provider restart sonrası state yükleme	≤ 2 sn (rapor4)
Proxy'nin eklediği streaming gecikmesi	___ ms
2.5 Forced close sırasında provider izleyicisi (P0)

Sorun. Programın kapanış akışı: request_close ile bekleme süresi (grace period) başlar, süre sonunda seal yapılır. Provider bu sürede son voucher'ı sunmazsa unsettled claim'i kaybedebilir.

rapor4 §6 grace period değerini "protokolün onayladığı değer" olarak bırakmıştır; bu bir placeholder'dır.

Yapılacaklar:

Gerçek grace period değerini Foundation dokümanından (state machine, instruction reference) okuyup belgeye yazın.
request_close eventini izleyen ve otomatik olarak settle_and_seal gönderen bir provider-side watcher ekleyin.
Grace period içinde permissionless settlement'ın gerçekten mümkün olup olmadığını doğrulayın (ana dokümanın açık sorularında hâlâ duruyor).
2.6 "Channel revoke" ifadesi düzeltilmeli (P0)

Sorun. rapor4 §2, session key çalınırsa çözüm olarak "channel revoke" sayar. İncelenen talimat listesinde revoke veya signer değiştirme yoktur:

text
open, settle, settle_and_seal, top_up, request_close,
seal, distribute, withdraw_payer, reclaim

Gerçek önlemler:

Düşük escrow tavanı
Kısa expiry
request_close ile zorunlu kapanış
Kanalın payee'sinin sabit olması (çalınan anahtar parayı üçüncü bir tarafa yönlendiremez; en kötü durum, meşru payee'ye aşırı harcamadır)

Not. İmzacının payer'dan ayrı olması desteklenmektedir (kanalda ayrı bir authorized_signer alanı vardır). Bu, ephemeral session key modelini destekler.

2.7 Maliyet modeli ve kanal ömrü politikası (P1)

Açık sorular:

Soru	Not
Her akış için yeni kanal mı, yeniden kullanılabilir kanal mı?	PayAI'nin x402 batch-settlement'ı yeniden kullanılabilir, 0.01–100 USDC arası fonlanan kanallar kullanıyor
Ağ ücreti ve iade edilebilir rent'i kim finanse eder?	Operatör SOL avansı verebiliyor; "ajan yalnızca USDC tutar" varsayımı kesin değil
İlk token gecikmesi	Quicknode'un MPP dokümanı ilk istekte kanal açılışı için yaklaşık yarım saniye veriyor (farklı bir yığın, ama işaret olarak değerli)
Fee sponsorship	Şu an P2; ilk açılış gecikmesi ve SOL gereksinimiyle birlikte yeniden değerlendirilmeli

Devnet hazırlık notu. Canalis ekibi, test mint'i için programın beklediği treasury ATA'yı elle oluşturmak zorunda kalmıştır. MVP planına "devnet asset + treasury ATA hazırlığı" adımı eklenmelidir. Programda protokol ücreti olup olmadığı da doğrulanmalıdır.

2.8 Dağıtım topolojisi: iki farklı ürün (P0 karar)

Dokümanlar iki farklı ürünü karıştırıyor:

Topoloji	Kaynak	Sonuç
Provider-side middleware: bağımsız provider'lar (vLLM, Ollama, OpenRouter) Stream402 proxy'sini kendi endpoint'lerinin önüne koyar	Ana doküman §7	Payee provider'ın kendisi
Yeniden satıcı gateway: proxy'nin arkasında OpenAI/Anthropic API var	rapor1 §44, §64	Payee proxy operatörü; upstream faturayı o öder

İkinci modelde ek sorunlar doğar: OpenAI/Anthropic'in yeniden satış koşulları ve proxy operatörünün kendi upstream bakiyesi/riski. Tek bir topoloji seçilmeli ve tüm dokümanlar buna göre hizalanmalıdır.

2.9 Karşılaştırma tablolarındaki eksik rakipler (P1)

rapor1 ve rapor3 pay.sh, PayKit, MPP ve x402'yi karşılaştırıyor. Aşağıdakiler eksik:

Proje	Neden önemli
Tempo MPP streamed payments	SSE üzerinden token başına faturalamayı, sunucunun voucher'ı artırmasıyla yapıyor (EVM). Kavramsal ön çalışma. Tempo ayrıca OpenAI ve Anthropic için hazır MPP uç noktaları sunuyor
PayAI x402 batch-settlement	28 Eylül'de Solana'da public preview. Server modunda operatör, kullanımı ölçtükten sonra kümülatif voucher imzalıyor; AI inference için uygun
Foundation settle_metered önerisi (issue #89)	İstemcinin imzaladığı tavan altında operatörün gerçek tutarı tahsil etmesini öneriyor; hedef inference/token başı faturalama. Kabul edilirse ürün katmanının bir kısmı primitifin içine girer
pay-kit MPP session SSE yardımcıları	mpp.metering ve mpp.usage eventleri, MeteredSseSession, Ack metodu. Genel amaçlı metered SSE katmanı mevcut
Meterline	Kendi Pinocchio programını yazmış, API çağrısı başına voucher
Canalis	Aynı hackathon, aynı primitif; ajan bütçe/ödeme orkestrasyonu, canlı devnet kanıtı. Katman farklı (tamamlayıcı)
BlockRun, GlianaAI	Solana'da pay-per-call LLM gateway'leri (x402/MPP)

Önemli not (delivery commit). pay-kit'in MeteredSseSession.Ack metodu bir commit receipt döndürüyor. Bu, rapor4'teki DELIVERY_COMMITTED durumuna benzer bir kavram gibi görünüyor. Kendi durum makinenizi icat etmeden önce bunun anlamını doğrulayın ve MPP ile uyumlu kalın.

Doğrulanmadı: pay-kit'te OpenAI/Anthropic'e özel adaptör veya token sayımı olup olmadığı. Kodu okuyarak kontrol edilmeli.

3. Ana Dokümanda Güncellenmesi Gereken Yerler
Bölüm	Güncelleme
§4.6 "Mevcut Çözümlerin Eksikleri" – MPP sessions satırı	"Solana'da AI-native ürün katmanı yok" ifadesi zayıflamıştır; generic metered SSE katmanı mevcut. "LLM'e özel adaptör, recovery ve durable watermark yok" şeklinde daraltın (doğrulama sonrası)
§18.1 – "x402 batch-settlement SVM parity" riski	Risk gerçekleşmiştir (PayAI preview). Riski "gerçekleşti" olarak işaretleyin, farklılaşmayı server mode'a karşı yeniden savunun
§13 Veri Modeli – Voucher	Foundation voucher'ı sabit 50 bayttır (magic, channel id, kümülatif tutar, expiry). nonce, stream_id, pricing_manifest_hash alanları settlement voucher'ında yok; rapor4 §3'teki ayrı imzalı zarfa taşıyın
§22.3 Henüz karar verilmemiş konular	Top-up programda zaten var (top_up); TypeScript client de mevcut (üretilmiş client + pay-kit). Bu iki maddeyi çıkarın veya "entegrasyon tasarımı" olarak yeniden yazın
Senaryo 3	§2.3'teki iki modlu ifadeyle değiştirin
Demo baseline	Yalnızca x402 exact ile değil, pay-kit'in MPP session SSE yardımcılarıyla da kıyaslayın
4. Birleşik P0 / P1 / P2 Listesi

rapor4 §14 listesine eklemeler kalın işaretlenmiştir.

P0 — Mutlaka kapatılmalı
 Voucher imzalayan taraf kesinleştirildi
 Session key ile channel arasındaki bağ tanımlandı
 Foundation voucher formatı ile uygulama zarfı ayrıldı
 Pricing manifest hash eklendi
 Provider crash ve agent crash ayrı tasarlandı
 Timeout, idle close ve forced close değerleri belirlendi
 Delivery ile payment authorization ayrımı dokümante edildi
 x402/MPP/Stream402 görev sınırları yazıldı
 Ceiling aşımı ve duplicate settlement testleri eklendi
 Voucher transport (SSE dışı kanal) ve ödenmemiş pencere kuralı
 İstemci tarafı kullanım doğrulaması (chunk sayımı)
 Preflight max_tokens maliyet kontrolü
 Persist-önce-sun sırası ve gerçek P99 hedefleri
 request_close izleyicisi (provider watcher) ve gerçek grace period değeri
 "Channel revoke" ifadesinin düzeltilmesi
 Dağıtım topolojisi kararı (middleware mi, yeniden satıcı gateway mi)
 Gerçek LLM'de kesinti ve yeniden bağlanma semantiği (deterministik vs gerçek upstream)
P1 — Hackathon'u güçlendirir
 Top-up veya düşük bakiye davranışı
 MPP receipt formatı desteği
 OpenAI-compatible endpoint
 Provider dashboard
 5.000 chunk benchmark
 Provider restart canlı demo
 Final receipt
 Kanal ömrü politikası (tek kullanımlık vs yeniden kullanılabilir) ve ücret/rent sahibi
 Devnet asset + treasury ATA hazırlığı
 Karşılaştırma tablolarına eksik rakiplerin eklenmesi
 pay-kit Ack/commit receipt ile uyum doğrulaması
P2 — Sonraki sürüm
 Anthropic adapter
 Rust SDK
 Multi-provider routing
 Token-2022 desteği
 Otomatik top-up
 Fee sponsorship
 Production monitoring ve audit
 Operatör imzalı (server mode) imza modeli
5. Önerilen Konumlandırma (özet)

Bulgular şu sonucu destekliyor: Stream402 yeni bir payment-channel protokolü ya da genel bir streaming ödeme katmanı olarak değil, Foundation payment-channels, MPP ve x402 üzerine kurulu LLM streaming ürün katmanı olarak anlatılmalıdır. Asıl fark yaratacak alanlar:

OpenAI/Anthropic usage eventlerini okuyan metering ve fiyat bütünlüğü
Dayanıklı watermark ve crash recovery (persist-önce-sun)
Forced close izleyicisi ve güvenli close/reclaim akışı
İstemci tarafı doğrulamalı, non-custodial (istemci imzalı) güven modeli. Bu, operatör imzalı server mode'a karşı savunulabilir bir fark olabilir; ancak bu bir çıkarımdır, test edilmedi
Geliştirici deneyimi: minimum kod değişikliğiyle OpenAI client uyumu
6. Doğrulanmamış / Takip Edilecekler
pay-kit'te OpenAI/Anthropic'e özel adaptör veya token sayımı var mı?
Grace period'da provider settlement permissionless mı? Grace period'ın gerçek değeri nedir?
Programda protokol ücreti / treasury payı var mı?
Ryvo, Faremeter Flex ve MCPay bu turda yeniden kontrol edilmedi.
Foundation'ın bildirdiği benchmark rakamları bağımsız olarak yeniden üretilmedi ve upstream servis olmadan ölçüldü; Stream402 performansı olarak sunulmamalı.
7. Kaynaklar
Solana Foundation, payment-channels (program, talimat listesi, durum makinesi): https://github.com/solana-foundation/payment-channels
Solana Foundation duyurusu: https://solana.com/news/payment-channels-1-million-payments-per-second
Issue #89, settle_metered: https://github.com/solana-foundation/payment-channels/issues/89
pay-kit: https://github.com/solana-foundation/pay-kit
pay-kit Go MPP client (MeteredSseSession): https://pkg.go.dev/github.com/solana-foundation/pay-kit/go/protocols/mpp/client
pay-kit issue #341 (metered SSE decoding): https://github.com/solana-foundation/pay-kit/issues/341
Solana MPP dokümanı: https://solana.com/docs/payments/agentic-payments/mpp
PayAI x402 batch settlement: https://solanacompass.com/news/payai-launches-x402-batch-settlement-on-solana-in-public-preview-bundling-usdc-micropayments-into-channel-claims
Solana payment channels, merchant riskleri ve benchmark notları: https://bitcoinethereumnews.com/tech/solana-payment-channels-refunds-and-merchant-risks/
Tempo, streamed payments: https://docs.tempo.xyz/docs/guide/machine-payments/streamed-payments
Tempo, MPP sessions: https://tempo.xyz/blog/mpp-sessions/
Tempo, AI model access: https://docs.tempo.xyz/docs/guide/machine-payments/use-cases/ai-model-access
MPP session intent: https://mpp.dev/intents/session
Quicknode, MPP payments: https://www.quicknode.com/docs/build-with-ai/mpp-payments
Meterline: https://github.com/bryankwandou/meterline
Canalis: https://github.com/EcstaceeLOR/Canalis
LLM per-token billing pitfalls: https://dev.to/kral-ai/billing-llm-usage-per-token-the-pitfalls-nobody-warns-you-about-oge
