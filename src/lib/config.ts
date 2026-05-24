/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import { getStorage } from '@/lib/db';

import { AdminConfig } from './admin.types';
import runtimeConfig from './runtime';

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
  group?: string;
}

const FAMILY_SOURCE_GROUPS = new Set([
  '精選推薦',
  '大陸劇',
  '綜合影視',
  '電影',
  '電視劇',
  '短劇',
  '動漫',
]);

const ADULT_SOURCE_KEYWORDS = [
  '🔞',
  '🈲',
  '18禁',
  '18🈲',
  '成人',
  '情色',
  '色情',
  '激情',
  '户外激情',
  '戶外激情',
  '裸露',
  '露出',
  '偷拍',
  '偷情',
  '做爱',
  '做愛',
  '无套',
  '無套',
  '乱伦',
  '亂倫',
  '女同',
  '母亲',
  '母親',
  '公公',
  '儿媳',
  '兒媳',
  '淫',
  '爆乳',
  '巨乳',
  '奶子',
  '约炮',
  '約炮',
  '人妻',
  '少妇',
  '少婦',
  '番号',
  '番號',
  '无码',
  '無碼',
  '有码',
  '有碼',
  '女优',
  '女優',
  'av',
  'jav',
  'adult',
  'porn',
  'sex',
  'xmm',
  '小猫咪',
  '小貓咪',
];

