# Eval results, FCWM 0.4.0

Cell: automated checks (render, QA, determinism, format, duration), then the mean visual score (1-10) when judged.

| Task | haiku | opus | sonnet |
| --- | --- | --- | --- |
| chart-10s | QA ok, 7 | QA ok, 7.8 | QA ok, 7 |
| lyric-beat | QA ok, 6.3 | QA ok, 8.2 | QA ok, 7.2 |
| promo-15s | QA ok, 5.8 | QA ok, 8.2 | QA ok, 7.4 |

- **haiku / chart-10s:** Frame 0 is empty (no title), bars show interim values while growing; correct at rest.
- **haiku / lyric-beat:** Small type in the upper third, the same three-bar cycle twice with identical entrances, exit ghosting.
- **haiku / promo-15s:** No hook, content in the top 45 % of the 9:16 frame, repetitive; stopped below the quality gate.
- **opus / chart-10s:** One amber accent, a "x3" payoff and a baseline marker. Frame 0 shows a half-typed title; growing bars show interim values.
- **opus / lyric-beat:** Two acts (stacked lines, then one giant word per beat), most varied entrances. Act 1 sits in the upper half; one frame leaks a cropped word at the top edge.
- **opus / promo-15s:** Strongest of the three: clear hook, product in focus, varied scenes.
- **sonnet / chart-10s:** Correct values and one accent, but the first frame is nearly empty and the chart is small in the frame.
- **sonnet / lyric-beat:** Two seconds of a pulsing dot before the first word (weak hook); type in the upper half of 9:16; 3 s static end lockup; exit ghosting.
- **sonnet / promo-15s:** Solid, but the product looks plastic and the layout repeats.
