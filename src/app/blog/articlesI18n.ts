import type { Lang } from "@/lib/i18n/translations";
import type { Bloc } from "./articles";

/**
 * LE CORPS DES ARTICLES, TRADUIT.
 *
 * `articles.ts` porte la version FRANÇAISE, qui reste la source : c'est elle qu'on écrit
 * d'abord, elle qui cite les sources, et elle qui sert de repli. Ce fichier ne contient
 * QUE des traductions de textes déjà écrits là-bas.
 *
 * ── LE MÉCANISME, ET POURQUOI IL EST FAIT AINSI ──────────────────────────────
 * La traduction est PARTIELLE À DESSEIN, et le type le dit (`Partial`). Un article non
 * traduit dans une langue s'affiche en français, avec un bandeau qui le signale au
 * lecteur DANS SA LANGUE. On ne bloque donc jamais la publication d'un article français
 * en attendant ses quatre traductions, et on n'affiche jamais du français sans prévenir.
 *
 * ⚠️ NE JAMAIS AJOUTER UNE ENTRÉE VIDE OU APPROXIMATIVE POUR « FAIRE COMPLET ». Une
 * entrée présente ici fait DISPARAÎTRE le bandeau : le lecteur croira lire un texte
 * relu. Mieux vaut l'absence, qui est honnête, qu'une traction bâclée qui ne se voit pas.
 *
 * ⚠️ Les SOURCES ne se traduisent pas : un titre de publication scientifique se cite
 * dans sa langue d'origine, sans quoi le lecteur ne le retrouve pas. Elles restent donc
 * dans `articles.ts` et sont partagées par toutes les langues.
 *
 * ⚠️ Les CHIFFRES issus des publications doivent rester IDENTIQUES d'une langue à
 * l'autre. Une traduction qui arrondit ou « adapte » un chiffre sourcé le transforme en
 * chiffre inventé — c'est exactement ce que ce blog a passé une journée à retirer.
 */

export type TraductionArticle = {
  chapo: string;
  blocs: Bloc[];
  avertissement?: string;
};

