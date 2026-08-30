# Web V2 API parity baseline

This baseline maps every NestJS controller operation to a Web V2 capability, routed workspace,
permission/guard classification and verification ticket. It is the authoritative scope guard for
the Angular greenfield replacement tracked by UIN-171.

## Rules

- `uiDisposition: required` means that Web V2 must expose the operation through the recorded route.
- `explicit-no-web-ui` is reserved for external APIs, infrastructure probes, Mobile-only endpoints
  and inbound webhooks. These operations still require contract/integration verification.
- A controller or endpoint cannot disappear from the baseline without an intentional review.
- The final UIN-210 cutover must reconcile every row with implemented UI or its explicit exception.
- Files are JSON Lines so each endpoint is reviewable and every artifact remains below 500 lines.

## Commands

```sh
npm run parity:generate
npm run parity:verify
```

Generation reads the sibling `../uinventario-api` repository. Verification runs from the committed
baseline in this repository and is part of Cloud Build.
