# Şerit C — Gateway & Demo Uzmanlık Kuralları

## Sorumluluk Alanı
- `packages/provider` — OpenAI-compatible SSE, deterministic + adapter
- `packages/meter` — Numbered-chunk meter, pricing manifest, preflight
- `packages/client` — OpenAI-compatible wrapper, Ack()
- `apps/demo` — Split-screen demo, Baseline A/B
- `bench` — 5.000 delivery benchmark

## Görev Türleri
- BP-04: Deterministic OpenAI-compatible SSE provider
- BP-05: Numbered-chunk meter + pricing manifest + hash
- BP-06: Preflight / bütçe koruması
- BP-13: Client wrapper (baseURL drop-in, Ack())
- BP-14: Demo UI (split-screen) + Baseline A (x402 exact)
- BP-15: Benchmark

## Kritik Kurallar (Şerit C Özel)
- Meter birimi: deterministic **numbered chunk**; 1 chunk = 1 birim (ADR-001).
- Pricing manifest hash oturum başında bağlanır, oturum boyunca değişmez (G8).
- Preflight: `giriş maliyeti + (max_tokens × output_fiyat) ≤ kalan tavan` (G13).
- `client` paketi `watcher`/`chain`/`store` import edemez (G5).
- Demo: yalnızca minimal split-screen UI; tam dashboard değil (ADR-006).
- Gerçek LLM için "resume" iddiası yok — kod, README, demo metni (G11).
- Benchmark rakamları ölçülmüş olmalı; hedef sayı uydurma.

## Bağımlılık
BP-04 → BP-05 → BP-06; BP-13 → BP-14 → BP-15
