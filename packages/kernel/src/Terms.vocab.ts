/**
 * The vocabulary: the thin thread's seven classes, nine properties, two schemes and four concepts, the party slice's
 * terms as its steps add them, and the gist names they rest on, as one literal kept `as const` and checked with
 * `satisfies` against the encoded side of `Vocabulary`. Every registry type below is derived from this literal and
 * from nothing else; a gate decodes the same literal strictly and works on the decoded value.
 *
 * Do not break: every label, definition, tag, parent, identity criterion, basis, domain, range, datatype and notation
 * is the text Benjamin accepted, word for word; change one only with a decision. The thread's terms are report 14
 * section 2's text as decision 111 accepted it, and they name 111: `Person` and `Organization` keep it with their
 * category parent `Party` (decision 12), `Person` with `storesId: false` (decision 161), and `grantScope` with its link
 * to `gist:isCategorizedBy` (decision 17), each listed by decision 176 without changing the term's text. The party
 * slice's terms are report 18's text as decision 176 accepted it, and they name 176. It is never built with
 * `Vocabulary.make`, whose record keys widen to `string` and would let any text pass as a term's name. `base` is the
 * one IRI literal; every other IRI of the vocabulary is derived from it.
 *
 * Where a report states something the metamodel has no field for, it is not lost: a class's named gist ancestors are
 * read from the gist list (`Person` through `gist:Person`, `Grant` through `gist:Assignment`, `Tenant` through its
 * local parent); a property's "filled by" and a scheme's "pointed at by" are the marks on the records, or the fixture
 * its `evidence` names; `Tenant`'s inherited criterion carries no text, and section 2.1's note on it is kept beside it
 * as a comment.
 *
 * @packageDocumentation
 */
import type { Vocabulary } from "@beep/vocabulary/Model"

const base = "https://example.org/inventory-import"

const ratification = { decision: 111 } as const

/** The decision that accepted report 18, the party slice's terms (decision 176). */
const partySlice = { decision: 176 } as const

/**
 * The vocabulary as written: the literal every name type of the vocabulary is derived from. Decode it with
 * `Vocabulary` and `{ onExcessProperty: "error", errors: "all" }` before reading it as data.
 */
