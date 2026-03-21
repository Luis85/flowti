import type { FlowtiChartConfig } from './flowti-chart.js';
import {
	PADDING, DOT_RADIUS, BAR_GAP_RATIO, SERIES_COLORS,
	type ChartSeriesData,
	formatValue, roundRect, computeYRange, drawGrid, drawXLabels,
	extractPieSegments,
} from './flowti-chart-helpers.js';

export function drawLineChart(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	data: ChartSeriesData,
	config: FlowtiChartConfig,
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const allValues = data.series.flatMap((s) => s.values);
	const { yMin, yRange } = computeYRange(allValues);
	const colors = config.colors ?? SERIES_COLORS;
	const showDots = config.showDots !== false;

	drawGrid(ctx, width, height, yMin, computeYRange(allValues).yMax, resolveColor);
	drawXLabels(ctx, width, height, data.labels, resolveColor);

	const plotLeft = PADDING.left;
	const plotRight = width - PADDING.right;
	const plotTop = PADDING.top;
	const plotBottom = height - PADDING.bottom;
	const plotW = plotRight - plotLeft;
	const plotH = plotBottom - plotTop;
	const n = data.labels.length;

	for (let si = 0; si < data.series.length; si++) {
		const series = data.series[si];
		const color = colors[si % colors.length];
		const points = series.values.map((v, i) => ({
			x: plotLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
			y: plotBottom - ((v - yMin) / yRange) * plotH,
		}));
		if (points.length > 1) {
			ctx.save();
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			ctx.stroke();
			ctx.restore();
		}
		if (showDots) {
			ctx.save();
			ctx.fillStyle = color;
			for (const p of points) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}
	}
}

export function drawBarChart(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	data: ChartSeriesData,
	config: FlowtiChartConfig,
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const allValues = data.series.flatMap((s) => s.values);
	const { yMin, yMax, yRange } = computeYRange(allValues);
	const colors = config.colors ?? SERIES_COLORS;
	const showValues = config.showValues !== false;

	drawGrid(ctx, width, height, yMin, yMax, resolveColor);
	drawXLabels(ctx, width, height, data.labels, resolveColor);

	const plotLeft = PADDING.left;
	const plotRight = width - PADDING.right;
	const plotTop = PADDING.top;
	const plotBottom = height - PADDING.bottom;
	const plotW = plotRight - plotLeft;
	const plotH = plotBottom - plotTop;
	const n = data.labels.length;
	const seriesCount = data.series.length;
	const totalGroupWidth = plotW / n;
	const groupGap = totalGroupWidth * BAR_GAP_RATIO;
	const usableWidth = totalGroupWidth - groupGap;
	const barWidth = seriesCount > 0 ? usableWidth / seriesCount : usableWidth;

	for (let i = 0; i < n; i++) {
		const groupX = plotLeft + i * totalGroupWidth + groupGap / 2;
		for (let si = 0; si < seriesCount; si++) {
			const v = data.series[si].values[i];
			const barHeight = ((v - yMin) / yRange) * plotH;
			const x = groupX + si * barWidth;
			const y = plotBottom - barHeight;
			const color = colors[si % colors.length];
			ctx.save();
			ctx.fillStyle = color;
			roundRect(ctx, x, y, Math.max(barWidth - 1, 1), Math.max(barHeight, 1), 2);
			ctx.fill();
			ctx.restore();
			if (showValues && barHeight > 14) {
				ctx.save();
				ctx.fillStyle = resolveColor('--text-muted', '#9ca3af');
				ctx.font = '10px system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'bottom';
				ctx.fillText(formatValue(v), x + barWidth / 2, y - 2);
				ctx.restore();
			}
		}
	}
}

export function drawAreaChart(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	data: ChartSeriesData,
	config: FlowtiChartConfig,
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const allValues = data.series.flatMap((s) => s.values);
	const { yMin, yMax, yRange } = computeYRange(allValues);
	const colors = config.colors ?? SERIES_COLORS;
	const showDots = config.showDots !== false;
	const areaOpacity = config.areaOpacity ?? 0.15;

	drawGrid(ctx, width, height, yMin, yMax, resolveColor);
	drawXLabels(ctx, width, height, data.labels, resolveColor);

	const plotLeft = PADDING.left;
	const plotRight = width - PADDING.right;
	const plotTop = PADDING.top;
	const plotBottom = height - PADDING.bottom;
	const plotW = plotRight - plotLeft;
	const plotH = plotBottom - plotTop;
	const n = data.labels.length;

	for (let si = 0; si < data.series.length; si++) {
		const series = data.series[si];
		const color = colors[si % colors.length];
		const points = series.values.map((v, i) => ({
			x: plotLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
			y: plotBottom - ((v - yMin) / yRange) * plotH,
		}));
		if (points.length > 1) {
			ctx.save();
			ctx.globalAlpha = areaOpacity;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(points[0].x, plotBottom);
			for (const p of points) ctx.lineTo(p.x, p.y);
			ctx.lineTo(points[points.length - 1].x, plotBottom);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
			ctx.save();
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.lineJoin = 'round';
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
			ctx.stroke();
			ctx.restore();
		}
		if (showDots) {
			ctx.save();
			ctx.fillStyle = color;
			for (const p of points) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}
	}
}

export function drawPieChart(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	data: ChartSeriesData,
	config: FlowtiChartConfig,
	resolveColor: (cssVar: string, fallback: string) => string,
): void {
	const segments = extractPieSegments(data, config);
	if (segments.length === 0) return;
	const total = segments.reduce((s, seg) => s + seg.value, 0);
	if (total <= 0) return;
	const cx = width / 2;
	const cy = height / 2;
	const radius = Math.min(width, height) / 2 - 20;
	let cumAngle = -Math.PI / 2;
	for (const seg of segments) {
		const sliceAngle = (seg.value / total) * 2 * Math.PI;
		ctx.save();
		ctx.fillStyle = seg.color;
		if (segments.length === 1) {
			ctx.beginPath();
			ctx.arc(cx, cy, radius, 0, Math.PI * 2);
			ctx.fill();
		} else {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.arc(cx, cy, radius, cumAngle, cumAngle + sliceAngle);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = resolveColor('--background-primary', '#ffffff');
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}
		const pct = (seg.value / total) * 100;
		if (pct >= 8) {
			const midAngle = cumAngle + sliceAngle / 2;
			const labelR = radius * 0.65;
			const lx = cx + labelR * Math.cos(midAngle);
			const ly = cy + labelR * Math.sin(midAngle);
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 11px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`${pct.toFixed(0)}%`, lx, ly);
		}
		ctx.restore();
		cumAngle += sliceAngle;
	}
}
