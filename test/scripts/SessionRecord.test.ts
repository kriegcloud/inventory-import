import { Array as Arr, String as Str } from "effect"
import { describe, expect, it } from "vitest"
import { clockStartOf, hideMarkers, isBriefFile, recordPlace, redact, summarize } from "../../scripts/session-log.mjs"
import {
  buildRecord,
  commandKind,
  eventKind,
  findMarkers,
  markerAdvice,
  parseLog,
  parseMarkers,
  renderedKinds
} from "../../scripts/session-report.mjs"
import fixture from "./session-fixture.jsonl?raw"

// The session record (scripts/session-log.mjs, scripts/session-report.mjs): what the hook keeps and redacts, what
// the report says for a fixed log, and that the private-marker check names places, never the marker.

const where = { root: "/home/tester/work/takehome", home: "/home/tester", user: "tester", hosts: ["testbox"] }
// Key-shaped strings are put together at run time: written out whole they would fail the pack's own key scan.
const fake = (prefix: string) => `${prefix}0123456789abcdefghij`
const log = Str.replaceAll("{{KEY}}", fake("sk-or-v1-"))(fixture)
const commits = [
  { hash: "1111111aaaa", ct: 1794571200, subject: "chore: project template" },
  { hash: "2222222bbbb", ct: 1794578400, subject: "chore: add the brief", start: true },
  { hash: "3333333cccc", ct: 1794578890, subject: "feat: items" }
]
const report = () => {
  const { events, skipped } = parseLog(log, where)
  return buildRecord({ events, commits, skipped })
}
const lines = (text: string) => Arr.filter(Str.split(text, "\n"), (line) => line !== "")

describe("redact", () => {
  it("makes project paths relative and writes no path outside the project", () => {
    expect(redact("cat /home/tester/work/takehome/src/a.ts /home/tester/notes.md /home/testerx", where)).toBe(
      "cat src/a.ts [outside the project] [outside the project]"
    )
    expect(redact("ls /tmp/claude-1000/-home-tester-work-takehome/tasks /home/tester/work/takehome-old", where)).toBe(
      "ls [outside the project] [outside the project]"
    )
    expect(redact("Run it in /home/tester/work/takehome. Then stop.", where)).toBe("Run it in .. Then stop.")
    expect(redact("Use the references in ~/refs/other-app and /opt/tools/cli.", where)).toBe(
      "Use the references in [outside the project] and [outside the project]."
    )
  })

  it("keeps routes, slash commands and the null device, which are not places on this disk", () => {
    expect(redact("curl localhost:5173/api/items; run /qa then /ship >/dev/null", where)).toBe(
      "curl localhost:5173/api/items; run /qa then /ship >/dev/null"
    )
  })

  it("writes no network name of this machine", () => {
    // A made-up Tailscale name, put together here: the pack's private-string check bans its suffix in tracked files.
    const tailnet = Arr.join(["testbox", "tail1234", "ts", "net"], ".")
    expect(redact(`Open http://${tailnet}:8791/e, or testbox.local, or http://100.101.2.3:8791/`, where)).toBe(
      "Open http://[host]:8791/e, or [host].local, or http://[address]:8791/"
    )
  })

  it("replaces key shapes, named secrets and email addresses", () => {
    const text = Arr.join(
      [
        `OPENROUTER_API_KEY=${fake("sk-or-v1-")}`,
        fake("sk-ant-api03-"),
        "sk-proj-0123456789abcdefghijklmn",
        "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
        "AKIAABCDEFGHIJKLMNOP",
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
        `-----BEGIN RSA ${"PRIVATE"} KEY-----\nMIIabc\n-----END RSA ${"PRIVATE"} KEY-----`,
        "op://Vault/Item/field",
        "mail ben.o@example.com, user tester"
      ],
      "\n"
    )
    expect(redact(text, where)).toBe(
      Arr.join(
        [
          "OPENROUTER_API_KEY=[redacted]",
          "[redacted]",
          "[redacted]",
          "[redacted]",
          "[redacted]",
          "Authorization: [redacted]",
          "[redacted]",
          "[redacted]",
          "mail [email], user [user]"
        ],
        "\n"
      )
    )
  })
})

