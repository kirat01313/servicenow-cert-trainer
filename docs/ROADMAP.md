# Roadmap

## Now · CSA

- [x] Study app for the CSA exam (sessions, spaced reviews, practice exams, progress, labs)
- [x] Accounts with Supabase and access codes per class
- [x] Content and progress stored in Supabase with row level security
- [x] Deploy on GitHub Pages

## Next · more certifications (CAD first)

The database is already ready for several certifications: `certifications`, `entitlements`,
`cert_content` and `user_docs` all carry the certification id (`csa`, `cad`, …), so each
certification has its own content, its own access and its own progress.

1. **Certification picker** – the logo in the sidebar becomes a small menu
   (*CSA ▾ → CSA · CAD · …*). Certifications you don't have yet show a lock and open the unlock
   screen. Only one certification is on screen at a time, so the menu stays the same as today.
2. **Settings per certification** – exam size, duration, domains and weights come from the
   content (`data.meta`, `domains`) instead of being fixed for the CSA.
3. **Progress per certification** – local cache and synced documents prefixed with the
   certification id (`cad:progress`, …).
4. **CAD content** – blueprint domains, question bank, notes based on the official documentation
   and labs for App Engine Studio, scripting and integrations.
5. **Paid access** – a checkout for people outside a class; a Supabase Edge Function receives the
   payment confirmation and adds an `entitlements` row with `source = 'purchase'`.

## Later

- Class dashboard for teachers (progress of the class, without personal answers)
- Offline mode (installable web app)
