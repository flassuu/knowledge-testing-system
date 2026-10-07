#!/usr/bin/env node
/**
 * Browser checks: the layout and the happy paths, in a real Firefox.
 *
 * Why a script and not a test file: most of what goes wrong in this interface
 * cannot be asserted without a real renderer. A `<fieldset>` that refuses to
 * shrink, a label that wraps to two lines in Ukrainian, a tap target of 28px —
 * none of that shows up in jsdom, and all of it shows up here.
 *
 * It drives Firefox over WebDriver BiDi with no dependencies at all: a
 * WebSocket, a few JSON messages. That is deliberate - a check that needs a
 * package install will not be run by the person who needs it.
 *
 *   pnpm check:browser                  # needs a server on :3300
 *   BASE=http://host:3300 pnpm check:browser
 *   ADMIN_PASSWORD=... pnpm check:browser
 *
 * It creates the accounts, the test, the session and the class it needs, and
 * deletes them afterwards. Screenshots of a failure land in a temporary
 * directory whose path is printed.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3300'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin'
const HEADED = process.argv.includes('--headed')
const SHOTS = process.env.SHOTS_DIR ?? mkdtempSync(join(tmpdir(), 'lantern-browser-'))

const WIDTHS = [320, 390, 1100]
const LOCALES = ['en', 'uk']

// ---------------------------------------------------------------- BiDi client

/**
 * A WebDriver BiDi session.
 *
 * One quirk worth writing down: Firefox does not pass `script.callFunction`
 * arguments to the function, so values are inlined into its source with
 * JSON.stringify. It is safe here because every value is produced by this file,
 * never by a user.
 */
class Session {
  #socket
  #nextId = 1
  #pending = new Map()

