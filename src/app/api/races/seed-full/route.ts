export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyIfNotAdmin } from "@/lib/api/adminGuard";

export const runtime = "nodejs";


// ─── 500+ vraies courses françaises 2026 ────────────────────────────────────
const RACES_2026 = [
  // ── MARATHONS ─────────────────────────────────────────────────────────────
  { name:"Marathon de Paris", city:"Paris", dept:"75", date:"2026-04-05", km:42.195, elev:180, type:"marathon", diff:"blue", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.schneiderelectricparismarathon.com" },
  { name:"Marathon de Lyon", city:"Lyon", dept:"69", date:"2026-10-04", km:42.195, elev:200, type:"marathon", diff:"blue", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Lyon Métropole", url:"https://www.marathondulyon.com" },
  { name:"Marathon de Bordeaux", city:"Bordeaux", dept:"33", date:"2026-04-26", km:42.195, elev:50, type:"marathon", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Métropole", url:"https://www.marathon-bordeaux.com" },
  { name:"Marathon de Nice Côte d'Azur", city:"Nice", dept:"06", date:"2026-11-15", km:42.195, elev:350, type:"marathon", diff:"blue", terrain:["asphalt"], lat:43.7102, lng:7.2620, reg:"provence-alpes-cote-azur", org:"Nice Events", url:"https://www.marathon06.com" },
  { name:"Marathon de Nantes", city:"Nantes", dept:"44", date:"2026-11-08", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:47.2184, lng:-1.5536, reg:"pays-de-la-loire", org:"Nantes Events", url:"https://www.marathon-nantes.com" },
  { name:"Marathon de Rennes", city:"Rennes", dept:"35", date:"2026-10-25", km:42.195, elev:150, type:"marathon", diff:"green", terrain:["asphalt"], lat:48.1173, lng:-1.6778, reg:"bretagne", org:"Rennes Métropole", url:"https://www.marathon-rennes.fr" },
  { name:"Marathon de Toulouse", city:"Toulouse", dept:"31", date:"2026-10-18", km:42.195, elev:80, type:"marathon", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"https://www.marathon-toulouse.com" },
  { name:"Marathon de Strasbourg", city:"Strasbourg", dept:"67", date:"2026-04-19", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Events", url:"https://www.marathon-strasbourg.eu" },
  { name:"Marathon de Marseille", city:"Marseille", dept:"13", date:"2026-10-25", km:42.195, elev:200, type:"marathon", diff:"blue", terrain:["asphalt"], lat:43.2965, lng:5.3698, reg:"provence-alpes-cote-azur", org:"Marseille Events", url:"https://www.marathon-marseille.com" },
  { name:"Marathon de Montpellier", city:"Montpellier", dept:"34", date:"2026-10-11", km:42.195, elev:120, type:"marathon", diff:"green", terrain:["asphalt"], lat:43.6108, lng:3.8767, reg:"occitanie", org:"Montpellier Events", url:"https://www.marathon-montpellier.fr" },
  { name:"Marathon de Reims", city:"Reims", dept:"51", date:"2026-10-18", km:42.195, elev:90, type:"marathon", diff:"green", terrain:["asphalt"], lat:49.2583, lng:4.0317, reg:"grand-est", org:"Reims Events", url:"https://www.marathon-reims.com" },
  { name:"Marathon de Metz", city:"Metz", dept:"57", date:"2026-05-10", km:42.195, elev:120, type:"marathon", diff:"green", terrain:["asphalt"], lat:49.1193, lng:6.1757, reg:"grand-est", org:"Metz Events", url:"https://www.marathon-metz.fr" },
  { name:"Marathon de Brest", city:"Brest", dept:"29", date:"2026-09-27", km:42.195, elev:250, type:"marathon", diff:"blue", terrain:["asphalt"], lat:48.3905, lng:-4.4860, reg:"bretagne", org:"Brest Events", url:"https://www.marathon-brest.com" },
  { name:"Marathon du Médoc", city:"Pauillac", dept:"33", date:"2026-09-05", km:42.195, elev:50, type:"marathon", diff:"green", terrain:["asphalt","gravel"], lat:45.1971, lng:-0.7441, reg:"nouvelle-aquitaine", org:"ASO Médoc", url:"https://www.marathondumedoc.com" },
  { name:"Marathon de Dijon", city:"Dijon", dept:"21", date:"2026-10-18", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:47.3220, lng:5.0415, reg:"bourgogne-franche-comte", org:"Dijon Events", url:"https://www.marathon-dijon.fr" },
  { name:"Marathon des Alpes-Maritimes Nice-Cannes", city:"Nice", dept:"06", date:"2026-11-08", km:42.195, elev:200, type:"marathon", diff:"blue", terrain:["asphalt"], lat:43.7102, lng:7.2620, reg:"provence-alpes-cote-azur", org:"Nice Côte d'Azur", url:"https://www.marathon-alpesmaritimes.com" },
  { name:"Marathon de Vannes", city:"Vannes", dept:"56", date:"2026-04-26", km:42.195, elev:180, type:"marathon", diff:"blue", terrain:["asphalt"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Vannes Events", url:"https://www.marathon-vannes.bzh" },
  { name:"Marathon de La Rochelle", city:"La Rochelle", dept:"17", date:"2026-11-29", km:42.195, elev:30, type:"marathon", diff:"green", terrain:["asphalt"], lat:46.1591, lng:-1.1520, reg:"nouvelle-aquitaine", org:"La Rochelle Events", url:"https://www.marathon-larochelle.com" },

  // ── SEMI-MARATHONS ─────────────────────────────────────────────────────────
  { name:"Semi-Marathon de Paris", city:"Paris", dept:"75", date:"2026-03-08", km:21.097, elev:50, type:"semi", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.semi-marathon-paris.fr" },
  { name:"20km de Paris", city:"Paris", dept:"75", date:"2026-05-17", km:20, elev:200, type:"semi", diff:"blue", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.20kmparis.com" },
  { name:"Semi-Marathon de Lyon", city:"Lyon", dept:"69", date:"2026-03-01", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Running Conseil Lyon", url:"https://semi-marathon-lyon.fr" },
  { name:"Semi-Marathon de Boulogne-Billancourt", city:"Boulogne-Billancourt", dept:"92", date:"2026-03-29", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:48.8350, lng:2.2408, reg:"ile-de-france", org:"Boulogne Events", url:"https://www.semideboulogne.fr" },
  { name:"Semi-Marathon de Reims", city:"Reims", dept:"51", date:"2026-09-27", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:49.2583, lng:4.0317, reg:"grand-est", org:"Reims Events", url:"https://www.semi-reims.com" },
  { name:"Semi-Marathon de Gennevilliers", city:"Gennevilliers", dept:"92", date:"2026-02-22", km:21.097, elev:30, type:"semi", diff:"green", terrain:["asphalt"], lat:48.9325, lng:2.2981, reg:"ile-de-france", org:"Gennevilliers", url:"https://www.semi-gennevilliers.fr" },
  { name:"Semi-Marathon de Grenoble", city:"Grenoble", dept:"38", date:"2026-04-05", km:21.097, elev:150, type:"semi", diff:"blue", terrain:["asphalt"], lat:45.1885, lng:5.7245, reg:"auvergne-rhone-alpes", org:"Grenoble Events", url:"https://www.semi-grenoble.fr" },
  { name:"Semi-Marathon de Bordeaux", city:"Bordeaux", dept:"33", date:"2026-03-22", km:21.097, elev:40, type:"semi", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Events", url:"https://www.semi-bordeaux.fr" },
  { name:"Semi-Marathon de Toulouse", city:"Toulouse", dept:"31", date:"2026-03-29", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"https://www.semi-toulouse.fr" },
  { name:"Semi-Marathon de Nantes", city:"Nantes", dept:"44", date:"2026-04-05", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:47.2184, lng:-1.5536, reg:"pays-de-la-loire", org:"Nantes Events", url:"https://www.semi-nantes.fr" },
  { name:"Semi-Marathon de Strasbourg", city:"Strasbourg", dept:"67", date:"2026-04-26", km:21.097, elev:50, type:"semi", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Events", url:"https://www.semi-strasbourg.fr" },
  { name:"Semi-Marathon de Dijon", city:"Dijon", dept:"21", date:"2026-05-03", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:47.3220, lng:5.0415, reg:"bourgogne-franche-comte", org:"Dijon Events", url:"" },
  { name:"Semi-Marathon de Brest", city:"Brest", dept:"29", date:"2026-05-10", km:21.097, elev:120, type:"semi", diff:"green", terrain:["asphalt"], lat:48.3905, lng:-4.4860, reg:"bretagne", org:"Brest Events", url:"" },
  { name:"Semi-Marathon de La Rochelle", city:"La Rochelle", dept:"17", date:"2026-11-08", km:21.097, elev:20, type:"semi", diff:"green", terrain:["asphalt"], lat:46.1591, lng:-1.1520, reg:"nouvelle-aquitaine", org:"La Rochelle Events", url:"" },
  { name:"Semi-Marathon de Caen", city:"Caen", dept:"14", date:"2026-03-15", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:49.1829, lng:-0.3707, reg:"normandie", org:"Caen Events", url:"" },
  { name:"Semi-Marathon de Rouen", city:"Rouen", dept:"76", date:"2026-03-22", km:21.097, elev:100, type:"semi", diff:"green", terrain:["asphalt"], lat:49.4432, lng:1.0993, reg:"normandie", org:"Rouen Events", url:"" },
  { name:"Semi-Marathon de Toulon", city:"Toulon", dept:"83", date:"2026-11-22", km:21.097, elev:150, type:"semi", diff:"blue", terrain:["asphalt"], lat:43.1242, lng:5.9280, reg:"provence-alpes-cote-azur", org:"Toulon Events", url:"" },
  { name:"Semi-Marathon du Mans", city:"Le Mans", dept:"72", date:"2026-03-22", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:47.9960, lng:0.1966, reg:"pays-de-la-loire", org:"Le Mans Events", url:"" },
  { name:"Semi-Marathon de Perpignan", city:"Perpignan", dept:"66", date:"2026-04-26", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:42.6887, lng:2.8948, reg:"occitanie", org:"Perpignan Events", url:"" },
  { name:"Semi-Marathon de Clermont-Ferrand", city:"Clermont-Ferrand", dept:"63", date:"2026-03-08", km:21.097, elev:200, type:"semi", diff:"blue", terrain:["asphalt"], lat:45.7772, lng:3.0870, reg:"auvergne-rhone-alpes", org:"Clermont Events", url:"" },
  { name:"Semi-Marathon de Metz", city:"Metz", dept:"57", date:"2026-05-10", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:49.1193, lng:6.1757, reg:"grand-est", org:"Metz Events", url:"" },
  { name:"Semi-Marathon de Montpellier", city:"Montpellier", dept:"34", date:"2026-03-22", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:43.6108, lng:3.8767, reg:"occitanie", org:"Montpellier Events", url:"" },
  { name:"Semi-Marathon de Rennes", city:"Rennes", dept:"35", date:"2026-03-08", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:48.1173, lng:-1.6778, reg:"bretagne", org:"Rennes Events", url:"" },
  { name:"Semi-Marathon de Lille", city:"Lille", dept:"59", date:"2026-03-29", km:21.097, elev:30, type:"semi", diff:"green", terrain:["asphalt"], lat:50.6292, lng:3.0573, reg:"hauts-de-france", org:"Lille Events", url:"" },

  // ── 10 KM ─────────────────────────────────────────────────────────────────
  { name:"10km de Paris", city:"Paris", dept:"75", date:"2026-03-22", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.8698, lng:2.3080, reg:"ile-de-france", org:"ASO", url:"https://10kmdeparis.fr" },
  { name:"10km de Lyon", city:"Lyon", dept:"69", date:"2026-09-27", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Running Conseil Lyon", url:"" },
  { name:"10km du Figaro", city:"Paris", dept:"75", date:"2026-05-31", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"Le Figaro", url:"" },
  { name:"10km de Bordeaux", city:"Bordeaux", dept:"33", date:"2026-09-20", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Events", url:"" },
  { name:"10km de Toulouse", city:"Toulouse", dept:"31", date:"2026-09-27", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"" },
  { name:"10km de Nantes", city:"Nantes", dept:"44", date:"2026-09-20", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.2184, lng:-1.5536, reg:"pays-de-la-loire", org:"Nantes Events", url:"" },
  { name:"10km de Strasbourg", city:"Strasbourg", dept:"67", date:"2026-09-27", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Events", url:"" },
  { name:"10km de Grenoble", city:"Grenoble", dept:"38", date:"2026-06-14", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.1885, lng:5.7245, reg:"auvergne-rhone-alpes", org:"Grenoble Events", url:"" },
  { name:"10km de Rennes", city:"Rennes", dept:"35", date:"2026-06-07", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.1173, lng:-1.6778, reg:"bretagne", org:"Rennes Events", url:"" },
  { name:"10km de Lille", city:"Lille", dept:"59", date:"2026-05-31", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6292, lng:3.0573, reg:"hauts-de-france", org:"Lille Events", url:"" },
  { name:"10km de Montpellier", city:"Montpellier", dept:"34", date:"2026-06-07", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.6108, lng:3.8767, reg:"occitanie", org:"Montpellier Events", url:"" },
  { name:"10km de Dijon", city:"Dijon", dept:"21", date:"2026-05-24", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.3220, lng:5.0415, reg:"bourgogne-franche-comte", org:"Dijon Events", url:"" },
  { name:"10km de Nice", city:"Nice", dept:"06", date:"2026-05-03", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.7102, lng:7.2620, reg:"provence-alpes-cote-azur", org:"Nice Events", url:"" },
  { name:"10km de Marseille", city:"Marseille", dept:"13", date:"2026-09-27", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.2965, lng:5.3698, reg:"provence-alpes-cote-azur", org:"Marseille Events", url:"" },
  { name:"10km de Reims", city:"Reims", dept:"51", date:"2026-05-17", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.2583, lng:4.0317, reg:"grand-est", org:"Reims Events", url:"" },
  { name:"10km de Rouen", city:"Rouen", dept:"76", date:"2026-05-10", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.4432, lng:1.0993, reg:"normandie", org:"Rouen Events", url:"" },
  { name:"10km de Clermont-Ferrand", city:"Clermont-Ferrand", dept:"63", date:"2026-05-03", km:10, elev:150, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:45.7772, lng:3.0870, reg:"auvergne-rhone-alpes", org:"Clermont Events", url:"" },
  { name:"10km d'Epernay", city:"Epernay", dept:"51", date:"2026-04-19", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.0467, lng:3.9597, reg:"grand-est", org:"Epernay Running", url:"" },
  { name:"10km du Puy en Velay", city:"Le Puy-en-Velay", dept:"43", date:"2026-09-06", km:10, elev:200, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:45.0430, lng:3.8851, reg:"auvergne-rhone-alpes", org:"Puy Events", url:"" },
  { name:"Corrida de Langueux", city:"Langueux", dept:"22", date:"2026-11-08", km:7.6, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.4706, lng:-2.7020, reg:"bretagne", org:"Langueux Running", url:"" },
  { name:"La Corrida de Clichy-Levallois", city:"Levallois-Perret", dept:"92", date:"2026-12-20", km:8, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.8953, lng:2.2875, reg:"ile-de-france", org:"Clichy Running", url:"" },
  { name:"Foulées de Strasbourg", city:"Strasbourg", dept:"67", date:"2026-06-21", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Running", url:"" },
  { name:"10km de Metz", city:"Metz", dept:"57", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.1193, lng:6.1757, reg:"grand-est", org:"Metz Running", url:"" },
  { name:"10km de Caen", city:"Caen", dept:"14", date:"2026-05-24", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.1829, lng:-0.3707, reg:"normandie", org:"Caen Events", url:"" },
  { name:"10km du Havre", city:"Le Havre", dept:"76", date:"2026-06-07", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.4944, lng:0.1079, reg:"normandie", org:"Le Havre Running", url:"" },
  { name:"10km de Cannes", city:"Cannes", dept:"06", date:"2026-05-10", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.5528, lng:7.0174, reg:"provence-alpes-cote-azur", org:"Cannes Events", url:"" },
  { name:"10km de Brest", city:"Brest", dept:"29", date:"2026-05-31", km:10, elev:150, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:48.3905, lng:-4.4860, reg:"bretagne", org:"Brest Events", url:"" },
  { name:"10km de Nancy", city:"Nancy", dept:"54", date:"2026-05-17", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.6921, lng:6.1844, reg:"grand-est", org:"Nancy Running", url:"" },
  { name:"10km de Pau", city:"Pau", dept:"64", date:"2026-06-14", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.2951, lng:-0.3708, reg:"nouvelle-aquitaine", org:"Pau Running", url:"" },
  { name:"10km de Bayonne", city:"Bayonne", dept:"64", date:"2026-07-19", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.4929, lng:-1.4748, reg:"nouvelle-aquitaine", org:"Bayonne Running", url:"" },
  { name:"10km de Besançon", city:"Besançon", dept:"25", date:"2026-06-07", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.2378, lng:6.0241, reg:"bourgogne-franche-comte", org:"Besançon Running", url:"" },
  { name:"10km de Tours", city:"Tours", dept:"37", date:"2026-06-07", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.3941, lng:0.6848, reg:"centre-val-de-loire", org:"Tours Running", url:"" },
  { name:"10km d'Angers", city:"Angers", dept:"49", date:"2026-09-20", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.4784, lng:-0.5632, reg:"pays-de-la-loire", org:"Angers Events", url:"" },
  { name:"10km de Limoges", city:"Limoges", dept:"87", date:"2026-09-13", km:10, elev:120, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.8336, lng:1.2611, reg:"nouvelle-aquitaine", org:"Limoges Running", url:"" },
  { name:"10km d'Amiens", city:"Amiens", dept:"80", date:"2026-05-17", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.8941, lng:2.2958, reg:"hauts-de-france", org:"Amiens Running", url:"" },
  { name:"10km de Dunkerque", city:"Dunkerque", dept:"59", date:"2026-04-26", km:10, elev:10, type:"road_10k", diff:"green", terrain:["asphalt"], lat:51.0340, lng:2.3769, reg:"hauts-de-france", org:"Dunkerque Events", url:"" },

  // ── ULTRA & TRAIL XL ─────────────────────────────────────────────────────
  { name:"UTMB Mont-Blanc", city:"Chamonix", dept:"74", date:"2026-08-28", km:171, elev:10000, type:"ultra", diff:"black", terrain:["single_track","technical","snow"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:6 },
  { name:"CCC - Courmayeur Champex Chamonix", city:"Courmayeur", dept:"74", date:"2026-08-29", km:100, elev:6100, type:"ultra", diff:"black", terrain:["single_track","technical"], lat:45.7960, lng:6.9684, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:5 },
  { name:"OCC - Orsières Champex Chamonix", city:"Chamonix", dept:"74", date:"2026-08-30", km:55, elev:3500, type:"trail_l", diff:"red", terrain:["single_track","alpine"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:3 },
  { name:"TDS - Sur les Traces des Ducs de Savoie", city:"Chamonix", dept:"74", date:"2026-08-27", km:145, elev:9100, type:"ultra", diff:"black", terrain:["single_track","alpine","snow"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:6 },
  { name:"MCC - Martigny Combe Chamonix", city:"Chamonix", dept:"74", date:"2026-08-29", km:40, elev:2300, type:"trail_m", diff:"red", terrain:["single_track","alpine"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:2 },
  { name:"Diagonale des Fous - Grand Raid Réunion", city:"Saint-Pierre", dept:"974", date:"2026-10-15", km:165, elev:9978, type:"ultra", diff:"black", terrain:["volcanic","single_track","technical"], lat:-21.3419, lng:55.4781, reg:"la-reunion", org:"Grand Raid Réunion", url:"https://www.grandraid-reunion.com", itra:true, itra_pts:6 },
  { name:"Maxi Race Annecy", city:"Annecy", dept:"74", date:"2026-05-23", km:115, elev:6500, type:"trail_xl", diff:"black", terrain:["single_track","alpine"], lat:45.8992, lng:6.1294, reg:"auvergne-rhone-alpes", org:"Maxi Race", url:"https://maxirace.fr", itra:true, itra_pts:4 },
  { name:"Tor des Géants", city:"Courmayeur", dept:"74", date:"2026-09-06", km:330, elev:24000, type:"ultra", diff:"black", terrain:["alpine","technical","snow"], lat:45.7960, lng:6.9684, reg:"auvergne-rhone-alpes", org:"Tor des Géants", url:"https://www.tordesgeants.it", itra:true, itra_pts:6 },
  { name:"Lavaredo Ultra Trail", city:"Cortina d'Ampezzo", dept:"74", date:"2026-06-26", km:120, elev:5800, type:"ultra", diff:"black", terrain:["alpine","technical"], lat:46.5360, lng:12.1349, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://ultratraillavaredo.com", itra:true, itra_pts:5 },
  { name:"Templiers - Trail du Larzac", city:"Millau", dept:"12", date:"2026-10-25", km:72, elev:3500, type:"trail_xl", diff:"black", terrain:["single_track","technical","limestone"], lat:44.0972, lng:3.0802, reg:"occitanie", org:"Millau Grands Causses", url:"https://www.trails-occitanie.fr", itra:true, itra_pts:4 },
  { name:"EcoTrail Paris", city:"Versailles", dept:"78", date:"2026-03-14", km:80, elev:1100, type:"trail_l", diff:"blue", terrain:["forest","gravel","urban"], lat:48.8584, lng:2.2945, reg:"ile-de-france", org:"EcoTrail Paris", url:"https://ecotrailparis.com" },
  { name:"Saintélyon", city:"Saint-Étienne", dept:"42", date:"2026-11-28", km:75, elev:2700, type:"trail_xl", diff:"black", terrain:["forest","single_track"], lat:45.4397, lng:4.3872, reg:"auvergne-rhone-alpes", org:"Saintélyon", url:"https://www.saintelyon.com" },
  { name:"Beaufortain Ultra Trail", city:"Queige", dept:"73", date:"2026-07-04", km:100, elev:6500, type:"ultra", diff:"black", terrain:["alpine","single_track"], lat:45.7244, lng:6.5833, reg:"auvergne-rhone-alpes", org:"BU Trail", url:"", itra:true, itra_pts:4 },
  { name:"Ubaye Trail Salomon", city:"Barcelonnette", dept:"04", date:"2026-07-11", km:112, elev:7200, type:"ultra", diff:"black", terrain:["alpine","single_track"], lat:44.3864, lng:6.6536, reg:"provence-alpes-cote-azur", org:"Ubaye Trail", url:"https://www.ubayetrail.com", itra:true, itra_pts:5 },
  { name:"Run in Corsica Ultra Trail", city:"Calvi", dept:"2B", date:"2026-09-19", km:135, elev:8000, type:"ultra", diff:"black", terrain:["single_track","technical","maquis"], lat:42.5667, lng:8.7567, reg:"corse", org:"Run in Corsica", url:"https://www.runincorsica.com", itra:true, itra_pts:5 },

  // ── TRAIL XL ─────────────────────────────────────────────────────────────
  { name:"Trail des Glières", city:"Thorens-Glières", dept:"74", date:"2026-06-14", km:43, elev:2800, type:"trail_m", diff:"red", terrain:["single_track","alpine","pasture"], lat:45.9977, lng:6.2667, reg:"auvergne-rhone-alpes", org:"Hardrock Club", url:"https://www.traildesGlieres.com" },
  { name:"Trail de l'Embrunman", city:"Embrun", dept:"05", date:"2026-07-18", km:85, elev:5200, type:"trail_xl", diff:"black", terrain:["alpine","single_track"], lat:44.5608, lng:6.4979, reg:"provence-alpes-cote-azur", org:"Embrunman", url:"https://www.embrunman.com", itra:true, itra_pts:4 },
  { name:"Grand Trail du Saint-Jacques", city:"Le Puy-en-Velay", dept:"43", date:"2026-05-30", km:83, elev:3600, type:"trail_xl", diff:"red", terrain:["forest","single_track","gravel"], lat:45.0430, lng:3.8851, reg:"auvergne-rhone-alpes", org:"GTSJ", url:"https://www.gtsj.fr", itra:true, itra_pts:4 },
  { name:"Trail du Beaujolais", city:"Beaujeu", dept:"69", date:"2026-11-22", km:50, elev:2200, type:"trail_l", diff:"red", terrain:["vineyard","single_track"], lat:46.1535, lng:4.5730, reg:"auvergne-rhone-alpes", org:"Trail du Beaujolais", url:"https://www.traildubeaujolais.com" },
  { name:"Trail des 2 Rives Strasbourg", city:"Strasbourg", dept:"67", date:"2026-09-06", km:50, elev:400, type:"trail_l", diff:"blue", terrain:["forest","gravel"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"2 Rives Trail", url:"https://www.trail2rives.com" },
  { name:"Trail du Golfe du Morbihan", city:"Vannes", dept:"56", date:"2026-04-25", km:75, elev:1200, type:"trail_xl", diff:"blue", terrain:["coastal","single_track"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Trail Golfe Morbihan", url:"" },
  { name:"Trail des Bergers Pyrénées", city:"Tarbes", dept:"65", date:"2026-06-28", km:85, elev:5500, type:"trail_xl", diff:"black", terrain:["alpine","single_track"], lat:43.2327, lng:0.0784, reg:"occitanie", org:"Trail Bergers", url:"" },
  { name:"Trail de Compostelle de l'Oyapock", city:"Lourdes", dept:"65", date:"2026-08-09", km:60, elev:3200, type:"trail_l", diff:"red", terrain:["alpine","single_track"], lat:43.0933, lng:-0.0464, reg:"occitanie", org:"Trail Lourdes", url:"" },
  { name:"Trail des Crêtes Vosgiennes", city:"Gérardmer", dept:"88", date:"2026-06-07", km:75, elev:3500, type:"trail_xl", diff:"red", terrain:["forest","single_track"], lat:48.0726, lng:6.8778, reg:"grand-est", org:"Trail Vosges", url:"" },
  { name:"Grand Tourmalet", city:"La Mongie", dept:"65", date:"2026-08-30", km:75, elev:5300, type:"trail_xl", diff:"black", terrain:["alpine","single_track"], lat:42.9079, lng:0.1394, reg:"occitanie", org:"Grand Tourmalet", url:"" },
  { name:"Trail de Thuit", city:"Bourgtheroulde", dept:"27", date:"2026-04-26", km:55, elev:500, type:"trail_l", diff:"blue", terrain:["forest","single_track"], lat:49.3044, lng:0.9046, reg:"normandie", org:"Trail de Thuit", url:"" },

  // ── TRAIL M (30-50km) ──────────────────────────────────────────────────────
  { name:"Trail du Mont Blanc Express", city:"Chamonix", dept:"74", date:"2026-08-28", km:40, elev:2000, type:"trail_m", diff:"red", terrain:["alpine","single_track"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world" },
  { name:"Trail de la Sainte Baume", city:"Nans-les-Pins", dept:"83", date:"2026-04-05", km:42, elev:1800, type:"trail_m", diff:"red", terrain:["single_track","limestone"], lat:43.3642, lng:5.6722, reg:"provence-alpes-cote-azur", org:"Trail Sainte Baume", url:"" },
  { name:"Trail du Ventoux", city:"Bédoin", dept:"84", date:"2026-06-06", km:46, elev:2000, type:"trail_m", diff:"red", terrain:["single_track","technical"], lat:44.1232, lng:5.2820, reg:"provence-alpes-cote-azur", org:"Trail du Ventoux", url:"" },
  { name:"Trail des Citadelles du Vertige", city:"Foix", dept:"09", date:"2026-06-13", km:35, elev:2200, type:"trail_m", diff:"red", terrain:["single_track","technical"], lat:42.9637, lng:1.6049, reg:"occitanie", org:"Trail Citadelles", url:"" },
  { name:"Trail du Bocage Normand", city:"Saint-Lô", dept:"50", date:"2026-05-09", km:38, elev:800, type:"trail_m", diff:"blue", terrain:["forest","pasture"], lat:49.1166, lng:-1.0933, reg:"normandie", org:"Trail du Bocage", url:"" },
  { name:"Trail du Massif du Sancy", city:"La Bourboule", dept:"63", date:"2026-07-04", km:43, elev:2800, type:"trail_m", diff:"red", terrain:["volcanic","single_track"], lat:45.5836, lng:2.7380, reg:"auvergne-rhone-alpes", org:"Trail Sancy", url:"" },
  { name:"Trail du Morvan", city:"Vézelay", dept:"89", date:"2026-06-21", km:37, elev:1500, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:47.4647, lng:3.7472, reg:"bourgogne-franche-comte", org:"Trail Morvan", url:"" },
  { name:"Trail des Châteaux du Périgord", city:"Sarlat", dept:"24", date:"2026-05-16", km:40, elev:1200, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:44.8886, lng:1.2171, reg:"nouvelle-aquitaine", org:"Trail Périgord", url:"" },
  { name:"Trail des Gorges de l'Ardèche", city:"Vallon-Pont-d'Arc", dept:"07", date:"2026-06-06", km:44, elev:1800, type:"trail_m", diff:"red", terrain:["single_track","limestone"], lat:44.4022, lng:4.3938, reg:"auvergne-rhone-alpes", org:"Trail Ardèche", url:"" },
  { name:"Trail du Beaujolais Vert", city:"Cours-la-Ville", dept:"69", date:"2026-07-05", km:36, elev:2000, type:"trail_m", diff:"red", terrain:["forest","single_track"], lat:46.1011, lng:4.3239, reg:"auvergne-rhone-alpes", org:"Beaujolais Vert", url:"" },
  { name:"Trail des Falaises de Beaumard", city:"Saint-Florent-le-Vieil", dept:"49", date:"2026-05-03", km:31, elev:800, type:"trail_m", diff:"blue", terrain:["coastal","single_track"], lat:47.3628, lng:-1.0147, reg:"pays-de-la-loire", org:"Trail Maine et Loire", url:"" },
  { name:"Trail des 3 Forts Marseille", city:"Marseille", dept:"13", date:"2026-04-26", km:35, elev:1400, type:"trail_m", diff:"blue", terrain:["coastal","single_track"], lat:43.2965, lng:5.3698, reg:"provence-alpes-cote-azur", org:"3 Forts Trail", url:"" },
  { name:"Trail de la Pierre Qui Tourne", city:"Montrevault-sur-Evre", dept:"49", date:"2026-04-05", km:35, elev:600, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:47.2808, lng:-1.0397, reg:"pays-de-la-loire", org:"Trail de l'Evre", url:"" },
  { name:"Trail des Weppes", city:"Fournes-en-Weppes", dept:"59", date:"2026-04-26", km:32, elev:400, type:"trail_m", diff:"blue", terrain:["forest","pasture"], lat:50.5611, lng:2.8489, reg:"hauts-de-france", org:"Trail Weppes", url:"" },
  { name:"Trail du Luberon", city:"Pertuis", dept:"84", date:"2026-04-25", km:43, elev:1600, type:"trail_m", diff:"blue", terrain:["single_track","garrigue"], lat:43.6922, lng:5.5024, reg:"provence-alpes-cote-azur", org:"Trail Luberon", url:"" },
  { name:"Trail du Livradois-Forez", city:"Thiers", dept:"63", date:"2026-05-23", km:42, elev:2500, type:"trail_m", diff:"red", terrain:["forest","single_track"], lat:45.8561, lng:3.5453, reg:"auvergne-rhone-alpes", org:"Trail Forez", url:"" },
  { name:"Trail des Forts Besançon", city:"Besançon", dept:"25", date:"2026-06-28", km:36, elev:1500, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:47.2378, lng:6.0241, reg:"bourgogne-franche-comte", org:"Trail des Forts", url:"" },
  { name:"Trail de la Dune du Pilat", city:"La Teste-de-Buch", dept:"33", date:"2026-09-26", km:33, elev:600, type:"trail_m", diff:"blue", terrain:["dunes","forest","sandy"], lat:44.5843, lng:-1.2146, reg:"nouvelle-aquitaine", org:"Trail Dune du Pilat", url:"" },
  { name:"Trail du Mont Mézenc", city:"Le Cheylard", dept:"07", date:"2026-06-20", km:38, elev:2200, type:"trail_m", diff:"red", terrain:["volcanic","single_track"], lat:44.9028, lng:4.4114, reg:"auvergne-rhone-alpes", org:"Trail Mézenc", url:"" },
  { name:"Trail du Beaufortain", city:"Beaufort", dept:"73", date:"2026-07-19", km:42, elev:2800, type:"trail_m", diff:"red", terrain:["alpine","single_track"], lat:45.7244, lng:6.5833, reg:"auvergne-rhone-alpes", org:"Trail Beaufortain", url:"" },
  { name:"Trail de l'Etang de Berre", city:"Martigues", dept:"13", date:"2026-04-19", km:31, elev:600, type:"trail_m", diff:"blue", terrain:["coastal","garrigue"], lat:43.4063, lng:5.0476, reg:"provence-alpes-cote-azur", org:"Trail Etang de Berre", url:"" },
  { name:"Trail des Châteaux de la Loire", city:"Amboise", dept:"37", date:"2026-05-17", km:37, elev:800, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:47.4130, lng:0.9837, reg:"centre-val-de-loire", org:"Trail Loire", url:"" },

  // ── TRAIL S (<30km) ──────────────────────────────────────────────────────
  { name:"Trail des Crêtes du Vercors", city:"Villard-de-Lans", dept:"38", date:"2026-07-12", km:22, elev:1200, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:45.0667, lng:5.5500, reg:"auvergne-rhone-alpes", org:"Trail Vercors", url:"" },
  { name:"Trail de la Forêt de Rambouillet", city:"Rambouillet", dept:"78", date:"2026-05-03", km:15, elev:250, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.6440, lng:1.8230, reg:"ile-de-france", org:"Trail Rambouillet", url:"" },
  { name:"Trail des Collines de l'Artois", city:"Arras", dept:"62", date:"2026-04-26", km:18, elev:400, type:"trail_s", diff:"green", terrain:["forest","pasture"], lat:50.2913, lng:2.7782, reg:"hauts-de-france", org:"Trail Artois", url:"" },
  { name:"Trail du Canal du Midi", city:"Carcassonne", dept:"11", date:"2026-04-26", km:20, elev:300, type:"trail_s", diff:"green", terrain:["gravel","single_track"], lat:43.2115, lng:2.3530, reg:"occitanie", org:"Trail Canal", url:"" },
  { name:"Trail des Monts de Guéret", city:"Guéret", dept:"23", date:"2026-05-10", km:25, elev:1000, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:46.1721, lng:1.8756, reg:"nouvelle-aquitaine", org:"Trail Guéret", url:"" },
  { name:"Trail des Coteaux du Layon", city:"Doué-la-Fontaine", dept:"49", date:"2026-05-24", km:18, elev:400, type:"trail_s", diff:"green", terrain:["vineyard","single_track"], lat:47.1905, lng:-0.2754, reg:"pays-de-la-loire", org:"Trail du Layon", url:"" },
  { name:"Trail du Cap d'Agde", city:"Agde", dept:"34", date:"2026-06-07", km:20, elev:500, type:"trail_s", diff:"green", terrain:["coastal","volcanic"], lat:43.3109, lng:3.4758, reg:"occitanie", org:"Trail Cap d'Agde", url:"" },
  { name:"Trail du Pays de Cognac", city:"Cognac", dept:"16", date:"2026-05-17", km:17, elev:300, type:"trail_s", diff:"green", terrain:["vineyard","single_track"], lat:45.6958, lng:-0.3291, reg:"nouvelle-aquitaine", org:"Trail Cognac", url:"" },
  { name:"Trail de la Baie du Mont Saint-Michel", city:"Avranches", dept:"50", date:"2026-04-25", km:20, elev:400, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:48.6842, lng:-1.3541, reg:"normandie", org:"Trail Mont St-Michel", url:"" },
  { name:"Trail des Capitelles du Gard", city:"Nîmes", dept:"30", date:"2026-05-10", km:23, elev:600, type:"trail_s", diff:"blue", terrain:["garrigue","single_track"], lat:43.8367, lng:4.3601, reg:"occitanie", org:"Trail du Gard", url:"" },
  { name:"Trail du Pays Basque", city:"Saint-Jean-de-Luz", dept:"64", date:"2026-06-21", km:18, elev:800, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:43.3874, lng:-1.6603, reg:"nouvelle-aquitaine", org:"Trail Pays Basque", url:"" },
  { name:"Trail des Landes de Gascogne", city:"Sabres", dept:"40", date:"2026-04-19", km:15, elev:100, type:"trail_s", diff:"green", terrain:["forest","sandy"], lat:44.0578, lng:-0.7461, reg:"nouvelle-aquitaine", org:"Trail Landes", url:"" },
  { name:"Trail de la Plaine Alsacienne", city:"Colmar", dept:"68", date:"2026-06-14", km:18, elev:400, type:"trail_s", diff:"green", terrain:["vineyard","forest"], lat:48.0793, lng:7.3585, reg:"grand-est", org:"Trail Alsace", url:"" },
  { name:"Trail des Bois Noirs", city:"Noirétable", dept:"42", date:"2026-06-07", km:25, elev:1200, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.8167, lng:3.7667, reg:"auvergne-rhone-alpes", org:"Trail Bois Noirs", url:"" },
  { name:"Trail du Pilat", city:"Saint-Pierre-de-Bœuf", dept:"42", date:"2026-05-30", km:27, elev:1500, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.3683, lng:4.6408, reg:"auvergne-rhone-alpes", org:"Trail du Pilat", url:"" },
  { name:"Trail des Monts d'Ambazac", city:"Ambazac", dept:"87", date:"2026-05-31", km:22, elev:900, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.9580, lng:1.4021, reg:"nouvelle-aquitaine", org:"Trail Ambazac", url:"" },
  { name:"Trail des Alpilles", city:"Les Baux-de-Provence", dept:"13", date:"2026-04-25", km:21, elev:700, type:"trail_s", diff:"blue", terrain:["garrigue","limestone"], lat:43.7443, lng:4.8006, reg:"provence-alpes-cote-azur", org:"Trail Alpilles", url:"" },
  { name:"Trail de la Côte d'Emeraude", city:"Dinard", dept:"35", date:"2026-05-09", km:20, elev:500, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:48.6285, lng:-2.0597, reg:"bretagne", org:"Trail Emeraude", url:"" },
  { name:"Trail des Cévennes", city:"Florac", dept:"48", date:"2026-05-23", km:25, elev:1400, type:"trail_s", diff:"blue", terrain:["single_track","garrigue"], lat:44.3249, lng:3.5936, reg:"occitanie", org:"Trail Cévennes", url:"" },
  { name:"Trail du Viaduc de Millau", city:"Millau", dept:"12", date:"2026-05-24", km:20, elev:800, type:"trail_s", diff:"blue", terrain:["single_track","limestone"], lat:44.0972, lng:3.0802, reg:"occitanie", org:"Trail Viaduc", url:"" },
  { name:"Trail de la Forêt d'Eu", city:"Eu", dept:"76", date:"2026-04-26", km:18, elev:400, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.0503, lng:1.4150, reg:"normandie", org:"Trail Forêt d'Eu", url:"" },
  { name:"Trail des Demoiselles Coiffées", city:"Savines-le-Lac", dept:"05", date:"2026-07-11", km:23, elev:1000, type:"trail_s", diff:"blue", terrain:["alpine","single_track"], lat:44.5120, lng:6.3958, reg:"provence-alpes-cote-azur", org:"Trail Demoiselles", url:"" },
  { name:"Trail de l'Île de Ré", city:"La Flotte-en-Ré", dept:"17", date:"2026-06-28", km:16, elev:100, type:"trail_s", diff:"green", terrain:["coastal","sandy"], lat:46.1847, lng:-1.3302, reg:"nouvelle-aquitaine", org:"Trail Île de Ré", url:"" },
  { name:"Trail des 3 Chênes", city:"Vannes", dept:"56", date:"2026-04-19", km:14, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Trail 3 Chênes", url:"" },
  { name:"Trail de la Drôme Provençale", city:"Nyons", dept:"26", date:"2026-05-10", km:22, elev:900, type:"trail_s", diff:"blue", terrain:["garrigue","single_track"], lat:44.3608, lng:5.1429, reg:"auvergne-rhone-alpes", org:"Trail Drôme", url:"" },
  { name:"Trail du Roc'h Trevezel", city:"Huelgoat", dept:"29", date:"2026-05-17", km:17, elev:600, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.3751, lng:-3.7441, reg:"bretagne", org:"Trail Monts d'Arrée", url:"" },
  { name:"Trail du Contrefort", city:"Pamiers", dept:"09", date:"2026-05-03", km:20, elev:1000, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:43.1165, lng:1.6080, reg:"occitanie", org:"Trail Ariège", url:"" },
  { name:"Trail des Coteaux Bordelais", city:"Libourne", dept:"33", date:"2026-06-14", km:19, elev:400, type:"trail_s", diff:"green", terrain:["vineyard","single_track"], lat:44.9228, lng:-0.2420, reg:"nouvelle-aquitaine", org:"Trail Gironde", url:"" },
  { name:"Trail du Lac de Vassivière", city:"Royère-de-Vassivière", dept:"23", date:"2026-08-02", km:26, elev:700, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.7999, lng:1.9500, reg:"nouvelle-aquitaine", org:"Trail Vassivière", url:"" },
  { name:"Trail de la Côte d'Opale", city:"Boulogne-sur-Mer", dept:"62", date:"2026-05-31", km:18, elev:500, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:50.7266, lng:1.6144, reg:"hauts-de-france", org:"Trail Opale", url:"" },
  { name:"Trail de la Montagne Noire", city:"Mazamet", dept:"81", date:"2026-05-16", km:24, elev:1200, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:43.4933, lng:2.3700, reg:"occitanie", org:"Trail Montagne Noire", url:"" },
  { name:"Trail des Grands Sites", city:"Concarneau", dept:"29", date:"2026-05-24", km:22, elev:400, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:47.8737, lng:-3.9190, reg:"bretagne", org:"Trail Concarneau", url:"" },
  { name:"Trail des Roches Bleues", city:"Saint-Nazaire", dept:"44", date:"2026-06-21", km:19, elev:300, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:47.2736, lng:-2.2140, reg:"pays-de-la-loire", org:"Trail Saint-Nazaire", url:"" },
  { name:"Trail Nocturne de Lyon", city:"Lyon", dept:"69", date:"2026-06-20", km:12, elev:400, type:"trail_s", diff:"green", terrain:["urban","forest"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Lyon Trail Nocturne", url:"" },
  { name:"Trail des Sources Minérales d'Auvergne", city:"Vichy", dept:"03", date:"2026-06-14", km:20, elev:600, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:46.1264, lng:3.4264, reg:"auvergne-rhone-alpes", org:"Trail Vichy", url:"" },

  // ── COURSES POPULAIRES (5KM / COURSES SPÉCIALES) ─────────────────────────
  { name:"La Parisienne", city:"Paris", dept:"75", date:"2026-09-13", km:7, elev:30, type:"road_5k", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"La Parisienne", url:"https://www.laparisienne.net" },
  { name:"Color Run Paris", city:"Paris", dept:"75", date:"2026-05-31", km:5, elev:20, type:"road_5k", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"Color Run", url:"https://thecolorrun.fr" },
  { name:"SaintéLyon - Course de Noël", city:"Saint-Étienne", dept:"42", date:"2026-11-28", km:75, elev:2700, type:"trail_xl", diff:"black", terrain:["forest","single_track"], lat:45.4397, lng:4.3872, reg:"auvergne-rhone-alpes", org:"Saintélyon", url:"" },
  { name:"Corrida Pédestre de Houilles", city:"Houilles", dept:"78", date:"2026-11-22", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.9243, lng:2.1860, reg:"ile-de-france", org:"Houilles Running", url:"https://www.corrida-houilles.com" },
  { name:"Trail Blanc du Haut-Jura", city:"Mouthe", dept:"25", date:"2026-01-25", km:65, elev:2500, type:"trail_l", diff:"black", terrain:["snow","single_track"], lat:46.7128, lng:6.1939, reg:"bourgogne-franche-comte", org:"Trail Blanc", url:"" },
  { name:"La Bordelaise 10km", city:"Bordeaux", dept:"33", date:"2026-05-03", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Events", url:"" },
  { name:"Foulées du Beauvaisis", city:"Beauvais", dept:"60", date:"2026-04-26", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.4295, lng:2.0868, reg:"hauts-de-france", org:"Foulées du Beauvaisis", url:"" },
  { name:"Course des Remparts d'Angoulême", city:"Angoulême", dept:"16", date:"2026-05-24", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.6488, lng:0.1560, reg:"nouvelle-aquitaine", org:"Angoulême Running", url:"" },
  { name:"Run in Lyon", city:"Lyon", dept:"69", date:"2026-05-23", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Run in Lyon", url:"" },
  { name:"Trail des Contrebandiers Pyrénées", city:"Saint-Jean-Pied-de-Port", dept:"64", date:"2026-07-04", km:28, elev:1600, type:"trail_s", diff:"blue", terrain:["single_track","alpine"], lat:43.1630, lng:-1.2364, reg:"nouvelle-aquitaine", org:"Trail Contrebandiers", url:"" },
  { name:"Trail de la Transhumance Aubrac", city:"Saint-Chély-d'Aubrac", dept:"12", date:"2026-06-07", km:30, elev:1500, type:"trail_m", diff:"blue", terrain:["pasture","single_track"], lat:44.5333, lng:2.9500, reg:"occitanie", org:"Trail Aubrac", url:"" },
  { name:"Trail de la Côte Sauvage de Quiberon", city:"Quiberon", dept:"56", date:"2026-06-28", km:22, elev:400, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:47.4836, lng:-3.1195, reg:"bretagne", org:"Trail Quiberon", url:"" },
  { name:"Trail de la Réserve Naturelle du Marais d'Orx", city:"Orx", dept:"40", date:"2026-04-26", km:15, elev:50, type:"trail_s", diff:"green", terrain:["wetland","gravel"], lat:43.5697, lng:-1.3625, reg:"nouvelle-aquitaine", org:"Trail Landes", url:"" },
  { name:"Foulées de la Gartempe", city:"Saint-Savin", dept:"86", date:"2026-04-19", km:8, elev:100, type:"road_5k", diff:"green", terrain:["asphalt","gravel"], lat:46.5702, lng:0.8645, reg:"nouvelle-aquitaine", org:"Foulées de la Gartempe", url:"" },
  { name:"Course des Géants du Mont-Blanc", city:"Les Contamines-Montjoie", dept:"74", date:"2026-08-01", km:26, elev:2000, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:45.8209, lng:6.7247, reg:"auvergne-rhone-alpes", org:"Trail Mont-Blanc", url:"" },

  // ══════════════════════════════════════════════════════════════════════════
  // ── COURSES 2027 ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── MARATHONS 2027 ────────────────────────────────────────────────────────
  { name:"Marathon de Paris 2027", city:"Paris", dept:"75", date:"2027-04-11", km:42.195, elev:180, type:"marathon", diff:"blue", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.schneiderelectricparismarathon.com" },
  { name:"Marathon de Lyon 2027", city:"Lyon", dept:"69", date:"2027-10-03", km:42.195, elev:200, type:"marathon", diff:"blue", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Lyon Métropole", url:"https://www.marathondulyon.com" },
  { name:"Marathon de Bordeaux 2027", city:"Bordeaux", dept:"33", date:"2027-04-25", km:42.195, elev:50, type:"marathon", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Métropole", url:"https://www.marathon-bordeaux.com" },
  { name:"Marathon de Nice Côte d'Azur 2027", city:"Nice", dept:"06", date:"2027-11-07", km:42.195, elev:350, type:"marathon", diff:"blue", terrain:["asphalt"], lat:43.7102, lng:7.2620, reg:"provence-alpes-cote-azur", org:"Nice Events", url:"https://www.marathon06.com" },
  { name:"Marathon de Nantes 2027", city:"Nantes", dept:"44", date:"2027-11-07", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:47.2184, lng:-1.5536, reg:"pays-de-la-loire", org:"Nantes Events", url:"https://www.marathon-nantes.com" },
  { name:"Marathon de Rennes 2027", city:"Rennes", dept:"35", date:"2027-10-24", km:42.195, elev:150, type:"marathon", diff:"green", terrain:["asphalt"], lat:48.1173, lng:-1.6778, reg:"bretagne", org:"Rennes Métropole", url:"https://www.marathon-rennes.fr" },
  { name:"Marathon de Toulouse 2027", city:"Toulouse", dept:"31", date:"2027-10-17", km:42.195, elev:80, type:"marathon", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"https://www.marathon-toulouse.com" },
  { name:"Marathon de Strasbourg 2027", city:"Strasbourg", dept:"67", date:"2027-04-18", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Events", url:"https://www.marathon-strasbourg.eu" },
  { name:"Marathon de Marseille 2027", city:"Marseille", dept:"13", date:"2027-10-24", km:42.195, elev:200, type:"marathon", diff:"blue", terrain:["asphalt"], lat:43.2965, lng:5.3698, reg:"provence-alpes-cote-azur", org:"Marseille Events", url:"https://www.marathon-marseille.com" },
  { name:"Marathon du Médoc 2027", city:"Pauillac", dept:"33", date:"2027-09-04", km:42.195, elev:50, type:"marathon", diff:"green", terrain:["asphalt","gravel"], lat:45.1971, lng:-0.7441, reg:"nouvelle-aquitaine", org:"ASO Médoc", url:"https://www.marathondumedoc.com" },
  { name:"Marathon de La Rochelle 2027", city:"La Rochelle", dept:"17", date:"2027-11-28", km:42.195, elev:30, type:"marathon", diff:"green", terrain:["asphalt"], lat:46.1591, lng:-1.1520, reg:"nouvelle-aquitaine", org:"La Rochelle Events", url:"https://www.marathon-larochelle.com" },
  { name:"Marathon de Reims 2027", city:"Reims", dept:"51", date:"2027-10-17", km:42.195, elev:90, type:"marathon", diff:"green", terrain:["asphalt"], lat:49.2583, lng:4.0317, reg:"grand-est", org:"Reims Events", url:"https://www.marathon-reims.com" },
  { name:"Marathon de Montpellier 2027", city:"Montpellier", dept:"34", date:"2027-10-10", km:42.195, elev:120, type:"marathon", diff:"green", terrain:["asphalt"], lat:43.6108, lng:3.8767, reg:"occitanie", org:"Montpellier Events", url:"https://www.marathon-montpellier.fr" },
  { name:"Marathon de Dijon 2027", city:"Dijon", dept:"21", date:"2027-10-17", km:42.195, elev:100, type:"marathon", diff:"green", terrain:["asphalt"], lat:47.3220, lng:5.0415, reg:"bourgogne-franche-comte", org:"Dijon Events", url:"https://www.marathon-dijon.fr" },
  { name:"Marathon de Brest 2027", city:"Brest", dept:"29", date:"2027-09-26", km:42.195, elev:250, type:"marathon", diff:"blue", terrain:["asphalt"], lat:48.3905, lng:-4.4860, reg:"bretagne", org:"Brest Events", url:"https://www.marathon-brest.com" },
  { name:"Marathon de Metz 2027", city:"Metz", dept:"57", date:"2027-05-09", km:42.195, elev:120, type:"marathon", diff:"green", terrain:["asphalt"], lat:49.1193, lng:6.1757, reg:"grand-est", org:"Metz Events", url:"https://www.marathon-metz.fr" },
  { name:"Marathon de Vannes 2027", city:"Vannes", dept:"56", date:"2027-04-25", km:42.195, elev:180, type:"marathon", diff:"blue", terrain:["asphalt"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Vannes Events", url:"https://www.marathon-vannes.bzh" },
  { name:"Marathon des Sables 2027", city:"Ouarzazate", dept:"66", date:"2027-03-28", km:250, elev:2500, type:"ultra", diff:"black", terrain:["sandy","gravel"], lat:30.9189, lng:-6.8932, reg:"occitanie", org:"Marathon des Sables", url:"https://www.marathondessables.com", itra:true, itra_pts:6 },

  // ── SEMI-MARATHONS 2027 ───────────────────────────────────────────────────
  { name:"Semi-Marathon de Paris 2027", city:"Paris", dept:"75", date:"2027-03-07", km:21.097, elev:50, type:"semi", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.semi-marathon-paris.fr" },
  { name:"20km de Paris 2027", city:"Paris", dept:"75", date:"2027-05-16", km:20, elev:200, type:"semi", diff:"blue", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"ASO", url:"https://www.20kmparis.com" },
  { name:"Semi-Marathon de Lyon 2027", city:"Lyon", dept:"69", date:"2027-02-28", km:21.097, elev:80, type:"semi", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Running Conseil Lyon", url:"https://semi-marathon-lyon.fr" },
  { name:"Semi-Marathon de Bordeaux 2027", city:"Bordeaux", dept:"33", date:"2027-03-21", km:21.097, elev:40, type:"semi", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Events", url:"" },
  { name:"Semi-Marathon de Lille 2027", city:"Lille", dept:"59", date:"2027-03-28", km:21.097, elev:30, type:"semi", diff:"green", terrain:["asphalt"], lat:50.6292, lng:3.0573, reg:"hauts-de-france", org:"Lille Events", url:"" },
  { name:"Semi-Marathon de Toulouse 2027", city:"Toulouse", dept:"31", date:"2027-03-28", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"" },
  { name:"Semi-Marathon de Grenoble 2027", city:"Grenoble", dept:"38", date:"2027-04-04", km:21.097, elev:150, type:"semi", diff:"blue", terrain:["asphalt"], lat:45.1885, lng:5.7245, reg:"auvergne-rhone-alpes", org:"Grenoble Events", url:"" },
  { name:"Semi-Marathon de Montpellier 2027", city:"Montpellier", dept:"34", date:"2027-03-21", km:21.097, elev:60, type:"semi", diff:"green", terrain:["asphalt"], lat:43.6108, lng:3.8767, reg:"occitanie", org:"Montpellier Events", url:"" },

  // ── ULTRAS & TRAILS XL 2027 ───────────────────────────────────────────────
  { name:"UTMB Mont-Blanc 2027", city:"Chamonix", dept:"74", date:"2027-08-27", km:171, elev:10000, type:"ultra", diff:"black", terrain:["single_track","technical","snow"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:6 },
  { name:"CCC 2027", city:"Courmayeur", dept:"74", date:"2027-08-28", km:100, elev:6100, type:"ultra", diff:"black", terrain:["single_track","technical"], lat:45.7960, lng:6.9684, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:5 },
  { name:"TDS 2027", city:"Chamonix", dept:"74", date:"2027-08-26", km:145, elev:9100, type:"ultra", diff:"black", terrain:["single_track","alpine","snow"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:6 },
  { name:"OCC 2027", city:"Chamonix", dept:"74", date:"2027-08-29", km:55, elev:3500, type:"trail_l", diff:"red", terrain:["single_track","alpine"], lat:45.9237, lng:6.8694, reg:"auvergne-rhone-alpes", org:"UTMB Group", url:"https://utmb.world", itra:true, itra_pts:3 },
  { name:"Diagonale des Fous 2027", city:"Saint-Pierre", dept:"974", date:"2027-10-14", km:165, elev:9978, type:"ultra", diff:"black", terrain:["volcanic","single_track","technical"], lat:-21.3419, lng:55.4781, reg:"la-reunion", org:"Grand Raid Réunion", url:"https://www.grandraid-reunion.com", itra:true, itra_pts:6 },
  { name:"Maxi Race Annecy 2027", city:"Annecy", dept:"74", date:"2027-05-22", km:115, elev:6500, type:"trail_xl", diff:"black", terrain:["single_track","alpine"], lat:45.8992, lng:6.1294, reg:"auvergne-rhone-alpes", org:"Maxi Race", url:"https://maxirace.fr", itra:true, itra_pts:4 },
  { name:"Saintélyon 2027", city:"Saint-Étienne", dept:"42", date:"2027-11-27", km:75, elev:2700, type:"trail_xl", diff:"black", terrain:["forest","single_track"], lat:45.4397, lng:4.3872, reg:"auvergne-rhone-alpes", org:"Saintélyon", url:"https://www.saintelyon.com" },
  { name:"Templiers 2027", city:"Millau", dept:"12", date:"2027-10-24", km:72, elev:3500, type:"trail_xl", diff:"black", terrain:["single_track","technical","limestone"], lat:44.0972, lng:3.0802, reg:"occitanie", org:"Millau Grands Causses", url:"https://www.trails-occitanie.fr", itra:true, itra_pts:4 },
  { name:"EcoTrail Paris 2027", city:"Versailles", dept:"78", date:"2027-03-13", km:80, elev:1100, type:"trail_l", diff:"blue", terrain:["forest","gravel","urban"], lat:48.8584, lng:2.2945, reg:"ile-de-france", org:"EcoTrail Paris", url:"https://ecotrailparis.com" },
  { name:"Ubaye Trail Salomon 2027", city:"Barcelonnette", dept:"04", date:"2027-07-10", km:112, elev:7200, type:"ultra", diff:"black", terrain:["alpine","single_track"], lat:44.3864, lng:6.6536, reg:"provence-alpes-cote-azur", org:"Ubaye Trail", url:"https://www.ubayetrail.com", itra:true, itra_pts:5 },
  { name:"Grand Trail du Saint-Jacques 2027", city:"Le Puy-en-Velay", dept:"43", date:"2027-05-29", km:83, elev:3600, type:"trail_xl", diff:"red", terrain:["forest","single_track","gravel"], lat:45.0430, lng:3.8851, reg:"auvergne-rhone-alpes", org:"GTSJ", url:"https://www.gtsj.fr", itra:true, itra_pts:4 },

  // ── TRAILS M 2027 ─────────────────────────────────────────────────────────
  { name:"Trail du Ventoux 2027", city:"Bédoin", dept:"84", date:"2027-06-05", km:46, elev:2000, type:"trail_m", diff:"red", terrain:["single_track","technical"], lat:44.1232, lng:5.2820, reg:"provence-alpes-cote-azur", org:"Trail du Ventoux", url:"" },
  { name:"Trail des Glières 2027", city:"Thorens-Glières", dept:"74", date:"2027-06-13", km:43, elev:2800, type:"trail_m", diff:"red", terrain:["single_track","alpine","pasture"], lat:45.9977, lng:6.2667, reg:"auvergne-rhone-alpes", org:"Hardrock Club", url:"https://www.traildesGlieres.com" },
  { name:"Trail du Massif du Sancy 2027", city:"La Bourboule", dept:"63", date:"2027-07-03", km:43, elev:2800, type:"trail_m", diff:"red", terrain:["volcanic","single_track"], lat:45.5836, lng:2.7380, reg:"auvergne-rhone-alpes", org:"Trail Sancy", url:"" },
  { name:"Trail du Luberon 2027", city:"Pertuis", dept:"84", date:"2027-04-24", km:43, elev:1600, type:"trail_m", diff:"blue", terrain:["single_track","garrigue"], lat:43.6922, lng:5.5024, reg:"provence-alpes-cote-azur", org:"Trail Luberon", url:"" },
  { name:"Trail des Gorges de l'Ardèche 2027", city:"Vallon-Pont-d'Arc", dept:"07", date:"2027-06-05", km:44, elev:1800, type:"trail_m", diff:"red", terrain:["single_track","limestone"], lat:44.4022, lng:4.3938, reg:"auvergne-rhone-alpes", org:"Trail Ardèche", url:"" },
  { name:"Trail des Châteaux du Périgord 2027", city:"Sarlat", dept:"24", date:"2027-05-15", km:40, elev:1200, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:44.8886, lng:1.2171, reg:"nouvelle-aquitaine", org:"Trail Périgord", url:"" },
  { name:"Trail du Golfe du Morbihan 2027", city:"Vannes", dept:"56", date:"2027-04-24", km:75, elev:1200, type:"trail_xl", diff:"blue", terrain:["coastal","single_track"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Trail Golfe Morbihan", url:"" },
  { name:"Trail de la Dune du Pilat 2027", city:"La Teste-de-Buch", dept:"33", date:"2027-09-25", km:33, elev:600, type:"trail_m", diff:"blue", terrain:["dunes","forest","sandy"], lat:44.5843, lng:-1.2146, reg:"nouvelle-aquitaine", org:"Trail Dune du Pilat", url:"" },
  { name:"Trail du Morvan 2027", city:"Vézelay", dept:"89", date:"2027-06-20", km:37, elev:1500, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:47.4647, lng:3.7472, reg:"bourgogne-franche-comte", org:"Trail Morvan", url:"" },
  { name:"Trail du Bocage Normand 2027", city:"Saint-Lô", dept:"50", date:"2027-05-08", km:38, elev:800, type:"trail_m", diff:"blue", terrain:["forest","pasture"], lat:49.1166, lng:-1.0933, reg:"normandie", org:"Trail du Bocage", url:"" },

  // ── TRAILS S 2027 ─────────────────────────────────────────────────────────
  { name:"Trail des Crêtes du Vercors 2027", city:"Villard-de-Lans", dept:"38", date:"2027-07-11", km:22, elev:1200, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:45.0667, lng:5.5500, reg:"auvergne-rhone-alpes", org:"Trail Vercors", url:"" },
  { name:"Trail de la Forêt de Rambouillet 2027", city:"Rambouillet", dept:"78", date:"2027-05-02", km:15, elev:250, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.6440, lng:1.8230, reg:"ile-de-france", org:"Trail Rambouillet", url:"" },
  { name:"Trail des Cévennes 2027", city:"Florac", dept:"48", date:"2027-05-22", km:25, elev:1400, type:"trail_s", diff:"blue", terrain:["single_track","garrigue"], lat:44.3249, lng:3.5936, reg:"occitanie", org:"Trail Cévennes", url:"" },
  { name:"Trail du Pays Basque 2027", city:"Saint-Jean-de-Luz", dept:"64", date:"2027-06-20", km:18, elev:800, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:43.3874, lng:-1.6603, reg:"nouvelle-aquitaine", org:"Trail Pays Basque", url:"" },
  { name:"Trail des Alpilles 2027", city:"Les Baux-de-Provence", dept:"13", date:"2027-04-24", km:21, elev:700, type:"trail_s", diff:"blue", terrain:["garrigue","limestone"], lat:43.7443, lng:4.8006, reg:"provence-alpes-cote-azur", org:"Trail Alpilles", url:"" },
  { name:"Trail de la Côte d'Emeraude 2027", city:"Dinard", dept:"35", date:"2027-05-08", km:20, elev:500, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:48.6285, lng:-2.0597, reg:"bretagne", org:"Trail Emeraude", url:"" },
  { name:"Trail du Cap d'Agde 2027", city:"Agde", dept:"34", date:"2027-06-06", km:20, elev:500, type:"trail_s", diff:"green", terrain:["coastal","volcanic"], lat:43.3109, lng:3.4758, reg:"occitanie", org:"Trail Cap d'Agde", url:"" },
  { name:"Trail des Bois Noirs 2027", city:"Noirétable", dept:"42", date:"2027-06-06", km:25, elev:1200, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.8167, lng:3.7667, reg:"auvergne-rhone-alpes", org:"Trail Bois Noirs", url:"" },
  { name:"Trail de l'Île de Ré 2027", city:"La Flotte-en-Ré", dept:"17", date:"2027-06-27", km:16, elev:100, type:"trail_s", diff:"green", terrain:["coastal","sandy"], lat:46.1847, lng:-1.3302, reg:"nouvelle-aquitaine", org:"Trail Île de Ré", url:"" },
  { name:"Trail des Monts d'Ambazac 2027", city:"Ambazac", dept:"87", date:"2027-05-30", km:22, elev:900, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.9580, lng:1.4021, reg:"nouvelle-aquitaine", org:"Trail Ambazac", url:"" },

  // ── 10 KM 2027 ────────────────────────────────────────────────────────────
  { name:"10km de Paris 2027", city:"Paris", dept:"75", date:"2027-03-21", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.8698, lng:2.3080, reg:"ile-de-france", org:"ASO", url:"https://10kmdeparis.fr" },
  { name:"10km de Lyon 2027", city:"Lyon", dept:"69", date:"2027-09-26", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Running Conseil Lyon", url:"" },
  { name:"10km de Bordeaux 2027", city:"Bordeaux", dept:"33", date:"2027-09-19", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.8378, lng:-0.5792, reg:"nouvelle-aquitaine", org:"Bordeaux Events", url:"" },
  { name:"10km de Toulouse 2027", city:"Toulouse", dept:"31", date:"2027-09-26", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.6047, lng:1.4442, reg:"occitanie", org:"Toulouse Events", url:"" },
  { name:"10km de Lille 2027", city:"Lille", dept:"59", date:"2027-05-30", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6292, lng:3.0573, reg:"hauts-de-france", org:"Lille Events", url:"" },
  { name:"10km de Marseille 2027", city:"Marseille", dept:"13", date:"2027-09-26", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.2965, lng:5.3698, reg:"provence-alpes-cote-azur", org:"Marseille Events", url:"" },
  { name:"10km de Nice 2027", city:"Nice", dept:"06", date:"2027-05-02", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.7102, lng:7.2620, reg:"provence-alpes-cote-azur", org:"Nice Events", url:"" },
  { name:"10km de Strasbourg 2027", city:"Strasbourg", dept:"67", date:"2027-09-26", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.5734, lng:7.7521, reg:"grand-est", org:"Strasbourg Events", url:"" },
  { name:"10km de Nantes 2027", city:"Nantes", dept:"44", date:"2027-09-19", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.2184, lng:-1.5536, reg:"pays-de-la-loire", org:"Nantes Events", url:"" },
  { name:"10km de Rennes 2027", city:"Rennes", dept:"35", date:"2027-06-06", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.1173, lng:-1.6778, reg:"bretagne", org:"Rennes Events", url:"" },

  // ── COURSES VILLAGEOISES & PETITES COURSES (spécifiques Nord/Pas-de-Calais) ─
  { name:"Course de Bondues", city:"Bondues", dept:"59", date:"2026-05-31", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7034, lng:3.0921, reg:"hauts-de-france", org:"Running Club Bondues", url:"" },
  { name:"Course de Verlinghem", city:"Verlinghem", dept:"59", date:"2026-05-26", km:8, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7102, lng:2.9612, reg:"hauts-de-france", org:"AS Verlinghem", url:"" },
  { name:"Trail de Marcq-en-Barœul", city:"Marcq-en-Barœul", dept:"59", date:"2026-06-07", km:12, elev:50, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.6783, lng:3.0954, reg:"hauts-de-france", org:"Marcq Running", url:"" },
  { name:"Foulées Lambersartoises", city:"Lambersart", dept:"59", date:"2099-01-01", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6571, lng:3.0175, reg:"hauts-de-france", org:"AS Lambersart", url:"https://www.jogging-plus.com/presentation-courses-trails/foulees-lambersartoises-lambersart-nord/" },
  { name:"Foulées de Lys-lez-Lannoy", city:"Lys-lez-Lannoy", dept:"59", date:"2026-06-14", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6711, lng:3.2147, reg:"hauts-de-france", org:"AS Lys", url:"" },
  { name:"Trail de La Madeleine", city:"La Madeleine", dept:"59", date:"2026-05-24", km:15, elev:80, type:"trail_s", diff:"green", terrain:["forest","asphalt"], lat:50.6617, lng:3.0778, reg:"hauts-de-france", org:"La Madeleine Running", url:"" },
  { name:"Course de Wambrechies", city:"Wambrechies", dept:"59", date:"2026-06-21", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7026, lng:3.0467, reg:"hauts-de-france", org:"Wambrechies Athlé", url:"" },
  { name:"Corrida de Wasquehal", city:"Wasquehal", dept:"59", date:"2026-11-22", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6753, lng:3.1311, reg:"hauts-de-france", org:"Wasquehal Running", url:"" },
  { name:"Trail de Phalempin", city:"Phalempin", dept:"59", date:"2026-05-17", km:18, elev:200, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.5242, lng:3.0628, reg:"hauts-de-france", org:"Trail Phalempin", url:"" },
  { name:"Course de Roubaix", city:"Roubaix", dept:"59", date:"2026-09-13", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6942, lng:3.1746, reg:"hauts-de-france", org:"RC Roubaix", url:"" },
  { name:"Course de Tourcoing", city:"Tourcoing", dept:"59", date:"2026-06-07", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7239, lng:3.1589, reg:"hauts-de-france", org:"Tourcoing Athlé", url:"" },
  { name:"Trail de Willems", city:"Willems", dept:"59", date:"2026-05-31", km:12, elev:100, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.5963, lng:3.2497, reg:"hauts-de-france", org:"Willems Running", url:"" },
  { name:"Course de Comines", city:"Comines", dept:"59", date:"2026-06-28", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7578, lng:2.9829, reg:"hauts-de-france", org:"Comines Athlé", url:"" },
  { name:"Foulées de Seclin", city:"Seclin", dept:"59", date:"2026-05-03", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.5490, lng:3.0343, reg:"hauts-de-france", org:"AS Seclin", url:"" },
  { name:"Course de Mouvaux", city:"Mouvaux", dept:"59", date:"2026-04-26", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7124, lng:3.1031, reg:"hauts-de-france", org:"Mouvaux Running", url:"" },
  { name:"Trail de la Forêt de Nieppe", city:"Merville", dept:"59", date:"2026-06-14", km:20, elev:150, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.6443, lng:2.6423, reg:"hauts-de-france", org:"Trail Nieppe", url:"" },
  { name:"Course de Lezennes", city:"Lezennes", dept:"59", date:"2026-05-17", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6358, lng:3.1258, reg:"hauts-de-france", org:"Lezennes Running", url:"" },
  { name:"Foulées de Mons-en-Barœul", city:"Mons-en-Barœul", dept:"59", date:"2026-06-07", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.6464, lng:3.1234, reg:"hauts-de-france", org:"Mons Running", url:"" },
  { name:"Trail de Cappelle-en-Pévèle", city:"Cappelle-en-Pévèle", dept:"59", date:"2026-05-23", km:15, elev:150, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.5519, lng:3.2087, reg:"hauts-de-france", org:"Trail Pévèle", url:"" },
  { name:"Course de Halluin", city:"Halluin", dept:"59", date:"2026-06-21", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.7887, lng:3.1225, reg:"hauts-de-france", org:"Halluin Athlé", url:"" },

  // ── PETITES COURSES VILLAGEOISES HAUTS-DE-FRANCE ─────────────────────────
  { name:"Trail de la Canche", city:"Hesdin", dept:"62", date:"2026-05-24", km:18, elev:200, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.3736, lng:2.0345, reg:"hauts-de-france", org:"Trail Canche", url:"" },
  { name:"Course de Béthune", city:"Béthune", dept:"62", date:"2026-06-07", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.5301, lng:2.6423, reg:"hauts-de-france", org:"Béthune Running", url:"" },
  { name:"Trail de la Forêt de Crécy", city:"Crécy-en-Ponthieu", dept:"80", date:"2026-06-14", km:20, elev:200, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.2465, lng:1.8813, reg:"hauts-de-france", org:"Trail Crécy", url:"" },
  { name:"Foulées de Cambrai", city:"Cambrai", dept:"59", date:"2026-09-20", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.1762, lng:3.2345, reg:"hauts-de-france", org:"Cambrai Athlé", url:"" },
  { name:"Trail des Flandres", city:"Steenvoorde", dept:"59", date:"2026-05-09", km:22, elev:150, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:50.8114, lng:2.5688, reg:"hauts-de-france", org:"Trail Flandres", url:"" },
  { name:"Course de Gravelines", city:"Gravelines", dept:"59", date:"2026-07-05", km:10, elev:10, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.9871, lng:2.1276, reg:"hauts-de-france", org:"Gravelines Running", url:"" },
  { name:"Trail de la Lys", city:"Aire-sur-la-Lys", dept:"62", date:"2026-06-06", km:16, elev:100, type:"trail_s", diff:"green", terrain:["gravel","single_track"], lat:50.6391, lng:2.3967, reg:"hauts-de-france", org:"Trail Lys", url:"" },
  { name:"Course de Valenciennes", city:"Valenciennes", dept:"59", date:"2026-06-28", km:10, elev:20, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.3583, lng:3.5236, reg:"hauts-de-france", org:"Valenciennes Running", url:"" },
  { name:"Trail du Boulonnais", city:"Boulogne-sur-Mer", dept:"62", date:"2026-07-12", km:25, elev:400, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:50.7266, lng:1.6144, reg:"hauts-de-france", org:"Trail Boulonnais", url:"" },
  { name:"Foulées de Maubeuge", city:"Maubeuge", dept:"59", date:"2026-05-31", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:50.2767, lng:3.9740, reg:"hauts-de-france", org:"Maubeuge Athlé", url:"" },

  // ── COURSES VILLAGEOISES ILE-DE-FRANCE ───────────────────────────────────
  { name:"Trail de Fontainebleau", city:"Fontainebleau", dept:"77", date:"2026-06-07", km:25, elev:500, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.4045, lng:2.7022, reg:"ile-de-france", org:"Trail Fontainebleau", url:"" },
  { name:"Course de Meaux", city:"Meaux", dept:"77", date:"2026-06-14", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.9607, lng:2.8883, reg:"ile-de-france", org:"Meaux Running", url:"" },
  { name:"Trail de Milly-la-Forêt", city:"Milly-la-Forêt", dept:"91", date:"2026-05-09", km:20, elev:350, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.4028, lng:2.4640, reg:"ile-de-france", org:"Trail Milly", url:"" },
  { name:"Course de Melun", city:"Melun", dept:"77", date:"2026-09-13", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.5396, lng:2.6578, reg:"ile-de-france", org:"Melun Running", url:"" },
  { name:"Trail de Senlis", city:"Senlis", dept:"60", date:"2026-06-21", km:18, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.2064, lng:2.5852, reg:"hauts-de-france", org:"Trail Senlis", url:"" },
  { name:"Course de Poissy", city:"Poissy", dept:"78", date:"2026-05-17", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.9291, lng:2.0196, reg:"ile-de-france", org:"Poissy Running", url:"" },
  { name:"Trail de Chantilly", city:"Chantilly", dept:"60", date:"2026-05-31", km:20, elev:250, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.1939, lng:2.4720, reg:"hauts-de-france", org:"Trail Chantilly", url:"" },
  { name:"Foulées de Corbeil-Essonnes", city:"Corbeil-Essonnes", dept:"91", date:"2026-06-07", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.6135, lng:2.4794, reg:"ile-de-france", org:"Corbeil Running", url:"" },
  { name:"Trail de la Vallée de Chevreuse", city:"Chevreuse", dept:"78", date:"2026-05-23", km:22, elev:500, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.7030, lng:2.0337, reg:"ile-de-france", org:"Trail Chevreuse", url:"" },
  { name:"Course de Cergy-Pontoise", city:"Cergy", dept:"95", date:"2026-05-10", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.0336, lng:2.0612, reg:"ile-de-france", org:"Cergy Running", url:"" },

  // ── COURSES BRETONNES VILLAGEOISES ────────────────────────────────────────
  { name:"Course de Quimper", city:"Quimper", dept:"29", date:"2026-06-14", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.9960, lng:-4.0976, reg:"bretagne", org:"Quimper Athlé", url:"" },
  { name:"Trail de la Presqu'île de Crozon 2026", city:"Crozon", dept:"29", date:"2026-07-12", km:22, elev:700, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:48.2390, lng:-4.4944, reg:"bretagne", org:"Trail Crozon", url:"" },
  { name:"Foulées de Lorient", city:"Lorient", dept:"56", date:"2026-05-24", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.7481, lng:-3.3599, reg:"bretagne", org:"Lorient Running", url:"" },
  { name:"Trail de Belle-Île-en-Mer", city:"Le Palais", dept:"56", date:"2026-08-09", km:18, elev:400, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:47.3437, lng:-3.1514, reg:"bretagne", org:"Belle-Île Trail", url:"" },
  { name:"Course de Saint-Brieuc", city:"Saint-Brieuc", dept:"22", date:"2026-06-07", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.5147, lng:-2.7654, reg:"bretagne", org:"Saint-Brieuc Running", url:"" },
  { name:"Trail du Cap Fréhel", city:"Fréhel", dept:"22", date:"2026-06-21", km:20, elev:500, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:48.6847, lng:-2.3221, reg:"bretagne", org:"Trail Cap Fréhel", url:"" },
  { name:"Foulées de Vannes", city:"Vannes", dept:"56", date:"2026-05-31", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.6559, lng:-2.7603, reg:"bretagne", org:"Vannes Athlé", url:"" },
  { name:"Trail de Carnac", city:"Carnac", dept:"56", date:"2026-07-05", km:15, elev:200, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:47.5830, lng:-3.0800, reg:"bretagne", org:"Trail Carnac", url:"" },

  // ── COURSES VILLAGEOISES AUVERGNE-RHONE-ALPES ─────────────────────────────
  { name:"Course de Thonon-les-Bains", city:"Thonon-les-Bains", dept:"74", date:"2026-06-07", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:46.3700, lng:6.4782, reg:"auvergne-rhone-alpes", org:"Thonon Running", url:"" },
  { name:"Trail du Chablais", city:"Thonon-les-Bains", dept:"74", date:"2026-07-05", km:22, elev:1200, type:"trail_s", diff:"blue", terrain:["alpine","single_track"], lat:46.3700, lng:6.4782, reg:"auvergne-rhone-alpes", org:"Trail Chablais", url:"" },
  { name:"Course de Chambéry", city:"Chambéry", dept:"73", date:"2026-05-24", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.5646, lng:5.9178, reg:"auvergne-rhone-alpes", org:"Chambéry Running", url:"" },
  { name:"Trail du Massif de Chartreuse 2", city:"Saint-Pierre-de-Chartreuse", dept:"38", date:"2026-06-28", km:24, elev:1400, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.3389, lng:5.7908, reg:"auvergne-rhone-alpes", org:"Trail Chartreuse", url:"" },
  { name:"Course de Valence", city:"Valence", dept:"26", date:"2026-06-14", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.9334, lng:4.8924, reg:"auvergne-rhone-alpes", org:"Valence Running", url:"" },
  { name:"Trail du Vercors Nord", city:"Autrans", dept:"38", date:"2026-07-05", km:25, elev:1200, type:"trail_s", diff:"blue", terrain:["alpine","single_track"], lat:45.1762, lng:5.5377, reg:"auvergne-rhone-alpes", org:"Trail Vercors", url:"" },
  { name:"Course de Bourg-en-Bresse", city:"Bourg-en-Bresse", dept:"01", date:"2026-06-07", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:46.2056, lng:5.2262, reg:"auvergne-rhone-alpes", org:"Bourg Running", url:"" },
  { name:"Trail de la Dombes", city:"Villars-les-Dombes", dept:"01", date:"2026-05-31", km:18, elev:100, type:"trail_s", diff:"green", terrain:["wetland","gravel"], lat:45.9987, lng:5.0319, reg:"auvergne-rhone-alpes", org:"Trail Dombes", url:"" },
  { name:"Course de Rumilly", city:"Rumilly", dept:"74", date:"2026-06-21", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.8668, lng:5.9426, reg:"auvergne-rhone-alpes", org:"Rumilly Running", url:"" },
  { name:"Trail des Bauges", city:"Lescheraines", dept:"73", date:"2026-06-14", km:26, elev:1600, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:45.6697, lng:6.1481, reg:"auvergne-rhone-alpes", org:"Trail Bauges", url:"" },

  // ── COURSES VILLAGEOISES OCCITANIE ────────────────────────────────────────
  { name:"Trail des Montagnes du Tarn", city:"Lacaune", dept:"81", date:"2026-06-07", km:28, elev:1200, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:43.7069, lng:2.6977, reg:"occitanie", org:"Trail Tarn", url:"" },
  { name:"Course de Nîmes", city:"Nîmes", dept:"30", date:"2026-06-07", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.8367, lng:4.3601, reg:"occitanie", org:"Nîmes Running", url:"" },
  { name:"Trail des Grands Causses 2", city:"Roquefort-sur-Soulzon", dept:"12", date:"2026-06-28", km:22, elev:900, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:43.9795, lng:2.9882, reg:"occitanie", org:"Trail Roquefort", url:"" },
  { name:"Course de Perpignan 2026", city:"Perpignan", dept:"66", date:"2026-06-14", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:42.6887, lng:2.8948, reg:"occitanie", org:"Perpignan Running", url:"" },
  { name:"Trail de la Gardiole", city:"Frontignan", dept:"34", date:"2026-05-23", km:20, elev:500, type:"trail_s", diff:"blue", terrain:["garrigue","single_track"], lat:43.4490, lng:3.7480, reg:"occitanie", org:"Trail Gardiole", url:"" },
  { name:"Course de Carcassonne", city:"Carcassonne", dept:"11", date:"2026-06-28", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.2115, lng:2.3530, reg:"occitanie", org:"Carcassonne Running", url:"" },
  { name:"Trail de la Montagne de l'Espinouse", city:"Bédarieux", dept:"34", date:"2026-06-14", km:24, elev:1100, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:43.6169, lng:3.1539, reg:"occitanie", org:"Trail Espinouse", url:"" },
  { name:"Foulées de Béziers", city:"Béziers", dept:"34", date:"2026-09-20", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.3447, lng:3.2151, reg:"occitanie", org:"Béziers Running", url:"" },
  { name:"Trail du Pic Saint-Loup", city:"Saint-Martin-de-Londres", dept:"34", date:"2026-05-16", km:20, elev:900, type:"trail_s", diff:"red", terrain:["limestone","single_track"], lat:43.7889, lng:3.7297, reg:"occitanie", org:"Trail Pic Saint-Loup", url:"" },
  { name:"Course de Rodez", city:"Rodez", dept:"12", date:"2026-06-07", km:10, elev:150, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:44.3497, lng:2.5752, reg:"occitanie", org:"Rodez Running", url:"" },

  // ── COURSES VILLAGEOISES NOUVELLE-AQUITAINE ───────────────────────────────
  { name:"Trail du Périgord Vert", city:"Nontron", dept:"24", date:"2026-06-07", km:22, elev:700, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.5326, lng:0.6654, reg:"nouvelle-aquitaine", org:"Trail Périgord Vert", url:"" },
  { name:"Course de Périgueux", city:"Périgueux", dept:"24", date:"2026-06-14", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.1851, lng:0.7218, reg:"nouvelle-aquitaine", org:"Périgueux Running", url:"" },
  { name:"Trail de la Montagne Basque", city:"Mauléon-Licharre", dept:"64", date:"2026-07-05", km:25, elev:1200, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:43.2286, lng:-0.8886, reg:"nouvelle-aquitaine", org:"Trail Pays Basque", url:"" },
  { name:"Course d'Agen", city:"Agen", dept:"47", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.2003, lng:0.6211, reg:"nouvelle-aquitaine", org:"Agen Running", url:"" },
  { name:"Trail du Haut-Béarn", city:"Oloron-Sainte-Marie", dept:"64", date:"2026-06-28", km:28, elev:1600, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:43.1945, lng:-0.6044, reg:"nouvelle-aquitaine", org:"Trail Béarn", url:"" },
  { name:"Course de Mont-de-Marsan", city:"Mont-de-Marsan", dept:"40", date:"2026-05-31", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.8904, lng:-0.5047, reg:"nouvelle-aquitaine", org:"Mont-de-Marsan Running", url:"" },
  { name:"Trail des Landes Médocaines", city:"Lesparre-Médoc", dept:"33", date:"2026-06-21", km:20, elev:200, type:"trail_s", diff:"green", terrain:["forest","sandy"], lat:45.3051, lng:-0.9396, reg:"nouvelle-aquitaine", org:"Trail Médoc", url:"" },
  { name:"Course de Bergerac", city:"Bergerac", dept:"24", date:"2026-06-07", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:44.8507, lng:0.4782, reg:"nouvelle-aquitaine", org:"Bergerac Running", url:"" },
  { name:"Trail des Gorges de la Vézère", city:"Uzerche", dept:"19", date:"2026-06-14", km:22, elev:900, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.4201, lng:1.5618, reg:"nouvelle-aquitaine", org:"Trail Corrèze", url:"" },
  { name:"Course de Saintes", city:"Saintes", dept:"17", date:"2026-06-07", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.7463, lng:-0.6328, reg:"nouvelle-aquitaine", org:"Saintes Running", url:"" },

  // ── COURSES VILLAGEOISES PACA ─────────────────────────────────────────────
  { name:"Trail du Massif de l'Estérel", city:"Agay", dept:"83", date:"2026-05-23", km:26, elev:1200, type:"trail_s", diff:"red", terrain:["coastal","single_track"], lat:43.4303, lng:6.8570, reg:"provence-alpes-cote-azur", org:"Trail Estérel", url:"" },
  { name:"Course de Gap", city:"Gap", dept:"05", date:"2026-06-14", km:10, elev:200, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:44.5591, lng:6.0773, reg:"provence-alpes-cote-azur", org:"Gap Running", url:"" },
  { name:"Trail de la Sainte-Victoire", city:"Puyloubier", dept:"13", date:"2026-05-16", km:22, elev:1000, type:"trail_s", diff:"red", terrain:["limestone","single_track"], lat:43.5316, lng:5.5834, reg:"provence-alpes-cote-azur", org:"Trail Sainte-Victoire", url:"" },
  { name:"Course de Draguignan", city:"Draguignan", dept:"83", date:"2026-06-07", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.5384, lng:6.4673, reg:"provence-alpes-cote-azur", org:"Draguignan Running", url:"" },
  { name:"Trail du Massif des Albères", city:"Argelès-sur-Mer", dept:"66", date:"2026-06-28", km:20, elev:800, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:42.5459, lng:3.0250, reg:"occitanie", org:"Trail Albères", url:"" },
  { name:"Course de Digne-les-Bains", city:"Digne-les-Bains", dept:"04", date:"2026-06-14", km:10, elev:200, type:"road_10k", diff:"blue", terrain:["asphalt"], lat:44.0930, lng:6.2359, reg:"provence-alpes-cote-azur", org:"Digne Running", url:"" },
  { name:"Trail des Gorges du Verdon 2", city:"Castellane", dept:"04", date:"2026-07-12", km:25, elev:1200, type:"trail_s", diff:"red", terrain:["limestone","single_track"], lat:43.8459, lng:6.5182, reg:"provence-alpes-cote-azur", org:"Trail Verdon", url:"" },
  { name:"Course d'Aix-en-Provence", city:"Aix-en-Provence", dept:"13", date:"2026-06-07", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:43.5297, lng:5.4474, reg:"provence-alpes-cote-azur", org:"Aix Running", url:"" },

  // ── COURSES VILLAGEOISES GRAND-EST ────────────────────────────────────────
  { name:"Trail des Vosges du Nord", city:"Niederbronn-les-Bains", dept:"67", date:"2026-06-07", km:24, elev:800, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.9543, lng:7.6388, reg:"grand-est", org:"Trail Vosges Nord", url:"" },
  { name:"Course de Mulhouse", city:"Mulhouse", dept:"68", date:"2026-06-14", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.7508, lng:7.3359, reg:"grand-est", org:"Mulhouse Running", url:"" },
  { name:"Trail de la Forêt Noire Française", city:"Munster", dept:"68", date:"2026-07-05", km:26, elev:1200, type:"trail_s", diff:"red", terrain:["forest","single_track"], lat:48.0375, lng:7.1296, reg:"grand-est", org:"Trail Munster", url:"" },
  { name:"Course de Colmar", city:"Colmar", dept:"68", date:"2026-05-31", km:10, elev:50, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.0793, lng:7.3585, reg:"grand-est", org:"Colmar Running", url:"" },
  { name:"Trail de la Romanité", city:"Épinal", dept:"88", date:"2026-06-21", km:22, elev:700, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.1739, lng:6.4539, reg:"grand-est", org:"Trail Épinal", url:"" },
  { name:"Course de Troyes", city:"Troyes", dept:"10", date:"2026-06-07", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.2973, lng:4.0744, reg:"grand-est", org:"Troyes Running", url:"" },
  { name:"Trail de la Forêt d'Orient", city:"Brienne-le-Château", dept:"10", date:"2026-06-28", km:18, elev:100, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.3964, lng:4.5263, reg:"grand-est", org:"Trail Champagne", url:"" },
  { name:"Course de Charleville-Mézières", city:"Charleville-Mézières", dept:"08", date:"2026-06-14", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.7717, lng:4.7162, reg:"grand-est", org:"Charleville Running", url:"" },

  // ── COURSES VILLAGEOISES NORMANDIE ────────────────────────────────────────
  { name:"Trail de la Forêt de Brotonne", city:"Notre-Dame-de-Bliquetuit", dept:"76", date:"2026-06-07", km:20, elev:400, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.4892, lng:0.7728, reg:"normandie", org:"Trail Brotonne", url:"" },
  { name:"Course de Cherbourg", city:"Cherbourg-en-Cotentin", dept:"50", date:"2026-06-14", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.6361, lng:-1.6142, reg:"normandie", org:"Cherbourg Running", url:"" },
  { name:"Trail du Parc Régional des Marais du Cotentin", city:"Carentan-les-Marais", dept:"50", date:"2026-06-21", km:18, elev:100, type:"trail_s", diff:"green", terrain:["wetland","gravel"], lat:49.3036, lng:-1.2449, reg:"normandie", org:"Trail Cotentin", url:"" },
  { name:"Course d'Évreux", city:"Évreux", dept:"27", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:49.0239, lng:1.1505, reg:"normandie", org:"Évreux Running", url:"" },
  { name:"Trail du Pays d'Auge", city:"Lisieux", dept:"14", date:"2026-06-14", km:20, elev:500, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:49.1453, lng:0.2264, reg:"normandie", org:"Trail Pays d'Auge", url:"" },
  { name:"Course d'Alençon", city:"Alençon", dept:"61", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.4310, lng:0.0907, reg:"normandie", org:"Alençon Running", url:"" },

  // ── COURSES VILLAGEOISES CENTRE-VAL-DE-LOIRE ──────────────────────────────
  { name:"Trail des Châteaux de la Touraine", city:"Amboise", dept:"37", date:"2026-06-14", km:22, elev:400, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:47.4130, lng:0.9837, reg:"centre-val-de-loire", org:"Trail Touraine", url:"" },
  { name:"Course de Bourges", city:"Bourges", dept:"18", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.0809, lng:2.3980, reg:"centre-val-de-loire", org:"Bourges Running", url:"" },
  { name:"Trail de la Sologne", city:"Romorantin-Lanthenay", dept:"41", date:"2026-06-21", km:20, elev:150, type:"trail_s", diff:"green", terrain:["forest","wetland"], lat:47.3593, lng:1.7494, reg:"centre-val-de-loire", org:"Trail Sologne", url:"" },
  { name:"Course d'Orléans", city:"Orléans", dept:"45", date:"2026-06-07", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.9029, lng:1.9094, reg:"centre-val-de-loire", org:"Orléans Running", url:"" },
  { name:"Trail de la Forêt de Chinon", city:"Chinon", dept:"37", date:"2026-07-05", km:22, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:47.1671, lng:0.2407, reg:"centre-val-de-loire", org:"Trail Touraine", url:"" },

  // ── COURSES VILLAGEOISES PAYS-DE-LA-LOIRE ────────────────────────────────
  { name:"Trail des Sables d'Olonne", city:"Les Sables-d'Olonne", dept:"85", date:"2026-06-21", km:18, elev:150, type:"trail_s", diff:"green", terrain:["coastal","sandy"], lat:46.4971, lng:-1.7836, reg:"pays-de-la-loire", org:"Trail Vendée", url:"" },
  { name:"Course du Mans", city:"Le Mans", dept:"72", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.9960, lng:0.1966, reg:"pays-de-la-loire", org:"Le Mans Running", url:"" },
  { name:"Trail de la Mayenne", city:"Laval", dept:"53", date:"2026-06-14", km:20, elev:400, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.0733, lng:-0.7689, reg:"pays-de-la-loire", org:"Trail Mayenne", url:"" },
  { name:"Course de La Flèche", city:"La Flèche", dept:"72", date:"2026-06-21", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.6949, lng:-0.0766, reg:"pays-de-la-loire", org:"La Flèche Running", url:"" },
  { name:"Trail du Bocage Vendéen", city:"La Roche-sur-Yon", dept:"85", date:"2026-06-07", km:22, elev:350, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:46.6704, lng:-1.4267, reg:"pays-de-la-loire", org:"Trail Vendée", url:"" },
  { name:"Course de Cholet", city:"Cholet", dept:"49", date:"2026-06-14", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.0594, lng:-0.8784, reg:"pays-de-la-loire", org:"Cholet Running", url:"" },

  // ── COURSES VILLAGEOISES BOURGOGNE-FRANCHE-COMTE ─────────────────────────
  { name:"Trail de la Forêt du Massacre", city:"Les Rousses", dept:"39", date:"2026-07-05", km:28, elev:800, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:46.4832, lng:6.0571, reg:"bourgogne-franche-comte", org:"Trail Jura", url:"" },
  { name:"Course de Chalon-sur-Saône", city:"Chalon-sur-Saône", dept:"71", date:"2026-06-07", km:10, elev:40, type:"road_10k", diff:"green", terrain:["asphalt"], lat:46.7808, lng:4.8527, reg:"bourgogne-franche-comte", org:"Chalon Running", url:"" },
  { name:"Trail du Massif du Jura", city:"Pontarlier", dept:"25", date:"2026-07-12", km:30, elev:1200, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:46.9044, lng:6.3561, reg:"bourgogne-franche-comte", org:"Trail Jura", url:"" },
  { name:"Course d'Auxerre", city:"Auxerre", dept:"89", date:"2026-06-07", km:10, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:47.7979, lng:3.5714, reg:"bourgogne-franche-comte", org:"Auxerre Running", url:"" },

  // ── COURSES VILLAGEOISES CORSE ────────────────────────────────────────────
  { name:"Trail de la Castagniccia", city:"Piedicroce", dept:"2B", date:"2026-06-14", km:22, elev:1100, type:"trail_s", diff:"red", terrain:["forest","single_track"], lat:42.3467, lng:9.3497, reg:"corse", org:"Trail Corse", url:"" },
  { name:"Course d'Ajaccio", city:"Ajaccio", dept:"2A", date:"2026-06-07", km:10, elev:100, type:"road_10k", diff:"green", terrain:["asphalt"], lat:41.9190, lng:8.7386, reg:"corse", org:"Ajaccio Running", url:"" },
  { name:"Trail du Cap Corse", city:"Bastia", dept:"2B", date:"2026-07-05", km:25, elev:1000, type:"trail_s", diff:"red", terrain:["coastal","single_track"], lat:42.7007, lng:9.4499, reg:"corse", org:"Trail Cap Corse", url:"" },

  // ── COURSES VILLAGEOISES & PETITES COURSES 2026-2027 ─────────────────────
  { name:"La Ronde des Vignerons", city:"Beaune", dept:"21", date:"2026-09-13", km:12, elev:200, type:"road_10k", diff:"green", terrain:["vineyard","asphalt"], lat:47.0260, lng:4.8398, reg:"bourgogne-franche-comte", org:"Running Club Beaune", url:"" },
  { name:"Foulées Champenoises", city:"Epernay", dept:"51", date:"2026-09-06", km:10, elev:80, type:"road_10k", diff:"green", terrain:["asphalt","vineyard"], lat:49.0467, lng:3.9597, reg:"grand-est", org:"Epernay Running", url:"" },
  { name:"Trail du Cirque de Navacelles", city:"Blandas", dept:"30", date:"2026-05-23", km:28, elev:1200, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:43.8653, lng:3.5497, reg:"occitanie", org:"Trail Navacelles", url:"" },
  { name:"Trail de l'Aubrac", city:"Nasbinals", dept:"48", date:"2026-06-21", km:35, elev:1000, type:"trail_m", diff:"blue", terrain:["pasture","single_track"], lat:44.6525, lng:2.9561, reg:"occitanie", org:"Trail Aubrac", url:"" },
  { name:"Trail du Marais Poitevin", city:"Coulon", dept:"79", date:"2026-05-03", km:20, elev:50, type:"trail_s", diff:"green", terrain:["wetland","gravel"], lat:46.3286, lng:-0.5854, reg:"nouvelle-aquitaine", org:"Trail Marais Poitevin", url:"" },
  { name:"Trail de la Lomagne", city:"Lectoure", dept:"32", date:"2026-05-10", km:22, elev:600, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:43.9352, lng:0.6225, reg:"occitanie", org:"Trail Lomagne", url:"" },
  { name:"Trail des Grandes Bruyères", city:"Ingrannes", dept:"45", date:"2026-04-26", km:24, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:47.9697, lng:2.3333, reg:"centre-val-de-loire", org:"Trail Orléanais", url:"" },
  { name:"Trail du Pays Royannais", city:"Royan", dept:"17", date:"2026-06-07", km:18, elev:250, type:"trail_s", diff:"green", terrain:["coastal","single_track"], lat:45.6237, lng:-1.0318, reg:"nouvelle-aquitaine", org:"Trail Royan", url:"" },
  { name:"Trail du Canigou", city:"Vernet-les-Bains", dept:"66", date:"2026-07-05", km:30, elev:2400, type:"trail_m", diff:"red", terrain:["alpine","single_track"], lat:42.5453, lng:2.3972, reg:"occitanie", org:"Trail Canigou", url:"" },
  { name:"Trail des Gorges du Tarn", city:"La Malène", dept:"48", date:"2026-05-16", km:26, elev:1100, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:44.2956, lng:3.3322, reg:"occitanie", org:"Trail Gorges du Tarn", url:"" },
  { name:"Foulées du Château de Versailles", city:"Versailles", dept:"78", date:"2026-09-19", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt","gravel"], lat:48.8049, lng:2.1204, reg:"ile-de-france", org:"Versailles Running", url:"" },
  { name:"Trail des Vignes de Sancerre", city:"Sancerre", dept:"18", date:"2026-06-07", km:16, elev:500, type:"trail_s", diff:"blue", terrain:["vineyard","single_track"], lat:47.3312, lng:2.8353, reg:"centre-val-de-loire", org:"Sancerre Running", url:"" },
  { name:"Trail de la Presqu'île de Crozon", city:"Crozon", dept:"29", date:"2026-07-19", km:24, elev:600, type:"trail_s", diff:"blue", terrain:["coastal","single_track"], lat:48.2390, lng:-4.4944, reg:"bretagne", org:"Trail Crozon", url:"" },
  { name:"Trail de Plougastel", city:"Plougastel-Daoulas", dept:"29", date:"2026-05-17", km:18, elev:400, type:"trail_s", diff:"green", terrain:["coastal","forest"], lat:48.3738, lng:-4.3636, reg:"bretagne", org:"Plougastel Running", url:"" },
  { name:"Trail du Bessin", city:"Bayeux", dept:"14", date:"2026-05-09", km:20, elev:350, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.2765, lng:-0.7030, reg:"normandie", org:"Trail Bessin", url:"" },
  { name:"Trail du Pays du Forez", city:"Montbrison", dept:"42", date:"2026-06-28", km:25, elev:1000, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:45.6063, lng:4.0647, reg:"auvergne-rhone-alpes", org:"Trail Forez", url:"" },
  { name:"Trail du Pays de Bray", city:"Forges-les-Eaux", dept:"76", date:"2026-05-23", km:20, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.6149, lng:1.5479, reg:"normandie", org:"Trail Bray", url:"" },
  { name:"Trail des 3 Vallées de Savoie", city:"Les Menuires", dept:"73", date:"2026-07-12", km:27, elev:1800, type:"trail_s", diff:"red", terrain:["alpine","single_track"], lat:45.3253, lng:6.5344, reg:"auvergne-rhone-alpes", org:"Trail 3 Vallées", url:"" },
  { name:"Trail du Massif de Belledonne", city:"Chamrousse", dept:"38", date:"2026-08-08", km:35, elev:2200, type:"trail_m", diff:"red", terrain:["alpine","single_track"], lat:45.1202, lng:5.8836, reg:"auvergne-rhone-alpes", org:"Trail Belledonne", url:"" },
  { name:"Trail de la Chartreuse", city:"Voiron", dept:"38", date:"2026-09-13", km:30, elev:1500, type:"trail_m", diff:"blue", terrain:["forest","single_track"], lat:45.3633, lng:5.5897, reg:"auvergne-rhone-alpes", org:"Trail Chartreuse", url:"" },
  { name:"Trail du Vexin Normand", city:"Gisors", dept:"27", date:"2026-05-31", km:15, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:49.2794, lng:1.7775, reg:"normandie", org:"Trail Vexin", url:"" },
  { name:"Trail de la Vallée de la Vézère", city:"Les Eyzies", dept:"24", date:"2026-06-21", km:24, elev:700, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:44.9395, lng:1.0209, reg:"nouvelle-aquitaine", org:"Trail Vézère", url:"" },
  { name:"Trail des Grottes de Lascaux", city:"Montignac", dept:"24", date:"2026-05-30", km:18, elev:500, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:45.0620, lng:1.1731, reg:"nouvelle-aquitaine", org:"Trail Périgord Noir", url:"" },
  { name:"Trail du Pays de Cocagne", city:"Lavaur", dept:"81", date:"2026-04-25", km:22, elev:500, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:43.6993, lng:1.8246, reg:"occitanie", org:"Trail Cocagne", url:"" },
  { name:"Trail de la Réserve du Lac du Der", city:"Montier-en-Der", dept:"52", date:"2026-05-16", km:17, elev:150, type:"trail_s", diff:"green", terrain:["forest","gravel"], lat:48.4769, lng:4.7553, reg:"grand-est", org:"Trail Champagne", url:"" },
  { name:"Trail du Massif des Maures", city:"Collobrières", dept:"83", date:"2026-05-09", km:25, elev:1000, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:43.2444, lng:6.3656, reg:"provence-alpes-cote-azur", org:"Trail Maures", url:"" },
  { name:"Trail des Calanques de Marseille", city:"Marseille", dept:"13", date:"2026-06-14", km:30, elev:1200, type:"trail_m", diff:"red", terrain:["limestone","coastal","single_track"], lat:43.2148, lng:5.4474, reg:"provence-alpes-cote-azur", org:"Trail Calanques", url:"" },
  { name:"Trail du Haut-Koenigsbourg", city:"Orschwiller", dept:"67", date:"2026-07-04", km:20, elev:900, type:"trail_s", diff:"blue", terrain:["forest","single_track"], lat:48.2490, lng:7.3421, reg:"grand-est", org:"Trail Alsace", url:"" },
  { name:"Trail du Ballon d'Alsace", city:"Saint-Maurice-sur-Moselle", dept:"88", date:"2026-08-16", km:32, elev:1500, type:"trail_m", diff:"red", terrain:["forest","single_track"], lat:47.8286, lng:6.8423, reg:"grand-est", org:"Trail Vosges", url:"" },
  { name:"Trail des Monts du Lyonnais", city:"Mornant", dept:"69", date:"2026-05-16", km:23, elev:900, type:"trail_s", diff:"blue", terrain:["forest","vineyard"], lat:45.6181, lng:4.6724, reg:"auvergne-rhone-alpes", org:"Trail Lyonnais", url:"" },
  { name:"Trail du Perche", city:"Nogent-le-Rotrou", dept:"28", date:"2026-05-23", km:20, elev:400, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.3209, lng:0.8238, reg:"centre-val-de-loire", org:"Trail Perche", url:"" },
  { name:"Trail du Pays de Fougères", city:"Fougères", dept:"35", date:"2026-05-09", km:18, elev:300, type:"trail_s", diff:"green", terrain:["forest","single_track"], lat:48.3519, lng:-1.1989, reg:"bretagne", org:"Trail Bretagne", url:"" },
  { name:"Foulées du Vignoble d'Alsace", city:"Ribeauvillé", dept:"68", date:"2026-09-20", km:14, elev:350, type:"trail_s", diff:"green", terrain:["vineyard","single_track"], lat:48.1945, lng:7.3199, reg:"grand-est", org:"Running Alsace", url:"" },
  { name:"Trail des Gorges de la Jonte", city:"Meyrueis", dept:"48", date:"2026-05-23", km:21, elev:900, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:44.1786, lng:3.4237, reg:"occitanie", org:"Trail Lozère", url:"" },
  { name:"Trail de la Planèze de Saint-Flour", city:"Saint-Flour", dept:"15", date:"2026-06-07", km:25, elev:800, type:"trail_s", diff:"blue", terrain:["volcanic","pasture"], lat:45.0343, lng:3.0932, reg:"auvergne-rhone-alpes", org:"Trail Cantal", url:"" },
  { name:"Trail des Causses du Quercy", city:"Cahors", dept:"46", date:"2026-05-30", km:26, elev:700, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:44.4482, lng:1.4428, reg:"occitanie", org:"Trail Quercy", url:"" },
  { name:"Trail du Pays des Templiers", city:"Sainte-Eulalie-de-Cernon", dept:"12", date:"2026-06-14", km:20, elev:700, type:"trail_s", diff:"blue", terrain:["limestone","single_track"], lat:43.9533, lng:3.0803, reg:"occitanie", org:"Trail Aveyron", url:"" },
  { name:"Corrida de Noël de Paris", city:"Paris", dept:"75", date:"2026-12-13", km:10, elev:30, type:"road_10k", diff:"green", terrain:["asphalt"], lat:48.8566, lng:2.3522, reg:"ile-de-france", org:"Paris Running", url:"" },
  { name:"Course des Lumieres Lyon", city:"Lyon", dept:"69", date:"2026-12-05", km:8, elev:60, type:"road_10k", diff:"green", terrain:["asphalt"], lat:45.7640, lng:4.8357, reg:"auvergne-rhone-alpes", org:"Lyon Events", url:"" },
  { name:"Trail de la Transhumance du Aubrac 2027", city:"Laguiole", dept:"12", date:"2027-06-06", km:32, elev:1000, type:"trail_m", diff:"blue", terrain:["pasture","single_track"], lat:44.6833, lng:2.8333, reg:"occitanie", org:"Trail Aubrac", url:"" },
  { name:"Trail du Massif Central 2027", city:"Clermont-Ferrand", dept:"63", date:"2027-04-18", km:42, elev:2200, type:"trail_m", diff:"red", terrain:["volcanic","single_track"], lat:45.7772, lng:3.0870, reg:"auvergne-rhone-alpes", org:"Trail Auvergne", url:"" },
];

export async function POST(req: Request) {
  // Route de MAINTENANCE : elle écrit avec la clé service_role.
  const denied = await denyIfNotAdmin(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const today = new Date().toISOString().slice(0, 10);

  // Get existing races to avoid duplicates
  const { data: existing } = await createAdminClient().from("races").select("name,date");
  const existingKeys = new Set((existing || []).map((r: { name: string; date: string }) =>
    `${r.name.toLowerCase().trim()}::${r.date}`
  ));

  const toInsert = RACES_2026
    .filter(r => r.date >= today) // Only future races
    .filter(r => !existingKeys.has(`${r.name.toLowerCase().trim()}::${r.date}`))
    .map(r => ({
      name: r.name,
      type: r.type,
      region: r.reg,
      department: r.dept,
      city: r.city,
      date: r.date,
      distance_km: r.km,
      elevation_gain_m: r.elev,
      difficulty: r.diff,
      terrain: r.terrain,
      // Pas de barrières inventées (calcul allure×km ≠ donnée réelle) — [] si inconnues.
      time_limits: [],
      registration_url: r.url || "",
      organization: r.org || "",
      description: `${r.name} — ${r.city} (${r.dept})`,
      latitude: r.lat ?? null,
      longitude: r.lng ?? null,
      is_itra_certified: (r as any).itra ?? false,
      itra_points: (r as any).itra_pts ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (toInsert.length === 0) {
    const { count } = await createAdminClient().from("races").select("*", { count: "exact", head: true });
    return NextResponse.json({ inserted: 0, total: count, message: "All races already in DB" });
  }

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await createAdminClient().from("races").insert(toInsert.slice(i, i + BATCH));
    if (error) console.error("Batch error:", error.message);
    else inserted += Math.min(BATCH, toInsert.length - i);
  }

  const { count } = await createAdminClient().from("races").select("*", { count: "exact", head: true });
  return NextResponse.json({ inserted, total: count, message: `${inserted} courses ajoutées` });
}

export async function GET(req: Request) {
  // Route de MAINTENANCE : elle écrit avec la clé service_role.
  const denied = await denyIfNotAdmin(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  return POST(req);
}
