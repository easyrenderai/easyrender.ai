const { request } = require('./lib/api');
module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText:
        'Create an er_ API key on the [easyrender Connectors page](https://easyrender.ai/connectors). Enable read and write scopes.',
    },
    {
      key: 'accountLabel',
      label: 'Account Label',
      type: 'string',
      required: true,
      helpText:
        'A recognizable label for your easyrender account, such as your team name. Do not enter your API key here.',
    },
  ],
  test: async (z, bundle) => {
    await request(z, bundle, '/credits');
    return { accountLabel: bundle.authData.accountLabel };
  },
  connectionLabel: '{{bundle.authData.accountLabel}}',
};
