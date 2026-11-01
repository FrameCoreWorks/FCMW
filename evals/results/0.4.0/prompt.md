# Prompt given to every model

Each model ran as an agent with a shell, the FCWM repository read-only, and no one to answer questions.
`<model>` and `<task-id>` change per run; the brief is the task file's body (`evals/tasks/<task-id>.md`).

> You are a user's agent making a motion graphics film with the FCWM plugin. The plugin is the
> repository at <repo> (read-only for you: do not edit anything in it). Start by reading
> <repo>/skills/fcwm/SKILL.md and follow it and the engine skill it routes you to. Commands:
> `node <repo>/scripts/fcwm.mjs ...`, run from your films folder <films>/<model> (create the film there;
> its folder name must be exactly `<task-id>`).
>
> Nobody will answer questions: the brief below is complete. Use quick mode. Make the film, run
> `fcwm render <task-id> --check`, look at the contact sheet image, apply the quality gate (fix the
> weakest spots; at most 3 review rounds), then run the full `fcwm render <task-id>` and
> `fcwm qa <task-id> --determinism`. Do not use paid services or the network beyond what FCWM itself
> fetches.
>
> Brief: <the task's brief>
>
> When done, reply in under 200 words: engine chosen, palette, your final self-scores, QA result
> lines, and anything in the FCWM skills or docs that was missing, wrong or confusing.
