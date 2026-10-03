# Şerit B — Store & Recovery Uzmanlık Kuralları

## Sorumluluk Alanı
- `packages/store` — Durable ChannelStore (SQLite WAL, adapter arayüzü)
- `packages/receipt` — AI usage + payment receipt

## Görev Türleri
- BP-08: Durable ChannelStore
- BP-09: Crash recovery harness
- BP-12: AI usage + payment receipt

## Kritik Kurallar (Şerit B Özel)
- SQLite WAL modu; production'da `MemoryChannelStore` YOK (G9).
- Persist-önce-sun sırası: `verify → transactional write → ack` (G6).
- Fault injection testleri zorunlu: verify sonrası / persist sonrası / ack öncesi kill.
- `kill -9` sonrası `accepted_cumulative` geri gidemez (G7).
- `ChannelStore` adapter arayüzüyle; SQLite bağımlılığı dışarıdan görünmez.
- Receipt şeması: oturum/kanal id, birim sayısı, maliyet, iade, manifest hash, tx imzaları.

## Invariant (özellikle bu şerit için)

```
on_chain_settled ≤ accepted_cumulative ≤ deposit
payout_watermark ≤ on_chain_settled
```

Bu invariant'ı her migration ve recovery sonrası doğrula.

## Bağımlılık
BP-08 → BP-09, BP-12 için önce tamamlanmalı.
