---
type: Capture
title: Capture
description: Benjamin's own words on why inventory-import uses @alchemy.run/domain in full, and what else he asked to have used beside it. Append-only.
---

# Capture

Benjamin's words, in the order he gave them. Nothing here is paraphrased; `[…]` marks words left out because they
named a place on his own machine or how the work was to be run.

## 2026-11-19

On the app as it stood, with no import of the library anywhere:

> not seeing a lot of @alchemy.run/domain

On the decision of 2026-11-18 that kept the app on D1 state tables behind ports
([ideal-architecture, "core"](../ideal-architecture/DECISIONS.md)):

> If I made that decision I clearly wasn't paying attention. @alchemy.run/domain was one of the primary reasons I
> wanted to embark on this build out in the first place

> Not borrow use.

On what he wants read, and why:

> […] thoroughly & I mean comprehensively exhaustively thoroughly review every page & concept in
> `https://alchemy.run/domain/` as well as reading the source code […] identify every module, concept, pattern or
> design that we aren't using from @alchemy.run/domain that we could be part of the reason I'm saying this is that
> porting beep-effect to this has been tricky this gives me a scoped down opportunity fully explore this library and
> really lock down the designs & concepts for myself. Therefore we if possible find a way to make use of ever single
> thing

On one pull request in particular:

> I'm particularly excited about this https://github.com/alchemy-run/alchemy/pull/3260

On where the material lives:

> Lets get those alchemy pros into an exploration packet I want them in the repo for agents to reference &
> potentially later for agent skills

From his own list of 2026-11-18, the items he marked as wanted, in his labels: "Cluster, workflows, singletons";
"Drizzle v1 on Durable Objects"; "GraphQL (effect/graphql)"; "ai-typesafe confidence"; "Resend email", with the note
"Resend through https://github.com/alchemy-run/distilled/tree/main/packages/resend"; "Discord sign-in, distilled
clients"; "Alchemy Git". He did not mark R2 presigned uploads.