  static async launch({ port, profile }) {
    const child = spawn(
      'firefox',
      [
        '--no-remote',
        '--profile',
        profile,
        '--remote-debugging-port',
        String(port),
        ...(HEADED ? [] : ['--headless']),
        'about:blank',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )

    const reported = await new Promise((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(
        () => reject(new Error('Firefox did not report a BiDi endpoint in 30s')),
        30_000,
      )
      child.stderr.on('data', (chunk) => {
        buffer += chunk.toString()
        const match = buffer.match(/WebDriver BiDi listening on (ws:\/\/\S+)/)
        if (match) {
          clearTimeout(timer)
          resolve(match[1])
        }
      })
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`Firefox exited with ${code}`))
      })
    })
    // Firefox reports the host and port without the path; the session endpoint
    // lives at /session, and connecting to the bare host is refused.
    const url = reported.replace(/\/$/, '') + '/session'
    return { child, url }
  }

  static async open(url) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', () => reject(new Error('BiDi socket failed')), {
        once: true,
      })
    })
    const session = new Session()
    session.#socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const pending = session.#pending.get(message.id)
      if (!pending) return
      session.#pending.delete(message.id)
      if (message.type === 'error') pending.reject(new Error(message.message ?? 'BiDi error'))
      else pending.resolve(message.result)
    })
    await session.send('session.new', { capabilities: {} })
    return session
  }

  send(method, params = {}) {
    const id = this.#nextId++
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#socket.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.#pending.delete(id)) reject(new Error(`timeout ${method}`))
      }, 30_000)
    })
  }

  async page(width, height = 900) {
    const created = await this.send('browsingContext.create', { type: 'tab' })
    const context = created.context
    await this.send('browsingContext.setViewport', { context, viewport: { width, height } })
    // Starts on the app rather than about:blank, so localStorage has an origin
    // to live in from the first line of the first check.
    await this.goto(context, BASE)
    return context
  }

  async setViewport(context, width, height = 900) {
    await this.send('browsingContext.setViewport', { context, viewport: { width, height } })
  }

  async goto(context, url) {
    await this.send('browsingContext.navigate', { context, url, wait: 'complete' })
  }

  /** Runs `source` as an async function body in the page; returns its value. */
  async run(context, source) {
    const result = await this.send('script.callFunction', {
      functionDeclaration: `async function () { ${source} }`,
      target: { context },
      awaitPromise: true,
    })
    if (result.type === 'exception') {
      throw new Error(
        result.exceptionDetails?.text ?? 'exception in the page',
      )
    }
    return decode(result.result)
  }

  async screenshot(context, path) {
    const shot = await this.send('browsingContext.captureScreenshot', { context })
    writeFileSync(path, Buffer.from(shot.data, 'base64'))
  }

  async close() {
    try {
      await this.send('session.end', {})
    } catch {
      // Already gone; closing the socket is enough.
    }
    this.#socket.close()
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/**
 * Unpacks what WebDriver BiDi sends back.
 *
 * A value comes from the page as BiDi's own serialization, not as the thing
 * that was returned: `{ type: 'object', value: [['warning', { type: 'boolean',
 * value: true }]] }`. Reading `.value` off that gives a list of pairs, so
 * `result.warning` is `undefined` and every check that reads a field quietly
 * fails - or, worse, quietly passes. Numbers, strings and booleans are the only
 * shapes that survive without this.
 */
function decode(remote) {
  if (remote === null || typeof remote !== 'object') return remote
  const { type } = remote
  if (type === 'null') return null
  if (type === 'object') {
    return Object.fromEntries(
      remote.value.map(([key, item]) => [key, decode(item)]),
    )
  }
  if (type === 'array') return remote.value.map(decode)
  return remote.value
}

// ------------------------------------------------------------------- the API

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 120)}`)
  }
  return text === '' ? null : JSON.parse(text)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function tokenOf(username, password) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  return result.token
}

// ------------------------------------------------------------- test fixtures

const SUFFIX = Math.floor(Math.random() * 100000)
const NAMES = {
  teacher: `browsercheck_t${SUFFIX}`,
  student: `browsercheck_s${SUFFIX}`,
}
const created = { tests: [], sessions: [], classes: [], users: [] }

/** Everything the checks need, built through the API and torn down after. */
async function seed() {
  const admin = await tokenOf('admin', ADMIN_PASSWORD)

  await api('/api/users', {
    token: admin,
    method: 'POST',
    body: { username: NAMES.teacher, password: 'browsercheck-pass-1', fullName: 'Check Teacher' },
  })
  created.users.push(NAMES.teacher)
  const teacher = await tokenOf(NAMES.teacher, 'browsercheck-pass-1')

  const test = await api('/api/tests', {
    token: teacher,
    method: 'POST',
    body: {
      title: `Browser check ${SUFFIX}`,
      // The API takes the stored shape - keyed options and a correct key - not
      // what the editor shows, so the fixture follows the server's contract.
      questions: [
        {
          type: 'single_choice',
          position: 0,
          body: 'Two plus two?',
          points: 1,
          payload: {
            options: [
              { key: 'a', text: '4' },
              { key: 'b', text: '5' },
            ],
            correct: 'a',
          },
        },
      ],
    },
  })
  created.tests.push(test.test.id)

  const session = await api('/api/sessions', {
    token: teacher,
    method: 'POST',
    body: { testId: test.test.id },
  })
  created.sessions.push(session.session.id)

  const classroom = await api('/api/classrooms', {
    token: teacher,
    method: 'POST',
    body: { name: `Class ${SUFFIX}` },
  })
  created.classes.push(classroom.classroom.id)

  // Registering with the key is the flow 5.2 added: approved, no admin involved.
  await api('/api/auth/register', {
    method: 'POST',
    body: {
      username: NAMES.student,
      password: 'browsercheck-pass-1',
      fullName: 'Check Student',
      classKey: classroom.classroom.key,
    },
  })
  created.users.push(NAMES.student)

  return { admin, teacher, student: await tokenOf(NAMES.student, 'browsercheck-pass-1'), key: classroom.classroom.key }
}

async function cleanup() {
  const admin = await tokenOf('admin', ADMIN_PASSWORD).catch(() => null)
  if (!admin) return
  for (const id of created.sessions) {
    await api(`/api/sessions/${id}`, { token: admin, method: 'PATCH', body: { status: 'finished' } }).catch(() => {})
  }
  for (const id of created.tests) await api(`/api/tests/${id}`, { token: admin, method: 'DELETE' }).catch(() => {})
  for (const id of created.classes) await api(`/api/classrooms/${id}`, { token: admin, method: 'DELETE' }).catch(() => {})
  const users = await api('/api/users', { token: admin }).catch(() => ({ users: [] }))
  for (const user of users.users ?? []) {
    if (!created.users.includes(user.username)) continue
    await api(`/api/users/${user.id}`, { token: admin, method: 'DELETE' }).catch(() => {})
  }
}

// -------------------------------------------------------------- the checks

const failures = []
/** Makes every load a different URL, so a navigation is never a no-op. */
let navigations = 0

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`   ok    ${name}`)
  } else {
    console.log(`   FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
  }
}

