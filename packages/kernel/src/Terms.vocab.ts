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
 * to `gist:isCategorizedBy` (decision 17), each listed by decision 176 without changing the term's text. `Member`,
 * whose definition, criterion and basis report 18 changed (decisions P2, 137, 154 and 158), and `membershipIn`, whose
 * definition decision 169 reworded, name 176 instead. The
 * party slice's terms are report 18's text as decision 176 accepted it, and they name 176. It is never built with
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
      Assignment: { parent: "TemporalRelation" },
      Event: {},
      Determination: { parent: "Event" },
      Address: { parent: "Content" },
      PhysicalAddress: { parent: "Address" },
      ElectronicAddress: { parent: "Address" }
    },
    disjointPairs: [
      ["Organization", "Content"],
      ["Organization", "PhysicalIdentifiableItem"],
      ["PhysicalIdentifiableItem", "Content"],
      ["PhysicalAddress", "ElectronicAddress"]
    ],
    // Report 18 section 8, read from the pinned file: `isCategorizedBy` declares no domain and no range, `isAbout` the
    // domain `gist:Content` and no range, `atDateTime` no domain and the range `xsd:dateTime`, `name` neither, and
    // `hasAddress` no domain and the range `gist:Address`.
    properties: {
      isCategorizedBy: { kind: "object" },
      isAbout: { kind: "object", domain: "Content" },
      atDateTime: { kind: "datatype", range: "xsd:dateTime" },
      name: { kind: "datatype" },
      hasAddress: { kind: "object", range: "Address" }
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
        "A relationship between one person and one tenant, made when the person is invited or added and kept after it is removed or revoked, that lets the person act in the tenant's workspace or, where it names one, in that source's workspace, until it is removed and, where it states a stage, while that stage is active.",
      tag: "relator",
      parent: { kind: "gist", name: "TemporalRelation" },
      identity: {
        kind: "stated",
        criterion:
          "the MemberId within its tenant, kept at every stage and after removal, revoked included; a membership that names a source's workspace is told apart by that link, and its own id in that source waits until the source's records are lifted (decision 158).",
        restsOn: ["membershipIn"]
      },
      ratification: partySlice
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
    },
    IdentityDecision: {
      prefLabel: "Identity decision",
      definition:
        "A determination by a member that two source records the tenant holds describe the same party, or different parties, resting on the evidence it cites.",
      tag: "event",
      parent: { kind: "gist", name: "Determination" },
      identity: {
        kind: "stated",
        criterion: "the tenant and the decision's own id.",
        restsOn: ["inTenant"]
      },
      ratification: partySlice
    },
    IdentityEvidence: {
      prefLabel: "Identity evidence",
      definition:
        "A statement of one observed likeness or difference between two source records the tenant holds, such as a shared tax number or names one letter apart, cited by an identity decision.",
      tag: "information",
      parent: { kind: "gist", name: "Content" },
      identity: {
        kind: "stated",
        criterion:
          "the tenant and the evidence's own id; one piece of evidence may be cited by more than one decision.",
        restsOn: ["inTenant"]
      },
      ratification: partySlice
    },
    AgentRun: {
      prefLabel: "Agent run",
      definition:
        "An event in which a software agent acts for one signed-in member, never above that member's role nor above its own role cap.",
      tag: "event",
      storesId: false,
      parent: { kind: "gist", name: "Event" },
      identity: {
        kind: "stated",
        criterion: "the request it runs in; never the agent's name, which many runs share (decision 160)."
      },
      ratification: partySlice
    },
    ModelCall: {
      prefLabel: "Model call",
      definition:
        "An event in which the app asks a language model one question for a tenant, taken from that tenant's daily allowance before it is asked.",
      tag: "event",
      parent: { kind: "gist", name: "Event" },
      identity: {
        kind: "stated",
        criterion: "the tenant and the call's id, the modelCall table's key.",
        restsOn: ["inTenant"]
      },
      ratification: partySlice
    },
    SignInAccount: {
      prefLabel: "Sign-in account",
      definition:
        "A credential record that lets one person sign in to an application, this one or a source such as Sutton, before any organization is chosen.",
      tag: "information",
      parent: { kind: "gist", name: "Content" },
      identity: {
        kind: "stated",
        criterion:
          "the UserId this application gives the account, never its email, which can change (decision 104); an account another system issued, such as a Sutton User, waits until that system's records are lifted (decision 158)."
      },
      ratification: partySlice
    },
    PostalAddress: {
      prefLabel: "Postal address",
      definition:
        "A physical address, written as lines, locality, region, postal code and country, that a tenant's record of a party gives for receiving or sending goods, documents or invoices.",
      tag: "information",
      parent: { kind: "gist", name: "PhysicalAddress" },
      identity: {
        kind: "stated",
        criterion:
          "its own record id within the tenant; equal text on two records is two addresses (decision 138), and an id a source issued waits until that source's records are lifted (decisions 158 and 173).",
        restsOn: ["inTenant"]
      },
      ratification: partySlice
    },
    ContactPoint: {
      prefLabel: "Contact point",
      definition: "An electronic address, an email address or a telephone number, at which a party is reached.",
      tag: "information",
      parent: { kind: "gist", name: "ElectronicAddress" },
      identity: {
        kind: "stated",
        criterion:
          "the record that gives it and the field it is read from, so a contact's email is one point and its phone another, never its value alone (decision 159)."
      },
      ratification: partySlice
    },
    ContactAssignment: {
      prefLabel: "Contact assignment",
      definition:
        "A relationship naming one person to reach at one account for a stated purpose using a particular contact point.",
      tag: "relator",
      parent: { kind: "gist", name: "Assignment" },
      identity: {
        kind: "stated",
        criterion:
          "the tenant and the assignment's own id within its tenant, never the person or the contact point alone (decisions 39 and 43); an id a source issued waits until that source's records are lifted (decision 158).",
        restsOn: ["inTenant"]
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
      definition:
        "Links a membership to the tenant it belongs to, in whose workspace, or in a source's workspace it names, it lets its person act.",
      domain: "Member",
      range: { kind: "class", key: "Tenant" },
      ratification: partySlice
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
    },
    decidesOn: {
      prefLabel: "decides on",
      definition: "Links an identity decision to one of the two source records it compares.",
      domain: "IdentityDecision",
      range: { kind: "class", key: "SourceRecord" },
      evidence: "fixture",
      ratification: partySlice
    },
    identityOutcome: {
      prefLabel: "identity outcome",
      definition: "Links an identity decision to what it found: the two records denote one party, or two.",
      domain: "IdentityDecision",
      range: { kind: "scheme", key: "IdentityOutcomeScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    decidedBy: {
      prefLabel: "decided by",
      definition: "Links an identity decision to the member who made it.",
      domain: "IdentityDecision",
      range: { kind: "class", key: "Member" },
      evidence: "fixture",
      ratification: partySlice
    },
    citesEvidence: {
      prefLabel: "cites evidence",
      definition: "Links a decision to a piece of evidence it rests on.",
      range: { kind: "class", key: "IdentityEvidence" },
      evidence: "fixture",
      ratification: partySlice
    },
    membershipStatus: {
      prefLabel: "membership status",
      definition: "Links a membership to the stage it stands at: pending, active, suspended or revoked.",
      domain: "Member",
      range: { kind: "scheme", key: "MembershipStatusScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    memberAccount: {
      prefLabel: "member account",
      definition: "Links a membership to the sign-in account its person signs in with to act under that membership.",
      domain: "Member",
      range: { kind: "class", key: "SignInAccount" },
      ratification: partySlice
    },
    recordedAgentRun: {
      prefLabel: "recorded agent run",
      definition:
        "Links an audit entry to the agent run that made the change for the member it names, when an agent did.",
      domain: "AuditEntry",
      range: { kind: "class", key: "AgentRun" },
      ratification: partySlice
    },
    maxRole: {
      prefLabel: "max role",
      definition:
        "Links an agent run to the highest role it may act with, whatever the role of the member it acts for.",
      domain: "AgentRun",
      range: { kind: "class", key: "Role" },
      ratification: partySlice
    },
    callPurpose: {
      prefLabel: "call purpose",
      definition:
        "Links a model call to what it is for: reading a table request, checking the key, or suggesting fixes for an import.",
      domain: "ModelCall",
      range: { kind: "scheme", key: "ModelCallPurposeScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    calledFor: {
      prefLabel: "called for",
      definition: "Links a model call to the member whose action asked for it.",
      domain: "ModelCall",
      range: { kind: "class", key: "Member" },
      evidence: "fixture",
      ratification: partySlice
    },
    hasPostalAddress: {
      prefLabel: "has postal address",
      definition: "Links the tenant's record of a party to a postal address that record gives.",
      domain: "SourceRecord",
      range: { kind: "class", key: "PostalAddress" },
      subPropertyOf: { kind: "gist", name: "hasAddress" },
      evidence: "fixture",
      ratification: partySlice
    },
    addressPurpose: {
      prefLabel: "address purpose",
      definition:
        "Links a postal address to a purpose its record types it for, such as billing, shipping or ship from; one address may have several.",
      domain: "PostalAddress",
      range: { kind: "scheme", key: "ContactPurposeScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    defaultFor: {
      prefLabel: "default for",
      definition: "Links a postal address to a purpose for which it is the one used when an order names no other.",
      domain: "PostalAddress",
      range: { kind: "scheme", key: "ContactPurposeScheme" },
      evidence: "fixture",
      ratification: partySlice
    },
    hasContactPoint: {
      prefLabel: "has contact point",
      definition: "Links the tenant's record of a party to an email address or telephone number that record gives.",
      domain: "SourceRecord",
      range: { kind: "class", key: "ContactPoint" },
      subPropertyOf: { kind: "gist", name: "hasAddress" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactPointKind: {
      prefLabel: "contact point kind",
      definition:
        "Links a contact point to what kind of electronic address it is: an email address or a telephone number.",
      domain: "ContactPoint",
      range: { kind: "scheme", key: "ContactPointKindScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactPerson: {
      prefLabel: "contact person",
      definition: "Links a contact assignment to the person to reach on it.",
      domain: "ContactAssignment",
      range: { kind: "class", key: "Person" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactAccount: {
      prefLabel: "contact account",
      definition:
        "Links a contact assignment to the account at which its person serves its purpose, an organization or a person.",
      domain: "ContactAssignment",
      range: { kind: "class", key: "Party" },
      evidence: "fixture",
      ratification: partySlice
    },
    assignmentPoint: {
      prefLabel: "assignment point",
      definition: "Links a contact assignment to the contact point to use for it.",
      domain: "ContactAssignment",
      range: { kind: "class", key: "ContactPoint" },
      evidence: "fixture",
      ratification: partySlice
    },
    servesPurpose: {
      prefLabel: "serves purpose",
      definition:
        "Links a contact assignment to the business exchange for which to reach its person at its account using its point.",
      domain: "ContactAssignment",
      range: { kind: "scheme", key: "ContactPurposeScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactAt: {
      prefLabel: "contact at",
      definition:
        "Links the tenant's record of a contact to the tenant's record of the company the contact belongs to, stating no purpose.",
      domain: "SourceRecord",
      range: { kind: "class", key: "SourceRecord" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactType: {
      prefLabel: "contact type",
      definition: "Links the tenant's record of a contact to the kind the tenant files the contact under.",
      domain: "SourceRecord",
      range: { kind: "scheme", key: "ContactTypeScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    contactOwner: {
      prefLabel: "contact owner",
      definition: "Links the tenant's record of a contact to a member of the tenant who owns the contact.",
      domain: "SourceRecord",
      range: { kind: "class", key: "Member" },
      evidence: "fixture",
      ratification: partySlice
    },
    primaryContact: {
      prefLabel: "primary contact",
      definition: "Links the tenant's record of a company to the tenant's record of the contact it names first.",
      domain: "SourceRecord",
      range: { kind: "class", key: "SourceRecord" },
      evidence: "fixture",
      ratification: partySlice
    },
    accountStatus: {
      prefLabel: "account status",
      definition:
        "Links the tenant's record of a party to whether the tenant still trades with the party or has archived the record.",
      domain: "SourceRecord",
      range: { kind: "scheme", key: "AccountStatusScheme" },
      subPropertyOf: { kind: "gist", name: "isCategorizedBy" },
      evidence: "fixture",
      ratification: partySlice
    },
    membershipWorkspace: {
      prefLabel: "membership workspace",
      definition:
        "Links a membership to the source's record of the workspace it lets its person act in, stated only where that workspace is another system's, such as a Sutton organization's.",
      domain: "Member",
      range: { kind: "class", key: "SourceRecord" },
      evidence: "fixture",
      ratification: partySlice
    },
    memberContactPoint: {
      prefLabel: "member contact point",
      definition:
        "Links a membership to an email address or telephone number that its profile in the tenant gives for its person, such as a personal email or phone.",
      domain: "Member",
      range: { kind: "class", key: "ContactPoint" },
      subPropertyOf: { kind: "gist", name: "hasAddress" },
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
    },
    eventTime: {
      prefLabel: "event time",
      definition: "The instant at which an event occurred, as its record states it.",
      datatype: "xsd:dateTime",
      subPropertyOf: { kind: "gist", name: "atDateTime" },
      evidence: "fixture",
      ratification: partySlice
    },
    evidenceText: {
      prefLabel: "evidence text",
      definition: "The evidence in a sentence a person reads, naming the two values compared.",
      domain: "IdentityEvidence",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    joinedAt: {
      prefLabel: "joined at",
      definition:
        "When the person could first act in the membership, as its record states it: for this app's members the moment an admin added them, for an invitee the moment the invitation was accepted.",
      domain: "Member",
      datatype: "xsd:dateTime",
      ratification: partySlice
    },
    accountEmail: {
      prefLabel: "account email",
      definition: "The email a sign-in account signs in with, compared whatever its case.",
      domain: "SignInAccount",
      datatype: "xsd:string",
      designation: "email",
      ratification: partySlice
    },
    name: {
      prefLabel: "name",
      definition:
        "The name people read for a party, a membership, a record or a place, which is never unique and never decides identity or permission.",
      datatype: "xsd:string",
      subPropertyOf: { kind: "gist", name: "name" },
      designation: "name",
      ratification: partySlice
    },
    agentName: {
      prefLabel: "agent name",
      definition: 'The agent\'s name as people read it in the activity list, such as "Assistant".',
      domain: "AgentRun",
      datatype: "xsd:string",
      designation: "name",
      ratification: partySlice
    },
    calledAt: {
      prefLabel: "called at",
      definition: "When a model call was taken from the tenant's daily allowance.",
      domain: "ModelCall",
      datatype: "xsd:dateTime",
      evidence: "fixture",
      ratification: partySlice
    },
    addressLines: {
      prefLabel: "address lines",
      definition: "The street lines of a postal address, in order and as written, one line break between two lines.",
      domain: "PostalAddress",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    locality: {
      prefLabel: "locality",
      definition: "The town or city of a postal address, as written.",
      domain: "PostalAddress",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    region: {
      prefLabel: "region",
      definition: "The state, province or other region of a postal address, as written.",
      domain: "PostalAddress",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    postalCode: {
      prefLabel: "postal code",
      definition: "The postal code of a postal address, kept as text so leading zeros survive.",
      domain: "PostalAddress",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    countryCode: {
      prefLabel: "country code",
      definition:
        "The country of a postal address as a two-letter ISO 3166 code, stated only once a person accepts the code read from the source's own text.",
      domain: "PostalAddress",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    contactValue: {
      prefLabel: "contact value",
      definition: "The text of an email address or telephone number, as written in the source.",
      domain: "ContactPoint",
      datatype: "xsd:string",
      designation: "email",
      evidence: "fixture",
      ratification: partySlice
    },
    extension: {
      prefLabel: "extension",
      definition: "The extension to dial after a telephone number, as written in the source.",
      domain: "ContactPoint",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    givenName: {
      prefLabel: "given name",
      definition: "A person's given name as a record or a membership's profile writes it.",
      datatype: "xsd:string",
      designation: "name",
      evidence: "fixture",
      ratification: partySlice
    },
    middleName: {
      prefLabel: "middle name",
      definition: "A person's middle name as a record or a membership's profile writes it.",
      datatype: "xsd:string",
      designation: "name",
      evidence: "fixture",
      ratification: partySlice
    },
    familyName: {
      prefLabel: "family name",
      definition: "A person's family name as a record or a membership's profile writes it.",
      datatype: "xsd:string",
      designation: "name",
      evidence: "fixture",
      ratification: partySlice
    },
    jobTitle: {
      prefLabel: "job title",
      definition: "The title of a person's job at the organization a record or a membership names, as written.",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    profileImage: {
      prefLabel: "profile image",
      definition:
        "The picture the profile of a membership shows for its person, as the source gives it, such as a link to an image file.",
      domain: "Member",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: partySlice
    },
    profileText: {
      prefLabel: "profile text",
      altLabels: ["About"],
      definition:
        "The text a person writes about themselves on the profile of one membership, as written in the source.",
      domain: "Member",
      datatype: "xsd:string",
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
    },
    IdentityOutcomeScheme: {
      prefLabel: "Identity outcome",
      definition:
        "A controlled vocabulary of what an identity decision finds about two source records a tenant holds that may be one party.",
      closed: true,
      concepts: {
        sameParty: {
          prefLabel: "Same party",
          altLabels: ["Merge"],
          definition:
            "An identity outcome in which two source records a tenant holds are found to be records of one party.",
          ratification: partySlice
        },
        differentParties: {
          prefLabel: "Different parties",
          altLabels: ["Not a duplicate"],
          definition:
            "An identity outcome in which two source records a tenant holds are found to be records of two parties.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    MembershipStatusScheme: {
      prefLabel: "Membership status",
      definition:
        "A controlled vocabulary of the stages a person's membership of a tenant passes through, from invited to revoked.",
      closed: true,
      concepts: {
        pending: {
          prefLabel: "Pending",
          altLabels: ["Invited"],
          definition:
            "A membership status in which the person was invited and has not yet accepted, and cannot yet act under the membership.",
          ratification: partySlice
        },
        active: {
          prefLabel: "Active",
          definition:
            "A membership status in which the person may act in the workspace the membership lets them act in.",
          ratification: partySlice
        },
        suspended: {
          prefLabel: "Suspended",
          definition:
            "A membership status in which the person may not act in the workspace the membership lets them act in, the history kept, and from which the membership can be made active again.",
          ratification: partySlice
        },
        revoked: {
          prefLabel: "Revoked",
          definition:
            "A membership status in which the membership no longer lets, or will never let, the person act and is not made active again, its row kept so the audit trail still names it.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    ModelCallPurposeScheme: {
      prefLabel: "Model call purpose",
      definition:
        "A controlled vocabulary of what a call to a language model is made for, each call drawn from the day's allowance.",
      closed: true,
      concepts: {
        view: {
          prefLabel: "Table request",
          definition: "A model call purpose in which the table assistant reads a request in words.",
          ratification: partySlice
        },
        check: {
          prefLabel: "Key check",
          definition: "A model call purpose in which the app checks that the model key works.",
          ratification: partySlice
        },
        suggest: {
          prefLabel: "Import suggestions",
          definition: "A model call purpose in which the app asks for proposals for the rows of an import.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    ContactPurposeScheme: {
      prefLabel: "Contact purpose",
      definition:
        "A controlled vocabulary of the purposes for which a party is reached or served: on a contact assignment, the purpose of one person at one account; on a postal address, a use its record types it for.",
      closed: false,
      concepts: {
        billing: {
          prefLabel: "Billing",
          altLabels: ["Bill-to"],
          definition:
            "A contact purpose for which invoices and payment questions are sent to the contact point or the address.",
          ratification: partySlice
        },
        shipping: {
          prefLabel: "Shipping",
          altLabels: ["Ship-to"],
          definition:
            "A contact purpose for which goods sent to the party are delivered to the address, or arranged with the person reached for it.",
          ratification: partySlice
        },
        receiving: {
          prefLabel: "Receiving",
          altLabels: ["Receiving dock"],
          definition:
            "A contact purpose for goods arriving at the party's site: the address where they are taken in, or the person who takes them in.",
          ratification: partySlice
        },
        ordering: {
          prefLabel: "Ordering",
          altLabels: ["Purchase orders"],
          definition: "A contact purpose for which purchase orders and order questions are sent to the contact point.",
          ratification: partySlice
        },
        ship_from: {
          prefLabel: "Ship from",
          definition: "A contact purpose for which an address is where goods the party sends leave from.",
          ratification: partySlice
        },
        manufacturing: {
          prefLabel: "Manufacturing",
          definition:
            "A contact purpose for which an address is where the party has goods made, as its record types it.",
          ratification: partySlice
        },
        other: {
          prefLabel: "Other",
          definition: "A contact purpose for an address its record types as none of the others.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    ContactPointKindScheme: {
      prefLabel: "Contact point kind",
      definition: "A controlled vocabulary of the kinds of electronic address at which a party is reached.",
      closed: false,
      concepts: {
        email: {
          prefLabel: "Email address",
          altLabels: ["Email"],
          definition: "A contact point kind for an address that electronic mail is sent to.",
          ratification: partySlice
        },
        phone: {
          prefLabel: "Telephone number",
          altLabels: ["Phone"],
          definition: "A contact point kind for a number that a call or a text message reaches.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    ContactTypeScheme: {
      prefLabel: "Contact type",
      definition:
        "A controlled vocabulary of the kinds a tenant files its contacts under, one per contact, apart from any purpose a contact is reached for.",
      closed: false,
      concepts: {
        customer: {
          prefLabel: "Customer",
          definition: "A contact type by which the tenant files a contact as someone at a customer.",
          ratification: partySlice
        },
        marketing: {
          prefLabel: "Marketing",
          definition: "A contact type by which the tenant files a contact as someone it reaches for marketing.",
          ratification: partySlice
        },
        sales: {
          prefLabel: "Sales",
          definition: "A contact type by which the tenant files a contact as someone it deals with on sales.",
          ratification: partySlice
        },
        vendor: {
          prefLabel: "Vendor",
          definition: "A contact type by which the tenant files a contact as someone at a vendor.",
          ratification: partySlice
        }
      },
      ratification: partySlice
    },
    AccountStatusScheme: {
      prefLabel: "Account status",
      definition:
        "A controlled vocabulary of whether the tenant still trades with a party it holds a record of or has set that record aside.",
      closed: false,
      concepts: {
        active: {
          prefLabel: "Active",
          definition: "An account status in which the tenant still trades with the party.",
          ratification: partySlice
        },
        archived: {
          prefLabel: "Archived",
          definition:
            "An account status in which the tenant has set the party's record aside and keeps it only for past records.",
          ratification: partySlice
        }
      },
      ratification: partySlice
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
