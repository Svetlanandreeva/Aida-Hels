import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { Card, GradientCard, Muted, PrimaryButton } from "@/src/components/ui";
import { CareAction, careForPet, getPetGame, PetGameState, spinPet } from "@/src/gameApi";
import { colors, fontSize, fonts, gradients, radius, spacing } from "@/src/theme";

const PETS: Record<string, { emoji: string; ru: string; en: string }> = {
  cat: { emoji: "🐱", ru: "Котик", en: "Cat" },
  bunny: { emoji: "🐰", ru: "Кролик", en: "Bunny" },
  fox: { emoji: "🦊", ru: "Лисёнок", en: "Fox" },
  panda: { emoji: "🐼", ru: "Панда", en: "Panda" },
  dragon: { emoji: "🐉", ru: "Дракон", en: "Dragon" },
  phoenix: { emoji: "🔥", ru: "Феникс", en: "Phoenix" },
  moon_fox: { emoji: "🌙", ru: "Лунная лиса", en: "Moon fox" },
  star_cat: { emoji: "✨", ru: "Звёздный кот", en: "Star cat" },
};

const CARE_META: Record<CareAction, { icon: any; ru: string; en: string }> = {
  feed: { icon: "restaurant-outline", ru: "Покормить", en: "Feed" },
  play: { icon: "game-controller-outline", ru: "Поиграть", en: "Play" },
  groom: { icon: "sparkles-outline", ru: "Уход", en: "Groom" },
};

