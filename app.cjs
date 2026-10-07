'use strict';
const report = require('./probe.cjs');
const { ApolloServer } = require('@apollo/server');

(async () => {
  const server = new ApolloServer({
    typeDefs: 'type Query { hello: String, book: Book } type Book { title: String }',
    resolvers: {
      Query: { hello: () => 'world', book: () => ({ title: 'CJS' }) },
      Book: { title: (book) => book.title },
    },
  });
  await server.start();
  const result = await server.executeOperation({ query: '{ hello book { title } }' });
  console.log('response:', JSON.stringify(result.body.singleResult.data));
  await server.stop();
  report(`CJS (${process.execArgv.join(' ')})`);
  process.exit(0);
})();
