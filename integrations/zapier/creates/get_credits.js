const { request } = require('../lib/api');
module.exports = {
  key: 'get_credits',
  noun: 'Credit Quote',
  display: {
    label: 'Get Credits',
    description: 'Returns account usage information.',
  },
  operation: {
    perform: (z, bundle) => request(z, bundle, '/credits'),
    sample: { balance: 0, currency: 'eur' },
    outputFields: [
      { key: 'balance', label: 'Balance', type: 'integer' },
      { key: 'currency', label: 'Currency' },
    ],
  },
};
