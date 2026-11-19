// Every Effect import follows docs/standards/effect-imports.md, held to account. The rules are beep-effect's
// (standards/effect-laws-v1.md laws 1 and 2, .patterns/effect-module-paths.md); its own checker is a ts-morph command
// inside its CLI and cannot be brought over, so this is the same law as one script.
//
//   node scripts/check-effect-imports.mjs            check: exit 1 and one sentence per wrong import
//   node scripts/check-effect-imports.mjs --write    repair the code that can be repaired mechanically, then check
//   node scripts/check-effect-imports.mjs <files>    only these files (either mode)
//
// What fails:
//   root-barrel     anything imported or re-exported from "effect"
//   nested-barrel   anything from a folder of modules ("effect/http", "effect/sql", ...) or from an "@effect/<package>"
//                   root other than the test runner's
//   alias           a namespace import whose name is not the module's (A, O, P, R, S, Str, Eq, Bool, F, BI, Regex, Num, and
//                   the module's own name for every other), unless that name is already taken in the file
//   named-import    a value picked by name from a module's own path; only "effect/Function" is imported that way
//   unknown-path    a path the installed package does not have
// It reads code under apps, packages, scripts and test, the examples in their comments, and the standing documents.
// The vendored kit packages (a vendor.json at their root) are not this repository's to change and are skipped.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseSync } from "oxc-parser"

const repo = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const write = args.includes("--write")
const named = args.filter((arg) => !arg.startsWith("--")).map((arg) => relative(repo, resolve(arg)))

/** The modules whose namespace name is not the module's own. beep-effect: effect-laws-v1 law 1, EF-4. */
const aliases = {
  "effect/Array": ["A"],
  "effect/Option": ["O"],
  "effect/Predicate": ["P"],
  "effect/Record": ["R"],
  "effect/Schema": ["S"],
  "effect/String": ["Str"],
  "effect/Equal": ["Eq"],
  "effect/Boolean": ["Bool"],
  "effect/Function": ["F"],
  "effect/BigInt": ["BI"],
  "effect/RegExp": ["Regex"],
  // beep-effect writes both Num and N; Benjamin chose Num (explorations/ideal-architecture/DECISIONS.md).
  "effect/Number": ["Num"]
}
/** Packages whose root is imported by name, as beep-effect does: the test runner's `describe`, `it`, `layer`. */
const namedRoots = ["@effect/vitest", "@effect/atom-react"]
/** Modules a value may be picked from by name. */
const namedLeaves = ["effect/Function", "@effect/vitest/utils"]

const isEffect = (source) => source === "effect" || source.startsWith("effect/") || source.startsWith("@effect/")
const packageOf = (source) => (source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : "effect")
const subpathOf = (source) => source.slice(packageOf(source).length + 1)

const packageDirs = {}
const packageDir = (name) => {
  if (!(name in packageDirs)) {
    const found = [join(repo, "node_modules", name)].concat(
      execFileSync("git", ["ls-files", "*/package.json"], { cwd: repo, encoding: "utf8" })
        .split("\n")
        .filter((path) => path !== "")
        .map((path) => join(repo, dirname(path), "node_modules", name))
    )
    packageDirs[name] = found.find((dir) => existsSync(join(dir, "package.json")))
  }
  return packageDirs[name]
}
/** "barrel" for a package root or a folder of modules, "leaf" for one module, "missing" for neither. */
const shapeOf = (source) => {
  const dir = packageDir(packageOf(source))
  if (dir === undefined) return "leaf" // not installed where this script can see it: not this check's business
  const subpath = subpathOf(source)
  if (subpath === "") return "barrel"
  if (existsSync(join(dir, "dist", subpath, "index.js"))) return "barrel"
  return existsSync(join(dir, "dist", `${subpath}.js`)) ? "leaf" : "missing"
}
const canonicalOf = (source) => aliases[source] ?? [source.slice(source.lastIndexOf("/") + 1)]

