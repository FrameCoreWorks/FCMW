# Contributing

Thanks for helping. A few rules keep FCWM open and usable by everyone.

1. **No brand, no house style.** Do not add company names, logos, palettes, fonts or creative rules
   that steer every film one way. Taste goes into options the user can choose. `npm run validate`
   fails on known brand names.
2. **Search before you build.** Before adding an engine, library, template or tool, look for a
   maintained option on GitHub, npm or PyPI. In the pull request, list the options you considered
   with licence, stars and last update, and say why you chose to use, adapt or write from scratch.
3. **Label every tool.** New engines and APIs go into `engines/catalog.json` with a tier: `free`,
   `restricted` or `paid`. Paid APIs read the user's own key from an environment variable and are
   never required.
4. **Keep third-party licences.** Vendored code keeps its upstream `LICENSE` next to it and gets a
   line in `NOTICE`.
5. **Skills follow the [Agent Skills spec](https://agentskills.io/specification).** One directory per
   skill, `name` equal to the directory name, a description that says what the skill does and when
   to use it.
6. **Prove it works.** New blocks, engines and checks come with an example or a test. Do not mark an
   engine `ready` until it has rendered its example on at least one OS.
7. **English** for code, docs and skills.

## Checks

```sh
npm run validate
```

The same check runs in CI on every pull request, on Linux, macOS and Windows.