describe("summarize (the hook)", () => {
  const context = { now: 0, minute: null, where }

  it("keeps the command, its exit code and duration, never the output", () => {
    const line = summarize(
      {
        hook_event_name: "PostToolUseFailure",
        session_id: "5e551on1-0000",
        prompt_id: "bbbb0002-0000",
        tool_name: "Bash",
        tool_input: { command: "cd /home/tester/work/takehome && npm run check" },
        error: "Exit code 1\nsrc/a.ts(3,1): error TS2322 with output that must not be kept",
        duration_ms: 3200
      },
      context
    )
    expect(line).toEqual({
      t: "1970-01-01T00:00:00.000Z",
      min: null,
      sid: "5e551on1",
      p: "bbbb0002",
      by: "main",
      ev: "shell",
      cmd: "cd . && npm run check",
      ok: false,
      exit: 1,
      ms: 3200
    })
  })

  it("attributes a tool call made inside a subagent to that subagent, and counts reads without content", () => {
    const line = summarize(
      {
        hook_event_name: "PostToolUse",
        session_id: "5e551on1-0000",
        agent_id: "a4c6e51756f9ae406",
        agent_type: "verifier",
        tool_name: "Read",
        tool_input: { file_path: "/home/tester/work/takehome/.dev.vars.example" },
        tool_response: { file: { content: "file contents that must not be kept" } }
      },
      context
    )
    expect(line).toEqual({
      t: "1970-01-01T00:00:00.000Z",
      min: null,
      sid: "5e551on1",
      by: "sub",
      agent: "verifier",
      aid: "a4c6e517",
      ev: "look",
      tool: "Read"
    })
  })

  it("never takes a subagent's relayed report for a prompt the person typed", () => {
    const line = summarize(
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "5e551on1-0000",
        prompt: '<agent-message from="ae2fe759e7007ada5"> [Subagent hand-back] The text below is the final report.'
      },
      context
    )
    expect(line).toMatchObject({ by: "harness", ev: "notification", task: "ae2fe759" })
    expect(line?.["text"]).toBeUndefined()
  })

  it("never takes a message from another session, a lead or its builder, for a prompt the person typed", () => {
    const line = summarize(
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "b0i1der0-0000",
        prompt: '<cross-session-message from="local_3fa9c1d2">Minute 12. Priority: now. His words: "Balanced"'
      },
      context
    )
    expect(line).toMatchObject({ by: "harness", ev: "notification", task: "local_3f" })
    expect(line?.["text"]).toBeUndefined()
  })

  it("tells a harness notification apart from a prompt the person typed", () => {
    const line = summarize(
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "5e551on1-0000",
        prompt:
          "<task-notification>\n<task-id>9f8e7d6c1de3977c7</task-id>\n<status>completed</status>\n<summary>Agent finished</summary>"
      },
      context
    )
    expect(line?.by).toBe("harness")
    expect(line?.ev).toBe("notification")
    expect(line?.["task"]).toBe("9f8e7d6c")
  })

  it("keeps a dialog answer as its headers, the labels chosen and his own words, never the questions", () => {
    const questions = [
      {
        question: "Which plan should I build? The brief has 178 rows.",
        header: "Plan",
        multiSelect: false,
        options: [
          { label: "Balanced (Recommended)", description: "secret detail of the plan" },
          { label: "Safe", description: "another description" }
        ]
      },
      {
        question: "Which findings go in now?",
        header: "Findings",
        multiSelect: true,
        options: [
          { label: "Totals row", description: "d" },
          { label: "Phone cards", description: "d" }
        ]
      },
      { question: "What does 1,250 mean?", header: "Comma qty", multiSelect: false, options: [] },
      { question: "Never answered?", header: "Later", multiSelect: false, options: [] }
    ]
    const line = summarize(
      {
        hook_event_name: "PostToolUse",
        session_id: "5e551on1-0000",
        prompt_id: "bbbb0004-0000",
        tool_name: "AskUserQuestion",
        tool_input: { questions },
        tool_response: {
          questions,
          answers: {
            "Which plan should I build? The brief has 178 rows.": "Balanced (Recommended)",
            "Which findings go in now?": "Totals row, Phone cards",
            "What does 1,250 mean?": "One thousand two hundred and fifty; ask tester@example.com if unsure"
          }
        }
      },
      context
    )
    expect(line).toEqual({
      t: "1970-01-01T00:00:00.000Z",
      min: null,
      sid: "5e551on1",
      p: "bbbb0004",
      by: "person",
      ev: "answer",
      qs: [
        { h: "Plan", pick: ["Balanced (Recommended)"] },
        { h: "Findings", pick: ["Totals row", "Phone cards"] },
        { h: "Comma qty", words: "One thousand two hundred and fifty; ask [email] if unsure" }
      ]
    })
  })

  it("keeps only the tool name of a dialog that was dismissed or holds no answer", () => {
    const dismissed = summarize(
      { hook_event_name: "PostToolUseFailure", tool_name: "AskUserQuestion", tool_input: { questions: [] } },
      context
    )
    expect(dismissed).toMatchObject({ by: "main", ev: "tool", tool: "AskUserQuestion", ok: false })
    const empty = summarize(
      { hook_event_name: "PostToolUse", tool_name: "AskUserQuestion", tool_input: {}, tool_response: {} },
      context
    )
    expect(empty).toMatchObject({ ev: "tool", tool: "AskUserQuestion", ok: true })
  })

  it("caps a long command line", () => {
    const line = summarize(
      { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: Str.repeat(250)("x") } },
      context
    )
    expect(line?.["cmd"]).toBe(`${Str.repeat(200)("x")}… [+50 chars]`)
  })
})