let functionNames
/** The flat functions "effect" re-exports from "effect/Function": `pipe`, `flow`, `identity`, `dual`. */
const isFunctionExport = (name) => {
  if (functionNames === undefined) {
    const text = readFileSync(join(packageDir("effect"), "dist", "Function.d.ts"), "utf8")
    functionNames = [...text.matchAll(/^export (?:declare )?(?:const|function) (\w+)/gm)].map((match) => match[1])
  }
  return functionNames.includes(name)
}

const importLine = (local, source, type) => `import ${type ? "type " : ""}* as ${local} from "${source}"`

/**
 * What is wrong with one import, as a list of sentences. `specifiers` are `{ kind, imported, local, type }` with kind
 * "namespace", "named" or "default"; `taken` says whether a name is bound by something else in the file.
 */
const judge = (source, specifiers, taken) => {
  const shape = shapeOf(source)
  if (shape === "missing") return [`unknown-path: "${source}" is not a path of the installed ${packageOf(source)}`]
  if (shape === "barrel") {
    if (namedRoots.includes(source)) return []
    const kind = source === "effect" ? "root-barrel" : "nested-barrel"
    if (specifiers.length === 0) return [`${kind}: "${source}" is a barrel. Import each module from its own path`]
    return specifiers.map((specifier) => {
      if (specifier.kind !== "named") {
        return `${kind}: "${source}" is a barrel and cannot be imported whole. Import each module from its own path`
      }
      const leaf = `${source}/${specifier.imported}`
      if (shapeOf(leaf) === "leaf") {
        return `${kind}: ${specifier.imported} from "${source}". Write: ${importLine(canonicalOf(leaf)[0], leaf, specifier.type)}`
      }
      if (source === "effect" && isFunctionExport(specifier.imported)) {
        return `${kind}: ${specifier.imported} from "effect". Write: import { ${specifier.imported} } from "effect/Function"`
      }
      return `${kind}: ${specifier.imported} from "${source}", and "${leaf}" is not a module. Find its module and import that`
    })
  }
  return specifiers.flatMap((specifier) => {
    if (specifier.kind === "namespace") {
      const names = canonicalOf(source)
      if (names.includes(specifier.local) || names.every(taken)) return []
      return [
        `alias: "${source}" as ${specifier.local}. Write: ${importLine(names[0], source, specifier.type)}` +
          (names.length > 1 ? ` (or ${names.slice(1).join(", ")})` : "")
      ]
    }
    if (specifier.type || namedLeaves.includes(source) || !source.startsWith("effect/")) return []
    return [
      `named-import: ${specifier.imported} from "${source}". Write: ${importLine(canonicalOf(source)[0], source, false)}` +
        ` and ${canonicalOf(source)[0]}.${specifier.imported}`
    ]
  })
}

// ---------------------------------------------------------------------------------------------------------------
// Which files

const tracked = (patterns) =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...patterns], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 1 << 28
  })
    .split("\n")
    .filter((path) => path !== "" && existsSync(join(repo, path)))

const vendored = tracked(["*vendor.json"]).map((path) => `${dirname(path)}/`)
const isVendored = (path) => vendored.some((dir) => path.startsWith(dir)) || path.includes("/dist/")

const codeRoots = ["apps", "packages", "scripts", "test"]
const codeFiles = tracked(codeRoots.flatMap((root) => ["ts", "tsx", "mts", "mjs"].map((ext) => `${root}/**/*.${ext}`)))
  .concat(tracked(["scripts/*.mjs", "scripts/*.ts"]))
  .filter((path, index, all) => all.indexOf(path) === index && !isVendored(path))
