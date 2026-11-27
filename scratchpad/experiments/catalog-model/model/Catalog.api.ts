// What a client of the catalog's model may send and read, one Api per kind of client. Today there is one, every
// command, for Verify's search, the nightly walks and the test that every declaration says what it is; what a browser
// and what the server may send join it here as their own Apis when the model is hosted. The one thing not to break:
// an Api names the model it serves and declares no rule of its own, so the rules stay in `Catalog.model.ts`.
import * as Domain from "@alchemy.run/domain"
import { Catalog } from "./Catalog.model.ts"

/**
 * **Details**
 *
 * It serves Verify's search and the nightly walks: no story sends through it. What a browser and what the server may
 * send are separate Apis, declared when the model is hosted.
 *
 * @category api
 * @since 0.0.0
 */
export class CatalogApi extends Domain.Api(
  "CatalogApi",
  { model: Catalog },
  { description: "Every command of the catalog's model, for its search" }
) {}