/** langue → slug → texte traduit. Partiel : ce qui manque retombe sur le français. */
export const ARTICLES_I18N: Partial<Record<Lang, Record<string, TraductionArticle>>> = {
  en: {
    "ia-coach-ce-quun-humain-ne-fait-pas": {
      chapo:
        "Algorithms and coaches are usually presented as a choice you have to make. The real dividing line isn't intelligence — it's how often each one looks. Here is what each sees, and what neither of them sees.",
      blocs: [
        {
          h: "What a coach does that no program replaces",
          p: [
            "A coach reads a face. They hear in one sentence that the breakup, the house move or the sleepless night weigh more than the training load. They know that an athlete who says \"I'm fine\" after a threshold session is lying half the time, and they know which half.",
            "They also carry a long view. They decide that a season will be sacrificed for the next one, that a goal is premature, that this one matters because it matters to you — and that a motivated athlete absorbs what a resigned one refuses. None of that can be derived from a series of measurements.",
            "Finally, they adjust live. A climb harder than expected, a group going out too fast, a calf that tightens at the third kilometre: they change the session on the spot, with what they see.",
          ],
        },
        {
          h: "What a program does that no coach can",
          p: [
            "It looks every night. Not on Monday evening over the phone: every night, and after every session. That is the only difference that truly matters, and it is structural — a coach following thirty athletes cannot re-read thirty sleep curves each morning, however good they are.",
            "It doesn't get tired and has no ego. It doesn't overrate the session it prescribed itself, doesn't remember the last good workout better than the three average ones, and has no pride to defend when the data contradicts the plan.",
            "It computes over windows no memory holds. Chronic load builds over weeks; the ratio between recent load and baseline load reads over a rolling month. These are moving averages: they are calculated, not intuited.",
          ],
        },
        {
          h: "The dividing line: frequency, not intelligence",
          p: [
            "A coach observes in episodes — a session, a call, a message. A program observes continuously, but only sees what is measured. The first has context and few data points; the second has many data points and no context.",
            "That is why the opposition is badly framed. The question isn't \"who decides better\" but \"who sees what, and how often\". A plan that only moves once a week ignores, by construction, whatever happened on Tuesday evening.",
          ],
        },
        {
          h: "What it changes in a real week",
          p: [
            "Take an ordinary week. Tuesday, threshold session run as planned. Wednesday, short night and heart rate variability well below baseline. Thursday, a quality session was on the schedule.",
            "Without daily re-reading, Thursday holds: it was written on Sunday. With daily re-reading, it is eased off, and the quality moves to Saturday, once the indicators have recovered. The week's volume barely changes; its distribution does — and distribution is what decides wear.",
            "This logic — steering the progression of load rather than its raw quantity — sits at the heart of Tim Gabbett's work on the training-injury paradox: it is often the rapid increases in load, more than high load itself, that expose the athlete.",
          ],
        },
        {
          h: "The limit, and it has to be said",
          p: [
            "A program decides from what it measures. What it doesn't measure doesn't exist for it: a pain that is starting, a bereavement, mental load at work, a shoe at the end of its life. It will never see them, and no future version will either, as long as they don't pass through a sensor.",
            "The indicators themselves call for caution. Martin Buchheit has shown that heart-rate-derived measures don't all tell the same story depending on context, timing and type of effort: an isolated value means nothing — it's the trend that informs.",
            "The honest conclusion is therefore not \"the algorithm replaces\". It is: it looks every day at what a human can only look at intermittently, and it understands nothing of what a human grasps at a glance. The runner who improves is the one who gives each what it does well.",
          ],
        },
      ],
    },
    "semi-en-moins-de-1h45-construire-le-plan": {
      chapo:
        "1h45 over a half marathon means holding 4:59 per kilometre for 21.1 km. Here is where each session of a build towards that time comes from, and why most of the work happens at a much slower pace.",
      blocs: [
        {
          h: "What the time demands, arithmetically",
          p: [
            "105 minutes for 21.0975 km works out at 4:59 per kilometre, a little over 12 km/h. That isn't an opinion, it's a division — and it is the only number in this article that describes a performance.",
            "The difficulty isn't reaching that pace: many runners hold it over 5 km. It is holding it for an hour and three quarters, which is a problem of endurance far more than of speed.",
          ],
        },
        {
          h: "Why most of the volume is run slowly",
          p: [
            "This is the most counter-intuitive part of the build, and the one most often skipped. Stephen Seiler described what endurance athletes at the top level actually do: the vast majority of their volume sits at low intensity, and only a small fraction at high intensity. What is called polarised distribution.",
            "Intuition says the opposite: if I want to run fast, I run fast. The problem is that intensity costs recovery. Running every outing at moderately hard pace produces a permanently moderately tired runner, who never recovers enough to do a real quality session.",
            "In practice, easy running must be genuinely easy: a pace where you can speak in full sentences. If you have to break off to breathe, you are going too fast.",
          ],
        },
        {
          h: "The threshold session, the heart of the build",
          p: [
            "Threshold is roughly the pace you can hold for about an hour in competition. For a half targeted at 1h45, it is logically a little faster than race pace itself.",
            "It is trained in blocks — long intervals of several minutes with short recoveries — rather than continuously, which lets you accumulate time at that intensity without the session becoming unmanageable.",
            "Higher-intensity work has its place too. Jan Helgerud's work comparing training formats showed that high-intensity intervals improve maximal oxygen uptake more than moderate continuous training. But it is a seasoning, not the dish.",
          ],
        },
        {
          h: "The long run",
          p: [
            "It builds what fast sessions don't: the capacity to keep going. It is run easy, and its duration matters more than its distance — it is the time spent on your feet that produces the adaptation.",
            "A useful variation late in the build is to finish part of it at target pace. That teaches you to find that pace on already-tired legs, which is exactly the situation at the 15th kilometre.",
          ],
        },
        {
          h: "The taper",
          p: [
            "The final weeks cut volume while keeping touches of intensity. The aim is to arrive with positive freshness: recent load comes down, underlying condition stays.",
            "The classic mistake is trying to catch up. A big session ten days before the start catches nothing up — it only degrades the freshness you have just built.",
          ],
        },
        {
          h: "What moves the plan along the way",
          p: [
            "A plan written eight weeks ahead assumes the eight weeks will unfold as planned. They never do: a hard week at work, a cold, a sleepless night, unexpected heat.",
            "That is where daily re-reading of the indicators earns its place. In Pacevo, the quality session moves or is eased off when freshness and heart rate variability say so, and the calendar explains the decision. The week's volume barely moves; its distribution moves a lot.",
          ],
        },
      ],
    },
    "body-battery-basse-faut-il-courir": {
      chapo:
        "An indicator at its lowest in the morning is neither a green light nor a red one: it is a question. Here are the three things that let you answer it, and the one case where the answer is no without discussion.",
      avertissement:
        "This article is about training, not medicine. Fatigue that persists for weeks, pain, unusual breathlessness or a lastingly elevated resting heart rate are reasons to see a doctor, whatever numbers a watch displays.",
      blocs: [
        {
          h: "What the indicator measures — and what it doesn't",
          p: [
            "Body Battery is a proprietary Garmin metric. It is not a direct measurement: it is a composite, computed from heart rate variability, estimated stress, activity and sleep. Other brands offer equivalents under other names, built differently.",
            "The consequence matters: such a score does not measure your muscular fatigue. It reflects the state of your autonomic nervous system as an algorithm infers it from wrist sensors. Your legs have nothing to do with it.",
            "That is why it can be low while you feel good, and fine while you ache. Both situations are normal and neither is a fault of the watch.",
          ],
        },
        {
          h: "First question: is it a day, or a trend?",
          p: [
            "An isolated value says almost nothing. These indicators vary a lot from day to day within the same person, and Martin Buchheit reminds us that heart-rate-derived measures must be read in context and as a trend, never in isolation.",
            "A low morning after a late evening or a hard session the day before is expected — it is even a sign the measurement works. Three or four low mornings in a row with nothing to explain them is a different message.",
          ],
        },
        {
          h: "Second question: why is it low?",
          p: [
            "The algorithm does not know the cause. Lack of sleep, the start of an infection, alcohol, a room too warm, jet lag, a difficult week at work: all produce the same low number.",
            "Sleep deserves its own place. Hugh Fullagar's review on the subject shows that sleep deprivation affects exercise performance and cognitive function — and running tired also degrades alertness, which matters on technical trail or in traffic.",
            "If the cause is identifiable and one-off, it has a treatment: sleep. If it isn't, or if it looks like the start of an illness, the session is not the priority.",
          ],
        },
        {
          h: "Third question: which session was planned?",
          p: [
            "This is the question people forget, and it is the most useful. \"Should I run?\" has no general answer; \"should I do THIS session?\" does.",
            "An easy forty-minute run asks almost nothing of the nervous system, and many runners feel better after than before. A threshold or VO2max session, on the other hand, requires being in a state to absorb it — doing it on an already-mobilised body produces a mediocre session AND a longer recovery.",
            "So the right decision is rarely binary. It almost always means keeping the run and changing its intensity, or moving the quality by two days.",
          ],
        },
        {
          h: "The one case where it's no",
          p: [
            "Fever, diffuse aching, sore throat, swollen glands: you don't run, whatever the indicator says. This is not about performance but about risk — intense effort during an infection is not harmless.",
            "Outside that situation, a low indicator is an invitation to ease off, not a ban. And if doubt persists for several days, it is a doctor who decides, not a watch.",
          ],
        },
        {
          h: "What Pacevo does with it",
          p: [
            "These values come up through intervals.icu and feed the rolling plan. When they drop as a trend, the quality session is eased off or postponed, and the calendar writes down why.",
            "But the app only has access to what passes through a sensor. It does not know you are coming down with something, nor that the week has been brutal at work. On that, your judgement comes before its own.",
          ],
        },
      ],
    },
    "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves": {
      chapo:
        "This article used to be titled \"the French trails not to miss in 2026\": a dated list that would be wrong within six months. Here instead are the criteria that decide whether a race suits you — and those don't expire.",
      blocs: [
        {
          h: "Distance is the worst criterion",
          p: [
            "Two 80 km races have almost nothing in common if one has 1,500 m of climbing and the other 5,000. Elevation decides the time on your feet, the share of hiking, the demand of the descents — and it is the descent, not the climb, that destroys quads.",
            "A more useful marker than distance alone is the ratio of climbing to kilometres. Beyond a certain average gradient you are no longer really running: you hike fast uphill and absorb downhill. Neither better nor worse, but it requires a different build.",
            "Second marker: the cut-off time set by the organiser. It tells you which population the race is aimed at, far better than the number of kilometres.",
          ],
        },
        {
          h: "Cut-offs, the constraint discovered too late",
          p: [
            "Most ultras impose passing times at intermediate points. Being stopped at an aid station because you are ten minutes late is the most common failure — and the most avoidable.",
            "They are read before entering, not the night before. Compare them to your real pace in the mountains, not your road pace: the gap between the two is considerable, and that is where optimistic projections break.",
          ],
        },
        {
          h: "Night changes everything",
          p: [
            "As soon as a race runs into the night it becomes a different exercise: degraded alertness, terrain harder to read, cold, and a sleep management problem that doesn't exist on a shorter format.",
            "A first ultra that finishes before dark is a more reasonable progression than a night format at the same distance. If night is unavoidable, rehearse it — at least one long run with a headlamp.",
          ],
        },
        {
          h: "Self-sufficiency and aid stations",
          p: [
            "Some races feed you often and generously; others impose long stretches of self-sufficiency, sometimes in water. Mandatory kit follows from that, and it weighs.",
            "This information is in the rules. Reading it also means anticipating what you will carry — and therefore what you must have tested on long runs.",
          ],
        },
        {
          h: "Qualification systems",
          p: [
            "Several major races don't accept direct entry. The UTMB circuit, for instance, uses a performance index computed from runners' results, and qualification stones earned on labelled races to enter the lottery for certain events.",
            "These are official schemes whose terms change from year to year. The only authoritative source is the organiser's site: consulting it before building a season calendar avoids discovering in January that you needed to start the previous year.",
          ],
        },
        {
          h: "How to use this in practice",
          p: [
            "Pacevo's calendar lists upcoming races with their distance, date and entry link. Choosing a race as your goal aligns the build with its date.",
            "But the app does not read the rules for you. Elevation, cut-offs, self-sufficiency and qualification are checked on the organiser's site — they are the ones who commit, not us.",
          ],
        },
      ],
    },
    "coach-vocal-en-course-ce-que-ca-change": {
      chapo:
        "The real problem in a race isn't speed: it is pacing. What a voice in your ear changes, what it cannot know, and why it helps most when you are tired.",
      blocs: [
        {
          h: "The problem it addresses",
          p: [
            "Chester Abbiss and Paul Laursen described the pacing strategies adopted in competition and how they weigh on the result. The general conclusion of that literature is consistent: how effort is distributed matters, and starting too fast is the most costly error.",
            "The problem is that a runner perceives their own pace poorly, and increasingly poorly as they tire. Perceived effort rises while speed falls — so at the exact moment you slow down, it feels like you are speeding up.",
          ],
        },
        {
          h: "What a screen doesn't solve",
          p: [
            "A watch already shows pace. But reading it means looking down, focusing, and above all comparing that number to a target you are holding in your head — three operations that become expensive at the 30th kilometre.",
            "Worse: instant pace fluctuates a lot, especially in cities or under tree cover where the satellite signal degrades. A runner correcting on every fluctuation produces an accordion race, more tiring than a steady pace.",
          ],
        },
        {
          h: "What the Ghost Runner announces",
          p: [
            "At each kilometre, a voice announces three things: the pace held, the gap to plan, and the projected finish time if you continue like this.",
            "The third is what changes behaviour. \"5:12\" is information; \"at this rate you finish four minutes above your goal\" is a decision. The mental conversion is done for you, at the moment you are least able to do it.",
            "And because it is audio, it requires neither looking away nor breaking your stride.",
          ],
        },
        {
          h: "Its limits, and they are real",
          p: [
            "It doesn't know the terrain. A climb legitimately slows the pace; the announcement of a gap is not a signal to accelerate there, unless you want to burn your legs in a hill.",
            "It doesn't know your legs either. It compares a speed to a goal; it has no idea your quad has been complaining for ten minutes. The goal you set at the start can become the wrong goal mid-race, and that is yours to decide.",
            "Finally, running with an earpiece means still hearing what surrounds you. On open roads, one ear only — and on some races, earphones are banned by the rules.",
          ],
        },
        {
          h: "When it helps most",
          p: [
            "On long efforts at target pace, where the drift is slow and therefore invisible from the inside. On a first attempt at a given time, when the feel isn't calibrated yet. And in training, to learn what the target pace actually feels like.",
            "On short intervals, by contrast, it adds nothing: the efforts are too brief for a per-kilometre announcement to exist.",
          ],
        },
      ],
    },
    "ravitaillement-marathon-quoi-quand-combien": {
      chapo:
        "Carbohydrate recommendations during exercise are the subject of a fairly stable consensus in the literature. Here is what it says, where the numbers come from, and why the most important point isn't the quantity but training your gut.",
      avertissement:
        "This article summarises general recommendations drawn from scientific publications. It does not replace the advice of a doctor or dietitian, particularly in case of digestive disorder, diabetes, pregnancy or ongoing treatment.",
      blocs: [
        {
          h: "Why the subject exists",
          p: [
            "The body stores a limited amount of glycogen — in the liver and in muscle. On a prolonged endurance effort, that reserve becomes the limiting factor well before the muscles themselves. It is the physiological cause of what runners call the wall.",
            "Taking in carbohydrate during effort isn't about \"having energy\" in a vague sense: it is about sparing a reserve you cannot enlarge on the day.",
          ],
        },
        {
          h: "How much: what the consensus says",
          p: [
            "Asker Jeukendrup's synthesis published in Sports Med in 2014 proposes a scale according to the duration of effort rather than a single figure. Around 30 to 60 grams of carbohydrate per hour for an effort of one to two and a half hours; up to about 90 grams per hour beyond that, but under one precise condition, developed just below.",
            "The American College of Sports Medicine joint position statement on nutrition and athletic performance, published the same year, points the same way and situates these intakes within the athlete's overall diet.",
            "These ranges are deliberately wide. Weight, pace, heat and individual tolerance move the cursor, and the gap between two runners of the same level is considerable.",
          ],
        },
        {
          h: "The condition everyone forgets: two sugars, not one",
          p: [
            "Glucose crosses the intestinal wall through a transporter that saturates — that is what caps absorption around 60 grams per hour. Fructose uses a different transporter, which does not saturate at the same time.",
            "That is why high intakes rely on a glucose-and-fructose mix. Chasing 90 grams an hour with glucose alone will not get it through: the surplus stays in the gut, and that is where the digestive trouble that ruins a finish is born.",
            "Concretely, this means reading the label. A product advertising a two-to-one ratio between glucose and fructose is designed for this; another is not.",
          ],
        },
        {
          h: "When: the race starts before the start",
          p: [
            "In the preceding days, the goal is to line up with full reserves, which means a carbohydrate-rich diet and reduced training volume — the taper counts as much here as the plate.",
            "On the morning, a digestible meal a few hours before the start, made of what you have already tested. This is not the day to try a new bread.",
            "During, the most useful rule is to start early and split it up. Waiting until you are hungry is already too late: gastric emptying takes time, and catching up in one massive intake is exactly what the gut refuses.",
          ],
        },
        {
          h: "Drinking: to thirst, and think about sodium",
          p: [
            "The advice to flood the system has been abandoned. Drinking to thirst remains the safest marker for most runners, and drinking far too much plain water on a long effort exposes you to a real danger — hyponatraemia, a dilution of blood sodium.",
            "In heat, or when you sweat heavily, sodium intake matters as much as the volume of fluid. Most sports drinks contain some; plain water contains none.",
          ],
        },
        {
          h: "The most important point: training your gut",
          p: [
            "The gut adapts to what is regularly asked of it. A runner who never fuels in training and takes in 90 grams an hour on race day exposes their stomach to an unprecedented load at the worst possible moment.",
            "The practical consequence is simple, and the least followed: long runs are where fuelling is tested. Same products, same quantities, same intervals as on the day. The nutrition plan is rehearsed in training, exactly like pace.",
          ],
        },
        {
          h: "After",
          p: [
            "Glycogen replenishment is faster in the hours following effort, which matters when races come back to back, far less when the next one is three weeks away.",
            "For a target race, the real question afterwards isn't the metabolic window: it is letting load come down before starting again.",
          ],
        },
      ],
    },
    "chaussure-de-trail-ce-qui-compte-avant-la-marque": {
      chapo:
        "This article used to promise a \"comparison based on your stride\": it would have meant rating specific models, on criteria we do not measure, and the ranking would be obsolete by the next collection. Here instead are the four parameters that actually decide, and what the literature says about each.",
      blocs: [
        {
          h: "Mass, the only parameter with a clearly established link",
          p: [
            "This is where the data is clearest. Work by Wouter Hoogkamer and colleagues showed that a change in running economy translates directly into distance-running performance — and mass on the feet is one of the simplest levers of that economy.",
            "In practice: a heavier shoe protects more but costs on every stride, and the cost is paid for longer the longer the race. It is a trade-off, not a rule — on broken ground, protection can be worth its weight.",
          ],
        },
        {
          h: "Drop: a lot of talk, little evidence",
          p: [
            "Drop is the height difference between heel and forefoot. It is the most widespread marketing argument, and one of the weakest.",
            "Laurent Malisoux's trial published in the American Journal of Sports Medicine compared shoes of different drops in recreational runners: it did not find an effect of drop on injury risk across the group. In other words, there is no \"correct\" drop that applies to everyone.",
            "The practical consequence is liberating: choose the drop you are used to, and if you want to change, do it gradually — it is the abrupt transition that causes trouble, not the value itself.",
          ],
        },
        {
          h: "Lugs: the terrain decides",
          p: [
            "Deep, widely spaced lugs bite into mud and shed soil; they are uncomfortable and wear fast on dry rock. Low lugs grip stone and roll well on runnable sections; they slip as soon as it gets greasy.",
            "So there is no best outsole, only a best outsole for YOUR usual terrain. A runner on clay forest and one on dry limestone don't have the same need, and no generic test will say so for them.",
          ],
        },
        {
          h: "Cushioning and protection: a question of duration",
          p: [
            "The longer the effort, the more impacts accumulate and the more cushioning counts. On a short, fast format, a low and precise shoe gives better ground feel.",
            "The rock plate isn't judged on comfort but on stones: on rocky terrain, its absence is paid for late in the race, when the sole of the foot stops forgiving.",
          ],
        },
        {
          h: "What matters more than all the rest: the fit",
          p: [
            "The best shoe on paper is useless if it doesn't suit your foot. Forefoot width, heel hold and volume vary enormously between brands — often more than the technical parameters everyone discusses.",
            "The foot swells on a long effort: try at the end of the day, with race socks, and leave room at the front. A shoe that fits perfectly in the shop is a shoe that is too small at the 40th kilometre.",
          ],
        },
        {
          h: "The honest conclusion",
          p: [
            "No ranking can tell you which model to buy, because the two decisive parameters — your terrain and your foot — appear in no test.",
            "What can be done, on the other hand, is tracking wear. Pacevo records mileage per pair: that is a measured fact, not an opinion, and it beats a hunch for deciding when a pair is done.",
          ],
        },
      ],
    },
    "vfc-et-charge-voir-la-fatigue-arriver": {
      chapo:
        "Three curves and one morning measurement. What each says, what it doesn't say, and why it is their crossing — never an isolated value — that lets you ease off before something breaks.",
      blocs: [
        {
          h: "The three curves: what CTL, ATL and TSB mean",
          p: [
            "The model used by most training platforms descends from Eric Banister's work on the response to load. It comes down to three numbers, all derived from the same series of sessions.",
            "Chronic load, often written CTL, is a long moving average — around six weeks. It is your underlying condition: it rises slowly, falls slowly, and represents what your body is used to absorbing.",
            "Acute load, ATL, is the same thing over a short window, around a week. It is your recent fatigue: it climbs fast after a big session and drops fast with rest.",
            "Freshness, TSB, is simply the gap between the two. Negative, you are absorbing more than usual. Positive, you are rested — and that is what you want on race day, not during the build.",
          ],
        },
        {
          h: "Heart rate variability: what it actually measures",
          p: [
            "Heart rate variability, or HRV, does not measure fatigue. It measures the interval between successive beats, which reflects the balance between the two branches of the autonomic nervous system. A low HRV signals that your body is in a mobilised state; it does not say why.",
            "That distinction changes everything in practice. A night of drinking, the start of a cold, a room too warm, jet lag or a frustration at work all lower HRV exactly as a too-hard session does. The measurement is true; the interpretation \"I'm overtrained\" is not.",
            "Second precaution: an isolated value is worth nothing. HRV varies a lot from day to day within the same person. What informs is the gap to YOUR baseline — the average of your recent days — and the direction of the trend. Buchheit insists on this: heart-rate-derived indicators must be read in context, not in isolation.",
          ],
        },
        {
          h: "Why the two have to be crossed",
          p: [
            "Taken separately, the two families of indicators fail in predictable ways.",
            "Load alone knows nothing about your life. It sees that you ran three times this week; it has no idea you slept five hours a night. So it keeps prescribing as if all were well.",
            "HRV alone knows nothing about your training. It sees a low indicator; it cannot distinguish a big week you chose — where negative freshness is normal and wanted — from a drift towards exhaustion.",
            "Crossed, they correct each other. Negative freshness with stable HRV is accepted load: the plan continues. Negative freshness with HRV dropping for several days is a warning: ease off. Low HRV while load is light probably has nothing to do with running.",
          ],
        },
        {
          h: "What Pacevo does with it, concretely",
          p: [
            "These indicators come up from your watch through intervals.icu — sleep, HRV, resting heart rate, the load of each session. Pacevo re-reads them after each sync and rewrites the rolling seven-day plan when they change.",
            "Easing off doesn't mean deleting the week. In practice, it moves the quality session, shortens its intense portion, or replaces a run with an easy one — volume barely moves, intensity moves a lot.",
            "And the calendar writes down WHY. That is the point that matters most in daily use: a plan you don't understand is a plan you work around. A plan that says \"your variability has been below baseline for three days, the threshold session moves to Saturday\" gets followed.",
          ],
        },
        {
          h: "What it does not do",
          p: [
            "It does not predict an injury. Load progression is one factor among others — biomechanics, terrain, equipment, injury history and sleep all count, and none of that fits into three curves.",
            "It does not replace your judgement. A pain that settles in, a discomfort that changes your stride, a fatigue that persists despite normal indicators: these are reasons to stop, whatever a dashboard says. A model is always right about what it measures and wrong about everything else.",
          ],
        },
      ],
    },
  },
  de: {
    "ravitaillement-marathon-quoi-quand-combien": {
      chapo:
        "Zur Kohlenhydratzufuhr während der Belastung gibt es in der Literatur einen recht stabilen Konsens. Hier steht, was er sagt, woher die Zahlen stammen — und warum der wichtigste Punkt nicht die Menge ist, sondern das Training deines Darms.",
      avertissement:
        "Dieser Artikel fasst allgemeine Empfehlungen aus wissenschaftlichen Publikationen zusammen. Er ersetzt nicht den Rat einer Ärztin oder eines Ernährungsberaters, insbesondere bei Verdauungsbeschwerden, Diabetes, Schwangerschaft oder laufender Behandlung.",
      blocs: [
        {
          h: "Warum es das Thema gibt",
          p: [
            "Der Körper speichert eine begrenzte Menge Glykogen — in Leber und Muskulatur. Bei langer Ausdauerbelastung wird diese Reserve zum limitierenden Faktor, lange vor den Muskeln selbst. Das ist die physiologische Ursache dessen, was Läufer den Mann mit dem Hammer nennen.",
            "Kohlenhydrate während der Belastung zuzuführen dient nicht dazu, vage „Energie zu haben\": Es dient dazu, eine Reserve zu schonen, die man am Wettkampftag nicht vergrößern kann.",
          ],
        },
        {
          h: "Wie viel: was der Konsens sagt",
          p: [
            "Asker Jeukendrups 2014 in Sports Med veröffentlichte Übersicht schlägt eine Skala nach Belastungsdauer vor statt einer einzigen Zahl. Etwa 30 bis 60 Gramm Kohlenhydrate pro Stunde bei ein bis zweieinhalb Stunden; bis zu rund 90 Gramm pro Stunde darüber hinaus, aber unter einer genauen Bedingung, die gleich folgt.",
            "Das gemeinsame Positionspapier des American College of Sports Medicine zu Ernährung und Leistung aus demselben Jahr weist in dieselbe Richtung und ordnet diese Mengen in die Gesamternährung ein.",
            "Diese Spannen sind bewusst weit. Gewicht, Tempo, Hitze und individuelle Verträglichkeit verschieben den Regler, und der Abstand zwischen zwei gleich starken Läufern ist beträchtlich.",
          ],
        },
        {
          h: "Die Bedingung, die alle vergessen: zwei Zucker, nicht einer",
          p: [
            "Glukose passiert die Darmwand über einen Transporter, der sättigt — das deckelt die Aufnahme bei etwa 60 Gramm pro Stunde. Fruktose nutzt einen anderen Transporter, der nicht gleichzeitig sättigt.",
            "Deshalb beruhen hohe Zufuhren auf einer Mischung aus Glukose und Fruktose. 90 Gramm pro Stunde mit reiner Glukose gehen nicht durch: Der Überschuss bleibt im Darm, und genau dort entstehen die Verdauungsprobleme, die ein Rennende ruinieren.",
            "Konkret heißt das: Etikett lesen. Ein Produkt mit ausgewiesenem Verhältnis von zwei zu eins zwischen Glukose und Fruktose ist dafür gemacht, ein anderes nicht.",
          ],
        },
        {
          h: "Wann: das Rennen beginnt vor dem Start",
          p: [
            "In den Tagen davor geht es darum, mit vollen Speichern anzutreten — also kohlenhydratreiche Ernährung und reduziertes Trainingsvolumen. Das Tapering zählt hier so viel wie der Teller.",
            "Am Morgen eine verträgliche Mahlzeit einige Stunden vor dem Start, aus dem, was du schon getestet hast. Das ist nicht der Tag für ein neues Brot.",
            "Während des Rennens ist die nützlichste Regel: früh anfangen und aufteilen. Zu warten, bis man Hunger hat, ist bereits zu spät — die Magenentleerung braucht Zeit, und das Aufholen in einer großen Portion ist genau das, was der Darm verweigert.",
          ],
        },
        {
          h: "Trinken: nach Durst, und an Natrium denken",
          p: [
            "Die Empfehlung, den Organismus zu fluten, ist aufgegeben. Nach Durst zu trinken bleibt für die meisten der sicherste Anhaltspunkt, und viel zu viel reines Wasser bei langer Belastung birgt eine echte Gefahr — die Hyponatriämie, eine Verdünnung des Blutnatriums.",
            "Bei Hitze oder starkem Schwitzen zählt die Natriumzufuhr so viel wie die Trinkmenge. Die meisten Sportgetränke enthalten welches; reines Wasser nicht.",
          ],
        },
        {
          h: "Der wichtigste Punkt: den Darm trainieren",
          p: [
            "Der Darm passt sich an das an, was regelmäßig von ihm verlangt wird. Wer im Training nie isst und am Wettkampftag 90 Gramm pro Stunde aufnimmt, mutet seinem Magen im schlechtesten Moment eine unbekannte Last zu.",
            "Die praktische Folge ist einfach und wird am wenigsten befolgt: Die langen Läufe sind der Ort, an dem die Verpflegung getestet wird. Gleiche Produkte, gleiche Mengen, gleiche Abstände wie am Wettkampftag. Der Ernährungsplan wird im Training geprobt, genau wie das Tempo.",
          ],
        },
        {
          h: "Danach",
          p: [
            "Die Wiederauffüllung des Glykogens ist in den Stunden nach der Belastung schneller, was zählt, wenn Wettkämpfe aufeinanderfolgen — deutlich weniger, wenn der nächste in drei Wochen ist.",
            "Bei einem Zielwettkampf ist die eigentliche Frage danach nicht das Stoffwechselfenster, sondern die Belastung sinken zu lassen, bevor man wieder loslegt.",
          ],
        },
      ],
    },
    "chaussure-de-trail-ce-qui-compte-avant-la-marque": {
      chapo:
        "Dieser Artikel versprach einmal einen „Vergleich nach deinem Laufstil\": Dafür hätte man konkrete Modelle bewerten müssen, nach Kriterien, die wir nicht messen — und die Rangliste wäre mit der nächsten Kollektion veraltet. Hier stehen stattdessen die vier Parameter, die wirklich entscheiden, und was die Literatur zu jedem sagt.",
      blocs: [
        {
          h: "Das Gewicht, der einzige Parameter mit klar belegtem Zusammenhang",
          p: [
            "Hier ist die Datenlage am deutlichsten. Arbeiten von Wouter Hoogkamer und Kollegen zeigten, dass eine Veränderung der Laufökonomie sich direkt in der Leistung über die Distanz niederschlägt — und die Masse am Fuß ist einer der einfachsten Hebel dieser Ökonomie.",
            "In der Praxis: Ein schwererer Schuh schützt mehr, kostet aber bei jedem Schritt, und der Preis wird umso länger bezahlt, je länger das Rennen ist. Eine Abwägung, keine Regel — auf grobem Gelände kann Schutz sein Gewicht wert sein.",
          ],
        },
        {
          h: "Die Sprengung: viel Gerede, wenig Belege",
          p: [
            "Die Sprengung ist der Höhenunterschied zwischen Ferse und Vorfuß. Sie ist das verbreitetste Marketingargument und eines der schwächsten.",
            "Laurent Malisoux' im American Journal of Sports Medicine veröffentlichte Studie verglich Schuhe unterschiedlicher Sprengung bei Freizeitläufern: Ein Effekt der Sprengung auf das Verletzungsrisiko ließ sich in der Gesamtgruppe nicht nachweisen. Anders gesagt: Es gibt keine „richtige\" Sprengung, die für alle gilt.",
            "Die praktische Folge befreit: Nimm die Sprengung, an die du gewöhnt bist, und wenn du wechseln willst, tu es schrittweise — der abrupte Wechsel ist das Problem, nicht der Wert selbst.",
          ],
        },
        {
          h: "Die Stollen: das Gelände entscheidet",
          p: [
            "Tiefe, weit stehende Stollen greifen in Schlamm und geben Erde frei; auf trockenem Fels sind sie unbequem und verschleißen schnell. Flache Stollen greifen auf Stein und rollen auf laufbaren Passagen gut; sobald es rutschig wird, verlieren sie.",
            "Es gibt also keine beste Sohle, nur eine beste Sohle für DEIN übliches Gelände. Wer auf lehmigem Waldboden läuft und wer auf trockenem Kalk läuft, haben nicht denselben Bedarf, und kein generischer Test entscheidet das für sie.",
          ],
        },
        {
          h: "Dämpfung und Schutz: eine Frage der Dauer",
          p: [
            "Je länger die Belastung, desto mehr summieren sich die Stöße und desto mehr zählt die Dämpfung. Bei kurzem, schnellem Format gibt ein flacher, präziser Schuh besseres Bodengefühl.",
            "Die Steinschutzplatte beurteilt man nicht nach Komfort, sondern nach Steinen: Auf steinigem Gelände wird ihr Fehlen spät im Rennen bezahlt, wenn die Fußsohle nichts mehr verzeiht.",
          ],
        },
        {
          h: "Was mehr zählt als alles andere: die Passform",
          p: [
            "Der auf dem Papier beste Schuh nützt nichts, wenn er nicht zu deinem Fuß passt. Vorfußbreite, Fersenhalt und Volumen schwanken zwischen Marken enorm — oft stärker als die technischen Parameter, über die alle reden.",
            "Der Fuß schwillt bei langer Belastung an: am Abend anprobieren, mit den Wettkampfsocken, und vorne Platz lassen. Ein im Laden perfekt sitzender Schuh ist im 40. Kilometer zu klein.",
          ],
        },
        {
          h: "Die ehrliche Schlussfolgerung",
          p: [
            "Keine Rangliste kann dir sagen, welches Modell du nehmen sollst, weil die beiden entscheidenden Parameter — dein Gelände und dein Fuß — in keinem Test vorkommen.",
            "Was sich hingegen tun lässt, ist den Verschleiß zu verfolgen. Pacevo erfasst die Kilometer pro Paar: Das ist eine gemessene Tatsache, keine Meinung, und sie schlägt jedes Bauchgefühl bei der Frage, wann ein Paar am Ende ist.",
          ],
        },
      ],
    },
    "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves": {
      chapo:
        "Dieser Artikel hieß einmal „die französischen Trails, die du 2026 nicht verpassen darfst\": eine datierte Liste, die in sechs Monaten falsch wäre. Hier stehen stattdessen die Kriterien, die entscheiden, ob ein Rennen zu dir passt — und die veralten nicht.",
      blocs: [
        {
          h: "Die Distanz ist das schlechteste Kriterium",
          p: [
            "Zwei 80-km-Rennen haben fast nichts gemeinsam, wenn eines 1 500 Höhenmeter hat und das andere 5 000. Der Anstieg entscheidet über die Zeit auf den Beinen, den Anteil des Gehens, die Belastung der Abfahrten — und es ist die Abfahrt, nicht der Aufstieg, die die Oberschenkel zerstört.",
            "Ein nützlicherer Anhaltspunkt als die Distanz allein ist das Verhältnis von Höhenmetern zu Kilometern. Ab einer gewissen mittleren Steigung läuft man nicht mehr wirklich: Man wandert schnell bergauf und steckt bergab ein. Weder besser noch schlechter, aber es verlangt einen anderen Aufbau.",
            "Zweiter Anhaltspunkt: das vom Veranstalter gesetzte Zeitlimit. Es sagt weit besser als die Kilometerzahl, an welche Zielgruppe sich das Rennen richtet.",
          ],
        },
        {
          h: "Cut-offs, die Einschränkung, die man zu spät entdeckt",
          p: [
            "Die meisten Ultras schreiben Durchgangszeiten an Zwischenpunkten vor. An einer Verpflegung gestoppt zu werden, weil man zehn Minuten zu spät ist, ist das häufigste Scheitern — und das vermeidbarste.",
            "Sie werden vor der Anmeldung gelesen, nicht am Vorabend. Vergleiche sie mit deinem echten Tempo im Gebirge, nicht mit dem auf der Straße: Der Unterschied ist erheblich, und genau daran zerschellen optimistische Hochrechnungen.",
          ],
        },
        {
          h: "Die Nacht ändert alles",
          p: [
            "Sobald ein Rennen in die Nacht reicht, wird es eine andere Übung: verminderte Wachsamkeit, schlechter lesbares Gelände, Kälte, und ein Schlafmanagement, das es in kurzen Formaten nicht gibt.",
            "Ein erster Ultra, der vor Einbruch der Dunkelheit endet, ist eine vernünftigere Steigerung als ein Nachtformat gleicher Distanz. Ist die Nacht unvermeidbar, wird sie geprobt — mindestens ein langer Lauf mit Stirnlampe.",
          ],
        },
        {
          h: "Autonomie und Verpflegung",
          p: [
            "Manche Rennen verpflegen oft und reichlich, andere verlangen lange Autonomie, mitunter beim Wasser. Die Pflichtausrüstung folgt daraus, und sie wiegt.",
            "Diese Angaben stehen im Reglement. Sie zu lesen heißt auch, vorwegzunehmen, was du tragen wirst — und was du folglich im langen Lauf getestet haben musst.",
          ],
        },
        {
          h: "Die Qualifikationssysteme",
          p: [
            "Mehrere große Rennen nehmen keine direkte Anmeldung an. Der UTMB-Zirkel etwa nutzt einen aus Ergebnissen berechneten Leistungsindex und auf gelabelten Rennen zu erwerbende Qualifikationssteine, um in die Auslosung bestimmter Events zu kommen.",
            "Das sind offizielle Verfahren, deren Modalitäten sich von Jahr zu Jahr ändern. Maßgeblich ist allein die Seite des Veranstalters: Sie vor dem Saisonplan zu lesen erspart die Entdeckung im Januar, dass man im Vorjahr hätte anfangen müssen.",
          ],
        },
        {
          h: "Wie man das konkret nutzt",
          p: [
            "Der Kalender von Pacevo listet kommende Rennen mit Distanz, Datum und Anmeldelink. Ein Rennen als Ziel zu wählen richtet den Aufbau auf sein Datum aus.",
            "Aber die App liest die Reglements nicht für dich. Höhenmeter, Cut-offs, Autonomie und Qualifikation prüft man auf der Seite des Veranstalters — er verpflichtet sich, nicht wir.",
          ],
        },
      ],
    },
    "coach-vocal-en-course-ce-que-ca-change": {
      chapo:
        "Das eigentliche Problem im Rennen ist nicht die Geschwindigkeit, sondern die Tempoeinteilung. Was eine Stimme im Ohr ändert, was sie nicht wissen kann, und warum sie vor allem hilft, wenn du müde bist.",
      blocs: [
        {
          h: "Das Problem, das es adressiert",
          p: [
            "Chester Abbiss und Paul Laursen haben die im Wettkampf gewählten Tempostrategien beschrieben und wie sie auf das Ergebnis wirken. Die durchgehende Schlussfolgerung dieser Literatur: Die Verteilung der Anstrengung zählt, und zu schnell zu starten ist der teuerste Fehler.",
            "Das Problem ist, dass ein Läufer sein Tempo schlecht wahrnimmt — und immer schlechter, je müder er wird. Das Anstrengungsempfinden steigt, während die Geschwindigkeit fällt: Genau in dem Moment, in dem du langsamer wirst, fühlt es sich an, als würdest du beschleunigen.",
          ],
        },
        {
          h: "Was ein Display nicht löst",
          p: [
            "Eine Uhr zeigt das Tempo bereits an. Aber es zu lesen heißt: den Blick senken, scharfstellen und vor allem diese Zahl mit einem Ziel vergleichen, das man im Kopf behält — drei Vorgänge, die im 30. Kilometer teuer werden.",
            "Schlimmer noch: Das Momentantempo schwankt stark, besonders in der Stadt oder unter Baumkronen, wo das Satellitensignal leidet. Wer bei jeder Schwankung korrigiert, läuft ein Ziehharmonika-Rennen — anstrengender als ein gleichmäßiges Tempo.",
          ],
        },
        {
          h: "Was der Ghost Runner ansagt",
          p: [
            "Bei jedem Kilometer nennt eine Stimme drei Dinge: das gelaufene Tempo, die Abweichung vom Plan und die Hochrechnung auf das Ziel, wenn du so weitermachst.",
            "Das dritte ändert das Verhalten. „5:12\" ist eine Information; „in diesem Rhythmus kommst du vier Minuten über deinem Ziel an\" ist eine Entscheidung. Die Umrechnung wird für dich gemacht, in dem Moment, in dem du sie am wenigsten leisten kannst.",
            "Und weil es Audio ist, verlangt es weder den Blick zur Seite noch einen Bruch im Laufrhythmus.",
          ],
        },
        {
          h: "Seine Grenzen, und sie sind real",
          p: [
            "Er kennt das Gelände nicht. Ein Anstieg verlangsamt zu Recht; die Ansage einer Abweichung ist dort kein Signal zu beschleunigen, es sei denn, man will die Beine am Berg verbrennen.",
            "Er kennt auch deine Beine nicht. Er vergleicht eine Geschwindigkeit mit einem Ziel; dass dein Oberschenkel seit zehn Minuten zieht, weiß er nicht. Das beim Start gesetzte Ziel kann mitten im Rennen das falsche werden, und das zu entscheiden ist deine Sache.",
            "Schließlich setzt Laufen mit Kopfhörer voraus, die Umgebung noch zu hören. Auf offener Straße nur ein Ohr — und bei manchen Rennen sind Kopfhörer laut Reglement verboten.",
          ],
        },
        {
          h: "Wann es am meisten hilft",
          p: [
            "Bei langen Belastungen im Zieltempo, wo das Abdriften langsam und daher von innen unsichtbar ist. Beim ersten Versuch über eine bestimmte Zeit, wenn das Gefühl noch nicht geeicht ist. Und im Training, um zu lernen, wie sich das Zieltempo wirklich anfühlt.",
            "Bei kurzen Intervallen dagegen bringt er nichts: Die Belastungen sind zu kurz, als dass eine Ansage pro Kilometer überhaupt stattfände.",
          ],
        },
      ],
    },
    "semi-en-moins-de-1h45-construire-le-plan": {
      chapo:
        "1:45 im Halbmarathon heißt, 4:59 pro Kilometer über 21,1 km zu halten. Hier steht, woher jede Einheit eines solchen Aufbaus kommt — und warum der Großteil der Arbeit deutlich langsamer stattfindet.",
      blocs: [
        {
          h: "Was die Zeit rechnerisch verlangt",
          p: [
            "105 Minuten für 21,0975 km ergeben 4:59 pro Kilometer, also etwas mehr als 12 km/h. Das ist keine Meinung, sondern eine Division — und die einzige Zahl dieses Artikels, die eine Leistung beschreibt.",
            "Die Schwierigkeit liegt nicht darin, dieses Tempo zu erreichen: Viele halten es über 5 km. Sie liegt darin, es eine Stunde fünfundvierzig zu halten, und das ist weit mehr ein Ausdauer- als ein Tempoproblem.",
          ],
        },
        {
          h: "Warum der Großteil des Volumens langsam gelaufen wird",
          p: [
            "Das ist der widersinnigste Teil des Aufbaus und der am häufigsten übersprungene. Stephen Seiler hat beschrieben, was Ausdauerathleten auf hohem Niveau tatsächlich tun: Der weit überwiegende Teil ihres Volumens liegt bei niedriger Intensität, nur ein kleiner Anteil bei hoher. Man nennt es polarisierte Verteilung.",
            "Die Intuition sagt das Gegenteil: Wenn ich schnell laufen will, laufe ich schnell. Das Problem ist, dass Intensität Erholung kostet. Wer jede Einheit mittelhart läuft, ist dauerhaft mittelmüde und erholt sich nie genug für eine echte Qualitätseinheit.",
            "In der Praxis muss der Grundlagenlauf wirklich locker sein: ein Tempo, bei dem du in ganzen Sätzen sprechen kannst. Wenn du zum Atmen abbrechen musst, bist du zu schnell.",
          ],
        },
        {
          h: "Die Schwellen-Einheit, das Herzstück",
          p: [
            "Die Schwelle ist etwa das Tempo, das man im Wettkampf rund eine Stunde halten kann. Für einen Halbmarathon in 1:45 liegt es logischerweise etwas über dem Renntempo selbst.",
            "Man trainiert sie in Blöcken — lange Intervalle von mehreren Minuten mit kurzen Pausen — statt am Stück, was erlaubt, Zeit bei dieser Intensität zu sammeln, ohne dass die Einheit unbeherrschbar wird.",
            "Auch höhere Intensität hat ihren Platz. Jan Helgeruds Vergleich von Trainingsformaten zeigte, dass hochintensive Intervalle die maximale Sauerstoffaufnahme stärker verbessern als moderates Dauertraining. Aber das ist Gewürz, nicht Hauptgericht.",
          ],
        },
        {
          h: "Der lange Lauf",
          p: [
            "Er baut auf, was schnelle Einheiten nicht aufbauen: die Fähigkeit durchzuhalten. Er wird locker gelaufen, und seine Dauer zählt mehr als seine Distanz — die Zeit auf den Beinen erzeugt die Anpassung.",
            "Eine nützliche Variante gegen Ende: einen Teil im Zieltempo beenden. Das lehrt, dieses Tempo auf müden Beinen zu finden — genau die Situation im 15. Kilometer.",
          ],
        },
        {
          h: "Das Tapering",
          p: [
            "Die letzten Wochen senken das Volumen und behalten Spitzen an Intensität. Ziel ist positive Frische: Die jüngste Belastung sinkt, die Grundform bleibt.",
            "Der klassische Fehler ist Aufholen zu wollen. Eine harte Einheit zehn Tage vor dem Start holt nichts auf — sie zerstört nur die Frische, die man gerade aufgebaut hat.",
          ],
        },
        {
          h: "Was den Plan unterwegs bewegt",
          p: [
            "Ein acht Wochen im Voraus geschriebener Plan unterstellt, dass diese acht Wochen wie geplant verlaufen. Das tun sie nie: eine harte Arbeitswoche, eine Erkältung, eine schlaflose Nacht, unerwartete Hitze.",
            "Genau hier zahlt sich das tägliche Nachlesen der Werte aus. In Pacevo wandert oder schrumpft die Qualitätseinheit, wenn Frische und Herzratenvariabilität es sagen, und der Kalender erklärt die Entscheidung. Das Wochenvolumen bewegt sich wenig, seine Verteilung viel.",
          ],
        },
      ],
    },
    "body-battery-basse-faut-il-courir": {
      chapo:
        "Ein Indikator am Tiefpunkt am Morgen ist weder grünes noch rotes Licht: Er ist eine Frage. Hier stehen die drei Dinge, mit denen man sie beantwortet — und der einzige Fall, in dem die Antwort ohne Diskussion Nein lautet.",
      avertissement:
        "Dieser Artikel handelt von Training, nicht von Medizin. Wochenlang anhaltende Müdigkeit, Schmerzen, ungewöhnliche Atemnot oder ein dauerhaft erhöhter Ruhepuls sind Gründe für einen Arztbesuch, unabhängig davon, was eine Uhr anzeigt.",
      blocs: [
        {
          h: "Was der Indikator misst — und was nicht",
          p: [
            "Body Battery ist eine proprietäre Kennzahl von Garmin. Sie ist keine direkte Messung, sondern ein Komposit aus Herzratenvariabilität, geschätztem Stress, Aktivität und Schlaf. Andere Hersteller bieten Entsprechungen unter anderen Namen, anders konstruiert.",
            "Die Folge ist wichtig: Ein solcher Wert misst nicht deine muskuläre Ermüdung. Er spiegelt den Zustand deines vegetativen Nervensystems, wie ihn ein Algorithmus aus Handgelenk-Sensoren ableitet. Deine Beine haben damit nichts zu tun.",
            "Deshalb kann er niedrig sein, während du dich gut fühlst, und in Ordnung, während du Muskelkater hast. Beides ist normal und keines davon ein Fehler der Uhr.",
          ],
        },
        {
          h: "Erste Frage: ein Tag oder ein Trend?",
          p: [
            "Ein einzelner Wert sagt fast nichts. Diese Indikatoren schwanken bei derselben Person stark von Tag zu Tag, und Martin Buchheit erinnert daran, dass herzfrequenzbasierte Größen im Kontext und als Trend zu lesen sind, nie isoliert.",
            "Ein niedriger Morgen nach einem späten Abend oder einer harten Einheit tags zuvor ist erwartbar — sogar ein Zeichen, dass die Messung funktioniert. Drei oder vier niedrige Morgen hintereinander ohne erkennbaren Grund sind eine andere Botschaft.",
          ],
        },
        {
          h: "Zweite Frage: warum ist er niedrig?",
          p: [
            "Der Algorithmus kennt die Ursache nicht. Schlafmangel, ein beginnender Infekt, Alkohol, ein zu warmes Zimmer, Jetlag, eine harte Arbeitswoche: Alles erzeugt dieselbe niedrige Zahl.",
            "Der Schlaf verdient einen eigenen Platz. Hugh Fullagars Übersichtsarbeit zeigt, dass Schlafmangel die Leistung bei Belastung und kognitive Funktionen beeinträchtigt — und müde zu laufen senkt auch die Wachsamkeit, was auf technischem Gelände oder im Verkehr zählt.",
            "Ist die Ursache erkennbar und einmalig, hat sie eine Behandlung: schlafen. Ist sie es nicht, oder sieht sie nach einem beginnenden Infekt aus, ist die Einheit nicht die Priorität.",
          ],
        },
        {
          h: "Dritte Frage: welche Einheit stand an?",
          p: [
            "Diese Frage wird vergessen, und sie ist die nützlichste. „Soll ich laufen?\" hat keine allgemeine Antwort; „soll ich DIESE Einheit machen?\" schon.",
            "Ein lockerer Vierzig-Minuten-Lauf verlangt dem Nervensystem fast nichts ab, und viele fühlen sich danach besser als davor. Eine Schwellen- oder VO2max-Einheit dagegen verlangt, sie verkraften zu können — auf einem bereits mobilisierten Organismus erzeugt sie eine mittelmäßige Einheit UND eine verlängerte Erholung.",
            "Die richtige Entscheidung ist also selten binär. Fast immer heißt sie: den Lauf behalten und die Intensität ändern, oder die Qualität um zwei Tage verschieben.",
          ],
        },
        {
          h: "Der einzige Fall, in dem es Nein heißt",
          p: [
            "Fieber, diffuser Muskelschmerz, Halsschmerzen, geschwollene Lymphknoten: Da läuft man nicht, was auch immer der Indikator sagt. Das ist keine Frage der Leistung, sondern des Risikos — intensive Belastung während eines Infekts ist alles andere als harmlos.",
            "Außerhalb dieser Lage ist ein niedriger Wert eine Einladung zu reduzieren, kein Verbot. Und wenn der Zweifel mehrere Tage bleibt, entscheidet ein Arzt, keine Uhr.",
          ],
        },
        {
          h: "Was Pacevo damit macht",
          p: [
            "Diese Werte kommen über intervals.icu und fließen in den gleitenden Plan ein. Fallen sie im Trend ab, wird die Qualitätseinheit reduziert oder verschoben, und der Kalender schreibt auf, warum.",
            "Aber die App hat nur Zugriff auf das, was durch einen Sensor geht. Sie weiß nicht, dass du etwas ausbrütest, und auch nicht, dass die Woche im Beruf hart war. Da geht dein Urteil vor.",
          ],
        },
      ],
    },
    "ia-coach-ce-quun-humain-ne-fait-pas": {
      chapo:
        "Algorithmus und Trainer werden meist als Entweder-oder dargestellt. Die eigentliche Trennlinie ist nicht Intelligenz, sondern die Häufigkeit des Hinsehens. Hier steht, was jeder sieht — und was keiner von beiden sieht.",
      blocs: [
        {
          h: "Was ein Trainer leistet und kein Programm ersetzt",
          p: [
            "Ein Trainer liest ein Gesicht. Er hört an einem Satz, dass die Trennung, der Umzug oder die schlaflose Nacht schwerer wiegen als die Trainingsbelastung. Er weiß, dass ein Athlet, der nach einer Schwellen-Einheit „alles gut\" sagt, in der Hälfte der Fälle lügt — und er weiß, in welcher Hälfte.",
            "Er trägt außerdem den langen Blick. Er entscheidet, dass eine Saison der nächsten geopfert wird, dass ein Ziel verfrüht ist, dass dieses hier zählt, weil es dir am Herzen liegt — und dass ein motivierter Athlet wegsteckt, was ein resignierter verweigert. Nichts davon lässt sich aus einer Messreihe ableiten.",
            "Schließlich passt er live an. Ein Anstieg, der härter ist als gedacht, eine Gruppe, die zu schnell losläuft, eine Wade, die im dritten Kilometer zickt: Er ändert die Einheit vor Ort, mit dem, was er sieht.",
          ],
        },
        {
          h: "Was ein Programm leistet und kein Trainer kann",
          p: [
            "Es schaut jede Nacht hin. Nicht am Montagabend am Telefon: jede Nacht, und nach jeder Einheit. Das ist der einzige Unterschied, der wirklich zählt, und er ist struktureller Natur — wer dreißig Athleten betreut, kann nicht jeden Morgen dreißig Schlafkurven durchsehen, wie gut er auch sei.",
            "Es ermüdet nicht und hat kein Ego. Es überschätzt nicht die Einheit, die es selbst verordnet hat, erinnert sich nicht besser an das letzte gute Training als an die drei mittelmäßigen, und hat keinen Stolz zu verteidigen, wenn die Daten dem Plan widersprechen.",
            "Es rechnet über Zeitfenster, die kein Gedächtnis hält. Die chronische Belastung baut sich über Wochen auf, das Verhältnis zwischen jüngster und Grundbelastung liest sich über einen gleitenden Monat. Das sind gleitende Mittelwerte: Sie werden berechnet, nicht erahnt.",
          ],
        },
        {
          h: "Die Trennlinie: Häufigkeit, nicht Intelligenz",
          p: [
            "Ein Trainer beobachtet episodisch — eine Einheit, ein Anruf, eine Nachricht. Ein Programm beobachtet durchgehend, sieht aber nur, was gemessen wird. Der erste hat Kontext und wenige Messpunkte, das zweite viele Messpunkte und keinen Kontext.",
            "Deshalb ist die Gegenüberstellung falsch gestellt. Die Frage lautet nicht „wer entscheidet besser\", sondern „wer sieht was, und wie oft\". Ein Plan, der sich nur einmal pro Woche bewegt, ignoriert konstruktionsbedingt, was am Dienstagabend passiert ist.",
          ],
        },
        {
          h: "Was das in einer echten Woche ändert",
          p: [
            "Nimm eine gewöhnliche Woche. Dienstag, Schwellen-Einheit wie geplant. Mittwoch, kurze Nacht und Herzratenvariabilität deutlich unter der Norm. Donnerstag stand eine Qualitätseinheit im Plan.",
            "Ohne tägliche Durchsicht bleibt der Donnerstag: Er wurde am Sonntag geschrieben. Mit täglicher Durchsicht wird er reduziert, und die Qualität wandert auf Samstag, wenn die Werte zurück sind. Das Wochenvolumen ändert sich kaum; seine Verteilung schon — und sie entscheidet über den Verschleiß.",
            "Diese Logik — den Anstieg der Belastung steuern statt ihrer rohen Menge — steht im Zentrum von Tim Gabbetts Arbeit zum Paradox von Training und Verletzung: Oft sind es die schnellen Belastungssprünge, mehr als die hohe Belastung selbst, die den Athleten exponieren.",
          ],
        },
        {
          h: "Die Grenze, und sie gehört gesagt",
          p: [
            "Ein Programm entscheidet aus dem, was es misst. Was es nicht misst, existiert für es nicht: ein beginnender Schmerz, ein Trauerfall, mentale Last im Beruf, ein Schuh am Ende seines Lebens. Es wird sie nie sehen, und keine künftige Version auch, solange sie nicht durch einen Sensor gehen.",
            "Auch die Indikatoren selbst verlangen Vorsicht. Martin Buchheit hat gezeigt, dass herzfrequenzbasierte Messgrößen je nach Kontext, Zeitpunkt und Belastungsart nicht dieselbe Geschichte erzählen: Ein isolierter Wert bedeutet nichts, es ist der Trend, der informiert.",
            "Die ehrliche Schlussfolgerung lautet also nicht „der Algorithmus ersetzt\". Sondern: Er schaut täglich auf das, was ein Mensch nur punktuell betrachten kann, und versteht nichts von dem, was ein Mensch auf einen Blick erfasst. Wer besser wird, gibt jedem das, was er kann.",
          ],
        },
      ],
    },
    "vfc-et-charge-voir-la-fatigue-arriver": {
      chapo:
        "Drei Kurven und eine Messung am Morgen. Was jede sagt, was sie nicht sagt, und warum erst ihre Kreuzung — nie ein einzelner Wert — erlaubt, zu reduzieren, bevor etwas bricht.",
      blocs: [
        {
          h: "Die drei Kurven: was CTL, ATL und TSB bedeuten",
          p: [
            "Das Modell der meisten Trainingsplattformen geht auf Eric Banisters Arbeiten zur Belastungsantwort zurück. Es besteht aus drei Zahlen, alle aus derselben Reihe von Einheiten abgeleitet.",
            "Die chronische Belastung, oft CTL genannt, ist ein langer gleitender Mittelwert — etwa sechs Wochen. Sie ist deine Grundform: Sie steigt langsam, fällt langsam und steht für das, was dein Körper gewohnt ist zu verkraften.",
            "Die akute Belastung, ATL, ist dasselbe über ein kurzes Fenster von etwa einer Woche. Sie ist deine jüngste Ermüdung: Sie steigt nach einer harten Einheit schnell und fällt in Ruhe schnell.",
            "Die Frische, TSB, ist schlicht die Differenz beider. Negativ heißt: Du verkraftest gerade mehr als üblich. Positiv heißt: Du bist erholt — und das ist es, was man am Wettkampftag will, nicht im Aufbau.",
          ],
        },
        {
          h: "Die Herzratenvariabilität: was sie wirklich misst",
          p: [
            "Die Herzratenvariabilität, kurz HRV, misst keine Ermüdung. Sie misst den Abstand zwischen aufeinanderfolgenden Schlägen, der das Gleichgewicht der beiden Äste des vegetativen Nervensystems widerspiegelt. Eine niedrige HRV zeigt an, dass dein Organismus mobilisiert ist; sie sagt nicht, warum.",
            "Diese Unterscheidung ändert in der Praxis alles. Eine Nacht mit Alkohol, ein beginnender Infekt, ein zu warmes Zimmer, Jetlag oder Ärger im Beruf senken die HRV genauso wie ein zu hartes Training. Die Messung stimmt; die Deutung „ich bin übertrainiert\" nicht.",
            "Zweite Vorsicht: Ein einzelner Wert taugt nichts. Die HRV schwankt bei derselben Person stark von Tag zu Tag. Was informiert, ist der Abstand zu DEINER Basis — dem Mittel deiner letzten Tage — und die Richtung des Trends. Buchheit betont genau das: Herzfrequenzbasierte Größen gehören im Kontext gelesen, nicht isoliert.",
          ],
        },
        {
          h: "Warum beide gekreuzt werden müssen",
          p: [
            "Getrennt betrachtet irren beide Indikatorenfamilien auf vorhersehbare Weise.",
            "Die Belastung allein weiß nichts von deinem Leben. Sie sieht, dass du diese Woche dreimal gelaufen bist; dass du fünf Stunden pro Nacht geschlafen hast, entgeht ihr. Also verordnet sie weiter, als wäre alles in Ordnung.",
            "Die HRV allein weiß nichts von deinem Training. Sie sieht einen niedrigen Wert; sie kann eine bewusst harte Woche — in der negative Frische normal und gewollt ist — nicht von einem Abgleiten in die Erschöpfung unterscheiden.",
            "Gekreuzt korrigieren sie einander. Negative Frische bei stabiler HRV ist akzeptierte Belastung: Der Plan läuft weiter. Negative Frische mit mehrere Tage abfallender HRV ist ein Warnsignal: reduzieren. Eine niedrige HRV bei geringer Belastung hat vermutlich nichts mit dem Laufen zu tun.",
          ],
        },
        {
          h: "Was Pacevo konkret damit macht",
          p: [
            "Diese Werte kommen über intervals.icu von deiner Uhr — Schlaf, HRV, Ruhepuls, die Belastung jeder Einheit. Pacevo liest sie nach jeder Synchronisation neu und schreibt den gleitenden Sieben-Tage-Plan um, wenn sie sich ändern.",
            "Reduzieren heißt nicht, die Woche zu streichen. In der Praxis wandert die Qualitätseinheit, ihr intensiver Teil wird gekürzt, oder ein Lauf wird durch einen ruhigen ersetzt — das Volumen bewegt sich wenig, die Intensität viel.",
            "Und der Kalender schreibt das WARUM auf. Das ist im Alltag der wichtigste Punkt: Einen Plan, den man nicht versteht, umgeht man. Einen Plan, der sagt „deine Variabilität liegt seit drei Tagen unter deiner Basis, die Schwellen-Einheit wandert auf Samstag\", befolgt man.",
          ],
        },
        {
          h: "Was es nicht leistet",
          p: [
            "Es sagt keine Verletzung voraus. Der Belastungsanstieg ist ein Faktor unter mehreren — Biomechanik, Untergrund, Material, Verletzungsgeschichte und Schlaf zählen ebenso, und nichts davon passt in drei Kurven.",
            "Es ersetzt dein Urteil nicht. Ein Schmerz, der sich festsetzt, ein Missempfinden, das deinen Laufstil verändert, eine Müdigkeit, die trotz normaler Werte bleibt: Das sind Gründe aufzuhören, was auch immer ein Dashboard sagt. Ein Modell hat immer recht über das, was es misst, und unrecht über alles andere.",
          ],
        },
      ],
    },
  },
};

export const traductionArticle = (lang: Lang, slug: string) =>
  ARTICLES_I18N[lang]?.[slug];
