---
type: Capture
title: ERP ontology capture
description: Benjamin's words on the ERP and WMS taxonomy and ontology, verbatim and append-only.
---

# Capture

## 2026-11-22

> So in ~/YeeBois/Career I had began some work & investigation into synthesizing, doing research & creating a
> taxonomy & ontology for sutton basing it off of existing ontology's & taxonomies we can find which are relevant to
> the ERP / WMS space & information which we've accumulated about sutton & its data model we can infer from sources
> like their public github repos, published npm packages, website & other sources.
>
> We've created the inventory-import repository based on the takehome that I did for my interviews takehome.
>
> Id like to begin designing a taxonomy & ontology as an new exploration packet in this repository. Currently work is
> being done to migrate the repository to a @alchemy.run/domain aligned architecture which I think will be useful for
> this taxonomy and ontology work.
>
> I'm not exactly sure where to start so maybe we can start by doing some back and forth & aligning on some data
> models, classes, etc that you think are relevant to an ERP / WMS like sutton.
>
> To me a few things seem to stand out that I'm thinking of:
>
> - A party data model
>   - https://www.ibm.com/docs/en/imdm/14.0.0?topic=overview-party-domain-model
>   - https://developer.salesforce.com/docs/platform/data-models/guide/party-overview.html
> - https://docs.oracle.com/cd/E74890_01/books/Secur/secur_accesscontrol022.htm
> - https://msi.dublincore.org/standards/w3c-org/
> - https://spec.edmcouncil.org/fibo/ontology/MetadataFIBO/FIBOSpecification?version=master/latest
> - https://schema.org/docs/schemas.html
>
> I've also attached some research reports that can help as a context seed

Attached: two seed reports, "Sutton API Ontology Design" and "Sutton architectural context seed" (both 2026-11-22,
kept outside the repository).

### Answers to the four opening questions

1. What the ontology is for first:

   > I think Model of record (what you recommended) but I would also look at how ~/YeeBois/projects/beep-effect
   > handles ontology & taxonomy & see if it's the right shape.

2. Which artifact is the source of truth:

   > If Effect Schema becomes the source of truth wouldn't that be easier and we could treat OWL, SKOS and SHACL as a
   > projection?

3. What a Sutton Account is:

   > Organization with role flags

4. Which upper ontology:

   > gist projection (Recommended)
