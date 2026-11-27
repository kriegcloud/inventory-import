/**
 * Where the model's Worker answers. Deployed, nowhere of its own: no `workers.dev` address and no domain on any
 * stage, so the site's service binding is the only way in. Under `alchemy dev`, its own port, so the site keeps
 * Alchemy's default one: the stack yields the model's Worker first, since the site's Worker binds it, and a Worker
 * on the default port would take it from the site (`@alchemy.run/cloudflare/src/Workers/Worker.ts`, `dev.port`: the
 * next free port when it is taken). The one thing not to break: `workersDev` stays `false`, and no `domain` or
 * `routes` is added (`test/ModelWorker.test.ts` reads this).
 *
 * @packageDocumentation
 */

/** The model Worker's address props, spread into its declaration (`ModelWorker.ts`). */
export const address = { workersDev: false, dev: { port: 1338 } } as const
