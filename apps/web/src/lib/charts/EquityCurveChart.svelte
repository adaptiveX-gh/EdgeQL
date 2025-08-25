<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart, { type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js/auto';
  import zoomPlugin from 'chartjs-plugin-zoom';
  import 'chartjs-adapter-date-fns';
  import type { EquityPoint, Trade } from '$lib/api/types.js';

  // Register zoom plugin
  Chart.register(zoomPlugin);

  export let equityCurve: EquityPoint[] = [];
  export let trades: Trade[] = [];
  export let height: string = '500px';
  export let title: string = 'Equity Curve';
  export let showDrawdown: boolean = true;
  export let showTrades: boolean = true;

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let isZoomed = false;

  // Controls state
  let showEquity = true;
  let showDrawdownLine = showDrawdown;
  let showTradeMarkers = showTrades;

  onMount(() => {
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

    // Create trade markers
    const buyTrades = trades.filter(t => t.side === 'buy').map(trade => ({
      x: new Date(trade.timestamp),
      y: trade.price,
      trade: trade
    }));

    const sellTrades = trades.filter(t => t.side === 'sell').map(trade => ({
      x: new Date(trade.timestamp),
      y: trade.price,
      trade: trade
    }));

    const datasets: any[] = [];

    // Equity line dataset
    if (showEquity) {
      datasets.push({
        label: 'Portfolio Equity',
        data: equityData,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        yAxisID: 'equity',
        pointRadius: 0,
        pointHoverRadius: 6
      });
    }

    // Drawdown dataset
    if (showDrawdownLine && showDrawdown) {
      datasets.push({
        label: 'Drawdown %',
        data: drawdownData,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        fill: true,
        tension: 0.1,
        yAxisID: 'drawdown',
        pointRadius: 0,
        pointHoverRadius: 4
      });
    }

    // Trade markers
    if (showTradeMarkers && trades.length > 0) {
      datasets.push({
        label: 'Buy Orders',
        data: buyTrades,
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
        yAxisID: 'equity',
        pointStyle: 'triangle'
      });

      datasets.push({
        label: 'Sell Orders',
        data: sellTrades,
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
        yAxisID: 'equity',
        pointStyle: 'rectRot'
      });
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: { datasets },
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
            color: 'rgb(156, 163, 175)',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgb(156, 163, 175)',
              usePointStyle: true,
              filter: function(item) {
                // Hide trade legend items if trades are disabled
                if (!showTradeMarkers && (item.text === 'Buy Orders' || item.text === 'Sell Orders')) {
                  return false;
                }
                // Hide drawdown if disabled
                if (!showDrawdownLine && item.text === 'Drawdown %') {
                  return false;
                }
                return true;
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            titleColor: 'rgb(243, 244, 246)',
            bodyColor: 'rgb(243, 244, 246)',
            borderColor: 'rgb(75, 85, 99)',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              title: function(context) {
                if (context[0]) {
                  const date = new Date(context[0].parsed.x);
                  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                }
                return '';
              },
              label: function(context) {
                const label = context.dataset.label || '';
                
                if (label === 'Portfolio Equity') {
                  return `${label}: $${context.parsed.y.toLocaleString()}`;
                } else if (label === 'Drawdown %') {
                  return `${label}: ${context.parsed.y.toFixed(2)}%`;
                } else if (label === 'Buy Orders' || label === 'Sell Orders') {
                  const trade = (context.raw as any).trade;
                  const lines = [
                    `${trade.side.toUpperCase()} ${trade.symbol}`,
                    `Qty: ${trade.quantity}`,
                    `Price: $${trade.price.toFixed(2)}`,
                    `Commission: $${trade.commission.toFixed(2)}`
                  ];
                  if (trade.pnl !== undefined) {
                    const pnlColor = trade.pnl >= 0 ? '+' : '';
                    lines.push(`PnL: ${pnlColor}$${trade.pnl.toFixed(2)}`);
                  }
                  return lines;
                } else {
                  return `${label}: ${context.parsed.y}`;
                }
              }
            }
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
                modifierKey: 'ctrl'
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
              onZoomComplete: function({chart}) {
                isZoomed = chart.isZoomedOrPanned();
              }
            },
            pan: {
              enabled: true,
              mode: 'x',
              onPanComplete: function({chart}) {
                isZoomed = chart.isZoomedOrPanned();
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                minute: 'HH:mm',
                hour: 'MMM dd HH:mm',
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy'
              }
            },
            title: {
              display: true,
              text: 'Time',
              color: 'rgb(156, 163, 175)'
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              maxTicksLimit: 12
            },
            grid: {
              color: 'rgba(75, 85, 99, 0.3)'
            }
          },
          equity: {
            type: 'linear',
            position: 'left',
            display: showEquity || showTradeMarkers,
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
              color: 'rgba(75, 85, 99, 0.3)'
            }
          },
          drawdown: {
            type: 'linear',
            position: 'right',
            display: showDrawdownLine && showDrawdown,
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
              color: 'rgba(75, 85, 99, 0.3)'
            },
            min: Math.min(...drawdownData.map(d => d.y)) - 1,
            max: 0
          }
        }
      }
    };

    chart = new Chart(ctx, config);
  };

  // Reset zoom function
  const resetZoom = () => {
    if (chart) {
      chart.resetZoom();
      isZoomed = false;
    }
  };

  // Toggle functions
  const toggleEquity = () => {
    showEquity = !showEquity;
    updateChart();
  };

  const toggleDrawdown = () => {
    showDrawdownLine = !showDrawdownLine;
    updateChart();
  };

  const toggleTrades = () => {
    showTradeMarkers = !showTradeMarkers;
    updateChart();
  };

  // Update chart with new visibility settings
  const updateChart = () => {
    if (chart) {
      chart.destroy();
      createChart();
    }
  };

  // Reactive updates when data changes
  $: if (chart && equityCurve.length > 0) {
    updateChart();
  }
