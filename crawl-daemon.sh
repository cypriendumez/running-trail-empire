#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Démon de surveillance du crawl de vérification.
#  • Empêche la mise en veille du Mac (caffeinate) tant qu'il tourne.
#  • Redémarre automatiquement `node verifier.js --loop` s'il s'arrête (plantage,
#    coupure réseau prolongée…). Reprise sans perte (results.jsonl).
#  • S'arrête seul quand data/CRAWL_DONE apparaît (audit terminé).
#  Lancé détaché : survit à la fermeture de session et à la limite de l'IA.
# ─────────────────────────────────────────────────────────────────────────────
cd /Users/cypriendumez/Desktop/running-trail-empire || exit 1
LOG="daemon.log"
echo "$(date '+%F %T') ── démon démarré (PID $$) ──" >> "$LOG"

# Empêche la veille (idle + secteur) tant que ce script vit.
caffeinate -i -s -w $$ &

while true; do
  if [ -f data/CRAWL_DONE ]; then
    echo "$(date '+%F %T') CRAWL_DONE → audit terminé, arrêt du démon." >> "$LOG"
    break
  fi
  if ! pgrep -f "verifier.js --loop" >/dev/null 2>&1; then
    echo "$(date '+%F %T') crawl absent → (re)démarrage." >> "$LOG"
    nohup node verifier.js --loop 60 --compact >> crawl.log 2>&1 &
    sleep 10
  fi
  sleep 60
done
