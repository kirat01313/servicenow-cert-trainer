# ServiceNow Cert Trainer · Treino CSA

A study app for the **ServiceNow Certified System Administrator (CSA)** exam. It mixes spaced
repetition, practice exams that follow the official blueprint and hands-on labs for your Personal
Developer Instance (PDI), and keeps every student's progress in their own account.

**Live site:** https://kirat01313.github.io/servicenow-cert-trainer/

The site is bilingual (European Portuguese and English) and works on phones and computers.

> Built first for my UpSkill class at IPCA. New classes get their own access code. The CAD exam and
> other ServiceNow certifications are next (see the [roadmap](docs/ROADMAP.md)).

## Features

- **Today** – a daily session with due reviews, questions you got wrong (up to 30% of the session)
  and new questions, mixed across the blueprint domains by their exam weight.
- **Practice** – review only, confident mistakes, questions you got wrong, new questions or the
  whole bank. You say how sure you are before seeing the answer.
- **Build a session** – pick a domain, topic or course module, how many questions and the format
  (practice with answers or timed, exam-style).
- **Practice exam** – 60 questions in 90 minutes with the official domain weights, no topic hints,
  questions marked for review, and a full report at the end (domains, pace, wrong answers).
- **Progress** – KPIs with targets and trends, a confidence index from 0 to 10, an evolution chart
  with a projection to the exam date, weak topics and the review calendar.
- **Question ranking** – the questions you miss most and get right most.
- **Global ranking** – an opt-in leaderboard of the class, sorted by the confidence index, with
  readiness, bank coverage, 7-day accuracy, practice exam average and day streak. Each student
  picks a public nickname (the email never appears) and can leave at any time.
- **Plan** – set the exam date and get hours per day, new questions per day and review intervals
  adjusted to the time you have.
- **The exam** – the official blueprint facts and tips for exam day.
- **Labs** – 73 step-by-step labs for a PDI, linked to the questions.
- **Explanations** – each question has a short note with a link to the official ServiceNow
  documentation, the related lab and the matching pages of the course guide.
- **Accounts** – sign up with a class access code (with password confirmation and a show/hide
  button), sign in and reset the password. The account menu in the sidebar has *Change password*,
  *Privacy and about the app* (what is stored, who sees it, delete my account) and *Sign out*.
- **Bring your progress** – export from the old offline file and import it on the Today page or in
  *Progress › Data*; the progress moves to your account.
- **Certification picker** – under the logo: CSA today, CAD marked *coming soon*.

## How access works

1. A student creates an account with the **access code** of their class.
2. The code gives the account access to one certification (for now, CSA).
3. The questions, notes, labs and course guide excerpts are stored in Supabase and only accounts
   with access can read them (row level security). They are **not** in this repository.
4. Each student's progress is saved in their own rows; nobody else can read it.
5. The global ranking only shows students who joined it, and only to students with access to the
   same certification.

Paid access for people outside a class is planned (see the roadmap).

## Built with

- HTML, CSS and JavaScript – no framework and no build step
- [Supabase](https://supabase.com) – authentication, Postgres with row level security and
  database functions for the access codes and for deleting an account
- [supabase-js](https://github.com/supabase/supabase-js) from the jsDelivr CDN
- GitHub Actions and GitHub Pages – automatic deploy on every push to `main`

## Project structure

```text
index.html            the app (sign-in screen + study app)
admin.html            admin page: upload content and manage access codes
css/
  app.css             design of the study app
  gate.css            sign-in and unlock screens
  account.css         certification picker, account menu, dialogs and global ranking
  admin.css           admin page
js/
  gate.js             sign-in, sign-up with a code, unlock, account menu and dialogs,
                      loads the content and the app
  app.js              the study app (sessions, spaced reviews, exams, progress, labs)
  admin.js            content upload and access codes
  config.js           Supabase project URL and publishable key
supabase/
  schema.sql          everything below in one file (for a new project)
  grants.sql          table permissions for signed-in users
  ranking-and-account.sql   global ranking table and "delete my account" function
docs/ROADMAP.md       what comes next
```

## Run it on your computer

1. Clone the repository:

   ```bash
   git clone https://github.com/kirat01313/servicenow-cert-trainer.git
   cd servicenow-cert-trainer
   ```

2. Serve the folder with any static server, for example the **Live Server** extension in VS Code
   (right-click `index.html` → *Open with Live Server*).

## Set up Supabase

1. Create a project in [Supabase](https://supabase.com) and put its URL and publishable key in
   `js/config.js` (Supabase → Project Settings → API).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). (Projects created with an
   older version of this file also need `grants.sql` and `ranking-and-account.sql`.)
3. In **Authentication → URL Configuration**, set the *Site URL* to the GitHub Pages address and add
   it (plus `http://127.0.0.1:5500` for Live Server) to the *Redirect URLs*.
4. Create your own account on the site, then make it an admin in **SQL Editor**:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

5. Open `admin.html`, upload the content files (`data.json`, `labs.json`, `topics.json`, `en.json`)
   and create an access code for your class.

## Deploy

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the site on
every push to `main`. Turn it on once in **Settings → Pages → Source: GitHub Actions**.

The Supabase URL and publishable key live in [`js/config.js`](js/config.js). The publishable key is
meant to be public: every table is protected by row level security, so a visitor without an account
or without access can't read anything. Never put the secret (`service_role`) key in this file.

## Content and credits

- Questions: a question bank shared during the UpSkill course, kept as written. Only options that
  were split incorrectly when reading the original spreadsheet were fixed.
- Notes and topic descriptions: written for this app, based on the
  [official ServiceNow documentation](https://github.com/ServiceNow/ServiceNowDocs) (Apache 2.0).
- Course guide excerpts: *ServiceNow Administration Fundamentals*, © ServiceNow. Shown only to
  students with access, for study.
- Exam facts: the official CSA exam blueprint (KB0011554, January 2026).

This project is not affiliated with or endorsed by ServiceNow.

## License

The code is released under the [MIT License](LICENSE). The study content is not part of this
repository and is not covered by that license.
