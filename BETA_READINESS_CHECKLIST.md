# Rover Beta Readiness Checklist

Checklist praktis sebelum public beta. Fokus: stability, security, dan operational sanity.

## 0) Preflight

- [ ] Pastikan environment siap:
  - `RPC_URL`
  - `WALLET_PRIVATE_KEY`
  - `LLM_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_ALLOWED_USER_IDS`
- [ ] Install deps:
  - `bun install`
- [ ] Build sukses:
  - `bun run build`

Expected: build selesai tanpa error.

## 1) Safety Defaults

- [ ] Verify default dry-run:
  - `cat user-config.json`
  - pastikan `dryRun: true` (atau env `DRY_RUN=true`)
- [ ] Verify Telegram hard-fail:
  - jalankan tanpa `TELEGRAM_ALLOWED_USER_IDS`
  - `bun src/runtime/rover.ts`

Expected: proses fail cepat dengan pesan bahwa `TELEGRAM_ALLOWED_USER_IDS` wajib diset.

## 2) Telegram Control Bootstrap

- [ ] Start agent dengan config Telegram valid.
- [ ] Dari akun Telegram yang ada di allowlist:
  - kirim `/d`
  - kirim `/setchat`
- [ ] Cek `user-config.json`:
  - field `telegramChatId` terisi.

Expected:
- `/d` balikin `chat_id` dan `user_id`
- `/setchat` sukses dan chat binding tersimpan.

## 3) Atomic State Writes

- [ ] Jalankan update state path umum:
  - `/setcfg minVolume 700`
  - `/setcfg rugcheckMaxRiskScore 75`
  - `gorover-agent discord-signals clear`
- [ ] Pastikan file tetap valid JSON:
  - `bun -e "JSON.parse(require('fs').readFileSync('user-config.json','utf8')); console.log('ok user-config')"`
  - `bun -e "JSON.parse(require('fs').readFileSync('deployer-blacklist.json','utf8')); console.log('ok deployer-blacklist')"`

Expected: semua parse JSON sukses, tidak ada file korup.

## 4) Live Transaction Guard

- [ ] Set `DRY_RUN=false`.
- [ ] Trigger write action (mis. deploy/close/swap via command path yang biasa lo pakai).
- [ ] Observasi first live action minta konfirmasi `confirm`.

Expected:
- tanpa konfirmasi: tx diblok
- setelah konfirmasi valid: tx boleh lanjut.

## 5) Input Sanitization

- [ ] Uji input invalid:
  - address tidak valid
  - amount negatif / non-number
- [ ] Jalankan via jalur tool/chat command.

Expected: request ditolak cepat dengan reason jelas, tidak lanjut ke on-chain call.

## 6) Crash Recovery

- [ ] Start runtime:
  - `bun src/runtime/rover.ts`
- [ ] Simulasikan error tool/non-fatal error di cycle.
- [ ] Tunggu cycle berikutnya.

Expected: cycle gagal ter-log, tapi agent tetap hidup dan lanjut cycle berikut.

## 7) Signal Ingest (ToS-Compliant)

- [ ] Start signal ingest:
  - `bun run signal`
- [ ] Health check:
  - `curl http://127.0.0.1:8787/health`
- [ ] Test ingest:
  - `curl -X POST "http://127.0.0.1:8787/signals/ingest" -H "Authorization: Bearer <SIGNAL_INGEST_TOKEN>" -H "Content-Type: application/json" -d '{"text":"test So11111111111111111111111111111111111111112","source":"smoke"}'`
- [ ] Cek queue:
  - `gorover-agent discord-signals`

Expected:
- `/health` return `ok: true`
- ingest return `ok: true`
- queue terisi (kalau lolos pre-check).

## 8) Screening & Management Smoke

- [ ] Run one screening:
  - `gorover-agent screen`
- [ ] Run one management:
  - `gorover-agent manage`
- [ ] Cek log output dan Telegram summary.

Expected:
- tidak crash
- report keluar
- keputusan masuk akal (no malformed output).

## 9) RugCheck Filter Sanity

- [ ] Set threshold ketat:
  - `/setcfg rugcheckMaxRiskScore 60`
- [ ] Jalankan screening.
- [ ] Set threshold longgar:
  - `/setcfg rugcheckMaxRiskScore 90`
- [ ] Jalankan screening lagi.

Expected: kandidat yang lolos berubah sesuai threshold, dengan log filter RugCheck.

## 10) Final Gate Sebelum Public Beta

- [ ] `bun run test:unit`
- [ ] `bun run lint`
- [ ] Simpan snapshot config final (`user-config.json` + env template internal).
- [ ] Dry-run 24 jam tanpa crash fatal.
- [ ] Live canary kecil (size minimal) dengan monitoring manual.

Go/No-Go:
- Go kalau semua checklist critical lulus.
- No-Go kalau ada: crash loop, state corruption, auth gap, atau live-guard bypass.