describe("commandKind", () => {
  it("names the repo's checks, builds and packs", () => {
    expect(commandKind("npm run check")).toBe("check")
    expect(commandKind("npm test")).toBe("check")
    expect(commandKind("npx vitest run test/domain")).toBe("check")
    expect(commandKind("npm run build")).toBe("build")
    expect(commandKind("npm run pack -- --early")).toBe("pack")
    expect(commandKind("npm run pack -- --quick")).toBe("quick-pack")
    expect(commandKind("git add -A && git commit -m x")).toBe("commit")
    expect(commandKind("npm run dev")).toBe("shell")
    expect(commandKind("echo npm run check")).toBe("shell")
    expect(commandKind('cat > /tmp/p.test.ts <<EOF\nimport { it } from "vitest"\nEOF')).toBe("shell")
  })
})

describe("the report on a fixed log", () => {
  it("quotes each prompt exactly, after redaction, and leaves out a session that ended before minute 0", () => {
    const { timeline, events } = report()
    expect(timeline).toContain("## m0 · Benjamin, prompt 1 [e2]")
    expect(timeline).toContain(
      "> Read the brief in brief and my notes in [outside the project].\n> The key is [redacted]"
    )
    expect(timeline).toContain("Left out: 3 events from 1 session that ended before minute 0.")
    expect(timeline).toContain("Skipped: 1 unreadable line in the raw log.")
    expect(timeline).not.toContain("an early prompt")
    expect(events).not.toContain("/home/tester")
    expect(lines(events)).toHaveLength(32)
  })

  it("nests a subagent's own commands under the delegation that started it", () => {
    const { timeline } = report()
    expect(timeline).toContain(
      "- m5 · main agent · delegated to **verifier (a4c6e517)** (foreground): “Check the API”; brief: “Run npm run typecheck in . and attack /api/items” → completed in 59.0 s, 2 tool calls on claude-opus-5-5 [e8, e13]"
    )
    expect(timeline).toContain("  - m5 · verifier (a4c6e517) · check `npm run typecheck` · FAIL (exit 2), 0.9 s [e10]")
    expect(timeline).toContain("  - m11 · qa (9f8e7d6c) · other tools: mcp__claude-in-chrome__computer 1 [e29]")
    expect(timeline).toContain("## m12 · harness: background task qa (9f8e7d6c) completed")
  })

  it("shows checks with their result, commits from git and the ship", () => {
    const { timeline } = report()
    expect(timeline).toContain("- m7 · main agent · check `npm run check` · FAIL (exit 1), 3.2 s [e16]")
    expect(timeline).toContain("- m8 · main agent · check `npm run check` · PASS, 3.1 s [e17]")
    expect(timeline).toContain("- m8 · commit `3333333` “feat: items” (git log)")
    expect(timeline).toContain("- m9 · Benjamin · **ship**: skill `ship` (typed as /ship) [e22]")
    expect(timeline).toContain("- m9 · main agent · pack `npm run pack -- --early` · PASS, 18.0 s [e24]")
  })

  it("counts what the summary claims, each with its evidence", () => {
    const { summary } = report()
    expect(summary).toContain("| Prompts from Benjamin | 3 | e2, e7, e21 |")
    expect(summary).toContain("| Subagents, by type | qa 1, verifier 1 | e9, e26 |")
    expect(summary).toContain("| Skills, by name | intake 1, ship 1 | e3, e22 |")
    expect(summary).toContain("| Checks | 3 run, 2 failed | failed: e10, e16 |")
    expect(summary).toContain("| First passing pack | m9 | e24 |")
    expect(summary).toContain("| Longest stretch without a check, build or pack | 5.5 min, m0 to m5 | e10 |")
    expect(summary).toContain("| Commits after minute 0 | 1 | `git log` |")
  })

  it("does not call a check whose output was piped a pass", () => {
    const { events } = parseLog(
      Arr.join(
        [
          '{"t":"2026-11-13T14:01:00.000Z","sid":"s1","p":"p1","by":"person","ev":"prompt","text":"go"}',
          '{"t":"2026-11-13T14:01:10.000Z","sid":"s1","p":"p1","by":"main","ev":"shell","cmd":"npm run check 2>&1 | tail -5","ok":true,"exit":0,"ms":1000}'
        ],
        "\n"
      ),
      where
    )
    const { timeline, summary } = buildRecord({ events, commits })
    expect(timeline).toContain(
      "· result not known: the output was piped, so exit 0 is the pipe's last command, 1.0 s [e2]"
    )
    expect(summary).toContain("| Checks | 1 run, 0 failed, 1 with the result hidden by a pipe | e2 |")
  })

  it("counts each commit made with --no-verify, wherever it sits in the command", () => {
    const { events } = parseLog(
      Arr.join(
        [
          '{"t":"2026-11-13T14:01:00.000Z","sid":"s1","p":"p1","by":"person","ev":"prompt","text":"go"}',
          '{"t":"2026-11-13T14:01:10.000Z","sid":"s1","p":"p1","by":"main","ev":"shell","cmd":"bun run typecheck; git add a.ts && git commit -qm \\"feat: a\\n\\nbody\\" --no-verify","ok":true,"exit":0,"ms":1000}',
          '{"t":"2026-11-13T14:01:20.000Z","sid":"s1","p":"p1","by":"main","ev":"shell","cmd":"git commit -qm \\"fix: b\\"","ok":true,"exit":0,"ms":100}',
          '{"t":"2026-11-13T14:01:30.000Z","sid":"s1","p":"p1","by":"main","ev":"shell","cmd":"echo --no-verify","ok":true,"exit":0,"ms":10}'
        ],
        "\n"
      ),
      where
    )
    const { summary } = buildRecord({ events, commits })
    expect(summary).toContain("| Commits with `--no-verify` (each one is named in the write-up) | 1 | e2 |")
  })

  it("gives the same files for the same input", () => {
    expect(report()).toEqual(report())
  })

  it("starts the session after the root commit, whatever that commit's message says", () => {
    const { events, skipped } = parseLog(log, where)
    const renamed = Arr.map(commits, (c, i) => (i === 0 ? { ...c, subject: "anything at all" } : c))
    const record = buildRecord({ events, commits: renamed, skipped })
    expect(record).toEqual(report())
    expect(record.timeline).not.toContain("anything at all")
  })

  it("opens both files with the frontmatter npm run docs:check requires", () => {
    const { timeline, summary } = report()
    for (const text of [timeline, summary]) {
      expect(Str.startsWith("---\ntype: Session Record\ntitle: Session ")(text)).toBe(true)
      expect(text).toContain("generated: { by: process:session-report, at: 20")
    }
  })
})

