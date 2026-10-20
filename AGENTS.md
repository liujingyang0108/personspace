# PersonSpace agent instructions

Before changing this project, read [`docs/DEVELOPMENT_HANDOFF.md`](docs/DEVELOPMENT_HANDOFF.md). It contains the current architecture, CloudBase environment, data model, known P0 risks, test gaps, and the deployment procedure.

Project rules:

- Do not commit `.env`, credentials, tokens, or user data.
- Do not deploy static hosting with `--prune`; the hosting root also contains CloudBase-managed `__auth/*` files.
- Changes to authentication, RLS, synchronization, or publication visibility require tests.
- Run `npm run test`, `npm run lint`, and `npm run build` before handing work back.
- Preserve unrelated user changes and do not force-push `main`.
