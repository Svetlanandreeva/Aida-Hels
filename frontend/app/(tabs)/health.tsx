import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sheet } from "@/src/components/Sheet";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { getCircadianDay } from "@/src/circadianApi";
import { AddCard, FCard, figma, mobileStyles, RoundIcon, SectionHeader, FigmaTxt as Txt } from "@/src/emergent/figma-mobile";

type Mod = { key: string; settingKey?: string; route: string; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number };
type AddAction = { key: string; settingKey?: string; labelRu: string; labelEn: string; hintRu: string; hintEn: string; icon: keyof typeof Ionicons.glyphMap; run: () => void };

function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

export default function HealthHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, activeProfile, refreshTick } = useApp();
  const { lang } = useI18n();
  const { openSymptom, openMed, openLab } = useLog();
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const goals = activeProfile?.goals || [];
  const womenRelevant = activeProfile?.sex === "female" && goals.some((goal: string) => ["women", "cycle", "pregnancy_planning", "pregnancy"].includes(goal));
  const enabled = (key?: string) => !key || activeProfile?.module_settings?.[key] !== false;

  const load = useCallback(async () => {
    if (!activeId) { setCounts({}); return; }
    try {
      const [labs, vitals, checkins, meds, documents, rhythm] = await Promise.all([api.listLabs(activeId), api.listVitals(activeId), api.listCheckins(activeId), api.listMeds(activeId), api.listDocuments(activeId), getCircadianDay(activeId, localDate())]);
      setCounts({ labs: labs.length, pressure: vitals.filter((v) => v.kind === "bp").length, measures: vitals.filter((v) => v.kind !== "bp").length, mind: checkins.length, meds: meds.length, documents: documents.length, rhythm: (rhythm.wake ? 1 : 0) + (rhythm.bedtime ? 1 : 0) });
    } catch { setCounts({}); }
  }, [activeId]);
  useFocusEffect(useCallback(() => { void load(); }, [load, refreshTick]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const go = (route: string) => { setAddOpen(false); setTimeout(() => router.push(route as any), 100); };
  const run = (fn: () => void) => { setAddOpen(false); setTimeout(fn, 160); };

  const mods = ([
    { key:"labs",settingKey:"labs",route:"/(tabs)/labs",label:lang==="ru"?"Анализы":"Labs",icon:"flask-outline",count:counts.labs },
    { key:"pressure",settingKey:"pressure",route:"/(tabs)/pressure",label:lang==="ru"?"Давление":"Pressure",icon:"pulse-outline",count:counts.pressure },
    { key:"mind",settingKey:"mind",route:"/(tabs)/mind",label:lang==="ru"?"Самочувствие":"Wellbeing",icon:"happy-outline",count:counts.mind },
    { key:"meds",settingKey:"medications",route:"/medications",label:lang==="ru"?"Лекарства":"Medications",icon:"medkit-outline",count:counts.meds },
    { key:"measures",route:"/measurements",label:lang==="ru"?"Измерения":"Measurements",icon:"fitness-outline",count:counts.measures },
    { key:"documents",route:"/documents",label:lang==="ru"?"Документы":"Documents",icon:"folder-outline",count:counts.documents },
    { key:"rhythm",route:"/sleep-rhythm",label:lang==="ru"?"Сон и режим":"Sleep & rhythm",icon:"moon-outline",count:counts.rhythm },
    ...(womenRelevant ? [{ key:"women",settingKey:"women",route:"/womens-health",label:lang==="ru"?"Женское здоровье":"Women’s health",icon:"flower-outline" as const }] : []),
  ] as Mod[]).filter((m)=>enabled(m.settingKey));

  const actions = ([
    {key:"pressure",settingKey:"pressure",labelRu:"Давление",labelEn:"Blood pressure",hintRu:"Систолическое, диастолическое и пульс",hintEn:"Systolic, diastolic and pulse",icon:"pulse-outline",run:()=>go("/(tabs)/pressure")},
    {key:"symptom",labelRu:"Симптом",labelEn:"Symptom",hintRu:"Что беспокоит и насколько сильно",hintEn:"What you feel and how severe it is",icon:"medical-outline",run:()=>run(openSymptom)},
    {key:"mind",settingKey:"mind",labelRu:"Самочувствие",labelEn:"Wellbeing",hintRu:"Настроение, энергия и стресс",hintEn:"Mood, energy and stress",icon:"happy-outline",run:()=>go("/(tabs)/mind")},
    {key:"med",settingKey:"medications",labelRu:"Лекарство",labelEn:"Medication",hintRu:"Название, дозировка и расписание",hintEn:"Name, dose and schedule",icon:"medkit-outline",run:()=>run(openMed)},
    {key:"lab",settingKey:"labs",labelRu:"Анализ",labelEn:"Lab result",hintRu:"Фото или PDF",hintEn:"Photo or PDF",icon:"flask-outline",run:()=>run(()=>openLab())},
    {key:"doc",labelRu:"Документ",labelEn:"Document",hintRu:"Выписка, заключение или назначение",hintEn:"Summary, note or prescription",icon:"document-attach-outline",run:()=>go("/documents")},
    {key:"measurement",labelRu:"Измерение",labelEn:"Measurement",hintRu:"Вес, температура, SpO₂ и другое",hintEn:"Weight, temperature, SpO₂ and more",icon:"fitness-outline",run:()=>go("/measurements")},
  ] as AddAction[]).filter((a)=>enabled(a.settingKey));

  return <View style={mobileStyles.page}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={figma.ink}/>} contentContainerStyle={{paddingTop:insets.top+14,paddingBottom:36}}>
      <View style={mobileStyles.content}>
        <View style={styles.brandRow}><View style={styles.brand}><View style={styles.mark}><Ionicons name="pulse" size={14} color="#fff"/></View><Txt variant="h3" style={{fontSize:22}}>Аида</Txt></View><View style={styles.actions}><Pressable onPress={()=>router.push("/notification-settings" as any)}><RoundIcon icon="notifications-outline" size={42} bg={figma.card}/></Pressable><Pressable onPress={()=>router.push("/(tabs)/profile" as any)}><RoundIcon icon="person-outline" size={42} bg={figma.card}/></Pressable></View></View>
        <Txt variant="h1" style={styles.title}>{lang==="ru"?"Здоровье":"Health"}</Txt><Txt variant="caption" color={figma.muted}>{lang==="ru"?"Все медицинские данные в одном месте":"All your health data in one place"}</Txt>
        <View style={{marginTop:18}}><AddCard testID="health-log-data-button" title={lang==="ru"?"Добавить данные":"Add data"} subtitle={lang==="ru"?"Давление, симптомы, анализы, документы и другое":"Pressure, symptoms, labs, documents and more"} onPress={()=>setAddOpen(true)}/></View>

        <SectionHeader title={lang==="ru"?"Разделы здоровья":"Health sections"} action={`${mods.length} ${lang==="ru"?"активных":"active"}`}/>
        <View style={styles.grid}>{mods.slice(0,6).map((m,index)=><Pressable testID={`module-${m.key}`} key={m.key} onPress={()=>router.push(m.route as any)} style={[styles.module,{backgroundColor:["#FFF6D8","#FBEAE5","#EAF2FA","#F1FAD0","#EFEAFF","#F8E7EF"][index%6]}]}><View style={styles.moduleTop}><RoundIcon icon={m.icon} size={44} bg="rgba(255,255,255,.72)"/><Ionicons name="chevron-forward" size={18} color={figma.muted}/></View><Txt variant="h3" style={styles.moduleTitle}>{m.label}</Txt><Txt variant="label" color={figma.muted}>{m.count ? `${m.count} ${lang==="ru"?"записей":"records"}` : (lang==="ru"?"Пока нет данных":"No data yet")}</Txt></Pressable>)}</View>

        {mods.length>6?<><SectionHeader title={lang==="ru"?"Ещё":"More"}/><View style={styles.moreStack}>{mods.slice(6).map(m=><Pressable key={m.key} onPress={()=>router.push(m.route as any)}><FCard style={styles.moreRow}><RoundIcon icon={m.icon} size={40} bg={figma.bg}/><Txt variant="caption" weight="bold" style={{flex:1}}>{m.label}</Txt><Ionicons name="chevron-forward" size={18} color={figma.muted}/></FCard></Pressable>)}</View></>:null}

        <SectionHeader title={lang==="ru"?"История здоровья":"Health history"} action={lang==="ru"?"Вся хронология ›":"Timeline ›"} onPress={()=>router.push("/history" as any)}/>
        <Pressable onPress={()=>router.push("/history" as any)}><FCard style={styles.history}><RoundIcon icon="time-outline" size={46} bg="#EEF2DB"/><View style={{flex:1}}><Txt variant="caption" weight="bold">{lang==="ru"?"Вся история в одном месте":"Your full history in one place"}</Txt><Txt variant="label" color={figma.muted} style={{marginTop:4}}>{lang==="ru"?"Анализы, измерения, симптомы и записи по датам":"Labs, measurements, symptoms and entries by date"}</Txt><Txt variant="label" weight="bold" style={{marginTop:8}}>{lang==="ru"?"Открыть историю":"Open history"}</Txt></View><Ionicons name="chevron-forward" size={20} color={figma.muted}/></FCard></Pressable>
      </View>
    </ScrollView>

    <Sheet visible={addOpen} onClose={()=>setAddOpen(false)} testID="health-add-data-sheet" scroll>
      <Txt variant="h1" style={{fontSize:28}}>{lang==="ru"?"Что добавить?":"What would you like to add?"}</Txt><Txt variant="label" color={figma.muted} style={{marginTop:5,marginBottom:14}}>{lang==="ru"?"Данные сохранятся в текущий профиль":"Data will be saved to the current profile"}</Txt>
      {actions.map((a)=><Pressable key={a.key} testID={`health-add-${a.key}`} onPress={a.run} style={styles.sheetRow}><RoundIcon icon={a.icon} size={42} bg={figma.bg}/><View style={{flex:1}}><Txt variant="caption" weight="bold">{lang==="ru"?a.labelRu:a.labelEn}</Txt><Txt variant="label" color={figma.muted}>{lang==="ru"?a.hintRu:a.hintEn}</Txt></View><Ionicons name="chevron-forward" size={18} color={figma.muted}/></Pressable>)}
    </Sheet>
  </View>;
}

const styles=StyleSheet.create({brandRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},brand:{flexDirection:"row",alignItems:"center",gap:8},mark:{width:22,height:22,borderRadius:7,backgroundColor:figma.red,alignItems:"center",justifyContent:"center"},actions:{flexDirection:"row",gap:10},title:{fontSize:34,lineHeight:38,marginTop:22},grid:{flexDirection:"row",flexWrap:"wrap",gap:12},module:{width:"48.2%",minHeight:148,borderRadius:26,padding:16,justifyContent:"space-between"},moduleTop:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"},moduleTitle:{fontSize:18,lineHeight:22,marginTop:12},moreStack:{gap:10},moreRow:{minHeight:72,flexDirection:"row",alignItems:"center",gap:12},history:{minHeight:122,flexDirection:"row",alignItems:"center",gap:16},sheetRow:{minHeight:72,flexDirection:"row",alignItems:"center",gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:figma.divider}});