describe("dialog answers in the report", () => {
  it("shows each answer under its turn, as his, and counts them", () => {
    const { events } = parseLog(
      Arr.join(
        [
          '{"t":"2026-11-13T14:10:00.000Z","sid":"main0001","p":"p1","by":"person","ev":"prompt","text":"Start the intake."}',
          '{"t":"2026-11-13T14:12:00.000Z","sid":"main0001","p":"p1","by":"person","ev":"answer","qs":[{"h":"Plan","pick":["Balanced (Recommended)"]},{"h":"Comma qty","words":"Ask per row, mail tester@example.com"}]}'
        ],
        "\n"
      ),
      where
    )
    const { timeline, summary } = buildRecord({ events, commits })
    expect(timeline).toContain(
      "· Benjamin · answered a question dialog: “Plan”: Balanced (Recommended); “Comma qty”: in his own words “Ask per row, mail [email]” [e2]"
    )
    expect(summary).toContain("| Question dialogs Benjamin answered | 1 | e2 |")
  })
})

describe("the prompt count", () => {
  // One prompt event a minute, from 14:10. The texts hold no quotes, so they go into the JSON line as they are.
  const prompt = (minute: number, sid: string, text: string) =>
    `{"t":"2026-11-13T14:${10 + minute}:00.000Z","sid":"${sid}","by":"person","ev":"prompt","text":"${text}"}`

  it("counts only what the person typed in the main session", () => {
    const { events } = parseLog(
      Arr.join(
        [
          prompt(0, "main0001", "Build the import."),
          // A subagent's report, relayed by the harness as a prompt, as an older hook recorded it.
          prompt(1, "main0001", String.raw`<agent-message from=\"a2fe759e7007ada5\"> [Subagent hand-back] Done.`),
          prompt(2, "main0001", "Yes, managers approve in bulk."),
          prompt(3, "probe001", "What tools do you have?"),
          prompt(
            4,
            "main0001",
            String.raw`<task-notification>\n<task-id>9f8e7d6c</task-id>\n<status>completed</status>`
          ),
          prompt(5, "main0001", "Building is over.")
        ],
        "\n"
      ),
      where
    )
    const { timeline, summary, counts } = buildRecord({ events, commits })
    expect(counts.prompts).toBe(3)
    expect(summary).toContain("| Prompts from Benjamin (main session main0001) | 3 | e1, e3, e6 |")
    expect(summary).toContain("| Prompts in other sessions (not counted as his) | 1 | e4 |")
    expect(summary).toContain(
      "| Turns opened by the harness (background work or a subagent reporting back; not his) | 2 | e2, e5 |"
    )
    expect(timeline).toContain("Benjamin, prompt 3, session main0001 [e6]")
    expect(timeline).toContain("a prompt in session probe001, not the main session (not counted) [e4]")
    expect(timeline).not.toContain("Subagent hand-back")
  })
})