const AUDIT = `
  const app = document.querySelector('#app');
  const box = app.getBoundingClientRect();
  const found = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  if (app.scrollWidth > box.width + 1) {
    found.push('the page scrolls sideways: ' + app.scrollWidth + 'px in ' + Math.round(box.width) + 'px');
  }
  for (const el of app.querySelectorAll('*')) {
    if (!visible(el) || el.scrollWidth > el.clientWidth + 1) continue;
    const r = el.getBoundingClientRect();
    if (r.right > box.right + 1) {
      found.push('past the right edge: <' + el.tagName.toLowerCase() + '> "' + el.textContent.trim().slice(0, 24) + '"');
      break;
    }
  }
  for (const el of app.querySelectorAll('button, a, input, select, [role="button"], [role="tab"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // 30px is the floor for anything a thumb has to hit.
    if (r.height < 30 || r.width < 30) {
      const name = el.getAttribute('aria-label') || el.textContent.trim() || el.title || '?';
      found.push('a small target: ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + name.slice(0, 20) + '"');
      break;
    }
  }
  for (const el of app.querySelectorAll('button')) {
    if (!visible(el)) continue;
    if (!el.getAttribute('aria-label') && !el.textContent.trim() && !el.title) {
      found.push('a button with no name');
      break;
    }
  }
  const keys = [...new Set((app.textContent.match(/\\b(admin|auth|common|student|teacher)\\.[a-zA-Z.]+\\b/g) || []))];
  if (keys.length) found.push('untranslated keys: ' + keys.slice(0, 3).join(', '));
  return { found };
`

async function auditScreen(session, context, label) {
  const result = await session.run(context, AUDIT)
  // The hidden file input is 1x1 on purpose: off the tab order and off the screen.
  const real = (result.found ?? []).filter((line) => !line.includes('1x1'))
  check(`${label}: layout`, real.length === 0, real.slice(0, 2).join(' | '))
  return real
}


/**
 * Loads the app signed in, at a given width, as a real navigation.
 *
 * Two traps, both learned the hard way. `location.reload()` from inside the
 * page leaves BiDi's `navigate` wait pointing at the previous document - which
 * still shows the login screen, and a check that audits that reports nothing
 * and passes. And navigating to the same URL twice is not guaranteed to load
 * anything at all. So the token goes into localStorage first, and the URL
 * carries a changing query to make every load a real one.
 */
async function openApp(session, context, { token, locale, width, height = 900 }) {
  await session.setViewport(context, width, height)
  await session.run(
    context,
    `
    localStorage.setItem('auth.token', ${JSON.stringify(token)});
    localStorage.setItem('locale', ${JSON.stringify(locale)});
    return true;
  `,
  )
  navigations += 1
  await session.goto(context, `${BASE}/?check=${navigations}`)
}

/**
 * Waits for the screen the check is about, rather than sleeping a guessed
 * number of seconds.
 *
 * "The app has some text" is not a condition worth waiting for: it is true for
 * the login screen too, which is what an expired token leaves behind. So the
 * wait is for what the screen is supposed to contain, and a timeout says what
 * the page looked like instead of just that it took too long.
 */
async function settle(session, context, expect = 'content', attempts = 60) {
  let last = 'unknown'
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await session.run(
      context,
      `
      const app = document.querySelector('#app');
      if (!app) return 'no-app';
      const tabs = app.querySelectorAll('[role=tab]').length;
      const signedOut = app.querySelector('form input[type="password"]') !== null;
      if (${JSON.stringify(expect)} === 'tabs') {
        return tabs > 0 ? 'ready' : (signedOut ? 'signed-out' : 'loading');
      }
      if (app.textContent.trim() === '') return 'loading';
      return signedOut ? 'signed-out' : 'ready';
    `,
    )
    if (last === 'ready') return 'ready'
    await sleep(250)
  }
  const seen = await session
    .run(
      context,
      `
      const app = document.querySelector('#app');
      return JSON.stringify({
        url: location.href,
        ready: document.readyState,
        scripts: document.querySelectorAll('script').length,
        appChars: app ? app.textContent.trim().length : -1,
      });
    `,
    )
    .catch((error) => `the page could not be read: ${error.message}`)
  throw new Error(
    `the ${expect} screen never appeared (last state: ${last}; ${seen})`,
  )
}

