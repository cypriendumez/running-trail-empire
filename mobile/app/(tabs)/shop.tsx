import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingBag, Zap, AlertTriangle, Star } from "lucide-react-native";

const PRODUCTS = [
  { id: "1", brand: "Nike", model: "Vaporfly 3", price: 249.99, retailer: "i-Run", score: 94, terrain: "Route", weight: 195, drop: 8, inStock: true },
  { id: "2", brand: "Hoka", model: "Speedgoat 6", price: 169.99, retailer: "Alltricks", score: 88, terrain: "Trail", weight: 320, drop: 4, inStock: true },
  { id: "3", brand: "Salomon", model: "Ultra Glide 2", price: 149.99, retailer: "Lepape", score: 82, terrain: "Trail", weight: 290, drop: 8, inStock: true },
  { id: "4", brand: "Brooks", model: "Ghost 16", price: 139.99, retailer: "i-Run", score: 71, terrain: "Route", weight: 268, drop: 12, inStock: false },
];

const SHOES_GARAGE = [
  { name: "Hoka Speedgoat 5", km: 412, maxKm: 600 },
  { name: "Nike Pegasus 40", km: 584, maxKm: 600 },
];

export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Shopping Hub</Text>
        <Text style={styles.subtitle}>Score Bio-Compatibilité · Comparateur prix</Text>

        {/* Garage */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MON GARAGE</Text>
          {SHOES_GARAGE.map(shoe => {
            const pct = shoe.km / shoe.maxKm;
            const worn = pct > 0.9;
            return (
              <View key={shoe.name} style={styles.shoeCard}>
                <Text style={styles.shoeName}>{shoe.name}</Text>
                <View style={styles.shoeKmRow}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: worn ? "#ef4444" : pct > 0.7 ? "#f97316" : "#22c55e" }]} />
                  </View>
                  <Text style={[styles.shoeKm, worn && { color: "#ef4444" }]}>{shoe.km}/{shoe.maxKm} km</Text>
                </View>
                {worn && (
                  <View style={styles.wornAlert}>
                    <AlertTriangle size={12} color="#ef4444" />
                    <Text style={styles.wornText}>Remplacement recommandé</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Products */}
        <Text style={styles.sectionLabel}>CHAUSSURES RECOMMANDÉES</Text>
        {PRODUCTS.map(p => (
          <TouchableOpacity key={p.id} style={styles.productCard} activeOpacity={0.7}>
            <View style={styles.productIcon}>
              <ShoppingBag size={20} color="#D4D4D8" />
            </View>
            <View style={styles.productInfo}>
              <View style={styles.productHeader}>
                <Text style={styles.productName}>{p.brand} {p.model}</Text>
                <Text style={styles.productPrice}>{p.price.toFixed(0)}€</Text>
              </View>
              <View style={styles.productMeta}>
                <Text style={styles.metaChip}>{p.terrain}</Text>
                <Text style={styles.metaChip}>Drop {p.drop}mm</Text>
                <Text style={styles.metaChip}>{p.weight}g</Text>
                <Text style={styles.retailer}>{p.retailer}</Text>
              </View>
              {!p.inStock && <Text style={styles.outOfStock}>Rupture de stock</Text>}
            </View>
            <View style={[styles.scoreCircle, { borderColor: p.score >= 90 ? "#22c55e" : p.score >= 75 ? "#f59e0b" : "#A1A1AA" }]}>
              <Text style={[styles.scoreVal, { color: p.score >= 90 ? "#22c55e" : p.score >= 75 ? "#f59e0b" : "#A1A1AA" }]}>{p.score}</Text>
              <Text style={styles.scoreLabel}>IA</Text>
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
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#09090B" },
  subtitle: { fontSize: 13, color: "#71717A", marginTop: 2, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  shoeCard: { backgroundColor: "white", borderRadius: 18, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  shoeName: { fontSize: 14, fontWeight: "600", color: "#09090B", marginBottom: 8 },
  shoeKmRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: "#F4F4F5", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  shoeKm: { fontSize: 11, fontWeight: "600", color: "#71717A" },
  wornAlert: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  wornText: { fontSize: 11, color: "#ef4444", fontWeight: "500" },
  productCard: { flexDirection: "row", backgroundColor: "white", borderRadius: 20, padding: 14, marginBottom: 10, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  productIcon: { width: 52, height: 40, backgroundColor: "#F4F4F5", borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  productInfo: { flex: 1 },
  productHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  productName: { fontSize: 14, fontWeight: "600", color: "#09090B" },
  productPrice: { fontSize: 15, fontWeight: "700", color: "#09090B" },
  productMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  metaChip: { fontSize: 10, color: "#71717A", backgroundColor: "#F4F4F5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  retailer: { fontSize: 10, color: "#3b82f6", fontWeight: "600" },
  outOfStock: { fontSize: 10, color: "#ef4444", fontWeight: "500", marginTop: 3 },
  scoreCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  scoreVal: { fontSize: 14, fontWeight: "700" },
  scoreLabel: { fontSize: 8, color: "#A1A1AA", fontWeight: "500" },
});
