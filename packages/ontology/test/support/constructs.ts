// An in-memory copy of the kernel's vocabulary literal that holds each construct step 1 of the party slice added to
// the metamodel, written so gate 4 finds it coherent: a category, `Party`, over `Person` and `Organization` (decision
// 12); a retired class, property, scheme and concept, replaced or withdrawn (decision 33); a relation and an attribute
// under a gist property (decision 16); and an attribute stated as a boolean. Gates 3 and 4 and the projector are tried
// on it, and on copies of it with one mistake planted, while the kernel's module and the committed exception list stay
// as they are (PLAN, step 2).
//
// Nothing here is a term anyone accepted. `Party` is decision 12's category with text of this test's own, and the gist
// list is planted: no domain or range of a gist property is in the repository (PLAN, "What the design left
// unchecked"), so `isCategorizedBy` states none, and `plantedAttribute` is no gist name at all, given a domain and a
// range only so the tests can see that neither reaches the Turtle.
import type { Vocabulary } from "@beep/vocabulary/Model"
import type { ExceptionList } from "@beep/vocabulary/Rules"
import { vocabulary } from "@inventory/kernel/Terms"
import exceptionFile from "../../exceptions/no-gist-parent.json" with { type: "json" }

/** `Party`'s reason for having no gist parent, as its exception entry repeats it. */
const partyReason = "A category over Person and Organization, each of which keeps its own gist parent."

/** The release the copy's retirements are dated from: the kernel's own version, so rule C15 passes. */
const since = vocabulary.version

/** The kernel's literal with every construct of step 1, coherent under gate 4. */
export const constructsVocabulary = {
  ...vocabulary,
  gist: {
    ...vocabulary.gist,
    properties: {
      isCategorizedBy: { kind: "object" },
      plantedAttribute: { kind: "datatype", domain: "Content", range: "xsd:dateTime" }
    }
  },
  classes: {
    ...vocabulary.classes,
    Party: {
      prefLabel: "Party",
      definition: "A person or an organization, the category either falls under in this test's copy.",
      tag: "category",
      parent: { kind: "none", reason: partyReason },
      ratification: { decision: 12 }
    },
    Person: { ...vocabulary.classes.Person, categoryParents: ["Party"] },
    Organization: { ...vocabulary.classes.Organization, categoryParents: ["Party"] },
    Workspace: {
      prefLabel: "Workspace",
      definition: "An organization for which the application kept a workspace, before the tenant replaced it.",
      tag: "role",
      parent: { kind: "local", key: "Organization" },
      identity: { kind: "inherited" },
      deprecation: { kind: "replaced", replacedBy: "Tenant", since },
      ratification: { decision: 33 }
    }
  },
  objectProperties: {
    ...vocabulary.objectProperties,
    grantScope: { ...vocabulary.objectProperties.grantScope, subPropertyOf: { kind: "gist", name: "isCategorizedBy" } }
  },
  datatypeProperties: {
    ...vocabulary.datatypeProperties,
    action: {
      ...vocabulary.datatypeProperties.action,
      deprecation: { kind: "withdrawn", reason: "No screen reads the words once the change is named.", since }
    },
    recordedAt: {
      ...vocabulary.datatypeProperties.recordedAt,
      subPropertyOf: { kind: "gist", name: "plantedAttribute" }
    },
    onHold: {
      prefLabel: "on hold",
      definition: "Whether a membership is held back from acting, stated true or false.",
      domain: "Member",
      datatype: "xsd:boolean",
      evidence: "fixture",
      ratification: { decision: 35 }
    }
  },
  schemes: {
    ...vocabulary.schemes,
    GrantScopeKindScheme: {
      ...vocabulary.schemes.GrantScopeKindScheme,
      concepts: {
        ...vocabulary.schemes.GrantScopeKindScheme.concepts,
        whole: {
          prefLabel: "Whole workspace",
          definition: "A grant scope kind in which the grant covered every record of one workspace.",
          deprecation: { kind: "replaced", replacedBy: "organization", since },
          ratification: { decision: 33 }
        }
      }
    },
    AccessLevelScheme: {
      prefLabel: "Access level",
      definition: "A controlled vocabulary of the access levels a member held, before member roles replaced it.",
      closed: true,
      deprecation: { kind: "replaced", replacedBy: "MemberRoleScheme", since },
      concepts: {
        full: {
          prefLabel: "Full access",
          definition: "An access level whose holder could do everything, withdrawn with nothing in its place.",
          deprecation: { kind: "withdrawn", reason: "Member roles say what each holder may do instead.", since },
          ratification: { decision: 33 }
        }
      },
      ratification: { decision: 33 }
    }
  }
} as const satisfies typeof Vocabulary.Encoded

/** The committed exception list with `Party`'s entry beside `Role`'s, allowed by decision 12. */
export const constructsExceptions = [
  ...exceptionFile,
  { class: "Party", reason: partyReason, ratification: { decision: 12 } }
] as const satisfies typeof ExceptionList.Encoded
