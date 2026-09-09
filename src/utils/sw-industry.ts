/** 申万 2021 二级（及东财 f100 别名）→ 一级。 */
const L2: Record<string, string> = {};
function add(l1: string, l2: string[]) {
  for (const n of l2) L2[n] = l1;
}

add('农林牧渔', [
  '种植业',
  '种子',
  '粮食种植',
  '其他种植业',
  '渔业',
  '水产养殖',
  '林业',
  '饲料',
  '农产品加工',
  '养殖业',
  '畜禽养殖',
  '动物保健Ⅱ',
  '农业综合Ⅱ',
]);
add('基础化工', ['化学原料', '化学制品', '化学纤维', '塑料', '橡胶', '农化制品', '非金属材料Ⅱ']);
add('钢铁', ['冶钢原料', '普钢', '特钢Ⅱ']);
add('有色金属', ['金属新材料', '工业金属', '小金属', '贵金属', '能源金属']);
add('电子', ['半导体', '元件', '光学光电子', '其他电子Ⅱ', '消费电子', '电子化学品Ⅱ']);
add('汽车', ['汽车零部件', '汽车整车', '汽车服务', '摩托车及其他']);
add('家用电器', ['白色家电', '黑色家电', '小家电', '照明设备Ⅱ', '家电零部件Ⅱ']);
add('食品饮料', ['白酒Ⅱ', '白酒', '非白酒', '饮料乳品', '调味发酵品Ⅱ', '食品加工', '饮料制造']);
add('纺织服饰', ['纺织制造', '服装家纺', '饰品']);
add('轻工制造', ['造纸', '包装印刷', '家居用品', '文娱用品']);
add('医药生物', ['化学制药', '中药Ⅱ', '生物制品', '医药商业', '医疗器械', '医疗服务']);
add('公用事业', ['电力', '燃气Ⅱ']);
add('交通运输', ['物流', '铁路公路', '航空机场', '航运港口', '公交']);
add('房地产', ['房地产开发', '房地产服务']);
add('商贸零售', ['贸易Ⅱ', '一般零售', '专业连锁', '互联网电商', '旅游零售']);
add('社会服务', ['旅游及景区', '酒店餐饮', '教育', '专业服务', '体育Ⅱ']);
add('综合', ['综合Ⅱ']);
add('建筑材料', ['水泥', '玻璃玻纤', '装修建材']);
add('建筑装饰', ['房屋建设', '装修装饰Ⅱ', '基础建设', '专业工程', '工程咨询服务Ⅱ']);
add('电力设备', ['电机Ⅱ', '电气设备', '光伏设备', '风电设备', '电池', '电网设备', '其他电源设备Ⅱ']);
add('国防军工', ['航天装备Ⅱ', '航空装备Ⅱ', '地面兵装Ⅱ', '航海装备Ⅱ', '军工电子Ⅱ']);
add('计算机', ['计算机设备', '软件开发', 'IT服务Ⅱ']);
add('传媒', ['游戏Ⅱ', '广告营销', '影视院线', '数字媒体', '出版', '电视广播Ⅱ']);
add('通信', ['通信服务', '通信设备']);
add('银行', ['国有大型银行Ⅱ', '股份制银行Ⅱ', '城商行Ⅱ', '农商行Ⅱ', '银行Ⅱ']);
add('非银金融', ['证券Ⅱ', '保险Ⅱ', '多元金融']);
add('煤炭', ['煤炭开采', '焦炭Ⅱ']);
add('石油石化', ['油气开采Ⅱ', '油服工程', '炼化及贸易']);
add('环保', ['环境治理', '环保设备Ⅱ']);
add('美容护理', ['个护用品', '化妆品', '医疗美容']);
add('机械设备', ['通用设备', '专用设备', '轨交设备Ⅱ', '工程机械', '自动化设备']);

const L1 = new Set(Object.values(L2));

export function bareCode(code: string): string {
  return code.replace(/^(sh|sz|bj)/i, '');
}

export function swL1FromF100(name: string): string | undefined {
  const n = name.trim();
  if (!n || n === '-') return;
  if (L1.has(n)) return n;
  return L2[n];
}

export function toSecid(code: string): string | null {
  const m = code.toLowerCase().match(/^(sh|sz|bj)?(\d{6})$/);
  if (!m) return null;
  const id = m[2];
  const pre = m[1] || (id.startsWith('6') || id.startsWith('9') || id.startsWith('5') ? 'sh' : 'sz');
  return pre === 'sh' ? `1.${id}` : `0.${id}`;
}

export interface SwClass {
  l1: string;
  l2: string;
}

interface UlistRow {
  f12?: string;
  f100?: string;
}

const memo: Record<string, SwClass> = {};

export function swGroupOf(
  p: { code: string; tag?: string; name: string },
  sw: Record<string, SwClass>,
  level: 'l1' | 'l2',
): string {
  const c = sw[bareCode(p.code)];
  if (level === 'l2') return c?.l2 || p.tag || p.name;
  return c?.l1 || p.tag || p.name;
}

export async function fetchSwClass(codes: string[]): Promise<Record<string, SwClass>> {
  const ids = [...new Set(codes.map(toSecid).filter((x): x is string => !!x))];
  const miss = ids.filter((id) => !memo[id.slice(id.indexOf('.') + 1)]);
  for (let i = 0; i < miss.length; i += 80) {
    const q = miss.slice(i, i + 80).join(',');
    const res = await fetch(`/push2/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f100&secids=${q}`, {
      cache: 'no-store',
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: { diff?: UlistRow[] | Record<string, UlistRow> } };
    const diff = json.data?.diff;
    const rows = Array.isArray(diff) ? diff : diff ? Object.values(diff) : [];
    for (const r of rows) {
      const l2 = String(r.f100 || '').trim();
      const l1 = swL1FromF100(l2);
      if (r.f12 && l1) memo[r.f12] = { l1, l2 };
    }
  }
  const out: Record<string, SwClass> = {};
  for (const c of codes) {
    const b = bareCode(c);
    if (memo[b]) out[b] = memo[b];
  }
  return out;
}
