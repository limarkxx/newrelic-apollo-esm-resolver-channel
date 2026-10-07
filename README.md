# New Relic Node agent: Apollo Server resolver instrumentation never fires under ESM

Reproduction for `newrelic/node-newrelic`. With `@apollo/server` 4 loaded as an ES module
(`node --import newrelic/esm-loader.mjs -r newrelic`), the agent records operation segments and
`GraphQL/operation/ApolloServer/*` metrics but never a resolver segment or a
`GraphQL/resolve/ApolloServer/*` metric. The same app as CommonJS gets both.

## Cause

`lib/subscribers/apollo-server/config.js` registers the `wrapField` instrumentation twice, once
per build of `@apollo/server`. The CJS entry publishes on `nr_resolve`; the ESM entry publishes on
`nr_processRequest`:

```js
{
  path: './apollo-server/resolve.js',
  instrumentations: [
    { channelName: 'nr_resolve',         module: { name: '@apollo/server', filePath: 'dist/cjs/utils/schemaInstrumentation.js' }, functionQuery: { functionName: 'wrapField', kind: 'Sync' } },
    { channelName: 'nr_processRequest',  module: { name: '@apollo/server', filePath: 'dist/esm/utils/schemaInstrumentation.js' }, functionQuery: { functionName: 'wrapField', kind: 'Sync' } },
  ]
}
```

`ApolloResolveSubscriber` subscribes to `orchestrion:@apollo/server:nr_resolve` and wraps
`field.resolve` in its `end` handler. `ApolloSubscriber` (the request pipeline) subscribes to
`nr_processRequest` and only handles `asyncEnd`. Under ESM the `Sync` `wrapField` events reach the
request subscriber, which ignores them, so no resolver is ever wrapped.

Present in v14.0.0 (where the plugin was merged into the agent) through v14.6.0 and `main`.

## Run

```
npm install
npm run all
```

`npm run all` runs the same Apollo app three ways. `probe.cjs` subscribes to both channels and
prints the event counts after one query that resolves three fields (`hello`, `book`, `Book.title`).
A placeholder license key is set so the agent installs its instrumentation; it never connects.

| script | command | `nr_resolve` | `nr_processRequest` |
|---|---|---|---|
| `cjs` | `node -r newrelic app.cjs` | start 3, end 3 | start 1, end 1, asyncStart 1, asyncEnd 1 |
| `esm` | `node --import newrelic/esm-loader.mjs -r newrelic app.mjs` | **0** | start 4, end 4, asyncStart 1, asyncEnd 1 (3 of the `end` events carry a `wrapField` argument) |
| `esm:patched` | `node --import ./patched-esm-loader.mjs -r newrelic app.mjs` | start 3, end 3 | start 1, end 1, asyncStart 1, asyncEnd 1 |

Observed output (Node 24.21.0, newrelic 14.6.0, @apollo/server 4.13.0, graphql 16.14.2):

```
== CJS (-r newrelic) ==
orchestrion:@apollo/server:nr_resolve {"start":3,"end":3,"asyncStart":0,"asyncEnd":0,"error":0}
orchestrion:@apollo/server:nr_processRequest {"start":1,"end":1,"asyncStart":1,"asyncEnd":1,"error":0}

== ESM (--import newrelic/esm-loader.mjs -r newrelic) ==
orchestrion:@apollo/server:nr_resolve {"start":0,"end":0,"asyncStart":0,"asyncEnd":0,"error":0}
orchestrion:@apollo/server:nr_processRequest {"start":4,"end":4,"asyncStart":1,"asyncEnd":1,"error":0,"wrapFieldOnWrongChannel":3}

== ESM (--import ./patched-esm-loader.mjs -r newrelic) ==
orchestrion:@apollo/server:nr_resolve {"start":3,"end":3,"asyncStart":0,"asyncEnd":0,"error":0}
orchestrion:@apollo/server:nr_processRequest {"start":1,"end":1,"asyncStart":1,"asyncEnd":1,"error":0}
```

## Fix

Change the ESM `wrapField` entry's `channelName` to `'nr_resolve'`. `patched-esm-loader.mjs` is the
agent's own `esm-loader.mjs` with that one value corrected before the hooks are registered; it is
the workaround an application can ship until the agent is fixed.

## Seen in production

On a Vendor Gateway deployment (Node 24, ESM, newrelic 14.3.5), switching to the ESM loader
produced `GraphQL/operation/ApolloServer/*` metrics, operation spans and operation-named
transactions within minutes, and zero `GraphQL/resolve/ApolloServer/*` metrics or
`graphql.field.*` spans over the same window.