async function clickTab(session, context, pattern, wait = 1200) {
  await settle(session, context, 'tabs')
  await session.run(
    context,
    `
    const tabs = [...document.querySelectorAll('[role=tab]')];
    const tab = tabs.find((el) => new RegExp(${JSON.stringify(pattern)}).test(el.textContent.trim()));
    if (!tab) throw new Error(
      'no tab matching ${pattern}; found: ' + tabs.map((el) => el.textContent.trim()).join(' / '),
    );
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, ${wait}));
    return true;
  `,
  )
}

async function clickTabByIndex(session, context, index, wait = 1200) {
  // Ensure tabs exist
  const count = await session.run(context, `return document.querySelectorAll('[role=tab]').length`)
  if (count <= index) {
    throw new Error(`not enough tabs (need index ${index}, have ${count})`)
  }
  await session.run(
    context,
    `
    const tabs = [...document.querySelectorAll('[role=tab]')];
    if (tabs.length <= ${index}) throw new Error('not enough tabs');
    tabs[${index}].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, ${wait}));
    return true;
  `,
  )
}

async function layoutSweep(session, fixtures) {
  const roles = [
    { name: 'admin', token: fixtures.admin, tabs: [/^Users$/, /^System/, /^Server$/] },
    { name: 'teacher', token: fixtures.teacher, tabs: [/^Live$/, /^Tests$/, /^Courses$/, /^Classes$/] },
    { name: 'student', token: fixtures.student, tabs: [] },
  ]

  // One tab for the whole sweep: every extra tab keeps a WebSocket open, and a
  // screen that waits on its own data is slower for every tab behind it.
  const context = await session.page(WIDTHS[0])
  for (const role of roles) {
    for (const locale of LOCALES) {
      for (const width of WIDTHS) {
        await openApp(session, context, { token: role.token, locale, width })
        await settle(session, context, role.tabs.length > 0 ? 'tabs' : 'content')

        // Click tabs by index to avoid language mismatch in pattern matching
        for (let tabIndex = 0; tabIndex < role.tabs.length; tabIndex++) {
          await clickTabByIndex(session, context, tabIndex)
          await auditScreen(session, context, `${role.name}/${locale}/${width} tab${tabIndex}`)
        }
        if (role.tabs.length === 0) {
          await auditScreen(session, context, `${role.name}/${locale}/${width} home`)
        }
      }
    }
  }
  return context
}

async function happyPaths(session, fixtures, adminToken) {
  const context = await session.page(1100, 1000)

  // Teacher: with nothing configured, the tab has to say the QR is unreachable.
  await openApp(session, context, { token: fixtures.teacher, locale: 'en', width: 1100, height: 1000 })
  await settle(session, context, 'tabs')
  await clickTab(session, context, '^Live$')
  await openTheQr(session, context)

  const withoutAddress = await readAddressState(session, context)
  check('teacher: warns when no public address is set', withoutAddress.warning)
  await session.screenshot(context, join(SHOTS, 'teacher-live-no-address.png'))

  // Set one, and the warning has to disappear - that is 5.1 working.
  const settings = await api('/api/settings', { token: adminToken })
  const address = settings.suggestions[0] ?? 'http://10.0.0.7:3300'
  await api('/api/settings', {
    token: adminToken,
    method: 'PATCH',
    body: { publicBaseUrl: address },
  })

  await openApp(session, context, { token: fixtures.teacher, locale: 'en', width: 1100, height: 1000 })
  await settle(session, context, 'tabs')
  await clickTab(session, context, '^Live$')
  await openTheQr(session, context)

  const withAddress = await readAddressState(session, context)
  check(
    'teacher: the QR carries the configured address',
    !withAddress.warning && (withAddress.address ?? '').includes(address),
    `address line: ${withAddress.address}`,
  )
  await session.screenshot(context, join(SHOTS, 'teacher-live-with-address.png'))

  // Teacher: the class key is on screen.
  await clickTab(session, context, '^Classes$')
  const keyShown = await session.run(
    context,
    `
    const code = document.querySelector('code');
    return code ? code.textContent.trim() : null;
  `,
  )
  check(
    'teacher: the class key is shown',
    /^[A-HJ-NP-Z2-9]{6}$/.test(keyShown ?? ''),
    `got ${keyShown}`,
  )

  // Admin: the console receives lines, and the public address card is there.
  await openApp(session, context, { token: adminToken, locale: 'en', width: 1100, height: 1000 })
  await settle(session, context, 'tabs')
  await clickTab(session, context, '^Server$', 2500)
  const consoleState = await session.run(
    context,
    `
    const log = document.querySelector('[role=log]');
    return {
      lines: log ? log.querySelectorAll('p').length : 0,
      hasStatus: document.body.textContent.includes('Status'),
    };
  `,
  )
  check('admin: the console receives lines', consoleState.lines > 0, `${consoleState.lines} lines`)
  await session.screenshot(context, join(SHOTS, 'admin-server.png'))

  await clickTab(session, context, '^System')
  const hasAddressCard = await session.run(
    context,
    `return document.body.textContent.includes('Public address');`,
  )
  check('admin: the public address card is on the System tab', hasAddressCard)

  return context
}

