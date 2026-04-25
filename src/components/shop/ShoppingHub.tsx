"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Heart, Star, Zap, AlertTriangle, ExternalLink,
  X, ChevronDown, ChevronUp, Check,
  Search, Loader2, ChevronRight, SlidersHorizontal, LayoutGrid, List,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Category = "shoes_road" | "shoes_trail" | "watches" | "clothing" | "accessories" | "nutrition";
type Terrain = "road" | "trail" | "mixed" | "n/a";
type Cushioning = "minimal" | "moderate" | "maximal" | "n/a";

interface PriceEntry {
  retailer: string;
  retailer_name?: string;
  price: number;
  url: string;
  in_stock: boolean;
}

interface Product {
  id: string;
  category: Category;
  brand: string;
  model: string;
  version: string;
  price: number;
  image: string;
  color_accent: string;
  url: string;
  retailer: string;
  in_stock: boolean;
  terrain: Terrain;
  cushioning: Cushioning;
  drop_mm?: number;
  stack_mm?: number;
  weight_g?: number;
  battery_h?: number;
  gps?: boolean;
  compatibility_score: number;
  tags: string[];
  bio_reasons: string[];
  specs: { label: string; value: string }[];
  new?: boolean;
  price_entries?: PriceEntry[];
}

// ── Product generator ──────────────────────────────────────────────────────────
const PRODUCTS: Product[] = (() => {
  const out: Product[] = [];
  let seq = 0;
  const gid = (pfx: string) => `${pfx}${seq++}`;

  const CUSH: Cushioning[] = ["minimal", "moderate", "maximal"];
  const RETAILER_KEYS = ["i-run", "alltricks", "lepape", "ekosport", "decathlon"];
  const RETAILER_URLS: Record<string, string> = {
    "i-run": "https://www.i-run.fr",
    "alltricks": "https://www.alltricks.fr",
    "lepape": "https://www.lepape.com",
    "ekosport": "https://www.ekosport.fr",
    "decathlon": "https://www.decathlon.fr",
  };

  // Image pools per category — verified Unsplash IDs
  const IMGS = {
    // Road running shoes — uniquement chaussures running performance (vérifiées CDN 200)
    road: [
      "photo-1542291026-7eec264c27ff",      // Nike Free RN Flyknit rouge ✓
      "photo-1491553895911-0055eca6402d",   // Nike Zoom course sur route ✓
      "photo-1571008887538-b36bb32f4571",   // Adidas route 10K race ✓
      "photo-1581888748626-2a3f240a6f9f",   // Nike sur route montagne ✓
      "photo-1575456456278-936c89ccdb7b",   // ASICS Gel produit ✓
      "photo-1644001992668-3b9ed080533a",   // ASICS noir/bleu/orange ✓
      "photo-1765914448113-ebf0ce8cb918",   // Pieds running bitume marathon ✓
      "photo-1765914448116-587acf59e3f3",   // Chaussure orange sur piste sprint ✓
    ],
    // Trail running shoes (chaussures de trail)
    trail: [
      "photo-1553361371-9b22f78e8b1d", // Trail shoe boue
      "photo-1551698618-1dfe5d97d256", // Trail shoe profil
      "photo-1574680096145-d05b474e2155", // Trail running shoe
      "photo-1506629082955-511b1aa562c8", // Coureur trail montagne
      "photo-1484557985045-edf25e08da73", // Running trail vue de bas
      "photo-1476480862126-209bfaa8edc8", // Running trail sentier
    ],
    // GPS watches (montres GPS)
    watch: [
      "photo-1508685096489-7aacd43bd3b1", // Smartwatch GPS
      "photo-1434494878577-86c23bcb06b9", // Smartwatch poignet
      "photo-1523275335684-37898b6baf30", // GPS watch Garmin style
      "photo-1546868871-7041f2a55e12",    // Smartwatch running
      "photo-1579586337278-3befd40fd17a", // Smartwatch sport
      "photo-1617886322168-72b886573c35", // GPS running watch
    ],
    // Clothing (vêtements running)
    cloth: [
      "photo-1556906781-9a412961a28c", // T-shirt running
      "photo-1571902943202-507ec2618e8f", // Running outfit
      "photo-1539710090369-f5fddc867a9a", // Short running
      "photo-1544441893-675973e31985",    // Running jacket
      "photo-1598346762291-aee88549193f", // Running tights
      "photo-1576566588028-4147f3842f27", // Running top
      "photo-1622163642998-1ea32b0bbc67", // Running vest
      "photo-1594737625785-a6cbdabd333c", // Trail running outfit
    ],
    // Accessories (accessoires)
    acc: [
      "photo-1517649763962-0c623066013b", // Running hydration vest
      "photo-1586790170083-2f9ceadc732d", // Sports headphones
      "photo-1608043152269-423dbba4e7e1", // Running belt/pack
      "photo-1464219789935-c2d9d9aba644", // Running headlamp/gear
      "photo-1581009137042-c552e485697a", // Sports gear
      "photo-1552674605-db6ffd4facb5", // Running accessory
    ],
    // Nutrition (gel, barres, boissons)
    nutr: [
      "photo-1532550907401-a500c9a57435", // Sports nutrition
      "photo-1490645935967-10de6ba17061", // Energy food
      "photo-1610832958506-aa56368176cf", // Sports supplement
      "photo-1546069901-ba9599a7e63c",    // Healthy food runner
    ],
  };
  const img = (key: keyof typeof IMGS, i: number) =>
    `https://images.unsplash.com/${IMGS[key][i % IMGS[key].length]}?w=500&h=350&fit=crop&q=80`;

  // ── Brand-deterministic image lookup ──────────────────────────────────────
  // Brand sets the IMAGE POOL → brand is always coherent.
  // ti (model) + cwi (colorway) drive variety WITHIN that brand's pool.
  const brandHash = (b: string) => b.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  // Verified photos per brand — running shoes only, no lifestyle
  const BRAND_ROAD: Record<string, string[]> = {
    "Nike":         ["photo-1542291026-7eec264c27ff",    // Nike Free RN rouge
                     "photo-1491553895911-0055eca6402d", // Nike Zoom course
                     "photo-1581888748626-2a3f240a6f9f"],// Nike montagne
    "Adidas":       ["photo-1571008887538-b36bb32f4571", // Adidas 10K race
                     "photo-1575456456278-936c89ccdb7b"],// ASICS-style produit (neutral)
    "ASICS":        ["photo-1575456456278-936c89ccdb7b", // ASICS Gel produit
                     "photo-1644001992668-3b9ed080533a"],// ASICS noir/bleu/orange
  };
  // Generic running shoes without visible brand — used for all other brands
  const ROAD_GENERIC = [
    "photo-1765914448113-ebf0ce8cb918", // Pieds running sur bitume (marathon)
    "photo-1765914448116-587acf59e3f3", // Chaussure orange sur piste sprint
    "photo-1765914448100-0845241f7481", // Running sur route
    "photo-1765914448097-85ef5e550056", // Course sur route vue de côté
    "photo-1644001992668-3b9ed080533a", // Chaussure sport performance
  ];
  const imgRoad = (brand: string, ti: number, cwi: number): string => {
    const pool = BRAND_ROAD[brand] ?? ROAD_GENERIC;
    // ti gives model variation, cwi gives colorway variation — both within brand's pool
    const id = pool[(ti + cwi) % pool.length];
    return `https://images.unsplash.com/${id}?w=500&h=350&fit=crop&q=80`;
  };
  const imgTrail = (brand: string, ti: number, cwi: number): string => {
    const pool = IMGS.trail;
    return `https://images.unsplash.com/${pool[(brandHash(brand) + ti + cwi) % pool.length]}?w=500&h=350&fit=crop&q=80`;
  };

  // ── Colorways ────────────────────────────────────────────────────────────────
  // [label, accent, price_delta, score_delta, in_stock]
  const CW_ROAD: [string,string,number,number,boolean][] = [
    ["Noir/Blanc",     "#18181b",   0,  0, true],
    ["Blanc/Argent",   "#e2e8f0",   5,  1, true],
    ["Rouge Vif",      "#dc2626",   0,  0, true],
    ["Bleu Electric",  "#2563eb",  10,  0, false],
    ["Vert Fluo",      "#16a34a", -10, -1, true],
    ["Rose/Or",        "#ec4899",   5,  0, true],
    ["Orange/Bleu",    "#f97316",   0,  1, true],
    ["Gris/Noir",      "#6b7280",  -5, -1, true],
  ];
  const CW_TRAIL: [string,string,number,number,boolean][] = [
    ["Gris/Orange",    "#f97316",  0,  0, true],
    ["Noir/Lime",      "#84cc16",  5,  1, true],
    ["Rouge/Noir",     "#dc2626",  0,  0, true],
    ["Bleu/Jaune",     "#2563eb", 10,  0, false],
    ["Vert Forêt",     "#166534",  0,  0, true],
    ["Marine/Blanc",   "#1e3a5f",  5, -1, true],
  ];
  const CW_WATCH: [string,string,number,number,boolean][] = [
    ["Noir Carbone",   "#18181b",   0,  0, true],
    ["Titane Argent",  "#94a3b8",  50,  1, true],
    ["Saphir Bleu",    "#1e40af",  30,  0, false],
    ["Or Rose",        "#d4a27f",  40,  0, true],
  ];
  const CW_CLOTH: [string,string,number,number,boolean][] = [
    ["Noir",           "#18181b",  0,  0, true],
    ["Blanc",          "#f8fafc",  0,  0, true],
    ["Bleu Marine",    "#1e3a5f",  0,  0, true],
    ["Rouge",          "#dc2626",  5,  0, true],
    ["Vert",           "#166534",  0,  0, false],
    ["Gris Anthracite","#374151",  0,  0, true],
  ];
  const CW_ACC: [string,string,number,number,boolean][] = [
    ["Standard",       "#18181b",  0,  0, true],
    ["Pro Edition",    "#1e40af", 20,  2, true],
    ["Édition Ltd",    "#dc2626", 30,  1, false],
  ];
  const CW_NUTR: [string,string,number,number,boolean][] = [
    ["x12 unités",     "#f97316",  0,  0, true],
    ["x24 unités",     "#dc2626", 15,  0, true],
    ["x36 unités",     "#16a34a", 25,  0, true],
  ];

  // ── Road shoe templates ──────────────────────────────────────────────────────
  // [brand, model, price, score, drop, stack, weight, cushioning_idx, tags, reasons]
  type ST = [string,string,number,number,number,number,number,0|1|2,string[],string[]];

  const ROAD_T: ST[] = [
    ["Nike",        "Vaporfly 3",               249.99, 96, 8, 40, 195, 2, ["Compétition","Carbon","Marathon"],          ["Plaque carbone ZoomX légèreté","Économie d'énergie +4%"]],
    ["Nike",        "Alphafly 3",               319.99, 93, 8, 39, 220, 2, ["Compétition","Carbon","Record"],            ["Amorti ZoomX + PEBA record","Double Zoom Air pods propulsion"]],
    ["Nike",        "Zoom Fly 5",               179.99, 84, 8, 37, 263, 2, ["Entraînement","Carbon","Tempo"],            ["Flyplate carbone entraînements rapides","React X durable et réactif"]],
    ["Nike",        "Pegasus 41",               134.99, 79,10, 32, 280, 1, ["Entraînement","Polyvalent","Quotidien"],    ["React X quotidien réactif","Stabilité talon large naturelle"]],
    ["Nike",        "Air Zoom Streak 7",        149.99, 82, 8, 28, 195, 0, ["Vitesse","Léger","Racing"],                 ["Ultra-léger 195g vitesse","Semelle XT3 accroche piste"]],
    ["Nike",        "React Infinity Run 4",     159.99, 76, 8, 30, 269, 1, ["Prévention blessures","Quotidien"],         ["Forme large réduction blessures","React X amorti durable"]],
    ["Nike",        "Structure 25",             119.99, 72,10, 30, 298, 1, ["Stabilité","Pronation","Quotidien"],        ["Guide Rail stabilité légère","Amorti structuré et durable"]],
    ["Nike",        "Zoom Pegasus Turbo 2",     179.99, 81, 8, 32, 188, 1, ["Tempo","Léger","Vitesse"],                  ["ZoomX foam ultra-réactif léger","188g parmi les + légères entrée gamme"]],
    ["Adidas",      "Adizero Adios Pro 3",      229.99, 91, 6, 39, 213, 2, ["Compétition","Carbon"],                    ["5 EnergyRods propulsion maximale","Lightstrike Pro ultra-réactif"]],
    ["Adidas",      "Adizero Prime X 2S",       299.99, 89, 5, 50, 238, 2, ["Ultra-stack","Carbon","Record"],            ["50mm stack record mondial","Adizero évolution ultime"]],
    ["Adidas",      "Adizero Boston 12",        139.99, 82, 6, 32, 235, 1, ["Entraînement","Rapide","Semi"],             ["Lightstrike Pro sous pied","Transition talon-avant pied"]],
    ["Adidas",      "Adizero SL 2",             109.99, 76, 6, 28, 248, 1, ["Entraînement","Budget","Quotidien"],        ["Budget imbattable débutant","Lightstrike 2.0 réactif"]],
    ["Adidas",      "Supernova Rise 2",         119.99, 74, 8, 32, 273, 1, ["Confort","Quotidien","Budget"],             ["Dual-foam confort quotidien","Dreamstrike+ douceur"]],
    ["Adidas",      "Ultraboost 23",            179.99, 77,10, 35, 313, 2, ["Lifestyle","Confort","Quotidien"],          ["Boost retour d'énergie iconic","Primeknit respirant"]],
    ["Adidas",      "Adizero Takumi Sen 9",     199.99, 85, 5, 30, 174, 0, ["Racing","Vitesse","5K-10K"],               ["174g le plus léger Adizero","Semelle Lightstrike Pro racing"]],
    ["Hoka",        "Rocket X 2",               249.99, 89, 5, 38, 209, 2, ["Compétition","Carbon"],                    ["Drop 5mm idéal midfoot strike","Propulsion carbone PEBA"]],
    ["Hoka",        "Mach X 2",                 179.99, 83, 5, 35, 228, 1, ["Entraînement","Polyvalent"],               ["Profly+ séances longues","Polyvalent tempo/endurance"]],
    ["Hoka",        "Clifton 9",                149.99, 80, 5, 36, 252, 2, ["Confort","Quotidien","Récupération"],       ["Amorti maximal douceur extrême","Extended heel transitions"]],
    ["Hoka",        "Bondi 8",                  169.99, 71, 4, 40, 298, 2, ["Ultra-amorti","Récupération"],             ["Stack 40mm amorti maximal","Parfait sorties Z1 récupération"]],
    ["Hoka",        "Arahi 7",                  149.99, 75, 5, 36, 281, 1, ["Stabilité","Pronation","Confort"],          ["J-Frame stabilité légère","Amorti Hoka maximal stabilisé"]],
    ["Hoka",        "Skyward X",                239.99, 87, 5, 45, 218, 2, ["Compétition","Carbon","Max stack"],        ["45mm stack carbone compétition","PEBA foam ultra-réactif"]],
    ["ASICS",       "MetaSpeed Sky+",           299.99, 88, 5, 40, 215, 2, ["Compétition","Carbon","Paris"],            ["FF TURBO 2 retour énergie","Optimisé grande foulée"]],
    ["ASICS",       "Gel-Nimbus 26",            189.99, 77,13, 36, 309, 2, ["Confort","Long run","Supination"],         ["FF Blast+ Eco longue distance","Gel talon et avant-pied"]],
    ["ASICS",       "Gel-Kayano 31",            199.99, 73,10, 40, 310, 2, ["Stabilité","Pronation","Longue distance"],  ["4D Guidance système","FF Blast Max + Gel double"]],
    ["ASICS",       "Gel-Cumulus 26",           169.99, 76,10, 34, 283, 1, ["Quotidien","Entraînement","Confort"],       ["FF Blast entraînements réguliers","Stabilité naturelle large"]],
    ["ASICS",       "GT-2000 13",               129.99, 74,10, 32, 283, 1, ["Stabilité","Quotidien","Débutant"],         ["IdaHold légère stabilité","Amorti régulier durable"]],
    ["ASICS",       "Gel-DS Trainer 28",        149.99, 80,10, 28, 245, 0, ["Racing","Tempo","Semi"],                   ["DS-lite léger semi-marathon","Renforts stabilité latérale"]],
    ["Saucony",     "Endorphin Pro 3",          219.99, 86, 8, 39, 204, 2, ["Compétition","Carbon"],                    ["Speedroll geometry naturelle","PWRRUN PB ultra-léger"]],
    ["Saucony",     "Endorphin Speed 4",        174.99, 84, 8, 35, 238, 2, ["Entraînement","Carbon","Polyvalent"],      ["Nylon speedboard plaque légère","PWRRUN PB réactif"]],
    ["Saucony",     "Kinvara 14",               119.99, 84, 4, 26, 220, 0, ["Légèreté","Vitesse","Natural"],            ["Drop 4mm foulée naturelle","220g léger tempo"]],
    ["Saucony",     "Triumph 22",               169.99, 78,10, 38, 294, 2, ["Confort","Longue sortie","Quotidien"],     ["PWRRUN+ ultra-moelleux","Longues sorties endurance Z2"]],
    ["Saucony",     "Guide 17",                 139.99, 75,10, 33, 286, 1, ["Stabilité","Léger","Quotidien"],           ["PWRRUN stabilité légère","Légère sur-pronation"]],
    ["New Balance", "FuelCell SuperComp Elite v4",259.99,85, 4, 40, 199, 2, ["Compétition","Carbon"],                  ["V-lign propulsion avant-pied","Pebax + carbon léger"]],
    ["New Balance", "FuelCell Rebel v4",        139.99, 83, 6, 32, 235, 1, ["Tempo","Léger","Réactif"],                 ["FuelCell ultra-réactif vitesse","Parmi les + légères"]],
    ["New Balance", "Fresh Foam 1080 v13",      174.99, 78, 6, 36, 293, 2, ["Confort","Long run","Sorties longues"],    ["Fresh Foam X ultra-moelleux","Semelle ample stabilité"]],
    ["New Balance", "Fresh Foam X 880 v14",     149.99, 76,10, 32, 278, 1, ["Quotidien","Entraînement","Durable"],      ["Fresh Foam X régulier","Durable et confortable"]],
    ["New Balance", "RC Elite v3",              229.99, 87, 4, 32, 195, 2, ["Compétition","Carbon","Race"],             ["Pebax carbone 195g compétition","Plaque carbone racing"]],
    ["Brooks",      "Ghost 16",                 139.99, 71,12, 32, 268, 1, ["Entraînement","Confort"],                  ["DNA Loft v3 douceur","Récupération active idéal"]],
    ["Brooks",      "Hyperion Max 2",           189.99, 83, 8, 38, 226, 2, ["Compétition","Polyvalent","Semi"],         ["DNA Flash v2 ultra-réactif","Carbone-infusée légère"]],
    ["Brooks",      "Glycerin 21",              169.99, 76,10, 38, 306, 2, ["Confort","Longue sortie","Neutre"],        ["DNA Loft v3 ultra-moelleux","Neutre maximal confort"]],
    ["Brooks",      "Launch 10",                119.99, 77,10, 28, 258, 1, ["Tempo","Budget","Polyvalent"],             ["BioMoGo DNA réactif léger","Sessions tempo rapides"]],
    ["Brooks",      "Adrenaline GTS 23",        139.99, 74,12, 31, 283, 1, ["Stabilité","Quotidien"],                  ["GuideRails stabilité douce","DNA Loft polyvalent"]],
    ["On Running",  "Cloudflow 4",              159.99, 81, 8, 30, 249, 1, ["Vitesse","Entraînement","Léger"],          ["CloudTec Phase propulsion dynamique","Polyvalent tempo"]],
    ["On Running",  "Cloudsurfer 2",            169.99, 79, 8, 32, 278, 1, ["Quotidien","Polyvalent","Confort"],        ["CloudTec Phase transitions fluides","Helion Superfoam"]],
    ["On Running",  "Cloudmonster 2",           169.99, 77, 8, 35, 285, 2, ["Confort","Maximaliste","Endurance"],       ["Super amorti CloudTec giant","Helion ultra-réactif"]],
    ["On Running",  "Cloud X 4",                159.99, 80, 8, 27, 254, 1, ["Polyvalent","Sport","CrossFit"],           ["Polyvalent run + training","CloudTec Phase stable"]],
    ["Mizuno",      "Wave Rider 27",            159.99, 75,12, 33, 278, 1, ["Stabilité","Quotidien","Entraînement"],    ["Wave plate stabilité naturelle","ENERZY foam réactif"]],
    ["Mizuno",      "Wave Inspire 21",          169.99, 73,12, 35, 296, 1, ["Stabilité","Pronation","Confort"],         ["Fan Wave stabilité légère","ENERZY Lite sous pied"]],
    ["Mizuno",      "Wave Neo Wind",            249.99, 85, 8, 39, 220, 2, ["Compétition","Carbon","Marathon"],         ["Enerzy Neo foam carbone","Plaque carbone propulsion"]],
    ["Puma",        "Fast-R Nitro Elite 2",     249.99, 87, 8, 40, 210, 2, ["Compétition","Carbon","Course"],           ["PWRPLATE Carbon full-length","NITRO Elite ultra-léger"]],
    ["Puma",        "Velocity Nitro 3",         129.99, 77,10, 32, 265, 1, ["Entraînement","Polyvalent","Budget"],      ["NITRO foam réactif quotidien","Budget imbattable Nitro"]],
    ["Puma",        "Deviate Nitro 3",          174.99, 84, 8, 35, 248, 2, ["Tempo","Vitesse","Semi"],                  ["NITRO Elite Foam réactif","Tige Pwrtape légère"]],
    ["Salomon",     "Aero Volt 2",              164.99, 80, 6, 33, 245, 1, ["Polyvalent","Route-Trial","Léger"],        ["Route et chemins mixtes","Energy Save geometry"]],
    ["Reebok",      "Floatride Energy 5",       109.99, 74, 8, 30, 263, 1, ["Budget","Quotidien","Entraînement"],       ["Floatride Energy foam réactif","Prix imbattable entrée gamme"]],
    ["Under Armour","HOVR Sonic 6",             109.99, 73, 8, 28, 274, 1, ["Entraînement","Quotidien","Budget"],       ["HOVR foam zéro gravité","MapMyRun connecté"]],
    ["Under Armour","HOVR Infinite 5",          129.99, 75, 8, 33, 291, 1, ["Longue sortie","Confort","Quotidien"],     ["HOVR amorti longue distance","Tige respirante Energy Web"]],
  ];

  // ── Trail shoe templates ─────────────────────────────────────────────────────
  const TRAIL_T: ST[] = [
    ["Salomon",     "S/Lab Ultra 3",            249.99, 94, 6, 30, 265, 1, ["Ultratrail","Compétition","Terrain mixte"],["Contagrip MA terrains variés","Plateforme ultra longue distance"]],
    ["Salomon",     "Speedcross 6",             134.99, 84,10, 27, 311, 1, ["Trail","Boue","Crampons"],                 ["Crampons 6mm mordent la boue","Sensifit précision pointure"]],
    ["Salomon",     "Ultra Glide 2",            149.99, 82, 8, 34, 290, 1, ["Trail","Entraînement","Terrain mixte"],    ["Accroche terrain mixte optimal","Stabilité biomécanique"]],
    ["Salomon",     "Sense Ride 5",             134.99, 83, 8, 28, 290, 1, ["Trail","Quotidien","Terrain mixte"],       ["Contagrip TA polyvalent","Léger et agile sentiers"]],
    ["Salomon",     "XA Pro 3D v9",             134.99, 74,10, 28, 320, 1, ["Trail","Protection","Randonnée rapide"],   ["3D Advanced Chassis protection","Contagrip TA tout terrain"]],
    ["Salomon",     "Genesis",                  189.99, 86, 6, 36, 275, 2, ["Trail","Ultratrail","Amorti"],             ["Energy Surge foam protection","EVA HD durable"]],
    ["Salomon",     "Pulsar Trail Pro 2",       209.99, 88, 6, 32, 245, 1, ["Trail","Carbon","Compétition"],           ["Plaque carbone trail léger","Contagrip MA polyvalent"]],
    ["Hoka",        "Speedgoat 6",              169.99, 88, 4, 37, 320, 2, ["Ultratrail","Protection","Terrain difficile"],["Vibram Megagrip adhérence extrême","Protection maximale ultra"]],
    ["Hoka",        "Tecton X 3",               219.99, 91, 5, 39, 254, 2, ["Trail","Carbon","Ultratrail","Compétition"],["Plaque carbone ELI trail","Vibram Litebase légère"]],
    ["Hoka",        "Challenger 7",             144.99, 81, 5, 33, 277, 2, ["Trail","Route","Polyvalent"],              ["Polyvalent route/chemin","Amorti Hoka maximal"]],
    ["Hoka",        "Zinal 2",                  154.99, 84, 4, 33, 254, 1, ["Trail","Racing","Montagne","Léger"],       ["254g léger pour montagne","Vibram Megagrip précision"]],
    ["Hoka",        "EVO Speedgoat 2",          169.99, 82, 4, 37, 275, 2, ["Ultratrail","Long","Protection"],          ["MaxTrac outsole maximale","CMEVA légère ultra"]],
    ["Inov-8",      "Trailfly G 270 V2",        169.99, 85, 8, 28, 270, 1, ["Trail","Terrain mixte","Graphène"],        ["Graphène 50x plus durable","Crampon 4mm polyvalent"]],
    ["Inov-8",      "Mudtalon Speed",           154.99, 83, 6, 22, 250, 0, ["Trail","Boue","Crampon 8mm","Course"],     ["Crampons 8mm boue profonde","Graphène résistance x50"]],
    ["Inov-8",      "Parkclaw G 280",           149.99, 79, 8, 24, 280, 1, ["Trail","Urban","Polyvalent"],              ["Polyvalent city/trail","Crampon 4mm discret route"]],
    ["La Sportiva", "Jackal II",                139.99, 80, 6, 22, 245, 0, ["Trail","Racing","Terrain rocheux"],        ["Légèreté compétition trail","FriXion XF rocheux"]],
    ["La Sportiva", "Lycan II",                 124.99, 77, 6, 24, 265, 0, ["Trail","Racing","Léger"],                  ["265g ultra-léger montagne","FriXion AT terrains mixtes"]],
    ["La Sportiva", "Bushido III",              164.99, 82, 6, 27, 245, 0, ["Trail","Racing","Polyvalent"],             ["FriXion XT compound premium","Racing montagne confirmé"]],
    ["ASICS",       "Gel-Trabuco 12",           139.99, 76, 8, 30, 310, 1, ["Trail","Protection","Confort"],            ["Gel descentes techniques","Trail Specific Outsole"]],
    ["ASICS",       "Trabuco Max 3",            174.99, 77, 8, 36, 315, 2, ["Ultratrail","Confort","Protection"],       ["Stack 36mm ultra longues distances","FF Blast protecteur"]],
    ["Brooks",      "Cascadia 17",              144.99, 76, 8, 32, 332, 1, ["Trail","Confort","Protection"],            ["TrailTack terrains variés","Protection descentes max"]],
    ["Brooks",      "Divide 4",                 109.99, 72,10, 28, 298, 1, ["Trail","Budget","Polyvalent","Débutant"],  ["Budget trail idéal début","Sticky rubber accroche basique"]],
    ["Nike",        "Wildhorse 8",              119.99, 74, 8, 29, 288, 1, ["Trail","Sentiers","Budget"],               ["Rock plate protection sous-pied","Prix accessible débutants"]],
    ["Nike",        "Juniper Trail 2",           89.99, 66,10, 26, 285, 1, ["Trail","Budget","Débutant"],               ["Entrée trail prix mini","Accroche basique chemins faciles"]],
    ["Adidas",      "Terrex Speed Ultra",       189.99, 87, 5, 24, 231, 0, ["Trail","Racing","Ultra-léger","Compétition"],["Continental Rubber max","231g ultra-léger compétition"]],
    ["Adidas",      "Terrex Agravic Speed+",    219.99, 88, 5, 25, 228, 0, ["Trail","Racing","Speed"],                  ["Stealth rubber grip","Ultra-léger trail racing compétition"]],
    ["Adidas",      "Terrex Trailmaker 2",      129.99, 74,10, 28, 311, 1, ["Trail","Polyvalent","Confort"],            ["Continental Rubber tout terrain","Cloudfoam trail coussin"]],
    ["Merrell",     "MTL Long Sky 2",           159.99, 79, 4, 25, 261, 1, ["Trail","Montagne","Léger"],                ["Floatpro foam sentiers alpins","Vibram FG humide"]],
    ["Merrell",     "Agility Peak 5",           134.99, 77, 0, 21, 255, 0, ["Trail","Racing","Drop 0","Minimaliste"],   ["Drop 0 foulée naturelle trail","TrailProtect sous-pied"]],
    ["Scarpa",      "Spin Infinity 2",          164.99, 82, 6, 27, 250, 1, ["Trail","Montagne","Polyvalent"],           ["Déroulement naturel progressif","Dynafit Speed léger"]],
    ["On Running",  "Cloudultra 2",             184.99, 80, 6, 32, 290, 2, ["Ultratrail","Confort","Polyvalent"],       ["CloudTec + Helion super foam","Missiongrip adhérence"]],
    ["New Balance", "Summit Unknown v3",        154.99, 79, 6, 34, 299, 2, ["Trail","Ultra","Confort"],                 ["FuelCell Trail dynamique","Vibram Megagrip difficile"]],
    ["Dynafit",     "Ultra 100",                174.99, 85, 6, 28, 290, 1, ["Trail","Ultra","Légèreté"],                ["290g ultra-léger trail","Vibram Litebase 2.5mm"]],
    ["Dynafit",     "Speed MTN",                164.99, 83, 6, 25, 255, 0, ["Skyrunning","Racing","Léger"],             ["255g skyrunning premium","Vibram Litebase 2mm"]],
    ["Salewa",      "Pedroc Ultra 2",           164.99, 81, 6, 26, 265, 0, ["Skyrunning","Trail","Légèreté"],           ["Michelin OutDry compound","Anti-Grav outsole"]],
    ["Altra",       "Mont Blanc",               179.99, 81, 0, 28, 275, 1, ["Trail","Drop 0","Ultratrail","Durable"],   ["Drop 0 foulée naturelle","Max Trac accroche max"]],
    ["Altra",       "Olympus 5",                174.99, 78, 0, 33, 298, 2, ["Trail","Ultra-amorti","Drop 0"],           ["Stack 33mm drop 0 unique","MaxTrac accroche tout terrain"]],
    ["Altra",       "Lone Peak 8",              149.99, 76, 0, 25, 284, 1, ["Trail","Drop 0","Polyvalent"],             ["Semelle large naturelle","FootShape toe-box confort"]],
    ["Saucony",     "Peregrine 14",             139.99, 80, 4, 28, 262, 1, ["Trail","Tout terrain","Polyvalent"],       ["PWRFOAM trail dynamique","PWRRUN terrain varié"]],
    ["Saucony",     "Xodus Ultra 2",            154.99, 78, 4, 34, 298, 2, ["Trail","Ultratrail","Confort"],            ["PWRRUN+ ultra-moelleux ultra","PWRFOAM trail durable"]],
  ];

  // ── Watch templates ──────────────────────────────────────────────────────────
  type WT = [string,string,number,number,number,boolean,string[],string[]];
  const WATCH_T: WT[] = [
    ["Garmin",   "Fenix 8 Solar",              999.99, 99, 82, true,  ["GPS","Multisport","Solaire"],       ["AMOLED + charge solaire premium","HRV Status + Body Battery"]],
    ["Garmin",   "Fenix 7 Pro Solar",          849.99, 98, 79, true,  ["GPS","Multisport","Solaire"],       ["Cartes topo incluses","Training Readiness avancé"]],
    ["Garmin",   "Fenix 7",                    699.99, 95, 73, true,  ["GPS","Multisport","Trail"],         ["Full multisport Garmin","Autonomie 18j GPS"]],
    ["Garmin",   "Forerunner 965",             599.99, 96, 52, true,  ["GPS","Running","AMOLED"],           ["AMOLED premium 1.4\"","Training Readiness quotidien"]],
    ["Garmin",   "Forerunner 955",             499.99, 93, 53, true,  ["GPS","Running","Triathlon"],        ["VO2max + Training Load","Nutrition et hydratation advisor"]],
    ["Garmin",   "Forerunner 745",             399.99, 90, 47, true,  ["GPS","Running","Triathlon"],        ["Garmin Pay + musique","Dynamiques de course complètes"]],
    ["Garmin",   "Forerunner 265",             449.99, 92, 47, true,  ["GPS","Running","AMOLED"],           ["AMOLED + Training Readiness","Morning Report quotidien"]],
    ["Garmin",   "Forerunner 255 Music",       299.99, 91, 49, true,  ["GPS","Running","Musique"],          ["HRV Status + musique 500 titres","Meilleur rapport qualité-prix"]],
    ["Garmin",   "Forerunner 165",             249.99, 85, 39, true,  ["GPS","Running","AMOLED Budget"],    ["AMOLED prix le plus bas","Training Readiness débutant"]],
    ["Garmin",   "Instinct 2X Solar",          449.99, 89, 67, true,  ["GPS","Solaire","Militaire"],        ["Autonomie illimitée solaire","MIL-STD-810 résistant"]],
    ["Garmin",   "Instinct 2",                 299.99, 86, 54, true,  ["GPS","Outdoor","Robuste"],          ["Robustesse ultime outdoor","28j autonomie sans GPS"]],
    ["Garmin",   "Lily 2",                     249.99, 82, 24, true,  ["GPS","Femme","OLED"],              ["Montre femme stylée GPS","OLED haute résolution"]],
    ["Garmin",   "Venu 3",                     449.99, 88, 47, true,  ["GPS","AMOLED","Santé"],            ["Health Snapshot santé complète","AMOLED Always-On"]],
    ["Garmin",   "Vivoactive 5",               299.99, 84, 45, true,  ["GPS","Polyvalent","AMOLED"],       ["60+ sports modes","Garmin Pay + AMOLED"]],
    ["COROS",    "VERTIX 2S",                  699.99, 97, 89, true,  ["GPS","Ultratrail","Autonomie"],     ["60j autonomie montre","EvoLab analyse physiologique"]],
    ["COROS",    "APEX 2 Pro",                 449.99, 95, 63, true,  ["GPS","Trail","Autonomie"],          ["Running power intégré","35j sans GPS"]],
    ["COROS",    "APEX 2",                     299.99, 90, 52, true,  ["GPS","Trail","Polyvalent"],         ["EvoLab avancé","30j autonomie trail"]],
    ["COROS",    "PACE 3",                     249.99, 92, 30, true,  ["GPS","Ultra-léger","Running"],      ["30g plus légère GPS du marché","20j autonomie"]],
    ["COROS",    "PACE 2",                     199.99, 87, 35, true,  ["GPS","Running","Budget"],           ["Budget imbattable","30h GPS autonomie"]],
    ["Polar",    "Vantage V3",                 499.99, 93, 55, true,  ["GPS","Running","VFC"],             ["VFC ultra-précise Polar","Fuel Wise nutrition advisor"]],
    ["Polar",    "Grit X2 Pro",                399.99, 91, 51, true,  ["GPS","Trail","AMOLED Titane"],     ["Boîtier titane + AMOLED","Hill Splitter automatique"]],
    ["Polar",    "Pacer Pro",                  299.99, 88, 45, true,  ["GPS","Running","VFC"],             ["Hill Splitter auto","Running Power sans capteur"]],
    ["Polar",    "Ignite 3",                   299.99, 84, 35, true,  ["GPS","Running","AMOLED"],          ["AMOLED + Sleep Plus Stages","Charge optimale quotidienne"]],
    ["Polar",    "Pacer",                      199.99, 82, 38, true,  ["GPS","Running","Budget"],          ["Budget running Polar efficace","Entraînement basique"]],
    ["Suunto",   "Vertical Titanium Solar",    699.99, 94, 79, false, ["GPS","Trail","Solaire Titan"],     ["Altimètre barométrique montagne","90j autonomie solaire"]],
    ["Suunto",   "Race S",                     449.99, 90, 37, true,  ["GPS","Ultra-léger","AMOLED"],      ["37g ultra-léger compétition","Training Load Pro scientifique"]],
    ["Suunto",   "Race",                       599.99, 92, 50, true,  ["GPS","Running","AMOLED"],          ["AMOLED + cartes détaillées","SuuntoPlus navigation"]],
    ["Apple",    "Watch Ultra 2",              949.99, 88, 61, true,  ["GPS","Titan","Trail","Ultra"],     ["3000 nits + titane 49mm","GPS L1+L5 dual frequency"]],
    ["Apple",    "Watch Series 9",             449.99, 80, 38, true,  ["GPS","Running","ECG"],             ["ECG + crash detection","Siri avancé offline"]],
    ["Samsung",  "Galaxy Watch Ultra",         599.99, 82, 60, true,  ["GPS","Android","Triathlon"],       ["Triathlon mode complet","Titanium + 100m waterproof"]],
    ["Samsung",  "Galaxy Watch 7",             299.99, 78, 33, true,  ["GPS","Android","Running"],         ["BioActive sensor avancé","Sleep coaching Samsung"]],
    ["Withings", "ScanWatch 2",                299.99, 79, 30, true,  ["GPS","Santé","ECG","Cardio"],      ["ECG + SpO2 médical","Autonomie 30j classique"]],
  ];

  // ── Clothing templates ───────────────────────────────────────────────────────
  type CT = [string,string,number,number,number,string[],string[]];
  const CLOTH_T: CT[] = [
    // Vestes
    ["Salomon",    "Bonatti Trail Jacket",      219.99, 88, 265, ["Veste","Imperméable","Trail"],       ["10 000mm H₂O","Respirabilité 10 000 g/m²"]],
    ["Gore Wear",  "R3 GTX Active Jacket",      299.99, 91, 290, ["Veste","Gore-Tex","3 couches"],      ["Gore-Tex Active imperméable","Coupe anatomique course"]],
    ["Gore Wear",  "Impulse Jacket",            149.99, 83, 170, ["Coupe-vent","Packable","Léger"],     ["170g ultra-packable","DWR déperlant durable"]],
    ["On Running", "Weather Jacket",            259.99, 84, 170, ["Veste","Ultra-légère","Coupe-vent"], ["Imperméable 20 000mm","170g tient dans la poche"]],
    ["Inov-8",     "Ultrashell HZ V2",          139.99, 82, 150, ["Coupe-vent","Trail","Léger"],        ["150g ultra-léger trail","Protection vent + pluie légère"]],
    ["Kalenji",    "Veste Running Imperméable",  49.99, 65, 310, ["Veste","Budget","Débutant"],         ["Budget imbattable","Imperméable 2500mm entrée gamme"]],
    ["Salomon",    "Lightning Jacket",          179.99, 86, 115, ["Veste","Coupe-vent","Ultra-légère"], ["115g la + légère marché","Matière recyclée certifiée"]],
    ["Compressport","Hurricane V5",             189.99, 84, 245, ["Veste","Trail","Protection"],        ["Imperméable 20 000mm trail","Running dynamics compatible"]],
    ["Adidas",     "Terrex Agravic Rain Jacket",159.99, 80, 210, ["Veste","Trail","Imperméable"],       ["TERREX recyclé 100%","Imperméable trail technique"]],
    ["The North Face","Flight Vent Jacket",     199.99, 83, 130, ["Veste","Coupe-vent","Running"],      ["FlashDry-XD technique légère","Trail rapide résistant"]],
    // Maillots/T-shirts
    ["Compressport","Racing T-Shirt v4",         64.99, 86,  89, ["T-shirt","Compression","Compétition"],["89g ultra-léger compétition","Fit compression légère"]],
    ["X-Bionic",   "Effektor G2 Run Shirt",     119.99, 89, 125, ["Maillot","Thermorégulation","Pro"],  ["3D BionicSphere thermorégulation","Canaux ventilation ciblés"]],
    ["Salomon",    "Agile Running T-Shirt",      44.99, 80, 100, ["T-shirt","Trail","Séchage rapide"],  ["Polyester recyclé séchage ultra-rapide","Anti-irritation trail"]],
    ["Craft",      "ADV Essence LS Tee",         69.99, 82, 135, ["T-shirt","Technique","Respirant"],   ["Anti-bactérien longues sorties","Aération zones chaudes"]],
    ["Kalenji",    "T-shirt Running Sec",        14.99, 64, 130, ["T-shirt","Budget","Débutant"],       ["Prix mini running","Séchage rapide basique efficace"]],
    ["Nike",       "Dri-FIT Rise 365 SS",        44.99, 78, 115, ["T-shirt","Léger","Dri-FIT"],         ["Dri-FIT evacuation transpiration","Coupe ergonomique course"]],
    ["Adidas",     "Own The Run Tee",            34.99, 76, 125, ["T-shirt","Running","Budget"],         ["AEROREADY séchage rapide","Polyester recyclé 100%"]],
    ["Skins",      "Compression Baselayer LS",   89.99, 85, 165, ["Sous-couche","Compression","Pro"],   ["DNAmic Series 5 compression","SPF 50+ protection"]],
    ["Odlo",       "Active Warm Eco Top LS",     79.99, 81, 175, ["Sous-couche","Hiver","Thermique"],   ["Hiver températures négatives","Recyclé OEKO-TEX"]],
    ["Inov-8",     "Merino Long Sleeve Base",    89.99, 82, 185, ["Maillot","Mérinos","Anti-odeur"],    ["Mérinos 100% thermorégulation","Anti-odeur multi-jours"]],
    // Shorts/Collants
    ["Compressport","Trail Half Short",          79.99, 85,  98, ["Short","Compression","Trail"],       ["Compression 70 deniers","Anti-irritation coutures plates"]],
    ["Nike",       "Dri-FIT Trail Short 5\"",    54.99, 78, 115, ["Short","Trail","Légèreté"],          ["Dri-FIT evacuation transpiration","Poches latérales gels"]],
    ["Adidas",     "Terrex Trail Shorts",        59.99, 76, 135, ["Short","Trail","Polyvalent"],        ["AEROREADY respirant trail","Poches zippées téléphone"]],
    ["Kalenji",    "Short Trail XT 10km",        29.99, 70, 120, ["Short","Budget","Débutant"],         ["Budget imbattable","Poche téléphone + 2 poches frontales"]],
    ["Skins",      "Series-5 Long Tights",      109.99, 86, 185, ["Collant","Compression","Récupération"],["Compression 400 den","Réduction DOMS clinique"]],
    ["Compressport","Women Full Tights v4",      99.99, 84, 190, ["Collant","Femme","Compétition"],    ["Running Geometry anatomique","Poche clé + réfléchissant"]],
    ["CEP",        "The Run Compression 4.0",    44.99, 86,  72, ["Chaussettes","Compression","Marathon"],["Compression 20-30 mmHg médicale","Micro-vibrations réduites"]],
    ["Compressport","Pro Racing Socks v4",       24.99, 89,  45, ["Chaussettes","Compression","Anti-ampoules"],["200 den avant-pied","Anti-friction marathon"]],
    ["Buff",       "CoolNet UV Multifunctional", 22.99, 83,  25, ["Bandeau","UV","Polyvalent"],         ["UPF 50+ protection maximale","Refroidissement évaporatif"]],
    ["Smartwool",  "Run Zero Cushion Sock",      29.99, 82,  55, ["Chaussettes","Laine","Confort"],     ["Mérinos zero cushion légère","Anti-odeur naturel mérinos"]],
    ["Salomon",    "Active Skin 4 Set",          49.99, 79, 175, ["Gilet","Hydratation","Trail"],       ["4L + 2 flasks 500mL","Trail sorties 2-4h idéal"]],
    ["Compressport","R2V2 Arm Sleeves",          34.99, 80,  40, ["Manchons bras","UV","Compression"],  ["UPF 50+ protection bras","Compression légère bras"]],
  ];

  // ── Accessory templates ──────────────────────────────────────────────────────
  type AT = [string,string,number,number,number,string[],string[]];
  const ACC_T: AT[] = [
    ["Petzl",          "Nao RL",                159.99, 93, 115, ["Frontale","1500lm","Reactive"],     ["1500 lumens puissance max","Reactive Lighting automatique"]],
    ["Black Diamond",  "Spot 400",               54.99, 87,  96, ["Frontale","400lm","Rechargeable"],  ["400 lumens trail de nuit","SOS clignotant USB-C"]],
    ["Ledlenser",      "NEO9R",                 109.99, 88, 130, ["Frontale","1200lm","Running"],      ["1200lm optimisé running","Batterie amovible USB-C"]],
    ["Silva",          "Trail Speed 3XT",        99.99, 84, 120, ["Frontale","600lm","Spectra"],       ["600lm Spectra LED","Band confort running 3 LED"]],
    ["Petzl",          "Swift RL Pro",           149.99, 91, 105, ["Frontale","900lm","Pro"],           ["900lm Reactive auto luminosité","Recharge USB-C en marche"]],
    ["Black Diamond",  "Storm 450",              44.99, 83,  82, ["Frontale","450lm","Résistant"],     ["450lm mode tempête résistant","IPX8 immergeable 1m"]],
    ["Garmin",         "HRM-Pro Plus",          129.99, 96,  41, ["Cardio","Running Dynamics","ANT+"],  ["Running Dynamics complet","ECG-like précision certifiée"]],
    ["Polar",          "H10 Chest",              89.99, 94,  37, ["Cardio","ECG","Running"],           ["ECG référence absolue","BT + ANT+ dual band"]],
    ["Wahoo",          "TICKR X v3",             89.99, 88,  32, ["Cardio","Running Dynamics"],        ["Mémoire interne 16h","Running Dynamics sans montre"]],
    ["Stryd",          "Footpod v5",            249.99, 97,   9, ["Capteur puissance","Running Power"], ["Puissance + vent + inclinaison","9g capteur le + précis"]],
    ["Salomon",        "ADV Skin 12 Set",       149.99, 94, 270, ["Sac trail","12L","Hydratation"],    ["12L + 2 soft flasks 500mL","Coupe anatomique running"]],
    ["Osprey",         "Duro 15",               119.99, 83, 395, ["Sac trail","15L","Hydratation"],    ["15L sorties longues","Réservoir 2.5L inclus"]],
    ["Ultimate Direction","Mountain Vest 6.0",  169.99, 91, 215, ["Gilet trail","Ultra","Autonomie"],  ["Ultra minimaliste longues courses","Flasks 500mL x2 incluses"]],
    ["Nathan",         "VaporAir 7L",            99.99, 82, 240, ["Sac trail","7L","Femme"],           ["Coupe femme ExoShell40","Soft flask 2L inclus"]],
    ["Salomon",        "S/Lab Sense Belt",       49.99, 85,  55, ["Ceinture","Gels","Race"],           ["Ceinture gels flasks racing","Légère 55g accès rapide"]],
    ["Nathan",         "Speed 2 Race Belt",      29.99, 78,  35, ["Ceinture","Gels","Budget"],         ["Budget ceinture running","4 poches gels + téléphone"]],
    ["Compressport",   "Calf Sleeves R2V2",      44.99, 87,  60, ["Manchons","Compression","Trail"],   ["Compression graduée vibrations","Proprioception endurance"]],
    ["Compressport",   "Ultra Run Socks 45k",    29.99, 84,  55, ["Chaussettes","Trail","Ultra"],      ["Rembourrage ciblé ultra-trail","Anti-frottement 6h+"]],
    ["Garmin",         "inReach Mini 2",        349.99, 95, 100, ["Sécurité","Satellite","SOS"],       ["Satellite SOS 24/7","Tracking GPS partageable temps réel"]],
    ["Shokz",          "OpenRun Pro 2",         179.99, 90,  29, ["Écouteurs","Bone conduction"],      ["29g oreilles libres trail","OpenBass basses enrichies"]],
    ["Suunto",         "Wing",                   99.99, 84,  36, ["Écouteurs","Bone conduction","Trail"],["IP67 bone conduction trail","Sécurité oreilles libres"]],
    ["Sony",           "WF-SP900",              199.99, 82,   9, ["Écouteurs","Waterproof","Sport"],   ["Totalement waterproof 4Go","IP68 + natation compatible"]],
    ["Black Diamond",  "Distance Carbon FLZ",   199.99, 89, 470, ["Bâtons trail","Carbon","Pliables"], ["Carbone T700 ultra-léger","FLZ ajustement rapide"]],
    ["Leki",           "MCT 12 Vario",          149.99, 85, 500, ["Bâtons trail","Vario","Compact"],   ["Pliant 28cm ultra-compact","Speed System anti-fuite"]],
    ["Salomon",        "Hacker Carbon 130",     159.99, 86, 460, ["Bâtons trail","Carbon","Racing"],   ["Carbon trail compétition","Grip compact ultra-léger"]],
    ["Theragun",       "Prime",                 299.99, 88, 880, ["Récupération","Massage","Percussif"],["Pistolet percussion récupération","5 vitesses 2400 perc/min"]],
    ["Hyperice",       "Normatec 3 Legs",       699.99, 92,2000, ["Récupération","Compression","Pro"], ["Compression dynamique jambes","7 zones personnalisables"]],
    ["Trigger Point",  "GRID Foam Roller",       44.99, 84, 450, ["Récupération","Foam roller","Massage"],["GRID structure 3-zone pressure","Libération myofasciale"]],
  ];

  // ── Nutrition templates ──────────────────────────────────────────────────────
  type NT = [string,string,number,number,string[],string[]];
  const NUTR_T: NT[] = [
    ["Maurten",       "Gel 100",               49.99, 96, ["Gel","Hydrogel","Sans caféine"],      ["Hydrogel 0 GI stress prouvé","25g glucides optimal par gel"]],
    ["Maurten",       "Gel 100 CAF 100",        54.99, 93, ["Gel","Caféine 100mg","Compétition"],  ["100mg caféine dernier tiers","Hydrogel sans GI issues"]],
    ["Maurten",       "Drink Mix 320",          59.99, 94, ["Boisson","Hydrogel","Marathon"],      ["80g glucides/h Hydrogel","Zéro GI issues marathon complet"]],
    ["Maurten",       "Drink Mix 160",          34.99, 91, ["Boisson","Hydrogel","Légère"],        ["40g glucides efforts <2h","Format réduit pratique"]],
    ["GU",            "Energy Gel",             34.99, 81, ["Gel","BCAA","Électrolytes"],          ["BCAA + 15 saveurs dispo","Sodium 100mg électrolytes"]],
    ["GU",            "Roctane Ultra",          54.99, 88, ["Gel","Ultra","Caféine"],              ["3x BCAA protection ultra","Électrolytes complets 6h+"]],
    ["GU",            "Chomps",                 29.99, 79, ["Gommes","Solide","Pratique"],         ["Alternative gel solide","Saveurs fruitées agréables"]],
    ["GU",            "Stroopwafel",            24.99, 76, ["Gaufrette","Solide","Long trail"],    ["Solide ventricule tolérant","Avoine miel érable naturel"]],
    ["SiS",           "GO Isotonic Gel",        44.99, 85, ["Gel","Isotonique","Sans eau"],        ["Seul gel sans eau nécessaire","22g absorption rapide"]],
    ["SiS",           "REGO Rapid Recovery",    44.99, 90, ["Récupération","Protéines","Post"],    ["22g protéines + 23g glucides","L-Glutamine réparation"]],
    ["SiS",           "Beta Fuel",              54.99, 88, ["Gel","Ultra Glucides","80g"],         ["80g glucides/heure 1:0.8","Testé scientifiquement élite"]],
    ["Tailwind",      "Endurance Fuel",         39.99, 88, ["Poudre","Boisson","Ultratrail"],      ["Hydratation + énergie + électrolytes","Formulé 15h+ effort"]],
    ["Spring Energy", "Awesome Sauce",          24.99, 87, ["Gel","Naturel","Vrai food"],          ["100% naturels sans additifs","Estomac sensible ultra-trail"]],
    ["Precision Fuel","Hydration H30",          29.99, 82, ["Hydratation","Pastilles","Électrolytes"],["Na/K/Mg complets","Pastille ultra-pratique en course"]],
    ["Overstim's",    "Gel Coup de Fouet",      32.99, 79, ["Gel","Caféine","Budget"],             ["Budget imbattable 36 gels","Gel liquide facile avaler"]],
    ["Etixx",         "Energy Sport Bar",       24.99, 80, ["Barre","Énergie","Solide"],           ["Maltodextrine + fructose 2:1","Aliment solide trail long"]],
    ["Namedsport",    "Total Energy Rush",      44.99, 82, ["Gel","Isotonique","Vitamines"],       ["Vitamines B + C énergie","22g glucides + électrolytes"]],
    ["Clif Bar",      "Energy Bar",             29.99, 75, ["Barre","Énergie","Naturel"],          ["70% ingrédients biologiques","26g glucides soutenu"]],
    ["Clif Bar",      "Shot Gel",               24.99, 78, ["Gel","BCAA","Double caféine"],        ["100mg caféine double shot","BCAA + électrolytes complets"]],
    ["Science in Sport","Elite Protein",        49.99, 87, ["Protéines","Récupération","Whey"],    ["25g protéines whey isolat","Récupération musculaire optimale"]],
    ["Enervit",       "Isotonic Drink",         29.99, 76, ["Boisson","Isotonique","Effort"],      ["Minéraux + glucides sachet","Citron rafraîchissant effort"]],
    ["Apurna",        "Gel Énergétique",        19.99, 74, ["Gel","Budget","France"],              ["Marque française qualité pro","Budget accessible performance"]],
    ["Baouw",         "Gel Ultra Bio",          24.99, 80, ["Gel","Bio","Naturel"],                ["Bio certifié Ecocert","Naturel pour ultra-trail"]],
    ["HIGH5",         "Energy Gel",             24.99, 76, ["Gel","Budget","Isotonique"],          ["Prix le plus bas marché","Isotonique sans eau nécessaire"]],
    ["OTE",           "Anytime Bar",            34.99, 78, ["Barre","Polyvalent","Naturel"],       ["Barre avant/pendant/après","Naturel facile digestion"]],
  ];

  // ── Generate road shoes: 55 templates × 8 colorways = 440 ───────────────────
  ROAD_T.forEach(([brand, model, price, score, drop, stack, weight, ci, tags, reasons], ti) => {
    CW_ROAD.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("r"),
        category: "shoes_road",
        brand, model, version: ver,
        price: Math.max(49.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "road", cushioning: CUSH[ci],
        drop_mm: drop, stack_mm: stack, weight_g: weight,
        color_accent: accent,
        image: imgRoad(brand, ti, cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [
          { label: "Drop", value: `${drop}mm` },
          { label: "Stack", value: `${stack}mm` },
          { label: "Poids", value: `${weight}g` },
        ],
      });
    });
  });

  // ── Generate trail shoes: 40 templates × 6 colorways = 240 ──────────────────
  TRAIL_T.forEach(([brand, model, price, score, drop, stack, weight, ci, tags, reasons], ti) => {
    CW_TRAIL.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("t"),
        category: "shoes_trail",
        brand, model, version: ver,
        price: Math.max(49.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "trail", cushioning: CUSH[ci],
        drop_mm: drop, stack_mm: stack, weight_g: weight,
        color_accent: accent,
        image: imgTrail(brand, ti, cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [
          { label: "Drop", value: `${drop}mm` },
          { label: "Stack", value: `${stack}mm` },
          { label: "Poids", value: `${weight}g` },
        ],
      });
    });
  });

  // ── Generate watches: 32 templates × 4 colorways = 128 ──────────────────────
  WATCH_T.forEach(([brand, model, price, score, weight, gps, tags, reasons], ti) => {
    CW_WATCH.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("w"),
        category: "watches",
        brand, model, version: ver,
        price: Math.max(99.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "n/a", cushioning: "n/a",
        weight_g: weight, gps,
        color_accent: accent,
        image: img("watch", ti + cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [
          { label: "Poids", value: `${weight}g` },
          { label: "GPS", value: gps ? "Oui" : "Non" },
        ],
      });
    });
  });

  // ── Generate clothing: 33 templates × 6 colors = 198 ────────────────────────
  CLOTH_T.forEach(([brand, model, price, score, weight, tags, reasons], ti) => {
    CW_CLOTH.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("c"),
        category: "clothing",
        brand, model, version: ver,
        price: Math.max(9.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "n/a", cushioning: "n/a",
        weight_g: weight,
        color_accent: accent,
        image: img("cloth", ti + cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [{ label: "Poids", value: `${weight}g` }],
      });
    });
  });

  // ── Generate accessories: 28 templates × 3 variants = 84 ────────────────────
  ACC_T.forEach(([brand, model, price, score, weight, tags, reasons], ti) => {
    CW_ACC.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("a"),
        category: "accessories",
        brand, model, version: ver,
        price: Math.max(9.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "n/a", cushioning: "n/a",
        weight_g: weight,
        color_accent: accent,
        image: img("acc", ti + cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [{ label: "Poids", value: `${weight}g` }],
      });
    });
  });

  // ── Generate nutrition: 25 templates × 3 pack sizes = 75 ────────────────────
  NUTR_T.forEach(([brand, model, price, score, tags, reasons], ti) => {
    CW_NUTR.forEach(([ver, accent, dp, ds, inStock], cwi) => {
      const r = RETAILER_KEYS[(ti + cwi) % RETAILER_KEYS.length];
      out.push({
        id: gid("n"),
        category: "nutrition",
        brand, model, version: ver,
        price: Math.max(9.99, price + dp),
        compatibility_score: Math.min(99, Math.max(60, score + ds)),
        terrain: "n/a", cushioning: "n/a",
        weight_g: 100,
        color_accent: accent,
        image: img("nutr", ti + cwi),
        url: RETAILER_URLS[r], retailer: r, in_stock: inStock,
        tags, bio_reasons: reasons,
        specs: [],
      });
    });
  });

  return out;
})();


