const { request } = require('../lib/api');

module.exports = {
  key: 'list_render_ids',
  noun: 'Render',
  display: {
    label: 'List Render IDs',
    description: 'Lists recent renders for the Render ID dropdown.',
    hidden: true,
  },
  operation: {
    type: 'polling',
    perform: async (z, bundle) => {
      const { renders } = await request(z, bundle, '/renders', { params: { limit: 100 } });
      return renders.map(({ id, name }) => ({ id, name: name || id }));
    },
    sample: { id: 'r_example', name: 'Chair' },
    outputFields: [
      { key: 'id', label: 'Render ID' },
      { key: 'name', label: 'Name' },
    ],
  },
};
