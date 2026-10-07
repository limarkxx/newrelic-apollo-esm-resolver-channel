'use strict';
// Counts the tracing-channel events the agent's instrumentation publishes for @apollo/server.
// The agent's ApolloResolveSubscriber listens on nr_resolve; ApolloSubscriber (request pipeline) on nr_processRequest.
const { tracingChannel } = require('node:diagnostics_channel');

const CHANNELS = ['nr_resolve', 'nr_processRequest'];
const EVENTS = ['start', 'end', 'asyncStart', 'asyncEnd', 'error'];
const counts = {};

for (const name of CHANNELS) {
  counts[name] = Object.fromEntries(EVENTS.map((e) => [e, 0]));
  const handlers = {};
  for (const event of EVENTS) {
    handlers[event] = (data) => {
      counts[name][event] += 1;
      if (name === 'nr_processRequest' && event === 'end' && data?.arguments?.[0]?.resolve) {
        counts[name].wrapFieldOnWrongChannel = (counts[name].wrapFieldOnWrongChannel ?? 0) + 1;
      }
    };
  }
  tracingChannel(`orchestrion:@apollo/server:${name}`).subscribe(handlers);
}

module.exports = function report(label) {
  console.log(`\n== ${label} ==`);
  for (const name of CHANNELS) {
    console.log(`orchestrion:@apollo/server:${name}`, JSON.stringify(counts[name]));
  }
};
