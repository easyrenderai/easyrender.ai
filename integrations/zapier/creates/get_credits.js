const { request } = require('../lib/api');
module.exports = {
  key: 'get_credits',
  noun: 'Credit Quote',
  display: {
    label: 'Get Credits',
    description: 'Gets the current account balance and live quote.',
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
