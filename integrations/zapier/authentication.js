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
        'Use a short display name, not a domain, URL or API key. This labels your connection only, such as your team name. Manage connections on the [easyrender Connectors page](https://easyrender.ai/connectors).',
    },
  ],
  test: async (z, bundle) => {
    const label = bundle.authData.accountLabel?.trim() || '';
    const isUrl = /[a-z][a-z\d+.-]*:\/\/|^\/\//i.test(label);
    const isDomain = /(?:[\p{L}\d-]+\.)+[\p{L}]{2,}|\b(?:\d{1,3}\.){3}\d{1,3}\b/u.test(label);
    const hasApiKey = /\ber_/i.test(label);
    if (!label || isUrl || isDomain || hasApiKey)
      throw new z.errors.Error(
        'Use a short display name, not a domain, URL or API key.',
        'InvalidAccountLabel',
      );
    await request(z, bundle, '/credits');
    return { accountLabel: bundle.authData.accountLabel };
  },
  connectionLabel: '{{bundle.authData.accountLabel}}',
};