interface ConfigFileStruct {
  cache_time?: number;
  api_site: {
    [key: string]: ApiSite;
  };
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

// 在模块加载时根据环境决定配置来源
let fileConfig: ConfigFileStruct;
let cachedConfig: AdminConfig;

async function initConfig() {
  if (cachedConfig) {
    return;
  }

  if (process.env.DOCKER_ENV === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const _require = eval('require') as NodeRequire;
    const fs = _require('fs') as typeof import('fs');
    const path = _require('path') as typeof import('path');

    const configPath = path.join(process.cwd(), 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    fileConfig = JSON.parse(raw) as ConfigFileStruct;
    console.log('load dynamic config success');
  } else {
    // 默认使用编译时生成的配置
    fileConfig = runtimeConfig as unknown as ConfigFileStruct;
  }
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType !== 'localstorage') {
    // 数据库存储，读取并补全管理员配置
    const storage = getStorage();

    try {
      // 尝试从数据库获取管理员配置
      let adminConfig: AdminConfig | null = null;
      if (storage && typeof (storage as any).getAdminConfig === 'function') {
        adminConfig = await (storage as any).getAdminConfig();
      }

      // 获取所有用户名，用于补全 Users
      let userNames: string[] = [];
      if (storage && typeof (storage as any).getAllUsers === 'function') {
        try {
          userNames = await (storage as any).getAllUsers();
        } catch (e) {
          console.error('获取用户列表失败:', e);
        }
      }

      // 从文件中获取源信息，用于补全源
      const apiSiteEntries = Object.entries(fileConfig.api_site);

      if (adminConfig) {
        // 补全 SourceConfig
        const existed = new Set(
          (adminConfig.SourceConfig || []).map((s) => s.key)
        );
        apiSiteEntries.forEach(([key, site]) => {
          if (!existed.has(key)) {
            adminConfig!.SourceConfig.push({
              key,
              name: site.name,
              api: site.api,
              detail: site.detail,
              from: 'config',
              disabled: false,
            });
          }
        });

        // 检查现有源是否在 fileConfig.api_site 中，如果不在则标记为 custom
        const apiSiteKeys = new Set(apiSiteEntries.map(([key]) => key));
        adminConfig.SourceConfig.forEach((source) => {
          if (!apiSiteKeys.has(source.key)) {
            source.from = 'custom';
          }
        });

        const existedUsers = new Set(
          (adminConfig.UserConfig.Users || []).map((u) => u.username)
        );
        userNames.forEach((uname) => {
          if (!existedUsers.has(uname)) {
            adminConfig!.UserConfig.Users.push({
              username: uname,
              role: 'user',
            });
          }
        });
        // 站长
        const ownerUser = process.env.USERNAME;
        if (ownerUser) {
          adminConfig!.UserConfig.Users = adminConfig!.UserConfig.Users.filter(
            (u) => u.username !== ownerUser
          );
          adminConfig!.UserConfig.Users.unshift({
            username: ownerUser,
            role: 'owner',
          });
        }
      } else {
        // 数据库中没有配置，创建新的管理员配置
        let allUsers = userNames.map((uname) => ({
          username: uname,
          role: 'user',
        }));
        const ownerUser = process.env.USERNAME;
        if (ownerUser) {
          allUsers = allUsers.filter((u) => u.username !== ownerUser);
          allUsers.unshift({
            username: ownerUser,
            role: 'owner',
          });
        }
        adminConfig = {
          SiteConfig: {
            SiteName: process.env.SITE_NAME || 'MoonTV',
            Announcement:
              process.env.ANNOUNCEMENT ||
              '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
            SearchDownstreamMaxPage:
              Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
            SiteInterfaceCacheTime: fileConfig.cache_time || 7200,
            ImageProxy: process.env.NEXT_PUBLIC_IMAGE_PROXY || '',
          },
          UserConfig: {
            AllowRegister: process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true',
            Users: allUsers as any,
          },
          SourceConfig: apiSiteEntries.map(([key, site]) => ({
            key,
            name: site.name,
            api: site.api,
            detail: site.detail,
            from: 'config',
            disabled: false,
          })),
        };
      }

      // 写回数据库（更新/创建）
      if (storage && typeof (storage as any).setAdminConfig === 'function') {
        await (storage as any).setAdminConfig(adminConfig);
      }

      // 更新缓存
      cachedConfig = adminConfig;
    } catch (err) {
      console.error('加载管理员配置失败:', err);
    }
  } else {
    // 本地存储直接使用文件配置
    cachedConfig = {
      SiteConfig: {
        SiteName: process.env.SITE_NAME || 'MoonTV',
        Announcement:
          process.env.ANNOUNCEMENT ||
          '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
        SearchDownstreamMaxPage:
          Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
        SiteInterfaceCacheTime: fileConfig.cache_time || 7200,
        ImageProxy: process.env.NEXT_PUBLIC_IMAGE_PROXY || '',
      },
      UserConfig: {
        AllowRegister: process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true',
        Users: [],
      },
      SourceConfig: Object.entries(fileConfig.api_site).map(([key, site]) => ({
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: 'config',
        disabled: false,
      })),
    } as AdminConfig;
  }
}

export async function getConfig(): Promise<AdminConfig> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (process.env.DOCKER_ENV === 'true' || storageType === 'localstorage') {
    await initConfig();
    return cachedConfig;
  }
  // 非 docker 环境且 DB 存储，直接读 db 配置
  const storage = getStorage();
  let adminConfig: AdminConfig | null = null;
  if (storage && typeof (storage as any).getAdminConfig === 'function') {
    adminConfig = await (storage as any).getAdminConfig();
  }
  if (adminConfig) {
    // 合并一些环境变量配置
    adminConfig.SiteConfig.SiteName = process.env.SITE_NAME || 'MoonTV';
    adminConfig.SiteConfig.Announcement =
      process.env.ANNOUNCEMENT ||
      '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';
    adminConfig.UserConfig.AllowRegister =
      process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true';
    adminConfig.SiteConfig.ImageProxy =
      process.env.NEXT_PUBLIC_IMAGE_PROXY || '';

    // 合并文件中的源信息
    fileConfig = runtimeConfig as unknown as ConfigFileStruct;
    const apiSiteEntries = Object.entries(fileConfig.api_site);
    const existed = new Set((adminConfig.SourceConfig || []).map((s) => s.key));
    apiSiteEntries.forEach(([key, site]) => {
      if (!existed.has(key)) {
        adminConfig!.SourceConfig.push({
          key,
          name: site.name,
          api: site.api,
          detail: site.detail,
          from: 'config',
          disabled: false,
        });
      }
    });

    // 检查现有源是否在 fileConfig.api_site 中，如果不在则标记为 custom
    const apiSiteKeys = new Set(apiSiteEntries.map(([key]) => key));
    adminConfig.SourceConfig.forEach((source) => {
      if (!apiSiteKeys.has(source.key)) {
        source.from = 'custom';
      }
    });
    cachedConfig = adminConfig;
  } else {
    // DB 无配置，执行一次初始化
    await initConfig();
  }
  return cachedConfig;
}