// The standard shows wrong imports on purpose.
const standard = "docs/standards/effect-imports.md"
// The standing documents: what an agent or a person reads as current guidance. Evidence (docs/session, docs/qa),
// research and vendored skills are other people's words or a record, and are not rewritten.
const textFiles = tracked(["*.md", "docs/**/*.md", ".claude/agents/*.md"]).filter(
  (path) =>
    !path.startsWith("docs/session/") &&
    !path.startsWith("docs/qa/") &&
    path !== standard &&
    (!path.includes("/") || path.startsWith("docs/") || path.startsWith(".claude/agents/"))
)
const wanted = (path) => named.length === 0 || named.includes(path)

// ---------------------------------------------------------------------------------------------------------------
// Examples in comments and documents: import statements found by pattern

const statement =
  /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+(["'])((?:effect|@effect\/[\w-]+)(?:\/[\w-]+)*)\3/g
const readClause = (clause, declaredType) =>
  clause.startsWith("*")
    ? [{ kind: "namespace", local: clause.replace(/^\*\s+as\s+/, ""), type: declaredType }]
    : clause
        .slice(1, -1)
        .split(",")
        .map((part) => part.replace(/[\s*]+/g, " ").trim())
        .filter((part) => part !== "")
        .map((part) => {
          const match = /^(type )?(\w+)(?: as (\w+))?$/.exec(part)
          if (match === null) return undefined
          return {
            kind: "named",
            imported: match[2],
            local: match[3] ?? match[2],
            type: declaredType || match[1] !== undefined
          }
        })
        .filter((specifier) => specifier !== undefined)

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length

/** The wrong import statements in a stretch of prose or comment, each with the offset it starts at. */
const judgeText = (text) =>
  [...text.matchAll(statement)].flatMap((match) =>
    judge(match[4], readClause(match[2], match[1] !== undefined), () => false).map((sentence) => ({
      offset: match.index,
      sentence
    }))
  )

/** The same stretch with every import statement that can be repaired written the house way. */
const repairText = (text) =>
  text.replace(statement, (whole, type, clause, _quote, source, offset) => {
    const specifiers = readClause(clause, type !== undefined)
    if (judge(source, specifiers, () => false).length === 0) return whole
    const lineStart = text.lastIndexOf("\n", offset - 1) + 1
    const lead = text.slice(lineStart, offset)
    const lines = specifiers.map((specifier) => {
      if (specifier.kind === "namespace") {
        return shapeOf(source) === "leaf" ? importLine(canonicalOf(source)[0], source, specifier.type) : undefined
      }
      const leaf = `${source}/${specifier.imported}`
      if (shapeOf(source) === "barrel" && shapeOf(leaf) === "leaf") {
        return importLine(canonicalOf(leaf)[0], leaf, specifier.type)
      }
      if (source === "effect" && isFunctionExport(specifier.imported)) {
        return `import { ${specifier.imported} } from "effect/Function"`
      }
      return undefined
    })
    return lines.includes(undefined) ? whole : lines.join(`\n${lead}`)
  })

// ---------------------------------------------------------------------------------------------------------------
// Code

const children = (node) =>
  Object.entries(node).flatMap(([key, value]) =>
    key === "parent" || value === null || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.filter((item) => item !== null && typeof item === "object" && typeof item.type === "string")
        : typeof value.type === "string"
          ? [value]
          : []
  )
const walk = (node, parent, visit) => {
  visit(node, parent)
  for (const child of children(node)) walk(child, node, visit)
}

const specifiersOf = (declaration) =>
  declaration.specifiers.map((specifier) => {
    const type = declaration.importKind === "type" || specifier.importKind === "type"
    if (specifier.type === "ImportNamespaceSpecifier") return { kind: "namespace", local: specifier.local.name, type }
    if (specifier.type === "ImportDefaultSpecifier") return { kind: "default", local: specifier.local.name, type }
    return {
      kind: "named",
      imported: specifier.imported.name ?? specifier.imported.value,
      local: specifier.local.name,
      type
    }
  })

/** The names a file's top level binds, other than through its Effect imports. */
const boundNames = (program) => {
  const names = []
  const declared = (node) => {
    if (node === null || node === undefined) return
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations)
        if (declarator.id.type === "Identifier") names.push(declarator.id.name)
    } else if (node.id?.type === "Identifier") names.push(node.id.name)
  }
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      if (!isEffect(node.source.value)) for (const specifier of node.specifiers) names.push(specifier.local.name)
    } else if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
      declared(node.declaration)
    } else declared(node)
  }
  return names
}

