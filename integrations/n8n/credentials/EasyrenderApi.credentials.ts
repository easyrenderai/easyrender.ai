import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class EasyrenderApi implements ICredentialType {
  name = 'easyrenderApi';
  displayName = 'Easyrender API';
  documentationUrl = 'https://easyrender.ai/api';
  icon = {
    light: 'file:../nodes/Easyrender/easyrender.svg',
    dark: 'file:../nodes/Easyrender/easyrender.dark.svg',
  } as const;
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Create an er_ API key in easyrender Connectors with read and write scopes',
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
  };
  test: ICredentialTestRequest = {
    request: { baseURL: 'https://easyrender.ai/api', url: '/credits', method: 'GET' },
  };
}