describe("when the hour starts", () => {
  const added = (hash: string, ...paths: ReadonlyArray<string>) => ({ hash, added: paths })
  // Ten minutes before the brief: files brought in during setup, before the brief arrived.
  const setup = { hash: "1515151eeee", ct: 1794577800, subject: "chore: bring files across" }

  it("is not started by the template or by a commit made before the brief", () => {
    expect(clockStartOf([added("t", "brief/README.md", "src/a.ts"), added("s", "src/web/x.tsx", "docs/y.md")])).toBe(
      undefined
    )
    expect(isBriefFile("brief/README.md")).toBe(false)
    expect(isBriefFile("briefs/orders.csv")).toBe(false)
    expect(isBriefFile("docs/brief/orders.csv")).toBe(false)
  })

  it("starts at the first commit that adds a file under brief/ other than its README", () => {
    const start = clockStartOf([
      added("t", "brief/README.md"),
      added("s", "src/web/x.tsx"),
      added("b", "brief/BRIEF.md", "brief/orders.csv"),
      added("l", "brief/notes.md")
    ])
    expect(start?.hash).toBe("b")
  })

  it("counts minutes from the brief commit, and stamps a commit made before it pre", () => {
    const { events } = parseLog(log, where)
    const withSetup = [...Arr.take(commits, 1), setup, ...Arr.drop(commits, 1)]
    const { timeline, summary } = buildRecord({ events, commits: withSetup })
    expect(timeline).toContain("the commit `2222222` “chore: add the brief”, the first to add the brief.")
    expect(timeline).toContain("- pre · commit `1515151` “chore: bring files across” (git log)")
    expect(timeline).toContain("- m8 · commit `3333333` “feat: items” (git log)")
    expect(summary).toContain("| Commits after minute 0 | 1 | `git log` |")
  })

  it("has not started while no commit has added the brief, however many there are", () => {
    const { events } = parseLog(log, where)
    const { timeline, summary } = buildRecord({ events, commits: [...Arr.take(commits, 1), setup] })
    expect(timeline).toContain("The timer has not started: no commit has added the brief")
    expect(timeline).toContain("## m– · Benjamin, prompt 1")
    expect(summary).toContain("| Commits after minute 0 | 0 | `git log` |")
  })
})

