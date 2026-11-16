import { expect, it } from 'vitest';
import { mailingOriginMap } from './mailing-origin';

it('uses exact reviewed origins and translation groups without inferring intent from words', () => {
  expect(mailingOriginMap['/es/api-imagen-a-3d']).toBe('api');
  expect(mailingOriginMap['/shopify']).toBe('ecommerce');
  expect(mailingOriginMap['/fr/guides/modeles-3d-e-commerce']).toBe('ecommerce');
  expect(mailingOriginMap['/de/ratgeber/vintage-moebel-verkaufen']).toBe('furniture');
  expect(mailingOriginMap['/learn/glb-file']).toBe('formats');
  expect(mailingOriginMap['/learn/unreviewed-ecommerce-api']).toBeUndefined();
  expect(mailingOriginMap['/es/mcp/unknown']).toBeUndefined();
});
