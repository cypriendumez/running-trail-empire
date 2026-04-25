import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, MapPin, Mountain, Calendar, Zap } from "lucide-react-native";
import { useState } from "react";

const RACES = [
  { id: "1", name: "UTMB Mont-Blanc", type: "Ultra", region: "Haute-Savoie", date: "28 Août 2026", distance: 171, elevation: 10000, difficulty: "black" },
  { id: "2", name: "Marathon de Paris", type: "Marathon", region: "Paris", date: "5 Avr. 2026", distance: 42.2, elevation: 180, difficulty: "blue" },
  { id: "3", name: "Trail des Glières", type: "Trail M", region: "Haute-Savoie", date: "14 Juin 2026", distance: 43, elevation: 2800, difficulty: "red" },
  { id: "4", name: "Maxi Race Annecy", type: "Trail XL", region: "Haute-Savoie", date: "23 Mai 2026", distance: 115, elevation: 6500, difficulty: "black" },
  { id: "5", name: "Semi de Lyon", type: "Semi", region: "Rhône", date: "1 Mars 2026", distance: 21.1, elevation: 80, difficulty: "green" },
];

const DIFF_COLORS: Record<string, string> = {
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b",
};

export default function RacesScreen() {
  const [search, setSearch] = useState("");
  const filtered = RACES.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Courses France</Text>
        <Text style={styles.subtitle}>{filtered.length} courses · Route & Trail</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color="#A1A1AA" />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Rechercher une course..."
          placeholderTextColor="#A1A1AA"
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(race => (
          <TouchableOpacity key={race.id} style={styles.raceCard} activeOpacity={0.7}>
            <View style={[styles.diffBar, { backgroundColor: DIFF_COLORS[race.difficulty] }]} />
            <View style={styles.raceContent}>
              <View style={styles.raceHeader}>
                <Text style={styles.raceName}>{race.name}</Text>
                <View style={[styles.diffBadge, { backgroundColor: DIFF_COLORS[race.difficulty] + "22", borderColor: DIFF_COLORS[race.difficulty] + "44" }]}>
                  <Text style={[styles.diffText, { color: DIFF_COLORS[race.difficulty] }]}>
                    {race.difficulty.charAt(0).toUpperCase()}{race.difficulty.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.raceMeta}>
                <View style={styles.metaItem}>
                  <Calendar size={11} color="#A1A1AA" />
                  <Text style={styles.metaText}>{race.date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MapPin size={11} color="#A1A1AA" />
                  <Text style={styles.metaText}>{race.region}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Zap size={11} color="#A1A1AA" />
                  <Text style={styles.metaText}>{race.distance} km</Text>
                </View>
                {race.elevation > 0 && (
                  <View style={styles.metaItem}>
                    <Mountain size={11} color="#A1A1AA" />
                    <Text style={styles.metaText}>+{race.elevation.toLocaleString()}m</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.trainBtn}>
                <Text style={styles.trainBtnText}>M&apos;entraîner pour cette course</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#09090B" },
  subtitle: { fontSize: 13, color: "#71717A", marginTop: 2 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 12, backgroundColor: "white", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#E4E4E7" },
  searchInput: { flex: 1, fontSize: 14, color: "#09090B" },
  list: { flex: 1, paddingHorizontal: 20 },
  raceCard: { flexDirection: "row", backgroundColor: "white", borderRadius: 20, marginBottom: 10, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  diffBar: { width: 4 },
  raceContent: { flex: 1, padding: 14 },
  raceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  raceName: { fontSize: 15, fontWeight: "600", color: "#09090B", flex: 1, marginRight: 8 },
  diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  diffText: { fontSize: 10, fontWeight: "600" },
  raceMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: "#71717A" },
  trainBtn: { backgroundColor: "#09090B", borderRadius: 12, paddingVertical: 8, alignItems: "center" },
  trainBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
});
