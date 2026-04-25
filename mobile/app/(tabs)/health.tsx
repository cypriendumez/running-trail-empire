import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield, Heart, AlertTriangle, Utensils, Zap, Droplets } from "lucide-react-native";
import { useState } from "react";

export default function HealthScreen() {
  const [guardianEnabled, setGuardianEnabled] = useState(false);
  const [raceHours, setRaceHours] = useState(6);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Santé & Sécurité</Text>

        {/* Guardian Mode */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Shield size={18} color={guardianEnabled ? "#22c55e" : "#71717A"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Guardian Mode</Text>
              <Text style={styles.cardSub}>Détection chute · Alerte GPS · SOS automatique</Text>
            </View>
            <TouchableOpacity
              onPress={() => setGuardianEnabled(!guardianEnabled)}
              style={[styles.toggle, { backgroundColor: guardianEnabled ? "#22c55e" : "#E4E4E7" }]}
            >
              <View style={[styles.toggleThumb, { transform: [{ translateX: guardianEnabled ? 18 : 2 }] }]} />
            </TouchableOpacity>
          </View>
          {guardianEnabled && (
            <View style={styles.activeAlert}>
              <Text style={styles.activeAlertText}>✅ Guardian actif — Surveillance en temps réel</Text>
            </View>
          )}
        </View>

        {/* Body pain report */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SIGNALER UNE DOULEUR</Text>
          <Text style={styles.cardSub}>Cliquez sur la zone concernée</Text>
          <View style={styles.bodyParts}>
            {["Genou G", "Genou D", "Cheville G", "Cheville D", "Mollet G", "Mollet D", "Hanche G", "Hanche D", "Dos lombaire", "Ischio G"].map(part => (
              <TouchableOpacity key={part} style={styles.bodyPart}>
                <Text style={styles.bodyPartText}>{part}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nutrition */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Utensils size={16} color="#71717A" />
            <Text style={styles.cardTitle}>Nutrition Lab</Text>
          </View>
          <Text style={styles.cardSub}>Épreuve de 6h · Température : 15°C</Text>
          <View style={styles.nutriGrid}>
            <View style={[styles.nutriCard, { backgroundColor: "#FFF7ED" }]}>
              <Zap size={20} color="#F97316" />
              <Text style={styles.nutriValue}>45</Text>
              <Text style={styles.nutriUnit}>g glucides/h</Text>
            </View>
            <View style={[styles.nutriCard, { backgroundColor: "#EFF6FF" }]}>
              <Droplets size={20} color="#3B82F6" />
              <Text style={styles.nutriValue}>500</Text>
              <Text style={styles.nutriUnit}>ml eau/h</Text>
            </View>
            <View style={[styles.nutriCard, { backgroundColor: "#F5F3FF" }]}>
              <Text style={{ fontSize: 20 }}>🧂</Text>
              <Text style={styles.nutriValue}>650</Text>
              <Text style={styles.nutriUnit}>mg sodium/h</Text>
            </View>
            <View style={[styles.nutriCard, { backgroundColor: "#F0FDF4" }]}>
              <Text style={{ fontSize: 20 }}>☕</Text>
              <Text style={styles.nutriValue}>120</Text>
              <Text style={styles.nutriUnit}>mg caféine</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#09090B", marginBottom: 16 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 18, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F4F4F5", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#09090B" },
  cardSub: { fontSize: 12, color: "#71717A", marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: "center" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  activeAlert: { backgroundColor: "#F0FDF4", borderRadius: 14, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#BBF7D0" },
  activeAlertText: { fontSize: 12, color: "#15803D", fontWeight: "500" },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  bodyParts: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  bodyPart: { backgroundColor: "#F4F4F5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  bodyPartText: { fontSize: 12, color: "#71717A", fontWeight: "500" },
  nutriGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  nutriCard: { flex: 1, minWidth: "45%", borderRadius: 18, padding: 14, alignItems: "center", gap: 4 },
  nutriValue: { fontSize: 22, fontWeight: "700", color: "#09090B" },
  nutriUnit: { fontSize: 10, color: "#71717A", textAlign: "center" },
});
