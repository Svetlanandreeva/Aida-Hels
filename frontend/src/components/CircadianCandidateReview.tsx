import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  approveCircadianCandidate,
  correctCircadianCandidate,
  listPendingCircadianCandidates,
  rejectCircadianCandidate,
  WearableCircadianCandidate,
} from "@/src/circadianApi";
import { colors, fontSize, fonts, radius, spacing } from "@/src/theme";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Props = {
  profileId: string | null | undefined;
  ru: boolean;
  onCommitted?: () => void | Promise<void>;
};

export function CircadianCandidateReview({ profileId, ru, onCommitted }: Props) {
  const [items, setItems] = useState<WearableCircadianCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await listPendingCircadianCandidates(profileId));
      setLoaded(true);
    } catch (e: any) {
      setError(e?.message || (ru ? "Не удалось загрузить данные сна с устройства" : "Could not load wearable sleep data"));
    } finally {
      setLoading(false);
    }
  }, [profileId, ru]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateLocal = (id: string, key: "local_date" | "local_time" | "kind", value: string) => {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      payload: { ...item.payload, [key]: value },
    } as WearableCircadianCandidate : item));
  };

  const saveCorrection = async (item: WearableCircadianCandidate) => {
    if (!DATE_RE.test(item.payload.local_date) || !TIME_RE.test(item.payload.local_time)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await correctCircadianCandidate(item.id, {
        kind: item.payload.kind,
        localDate: item.payload.local_date,
        localTime: item.payload.local_time,
      });
      setItems((current) => current.map((x) => x.id === item.id ? updated : x));
    } catch (e: any) {
      setError(e?.message || (ru ? "Не удалось сохранить исправление" : "Could not save correction"));
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (item: WearableCircadianCandidate, action: "approve" | "reject") => {
    if (!DATE_RE.test(item.payload.local_date) || !TIME_RE.test(item.payload.local_time)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await correctCircadianCandidate(item.id, {
        kind: item.payload.kind,
        localDate: item.payload.local_date,
        localTime: item.payload.local_time,
      });
      if (action === "approve") await approveCircadianCandidate(item.id);
      else await rejectCircadianCandidate(item.id);
      setItems((current) => current.filter((x) => x.id !== item.id));
      await onCommitted?.();
    } catch (e: any) {
      setError(e?.message || (ru ? "Не удалось обработать запись" : "Could not process candidate"));
    } finally {
      setBusyId(null);
    }
  };

  if (!loaded && loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.onSurface} /></View>;
  }
  if (!items.length && !error) return null;

  return <View style={styles.card} testID="wearable-circadian-review">
    <View style={styles.headingRow}>
      <Ionicons name="watch-outline" size={24} color={colors.onSurface} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{ru ? "Сон с устройства" : "Wearable sleep"}</Text>
        <Text style={styles.description}>{ru ? "Аида нашла время сна или пробуждения в Apple Health / Health Connect. Проверьте запись перед добавлением в историю." : "Aida found bedtime or wake data in Apple Health / Health Connect. Review it before it becomes part of your history."}</Text>
      </View>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>{ru ? "Повторить" : "Retry"}</Text></Pressable></View> : null}

    {items.map((item) => {
      const busy = busyId === item.id;
      const valid = DATE_RE.test(item.payload.local_date) && TIME_RE.test(item.payload.local_time);
      const provider = item.payload.provider === "apple_health" || item.payload.provider === "healthkit"
        ? "Apple Health"
        : item.payload.provider === "android_health_connect" ? "Health Connect" : item.payload.provider;
      return <View key={item.id} style={styles.item} testID={`circadian-candidate-${item.id}`}>
        <View style={styles.metaRow}>
          <Text style={styles.kind}>{item.payload.kind === "wake" ? (ru ? "Пробуждение" : "Wake") : (ru ? "Отход ко сну" : "Bedtime")}</Text>
          <Text style={styles.source}>{provider}</Text>
        </View>

        <View style={styles.kindRow}>
          <Pressable disabled={busy} onPress={() => updateLocal(item.id, "kind", "bedtime")} style={[styles.kindPill, item.payload.kind === "bedtime" && styles.kindPillOn]}>
            <Text style={[styles.kindPillText, item.payload.kind === "bedtime" && styles.kindPillTextOn]}>{ru ? "Сон" : "Bedtime"}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => updateLocal(item.id, "kind", "wake")} style={[styles.kindPill, item.payload.kind === "wake" && styles.kindPillOn]}>
            <Text style={[styles.kindPillText, item.payload.kind === "wake" && styles.kindPillTextOn]}>{ru ? "Подъём" : "Wake"}</Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <TextInput value={item.payload.local_date} onChangeText={(v) => updateLocal(item.id, "local_date", v)} editable={!busy} style={styles.dateInput} placeholder="2026-08-17" placeholderTextColor={colors.onSurfaceSecondary} />
          <TextInput value={item.payload.local_time} onChangeText={(v) => updateLocal(item.id, "local_time", v)} editable={!busy} style={styles.timeInput} placeholder="23:30" placeholderTextColor={colors.onSurfaceSecondary} />
        </View>
        {!valid ? <Text style={styles.validation}>{ru ? "Проверьте дату ГГГГ-ММ-ДД и время ЧЧ:ММ" : "Check YYYY-MM-DD date and HH:MM time"}</Text> : null}

        <View style={styles.actions}>
          <Pressable disabled={busy || !valid} onPress={() => void saveCorrection(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{ru ? "Сохранить правку" : "Save edit"}</Text></Pressable>
          <Pressable disabled={busy || !valid} onPress={() => void decide(item, "reject")} style={styles.rejectButton}><Text style={styles.rejectText}>{ru ? "Отклонить" : "Reject"}</Text></Pressable>
          <Pressable disabled={busy || !valid} onPress={() => void decide(item, "approve")} style={styles.approveButton}>{busy ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> : <Text style={styles.approveText}>{ru ? "Подтвердить" : "Confirm"}</Text>}</Pressable>
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  loading:{paddingVertical:spacing.lg,alignItems:"center"},
  card:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.xl,padding:spacing.lg,borderWidth:1,borderColor:colors.border,marginBottom:spacing.md},
  headingRow:{flexDirection:"row",gap:spacing.md,alignItems:"flex-start"},
  title:{fontSize:fontSize.xl,fontWeight:"800",fontFamily:fonts.display,color:colors.onSurface},
  description:{marginTop:spacing.xs,fontSize:fontSize.sm,lineHeight:20,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  errorBox:{marginTop:spacing.md,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surface},
  errorText:{fontSize:fontSize.sm,color:colors.error,fontFamily:fonts.text},
  retry:{marginTop:spacing.xs,color:colors.onSurface,fontWeight:"800"},
  item:{marginTop:spacing.lg,paddingTop:spacing.md,borderTopWidth:1,borderTopColor:colors.divider},
  metaRow:{flexDirection:"row",justifyContent:"space-between",gap:spacing.sm,alignItems:"center"},
  kind:{fontSize:fontSize.base,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},
  source:{fontSize:fontSize.sm,color:colors.onSurfaceSecondary,fontFamily:fonts.text},
  kindRow:{flexDirection:"row",gap:spacing.sm,marginTop:spacing.md},
  kindPill:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface},
  kindPillOn:{backgroundColor:colors.onSurface},
  kindPillText:{fontSize:fontSize.sm,fontWeight:"700",color:colors.onSurfaceSecondary},
  kindPillTextOn:{color:colors.onSurfaceInverse},
  inputRow:{flexDirection:"row",gap:spacing.sm,marginTop:spacing.md},
  dateInput:{flex:1,minHeight:46,borderRadius:radius.md,backgroundColor:colors.surface,paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,color:colors.onSurface},
  timeInput:{width:96,minHeight:46,borderRadius:radius.md,backgroundColor:colors.surface,paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,color:colors.onSurface},
  validation:{marginTop:spacing.xs,fontSize:fontSize.sm,color:colors.error,fontFamily:fonts.text},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,marginTop:spacing.md},
  secondaryButton:{minHeight:42,paddingHorizontal:spacing.md,borderRadius:radius.pill,backgroundColor:colors.surfaceTertiary,alignItems:"center",justifyContent:"center"},
  secondaryText:{color:colors.onSurface,fontWeight:"800",fontSize:fontSize.sm},
  rejectButton:{minHeight:42,paddingHorizontal:spacing.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.error,alignItems:"center",justifyContent:"center"},
  rejectText:{color:colors.error,fontWeight:"800",fontSize:fontSize.sm},
  approveButton:{minHeight:42,paddingHorizontal:spacing.lg,borderRadius:radius.pill,backgroundColor:colors.onSurface,alignItems:"center",justifyContent:"center"},
  approveText:{color:colors.onSurfaceInverse,fontWeight:"800",fontSize:fontSize.sm},
});