describe("the report when there is nothing to show", () => {
  it("says plainly that the log is empty and the timer has not started", () => {
    const { timeline, summary, events } = buildRecord({ events: [], commits: Arr.take(commits, 1) })
    expect(timeline).toContain("The timer has not started")
    expect(timeline).toContain("No events were recorded.")
    expect(summary).toContain("| Prompts from Benjamin | 0 |")
    expect(events).toBe("")
  })

  it("shows no minutes until the brief is committed", () => {
    const { events } = parseLog(log, where)
    const { timeline } = buildRecord({ events, commits: Arr.take(commits, 1) })
    expect(timeline).toContain("## m– · Benjamin, prompt 1")
    expect(timeline).not.toContain("Left out")
  })
})

describe("the private-marker check", () => {
  it("reads one marker per line, ignoring comments, blanks and case", () => {
    expect(parseMarkers("# private\n\nAcme Rocket\n  OTHER thing  \n")).toEqual(["acme rocket", "other thing"])
  })

  it("names the file and line of each hit, never the marker", () => {
    const hits = findMarkers({
      markers: parseMarkers("Acme Rocket\nother thing"),
      sources: [
        { where: "docs/session/TIMELINE.md", text: "one\nthe ACME rocket launch\nthree" },
        { where: "history 3333333 src/a.ts", text: "x\nanother THING", lines: [10, 14] },
        { where: "commit 3333333 message", text: "feat: items" }
      ]
    })
    expect(hits).toEqual([
      { where: "docs/session/TIMELINE.md", line: 2, kind: "a line of a tracked file" },
      { where: "history 3333333 src/a.ts", line: 14, kind: "a line of a tracked file" }
    ])
  })

  it("names the kind of event a hit in the session record came from, never the marker", () => {
    const events = Arr.join(
      [
        '{"ev":"shell","by":"main","cmd":"ls"}',
        '{"ev":"prompt","by":"person","text":"Acme Rocket is the client"}',
        '{"ev":"delegate","by":"sub","agent":"backend","brief":"x"}'
      ],
      "\n"
    )
    const timeline = "## m3 · Benjamin, prompt 1 [e2]\n\n> Acme Rocket is the client\n- m4 · main · ran ls [e1]"
    const hits = findMarkers({
      markers: parseMarkers("Acme Rocket"),
      sources: [
        { where: "docs/session/events.jsonl", text: events, kinds: Arr.map(Str.split(events, "\n"), eventKind) },
        { where: "docs/session/TIMELINE.md", text: timeline, kinds: renderedKinds(timeline, events) },
        { where: "commit 3333333 message", text: "fix: acme rocket", kind: "a commit message" }
      ]
    })
    expect(hits).toEqual([
      { where: "docs/session/events.jsonl", line: 2, kind: "a prompt Benjamin typed" },
      { where: "docs/session/TIMELINE.md", line: 3, kind: "a prompt Benjamin typed" },
      { where: "commit 3333333 message", line: 1, kind: "a commit message" }
    ])
    expect(Arr.filter(hits, (hit) => /acme/i.test(`${hit.where} ${hit.kind}`))).toEqual([])
    expect(eventKind(Arr.getUnsafe(Str.split(events, "\n"), 2))).toBe("a brief to a subagent, by the backend subagent")
  })

  it("finds a marker that reaches the timeline through a prompt", () => {
    const hits = findMarkers({
      markers: parseMarkers("balanced PLAN"),
      sources: [{ where: "docs/session/TIMELINE.md", text: report().timeline }]
    })
    expect(Arr.map(hits, (hit) => hit.where)).toEqual(["docs/session/TIMELINE.md"])
  })

  it("sends a hit in the brief to Benjamin, a hit in the record to a fresh render, and never to a hand edit", () => {
    const brief = [{ where: "history 11c2da6 brief/BRIEF.md", line: 53 }]
    const record = [{ where: "docs/session/TIMELINE.md", line: 2 }]
    const other = [{ where: "src/a.ts", line: 4 }]
    expect(markerAdvice(brief)).toEqual([
      "A hit under brief/ is in the brief as received: never edit brief/ or rewrite the commit that started the clock to remove it. Stop and ask Benjamin."
    ])
    expect(markerAdvice(record)).toEqual([
      "A hit in docs/session/: run bun run session again with TAKEHOME_PRIVATE_MARKERS set; it writes each marker as [private]. Never edit .session/ or docs/session/ by hand."
    ])
    expect(markerAdvice(other)).toHaveLength(1)
    expect(markerAdvice([...brief, ...record, ...other])).toHaveLength(3)
  })

  it("is written as [private] by the hook and by the report, so the record never needs a hand edit", () => {
    const markers = parseMarkers("Acme Rocket")
    expect(hideMarkers("Call ACME rocket, then acme Rocket.", markers)).toBe("Call [private], then [private].")
    const line = summarize(
      { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "The client is Acme Rocket." },
      { now: 0, minute: 3, where: { ...where, markers } }
    )
    expect(line?.["text"]).toBe("The client is [private].")
    const raw = '{"t":"2026-11-18T08:30:00.000Z","min":1,"by":"person","ev":"prompt","text":"acme rocket"}\n'
    const { events } = parseLog(raw, { ...where, markers })
    expect(Arr.map(events, (event) => event["text"])).toEqual(["[private]"])
  })

  it("does nothing without markers", () => {
    expect(findMarkers({ markers: [], sources: [{ where: "a", text: "anything" }] })).toEqual([])
  })
})

