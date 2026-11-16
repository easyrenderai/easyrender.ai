const { request, renderPath } = require('../lib/api');
const { renderInput, renderOutput, sample } = require('../lib/fields');
module.exports = {
  key: 'get_render',
  noun: 'Render',
  display: { label: 'Get Render', description: 'Gets a render and its current status by ID.' },
  operation: {
    inputFields: renderInput,
    perform: (z, bundle) => request(z, bundle, renderPath(bundle.inputData.id)),
    sample,
    outputFields: renderOutput,
  },
};
