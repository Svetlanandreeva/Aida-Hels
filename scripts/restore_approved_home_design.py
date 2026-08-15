from pathlib import Path

path = Path('frontend/app/(tabs)/index.tsx')
text = path.read_text()

text = text.replace(
    '  const { inRange, outRange, biomarkerCount } = useMemo(() => {',
    '  const { inRange, outRange } = useMemo(() => {'
)
text = text.replace('    let total = 0;\n', '')
text = text.replace('        total += 1;\n', '')
text = text.replace(
    '    return { inRange: inR, outRange: outR, biomarkerCount: total };',
    '    return { inRange: inR, outRange: outR };'
)
text = text.replace(
    '  const hasLabData = biomarkerCount > 0;\n  const hasClinicalData = hasLabData || meds.length > 0 || symptoms.length > 0;\n',
    ''
)

start_marker = '          {!hasClinicalData && ('
end_marker = '          <View style={styles.dualRow}>'
start = text.index(start_marker)
end = text.index(end_marker, start)

approved = '''          <View style={styles.statStrip}><View style={styles.statPill}><Text style={styles.statNum}>{inRange}</Text><View style={[styles.statTag, { backgroundColor: colors.accent }]}><Text style={styles.statTagText}>{lang === "ru" ? "В норме" : "In range"}</Text></View></View><View style={styles.statPill}><Text style={styles.statNum}>{outRange}</Text><View style={[styles.statTag, { backgroundColor: "#F6D8CE" }]}><Text style={[styles.statTagText, { color: colors.error }]}>{lang === "ru" ? "Вне нормы" : "Out of range"}</Text></View></View></View>
          {readinessOn && <GradientCard gradient={gradients.warm} style={styles.hero} testID="hero-readiness"><Text style={styles.heroLabel}>{t("readiness")}</Text><Text style={styles.heroNum}>{readiness?.overall ?? 0}%</Text><Text style={styles.heroSub}>{t("readiness_hint")}</Text><View style={styles.heroBar}><View style={{ width: `${readiness?.overall ?? 0}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 3 }} /></View></GradientCard>}
          {aiAnalyticsOn && overview?.ai_summary ? <GradientCard gradient={gradients.lime} style={{ marginBottom: spacing.md }} testID="ai-day-card"><View style={styles.aiHead}><Ionicons name="sparkles" size={16} color={colors.onSurface} /><Text style={styles.aiHeadText}>{t("ai_day")}</Text></View><Text style={styles.aiText}>{overview.ai_summary}</Text></GradientCard> : null}
          <Card style={{ marginBottom: spacing.md }} testID="attention-card"><WidgetHeader icon="alert-circle-outline" label={t("needs_attention")} />{overview && overview.attention.length > 0 ? overview.attention.map((a, i) => <Pressable key={i} style={styles.attnRow} testID={`attention-${i}`} onPress={() => router.push((a.type === "bp" ? "/pressure" : a.type === "symptom" ? "/history" : "/labs") as any)}><View style={[styles.attnDot, { backgroundColor: a.severity === "error" ? colors.error : colors.warning }]} /><View style={{ flex: 1 }}><Text style={styles.attnTitle}>{a.title}</Text>{a.subtitle ? <Muted>{a.subtitle}</Muted> : null}</View><Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /></Pressable>) : <View style={styles.allGood}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Muted style={{ flex: 1 }}>{t("all_good")}</Muted></View>}</Card>
'''

text = text[:start] + approved + text[end:]
path.write_text(text)

Path('DESIGN_LOCK.md').write_text('''# Aida design lock

## Non-negotiable product rule

The currently approved Aida UI/design system is **locked**.

- Product/feature work must **add functionality inside the existing approved UI**.
- Do **not** redesign, restyle, replace, reinterpret, or rebuild screens, navigation, typography, spacing, card shapes, colors, gradients, icon language, information hierarchy, or component composition unless the user explicitly asks for a design-system change.
- A request such as “add”, “connect”, “implement”, “make functional”, “optimize”, “fix”, or “integrate” is **not permission to redesign**.
- When functionality needs a new control, reuse the existing components/tokens and place it with the minimum visual change necessary.
- If a requested feature appears to require a visual redesign, preserve the current design and ask for explicit approval before changing it.

## Approved Home reference

The approved Home/Puzzle layout is the compact dashboard version with:

1. profile/avatar + language control in the header;
2. two compact metric cards (“В норме” / “Вне нормы”);
3. gradient “Готовность аналитики” card;
4. “Требует внимания” card;
5. side-by-side “Загрузить анализ” and gradient “Подключить устройство” cards;
6. existing bottom navigation (“Пазл / Здоровье / Аида / Задачи / Профиль”).

Do not replace this with a large editorial hero, oversized health ring, alternate navigation, or a different visual system unless the user explicitly requests it.
''')