describe("sessions in another checkout", () => {
  const project = "/home/tester/work/takehome"

  it("write into their own checkout's record, never this one's; a frozen copy and a subfolder stay here", () => {
    expect(recordPlace({ project, toplevel: project })).toEqual({ root: project, dir: "." })
    expect(recordPlace({ project, toplevel: `${project}/.frozen/v0.3.0` })).toEqual({ root: project, dir: "." })
    expect(recordPlace({ project, toplevel: `${project}/.claude/worktrees/docs-review` })).toEqual({
      root: `${project}/.claude/worktrees/docs-review`,
      dir: ".claude/worktrees/docs-review"
    })
    expect(recordPlace({ project, toplevel: "/home/tester/work/takehome-other" })).toEqual({
      root: "/home/tester/work/takehome-other",
      dir: "[outside the project]"
    })
    expect(recordPlace({ project, toplevel: undefined })).toBeUndefined()
  })

  it("carry the checkout on every event, and are left out of every count of this one, named", () => {
    const prompt = summarize(
      { hook_event_name: "UserPromptSubmit", session_id: "side0000-1", prompt: "review the docs" },
      { now: 0, minute: 3, where, dir: ".claude/worktrees/docs-review" }
    )
    expect(prompt).toMatchObject({ dir: ".claude/worktrees/docs-review", sid: "side0000" })
    // Minute 0 is the fixture's brief commit (ct 1794578400): these events are at minute 1.
    const raw = Arr.join(
      [
        '{"t":"2026-11-13T14:01:00.000Z","min":1,"sid":"main0000","dir":".","by":"person","ev":"prompt","text":"go"}',
        '{"t":"2026-11-13T14:01:10.000Z","min":1,"sid":"main0000","dir":".","by":"main","ev":"shell","cmd":"bun run check","ok":true}',
        '{"t":"2026-11-13T14:01:20.000Z","min":1,"sid":"side0000","dir":".claude/worktrees/docs-review","by":"person","ev":"prompt","text":"review"}',
        '{"t":"2026-11-13T14:01:30.000Z","min":1,"sid":"side0000","dir":".claude/worktrees/docs-review","by":"main","ev":"shell","cmd":"bun run check","ok":true}'
      ],
      "\n"
    )
    const { events } = parseLog(raw, where)
    const record = buildRecord({ events, commits })
    expect(record.counts).toMatchObject({ events: 2, prompts: 1, checks: 1 })
    expect(record.summary).toContain("Recorded: 2 events from 1 session (main0000)")
    expect(record.summary).toContain(
      "Left out: 2 events from 1 session that worked in another checkout (.claude/worktrees/docs-review); none is counted here."
    )
    expect(record.events).not.toContain("side0000")
    expect(record.timeline).not.toContain("> review")
  })
})
