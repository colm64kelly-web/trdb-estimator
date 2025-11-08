let chart;

export function renderChart(ctx, breakdown, market) {
  const labels = [];
  const data = [];
  const colors = [];

  for (const [key, value] of Object.entries(breakdown)) {
    const slice = market.slices[key];
    labels.push(slice?.label || key);
    data.push(Math.max(0, value));
    colors.push(slice?.color || '#95a2b3');
  }

  if (chart) chart.destroy();
  chart = new window.Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
}
