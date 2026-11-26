// What gate 8 reads besides the lift: every hand-written fixture text, each by its file's name, the party slice's
// questions, and the committed OWL file every question walks over (decision 27). The party slice's fixtures and
// queries live in the packet (`explorations/erp-ontology/assets/requirements/cq/`, decision 36 and PLAN "Choices
// made"); the thread's stay in the package. A hand-written fixture is added here when it is committed, or guard 3 does
// not read it.
import bareTypeFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/bare-type.fixture.ttl?raw"
import bareTypePlanted from "../../../../explorations/erp-ontology/assets/requirements/cq/bare-type.planted.rq?raw"
import tradingFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P01.fixture.ttl?raw"
import tradingQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P01.rq?raw"
import rolelessFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P02.fixture.ttl?raw"
import rolelessQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P02.rq?raw"
import tenancyFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P09.fixture.ttl?raw"
import tenancyQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P09.rq?raw"
import identityFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P04.fixture.ttl?raw"
import identityQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P04.rq?raw"
import samenessFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P05.fixture.ttl?raw"
import samenessQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P05.rq?raw"
import stewardshipFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P07.fixture.ttl?raw"
import stewardshipQuery from "../../../../explorations/erp-ontology/assets/requirements/cq/CQ-P07.rq?raw"
import modelCallFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/model-call.ttl?raw"
import ontologyText from "../../generated/inventory.owl.ttl?raw"
import { threadHandWritten } from "../../src/Thread.ts"

/** Every hand-written fixture text, by the name of its file. */
export const handWrittenFixtures: ReadonlyArray<readonly [name: string, text: string]> = [
  ["CQ-P06.fixture.ttl", threadHandWritten],
  ["bare-type.fixture.ttl", bareTypeFixture],
  ["CQ-P01.fixture.ttl", tradingFixture],
  ["CQ-P02.fixture.ttl", rolelessFixture],
  ["CQ-P09.fixture.ttl", tenancyFixture],
  ["CQ-P04.fixture.ttl", identityFixture],
  ["CQ-P05.fixture.ttl", samenessFixture],
  ["model-call.ttl", modelCallFixture],
  ["CQ-P07.fixture.ttl", stewardshipFixture]
]

/** The fixture of the planted query: one node typed only `inv:Tenant`. */
export const bareType: string = bareTypeFixture

/** The planted query that asks for organizations with a bare type step. Never a question. */
export const bareTypeQuery: string = bareTypePlanted

/** CQ-P01, the organizations a tenant both buys from and sells to, and its fixture. */
export const trading = { query: tradingQuery, fixture: tradingFixture } as const

/** CQ-P02, the organizations a tenant's record states hold no trading role, and its fixture. */
export const roleless = { query: rolelessQuery, fixture: rolelessFixture } as const

/** CQ-P09's party half, a source record held by no tenant or by two, and its fixture. */
export const tenancy = { query: tenancyQuery, fixture: tenancyFixture } as const

/** CQ-P04, the pairs of a tenant's source records decided to be one party, and its fixture. */
export const identity = { query: identityQuery, fixture: identityFixture } as const

/**
 * CQ-P05, the ASK for a thing stated the same as another by the construct identity is never stated by, and its fixture:
 * that one statement, read only beside CQ-P04's fixture.
 */
export const sameness = { query: samenessQuery, fixture: samenessFixture } as const

/** CQ-P07, the tenants that keep no active admin, and its fixture. */
export const stewardship = { query: stewardshipQuery, fixture: stewardshipFixture } as const

/** The committed OWL file, as `bun run ontology:write` wrote it. */
export const ontology: string = ontologyText
