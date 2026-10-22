window.__ModuleLoader__.load({
  id: 'dsh-api-price-board',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // __PRICING__

    const CLIENT_VERSION = '0.1.0';
    const SLOT = 'conversation.session.header.utilities';
    const TICK_MS = 15_000;
    const PANEL_WIDTH = 336;

    const COPY = {
      zh: {
        peak: '高峰时段',
        offpeak: '空闲时段',
        toPeak: '距峰时',
        toOffpeak: '距谷时',
        prices: '价格',
        unit: '元 / 百万 tokens',
        cacheMiss: '输入 · 未命中',
        cacheHit: '输入 · 命中',
        output: '输出',
        searchFetch: 'Search / Fetch',
        perThousand: '各 ¥5 / 千次成功',
        freeUntil: 'DSH 内当前免费，11 月 1 日起收费',
        freeEnded: '按成功请求计费',
        balance: '账户余额',
        topUp: '充值',
        bonus: '赠金',
        refresh: '刷新',
        refreshing: '刷新中…',
        updated: '更新于',
        login: '登录后查看余额',
        balanceFailed: '暂时读不到余额',
        balanceStale: '刷新失败，显示上次结果',
        balanceLoading: '读取中…',
        modelMissing: '等待模型选择',
        modelUnknown: '当前模型未收录价格',
        reasoning: '推理',
        defaultReasoning: '默认推理',
        period: '时段',
        high: '高峰',
        off: '空闲',
      },
      en: {
        peak: 'Peak',
        offpeak: 'Off-peak',
        toPeak: 'Peak in',
        toOffpeak: 'Off-peak in',
        prices: 'Price',
        unit: 'CNY / 1M tokens',
        cacheMiss: 'Input · cache miss',
        cacheHit: 'Input · cache hit',
        output: 'Output',
        searchFetch: 'Search / Fetch',
        perThousand: '¥5 each / 1,000 successful',
        freeUntil: 'Free in DSH until Nov 1, billed after',
        freeEnded: 'Billed per successful request',
        balance: 'Account balance',
        topUp: 'Topped-up',
        bonus: 'Granted',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        updated: 'Updated',
        login: 'Sign in to view balance',
        balanceFailed: 'Balance temporarily unavailable',
        balanceStale: 'Refresh failed; showing the last reading',
        balanceLoading: 'Loading…',
        modelMissing: 'Waiting for model selection',
        modelUnknown: 'No price for this model',
        reasoning: 'reasoning',
        defaultReasoning: 'default reasoning',
        period: 'Period',
        high: 'Peak',
        off: 'Off-peak',
      },
    };

    function langOf(locale) {
      return String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh';
    }

    function useNow() {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(timer);
      }, []);
      return now;
    }

    function useStoreValue(store) {
      const [value, setValue] = React.useState(() => store.getSnapshot());
      React.useEffect(() => {
        const update = () => setValue(store.getSnapshot());
        update();
        return store.subscribe(update);
      }, [store]);
      return value;
    }

    function periodColor(period) {
      return period === 'peak'
        ? 'var(--dsw-alias-state-error-primary)'
        : 'var(--dsw-alias-state-success-primary)';
    }

    function periodText(status, t) {
      return status.period === 'peak' ? t('peak') : t('offpeak');
    }

    function countdownText(status, t) {
      const target = status.nextPeriod === 'peak' ? t('toPeak') : t('toOffpeak');
      return `${target} ${formatDuration(status.msUntilSwitch)}`;
    }

    function labelStyle(extra) {
      return Object.assign({
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        lineHeight: '18px',
      }, extra);
    }

    function valueStyle(extra) {
      return Object.assign({
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        lineHeight: '18px',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }, extra);
    }

    function PriceTable({ info, status, t }) {
      const peak = priceFor(info, 'peak');
      const off = priceFor(info, 'offpeak');
      return h('div', null, [
        h('div', {
          key: 'unit',
          style: {
            color: 'var(--dsw-alias-label-tertiary)',
            fontSize: 10,
            lineHeight: '14px',
            textAlign: 'right',
            marginTop: 6,
          },
        }, t('unit')),
        h('table', {
          key: 'table',
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            marginTop: 2,
          },
        }, [
          h('thead', { key: 'head' }, h('tr', null, [
            h('th', { key: 'label', style: labelStyle({ textAlign: 'left', fontWeight: 400, padding: '0 0 4px' }) }, t('prices')),
            h('th', {
              key: 'peak',
              style: labelStyle({
                textAlign: 'right',
                fontWeight: status.period === 'peak' ? 600 : 400,
                color: status.period === 'peak' ? periodColor('peak') : 'var(--dsw-alias-label-tertiary)',
                padding: '0 0 4px 8px',
              }),
            }, t('high')),
            h('th', {
              key: 'off',
              style: labelStyle({
                textAlign: 'right',
                fontWeight: status.period === 'offpeak' ? 600 : 400,
                color: status.period === 'offpeak' ? periodColor('offpeak') : 'var(--dsw-alias-label-tertiary)',
                padding: '0 0 4px 8px',
              }),
            }, t('off')),
          ])),
          h('tbody', { key: 'body' }, [
            rowTriple('cacheHit', t('cacheHit'), peak.cacheHit, off.cacheHit, status.period === 'peak'),
            rowTriple('cacheMiss', t('cacheMiss'), peak.cacheMiss, off.cacheMiss, status.period === 'peak'),
            rowTriple('output', t('output'), peak.output, off.output, status.period === 'peak'),
          ]),
        ]),
      ]);
    }

    function rowTriple(key, label, peakValue, offValue, peakCurrent) {
      const border = '0.5px solid var(--dsw-alias-border-l1)';
      return h('tr', { key }, [
        h('td', { key: 'label', style: labelStyle({ padding: '4px 8px 4px 0', borderBottom: border }) }, label),
        h('td', {
          key: 'peak',
          style: valueStyle({
            padding: '4px 6px',
            borderBottom: border,
            fontWeight: peakCurrent ? 600 : 400,
            background: peakCurrent ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            borderRadius: peakCurrent ? 4 : 0,
          }),
        }, formatCny(peakValue)),
        h('td', {
          key: 'off',
          style: valueStyle({
            padding: '4px 0 4px 6px',
            borderBottom: border,
            fontWeight: peakCurrent ? 400 : 600,
            background: peakCurrent ? 'transparent' : 'var(--dsw-alias-bg-layer-2)',
            borderRadius: peakCurrent ? 0 : 4,
          }),
        }, formatCny(offValue)),
      ]);
    }

    function modelLine(resolved, t) {
      if (resolved.status === 'known') {
        const effort = resolved.effort !== undefined
          ? `${t('reasoning')} ${resolved.effort}`
          : t('defaultReasoning');
        return `${resolved.label} · ${effort}`;
      }
      if (resolved.status === 'unknown') return t('modelUnknown');
      return t('modelMissing');
    }

    function Section({ children, first }) {
      return h('div', {
        style: {
          marginTop: first ? 0 : 10,
          paddingTop: first ? 0 : 10,
          borderTop: first ? 'none' : '0.5px solid var(--dsw-alias-border-l1)',
        },
      }, children);
    }

    function BalancedSection({ snapshot, onRefresh, t }) {
      if (snapshot.phase === 'unavailable') return null;
      const ready = snapshot.phase === 'ready';
      const hasData = ready || (snapshot.phase === 'failed' && snapshot.fetchedAt !== null);
      const totalSummary = hasData ? walletSummary(snapshot.wallets) : undefined;
      const bonusSummary = hasData ? walletSummary(snapshot.bonusWallets) : undefined;
      const total = totalSummary?.total;
      const bonus = bonusSummary?.total ?? 0;
      const symbol = totalSummary?.symbol ?? bonusSummary?.symbol ?? '¥';
      const topped = total !== undefined ? total - bonus : undefined;
      const canRefresh = snapshot.phase !== 'signed-out';
      const state = snapshot.phase === 'signed-out'
        ? t('login')
        : snapshot.phase === 'failed'
          ? (hasData ? t('balanceStale') : t('balanceFailed'))
          : snapshot.phase === 'loading' || snapshot.phase === 'idle'
            ? t('balanceLoading')
            : null;
      const updated = snapshot.fetchedAt === null
        ? null
        : `${t('updated')} ${new Intl.DateTimeFormat(langOf(snapshot.locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(snapshot.fetchedAt))}`;

      return h('div', null, [
        h('div', {
          key: 'head',
          style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
        }, [
          h('span', { key: 'title', style: labelStyle({ color: 'var(--dsw-alias-label-tertiary)' }) }, t('balance')),
          h('span', { key: 'actions', style: { display: 'flex', alignItems: 'baseline', gap: 8 } }, [
            hasData && total !== undefined
              ? h('span', { key: 'total', style: valueStyle({ fontSize: 14, fontWeight: 600 }) }, formatBalance(total, symbol))
              : null,
            canRefresh
              ? h('button', {
                key: 'refresh',
                type: 'button',
                onClick: onRefresh,
                disabled: snapshot.busy,
                style: {
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-tertiary)',
                  font: 'inherit',
                  fontSize: 11,
                  cursor: snapshot.busy ? 'default' : 'pointer',
                  padding: '2px 0',
                },
              }, snapshot.busy ? t('refreshing') : t('refresh'))
              : null,
          ]),
        ]),
        hasData && total !== undefined
          ? h('div', {
            key: 'breakdown',
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2px 10px',
              marginTop: 4,
              color: 'var(--dsw-alias-label-tertiary)',
              fontSize: 11,
              lineHeight: '16px',
            },
          }, [
            h('span', { key: 'topped' }, `${t('topUp')} ${formatBalance(topped ?? 0, symbol)}`),
            bonus > 0 ? h('span', { key: 'bonus' }, `${t('bonus')} ${formatBalance(bonus, symbol)}`) : null,
            updated === null ? null : h('span', { key: 'updated' }, updated),
          ])
          : state === null ? null : h('div', {
            key: 'state',
            style: {
              marginTop: 4,
              color: 'var(--dsw-alias-label-tertiary)',
              fontSize: 11,
              lineHeight: '16px',
            },
          }, state),
      ]);
    }

    function walletSummary(wallets) {
      if (!Array.isArray(wallets) || wallets.length === 0) return { total: 0, symbol: '¥' };
      const currency = wallets.some((wallet) => wallet?.currency === 'CNY')
        ? 'CNY'
        : wallets[0]?.currency;
      const list = currency === undefined
        ? wallets
        : wallets.filter((wallet) => wallet?.currency === currency);
      let total = 0;
      for (const wallet of list) {
        const amount = parseAmount(wallet?.balance);
        if (amount === undefined) return { total: undefined, symbol: currency === 'USD' ? '$' : '¥' };
        total += amount;
      }
      return { total, symbol: currency === 'USD' ? '$' : '¥' };
    }

    function PricePanel({ anchor, onClose, useProjection, useLocale, balance, refreshBalance }) {
      const now = useNow();
      const locale = typeof useLocale === 'function' ? useLocale() : 'zh-CN';
      const t = (key) => COPY[langOf(locale)][key] ?? COPY.zh[key] ?? key;
      const selection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
      const resolved = resolveModel(selection);
      const status = statusAt(now);
      const service = serviceState(now);
      const snapshot = useStoreValue(balance);
      const width = Math.min(PANEL_WIDTH, Math.max(280, window.innerWidth - 24));
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      const top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 120));

      React.useEffect(() => {
        const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
      }, [onClose]);

      React.useEffect(() => { refreshBalance(); }, []);

      return h('div', {
        role: 'dialog',
        'aria-label': t('prices'),
        style: {
          position: 'fixed',
          left,
          top,
          width,
          maxHeight: `calc(100vh - ${top + 8}px)`,
          overflowY: 'auto',
          boxSizing: 'border-box',
          zIndex: 1000,
          background: 'var(--dsw-alias-bg-overlay)',
          border: '0.5px solid var(--dsw-alias-border-l1)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
          padding: 12,
          color: 'var(--dsw-alias-label-secondary)',
          fontFamily: 'inherit',
          fontSize: 12,
          lineHeight: '18px',
        },
      }, [
        h('div', { key: 'head' }, [
          h('div', {
            key: 'row',
            style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
          }, [
            h('span', { key: 'period', style: { color: periodColor(status.period), fontSize: 13, fontWeight: 600 } }, periodText(status, t)),
            h('span', { key: 'countdown', style: labelStyle({ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }) }, countdownText(status, t)),
          ]),
          h('div', {
            key: 'model',
            style: labelStyle({ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, marginTop: 2 }),
          }, modelLine(resolved, t)),
        ]),
        resolved.status === 'known'
          ? h(Section, { key: 'prices' }, h(PriceTable, { info: resolved.info, status, t }))
          : null,
        h(Section, { key: 'services' }, [
          h('div', {
            key: 'row',
            style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
          }, [
            h('span', { key: 'label', style: labelStyle({ color: 'var(--dsw-alias-label-tertiary)' }) }, t('searchFetch')),
            h('span', { key: 'value', style: valueStyle({ fontSize: 12 }) }, t('perThousand')),
          ]),
          h('div', {
            key: 'state',
            style: {
              marginTop: 2,
              color: service.free ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)',
              fontSize: 11,
              lineHeight: '16px',
            },
          }, service.free ? t('freeUntil') : t('freeEnded')),
        ]),
        snapshot.phase === 'unavailable' ? null : h(Section, { key: 'balance' }, h(BalancedSection, {
          snapshot: { ...snapshot, locale },
          onRefresh: refreshBalance,
          t,
        })),
      ]);
    }

    function PriceBadge({ useProjection, useLocale, balance, refreshBalance }) {
      const now = useNow();
      const locale = typeof useLocale === 'function' ? useLocale() : 'zh-CN';
      const status = statusAt(now);
      const selection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
      const resolved = resolveModel(selection);
      const [open, setOpen] = React.useState(false);
      const [anchor, setAnchor] = React.useState({ left: 0, bottom: 0 });
      const buttonRef = React.useRef(null);
      const t = (key) => COPY[langOf(locale)][key] ?? COPY.zh[key] ?? key;

      const updateAnchor = React.useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect !== undefined) setAnchor({ left: rect.left, bottom: rect.bottom });
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        updateAnchor();
        const onResize = () => updateAnchor();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, [open, updateAnchor]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onMouseDown = (event) => {
          if (buttonRef.current?.contains(event.target)) return;
          const panel = document.querySelector('[data-api-price-board-panel="true"]');
          if (panel?.contains(event.target)) return;
          setOpen(false);
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
      }, [open]);

      if (resolved.status === 'provider') return null;

      const label = status.period === 'peak' ? '梁文峰' : '梁文谷';
      const color = periodColor(status.period);
      return h('div', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' } }, [
        h('button', {
          key: 'badge',
          ref: buttonRef,
          type: 'button',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': `${periodText(status, t)}，${t('prices')}`,
          onClick: () => { updateAnchor(); setOpen((value) => !value); },
          style: {
            border: 'none',
            background: 'transparent',
            color,
            font: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: '18px',
            padding: '2px 4px',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          },
        }, label),
        open ? h('div', { 'data-api-price-board-panel': 'true' }, h(PricePanel, {
          anchor,
          onClose: () => setOpen(false),
          useProjection,
          useLocale,
          balance,
          refreshBalance,
        })) : null,
      ]);
    }

    class BadgeBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false, message: '' };
      }
      static getDerivedStateFromError(error) {
        return { failed: true, message: error instanceof Error ? error.message : String(error) };
      }
      componentDidCatch(error) {
        console.error('api-price-board badge crashed', error);
      }
      render() {
        if (this.state.failed) {
          return h('span', {
            title: this.state.message,
            style: {
              color: 'var(--dsw-alias-label-tertiary)',
              fontSize: 11,
              lineHeight: '18px',
              padding: '2px 4px',
            },
          }, '价格牌');
        }
        return this.props.children;
      }
    }

    function BadgeShell(props) {
      return h(BadgeBoundary, null, h(PriceBadge, props));
    }

    function createBalanceStore() {
      let loader = null;
      let snapshot = {
        phase: 'unavailable',
        wallets: [],
        bonusWallets: [],
        fetchedAt: null,
        busy: false,
        stale: false,
      };
      let inFlight = null;
      let disposed = false;
      const listeners = new Set();
      const publish = (next) => {
        snapshot = next;
        for (const listener of listeners) listener();
      };
      const refresh = () => {
        if (disposed || loader === null) return Promise.resolve(snapshot);
        if (inFlight !== null) return inFlight;
        const previous = snapshot;
        publish({ ...previous, busy: true, phase: previous.fetchedAt !== null ? 'ready' : 'loading', stale: false });
        inFlight = Promise.resolve()
          .then(() => loader())
          .then((next) => {
            if (disposed) return;
            if (next.phase === 'ready') {
              publish({ ...next, busy: false, stale: false });
            } else if (next.phase === 'signed-out') {
              publish({ ...previous, ...next, busy: false, stale: false });
            } else {
              publish({
                ...previous,
                ...next,
                busy: false,
                phase: 'failed',
                stale: previous.fetchedAt !== null,
              });
            }
          })
          .catch(() => {
            if (disposed) return;
            publish({
              ...previous,
              busy: false,
              phase: 'failed',
              stale: previous.fetchedAt !== null,
            });
          })
          .finally(() => { inFlight = null; });
        return inFlight;
      };
      return {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot() { return snapshot; },
        attach(fn) {
          loader = fn;
          if (snapshot.phase === 'unavailable') publish({ ...snapshot, phase: 'idle' });
          // If the panel is already open when the optional account service
          // arrives, do the one read it would have done on mount.
          if (listeners.size > 0) void refresh();
        },
        detach() { loader = null; },
        refresh,
        dispose() {
          disposed = true;
          listeners.clear();
          inFlight = null;
        },
      };
    }

    function normalizeWallets(raw) {
      if (!Array.isArray(raw)) return [];
      return raw.filter((wallet) => wallet !== null && typeof wallet === 'object');
    }

    async function loadBalance(account, identity) {
      const state = await account.getState();
      if (state === null || typeof state !== 'object' || state.ok !== true) return { phase: 'failed' };
      if (state.value?.status !== 'credential-stored') return { phase: 'signed-out' };
      const result = await account.getBalance(identity);
      if (result === null || typeof result !== 'object' || result.ok !== true) return { phase: 'failed' };
      const value = result.value;
      if (value === null) return { phase: 'signed-out' };
      if (value.status !== 'ready') return { phase: 'failed' };
      return {
        phase: 'ready',
        wallets: normalizeWallets(value.value),
        bonusWallets: normalizeWallets(value.bonusWallets),
        fetchedAt: Date.now(),
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const balance = createBalanceStore();
        ctx.effect(() => () => balance.dispose(), 'api-price-board: balance lifetime');
        ctx.inject(['remote', 'remote.account'], (accountCtx) => {
          const account = accountCtx.remote.account;
          const identity = () => ({
            version: CLIENT_VERSION,
            locale: ctx.locale?.getSnapshot?.()?.active ?? 'zh-CN',
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
          });
          balance.attach(() => loadBalance(account, identity()));
          return () => balance.detach();
        });

        const useLocale = () => {
          const [locale, setLocale] = React.useState(() => ctx.locale?.getSnapshot?.()?.active ?? 'zh-CN');
          React.useEffect(() => {
            const update = () => setLocale(ctx.locale?.getSnapshot?.()?.active ?? 'zh-CN');
            update();
            return ctx.locale?.subscribe?.(update) ?? (() => {});
          }, []);
          return locale;
        };

        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: 'api-price-board',
          order: -20,
          inject: () => ({
            useLocale,
            balance,
            refreshBalance: () => balance.refresh(),
          }),
        }, BadgeShell));
      },
    };
  },
});
