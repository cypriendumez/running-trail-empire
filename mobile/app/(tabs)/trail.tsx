import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mountain, Zap, Download, Wifi, Map } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function TrailScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trail Builder</Text>
        <Text style={styles.subtitle}>Cartographie SIG · Export Garmin/Coros</Text>
      </View>

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder}>
        <Mountain size={48} color="#D4D4D8" />
        <Text style={styles.mapPlaceholderTitle}>Carte Interactive</Text>
        <Text style={styles.mapPlaceholderSub}>Configurez votre clé Mapbox{"\n"}dans les paramètres de l&apos;app</Text>
      </View>

      {/* Mode selector */}
      <View style={styles.modeRow}>
        {[
          { label: "👁️ Vue", active: true },
          { label: "✏️ Tracer", active: false },
          { label: "✨ Générer", active: false },
        ].map(m => (
          <TouchableOpacity key={m.label} style={[styles.modeBtn, m.active && styles.modeBtnActive]}>
            <Text style={[styles.modeBtnText, m.active && styles.modeBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Generate section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Zap size={16} color="#22c55e" />
          <Text style={styles.cardTitle}>Génération Auto</Text>
        </View>
        <Text style={styles.cardSub}>Distance cible : 20 km · Dénivelé : 800m D+</Text>
        <TouchableOpacity style={styles.generateBtn}>
          <Zap size={16} color="white" />
          <Text style={styles.generateBtnText}>Générer l&apos;itinéraire</Text>
        </TouchableOpacity>
      </View>

      {/* Export */}
      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportBtn}>
          <Download size={16} color="#09090B" />
          <Text style={styles.exportBtnText}>Export GPX</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn}>
          <Wifi size={16} color="#09090B" />
          <Text style={styles.exportBtnText}>Sync Garmin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn}>
          <Map size={16} color="#09090B" />
          <Text style={styles.exportBtnText}>Sync Coros</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#09090B" },
  subtitle: { fontSize: 13, color: "#71717A", marginTop: 2 },
  mapPlaceholder: { marginHorizontal: 20, height: 220, backgroundColor: "#F4F4F5", borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  mapPlaceholderTitle: { fontSize: 16, fontWeight: "600", color: "#A1A1AA" },
  mapPlaceholderSub: { fontSize: 12, color: "#A1A1AA", textAlign: "center" },
  modeRow: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#E4E4E7" },
  modeBtnActive: { backgroundColor: "#09090B", borderColor: "#09090B" },
  modeBtnText: { fontSize: 12, fontWeight: "600", color: "#71717A" },
  modeBtnTextActive: { color: "white" },
  card: { backgroundColor: "white", borderRadius: 24, padding: 16, marginHorizontal: 20, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#09090B" },
  cardSub: { fontSize: 12, color: "#71717A", marginBottom: 12 },
  generateBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  generateBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  exportRow: { flexDirection: "row", gap: 8, marginHorizontal: 20 },
  exportBtn: { flex: 1, backgroundColor: "white", borderRadius: 16, paddingVertical: 12, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#E4E4E7" },
  exportBtnText: { fontSize: 11, fontWeight: "600", color: "#09090B" },
});
