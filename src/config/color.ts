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