export default function PetScreen() {
  const { activeId, bumpRefresh } = useApp();
  const { lang } = useI18n();
  const ru = lang === "ru";
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<PetGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [careBusy, setCareBusy] = useState<CareAction | null>(null);
  const spinStarted = useRef(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!activeId || activeId === "preview-profile") {
      setLoading(false);
      return;
    }
    try {
      const next = await getPetGame(activeId);
      setState(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!activeId || !state?.pet.claim_available || state.pet.claimed || spinStarted.current) return;
    spinStarted.current = true;
    setSpinning(true);
    rotation.setValue(0);

    const animation = Animated.timing(rotation, {
      toValue: 1,
      duration: 2600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    let cancelled = false;
    const request = spinPet(activeId);
    animation.start(async ({ finished }) => {
      if (!finished || cancelled) return;
      try {
        const next = await request;
        if (!cancelled) {
          setState(next);
          bumpRefresh();
        }
      } catch {
        if (!cancelled) {
          setError(true);
          spinStarted.current = false;
        }
      } finally {
        if (!cancelled) setSpinning(false);
      }
    });

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [activeId, bumpRefresh, rotation, state?.pet.claim_available, state?.pet.claimed]);

  const care = async (action: CareAction) => {
    if (!activeId || careBusy) return;
    setCareBusy(action);
    try {
      const next = await careForPet(activeId, action);
      setState(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCareBusy(null);
    }
  };

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1800deg"] });
  const petMeta = state?.pet.pet_code ? PETS[state.pet.pet_code] : null;
  const rare = state?.pet.rarity === "rare";
  const nextThreshold = Number(state?.next_threshold || 0);
  const progress = nextThreshold > 0 ? Math.min(100, Math.max(0, (Number(state?.xp_in_level || 0) / nextThreshold) * 100)) : 0;

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel={ru ? "Назад" : "Back"}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{ru ? "Питомец Аиды" : "Aida Pet"}</Text>
          <Muted>{ru ? "Растёт вместе с вашими очками Аиды" : "Grows with your Aida points"}</Muted>
        </View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.onSurface} /></View> : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
          {error ? <Card><Text style={styles.errorTitle}>{ru ? "Не удалось обновить питомца" : "Could not refresh pet"}</Text><PrimaryButton label={ru ? "Повторить" : "Retry"} onPress={() => void load()} style={{ marginTop: spacing.md }} /></Card> : null}

          {!state ? null : Number(state.level) < 2 ? (
            <GradientCard gradient={gradients.lime}>
              <View style={styles.lockedIcon}><Ionicons name="lock-closed-outline" size={30} color={colors.onSurface} /></View>
              <Text style={styles.heroTitle}>{ru ? "Питомец откроется на 2 уровне" : "Your pet unlocks at level 2"}</Text>
              <Muted style={{ marginTop: spacing.sm }}>{ru ? `До следующего уровня: ${state.xp_to_next} XP` : `${state.xp_to_next} XP to the next level`}</Muted>
              <Progress value={progress} />
            </GradientCard>
          ) : spinning || state.pet.claim_available ? (
            <GradientCard gradient={gradients.lime}>
              <Text style={styles.eyebrow}>{ru ? "ВАШ ПЕРВЫЙ ПИТОМЕЦ" : "YOUR FIRST PET"}</Text>
              <Text style={styles.heroTitle}>{ru ? "Крутим колесо…" : "Spinning the wheel…"}</Text>
              <View style={styles.wheelWrap}>
                <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}> 
                  <Text style={styles.wheelEmoji}>🐱</Text><Text style={styles.wheelEmoji}>🐉</Text><Text style={styles.wheelEmoji}>🐰</Text><Text style={styles.wheelEmoji}>✨</Text>
                </Animated.View>
                <View style={styles.pointer}><Ionicons name="caret-down" size={28} color={colors.onSurface} /></View>
              </View>
              <Muted>{ru ? "Результат фиксируется один раз на сервере — обновлением страницы его нельзя изменить." : "The result is fixed once on the server and cannot be rerolled by refreshing."}</Muted>
            </GradientCard>
          ) : state.pet.claimed && petMeta ? (
            <>
              <GradientCard gradient={gradients.lime}>
                <View style={styles.petHero}>
                  <View style={styles.petCircle}><Text style={styles.petEmoji}>{petMeta.emoji}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, rare && styles.rareBadge]}><Text style={styles.badgeText}>{rare ? (ru ? "РЕДКИЙ" : "RARE") : (ru ? "ОБЫЧНЫЙ" : "COMMON")}</Text></View>
                      <Text style={styles.coinText}>🪙 {state.coins}</Text>
                    </View>
                    <Text style={styles.petName}>{ru ? petMeta.ru : petMeta.en}</Text>
                    <Text style={styles.levelText}>{ru ? `Уровень питомца ${state.pet.level}` : `Pet level ${state.pet.level}`}</Text>
                    <Progress value={progress} />
                    <Muted style={{ marginTop: 6 }}>{state.xp_to_next} XP {ru ? "до следующего уровня" : "to next level"}</Muted>
                  </View>
                </View>
              </GradientCard>

              {rare ? <Card>
                <View style={styles.sectionHead}><Ionicons name="diamond-outline" size={20} color={colors.onSurface} /><Text style={styles.sectionTitle}>{ru ? "Редкий бонус" : "Rare benefit"}</Text></View>
                <Text style={styles.benefitBig}>−50%</Text>
                <Text style={styles.bodyText}>{ru ? "на подписку Аиды" : "on an Aida subscription"}</Text>
                <Muted style={{ marginTop: spacing.sm }}>{ru ? "Также 50% у участвующих партнёров — только когда у конкретного партнёра активно такое предложение." : "Also 50% with participating partners, only while that specific partner offer is active."}</Muted>
              </Card> : null}

              <Card>
                <View style={styles.sectionHead}><Ionicons name="heart-outline" size={20} color={colors.onSurface} /><Text style={styles.sectionTitle}>{ru ? "Уход" : "Care"}</Text></View>
                <Muted>{ru ? `Заполняйте ежедневный журнал: одно засчитанное заполнение = +${state.economy.daily_journal_reward} монет в день.` : `Fill the daily journal: one eligible entry = +${state.economy.daily_journal_reward} coins per day.`}</Muted>
                <View style={styles.careGrid}>
                  {(Object.keys(CARE_META) as CareAction[]).map((action) => {
                    const meta = CARE_META[action];
                    const cost = state.economy.care_costs[action];
                    const disabled = careBusy !== null || state.coins < cost;
                    return <Pressable key={action} onPress={() => void care(action)} disabled={disabled} style={[styles.careButton, disabled && styles.disabled]}>
                      <Ionicons name={meta.icon} size={22} color={colors.onSurface} />
                      <Text style={styles.careTitle}>{ru ? meta.ru : meta.en}</Text>
                      <Text style={styles.careCost}>🪙 {cost}</Text>
                      <Muted>{ru ? `Действий: ${state.pet.care[action] || 0}` : `Actions: ${state.pet.care[action] || 0}`}</Muted>
                    </Pressable>;
                  })}
                </View>
              </Card>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Progress({ value }: { value: number }) {
  return <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.md, padding: spacing.lg },
  errorTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.error, fontFamily: fonts.text },
  lockedIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  heroTitle: { marginTop: spacing.sm, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  wheelWrap: { height: 270, alignItems: "center", justifyContent: "center", marginVertical: spacing.lg },
  wheel: { width: 220, height: 220, borderRadius: 110, borderWidth: 12, borderColor: "rgba(27,27,29,0.14)", backgroundColor: "rgba(255,255,255,0.65)", alignItems: "center", justifyContent: "space-around", flexDirection: "row", flexWrap: "wrap", padding: 32 },
  wheelEmoji: { width: "50%", textAlign: "center", fontSize: 44 },
  pointer: { position: "absolute", top: 8 },
  petHero: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  petCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.65)", alignItems: "center", justifyContent: "center" },
  petEmoji: { fontSize: 66 },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, backgroundColor: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: 4 },
  rareBadge: { borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" },
  badgeText: { color: colors.onSurfaceInverse, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, fontFamily: fonts.text },
  coinText: { fontSize: fontSize.base, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  petName: { marginTop: spacing.sm, fontSize: fontSize["2xl"], fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  levelText: { marginTop: 2, fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  progress: { height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(27,27,29,0.14)", marginTop: spacing.md },
  progressFill: { height: "100%", backgroundColor: colors.onSurface, borderRadius: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  benefitBig: { fontSize: 44, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.display },
  bodyText: { fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  careGrid: { marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  careButton: { flex: 1, minWidth: 170, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  careTitle: { marginTop: spacing.sm, fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  careCost: { marginVertical: 3, fontSize: fontSize.sm, fontWeight: "800", color: colors.onSurface, fontFamily: fonts.text },
  disabled: { opacity: 0.45 },
});
