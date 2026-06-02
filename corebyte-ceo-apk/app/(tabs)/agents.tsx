// app/(tabs)/agents.tsx — Dashboard 14 Agentes CoreByte
import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AGENTS, COLORS, AgentStatus } from "../../constants/agents";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;

function PulseDot({ color, active }: { color: string; active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(active ? 1 : 0.35);
  useEffect(() => {
    if (active) {
      scale.value = withRepeat(withTiming(1.4, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
      opacity.value = withRepeat(withTiming(0.5, { duration: 700 }), -1, true);
    } else { scale.value = 1; opacity.value = 0.35; }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }, style]} />;
}

interface AgentCardProps { id: string; nome: string; emoji: string; cor: string; status: AgentStatus; tasks: number; }

function AgentCard({ id, nome, emoji, cor, status, tasks }: AgentCardProps) {
  const active = status === "processando";
  const borderOpacity = useSharedValue(active ? 1 : 0.3);
  useEffect(() => {
    if (active) { borderOpacity.value = withRepeat(withTiming(0.7, { duration: 900 }), -1, true); }
    else { borderOpacity.value = 0.3; }
  }, [active]);
  const borderStyle = useAnimatedStyle(() => ({ borderColor: cor, borderWidth: active ? 1.5 : 1, opacity: borderOpacity.value }));
  const statusLabel = status === "processando" ? "Processando" : status === "concluido" ? "Concluido" : "Aguardando";
  const statusColor = status === "processando" ? COLORS.warning : status === "concluido" ? COLORS.success : COLORS.subtext;
  return (
    <Animated.View style={[{ width: CARD_W, backgroundColor: COLORS.card, borderRadius: 16, padding: 14 }, borderStyle]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <PulseDot color={cor} active={active} />
      </View>
      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "600", lineHeight: 18, marginBottom: 8 }} numberOfLines={2}>{nome}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
        <Text style={{ fontSize: 11, color: statusColor }}>{statusLabel}</Text>
      </View>
      {tasks > 0 && (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: cor, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
          <Text style={{ fontSize: 10, fontWeight: "600", color: cor }}>{tasks} tarefa{tasks > 1 ? "s" : ""}</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function AgentsScreen() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(() =>
    Object.fromEntries(AGENTS.map((a) => [a.id, "idle"]))
  );
  const [tasks, setTasks] = useState<Record<string, number>>(() =>
    Object.fromEntries(AGENTS.map((a) => [a.id, 0]))
  );
  useEffect(() => {
    const interval = setInterval(() => {
      const randomId = AGENTS[Math.floor(Math.random() * AGENTS.length)].id;
      setStatuses((prev) => ({ ...prev, [randomId]: prev[randomId] === "processando" ? "concluido" : "processando" }));
      setTasks((prev) => ({ ...prev, [randomId]: Math.floor(Math.random() * 5) }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  const processando = Object.values(statuses).filter((s) => s === "processando").length;
  const concluidos = Object.values(statuses).filter((s) => s === "concluido").length;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: "#0D1929" }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700" }}>📊 Agentes CoreByte</Text>
        <Text style={{ color: COLORS.subtext, fontSize: 12, marginTop: 2 }}>14 especialistas disponíveis</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        {[{ num: 14, label: "Total", color: COLORS.success }, { num: processando, label: "Ativos", color: COLORS.warning }, { num: concluidos, label: "Concluídos", color: COLORS.cyan }, { num: 14-processando-concluidos, label: "Idle", color: COLORS.subtext }].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <View style={{ width: 1, height: 32, backgroundColor: COLORS.border }} />}
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: s.color }}>{s.num}</Text>
              <Text style={{ color: COLORS.subtext, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ flexDirection: "row", flewWrap: "wrap", padding: 12, gap: 12 }} showsVerticalScrollIndicator={false}>
        {AGENTS.map((agent) => (
          <AgentCard key={agent.id} id={agent.id} nome={agent.nome} emoji={agent.emoji� cor={agent.cor} status={statuses[agent.id]} tasks={tasks[agent.id]} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
