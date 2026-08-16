from pathlib import Path
import re

server = Path("backend/server.py")
text = server.read_text()
old = "from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType"
new = "from llm_provider import LlmChat, UserMessage, FileContentWithMimeType"
if old in text:
    server.write_text(text.replace(old, new, 1))

profile = Path("frontend/app/(tabs)/profile.tsx")
text = profile.read_text()
needle = '          <Card style={{ marginTop: spacing.md }} testID="allergies-card">'
if "profile-feature-links" not in text:
    insert = '''          <View style={styles.featureLinks} testID="profile-feature-links">
            <FeatureLink icon="body-outline" title={lang === "ru" ? "Организм" : "Body"} subtitle={lang === "ru" ? "Системы и биологический возраст" : "Systems and biological age"} onPress={() => router.push("/body" as any)} />
            <FeatureLink icon="watch-outline" title={lang === "ru" ? "Устройства" : "Devices"} subtitle={lang === "ru" ? "Часы, HealthKit и Health Connect" : "Watches, HealthKit and Health Connect"} onPress={() => router.push("/devices" as any)} />
            {activeProfile.sex === "female" ? <FeatureLink icon="flower-outline" title={lang === "ru" ? "Женское здоровье" : "Women's health"} subtitle={lang === "ru" ? "Цикл, планирование, беременность" : "Cycle, planning, pregnancy"} onPress={() => router.push("/womens-health" as any)} /> : null}
            <FeatureLink icon="people-outline" title={lang === "ru" ? "Семья и доступ" : "Family & access"} subtitle={lang === "ru" ? "Профили и разрешения" : "Profiles and permissions"} onPress={() => router.push("/family" as any)} />
            <FeatureLink icon="shield-checkmark-outline" title={lang === "ru" ? "Приватность" : "Privacy"} subtitle={lang === "ru" ? "AI, уведомления и сессии" : "AI, notifications and sessions"} onPress={() => router.push("/privacy" as any)} />
            <FeatureLink icon="medical-outline" title={lang === "ru" ? "Экстренная медкарта" : "Emergency card"} subtitle={lang === "ru" ? "Краткие важные данные" : "Essential health summary"} onPress={() => router.push("/emergency-card" as any)} />
          </View>

'''
    if needle not in text:
        raise SystemExit("profile insertion point missing")
    text = text.replace(needle, insert + needle, 1)

helper_needle = 'const EditField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => ('
if "const FeatureLink:" not in text:
    helper = '''const FeatureLink: React.FC<{ icon: any; title: string; subtitle: string; onPress: () => void }> = ({ icon, title, subtitle, onPress }) => (
  <Pressable style={styles.featureLink} onPress={onPress}>
    <View style={styles.featureIcon}><Ionicons name={icon} size={20} color={colors.onSurface} /></View>
    <View style={{ flex: 1 }}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureHint}>{subtitle}</Text></View>
    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
  </Pressable>
);

'''
    if helper_needle not in text:
        raise SystemExit("profile helper point missing")
    text = text.replace(helper_needle, helper + helper_needle, 1)

style_needle = '  container: { flex: 1, backgroundColor: colors.surface },'
if "featureLinks:" not in text:
    styles = '''
  featureLinks: { marginTop: spacing.md, gap: spacing.sm },
  featureLink: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  featureIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  featureHint: { marginTop: 2, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },'''
    if style_needle not in text:
        raise SystemExit("profile style point missing")
    text = text.replace(style_needle, style_needle + styles, 1)
profile.write_text(text)

# Keep the old Yandex deployment available only as an explicit manual fallback.
yandex = Path(".github/workflows/deploy-yandex.yml")
if yandex.exists():
    y = yandex.read_text()
    start = y.find("on:\n")
    jobs = y.find("\njobs:")
    if start >= 0 and jobs > start and "workflow_dispatch:" not in y[start:jobs]:
        y = y[:start] + "on:\n  workflow_dispatch:\n" + y[jobs:]
        yandex.write_text(y)

for name in (
    "cleanup-dashboard-fake-data-once.yml",
    "harden-source-security-once.yml",
    "rebuild-appointments-once.yml",
    "rebuild-labs-once.yml",
    "redesign-reminders-once.yml",
    "remove-demo-auth-source.yml",
    "sync-aida2-into-hels-once.yml",
):
    p = Path(".github/workflows") / name
    if p.exists():
        p.unlink()
