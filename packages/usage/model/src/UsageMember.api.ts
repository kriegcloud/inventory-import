// What a member's browser may read of the usage model: the day's count of its own organization, and nothing to send.
// No screen reads it yet (Benjamin, 2026-11-26: "No screen yet; any member may read"); who may read which key is the
// view's `validate` (`Allowance/AllowanceToday.view.ts`). Every kind is listed, since a kind left out is served whole
// (`@alchemy.run/domain/src/Api.ts:74-93`). The one thing not to break: no command is on this Api, so a browser never
// takes a call itself.
import * as Domain from "@alchemy.run/domain"
import { Usage } from "./Usage.model.ts"

/** A member's Api over the usage model: their organization's `AllowanceToday`, and no command. */
export class UsageMemberApi extends Domain.Api(
  "UsageMemberApi",
  { model: Usage, commands: [], views: ["AllowanceToday"], streams: [], queries: [] },
  { description: "What a member may read of the usage model: their organization's count of the day's model calls" }
) {}
