import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Activity, Heart, Trophy, Zap, TrendingUp, Calendar } from "lucide-react-native";

const { width } = Dimensions.get("window");

const STATE_COLORS = {
  recovery: { bg: "#E0F2FE", accent: "#0284C7", label: "Mode Récupération", emoji: "💙" },
  optimal: { bg: "#D1FAE5", accent: "#059669", label: "Forme Optimale", emoji: "💚" },
  competition: { bg: "#FFEDD5", accent: "#EA580C", label: "Jour de Course", emoji: "🔥" },
};

export default function DashboardScreen() {
  const state = STATE_COLORS.optimal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: state.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.stateRow}>
              <Text style={styles.stateEmoji}>{state.emoji}</Text>
              <Text style={[styles.stateLabel, { color: state.accent }]}>{state.label}</Text>
            </View>
            <Text style={styles.greeting}>Bonjour, Champion 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: state.accent }]}>
            <Text style={styles.avatarText}>C</Text>
          </View>
        </View>

        {/* Discipline Score */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SCORE DISCIPLINE</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>82</Text>
              <Text style={styles.scoreUnit}>/100</Text>
            </View>
            <View style={styles.scoreBreakdown}>
              {[
                { label: "Précision", val: 85 },
                { label: "Assiduité", val: 80 },
                { label: "Récupération", val: 78 },
              ].map(m => (
                <View key={m.label} style={styles.scoreItem}>
                  <View style={styles.scoreItemHeader}>
                    <Text style={styles.scoreItemLabel}>{m.label}</Text>
                    <Text style={styles.scoreItemVal}>{m.val}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${m.val}%`, backgroundColor: state.accent }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          {[
            { label: "Volume Semaine", value: "47.3", unit: "km", icon: Activity, color: "#22c55e" },
            { label: "VFC Aujourd'hui", value: "62", unit: "ms", icon: Heart, color: "#ef4444" },
            { label: "Ligue", value: "Or", unit: "#247", icon: Trophy, color: "#d97706" },
            { label: "Prochaine séance", value: "Dim", unit: "Long run Z2", icon: Calendar, color: "#6366f1" },
          ].map(stat => (
            <View key={stat.label} style={styles.statCard}>
              <stat.icon size={16} color={stat.color} strokeWidth={2} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statUnit}>{stat.unit}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Next session */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>PROCHAINE SÉANCE</Text>
            <Calendar size={16} color="#A1A1AA" />
          </View>
          <Text style={styles.sessionTitle}>Sortie Longue Zone 2</Text>
          <Text style={styles.sessionSub}>Dimanche · 2h20 · 25 km · Allure : 5'45"/km</Text>
          <View style={styles.tags}>
            {["Z2", "25 km", "2h20"].map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#09090B" }]}>
            <Zap size={16} color="white" />
            <Text style={[styles.actionText, { color: "white" }]}>Démarrer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E4E7" }]}>
            <TrendingUp size={16} color="#09090B" />
            <Text style={[styles.actionText, { color: "#09090B" }]}>Analyser</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  stateEmoji: { fontSize: 14 },
  stateLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#09090B" },
  date: { fontSize: 13, color: "#71717A", marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontSize: 18, fontWeight: "700" },
  card: { backgroundColor: "white", borderRadius: 24, padding: 18, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  scoreRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  scoreCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  scoreValue: { fontSize: 26, fontWeight: "700", color: "#09090B" },
  scoreUnit: { fontSize: 10, color: "#A1A1AA" },
  scoreBreakdown: { flex: 1, gap: 8 },
  scoreItem: { gap: 4 },
  scoreItemHeader: { flexDirection: "row", justifyContent: "space-between" },
  scoreItemLabel: { fontSize: 11, color: "#71717A" },
  scoreItemVal: { fontSize: 11, fontWeight: "600", color: "#09090B" },
  progressBar: { height: 4, backgroundColor: "#F4F4F5", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: { backgroundColor: "white", borderRadius: 20, padding: 14, width: (width - 50) / 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 24, fontWeight: "700", color: "#09090B", marginTop: 8 },
  statUnit: { fontSize: 11, color: "#A1A1AA" },
  statLabel: { fontSize: 10, color: "#71717A", marginTop: 2, fontWeight: "500" },
  sessionTitle: { fontSize: 17, fontWeight: "600", color: "#09090B" },
  sessionSub: { fontSize: 12, color: "#71717A", marginTop: 4 },
  tags: { flexDirection: "row", gap: 6, marginTop: 10 },
  tag: { backgroundColor: "#F4F4F5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: "500", color: "#71717A" },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 18 },
  actionText: { fontSize: 14, fontWeight: "600" },
});
