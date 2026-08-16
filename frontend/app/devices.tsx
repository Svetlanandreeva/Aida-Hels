import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";
import {
  appleHealthBridgeAvailable,
  connectAppleHealth,
  connectHealthConnect,
  healthConnectBridgeAvailable,
  syncAppleHealth,
  syncHealthConnect,
} from "@/src/native-health";
import {
  WearableProvider,
  cloudWearableConfiguration,
  startCloudWearableAuthorization,
  updateWearableConnection,
  wearableStatus,
} from "@/src/wearables";
import { colors, fonts, radius, spacing } from "@/src/theme";

const providerIcon = (id: string): keyof typeof Ionicons.glyphMap => {
  if (id === "apple_health") return "logo-apple";
  if (id === "android_health_connect") return "logo-android";
  if (id === "oura") return "ellipse-outline";
  if (id === "withings") return "body-outline";
  return "watch-outline";
};

export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const [providers, setProviders] = useState<WearableProvider[]>([]);
  const [cloudConfig, setCloudConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeId) { setProviders([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [response, config] = await Promise.all([
        wearableStatus(activeId),
        cloudWearableConfiguration().catch(() => ({})),
      ]);
      setProviders(response.providers || []);
      setCloudConfig(config || {});
    } catch { setProviders([]); }
    finally { setLoading(false); }
  }, [activeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stateText = (provider: WearableProvider) => {
    if (provider.state === "connected_no_data") return lang === "ru" ? "Подключено · данных пока нет" : "Connected · no data yet";
    if (provider.state === "permission_denied") return lang === "ru" ? "Нет разрешения" : "Permission denied";
    if (provider.state === "sync_error") return lang === "ru" ? "Ошибка синхронизации · повторить" : "Sync error · retry";
    if (provider.state === "stale") return lang === "ru" ? "Данные устарели · обновить" : "Data is stale · refresh";
    if (provider.state === "data") return lang === "ru" ? "Подключено" : "Connected";
    return null;
  };

  const actionText = (provider: WearableProvider) => {
    const state = stateText(provider);
    if (state) return state;
    if (provider.id === "apple_health") {
      if (Platform.OS !== "ios") return lang === "ru" ? "Откройте Аиду на iPhone" : "Open Aida on iPhone";
      return appleHealthBridgeAvailable() ? (lang === "ru" ? "Подключить Apple Health" : "Connect Apple Health") : (lang === "ru" ? "Нужна iOS-сборка Аиды" : "Aida iOS build required");
    }
    if (provider.id === "android_health_connect") {
      if (Platform.OS !== "android") return lang === "ru" ? "Откройте Аиду на Android" : "Open Aida on Android";
      return healthConnectBridgeAvailable() ? (lang === "ru" ? "Подключить Health Connect" : "Connect Health Connect") : (lang === "ru" ? "Нужна Android-сборка Аиды" : "Aida Android build required");
    }
    const cfg = cloudConfig[provider.id];
    if (cfg?.configured) return lang === "ru" ? "Подключить аккаунт" : "Connect account";
    return lang === "ru" ? "Требуются ключи провайдера" : "Provider credentials required";
  };

  const canRetry = (provider: WearableProvider) => provider.state === "sync_error" || provider.state === "stale";
  const disabled = (provider: WearableProvider) => connecting === provider.id || (provider.connected && !canRetry(provider));

  const persistFailure = async (provider: WearableProvider, error: any) => {
    if (!activeId) return;
    const raw = String(error?.message || error || "");
    const permission = /permission|denied|authorization|not authorized/i.test(raw);
    await updateWearableConnection(
      provider.id,
      activeId,
      permission ? "permission_denied" : "sync_error",
      { code: permission ? "permission_denied" : "native_sync_error", message: raw.slice(0, 500) },
    ).catch(() => undefined);
  };

  const connect = async (provider: WearableProvider) => {
    if (!activeId || disabled(provider)) return;
    setConnecting(provider.id); setMessage(null);
    try {
      if (provider.id === "apple_health") {
        if (!appleHealthBridgeAvailable()) throw new Error(lang === "ru" ? "HealthKit доступен только в нативной iOS-сборке" : "HealthKit is available only in the native iOS build");
        if (canRetry(provider)) await syncAppleHealth(activeId); else await connectAppleHealth(activeId);
        await load(); return;
      }
      if (provider.id === "android_health_connect") {
        if (!healthConnectBridgeAvailable()) throw new Error(lang === "ru" ? "Health Connect доступен только в нативной Android-сборке" : "Health Connect is available only in the native Android build");
        if (canRetry(provider)) await syncHealthConnect(activeId); else await connectHealthConnect(activeId);
        await load(); return;
      }
      const cfg = cloudConfig[provider.id];
      if (!cfg?.configured) {
        const missing = (cfg?.missing || []).join(", ");
        throw new Error((lang === "ru" ? "Не настроено: " : "Missing: ") + (missing || "credentials"));
      }
      const auth = await startCloudWearableAuthorization(provider.id, activeId);
      await Linking.openURL(auth.authorization_url);
    } catch (e: any) {
      if (provider.mode === "native_system") await persistFailure(provider, e);
      setMessage(e?.message || (lang === "ru" ? "Не удалось подключить" : "Connection failed"));
      await load();
    } finally { setConnecting(null); }
  };

  const isHealthyConnection = (provider: WearableProvider) => provider.state === "data" || provider.state === "connected_no_data";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: responsive.contentPadding }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button"><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.title}>{lang === "ru" ? "Устройства и часы" : "Devices & wearables"}</Text><Text style={styles.subtitle}>{lang === "ru" ? "Данные поступают только после вашего разрешения" : "Data is imported only after your permission"}</Text></View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.onSurface} /></View> : (
        <ScrollView contentContainerStyle={[styles.content,{paddingHorizontal:responsive.contentPadding,paddingBottom:Math.max(insets.bottom,20)+32,maxWidth:responsive.isDesktop?980:undefined,width:"100%",alignSelf:"center"}]}>
          <View style={styles.infoCard}><Ionicons name="shield-checkmark-outline" size={22} color={colors.onSurface} /><View style={{flex:1}}><Text style={styles.infoTitle}>{lang === "ru" ? "Что будет синхронизироваться" : "What Aida syncs"}</Text><Text style={styles.infoText}>{lang === "ru" ? "Пульс, пульс покоя, HRV, сон, шаги, активность, SpO₂, дыхание, VO₂ max, температура и состав тела — только если устройство реально измеряет эти показатели." : "Heart rate, resting HR, HRV, sleep, steps, activity, SpO₂, respiration, VO₂ max, temperature and body composition when the device actually measures them."}</Text></View></View>
          {message ? <View style={styles.message}><Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceSecondary}/><Text style={styles.messageText}>{message}</Text></View> : null}
          <View style={[styles.grid,responsive.width<700&&styles.gridStack]}>{providers.map((provider)=><View key={provider.id} style={[styles.providerCard,responsive.width<700&&styles.providerCardStack]}>
            <View style={styles.providerTop}><View style={styles.providerIcon}><Ionicons name={providerIcon(provider.id)} size={24} color={colors.onSurface}/></View><View style={{flex:1,minWidth:0}}><Text style={styles.providerName}>{provider.name}</Text><Text style={styles.providerDevices} numberOfLines={2}>{provider.devices.join(" · ")}</Text></View></View>
            <View style={styles.metricPills}>{(provider.id==="withings"?["Вес","Давление","Сон"]:["Пульс","Сон","Активность"]).map((item)=><View key={item} style={styles.metricPill}><Text style={styles.metricText}>{item}</Text></View>)}</View>
            <Pressable style={[styles.statusRow,isHealthyConnection(provider)&&styles.statusConnected]} onPress={()=>connect(provider)} disabled={disabled(provider)}><View style={[styles.statusDot,isHealthyConnection(provider)&&styles.statusDotConnected]}/>{connecting===provider.id?<ActivityIndicator size="small" color={colors.onSurface}/>:<Text style={styles.statusText}>{actionText(provider)}</Text>}</Pressable>
            {provider.error?.message ? <Text style={styles.lastSync}>{provider.error.message}</Text> : null}
            {provider.last_sync_at?<Text style={styles.lastSync}>{lang==="ru"?"Последняя синхронизация":"Last sync"}: {new Date(provider.last_sync_at).toLocaleString()}</Text>:null}
          </View>)}</View>
          <Text style={styles.footnote}>{lang === "ru" ? "Apple Watch подключается через Apple Health на iPhone. На Android Аида использует Health Connect. Облачные подключения включаются только после регистрации приложения у конкретного производителя и добавления его ключей на сервер." : "Apple Watch connects through Apple Health on iPhone. Android uses Health Connect. Cloud providers become available only after the app is registered with the vendor and its server credentials are configured."}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.surface},header:{flexDirection:"row",gap:12,alignItems:"center",paddingBottom:14,borderBottomWidth:1,borderBottomColor:colors.border},backButton:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceSecondary},title:{fontSize:22,lineHeight:27,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.display},subtitle:{marginTop:2,fontSize:13,color:colors.onSurfaceSecondary,fontFamily:fonts.text},center:{flex:1,alignItems:"center",justifyContent:"center"},content:{paddingTop:spacing.lg,gap:spacing.md},infoCard:{flexDirection:"row",gap:12,padding:18,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},infoTitle:{fontSize:15,fontWeight:"700",color:colors.onSurface,fontFamily:fonts.text},infoText:{marginTop:4,fontSize:13,lineHeight:19,color:colors.onSurfaceSecondary,fontFamily:fonts.text},message:{flexDirection:"row",gap:8,padding:12,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary},messageText:{flex:1,fontSize:12,lineHeight:18,color:colors.onSurfaceSecondary},grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.md},gridStack:{flexDirection:"column"},providerCard:{flexBasis:"48%",flexGrow:1,minWidth:300,padding:18,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},providerCardStack:{width:"100%",minWidth:0},providerTop:{flexDirection:"row",alignItems:"center",gap:12},providerIcon:{width:44,height:44,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},providerName:{fontSize:16,fontWeight:"800",color:colors.onSurface,fontFamily:fonts.text},providerDevices:{marginTop:2,fontSize:12,lineHeight:16,color:colors.onSurfaceSecondary,fontFamily:fonts.text},metricPills:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:16},metricPill:{paddingHorizontal:9,paddingVertical:5,borderRadius:radius.pill,backgroundColor:colors.surface},metricText:{fontSize:11,color:colors.onSurfaceSecondary,fontFamily:fonts.text},statusRow:{marginTop:16,minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,paddingHorizontal:11,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface},statusConnected:{backgroundColor:"#E8F5EC"},statusDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.onSurfaceSecondary},statusDotConnected:{backgroundColor:colors.success},statusText:{fontSize:12,fontWeight:"700",color:colors.onSurface,fontFamily:fonts.text},lastSync:{marginTop:8,fontSize:11,color:colors.onSurfaceSecondary,fontFamily:fonts.text},footnote:{paddingVertical:8,fontSize:12,lineHeight:18,color:colors.onSurfaceSecondary,fontFamily:fonts.text}});
