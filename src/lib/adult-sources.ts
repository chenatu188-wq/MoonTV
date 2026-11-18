type AdultSource = {
  api: string;
  group?: string;
};

const normalizeApi = (api: string) =>
  api.trim().toLowerCase().replace(/\/+$/, '');

export function filterDedicatedAdultSources<T extends AdultSource>(
  sources: T[]
): T[] {
  const generalApis = new Set(
    sources
      .filter((source) => !(source.group || '').startsWith('🔞'))
      .map((source) => normalizeApi(source.api))
  );

  return sources.filter(
    (source) =>
      (source.group || '').startsWith('🔞') &&
      !generalApis.has(normalizeApi(source.api))
  );
}
