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
    "deficit-energetique-relatif-reds-coureur": {
      chapo:
        "The most important subject on this blog, and the least told. When what you eat no longer covers what you spend, performance isn't the first thing to go — bone, hormones and immunity are.",
      avertissement:
        "This article describes a recognised medical syndrome. It is neither a diagnostic tool nor a substitute for consultation. If you recognise yourself in several of the signs described, talk to a doctor or a sports dietitian — and if your relationship with food is a source of distress, to a mental health professional.",
      blocs: [
        {
          h: "What we are talking about",
          p: [
            "Since 2014 the International Olympic Committee has published a consensus on what it now calls REDs — Relative Energy Deficiency in Sport. The 2023 version is the current reference, and it is explicit: the problem is not weight, it is ENERGY AVAILABILITY.",
            "Energy availability is what remains for the body to live on once training is paid for. A runner can eat a lot and be in deficit if they train more; another can eat little and be fine if they run little. The number on the scale says nothing about any of this.",
            "That is why the syndrome also affects men, and athletes of perfectly ordinary weight. The image of the emaciated runner is an image, not a criterion.",
          ],
        },
        {
          h: "What it damages, in order",
          p: [
            "The body does not stop all at once: it shuts functions down by order of priority, and performance is not the first sacrificed. The IOC consensus describes impairment across multiple systems.",
            "Bone first, and it is the costliest: mineral density degrades, and stress fractures follow. Repeated stress fractures in an otherwise serious runner should raise the question of intake, not only of volume.",
            "Hormones next. In women, amenorrhoea — the absence of periods — is the most visible sign, and it is never normal in an athlete. In men, lowered testosterone is quieter but no less real.",
            "Then immunity, sleep, mood, the ability to recover. At that stage the athlete trains just as much and improves less and less — and their usual conclusion is that they aren't doing enough.",
          ],
        },
        {
          h: "The signs that should alert you",
          p: [
            "Stagnation or regression despite maintained training. Repeated bone injuries. Unusual sensitivity to cold. Sleep degrading for no reason. Reduced libido. In women, irregular or absent periods.",
            "None of these proves anything on its own — all have other possible causes. It is their ACCUMULATION in someone who trains a lot and eats little that should lead to a consultation.",
            "A common trap: heart rate variability and resting heart rate can stay acceptable for a long time. A watch does not detect this syndrome, and the absence of an alert on a dashboard is not a green light.",
          ],
        },
        {
          h: "The particular case of intentional weight loss",
          p: [
            "Wanting to lose weight through running is legitimate, and many do so without trouble. The risk does not come from the intention but from the RATE: it is a deficit too large, held too long, alongside a rising training load, that tips into REDs.",
            "Hence two simple rules. A deficit is opened slowly, and never during a hard training block or just before a race. And there is a floor below which losing more brings nothing to performance and costs health.",
          ],
        },
        {
          h: "What Pacevo does with this subject",
          p: [
            "The app's weight-loss mode is built on this logic rather than on rate of loss alone. The daily deficit is capped, the targeted loss is bounded as a percentage of body weight per week, and the calculation stops at a floor — maintenance is imposed below a body mass index of 21.",
            "Weight tracking, expenditure tracking and protein tracking are kept separate from the deficit itself, so that an athlete can weigh themselves without that mechanically triggering a restriction.",
            "None of this replaces a professional. What software can do is refuse to propose what would be unreasonable — and that is already a lot, because a frustrated runner's first reflex is to do more and eat less.",
          ],
        },
      ],
    },
    "renforcement-courir-plus-vite-sans-courir": {
      chapo:
        "It is one of the best-established links in the endurance literature, and it is the session almost everyone skips. What it improves, what it doesn't, and what it looks like for a runner.",
      blocs: [
        {
          h: "What the reference review says",
          p: [
            "Richard Blagrove's systematic review published in Sports Med in 2018 examined the effect of strength training on the physiological determinants of middle- and long-distance running performance. Its conclusion is clear: strength work improves running economy without degrading maximal oxygen uptake.",
            "Running economy is the energy cost of a given pace. Two runners with the same VO2max don't run the same time if one spends less to travel at the same speed. It is a performance lever in its own right, and a more accessible one than VO2max once you have a few years of training behind you.",
            "A second, less visible effect: strength work acts on tolerance to repeated loading. A runner who absorbs better trains more consistently, and consistency does more for progression than any isolated session.",
          ],
        },
        {
          h: "What it is not",
          p: [
            "It is not aesthetic bodybuilding, and the fear of \"bulking up\" is misplaced: heavy loads at low repetitions mainly develop neural drive.",
            "Nor is it a substitute for running. Strength work is added to a running plan, it does not replace it — and it certainly doesn't replace easy aerobic running.",
            "Finally, it is not a guarantee against injury. Load progression, sleep, history and terrain also count. Strength is one factor among others, simply one of the easiest to add.",
          ],
        },
        {
          h: "What it actually looks like",
          p: [
            "One or two sessions a week are enough, and they are short. The essentials come down to a few movements on the posterior chain and the foot-ground contact: squat, lunge, Romanian deadlift, step-up, and unilateral work — running is an exercise on one leg at a time.",
            "Two placement rules avoid most of the trouble. Don't put a heavy strength session the day before a quality session. And place it AFTER a run in the day rather than before, so you don't run on already-emptied legs.",
            "During high-load periods the session stays but gets lighter. Deleting it entirely through the eight hardest weeks means losing the adaptation exactly when it protects most.",
          ],
        },
        {
          h: "The trail case",
          p: [
            "Downhill, the muscle brakes while lengthening — a particularly traumatic mode of contraction, and it is what produces wooden quads the next day.",
            "This is where strength work becomes specific: eccentric work, and above all descents in training. No gym replaces having descended, several times, what the race will ask you to descend.",
          ],
        },
        {
          h: "Where it is in the app",
          p: [
            "Pacevo integrates strength work into the programme rather than leaving it aside: the strength guide is reachable from the training area, and the coach's context plans one to two sessions per week when building the plan.",
            "The strength session is not pushed to the watch — the watch receives running sessions. That is a limit of the sync chain, not an oversight.",
          ],
        },
      ],
    },
    "cycle-menstruel-et-entrainement-ce-que-dit-la-meta-analyse": {
      chapo:
        "Many apps sell periodisation built around the cycle. The reference meta-analysis is considerably more cautious than that pitch, and that caution is itself the most useful information.",
      avertissement:
        "This article summarises general scientific literature. Absent, very painful or very heavy periods are not a training matter but a medical one.",
      blocs: [
        {
          h: "What the meta-analysis found",
          p: [
            "Kelly McNulty and colleagues published a systematic review with meta-analysis in Sports Med in 2020 on the effect of menstrual cycle phase on exercise performance in eumenorrheic women — that is, with regular cycles and no hormonal contraception.",
            "Their conclusion has two parts, and the second matters as much as the first. There is an effect of cycle phase on performance, but it is of SMALL magnitude. And the quality of available studies is generally low, which demands caution in interpretation.",
            "Above all, between-individual variability is considerable. What the cycle does to one athlete does not predict what it does to another, and that is why a general rule like \"push in the follicular phase, ease off in the luteal\" is often wrong.",
          ],
        },
        {
          h: "Why rigid periodisation misses the point",
          p: [
            "Calendar-based periodisation assumes two things: that your cycle is regular, and that your response resembles the average. Both assumptions are fragile, and the second is contradicted by the observed variability.",
            "It also has a cost: giving up a quality session on principle for part of every month removes a non-trivial share of the year's hard work. On the basis of an effect the literature calls small, that is a bad trade.",
            "Add that many women use hormonal contraception, which changes the picture — the meta-analysis cited concerns specifically women without hormonal contraception, and a separate review looked at oral contraceptives.",
          ],
        },
        {
          h: "What works better: observe rather than assume",
          p: [
            "The defensible approach is individual. Note, cycle after cycle, where the bad sessions fall, the heavy-leg feelings, sleep and appetite. After a few months a pattern appears — or doesn't, and that is an answer too.",
            "If it appears, the adjustment follows YOUR pattern, not a population average. And it often bears less on cancelling a session than on moving it forty-eight hours.",
            "Two practical points sit outside the performance debate and deserve treatment in their own right: iron, whose requirements are increased by menstrual losses, and painful symptoms, which are a medical matter and not a training plan.",
          ],
        },
        {
          h: "The link with REDs",
          p: [
            "One point is not a nuance but an alarm: absence of periods in an athlete is never normal. It is one of the most visible signs of the relative energy deficiency described by the IOC consensus.",
            "The shortcut \"I train a lot, that's why\" is widespread and wrong. A cycle that disappears is a signal to bring to a doctor, not an adaptation to training.",
          ],
        },
        {
          h: "What Pacevo offers, and what it doesn't do",
          p: [
            "The app allows cycle tracking to be enabled: the phase then enters the coach's context on the same footing as sleep, heart rate variability or load, and weighs on how intensity is distributed.",
            "It is off by default, deliberately. It is intimate health data, and nothing justifies collecting it from someone who has not explicitly asked for it.",
            "What the app does not do: decide for you that a phase is bad. It crosses the information with the rest, and the calendar explains its decision — which leaves you free to contradict it, and that is the point.",
          ],
        },
      ],
    },
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
    "deficit-energetique-relatif-reds-coureur": {
      chapo:
        "Das wichtigste Thema dieses Blogs und das am wenigsten erzählte. Wenn das, was du isst, nicht mehr deckt, was du verbrauchst, bricht nicht zuerst die Leistung weg — sondern Knochen, Hormone und Immunsystem.",
      avertissement:
        "Dieser Artikel beschreibt ein anerkanntes medizinisches Syndrom. Er ist weder ein Diagnosewerkzeug noch ein Ersatz für eine Konsultation. Wenn du dich in mehreren der beschriebenen Zeichen wiedererkennst, sprich mit einer Ärztin oder einem Sporternährungsberater — und wenn das Verhältnis zum Essen belastend ist, mit einer Fachperson für psychische Gesundheit.",
      blocs: [
        {
          h: "Wovon wir sprechen",
          p: [
            "Das Internationale Olympische Komitee veröffentlicht seit 2014 einen Konsens zu dem, was es heute REDs nennt — Relative Energy Deficiency in Sport. Die Fassung von 2023 ist die aktuelle Referenz, und sie ist deutlich: Das Problem ist nicht das Gewicht, sondern die ENERGIEVERFÜGBARKEIT.",
            "Energieverfügbarkeit ist das, was dem Organismus zum Leben bleibt, nachdem das Training bezahlt ist. Ein Läufer kann viel essen und im Defizit sein, wenn er mehr trainiert; ein anderer kann wenig essen und gut zurechtkommen, wenn er wenig läuft. Die Zahl auf der Waage sagt darüber nichts.",
            "Deshalb betrifft das Syndrom auch Männer und Athleten von völlig gewöhnlichem Gewicht. Das Bild des ausgemergelten Läufers ist ein Bild, kein Kriterium.",
          ],
        },
        {
          h: "Was es schädigt, in dieser Reihenfolge",
          p: [
            "Der Körper hört nicht auf einen Schlag auf: Er schaltet Funktionen nach Priorität ab, und die Leistung wird nicht zuerst geopfert. Der IOC-Konsens beschreibt eine Beeinträchtigung mehrerer Systeme.",
            "Zuerst der Knochen, und das ist das Teuerste: Die Knochendichte verschlechtert sich, und Ermüdungsbrüche folgen. Wiederholte Ermüdungsbrüche bei einem ansonsten seriösen Läufer müssen die Frage nach der Zufuhr aufwerfen, nicht nur nach dem Umfang.",
            "Dann die Hormone. Bei Frauen ist die Amenorrhoe — das Ausbleiben der Regel — das sichtbarste Zeichen, und es ist bei einer Sportlerin nie normal. Bei Männern ist der Testosteronabfall stiller, aber nicht weniger real.",
            "Danach Immunsystem, Schlaf, Stimmung, Regenerationsfähigkeit. In diesem Stadium trainiert der Athlet genauso viel und macht immer weniger Fortschritte — und sein üblicher Schluss lautet, er tue nicht genug.",
          ],
        },
        {
          h: "Die Zeichen, die alarmieren sollten",
          p: [
            "Stagnation oder Rückschritt trotz gleichbleibendem Training. Wiederholte Knochenverletzungen. Ungewohntes Frieren. Schlaf, der sich ohne Grund verschlechtert. Nachlassende Libido. Bei Frauen unregelmäßige oder ausbleibende Regelblutungen.",
            "Keines dieser Zeichen beweist für sich genommen etwas — alle haben andere mögliche Ursachen. Es ist ihre HÄUFUNG bei jemandem, der viel trainiert und wenig isst, die zu einer Konsultation führen sollte.",
            "Eine häufige Falle: Herzratenvariabilität und Ruhepuls können lange unauffällig bleiben. Eine Uhr erkennt dieses Syndrom nicht, und das Fehlen einer Warnung auf einem Dashboard ist keine Freigabe.",
          ],
        },
        {
          h: "Der Sonderfall der gewollten Gewichtsabnahme",
          p: [
            "Über das Laufen abnehmen zu wollen ist legitim, und viele tun es ohne Probleme. Das Risiko entsteht nicht aus der Absicht, sondern aus dem TEMPO: Ein zu großes, zu lange gehaltenes Defizit bei gleichzeitig steigender Trainingsbelastung kippt in REDs.",
            "Daraus folgen zwei einfache Regeln. Ein Defizit wird langsam aufgebaut, und nie während eines harten Trainingsblocks oder kurz vor einem Wettkampf. Und es gibt eine Untergrenze, unterhalb derer weiteres Abnehmen der Leistung nichts bringt und die Gesundheit kostet.",
          ],
        },
        {
          h: "Was Pacevo aus diesem Thema macht",
          p: [
            "Der Abnehm-Modus der App ist auf dieser Logik gebaut und nicht auf der reinen Abnahmegeschwindigkeit. Das tägliche Defizit ist gedeckelt, der angestrebte Verlust ist als Prozentsatz des Körpergewichts pro Woche begrenzt, und die Berechnung stoppt an einer Untergrenze — unterhalb eines Body-Mass-Index von 21 wird Erhaltung erzwungen.",
            "Gewichtsverfolgung, Verbrauch und Proteinzufuhr sind vom Defizit selbst getrennt, damit sich jemand wiegen kann, ohne dass dies mechanisch eine Restriktion auslöst.",
            "Nichts davon ersetzt eine Fachperson. Was Software leisten kann, ist sich zu weigern, Unvernünftiges vorzuschlagen — und das ist schon viel, denn der erste Reflex eines frustrierten Läufers ist, mehr zu tun und weniger zu essen.",
          ],
        },
      ],
    },
    "renforcement-courir-plus-vite-sans-courir": {
      chapo:
        "Es ist einer der am besten belegten Zusammenhänge der Ausdauerliteratur — und die Einheit, die fast alle auslassen. Was sie verbessert, was nicht, und wie sie für einen Läufer aussieht.",
      blocs: [
        {
          h: "Was die maßgebliche Übersichtsarbeit sagt",
          p: [
            "Die systematische Übersichtsarbeit von Richard Blagrove, 2018 in Sports Med veröffentlicht, untersuchte die Wirkung von Krafttraining auf die physiologischen Determinanten der Mittel- und Langstreckenleistung. Ihr Schluss ist klar: Krafttraining verbessert die Laufökonomie, ohne die maximale Sauerstoffaufnahme zu verschlechtern.",
            "Laufökonomie ist der Energieaufwand für ein gegebenes Tempo. Zwei Läufer mit derselben VO2max laufen nicht dieselbe Zeit, wenn einer für dieselbe Geschwindigkeit weniger aufwendet. Es ist ein eigenständiger Leistungshebel, und ein zugänglicherer als die VO2max, sobald man einige Trainingsjahre hinter sich hat.",
            "Ein zweiter, weniger sichtbarer Effekt: Krafttraining wirkt auf die Toleranz gegenüber wiederholter Belastung. Wer besser wegsteckt, trainiert regelmäßiger — und Regelmäßigkeit bringt mehr als jede einzelne Einheit.",
          ],
        },
        {
          h: "Was es nicht ist",
          p: [
            "Es ist kein ästhetisches Bodybuilding, und die Angst vor „Masse\" ist unbegründet: Schwere Lasten bei wenigen Wiederholungen entwickeln vor allem die neuronale Ansteuerung.",
            "Es ist auch kein Ersatz für das Laufen. Krafttraining kommt zu einem Laufplan hinzu, es ersetzt ihn nicht — und erst recht nicht den ruhigen Grundlagenlauf.",
            "Schließlich ist es keine Garantie gegen Verletzungen. Belastungsanstieg, Schlaf, Vorgeschichte und Untergrund zählen ebenso. Kraft ist ein Faktor unter mehreren, nur einer der am leichtesten hinzuzufügenden.",
          ],
        },
        {
          h: "Wie es konkret aussieht",
          p: [
            "Ein bis zwei Einheiten pro Woche reichen, und sie sind kurz. Das Wesentliche liegt in wenigen Bewegungen für die hintere Kette und den Bodenkontakt: Kniebeuge, Ausfallschritt, rumänisches Kreuzheben, Step-up und einbeiniges Arbeiten — Laufen ist eine Übung auf jeweils einem Bein.",
            "Zwei Platzierungsregeln ersparen die meisten Probleme. Keine schwere Krafteinheit am Vortag einer Qualitätseinheit. Und lieber NACH einem Lauf im Tagesverlauf als davor, um nicht auf schon leeren Beinen zu laufen.",
            "In Phasen hoher Belastung bleibt die Einheit, wird aber leichter. Sie in den acht härtesten Wochen ganz zu streichen heißt, die Anpassung genau dann zu verlieren, wenn sie am meisten schützt.",
          ],
        },
        {
          h: "Der Trail-Fall",
          p: [
            "Bergab bremst der Muskel, während er sich verlängert — eine besonders belastende Kontraktionsform, und sie erzeugt die hölzernen Oberschenkel am nächsten Tag.",
            "Hier wird Krafttraining spezifisch: exzentrische Arbeit, und vor allem Abfahrten im Training. Kein Studio ersetzt die Erfahrung, mehrfach das hinuntergelaufen zu sein, was der Wettkampf verlangen wird.",
          ],
        },
        {
          h: "Wo es in der App steckt",
          p: [
            "Pacevo integriert Krafttraining ins Programm, statt es danebenzustellen: Der Kraft-Leitfaden ist aus dem Trainingsbereich erreichbar, und der Kontext des Coaches sieht beim Planaufbau ein bis zwei Einheiten pro Woche vor.",
            "Die Krafteinheit wird nicht auf die Uhr geschoben — die Uhr erhält Laufeinheiten. Das ist eine Grenze der Synchronisationskette, kein Versehen.",
          ],
        },
      ],
    },
    "cycle-menstruel-et-entrainement-ce-que-dit-la-meta-analyse": {
      chapo:
        "Viele Apps verkaufen eine Periodisierung nach dem Zyklus. Die maßgebliche Meta-Analyse ist deutlich vorsichtiger als dieses Versprechen — und diese Vorsicht ist selbst die nützlichste Information.",
      avertissement:
        "Dieser Artikel fasst allgemeine wissenschaftliche Literatur zusammen. Ausbleibende, sehr schmerzhafte oder sehr starke Regelblutungen sind keine Trainings-, sondern eine medizinische Frage.",
      blocs: [
        {
          h: "Was die Meta-Analyse fand",
          p: [
            "Kelly McNulty und Kolleginnen veröffentlichten 2020 in Sports Med eine systematische Übersicht mit Meta-Analyse zur Wirkung der Zyklusphase auf die Leistungsfähigkeit bei eumenorrhoischen Frauen — also mit regelmäßigem Zyklus und ohne hormonelle Verhütung.",
            "Ihr Schluss hat zwei Teile, und der zweite wiegt so schwer wie der erste. Es gibt einen Effekt der Zyklusphase auf die Leistung, aber er ist von GERINGEM Ausmaß. Und die Qualität der verfügbaren Studien ist insgesamt niedrig, was Vorsicht bei der Auslegung verlangt.",
            "Vor allem ist die Variabilität zwischen Personen beträchtlich. Was der Zyklus bei einer Athletin bewirkt, sagt nichts darüber, was er bei einer anderen bewirkt — und deshalb liegt eine allgemeine Regel wie „in der Follikelphase drücken, in der Lutealphase zurücknehmen\" oft daneben.",
          ],
        },
        {
          h: "Warum starre Periodisierung daran vorbeigeht",
          p: [
            "Eine kalendergestützte Periodisierung unterstellt zweierlei: dass dein Zyklus regelmäßig ist und dass deine Reaktion dem Durchschnitt ähnelt. Beide Annahmen sind fragil, und die zweite wird durch die beobachtete Variabilität widerlegt.",
            "Sie hat auch einen Preis: grundsätzlich auf eine Qualitätseinheit für einen Teil jedes Monats zu verzichten, entzieht dem Jahr einen erheblichen Anteil intensiver Arbeit. Auf Basis eines Effekts, den die Literatur als gering bezeichnet, ist das ein schlechter Tausch.",
            "Hinzu kommt, dass viele Frauen hormonell verhüten, was das Bild verändert — die zitierte Meta-Analyse betrifft ausdrücklich Frauen ohne hormonelle Verhütung, und eine eigene Übersichtsarbeit hat sich mit oralen Kontrazeptiva befasst.",
          ],
        },
        {
          h: "Was besser funktioniert: beobachten statt unterstellen",
          p: [
            "Der vertretbare Ansatz ist individuell. Notiere Zyklus für Zyklus, wo die schlechten Einheiten fallen, das Gefühl schwerer Beine, Schlaf und Appetit. Nach einigen Monaten zeigt sich ein Muster — oder eben nicht, und auch das ist eine Antwort.",
            "Zeigt es sich, richtet sich die Anpassung nach DEINEM Muster, nicht nach einem Bevölkerungsmittel. Und sie betrifft oft weniger das Streichen einer Einheit als ihr Verschieben um achtundvierzig Stunden.",
            "Zwei praktische Punkte stehen außerhalb der Leistungsdebatte und verdienen eigene Behandlung: Eisen, dessen Bedarf durch Menstruationsverluste steigt, und schmerzhafte Symptome, die eine medizinische Frage sind und kein Trainingsplan.",
          ],
        },
        {
          h: "Die Verbindung zu REDs",
          p: [
            "Ein Punkt ist keine Nuance, sondern ein Alarm: Ausbleibende Regelblutungen sind bei einer Sportlerin nie normal. Es ist eines der sichtbarsten Zeichen des relativen Energiedefizits, das der IOC-Konsens beschreibt.",
            "Die Abkürzung „ich trainiere viel, daher kommt das\" ist verbreitet und falsch. Ein Zyklus, der verschwindet, gehört zu einer Ärztin, nicht in die Rubrik Trainingsanpassung.",
          ],
        },
        {
          h: "Was Pacevo anbietet und was es nicht tut",
          p: [
            "Die App erlaubt, eine Zyklusverfolgung zu aktivieren: Die Phase geht dann in den Kontext des Coaches ein wie Schlaf, Herzratenvariabilität oder Belastung, und wirkt auf die Verteilung der Intensität.",
            "Sie ist standardmäßig aus, und das ist Absicht. Es sind intime Gesundheitsdaten, und nichts rechtfertigt, sie bei jemandem zu erheben, der nicht ausdrücklich darum gebeten hat.",
            "Was die App nicht tut: für dich entscheiden, dass eine Phase schlecht ist. Sie kreuzt die Information mit dem Rest, und der Kalender erklärt seine Entscheidung — was dir die Möglichkeit lässt, ihr zu widersprechen, und genau das ist der Zweck.",
          ],
        },
      ],
    },
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
  es: {
    "deficit-energetique-relatif-reds-coureur": {
      chapo:
        "El tema más importante de este blog, y el menos contado. Cuando lo que comes deja de cubrir lo que gastas, no es el rendimiento lo primero que cae — son el hueso, las hormonas y la inmunidad.",
      avertissement:
        "Este artículo describe un síndrome médico reconocido. No es una herramienta de diagnóstico ni sustituye una consulta. Si te reconoces en varios de los signos descritos, háblalo con un médico o un dietista deportivo — y si la relación con la comida es fuente de sufrimiento, con un profesional de salud mental.",
      blocs: [
        {
          h: "De qué hablamos",
          p: [
            "El Comité Olímpico Internacional publica desde 2014 un consenso sobre lo que hoy llama REDs — Relative Energy Deficiency in Sport. Su versión de 2023 es la referencia actual, y es explícita: el problema no es el peso, es la DISPONIBILIDAD ENERGÉTICA.",
            "La disponibilidad energética es lo que le queda al organismo para vivir una vez pagado el entrenamiento. Un corredor puede comer mucho y estar en déficit si entrena más; otro puede comer poco y estar bien si corre poco. La cifra de la báscula no dice nada de eso.",
            "Por eso el síndrome afecta también a hombres, y a atletas de peso perfectamente corriente. La imagen del corredor esquelético es una imagen, no un criterio.",
          ],
        },
        {
          h: "Qué daña, y en qué orden",
          p: [
            "El cuerpo no se detiene de golpe: apaga funciones por orden de prioridad, y el rendimiento no es lo primero que se sacrifica. El consenso del COI describe una afectación de múltiples sistemas.",
            "El hueso primero, y es lo más caro: la densidad mineral se degrada y aparecen las fracturas de estrés. Fracturas de estrés repetidas en un corredor por lo demás serio deben plantear la cuestión del aporte, no solo la del volumen.",
            "Las hormonas después. En la mujer, la amenorrea — la ausencia de regla — es el signo más visible, y nunca es normal en una deportista. En el hombre, la caída de testosterona es más silenciosa pero igual de real.",
            "Luego la inmunidad, el sueño, el ánimo, la capacidad de recuperar. En esa fase el atleta entrena igual y progresa cada vez menos — y su conclusión habitual es que no hace bastante.",
          ],
        },
        {
          h: "Los signos que deben alertarte",
          p: [
            "Estancamiento o retroceso pese a mantener el entrenamiento. Lesiones óseas repetidas. Frío inhabitual. Sueño que se degrada sin causa. Libido a la baja. En la mujer, reglas irregulares o ausentes.",
            "Ninguno de estos signos prueba nada por separado — todos tienen otras causas posibles. Es su ACUMULACIÓN en alguien que entrena mucho y come poco lo que debe llevar a consultar.",
            "Una trampa frecuente: la variabilidad cardíaca y la frecuencia cardíaca en reposo pueden mantenerse correctas mucho tiempo. Un reloj no detecta este síndrome, y la ausencia de alerta en un panel no equivale a luz verde.",
          ],
        },
        {
          h: "El caso particular de la pérdida de peso buscada",
          p: [
            "Querer perder peso corriendo es legítimo, y muchos lo hacen sin problema. El riesgo no aparece con la intención sino con el RITMO: es un déficit demasiado grande, sostenido demasiado tiempo, a la vez que sube la carga de entrenamiento, lo que bascula hacia los REDs.",
            "De ahí dos reglas simples. Un déficit se abre despacio, y nunca durante un bloque duro ni justo antes de una carrera. Y existe un suelo por debajo del cual perder más no aporta nada al rendimiento y cuesta salud.",
          ],
        },
        {
          h: "Qué hace Pacevo con este tema",
          p: [
            "El modo pérdida de peso de la app está construido sobre esta lógica y no sobre la mera velocidad de pérdida. El déficit diario está limitado, la pérdida buscada está acotada en porcentaje de peso por semana, y el cálculo se detiene en un suelo — por debajo de un índice de masa corporal de 21 se impone el mantenimiento.",
            "El seguimiento del peso, el del gasto y el de las proteínas están separados del déficit en sí, para que alguien pueda pesarse sin que eso dispare mecánicamente una restricción.",
            "Nada de esto sustituye a un profesional. Lo que el software puede hacer es negarse a proponer lo que sería poco razonable — y ya es mucho, porque el primer reflejo de un corredor frustrado es hacer más y comer menos.",
          ],
        },
      ],
    },
    "renforcement-courir-plus-vite-sans-courir": {
      chapo:
        "Es uno de los vínculos mejor establecidos de la literatura de resistencia, y es la sesión que casi todo el mundo se salta. Qué mejora, qué no, y cómo es para un corredor.",
      blocs: [
        {
          h: "Lo que dice la revisión de referencia",
          p: [
            "La revisión sistemática de Richard Blagrove publicada en Sports Med en 2018 examinó el efecto del entrenamiento de fuerza sobre los determinantes fisiológicos del rendimiento en medio fondo y fondo. Su conclusión es nítida: el trabajo de fuerza mejora la economía de carrera sin degradar el consumo máximo de oxígeno.",
            "La economía de carrera es el coste energético de un ritmo dado. Dos corredores con el mismo VO2máx no hacen el mismo crono si uno gasta menos para ir a la misma velocidad. Es una palanca de rendimiento por derecho propio, y más accesible que el VO2máx cuando ya llevas unos años entrenando.",
            "Segundo efecto, menos visible: la fuerza actúa sobre la tolerancia a las cargas repetidas. Quien encaja mejor entrena con más regularidad, y la regularidad hace más por la progresión que cualquier sesión aislada.",
          ],
        },
        {
          h: "Lo que no es",
          p: [
            "No es culturismo estético, y el miedo a «coger volumen» no tiene fundamento: las cargas pesadas a pocas repeticiones desarrollan sobre todo el mando nervioso.",
            "Tampoco sustituye a correr. La fuerza se añade a un plan de carrera, no lo reemplaza — y menos aún reemplaza al rodaje suave.",
            "Por último, no es una garantía contra la lesión. La progresión de la carga, el sueño, el historial y el terreno también cuentan. La fuerza es un factor entre otros, simplemente uno de los más fáciles de añadir.",
          ],
        },
        {
          h: "Cómo es en concreto",
          p: [
            "Una o dos sesiones por semana bastan, y son cortas. Lo esencial cabe en unos pocos movimientos de cadena posterior y apoyos: sentadilla, zancada, peso muerto rumano, subida al cajón y trabajo unilateral — correr es un ejercicio sobre una pierna cada vez.",
            "Dos reglas de colocación evitan la mayoría de los problemas. No pongas una sesión de fuerza pesada la víspera de una sesión de calidad. Y colócala más bien DESPUÉS de una carrera en el día que antes, para no correr con las piernas ya vaciadas.",
            "En periodos de carga alta la sesión se mantiene pero se aligera. Suprimirla del todo durante las ocho semanas más duras es perder la adaptación justo cuando más protege.",
          ],
        },
        {
          h: "El caso del trail",
          p: [
            "En bajada, el músculo frena alargándose — un modo de contracción especialmente traumático, y es el que produce los cuádriceps de madera del día siguiente.",
            "Es un caso en que la fuerza se especifica: trabajo excéntrico y, sobre todo, bajadas en el entrenamiento. Ningún gimnasio sustituye el haber bajado, varias veces, lo que la carrera te pedirá bajar.",
          ],
        },
        {
          h: "Dónde está en la app",
          p: [
            "Pacevo integra la fuerza en el programa en lugar de dejarla al margen: la guía de refuerzo es accesible desde el espacio de entrenamiento, y el contexto del entrenador prevé una o dos sesiones semanales al construir el plan.",
            "La sesión de fuerza no se envía al reloj — el reloj recibe las sesiones de carrera. Es un límite de la cadena de sincronización, no un olvido.",
          ],
        },
      ],
    },
    "cycle-menstruel-et-entrainement-ce-que-dit-la-meta-analyse": {
      chapo:
        "Muchas apps venden una periodización ajustada al ciclo. El metaanálisis de referencia es bastante más prudente que ese discurso, y esa prudencia es en sí misma la información más útil.",
      avertissement:
        "Este artículo resume literatura científica general. Reglas ausentes, muy dolorosas o muy abundantes no son un asunto de entrenamiento sino médico.",
      blocs: [
        {
          h: "Lo que encontró el metaanálisis",
          p: [
            "Kelly McNulty y su equipo publicaron en 2020 en Sports Med una revisión sistemática con metaanálisis sobre el efecto de la fase del ciclo menstrual en el rendimiento en mujeres eumenorreicas — es decir, con ciclo regular y sin anticoncepción hormonal.",
            "Su conclusión tiene dos partes, y la segunda pesa tanto como la primera. Existe un efecto de la fase del ciclo sobre el rendimiento, pero es de PEQUEÑA magnitud. Y la calidad de los estudios disponibles es en general baja, lo que obliga a prudencia al interpretar.",
            "Sobre todo, la variabilidad entre individuos es considerable. Lo que el ciclo hace a una atleta no predice lo que hace a otra, y por eso una regla general del tipo «apretar en fase folicular, levantar el pie en lútea» se equivoca a menudo.",
          ],
        },
        {
          h: "Por qué una periodización rígida se equivoca",
          p: [
            "Una periodización basada en el calendario supone dos cosas: que tu ciclo es regular y que tu respuesta se parece a la media. Ambas hipótesis son frágiles, y la segunda queda contradicha por la variabilidad observada.",
            "También tiene un coste: renunciar por principio a una sesión de calidad durante una parte de cada mes retira una porción nada despreciable del trabajo intenso del año. Sobre la base de un efecto que la literatura califica de pequeño, es un mal cambio.",
            "Añádase que muchas mujeres usan anticoncepción hormonal, lo que cambia el cuadro — el metaanálisis citado se refiere específicamente a mujeres sin anticoncepción hormonal, y una revisión distinta se ocupó de los anticonceptivos orales.",
          ],
        },
        {
          h: "Lo que funciona mejor: observar en vez de presumir",
          p: [
            "El enfoque defendible es individual. Anota, ciclo tras ciclo, dónde caen las sesiones que salen mal, las sensaciones de piernas pesadas, el sueño y el apetito. Al cabo de unos meses aparece un patrón — o no aparece, y eso también es una respuesta.",
            "Si aparece, el ajuste se hace sobre TU patrón, no sobre una media poblacional. Y suele referirse menos a anular una sesión que a desplazarla cuarenta y ocho horas.",
            "Dos puntos prácticos quedan fuera del debate sobre el rendimiento y merecen tratarse aparte: el hierro, cuyas necesidades aumentan con las pérdidas menstruales, y los síntomas dolorosos, que son un asunto médico y no un plan de entrenamiento.",
          ],
        },
        {
          h: "El vínculo con los REDs",
          p: [
            "Un punto no es un matiz sino una alarma: la ausencia de regla en una deportista nunca es normal. Es uno de los signos más visibles del déficit energético relativo descrito por el consenso del COI.",
            "El atajo «entreno mucho, por eso» está extendido y es falso. Un ciclo que desaparece es una señal que se lleva a un médico, no una adaptación al entrenamiento.",
          ],
        },
        {
          h: "Lo que propone Pacevo, y lo que no hace",
          p: [
            "La app permite activar un seguimiento del ciclo: la fase entra entonces en el contexto del entrenador igual que el sueño, la variabilidad cardíaca o la carga, y pesa en el reparto de la intensidad.",
            "Está desactivado por defecto, y es deliberado. Es un dato de salud íntimo, y nada justifica recogerlo de alguien que no lo ha pedido explícitamente.",
            "Lo que la app no hace: decidir por ti que una fase es mala. Cruza la información con el resto, y el calendario explica su decisión — lo que te deja la posibilidad de contradecirla, que es justamente el objetivo.",
          ],
        },
      ],
    },
    "ravitaillement-marathon-quoi-quand-combien": {
      chapo:
        "Las recomendaciones de hidratos durante el esfuerzo son objeto de un consenso bastante estable en la literatura. Aquí está lo que dice, de dónde vienen las cifras, y por qué el punto más importante no es la cantidad sino el entrenamiento de tu intestino.",
      avertissement:
        "Este artículo resume recomendaciones generales procedentes de publicaciones científicas. No sustituye el consejo de un médico o un dietista, en particular en caso de trastorno digestivo, diabetes, embarazo o tratamiento en curso.",
      blocs: [
        {
          h: "Por qué existe el tema",
          p: [
            "El cuerpo almacena una cantidad limitada de glucógeno — en el hígado y en los músculos. En un esfuerzo de resistencia prolongado, esa reserva se convierte en el factor limitante mucho antes que los propios músculos. Es la causa fisiológica de lo que los corredores llaman el muro.",
            "Aportar hidratos durante el esfuerzo no sirve para «tener energía» en un sentido vago: sirve para ahorrar una reserva que no se puede agrandar el día de la carrera.",
          ],
        },
        {
          h: "Cuánto: lo que dice el consenso",
          p: [
            "La síntesis de Asker Jeukendrup publicada en Sports Med en 2014 propone una escala según la duración del esfuerzo más que una cifra única. En torno a 30 a 60 gramos de hidratos por hora para un esfuerzo de una a dos horas y media; hasta unos 90 gramos por hora más allá, pero con una condición precisa, desarrollada justo debajo.",
            "El posicionamiento conjunto del American College of Sports Medicine sobre nutrición y rendimiento, publicado el mismo año, va en el mismo sentido y sitúa esos aportes en la alimentación general del atleta.",
            "Estos rangos son amplios a propósito. El peso, el ritmo, el calor y la tolerancia individual mueven el cursor, y la diferencia entre dos corredores del mismo nivel es considerable.",
          ],
        },
        {
          h: "La condición que todo el mundo olvida: dos azúcares, no uno",
          p: [
            "La glucosa atraviesa la pared intestinal por un transportador que se satura — eso es lo que limita la absorción en torno a 60 gramos por hora. La fructosa usa un transportador distinto, que no se satura al mismo tiempo.",
            "Por eso los aportes altos se basan en una mezcla de glucosa y fructosa. Buscar 90 gramos por hora solo con glucosa no los hará pasar: el excedente se queda en el intestino, y ahí nacen los problemas digestivos que arruinan un final de carrera.",
            "En concreto, esto significa leer la etiqueta. Un producto que anuncia una proporción de dos a uno entre glucosa y fructosa está diseñado para eso; otro no.",
          ],
        },
        {
          h: "Cuándo: la carrera empieza antes de la salida",
          p: [
            "Los días previos, el objetivo es salir con las reservas llenas, lo que pasa por una alimentación rica en hidratos y un volumen de entrenamiento reducido — el afinamiento juega aquí tanto como el plato.",
            "Por la mañana, una comida digestible unas horas antes de la salida, hecha de lo que ya has probado. No es el día de estrenar un pan nuevo.",
            "Durante, la regla más útil es empezar pronto y fraccionar. Esperar a tener hambre ya es tarde: el vaciado gástrico lleva tiempo, y recuperar en una toma masiva es exactamente lo que el intestino rechaza.",
          ],
        },
        {
          h: "Beber: a la sed, y pensar en el sodio",
          p: [
            "La recomendación de inundar el organismo se ha abandonado. Beber a la sed sigue siendo la referencia más segura para la mayoría, y beber muchísima agua pura en un esfuerzo largo expone a un peligro real — la hiponatremia, una dilución del sodio sanguíneo.",
            "Con calor fuerte o cuando sudas mucho, el aporte de sodio cuenta tanto como el volumen de bebida. La mayoría de bebidas deportivas lo contienen; el agua sola no.",
          ],
        },
        {
          h: "El punto más importante: entrenar el intestino",
          p: [
            "El intestino se adapta a lo que se le pide con regularidad. Un corredor que nunca se alimenta en el entrenamiento y absorbe 90 gramos por hora el día de la carrera expone su estómago a una carga inédita en el peor momento.",
            "La consecuencia práctica es simple, y la que menos se sigue: las tiradas largas son el lugar donde se prueba el avituallamiento. Mismos productos, mismas cantidades, mismos intervalos que el día de la carrera. El plan de nutrición se ensaya en el entrenamiento, exactamente igual que el ritmo.",
          ],
        },
        {
          h: "Después",
          p: [
            "La reposición del glucógeno es más rápida en las horas siguientes al esfuerzo, lo que importa cuando se encadenan carreras, mucho menos cuando la siguiente es dentro de tres semanas.",
            "Para una carrera objetivo, el verdadero tema del después no es la ventana metabólica: es dejar que baje la carga antes de volver a empezar.",
          ],
        },
      ],
    },
    "chaussure-de-trail-ce-qui-compte-avant-la-marque": {
      chapo:
        "Este artículo anunciaba una «comparativa según tu pisada»: habría hecho falta puntuar modelos concretos, con criterios que no medimos, y la clasificación estaría caducada al salir la siguiente colección. Aquí están, en su lugar, los cuatro parámetros que deciden de verdad, y lo que la literatura dice de cada uno.",
      blocs: [
        {
          h: "El peso, el único parámetro con un vínculo claramente establecido",
          p: [
            "Es el punto donde los datos son más nítidos. Los trabajos de Wouter Hoogkamer y su equipo mostraron que una modificación de la economía de carrera se traduce directamente en rendimiento sobre distancia — y la masa en los pies es una de las palancas más simples de esa economía.",
            "En la práctica: una zapatilla más pesada protege más pero cuesta en cada zancada, y el coste se paga tanto más cuanto más larga es la carrera. Es un arbitraje, no una regla — en terreno rompepiernas, la protección puede valer su peso.",
          ],
        },
        {
          h: "El drop: mucho discurso, pocas pruebas",
          p: [
            "El drop es la diferencia de altura entre talón y antepié. Es el argumento de marketing más extendido, y uno de los más débiles.",
            "El ensayo de Laurent Malisoux publicado en el American Journal of Sports Medicine comparó zapatillas de drops distintos en corredores populares: no puso de manifiesto un efecto del drop sobre el riesgo de lesión en el conjunto del grupo. Dicho de otro modo, no existe un drop «correcto» aplicable a todo el mundo.",
            "La consecuencia práctica es liberadora: elige el drop al que estás acostumbrado, y si quieres cambiar, hazlo progresivamente — es la transición brusca la que plantea problema, no el valor en sí.",
          ],
        },
        {
          h: "Los tacos: decide el terreno",
          p: [
            "Tacos profundos y separados muerden el barro y evacúan la tierra; son incómodos y se desgastan rápido en seco y en piedra. Tacos bajos agarran la roca y ruedan bien en tramos corribles; patinan en cuanto resbala.",
            "No existe, pues, una mejor suela, solo una mejor suela para TU terreno habitual. Un corredor de bosque arcilloso y uno de caliza seca no tienen la misma necesidad, y ningún test genérico lo dirá por ellos.",
          ],
        },
        {
          h: "La amortiguación y la protección: una cuestión de duración",
          p: [
            "Cuanto más largo es el esfuerzo, más se acumulan los impactos y más cuenta la amortiguación. En un formato corto y rápido, una zapatilla baja y precisa da mejor retorno del terreno.",
            "La placa de protección no se juzga por la comodidad sino por las piedras: en terreno pedregoso, su ausencia se paga al final de la carrera, cuando la planta del pie ya no perdona.",
          ],
        },
        {
          h: "Lo que cuenta más que todo lo demás: la horma",
          p: [
            "La mejor zapatilla sobre el papel es inútil si no le va a tu pie. La anchura del antepié, la sujeción del talón y el volumen varían enormemente de una marca a otra — a menudo más que los parámetros técnicos de los que todos hablan.",
            "El pie se hincha en un esfuerzo largo: probar al final del día, con los calcetines de carrera, y dejar margen por delante. Una zapatilla perfectamente ajustada en la tienda es una zapatilla pequeña en el kilómetro 40.",
          ],
        },
        {
          h: "La conclusión honesta",
          p: [
            "Ninguna clasificación puede decirte qué modelo comprar, porque los dos parámetros decisivos — tu terreno y tu pie — no figuran en ningún test.",
            "Lo que sí se puede hacer es seguir el desgaste. Pacevo registra el kilometraje por par: es un hecho medido, no una opinión, y vale más que una intuición para decidir cuándo un par está al final de su vida.",
          ],
        },
      ],
    },
    "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves": {
      chapo:
        "Este artículo se titulaba «los trails franceses que no te puedes perder en 2026»: una lista con fecha que sería falsa en seis meses. Aquí están, en su lugar, los criterios que deciden si una carrera te conviene — y esos no caducan.",
      blocs: [
        {
          h: "La distancia es el peor criterio",
          p: [
            "Dos carreras de 80 km no tienen casi nada en común si una tiene 1 500 m de desnivel positivo y la otra 5 000. El desnivel decide el tiempo de pie, la proporción de marcha, la exigencia de las bajadas — y es la bajada, no la subida, la que destroza los cuádriceps.",
            "Una referencia más útil que la distancia sola es la relación entre desnivel y kilómetros. A partir de cierta pendiente media ya no se corre de verdad: se camina rápido en subida y se encaja en bajada. Ni mejor ni peor, pero exige otra preparación.",
            "Segunda referencia: el tiempo límite previsto por la organización. Dice a qué público se dirige la prueba mucho mejor que el número de kilómetros.",
          ],
        },
        {
          h: "Las barreras horarias, la limitación que se descubre tarde",
          p: [
            "La mayoría de los ultras imponen horas de paso en puntos intermedios. Que te paren en un avituallamiento por diez minutos de retraso es el fracaso más frecuente — y el más evitable.",
            "Se leen antes de inscribirse, no la víspera. Compáralas con tu ritmo real en montaña, no con tu ritmo en asfalto: la diferencia entre ambos es considerable, y ahí es donde se estrellan las proyecciones optimistas.",
          ],
        },
        {
          h: "La noche lo cambia todo",
          p: [
            "En cuanto una prueba se adentra en la noche se convierte en otro ejercicio: vigilancia degradada, terreno menos legible, frío, y una gestión del sueño que no existe en un formato corto.",
            "Un primer ultra que termina antes de la noche es una progresión más razonable que un formato nocturno a igual distancia. Si la noche es inevitable, se ensaya en el entrenamiento — al menos una tirada larga con frontal.",
          ],
        },
        {
          h: "Autonomía y avituallamientos",
          p: [
            "Algunas pruebas avituallan a menudo y en abundancia; otras imponen una autonomía larga entre dos puntos, a veces de agua. El material obligatorio se deriva de ello, y pesa.",
            "Esa información está en el reglamento. Leerla es también anticipar lo que tendrás que llevar — y por tanto lo que debes haber probado en tirada larga.",
          ],
        },
        {
          h: "Los sistemas de clasificación",
          p: [
            "Varias grandes pruebas no aceptan inscripción directa. El circuito UTMB, por ejemplo, usa un índice de rendimiento calculado sobre los resultados de los corredores, y piedras de clasificación que se obtienen en carreras con sello para entrar en el sorteo de ciertas pruebas.",
            "Son dispositivos oficiales cuyas modalidades evolucionan de un año a otro. La única fuente que hace fe es la web del organizador: consultarla antes de armar un calendario de temporada evita descubrir en enero que había que empezar el año anterior.",
          ],
        },
        {
          h: "Cómo usarlo en concreto",
          p: [
            "El calendario de Pacevo recoge las pruebas próximas con su distancia, su fecha y el enlace de inscripción. Elegir una carrera como objetivo ajusta la preparación a su fecha.",
            "Pero la app no lee los reglamentos por ti. El desnivel, las barreras horarias, la autonomía y las clasificaciones se comprueban en la web del organizador — es él quien se compromete, no nosotros.",
          ],
        },
      ],
    },
    "coach-vocal-en-course-ce-que-ca-change": {
      chapo:
        "El verdadero problema de una carrera no es la velocidad: es la gestión del ritmo. Lo que cambia una voz en el oído, lo que no puede saber, y por qué sirve sobre todo cuando estás cansado.",
      blocs: [
        {
          h: "El problema al que responde",
          p: [
            "Chester Abbiss y Paul Laursen describieron las estrategias de ritmo adoptadas en competición y cómo pesan en el resultado. La conclusión general de esa literatura es constante: el reparto del esfuerzo cuenta, y salir demasiado rápido es el error más caro.",
            "El problema es que un corredor percibe mal su ritmo, y cada vez peor a medida que se cansa. La sensación de esfuerzo aumenta mientras la velocidad baja — así que en el momento exacto en que reduces, tienes la impresión de acelerar.",
          ],
        },
        {
          h: "Lo que una pantalla no resuelve",
          p: [
            "Un reloj ya muestra el ritmo. Pero leerlo exige bajar la vista, enfocar y sobre todo comparar mentalmente esa cifra con un objetivo que llevas en la cabeza — tres operaciones que se vuelven costosas en el kilómetro 30.",
            "Hay algo peor: el ritmo instantáneo oscila mucho, sobre todo en ciudad o bajo arbolado, donde la señal satelital se degrada. Un corredor que corrige en cada oscilación produce una carrera en acordeón, más agotadora que un ritmo regular.",
          ],
        },
        {
          h: "Lo que anuncia el Ghost Runner",
          p: [
            "En cada kilómetro, una voz anuncia tres cosas: el ritmo mantenido, la diferencia respecto al plan y el crono proyectado en meta si sigues así.",
            "El tercer elemento es el que cambia el comportamiento. «5:12» es una información; «a este ritmo llegas cuatro minutos por encima de tu objetivo» es una decisión. La conversión mental se hace por ti, en el momento en que menos capaz eres de hacerla.",
            "Y como es audio, no exige mirar a otro lado ni romper la zancada.",
          ],
        },
        {
          h: "Sus límites, y son reales",
          p: [
            "No conoce el terreno. Un tramo en cuesta ralentiza legítimamente el ritmo; el anuncio de una diferencia no es ahí una señal para acelerar, salvo que quieras quemar las piernas en una subida.",
            "Tampoco conoce tus piernas. Compara una velocidad con un objetivo; no sabe si el cuádriceps te tira desde hace diez minutos. El objetivo fijado en la salida puede volverse el objetivo equivocado a media carrera, y eso lo decides tú.",
            "Por último, correr con auricular supone seguir oyendo lo que te rodea. En carretera abierta, un solo oído — y en algunas pruebas los auriculares están prohibidos por reglamento.",
          ],
        },
        {
          h: "Cuándo sirve más",
          p: [
            "En esfuerzos largos a ritmo objetivo, donde la deriva es lenta y por tanto invisible desde dentro. En un primer intento a un crono dado, cuando aún no tienes la sensación calibrada. Y en el entrenamiento, para aprender a qué se parece de verdad el ritmo objetivo.",
            "En cambio, en series cortas no aporta nada: los esfuerzos son demasiado breves para que un anuncio por kilómetro llegue a existir.",
          ],
        },
      ],
    },
    "semi-en-moins-de-1h45-construire-le-plan": {
      chapo:
        "1h45 en un medio maratón es sostener 4:59 por kilómetro durante 21,1 km. Aquí está de dónde sale cada sesión de una preparación que apunta a ese crono, y por qué lo esencial del trabajo se hace a un ritmo bastante más lento.",
      blocs: [
        {
          h: "Lo que exige el crono, en aritmética",
          p: [
            "105 minutos para 21,0975 km dan 4:59 por kilómetro, algo más de 12 km/h. No es una opinión, es una división — y es la única cifra de este artículo que describe un rendimiento.",
            "La dificultad no es alcanzar ese ritmo: muchos corredores lo sostienen en 5 km. Es sostenerlo una hora cuarenta y cinco, lo que es un problema de resistencia mucho más que de velocidad.",
          ],
        },
        {
          h: "Por qué la mayoría del volumen se corre despacio",
          p: [
            "Es la parte más contraintuitiva de la preparación, y la que más se salta. Stephen Seiler describió lo que hacen realmente los atletas de resistencia de alto nivel: la gran mayoría de su volumen está a baja intensidad, y solo una pequeña fracción a intensidad alta. Lo que se llama distribución polarizada.",
            "La intuición dice lo contrario: si quiero correr rápido, corro rápido. El problema es que la intensidad cuesta recuperación. Correr todas las salidas a ritmo medianamente duro produce un corredor medianamente cansado de forma permanente, que nunca recupera lo suficiente para hacer una verdadera sesión de calidad.",
            "En la práctica, la resistencia de base debe ser francamente fácil: un ritmo en el que puedas hablar con frases enteras. Si tienes que interrumpirte para respirar, vas demasiado rápido.",
          ],
        },
        {
          h: "La sesión de umbral, el corazón del dispositivo",
          p: [
            "El umbral es el ritmo que se puede sostener alrededor de una hora en competición. Para un medio a 1h45, es lógicamente algo más rápido que el propio ritmo de carrera.",
            "Se trabaja por bloques — series largas, de varios minutos, con recuperaciones cortas — más que en continuo, lo que permite acumular tiempo a esa intensidad sin que la sesión se vuelva inmanejable.",
            "El trabajo a intensidad más alta también tiene su sitio. Los trabajos de Jan Helgerud comparando formatos de entrenamiento mostraron que los intervalos de alta intensidad mejoran el consumo máximo de oxígeno más que un trabajo continuo moderado. Pero es un condimento, no el plato.",
          ],
        },
        {
          h: "La tirada larga",
          p: [
            "Construye lo que las sesiones rápidas no construyen: la capacidad de aguantar. Se corre en resistencia, y su duración cuenta más que su distancia — es el tiempo de pie el que produce la adaptación.",
            "Una variante útil al final de la preparación consiste en terminar una parte al ritmo objetivo. Enseña a encontrar ese ritmo con las piernas ya cansadas, que es exactamente la situación del kilómetro 15.",
          ],
        },
        {
          h: "El afinamiento",
          p: [
            "Las últimas semanas reducen el volumen manteniendo toques de intensidad. El objetivo es llegar con una frescura positiva: la carga reciente baja, la condición de fondo se mantiene.",
            "El error clásico es querer recuperar el tiempo perdido. Una sesión dura a diez días de la salida no recupera nada — solo degrada la frescura que se acaba de construir.",
          ],
        },
        {
          h: "Lo que mueve el plan sobre la marcha",
          p: [
            "Un plan escrito ocho semanas antes supone que esas ocho semanas transcurrirán según lo previsto. Nunca lo hacen: una semana dura de trabajo, un resfriado, una noche en blanco, un calor inesperado.",
            "Ahí es donde la relectura diaria de los indicadores cobra sentido. En Pacevo, la sesión de calidad se desplaza o se aligera cuando la frescura y la variabilidad cardíaca lo dicen, y el calendario explica la decisión. El volumen de la semana se mueve poco; su reparto, mucho.",
          ],
        },
      ],
    },
    "body-battery-basse-faut-il-courir": {
      chapo:
        "Un indicador en mínimos por la mañana no es ni luz verde ni luz roja: es una pregunta. Aquí están los tres elementos que permiten responderla, y el único caso en que la respuesta es no sin discusión.",
      avertissement:
        "Este artículo habla de entrenamiento, no de medicina. Una fatiga que persiste varias semanas, un dolor, una falta de aire inhabitual o una frecuencia cardíaca en reposo duraderamente elevada son motivos de consulta médica, sean cuales sean las cifras que muestre un reloj.",
      blocs: [
        {
          h: "Lo que mide el indicador — y lo que no",
          p: [
            "Body Battery es un indicador propietario de Garmin. No es una medición directa: es un compuesto, calculado a partir de la variabilidad cardíaca, el nivel de estrés estimado, la actividad y el sueño. Otras marcas ofrecen equivalentes con otros nombres, construidos de otra forma.",
            "La consecuencia importa: un valor así no mide tu fatiga muscular. Refleja el estado de tu sistema nervioso autónomo tal como un algoritmo lo deduce de sensores en la muñeca. Tus piernas no tienen nada que ver.",
            "Por eso puede estar bajo mientras te encuentras bien, y correcto mientras tienes agujetas. Ambas situaciones son normales y ninguna es un error del reloj.",
          ],
        },
        {
          h: "Primera pregunta: ¿es un día o una tendencia?",
          p: [
            "Un valor aislado no dice casi nada. Estos indicadores varían mucho de un día a otro en la misma persona, y Martin Buchheit recuerda que las medidas derivadas de la frecuencia cardíaca deben leerse en su contexto y como tendencia, nunca aisladas.",
            "Una mañana baja tras una noche tardía o una sesión dura la víspera es esperable — es incluso señal de que la medición funciona. Tres o cuatro mañanas bajas seguidas sin nada que lo justifique es otro mensaje.",
          ],
        },
        {
          h: "Segunda pregunta: ¿por qué está bajo?",
          p: [
            "El algoritmo no conoce la causa. Falta de sueño, el inicio de una infección, el alcohol, una habitación demasiado caliente, el jet lag, una semana dura en el trabajo: todo produce la misma cifra baja.",
            "El sueño merece un lugar aparte. La revisión de Hugh Fullagar sobre el tema muestra que la privación de sueño afecta al rendimiento en el ejercicio y a las funciones cognitivas — y correr cansado degrada también la vigilancia, lo que cuenta en un sendero técnico o en ciudad.",
            "Si la causa es identificable y puntual, tiene tratamiento: dormir. Si no lo es, o si se parece al inicio de una enfermedad, la sesión no es la prioridad.",
          ],
        },
        {
          h: "Tercera pregunta: ¿qué sesión estaba prevista?",
          p: [
            "Es la pregunta que se olvida, y la más útil. «¿Hay que correr?» no tiene respuesta general; «¿hay que hacer ESTA sesión?» sí la tiene.",
            "Un rodaje suave de cuarenta minutos casi no exige nada al sistema nervioso, y muchos corredores se sienten mejor después que antes. Una sesión de umbral o de VO2máx, en cambio, exige estar en condiciones de encajarla — hacerla sobre un organismo ya movilizado produce una sesión mediocre Y una recuperación alargada.",
            "La buena decisión rara vez es binaria. Casi siempre consiste en mantener la salida y cambiar su intensidad, o desplazar la calidad dos días.",
          ],
        },
        {
          h: "El único caso en que es no",
          p: [
            "Fiebre, dolores musculares difusos, garganta tomada, ganglios: no se corre, sea cual sea el indicador. No es una cuestión de rendimiento sino de riesgo — un esfuerzo intenso durante una infección no es anodino.",
            "Fuera de esa situación, un indicador bajo es una invitación a aligerar, no una prohibición. Y si la duda persiste varios días, quien decide es un médico, no un reloj.",
          ],
        },
        {
          h: "Qué hace Pacevo con ello",
          p: [
            "Estos valores llegan vía intervals.icu y entran en el cálculo del plan móvil. Cuando caen en tendencia, la sesión de calidad se aligera o se aplaza, y el calendario escribe por qué.",
            "Pero la app solo tiene acceso a lo que pasa por un sensor. No sabe que estás incubando algo, ni que la semana ha sido dura en el trabajo. En eso, tu juicio va por delante del suyo.",
          ],
        },
      ],
    },
    "ia-coach-ce-quun-humain-ne-fait-pas": {
      chapo:
        "Se suele oponer el algoritmo al entrenador como si hubiera que elegir. La verdadera línea divisoria no es la inteligencia: es la frecuencia con la que cada uno mira. Esto es lo que ve cada uno, y lo que no ve ninguno de los dos.",
      blocs: [
        {
          h: "Lo que hace un entrenador y ningún programa sustituye",
          p: [
            "Un entrenador lee una cara. Oye en una frase que la separación, la mudanza o la noche en blanco pesan más que la carga de entrenamiento. Sabe que un atleta que dice «estoy bien» al terminar una sesión de umbral miente una vez de cada dos, y sabe cuál de las dos.",
            "Además tiene una visión larga. Decide que una temporada se sacrificará por la siguiente, que un objetivo es prematuro, que este importa porque te importa a ti — y que un atleta motivado encaja lo que uno resignado rechaza. Nada de eso se deduce de una serie de mediciones.",
            "Por último, ajusta en directo. Una cuesta más dura de lo previsto, un grupo que sale demasiado rápido, un gemelo que tira en el tercer kilómetro: cambia la sesión sobre la marcha, con lo que ve.",
          ],
        },
        {
          h: "Lo que hace un programa y ningún entrenador puede hacer",
          p: [
            "Mira todas las noches. No el lunes por teléfono: todas las noches, y después de cada sesión. Es la única diferencia que cuenta de verdad, y es estructural — quien sigue a treinta atletas no puede releer treinta curvas de sueño cada mañana, por bueno que sea.",
            "No se cansa y no tiene ego. No sobrevalora la sesión que él mismo prescribió, no recuerda mejor el último buen entrenamiento que los tres mediocres, y no tiene orgullo que defender cuando los datos contradicen el plan.",
            "Calcula sobre ventanas que ninguna memoria sostiene. La carga crónica se construye durante semanas; la relación entre carga reciente y carga de fondo se lee sobre un mes móvil. Son medias móviles: se calculan, no se intuyen.",
          ],
        },
        {
          h: "La línea divisoria: la frecuencia, no la inteligencia",
          p: [
            "Un entrenador observa por episodios — una sesión, una llamada, un mensaje. Un programa observa en continuo, pero solo ve lo que se mide. El primero tiene contexto y pocos puntos de medida; el segundo, muchos puntos de medida y ningún contexto.",
            "Por eso la oposición está mal planteada. La pregunta no es «quién decide mejor» sino «quién ve qué, y cada cuánto». Un plan que solo se mueve una vez por semana ignora por construcción lo que pasó el martes por la noche.",
          ],
        },
        {
          h: "Lo que cambia en una semana real",
          p: [
            "Tomemos una semana corriente. Martes, sesión de umbral tal como estaba prevista. Miércoles, noche corta y variabilidad cardíaca claramente por debajo de lo normal. Jueves, había una sesión de calidad programada.",
            "Sin relectura diaria, el jueves se mantiene: se escribió el domingo. Con relectura diaria, se aligera y la calidad se traslada al sábado, cuando los indicadores han vuelto. El volumen de la semana casi no cambia; su reparto sí — y es el reparto el que decide el desgaste.",
            "Esta lógica — pilotar la progresión de la carga en vez de su cantidad bruta — está en el centro del trabajo de Tim Gabbett sobre la paradoja entre entrenamiento y lesión: a menudo son las subidas rápidas de carga, más que la carga alta en sí, las que exponen al atleta.",
          ],
        },
        {
          h: "El límite, y hay que decirlo",
          p: [
            "Un programa decide a partir de lo que mide. Lo que no mide no existe para él: un dolor que empieza, un duelo, una carga mental en el trabajo, una zapatilla al final de su vida. Nunca los verá, y ninguna versión futura los verá mientras no pasen por un sensor.",
            "Los propios indicadores exigen prudencia. Martin Buchheit mostró que las medidas derivadas de la frecuencia cardíaca no cuentan todas la misma historia según el contexto, el momento y el tipo de esfuerzo: un valor aislado no significa nada, es la tendencia la que informa.",
            "La conclusión honesta no es, por tanto, «el algoritmo sustituye». Es: mira cada día lo que un humano solo puede mirar de vez en cuando, y no entiende nada de lo que un humano capta de un vistazo. El corredor que progresa es el que da a cada uno lo que sabe hacer.",
          ],
        },
      ],
    },
    "vfc-et-charge-voir-la-fatigue-arriver": {
      chapo:
        "Tres curvas y una medición matinal. Lo que dice cada una, lo que no dice, y por qué es su cruce — nunca un valor aislado — lo que permite aligerar antes de que algo se rompa.",
      blocs: [
        {
          h: "Las tres curvas: qué significan CTL, ATL y TSB",
          p: [
            "El modelo que usan la mayoría de plataformas de entrenamiento desciende de los trabajos de Eric Banister sobre la respuesta a la carga. Se resume en tres números, todos derivados de la misma serie de sesiones.",
            "La carga crónica, a menudo escrita CTL, es una media móvil larga — del orden de seis semanas. Es tu condición de fondo: sube despacio, baja despacio, y representa lo que tu cuerpo está acostumbrado a encajar.",
            "La carga aguda, ATL, es lo mismo sobre una ventana corta, del orden de la semana. Es tu fatiga reciente: sube rápido tras una sesión dura y baja rápido con el descanso.",
            "La frescura, TSB, es simplemente la diferencia entre ambas. Negativa, estás encajando más de lo habitual. Positiva, estás descansado — y eso es lo que se busca el día de la carrera, no durante la preparación.",
          ],
        },
        {
          h: "La variabilidad cardíaca: qué mide realmente",
          p: [
            "La variabilidad de la frecuencia cardíaca, o VFC, no mide la fatiga. Mide el intervalo entre latidos sucesivos, que refleja el equilibrio entre las dos ramas del sistema nervioso autónomo. Una VFC baja indica que tu organismo está movilizado; no dice por qué.",
            "Esa distinción lo cambia todo en la práctica. Una noche con alcohol, el inicio de un resfriado, una habitación demasiado caliente, el jet lag o un disgusto hacen bajar la VFC exactamente igual que un entrenamiento demasiado duro. La medición es cierta; la interpretación «estoy sobreentrenado» no.",
            "Segunda precaución: un valor aislado no vale nada. La VFC varía mucho de un día a otro en la misma persona. Lo que informa es la diferencia respecto a TU base — la media de tus últimos días — y la dirección de la tendencia. Buchheit insiste en ello: los indicadores derivados de la frecuencia cardíaca deben leerse en contexto, no aislados.",
          ],
        },
        {
          h: "Por qué hay que cruzar ambos",
          p: [
            "Por separado, las dos familias de indicadores se equivocan de forma previsible.",
            "La carga sola no sabe nada de tu vida. Ve que has corrido tres veces esta semana; ignora que has dormido cinco horas por noche. Seguirá prescribiendo como si todo fuera bien.",
            "La VFC sola no sabe nada de tu entrenamiento. Ve un indicador bajo; no puede distinguir una semana dura asumida — donde una frescura negativa es normal y deseada — de una deriva hacia el agotamiento.",
            "Cruzadas, se corrigen. Frescura negativa con VFC estable es carga aceptada: el plan continúa. Frescura negativa con VFC que cae varios días seguidos es una señal de alerta: se aligera. Una VFC baja con carga escasa probablemente no tiene nada que ver con correr.",
          ],
        },
        {
          h: "Qué hace Pacevo con ello, en concreto",
          p: [
            "Estos indicadores llegan desde tu reloj vía intervals.icu — sueño, VFC, frecuencia cardíaca en reposo, la carga de cada sesión. Pacevo los relee tras cada sincronización y reescribe el plan móvil de siete días cuando cambian.",
            "Aligerar no significa suprimir la semana. En la práctica, desplaza la sesión de calidad, acorta su parte intensa o sustituye una salida por un rodaje suave — el volumen se mueve poco, la intensidad mucho.",
            "Y el calendario escribe POR QUÉ. Es el punto que más cuenta en el uso diario: un plan que no se entiende se esquiva. Un plan que dice «tu variabilidad lleva tres días por debajo de tu base, la sesión de umbral pasa al sábado» se respeta.",
          ],
        },
        {
          h: "Lo que no hace",
          p: [
            "No predice una lesión. La progresión de la carga es un factor entre otros — la biomecánica, el terreno, el material, el historial de lesiones y el sueño también cuentan, y nada de eso cabe en tres curvas.",
            "No sustituye tu juicio. Un dolor que se instala, una molestia que cambia tu zancada, una fatiga que persiste pese a indicadores normales: son motivos para parar, diga lo que diga un panel. Un modelo siempre tiene razón sobre lo que mide y se equivoca sobre todo lo demás.",
          ],
        },
      ],
    },
  },
  pt: {
    "deficit-energetique-relatif-reds-coureur": {
      chapo:
        "O tema mais importante deste blogue, e o menos contado. Quando o que comes deixa de cobrir o que gastas, não é o desempenho que cai primeiro — é o osso, a hormona e a imunidade.",
      avertissement:
        "Este artigo descreve uma síndrome médica reconhecida. Não é uma ferramenta de diagnóstico nem substitui uma consulta. Se te reconheces em vários dos sinais descritos, fala com um médico ou um nutricionista do desporto — e se a relação com a alimentação for fonte de sofrimento, com um profissional de saúde mental.",
      blocs: [
        {
          h: "Do que estamos a falar",
          p: [
            "O Comité Olímpico Internacional publica desde 2014 um consenso sobre o que hoje chama REDs — Relative Energy Deficiency in Sport. A versão de 2023 é a referência atual, e é explícita: o problema não é o peso, é a DISPONIBILIDADE ENERGÉTICA.",
            "A disponibilidade energética é o que resta ao organismo para viver depois de pago o treino. Um corredor pode comer muito e estar em défice se treinar mais; outro pode comer pouco e estar bem se correr pouco. O número na balança nada diz sobre isso.",
            "É por isso que a síndrome atinge também homens, e atletas de peso perfeitamente comum. A imagem do corredor esquelético é uma imagem, não um critério.",
          ],
        },
        {
          h: "O que danifica, por esta ordem",
          p: [
            "O corpo não para de uma vez: desliga funções por ordem de prioridade, e o desempenho não é o primeiro a ser sacrificado. O consenso do COI descreve um comprometimento de múltiplos sistemas.",
            "O osso primeiro, e é o mais caro: a densidade mineral degrada-se e surgem as fraturas de fadiga. Fraturas de fadiga repetidas num corredor de resto sério devem levantar a questão do aporte, e não apenas a do volume.",
            "As hormonas a seguir. Na mulher, a amenorreia — a ausência de menstruação — é o sinal mais visível, e nunca é normal numa desportista. No homem, a queda de testosterona é mais silenciosa mas igualmente real.",
            "Depois a imunidade, o sono, o humor, a capacidade de recuperar. Nessa fase o atleta treina na mesma e progride cada vez menos — e a sua conclusão habitual é que não faz o suficiente.",
          ],
        },
        {
          h: "Os sinais que devem alertar",
          p: [
            "Estagnação ou regressão apesar do treino mantido. Lesões ósseas repetidas. Friorento de forma invulgar. Sono que se degrada sem causa. Libido em baixa. Na mulher, menstruações irregulares ou ausentes.",
            "Nenhum destes sinais prova o que quer que seja isoladamente — todos têm outras causas possíveis. É a sua ACUMULAÇÃO em alguém que treina muito e come pouco que deve levar a consultar.",
            "Uma armadilha frequente: a variabilidade cardíaca e a frequência cardíaca em repouso podem manter-se corretas durante muito tempo. Um relógio não deteta esta síndrome, e a ausência de alerta num painel não é luz verde.",
          ],
        },
        {
          h: "O caso particular da perda de peso desejada",
          p: [
            "Querer perder peso a correr é legítimo, e muitos fazem-no sem problema. O risco não vem da intenção mas do RITMO: é um défice demasiado grande, mantido demasiado tempo, ao mesmo tempo que a carga de treino sobe, que descamba em REDs.",
            "Daí duas regras simples. Um défice abre-se devagar, e nunca durante um bloco duro nem mesmo antes de uma prova. E existe um patamar abaixo do qual perder mais nada traz ao desempenho e custa saúde.",
          ],
        },
        {
          h: "O que o Pacevo faz deste tema",
          p: [
            "O modo perda de peso da app está construído sobre esta lógica e não sobre a mera velocidade de perda. O défice diário é limitado, a perda pretendida é balizada em percentagem de peso por semana, e o cálculo para num patamar — abaixo de um índice de massa corporal de 21 é imposta a manutenção.",
            "O acompanhamento do peso, o do dispêndio e o das proteínas estão separados do défice em si, para que alguém se possa pesar sem que isso desencadeie mecanicamente uma restrição.",
            "Nada disto substitui um profissional. O que o software pode fazer é recusar propor o que seria pouco razoável — e já é muito, porque o primeiro reflexo de um corredor frustrado é fazer mais e comer menos.",
          ],
        },
      ],
    },
    "renforcement-courir-plus-vite-sans-courir": {
      chapo:
        "É uma das ligações mais bem estabelecidas da literatura de resistência, e é a sessão que quase toda a gente salta. O que melhora, o que não melhora, e como é para um corredor.",
      blocs: [
        {
          h: "O que diz a revisão de referência",
          p: [
            "A revisão sistemática de Richard Blagrove publicada na Sports Med em 2018 examinou o efeito do treino de força sobre os determinantes fisiológicos do desempenho no meio-fundo e no fundo. A conclusão é nítida: o trabalho de força melhora a economia de corrida sem degradar o consumo máximo de oxigénio.",
            "A economia de corrida é o custo energético de um dado ritmo. Dois corredores com o mesmo VO2máx não fazem o mesmo tempo se um gastar menos para ir à mesma velocidade. É uma alavanca de desempenho por direito próprio, e mais acessível do que o VO2máx quando já se tem alguns anos de treino.",
            "Segundo efeito, menos visível: a força atua na tolerância às cargas repetidas. Quem encaixa melhor treina com mais regularidade, e a regularidade faz mais pela progressão do que qualquer sessão isolada.",
          ],
        },
        {
          h: "O que não é",
          p: [
            "Não é musculação estética, e o receio de «ganhar volume» não tem fundamento: as cargas pesadas com poucas repetições desenvolvem sobretudo o comando nervoso.",
            "Também não substitui correr. A força acrescenta-se a um plano de corrida, não o substitui — e muito menos substitui o trote leve.",
            "Por fim, não é garantia contra a lesão. A progressão da carga, o sono, o histórico e o terreno também contam. A força é um fator entre outros, apenas um dos mais fáceis de acrescentar.",
          ],
        },
        {
          h: "Como é em concreto",
          p: [
            "Uma ou duas sessões por semana bastam, e são curtas. O essencial cabe em poucos movimentos de cadeia posterior e apoios: agachamento, afundo, peso morto romeno, subida ao caixote e trabalho unilateral — correr é um exercício sobre uma perna de cada vez.",
            "Duas regras de colocação evitam a maioria dos problemas. Não colocar uma sessão de força pesada na véspera de uma sessão de qualidade. E colocá-la antes DEPOIS de uma corrida no dia do que antes, para não correr com as pernas já vazias.",
            "Em períodos de carga elevada a sessão mantém-se mas alivia. Suprimi-la por completo nas oito semanas mais duras é perder a adaptação exatamente quando ela mais protege.",
          ],
        },
        {
          h: "O caso do trail",
          p: [
            "Na descida, o músculo trava enquanto se alonga — um modo de contração particularmente traumático, e é ele que produz os quadríceps de madeira no dia seguinte.",
            "É um caso em que a força se especifica: trabalho excêntrico e, sobretudo, descidas no treino. Nenhum ginásio substitui ter descido, várias vezes, o que a prova te vai pedir para descer.",
          ],
        },
        {
          h: "Onde está na app",
          p: [
            "O Pacevo integra a força no programa em vez de a deixar de lado: o guia de reforço é acessível a partir do espaço de treino, e o contexto do treinador prevê uma a duas sessões por semana ao construir o plano.",
            "A sessão de força não é enviada para o relógio — o relógio recebe as sessões de corrida. É um limite da cadeia de sincronização, não um esquecimento.",
          ],
        },
      ],
    },
    "cycle-menstruel-et-entrainement-ce-que-dit-la-meta-analyse": {
      chapo:
        "Muitas apps vendem uma periodização assente no ciclo. A meta-análise de referência é bastante mais prudente do que esse discurso, e essa prudência é, em si, a informação mais útil.",
      avertissement:
        "Este artigo resume literatura científica geral. Menstruações ausentes, muito dolorosas ou muito abundantes não são um assunto de treino mas médico.",
      blocs: [
        {
          h: "O que a meta-análise encontrou",
          p: [
            "Kelly McNulty e a sua equipa publicaram em 2020 na Sports Med uma revisão sistemática com meta-análise sobre o efeito da fase do ciclo menstrual no desempenho em mulheres eumenorreicas — ou seja, com ciclo regular e sem contraceção hormonal.",
            "A conclusão tem duas partes, e a segunda pesa tanto como a primeira. Existe um efeito da fase do ciclo no desempenho, mas é de PEQUENA amplitude. E a qualidade dos estudos disponíveis é globalmente baixa, o que impõe prudência na interpretação.",
            "Sobretudo, a variabilidade entre pessoas é considerável. O que o ciclo faz a uma atleta não prevê o que faz a outra, e é por isso que uma regra geral do tipo «carregar na fase folicular, aliviar na lútea» falha muitas vezes.",
          ],
        },
        {
          h: "Porque uma periodização rígida falha",
          p: [
            "Uma periodização assente no calendário pressupõe duas coisas: que o teu ciclo é regular e que a tua resposta se parece com a média. Ambas as hipóteses são frágeis, e a segunda é contrariada pela variabilidade observada.",
            "Tem também um custo: prescindir por princípio de uma sessão de qualidade durante parte de cada mês retira uma parcela nada desprezável do trabalho intenso do ano. Com base num efeito que a literatura classifica de pequeno, é uma má troca.",
            "Acresce que muitas mulheres usam contraceção hormonal, o que muda o quadro — a meta-análise citada refere-se especificamente a mulheres sem contraceção hormonal, e uma revisão distinta debruçou-se sobre os contracetivos orais.",
          ],
        },
        {
          h: "O que funciona melhor: observar em vez de presumir",
          p: [
            "A abordagem defensável é individual. Regista, ciclo após ciclo, onde caem as sessões que correm mal, as sensações de pernas pesadas, o sono e o apetite. Ao fim de alguns meses aparece um padrão — ou não aparece, e isso também é uma resposta.",
            "Se aparecer, o ajuste faz-se sobre O TEU padrão, não sobre uma média populacional. E incide muitas vezes menos em anular uma sessão do que em deslocá-la quarenta e oito horas.",
            "Dois pontos práticos ficam fora do debate sobre desempenho e merecem tratamento próprio: o ferro, cujas necessidades aumentam com as perdas menstruais, e os sintomas dolorosos, que são um assunto médico e não um plano de treino.",
          ],
        },
        {
          h: "A ligação com os REDs",
          p: [
            "Um ponto não é uma nuance mas um alarme: a ausência de menstruação numa desportista nunca é normal. É um dos sinais mais visíveis do défice energético relativo descrito pelo consenso do COI.",
            "O atalho «treino muito, é por isso» é comum e falso. Um ciclo que desaparece é um sinal a levar a um médico, não uma adaptação ao treino.",
          ],
        },
        {
          h: "O que o Pacevo propõe, e o que não faz",
          p: [
            "A app permite ativar um acompanhamento do ciclo: a fase entra então no contexto do treinador tal como o sono, a variabilidade cardíaca ou a carga, e pesa na distribuição da intensidade.",
            "Está desativado por omissão, e é deliberado. É um dado de saúde íntimo, e nada justifica recolhê-lo de alguém que não o pediu explicitamente.",
            "O que a app não faz: decidir por ti que uma fase é má. Cruza a informação com o resto, e o calendário explica a sua decisão — o que te deixa a possibilidade de a contrariar, e é esse o objetivo.",
          ],
        },
      ],
    },
    "ravitaillement-marathon-quoi-quand-combien": {
      chapo:
        "As recomendações de hidratos durante o esforço são objeto de um consenso bastante estável na literatura. Eis o que diz, de onde vêm os números, e porque o ponto mais importante não é a quantidade mas o treino do teu intestino.",
      avertissement:
        "Este artigo resume recomendações gerais provenientes de publicações científicas. Não substitui o parecer de um médico ou de um nutricionista, em particular em caso de perturbação digestiva, diabetes, gravidez ou tratamento em curso.",
      blocs: [
        {
          h: "Porque o tema existe",
          p: [
            "O corpo armazena uma quantidade limitada de glicogénio — no fígado e nos músculos. Num esforço de resistência prolongado, essa reserva torna-se o fator limitante muito antes dos próprios músculos. É a causa fisiológica daquilo a que os corredores chamam o muro.",
            "Ingerir hidratos durante o esforço não serve para «ter energia» num sentido vago: serve para poupar uma reserva que não se pode aumentar no dia da prova.",
          ],
        },
        {
          h: "Quanto: o que diz o consenso",
          p: [
            "A síntese de Asker Jeukendrup publicada na Sports Med em 2014 propõe uma escala consoante a duração do esforço, em vez de um número único. Cerca de 30 a 60 gramas de hidratos por hora para um esforço de uma a duas horas e meia; até cerca de 90 gramas por hora acima disso, mas com uma condição precisa, desenvolvida logo abaixo.",
            "A tomada de posição conjunta do American College of Sports Medicine sobre nutrição e desempenho, publicada no mesmo ano, vai no mesmo sentido e situa estes aportes na alimentação geral do atleta.",
            "Estes intervalos são amplos de propósito. O peso, o ritmo, o calor e a tolerância individual deslocam o cursor, e a diferença entre dois corredores do mesmo nível é considerável.",
          ],
        },
        {
          h: "A condição que toda a gente esquece: dois açúcares, não um",
          p: [
            "A glicose atravessa a parede intestinal por um transportador que satura — é isso que limita a absorção por volta dos 60 gramas por hora. A frutose usa um transportador diferente, que não satura ao mesmo tempo.",
            "É por isso que os aportes elevados assentam numa mistura de glicose e frutose. Procurar 90 gramas por hora só com glicose não os fará passar: o excedente fica no intestino, e é aí que nascem os problemas digestivos que arruínam um final de prova.",
            "Em concreto, isto significa ler o rótulo. Um produto que anuncia uma proporção de dois para um entre glicose e frutose foi concebido para isso; outro não.",
          ],
        },
        {
          h: "Quando: a prova começa antes da partida",
          p: [
            "Nos dias anteriores, o objetivo é partir com as reservas cheias, o que passa por uma alimentação rica em hidratos e um volume de treino reduzido — o afinamento conta aqui tanto como o prato.",
            "De manhã, uma refeição digerível algumas horas antes da partida, feita do que já testaste. Não é o dia para estrear um pão novo.",
            "Durante, a regra mais útil é começar cedo e fracionar. Esperar até ter fome já é tarde: o esvaziamento gástrico leva tempo, e recuperar numa única toma maciça é exatamente o que o intestino recusa.",
          ],
        },
        {
          h: "Beber: à sede, e pensar no sódio",
          p: [
            "A recomendação de inundar o organismo foi abandonada. Beber à sede continua a ser a referência mais segura para a maioria, e beber demasiada água pura num esforço longo expõe a um perigo real — a hiponatremia, uma diluição do sódio sanguíneo.",
            "Com calor forte ou quando transpiras muito, o aporte de sódio conta tanto como o volume de bebida. A maioria das bebidas desportivas contém-no; a água simples não.",
          ],
        },
        {
          h: "O ponto mais importante: treinar o intestino",
          p: [
            "O intestino adapta-se ao que lhe é pedido com regularidade. Um corredor que nunca se alimenta no treino e absorve 90 gramas por hora no dia da prova expõe o estômago a uma carga inédita no pior momento.",
            "A consequência prática é simples, e a que menos se segue: as tiradas longas são o lugar onde se testa o abastecimento. Mesmos produtos, mesmas quantidades, mesmos intervalos que no dia da prova. O plano de nutrição ensaia-se no treino, exatamente como o ritmo.",
          ],
        },
        {
          h: "Depois",
          p: [
            "A reposição do glicogénio é mais rápida nas horas seguintes ao esforço, o que importa quando se encadeiam provas, muito menos quando a seguinte é daqui a três semanas.",
            "Para uma prova objetivo, o verdadeiro tema do depois não é a janela metabólica: é deixar a carga descer antes de recomeçar.",
          ],
        },
      ],
    },
    "chaussure-de-trail-ce-qui-compte-avant-la-marque": {
      chapo:
        "Este artigo anunciava uma «comparação segundo a tua passada»: teria sido preciso pontuar modelos concretos, com critérios que não medimos, e a classificação estaria desatualizada à saída da coleção seguinte. Eis, em vez disso, os quatro parâmetros que decidem mesmo, e o que a literatura diz de cada um.",
      blocs: [
        {
          h: "O peso, o único parâmetro com uma ligação claramente estabelecida",
          p: [
            "É o ponto em que os dados são mais nítidos. Os trabalhos de Wouter Hoogkamer e da sua equipa mostraram que uma alteração da economia de corrida se traduz diretamente em desempenho na distância — e a massa aos pés é uma das alavancas mais simples dessa economia.",
            "Na prática: uma sapatilha mais pesada protege mais mas custa a cada passada, e o custo paga-se tanto mais quanto mais longa for a prova. É um compromisso, não uma regra — em terreno partido, a proteção pode valer o seu peso.",
          ],
        },
        {
          h: "O drop: muito discurso, poucas provas",
          p: [
            "O drop é a diferença de altura entre calcanhar e antepé. É o argumento de marketing mais difundido, e um dos mais fracos.",
            "O ensaio de Laurent Malisoux publicado no American Journal of Sports Medicine comparou sapatilhas de drops diferentes em corredores amadores: não evidenciou um efeito do drop no risco de lesão no conjunto do grupo. Por outras palavras, não existe um drop «correto» aplicável a toda a gente.",
            "A consequência prática é libertadora: escolhe o drop a que estás habituado, e se quiseres mudar, fá-lo progressivamente — é a transição brusca que cria problema, não o valor em si.",
          ],
        },
        {
          h: "Os pitons: é o terreno que decide",
          p: [
            "Pitons profundos e espaçados mordem a lama e libertam a terra; são desconfortáveis e gastam-se depressa no seco e na pedra. Pitons baixos agarram a rocha e rolam bem nos troços corríveis; escorregam assim que fica escorregadio.",
            "Não existe, pois, melhor sola, apenas melhor sola para O TEU terreno habitual. Quem corre em floresta argilosa e quem corre em calcário seco não têm a mesma necessidade, e nenhum teste genérico o dirá por eles.",
          ],
        },
        {
          h: "O amortecimento e a proteção: uma questão de duração",
          p: [
            "Quanto mais longo é o esforço, mais os impactos se acumulam e mais o amortecimento conta. Num formato curto e rápido, uma sapatilha baixa e precisa dá melhor retorno do terreno.",
            "A placa de proteção não se julga pelo conforto mas pelas pedras: em terreno pedregoso, a sua ausência paga-se no fim da prova, quando a planta do pé deixa de perdoar.",
          ],
        },
        {
          h: "O que conta mais do que tudo o resto: a forma",
          p: [
            "A melhor sapatilha no papel é inútil se não servir ao teu pé. A largura do antepé, a fixação do calcanhar e o volume variam enormemente de marca para marca — muitas vezes mais do que os parâmetros técnicos de que toda a gente fala.",
            "O pé incha num esforço longo: experimentar ao fim do dia, com as meias de prova, e deixar folga à frente. Uma sapatilha perfeitamente ajustada na loja é uma sapatilha pequena ao quilómetro 40.",
          ],
        },
        {
          h: "A conclusão honesta",
          p: [
            "Nenhuma classificação te pode dizer que modelo levar, porque os dois parâmetros decisivos — o teu terreno e o teu pé — não constam de nenhum teste.",
            "O que se pode fazer, isso sim, é acompanhar o desgaste. O Pacevo regista a quilometragem por par: é um facto medido, não uma opinião, e vale mais do que uma intuição para decidir quando um par chegou ao fim.",
          ],
        },
      ],
    },
    "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves": {
      chapo:
        "Este artigo chamava-se «os trails franceses a não perder em 2026»: uma lista datada que estaria errada dentro de seis meses. Eis, em vez disso, os critérios que decidem se uma prova te serve — e esses não ficam desatualizados.",
      blocs: [
        {
          h: "A distância é o pior critério",
          p: [
            "Duas provas de 80 km quase nada têm em comum se uma tiver 1 500 m de desnível positivo e a outra 5 000. O desnível decide o tempo em pé, a parte de marcha, a exigência das descidas — e é a descida, não a subida, que destrói os quadríceps.",
            "Uma referência mais útil do que a distância isolada é a relação entre desnível e quilómetros. A partir de certa inclinação média já não se corre verdadeiramente: caminha-se depressa a subir e encaixa-se a descer. Nem melhor nem pior, mas exige outra preparação.",
            "Segunda referência: o tempo limite previsto pela organização. Diz a que público se dirige a prova muito melhor do que o número de quilómetros.",
          ],
        },
        {
          h: "As barreiras horárias, a restrição que se descobre tarde",
          p: [
            "A maioria dos ultras impõe horas de passagem em pontos intermédios. Ser travado num abastecimento por dez minutos de atraso é o insucesso mais frequente — e o mais evitável.",
            "Leem-se antes da inscrição, não na véspera. Compara-as com o teu ritmo real em montanha, não com o teu ritmo em estrada: a diferença é considerável, e é aí que as projeções otimistas se desfazem.",
          ],
        },
        {
          h: "A noite muda tudo",
          p: [
            "Assim que uma prova entra pela noite torna-se um exercício diferente: vigilância degradada, terreno menos legível, frio, e uma gestão do sono que não existe num formato curto.",
            "Um primeiro ultra que termina antes da noite é uma progressão mais razoável do que um formato noturno à mesma distância. Se a noite é inevitável, ensaia-se no treino — pelo menos uma tirada longa com frontal.",
          ],
        },
        {
          h: "Autonomia e abastecimentos",
          p: [
            "Algumas provas abastecem com frequência e fartura; outras impõem longa autonomia entre dois pontos, por vezes de água. O material obrigatório decorre daí, e pesa.",
            "Essa informação está no regulamento. Lê-la é também antecipar o que vais transportar — e portanto o que deves ter testado em tirada longa.",
          ],
        },
        {
          h: "Os sistemas de qualificação",
          p: [
            "Várias grandes provas não aceitam inscrição direta. O circuito UTMB, por exemplo, usa um índice de desempenho calculado sobre os resultados dos corredores, e pedras de qualificação obtidas em provas certificadas para entrar no sorteio de certas provas.",
            "São dispositivos oficiais cujas modalidades evoluem de ano para ano. A única fonte que faz fé é o site do organizador: consultá-lo antes de montar um calendário de época evita descobrir em janeiro que era preciso ter começado no ano anterior.",
          ],
        },
        {
          h: "Como usar isto em concreto",
          p: [
            "O calendário do Pacevo reúne as provas futuras com a sua distância, data e ligação de inscrição. Escolher uma prova como objetivo alinha a preparação pela sua data.",
            "Mas a app não lê os regulamentos por ti. O desnível, as barreiras horárias, a autonomia e as qualificações verificam-se no site do organizador — é ele que se compromete, não nós.",
          ],
        },
      ],
    },
    "coach-vocal-en-course-ce-que-ca-change": {
      chapo:
        "O verdadeiro problema de uma prova não é a velocidade: é a gestão do ritmo. O que muda uma voz no ouvido, o que ela não pode saber, e porque serve sobretudo quando estás cansado.",
      blocs: [
        {
          h: "O problema que resolve",
          p: [
            "Chester Abbiss e Paul Laursen descreveram as estratégias de ritmo adotadas em competição e como pesam no resultado. A conclusão geral dessa literatura é constante: a repartição do esforço conta, e partir depressa demais é o erro mais caro.",
            "O problema é que um corredor percebe mal o seu ritmo, e cada vez pior à medida que se cansa. A sensação de esforço aumenta enquanto a velocidade baixa — ou seja, no momento exato em que abrandas, tens a impressão de acelerar.",
          ],
        },
        {
          h: "O que um ecrã não resolve",
          p: [
            "Um relógio já mostra o ritmo. Mas lê-lo exige baixar os olhos, focar e sobretudo comparar mentalmente esse número com um objetivo que guardas na cabeça — três operações que se tornam caras ao quilómetro 30.",
            "Pior ainda: o ritmo instantâneo oscila muito, sobretudo na cidade ou sob copado, onde o sinal de satélite se degrada. Quem corrige a cada oscilação faz uma prova em acordeão, mais cansativa do que um ritmo regular.",
          ],
        },
        {
          h: "O que o Ghost Runner anuncia",
          p: [
            "A cada quilómetro, uma voz anuncia três coisas: o ritmo mantido, o desvio ao plano e o tempo projetado na meta se continuares assim.",
            "O terceiro elemento é o que muda o comportamento. «5:12» é uma informação; «a este ritmo chegas quatro minutos acima do teu objetivo» é uma decisão. A conversão mental é feita por ti, no momento em que menos capaz és de a fazer.",
            "E porque é áudio, não exige olhar para o lado nem partir a passada.",
          ],
        },
        {
          h: "Os seus limites, e são reais",
          p: [
            "Não conhece o terreno. Um troço a subir abranda legitimamente o ritmo; o anúncio de um desvio não é aí um sinal para acelerar, a não ser que queiras queimar as pernas numa subida.",
            "Também não conhece as tuas pernas. Compara uma velocidade com um objetivo; não sabe se o teu quadríceps puxa há dez minutos. O objetivo fixado à partida pode tornar-se o objetivo errado a meio da prova, e isso decides tu.",
            "Por fim, correr com auricular pressupõe continuar a ouvir o que te rodeia. Em estrada aberta, um só ouvido — e em algumas provas os auriculares são proibidos pelo regulamento.",
          ],
        },
        {
          h: "Quando serve mais",
          p: [
            "Em esforços longos a ritmo alvo, onde a deriva é lenta e portanto invisível por dentro. Numa primeira tentativa a um tempo dado, quando ainda não tens a sensação calibrada. E no treino, para aprender como é realmente o ritmo alvo.",
            "Em séries curtas, pelo contrário, não acrescenta nada: os esforços são demasiado breves para que um anúncio ao quilómetro chegue a existir.",
          ],
        },
      ],
    },
    "semi-en-moins-de-1h45-construire-le-plan": {
      chapo:
        "1h45 numa meia maratona é sustentar 4:59 por quilómetro durante 21,1 km. Eis de onde vem cada sessão de uma preparação com esse objetivo, e porque o essencial do trabalho se faz a um ritmo bem mais lento.",
      blocs: [
        {
          h: "O que o tempo exige, em aritmética",
          p: [
            "105 minutos para 21,0975 km dão 4:59 por quilómetro, pouco mais de 12 km/h. Não é uma opinião, é uma divisão — e é o único número deste artigo que descreve um desempenho.",
            "A dificuldade não é atingir esse ritmo: muitos corredores sustentam-no em 5 km. É sustentá-lo uma hora e quarenta e cinco, o que é um problema de resistência muito mais do que de velocidade.",
          ],
        },
        {
          h: "Porque a maioria do volume se corre devagar",
          p: [
            "É a parte mais contraintuitiva da preparação, e a que mais se salta. Stephen Seiler descreveu o que fazem realmente os atletas de resistência de alto nível: a grande maioria do seu volume situa-se em baixa intensidade, e apenas uma pequena fração em intensidade elevada. A chamada distribuição polarizada.",
            "A intuição diz o contrário: se quero correr rápido, corro rápido. O problema é que a intensidade custa recuperação. Correr todas as saídas a ritmo medianamente duro produz um corredor permanentemente meio cansado, que nunca recupera o suficiente para fazer uma verdadeira sessão de qualidade.",
            "Na prática, a resistência de base tem de ser francamente fácil: um ritmo em que consigas falar por frases inteiras. Se tens de interromper para respirar, vais depressa demais.",
          ],
        },
        {
          h: "A sessão de limiar, o coração do dispositivo",
          p: [
            "O limiar é o ritmo que se consegue sustentar cerca de uma hora em prova. Para uma meia em 1h45, é logicamente um pouco mais rápido do que o próprio ritmo de prova.",
            "Trabalha-se por blocos — frações longas, de vários minutos, com recuperações curtas — em vez de contínuo, o que permite acumular tempo nessa intensidade sem que a sessão se torne ingerível.",
            "O trabalho em intensidade mais elevada também tem lugar. Os trabalhos de Jan Helgerud comparando formatos de treino mostraram que os intervalos de alta intensidade melhoram o consumo máximo de oxigénio mais do que um trabalho contínuo moderado. Mas é um tempero, não o prato.",
          ],
        },
        {
          h: "A tirada longa",
          p: [
            "Constrói o que as sessões rápidas não constroem: a capacidade de aguentar. Corre-se em resistência, e a sua duração conta mais do que a distância — é o tempo em pé que produz a adaptação.",
            "Uma variante útil no fim da preparação é terminar uma parte ao ritmo alvo. Ensina a encontrar esse ritmo com as pernas já cansadas, que é exatamente a situação do quilómetro 15.",
          ],
        },
        {
          h: "O afinamento",
          p: [
            "As últimas semanas reduzem o volume mantendo toques de intensidade. O objetivo é chegar com frescura positiva: a carga recente desce, a condição de fundo mantém-se.",
            "O erro clássico é querer recuperar o atraso. Uma sessão dura a dez dias da partida não recupera nada — só degrada a frescura que se acabou de construir.",
          ],
        },
        {
          h: "O que mexe no plano pelo caminho",
          p: [
            "Um plano escrito oito semanas antes pressupõe que essas oito semanas decorrerão como previsto. Nunca decorrem: uma semana dura de trabalho, uma constipação, uma noite em claro, um calor inesperado.",
            "É aí que a releitura diária dos indicadores ganha sentido. No Pacevo, a sessão de qualidade desloca-se ou alivia-se quando a frescura e a variabilidade cardíaca o dizem, e o calendário explica a decisão. O volume da semana mexe pouco; a sua repartição, muito.",
          ],
        },
      ],
    },
    "body-battery-basse-faut-il-courir": {
      chapo:
        "Um indicador no mínimo de manhã não é luz verde nem vermelha: é uma pergunta. Eis os três elementos que permitem respondê-la, e o único caso em que a resposta é não sem discussão.",
      avertissement:
        "Este artigo fala de treino, não de medicina. Uma fadiga que persiste várias semanas, uma dor, uma falta de ar invulgar ou uma frequência cardíaca em repouso duradouramente elevada são motivos de consulta médica, sejam quais forem os números de um relógio.",
      blocs: [
        {
          h: "O que o indicador mede — e o que não mede",
          p: [
            "Body Battery é um indicador proprietário da Garmin. Não é uma medição direta: é um compósito, calculado a partir da variabilidade cardíaca, do nível de stress estimado, da atividade e do sono. Outras marcas propõem equivalentes com outros nomes, construídos de forma diferente.",
            "A consequência é importante: um valor destes não mede a tua fadiga muscular. Reflete o estado do teu sistema nervoso autónomo tal como um algoritmo o deduz de sensores no pulso. As tuas pernas não têm nada a ver.",
            "Por isso pode estar baixo quando te sentes bem, e correto quando tens dores musculares. As duas situações são normais e nenhuma é um erro do relógio.",
          ],
        },
        {
          h: "Primeira pergunta: é um dia ou uma tendência?",
          p: [
            "Um valor isolado não diz quase nada. Estes indicadores variam muito de um dia para o outro na mesma pessoa, e Martin Buchheit lembra que as medidas derivadas da frequência cardíaca se leem no contexto e como tendência, nunca isoladas.",
            "Uma manhã baixa depois de uma noite tardia ou de uma sessão dura na véspera é esperada — é até sinal de que a medição funciona. Três ou quatro manhãs baixas seguidas sem nada que o justifique é outra mensagem.",
          ],
        },
        {
          h: "Segunda pergunta: porque está baixo?",
          p: [
            "O algoritmo não conhece a causa. Falta de sono, o início de uma infeção, o álcool, um quarto demasiado quente, o jet lag, uma semana dura no trabalho: tudo produz o mesmo número baixo.",
            "O sono merece lugar à parte. A revisão de Hugh Fullagar sobre o tema mostra que a privação de sono afeta o desempenho no exercício e as funções cognitivas — e correr cansado degrada também a vigilância, o que conta num trilho técnico ou na cidade.",
            "Se a causa é identificável e pontual, tem tratamento: dormir. Se não é, ou se parece o início de uma doença, a sessão não é a prioridade.",
          ],
        },
        {
          h: "Terceira pergunta: que sessão estava prevista?",
          p: [
            "É a pergunta que se esquece, e a mais útil. «Devo correr?» não tem resposta geral; «devo fazer ESTA sessão?» tem.",
            "Um trote fácil de quarenta minutos quase nada exige ao sistema nervoso, e muitos corredores sentem-se melhor depois do que antes. Uma sessão de limiar ou de VO2máx, pelo contrário, exige estar em condições de a encaixar — fazê-la num organismo já mobilizado produz uma sessão medíocre E uma recuperação alongada.",
            "A boa decisão raramente é binária. Quase sempre consiste em manter a saída e mudar a intensidade, ou deslocar a qualidade dois dias.",
          ],
        },
        {
          h: "O único caso em que é não",
          p: [
            "Febre, dores musculares difusas, garganta inflamada, gânglios: não se corre, seja qual for o indicador. Não é uma questão de desempenho mas de risco — um esforço intenso durante uma infeção não é inócuo.",
            "Fora dessa situação, um indicador baixo é um convite a aliviar, não uma proibição. E se a dúvida persistir vários dias, quem decide é um médico, não um relógio.",
          ],
        },
        {
          h: "O que o Pacevo faz com isso",
          p: [
            "Estes valores chegam via intervals.icu e entram no cálculo do plano móvel. Quando caem em tendência, a sessão de qualidade é aliviada ou adiada, e o calendário escreve porquê.",
            "Mas a app só tem acesso ao que passa por um sensor. Não sabe que estás a incubar alguma coisa, nem que a semana foi dura no trabalho. Nesse ponto, o teu juízo vem antes do dela.",
          ],
        },
      ],
    },
    "ia-coach-ce-quun-humain-ne-fait-pas": {
      chapo:
        "Costuma opor-se o algoritmo ao treinador como se fosse preciso escolher. A verdadeira linha divisória não é a inteligência: é a frequência com que cada um olha. Eis o que cada um vê — e o que nenhum dos dois vê.",
      blocs: [
        {
          h: "O que um treinador faz e nenhum programa substitui",
          p: [
            "Um treinador lê um rosto. Percebe numa frase que a separação, a mudança de casa ou a noite mal dormida pesam mais do que a carga de treino. Sabe que um atleta que diz «estou bem» no fim de uma sessão de limiar mente uma vez em cada duas, e sabe qual das duas.",
            "Tem também uma visão longa. Decide que uma época será sacrificada pela seguinte, que um objetivo é prematuro, que este conta porque te importa — e que um atleta motivado encaixa o que um resignado recusa. Nada disso se deduz de uma série de medições.",
            "Por fim, ajusta em direto. Uma subida mais dura do que o previsto, um grupo que parte demasiado rápido, um gémeo que puxa ao terceiro quilómetro: muda a sessão no momento, com o que vê.",
          ],
        },
        {
          h: "O que um programa faz e nenhum treinador consegue",
          p: [
            "Olha todas as noites. Não à segunda-feira ao telefone: todas as noites, e depois de cada sessão. É a única diferença que conta mesmo, e é estrutural — quem acompanha trinta atletas não pode reler trinta curvas de sono todas as manhãs, por melhor que seja.",
            "Não se cansa e não tem ego. Não sobrevaloriza a sessão que ele próprio prescreveu, não se lembra melhor do último bom treino do que dos três medianos, e não tem orgulho a defender quando os dados contradizem o plano.",
            "Calcula sobre janelas que nenhuma memória sustenta. A carga crónica constrói-se ao longo de semanas; a relação entre carga recente e carga de fundo lê-se num mês móvel. São médias móveis: calculam-se, não se intuem.",
          ],
        },
        {
          h: "A linha divisória: a frequência, não a inteligência",
          p: [
            "Um treinador observa por episódios — uma sessão, uma chamada, uma mensagem. Um programa observa em contínuo, mas só vê o que é medido. O primeiro tem contexto e poucos pontos de medida; o segundo, muitos pontos de medida e nenhum contexto.",
            "É por isso que a oposição está mal colocada. A pergunta não é «quem decide melhor» mas «quem vê o quê, e com que frequência». Um plano que só se mexe uma vez por semana ignora, por construção, o que aconteceu na terça à noite.",
          ],
        },
        {
          h: "O que muda numa semana real",
          p: [
            "Tomemos uma semana comum. Terça, sessão de limiar como previsto. Quarta, noite curta e variabilidade cardíaca claramente abaixo do normal. Quinta, estava marcada uma sessão de qualidade.",
            "Sem releitura diária, a quinta mantém-se: foi escrita no domingo. Com releitura diária, é aliviada e a qualidade passa para sábado, quando os indicadores voltaram. O volume da semana quase não muda; a sua repartição sim — e é ela que decide o desgaste.",
            "Esta lógica — pilotar a progressão da carga em vez da sua quantidade bruta — está no centro do trabalho de Tim Gabbett sobre o paradoxo entre treino e lesão: são muitas vezes as subidas rápidas de carga, mais do que a carga elevada em si, que expõem o atleta.",
          ],
        },
        {
          h: "O limite, e é preciso dizê-lo",
          p: [
            "Um programa decide a partir do que mede. O que não mede não existe para ele: uma dor que começa, um luto, uma carga mental no trabalho, um ténis no fim de vida. Nunca os verá, e nenhuma versão futura os verá enquanto não passarem por um sensor.",
            "Os próprios indicadores pedem prudência. Martin Buchheit mostrou que as medidas derivadas da frequência cardíaca não contam todas a mesma história consoante o contexto, o momento e o tipo de esforço: um valor isolado não significa nada, é a tendência que informa.",
            "A conclusão honesta não é, portanto, «o algoritmo substitui». É: olha todos os dias para o que um humano só consegue olhar de vez em quando, e não percebe nada do que um humano capta num relance. Quem progride é quem dá a cada um aquilo que sabe fazer.",
          ],
        },
      ],
    },
    "vfc-et-charge-voir-la-fatigue-arriver": {
      chapo:
        "Três curvas e uma medição de manhã. O que cada uma diz, o que não diz, e porque é o seu cruzamento — nunca um valor isolado — que permite aliviar antes que algo parta.",
      blocs: [
        {
          h: "As três curvas: o que significam CTL, ATL e TSB",
          p: [
            "O modelo usado pela maioria das plataformas de treino descende dos trabalhos de Eric Banister sobre a resposta à carga. Resume-se a três números, todos derivados da mesma série de sessões.",
            "A carga crónica, muitas vezes escrita CTL, é uma média móvel longa — da ordem das seis semanas. É a tua condição de fundo: sobe devagar, desce devagar, e representa o que o teu corpo está habituado a encaixar.",
            "A carga aguda, ATL, é o mesmo numa janela curta, da ordem da semana. É a tua fadiga recente: sobe depressa depois de uma sessão dura e desce depressa em repouso.",
            "A frescura, TSB, é simplesmente a diferença entre as duas. Negativa, estás a encaixar mais do que o habitual. Positiva, estás descansado — e é isso que se procura no dia da prova, não durante a preparação.",
          ],
        },
        {
          h: "A variabilidade cardíaca: o que mede realmente",
          p: [
            "A variabilidade da frequência cardíaca, ou VFC, não mede a fadiga. Mede o intervalo entre batimentos sucessivos, que reflete o equilíbrio entre os dois ramos do sistema nervoso autónomo. Uma VFC baixa sinaliza que o organismo está mobilizado; não diz porquê.",
            "Essa distinção muda tudo na prática. Uma noite com álcool, o início de uma constipação, um quarto demasiado quente, o jet lag ou um aborrecimento fazem baixar a VFC exatamente como um treino demasiado duro. A medição é verdadeira; a interpretação «estou sobretreinado» não é.",
            "Segunda precaução: um valor isolado não vale nada. A VFC varia muito de um dia para o outro na mesma pessoa. O que informa é o desvio à TUA base — a média dos teus últimos dias — e a direção da tendência. Buchheit insiste nisso: os indicadores derivados da frequência cardíaca leem-se em contexto, não isolados.",
          ],
        },
        {
          h: "Porque é preciso cruzar os dois",
          p: [
            "Tomadas em separado, as duas famílias de indicadores enganam-se de forma previsível.",
            "A carga sozinha não sabe nada da tua vida. Vê que correste três vezes esta semana; ignora que dormiste cinco horas por noite. Continuará a prescrever como se estivesse tudo bem.",
            "A VFC sozinha não sabe nada do teu treino. Vê um indicador baixo; não distingue uma semana dura assumida — em que uma frescura negativa é normal e desejada — de uma deriva para o esgotamento.",
            "Cruzadas, corrigem-se. Frescura negativa com VFC estável é carga aceite: o plano continua. Frescura negativa com VFC a cair vários dias seguidos é um sinal de alerta: alivia-se. Uma VFC baixa com carga fraca provavelmente nada tem a ver com correr.",
          ],
        },
        {
          h: "O que o Pacevo faz com isso, em concreto",
          p: [
            "Estes indicadores chegam do teu relógio via intervals.icu — sono, VFC, frequência cardíaca em repouso, a carga de cada sessão. O Pacevo relê-os após cada sincronização e reescreve o plano móvel dos sete dias seguintes quando mudam.",
            "Aliviar não é suprimir a semana. Na prática, desloca a sessão de qualidade, encurta a sua parte intensa, ou substitui uma saída por um trote leve — o volume mexe pouco, a intensidade mexe muito.",
            "E o calendário escreve PORQUÊ. É o ponto que mais conta no dia a dia: um plano que não se percebe, contorna-se. Um plano que diz «a tua variabilidade está abaixo da tua base há três dias, a sessão de limiar passa para sábado» cumpre-se.",
          ],
        },
        {
          h: "O que não faz",
          p: [
            "Não prevê uma lesão. A progressão da carga é um fator entre outros — a biomecânica, o terreno, o material, o histórico de lesões e o sono também contam, e nada disso cabe em três curvas.",
            "Não substitui o teu juízo. Uma dor que se instala, um incómodo que altera a tua passada, uma fadiga que persiste apesar de indicadores normais: são motivos para parar, diga o que disser um painel. Um modelo tem sempre razão sobre o que mede e engana-se sobre tudo o resto.",
          ],
        },
      ],
    },
  },
};

export const traductionArticle = (lang: Lang, slug: string) =>
  ARTICLES_I18N[lang]?.[slug];
