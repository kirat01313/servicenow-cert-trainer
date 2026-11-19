(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  try {
    document.documentElement.dataset.theme = localStorage.getItem("csa2-theme") || "light";
  } catch (e) {}
  var root = document.getElementById("admin");
  var QUESTIONS_PER_PART = 90;
  var sb = null;
  var session = null;
  var certs = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function say(msg) {
    root.innerHTML = '<div class="admin-card"><p class="gate-msg">' + esc(msg) + "</p></div>";
  }

  function randomCode(prefix) {
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    var bytes = new Uint32Array(6);
    crypto.getRandomValues(bytes);
    for (var i = 0; i < 6; i++) out += abc[bytes[i] % abc.length];
    return (prefix ? prefix.toUpperCase() + "-" : "") + out;
  }

  function showSignIn(msg) {
    root.innerHTML =
      '<div class="admin-card"><div class="admin-top"><span class="logo">CSA</span><b>Administração</b></div>' +
      (msg ? '<p class="gate-msg">' + esc(msg) + "</p>" : "") +
      '<form id="signin"><label class="field"><span>Email</span><input id="aEmail" type="email" required></label>' +
      '<label class="field"><span>Palavra-passe</span><input id="aPass" type="password" required></label>' +
      '<button class="btn primary big" type="submit">Entrar</button></form></div>';
  }

  function render() {
    var opts = certs
      .map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.id.toUpperCase() + " · " + c.name) + "</option>";
      })
      .join("");
    root.innerHTML =
      '<div class="head"><h1>Administração</h1><span class="sp">' + esc(session.user.email) +
      ' · <a class="link" href="./">Abrir a aplicação</a> · <button class="link" data-a="signout">Sair</button></span></div>' +
      '<section class="panel"><h2>Conteúdo de uma certificação</h2>' +
      '<p class="muted">Escolhe os ficheiros da pasta <code>content/&lt;certificação&gt;/</code> do teu computador. Substituem o conteúdo atual dessa certificação.</p>' +
      '<form id="upload" class="grid-form">' +
      '<label class="field"><span>Certificação</span><select id="uCert">' + opts + "</select></label>" +
      '<label class="field"><span>data.json (questões)</span><input id="uData" type="file" accept=".json" required></label>' +
      '<label class="field"><span>labs.json</span><input id="uLabs" type="file" accept=".json"></label>' +
      '<label class="field"><span>topics.json</span><input id="uTopics" type="file" accept=".json"></label>' +
      '<label class="field"><span>en.json (inglês)</span><input id="uEn" type="file" accept=".json"></label>' +
      '<button class="btn primary" type="submit">Enviar conteúdo</button></form>' +
      '<p class="log" id="uLog"></p></section>' +
      '<section class="panel"><h2>Códigos de acesso</h2>' +
      '<form id="newcode" class="grid-form">' +
      '<label class="field"><span>Certificação</span><select id="cCert">' + opts + "</select></label>" +
      '<label class="field"><span>Nome (ex.: turma UpSkill 2026)</span><input id="cLabel" type="text" required></label>' +
      '<label class="field"><span>Código</span><input id="cCode" type="text" value="' + esc(randomCode("UPSKILL")) + '" required></label>' +
      '<label class="field"><span>Máximo de contas (vazio = sem limite)</span><input id="cMax" type="number" min="1"></label>' +
      '<label class="field"><span>Válido até (opcional)</span><input id="cExp" type="date"></label>' +
      '<button class="btn primary" type="submit">Criar código</button></form>' +
      '<div id="codes" style="margin-top:16px"><p class="muted">A carregar…</p></div></section>';
    loadCodes();
  }

  function loadCodes() {
    Promise.all([
      sb.from("access_codes").select("*").order("created_at", { ascending: false }),
      sb.from("entitlements").select("cert"),
    ]).then(function (r) {
      var box = document.getElementById("codes");
      if (r[0].error) {
        box.innerHTML = '<p class="muted">Erro: ' + esc(r[0].error.message) + "</p>";
        return;
      }
      var perCert = {};
      (r[1].data || []).forEach(function (e) {
        perCert[e.cert] = (perCert[e.cert] || 0) + 1;
      });
      var rows = (r[0].data || [])
        .map(function (c) {
          return (
            "<tr><td><code>" + esc(c.code) + "</code></td><td>" + esc(c.cert.toUpperCase()) + "</td><td>" + esc(c.label || "") +
            "</td><td>" + c.uses + (c.max_uses ? " / " + c.max_uses : "") + "</td><td>" +
            (c.expires_at ? esc(new Date(c.expires_at).toLocaleDateString("pt-PT")) : "—") + "</td><td>" +
            '<button class="btn" data-a="toggle" data-code="' + esc(c.code) + '" data-on="' + (c.active ? 1 : 0) + '">' +
            (c.active ? "Desativar" : "Ativar") + "</button></td></tr>"
          );
        })
        .join("");
      var totals = Object.keys(perCert)
        .map(function (k) {
          return k.toUpperCase() + ": " + perCert[k];
        })
        .join(" · ");
      box.innerHTML =
        '<p class="muted">Contas com acesso — ' + esc(totals || "nenhuma ainda") + "</p>" +
        (rows
          ? "<table><thead><tr><th>Código</th><th>Cert.</th><th>Nome</th><th>Usos</th><th>Válido até</th><th></th></tr></thead><tbody>" + rows + "</tbody></table>"
          : '<p class="muted">Ainda não há códigos.</p>');
    });
  }

  function readJson(input) {
    var f = input && input.files && input.files[0];
    if (!f) return Promise.resolve(null);
    return f.text().then(function (txt) {
      return JSON.parse(txt);
    });
  }

  function upload(form) {
    var log = document.getElementById("uLog");
    var line = function (s) {
      log.textContent += s + "\n";
    };
    log.textContent = "";
    var cert = form.querySelector("#uCert").value;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    Promise.all(["#uData", "#uLabs", "#uTopics", "#uEn"].map(function (id) {
      return readJson(form.querySelector(id));
    }))
      .then(function (files) {
        var data = files[0];
        if (!data || !Array.isArray(data.questions)) throw new Error("O data.json não tem a lista de questões.");
        var rows = [{ cert: cert, key: "data.meta", data: { meta: data.meta, domains: data.domains } }];
        for (var i = 0, p = 0; i < data.questions.length; i += QUESTIONS_PER_PART, p++) {
          rows.push({ cert: cert, key: "data.q" + p, data: data.questions.slice(i, i + QUESTIONS_PER_PART) });
        }
        var parts = rows.length - 1;
        if (files[1]) rows.push({ cert: cert, key: "labs", data: files[1] });
        if (files[2]) rows.push({ cert: cert, key: "topics", data: files[2] });
        if (files[3]) rows.push({ cert: cert, key: "en", data: files[3] });
        line(data.questions.length + " questões em " + parts + " partes.");
        var chain = Promise.resolve();
        rows.forEach(function (row) {
          chain = chain.then(function () {
            row.updated_at = new Date().toISOString();
            return sb.from("cert_content").upsert(row).then(function (r) {
              if (r.error) throw new Error(row.key + ": " + r.error.message);
              line("✓ " + row.key);
            });
          });
        });
        return chain.then(function () {
          return sb.from("cert_content").select("key").eq("cert", cert).like("key", "data.q%").then(function (r) {
            var old = (r.data || []).map(function (x) {
              return x.key;
            }).filter(function (k) {
              return parseInt(k.slice(6), 10) >= parts;
            });
            if (!old.length) return;
            return sb.from("cert_content").delete().eq("cert", cert).in("key", old).then(function () {
              line("Apagadas partes antigas: " + old.join(", "));
            });
          });
        });
      })
      .then(function () {
        line("Concluído.");
      })
      .catch(function (e) {
        line("Erro: " + e.message);
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  function createCode(form) {
    var exp = form.querySelector("#cExp").value;
    var max = form.querySelector("#cMax").value;
    var row = {
      code: form.querySelector("#cCode").value.trim().toUpperCase(),
      cert: form.querySelector("#cCert").value,
      label: form.querySelector("#cLabel").value.trim(),
      max_uses: max ? parseInt(max, 10) : null,
      expires_at: exp ? new Date(exp + "T23:59:59").toISOString() : null,
    };
    sb.from("access_codes").insert(row).then(function (r) {
      if (r.error) {
        alert("Não consegui criar o código: " + r.error.message);
        return;
      }
      form.querySelector("#cLabel").value = "";
      form.querySelector("#cCode").value = randomCode("UPSKILL");
      loadCodes();
    });
  }

  document.addEventListener("submit", function (ev) {
    var f = ev.target;
    ev.preventDefault();
    if (f.id === "signin") {
      sb.auth
        .signInWithPassword({ email: f.querySelector("#aEmail").value, password: f.querySelector("#aPass").value })
        .then(function (r) {
          if (r.error) throw r.error;
          start(r.data.session);
        })
        .catch(function (e) {
          showSignIn(e.message);
        });
    } else if (f.id === "upload") upload(f);
    else if (f.id === "newcode") createCode(f);
  });

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-a]");
    if (!el) return;
    if (el.dataset.a === "signout") {
      sb.auth.signOut().then(function () {
        location.reload();
      });
    } else if (el.dataset.a === "toggle") {
      sb.from("access_codes")
        .update({ active: el.dataset.on !== "1" })
        .eq("code", el.dataset.code)
        .then(loadCodes);
    }
  });

  function start(s) {
    session = s;
    sb.from("admins")
      .select("user_id")
      .maybeSingle()
      .then(function (r) {
        if (r.error || !r.data) {
          say("Esta conta não é de administração. Junta o teu utilizador à tabela admins no Supabase (ver README).");
          return;
        }
        return sb
          .from("certifications")
          .select("id,name,active,sort")
          .order("sort")
          .then(function (c) {
            certs = c.data || [];
            render();
          });
      });
  }

  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
    say("Falta o ficheiro js/config.js com o endereço e a chave do Supabase.");
    return;
  }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) start(r.data.session);
    else showSignIn("");
  });
})();
