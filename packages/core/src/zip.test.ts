import { describe, expect, it } from 'vitest';
import { crc32, zipStore } from './zip';

const text = (value: string) => new TextEncoder().encode(value);

// Reads the archive back the way an unzip tool does: the central directory, then each entry.
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: { name: string; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    const start = offset + 30 + view.getUint16(offset + 26, true);
    entries.push({ name, data: bytes.subarray(start, start + size), crc });
    at += 46 + nameLength;
  }
  return entries;
}

describe('zipStore', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('stores every file under its name, with a matching checksum', () => {
    const files = [
      { name: 'chair-front.jpg', data: text('front bytes') },
      { name: 'chair-back-left.jpg', data: new Uint8Array([0, 255, 1, 254]) },
      { name: 'ñandú.jpg', data: text('utf-8 names') },
    ];
    const entries = readZip(zipStore(files));
    expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
    for (const [index, entry] of entries.entries()) {
      expect([...entry.data]).toEqual([...(files[index] as (typeof files)[number]).data]);
      expect(entry.crc).toBe(crc32(entry.data));
    }
  });

  it('writes an empty archive', () => {
    expect(readZip(zipStore([]))).toEqual([]);
  });
});
