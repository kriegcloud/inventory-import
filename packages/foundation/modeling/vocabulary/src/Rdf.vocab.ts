/**
 * The W3C terms a projection of a vocabulary may write, as one registry. It is built from the vendored `CoreVocab` of
 * `@beep/identity/Vocab` with `mergeVocab`, never by editing that file: `vendor:check` holds its hash. The merge
 * replaces a whole prefix, so the `owl` entry spreads the vendored terms before adding its own. Gist names are not
 * here: which gist classes a vocabulary admits is that vocabulary's choice, held in its own `gist` projection.
 *
 * @packageDocumentation
 */
import { CoreVocab, type Curie, mergeVocab } from "@beep/identity/Vocab"

/**
 * The registry the writer takes every predicate and type from: `CoreVocab`, plus `owl:disjointWith` and
 * `owl:versionIRI`, which `CoreVocab` lacks, and an `xsd` prefix holding only the datatypes a vocabulary states.
 * A datatype is added here by the slice that first writes it; `owl:AllDisjointClasses` is not added, because a
 * projection states disjointness as pairs.
 *
 * @example RdfVocab.xsd.terms // ["string", "dateTime"]
 */
export const RdfVocab = mergeVocab(CoreVocab, {
  owl: { iri: CoreVocab.owl.iri, terms: [...CoreVocab.owl.terms, "disjointWith", "versionIRI"] },
  xsd: { iri: "http://www.w3.org/2001/XMLSchema#", terms: ["string", "dateTime"] }
} as const)

/** Runtime type of {@link RdfVocab}. */
export type RdfVocab = typeof RdfVocab

/** A CURIE the registry knows, such as `rdf:type`, `owl:disjointWith` or `xsd:dateTime`. */
export type RdfCurie = Curie<RdfVocab>

/** The literal datatypes a datatype property may state, the local names under `xsd`. */
export type XsdTerm = RdfVocab["xsd"]["terms"][number]
