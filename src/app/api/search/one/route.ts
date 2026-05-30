import { NextResponse } from 'next/server';

import {
  getAvailableApiSites,
  getCacheTime,
  hasAdultKeyword,
  isFamilyApiSite,
} from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

// 单片源搜索接口（仅搜索指定 resourceId）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const resourceId = searchParams.get('resourceId');

  if (!query || !resourceId) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { result: null, error: '缺少必要参数: q 或 resourceId' },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  }

  const apiSites = await getAvailableApiSites();

  try {
    // 根据 resourceId 查找对应的 API 站点
    const targetSite = apiSites.find((site) => site.key === resourceId);
    if (!targetSite) {
      return NextResponse.json(
        {
          error: `未找到指定的视频源: ${resourceId}`,
          result: null,
        },
        { status: 404 }
      );
    }

    if (!isFamilyApiSite(targetSite)) {
      return NextResponse.json(
        {
          error: `未找到指定的视频源: ${resourceId}`,
          result: null,
        },
        { status: 404 }
      );
    }

    const results = (await searchFromApi(targetSite, query)).filter(
      (r) =>
        !hasAdultKeyword([
          r.title,
          r.source_name,
          r.source_group,
          r.class,
          r.type_name,
          r.desc,
        ])
    );
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: '搜索失败',
        result: null,
      },
      { status: 500 }
    );
  }
}
