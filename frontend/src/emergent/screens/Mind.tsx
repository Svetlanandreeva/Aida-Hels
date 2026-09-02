import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import dayjs from "dayjs";

import { useApp } from "@/src/emergent/AppContext";
import { useHealth } from "@/src/emergent/health-context";
import { Txt } from "@/src/emergent/ui";
import { AddCard, FCard, figma, gradients, GradientPanel, mobileStyles, SectionHeader } from "@/src/emergent/figma-mobile";

export default function Mind() {
  const { lang } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addCheckin } = useHealth();
  const latest = state.checkins[0];
  const [editing, setEditing] = useState(false);
  const [mood, setMood] = useState(latest?.mood || 3);
  const [energy, setEnergy] = useState(latest?.energy || 3);
  const [stress, setStress] = useState(latest?.stress || 3);
  const [wellbeing, setWellbeing] = useState(latest?.wellbeing || 3);
  const recent = state.checkins.slice(0, 7).reverse();
  const avg = useMemo(() => state.checkins.length ? (state.checkins.slice(0, 7).reduce((s,c)=>s+c.wellbeing,0)/Math.min(7,state.checkins.length)).toFixed(1) : null, [state.checkins]);
  const save = () => { addCheckin({ mood, energy, stress, wellbeing }); setEditing(false); };

  return <View style={mobileStyles.page}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 }}>
      <View style={mobileStyles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={figma.ink} /></Pressable><View style={{ flex: 1 }}><Txt variant="h1" style={styles.title}>{lang === "ru" ? "Самочувствие" : "Wellbeing"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Настроение, энергия, стресс и общее состояние" : "Mood, energy, stress and overall state"}</Txt></View><Pressable onPress={() => setEditing(true)} style={styles.round}><Ionicons name="add" size={23} color={figma.ink} /></Pressable></View>

        <View style={{ marginTop: 18 }}><AddCard title={lang === "ru" ? "Добавить check-in" : "Add check-in"} subtitle={lang === "ru" ? "Займёт меньше минуты" : "Takes less than a minute"} icon="happy-outline" onPress={() => setEditing(true)} /></View>

        <View style={{ marginTop: 18 }}><GradientPanel colors={gradients.wellbeing} style={styles.hero}><Txt variant="label" color={figma.soft} weight="semibold">{lang === "ru" ? "СЕГОДНЯ" : "TODAY"}</Txt><View style={styles.heroLine}><Txt variant="display" style={styles.heroValue}>{latest ? latest.wellbeing : "—"}</Txt><Txt variant="h3" color={figma.soft}>/5</Txt></View><View style={[mobileStyles.pill, { backgroundColor: figma.card }]}><Txt variant="label" weight="bold">{latest ? wellbeingWord(latest.wellbeing, lang) : (lang === "ru" ? "Нет отметки" : "No check-in")}</Txt></View>{latest ? <Txt variant="label" color={figma.soft} style={{ marginTop: 10 }}>{dayjs(latest.ts).format("HH:mm")}</Txt> : null}<View style={styles.moodRing}><Txt variant="h1">{latest ? moodEmoji(latest.mood) : "•"}</Txt><Txt variant="label" color={figma.muted}>{lang === "ru" ? "настроение" : "mood"}</Txt></View></GradientPanel></View>

        <SectionHeader title={lang === "ru" ? "Последний check-in" : "Latest check-in"} action={latest ? dayjs(latest.ts).format("HH:mm") : undefined} />
        <View style={styles.metricGrid}><MetricCard icon="happy-outline" label={lang === "ru" ? "Настроение" : "Mood"} value={latest ? `${latest.mood}/5` : "—"} /><MetricCard icon="flash-outline" label={lang === "ru" ? "Энергия" : "Energy"} value={latest ? `${latest.energy}/5` : "—"} /><MetricCard icon="alert-circle-outline" label={lang === "ru" ? "Стресс" : "Stress"} value={latest ? `${latest.stress}/5` : "—"} /><MetricCard icon="heart-outline" label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={latest ? `${latest.wellbeing}/5` : "—"} /></View>

        <SectionHeader title={lang === "ru" ? "Динамика" : "Dynamics"} action={lang === "ru" ? "7 дней" : "7 days"} />
        <FCard style={styles.chartCard}><View style={styles.chartHead}><Txt variant="caption" weight="bold">{lang === "ru" ? "Общее самочувствие" : "Overall wellbeing"}</Txt>{avg ? <View style={[mobileStyles.pill,{backgroundColor:"#EEF2DB"}]}><Txt variant="label" weight="bold">Ø {avg}</Txt></View> : null}</View>{recent.length ? <View style={styles.chart}>{recent.map((c) => <View key={c.id} style={styles.chartCol}><Txt variant="label" color={figma.muted}>{c.wellbeing}</Txt><View style={[styles.bar, { height: 24 + c.wellbeing * 20 }]} /><Txt variant="label" color={figma.muted}>{dayjs(c.ts).format("dd")}</Txt></View>)}</View> : <View style={styles.emptyChart}><Ionicons name="analytics-outline" size={28} color={figma.muted} /><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Нужно несколько check-in для графика" : "Add a few check-ins to see a chart"}</Txt></View>}</FCard>

        <SectionHeader title={lang === "ru" ? "Факторы" : "Factors"} action={lang === "ru" ? "Все ›" : "All ›"} />
        <FCard><Txt variant="caption" weight="bold">{lang === "ru" ? "Что может влиять" : "What may affect you"}</Txt><Txt variant="label" color={figma.muted} style={{ marginTop: 5 }}>{lang === "ru" ? "Аида сопоставит самочувствие со сном, нагрузкой, циклом, лекарствами и анализами." : "Aida compares wellbeing with sleep, load, cycle, medication and labs."}</Txt><View style={styles.chips}>{[lang === "ru" ? "Сон" : "Sleep", lang === "ru" ? "Нагрузка" : "Load", lang === "ru" ? "Цикл" : "Cycle"].map((x)=><View key={x} style={[mobileStyles.pill,{backgroundColor:figma.bg}]}><Txt variant="label" weight="semibold">{x}</Txt></View>)}</View></FCard>

        <SectionHeader title={lang === "ru" ? "История" : "History"} action={state.checkins.length ? String(state.checkins.length) : undefined} />
        <FCard style={{ paddingVertical: 4 }}>{state.checkins.length ? state.checkins.slice(0,5).map((c,i)=><View key={c.id}>{i ? <View style={mobileStyles.divider}/> : null}<View style={styles.history}><View style={[styles.dot,{backgroundColor:c.wellbeing>=4?figma.green:c.wellbeing>=3?figma.lime:figma.orange}]}/><Txt variant="label" color={figma.muted} style={{flex:1}}>{dayjs(c.ts).format("D MMM, HH:mm")}</Txt><Txt variant="h3">{c.wellbeing}/5</Txt><Txt variant="label" color={figma.muted}>{wellbeingWord(c.wellbeing,lang)}</Txt></View></View>) : <View style={styles.noHistory}><Txt variant="label" color={figma.muted}>{lang === "ru" ? "Пока нет записей" : "No entries yet"}</Txt></View>}</FCard>
      </View>
    </ScrollView>

    {editing ? <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} /><View style={[styles.sheet,{paddingBottom:Math.max(insets.bottom,18)+18}]}><View style={styles.handle}/><Txt variant="h1" style={{fontSize:28}}>{lang === "ru" ? "Как вы себя чувствуете?" : "How do you feel?"}</Txt><Txt variant="label" color={figma.muted} style={{marginTop:4}}>{lang === "ru" ? "Отметьте четыре показателя" : "Rate four dimensions"}</Txt><View style={styles.editorGrid}><ScaleCard label={lang === "ru" ? "Настроение" : "Mood"} value={mood} onChange={setMood}/><ScaleCard label={lang === "ru" ? "Энергия" : "Energy"} value={energy} onChange={setEnergy}/><ScaleCard label={lang === "ru" ? "Стресс" : "Stress"} value={stress} onChange={setStress}/><ScaleCard label={lang === "ru" ? "Самочувствие" : "Wellbeing"} value={wellbeing} onChange={setWellbeing}/></View><Pressable testID="mind-save" onPress={save} style={styles.save}><Txt variant="caption" color="#fff" weight="bold">{lang === "ru" ? "Сохранить check-in" : "Save check-in"}</Txt></Pressable><Pressable onPress={() => setEditing(false)} style={styles.cancel}><Txt variant="caption" weight="bold">{lang === "ru" ? "Отмена" : "Cancel"}</Txt></Pressable></View></View> : null}
  </View>;
}

function MetricCard({icon,label,value}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string}){return <FCard style={styles.metricCard}><View style={styles.metricIcon}><Ionicons name={icon} size={20} color={figma.ink}/></View><Txt variant="label" color={figma.muted}>{label}</Txt><Txt variant="h2">{value}</Txt></FCard>}
function ScaleCard({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){return <View style={styles.scaleCard}><Txt variant="caption" weight="bold">{label}</Txt><Txt variant="h1" style={{marginTop:5}}>{value}/5</Txt><View style={styles.scale}>{[1,2,3,4,5].map(v=><Pressable key={v} onPress={()=>onChange(v)} style={[styles.scaleDot,v<=value&&styles.scaleDotOn]}/>)}</View></View>}
function wellbeingWord(v:number,lang:string){if(lang!=="ru") return v>=4?"Good":v>=3?"Moderate":"Low"; return v>=4?"Хорошо":v>=3?"Умеренно":"Низко"}
function moodEmoji(v:number){return v>=5?"☺":v>=4?"◡":v>=3?"•":v>=2?"⌢":"☹"}

const styles=StyleSheet.create({
  header:{flexDirection:"row",alignItems:"center",gap:14},round:{width:40,height:40,borderRadius:20,backgroundColor:figma.card,alignItems:"center",justifyContent:"center"},title:{fontSize:27,lineHeight:31},hero:{minHeight:190,position:"relative"},heroLine:{flexDirection:"row",alignItems:"flex-end",gap:6,marginTop:8},heroValue:{fontSize:58,lineHeight:62,color:figma.ink},moodRing:{position:"absolute",right:18,top:24,width:72,height:72,borderRadius:36,backgroundColor:"rgba(255,255,255,.55)",borderWidth:6,borderColor:"rgba(255,255,255,.72)",alignItems:"center",justifyContent:"center"},metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},metricCard:{width:"48.5%",minHeight:104,padding:14,gap:5},metricIcon:{width:38,height:38,borderRadius:19,backgroundColor:figma.bg,alignItems:"center",justifyContent:"center"},chartCard:{minHeight:250},chartHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},chart:{height:180,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",marginTop:16},chartCol:{flex:1,alignItems:"center",justifyContent:"flex-end",gap:6},bar:{width:24,borderRadius:12,backgroundColor:figma.ink},emptyChart:{minHeight:175,alignItems:"center",justifyContent:"center",gap:10},chips:{flexDirection:"row",gap:8,marginTop:14,flexWrap:"wrap"},history:{minHeight:58,flexDirection:"row",alignItems:"center",gap:9},dot:{width:9,height:9,borderRadius:5},noHistory:{minHeight:90,alignItems:"center",justifyContent:"center"},overlay:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,.52)",justifyContent:"flex-end"},sheet:{backgroundColor:figma.card,borderTopLeftRadius:32,borderTopRightRadius:32,padding:24},handle:{width:44,height:5,borderRadius:3,backgroundColor:figma.divider,alignSelf:"center",marginBottom:24},editorGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:20},scaleCard:{width:"48.5%",height:145,borderRadius:24,backgroundColor:figma.bg,padding:14},scale:{flexDirection:"row",gap:7,marginTop:22},scaleDot:{flex:1,height:9,borderRadius:5,backgroundColor:figma.divider},scaleDotOn:{backgroundColor:figma.ink},save:{height:62,borderRadius:999,backgroundColor:figma.ink,alignItems:"center",justifyContent:"center",marginTop:20},cancel:{height:54,borderRadius:999,backgroundColor:figma.bg,alignItems:"center",justifyContent:"center",marginTop:10}
});
