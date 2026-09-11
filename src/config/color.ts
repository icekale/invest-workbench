export type TColorToken = Record<string, string>;
export type TColorSeries = Record<string, TColorToken>;

// TODO: 中性色暂时固定 待tvision-color生成带色彩倾向的中性色
export const LIGHT_CHART_COLORS = {
  textColor: '#14212b',
  placeholderColor: '#5e6c76',
  borderColor: '#e6eaed',
  containerColor: '#ffffff',
};

export const DARK_CHART_COLORS = {
  textColor: '#e8eef0',
  placeholderColor: '#8da5aa',
  borderColor: '#2c4850',
  containerColor: '#162a34',
};

export type TChartColor = typeof LIGHT_CHART_COLORS;

export const DEFAULT_COLOR_OPTIONS = [
  '#0d706d', // 观澜墨绿 (主色)
  '#dfb56d', // 观澜金标 (导航与强调)
  '#3569bb', // 辅助深蓝 (股票资产)
  '#16815f', // A股绿 (跌/安全)
  '#b8433e', // A股红 (涨/超配)
  '#b8782d', // 预警琥珀
  '#5b45b0', // 观澜雅紫
  '#2a8f89', // 浅海青
  '#4a5c68', // 岩石灰
];

/**
 * 分类色序（饼图/图例用）：与 DEFAULT_COLOR_OPTIONS 是**同一批品牌色，只是换了个顺序**。
 * 饼图的颜色不承载涨跌语义，唯一的任务是「相邻排名别撞脸」，所以按 ΔE(Lab) 贪心重排：
 * 品牌色里有三个互相邻近的绿青（墨绿 #0d706d / A股绿 #16815f / 浅海青 #2a8f89），
 * 原序下「墨绿」与「浅海青」只差 ΔE=12（<15 已属肉眼难分），一个排第 1、一个排第 8 时
 * 就会被看成同一个颜色。重排把这三个绿青推到末位：前 5 名的两两最小 ΔE 从 20.4 提到 27.7。
 * 注意：整批色两两最小 ΔE 恒为 12（集合固有属性），所以第 9 名之后必然开始接近 ——
 * 那是「饼图切片太多」的问题，不是配色的问题。
 */
export const CATEGORICAL_COLOR_OPTIONS = [
  '#0d706d', // 观澜墨绿 (主色，固定头名)
  '#b8433e', // A股红
  '#5b45b0', // 观澜雅紫
  '#dfb56d', // 观澜金标
  '#3569bb', // 辅助深蓝
  '#b8782d', // 预警琥珀
  '#4a5c68', // 岩石灰
  '#16815f', // A股绿
  '#2a8f89', // 浅海青
];
