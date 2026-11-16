const { request } = require('../lib/api');
const { renderOutput, sample } = require('../lib/fields');
module.exports = {
  key: 'list_renders',
  noun: 'Render Page',
  display: {
    label: 'List Renders',
    description: 'Lists a page of renders with a cursor for the next page.',
  },
  operation: {
    inputFields: [
      {
        key: 'limit',
        label: 'Limit',
        type: 'integer',
        default: '25',
        helpText: 'Number of renders per page, from 1 to 100.',
      },
      {
        key: 'cursor',
        label: 'Cursor',
        type: 'string',
        helpText: 'The nextCursor from a previous page. Keep the same status filter.',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'string',
        choices: ['drafting', 'preview_ready', 'rendering', 'ready', 'failed'],
      },
    ],
    perform: (z, bundle) => {
      const { limit = 25, cursor, status } = bundle.inputData;
      if (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)
        throw new z.errors.Error('Limit must be an integer from 1 to 100.', 'InvalidInput');
      return request(z, bundle, '/renders', {
        params: { limit, ...(cursor ? { cursor } : {}), ...(status ? { status } : {}) },
      });
    },
    sample: { renders: [sample], nextCursor: 'opaque_next_page' },
    outputFields: [
      { key: 'renders', label: 'Renders', children: renderOutput },
      { key: 'nextCursor', label: 'Next Cursor' },
    ],
  },
};
