const fs = require('fs');

const zones = {
    "Nord": ["Métropole Lilloise", "Monts de Flandre", "Avesnois", "Pévèle Carembault", "Cambrésis", "Valenciennois", "Plaine de la Lys", "Littoral Dunkerquois", "Douaisis"],
    "Pas-de-Calais": ["Côte d'Opale", "Boulonnais", "Bassin Minier", "Arrageois", "Audomarois", "Ternois", "Sept Vallées", "Calaisis"],
    "Somme": ["Baie de Somme", "Vallée de la Somme", "Amiénois", "Santerre", "Ponthieu", "Vimeu"],
    "Oise": ["Forêt de Compiègne", "Massif de Chantilly", "Beauvaisis", "Valois", "Pays de Bray", "Clermontois"],
    "Aisne": ["Thiérache", "Laonnois", "Vallée de l'Aisne", "Soissonnais", "Saint-Quentinois", "Vermandois"]
};

const sports = ["Running", "Trail", "Randonnée", "Vélo (Route)", "VTT"];
const diffs = ["Facile", "Moyen", "Difficile"];
const types = ["Boucle", "Aller simple"];
const debs = ["La Boucle des", "Le Sentier du", "Le Circuit de la", "L'Assaut du", "La Traversée de", "Le Tour du", "Les Balcons de", "Le Chemin des", "La Route des", "L'Échappée du"];
const mils = ["Vieux", "Grand", "Petit", "Secret", "Sauvage", "Royal", "Historique", "Vert", "Bleu", "Ombragé"];
const fins = ["Loup", "Abbaye", "Moulins", "Remparts", "Château", "Dunes", "Terrils", "Étangs", "Bocages", "Vallées"];

const parcours = [];
for (let i = 1; i <= 10000; i++) {
    const depts = Object.keys(zones);
    const dept = depts[Math.floor(Math.random() * depts.length)];
    const zone = zones[dept][Math.floor(Math.random() * zones[dept].length)];
    const sport = sports[Math.floor(Math.random() * sports.length)];
    const diff = diffs[Math.floor(Math.random() * diffs.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    const dist = (Math.random() * (40 - 5) + 5).toFixed(2);
    const deniv = Math.floor(dist * (Math.random() * (25 - 5) + 5));
    const hrs = Math.floor(dist / 10 + 1);
    const mins = Math.floor(Math.random() * 60);
    const temps = `${hrs}h${mins < 10 ? '0' : ''}${mins}`;

    parcours.push({
        id: i,
        nom: `${debs[i % debs.length]} ${mils[i % mils.length]} ${fins[i % fins.length]} n°${i}`,
        sport: sport,
        difficulte: diff,
        type_parcours: type,
        distance_km: parseFloat(dist),
        denivele_positif_m: deniv,
        denivele_negatif_m: Math.floor(deniv * 0.95),
        temps_estime: temps,
        calories_kcal: Math.floor(dist * 70),
        pente_mean: (deniv / (dist * 10)).toFixed(1),
        altitude_min_m: Math.floor(Math.random() * 100 + 10),
        altitude_max_m: Math.floor(deniv + 50),
        localisation: { departement: dept, zone: zone },
        description: `Itinéraire magnifique de ${sport.toLowerCase()} de niveau ${diff.toLowerCase()} dans la zone de ${zone}.`
    });
}

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/dataset.json', JSON.stringify(parcours, null, 2), 'utf-8');
console.log("Fichier de 10000 parcours généré avec succès ! (data/dataset.json)");