</script>

<!-- Chart Controls -->
<div class="flex flex-wrap items-center justify-between gap-4 mb-4 p-4 bg-base-100 rounded-lg shadow">
  <div class="flex flex-wrap gap-2">
    <label class="label cursor-pointer gap-2">
      <input type="checkbox" bind:checked={showEquity} class="checkbox checkbox-success checkbox-sm" />
      <span class="label-text text-sm">Equity Curve</span>
    </label>
    
    {#if showDrawdown}
      <label class="label cursor-pointer gap-2">
        <input type="checkbox" bind:checked={showDrawdownLine} class="checkbox checkbox-error checkbox-sm" />
        <span class="label-text text-sm">Drawdown</span>
      </label>
    {/if}
    
    {#if trades.length > 0}
      <label class="label cursor-pointer gap-2">
        <input type="checkbox" bind:checked={showTradeMarkers} class="checkbox checkbox-primary checkbox-sm" />
        <span class="label-text text-sm">Trade Markers</span>
      </label>
    {/if}
  </div>
  
  <div class="flex gap-2">
    {#if isZoomed}
      <button class="btn btn-sm btn-outline" on:click={resetZoom}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
        </svg>
        Reset Zoom
      </button>
    {/if}
    
    <div class="text-xs text-base-content/70 flex items-center">
      <kbd class="kbd kbd-xs">Ctrl</kbd> + <span class="mx-1">scroll</span> to zoom
    </div>
  </div>
</div>

<!-- Chart Container -->
<div class="bg-base-100 rounded-lg shadow-lg p-4">
  <div class="w-full" style="height: {height};">
    <canvas bind:this={canvas}></canvas>
  </div>
  
  {#if equityCurve.length === 0}
    <div class="flex items-center justify-center h-64">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <h4 class="text-lg font-semibold mb-2">No Equity Data</h4>
        <p class="text-base-content/70">No equity curve data available for this run.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .kbd {
    @apply inline-flex items-center justify-center px-1.5 py-1 text-xs font-semibold bg-base-200 border border-base-300 rounded;
  }
</style>