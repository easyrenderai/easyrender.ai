const { request } = require('../lib/api');
const { renderOutput, sample } = require('../lib/fields');
module.exports = {
  key: 'create_render',
  noun: 'Render',
  display: {
    label: 'Create Render',
    description:
      'Creates a private free preview from an image URL. Start the 3D build separately in easyrender.',
  },
  operation: {
    inputFields: [
      {
        key: 'image_url',
        label: 'Image URL',
        type: 'string',
        required: true,
        helpText: 'Public HTTPS URL for a JPEG, PNG or WebP photo.',
      },
      {
        key: 'idempotency_key',
        label: 'Idempotency Key',
        type: 'string',
        required: true,
        helpText:
          'Map a stable unique source event ID. Reuse the same key and photo on retries; use a new key for a new intended preview.',
      },
      { key: 'name', label: 'Name', type: 'string', helpText: 'Up to 120 characters.' },
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'text',
        helpText: 'Product description, up to 500 characters.',
      },
    ],
    perform: async (z, bundle) => {
      const { image_url, idempotency_key, name, prompt } = bundle.inputData;
      if (!/^https:\/\//.test(image_url))
        throw new z.errors.Error('Image URL must use HTTPS.', 'InvalidInput');
      if (typeof idempotency_key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(idempotency_key))
        throw new z.errors.Error(
          'Idempotency key must be 1–128 printable ASCII characters without spaces.',
          'InvalidInput',
        );
      return request(z, bundle, '/renders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotency_key },
        body: {
          image_url,
          isPublic: false,
          ...(name ? { name } : {}),
          ...(prompt ? { prompt } : {}),
        },
      });
    },
    sample: { ...sample, status: 'drafting', hasModel: false, hasPreview: false },
    outputFields: renderOutput,
  },
};
