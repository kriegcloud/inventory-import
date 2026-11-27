// Every command of the model is sent in a story and every refusal it can give is named by one (Benjamin, 2026-11-22:
// "Yes, tests hold it, said plainly" and "Yes, one per command"). The model is the list: a command or a rejection
// added to it with no story fails here, naming it. The one thing not to break: no list of names is written in this file.
//
// What it holds, and what it does not: that a name is written in a story file, not which story or which step. A
// command counts once its `<Tag>.make(` is in a story file, directly in `Story.when(` or in a helper a story sends
// (`act`, `undo`, `group` and `confirm` build four of them). A rejection counts once a `Story.rejected(<Tag>` is
// there, held once for the model, so a rejection one command already has a story for is not asked again of a twelfth
// command that declares it: that needs the stories' steps as data. That a step ran and stated every event is the
// story's own doing (`Review.story.test.ts`, its header).
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Str from "effect/String"
import { Catalog } from "../src/Catalog.model.ts"
import groupStories from "./Group.story.test.ts?raw"
import reviewStories from "./Review.story.test.ts?raw"

/** What a command of a model shows of itself to this check: its tag and the tags of the refusals it can give. */
type Told = { readonly tag: string; readonly rejects: ReadonlyArray<{ readonly tag: string }> }

/** The commands no story sends and the rejections no story names, given a model's commands and its story files. */
const untold = (commands: ReadonlyArray<Told>, stories: ReadonlyArray<string>) => {
  const said = (text: string) => A.some(stories, Str.includes(text))
  return {
    commands: A.filter(
      A.map(commands, (command) => command.tag),
      (tag) => !said(`${tag}.make(`)
    ),
    rejections: A.filter(
      A.dedupe(A.flatMap(commands, (command) => A.map(command.rejects, (rejection) => rejection.tag))),
      (tag) => !said(`Story.rejected(${tag}`)
    )
  }
}

const stories = [reviewStories, groupStories]

describe("every command and every refusal has a story", () => {
  it("the model's eleven commands and all their rejections are in the story files", () => {
    expect(untold([...Catalog.commands], stories)).toEqual({ commands: [], rejections: [] })
  })

  it("names a rejection whose only story is taken out", () => {
    const without = A.map(stories, Str.replaceAll("Story.rejected(HistoryEnds", "Story.rejected(Elsewhere"))
    expect(untold([...Catalog.commands], without).rejections).toEqual(["HistoryEnds"])
  })

  it("names a command and a rejection added to the model with no story", () => {
    const added: ReadonlyArray<Told> = [
      ...Catalog.commands,
      { tag: "ArchiveImport", rejects: [{ tag: "NotOpen" }, { tag: "StillInUse" }] }
    ]
    expect(untold(added, stories)).toEqual({ commands: ["ArchiveImport"], rejections: ["StillInUse"] })
  })
})