const judgeCode = (path, text) => {
  const parsed = parseSync(path, text)
  const bound = boundNames(parsed.program)
  const found = []
  for (const node of parsed.program.body) {
    const source = node.source?.value
    if (typeof source !== "string" || !isEffect(source)) continue
    if (node.type === "ImportDeclaration") {
      const own = specifiersOf(node)
      // A name is taken when something other than an Effect import of this same module binds it.
      const others = parsed.program.body.flatMap((other) =>
        other.type === "ImportDeclaration" && isEffect(other.source.value) && other.source.value !== source
          ? other.specifiers.map((specifier) => specifier.local.name)
          : []
      )
      const taken = (name) => bound.includes(name) || others.includes(name)
      for (const sentence of judge(source, own, taken)) found.push({ offset: node.start, sentence })
    } else if (shapeOf(source) !== "leaf") {
      found.push({
        offset: node.start,
        sentence: `re-export from "${source}", a barrel. Re-export from the module's own path`
      })
    }
  }
  walk(parsed.program, undefined, (node) => {
    if (node.type === "ImportExpression" && node.source.type === "Literal" && typeof node.source.value === "string") {
      const source = node.source.value
      if (isEffect(source) && shapeOf(source) !== "leaf" && !namedRoots.includes(source)) {
        found.push({ offset: node.start, sentence: `import("${source}") loads a barrel. Load the module's own path` })
      }
    }
  })
  for (const comment of parsed.comments) {
    for (const hit of judgeText(comment.value)) {
      found.push({ offset: comment.start + hit.offset, sentence: `in a comment, ${hit.sentence}` })
    }
  }
  return found
}

/** Positions where an identifier is a property's name, not a reference to a binding. */
const isName = (node, parent) =>
  parent !== undefined &&
  ((parent.type === "MemberExpression" && parent.property === node && !parent.computed) ||
    (parent.type === "TSQualifiedName" && parent.right === node) ||
    (parent.type === "JSXMemberExpression" && parent.property === node) ||
    (parent.type === "JSXAttribute" && parent.name === node) ||
    ([
      "Property",
      "MethodDefinition",
      "PropertyDefinition",
      "AccessorProperty",
      "TSPropertySignature",
      "TSMethodSignature",
      "TSEnumMember"
    ].includes(parent.type) &&
      parent.key === node &&
      !parent.computed &&
      parent.shorthand !== true) ||
    (["LabeledStatement", "BreakStatement", "ContinueStatement"].includes(parent.type) && parent.label === node) ||
    parent.type === "ImportSpecifier" ||
    parent.type === "ImportNamespaceSpecifier" ||
    parent.type === "ImportDefaultSpecifier" ||
    (parent.type === "TSModuleDeclaration" && parent.id === node))

/** Positions where an identifier declares a new binding, which would shadow an import of the same name. */
const declares = (node, parent) =>
  parent !== undefined &&
  ((parent.type === "VariableDeclarator" && parent.id === node) ||
    ([
      "FunctionDeclaration",
      "FunctionExpression",
      "ClassDeclaration",
      "ClassExpression",
      "TSTypeAliasDeclaration",
      "TSInterfaceDeclaration",
      "TSEnumDeclaration"
    ].includes(parent.type) &&
      parent.id === node) ||
    (parent.type === "TSTypeParameter" && parent.name === node) ||
    (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(parent.type) &&
      parent.params.includes(node)) ||
    (parent.type === "CatchClause" && parent.param === node) ||
    parent.type === "ArrayPattern" ||
    parent.type === "RestElement" ||
    (parent.type === "AssignmentPattern" && parent.left === node))

