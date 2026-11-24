const core = require('zapier-platform-core');
const { version } = require('./package.json');
const authentication = require('./authentication');
const createRender = require('./creates/create_render');
const getRender = require('./creates/get_render');
const listRenders = require('./creates/list_renders');
const getCredits = require('./creates/get_credits');
const modelReady = require('./triggers/model_ready');
const listRenderIds = require('./triggers/list_render_ids');

module.exports = {
  version,
  platformVersion: core.version,
  flags: { cleanInputData: false },
  authentication,
  creates: {
    [createRender.key]: createRender,
    [getRender.key]: getRender,
    [listRenders.key]: listRenders,
    [getCredits.key]: getCredits,
  },
  triggers: { [modelReady.key]: modelReady, [listRenderIds.key]: listRenderIds },
};
