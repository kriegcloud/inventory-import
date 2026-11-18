---
type: Playbook
title: Reviewing a screen before calling it done
description: Fixed shots, measured gates, a newcomer question, reviewers who see only screenshots, and a blind side-by-side to measure progress.
tags: [ui, review, qa]
status: draft
---

Under time pressure, steps 2, 3 and 7 fit; the rest is for a screen that gets more than one round of review.

1. **Fix the shots.** One shot is one state at one size, with the same sample file every round: the review just
   opened (1440 × 900), one problem kind selected, a reason open, the moment before import, and the phone
   (390 × 844).
2. **Measure the gates first**, by script from the page: the numbers in
   [one screen, few words](../standards/review-screen.md) and [the phone](../standards/phone.md). A failed gate is a
   defect whatever a reviewer says. The one-liners are in the `qa` agent.
3. **Ask the newcomer question first.** A fresh agent that sees only the screenshot says what
   the screen is for, what it would do next, and every mark it cannot explain. Each of those is a finding.
4. **Reviewers see only the screenshots**: no code, no history, no sentence about typical scores. Use two or more,
   one from a second model family. What they agree on is the finding; what one says alone is a lead.
5. **Measure progress blind and side by side.** Show two rounds of the same shot, unlabelled and in mixed order, and
   ask which is better on each dimension and why. Absolute scores from fresh reviewers are a poor measure: a
   sentence about typical scores in the prompt anchors them, and they can stay flat while the screen improves.
6. **My estimate and my approval decide.** Ask me for a number, not a pick between two. The screen is done when the
   gates pass and I approve the screenshots; until then, say what is below the bar.
7. **Report what was looked at** ([handing work to me](../standards/handing-over.md)), and record a reviewer's
   suggestion that was turned down, with the reason ([recurring defects](recurring-defects.md)).
