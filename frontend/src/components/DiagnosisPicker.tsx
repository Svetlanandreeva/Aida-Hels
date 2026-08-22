import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api, Icd10Item } from "@/src/api";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const SEARCH_DEBOUNCE_MS = 240;
const ICD_DISPLAY = /^([A-Z]\d{2}(?:\.\d+)?)\s*[—-]\s*(.+)$/i;

const formatItem = (item: Icd10Item) => `${item.code} — ${item.name}`;
const selectedCode = (value: string) => value.match(ICD_DISPLAY)?.[1]?.toUpperCase() || "";

export function DiagnosisPicker({
  selected,
  onChange,
  mentalOnly = false,
  ru,
  testID,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
  mentalOnly?: boolean;
  ru: boolean;
  testID: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Icd10Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const selectedCodes = useMemo(() => new Set(selected.map(selectedCode).filter(Boolean)), [selected]);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      void api.searchIcd10(value, mentalOnly ? "mental" : "all")
        .then((items) => {
          if (!cancelled) setResults(items.filter((item) => !selectedCodes.has(item.code.toUpperCase())));
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentalOnly, query, selectedCodes]);

  const add = (item: Icd10Item) => {
    const value = formatItem(item);
    if (!selected.includes(value)) onChange([...selected, value]);
    setQuery("");
    setResults([]);
  };

  const remove = (index: number) => onChange(selected.filter((_, itemIndex) => itemIndex !== index));

  return (
    <View testID={testID}>
      <Text style={s.hint}>
        {ru
          ? mentalOnly
            ? "Найдите установленное психическое расстройство по названию или коду МКБ-10 (раздел F)."
            : "Найдите установленный диагноз по названию или коду МКБ-10."
          : mentalOnly
            ? "Find a diagnosed mental disorder by name or ICD-10 code (F chapter)."
            : "Find a diagnosed condition by name or ICD-10 code."}
      </Text>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.onSurfaceSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={ru ? "Название или код МКБ-10" : "Name or ICD-10 code"}
          placeholderTextColor={colors.onSurfaceSecondary}
          style={s.input}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={ru ? "Поиск диагноза по названию или коду МКБ-10" : "Search diagnosis by name or ICD-10 code"}
        />
        {loading ? <ActivityIndicator size="small" color={colors.onSurface} /> : null}
      </View>

      {failed ? <Text style={s.error}>{ru ? "Не удалось выполнить поиск. Попробуйте ещё раз." : "Search failed. Try again."}</Text> : null}

      {results.length ? <View style={s.results} accessibilityLiveRegion="polite">
        {results.map((item) => (
          <Pressable
            key={item.code}
            onPress={() => add(item)}
            style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.code}. ${item.name}`}
          >
            <Text style={s.code}>{item.code}</Text>
            <Text style={s.name}>{item.name}</Text>
            <Ionicons name="add-circle-outline" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
        ))}
      </View> : null}

      {selected.length ? <View style={s.selectedList}>
        {selected.map((value, index) => (
          <View key={`${value}-${index}`} style={s.selectedRow}>
            <Ionicons name="checkmark-circle" size={19} color={colors.onSurface} />
            <Text style={s.selectedText}>{value}</Text>
            <Pressable
              onPress={() => remove(index)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={ru ? `Удалить ${value}` : `Remove ${value}`}
            >
              <Ionicons name="close-circle-outline" size={21} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>
        ))}
      </View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: fontSize.sm, lineHeight: 19, color: colors.onSurfaceSecondary, fontFamily: fonts.text, marginBottom: spacing.sm },
  searchRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  input: { flex: 1, minHeight: 50, color: colors.onSurface, fontSize: fontSize.base, fontFamily: fonts.text, outlineStyle: "none" } as any,
  results: { marginTop: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  resultRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  code: { minWidth: 54, color: colors.onSurface, fontWeight: "800", fontFamily: fonts.text },
  name: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.text },
  selectedList: { marginTop: spacing.sm, gap: 7 },
  selectedRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8 },
  selectedText: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.text },
  error: { marginTop: 7, color: colors.error, fontSize: fontSize.sm, fontFamily: fonts.text },
  pressed: { opacity: 0.68 },
});
