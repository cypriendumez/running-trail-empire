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
};

export const traductionArticle = (lang: Lang, slug: string) =>
  ARTICLES_I18N[lang]?.[slug];
