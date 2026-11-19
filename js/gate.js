(function () {
  "use strict";

  var CERT = "csa";
  var LS = window.localStorage;
  var cfg = window.APP_CONFIG || {};
  var gate = document.getElementById("gate");
  var lang = safeGet("csa2-lang") === "en" ? "en" : "pt";
  var sb = null;
  var mode = "signin";
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
    },
  };

  function t(k) {
    return TXT[lang][k];
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

  function card(inner) {
    gate.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-top"><span class="logo" aria-hidden="true">CSA</span><b>' + esc(t("title")) + "</b>" +
      '<div class="seg langseg" role="group" aria-label="Idioma / Language">' +
      '<button data-g="lang" data-v="pt" aria-pressed="' + (lang === "pt") + '">PT</button>' +
      '<button data-g="lang" data-v="en" aria-pressed="' + (lang === "en") + '">EN</button></div></div>' +
      '<p class="gate-tag">' + esc(t("tagline")) + "</p>" +
      (notice ? '<p class="gate-msg" role="status">' + esc(notice) + "</p>" : "") +
      inner +
      "</div>";
    var first = gate.querySelector("input");
    if (first) first.focus();
  }

  function field(id, label, type, extra) {
    return (
      '<label class="field" for="' + id + '"><span>' + esc(label) + "</span>" +
      '<input id="' + id + '" type="' + type + '" ' + (extra || "") + " required></label>"
    );
  }

  function showAuth() {
    gate.hidden = false;
    var tabs =
      '<div class="seg gate-tabs" role="group">' +
      '<button data-g="mode" data-v="signin" aria-pressed="' + (mode === "signin") + '">' + esc(t("signin")) + "</button>" +
      '<button data-g="mode" data-v="signup" aria-pressed="' + (mode === "signup") + '">' + esc(t("signup")) + "</button></div>";
    if (mode === "signin") {
      card(
        tabs +
          '<form data-g="signin">' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          field("gPass", t("password"), "password", 'autocomplete="current-password"') +
          '<button class="btn primary big" type="submit">' + esc(t("signin")) + "</button></form>" +
          '<button class="link gate-alt" data-g="mode" data-v="forgot">' + esc(t("forgot")) + "</button>"
      );
    } else if (mode === "signup") {
      card(
        tabs +
          '<form data-g="signup">' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          field("gPass", t("passwordNew"), "password", 'autocomplete="new-password" minlength="8"') +
          field("gCode", t("code"), "text", 'autocomplete="off" autocapitalize="characters" spellcheck="false"') +
          '<p class="gate-help">' + esc(t("codeHelp")) + "</p>" +
          '<button class="btn primary big" type="submit">' + esc(t("signup")) + "</button></form>"
      );
    } else if (mode === "forgot") {
      card(
        '<form data-g="forgot">' +
          field("gEmail", t("email"), "email", 'autocomplete="email"') +
          '<button class="btn primary big" type="submit">' + esc(t("sendReset")) + "</button></form>" +
          '<button class="link gate-alt" data-g="mode" data-v="signin">' + esc(t("back")) + "</button>"
      );
    } else if (mode === "recover") {
      card(
        '<form data-g="recover">' +
          field("gPass", t("newPassword"), "password", 'autocomplete="new-password" minlength="8"') +
          '<button class="btn primary big" type="submit">' + esc(t("savePassword")) + "</button></form>"
      );
    }
  }

  function showUnlock() {
    gate.hidden = false;
    card(
      "<h2>" + esc(t("unlockTitle")) + "</h2><p>" + esc(t("unlockText")) + "</p>" +
        '<form data-g="unlock">' +
        field("gCode", t("code"), "text", 'autocomplete="off" autocapitalize="characters" spellcheck="false"') +
        '<button class="btn primary big" type="submit">' + esc(t("unlock")) + "</button></form>" +
        '<p class="gate-help">' + esc(t("paidSoon")) + "</p>" +
        '<button class="link gate-alt" data-g="signout">' + esc(t("signout")) + "</button>"
    );
  }

  function showMessage(msg) {
    gate.hidden = false;
    notice = msg;
    card('<button class="link gate-alt" data-g="signout">' + esc(t("signout")) + "</button>");
  }

  function showLoading() {
    gate.hidden = false;
    gate.innerHTML = '<div class="gate-card gate-loading"><span class="spin" aria-hidden="true"></span><p>' + esc(t("loading")) + "</p></div>";
  }

  function fail(msg) {
    notice = msg;
    if (gate.querySelector("form")) {
      var m = gate.querySelector(".gate-msg");
      if (m) m.textContent = msg;
      else {
        var p = document.createElement("p");
        p.className = "gate-msg";
        p.setAttribute("role", "status");
        p.textContent = msg;
        gate.querySelector(".gate-tag").after(p);
      }
    }
  }

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

  function hasAccess() {
    return sb
      .from("entitlements")
      .select("cert")
      .eq("cert", CERT)
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
      .then(hasAccess)
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

    var foot = document.querySelector(".side-foot");
    if (foot && !document.getElementById("acct")) {
      var row = document.createElement("div");
      row.className = "row2 acct";
      row.id = "acct";
      var email = session.user.email || "";
      row.innerHTML =
        '<span class="who" title="' + esc(email) + '"><i aria-hidden="true">' + esc((email[0] || "?").toUpperCase()) + "</i>" + esc(email) + "</span>" +
        '<button class="link" data-g="signout" data-en="Sign out">Sair</button>';
      foot.insertBefore(row, foot.firstChild);
    }

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
    gate.innerHTML = '<div class="gate-card"><p class="gate-msg">' + esc(t("noConfig")) + "</p></div>";
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
