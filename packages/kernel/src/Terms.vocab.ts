/**
 * The vocabulary of the thin thread: its seven classes, nine properties, two schemes and four concepts, and the gist
 * names they rest on, as one literal kept `as const` and checked with `satisfies` against the encoded side of
 * `Vocabulary`. Every registry type below is derived from this literal and from nothing else; a gate decodes the same
 * literal strictly and works on the decoded value.
 *
 * Do not break: every label, definition, tag, parent, identity criterion, domain, range, datatype and notation is
 * report 14 section 2's text as Benjamin accepted it in decision 111, word for word; change one only with a decision.
 * It is never built with `Vocabulary.make`, whose record keys widen to `string` and would let any text pass as a
 * term's name. `base` is the one IRI literal; every other IRI of the vocabulary is derived from it.
 *
 * Where section 2 states something the metamodel has no field for, it is not lost: a class's named gist ancestors are
 * read from the gist list (`Person` through `gist:Person`, `Grant` through `gist:Assignment`, `Tenant` through its
 * local parent); a property's "filled by" and a scheme's "pointed at by" are the marks on the records (step 5);
 * `Tenant`'s inherited criterion carries no text, and section 2.1's note on it is kept beside it as a comment.
 *
 * @packageDocumentation
 */
import type { Vocabulary } from "@beep/vocabulary/Model"

const base = "https://example.org/inventory-import"

const ratification = { decision: 111 } as const

/**
 * The thread's vocabulary as written: the literal every name type of the thread is derived from. Decode it with
 * `Vocabulary` and `{ onExcessProperty: "error", errors: "all" }` before reading it as data.
 */
export const vocabulary = {
  base,
  namespace: `${base}/ontology/`,
  version: "0.1.0",
  gist: {
    version: "14.1.0",
    namespace: "https://w3id.org/semanticarts/ns/ontology/gist/",
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
    ]
  },
  classes: {
    Organization: {
      prefLabel: "Organization",
      definition:
        "An organized body of people or of other organizations formed for a purpose, such as a company the tenant buys from, sells to, ships with or has goods made by, or the tenant itself.",
      tag: "kind",
      parent: { kind: "gist", name: "Organization" },
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
      parent: { kind: "gist", name: "Person" },
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

/** The thread's one prefix, `inv:`, over the vocabulary's namespace, naming the terms `K`. */
type InvRegistry<K extends string> = {
  readonly inv: { readonly iri: Terms["namespace"]; readonly terms: ReadonlyArray<K> }
}

/**
 * The thread's classes as a registry of `@beep/identity/Vocab`: `Curie<InvClassVocab>` is `"inv:Organization" | ...`,
 * so a helper typed with it refuses a property's or a scheme's name.
 */
export type InvClassVocab = InvRegistry<keyof Terms["classes"] & string>

/** The thread's properties, object and datatype together, as a registry: a class's name is not one of them. */
export type InvPropertyVocab = InvRegistry<
  (keyof Terms["objectProperties"] | keyof Terms["datatypeProperties"]) & string
>

/** The thread's concept schemes as a registry: the names a union of literals may point at. */
export type InvSchemeVocab = InvRegistry<keyof Terms["schemes"] & string>

type Schemes = Terms["schemes"]

/**
 * A concept's CURIE, `inv:<SchemeKey>-<notation>`, derived from the concepts' keys, so a misspelt notation does not
 * compile.
 *
 * @example "inv:GrantScopeKindScheme-organization"
 */
export type InvConceptCurie = {
  [K in keyof Schemes & string]: `inv:${K}-${keyof Schemes[K]["concepts"] & string}`
}[keyof Schemes & string]
