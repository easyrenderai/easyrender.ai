import type {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { apiRequest, renderIdPath } from './transport';

export class EasyrenderTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Easy Render | Photo to 3D Trigger',
    name: 'easyrenderTrigger',
    icon: { light: 'file:easyrender.svg', dark: 'file:easyrender.dark.svg' },
    group: ['trigger'],
    version: 1,
    subtitle: 'Model Ready',
    description: 'Turn any Product Photo into a 3D model',
    defaults: { name: 'Easy Render | Photo to 3D Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    polling: true,
    credentials: [{ name: 'easyrenderApi', required: true }],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        noDataExpression: true,
        default: 'modelReady',
        options: [{ name: 'Model Ready', value: 'modelReady' }],
      },
      {
        displayName: 'Render ID',
        name: 'renderId',
        type: 'string',
        default: '',
        required: true,
        description:
          'Watch this render until its model is ready. The build must be started separately in easyrender.',
      },
    ],
  };
  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const renderId = this.getNodeParameter('renderId') as string;
    const render = await apiRequest.call(this, 'GET', renderIdPath(renderId));
    if (render.status === 'failed')
      throw new NodeOperationError(
        this.getNode(),
        `Render ${renderId} failed. Inspect it in easyrender before retrying.`,
      );
    if (render.status !== 'ready' || render.hasModel !== true) return null;
    const state = this.getWorkflowStaticData('node');
    if (this.getMode() !== 'manual') {
      if (state.lastReadyId === render.id) return null;
      state.lastReadyId = render.id;
    }
    return [[{ json: render }]];
  }
}
