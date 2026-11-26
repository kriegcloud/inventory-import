# Next-run rotation

Moved here verbatim from the Tool Commands block of `SKILL.md` so that file stays under 500 lines. It runs
after Step 9, in the same shell, with `$SKILL`, `$ONT`, `$WORK` and `VAL` set by Step 0. Here `$ONT` is
`explorations/erp-ontology/assets/audit/<name>`, so `runs/` and the sibling `archives/` shelter stay under the
formatter-ignored `explorations/`.

```bash
# NEXT-RUN ROTATION — FAIL-CLOSED (manifest/index are singletons at work/;
# destinations are never clobbered; sources go only after both copies verify).
# The run id comes from the validator's own parser, never a sed over raw bytes
# (CRLF residue, duplicate keys and !!str tags would mangle archive names):
RID=$(VAL --print-run-id "$ONT") || RID=""
[ -n "$RID" ] && mkdir -p $ONT/runs
AM=$ONT/runs/$RID.manifest.yaml; AI=$ONT/runs/$RID.index.yaml
if [ -z "$RID" ]; then :; elif [ -e "$AM" ] || [ -e "$AI" ]; then echo "refusing: archive for $RID exists"; else
  cp "$WORK/run-manifest.yaml" "$AM" && cp "$WORK/dispositions.index.yaml" "$AI" && \
  cmp -s "$WORK/run-manifest.yaml" "$AM" && cmp -s "$WORK/dispositions.index.yaml" "$AI" && \
  rm "$WORK/run-manifest.yaml" "$WORK/dispositions.index.yaml" && \
  echo "rotated; prior_index: runs/$RID.index.yaml  prior_index_sha256_12: $(sha256sum "$AI" | cut -c1-12)"
fi
# OBSERVATIONS ARE RUN-SCOPED (their ids embed the pinned commit and adapter
# version; left in place they poison the next scan). Archive them at the
# SIBLING shelter, OUTSIDE the scan root. runs/ holds manifest/index pairs and
# engine history only; the validator refuses record-prefixed files under runs/:
ARCH=$(dirname "$ONT")/archives/$(basename "$ONT")
AO=$ARCH/$RID.observations
if [ -z "$RID" ]; then :; elif [ -e "$AO" ]; then echo "refusing: observation archive for $RID exists"; else
  mkdir -p "$AO" && mv "$WORK/observations" "$WORK/prose-observations" "$AO"/ && \
  mkdir -p "$WORK/observations" "$WORK/prose-observations" && \
  echo "observations archived to $AO/"
fi
# CARRY-FORWARD: reviews/analyses are content-addressed; a new run reuses them
# only while their closures still verify. Stale carried seat trees or
# ratifications move byte-identically to the same sibling shelter with a dated
# README note, after every gate or script joining on the old paths is updated.
```
