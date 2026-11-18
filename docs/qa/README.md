---
type: Folder Guide
title: QA evidence
description: What the browser test passes leave in docs/qa/ and who writes it.
tags: [qa, evidence]
---

# QA evidence

Evidence from the browser test passes (the `qa` agent). The `qa` agent appends one dated section per pass
to `QA.md`: what it tested, what it read from the page, at what window size and on which version, what it found, and
what it did not test. Its screenshots stay in `.scratch/shots/` and the layout inspector's in `.taste-skill/`, both
git-ignored. The images kept here are the small WebPs `README.md` shows.
