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
    const isUrl = label.includes('://') || label.startsWith('//');
    const hasDomain = label
      .split(/[^\p{L}\d.-]+/u)
      .some((token) =>
        token.split('.').some((part, index, parts) => parts[index - 1] && /^\p{L}{2}/u.test(part)),
      );
    const hasAddress = /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(label);
    const hasApiKey = /\ber_/i.test(label);
    if (!label || isUrl || hasDomain || hasAddress || hasApiKey)
      throw new z.errors.Error(
        'Use a short display name, not a domain, URL or API key.',
        'InvalidAccountLabel',
      );
    await request(z, bundle, '/credits');
    return { accountLabel: bundle.authData.accountLabel };
  },
  connectionLabel: '{{bundle.authData.accountLabel}}',
};
