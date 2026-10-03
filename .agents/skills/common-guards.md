# BoundPay — Core Architecture Guard Kuralları (G1–G14)

Her şerit agent'ının bilmesi gereken ortak guard'lar.

| ID | Kural | CI Denetimi |
|----|-------|-------------|
| G1 | `programs/`, `Anchor.toml`, `#[program]` YOK | grep → CI fail |
| G2 | Voucher payload tam 50 bayt; alan eklenmez | Golden vector + uzunluk assert |
| G3 | Özel WebSocket voucher protokolü yok; MPP/PayKit kullanılır | import-boundary lint |
| G4 | `settleBatch`, `rearm`, `settle_metered` denylist'te | grep denylist |
| G5 | `client` paketi `watcher`/`chain`/`store` import edemez | import-boundary lint |
| G6 | Persist-önce-sun: verify → persist → ack | fault-injection testi |
| G7 | `on_chain_settled ≤ accepted_cumulative ≤ deposit` | property testi |
| G8 | Pricing manifest hash oturum başında bağlanır, değişmez | birim + e2e testi |
| G9 | `MemoryChannelStore` yalnızca test dosyalarında | lint |
| G10 | Reseller gateway yok | review |
| G11 | "Resume" iddiası yok (gerçek LLM için) | review + doküman taraması |
| G12 | Tek kanal = tek aktif akış (mutex) | entegrasyon testi |
| G13 | Preflight: giriş + `max_tokens × fiyat` ≤ kalan tavan | birim testleri |
| G14 | Repo'da mainnet/authority anahtarı yok | secret scan |