export const vocabulary = {
  base,
  namespace: `${base}/ontology/`,
  version: "0.2.0",
  gist: {
    version: "14.1.0",
    namespace: "https://w3id.org/semanticarts/ns/ontology/gist/",
    // Decision 122. The file at tag v14.1.0 states a template placeholder here; this is the form its releases write.
    versionIri: "https://w3id.org/semanticarts/ontology/gistCore14.1.0",
    classes: {
      Organization: {},
      Person: { parent: "LivingThing" },
      LivingThing: { parent: "PhysicalIdentifiableItem" },
      PhysicalIdentifiableItem: {},
      Content: {},
      TemporalRelation: {},
      Assignment: { parent: "TemporalRelation" }
    },
    disjointPairs: [
      ["Organization", "Content"],
      ["Organization", "PhysicalIdentifiableItem"],
      ["PhysicalIdentifiableItem", "Content"]
    ],
    // Report 18 section 8, read from the pinned file: neither declares a range, and `isCategorizedBy` no domain.
    properties: {
      isCategorizedBy: { kind: "object" },
      isAbout: { kind: "object", domain: "Content" }
    }
  },
  classes: {
    Organization: {
      prefLabel: "Organization",
      definition:
        "An organized body of people or of other organizations formed for a purpose, such as a company the tenant buys from, sells to, ships with or has goods made by, or the tenant itself.",
      tag: "kind",
      parent: { kind: "gist", name: "Organization" },
      categoryParents: ["Party"],
      identity: {
        kind: "stated",
        criterion:
          "the organized body itself (decision 34), the same organization being the same legal entity; a body with no registration is told apart by its founding (decision 103). No thread record holds it."
      },
      ratification
    },
    Tenant: {
      prefLabel: "Tenant",
      definition:
        "An organization for which this application keeps a workspace, whose records are scoped to it and hidden from every other organization.",
      tag: "role",
      parent: { kind: "local", key: "Organization" },
      // Section 2.1: "Inherited from Organization. In the repository it is told apart by OrganizationId (decision 38)."
      identity: { kind: "inherited" },
      ratification
    },
    Person: {
      prefLabel: "Person",
      definition: "A human being.",
      tag: "kind",
      storesId: false,
      parent: { kind: "gist", name: "Person" },
      categoryParents: ["Party"],
      identity: {
        kind: "stated",
        criterion:
          "the human being, one for life and after death, whatever records name them (decisions 34 and 104). No thread record holds it; the fixture names one."
      },
      ratification
    },
    Member: {
      prefLabel: "Member",
      definition:
        "A relationship between one person and one tenant that lets the person act in the tenant's workspace from the day it is made until it is removed.",
      tag: "relator",
      parent: { kind: "gist", name: "TemporalRelation" },
      identity: {
        kind: "stated",
        criterion:
          "the MemberId within its tenant, kept after removal. It rests on Member.id and Member.organizationId."
      },
      ratification
    },
    Role: {
      prefLabel: "Role",
      definition: "A named level of access a grant gives a member, such as viewer, editor or admin.",
      tag: "information",
      parent: {
        kind: "none",
        reason: "Its individuals are the concepts of MemberRoleScheme; gist:Permission fits once permits exists."
      },
      identity: {
        kind: "stated",
        criterion:
          "the concept's scheme and notation (decision 41); the named level, the same role when what it permits changes (decision 109)."
      },
      ratification
    },
    Grant: {
      prefLabel: "Grant",
      definition:
        "An assignment of one role to one member at one scope (the whole tenant, one site or one field), made by a member allowed to make it.",
      tag: "relator",
      parent: { kind: "gist", name: "Assignment" },
      identity: {
        kind: "stated",
        criterion:
          "the member it is granted to and the record field it is read from. In the thread that field is role, so a member has exactly one grant."
      },
      ratification
    },
    AuditEntry: {
      prefLabel: "Audit entry",
      altLabels: ["Activity"],
      definition:
        "A record of one change to a tenant's data, written in the same batch as the change, naming who made it, the agent that acted for them if any, and what was done.",
      tag: "information",
      parent: { kind: "gist", name: "Content" },
      identity: {
        kind: "stated",
        criterion: "the tenant and the entry's id. It rests on Activity.organizationId and Activity.id."
      },
      ratification
    },
    Party: {
      prefLabel: "Party",
      definition:
        "An agent that is either a human being or an organized body, named so that the properties persons and organizations share have one range.",
      tag: "category",
      storesId: false,
      parent: {
        kind: "none",
        reason:
          "gist 14.1.0 has no party class; Party gathers Person and Organization, which keep their gist parents, and supplies no identity."
      },
      ratification: partySlice
    },
    SourceRecord: {
      prefLabel: "Source record",
      definition:
        "Content an external system or the tenant holds about one thing, named by its system, its record type and its opaque id, so that a later read of the same record is the same source record; the tenant's assertions about that thing, such as its customer and vendor flags, sit on it.",
      tag: "information",
      parent: { kind: "gist", name: "Content" },
      identity: {
        kind: "stated",
        criterion:
          "the tenant, the source system, the record's type and its opaque id, each kept as written (case, leading zeros, punctuation); equal ids in two systems or two tenants are two records (decision 34).",
        restsOn: ["inTenant", "sourceSystem", "sourceType", "sourceId"]
      },
      ratification: partySlice
    }
  },
  objectProperties: {
    membershipOf: {
      prefLabel: "membership of",
      definition: "Links a membership to the human who holds it, independently of any account.",
      domain: "Member",
      range: { kind: "class", key: "Person" },
      evidence: "fixture",
      ratification
    },
    membershipIn: {
      prefLabel: "membership in",
      definition: "Links a membership to the tenant it lets its person act in.",
      domain: "Member",
      range: { kind: "class", key: "Tenant" },
      ratification
    },
    grantedTo: {
      prefLabel: "granted to",
      definition: "Links a grant to the member who holds it.",
      domain: "Grant",
      range: { kind: "class", key: "Member" },
      ratification
    },
    grantsRole: {
      prefLabel: "grants role",
      definition: "Links a grant to the role it gives.",
      domain: "Grant",
      range: { kind: "class", key: "Role" },
      ratification
    },
    grantScope: {
      prefLabel: "grant scope",
      definition: "Links a grant to the kind of scope it applies to.",
      domain: "Grant",
      range: { kind: "scheme", key: "GrantScopeKindScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      ratification
    },
    recordedActor: {
      prefLabel: "recorded actor",
      definition: "Links an audit entry to the member it names as having made the change.",
      domain: "AuditEntry",
      range: { kind: "class", key: "Member" },
      ratification
    },
    inTenant: {
      prefLabel: "in tenant",
      definition: "The tenant whose workspace holds this record, not the owner of the body it describes.",
      range: { kind: "class", key: "Tenant" },
      ratification
    },
    recordOf: {
      prefLabel: "record of",
      definition: "Links a source record to the party it was captured about: a person, or an organization.",
      domain: "SourceRecord",
      range: { kind: "class", key: "Party" },
      subPropertyOf: { kind: "gist", name: "isAbout" },
      evidence: "fixture",
      ratification: partySlice
    }
  },
  datatypeProperties: {
    action: {
      prefLabel: "action",
      definition: "What was done in the change an audit entry records, in a few words a person reads.",
      domain: "AuditEntry",
      datatype: "xsd:string",
      ratification
    },
    recordedAt: {
      prefLabel: "recorded at",
      definition: "The instant at which an audit entry was written.",
      domain: "AuditEntry",
      datatype: "xsd:dateTime",
      ratification
    },
    sourceSystem: {
      prefLabel: "source system",
      definition: "The external system a source record was read from, as written.",
      domain: "SourceRecord",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    sourceType: {
      prefLabel: "source type",
      definition: "The record type the external system gives a source record, as written.",
      domain: "SourceRecord",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    sourceId: {
      prefLabel: "source id",
      definition: "The opaque id the external system gives a source record, kept exactly as written.",
      domain: "SourceRecord",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    capturedAt: {
      prefLabel: "captured at",
      definition:
        "The instant a source record was last read from its system: one value, which each later read of the same record replaces.",
      domain: "SourceRecord",
      datatype: "xsd:dateTime",
      evidence: "fixture",
      ratification: partySlice
    },
    isCustomer: {
      prefLabel: "is customer",
      altLabels: ["Customer", "Client", "Buyer"],
      definition:
        "Whether the tenant's record of a trading account, one whose source has a trading-role field such as a Sutton company's, states that the party buys from the tenant: true or false on every such stored record, and stated on no other record.",
      domain: "SourceRecord",
      datatype: "xsd:boolean",
      evidence: "fixture",
      ratification: partySlice
    },
    isVendor: {
      prefLabel: "is vendor",
      altLabels: ["Vendor", "Supplier"],
      definition:
        "Whether the tenant's record of a trading account, one whose source has a trading-role field such as a Sutton company's, states that the party sells to the tenant: true or false on every such stored record, and stated on no other record.",
      domain: "SourceRecord",
      datatype: "xsd:boolean",
      evidence: "fixture",
      ratification: partySlice
    }
  },
  schemes: {
    MemberRoleScheme: {
      prefLabel: "Member role",
      definition:
        "A controlled vocabulary of the access levels a member holds in an organization, ranked by what each may do.",
      closed: true,
      concepts: {
        viewer: {
          prefLabel: "Viewer",
          altLabels: ["Read only"],
          definition: "A member role whose holder may read the organization's records and write none.",
          alsoInstanceOf: "Role",
          ratification
        },
        editor: {
          prefLabel: "Editor",
          definition:
            "A member role whose holder may read and write the organization's records but not manage its people.",
          alsoInstanceOf: "Role",
          ratification
        },
        admin: {
          prefLabel: "Admin",
          altLabels: ["Administrator"],
          definition:
            "A member role whose holder may read and write the organization's records and add, change and remove its people.",
          alsoInstanceOf: "Role",
          ratification
        }
      },
      ratification
    },
    GrantScopeKindScheme: {
      prefLabel: "Grant scope kind",
      definition:
        "A controlled vocabulary of the extents a grant of access covers: a whole organization, one location, or one field.",
      closed: false,
      concepts: {
        organization: {
          prefLabel: "Whole organization",
          altLabels: ["Tenant"],
          definition: "A grant scope kind in which the grant covers every record of one organization.",
          ratification
        }
      },
      ratification
    }
  }
} as const satisfies typeof Vocabulary.Encoded

type Terms = typeof vocabulary

/** The vocabulary's one prefix, `inv:`, over the vocabulary's namespace, naming the terms `K`. */
type InvRegistry<K extends string> = {
  readonly inv: { readonly iri: Terms["namespace"]; readonly terms: ReadonlyArray<K> }
}

/**
 * The vocabulary's classes as a registry of `@beep/identity/Vocab`: `Curie<InvClassVocab>` is `"inv:Organization" | ...`,
 * so a helper typed with it refuses a property's or a scheme's name.
 */
export type InvClassVocab = InvRegistry<keyof Terms["classes"] & string>

/** The vocabulary's properties, object and datatype together, as a registry: a class's name is not one of them. */
export type InvPropertyVocab = InvRegistry<
  (keyof Terms["objectProperties"] | keyof Terms["datatypeProperties"]) & string
>

/** The vocabulary's concept schemes as a registry: the names a union of literals may point at. */
export type InvSchemeVocab = InvRegistry<keyof Terms["schemes"] & string>

type Schemes = Terms["schemes"]

/**
 * A concept's CURIE, `inv:<SchemeKey>-<notation>`, derived from the concepts' keys, so a misspelt notation does not
 * compile.
 *
 * @example "inv:GrantScopeKindScheme-organization"
 */
export type InvConceptCurie = {
  readonly [K in keyof Schemes & string]: `inv:${K}-${keyof Schemes[K]["concepts"] & string}`
}[keyof Schemes & string]
