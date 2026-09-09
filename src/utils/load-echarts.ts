import type { ECharts } from 'echarts/core';

let core: typeof import('echarts/core') | null = null;

export async function loadEcharts(): Promise<typeof import('echarts/core')> {
  if (core) return core;
  const [echarts, { LineChart }, comps, { CanvasRenderer }] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  echarts.use([
    LineChart,
    comps.GridComponent,
    comps.TooltipComponent,
    comps.MarkLineComponent,
    comps.MarkAreaComponent,
    CanvasRenderer,
  ]);
  core = echarts;
  return echarts;
}

export type { ECharts };