/**
 * One file written the house way: every barrel import split into its modules, every namespace given its name, and the
 * identifiers that follow from a changed name renamed with it. Returns the new text, and what it had to leave.
 */
const repairCode = (path, text) => {
  const parsed = parseSync(path, text)
  const bound = boundNames(parsed.program)
  const left = []
  const declarations = parsed.program.body.filter(
    (node) => node.type === "ImportDeclaration" && isEffect(node.source.value)
  )
  // Every namespace this file ends up with: module path -> { locals, type, first declaration }.
  const modules = {}
  const order = []
  const plans = []
  for (const declaration of declarations) {
    const source = declaration.source.value
    const shape = shapeOf(source)
    const specifiers = specifiersOf(declaration)
    const uses = []
    let whole = true
    if (shape === "leaf") {
      if (specifiers.length === 1 && specifiers[0].kind === "namespace") uses.push({ ...specifiers[0], path: source })
      else whole = false
    } else if (shape === "barrel" && !namedRoots.includes(source) && specifiers.length > 0) {
      for (const specifier of specifiers) {
        const leaf = `${source}/${specifier.imported}`
        if (specifier.kind === "named" && shapeOf(leaf) === "leaf") uses.push({ ...specifier, path: leaf })
        else if (specifier.kind === "named" && source === "effect" && isFunctionExport(specifier.imported)) {
          uses.push({ ...specifier, path: "effect/Function", flat: true })
        } else whole = false
      }
    } else whole = false
    if (!whole) continue // judged, and left for a person
    plans.push({ declaration, uses })
    for (const use of uses) {
      if (use.flat === true) continue
      if (!(use.path in modules)) {
        modules[use.path] = { locals: [], type: true, first: declaration }
        order.push(use.path)
      }
      modules[use.path].locals.push(use.local)
      modules[use.path].type = modules[use.path].type && use.type
    }
  }
  const renames = {}
  const finalNames = {}
  for (const modulePath of order) {
    const entry = modules[modulePath]
    const names = canonicalOf(modulePath)
    const others = Object.entries(modules).flatMap(([other, value]) => (other === modulePath ? [] : value.locals))
    const kept = names.find((name) => entry.locals.includes(name))
    const free = names.find((name) => !bound.includes(name) && !others.includes(name))
    const final = kept ?? free ?? entry.locals[0]
    finalNames[modulePath] = final
    for (const local of entry.locals) if (local !== final) renames[local] = final
  }
  // A module's name must not collide with another module's in the same file.
  const finals = Object.values(finalNames)
  if (finals.some((name, index) => finals.indexOf(name) !== index)) {
    return { text, left: ["two modules would share one name: repair this file by hand"] }
  }

  const edits = []
  for (const { declaration, uses } of plans) {
    const semicolon = text.slice(declaration.start, declaration.end).trimEnd().endsWith(";") ? ";" : ""
    const lines = []
    const flat = uses.filter((use) => use.flat === true)
    for (const use of uses) {
      if (use.flat === true) continue
      if (modules[use.path].first !== declaration || modules[use.path].written === true) continue
      modules[use.path].written = true
      lines.push(importLine(finalNames[use.path], use.path, modules[use.path].type) + semicolon)
    }
    if (flat.length > 0) {
      const names = flat.map((use) => (use.local === use.imported ? use.imported : `${use.imported} as ${use.local}`))
      lines.push(`import { ${names.join(", ")} } from "effect/Function"${semicolon}`)
    }
    const replacement = lines.join("\n")
    if (replacement === text.slice(declaration.start, declaration.end)) continue
    if (replacement === "") {
      // The module is already imported above: drop this line with its line break.
      const end = text[declaration.end] === "\n" ? declaration.end + 1 : declaration.end
      edits.push({ start: declaration.start, end, replacement: "" })
    } else edits.push({ start: declaration.start, end: declaration.end, replacement })
  }

  const renamed = Object.keys(renames)
  if (renamed.length > 0) {
    const shadowed = []
    const references = []
    walk(parsed.program, undefined, (node, parent) => {
      if (parent?.type === "ImportDeclaration" || parent?.type === "ImportSpecifier") return
      if ((node.type !== "Identifier" && node.type !== "JSXIdentifier") || !renamed.includes(node.name)) return
      if (parent?.type === "ImportNamespaceSpecifier" || parent?.type === "ImportDefaultSpecifier") return
      if (isName(node, parent)) return
      if (declares(node, parent) || parent?.type === "ExportSpecifier") shadowed.push(node.name)
      else references.push({ node, parent })
    })
    for (const { node, parent } of references) {
      if (shadowed.includes(node.name)) continue
      const next = renames[node.name]
      const shorthand = parent?.type === "Property" && parent.shorthand === true
      edits.push({ start: node.start, end: node.end, replacement: shorthand ? `${node.name}: ${next}` : next })
    }
    for (const name of shadowed.filter((item, index) => shadowed.indexOf(item) === index)) {
      left.push(`${name} is declared again inside the file: rename its uses to ${renames[name]} by hand`)
    }
    // Examples in comments follow the names of the file they sit in.
    for (const comment of parsed.comments) {
      const before = text.slice(comment.start, comment.end)
      const after = before.replace(
        new RegExp(`(?<![\\w.$])(${renamed.join("|")})\\.(?=[A-Za-z_$])`, "g"),
        (_whole, name) => `${renames[name]}.`
      )
      if (after !== before) edits.push({ start: comment.start, end: comment.end, replacement: after })
    }
  }

  let next = text
  const sorted = edits.toSorted((a, b) => b.start - a.start)
  for (let index = 0; index < sorted.length; index += 1) {
    const edit = sorted[index]
    // A reference inside a comment that was rewritten whole cannot happen; overlapping edits would be a bug.
    if (index > 0 && edit.end > sorted[index - 1].start) {
      return { text, left: ["overlapping edits: repair this file by hand"] }
    }
    next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end)
  }
  // Import statements inside comments.
  const reparsed = parseSync(path, next)
  for (const comment of reparsed.comments.toSorted((a, b) => b.start - a.start)) {
    const before = next.slice(comment.start, comment.end)
    const after = repairText(before)
    if (after !== before) next = next.slice(0, comment.start) + after + next.slice(comment.end)
  }
  return { text: next, left }
}

