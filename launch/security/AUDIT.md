# MarioMemeMania — Pre-Launch Security Audit

**Scope.** This audit covers the on-chain side of the MARIO economy (the TON
Jetton that backs the rewards from `token/`) plus the off-chain bridges used
by the bounty platform. It is a *self-assessment*; a third-party audit by
Certik/Trail of Bits is on the checklist before main-net launch.

**Audit window.** 2026-05-13 — pre-launch freeze.

## Components in scope

| Layer            | Component                                  | Risk class |
| ---------------- | ------------------------------------------ | ---------- |
| Token            | `MARIO` TON Jetton (master + wallet code)  | high       |
| Off-chain → chain| Reward distributor (signs Jetton transfers)| high       |
| Off-chain        | `token/` RewardEngine / StakingPool        | medium     |
| API              | T03 meme service (rate limit, NSFW)        | medium     |

## Methodology

1. Static analysis with [`misti`](https://github.com/nowarp/misti) on the
   Jetton FunC sources. Findings filed below.
2. Run the `building-secure-contracts:ton-vulnerability-scanner` skill on
   the FunC source tree. The three patterns it scans for
   (integer-as-boolean, fake-Jetton, forward-TON-without-gas) all need to be
   verified by hand on every external transfer path.
3. Threat-modelling session against the off-chain reward distributor (see
   `THREAT-MODEL.md` once produced).
4. Manual review of `token/src/` for invariant correctness — especially
   daily-cap and streak-resetting logic — which the unit tests already
   cover.

## Findings (initial pass)

| ID | Severity | Component                  | Title                                                                | Status |
| -- | -------- | -------------------------- | -------------------------------------------------------------------- | ------ |
| S-01 | High   | Reward distributor         | Signing key stored unencrypted on dev VMs                            | Open. Mitigation: HSM + short-lived attestation token. |
| S-02 | High   | TON Jetton (transfer)      | Verify the bounced-message / refund path doesn't allow double-spend  | Pending — must run TON scanner.                       |
| S-03 | Medium | NSFW classifier            | Heuristic is bypassable; production must swap in a model classifier  | Open — tracked in T03 follow-up.                       |
| S-04 | Medium | Staking pool (off-chain)   | Yield is paid even if on-chain pool runs dry — needs reserve check   | Open — fix before main-net.                            |
| S-05 | Low    | Meme API                   | No global rate-limit; only daily reward caps via `RewardEngine`      | Open — add IP-rate-limit middleware (e.g. `express-rate-limit`). |
| S-06 | Low    | Frontend (T01)             | `WalletConnect` accepts arbitrary `connect()`; document trust model. | Closed (documented in T01 README).                     |

## Pre-launch must-fix list

- [ ] **S-01** — move reward distributor key to a HW-backed KMS.
- [ ] **S-02** — run TON scanner; confirm all `int` flags compared with `0`/`-1` (not as boolean) and all forward-fees include explicit gas reserves.
- [ ] **S-04** — emit `StakingPool.reservedYield` from on-chain reserve before crediting.
- [ ] **S-05** — wire `express-rate-limit` (60 req/min/IP on `/api/memes/*`).
- [ ] **External audit** — engage a third party once S-01..S-04 are closed.

## Sign-off

Audit lead: `dever-io` · `2026-05-13`.

This document must be updated and re-signed before the launch checklist
item *"Security audit complete"* can be marked done.
