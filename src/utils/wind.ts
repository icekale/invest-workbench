/**
 * 万得 Wind AI FinMarket 客户端接口服务
 * 走 /wind/ 反向代理（服务端注入 API Key），支持 MCP 标准 JSON-RPC 调用。
 * 内置缓存机制，避免频繁重复调用消耗 API 额度。
 */

export interface WindMetricMeta {
  code: string;
  name: string;
  unit?: string;
  source?: string;
  updateDate?: string;
  freq?: string;
}

export interface WindMetric {
  code: string;
  name: string;
  unit: string;
  source: string;
  freq: string;
  updateDate: string;
  dates: string[];
  values: number[];
  latestValue: number | null;
  previousValue: number | null;
  change: number | null; // latest - previous
}

export interface WindNewsItem {
  title: string;
  date: string;
  content: string;
  relevance: number;
  url: string;
}

const CACHE_PREFIX = 'wind-cache-v1-';
const DEFAULT_TTL_MS = 6 * 3600 * 1000; // 6 小时缓存

function parseSseOrJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continue to SSE parse
    }
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      try {
        return JSON.parse(dataStr);
      } catch {
        // continue
      }
    }
  }
  throw new Error('未识别的万得接口响应格式');
}

/**
 * 通用 MCP 工具调用
 */
async function callWindMcp(serverType: string, toolName: string, args: Record<string, unknown>) {
  const endpoint = `/wind/vserver_${serverType}/mcp/`;
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`万得接口异常: HTTP ${res.status}`);
  }

  const text = await res.text();
  const payload = parseSseOrJson(text);

  if (payload.error) {
    const err = payload.error as { message?: string };
    throw new Error(err.message || '万得 MCP 接口调用失败');
  }

  const result = payload.result as {
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
  };

  if (!result || !Array.isArray(result.content) || !result.content.length) {
    throw new Error('万得未返回有效数据');
  }

  const innerText = result.content[0]?.text || '';
  if (result.isError) {
    throw new Error(innerText || '万得工具返回错误');
  }

  // 尝试解析内部 JSON
  try {
    return JSON.parse(innerText);
  } catch {
    return innerText;
  }
}

/**
 * 查询万得 EDB 宏观指标
 */
export async function fetchWindEdb(question: string, observation = 8, force = false): Promise<WindMetric[]> {
  const cacheKey = `${CACHE_PREFIX}edb-${question}-${observation}`;
  if (!force) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < DEFAULT_TTL_MS && Array.isArray(cached.data) && cached.data.length > 0) {
          return cached.data;
        }
      }
    } catch {
      // ignore
    }
  }

  const parsed = await callWindMcp('economic_data', 'query_economic_indicator_data', {
    question,
    observation,
  });

  if (typeof parsed === 'string') {
    throw new TypeError(parsed);
  }

  const metricsRaw = (parsed as { metrics?: Array<Record<string, unknown>> })?.metrics;
  if (!Array.isArray(metricsRaw)) {
    throw new TypeError('未获取到宏观指标时间序列');
  }

  const list: WindMetric[] = [];
  for (const m of metricsRaw) {
    const meta = (m.meta || {}) as WindMetricMeta;
    const rawDates = Array.isArray(m.date) ? m.date.map(String) : [];
    const rawValues = Array.isArray(m.value) ? m.value.map((v) => (typeof v === 'number' ? v : Number(v) || 0)) : [];

    if (!meta.code || !meta.name || !rawDates.length) continue;

    // 格式化日期 YYYYMMDD -> YYYY-MM-DD
    const dates = rawDates.map((d) => {
      if (d.length === 8) {
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
      return d;
    });

    const values = rawValues;
    const latestValue = values.length > 0 ? values[values.length - 1] : null;
    const previousValue = values.length > 1 ? values[values.length - 2] : null;
    const change =
      latestValue != null && previousValue != null ? Math.round((latestValue - previousValue) * 100) / 100 : null;

    list.push({
      code: meta.code,
      name: meta.name.replace(/^中国:/, ''),
      unit: meta.unit || '%',
      source: meta.source || '国家统计局/央行',
      freq: meta.freq || '月',
      updateDate: meta.updateDate || '',
      dates,
      values,
      latestValue,
      previousValue,
      change,
    });
  }

  if (list.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: list }));
    } catch {
      // storage quota
    }
  }

  return list;
}

/**
 * 检索万得权威宏观资讯 / 央行公报
 */
export async function fetchWindNews(query: string, topK = 4, force = false): Promise<WindNewsItem[]> {
  const cacheKey = `${CACHE_PREFIX}news-${query}-${topK}`;
  if (!force) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < DEFAULT_TTL_MS && Array.isArray(cached.data) && cached.data.length > 0) {
          return cached.data;
        }
      }
    } catch {
      // ignore
    }
  }

  const parsed = await callWindMcp('financial_docs', 'get_financial_news', {
    query,
    top_k: topK,
  });

  const itemsRaw = (parsed as { data?: { items?: Array<Record<string, unknown>> } })?.data?.items;
  if (!Array.isArray(itemsRaw)) {
    return [];
  }

  const list: WindNewsItem[] = itemsRaw.map((item) => ({
    title: String(item.title || ''),
    date: String(item.date || ''),
    content: String(item.content || '').replace(/\\n/g, '\n'),
    relevance: Number(item.relevance) || 0,
    url: String(item.url || ''),
  }));

  if (list.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: list }));
    } catch {
      // storage quota
    }
  }

  return list;
}
