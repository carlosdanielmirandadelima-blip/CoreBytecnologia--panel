// app/(tabs)/index.tsx  — Painel Chat CEO IA
import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import { COLORS, AGENTS } from "../../constants/agents";
import { detectAgents, getCeoResponse } from "../../constants/responses";

interface Message {
  id: string;
  role: "user" | "ceo";
  content: string;
  timestamp: Date;
  agentIds?: string[];
}

function AgentTag({ agentId }: { agentId: string }) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return null;
  return (
    <View style={[styles.agentTag, { borderColor: agent.cor }]}>
      <Text style={{ fontSize: 10, color: agent.cor }}>{agent.emoji} {agent.nome}</Text>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([{
    id: "0", role: "ceo",
    content: "📾 **CoreByte CEO IA online.**\n\nOlá, Carlos! Todos os **14 agentes especializados** estão prontos. Pode me fazer qualquer pergunta sobre licitações, financeiro, jurídico, desenvolvimento, marketing e muito mais.\n\nComo posso ajudar a CoreByte hoje?",
    timestamp: new Date(),
  }]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;

  const startDotAnim = useCallback(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ])).start();
  }, [dotAnim]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setIsTyping(true);
    startDotAnim();
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    const agentIds = detectAgents(text);
    const response = getCeoResponse(agentIds);
    const ceoMsg: Message = { id: (Date.now()+1).toString(), role: "ceo", content: response, timestamp: new Date(), agentIds };
    setIsTyping(false);
    dotAnim.stopAnimation();
    setMessages(p => [...p, ceoMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, dotAnim, startDotAnim]);

  const renderMsg = useCallback(({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && <View style={styles.avatar}><Text style={{fontSize:18}}><'📾</Text></View>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCeo]}>
          {item.agentIds && item.agentIds.length > 0 && (
            <View style={styles.agentTags}>{item.agentIds.map(id => <AgentTag key={id} agentId={id} />)}</View>
          )}
          {isUser
            ? <Text style={styles.userText}>{item.content}</Text>
            : <Markdown style={markdownStyles}>{item.content}</Markdown>
          }
          <Text style={styles.timestamp}>{item.timestamp.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</Text>
        </View>
        {isUser && <View style={[styles.avatar,styles.avatarUser]}><Text style={{fontSize:18}}>👐</Text></View>}
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>📾</Text>
          <View>
            <Text style={styles.headerTitle}>CEO IA</Text>
            <Text style={styles.headerSub}>CoreByte Command Center</Text>
          </View>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>
      <FlatList ref={flatListRef} data={messages} keyExtractor={i => i.id}
        renderItem={renderMsg} contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated:true})}
        showsVerticalScrollIndicator={false} />
      {isTyping && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}><Text style={{fontSize:16}}><'📾</Text></View>
          <View style={styles.typingBubble}>
            <Animated.Text style={[styles.typingDots,{opacity:dotAnim}]}>┅┅┅</Animated.Text>
            <Text style={styles.typingText}> CEO IA digitando...</Text>
          </View>
        </View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS==="ios'?"padding":"height"} keyboardVerticalOffset={Platform.OS==="ios"?0:20}>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} placeholder="Pergunte ao CEO IA..."
            placeholderTextColor={COLORS.subtext} value={inputText} onChangeText={setInputText}
            onSubmitEditing={sendMessage} returnKeyType="send" multiline maxLength={1000} />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim()&&styles.sendBtnDisabled]}
            onPress={sendMessage} disabled={!inputText.trim()||isTyping}>
            {isTyping ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendIcon}>⚤</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  strong: { color: COLORS.cyan, fontWeight: "700" as const },
  heading1: { color: COLORS.blue, fontSize: 18, fontWeight: "700" as const },
  heading2: { color: COLORS.blue, fontSize: 16, fontWeight: "700" as const },
  bullet_list: { color: COLORS.text },
  list_item: { color: COLORS.text, marginVertical: 2 },
  code_inline: { backgroundColor: "#0D1929", color: COLORS.cyan, borderRadius: 4, paddingHorizontal: 4 },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:COLORS.border,backgroundColor:"#0D1929" },
  headerLeft: { flexDirection:"row",alignItems:"center",gap:10 },
  headerEmoji: { fontSize: 32 },
  headerTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  headerSub: { color: COLORS.subtext, fontSize: 12 },
  onlineBadge: { flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"#0D2D1A",paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1,borderColor:COLORS.success },
  onlineDot: { width:7,height:7,borderRadius:4,backgroundColor:COLORS.success },
  onlineText: { color: COLORS.success, fontSize: 11, fontWeight: "600" },
  messagesList: { paddingHorizontal:12,paddingVertical:16,paddingBottom:8 },
  msgRow: { flexDirection:"row",marginBottom:16,maxWidth:"92%" },
  msgRowUser: { alignSelf:"flex-end",flexDirection:"row-reverse" },
  avatar: { width:36,height:36,borderRadius:18,backgroundColor:COLORS.card,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:COLORS.border,marginHorizontal:6 },
  avatarUser: { borderColor: COLORS.blue },
  bubble: { flex:1,borderRadius:16,padding:12,maxWidth:"88%" },
  bubbleCeo: { backgroundColor:COLORS.card,borderWidth:1,borderColor:COLORS.border,borderTopLeftRadius:4 },
  bubbleUser: { backgroundColor:"#1D3A5F",borderWidth:1,borderColor:COLORS.blue,borderTopRightRadius:4 },
  userText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  timestamp: { color:COLORS.subtext,fontSize:10,marginTop:4,textAlign:"right" },
  agentTags: { flexDirection:"row",flexWrap:"wrap",gap:4,marginBottom:6 },
  agentTag: { borderWidth:1,borderRadius:10,paddingHorizontal:7,paddingVertical:2,backgroundColor:"#0D1929" },
  typingRow: { flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingBottom:8 },
  typingBubble: { flexDirection:"row",alignItems:"center",backgroundColor:COLORS.card,borderRadius:16,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:COLORS.border },
  typingDots: { color: COLORS.cyan, fontSize: 12 },
  typingText: { color: COLORS.subtext, fontSize: 12 },
  inputRow: { flexDirection:"row",alignItems:"flex-end",gap:8,paddingHorizontal:12,paddingVertical:10,borderTopWidth:1,borderTopColor:COLORS.border,backgroundColor:"#0D1929" },
  input: { flex:1,backgroundColor:COLORS.card,color:COLORS.text,borderRadius:24,paddingHorizontal:16,paddingVertical:10,fontSize:14,borderWidth:1,borderColor:COLORS.border,naxHeight:100 },
  sendBtn: { width:44,height:44,borderRadius:22,backgroundColor:COLORS.blue,alignItems:"center",justifyContent:"center" },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendIcon: { color:"#fff",fontSize:16,fontWeight:"700" },
});