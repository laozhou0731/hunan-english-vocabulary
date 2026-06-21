<script setup lang="ts">
import { computed } from 'vue';
import { use } from 'echarts/core';
import type { ComposeOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TitleComponent
} from 'echarts/components';
import VChart from 'vue-echarts';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { GridComponentOption, TooltipComponentOption, TitleComponentOption, LegendComponentOption } from 'echarts/components';
import type { OverviewStats } from '../types';

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent, TitleComponent, LegendComponent]);

type ECOption = ComposeOption<
  BarSeriesOption | LineSeriesOption | GridComponentOption | TooltipComponentOption | TitleComponentOption | LegendComponentOption
>;

const props = defineProps<{
  stats: OverviewStats | null;
}>();

const progressOption = computed<ECOption>(() => {
  const rows = props.stats?.progressSeries ?? [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 18, top: 26, bottom: 28 },
    xAxis: {
      type: 'category',
      axisLabel: { color: '#61707d' },
      data: rows.map((item) => item.planDate.slice(5))
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#61707d' },
      splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.08)' } }
    },
    series: [
      {
        name: '完成词数',
        type: 'bar',
        data: rows.map((item) => item.completed),
        barWidth: 18,
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: '#0071e3'
        }
      }
    ]
  };
});

const accuracyOption = computed<ECOption>(() => {
  const rows = props.stats?.accuracySeries ?? [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 18, top: 26, bottom: 28 },
    xAxis: {
      type: 'category',
      axisLabel: { color: '#61707d' },
      data: rows.map((item) => item.planDate.slice(5))
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#61707d', formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.08)' } }
    },
    series: [
      {
        name: '默写正确率',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: '#34c759' },
        itemStyle: { color: '#34c759' },
        areaStyle: { color: 'rgba(52, 199, 89, 0.16)' },
        data: rows.map((item) => item.accuracy ?? 0)
      }
    ]
  };
});
</script>

<template>
  <div class="charts-wrap">
    <section class="chart-card">
      <h3>每日完成量</h3>
      <VChart class="chart" :option="progressOption" autoresize />
    </section>
    <section class="chart-card">
      <h3>默写正确率趋势</h3>
      <VChart class="chart" :option="accuracyOption" autoresize />
    </section>
  </div>
</template>

<style scoped>
.charts-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 16px;
}

.chart-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 20px;
  padding: 12px;
  box-shadow: 0 14px 30px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
}

.chart-card h3 {
  margin: 4px 8px 8px;
  color: #1d232a;
  font-size: 15px;
}

.chart {
  height: 240px;
}

@media (max-width: 900px) {
  .charts-wrap {
    grid-template-columns: 1fr;
  }

  .chart {
    height: 220px;
  }
}

@media (max-width: 520px) {
  .chart-card {
    padding: 10px;
    border-radius: 16px;
  }

  .chart {
    height: 200px;
  }
}
</style>
