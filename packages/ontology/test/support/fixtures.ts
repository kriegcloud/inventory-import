// What gate 8 reads besides the lift: every hand-written fixture text, each by its file's name, and the committed OWL
// file every question walks over (decision 27). The party slice's fixtures live in the packet
// (`explorations/erp-ontology/assets/requirements/cq/`, decision 36 and PLAN "Choices made"); the thread's stays in
// the package. A hand-written fixture is added here when it is committed, or guard 3 does not read it.
import bareTypeFixture from "../../../../explorations/erp-ontology/assets/requirements/cq/bare-type.fixture.ttl?raw"
import bareTypePlanted from "../../../../explorations/erp-ontology/assets/requirements/cq/bare-type.planted.rq?raw"
import ontologyText from "../../generated/inventory.owl.ttl?raw"
import { threadHandWritten } from "../../src/Thread.ts"

/** Every hand-written fixture text, by the name of its file. */
export const handWrittenFixtures: ReadonlyArray<readonly [name: string, text: string]> = [
  ["CQ-P06.fixture.ttl", threadHandWritten],
  ["bare-type.fixture.ttl", bareTypeFixture]
]

/** The fixture of the planted query: one node typed only `inv:Tenant`. */
export const bareType: string = bareTypeFixture

/** The planted query that asks for organizations with a bare type step. Never a question. */
export const bareTypeQuery: string = bareTypePlanted

/** The committed OWL file, as `bun run ontology:write` wrote it. */
export const ontology: string = ontologyText
