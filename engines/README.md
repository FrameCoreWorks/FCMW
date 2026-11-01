# engines/

One directory per engine adapter (`engines/<id>/`) plus [`catalog.json`](catalog.json), the routing
source of truth read by `skills/fcwm`.

Each catalog entry has: `id`, `name`, `purpose`, `tier` (`free` | `restricted` | `paid`), `license`,
`upstream`, `requirements`, `status` (`planned` | `experimental` | `ready`) and `checked` (date the
licence, stars and activity were last verified). Skills only use `ready` engines.

An adapter directory holds:

- `README.md`: what the engine is for, install, one example, known limits (GPU, OS).
- The engine's own code if vendored, with its upstream `LICENSE` kept next to it and a line in the
  root `NOTICE`.
- An example film and a test that renders it.

Paid generators (video, image, music, voice) are not engines: they are optional services listed in
[`../integrations/catalog.json`](../integrations/catalog.json) with `tier: "paid"`, connected by the
user in their own agent (see `skills/connecting-services`). They are never required.
