import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fontSize } from '../theme';

export default function WeightChart({ data, unit = 'kg', width = 320, height = 200 }) {
  if (!data || data.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Log at least 2 entries to see chart</Text>
      </View>
    );
  }

  const visible = data.slice(-14);
  const weights = visible.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const xOf = i => (i / (visible.length - 1)) * cw;
  const yOf = w => ch - ((w - minW) / range) * ch;

  const pts = visible.map((d, i) => ({ x: xOf(i), y: yOf(d.weight), ...d }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${ch} L0,${ch} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: ch * t,
    label: (maxW - range * t).toFixed(1),
  }));

  const xLabels = pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % Math.ceil(pts.length / 4) === 0);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.3" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <G transform={`translate(${pad.left},${pad.top})`}>
        {yTicks.map((t, i) => (
          <G key={i}>
            <Line x1={0} y1={t.y} x2={cw} y2={t.y} stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
            <SvgText
              x={-6}
              y={t.y + 4}
              fill={colors.textMuted}
              fontSize={9}
              textAnchor="end"
            >
              {t.label}
            </SvgText>
          </G>
        ))}

        <Path d={areaPath} fill="url(#areaGrad)" />
        <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3.5} fill={i === pts.length - 1 ? colors.primary : colors.bgCard} stroke={colors.primary} strokeWidth={2} />
        ))}

        {xLabels.map((p, i) => (
          <SvgText key={i} x={p.x} y={ch + 22} fill={colors.textMuted} fontSize={9} textAnchor="middle">
            {p.date?.slice(5)}
          </SvgText>
        ))}

        <SvgText
          x={-30}
          y={ch / 2}
          fill={colors.textMuted}
          fontSize={9}
          textAnchor="middle"
          transform={`rotate(-90,${-30},${ch / 2})`}
        >
          {unit}
        </SvgText>
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