// ── Constants ──────────────────────────────────────────────────────────────────
const RETAILERS: Record<string, { name: string; color: string; logo?: string }> = {
  "i-run":     { name: "i-Run",      color: "#E85A1B" },
  "alltricks": { name: "Alltricks",  color: "#16A34A" },
  "lepape":    { name: "Lepape",     color: "#DC2626" },
  "ekosport":  { name: "Ekosport",   color: "#7C3AED" },
  "decathlon": { name: "Décathlon",  color: "#1D4ED8" },
};

const CATEGORIES: { key: Category | "all"; label: string; emoji: string; img: string }[] = [
  { key: "shoes_road",  label: "Chaussures Route", emoji: "🏃", img: "photo-1542291026-7eec264c27ff" },
  { key: "shoes_trail", label: "Chaussures Trail",  emoji: "🏔", img: "photo-1553361371-9b22f78e8b1d" },
  { key: "watches",     label: "Montres GPS",       emoji: "⌚", img: "photo-1508685096489-7aacd43bd3b1" },
  { key: "clothing",    label: "Vêtements",          emoji: "👕", img: "photo-1556906781-9a412961a28c" },
  { key: "accessories", label: "Accessoires",        emoji: "🎒", img: "photo-1517649763962-0c623066013b" },
  { key: "nutrition",   label: "Nutrition",          emoji: "⚡", img: "photo-1532550907401-a500c9a57435" },
];

