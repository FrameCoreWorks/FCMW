<!-- Copied from knowledge/checklist.md by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->
# Detail checklist before showing anything

Run this on the contact sheets, the phone-size sheets and full-resolution stills. Half-size previews
both hide and add artifacts, so check details at full resolution.

## Picture
- [ ] Frame 0 already shows something worth stopping for.
- [ ] Every word readable on the phone-size sheet; letters crisp, nothing broken or clipped.
- [ ] Text fully inside its frame with margin and inside the platform's safe zone; nothing covered.
- [ ] Each format composed for its own shape (no crop or letterbox of another format).
- [ ] No gap longer than 4 s without a new event (fast social: nothing static over ~1 s).
- [ ] The frame on each downbeat cut shows the new image: no blank frame, no full-frame flash
      (at most one or two structural flashes per film).
- [ ] No scene repeats another's layout or trick.
- [ ] Transitions pass through a logical detail, or are honest cuts on the beat.

## Motion
- [ ] Springs or eased keys everywhere; nothing linear unless mechanical on purpose.
- [ ] Zooms in log space; camera never brakes to zero inside a continuous move.
- [ ] Exposure steady; no brightness pumping on every kick.
- [ ] Cursor moves are short minimum-jerk glides that arrive before the click.

## Objects and characters
- [ ] Objects rest on something; hands actually hold things; no interpenetration.
- [ ] No z-fighting (coplanar-face audit passed on 3-D scenes).
- [ ] Characters checked in 2-3x crops: limbs continuous, one pair of hands, blinks not in sync.

## Sound
- [ ] Every accent has a sound; the mix breathes.
- [ ] Hits within 20 ms of their frame.
- [ ] -14 LUFS integrated, -1 dBTP.

## Delivery
- [ ] Constant frame rate, expected duration, audio present (check with ffprobe).
- [ ] A frame pulled from the encoded file matches the preview (the encode itself is fine).
- [ ] Rendering the same frame twice gives the same image (determinism).
