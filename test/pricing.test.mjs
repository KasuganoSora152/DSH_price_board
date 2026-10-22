import assert from 'node:assert/strict'
import {
  formatBalance,
  formatCny,
  formatDuration,
  HOLIDAY_YEARS,
  isHoliday,
  isPeakParts,
  isWorkday,
  nextTransition,
  priceFor,
  resolveModel,
  serviceState,
  SERVICE_WAIVER_UNTIL_MS,
  statusAt,
} from '../src/pricing.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const at = (iso) => Date.parse(iso)
const iso = (ms) => new Date(ms).toISOString()

test('北京时间字段不依赖本机时区', () => {
  const parts = statusAt(at('2026-10-21T10:30:00+08:00')).parts
  assert.equal(parts.year, 2026)
  assert.equal(parts.month, 10)
  assert.equal(parts.day, 21)
  assert.equal(parts.weekday, 3)
  assert.equal(parts.minutes, 10 * 60 + 30)
})

test('工作日高峰窗口左闭右开', () => {
  assert.equal(statusAt(at('2026-10-21T08:59:59+08:00')).period, 'offpeak')
  assert.equal(statusAt(at('2026-10-21T09:00:00+08:00')).period, 'peak')
  assert.equal(statusAt(at('2026-10-21T11:59:59+08:00')).period, 'peak')
  assert.equal(statusAt(at('2026-10-21T12:00:00+08:00')).period, 'offpeak')
  assert.equal(statusAt(at('2026-10-21T13:59:59+08:00')).period, 'offpeak')
  assert.equal(statusAt(at('2026-10-21T14:00:00+08:00')).period, 'peak')
  assert.equal(statusAt(at('2026-10-21T17:59:59+08:00')).period, 'peak')
  assert.equal(statusAt(at('2026-10-21T18:00:00+08:00')).period, 'offpeak')
})

test('周末全天谷时', () => {
  assert.equal(statusAt(at('2026-10-24T10:00:00+08:00')).period, 'offpeak')
})

test('法定节假日全天谷时', () => {
  assert.equal(isHoliday(at('2026-10-01T10:00:00+08:00')), true)
  assert.equal(statusAt(at('2026-10-01T10:00:00+08:00')).period, 'offpeak')
  assert.equal(statusAt(at('2026-10-08T10:00:00+08:00')).period, 'peak')
})

test('早上谷时切换到 09:00', () => {
  const status = statusAt(at('2026-10-21T08:30:00+08:00'))
  assert.equal(status.nextPeriod, 'peak')
  assert.equal(iso(status.nextAt), '2026-10-21T01:00:00.000Z')
  assert.equal(status.msUntilSwitch, 30 * 60 * 1000)
})

test('午休谷时切换到 14:00', () => {
  const status = statusAt(at('2026-10-21T12:30:00+08:00'))
  assert.equal(status.nextPeriod, 'peak')
  assert.equal(iso(status.nextAt), '2026-10-21T06:00:00.000Z')
})

test('晚间谷时切换到下一个工作日 09:00', () => {
  const status = statusAt(at('2026-10-21T18:30:00+08:00'))
  assert.equal(status.nextPeriod, 'peak')
  assert.equal(iso(status.nextAt), '2026-10-22T01:00:00.000Z')
})

test('周五晚间跨周末到周一 09:00', () => {
  const status = statusAt(at('2026-10-23T18:30:00+08:00'))
  assert.equal(iso(status.nextAt), '2026-10-26T01:00:00.000Z')
})

test('节假日结束后回到工作日 09:00', () => {
  const status = statusAt(at('2026-10-01T10:00:00+08:00'))
  assert.equal(iso(status.nextAt), '2026-10-08T01:00:00.000Z')
})

test('高峰结束切到谷时', () => {
  const status = statusAt(at('2026-10-21T10:30:00+08:00'))
  assert.equal(status.nextPeriod, 'offpeak')
  assert.equal(iso(status.nextAt), '2026-10-21T04:00:00.000Z')
})

