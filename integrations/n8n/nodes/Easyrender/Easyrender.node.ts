import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { apiRequest, renderIdPath } from './transport';

export class Easyrender implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'easyrender',
    name: 'easyrender',
    icon: { light: 'file:easyrender.svg', dark: 'file:easyrender.dark.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Create previews and read easyrender models',
    usableAsTool: true,
    defaults: { name: 'easyrender' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'easyrenderApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'create',
        options: [
          {
            name: 'Create Render',
            value: 'create',
            description: 'Create a private free preview from an image URL',
            action: 'Create a render',
          },
          {
            name: 'Get Credits',
            value: 'credits',
            description: 'Get the live account balance and quote',
            action: 'Get credits',
          },
          {
            name: 'Get Render',
            value: 'get',
            description: 'Get a render and its current status',
            action: 'Get a render',
          },
          {
            name: 'List Renders',
            value: 'list',
            description: 'List one page of renders with its next cursor',
            action: 'List renders',
          },
        ],
      },
      {
        displayName: 'Image URL',
        name: 'imageUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['create'] } },
        description:
          'Public HTTPS JPEG, PNG or WebP URL. Creation starts a preview, not a paid 3D build.',
      },
      {
        displayName: 'Idempotency Key',
        name: 'idempotencyKey',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['create'] } },
        description:
          'Stable unique key for this photo and input. Reuse it on retries; use a new key for a new intended preview.',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        default: {},
        placeholder: 'Add Field',
        displayOptions: { show: { operation: ['create'] } },
        options: [
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
            description: 'Catalog name, up to 120 characters',
          },
          {
            displayName: 'Prompt',
            name: 'prompt',
            type: 'string',
            default: '',
            description: 'Product description, up to 500 characters',
          },
        ],
      },
      {
        displayName: 'Render ID',
        name: 'renderId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['get'] } },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        typeOptions: { minValue: 1, maxValue: 100 },
        displayOptions: { show: { operation: ['list'] } },
        description: 'Max number of results to return',
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        default: {},
        placeholder: 'Add Filter',
        displayOptions: { show: { operation: ['list'] } },
        options: [
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
            description: 'Opaque nextCursor from the previous page; retain the same status filter',
          },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            default: 'ready',
            options: [
              { name: 'Drafting', value: 'drafting' },
              { name: 'Failed', value: 'failed' },
              { name: 'Preview Ready', value: 'preview_ready' },
              { name: 'Ready', value: 'ready' },
              { name: 'Rendering', value: 'rendering' },
            ],
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const output: INodeExecutionData[] = [];
    for (let i = 0; i < this.getInputData().length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        let result: IDataObject;
        if (operation === 'create') {
          const key = this.getNodeParameter('idempotencyKey', i) as string;
          if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
            throw new NodeOperationError(
              this.getNode(),
              'Idempotency key must be 1–128 printable ASCII characters without spaces',
              { itemIndex: i },
            );
          const imageUrl = this.getNodeParameter('imageUrl', i) as string;
          if (!imageUrl.startsWith('https://'))
            throw new NodeOperationError(this.getNode(), 'Image URL must use HTTPS', {
              itemIndex: i,
            });
          const fields = this.getNodeParameter('additionalFields', i) as IDataObject;
          result = await apiRequest.call(
            this,
            'POST',
            '/renders',
            {
              image_url: imageUrl,
              isPublic: false,
              ...(fields.name ? { name: fields.name } : {}),
              ...(fields.prompt ? { prompt: fields.prompt } : {}),
            },
            {},
            { 'Idempotency-Key': key },
          );
        } else if (operation === 'get') {
          result = await apiRequest.call(
            this,
            'GET',
            renderIdPath(this.getNodeParameter('renderId', i) as string),
          );
        } else if (operation === 'list') {
          const filters = this.getNodeParameter('filters', i) as IDataObject;
          result = await apiRequest.call(this, 'GET', '/renders', undefined, {
            limit: this.getNodeParameter('limit', i) as number,
            ...filters,
          });
        } else if (operation === 'credits') {
          result = await apiRequest.call(this, 'GET', '/credits');
        } else {
          throw new NodeOperationError(this.getNode(), 'Unknown operation', { itemIndex: i });
        }
        output.push({ json: result, pairedItem: { item: i } });
      } catch (error) {
        if (!this.continueOnFail()) {
          if (error instanceof NodeOperationError)
            throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
          throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
        }
        output.push({
          json: { error: error instanceof Error ? error.message : 'Request failed' },
          pairedItem: { item: i },
        });
      }
    }
    return [output];
  }
}
