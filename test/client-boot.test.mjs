import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let registration
const ReactMock = {
  Component: class { constructor(props) { this.props = props; this.state = {}; } },
  createElement: () => null,
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
}
const sandbox = {
  window: { __ModuleLoader__: { load: (value) => { registration = value } } },
  console,
}
vm.runInNewContext(source, sandbox)

assert.equal(registration.id, 'dsh-api-price-board')
const plugin = registration.factory((name) => {
  assert.equal(name, 'react')
  return ReactMock
})
assert.equal(plugin.inject.length, 2)
assert.equal(plugin.inject[0], 'slots')
assert.equal(plugin.inject[1], 'locale')

const slots = []
const ctx = {
  effect: () => () => {},
  inject: (keys, callback) => {
    callback({ remote: { account: { getState: async () => ({ ok: true, value: { status: 'signed-out' } }) } } })
  },
  locale: {
    subscribe: () => () => {},
    getSnapshot: () => ({ active: 'zh-CN' }),
  },
  slots: {
    inject: (_slot, callback) => callback(),
    register: (options, component) => { slots.push({ options, component }) },
  },
}
plugin.apply(ctx)
assert.equal(slots.length, 1)
assert.equal(slots[0].options.id, 'api-price-board')
assert.equal(slots[0].options.name, 'conversation.session.header.utilities')
assert.equal(slots[0].options.order, -20)
assert.equal(typeof slots[0].component, 'function')
console.log('client boot test: passed')
