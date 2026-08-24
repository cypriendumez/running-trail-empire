-- ─────────────────────────────────────────────────────────────────────────────
--  LANCEUR PACEVO — les liens du projet, à portée de double-clic.
--
--  Cyprien redemandait ses adresses à chaque conversation. Elles vivent maintenant
--  ici, dans une application posée sur son Bureau : double-clic, on choisit, ça ouvre.
--
--  ⚠️ LA LISTE EST LA MÊME QUE CELLE DU PROJET. Si une adresse change (nouveau domaine,
--  autre projet Supabase), c'est CE fichier qu'il faut modifier, puis relancer
--  `outils/construire-lanceur.sh`. Un test vérifie que les adresses d'ici correspondent
--  à celles que le code utilise réellement — sinon le lanceur ouvrirait un site mort.
-- ─────────────────────────────────────────────────────────────────────────────

property destinations : {¬
	{titre:"Ouvrir TOUT (5 onglets)", url:"*"}, ¬
	{titre:"Application", url:"https://running-trail-empire-woad.vercel.app"}, ¬
	{titre:"Espace coach (admin)", url:"https://running-trail-empire-woad.vercel.app/admin"}, ¬
	{titre:"Comptabilité", url:"https://running-trail-empire-woad.vercel.app/admin?onglet=compta"}, ¬
	{titre:"Notre histoire", url:"https://running-trail-empire-woad.vercel.app/notre-histoire"}, ¬
	{titre:"Vercel — déploiements", url:"https://vercel.com/dashboard"}, ¬
	{titre:"Supabase — base de données", url:"https://supabase.com/dashboard/project/vglvmhqvntihaeqijdkm"}, ¬
	{titre:"Supabase — factures stockées", url:"https://supabase.com/dashboard/project/vglvmhqvntihaeqijdkm/storage/buckets/justificatifs"}, ¬
	{titre:"GitHub — code source", url:"https://github.com/cypriendumez/running-trail-empire"}, ¬
	{titre:"Stripe — tableau de bord", url:"https://dashboard.stripe.com"}, ¬
	{titre:"Resend — e-mails envoyés", url:"https://resend.com/emails"}}

-- Les cinq adresses ouvertes par « Ouvrir TOUT » : celles du quotidien, pas les onze.
property lesCinq : {"https://running-trail-empire-woad.vercel.app", ¬
	"https://running-trail-empire-woad.vercel.app/admin", ¬
	"https://vercel.com/dashboard", ¬
	"https://supabase.com/dashboard/project/vglvmhqvntihaeqijdkm", ¬
	"https://github.com/cypriendumez/running-trail-empire"}

on run
	set titres to {}
	repeat with d in destinations
		set end of titres to titre of d
	end repeat

	set choix to choose from list titres ¬
		with title "Pacevo" ¬
		with prompt "Quelle page veux-tu ouvrir ?" ¬
		default items {item 2 of titres} ¬
		OK button name "Ouvrir" cancel button name "Fermer"

	if choix is false then return -- fermé sans choisir : on ne fait rien

	set voulu to item 1 of choix
	repeat with d in destinations
		if titre of d is voulu then
			if url of d is "*" then
				repeat with u in lesCinq
					open location (u as text)
					delay 0.4 -- laisse le navigateur enchaîner les onglets sans en perdre
				end repeat
			else
				open location (url of d)
			end if
			return
		end if
	end repeat
end run
