#!/usr/bin/env node

import { createReadStream, createWriteStream, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'

const DEFAULT_MATCH =
  'ERROR|FAILED|Interrupted|Traceback|ModuleNotFoundError|ImportError|collected|timeout'

function parseArgs(argv) {
  const options = {
    kind: 'generic',
    timeoutSeconds: 180,
    maxMatches: 80,
    tailLines: 40,
    json: false,
    command: [],
  }

  let index = 0
  for (; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') {
      options.command = argv.slice(index + 1)
      break
    }
    if (arg === '--kind') {
      options.kind = requireValue(argv, index, arg)
      index += 1
    } else if (arg === '--timeout') {
      options.timeoutSeconds = parsePositiveNumber(requireValue(argv, index, arg), arg)
      index += 1
    } else if (arg === '--max-matches') {
      options.maxMatches = Math.floor(parsePositiveNumber(requireValue(argv, index, arg), arg))
      index += 1
    } else if (arg === '--tail') {
      options.tailLines = Math.floor(parsePositiveNumber(requireValue(argv, index, arg), arg))
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (!['generic', 'pytest-collect'].includes(options.kind)) {
    throw new Error('--kind must be generic or pytest-collect')
  }

  if (!options.help && options.command.length === 0) {
    throw new Error('expected command after --')
  }

  return options
}

function requireValue(argv, index, arg) {
  const value = argv[index + 1]
  if (!value) {
    throw new Error(`${arg} needs a value`)
  }
  return value
}

function parsePositiveNumber(value, arg) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${arg} must be a positive number`)
  }
  return number
}

function matcherForKind(kind) {
  if (kind === 'pytest-collect') {
    return /^ERROR |^_ ERROR|^E\s+|Interrupted|collected|ModuleNotFoundError|ImportError|Traceback/
  }
  return new RegExp(DEFAULT_MATCH)
}

function truncate(value, maxLength = 240) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

function isCollectedPytestNode(line) {
  return /^tests\/.+::/.test(line)
}

async function runCommand(command, args, timeoutSeconds, logPath) {
  return new Promise((resolve) => {
    const output = createWriteStream(logPath)
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
    })

    let settled = false
    let timedOut = false
    let killTimer = null
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000)
    }, timeoutSeconds * 1000)

    const finish = (result) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      if (killTimer) {
        clearTimeout(killTimer)
      }
      output.end(() => resolve({ ...result, timedOut }))
    }

    child.stdout.on('data', (chunk) => output.write(chunk))
    child.stderr.on('data', (chunk) => output.write(chunk))
    child.on('error', (error) => {
      output.write(`[spawn error] ${error.message}\n`)
      finish({ status: 127, signal: null })
    })
    child.on('close', (code, signal) => {
      finish({ status: code ?? 128, signal })
    })
  })
}

async function summarizeLog(logPath, options) {
  const matcher = matcherForKind(options.kind)
  const matches = []
  const tail = []
  let lines = 0

  const stream = createReadStream(logPath, { encoding: 'utf8' })
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  })

  for await (const line of reader) {
    lines += 1
    if (matches.length < options.maxMatches && matcher.test(line)) {
      matches.push({ line: lines, text: truncate(line) })
    }

    if (options.kind !== 'pytest-collect' && !isCollectedPytestNode(line)) {
      tail.push(truncate(line))
      if (tail.length > options.tailLines) {
        tail.shift()
      }
    }
  }

  return {
    bytes: statSync(logPath).size,
    lines,
    matches,
    tail,
  }
}

function renderMarkdown(summary) {
  const command = summary.command.map((part) => shellish(part)).join(' ')
  const lines = [
    '# Bounded Command Summary',
    '',
    `command: ${command}`,
    `log: ${summary.log}`,
    `status: ${summary.status}`,
    `signal: ${summary.signal ?? 'none'}`,
    `timed_out: ${summary.timedOut}`,
    `lines: ${summary.lines}`,
    `bytes: ${summary.bytes}`,
    '',
    '## Matches',
  ]

  if (summary.matches.length === 0) {
    lines.push('- none')
  } else {
    for (const match of summary.matches) {
      lines.push(`- ${match.line}: ${match.text}`)
    }
  }

  lines.push('')
  if (summary.kind === 'pytest-collect') {
    lines.push('## Tail')
    lines.push('omitted for pytest-collect to avoid printing collected node IDs')
  } else {
    lines.push('## Tail')
    if (summary.tail.length === 0) {
      lines.push('- none')
    } else {
      for (const line of summary.tail) {
        lines.push(line)
      }
    }
  }

  return lines.join('\n')
}

function shellish(value) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value
  }
  return `'${value.replaceAll("'", "'\\''")}'`
}

function usage() {
  return `Usage: bounded-command-summary.mjs [--kind generic|pytest-collect] [--timeout seconds] [--max-matches N] [--tail N] [--json] -- <command> [args...]

Run a potentially noisy verification command, save full output to a temp log,
and print only a bounded summary.`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const dir = mkdtempSync(join(tmpdir(), 'reduce-entropy-command-'))
  const logPath = join(dir, 'output.log')
  const [command, ...args] = options.command
  const run = await runCommand(command, args, options.timeoutSeconds, logPath)
  const log = await summarizeLog(logPath, options)
  const summary = {
    kind: options.kind,
    command: options.command,
    log: logPath,
    status: run.status,
    signal: run.signal,
    timedOut: run.timedOut,
    ...log,
  }

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(renderMarkdown(summary))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
