const { request, renderPath } = require('../lib/api');
const { renderInput, renderOutput, sample } = require('../lib/fields');
module.exports = {
  key: 'model_ready',
  noun: 'Model',
  display: {
    label: 'Model Ready',
    description:
      'Triggers when a selected render has a ready 3D model. Watches one render ID, not the whole account.',
  },
  operation: {
    type: 'polling',
    inputFields: renderInput,
    perform: async (z, bundle) => {
      const render = await request(z, bundle, renderPath(bundle.inputData.id));
      if (render.status === 'failed')
        throw new z.errors.Error(
          `Render ${render.id} failed. Inspect it in easyrender before retrying.`,
          'RenderFailed',
        );
      return render.status === 'ready' && render.hasModel === true ? [render] : [];
    },
    sample,
    outputFields: renderOutput,
  },
};