/** Selects the running session and expands its QR, the way a teacher does. */
async function openTheQr(session, context) {
  await session.run(
    context,
    `
    const chip = [...document.querySelectorAll('button')].find((b) => /Browser check/.test(b.textContent));
    if (chip) chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1500));
    const qr = [...document.querySelectorAll('button')].find((b) => /Show QR code/.test(b.textContent.trim()));
    if (qr) qr.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
  `,
  )
}

/** The two things the Live tab says about the address, read as a pair. */
function readAddressState(session, context) {
  return session.run(
    context,
    `
    const warning = [...document.querySelectorAll('p')].find((p) => /cannot open this address/.test(p.textContent));
    const address = [...document.querySelectorAll('p')].find((p) => /Address in the QR code/.test(p.textContent));
    return {
      warning: !!warning,
      address: address ? address.textContent.replace(/\s+/g, ' ').trim() : null,
    };
  `,
  )
}

/** Student: the account created with a class key can sign in and see work. */
async function studentPath(session, fixtures, context) {
  await openApp(session, context, { token: fixtures.student, locale: 'uk', width: 390 })
  await settle(session, context, 'content')

  const home = await session.run(
    context,
    `
    const text = document.body.textContent;
    return {
      name: text.includes('Check Student'),
      keys: /\b(student|common|auth)\.[a-z]+\b/.test(text),
    };
  `,
  )
  check('student: signs in with the account the key created', home.name)
  check('student: no untranslated keys on the home screen', !home.keys)
  await session.screenshot(context, join(SHOTS, 'student-home.png'))
}


// ------------------------------------------------------------------- running

async function main() {
  console.log(`browser checks against ${BASE}`)
  try {
    await api('/api/health')
  } catch {
    console.log(`no server on ${BASE}. Start one with: pnpm dev:server`)
    process.exit(2)
  }

  mkdirSync(SHOTS, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'lantern-ff-'))
  let child = null
  let session = null
  // The open tab, so a failure can be photographed. A check that fails without a
  // picture is a puzzle; with one it is a bug report.
  let context = null
  // Seeding is inside the try on purpose: a fixture that fails halfway through
  // must still be torn down, or the next run starts on a database someone else's
  // leftovers polluted.
  let fixtures = null
  try {
    fixtures = await seed()
    console.log(
      `fixtures ready (teacher ${NAMES.teacher}, student ${NAMES.student}, key ${fixtures.key})`,
    )

    const port = await freePort()
    const launched = await Session.launch({ port, profile })
    child = launched.child
    session = await Session.open(launched.url)

    console.log('\nlayout: three roles, two languages, three widths')
    context = await layoutSweep(session, fixtures)

    console.log('\nhappy paths')
    await happyPaths(session, fixtures, fixtures.admin)
    await studentPath(session, fixtures, context)

    await session.close()
  } catch (error) {
    failures.push(`harness: ${error.message}`)
    console.log(`   FAIL  harness — ${error.message}`)
    if (context && session) {
      try {
        await session.screenshot(context, join(SHOTS, 'failure.png'))
        const seen = await session
          .run(
            context,
            `const app = document.querySelector('#app');
             return JSON.stringify({
               tabs: document.querySelectorAll('[role=tab]').length,
               url: location.href,
               ready: document.readyState,
               text: app ? app.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) : 'no #app',
             });`,
          )
          .catch((inner) => `could not read the page: ${inner.message}`)
        console.log(`   the page said: ${seen}`)
      } catch {
        // The tab may be gone already; the failure is reported either way.
      }
    }
  } finally {
    child?.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
    await cleanup()
  }

  console.log(`\nscreenshots: ${SHOTS}`)
  if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed:`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exit(1)
  }
  console.log('\nall checks passed')
}

main()