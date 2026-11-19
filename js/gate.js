(function () {
  "use strict";

  var CERT = "csa";
  var LS = window.localStorage;
  var cfg = window.APP_CONFIG || {};
  var gate = document.getElementById("gate");
  var lang = safeGet("csa2-lang") === "en" ? "en" : "pt";
  var sb = null;
  var mode = "signin";
  var currentEmail = "";
  var armedDelete = false;
  var notice = "";

  var TXT = {
    pt: {
      title: "Treino CSA",
      tagline: "Prepara o exame Certified System Administrator da ServiceNow com revisões espaçadas, simulados e labs.",
      signin: "Entrar",
      signup: "Criar conta",
      email: "Email",
      password: "Palavra-passe",
      passwordNew: "Palavra-passe (mínimo 8 caracteres)",
      code: "Código de acesso",
      codeHelp: "O código que recebeste da tua turma ou formação.",
      forgot: "Esqueci-me da palavra-passe",
      sendReset: "Enviar link para mudar a palavra-passe",
      back: "Voltar",
      newPassword: "Nova palavra-passe",
      savePassword: "Guardar palavra-passe",
      unlockTitle: "Desbloquear o acesso",
      unlockText: "A tua conta ainda não tem acesso às questões. Escreve o código de acesso da tua turma.",
      unlock: "Desbloquear",
      paidSoon: "Não tens código? Em breve vai haver acesso pago para quem não é de uma turma.",
      signout: "Sair",
      loading: "A carregar as questões…",
      checkEmail: "Enviámos um email de confirmação. Abre o link e volta a entrar aqui.",
      resetSent: "Se o email tiver conta, vais receber um link para mudar a palavra-passe.",
      passwordSaved: "Palavra-passe guardada.",
      badCode: "Este código não é válido ou já expirou.",
      badLogin: "Email ou palavra-passe errados.",
      shortPassword: "A palavra-passe precisa de pelo menos 8 caracteres.",
      notConfirmed: "Ainda não confirmaste o email. Procura o email de confirmação.",
      genericError: "Algo correu mal. Tenta outra vez.",
      noConfig: "A aplicação não está configurada: falta o ficheiro js/config.js.",
      loadError: "Não consegui carregar as questões. Recarrega a página.",
      emptyContent: "As questões ainda não foram carregadas para esta certificação.",
      confirmPassword: "Confirmar a palavra-passe",
      mismatch: "As palavras-passe não coincidem.",
      showPassword: "Mostrar a palavra-passe",
      hidePassword: "Esconder a palavra-passe",
      kicker: "ServiceNow · Certified System Administrator",
      headline: "Passa no CSA com método.",
      sub: "Revisões espaçadas, simulados como o exame real e labs para a tua PDI. O progresso fica guardado na tua conta.",
      f1: "441 questões organizadas pelos 6 domínios do blueprint",
      f2: "Simulados de 60 questões em 90 minutos",
      f3: "73 labs passo a passo para a tua PDI",
      f4: "Índice de confiança e plano até ao dia do exame",
      foot: "Projeto de estudo. Não é afiliado à ServiceNow.",
      signinTitle: "Bem-vindo de volta",
      signinSub: "Entra para continuar o teu estudo.",
      signupTitle: "Criar conta",
      signupSub: "Precisas do código de acesso da tua turma.",
      forgotTitle: "Recuperar a palavra-passe",
      forgotSub: "Enviamos-te um link para escolheres uma nova.",
      recoverTitle: "Nova palavra-passe",
      recoverSub: "Escolhe uma palavra-passe com pelo menos 8 caracteres.",
      noAccount: "Ainda não tens conta?",
      haveAccount: "Já tens conta?",
      account: "Conta",
      changePassword: "Mudar a palavra-passe",
      privacy: "Privacidade e sobre a app",
      passwordChanged: "Palavra-passe mudada.",
      close: "Fechar",
      cancel: "Cancelar",
      certsTitle: "Certificações",
      current: "A estudar",
      soon: "Em breve",
      moreCerts: "Mais certificações ServiceNow a caminho.",
      privacyHtml:
        "<h3>O que guardamos</h3><ul><li>O teu <b>email</b>, para entrares.</li><li>O teu <b>progresso de estudo</b>: respostas, sessões, simulados, datas e definições.</li><li>Só se entrares no <b>ranking global</b>: o nome que escolheres e as tuas estatísticas (índice, prontidão, cobertura, acerto, simulados, dias seguidos).</li></ul>" +
        "<h3>Quem vê</h3><ul><li>O teu progresso: só tu.</li><li>O ranking global: os colegas com acesso à mesma certificação. O teu email nunca aparece.</li><li>O administrador vê quantas contas usaram cada código, não o teu progresso.</li></ul>" +
        "<h3>Os teus direitos</h3><ul><li>Podes exportar o progresso em <b>Progresso › Dados</b>.</li><li>Podes sair do ranking quando quiseres.</li><li>Podes apagar a conta aqui em baixo: apaga o progresso, o acesso e o lugar no ranking. Não dá para desfazer.</li></ul>" +
        "<h3>Sobre a app</h3><p>Projeto de estudo feito por um aluno do UpSkill (IPCA) para preparar o exame ServiceNow CSA. Não é afiliado à ServiceNow. As questões vêm do banco partilhado na formação; as notas baseiam-se na documentação oficial da ServiceNow; os excertos do guia do curso só aparecem a quem tem acesso.</p>",
      deleteAccount: "Apagar a minha conta",
      deleteConfirm: "Tens a certeza? O progresso, o acesso e o lugar no ranking são apagados e não dá para desfazer. Exporta o progresso antes, se o quiseres guardar.",
      deleteGo: "Apagar mesmo",
      deleteError: "Não consegui apagar a conta. Tenta outra vez.",
    },
    en: {
      title: "CSA Trainer",
      tagline: "Prepare for the ServiceNow Certified System Administrator exam with spaced reviews, practice exams and labs.",
      signin: "Sign in",
      signup: "Create account",
      email: "Email",
      password: "Password",
      passwordNew: "Password (at least 8 characters)",
      code: "Access code",
      codeHelp: "The code you got from your class or training.",
      forgot: "I forgot my password",
      sendReset: "Send a link to change the password",
      back: "Back",
      newPassword: "New password",
      savePassword: "Save password",
      unlockTitle: "Unlock access",
      unlockText: "Your account doesn’t have access to the questions yet. Type your class access code.",
      unlock: "Unlock",
      paidSoon: "No code? Paid access for people outside a class is coming soon.",
      signout: "Sign out",
      loading: "Loading the questions…",
      checkEmail: "We sent you a confirmation email. Open the link and sign in here again.",
      resetSent: "If that email has an account, you’ll get a link to change the password.",
      passwordSaved: "Password saved.",
      badCode: "This code isn’t valid or has expired.",
      badLogin: "Wrong email or password.",
      shortPassword: "The password needs at least 8 characters.",
      notConfirmed: "You haven’t confirmed your email yet. Look for the confirmation email.",
      genericError: "Something went wrong. Try again.",
      noConfig: "The app isn’t configured: the js/config.js file is missing.",
      loadError: "Couldn’t load the questions. Reload the page.",
      emptyContent: "The questions for this certification haven’t been uploaded yet.",
      confirmPassword: "Confirm password",
      mismatch: "The passwords don’t match.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      kicker: "ServiceNow · Certified System Administrator",
      headline: "Pass the CSA with a method.",
      sub: "Spaced reviews, practice exams like the real one and labs for your PDI. Your progress is saved to your account.",
      f1: "441 questions organized by the 6 blueprint domains",
      f2: "Practice exams of 60 questions in 90 minutes",
      f3: "73 step-by-step labs for your PDI",
      f4: "Confidence index and a plan up to exam day",
      foot: "Study project. Not affiliated with ServiceNow.",
      signinTitle: "Welcome back",
      signinSub: "Sign in to carry on studying.",
      signupTitle: "Create account",
      signupSub: "You need your class access code.",
      forgotTitle: "Reset your password",
      forgotSub: "We’ll send you a link to choose a new one.",
      recoverTitle: "New password",
      recoverSub: "Choose a password with at least 8 characters.",
      noAccount: "Don’t have an account?",
      haveAccount: "Already have an account?",
      account: "Account",
      changePassword: "Change password",
      privacy: "Privacy and about the app",
      passwordChanged: "Password changed.",
      close: "Close",
      cancel: "Cancel",
      certsTitle: "Certifications",
      current: "Studying",
      soon: "Coming soon",
      moreCerts: "More ServiceNow certifications on the way.",
      privacyHtml:
        "<h3>What we store</h3><ul><li>Your <b>email</b>, so you can sign in.</li><li>Your <b>study progress</b>: answers, sessions, practice exams, dates and settings.</li><li>Only if you join the <b>global ranking</b>: the name you choose and your stats (index, readiness, coverage, accuracy, exams, day streak).</li></ul>" +
        "<h3>Who sees it</h3><ul><li>Your progress: only you.</li><li>The global ranking: classmates with access to the same certification. Your email never appears.</li><li>The admin sees how many accounts used each code, not your progress.</li></ul>" +
        "<h3>Your rights</h3><ul><li>You can export your progress in <b>Progress › Data</b>.</li><li>You can leave the ranking whenever you want.</li><li>You can delete your account below: it deletes your progress, access and ranking place. It can’t be undone.</li></ul>" +
        "<h3>About the app</h3><p>A study project made by an UpSkill (IPCA) student to prepare for the ServiceNow CSA exam. Not affiliated with ServiceNow. The questions come from the bank shared during the course; the notes are based on the official ServiceNow documentation; the course guide excerpts are shown only to people with access.</p>",
      deleteAccount: "Delete my account",
      deleteConfirm: "Are you sure? Your progress, access and ranking place are deleted and it can’t be undone. Export your progress first if you want to keep it.",
      deleteGo: "Delete for real",
      deleteError: "Couldn’t delete the account. Try again.",
    },
  };

  function t(k) {
    var cur = safeGet("csa2-lang") === "en" ? "en" : "pt";
    return TXT[cur][k];
  }
  function safeGet(k) {
    try {
      return LS.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function safeSet(k, v) {
    try {
      if (v == null) LS.removeItem(k);
      else LS.setItem(k, v);
    } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  (function applyTheme() {
    var th = safeGet("csa2-theme") || "light";
    document.documentElement.dataset.theme = th;
    document.documentElement.lang = lang === "en" ? "en" : "pt-PT";
  })();

  var ICONS = {"q": "<path d=\"M4 6.5h16M4 12h16M4 17.5h10\"/>", "clock": "<circle cx=\"12\" cy=\"13\" r=\"7.5\"/><path d=\"M12 9v4l2.5 2M9.5 3h5\"/>", "lab": "<path d=\"M9.5 3.5h5M10.5 3.5v6L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-5.5-9.5v-6\"/><path d=\"M7.5 15h9\"/>", "chart": "<path d=\"M4 19h16\"/><path d=\"m5 15 4.5-4.5 3.5 3L19 7\"/>"};
  var EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  function layout(title, sub, inner) {
    gate.innerHTML =
      '<div class="auth">' +
      '<aside class="auth-brand">' +
      '<div class="ab-top"><span class="logo" aria-hidden="true">CSA</span><b>' + esc(t("title")) + "</b></div>" +
      '<div class="ab-mid"><p class="ab-kicker">' + esc(t("kicker")) + "</p><h1>" + esc(t("headline")) + "</h1>" +
      '<p class="ab-sub">' + esc(t("sub")) + "</p>" +
      '<ul class="ab-feats">' +
      [["q", "f1"], ["clock", "f2"], ["lab", "f3"], ["chart", "f4"]]
        .map(function (f) {
          return '<li><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[f[0]] + "</svg></span>" + esc(t(f[1])) + "</li>";
        })
        .join("") +
      "</ul></div>" +
      '<p class="ab-foot">' + esc(t("foot")) + "</p></aside>" +
      '<main class="auth-main"><div class="auth-box">' +
      '<div class="seg langseg ab-lang" role="group" aria-label="Idioma / Language">' +
      '<button data-g="lang" data-v="pt" aria-pressed="' + (lang === "pt") + '">PT</button>' +
      '<button data-g="lang" data-v="en" aria-pressed="' + (lang === "en") + '">EN</button></div>' +
      (title ? "<h2>" + esc(title) + "</h2>" : "") +
      (sub ? '<p class="auth-sub">' + esc(sub) + "</p>" : "") +
      '<p class="gate-msg" role="status"' + (notice ? "" : " hidden") + ">" + esc(notice) + "</p>" +
      inner +
      "</div></main></div>";
    var first = gate.querySelector(".auth-box input");
    if (first) first.focus();
  }

  function field(id, label, type, extra) {
    return (
      '<label class="field" for="' + id + '"><span>' + esc(label) + "</span>" +
      '<input id="' + id + '" type="' + type + '" ' + (extra || "") + " required></label>"
    );
  }

  function passField(id, label, extra) {
    return (
      '<label class="field" for="' + id + '"><span>' + esc(label) + "</span>" +
      '<span class="pw"><input id="' + id + '" type="password" ' + (extra || "") + " required>" +
      '<button type="button" class="eye" data-g="eye" aria-label="' + esc(t("showPassword")) + '" aria-pressed="false">' + EYE + "</button></span></label>"
    );
  }

  function submitBtn(label) {
    return '<button class="btn primary big auth-go" type="submit">' + esc(label) + "</button>";
  }

  function switchLine(text, to, label) {
    return '<p class="auth-switch">' + esc(text) + ' <button class="link" type="button" data-g="mode" data-v="' + to + '">' + esc(label) + "</button></p>";
  }

  function showAuth() {
    gate.hidden = false;
    if (mode === "signin") {
      layout(
        t("signinTitle"),
        t("signinSub"),
        '<form data-g="signin" novalidate>' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          passField("gPass", t("password"), 'autocomplete="current-password"') +
          '<button class="link auth-forgot" type="button" data-g="mode" data-v="forgot">' + esc(t("forgot")) + "</button>" +
          submitBtn(t("signin")) +
          "</form>" +
          switchLine(t("noAccount"), "signup", t("signup"))
      );
    } else if (mode === "signup") {
      layout(
        t("signupTitle"),
        t("signupSub"),
        '<form data-g="signup" novalidate>' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          passField("gPass", t("passwordNew"), 'autocomplete="new-password" minlength="8"') +
          passField("gPass2", t("confirmPassword"), 'autocomplete="new-password" minlength="8"') +
          field("gCode", t("code"), "text", 'autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="UPSKILL-XXXXXX"') +
          '<p class="gate-help">' + esc(t("codeHelp")) + "</p>" +
          submitBtn(t("signup")) +
          "</form>" +
          switchLine(t("haveAccount"), "signin", t("signin"))
      );
    } else if (mode === "forgot") {
      layout(
        t("forgotTitle"),
        t("forgotSub"),
        '<form data-g="forgot" novalidate>' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          submitBtn(t("sendReset")) +
          "</form>" +
          '<p class="auth-switch"><button class="link" type="button" data-g="mode" data-v="signin">← ' + esc(t("back")) + "</button></p>"
      );
    } else if (mode === "recover") {
      layout(
        t("recoverTitle"),
        t("recoverSub"),
        '<form data-g="recover" novalidate>' +
          passField("gPass", t("newPassword"), 'autocomplete="new-password" minlength="8"') +
          passField("gPass2", t("confirmPassword"), 'autocomplete="new-password" minlength="8"') +
          submitBtn(t("savePassword")) +
          "</form>"
      );
    }
  }

  function showUnlock() {
    gate.hidden = false;
    layout(
      t("unlockTitle"),
      t("unlockText"),
      '<form data-g="unlock" novalidate>' +
        field("gCode", t("code"), "text", 'autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="UPSKILL-XXXXXX"') +
        submitBtn(t("unlock")) +
        "</form>" +
        '<p class="gate-help">' + esc(t("paidSoon")) + "</p>" +
        '<p class="auth-switch"><button class="link" type="button" data-g="signout">' + esc(t("signout")) + "</button></p>"
    );
  }

  function showMessage(msg) {
    gate.hidden = false;
    notice = msg;
    layout("", "", '<p class="auth-switch"><button class="link" type="button" data-g="signout">' + esc(t("signout")) + "</button></p>");
  }

  function showLoading() {
    gate.hidden = false;
    gate.innerHTML = '<div class="auth-loading"><span class="logo" aria-hidden="true">CSA</span><span class="spin" aria-hidden="true"></span><p>' + esc(t("loading")) + "</p></div>";
  }

  function fail(msg) {
    notice = msg;
    var m = gate.querySelector(".gate-msg");
    if (m) {
      m.textContent = msg;
      m.hidden = false;
      m.classList.add("err");
    }
  }

  function closePops() {
    ["certPop", "userPop"].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.hidden = true;
    });
    document.querySelectorAll('[data-g="usermenu"],[data-g="certs"]').forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function placePop(pop, btn) {
    var r = btn.getBoundingClientRect();
    pop.style.left = pop.style.right = pop.style.top = pop.style.bottom = "";
    pop.hidden = false;
    var w = pop.offsetWidth;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    pop.style.left = left + "px";
    if (r.top > window.innerHeight / 2) pop.style.bottom = window.innerHeight - r.top + 8 + "px";
    else pop.style.top = r.bottom + 8 + "px";
    btn.setAttribute("aria-expanded", "true");
  }

  function openUserMenu(btn) {
    var pop = document.getElementById("userPop");
    if (!pop.hidden) {
      closePops();
      return;
    }
    closePops();
    pop.innerHTML =
      '<p class="mp-head"><span>' + esc(t("account")) + "</span><b>" + esc(currentEmail) + "</b></p>" +
      '<button role="menuitem" data-g="pw"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>' + esc(t("changePassword")) + "</button>" +
      '<button role="menuitem" data-g="privacy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5z"/><path d="M12 10.5v5M12 7.8v.4"/></svg>' + esc(t("privacy")) + "</button>" +
      '<hr><button role="menuitem" data-g="signout" class="mp-out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h9"/></svg>' + esc(t("signout")) + "</button>";
    placePop(pop, btn);
  }

  function openCerts(btn) {
    var pop = document.getElementById("certPop");
    if (!pop.hidden) {
      closePops();
      return;
    }
    closePops();
    var list = [
      { id: "csa", name: "Certified System Administrator", on: true },
      { id: "cad", name: "Certified Application Developer", on: false },
    ];
    pop.innerHTML =
      '<p class="mp-head"><span>' + esc(t("certsTitle")) + "</span></p>" +
      list
        .map(function (c) {
          return (
            '<button role="menuitem" class="mp-cert' + (c.id === CERT ? " on" : "") + '"' + (c.on ? "" : ' disabled aria-disabled="true"') + ' data-g="certpick" data-v="' + c.id + '">' +
            '<span class="cs-code">' + c.id.toUpperCase() + '</span><span class="mp-cname">' + esc(c.name) + "</span>" +
            '<span class="pill' + (c.id === CERT ? " ok" : "") + '">' + esc(c.id === CERT ? t("current") : t("soon")) + "</span></button>"
          );
        })
        .join("") +
      '<p class="mp-foot">' + esc(t("moreCerts")) + "</p>";
    placePop(pop, btn);
  }

  function dialog(title, body) {
    var d = document.getElementById("dlg");
    d.innerHTML =
      '<div class="dlg-head"><h2>' + esc(title) + '</h2><button class="dlg-x" data-g="dlgclose" aria-label="' + esc(t("close")) + '">×</button></div>' +
      '<div class="dlg-body">' + body + "</div>";
    if (!d.open) d.showModal();
    var first = d.querySelector("input");
    if (first) first.focus();
  }

  function openPassword() {
    dialog(
      t("changePassword"),
      '<p class="gate-msg" role="status" hidden></p>' +
        '<form data-g="pwchange" novalidate>' +
        passField("gPass", t("newPassword"), 'autocomplete="new-password" minlength="8"') +
        passField("gPass2", t("confirmPassword"), 'autocomplete="new-password" minlength="8"') +
        '<div class="dlg-actions"><button class="btn" type="button" data-g="dlgclose">' + esc(t("cancel")) + '</button><button class="btn primary" type="submit">' + esc(t("savePassword")) + "</button></div></form>"
    );
  }

  function openPrivacy() {
    armedDelete = false;
    dialog(
      t("privacy"),
      '<div class="privacy">' + t("privacyHtml") + "</div>" +
        '<div class="dlg-danger"><p class="gate-msg" role="status" hidden></p><div class="dlg-actions"><button class="btn danger" type="button" data-g="delacct">' + esc(t("deleteAccount")) + "</button></div></div>"
    );
  }

  function dlgMsg(msg, ok) {
    var m = document.querySelector("#dlg .gate-msg");
    if (!m) return;
    m.textContent = msg;
    m.hidden = false;
    m.classList.toggle("err", !ok);
    m.classList.toggle("ok", !!ok);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePops();
  });
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest(".menu-pop") && !ev.target.closest('[data-g="usermenu"],[data-g="certs"]')) closePops();
  }, true);

  function busy(form, on) {
    var b = form && form.querySelector('button[type="submit"]');
    if (b) b.disabled = on;
  }

  function normCode(c) {
    return String(c || "").trim().toUpperCase();
  }

  function authError(e) {
    var m = (e && e.message) || "";
    if (/invalid login/i.test(m)) return t("badLogin");
    if (/not confirmed/i.test(m)) return t("notConfirmed");
    if (/password/i.test(m) && /(6|8)/.test(m)) return t("shortPassword");
    return m || t("genericError");
  }

  function hasAccess(uid) {
    return sb
      .from("entitlements")
      .select("cert")
      .eq("cert", CERT)
      .eq("user_id", uid)
      .maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        return !!r.data;
      });
  }

  function redeem(code) {
    return sb.rpc("redeem_access_code", { p_code: normCode(code) }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  function afterSignIn(session) {
    var uid = session.user.id;
    if (safeGet("csa2-uid") && safeGet("csa2-uid") !== uid) {
      ["csa2", "csa2-labs", "csa2-ex-doc"].forEach(function (k) {
        safeSet(k, null);
      });
    }
    safeSet("csa2-uid", uid);
    showLoading();
    var pending = safeGet("csa2-pending-code");
    var step = pending
      ? redeem(pending)
          .catch(function () {
            return null;
          })
          .then(function () {
            safeSet("csa2-pending-code", null);
          })
      : Promise.resolve();
    return step
      .then(function () {
        return hasAccess(uid);
      })
      .then(function (ok) {
        if (!ok) {
          showUnlock();
          return;
        }
        return loadContent()
          .then(function (content) {
            boot(session, content);
          })
          .catch(function (e) {
            showMessage(e && e.message === "empty" ? t("emptyContent") : t("loadError"));
          });
      })
      .catch(function () {
        showMessage(t("loadError"));
      });
  }

  function loadContent() {
    return sb
      .from("cert_content")
      .select("key,data")
      .eq("cert", CERT)
      .then(function (r) {
        if (r.error) throw r.error;
        var rows = r.data || [];
        if (!rows.length) throw new Error("empty");
        var byKey = {};
        rows.forEach(function (row) {
          byKey[row.key] = row.data;
        });
        var meta = byKey["data.meta"];
        if (!meta) throw new Error("empty");
        var parts = Object.keys(byKey)
          .filter(function (k) {
            return /^data\.q\d+$/.test(k);
          })
          .sort(function (a, b) {
            return parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10);
          });
        var questions = [];
        parts.forEach(function (k) {
          questions = questions.concat(byKey[k]);
        });
        return {
          "data.json": { meta: meta.meta, domains: meta.domains, questions: questions },
          "labs.json": byKey.labs || { labs: [], map: {} },
          "topics.json": byKey.topics || null,
          "en.json": byKey.en || null,
        };
      });
  }

  function boot(session, content) {
    var uid = session.user.id;
    var realFetch = window.fetch.bind(window);
    window.fetch = function (u, o) {
      var k = String(u).split("/").pop();
      if (Object.prototype.hasOwnProperty.call(content, k)) {
        var v = content[k];
        return Promise.resolve({
          ok: !!v,
          status: v ? 200 : 404,
          json: function () {
            return Promise.resolve(JSON.parse(JSON.stringify(v)));
          },
        });
      }
      return realFetch(u, o);
    };

    var docs = {
      collection: function () {
        return {
          doc: function (name) {
            var key = CERT + ":" + name;
            return {
              get: function () {
                return sb
                  .from("user_docs")
                  .select("data")
                  .eq("doc", key)
                  .maybeSingle()
                  .then(function (r) {
                    if (r.error) throw { code: "unavailable" };
                    return {
                      exists: !!r.data,
                      data: function () {
                        return r.data ? r.data.data : null;
                      },
                    };
                  });
              },
              set: function (body) {
                return sb
                  .from("user_docs")
                  .upsert({ user_id: uid, doc: key, data: body, updated_at: new Date().toISOString() })
                  .then(function (r) {
                    if (r.error) throw { code: "unavailable" };
                  });
              },
            };
          },
        };
      },
    };
    window.claude = {
      use: function (name) {
        if (name === "db") return Promise.resolve(docs);
        if (name === "user")
          return Promise.resolve({
            id: function () {
              return Promise.resolve(uid);
            },
          });
        return Promise.resolve(null);
      },
    };

    window.CSA_BACKEND = {
      cert: CERT,
      uid: uid,
      lbList: function () {
        return sb
          .from("leaderboard")
          .select("user_id,display_name,score,readiness,coverage,accuracy7,exams_avg,streak,answers,updated_at")
          .eq("cert", CERT)
          .then(function (r) {
            if (r.error) throw r.error;
            return r.data || [];
          });
      },
      lbMine: function () {
        return sb
          .from("leaderboard")
          .select("*")
          .eq("cert", CERT)
          .eq("user_id", uid)
          .maybeSingle()
          .then(function (r) {
            if (r.error) throw r.error;
            return r.data;
          });
      },
      lbSave: function (row) {
        row.user_id = uid;
        row.cert = CERT;
        row.updated_at = new Date().toISOString();
        return sb
          .from("leaderboard")
          .upsert(row)
          .select()
          .maybeSingle()
          .then(function (r) {
            if (r.error) throw r.error;
            return r.data || row;
          });
      },
      lbLeave: function () {
        return sb
          .from("leaderboard")
          .delete()
          .eq("cert", CERT)
          .eq("user_id", uid)
          .then(function (r) {
            if (r.error) throw r.error;
          });
      },
    };

    var foot = document.querySelector(".side-foot");
    if (foot && !document.getElementById("acct")) {
      var row = document.createElement("div");
      row.className = "acct";
      row.id = "acct";
      var email = session.user.email || "";
      row.innerHTML =
        '<button class="acct-btn" data-g="usermenu" aria-haspopup="menu" aria-expanded="false" title="' + esc(email) + '">' +
        '<i aria-hidden="true">' + esc((email[0] || "?").toUpperCase()) + "</i><span>" + esc(email) + "</span>" +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg></button>';
      foot.insertBefore(row, foot.firstChild);
    }
    currentEmail = email;

    gate.hidden = true;
    gate.innerHTML = "";
    document.body.classList.remove("gated");
    var s = document.createElement("script");
    s.src = "js/app.js";
    document.body.appendChild(s);
  }

  function signOut() {
    safeSet("csa2-pending-code", null);
    sb.auth.signOut().then(function () {
      location.reload();
    });
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-g]");
    if (!el || el.tagName === "FORM") return;
    var a = el.dataset.g;
    if (a === "signout") closePops();
    if (a === "lang") {
      lang = el.dataset.v === "en" ? "en" : "pt";
      safeSet("csa2-lang", lang);
      document.documentElement.lang = lang === "en" ? "en" : "pt-PT";
      if (gate.hidden) return;
      if (gate.querySelector('form[data-g="unlock"]')) showUnlock();
      else showAuth();
    } else if (a === "mode") {
      mode = el.dataset.v;
      notice = "";
      showAuth();
    } else if (a === "signout") {
      signOut();
    } else if (a === "usermenu") {
      openUserMenu(el);
    } else if (a === "certs") {
      openCerts(el);
    } else if (a === "certpick") {
      closePops();
    } else if (a === "pw") {
      closePops();
      openPassword();
    } else if (a === "privacy") {
      closePops();
      openPrivacy();
    } else if (a === "dlgclose") {
      document.getElementById("dlg").close();
    } else if (a === "delacct") {
      if (!armedDelete) {
        armedDelete = true;
        dlgMsg(t("deleteConfirm"), false);
        el.textContent = t("deleteGo");
        return;
      }
      el.disabled = true;
      sb.rpc("delete_my_account").then(function (r) {
        if (r.error) throw r.error;
        ["csa2", "csa2-labs", "csa2-ex-doc", "csa2-uid"].forEach(function (k) {
          safeSet(k, null);
        });
        return sb.auth.signOut();
      }).then(function () {
        location.reload();
      }).catch(function () {
        el.disabled = false;
        dlgMsg(t("deleteError"), false);
      });
    } else if (a === "eye") {
      var inp = el.parentNode.querySelector("input");
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      el.setAttribute("aria-pressed", show ? "true" : "false");
      el.setAttribute("aria-label", show ? t("hidePassword") : t("showPassword"));
    }
  });

  document.addEventListener("submit", function (ev) {
    var f = ev.target.closest("form[data-g]");
    if (!f) return;
    ev.preventDefault();
    var a = f.dataset.g;
    var email = (f.querySelector("#gEmail") || {}).value;
    var pass = (f.querySelector("#gPass") || {}).value;
    var code = (f.querySelector("#gCode") || {}).value;
    var pass2 = (f.querySelector("#gPass2") || {}).value;
    busy(f, true);
    var done = function () {
      busy(f, false);
    };
    if (a === "signin") {
      sb.auth
        .signInWithPassword({ email: email, password: pass })
        .then(function (r) {
          if (r.error) throw r.error;
          notice = "";
          return afterSignIn(r.data.session);
        })
        .catch(function (e) {
          fail(authError(e));
        })
        .then(done);
    } else if (a === "signup") {
      if ((pass || "").length < 8) {
        fail(t("shortPassword"));
        done();
        return;
      }
      if (pass !== pass2) {
        fail(t("mismatch"));
        done();
        return;
      }
      sb.rpc("check_access_code", { p_code: normCode(code) })
        .then(function (r) {
          if (r.error || !r.data) throw { message: t("badCode") };
          safeSet("csa2-pending-code", normCode(code));
          return sb.auth.signUp({
            email: email,
            password: pass,
            options: { emailRedirectTo: location.origin + location.pathname },
          });
        })
        .then(function (r) {
          if (r.error) throw r.error;
          if (r.data.session) return afterSignIn(r.data.session);
          mode = "signin";
          notice = t("checkEmail");
          showAuth();
        })
        .catch(function (e) {
          fail(e && e.message === t("badCode") ? t("badCode") : authError(e));
        })
        .then(done);
    } else if (a === "forgot") {
      sb.auth
        .resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
        .then(function () {
          mode = "signin";
          notice = t("resetSent");
          showAuth();
        })
        .catch(function (e) {
          fail(authError(e));
        })
        .then(done);
    } else if (a === "recover") {
      if ((pass || "").length < 8) {
        fail(t("shortPassword"));
        done();
        return;
      }
      if (pass !== pass2) {
        fail(t("mismatch"));
        done();
        return;
      }
      sb.auth
        .updateUser({ password: pass })
        .then(function (r) {
          if (r.error) throw r.error;
          notice = t("passwordSaved");
          return sb.auth.getSession().then(function (s) {
            return afterSignIn(s.data.session);
          });
        })
        .catch(function (e) {
          fail(authError(e));
        })
        .then(done);
    } else if (a === "pwchange") {
      var showErr = function (msg) {
        dlgMsg(msg, false);
        done();
      };
      if ((pass || "").length < 8) return showErr(t("shortPassword"));
      if (pass !== pass2) return showErr(t("mismatch"));
      sb.auth
        .updateUser({ password: pass })
        .then(function (r) {
          if (r.error) throw r.error;
          f.reset();
          dlgMsg(t("passwordChanged"), true);
        })
        .catch(function (e) {
          dlgMsg(authError(e), false);
        })
        .then(done);
    } else if (a === "unlock") {
      redeem(code)
        .then(function (cert) {
          if (!cert) throw new Error("bad");
          notice = "";
          return sb.auth.getSession().then(function (s) {
            return afterSignIn(s.data.session);
          });
        })
        .catch(function () {
          fail(t("badCode"));
        })
        .then(done);
    }
  });

  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
    gate.hidden = false;
    notice = t("noConfig");
    layout("", "", "");
    return;
  }

  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  var recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      mode = "recover";
      showAuth();
    }
  });
  showLoading();
  sb.auth.getSession().then(function (r) {
    var session = r.data && r.data.session;
    if (recovering) {
      mode = "recover";
      showAuth();
    } else if (session) afterSignIn(session);
    else showAuth();
  });
})();
