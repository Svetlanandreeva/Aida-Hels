import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { getLabTrends, LabTrendSeries } from "@/src/labTrendsApi";
import { Txt } from "@/src/emergent/ui";
import { Bars, FCard, figma, mobileStyles, SectionHeader } from "@/src/emergent/figma-mobile";

const ranges = ["7д", "30д", "3м", "6м", "1г", "Все"];

export default function LabTrendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId } = useApp();
  const { lang } = useI18n();
  const [series, setSeries] = useState<LabTrendSeries[]>([]);
  const [labCount, setLabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(0);
  const [range, setRange] = useState(2);

  const load = useCallback(async () => {
    if (!activeId) { setSeries([]); setLabCount(0); setLoading(false); return; }
    setLoadError(false);
    try { const data = await getLabTrends(activeId); setSeries(data.series || []); setLabCount(data.lab_count || 0); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [activeId]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const item = series[Math.min(selected, Math.max(0, series.length - 1))];
  const values = item?.points.map((p) => p.value) || [];
  const max = values.length ? Math.max(...values, 1) : 1;
  const recent = item?.points.slice(-4) || [];
  const deltaPct = useMemo(() => {
    if (!item || item.points.length < 2) return null;
    const first = item.points[0].value; const last = item.points[item.points.length - 1].value;
    return first === 0 ? null : Math.round(((last - first) / Math.abs(first)) * 100);
  }, [item]);

  return <View style={mobileStyles.page}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={figma.ink}/></Pressable><View style={{flex:1}}><Txt variant="h1" style={styles.title}>{lang==="ru"?"Тренды показателей":"Biomarker trends"}</Txt><Txt variant="label" color={figma.muted}>{lang==="ru"?"Графики изменений по времени":"Changes over time"}</Txt></View><Pressable onPress={()=>router.push("/(tabs)/labs" as any)} style={styles.round}><Ionicons name="add" size={22} color={figma.ink}/></Pressable></View>

        {loading ? <View style={styles.state}><ActivityIndicator color={figma.ink}/></View> : loadError ? <State icon="cloud-offline-outline" title={lang==="ru"?"Не удалось загрузить тренды":"Could not load trends"} text={lang==="ru"?"Попробуйте ещё раз":"Please try again"} action={load}/> : !activeId ? <State icon="person-circle-outline" title={lang==="ru"?"Выберите профиль":"Choose a profile"} text={lang==="ru"?"Тренды строятся отдельно для каждого профиля":"Trends are profile-specific"}/> : !series.length ? <State icon="analytics-outline" title={lang==="ru"?"Пока нечего сравнивать":"Nothing to compare yet"} text={labCount<2?(lang==="ru"?"Нужно минимум два анализа с повторяющимся показателем":"At least two reports with a repeated biomarker are needed"):(lang==="ru"?"Повторяющихся совместимых показателей пока нет":"No compatible repeated biomarkers yet")}/> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{series.map((s,i)=><Pressable key={s.key} onPress={()=>setSelected(i)} style={[styles.chip,i===selected&&styles.chipActive]}><Txt variant="label" color={i===selected?"#fff":figma.ink} weight="semibold">{s.name}</Txt></Pressable>)}</ScrollView>

          <FCard style={styles.hero}><View style={styles.heroGlow}/><Txt variant="h3">{item.name}</Txt><View style={styles.heroValue}><Txt variant="display" style={styles.number}>{item.latest.raw_value ?? item.latest.value}</Txt><Txt variant="caption" color={figma.muted}>{item.unit || ""}</Txt></View><Txt variant="caption" color={figma.orange} weight="bold">{item.latest.status === "low" ? (lang==="ru"?"Ниже нормы":"Below range") : item.latest.status === "high" ? (lang==="ru"?"Выше нормы":"Above range") : (lang==="ru"?"В норме":"In range")}</Txt><View style={styles.heroBars}><Bars values={recent.map(p=>p.value)} max={max} height={88} width={22}/></View>{deltaPct!==null?<View style={styles.deltaRing}><Txt variant="h3">{deltaPct>0?"+":""}{deltaPct}%</Txt><Txt variant="label" color={figma.muted}>{lang==="ru"?"за период":"period"}</Txt></View>:null}</FCard>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges}>{ranges.map((r,i)=><Pressable key={r} onPress={()=>setRange(i)} style={[styles.range,i===range&&styles.rangeActive]}><Txt variant="label" color={i===range?"#fff":figma.ink} weight="semibold">{r}</Txt></Pressable>)}</ScrollView>

          <SectionHeader title={lang==="ru"?"Динамика":"Dynamics"}/>
          <FCard style={styles.chartCard}><View style={styles.chartHead}><Txt variant="label" color={figma.muted}>{item.unit || ""}</Txt>{item.latest.reference?<Txt variant="label" color={figma.muted}>{lang==="ru"?"Референс":"Reference"}: {item.latest.reference}</Txt>:null}</View><View style={styles.chart}><Bars values={values.length>8?values.slice(-8):values} max={max} height={190} width={24}/></View><View style={styles.axis}>{(item.points.length>4?item.points.filter((_,i)=>i===0||i===item.points.length-1):item.points).map((p,i)=><Txt key={`${p.date}-${i}`} variant="label" color={figma.muted}>{p.date}</Txt>)}</View></FCard>

          <SectionHeader title={lang==="ru"?"Сравнение периодов":"Period comparison"}/>
          <FCard><View style={styles.compare}>{recent.length?recent.map((p,i)=><View key={`${p.date}-${i}`} style={styles.compareCol}><Txt variant="caption" weight="bold">{p.value}</Txt><View style={[styles.compareBar,{height:34+Math.round((p.value/max)*70)}]}/><Txt variant="label" color={figma.muted}>{p.date.slice(5)}</Txt></View>):null}</View></FCard>

          <SectionHeader title={lang==="ru"?"Последние измерения":"Latest measurements"} action={`${item.count}`}/>
          <FCard style={{paddingVertical:4}}>{item.points.slice().reverse().slice(0,5).map((p,i)=><View key={`${p.date}-${i}`}>{i?<View style={mobileStyles.divider}/>:null}<View style={styles.row}><View style={[styles.dot,{backgroundColor:p.status==="normal"?figma.green:figma.orange}]}/><Txt variant="label" color={figma.muted} style={{flex:1}}>{p.date}</Txt><Txt variant="h3">{p.raw_value ?? p.value}</Txt><Txt variant="label" color={figma.muted}>{item.unit||""}</Txt><Ionicons name="chevron-forward" size={18} color={figma.muted}/></View></View>)}</FCard>
        </>}
      </View>
    </ScrollView>
  </View>;
}

function State({icon,title,text,action}:{icon:keyof typeof Ionicons.glyphMap;title:string;text:string;action?:()=>void}){return <View style={styles.state}><Ionicons name={icon} size={34} color={figma.muted}/><Txt variant="h2">{title}</Txt><Txt variant="label" color={figma.muted} style={{textAlign:"center"}}>{text}</Txt>{action?<Pressable onPress={action} style={styles.retry}><Txt variant="caption" color="#fff" weight="bold">Повторить</Txt></Pressable>:null}</View>}

const styles=StyleSheet.create({header:{flexDirection:"row",alignItems:"center",gap:14},round:{width:40,height:40,borderRadius:20,backgroundColor:figma.card,alignItems:"center",justifyContent:"center"},title:{fontSize:27,lineHeight:31},chips:{gap:8,paddingVertical:18,paddingRight:16},chip:{height:40,borderRadius:999,paddingHorizontal:14,backgroundColor:figma.card,alignItems:"center",justifyContent:"center"},chipActive:{backgroundColor:figma.ink},hero:{minHeight:220,position:"relative",overflow:"hidden"},heroGlow:{position:"absolute",right:-30,bottom:-40,width:180,height:180,borderRadius:90,backgroundColor:"#F4D9E4",opacity:.8},heroValue:{flexDirection:"row",alignItems:"flex-end",gap:8,marginTop:8},number:{fontSize:56,lineHeight:60,color:figma.ink},heroBars:{position:"absolute",right:24,bottom:18,width:170},deltaRing:{position:"absolute",right:20,top:20,width:76,height:76,borderRadius:38,borderWidth:6,borderColor:"rgba(255,255,255,.8)",backgroundColor:"rgba(255,255,255,.35)",alignItems:"center",justifyContent:"center"},ranges:{gap:6,paddingVertical:16},range:{minWidth:50,height:40,borderRadius:999,backgroundColor:figma.card,alignItems:"center",justifyContent:"center",paddingHorizontal:10},rangeActive:{backgroundColor:figma.ink},chartCard:{minHeight:360},chartHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},chart:{height:210,justifyContent:"flex-end",marginTop:20,paddingHorizontal:10},axis:{flexDirection:"row",justifyContent:"space-between",marginTop:10},compare:{height:150,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-around"},compareCol:{alignItems:"center",gap:6},compareBar:{width:28,borderRadius:14,backgroundColor:figma.ink},row:{minHeight:64,flexDirection:"row",alignItems:"center",gap:10},dot:{width:10,height:10,borderRadius:5},state:{minHeight:460,alignItems:"center",justifyContent:"center",gap:10,paddingHorizontal:28},retry:{height:44,paddingHorizontal:20,borderRadius:999,backgroundColor:figma.ink,alignItems:"center",justifyContent:"center",marginTop:8}});
