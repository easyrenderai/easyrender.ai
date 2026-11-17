import type {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { renderOutput } from './output';
import { apiRequest, renderIdPath } from './transport';

export class EasyrenderTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Easy Render | Photo to 3D Trigger',
    name: 'easyrenderTrigger',
    icon: { light: 'file:easyrender.svg', dark: 'file:easyrender.dark.svg' },
    group: ['trigger'],
    version: 1,
    subtitle: 'Model Ready',
    description: 'Wait for one 3D model, then output its images and viewer and download links',
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
          'Watch one fixed render ID until its model is ready. First create a preview, review its angle sheet, and start the 3D build in easyrender.',
        hint: 'Use Get Render for IDs from upstream workflow steps. This trigger starts a separate workflow and emits once per configured render.',
      },
      {
        displayName: 'Download Images',
        name: 'downloadImages',
        type: 'boolean',
        default: true,
        description:
          'Whether to download available preview and angle sheet images into the output Binary tab using your API key',
        hint: 'Open preview or sheet in Binary. Follow viewerUrl to inspect the model or glbUrl to download it. Export USDZ from the viewer.',
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
    const isManual = this.getMode() === 'manual';
    if (!isManual && state.lastReadyId === render.id) return null;
    const item = await renderOutput.call(
      this,
      render,
      this.getNodeParameter('downloadImages', true) as boolean,
    );
    if (!isManual) state.lastReadyId = render.id;
    return [[item]];
  }
}
