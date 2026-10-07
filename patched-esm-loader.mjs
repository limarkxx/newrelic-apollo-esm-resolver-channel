// Same as newrelic/esm-loader.mjs, with the ESM wrapField entry pointed at the channel the resolve subscriber listens on.
import { register } from 'node:module';
import subscriptions from 'newrelic/lib/subscriber-configs.js';
import createSubscriberConfigs from 'newrelic/lib/subscribers/create-config.js';

const agentLoader = import.meta.resolve('newrelic/esm-loader.mjs');
const { instrumentations } = createSubscriberConfigs(subscriptions);
for (const entry of instrumentations) {
  if (
    entry.module.name === '@apollo/server' &&
    entry.module.filePath === 'dist/esm/utils/schemaInstrumentation.js'
  ) {
    entry.channelName = 'nr_resolve';
  }
}
register('@apm-js-collab/tracing-hooks/hook.mjs', agentLoader, { data: { instrumentations } });
register('import-in-the-middle/hook.mjs', agentLoader, { data: { exclude: [/@openai\/agents.*/] } });
