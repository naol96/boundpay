# Şerit A — Payment Core Uzmanlık Kuralları

## Sorumluluk Alanı
- `packages/voucher` — 50-byte codec, verify, golden vectors
- `packages/chain` — Payment Channels generated client sarmalayıcı, tx builder
- `packages/watcher` — request_close izleme, settle_and_seal/seal/distribute
- `packages/middleware/commit` — MPP/PayKit commit entegrasyonu

## Görev Türleri
- BP-01: PayKit/MPP baseline, Baseline B kaydı
- BP-02: Voucher codec + verify + golden vectors
- BP-03: Devnet kanal yaşam döngüsü
- BP-07: MPP metered entegrasyon
- BP-10: Cooperative close
- BP-11 (a-d): Settlement / Close Watcher

## Kritik Kurallar (Şerit A Özel)
- Golden vector'lar YALNIZCA Foundation generated client veya referansından alınır.
- `settle_and_seal` instruction'ı: grace içindeyken kullan.
- `seal` + `distribute`: grace sonrası.
- Grace sonrası permissionless `settle`'a güvenme (G4).
- Watcher izole bir paket/süreçtir; Coordinator'a bağımlı çalışmaz.

## Devnet Kuralı
- Her test kendi ephemeral `solana-test-validator`'ını başlatır.
- Geçici ledger dizini ve dinamik portlar kullan.
- Devnet faucet limiti = INFRA hatası → backoff + retry.

## Kullanılmayacak Özellikler
`settleBatch`, `rearm`, `settle_metered`, `initialize` (doğrusu `open`)