const BRANDS = [...new Set(PRODUCTS.map(p => p.brand))].sort();
const PAGE_SIZE = 48;

// ── Helpers ────────────────────────────────────────────────────────────────────
function scoreToStars(score: number) {
  if (score >= 95) return 5.0;
  if (score >= 90) return 4.8;
  if (score >= 85) return 4.5;
  if (score >= 80) return 4.3;
  if (score >= 75) return 4.0;
  if (score >= 70) return 3.8;
  return 3.5;
}

function fakeReviewCount(id: string, score: number) {
  // Deterministic fake count based on product id chars
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return 20 + (n % 180) + Math.floor(score * 0.8);
}

function fakeOriginalPrice(price: number, id: string) {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  if (n % 4 === 0) return Math.round(price * 1.25); // 25% off
  if (n % 7 === 0) return Math.round(price * 1.15); // 15% off
  return null;
}

function StarRating({ stars, count }: { stars: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.floor(stars) ? "fill-yellow-400 text-yellow-400" : i - 0.5 <= stars ? "fill-yellow-400/50 text-yellow-400" : "text-zinc-200 fill-zinc-200"}`} />
        ))}
      </div>
      <span className="text-xs text-zinc-400">{stars.toFixed(1)} ({count} avis)</span>
    </div>
  );
}

interface GarageShoe {
  id: string; brand: string; model: string; current_km: number; max_km: number;
}

// ── Filter Sidebar Section ────────────────────────────────────────────────────
function FilterSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-100 last:border-0 pb-4 mb-4 last:mb-0 last:pb-0">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left mb-3 group">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-800 transition-colors">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
      </button>
      {open && children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ShoppingHub() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "price_asc" | "price_desc" | "weight">("score");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [minScore, setMinScore] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [garage, setGarage] = useState<GarageShoe[]>([]);
  const [garageLoading, setGarageLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const searchRef = useRef<HTMLDivElement>(null);

  // Is results mode active?
  const resultsMode = search.length > 0 || category !== "all" || selectedBrands.size > 0 || inStockOnly || minScore > 0 || priceRange[0] > 0 || priceRange[1] < 1000;

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setGarageLoading(false); return; }
      const { data } = await supabase.from("shoes").select("id, brand, model, current_km, max_km").eq("user_id", user.id).eq("is_active", true);
      setGarage((data as GarageShoe[]) ?? []);
      setGarageLoading(false);
    })();
  }, []);

  useEffect(() => { setPage(1); }, [category, search, priceRange, selectedBrands, minScore, inStockOnly, sortBy]);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!inputVal.trim() || inputVal.length < 2) return [];
    const q = inputVal.toLowerCase();
    const seen = new Set<string>();
    const res: string[] = [];
    for (const p of PRODUCTS) {
      const label = `${p.brand} ${p.model}`;
      if (label.toLowerCase().includes(q) && !seen.has(label)) {
        seen.add(label);
        res.push(label);
        if (res.length >= 8) break;
      }
    }
    return res;
  }, [inputVal]);

  const toggleBrand = useCallback((b: string) => {
    setSelectedBrands(prev => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });
  }, []);

  const toggleWishlist = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWishlist(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const filtered = useMemo(() => {
    return PRODUCTS
      .filter(p => category === "all" || p.category === category)
      .filter(p => !search || `${p.brand} ${p.model} ${p.version} ${p.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase()))
      .filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])
      .filter(p => selectedBrands.size === 0 || selectedBrands.has(p.brand))
      .filter(p => p.compatibility_score >= minScore)
      .filter(p => !inStockOnly || p.in_stock)
      .sort((a, b) => {
        if (sortBy === "score") return b.compatibility_score - a.compatibility_score;
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        return (a.weight_g ?? 999) - (b.weight_g ?? 999);
      });
  }, [category, search, priceRange, selectedBrands, minScore, inStockOnly, sortBy]);

  const displayed = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = displayed.length < filtered.length;

  function submitSearch(val: string) {
    setSearch(val);
    setInputVal(val);
    setShowSuggestions(false);
  }

  function resetAll() {
    setCategory("all"); setSearch(""); setInputVal(""); setSelectedBrands(new Set());
    setMinScore(0); setInStockOnly(false); setPriceRange([0, 1000]);
  }

  const activeFilterCount = selectedBrands.size + (inStockOnly ? 1 : 0) + (minScore > 0 ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0);

  // ── LANDING (hero mode) ────────────────────────────────────────────────────
  if (!resultsMode) {
    return (
      <div className="pb-10">
        {/* Hero search */}
        <div className="max-w-2xl mx-auto py-10 px-4 text-center">
          <h1 className="text-3xl font-black text-zinc-900 mb-2">Boutique Running</h1>
          <p className="text-zinc-400 text-sm mb-8">1 167 références · Recommandations IA · Meilleurs prix</p>

          <div ref={searchRef} className="relative">
            <div className="flex items-center bg-white border-2 border-zinc-900 rounded-2xl overflow-hidden shadow-lg">
              <Search className="w-5 h-5 text-zinc-400 ml-4 shrink-0" />
              <input
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={e => e.key === "Enter" && submitSearch(inputVal)}
                placeholder="Rechercher Nike, Garmin, Vaporfly…"
                className="flex-1 px-4 py-4 text-base focus:outline-none placeholder:text-zinc-300"
              />
              <button onClick={() => submitSearch(inputVal)}
                className="bg-zinc-900 text-white px-6 py-4 font-semibold hover:bg-zinc-700 transition-colors text-sm">
                Rechercher
              </button>
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-zinc-200 shadow-xl z-50 overflow-hidden">
                  {suggestions.map(s => (
                    <button key={s} onMouseDown={() => submitSearch(s)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                      <Search className="w-4 h-4 text-zinc-300 shrink-0" />
                      <span className="text-sm text-zinc-700">{s}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Category circles */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 max-w-3xl mx-auto px-4">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className="flex flex-col items-center gap-2 group">
              <div className="w-full aspect-square rounded-2xl overflow-hidden border-2 border-zinc-100 group-hover:border-zinc-900 transition-all shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://images.unsplash.com/${c.img}?w=200&h=200&fit=crop&q=75`}
                  alt={c.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <span className="text-xs font-semibold text-zinc-600 group-hover:text-zinc-900 text-center leading-tight transition-colors">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Popular searches */}
        <div className="max-w-2xl mx-auto px-4 mt-10">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Recherches populaires</p>
          <div className="flex flex-wrap gap-2">
            {["Nike Vaporfly", "Hoka Speedgoat", "Garmin Fenix 7", "Salomon Speedcross", "Adidas Adizero", "Trail shoes", "GPS watch", "Hydration vest"].map(q => (
              <button key={q} onMouseDown={() => submitSearch(q)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-600 text-xs font-medium rounded-full transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS MODE ──────────────────────────────────────────────────────────
  return (
    <div className="pb-10">
      {/* Top search bar (compact) */}
      <div className="flex items-center gap-3 mb-6">
        <div ref={searchRef} className="relative flex-1">
          <div className="flex items-center bg-white border border-zinc-300 rounded-xl overflow-hidden hover:border-zinc-500 transition-colors">
            <Search className="w-4 h-4 text-zinc-400 ml-3 shrink-0" />
            <input
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={e => e.key === "Enter" && submitSearch(inputVal)}
              placeholder="Rechercher un produit…"
              className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
            />
            {inputVal && (
              <button onClick={() => { setInputVal(""); setSearch(""); }} className="pr-3">
                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-700" />
              </button>
            )}
          </div>
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-zinc-200 shadow-xl z-50 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s} onMouseDown={() => submitSearch(s)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                    <Search className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                    <span className="text-sm text-zinc-700">{s}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={resetAll} className="text-sm text-zinc-400 hover:text-zinc-700 whitespace-nowrap flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Réinitialiser
        </button>
      </div>

      {/* Breadcrumb */}
      {(search || category !== "all") && (
        <div className="flex items-center gap-2 mb-4 text-sm text-zinc-400">
          <button onClick={resetAll} className="hover:text-zinc-700">Boutique</button>
          {category !== "all" && (
            <>
              <span>/</span>
              <span className="text-zinc-700 font-medium">{CATEGORIES.find(c => c.key === category)?.label}</span>
            </>
          )}
          {search && (
            <>
              <span>/</span>
              <span className="text-zinc-700 font-medium">Recherche de «{search}»</span>
            </>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden lg:block w-52 shrink-0 space-y-0">
          <div className="sticky top-4 bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filtres
              </span>
              {activeFilterCount > 0 && (
                <button onClick={() => { setSelectedBrands(new Set()); setMinScore(0); setInStockOnly(false); setPriceRange([0, 1000]); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Catégorie */}
            <FilterSection title="Catégorie">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setCategory("all")}
                    className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${category === "all" ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                    {category === "all" && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-zinc-700">Tout ({PRODUCTS.length})</span>
                </label>
                {CATEGORIES.map(c => {
                  const cnt = PRODUCTS.filter(p => p.category === c.key).length;
                  return (
                    <label key={c.key} className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setCategory(category === c.key ? "all" : c.key)}
                        className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${category === c.key ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 hover:border-zinc-500"}`}>
                        {category === c.key && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-zinc-700">{c.emoji} {c.label} <span className="text-zinc-400">({cnt})</span></span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Marque */}
            <FilterSection title="Marque">
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {BRANDS.map(b => {
                  const cnt = PRODUCTS.filter(p => p.brand === b && (category === "all" || p.category === category)).length;
                  if (cnt === 0) return null;
                  return (
                    <label key={b} className="flex items-center gap-2 cursor-pointer group">
                      <div onClick={() => toggleBrand(b)}
                        className={`w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0 ${selectedBrands.has(b) ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 group-hover:border-zinc-500"}`}>
                        {selectedBrands.has(b) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-zinc-700 flex-1">{b}</span>
                      <span className="text-xs text-zinc-400">{cnt}</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Prix */}
            <FilterSection title="Prix">
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-semibold text-zinc-800">
                  <span>{priceRange[0]}€</span><span>{priceRange[1]}€</span>
                </div>
                <input type="range" min={0} max={1000} step={10} value={priceRange[0]}
                  onChange={e => setPriceRange([Math.min(+e.target.value, priceRange[1] - 10), priceRange[1]])}
                  className="w-full accent-zinc-900 h-1" />
                <input type="range" min={0} max={1000} step={10} value={priceRange[1]}
                  onChange={e => setPriceRange([priceRange[0], Math.max(+e.target.value, priceRange[0] + 10)])}
                  className="w-full accent-zinc-900 h-1" />
                <div className="flex gap-1.5 flex-wrap">
                  {[[0,100],[0,200],[0,350],[0,600]].map(([a,b]) => (
                    <button key={`${a}-${b}`} onClick={() => setPriceRange([a,b])}
                      className={`text-xs px-2 py-1 rounded-lg border transition-all ${priceRange[0]===a && priceRange[1]===b ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
                      &lt;{b}€
                    </button>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Score IA */}
            <FilterSection title="Score IA min">
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-zinc-900">{minScore || "Tout"}</span>
                  {minScore > 0 && <span className="text-xs text-zinc-400">/100</span>}
                </div>
                <input type="range" min={0} max={95} step={5} value={minScore}
                  onChange={e => setMinScore(+e.target.value)}
                  className="w-full accent-zinc-900 h-1" />
                <div className="flex gap-1">
                  {[0,75,85,90].map(v => (
                    <button key={v} onClick={() => setMinScore(v)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-all ${minScore===v ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
                      {v===0 ? "Tout" : `≥${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </FilterSection>

            {/* Options */}
            <FilterSection title="Disponibilité" defaultOpen={false}>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-zinc-700">En stock uniquement</span>
                <button onClick={() => setInStockOnly(s => !s)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${inStockOnly ? "bg-zinc-900" : "bg-zinc-200"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${inStockOnly ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            </FilterSection>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">
          {/* Results header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="font-bold text-zinc-900 text-sm">
                {search && <>Recherche de «{search}» · </>}
                <span className="text-zinc-500 font-normal">{filtered.length} produit{filtered.length > 1 ? "s" : ""}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 hidden sm:inline">Classer par :</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm px-3 py-2 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer font-medium">
                <option value="score">Pertinence (Score IA)</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="weight">Poids</option>
              </select>
              <div className="flex gap-0.5 p-1 bg-zinc-100 rounded-xl">
                <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode==="grid" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400"}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode==="list" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400"}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {[...selectedBrands].map(b => (
                <span key={b} className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  {b} <button onClick={() => toggleBrand(b)}><X className="w-3 h-3" /></button>
                </span>
              ))}
              {inStockOnly && (
                <span className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  En stock <button onClick={() => setInStockOnly(false)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {minScore > 0 && (
                <span className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  Score ≥{minScore} <button onClick={() => setMinScore(0)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {(priceRange[0] > 0 || priceRange[1] < 1000) && (
                <span className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  {priceRange[0]}€–{priceRange[1]}€ <button onClick={() => setPriceRange([0,1000])}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 py-20 text-center">
              <ShoppingBag className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">Aucun produit ne correspond à vos critères</p>
              <button onClick={resetAll} className="mt-3 text-sm text-blue-600 hover:underline">Tout réinitialiser</button>
            </div>
          ) : viewMode === "grid" ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayed.map((p, i) => (
                  <ProductCard key={p.id} p={p} i={i}
                    isWishlisted={wishlist.has(p.id)}
                    isSelected={selected?.id === p.id}
                    onSelect={() => setSelected(selected?.id === p.id ? null : p)}
                    onWishlist={e => toggleWishlist(p.id, e)} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button onClick={() => setPage(p => p + 1)}
                    className="inline-flex items-center gap-2 px-8 py-3 border-2 border-zinc-900 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-900 hover:text-white transition-all">
                    Charger {Math.min(PAGE_SIZE, filtered.length - displayed.length)} produits de plus
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-zinc-400 mt-2">{filtered.length - displayed.length} restants sur {filtered.length}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {displayed.map((p, i) => (
                  <ProductRow key={p.id} p={p} i={i}
                    isWishlisted={wishlist.has(p.id)}
                    isSelected={selected?.id === p.id}
                    onSelect={() => setSelected(selected?.id === p.id ? null : p)}
                    onWishlist={e => toggleWishlist(p.id, e)} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <button onClick={() => setPage(p => p + 1)}
                    className="inline-flex items-center gap-2 px-8 py-3 border-2 border-zinc-900 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-900 hover:text-white transition-all">
                    Charger plus <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="relative h-56 bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.image} alt={`${selected.brand} ${selected.model}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/40">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className="bg-zinc-900/80 backdrop-blur text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    ⭐ {selected.compatibility_score}/100
                  </span>
                  {!selected.in_stock && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">Rupture</span>}
                </div>
                <div className="absolute bottom-4 left-5">
                  <p className="text-xs text-white/70 font-semibold uppercase tracking-wider">{selected.brand}</p>
                  <p className="text-xl font-black text-white leading-tight">{selected.model}</p>
                  <p className="text-sm text-white/60">{selected.version}</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <StarRating stars={scoreToStars(selected.compatibility_score)} count={fakeReviewCount(selected.id, selected.compatibility_score)} />
                {selected.specs.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.specs.map(s => (
                      <div key={s.label} className="bg-zinc-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-xs text-zinc-400">{s.label}</div>
                        <div className="text-sm font-bold text-zinc-800">{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {selected.bio_reasons.slice(0, 3).map(r => (
                    <div key={r} className="flex items-start gap-2 text-sm text-zinc-600">
                      <Zap className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />{r}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div>
                    <div className="text-2xl font-black text-zinc-900">{selected.price.toFixed(2)}€</div>
                    {fakeOriginalPrice(selected.price, selected.id) && (
                      <div className="text-sm text-zinc-400 line-through">{fakeOriginalPrice(selected.price, selected.id)}€</div>
                    )}
                    <div className="text-xs font-semibold mt-0.5" style={{ color: RETAILERS[selected.retailer]?.color }}>
                      {RETAILERS[selected.retailer]?.name}
                    </div>
                  </div>
                  <a href={selected.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-700 text-white rounded-2xl text-sm font-bold transition-all">
                    <ExternalLink className="w-4 h-4" /> Voir l&apos;offre
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Product Card (grid) ───────────────────────────────────────────────────────
function ProductCard({ p, i, isWishlisted, isSelected, onSelect, onWishlist }: {
  p: Product; i: number; isWishlisted: boolean; isSelected: boolean;
  onSelect: () => void; onWishlist: (e: React.MouseEvent) => void;
}) {
  const stars = scoreToStars(p.compatibility_score);
  const reviewCount = fakeReviewCount(p.id, p.compatibility_score);
  const origPrice = fakeOriginalPrice(p.price, p.id);
  const discountPct = origPrice ? Math.round((1 - p.price / origPrice) * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}
      className={`bg-white rounded-2xl border cursor-pointer flex flex-col transition-all overflow-hidden group ${
        isSelected ? "ring-2 ring-zinc-900 border-zinc-900 shadow-lg" : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
      }`}
      onClick={onSelect}>
      {/* Image — fond coloré par colorway, chaussure entière visible */}
      <div className="relative aspect-square overflow-hidden"
        style={{ backgroundColor: p.color_accent + "18" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt={`${p.brand} ${p.model}`}
          className="w-full h-full object-contain p-5 group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23f4f4f5'%3E%3C/svg%3E"; }} />

        {/* Bande couleur en bas (signature colorway) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 opacity-50"
          style={{ backgroundColor: p.color_accent }} />

        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discountPct && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-md">-{discountPct}%</span>
          )}
          {p.new && <span className="bg-zinc-900 text-white text-xs font-bold px-2 py-0.5 rounded-md">NEW</span>}
          {!p.in_stock && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-md">Rupture</span>}
        </div>

        {/* Score + wishlist top-right */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="bg-white/90 backdrop-blur text-zinc-900 text-xs font-black px-2 py-0.5 rounded-md shadow-sm">
            ★ {p.compatibility_score}
          </span>
          <button onClick={onWishlist}
            className="w-7 h-7 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-zinc-400"}`} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{p.brand}</p>
        <p className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2">{p.model}</p>
        {/* Colorway dot + label */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: p.color_accent }} />
          <span className="text-xs text-zinc-400">{p.version}</span>
        </div>
        <StarRating stars={stars} count={reviewCount} />
        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="text-base font-black text-zinc-900">{p.price.toFixed(0)}€</span>
          {origPrice && <span className="text-xs text-zinc-400 line-through">{origPrice}€</span>}
        </div>
        <div className="text-xs font-semibold" style={{ color: RETAILERS[p.retailer]?.color }}>
          {RETAILERS[p.retailer]?.name}
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Row (list mode) ───────────────────────────────────────────────────
function ProductRow({ p, i, isWishlisted, isSelected, onSelect, onWishlist }: {
  p: Product; i: number; isWishlisted: boolean; isSelected: boolean;
  onSelect: () => void; onWishlist: (e: React.MouseEvent) => void;
}) {
  const stars = scoreToStars(p.compatibility_score);
  const reviewCount = fakeReviewCount(p.id, p.compatibility_score);
  const origPrice = fakeOriginalPrice(p.price, p.id);
  const discountPct = origPrice ? Math.round((1 - p.price / origPrice) * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
      className={`bg-white rounded-2xl border cursor-pointer flex gap-4 p-3 transition-all ${
        isSelected ? "ring-2 ring-zinc-900 border-zinc-900" : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
      }`}
      onClick={onSelect}>
      {/* Image */}
      <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-zinc-50 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt={`${p.brand} ${p.model}`} className="w-full h-full object-cover" />
        {discountPct && (
          <span className="absolute top-1 left-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">-{discountPct}%</span>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{p.brand}</p>
        <p className="text-sm font-bold text-zinc-900">{p.model} <span className="font-normal text-zinc-400">{p.version}</span></p>
        <StarRating stars={stars} count={reviewCount} />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {p.specs.slice(0,2).map(s => (
            <span key={s.label} className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md">{s.value}</span>
          ))}
          {!p.in_stock && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-medium">Rupture</span>}
        </div>
      </div>
      {/* Price + action */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <button onClick={onWishlist} className="p-1.5 hover:scale-110 transition-transform">
          <Heart className={`w-4 h-4 ${isWishlisted ? "fill-red-500 text-red-500" : "text-zinc-300"}`} />
        </button>
        <div className="text-right">
          <div className="text-lg font-black text-zinc-900">{p.price.toFixed(0)}€</div>
          {origPrice && <div className="text-xs text-zinc-400 line-through">{origPrice}€</div>}
        </div>
        <div className="text-xs font-semibold" style={{ color: RETAILERS[p.retailer]?.color }}>{RETAILERS[p.retailer]?.name}</div>
        <span className="text-xs text-zinc-400 flex items-center gap-0.5">
          ★ {p.compatibility_score} <AlertTriangle className="w-3 h-3 hidden" />
        </span>
      </div>
    </motion.div>
  );
}
