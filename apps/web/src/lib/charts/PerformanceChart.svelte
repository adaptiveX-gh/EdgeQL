<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart, { type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';
  import type { EquityPoint, Trade } from '$lib/api/types.js';

  export let equityCurve: EquityPoint[] = [];
  export let trades: Trade[] = [];
  export let height: string = '400px';
  export let title: string = 'Performance Chart';

  let canvas: HTMLCanvasElement;
  let chart: Chart;

  onMount(() => {
    if (equityCurve.length === 0) {
      // Create mock data for demonstration
      const now = new Date();
      const mockEquity: EquityPoint[] = [];
      
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(now.getTime() - (100 - i) * 24 * 60 * 60 * 1000);
        const value = 100000 + Math.random() * 20000 - 10000 + i * 200;
        const drawdown = Math.random() * -15;
        
        mockEquity.push({
          timestamp: timestamp.toISOString(),
          equity: value,
          drawdown: drawdown
        });
      }
      
      equityCurve = mockEquity;
    }

    createChart();
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  const createChart = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const equityData = equityCurve.map(point => ({
      x: new Date(point.timestamp),
      y: point.equity
    }));

    const drawdownData = equityCurve.map(point => ({
      x: new Date(point.timestamp),
      y: point.drawdown
    }));

    const tradePoints = trades.map(trade => ({
      x: new Date(trade.timestamp),
      y: trade.price,
      side: trade.side,
      pnl: trade.pnl || 0
    }));

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Portfolio Equity',
            data: equityData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            yAxisID: 'equity'
          },
          {
            label: 'Drawdown %',
            data: drawdownData,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 1,
            fill: true,
            tension: 0.1,
            yAxisID: 'drawdown'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: title,
            color: 'rgb(156, 163, 175)'
          },
          legend: {
            labels: {
              color: 'rgb(156, 163, 175)'
            }
          },
          tooltip: {
            backgroundColor: 'rgb(31, 41, 55)',
            titleColor: 'rgb(243, 244, 246)',
            bodyColor: 'rgb(243, 244, 246)',
            borderColor: 'rgb(75, 85, 99)',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 0) {
                  return `Equity: $${context.parsed.y.toLocaleString()}`;
                } else {
                  return `Drawdown: ${context.parsed.y.toFixed(2)}%`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy'
              }
            },
            title: {
              display: true,
              text: 'Date',
              color: 'rgb(156, 163, 175)'
            },
            ticks: {
              color: 'rgb(156, 163, 175)'
            },
            grid: {
              color: 'rgb(75, 85, 99)'
            }
          },
          equity: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Portfolio Value ($)',
              color: 'rgb(156, 163, 175)'
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              callback: function(value) {
                return '$' + (value as number).toLocaleString();
              }
            },
            grid: {
              color: 'rgb(75, 85, 99)'
            }
          },
          drawdown: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Drawdown (%)',
              color: 'rgb(156, 163, 175)'
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              callback: function(value) {
                return (value as number).toFixed(1) + '%';
              }
            },
            grid: {
              drawOnChartArea: false,
              color: 'rgb(75, 85, 99)'
            },
            min: -20,
            max: 0
          }
        }
      }
    };

    chart = new Chart(ctx, config);
  };

  // Reactively update chart when data changes
  $: if (chart && equityCurve.length > 0) {
    const equityData = equityCurve.map(point => ({
      x: new Date(point.timestamp),
      y: point.equity
    }));

    const drawdownData = equityCurve.map(point => ({
      x: new Date(point.timestamp),
      y: point.drawdown
    }));

    chart.data.datasets[0].data = equityData;
    chart.data.datasets[1].data = drawdownData;
    chart.update('none');
  }
</script>

<div class="w-full" style="height: {height};">
  <canvas bind:this={canvas}></canvas>
</div>