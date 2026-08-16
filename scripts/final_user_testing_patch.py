from pathlib import Path

# Production reset links must point to the deployed HTTPS app, while deployments
# can still override the URL explicitly.
auth = Path("backend/auth_api.py")
text = auth.read_text()
text = text.replace('os.environ.get("PASSWORD_RESET_BASE_URL", "frontend://reset-password")', 'os.environ.get("PASSWORD_RESET_BASE_URL", "https://aidaassistent.ru/reset-password")')
auth.write_text(text)

# Notification text respects the profile privacy setting. The task title stays
# on-device only when the user explicitly enables detailed notifications.
notifications = Path("frontend/src/notifications.ts")
text = notifications.read_text()
text = text.replace('  taskId?: string | null;\n}', '  taskId?: string | null;\n  showDetails?: boolean;\n}')
text = text.replace('      body: input.title,', '      body: input.showDetails ? input.title : "Откройте Аиду, чтобы посмотреть напоминание",')
notifications.write_text(text)

tasks = Path("frontend/app/(tabs)/tasks.tsx")
text = tasks.read_text()
text = text.replace('const { activeId, refreshTick, bumpRefresh } = useApp();', 'const { activeId, activeProfile, refreshTick, bumpRefresh } = useApp();')
text = text.replace('          taskId: updated.id,\n        });', '          taskId: updated.id,\n          showDetails: activeProfile?.privacy?.show_notification_details === true,\n        });')
text = text.replace('          taskId: created.id,\n        });', '          taskId: created.id,\n          showDetails: activeProfile?.privacy?.show_notification_details === true,\n        });')
tasks.write_text(text)

# Surface export in the approved profile feature list.
profile = Path("frontend/app/(tabs)/profile.tsx")
text = profile.read_text()
needle = '            <FeatureLink icon="medical-outline" title={lang === "ru" ? "Экстренная медкарта" : "Emergency card"}'
if needle in text and 'router.push("/export-data"' not in text:
    insert = '            <FeatureLink icon="download-outline" title={lang === "ru" ? "Экспорт данных" : "Data export"} subtitle={lang === "ru" ? "Скачать данные профиля" : "Download profile data"} onPress={() => router.push("/export-data" as any)} />\n'
    text = text.replace(needle, insert + needle, 1)
profile.write_text(text)
