import { NextResponse } from 'next/server';
import { pickerPaths } from '@/lib/seo/equivalents';

/**
 * The language picker's options for one page, for pages the route registry does not list (guides
 * and comparisons). Public and the same for everyone, so the edge may keep it. Publication dates
 * decide which translations exist, hence the hour.
 */
export function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 300)
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  return NextResponse.json(pickerPaths(path), {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
