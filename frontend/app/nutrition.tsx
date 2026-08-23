import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, PrimaryButton } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { api } from "@/src/api";
import {
  NutritionEntry,
  NutritionFoodCandidate,
  NutritionStatus,
  NutritionSummary,
  nutritionApi,
} from "@/src/nutritionApi";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const MEALS = [
  ["breakfast", "Завтрак", "Breakfast"],
  ["lunch", "Обед", "Lunch"],
  ["dinner", "Ужин", "Dinner"],
  ["snack", "Перекус", "Snack"],
] as const;

function numberOrUndefined(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function localClockPayload() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    eaten_at: now.toISOString(),
    local_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    local_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timezone_offset_min: -now.getTimezoneOffset(),
  };
}

function mealLabel(meal: string, lang: string) {
  const item = MEALS.find(([key]) => key === meal);
  if (item) return lang === "ru" ? item[1] : item[2];
  return lang === "ru" ? "Приём пищи" : "Meal";
}

function nutrientText(entry: NutritionEntry, lang: string) {
  const n = entry.nutrients || {};
  const parts = [
    n.calories != null ? `${Math.round(n.calories)} ${lang === "ru" ? "ккал" : "kcal"}` : null,
    n.protein_g != null ? `${lang === "ru" ? "Б" : "P"} ${n.protein_g.toFixed(1)} г` : null,
    n.fat_g != null ? `${lang === "ru" ? "Ж" : "F"} ${n.fat_g.toFixed(1)} г` : null,
    n.carbs_g != null ? `${lang === "ru" ? "У" : "C"} ${n.carbs_g.toFixed(1)} г` : null,
    n.fiber_g != null ? `${lang === "ru" ? "клетч." : "fiber"} ${n.fiber_g.toFixed(1)} г` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function candidateNutrients(food: NutritionFoodCandidate, lang: string) {
  const n = food.nutrients || {};
  const parts = [
    n.calories != null ? `${Math.round(n.calories)} ${lang === "ru" ? "ккал" : "kcal"}` : null,
    n.protein_g != null ? `${lang === "ru" ? "Б" : "P"} ${n.protein_g.toFixed(1)}` : null,
    n.fat_g != null ? `${lang === "ru" ? "Ж" : "F"} ${n.fat_g.toFixed(1)}` : null,
    n.carbs_g != null ? `${lang === "ru" ? "У" : "C"} ${n.carbs_g.toFixed(1)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const { activeProfile, activeId, reload, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const enabled = activeProfile?.module_settings?.nutrition === true;

  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [status, setStatus] = useState<NutritionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<"reference" | "manual">("reference");
  const [meal, setMeal] = useState("breakfast");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NutritionFoodCandidate[]>([]);
  const [selected, setSelected] = useState<NutritionFoodCandidate | null>(null);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError("");
    try {
      const nextStatus = await nutritionApi.status(activeId);
      setStatus(nextStatus);
      if (activeProfile?.module_settings?.nutrition === true) {
        const [items, nextSummary] = await Promise.all([
          nutritionApi.listEntries(activeId),
          nutritionApi.summary(activeId),
        ]);
        setEntries(items);
        setSummary(nextSummary);
      } else {
        setEntries([]);
        setSummary(null);
      }
    } catch {
      setError(lang === "ru" ? "Не удалось обновить дневник питания." : "Could not refresh nutrition diary.");
    } finally {
      setLoading(false);
    }
  }, [activeId, activeProfile?.module_settings?.nutrition, lang]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toggleModule = async () => {
    if (!activeProfile) return;
    setSavingSetting(true);
    setError("");
    try {
      await api.updateProfile(activeProfile.id, {
        module_settings: { ...(activeProfile.module_settings || {}), nutrition: !enabled },
      });
      await reload();
      bumpRefresh();
    } catch {
      setError(lang === "ru" ? "Не удалось изменить настройку питания." : "Could not change nutrition setting.");
    } finally {
      setSavingSetting(false);
    }
  };

  const latestDay = summary?.daily?.[0] || null;
  const todayStats = useMemo(() => {
    if (!latestDay) return [];
    return [
      [lang === "ru" ? "Энергия" : "Energy", latestDay.calories ? `${Math.round(latestDay.calories)} ${lang === "ru" ? "ккал" : "kcal"}` : "—"],
      [lang === "ru" ? "Белок" : "Protein", latestDay.protein_g ? `${Number(latestDay.protein_g).toFixed(1)} г` : "—"],
      [lang === "ru" ? "Клетчатка" : "Fiber", latestDay.fiber_g ? `${Number(latestDay.fiber_g).toFixed(1)} г` : "—"],
    ];
  }, [latestDay, lang]);

  const openAdd = () => {
    setSourceMode("reference");
    setMeal("breakfast");
    setQuery("");
    setResults([]);
    setSelected(null);
    setLabel("");
    setQuantity("1");
    setCalories(""); setProtein(""); setCarbs(""); setFat(""); setFiber(""); setSugar("");
    setError("");
    setSheetOpen(true);
  };

  const search = async () => {
    if (!activeId || query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const response = await nutritionApi.searchFoods(activeId, query.trim());
      setResults(response.items || []);
      if (!response.items?.length) {
        setError(lang === "ru" ? "В открытых базах ничего не найдено. Можно добавить продукт вручную." : "No match in open databases. You can add the food manually.");
      }
    } catch {
      setError(lang === "ru" ? "Поиск сейчас недоступен. Можно добавить продукт вручную." : "Search is unavailable. You can add the food manually.");
    } finally {
      setSearching(false);
    }
  };

  const chooseFood = (food: NutritionFoodCandidate) => {
    setSelected(food);
    setLabel(food.brand ? `${food.name} · ${food.brand}` : food.name);
    setResults([]);
  };

  const saveEntry = async () => {
    if (!activeId) return;
    if (sourceMode === "reference" && !selected) {
      setError(lang === "ru" ? "Сначала выберите продукт из результатов поиска." : "Choose a food from search results first.");
      return;
    }
    if (sourceMode === "manual" && !label.trim()) {
      setError(lang === "ru" ? "Укажите продукт или блюдо." : "Enter a food or meal.");
      return;
    }
    setSavingEntry(true);
    setError("");
    try {
      await nutritionApi.createEntry({
        profile_id: activeId,
        label: label.trim(),
        meal_type: meal,
        ...localClockPayload(),
        source: sourceMode === "reference" ? selected!.reference_source : "manual",
        reference_id: sourceMode === "reference" ? selected!.reference_id : undefined,
        quantity: Math.max(0.01, numberOrUndefined(quantity) || 1),
        calories: sourceMode === "manual" ? numberOrUndefined(calories) : undefined,
        protein_g: sourceMode === "manual" ? numberOrUndefined(protein) : undefined,
        carbs_g: sourceMode === "manual" ? numberOrUndefined(carbs) : undefined,
        fat_g: sourceMode === "manual" ? numberOrUndefined(fat) : undefined,
        fiber_g: sourceMode === "manual" ? numberOrUndefined(fiber) : undefined,
        sugar_g: sourceMode === "manual" ? numberOrUndefined(sugar) : undefined,
      });
      setSheetOpen(false);
      await load();
      bumpRefresh();
    } catch {
      setError(lang === "ru" ? "Не удалось сохранить продукт." : "Could not save food.");
    } finally {
      setSavingEntry(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await nutritionApi.deleteEntry(id);
      await load();
      bumpRefresh();
    } catch {
      setError(lang === "ru" ? "Не удалось удалить запись." : "Could not delete entry.");
    }
  };

  if (!activeProfile || !activeId) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={lang === "ru" ? "Питание" : "Nutrition"} />
        <View style={styles.center}><Muted>{lang === "ru" ? "Сначала выберите профиль." : "Choose a profile first."}</Muted></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={lang === "ru" ? "Питание" : "Nutrition"} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 + insets.bottom, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <Card testID="nutrition-module-card">
          <View style={styles.moduleRow}>
            <View style={styles.moduleIcon}><Ionicons name="restaurant-outline" size={22} color={colors.onSurface} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{lang === "ru" ? "Дневник питания" : "Nutrition diary"}</Text>
              <Muted>{lang === "ru" ? "Питание участвует в общем анализе только когда модуль включён." : "Nutrition joins Aida's overall analysis only when this module is enabled."}</Muted>
            </View>
            <Pressable onPress={() => void toggleModule()} disabled={savingSetting} style={[styles.toggle, enabled && styles.toggleActive]} testID="nutrition-module-toggle">
              {savingSetting ? <ActivityIndicator size="small" color={enabled ? colors.onBrandPrimary : colors.onSurface} /> : <Text style={[styles.toggleText, enabled && styles.toggleTextActive]}>{enabled ? (lang === "ru" ? "Вкл" : "On") : (lang === "ru" ? "Выкл" : "Off")}</Text>}
            </Pressable>
          </View>
        </Card>

        {error ? <View style={styles.notice}><Ionicons name="alert-circle-outline" size={18} color={colors.warning} /><Text style={styles.noticeText}>{error}</Text></View> : null}

        {!enabled ? (
          <Card>
            <View style={styles.emptyBlock}>
              <Ionicons name="nutrition-outline" size={42} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyTitle}>{lang === "ru" ? "Подключите питание к профилю" : "Connect nutrition to this profile"}</Text>
              <Muted style={styles.emptyText}>{lang === "ru" ? "После включения КБЖУ, интервалы между едой и подтверждённые взаимодействия с лекарствами смогут использоваться в общем анализе Aida." : "Once enabled, nutrients, meal timing and evidence-backed food/medicine interaction flags can be used in Aida's overall analysis."}</Muted>
              <PrimaryButton label={lang === "ru" ? "Включить дневник" : "Enable diary"} onPress={() => void toggleModule()} loading={savingSetting} style={{ marginTop: spacing.lg }} />
            </View>
          </Card>
        ) : (
          <>
            <Card testID="nutrition-provider-card">
              <View style={styles.providerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{lang === "ru" ? "Источники КБЖУ" : "Nutrition sources"}</Text>
                  <Muted>{lang === "ru"
                    ? `Open Food Facts доступен бесплатно${status?.usda_configured ? ", USDA подключён" : ", USDA можно подключить бесплатным API-ключом"}. Когда есть данные из двух открытых источников, Aida сверяет их между собой.`
                    : `Open Food Facts is available for free${status?.usda_configured ? ", USDA is connected" : ", USDA can be connected with a free API key"}. When two open sources are available, Aida cross-checks them.`}
                  </Muted>
                  <Text style={styles.retentionText}>{lang === "ru"
                    ? `Названия конкретных продуктов хранятся ${status?.detail_retention_hours || 20} часов, затем остаётся только приём пищи и его КБЖУ/клетчатка и другие нутриенты.`
                    : `Individual food names are kept for ${status?.detail_retention_hours || 20} hours, then only the meal and its nutrition totals remain.`}
                  </Text>
                </View>
                <View style={styles.sourceStack}>
                  <View style={styles.sourceBadge}><Text style={styles.sourceBadgeText}>OFF</Text></View>
                  <View style={[styles.sourceBadge, !status?.usda_configured && styles.sourceBadgeMuted]}><Text style={styles.sourceBadgeText}>USDA</Text></View>
                </View>
              </View>
            </Card>

            {todayStats.length ? (
              <View style={styles.statsRow}>
                {todayStats.map(([title, value]) => <View key={title} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{title}</Text></View>)}
              </View>
            ) : null}

            {(summary?.food_medication_flags || []).length > 0 ? (
              <Card testID="nutrition-medication-flags">
                <View style={styles.sectionHead}><Ionicons name="medical-outline" size={19} color={colors.warning} /><Text style={styles.sectionTitle}>{lang === "ru" ? "Еда и лекарства" : "Food & medications"}</Text></View>
                {summary!.food_medication_flags.map((flag, index) => (
                  <View key={`${flag.kind}-${index}`} style={styles.flagRow}>
                    <Text style={styles.flagTitle}>{[flag.food, flag.medication].filter(Boolean).join(" ↔ ")}</Text>
                    <Text style={styles.flagText}>{flag.message}</Text>
                    {flag.action ? <Muted style={{ marginTop: 5 }}>{flag.action}</Muted> : null}
                    {flag.evidence_url ? <Pressable onPress={() => void Linking.openURL(flag.evidence_url!)}><Text style={styles.sourceLink}>{lang === "ru" ? "Медицинский источник" : "Medical source"}</Text></Pressable> : null}
                  </View>
                ))}
              </Card>
            ) : null}

            {(summary?.insights || []).length > 0 ? (
              <Card testID="nutrition-insights-card">
                <View style={styles.sectionHead}><Ionicons name="sparkles-outline" size={19} color={colors.onSurface} /><Text style={styles.sectionTitle}>{lang === "ru" ? "Наблюдения Aida" : "Aida observations"}</Text></View>
                {summary!.insights.map((item) => <View key={item.kind} style={styles.insight}><Text style={styles.insightTitle}>{item.title}</Text><Muted>{item.text}</Muted></View>)}
              </Card>
            ) : null}

            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>{lang === "ru" ? "Записи" : "Entries"}</Text>
              {loading ? <ActivityIndicator size="small" color={colors.onSurface} /> : <Pressable style={styles.addButton} onPress={openAdd}><Ionicons name="add" size={18} color={colors.onSurfaceInverse} /><Text style={styles.addButtonText}>{lang === "ru" ? "Добавить" : "Add"}</Text></Pressable>}
            </View>

            {entries.length ? entries.map((entry) => (
              <Card key={entry.id} testID={`nutrition-entry-${entry.id}`}>
                <View style={styles.entryRow}>
                  <View style={styles.mealIcon}><Ionicons name={entry.compacted ? "pie-chart-outline" : "restaurant-outline"} size={18} color={colors.onSurface} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryTitle}>{entry.label || `${mealLabel(entry.meal_type, lang)} · ${lang === "ru" ? "итог" : "summary"}`}</Text>
                    <Text style={styles.entryMeta}>{mealLabel(entry.meal_type, lang)} · {entry.local_date || String(entry.eaten_at).slice(0, 10)}{entry.local_time ? ` · ${entry.local_time}` : ""}</Text>
                    {entry.compacted ? <Text style={styles.compactedText}>{lang === "ru" ? `Сводка после 20 ч · ${entry.detail_count || 1} поз.` : `20h summary · ${entry.detail_count || 1} items`}</Text> : null}
                    {nutrientText(entry, lang) ? <Text style={styles.entryNutrients}>{nutrientText(entry, lang)}</Text> : <Muted style={{ marginTop: 4 }}>{lang === "ru" ? "КБЖУ не указаны" : "No nutrition values"}</Muted>}
                    {!entry.compacted && entry.verification_status === "cross_checked" ? <Text style={styles.verifiedText}>{lang === "ru" ? "✓ Сверено по двум открытым источникам" : "✓ Cross-checked with two open sources"}</Text> : null}
                    {!entry.compacted && entry.verification_status === "source_disagreement" ? <Text style={styles.warningText}>{lang === "ru" ? "Источники заметно расходятся, используем основной источник с пометкой." : "Sources differ noticeably; the primary source is kept with a warning."}</Text> : null}
                  </View>
                  <Pressable onPress={() => void removeEntry(entry.id)} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} /></Pressable>
                </View>
              </Card>
            )) : (
              <Card><View style={styles.emptyList}><Muted>{lang === "ru" ? "Добавьте первый приём пищи." : "Add your first meal."}</Muted></View></Card>
            )}
          </>
        )}
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} scroll testID="nutrition-add-sheet">
        <Text style={styles.sheetTitle}>{lang === "ru" ? "Добавить питание" : "Add food"}</Text>
        <View style={styles.sourceTabs}>
          <Pressable onPress={() => setSourceMode("reference")} style={[styles.sourceTab, sourceMode === "reference" && styles.sourceTabActive]}>
            <Text style={[styles.sourceTabText, sourceMode === "reference" && styles.sourceTabTextActive]}>{lang === "ru" ? "Найти в базе" : "Search database"}</Text>
          </Pressable>
          <Pressable onPress={() => setSourceMode("manual")} style={[styles.sourceTab, sourceMode === "manual" && styles.sourceTabActive]}>
            <Text style={[styles.sourceTabText, sourceMode === "manual" && styles.sourceTabTextActive]}>{lang === "ru" ? "Вручную" : "Manual"}</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>{lang === "ru" ? "Приём пищи" : "Meal"}</Text>
        <View style={styles.mealChips}>{MEALS.map(([key, ru, en]) => <Pressable key={key} onPress={() => setMeal(key)} style={[styles.mealChip, meal === key && styles.mealChipActive]}><Text style={[styles.mealChipText, meal === key && styles.mealChipTextActive]}>{lang === "ru" ? ru : en}</Text></Pressable>)}</View>

        {sourceMode === "reference" ? (
          <>
            <Text style={styles.fieldLabel}>{lang === "ru" ? "Найти продукт" : "Find food"}</Text>
            <View style={styles.searchRow}>
              <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder={lang === "ru" ? "Например: овсянка" : "For example: oatmeal"} placeholderTextColor={colors.onSurfaceSecondary} style={[styles.input, { flex: 1 }]} />
              <Pressable style={styles.searchButton} onPress={() => void search()}>{searching ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Ionicons name="search" size={19} color={colors.onSurfaceInverse} />}</Pressable>
            </View>
            {results.map((food) => <Pressable key={`${food.reference_source}-${food.reference_id}`} style={styles.searchResult} onPress={() => chooseFood(food)}><View style={{ flex: 1 }}><View style={styles.resultTitleRow}><Text style={styles.searchResultTitle}>{food.name}</Text><View style={styles.providerPill}><Text style={styles.providerPillText}>{food.reference_source === "usda" ? "USDA" : "OFF"}</Text></View></View>{food.brand ? <Muted>{food.brand}</Muted> : null}{candidateNutrients(food, lang) ? <Text style={styles.searchResultDescription}>{candidateNutrients(food, lang)} · {food.serving_description || "100 г"}</Text> : null}</View><Ionicons name="add-circle-outline" size={21} color={colors.onSurface} /></Pressable>)}
            {selected ? <View style={styles.selectedFood}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><View style={{ flex: 1 }}><Text style={styles.selectedFoodText}>{label}</Text><Muted>{selected.reference_source === "usda" ? "USDA FoodData Central" : "Open Food Facts"} · {selected.serving_description || "100 г"}</Muted></View></View> : null}
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>{lang === "ru" ? "Продукт или блюдо" : "Food or meal"}</Text>
            <TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder={lang === "ru" ? "Название" : "Name"} placeholderTextColor={colors.onSurfaceSecondary} />
            <Text style={styles.fieldLabel}>{lang === "ru" ? "Нутриенты (необязательно)" : "Nutrients (optional)"}</Text>
            <View style={styles.nutrientGrid}>
              <NutrientField label={lang === "ru" ? "ккал" : "kcal"} value={calories} onChange={setCalories} />
              <NutrientField label={lang === "ru" ? "Белок, г" : "Protein, g"} value={protein} onChange={setProtein} />
              <NutrientField label={lang === "ru" ? "Углеводы, г" : "Carbs, g"} value={carbs} onChange={setCarbs} />
              <NutrientField label={lang === "ru" ? "Жиры, г" : "Fat, g"} value={fat} onChange={setFat} />
              <NutrientField label={lang === "ru" ? "Клетчатка, г" : "Fiber, g"} value={fiber} onChange={setFiber} />
              <NutrientField label={lang === "ru" ? "Сахара, г" : "Sugar, g"} value={sugar} onChange={setSugar} />
            </View>
          </>
        )}

        <Text style={styles.fieldLabel}>{sourceMode === "reference" ? (lang === "ru" ? "Количество порций по 100 г" : "Number of 100 g servings") : (lang === "ru" ? "Количество порций" : "Servings")}</Text>
        <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} placeholder="1" placeholderTextColor={colors.onSurfaceSecondary} />
        <PrimaryButton label={lang === "ru" ? "Сохранить" : "Save"} onPress={() => void saveEntry()} loading={savingEntry} style={{ marginTop: spacing.lg }} />
      </Sheet>
    </View>
  );
}

function NutrientField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.nutrientField}><Text style={styles.nutrientLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.inputSmall} placeholder="0" placeholderTextColor={colors.onSurfaceSecondary} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  moduleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  moduleIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginBottom: 3 },
  toggle: { minWidth: 54, minHeight: 34, paddingHorizontal: 10, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  toggleText: { fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  toggleTextActive: { color: colors.onBrandPrimary },
  notice: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  noticeText: { flex: 1, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurface, fontFamily: fonts.text },
  emptyBlock: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { marginTop: spacing.sm, fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, textAlign: "center", fontFamily: fonts.display },
  emptyText: { marginTop: spacing.xs, textAlign: "center", maxWidth: 420 },
  providerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sourceStack: { gap: 6, alignItems: "flex-end" },
  sourceBadge: { minWidth: 46, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: "center" },
  sourceBadgeMuted: { opacity: 0.35 },
  sourceBadgeText: { color: colors.onSurfaceInverse, fontSize: 10, fontWeight: "800", fontFamily: fonts.text },
  retentionText: { marginTop: spacing.sm, fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurface, fontFamily: fonts.text },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, minHeight: 82, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  statLabel: { marginTop: 5, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  flagRow: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  flagTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  flagText: { marginTop: 5, fontSize: fontSize.sm, lineHeight: 20, color: colors.onSurface, fontFamily: fonts.text },
  sourceLink: { marginTop: 7, fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, textDecorationLine: "underline", fontFamily: fonts.text },
  insight: { paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  insightTitle: { marginBottom: 4, fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  listHeader: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: colors.onSurface, flexDirection: "row", alignItems: "center", gap: 6 },
  addButtonText: { color: colors.onSurfaceInverse, fontSize: fontSize.sm, fontWeight: "800", fontFamily: fonts.text },
  entryRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  mealIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  entryTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  entryMeta: { marginTop: 3, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  compactedText: { marginTop: 4, fontSize: 11, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  entryNutrients: { marginTop: 5, fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  verifiedText: { marginTop: 6, fontSize: 11, color: colors.success, fontWeight: "700", fontFamily: fonts.text },
  warningText: { marginTop: 6, fontSize: 11, lineHeight: 16, color: colors.warning, fontFamily: fonts.text },
  emptyList: { alignItems: "center", paddingVertical: spacing.xl },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display, marginBottom: spacing.lg },
  sourceTabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  sourceTab: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  sourceTabActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  sourceTabText: { fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  sourceTabTextActive: { color: colors.onSurfaceInverse },
  fieldLabel: { marginTop: spacing.md, marginBottom: spacing.sm, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  mealChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mealChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  mealChipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  mealChipText: { fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "700", fontFamily: fonts.text },
  mealChipTextActive: { color: colors.onSurfaceInverse },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchButton: { width: 50, height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.onSurface },
  input: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  searchResult: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  resultTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  searchResultTitle: { flexShrink: 1, fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  providerPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  providerPillText: { fontSize: 9, fontWeight: "800", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  searchResultDescription: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  selectedFood: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: 8, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  selectedFoodText: { flex: 1, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  nutrientGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  nutrientField: { width: "48%" },
  nutrientLabel: { marginBottom: 5, fontSize: 12, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  inputSmall: { minHeight: 46, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
});