export async function resetConfig() {
  const storage = getStorage();
  // 获取所有用户名，用于补全 Users
  let userNames: string[] = [];
  if (storage && typeof (storage as any).getAllUsers === 'function') {
    try {
      userNames = await (storage as any).getAllUsers();
    } catch (e) {
      console.error('获取用户列表失败:', e);
    }
  }

  if (process.env.DOCKER_ENV === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const _require = eval('require') as NodeRequire;
    const fs = _require('fs') as typeof import('fs');
    const path = _require('path') as typeof import('path');

    const configPath = path.join(process.cwd(), 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    fileConfig = JSON.parse(raw) as ConfigFileStruct;
    console.log('load dynamic config success');
  } else {
    // 默认使用编译时生成的配置
    fileConfig = runtimeConfig as unknown as ConfigFileStruct;
  }

  // 从文件中获取源信息，用于补全源
  const apiSiteEntries = Object.entries(fileConfig.api_site);
  let allUsers = userNames.map((uname) => ({
    username: uname,
    role: 'user',
  }));
  const ownerUser = process.env.USERNAME;
  if (ownerUser) {
    allUsers = allUsers.filter((u) => u.username !== ownerUser);
    allUsers.unshift({
      username: ownerUser,
      role: 'owner',
    });
  }
  const adminConfig = {
    SiteConfig: {
      SiteName: process.env.SITE_NAME || 'MoonTV',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: fileConfig.cache_time || 7200,
      ImageProxy: process.env.NEXT_PUBLIC_IMAGE_PROXY || '',
    },
    UserConfig: {
      AllowRegister: process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true',
      Users: allUsers as any,
    },
    SourceConfig: apiSiteEntries.map(([key, site]) => ({
      key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      from: 'config',
      disabled: false,
    })),
  } as AdminConfig;

  if (storage && typeof (storage as any).setAdminConfig === 'function') {
    await (storage as any).setAdminConfig(adminConfig);
  }
  if (cachedConfig == null) {
    // serverless 环境，直接使用 adminConfig
    cachedConfig = adminConfig;
  }
  cachedConfig.SiteConfig = adminConfig.SiteConfig;
  cachedConfig.UserConfig = adminConfig.UserConfig;
  cachedConfig.SourceConfig = adminConfig.SourceConfig;
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

export async function getAvailableApiSites(): Promise<ApiSite[]> {
  const config = await getConfig();
  // 家庭區：只放行明確家庭分類，並排除成人關鍵字源。
  // 只允許目前 runtime/config.json 裡存在且非成人的 key；DB 舊資料不再放行
  const fileSites = (runtimeConfig as any)?.api_site || {};
  const allowedKeys = new Set(
    Object.entries(fileSites)
      .filter(([key, site]: [string, any]) => {
        return isFamilyApiSite({ ...site, key });
      })
      .map(([key]) => key)
  );
  return config.SourceConfig.filter((s) => {
    if (s.disabled) return false;
    if (!allowedKeys.has(s.key)) return false;
    return isFamilyApiSite({ ...fileSites[s.key], ...s });
  }).map((s) => ({
    key: s.key,
    name: s.name,
    api: s.api,
    detail: s.detail,
    group: (s as any).group || fileSites[s.key]?.group,
  }));
}

export function isFamilyApiSite(site: Partial<ApiSite>): boolean {
  const group = site.group || '';
  if (!FAMILY_SOURCE_GROUPS.has(group)) return false;

  return !hasAdultKeyword([
    site.key,
    site.name,
    site.group,
    site.api,
    site.detail,
  ]);
}

export function hasAdultKeyword(parts: unknown[]): boolean {
  const text = parts.filter(Boolean).join(' ').normalize('NFKC').toLowerCase();

  if (/18\s*[禁🈲]/u.test(text)) return true;
  return ADULT_SOURCE_KEYWORDS.some((keyword) =>
    text.includes(keyword.normalize('NFKC').toLowerCase())
  );
}
