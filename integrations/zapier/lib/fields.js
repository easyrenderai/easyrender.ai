const renderInput = [
  {
    key: 'id',
    label: 'Render ID',
    type: 'string',
    required: true,
    dynamic: 'list_render_ids.id.name',
    helpText:
      'Choose a recent render or enter a custom ID returned by Create Render or shown in easyrender.',
  },
];
const renderOutput = [
  { key: 'id', label: 'Render ID' },
  { key: 'status', label: 'Status' },
  { key: 'name', label: 'Name' },
  { key: 'hasModel', label: 'Has Model', type: 'boolean' },
  { key: 'hasPreview', label: 'Has Preview', type: 'boolean' },
  { key: 'isPublic', label: 'Is Public', type: 'boolean' },
  { key: 'createdAt', label: 'Created At', type: 'datetime' },
];
const sample = {
  id: 'r_example',
  status: 'ready',
  name: 'Chair',
  hasModel: true,
  hasPreview: true,
  isPublic: false,
  createdAt: '2026-11-16T09:00:00Z',
};
module.exports = { renderInput, renderOutput, sample };