// ---------------------------------------------------------------------------------------------------------------

const counts = { files: 0, changed: 0 }
const problems = []
for (const path of codeFiles.filter(wanted)) {
  counts.files += 1
  let text = readFileSync(join(repo, path), "utf8")
  if (write) {
    const repaired = repairCode(path, text)
    for (const sentence of repaired.left) problems.push(`${path}  ${sentence}`)
    if (repaired.text !== text) {
      writeFileSync(join(repo, path), repaired.text)
      text = repaired.text
      counts.changed += 1
    }
  }
  for (const hit of judgeCode(path, text)) problems.push(`${path}:${lineOf(text, hit.offset)}  ${hit.sentence}`)
}
// Documents are checked, never rewritten: a sentence around an import has to be reworded by a person.
for (const path of textFiles.filter(wanted)) {
  counts.files += 1
  const text = readFileSync(join(repo, path), "utf8")
  for (const hit of judgeText(text)) problems.push(`${path}:${lineOf(text, hit.offset)}  ${hit.sentence}`)
}

if (write) console.log(`check-effect-imports wrote ${counts.changed} of ${counts.files} files`)
if (problems.length > 0) {
  console.error(
    `check-effect-imports FAIL  ${problems.length} in ${counts.files} files (docs/standards/effect-imports.md)`
  )
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`check-effect-imports OK  ${counts.files} files, every Effect import from its own path under its own name`)