test('Flash 峰谷三价', () => {
  const flash = resolveModel({ provider: 'deepseek-official', model: 'deepseek-flash' })
  assert.equal(flash.status, 'known')
  assert.deepEqual(priceFor(flash.info, 'peak'), {
    cacheHit: 0.04, cacheMiss: 2, output: 8, multiplier: 1,
  })
  assert.deepEqual(priceFor(flash.info, 'offpeak'), {
    cacheHit: 0.02, cacheMiss: 1, output: 4, multiplier: 0.5,
  })
})

test('Pro 峰谷三价', () => {
  const pro = resolveModel({ provider: 'deepseek-official', model: 'deepseek-v4-pro' })
  assert.equal(pro.status, 'known')
  assert.deepEqual(priceFor(pro.info, 'peak'), {
    cacheHit: 0.3, cacheMiss: 9, output: 27, multiplier: 1,
  })
  assert.deepEqual(priceFor(pro.info, 'offpeak'), {
    cacheHit: 0.15, cacheMiss: 4.5, output: 13.5, multiplier: 0.5,
  })
})

test('旧 Flash 模型名归一化', () => {
  for (const model of ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4.1-flash']) {
    const resolved = resolveModel({ provider: 'deepseek-official', model })
    assert.equal(resolved.status, 'known')
    assert.equal(resolved.model, 'deepseek-flash')
  }
})

test('modelSelection 的 next / lastUsed 都能解析', () => {
  const next = resolveModel({ next: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' } })
  assert.equal(next.status, 'known')
  assert.equal(next.effort, 'high')
  const last = resolveModel({ lastUsed: { provider: 'deepseek-account', model: 'deepseek-v4-pro' } })
  assert.equal(last.status, 'known')
  assert.equal(last.model, 'deepseek-v4-pro')
})

test('兼容包一层的 projection 形状', () => {
  const wrapped = resolveModel({ value: { provider: 'deepseek-official', model: 'deepseek-flash' } })
  assert.equal(wrapped.status, 'known')
  assert.equal(wrapped.model, 'deepseek-flash')
  assert.equal(resolveModel({}).status, 'missing')
})

test('未知模型和非 DeepSeek provider 不猜价格', () => {
  assert.equal(resolveModel({ provider: 'deepseek-official', model: 'deepseek-v9-unknown' }).status, 'unknown')
  assert.equal(resolveModel({ provider: 'openrouter', model: 'deepseek-v4-pro' }).status, 'provider')
  assert.equal(resolveModel(undefined).status, 'missing')
})

test('搜索/抓取免费期边界', () => {
  assert.equal(serviceState(at('2026-10-31T23:59:59+08:00')).free, true)
  assert.equal(serviceState(at('2026-11-01T00:00:00+08:00')).free, false)
  assert.equal(serviceState(at('2026-10-21T00:00:00+08:00')).listPrice, 5)
  assert.equal(serviceState(at('2026-10-21T00:00:00+08:00')).until, SERVICE_WAIVER_UNTIL_MS)
})

test('金额与倒计时格式', () => {
  assert.equal(formatCny(0.04), '¥0.04')
  assert.equal(formatCny(4.5), '¥4.50')
  assert.equal(formatBalance('0.004'), '<¥0.01')
  assert.equal(formatBalance('15.5'), '¥15.50')
  assert.equal(formatBalance('15.5', '$'), '$15.50')
  assert.equal(formatDuration(90 * 60 * 1000), '1小时 30分')
  assert.equal(formatDuration(26 * 60 * 60 * 1000), '1天 2小时')
  assert.equal(formatDuration(45 * 1000), '1分')
})

test('2026 节假日覆盖', () => {
  assert.deepEqual(HOLIDAY_YEARS, [2026])
  assert.equal(isWorkday(statusAt(at('2026-10-21T10:00:00+08:00')).parts), true)
  assert.equal(isWorkday(statusAt(at('2026-10-01T10:00:00+08:00')).parts), false)
  assert.equal(isPeakParts(statusAt(at('2026-10-01T10:00:00+08:00')).parts), false)
})

test('nextTransition 返回值与 statusAt 一致', () => {
  const now = at('2026-10-21T08:30:00+08:00')
  assert.equal(nextTransition(now).at, statusAt(now).nextAt)
  assert.equal(nextTransition(now).nextPeriod, statusAt(now).nextPeriod)
})

console.log(`pricing tests: ${passed} passed`)
