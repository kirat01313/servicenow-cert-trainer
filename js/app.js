(function(){
"use strict";
var DAY=864e5, KEY="csa2", OLDKEY="csa-treino-v1", EXKEY="csa2-ex-doc";
var INT={1:0,2:1,3:3,4:7,5:16};
/* idioma: "pt" (por omissão) ou "en". L(pt,en) devolve o texto no idioma atual. */
var LANG=(function(){try{return localStorage.getItem("csa2-lang")==="en"?"en":"pt";}catch(e){return "pt";}})();
function TL(p,e){return LANG==="en"?e:p;}
function LOC(){return LANG==="en"?"en-GB":"pt-PT";}
var OFFLINE=!!window.CSA_OFFLINE;
var WEB=!!window.CSA_WEB;
var CONF, TIPS;
function i18nConsts(){
  CONF={s:TL("Tenho a certeza","I’m sure"),a:TL("Acho que sim","I think so"),p:TL("Palpite","Guess"),n:TL("Não sei","Don’t know"),x:TL("Simulado","Practice exam")};
  TIPS=[TL("Levanta-te e mexe-te um pouco.","Get up and move around a bit."),TL("Olha para algo ao longe durante 20 segundos.","Look at something far away for 20 seconds."),TL("Bebe água.","Drink some water."),TL("Deixa o telemóvel de lado: a pausa também conta.","Put your phone away: the break counts too.")];
}
var POMO={"25/5":{f:25,b:5,l:15},"50/10":{f:50,b:10,l:20}};
i18nConsts();
var D=null, Q={}, W={}, DN={}, view="hoje";
var ui={lab:null, assets:null, sel:[], done:false, last:null, size:20, resultAt:null, examConfirm:false, examGrid:false, sample:null, ctl:null, armed:null};
var sync={db:null, uid:null, state:"local", at:0};
var $=function(id){return document.getElementById(id);};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function pad(n){return (n<10?"0":"")+n;}
function dkey(t){var d=new Date(t||Date.now());return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function sod(t){var d=new Date(t);d.setHours(0,0,0,0);return +d;}
function eod(){var d=new Date();d.setHours(23,59,59,999);return +d;}
function mmss(ms){ms=Math.max(0,Math.round(ms/1000));return pad(Math.floor(ms/60))+":"+pad(ms%60);}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function same(a,b){if(a.length!==b.length)return false;a=a.slice().sort();b=b.slice().sort();return a.every(function(x,i){return x===b[i];});}
function pct(a,b){return b?Math.round(100*a/b):0;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function when(due){var d=Math.round((sod(due)-sod(Date.now()))/DAY);return d<=0?TL("ainda hoje","later today"):d===1?TL("amanhã","tomorrow"):TL("daqui a ","in ")+d+TL(" dias"," days");}

/* ---------------- estado local ---------------- */
function blank(){return {v:2,p:{},cal:{s:[0,0],a:[0,0],p:[0,0]},days:{},exams:[],log:[],cfg:{newPerDay:15,sessMax:60,pomo:"25/5",dep:false,examDate:""},sess:null,exam:null,pomo:{mode:"idle",running:false,endsAt:0,remain:0,cycle:0}};}
function loadLocal(){
  var s=null,b=blank();
  try{s=JSON.parse(localStorage.getItem(KEY));}catch(e){}
  if(s&&s.v===2){for(var k in b){if(s[k]===undefined)s[k]=b[k];} s.cfg=Object.assign(b.cfg,s.cfg||{}); s.pomo=Object.assign(b.pomo,s.pomo||{}); return s;}
  try{var old=JSON.parse(localStorage.getItem(OLDKEY)),now=Date.now();
    if(old){for(var id in old){var ok=old[id]==="ok";b.p[id]={b:ok?2:1,due:ok?sod(now)+DAY:now,n:1,k:ok?1:0,l:ok?1:0,c:"a",h:ok?"1":"0",t:now-1};}}}catch(e){}
  return b;
}
var S=loadLocal();
if(fixRetries())saveLocal();
if(S.exam)S.exam.vt=Date.now();
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function day(k){k=k||dkey();return S.days[k]||(S.days[k]={q:0,ok:0,nw:0,pomo:0,min:0});}

/* ---------------- sincronização com a conta ---------------- */
var dirty={}, chain=Promise.resolve(), ftimer=null, retried={};
function markDirty(k){dirty[k]=1;saveLocal();if(!sync.db)return;clearTimeout(ftimer);ftimer=setTimeout(flush,1500);}
function flush(){var ks=Object.keys(dirty);dirty={};ks.forEach(function(k){chain=chain.then(function(){return writeDoc(k);});});}
function ref(k){return sync.db.collection("data/users/"+sync.uid).doc(k);}
function pruneDays(d){var keys=Object.keys(d).sort().slice(-150),o={};keys.forEach(function(k){o[k]=d[k];});return o;}
function writeDoc(k){
  if(!sync.db)return Promise.resolve();
  if(k==="l")return writeLog();
  var body=k==="p"?{p:S.p,cal:S.cal,t:Date.now(),ex:S.cfg.examDate||"",ext:S.cfg.exT||0}:k==="d"?{d:pruneDays(S.days)}:{list:S.exams.slice(-30)};
  var name=k==="p"?"progress":k==="d"?"days":"exams";
  return ref(name).set(body).then(function(){retried[k]=0;sync.state="cloud";sync.at=Date.now();paintSync();})
  .catch(function(e){
    var c=e&&e.code;
    if(c==="unavailable"&&!retried[k]){retried[k]=1;setTimeout(function(){dirty[k]=1;flush();},1500+Math.random()*2500);return;}
    if(c==="invalid_argument"||c==="revoked"||c==="not_granted"){sync.db=null;sync.state="local";}
    else sync.state="error";
    paintSync();
  });
}
function initSync(){
  if(!window.claude||!window.claude.use)return;
  Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){
    var db=r[0],user=r[1]; if(!db||!user)return null;
    return user.id().then(function(uid){ if(!uid)return null; sync.db=db; sync.uid=uid; return true; });
  }).then(function(ok){
    if(!ok)return;
    sync.state="syncing"; paintSync();
    var slow=setTimeout(function(){if(sync.state==="syncing"){sync.state="slow";paintSync();}},10000);
    return Promise.all([ref("progress").get(),ref("days").get(),ref("exams").get()].concat(logMonths().map(function(m){return ref("log-"+m).get();}))).then(function(r){
      clearTimeout(slow);
      var needP=mergeP(r[0].exists?clone(r[0].data()||{}):{});
      var needD=mergeDays(r[1].exists?clone((r[1].data()||{}).d||{}):{});
      var needE=mergeExams(r[2].exists?clone((r[2].data()||{}).list||[]):[]);
      var needL=mergeLog(r.slice(3).map(function(x){return x.exists?((x.data()||{}).l||[]):[];}));
      if(fixRetries())needP=true;
      saveLocal();
      if(needP)dirty.p=1; if(needD)dirty.d=1; if(needE)dirty.e=1; if(needL)dirty.l=1;
      sync.state="cloud"; sync.at=Date.now();
      if(Object.keys(dirty).length)flush();
      paintSync(); if(D)render(); loadLabsRemote();
    }).catch(function(e){clearTimeout(slow);sync.state=(e&&(e.code==="not_granted"||e.code==="revoked"))?"local":"error";if(sync.state==="local")sync.db=null;paintSync();});
  }).catch(function(){});
}
function mergeP(remote){
  var rp=remote.p||{}, need=false, id;
  if(remote.ext&&(remote.ext>(S.cfg.exT||0))){S.cfg.examDate=remote.ex||"";S.cfg.exT=remote.ext;}else if((S.cfg.exT||0)>(remote.ext||0))need=true;
  for(id in rp){if(!S.p[id]||(rp[id].t||0)>(S.p[id].t||0))S.p[id]=rp[id];}
  for(id in S.p){if(!rp[id]||(S.p[id].t||0)>(rp[id].t||0))need=true;}
  var rc=remote.cal||{};
  if(rc.fx&&!S.cal.fx){S.cal=clone(rc);return need;}
  if(S.cal.fx&&!rc.fx&&remote.p)return true;
  ["s","a","p"].forEach(function(c){var r=rc[c]||[0,0],l=S.cal[c]||[0,0];
    if(l[1]>r[1])need=true; S.cal[c]=[Math.max(l[0],r[0]),Math.max(l[1],r[1])];});
  return need;
}
function mergeDays(rd){
  var need=false,k,f;
  for(k in rd){var l=S.days[k]||(S.days[k]={q:0,ok:0,nw:0,pomo:0,min:0});for(f in rd[k]){l[f]=Math.max(l[f]||0,rd[k][f]||0);}}
  for(k in S.days){if(!rd[k]){need=true;continue;}for(f in S.days[k]){if((S.days[k][f]||0)>(rd[k][f]||0))need=true;}}
  return need;
}
function mergeExams(list){
  var have={},need=false;S.exams.forEach(function(e){have[e.at]=1;});
  var rem={};list.forEach(function(e){rem[e.at]=1;if(!have[e.at])S.exams.push(e);});
  S.exams.forEach(function(e){if(!rem[e.at])need=true;});
  S.exams.sort(function(a,b){return a.at-b.at;});
  return need;
}
// histórico de respostas: um documento por mês ("log-AAAA-MM"), cada entrada [quando, questão, certa, confiança, ms, origem]
function logMonths(){var o=[],d=new Date();for(var i=0;i<6;i++){var x=new Date(d.getFullYear(),d.getMonth()-i,1);o.push(x.getFullYear()+"-"+pad(x.getMonth()+1));}return o;}
function monthOf(t){var d=new Date(t);return d.getFullYear()+"-"+pad(d.getMonth()+1);}
function writeLog(){var m=monthOf(Date.now()),l=(S.log||[]).filter(function(e){return monthOf(e[0])===m;}).slice(-5000);
  return ref("log-"+m).set({l:l}).then(function(){sync.state="cloud";sync.at=Date.now();paintSync();}).catch(function(e){var c=e&&e.code;if(c==="unavailable"){setTimeout(function(){dirty.l=1;flush();},3000);return;}sync.state="error";paintSync();});}
function mergeLog(lists){var have={},need=false;S.log=S.log||[];S.log.forEach(function(e){have[e[0]+"_"+e[1]]=1;});var rem={};
  lists.forEach(function(l){l.forEach(function(e){var k=e[0]+"_"+e[1];rem[k]=1;if(!have[k]){S.log.push(e);have[k]=1;}});});
  var m=monthOf(Date.now());S.log.forEach(function(e){if(monthOf(e[0])===m&&!rem[e[0]+"_"+e[1]])need=true;});
  S.log.sort(function(a,b){return a[0]-b[0];});if(S.log.length>8000)S.log=S.log.slice(-8000);return need;}
function logPush(id,ok,conf,ms,src){S.log=S.log||[];S.log.push([Date.now(),id,ok?1:0,conf,Math.round(Math.min(ms||0,600000)),src]);if(S.log.length>8000)S.log=S.log.slice(-8000);markDirty("l");}
function paintSync(){
  var el=document.querySelector("[data-sync]"); if(!el)return;
  el.textContent=syncText();
}
function syncText(){
  if(WEB&&sync.state==="local")return TL("O progresso fica guardado neste browser até a ligação à tua conta voltar.","Your progress is kept in this browser until the connection to your account comes back.");
  if(WEB&&sync.state==="cloud")return TL("Progresso guardado na tua conta: continua noutro computador ou no telemóvel.","Progress saved to your account: carry on from another computer or your phone.");
  if(OFFLINE&&sync.state==="local")return TL("O progresso fica guardado neste browser, neste computador. Se limpares os dados do browser, perde-se: exporta-o de vez em quando.","Your progress is saved in this browser, on this computer. If you clear the browser data, it’s lost: export it from time to time.");
  return {local:TL("O progresso fica guardado neste browser. Abre a app com sessão iniciada no Claude para o guardar na tua conta.","Your progress is saved in this browser. Open the app signed in to Claude to save it to your account."),
    syncing:TL("A sincronizar com a tua conta…","Syncing with your account…"),
    cloud:TL("Progresso guardado na tua conta — continua no telemóvel ou noutro computador.","Progress saved to your account — carry on from your phone or another computer."),
    slow:TL("A tua conta ainda não respondeu. Entretanto, o progresso fica guardado neste browser.","Your account hasn’t responded yet. Meanwhile, your progress is saved in this browser."),
    error:TL("Não consegui guardar na tua conta. O progresso continua guardado neste browser.","Couldn’t save to your account. Your progress is still saved in this browser.")}[sync.state];
}

/* ---------------- conjuntos de questões ---------------- */
/* bancos de questões: Deloitte (o do curso) e ExamBase (src "x", questões extra revistas pela turma).
   pool(false) é sempre o banco Deloitte sem deprecated: é o que conta para estatísticas, índice, prontidão e ranking. */
function isX(q){return q.src==="x";}
function hasX(){return !!(D&&D.questions.some(isX));}
function bankSel(){var b=S.cfg.bank;return hasX()&&(b==="x"||b==="all")?b:"d";}
function inBank(q,b){b=b||bankSel();return b==="all"||(b==="x"?isX(q):!isX(q));}
function pool(dep){if(dep===false)return D.questions.filter(function(q){return q.scorable&&!q.dep&&!isX(q);});var inc=dep===undefined?S.cfg.dep:dep;return D.questions.filter(function(q){return q.scorable&&(inc||!q.dep)&&inBank(q);});}
function examPool(){return D.questions.filter(function(q){return q.scorable&&!q.dep&&inBank(q);});}
function srcTag(q){return hasX()?(isX(q)?'<span class="tag bk bk-x">ExamBase</span>':'<span class="tag bk bk-d">Deloitte</span>'):"";}
function bankFieldHTML(where){
  if(!hasX())return "";
  var dep=where==="exam"?false:S.cfg.dep, b=bankSel();
  function cnt(k){return D.questions.filter(function(q){return q.scorable&&(dep||!q.dep)&&inBank(q,k);}).length;}
  function btn(k,l){return '<button data-act="bank" data-v="'+k+'" aria-pressed="'+(b===k)+'">'+l+' <span class="bk-n">'+cnt(k)+"</span></button>";}
  var help=TL("Deloitte: o banco de questões do curso. ExamBase: questões extra de um site público de prática (exambase.com), que não estavam no banco Deloitte, revistas pela turma e confirmadas na documentação oficial sempre que possível. Cada questão mostra de que banco vem. As estatísticas, o índice, a prontidão e o ranking contam só o banco Deloitte, para serem comparáveis entre colegas.",
    "Deloitte: the course question bank. ExamBase: extra questions from a public practice site (exambase.com) that weren’t in the Deloitte bank, reviewed by the class and checked against the official docs whenever possible. Each question shows which bank it comes from. Stats, the index, readiness and the ranking count the Deloitte bank only, so they stay comparable between classmates.");
  return '<div class="field bankf"><span>'+TL("Banco de questões","Question bank")+info(help)+'</span><div class="seg fmtseg" role="group" aria-label="'+TL("Banco de questões","Question bank")+'">'+
    btn("d","Deloitte")+btn("x","ExamBase")+btn("all",TL("Ambos","Both"))+"</div>"+
    (b!=="d"&&(where==="exam"||where==="mk")?'<p class="small faint bk-note">'+TL("Com questões ExamBase, o simulado não conta para o índice nem para o ranking.","With ExamBase questions, the practice exam doesn’t count towards the index or the ranking.")+"</p>":"")+
    (b!=="d"&&where==="train"?'<p class="small faint bk-note">'+TL("As estatísticas e o ranking continuam a contar só o banco Deloitte.","Stats and the ranking still count the Deloitte bank only.")+"</p>":"")+"</div>";
}
function rec(id){return S.p[id];}
function dueList(){var e=eod();return pool().filter(function(q){var r=rec(q.id);return r&&r.n>0&&r.due<=e;}).sort(function(a,b){return rec(a.id).due-rec(b.id).due;});}
function freshList(){return pool().filter(function(q){var r=rec(q.id);return !r||!r.n;});}
function hcList(){return pool().filter(function(q){var r=rec(q.id);return r&&r.hcOpen;});}
function wrongList(){return pool().filter(function(q){var r=rec(q.id);return r&&r.n&&!r.l;});}
function pickWeighted(list,n){
  var by={},out=[];list.forEach(function(q){(by[q.d]=by[q.d]||[]).push(q);});
  for(var k in by)shuffle(by[k]);
  while(out.length<n){
    var ds=Object.keys(by).filter(function(k){return by[k].length;});if(!ds.length)break;
    var tot=ds.reduce(function(s,k){return s+W[k];},0),r=Math.random()*tot,pick=ds[0];
    for(var i=0;i<ds.length;i++){r-=W[ds[i]];if(r<=0){pick=ds[i];break;}}
    out.push(by[pick].pop());
  }
  return out;
}
function interleave(ids){
  for(var i=1;i<ids.length;i++){if(Q[ids[i]].sub===Q[ids[i-1]].sub){
    for(var j=i+1;j<ids.length;j++){if(Q[ids[j]].sub!==Q[ids[i-1]].sub){var t=ids[i];ids[i]=ids[j];ids[j]=t;break;}}}}
  return ids;
}
function sessMax(){return S.cfg.sessMax>0?S.cfg.sessMax:60;}
function smartIds(){
  if(ui.smartCache&&ui.smartCache.t>Date.now()-5000)return ui.smartCache.ids.slice();
  var due=dueList(), wrong=due.filter(function(q){return !rec(q.id).l;}), rest=due.filter(function(q){return rec(q.id).l;}).map(function(q){return q.id;});
  wrong.sort(function(a,b){var ra=rec(a.id),rb=rec(b.id);return (rb.hcOpen?1:0)-(ra.hcOpen?1:0)||(rb.n-rb.k)-(ra.n-ra.k)||ra.due-rb.due;});
  var quota=Math.max(0,S.cfg.newPerDay-(day().nw||0));
  var fresh=pickWeighted(freshList(),quota).map(function(q){return q.id;});
  var max=sessMax(), base=rest.length+fresh.length, cap=wrongCap(), wn=base?Math.min(wrong.length,Math.ceil(base*cap/(1-cap))):Math.min(wrong.length,max);
  if(base+wn>max){
    /* limite da sessão: erradas até ao teto (erros confiantes primeiro), depois as revisões mais atrasadas, depois as novas */
    wn=Math.min(wn,Math.round(max*cap));
    var slots=max-wn; rest=rest.slice(0,slots); fresh=fresh.slice(0,slots-rest.length);
  }
  var ids=interleave(shuffle(rest.concat(fresh,wrong.slice(0,wn).map(function(q){return q.id;}))));
  ui.smartCache={t:Date.now(),ids:ids};return ids.slice();
}

/* ---------------- registo e calendário de revisão ---------------- */
function record(q,correct,conf,ms,src){
  var r=S.p[q.id]||(S.p[q.id]={b:0,n:0,k:0}), first=!r.n, now=Date.now(), b=r.b||0, nb;
  r.n=(r.n||0)+1; if(correct)r.k=(r.k||0)+1; r.l=correct?1:0; r.c=conf;
  r.h=((r.h||"")+(correct?"1":"0")).slice(-6);
  if(conf==="x"){ if(!correct){r.b=1;r.due=now;} else if(b===0){r.b=2;r.due=sod(now)+DAY;} }
  else{
    if(!correct)nb=1;
    else if(conf==="p")nb=Math.max(1,b);
    else if(conf==="a")nb=Math.min(5,Math.max(1,b)+1);
    else nb=Math.min(5,Math.max(1,b)+(b===0?2:1));
    r.b=nb;
    var iv=conf==="p"?1:ivDays(nb); if((r.n-(r.k||0))>=2&&iv>1)iv=Math.max(1,Math.round(iv*0.6));
    r.due=correct?sod(now)+iv*DAY:now;
  }
  if(!correct&&conf==="s"){r.hc=(r.hc||0)+1;r.hcOpen=1;}
  if(correct&&conf!=="p")r.hcOpen=0;
  if(conf==="s"||conf==="a"||conf==="p"){S.cal[conf][1]++;if(correct)S.cal[conf][0]++;}
  r.t=now;
  var d=day();d.q++;if(correct)d.ok++;if(first)d.nw++;
  logPush(q.id,correct,conf,ms,src||"t"); ui.smartCache=null;
  markDirty("p");markDirty("d");
  return r;
}
// repetição na mesma sessão: já viste a resposta, por isso não conta para estatísticas nem sobe de caixa
function retry(q,correct){
  var r=S.p[q.id],now=Date.now();
  if(correct)r.due=sod(now)+DAY;
  r.t=now; markDirty("p");
  return r;
}
// correção única: até 05/11/2026 as repetições na sessão contavam como tentativas novas
function fixRetries(){
  if(S.cal.fx||!Object.keys(S.p).length)return false;
  var now=Date.now();
  for(var id in S.p){var r=S.p[id];
    if(r.n>=2&&/01$/.test(r.h||"")){
      if(r.c==="s"||r.c==="a"||r.c==="p"){var v=S.cal[r.c];if(v&&v[0]>0&&v[1]>0){v[0]--;v[1]--;}}
      r.n--;r.k=Math.max(0,(r.k||0)-1);r.h=r.h.slice(0,-1);r.l=0;r.b=1;
      r.due=Math.max(now,sod(r.t)+DAY);r.t=now;
    }}
  S.cal.fx=1; return true;
}

/* ---------------- sessões de treino ---------------- */
var DEATH_MAX=18;
function deathTag(s){return s.mode==="death"?'<span class="tag death"'+((s.errs||0)>=DEATH_MAX-3?' style="background:color-mix(in srgb,var(--bad) 14%,var(--surface));color:var(--bad)"':"")+'>'+TL("Erros ","Mistakes ")+(s.errs||0)+"/"+DEATH_MAX+"</span>":"";}
function deathHTML(s,n){
  if(s.mode!=="death")return "";
  var tot=s.total||s.q.length, errs=s.errs||0, msg;
  if(s.dead)msg='<b>'+TL("Caíste ao ","You fell at mistake ")+DEATH_MAX+TL(".º erro","")+"</b>"+TL(", na questão ",", on question ")+s.dead+TL(" de "," of ")+tot+".";
  else if(n>=tot)msg='<b>'+TL("Sobreviveste!","You survived!")+"</b> "+TL("Respondeste às ","You answered all ")+tot+TL(" questões com "," questions with ")+errs+(errs===1?TL(" erro."," mistake."):TL(" erros."," mistakes."));
  else msg='<b>'+TL("Paraste na questão ","You stopped at question ")+n+TL(" de "," of ")+tot+"</b>"+TL(", com ",", with ")+errs+(errs===1?TL(" erro."," mistake."):TL(" erros."," mistakes."));
  return '<section class="panel" style="grid-column:1/-1"><p class="lbl">'+TL("Morte súbita","Sudden death")+'</p><div class="verdict '+(s.dead?"no":n>=tot?"ok":"nt")+'" style="margin:0">'+msg+"</div></section>";
}
function startSession(mode,label,ids){
  if(!ids.length){toast(TL("Não há questões para esta sessão.","There are no questions for this session."));return;}
  S.sess={mode:mode,label:label,q:ids,i:0,res:{},rq:{},log:{},at:Date.now()};
  if(mode==="death"){S.sess.errs=0;S.sess.total=ids.length;}
  ui.sel=[];ui.done=false;ui.last=null;ui.peek=null;saveLocal();
  if(location.hash!=="#treino")location.hash="#treino";else render();
  window.scrollTo(0,0);
}
function startMode(m){
  var n=ui.size>=999?99999:ui.size, ids;
  if(m==="smart")return startSession("smart",TL("Sessão de hoje","Today’s session"),smartIds());
  if(m==="due")return startSession("due",TL("Revisões em atraso","Overdue reviews"),interleave(shuffle(dueList().map(function(q){return q.id;}))).slice(0,n));
  if(m==="hc")return startSession("hc",TL("Erros confiantes","Confident mistakes"),shuffle(hcList().map(function(q){return q.id;})).slice(0,n));
  if(m==="wrong")return startSession("wrong",TL("Questões que errei","Questions I got wrong"),interleave(shuffle(wrongList().map(function(q){return q.id;}))).slice(0,n));
  if(m==="fresh")return startSession("fresh",TL("Questões novas","New questions"),interleave(pickWeighted(freshList(),Math.min(n,freshList().length)).map(function(q){return q.id;})));
  if(m==="dom"){
    var dv=($("selD")||{}).value||"",sv=($("selS")||{}).value||"";
    var l=pool().filter(function(q){return (!dv||String(q.d)===dv)&&(!sv||q.sub===sv);});
    var lab=sv?sv:dv?("D"+dv+" · "+DN[dv]):TL("Todos os domínios","All domains");
    return startSession("dom",lab,shuffle(l.map(function(q){return q.id;})).slice(0,n));
  }
  if(m==="mod")return trainMod(($("selM")||{}).value||mods()[0]);
  if(m==="redo"){var s0=S.sess;if(!s0)return;var w=sessEntries(s0).filter(function(e){return !e.ok;}).map(function(e){return e.id;}).filter(function(id,i,a){return a.indexOf(id)===i;});return startSession("redo",TL("Bloco final: refazer as erradas","Final block: redo the wrong ones"),shuffle(w));}
  if(m==="mix")return startSession("mix",TL("Todas, misturadas","All, shuffled"),interleave(shuffle(pool().map(function(q){return q.id;}))).slice(0,n));
}
// módulo do SNAF = módulo da secção do guia que melhor corresponde à questão
function modOf(q){return q.refs&&q.refs[0]?q.refs[0].m:"";}
function mods(){var o={};pool(false).forEach(function(q){var m=modOf(q);if(m)o[m]=1;});return Object.keys(o).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);});}
function modName(m){return TL("Módulo ","Module ")+m.replace(" - "," · ");}
function trainMod(m){var n=ui.size>=999?99999:ui.size;
  return startSession("mod",modName(m),shuffle(pool().filter(function(q){return modOf(q)===m;}).map(function(q){return q.id;})).slice(0,n));}
function curQ(){var s=S.sess;return s&&s.i<s.q.length?Q[s.q[s.i]]:null;}
function toggleOpt(i){
  var q=curQ(); if(!q||ui.done||!q.opts[i])return;
  var k=ui.sel.indexOf(i);
  if(k>=0)ui.sel.splice(k,1);
  else if(!q.multi)ui.sel=[i];
  else{ if(ui.sel.length>=q.ans.length)ui.sel.shift(); ui.sel.push(i); }
  document.querySelectorAll(".qcard .opt").forEach(function(b){b.setAttribute("aria-pressed",ui.sel.indexOf(+b.dataset.v)>=0?"true":"false");});
  var ready=ui.sel.length===q.ans.length;
  document.querySelectorAll(".cbtn").forEach(function(b){b.disabled=!ready;});
}
/* tempo por questão: tempo real desde que a questão abre até Verificar (mudar de aba não pára; teto de 10 min).
   O início fica na sessão guardada, por isso sobrevive a recarregar a página. */
var QT_MAX=600000;
function qtStart(id){var s=S.sess;if(ui.qt&&ui.qt.id===id)return;
  if(s&&s.qt&&s.qt.id===id&&s.qt.i===s.i){ui.qt=s.qt;return;}
  ui.qt={id:id,i:s?s.i:0,since:Date.now()};if(s){s.qt=ui.qt;saveLocal();}}
function qtElapsed(){var t=ui.qt;return t?Math.min(Date.now()-t.since,QT_MAX):0;}
function qtStop(){var ms=qtElapsed();ui.qt=null;if(S.sess)S.sess.qt=null;return ms;}
function paintQClock(){var el=$("qClock");if(!el||!ui.qt)return;var ms=qtElapsed();el.textContent=mmss(ms)+(ms>=QT_MAX?"+":"");el.classList.toggle("slow",ms>90000);}
function verify(conf){
  var q=curQ(); if(!q||ui.done)return;
  if(conf!=="n"&&ui.sel.length!==q.ans.length)return;
  var chosen=conf==="n"?[]:ui.sel.map(function(i){return q.opts[i].letter;});
  var correct=conf!=="n"&&same(chosen,q.ans);
  var ms=qtStop();
  var repeat=S.sess.mode==="redo"||!!S.sess.res[q.id];
  var r=repeat?retry(q,correct):record(q,correct,conf,ms,"t");
  if(!repeat)S.sess.res[q.id]={c:correct,f:conf};
  S.sess.log=S.sess.log||{}; S.sess.log[S.sess.i]={ch:chosen,c:correct,f:conf,ms:ms};
  if(S.sess.mode==="death"&&!correct){S.sess.errs=(S.sess.errs||0)+1;if(S.sess.errs>=DEATH_MAX){S.sess.dead=S.sess.i+1;S.sess.q=S.sess.q.slice(0,S.sess.i+1);}}
  ui.done=true; ui.last={id:q.id,chosen:chosen,correct:correct,conf:conf,due:r.due,repeat:repeat,ms:ms};
  if(!repeat)snapDay();
  saveLocal(); render();
  var nb=$("nextBtn"); if(nb)nb.focus({preventScroll:true});
}
function next(){
  if(!S.sess)return;
  S.sess.i++; ui.sel=[]; ui.done=false; ui.last=null; ui.qt=null; if(S.sess)S.sess.qt=null; saveLocal(); render(); window.scrollTo({top:0});
}

/* ---------------- simulado ---------------- */
function startExam(opt){
  var strict=examPool(), ids=[], mins=D.meta.exam.minutes;
  if(opt&&opt.ids){ids=opt.ids.slice();mins=opt.min;}
  else{
    D.domains.forEach(function(d){
      var n=Math.round(60*d.w/100), inD=strict.filter(function(q){return q.d===d.id;});
      var wr=shuffle(inD.filter(function(q){var r=rec(q.id);return r&&r.n&&!r.l;})).slice(0,Math.round(n*0.3));
      wr.forEach(function(q){ids.push(q.id);});
      shuffle(inD.filter(function(q){return ids.indexOf(q.id)<0;})).slice(0,n-wr.length).forEach(function(q){ids.push(q.id);});
    });
    if(ids.length<60){shuffle(strict.filter(function(q){return ids.indexOf(q.id)<0;})).slice(0,60-ids.length).forEach(function(q){ids.push(q.id);});}
    if(ids.length<60)mins=Math.max(1,Math.round(ids.length*1.5));
  }
  var now=Date.now();
  S.exam={bank:bankSel(),at:now,ends:now+mins*60e3,q:shuffle(ids),a:{},m:{},i:0,t:{},vt:now,min:mins,label:opt&&opt.label||""};
  ui.examConfirm=false; ui.examGrid=false; ui.resultAt=null;
  if(S.pomo.running&&S.pomo.mode==="focus"){pomoPause();toast(TL("O Pomodoro ficou em pausa: o exame real são 90 minutos seguidos.","The Pomodoro has been paused: the real exam is 90 minutes in one go."));}
  saveLocal();
  if(location.hash!=="#simulado")location.hash="#simulado";else render();
  window.scrollTo(0,0);
}
function exQ(){var e=S.exam;return e?Q[e.q[e.i]]:null;}
function examToggle(i){
  var e=S.exam,q=exQ(); if(!q||!q.opts[i])return;
  var L=q.opts[i].letter, a=(e.a[q.id]||[]).slice(), k=a.indexOf(L);
  if(k>=0)a.splice(k,1); else if(!q.multi)a=[L]; else{ if(a.length>=q.ans.length)a.shift(); a.push(L); }
  if(a.length)e.a[q.id]=a; else delete e.a[q.id];
  saveLocal();
  document.querySelectorAll(".qcard .opt").forEach(function(b){var o=q.opts[+b.dataset.v];b.setAttribute("aria-pressed",o&&a.indexOf(o.letter)>=0?"true":"false");});
  paintExamTop();
}
// tempo passado na questão que está no ecrã (cada visita conta no máximo 10 min, para não somar o tempo com a página fechada)
function examTick(){
  var e=S.exam; if(!e)return; var now=Date.now(), id=e.q[e.i]; e.t=e.t||{};
  var dt=Math.min(now-(e.vt||now),10*60e3); if(dt>0)e.t[id]=(e.t[id]||0)+dt; e.vt=now;
}
function examGo(d){var e=S.exam;if(!e)return;examTick();e.i=Math.max(0,Math.min(e.q.length-1,e.i+d));ui.examConfirm=false;saveLocal();render();}
function examMark(){var e=S.exam,q=exQ();if(!q)return;if(e.m[q.id])delete e.m[q.id];else e.m[q.id]=1;saveLocal();render();}
function finishExam(){
  var e=S.exam; if(!e||!D)return; examTick();
  var ok=0,byD={},wrong=[],nA=0;
  e.q.forEach(function(id){
    var q=Q[id],a=e.a[id]||[],right=same(a,q.ans);
    if(a.length)nA++;
    if(right)ok++; byD[q.d]=byD[q.d]||[0,0]; byD[q.d][1]++; if(right)byD[q.d][0]++; else wrong.push(id);
    // só as respondidas entram no calendário de revisão: as que ficaram por ver continuam "novas"
    if(a.length)record(q,right,"x",(e.t||{})[id],"x");
  });
  var t={}; for(var k in (e.t||{}))t[k]=Math.round(e.t[k]/1000)*1000;
  var res={seed:e.seed,bank:e.bank||"d",at:e.at,end:Math.min(Date.now(),e.ends),n:e.q.length,ok:ok,byD:byD,wrong:wrong,ans:e.a,q:e.q.slice(),t:t,min:e.min||D.meta.exam.minutes,label:e.label||""};
  snapDay();
  S.exams.push(res); S.exam=null; ui.resultAt=res.at; ui.examConfirm=false; ui.histTab=nA>=e.q.length?"done":"int";
  markDirty("e"); saveLocal(); render(); window.scrollTo(0,0);
}

/* ---------------- pomodoro ---------------- */
var actx=null;
function ensureAudio(){try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==="suspended")actx.resume();}catch(e){}}
function chime(n){
  if(!actx)return;
  try{var t0=actx.currentTime;for(var i=0;i<=n;i++){var o=actx.createOscillator(),g=actx.createGain(),t=t0+i*0.3;
    o.type="sine";o.frequency.value=i%2?659:880;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+0.28);
    o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+0.3);}}catch(e){}
}
function pc(){return POMO[S.cfg.pomo]||POMO["25/5"];}
function pomoStart(){var P=S.pomo;ensureAudio();if(P.mode==="idle"){P.mode="focus";P.remain=pc().f*60e3;}P.endsAt=Date.now()+P.remain;P.running=true;saveLocal();paintPomo();}
function pomoPause(){var P=S.pomo;if(!P.running)return;P.remain=Math.max(0,P.endsAt-Date.now());P.running=false;saveLocal();paintPomo();}
function pomoReset(){S.pomo={mode:"idle",running:false,endsAt:0,remain:0,cycle:S.pomo.cycle||0};saveLocal();paintPomo();}
function pomoDone(skipped){
  var P=S.pomo,c=pc();
  if(P.mode==="focus"){
    if(!skipped){var d=day();d.pomo++;d.min+=c.f;markDirty("d");chime(2);}
    P.cycle=(P.cycle||0)+1; var lng=P.cycle%4===0;
    P.mode=lng?"long":"break"; P.remain=(lng?c.l:c.b)*60e3; P.endsAt=Date.now()+P.remain; P.running=true;
  }else if(P.mode==="break"||P.mode==="long"){
    if(!skipped)chime(1);
    P.mode="idle";P.running=false;P.remain=0;
    toast(TL("A pausa terminou.","The break is over."),{label:TL("Começar foco","Start focus"),act:"pomostart"});
  }
  saveLocal();paintPomo();
}
function pomoLeft(){var P=S.pomo;return P.running?P.endsAt-Date.now():P.mode==="idle"?pc().f*60e3:P.remain;}
function paintPomo(){
  var P=S.pomo,b=$("pomoBtn"),t=$("pomoTxt");
  b.dataset.mode=P.mode; b.dataset.run=P.running?"1":"0";
  var lab=P.mode==="focus"?TL("Foco","Focus"):P.mode==="idle"?"Pomodoro":TL("Pausa","Break");
  t.innerHTML=P.mode==="idle"?"Pomodoro":esc(lab)+' <span class="num">'+mmss(pomoLeft())+"</span>"+(P.running?"":TL(" · em pausa"," · paused"));
  if(!$("pop").hidden)renderPop();
  var veil=$("veil"), onBreak=(P.mode==="break"||P.mode==="long")&&P.running;
  if(onBreak){
    if(veil.hidden||veil.dataset.m!==P.mode){
      veil.dataset.m=P.mode;
      veil.innerHTML='<div class="in"><p class="lbl">'+(P.mode==="long"?TL("Pausa longa","Long break"):TL("Pausa","Break"))+'</p><div class="big" id="veilT">'+mmss(pomoLeft())+'</div><p>'+esc(TIPS[(P.cycle||0)%TIPS.length])+TL(' As pausas a horas certas ajudam a manter a concentração ao longo da sessão.</p><button class="btn" data-act="pomoskip">Saltar a pausa</button></div>',' Breaks at fixed times help you stay focused throughout the session.</p><button class="btn" data-act="pomoskip">Skip the break</button></div>');
      veil.hidden=false;
    }else{var vt=$("veilT");if(vt)vt.textContent=mmss(pomoLeft());}
  }else if(!veil.hidden){veil.hidden=true;}
}
function renderPop(){
  var P=S.pomo,c=pc(),d=day(),cyc="";
  var done=P.mode==="long"?4:(P.cycle||0)%4;
  for(var i=1;i<=4;i++)cyc+='<i class="'+(i<=done?"on":"")+'"></i>';
  var lab=P.mode==="focus"?TL("Foco","Focus"):P.mode==="idle"?TL("Pronto para focar","Ready to focus"):P.mode==="long"?TL("Pausa longa","Long break"):TL("Pausa","Break");
  $("pop").innerHTML='<h3>'+esc(lab)+'</h3><div class="big">'+mmss(pomoLeft())+'</div><div class="cyc" title="'+TL("Ciclo de 4 focos antes da pausa longa","Cycle of 4 focus blocks before the long break")+'">'+cyc+'</div>'+
    '<div class="row">'+(P.running?TL('<button class="btn" data-act="pomopause">Pausar</button>','<button class="btn" data-act="pomopause">Pause</button>'):'<button class="btn primary" data-act="pomostart">'+(P.mode==="idle"?TL("Começar foco","Start focus"):TL("Continuar","Continue"))+'</button>')+
    (P.mode!=="idle"?TL('<button class="btn" data-act="pomoskip">Saltar</button><button class="link" data-act="pomoreset">Repor</button>','<button class="btn" data-act="pomoskip">Skip</button><button class="link" data-act="pomoreset">Reset</button>'):"")+'</div>'+
    TL('<div class="row" style="margin-top:14px"><span class="small muted">Ritmo</span><div class="seg">','<div class="row" style="margin-top:14px"><span class="small muted">Rhythm</span><div class="seg">')+
    Object.keys(POMO).map(function(k){return '<button data-act="pomocfg" data-v="'+k+'" aria-pressed="'+(S.cfg.pomo===k)+'">'+k+'</button>';}).join("")+'</div></div>'+
    TL('<p class="fine">Hoje: <span class="num">','<p class="fine">Today: <span class="num">')+d.pomo+TL('</span> pomodoros · <span class="num">','</span> pomodoros · <span class="num">')+d.min+TL('</span> min de foco. Depois de 4 focos vem uma pausa de ','</span> min of focus. After 4 focus blocks comes a break of ')+c.l+' min.</p>';
}
function togglePop(force){
  var p=$("pop"),open=force!==undefined?force:p.hidden;
  if(open)renderPop(); p.hidden=!open; $("pomoBtn").setAttribute("aria-expanded",open?"true":"false");
}

/* ---------------- idioma ---------------- */
var EN=null, T_PT=null, LABS_PT=null, LABS_EN=null;
function paintShell(){
  document.documentElement.lang=LANG==="en"?"en":"pt-PT";
  document.querySelectorAll("[data-en]").forEach(function(el){if(el.dataset.pt==null)el.dataset.pt=el.textContent;el.textContent=LANG==="en"?el.dataset.en:el.dataset.pt;});
  document.querySelectorAll("[data-en-aria]").forEach(function(el){if(el.dataset.ptAria==null)el.dataset.ptAria=el.getAttribute("aria-label")||"";el.setAttribute("aria-label",LANG==="en"?el.dataset.enAria:el.dataset.ptAria);});
  var lb=$("langLbl");if(lb)lb.textContent=TL("Idioma","Language");
  var sg=$("langSeg");if(sg){sg.setAttribute("aria-label",TL("Idioma","Language"));sg.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.v===LANG?"true":"false");});}
  document.title=TL("Treino CSA","CSA Trainer");
}
function mockEN(x){var M=(EN&&EN.mock)||{};if(typeof x==="string")return M[x]!=null?M[x]:x;if(Array.isArray(x))return x.map(mockEN);if(x&&typeof x==="object"){var o={};for(var k in x)o[k]=mockEN(x[k]);return o;}return x;}
function buildLabsEN(){
  var o={};
  Object.keys(LABS_PT).forEach(function(k){
    var lb=clone(LABS_PT[k]),t=(EN.labs||{})[k]||{};
    ["t","role","see","warn"].forEach(function(f){if(t[f]!=null)lb[f]=t[f];});
    if(t.path)lb.path=t.path; if(t.steps)lb.steps=t.steps;
    lb.mock=mockEN(lb.mock); o[k]=lb;
  });
  return o;
}
/* aplica o idioma ao conteúdo: notas «Porquê», descrições dos temas e labs (a versão portuguesa fica guardada) */
function applyContent(){
  var en=LANG==="en"&&EN;
  if(D)D.questions.forEach(function(q){var d=q.doc;if(!d)return;if(d.n_pt==null)d.n_pt=d.n;d.n=en&&EN.notes&&EN.notes[q.id]?EN.notes[q.id]:d.n_pt;});
  if(T_PT)T=en&&EN.topics?EN.topics:T_PT;
  if(LABS_PT){if(en&&!LABS_EN)LABS_EN=buildLabsEN();LABS=en?LABS_EN:LABS_PT;}
}
function setLang(v){
  LANG=v==="en"?"en":"pt";
  try{localStorage.setItem("csa2-lang",LANG);}catch(e){}
  i18nConsts(); applyContent(); paintShell();
  setTheme(document.documentElement.dataset.theme==="dark"?"dark":"light");
  var veil=$("veil"); if(veil)veil.dataset.m="";
  paintPomo(); if(!$("pop").hidden)renderPop();
  ui.smartCache=null; render(); paintSync();
}
/* nomes das sessões guardados no progresso: mostram-se no idioma atual */
var LBLS=[["Sessão de hoje","Today’s session"],["Revisões em atraso","Overdue reviews"],["Erros confiantes","Confident mistakes"],["Questões que errei","Questions I got wrong"],["Questões novas","New questions"],["Todas, misturadas","All, shuffled"],["Todos os domínios","All domains"],["Bloco final: refazer as erradas","Final block: redo the wrong ones"],["Ranking: mais erradas","Ranking: most missed"],["Erros do simulado","Practice exam mistakes"],["Sessão à medida","Custom session"]];
function lbl(x){
  if(!x)return x;
  for(var i=0;i<LBLS.length;i++)if(x===LBLS[i][0]||x===LBLS[i][1])return TL(LBLS[i][0],LBLS[i][1]);
  var m=/^(?:Módulo|Module) (.*)$/.exec(x); if(m)return TL("Módulo ","Module ")+m[1];
  return x;
}

/* ---------------- exportar / importar progresso (versão em ficheiro) ---------------- */
function exportProgress(){
  try{
    var data={app:"treino-csa",v:1,at:Date.now(),state:S,labs:{done:LS.done}};
    var fname="treino-csa-progresso-"+dkey()+".json";
    if(ui.downloads){
      ui.downloads.save({filename:fname,data:JSON.stringify(data)}).then(function(){toast(TL("Ficheiro de progresso guardado.","Progress file saved."));})
      .catch(function(e){var c=e&&e.code;if(c==="declined")return;toast(c==="rate_limited"?TL("Já há um pedido aberto. Tenta daqui a pouco.","A request is already open. Try again shortly."):TL("Não consegui criar o ficheiro.","Couldn't create the file."));});
      return;
    }
    var blob=new Blob([JSON.stringify(data)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
    toast(TL("Ficheiro de progresso descarregado.","Progress file downloaded."));
  }catch(e){toast(TL("Não consegui criar o ficheiro.","Couldn't create the file."));}
}
function readImport(file){
  if(!file)return;
  var fr=new FileReader();
  fr.onload=function(){
    try{var d=JSON.parse(fr.result);if(!d||d.app!=="treino-csa"||!d.state||d.state.v!==2||typeof d.state.p!=="object")throw 0;ui.imp=d;render();}
    catch(e){ui.imp=null;toast(TL("Este ficheiro não é um progresso do Treino CSA.","This file isn't a CSA Trainer progress file."));}
  };
  fr.onerror=function(){toast(TL("Não consegui ler o ficheiro.","Couldn't read the file."));};
  fr.readAsText(file);
}
function applyImport(){
  var d=ui.imp; if(!d)return;
  var b=blank(), st=d.state;
  for(var k in b){if(st[k]===undefined)st[k]=b[k];}
  st.cfg=Object.assign(b.cfg,st.cfg||{}); st.pomo=Object.assign(b.pomo,st.pomo||{});
  S=st; if(d.labs&&d.labs.done){LS.done=d.labs.done;saveLabs(false);}
  ui.imp=null; ui.smartCache=null; ui.last=null; ui.done=false; ui.sel=[]; ui.qt=null; ui.peek=null; ui.resultAt=null;
  saveLocal(); if(sync.db){markDirty("p");markDirty("d");markDirty("e");markDirty("l");saveLabs(true);} paintPomo(); render(); toast(TL("Progresso importado.","Progress imported."));
}
function dataPanelHTML(){
  if(ui.imp){var st=ui.imp.state,seen=Object.keys(st.p||{}).filter(function(id){return st.p[id]&&st.p[id].n;}).length;
    return TL('<div class="confirm" style="margin:0 0 12px"><p style="margin:0 0 12px">Substituir o teu progresso atual pelo do ficheiro? O ficheiro tem <b>','<div class="confirm" style="margin:0 0 12px"><p style="margin:0 0 12px">Replace your current progress with the one in the file? The file has <b>')+seen+TL('</b> questões vistas e <b>','</b> questions seen and <b>')+((st.exams||[]).length)+TL('</b> simulados, exportado a ','</b> practice exams, exported on ')+dmy(ui.imp.at)+TL('.</p><div class="row"><button class="btn primary" data-act="impgo">Importar</button><button class="btn" data-act="impno">Cancelar</button></div></div>','.</p><div class="row"><button class="btn primary" data-act="impgo">Import</button><button class="btn" data-act="impno">Cancel</button></div></div>');}
  var h=TL('<div class="row" style="margin:0 0 10px"><button class="btn" data-act="exportp">Exportar progresso</button><label class="btn">Importar progresso<input type="file" accept=".json,application/json" data-import="1" hidden></label></div><p class="small faint" style="margin:0 0 14px">Guarda uma cópia do teu progresso num ficheiro, para passares para outro browser ou computador.</p>','<div class="row" style="margin:0 0 10px"><button class="btn" data-act="exportp">Export progress</button><label class="btn">Import progress<input type="file" accept=".json,application/json" data-import="1" hidden></label></div><p class="small faint" style="margin:0 0 14px">Save a copy of your progress to a file, to move it to another browser or computer.</p>');
  if(!OFFLINE&&!WEB&&!ui.downloads)h=h.replace(/<button class="btn" data-act="exportp">[^<]*<\/button>/,"");
  return h;
}

/* ---------------- avisos ---------------- */
var ttimer=null;
function toast(msg,action){
  var t=$("toast");t.innerHTML=esc(msg)+(action?'<button data-act="'+esc(action.act)+'">'+esc(action.label)+'</button>':"");
  t.hidden=false;clearTimeout(ttimer);ttimer=setTimeout(function(){t.hidden=true;},action?9000:4500);
}

/* ---------------- explicação com o Claude ---------------- */
function exCache(){try{return JSON.parse(localStorage.getItem(EXKEY))||{};}catch(e){return {};}}
function exKey(id){return LANG==="en"?id+"_en":String(id);}
function exSave(id,txt){try{var c=exCache();c[exKey(id)]=txt;var ks=Object.keys(c);if(ks.length>300)delete c[ks[0]];localStorage.setItem(EXKEY,JSON.stringify(c));}catch(e){}}
function paintAI(el,text){
  el.classList.remove("busy");el.innerHTML="";
  String(text).replace(/\*\*/g,"").replace(/^#+\s*/gm,"").split(/\n\s*\n/).forEach(function(par){
    par=par.trim();if(!par)return;var p=document.createElement("p");
    if(/^(Para memorizar|To remember)/i.test(par))p.className="mem"; p.textContent=par; el.appendChild(p);
  });
}
function prompt(q,chosen){
  var opts=optOrder(q).order.map(function(i,pos){return String.fromCharCode(65+pos)+". "+q.opts[i].text;}).join("\n");
  var refs=(q.key||[]).map(function(k){return '- "'+k.s+TL('" (pág. ','" (p. ')+k.p+", "+k.t+")";}).join("\n");
  var full=q.refs.map(function(r){return "["+r.t+TL(", pág. ",", p. ")+r.p+"]\n"+r.x;}).join("\n\n");
  var dd=q.doc||{}, docx=(dd.x||[]).map(function(x){return "["+x.t+" — "+x.u+"]\n"+x.x;}).join("\n\n");
  var who=chosen&&chosen.length?(same(chosen,q.ans)?TL("O aluno acertou (escolheu ","The student got it right (chose ")+dls(q,chosen)+").":TL("O aluno escolheu ","The student chose ")+dls(q,chosen)+TL(", que está errado.",", which is wrong.")):TL("O aluno não respondeu e pediu para ver a resposta.","The student didn’t answer and asked to see the answer.");
  return TL("És um tutor de ServiceNow a preparar um aluno português para o exame Certified System Administrator (CSA). Escreve em português de Portugal. Mantém em inglês os nomes técnicos da plataforma (tabelas, módulos, funcionalidades).\n\n","You are a ServiceNow tutor preparing a student for the Certified System Administrator (CSA) exam. Write in English. Keep the platform’s technical names as they are (tables, modules, features).\n\n")+
    TL("Domínio do blueprint: ","Blueprint domain: ")+DN[q.d]+" — "+q.sub+TL("\n\nQuestão:\n","\n\nQuestion:\n")+q.stem+TL("\n\nOpções:\n","\n\nOptions:\n")+opts+TL("\n\nResposta correta (banco de questões): ","\n\nCorrect answer (question bank): ")+dtext(q,q.back)+"\n"+who+"\n\n"+
    TL("FONTE PRINCIPAL — excertos da documentação oficial ServiceNow (release Brazil):\n","MAIN SOURCE — excerpts from the official ServiceNow documentation (Brazil release):\n")+(docx||TL("(a documentação oficial não tem um tópico sobre esta questão)","(the official documentation has no topic on this question)"))+"\n\n"+
    TL("Nota curta já mostrada ao aluno:\n","Short note already shown to the student:\n")+(dtext(q,dd.n)||TL("(nenhuma)","(none)"))+"\n\n"+
    TL("FONTE SECUNDÁRIA — guia ServiceNow Administration Fundamentals (livro do curso):\n","SECONDARY SOURCE — ServiceNow Administration Fundamentals guide (course book):\n")+(refs||TL("(nenhuma)","(none)"))+TL("\n\nExcertos completos do guia:\n","\n\nFull excerpts from the guide:\n")+full.slice(0,4000)+"\n\n"+
    TL("A ordem das opções muda de cada vez que a questão aparece: quando falares de uma opção, cita o texto dela e não só a letra.\n\n","The order of the options changes every time the question appears: when you mention an option, quote its text, not just the letter.\n\n")+TL("Tarefa: em 4 a 7 frases curtas, explica porque é que a resposta correta está certa","Task: in 4 to 7 short sentences, explain why the correct answer is right")+(chosen&&chosen.length&&!same(chosen,q.ans)?TL(" e porque é que a escolha do aluno está errada"," and why the student’s choice is wrong"):"")+
    TL(". Regras: usa só o que está nas fontes acima — não acrescentes factos da tua memória nem suposições («acho», «provavelmente»). Quando usares a documentação, cita o título do tópico entre parênteses; quando usares o guia, indica a página (pág. N). ",". Rules: use only what’s in the sources above — don’t add facts from your memory or assumptions («I think», «probably»). When you use the documentation, cite the topic title in brackets; when you use the guide, give the page (p. N). ")+
    TL("Se as fontes não cobrirem um ponto, escreve claramente «A documentação não cobre este ponto» em vez de o explicar. Se a questão usar nomes antigos (ex.: Report Designer, UI16, Flow Designer, Connect Chat) e a doc usar nomes novos, diz a correspondência. ","If the sources don’t cover a point, say clearly «The documentation doesn’t cover this point» instead of explaining it. If the question uses old names (e.g. Report Designer, UI16, Flow Designer, Connect Chat) and the docs use new names, give the mapping. ")+
    TL("Termina com um parágrafo separado que comece por 'Para memorizar:' e tenha uma regra curta. Escreve em parágrafos simples, sem títulos e sem listas.","End with a separate paragraph that starts with ’To remember:’ and gives a short rule. Write in plain paragraphs, with no headings and no lists.");
}
function explain(id,chosen,refresh){
  var out=document.querySelector('.ai-out[data-id="'+id+'"]'),btn=document.querySelector('[data-act="explain"][data-id="'+id+'"]');
  if(!out||!ui.sample)return;
  if(ui.ctl)ui.ctl.abort();
  var ctl=new AbortController();ui.ctl=ctl;
  out.classList.add("busy");out.textContent=TL("A pensar… costuma demorar uns segundos.","Thinking… this usually takes a few seconds.");
  if(btn){btn.dataset.act="stopx";btn.textContent=TL("Parar","Stop");}
  ui.sample(prompt(Q[id],chosen),{signal:ctl.signal,modelTier:"default",effort:"low",cache:{gcTime:86400000,refresh:!!refresh},onText:function(u){paintAI(out,u.text);}})
  .then(function(r){paintAI(out,r.text);exSave(id,r.text);if(r.truncated){var n=document.createElement("p");n.className="ai-note";n.textContent=TL("A explicação ficou cortada a meio.","The explanation was cut off midway.");out.appendChild(n);}})
  .catch(function(e){
    var c=e&&e.code;
    if(c==="cancelled"){if(e.text)paintAI(out,e.text);else{out.classList.remove("busy");out.textContent="";}return;}
    if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].indexOf(c)>=0){ui.sample=null;out.classList.remove("busy");out.textContent=TL("A explicação com o Claude não está disponível nesta vista.","The explanation with Claude isn’t available in this view.");return;}
    out.classList.remove("busy");
    if(e&&e.text)paintAI(out,e.text);else out.textContent="";
    var p=document.createElement("p");p.className="ai-note";
    p.textContent=c==="rate_limited"?TL("Demasiados pedidos seguidos. Tenta outra vez daqui a um bocado.","Too many requests in a row. Try again in a little while."):c==="session_expired"?TL("A tua sessão no Claude expirou. Inicia sessão outra vez.","Your Claude session has expired. Sign in again."):c==="refused"?TL("O Claude não respondeu a este pedido.","Claude didn’t answer this request."):TL("A ligação falhou. Tenta outra vez.","The connection failed. Try again.");
    out.appendChild(p);
  }).then(function(){
    if(ui.ctl===ctl)ui.ctl=null;
    var b=document.querySelector('[data-act="stopx"][data-id="'+id+'"]');
    if(b){b.dataset.act="explain";b.textContent=exCache()[exKey(id)]?TL("Explicar de outra forma","Explain it another way"):TL("Mais explicação","More explanation");}
  });
}

/* ---------------- peças partilhadas ---------------- */
function stemHTML(q){return '<p class="stem">'+esc(q.stem).replace(/&lt;image&gt;/g,TL('<span class="noimg">[imagem da questão original não incluída no banco]</span>','<span class="noimg">[the original question’s image isn’t included in the bank]</span>'))+"</p>";}
function boxes(id){var r=rec(id),b=r&&r.n?r.b:0,s="";for(var i=1;i<=5;i++)s+='<i class="'+(i<=b?"on":"")+'"></i>';return TL('<span class="boxes" title="Caixa ','<span class="boxes" title="Box ')+b+TL(' de 5">',' of 5">')+s+"</span>";}
/* ---------------- ordem das opções: baralhada sempre que a questão aparece ----------------
   As letras originais continuam a ser a chave interna (progresso, respostas, estatísticas);
   só o ecrã mostra A, B, C… pela nova ordem. Dentro da mesma visita a ordem fica fixa. */
var PAGE_SEED=Math.random().toString(36).slice(2), DISP={};
function hstr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,1274126177);return (h^(h>>>16))>>>0;}
function newSeed(){return Math.random().toString(36).slice(2,10);}
function optSeed(){
  if(view==="simulado"&&S.exam){if(!S.exam.seed)S.exam.seed=newSeed();return S.exam.seed;}
  if(view==="simulado"&&ui.resultAt){var r=S.exams.filter(function(e){return e.at===ui.resultAt;})[0];if(r&&r.seed)return r.seed;}
  if(view==="treino"&&S.sess){var s=S.sess;if(!s.seed)s.seed=newSeed();return s.seed+"|"+(ui.peek!=null?ui.peek:s.i);}
  return PAGE_SEED;
}
function optOrder(q,seed){
  var key=(seed==null?optSeed():seed)+"|"+q.id;
  if(DISP[key])return DISP[key];
  var idx=q.opts.map(function(o,i){return i;});
  idx.sort(function(a,b){return hstr(key+"|"+a)-hstr(key+"|"+b);});
  var map={};idx.forEach(function(oi,pos){map[q.opts[oi].letter]=String.fromCharCode(65+pos);});
  return (DISP[key]={order:idx,map:map});
}
function dl(q,L){return optOrder(q).map[L]||L;}
function dls(q,arr){return (arr||[]).map(function(L){return dl(q,L);}).sort().join(", ");}
function dtext(q,t){
  if(!t)return t;
  return String(t).replace(/^([ \t ]*)([A-H])\.(?=[\s A-Za-z])/gm,function(m,sp,L){return sp+dl(q,L)+".";})
    .replace(/\b(op[cç][aã]o|op[cç][oõ]es|options?|answers?|resposta|alternativa)(\s+)([A-H])\b/gi,function(m,w,sp,L){return w+sp+dl(q,L);});
}
function optAt(q,pos){var o=q?optOrder(q).order:[];return pos<o.length?o[pos]:-1;}
function optsHTML(q,state){
  // state: {sel:[idx]} antes; {chosen:[letters], reveal:true} depois
  return '<ol class="opts">'+optOrder(q).order.map(function(i,pos){
    var o=q.opts[i],cls="opt",mk="",pressed=false;
    if(state.reveal){
      var isR=q.ans.indexOf(o.letter)>=0,picked=state.chosen.indexOf(o.letter)>=0;
      if(isR){cls+=" ok";mk=picked?TL("a tua · correta","yours · correct"):TL("correta","correct");} else if(picked){cls+=" no";mk=TL("a tua","yours");}
    }else pressed=state.sel.indexOf(i)>=0;
    return '<li><button class="'+cls+'" data-act="'+(state.reveal?"":state.act)+'" data-v="'+i+'" aria-pressed="'+pressed+'"'+(state.reveal?" disabled":"")+'><span class="L">'+String.fromCharCode(65+pos)+'</span><span class="T">'+esc(o.text)+"</span>"+(mk?'<span class="M">'+mk+"</span>":"")+"</button></li>";
  }).join("")+"</ol>";
}
function docHTML(q){
  var d=q.doc; if(!d)return "";
  var src=d.u?TL('<p class="dsrc">Fonte: <a href="','<p class="dsrc">Source: <a href="')+esc(d.u)+'" target="_blank" rel="noopener">'+esc(d.t)+TL("</a> · documentação oficial ServiceNow</p>","</a> · official ServiceNow documentation</p>")
    :TL('<p class="dsrc nosrc">A documentação oficial atual (release Brazil) não tem um tópico sobre isto — muitas vezes é matéria antiga. Esta nota não tem fonte na doc.</p>','<p class="dsrc nosrc">The current official documentation (Brazil release) has no topic on this — it’s often older material. This note has no source in the docs.</p>');
  var xs=(d.x||[]).map(function(x,i){return '<blockquote class="dq">'+esc(x.x)+'<cite><a href="'+esc(x.u)+'" target="_blank" rel="noopener">'+esc(x.t)+"</a></cite></blockquote>";}).join("");
  return TL('<div class="dnote"><p class="lbl">Porquê</p><p class="dn">','<div class="dnote"><p class="lbl">Why</p><p class="dn">')+esc(dtext(q,d.n))+"</p>"+src+
    (xs?TL('<details class="more"><summary>O que diz a doc (em inglês)</summary>','<details class="more"><summary>What the docs say</summary>')+xs+"</details>":"")+"</div>";
}
function explainHTML(q,chosen){
  var key=(q.key||[]).map(function(k){return '<blockquote class="quote">'+esc(k.s)+TL("<cite>pág. ","<cite>p. ")+k.p+" · "+esc(k.t)+"</cite></blockquote>";}).join("");
  var cached=exCache()[exKey(q.id)], ch=(chosen||[]).join(",");
  var ai=ui.sample?TL('<div class="ai"><div class="ai-head"><p class="lbl">Mais explicação</p><button class="btn" data-act="explain" data-id="','<div class="ai"><div class="ai-head"><p class="lbl">More explanation</p><button class="btn" data-act="explain" data-id="')+q.id+'" data-ch="'+esc(ch)+'">'+(cached?TL("Explicar de outra forma","Explain it another way"):TL("Mais explicação","More explanation"))+'</button></div><div class="ai-out" data-id="'+q.id+TL('" aria-live="polite"></div><p class="ai-note">Gerada pelo Claude só a partir dos excertos da documentação oficial e do guia SNAF. Se a doc não cobrir um ponto, ele diz.</p></div>','" aria-live="polite"></div><p class="ai-note">Generated by Claude only from the excerpts of the official documentation and the SNAF guide. If the docs don’t cover a point, it says so.</p></div>'):"";
  var refs=q.refs.map(function(r){return '<div class="ref"><h4>'+esc(r.t)+TL("<span>pág. ","<span>p. ")+r.p+TL(" · Módulo "," · Module ")+esc(r.m)+"</span></h4><p>"+esc(r.x)+"</p></div>";}).join("");
  var pages=(q.key||[]).map(function(k){return k.p;}).filter(function(p,i,a){return a.indexOf(p)===i;});
  var raw="FRONT\n"+q.stem+(q.opts.length?"\n\n"+optOrder(q).order.map(function(i,pos){return String.fromCharCode(65+pos)+". "+q.opts[i].text;}).join("\n"):"")+(q.note?"\n\n"+dtext(q,q.note):"")+"\n\nBACK\n"+dtext(q,q.back);
  return '<div class="ex">'+
    docHTML(q)+
    labForQ(q)+
    ai+
    TL('<div><p class="lbl">Resposta no banco de questões</p><div class="verb">','<div><p class="lbl">Answer in the question bank</p><div class="verb">')+esc(dtext(q,q.back))+"</div></div>"+
    (q.note?TL('<div><p class="lbl">Nota no banco de questões</p><div class="verb">','<div><p class="lbl">Note in the question bank</p><div class="verb">')+esc(q.note.replace(/^\*+\s*/,""))+"</div></div>":"")+
    (key?TL('<details class="more"><summary>No livro SNAF','<details class="more"><summary>In the SNAF book')+(pages.length?TL(" (pág. "," (p. ")+pages.join(", ")+")":"")+"</summary>"+(q.weak?TL('<p class="weak">O guia não trata este tema de forma direta. As frases abaixo são as mais próximas que encontrei.</p>','<p class="weak">The guide doesn’t cover this topic directly. The sentences below are the closest I found.</p>'):"")+key+"</details>":"")+
    TL('<details class="more"><summary>Excertos completos do guia (','<details class="more"><summary>Full excerpts from the guide (')+q.refs.length+")</summary>"+refs+"</details>"+
    TL('<details class="more"><summary>Linha original do Excel</summary><pre class="raw">','<details class="more"><summary>Original Excel row</summary><pre class="raw">')+esc(raw)+"</pre></details>"+
  "</div>";
}
function fillCachedAI(){
  document.querySelectorAll(".ai-out").forEach(function(el){var t=exCache()[exKey(el.dataset.id)];if(t&&!el.textContent)paintAI(el,t);});
}

/* ---------------- labs: passo a passo na instância ---------------- */
var LABS=null, LMAP={}, LK="csa2-labs", LS={done:{},shots:{}};
try{var _l=JSON.parse(localStorage.getItem(LK)||"null");if(_l&&_l.done)LS={done:_l.done||{},shots:_l.shots||{}};}catch(e){}
function saveLabs(remote){
  try{localStorage.setItem(LK,JSON.stringify(LS));}catch(e){}
  if(remote&&sync.db)ref("labs").set({done:LS.done,shots:LS.shots,t:Date.now()}).catch(function(){});
}
function loadLabsRemote(){
  if(!sync.db)return;
  ref("labs").get().then(function(s){
    if(!s.exists){if(Object.keys(LS.done).length||Object.keys(LS.shots).length)saveLabs(true);return;}
    var r=s.data()||{}, k;
    for(k in (r.done||{}))if(!LS.done[k])LS.done[k]=r.done[k];
    for(k in (r.shots||{}))if(!LS.shots[k])LS.shots[k]=r.shots[k];
    saveLabs(false); if(D)render();
  }).catch(function(){});
}
function md(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,"<code>$1</code>");}
function co(n){return n?TL('<span class="co" aria-label="passo ','<span class="co" aria-label="step ')+n+'">'+n+"</span>":"";}
function mkf(f,wide){
  var ty=f[2]||"t", v=f[1]==null?"":f[1], n=f[3], inner;
  if(ty==="x")inner="☑"; else if(ty==="o")inner="☐";
  else if(ty==="s")return '<div class="mk-f wide'+(n?" hl":"")+'"><label>'+esc(f[0])+'</label><pre class="mk-code">'+esc(v)+"</pre>"+co(n)+"</div>";
  else inner="<span>"+esc(v)+"</span>"+(ty==="r"?"<i>🔍</i>":ty==="c"?"<i>▾</i>":"");
  return '<div class="mk-f'+(ty==="ta"||wide?" wide":"")+(n?" hl":"")+'"><label>'+(ty==="m"?"<i>*</i>":"")+esc(f[0])+'</label><div class="mk-in ty-'+ty+'">'+inner+"</div>"+co(n)+"</div>";
}
function mkTable(cols,rows,o){
  o=o||{};
  return '<div class="mk-tw"><table><thead><tr>'+cols.map(function(c,j){return "<th"+(o.hlh===j?' class="hl"':"")+">"+esc(c)+(o.gear!=null&&j===cols.length-1?' <span style="float:right">⚙ '+co(o.gear)+"</span>":"")+"</th>";}).join("")+"</tr></thead><tbody>"+
    rows.map(function(r,i){return "<tr"+(o.hlr===i?' class="hl"':"")+">"+r.map(function(c,j){
      var cls=[]; if(j===0)cls.push("lk"); if(o.edit&&o.edit[0]===i&&o.edit[1]===j)cls.push("ed"); else if(o.hlc&&o.hlc[0]===i&&o.hlc[1]===j)cls.push("hl");
      return "<td"+(cls.length?' class="'+cls.join(" ")+'"':"")+">"+esc(c)+"</td>";}).join("")+"</tr>";}).join("")+"</tbody></table></div>";
}
function mkMenu(items,hl){return '<ul class="mk-menu">'+items.map(function(t,i){return t==="—"?'<li class="sep"></li>':"<li"+(i===hl?' class="hl"':"")+">"+esc(t)+"</li>";}).join("")+"</ul>";}
function mkSvgMap(m){
  var W=560, H=0, P={};
  m.nodes.forEach(function(nd){var w=Math.min(250,nd[1].length*6.4+22);P[nd[0]]={x:nd[2],y:nd[3],w:w};H=Math.max(H,nd[3]+34);});
  var e=(m.edges||[]).map(function(ed){var a=P[ed[0]],b=P[ed[1]];var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    return '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>'+(ed[2]?'<text class="el" x="'+mx+'" y="'+(my-4)+'" text-anchor="middle">'+esc(ed[2])+"</text>":"");}).join("");
  var n=m.nodes.map(function(nd){var p=P[nd[0]];return '<rect'+(nd[4]?' class="h"':"")+' x="'+(p.x-p.w/2)+'" y="'+(p.y-13)+'" width="'+p.w+'" height="26" rx="6"/><text x="'+p.x+'" y="'+(p.y+4)+'" text-anchor="middle">'+esc(nd[1])+"</text>";}).join("");
  return '<svg class="mk-svg" viewBox="0 0 '+W+" "+H+TL('" role="img" aria-label="Diagrama">','" role="img" aria-label="Diagram">')+e+n+"</svg>";
}
function mkChart(m){
  var W=520,H=170,mx=Math.max.apply(null,m.bars.map(function(b){return b[1];}).concat([m.target||0]))||1,bw=(W-40)/m.bars.length;
  var bars=m.bars.map(function(b,i){var h=(H-40)*b[1]/mx,x=30+i*bw+bw*.2;return '<rect class="mkbar" x="'+x+'" y="'+(H-22-h)+'" width="'+(bw*.6)+'" height="'+h+'" rx="2"/><text class="el" x="'+(x+bw*.3)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(b[0])+'</text><text class="el" x="'+(x+bw*.3)+'" y="'+(H-26-h)+'" text-anchor="middle">'+b[1]+"</text>";}).join("");
  var tg=m.target?'<line class="tg" x1="24" x2="'+(W-6)+'" y1="'+(H-22-(H-40)*m.target/mx)+'" y2="'+(H-22-(H-40)*m.target/mx)+'"/><text class="el" x="'+(W-8)+'" y="'+(H-26-(H-40)*m.target/mx)+'" text-anchor="end">target '+m.target+"</text>":"";
  return '<svg class="mk-svg" viewBox="0 0 '+W+" "+H+TL('" role="img" aria-label="Gráfico de barras">','" role="img" aria-label="Bar chart">')+'<line x1="24" x2="'+(W-6)+'" y1="'+(H-22)+'" y2="'+(H-22)+'"/>'+bars+tg+"</svg>";
}
function mock(m){
  var h="", k=m.k;
  if(k==="nav"){
    h='<div class="mk-top"><b class="on">All</b><span>Favorites</span><span>History</span><span class="mk-sp"></span><span class="mk-av">SA</span></div><div class="mk-body"><div class="mk-navp"><div class="mk-filter">🔍 <span>'+esc(m.q)+"</span>"+(m.mods?"":co(m.n))+"</div>"+
      (m.mods?'<p class="mk-app">'+esc(m.app)+' ▾</p><ul>'+m.mods.map(function(t){var on=t===m.hl;return "<li"+(on?' class="hl"':"")+">"+esc(t)+(on?co(m.n):"")+(m.star?'<span class="st">'+(on?"★":"☆")+"</span>":"")+"</li>";}).join("")+"</ul>":"")+
      (m.hint?'<p class="mk-hint">'+esc(m.hint)+"</p>":"")+"</div></div>";
  }else if(k==="menu"){
    if(m.ico==="user")h='<div class="mk-top"><b>All</b><span>Favorites</span><span class="mk-sp"></span><span class="mk-av hl">SA</span></div><div class="mk-body" style="justify-content:flex-end"><div class="mk-col">'+mkMenu(m.items,m.hl)+"</div>"+co(m.n)+"</div>";
    else h='<div class="mk-body"><div class="mk-col"><div class="mk-menu ttl">'+(m.ico==="globe"?"🌐 ":"≡ ")+esc(m.t)+'</div>'+mkMenu(m.items,m.hl)+"</div>"+(m.sub?mkMenu(m.sub.items,m.sub.hl):"")+co(m.n)+"</div>";
  }else if(k==="dialog"){
    h='<div class="mk-body" style="justify-content:center"><div class="mk-navp" style="width:320px"><div class="mk-fh" style="padding:4px 2px 8px"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>✕</div><div class="mk-ff one" style="padding:8px 0">'+m.f.map(function(f){return mkf(f);}).join("")+'</div><div style="display:flex;gap:6px;justify-content:flex-end">'+m.btns.map(function(b,i){return '<span class="mk-b'+(i===m.hlb?" pri":"")+'">'+esc(b)+"</span>";}).join("")+"</div></div></div>";
  }else if(k==="form"){
    h='<div class="mk-fh"><span>‹</span><b>'+esc(m.t)+'</b><span class="mk-st">'+esc(m.st||"")+'</span><span class="mk-sp"></span>'+(m.btns||[]).map(function(b,i){return '<span class="mk-b'+(i===(m.hlb==null?(m.btns.length-1):m.hlb)?" pri":"")+'">'+esc(b)+"</span>";}).join("")+"</div>"+
      (m.steps?'<div class="mk-steps">'+m.steps.map(function(s,i){return "<span"+(i===m.stp?' class="on"':"")+">"+esc(s)+"</span>";}).join("")+"</div>":"")+
      (m.tabs?'<div class="mk-tabs">'+m.tabs.map(function(t,i){return "<span"+(i===m.tab?' class="on"':"")+">"+esc(t)+"</span>";}).join("")+"</div>":"")+
      '<div class="mk-ff'+(m.f.length<3?" one":"")+'">'+m.f.map(function(f){return mkf(f);}).join("")+"</div>"+
      (m.act?'<div class="mk-rl"><h5>Activity '+co(m.actn)+"</h5>"+m.act.map(function(a){return '<div class="mk-card" style="margin-bottom:5px;display:block"><small>'+esc(a[0])+" · "+esc(a[1])+"</small><div>"+esc(a[2])+"</div></div>";}).join("")+"</div>":"")+
      (m.rl?(m.rtabs?'<div class="mk-tabs">'+m.rtabs.map(function(t,i){return "<span"+(i===m.rtab?' class="on"':"")+">"+esc(t)+"</span>";}).join("")+"</div>":"")+'<div class="mk-rl"><h5>'+esc(m.rl.t)+" "+co(m.rl.n)+'<span class="mk-sp"></span>'+(m.rl.btns||["New"]).map(function(b){return '<span class="mk-b">'+esc(b)+"</span>";}).join(" ")+"</h5>"+mkTable(m.rl.cols,m.rl.rows)+"</div>":"");
  }else if(k==="list"){
    h='<div class="mk-lh">≡ <b>'+esc(m.t)+'</b><span class="mk-b">New</span><span class="mk-srch">Search</span><span class="mk-sp"></span>'+(m.n&&!m.menu&&m.hlc==null&&m.hlr==null&&m.gear==null?co(m.n):"")+"</div>"+
      (m.cond?'<div class="mk-cond">'+m.cond.map(function(c){return '<div class="r"><span>'+esc(c[0])+"</span><span>"+esc(c[1])+"</span><span>"+esc(c[2])+"</span>"+co(c[3])+"</div>";}).join("")+'<div class="r"><span class="mk-b">AND</span><span class="mk-b">OR</span><span class="mk-b pri">Run</span>'+co(m.condn)+'<span class="mk-b">Save...</span></div></div>':"")+
      (m.bc?'<div class="mk-bc">'+esc(m.bc)+" "+co(m.bcn)+"</div>":"")+
      mkTable(m.cols,m.rows,{hlh:m.hlh,hlr:m.hlr,hlc:m.hlc,edit:m.edit,gear:m.gear})+
      (m.err?'<div class="mk-err">⚠ '+esc(m.err)+" "+co(m.n)+"</div>":"")+
      (m.menu?'<div class="mk-pop">'+mkMenu(m.menu.items,m.menu.hl)+co(m.menu.n)+"<p>"+(m.menu.at[0]<0?TL("Clique direito no cabeçalho «","Right-click the «")+esc(m.cols[m.menu.at[1]])+"»":TL("Clique direito em «","Right-click «")+esc(m.rows[m.menu.at[0]][m.menu.at[1]])+"»")+"</p></div>":"")+
      (m.rowlbl||m.collbl?'<p class="mk-leg">'+(m.rowlbl?TL("Linha destacada: ","Highlighted row: ")+esc(m.rowlbl)+". ":"")+(m.collbl?TL("Cada coluna (","Each column (")+esc(m.cols[m.collbl[0]])+", …): "+esc(m.collbl[1])+".":"")+"</p>":"")+
      ((m.hlc||m.hlr!=null)&&m.n&&!m.menu&&!m.err?'<p class="mk-leg">'+co(m.n)+TL(" a zona destacada é a do passo "," the highlighted area belongs to step ")+m.n+"</p>":"");
  }else if(k==="slush"){
    var li=function(t){return "<li"+(t===m.hl?' class="hl"':"")+">"+esc(t)+(t===m.hl?co(m.n):"")+"</li>";};
    h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span><span class="mk-b pri">Save</span></div><div class="mk-sl"><div class="box"><p>Available</p><ul>'+m.a.map(li).join("")+'</ul></div><div class="arr"><span>▶</span><span>◀</span></div><div class="box"><p>Selected</p><ul>'+m.s.map(li).join("")+"</ul></div></div>";
  }else if(k==="flow"){
    h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span><span class="mk-b">Test</span><span class="mk-b">Save</span><span class="mk-b pri">Activate</span></div><div class="mk-flow"><small class="lcap">TRIGGER</small><div class="mk-card trig">⚡ '+esc(m.trig)+" "+co(m.trn)+'</div><small class="lcap">ACTIONS</small>'+
      m.acts.map(function(a){return '<div class="mk-card'+(a[3]?" hl":"")+'" style="margin-left:'+(a[2]*22)+'px"><small>'+esc(a[0])+"</small>"+esc(a[1])+" "+co(a[3])+"</div>";}).join("")+"</div>"+
      (m.pills?'<div class="mk-pills"><small class="lcap">DATA</small>'+m.pills.map(function(p){return '<span class="mk-pill">'+esc(p)+"</span>";}).join("")+co(m.pn)+"</div>":"");
  }else if(k==="map"){h='<div style="padding:8px 8px 4px;position:relative">'+(m.n?'<div style="position:absolute;left:8px;top:8px">'+co(m.n)+"</div>":"")+mkSvgMap(m)+"</div>";}
  else if(k==="chart"){h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>'+co(m.n)+'<span class="mk-b">Data</span><span class="mk-b">Style</span><span class="mk-b pri">Save</span></div><div style="padding:8px">'+mkChart(m)+"</div>";}
  else if(k==="board"){h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>'+co(m.n)+'</div><div class="mk-board">'+m.lanes.map(function(l){return '<div class="ln"><p>'+esc(l[0])+"</p>"+l[1].map(function(c){return '<div class="cd">'+esc(c)+"</div>";}).join("")+"</div>";}).join("")+"</div>";}
  else if(k==="pipe"){h='<div class="mk-pipe">'+m.steps.map(function(s,i){return '<span class="s'+(i===m.hl?" hl":"")+'">'+esc(s)+(i===m.hl?co(m.n):"")+"</span>";}).join("<i>→</i>")+"</div>";}
  else if(k==="preview"){h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>'+co(m.n)+'</div><div class="mk-prev">'+m.f.map(function(f){return '<div class="r">'+(f[0]?"<span>"+esc(f[0])+"</span>":"")+"<div>"+esc(f[1])+"</div></div>";}).join("")+"</div>";}
  else if(k==="chat"){h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>'+co(m.n)+'</div><div class="mk-chat">'+m.msgs.map(function(x){return '<p class="'+x[0]+'">'+esc(x[1])+"</p>";}).join("")+"</div>";}
  else if(k==="tiles"){h='<div class="mk-fh"><b>'+esc(m.t)+'</b><span class="mk-sp"></span>'+co(m.n)+'</div><div class="mk-tiles">'+m.tiles.map(function(t,i){return "<div"+(i===m.hl?' class="hl"':"")+"><b>"+esc(t[1])+"</b><span>"+esc(t[0])+"</span></div>";}).join("")+"</div>";}
  return '<figure class="mk mk-'+k+'">'+h+"</figure>";
}
function labBody(L){
  var shot=LS.shots[L.id], done=LS.done[L.id];
  var shotH=ui.assets
    ?(shot?'<img src="'+esc(shot.url)+TL('" alt="A minha captura: ','" alt="My screenshot: ')+esc(L.t)+TL('" loading="lazy"><div class="row"><label class="btn">Trocar captura<input type="file" accept="image/*" data-shot="','" loading="lazy"><div class="row"><label class="btn">Replace screenshot<input type="file" accept="image/*" data-shot="')+L.id+'" hidden></label><button class="link" data-act="shotdel" data-v="'+L.id+TL('">Remover</button></div>','">Remove</button></div>')
      :TL('<p>Quando fizeres o lab na tua PDI, guarda aqui uma captura do teu ecrã. Fica ao lado da ilustração para comparares.</p><div class="row"><label class="btn">Adicionar a minha captura<input type="file" accept="image/*" data-shot="','<p>When you do the lab in your PDI, save a screenshot of your screen here. It sits next to the illustration so you can compare.</p><div class="row"><label class="btn">Add my screenshot<input type="file" accept="image/*" data-shot="')+L.id+'" hidden></label></div>')
    :TL('<p>Para guardares aqui capturas da tua PDI, abre a app no claude.ai com a sessão iniciada.</p>','<p>To save screenshots of your PDI here, open the app on claude.ai while signed in.</p>');
  return '<div class="lab"><div class="lpath">'+L.path.map(function(p){return "<span>"+esc(p)+"</span>";}).join("<i>›</i>")+TL('</div><p class="lrole">Role necessário: ','</div><p class="lrole">Role required: ')+esc(L.role)+"</p>"+
    '<div class="lgrid"><div><ol class="lsteps">'+L.steps.map(function(s){return "<li>"+md(s)+"</li>";}).join("")+TL('</ol><div class="lsee"><b>O que deves ver:</b> ','</ol><div class="lsee"><b>What you should see:</b> ')+md(L.see)+"</div>"+(L.warn?'<div class="lwarn">'+md(L.warn)+"</div>":"")+
    TL('<p class="lsrc">Passos com base em: ','<p class="lsrc">Steps based on: ')+L.src.map(function(s){return '<a href="'+esc(s[1])+'" target="_blank" rel="noopener">'+esc(s[0])+"</a>";}).join(" · ")+TL(" (documentação oficial ServiceNow)</p></div>"," (official ServiceNow documentation)</p></div>")+
    '<div class="lfigs">'+L.mock.map(mock).join("")+TL('<p class="lcap">Ilustração esquemática feita por mim a partir da doc, não é uma captura real. Os números correspondem aos passos; o ecrã da tua instância pode ter outro aspeto.</p>','<p class="lcap">Schematic illustration I made from the docs, not a real screenshot. The numbers match the steps; your instance’s screen may look different.</p>')+
    (OFFLINE||WEB?"":'<div class="lshot" data-shotbox="'+L.id+'">'+shotH+'</div>')+'<label class="ldone"><input type="checkbox" data-done="'+L.id+'"'+(done?" checked":"")+TL("> Já fiz este lab na minha PDI</label></div></div></div>","> I’ve done this lab in my PDI</label></div></div></div>");
}
function labForQ(q){
  var id=LMAP[q.id], L=id&&LABS&&LABS[id]; if(!L)return "";
  return '<details class="labd" data-lab="'+L.id+TL('"><summary><p class="lbl">Na prática</p><b>','"><summary><p class="lbl">In practice</p><b>')+esc(L.t)+"</b></summary>"+labBody(L)+"</details>";
}
function labDomain(L){var c={};L.qs.forEach(function(id){var q=Q[id];if(q)c[q.d]=(c[q.d]||0)+1;});var best=0,b=1;for(var d in c)if(c[d]>best){best=c[d];b=+d;}return b;}
function vLabs(){
  if(!LABS)return TL('<div class="vh"><h1>Labs</h1></div><div class="empty"><b>A carregar os labs…</b></div>','<div class="vh"><h1>Labs</h1></div><div class="empty"><b>Loading the labs…</b></div>');
  var list=Object.keys(LABS).map(function(k){return LABS[k];});
  if(ui.lab&&LABS[ui.lab]){
    var L=LABS[ui.lab];
    return TL('<a class="backl" href="#labs" data-act="labback">‹ Todos os labs</a><div class="vh"><h1>','<a class="backl" href="#labs" data-act="labback">‹ All labs</a><div class="vh"><h1>')+esc(L.t)+"</h1><p>"+L.qs.length+TL(" questões do banco tocam neste tema</p></div><section class=\"panel\">"," questions in the bank touch on this topic</p></div><section class=\"panel\">")+labBody(L)+"</section>";
  }
  var nd=list.filter(function(L){return LS.done[L.id];}).length, by={};
  list.forEach(function(L){var d=labDomain(L);(by[d]=by[d]||[]).push(L);});
  return '<div class="vh"><h1>Labs</h1><p>'+nd+TL(" de "," of ")+list.length+TL(' feitos na PDI</p></div><p style="color:var(--ink-2);max-width:66ch;margin:0 0 8px">Cada lab mostra como chegar ao tema de uma questão numa instância real: o caminho no menu, os passos (com base na documentação oficial), o que deves ver e uma ilustração do ecrã. Também aparecem dentro de cada questão, depois de responderes.</p><div class="labl">',' done in the PDI</p></div><p style="color:var(--ink-2);max-width:66ch;margin:0 0 8px">Each lab shows how to reach a question’s topic in a real instance: the menu path, the steps (based on the official documentation), what you should see and an illustration of the screen. They also appear inside each question, after you answer.</p><div class="labl">')+
    D.domains.filter(function(d){return by[d.id];}).map(function(d){return TL("<h2>Domínio ","<h2>Domain ")+d.id+" · "+esc(d.name)+"</h2>"+by[d.id].map(function(L){
      return '<a href="#labs" data-act="labopen" data-v="'+L.id+'"><span class="ck'+(LS.done[L.id]?" on":"")+'">'+(LS.done[L.id]?"✓":"")+"</span><b>"+esc(L.t)+"</b><small>"+L.qs.length+TL(" questões"," questions")+(LS.shots[L.id]?" · 📷":"")+"</small></a>";}).join("");}).join("")+"</div>";
}
function shotUpload(id,file){
  if(!ui.assets||!file)return;
  if(!/^image\//.test(file.type)){toast(TL("Escolhe uma imagem (PNG ou JPG).","Choose an image (PNG or JPG)."));return;}
  var box=document.querySelector('[data-shotbox="'+id+'"]'); if(box)box.innerHTML=TL("<p>A enviar a captura…</p>","<p>Uploading the screenshot…</p>");
  var old=LS.shots[id];
  ui.assets.upload(file).then(function(r){
    LS.shots[id]={id:r.id,url:r.url,t:Date.now()}; saveLabs(true); render();
    if(old&&old.id)ui.assets.delete(old.id).catch(function(){});
    toast(TL("Captura guardada.","Screenshot saved."));
  }).catch(function(e){render();toast(e&&e.code==="too_large"?TL("A imagem é demasiado grande.","The image is too large."):TL("Não consegui guardar a captura.","Couldn’t save the screenshot."));});
}
function shotDelete(id){
  var s=LS.shots[id]; if(!s)return;
  delete LS.shots[id]; saveLabs(true); render();
  if(ui.assets&&s.id)ui.assets.delete(s.id).catch(function(){});
}

/* ---------------- v12: métricas partilhadas ---------------- */
var T=null;
function fmt1(x){var v=(Math.round(x*10)/10).toFixed(1);return LANG==="en"?v:v.replace(".",",");}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function dmy(t){return new Date(t).toLocaleDateString(LOC(),{day:"numeric",month:"short"});}
function examTs(){var s=S.cfg.examDate;if(!s)return null;var t=new Date(s+"T09:00:00");return isNaN(t)?null:+t;}
function daysLeft(){var t=examTs();if(t==null)return null;return Math.round((sod(t)-sod(Date.now()))/DAY);}
function wrongCap(){var d=daysLeft();return d!=null&&d>=0&&d<=14?0.4:0.3;}
// intervalo de cada caixa ajustado ao tempo até ao exame (mais tempo, mais espaçado; menos tempo, volta mais cedo)
function ivFactor(){var d=daysLeft();if(d==null||d<0)return 1;return clamp(d/48,0.25,1.5);}
function ivDays(b){var base=INT[b]||0;if(b<=1)return 0;var d=daysLeft();if(d==null||d<0)return base;return Math.max(1,Math.min(Math.max(1,Math.floor(d/3)),Math.round(base*ivFactor())));}
function strictSeen(){var n=0;pool(false).forEach(function(q){var r=rec(q.id);if(r&&r.n)n++;});return n;}
function logAll(){return S.log||[];}
function avgMs(n){var L=logAll().filter(function(e){return e[4]>0;}).slice(-(n||200));if(L.length<5)return null;return L.reduce(function(a,e){return a+Math.min(e[4],300000);},0)/L.length;}
var MPQ_MAX=4;
function minutesPerQ(){var sm=0,sq=0,t=Date.now();for(var i=0;i<30;i++){var d=S.days[dkey(t-i*DAY)];if(d&&d.sq){sm+=Math.min(d.sm||0,d.sq*MPQ_MAX);sq+=d.sq;}}return sq>=20?clamp(sm/sq,0.5,MPQ_MAX):1.2;}
function eligibleExams(){return S.exams.filter(function(e){var s=exStats(e);return (e.bank||"d")==="d"&&e.n>=30&&s.nA>=e.n*0.8;});}
function examPct(e){var s=exStats(e);return 100*s.okA/e.n;}
function trail(t,n){var q=0,ok=0;for(var j=0;j<n;j++){var d=S.days[dkey(t-j*DAY)];if(d){q+=d.q||0;ok+=d.ok||0;}}return {q:q,ok:ok};}

/* índice de confiança 0–10: média ponderada de seis componentes, cada um de 0 a 1 */
var SCORE_W={C:.15,M:.25,R:.15,X:.25,K:.10,P:.10};
function confScore(){
  var ds={};D.domains.forEach(function(d){ds[d.id]={t:0,s:0,c:0,m3:0};});
  pool(false).forEach(function(q){var o=ds[q.d],r=rec(q.id);o.t++;if(r&&r.n){o.s++;if(r.l){o.c++;if(r.b>=3)o.m3++;}}});
  var C=0,M=0,R=0;
  D.domains.forEach(function(d){var o=ds[d.id],w=d.w/100;if(!o.t)return;C+=w*o.s/o.t;M+=w*(o.s?o.c/o.s:0);R+=w*(o.s?o.m3/o.s:0);});
  var ex=eligibleExams().slice(-3), X=ex.length?ex.reduce(function(a,e){return a+examPct(e)/100;},0)/ex.length:0;
  var cs=S.cal.s||[0,0], tot=(S.cal.s[1]||0)+(S.cal.a[1]||0)+(S.cal.p[1]||0);
  var acS=cs[1]>=10?cs[0]/cs[1]:0.5, gs=tot?(S.cal.p[1]||0)/tot:0.5, K=0.6*acS+0.4*(1-gs);
  var am=avgMs(200), P=am==null?0.5:clamp((120000-am)/60000,0,1);
  var parts=[
    {k:"M",n:TL("Acerto nas questões vistas","Accuracy on questions seen"),v:M,d:TL("Certas na última tentativa, por domínio, com o peso do blueprint.","Correct on the last attempt, per domain, with the blueprint weight.")},
    {k:"X",n:TL("Simulados","Practice exams"),v:X,d:ex.length?TL("Média dos últimos ","Average of the last ")+ex.length+TL(" simulados (as em branco contam como erradas)."," practice exams (blanks count as wrong)."):TL("Ainda sem simulado completo: este componente fica a zero.","No complete practice exam yet: this component stays at zero.")},
    {k:"C",n:TL("Cobertura do banco","Bank coverage"),v:C,d:TL("Questões já vistas, por domínio, com o peso do blueprint.","Questions already seen, per domain, with the blueprint weight.")},
    {k:"R",n:TL("Retenção","Retention"),v:R,d:TL("Questões certas que já sobreviveram a revisões espaçadas (caixa 3 ou mais).","Correct questions that have already survived spaced reviews (box 3 or higher).")},
    {k:"K",n:TL("Calibração e palpites","Calibration and guesses"),v:K,d:TL("Quanto acertas quando dizes «tenho a certeza» e quão poucas vezes recorres ao palpite.","How often you’re right when you say «I’m sure», and how rarely you fall back on a guess.")},
    {k:"P",n:TL("Ritmo","Pace"),v:P,d:am==null?TL("Ainda sem tempos medidos: conta a meio.","No times measured yet: counts as half."):TL("Tempo médio por questão: ","Average time per question: ")+mmss(am)+TL(" (1:00 ou menos vale tudo; 2:00 ou mais vale zero)."," (1:00 or less scores full; 2:00 or more scores zero).")}
  ];
  var score=0;parts.forEach(function(p){p.w=SCORE_W[p.k];score+=p.w*p.v;});
  return {score:10*score,parts:parts};
}
function scoreBand(s){return s>=8?{t:TL("Pronto para marcar o exame","Ready to book the exam"),c:"ok"}:s>=7?{t:TL("Quase lá","Almost there"),c:"lime"}:s>=5?{t:TL("A caminho","On the way"),c:"warn"}:{t:TL("Ainda longe","Still far"),c:"bad"};}
function snapDay(){if(!D)return;var d=day();d.sc=Math.round(confScore().score*10);d.rd=readiness(domStats());lbSchedule();}

/* ---------------- gráficos pequenos ---------------- */
function spark(vals,target,max){
  var W=200,H=34,pts=[],n=vals.length;max=max||Math.max.apply(null,vals.filter(function(v){return v!=null;}).concat([target||0,1]));
  vals.forEach(function(v,i){if(v!=null)pts.push([n>1?i*(W-4)/(n-1)+2:W/2,H-3-(H-6)*clamp(v/max,0,1)]);});
  if(!pts.length)return '<svg class="spark" viewBox="0 0 200 34" aria-hidden="true"></svg>';
  var d=pts.map(function(p,i){return (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" ");
  var a=d+" L"+pts[pts.length-1][0].toFixed(1)+" "+(H-1)+" L"+pts[0][0].toFixed(1)+" "+(H-1)+" Z";
  var tg=target!=null?'<line class="tg" x1="0" x2="'+W+'" y1="'+(H-3-(H-6)*clamp(target/max,0,1)).toFixed(1)+'" y2="'+(H-3-(H-6)*clamp(target/max,0,1)).toFixed(1)+'"/>':"";
  var e=pts[pts.length-1];
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+tg+(pts.length>1?'<path class="ar" d="'+a+'"/><path class="ln" d="'+d+'"/>':"")+'<circle class="dot" cx="'+e[0].toFixed(1)+'" cy="'+e[1].toFixed(1)+'" r="3.5"/></svg>';
}
function gaugeHTML(cs,compact){
  var r=60,L=2*Math.PI*r,v=clamp(cs.score/10,0,1),b=scoreBand(cs.score);
  var svg=TL('<svg viewBox="0 0 150 150" role="img" aria-label="Índice de confiança ','<svg viewBox="0 0 150 150" role="img" aria-label="Confidence index ')+fmt1(cs.score)+TL(' em 10"><circle class="trk" cx="75" cy="75" r="',' out of 10"><circle class="trk" cx="75" cy="75" r="')+r+'"/><circle class="val" cx="75" cy="75" r="'+r+'" stroke-dasharray="'+(L*v).toFixed(1)+" "+L.toFixed(1)+'" transform="rotate(-90 75 75)"/><text class="gt" x="75" y="80" text-anchor="middle">'+fmt1(cs.score)+TL('</text><text class="gs" x="75" y="100" text-anchor="middle">DE 10</text></svg>','</text><text class="gs" x="75" y="100" text-anchor="middle">OUT OF 10</text></svg>');
  if(compact)return '<div class="gauge">'+svg+'<div><span class="pill '+b.c+'">'+b.t+TL('</span><p class="small muted" style="margin:10px 0 0">Junta acerto, simulados, cobertura, retenção, calibração e ritmo. A meta é 8 ou mais.</p><a class="link" href="#progresso">Ver como é calculado</a></div></div>','</span><p class="small muted" style="margin:10px 0 0">Combines accuracy, practice exams, coverage, retention, calibration and pace. The target is 8 or more.</p><a class="link" href="#progresso">See how it’s calculated</a></div></div>');
  var parts='<ul class="parts">'+cs.parts.map(function(p){return '<li><span>'+esc(p.n)+TL(' <small>· peso ',' <small>· weight ')+Math.round(p.w*100)+'%</small></span><span class="num">'+Math.round(p.v*100)+'%</span><div class="bar"><i class="b-m" style="width:'+Math.round(p.v*100)+'%"></i></div></li>';}).join("")+'</ul>';
  return '<div class="gauge">'+svg+'<div><span class="pill '+b.c+'">'+b.t+'</span><div style="margin-top:14px">'+parts+'</div></div></div>';
}
function donutHTML(segs,label){
  var r=52,L=2*Math.PI*r,sum=segs.reduce(function(a,s){return a+s.v;},0),tot=sum||1,off=0,gap=segs.filter(function(s){return s.v;}).length>1?3:0;
  function da(s,i){return ' data-seg="'+i+'" data-n="'+esc(s.n)+'" data-v="'+s.v+'" data-p="'+(sum?Math.round(s.v/sum*100):0)+'" data-c="'+esc(s.c)+'" data-d="'+esc(s.d||"")+'"';}
  var arcs=segs.map(function(s,i){if(!s.v)return "";var len=L*s.v/tot,el='<circle class="arc" cx="66" cy="66" r="'+r+'" fill="none" stroke="'+s.c+'" stroke-width="16" stroke-dasharray="'+Math.max(0,len-gap).toFixed(1)+" "+L.toFixed(1)+'" stroke-dashoffset="'+(-off).toFixed(1)+'" transform="rotate(-90 66 66)"'+da(s,i)+'></circle>';off+=len;return el;}).join("");
  return '<div class="donut"><svg viewBox="0 0 132 132" role="img" aria-label="'+esc(label)+'"><circle cx="66" cy="66" r="'+r+'" fill="none" stroke="var(--sunk)" stroke-width="16"/>'+arcs+'<text x="66" y="71" text-anchor="middle" style="font:600 22px var(--display);fill:var(--ink)">'+sum+'</text></svg><ul class="lg">'+segs.map(function(s,i){return '<li'+da(s,i)+'><i style="background:'+s.c+'"></i><span>'+esc(s.n)+'</span><b>'+s.v+'</b></li>';}).join("")+'</ul><div class="dtip" hidden></div></div>';
}

/* ---------------- KPIs (como os indicadores do Performance Analytics: valor, meta, tendência) ---------------- */
function kpiStatus(v,tg,higher){if(v==null)return "";if(higher)return v>=tg?"ok":v>=tg*0.85?"warn":"bad";return v<=tg?"ok":v<=tg*1.15?"warn":"bad";}
/* ---------------- explicações (botão «i» com dica ao passar o rato) ---------------- */
function HELP(){var w=function(k){return Math.round(SCORE_W[k]*100);};return {
  score:TL("Nota de 0 a 10 que estima quão preparado estás para o exame. Junta 6 componentes com pesos: acerto 25%, simulados 25%, cobertura 15%, retenção 15%, calibração 10% e ritmo 10%. 8 ou mais, com 80% em três simulados seguidos, é bom sinal para marcar o exame.","A 0 to 10 score that estimates how ready you are for the exam. It combines 6 weighted parts: accuracy 25%, practice exams 25%, coverage 15%, retention 15%, calibration 10% and pace 10%. 8 or more, with 80% in three practice exams in a row, is a good sign to book the exam."),
  readiness:TL("Estimativa da nota se o exame fosse hoje. Em cada domínio conta as questões certas na última tentativa sobre o total do domínio (as que ainda não viste contam como erradas) e pesa pelo peso do domínio no blueprint.","An estimate of your score if the exam were today. In each domain it counts the questions right on the last attempt over the domain total (questions not seen yet count as wrong) and weights it by the domain’s blueprint weight."),
  coverage:TL("Percentagem das questões ativas do banco a que já respondeste pelo menos uma vez. Mede quanto do conteúdo já viste, não se acertaste.","Share of the active questions in the bank you’ve answered at least once. It measures how much of the content you’ve seen, not whether you got it right."),
  acc7:TL("Respostas certas sobre respostas dadas nos últimos 7 dias, contando repetições. Mostra a forma recente.","Correct answers over answers given in the last 7 days, repeats included. It shows your recent form."),
  exams:TL("Média dos últimos 3 simulados válidos (30 ou mais questões, com pelo menos 80% respondidas). As questões em branco contam como erradas. Meta: 80%.","Average of the last 3 valid practice exams (30 or more questions, with at least 80% answered). Blank questions count as wrong. Target: 80%."),
  streak:TL("Dias seguidos com pelo menos uma questão respondida. Se hoje ainda não estudaste, conta até ontem.","Days in a row with at least one question answered. If you haven’t studied today yet, it counts up to yesterday."),
  updated:TL("Quando as estatísticas foram enviadas pela última vez. Atualizam-se sozinhas uns segundos depois de responderes a uma questão.","When the stats were last sent. They update by themselves a few seconds after you answer a question."),
  answers:TL("Todas as respostas dadas desde o início, incluindo repetições da mesma questão.","Every answer given since the start, including repeats of the same question."),
  studied:TL("Número de dias diferentes com pelo menos uma resposta.","Number of different days with at least one answer."),
  avgms:TL("Média do tempo gasto nas últimas 200 respostas (cada uma limitada a 5 minutos). No exame tens 1:30 por questão.","Average time spent on the last 200 answers (each capped at 5 minutes). In the exam you have 1:30 per question."),
  sure:TL("Das respostas marcadas «tenho a certeza», a percentagem que estava certa. Perto de 100% quer dizer que a confiança bate certo com o conhecimento. Só aparece a partir de 10 respostas.","Of the answers marked «I’m sure», the share that was right. Close to 100% means confidence matches knowledge. Shows up after 10 answers."),
  points:TL("Pontos do ranking, de 0 a 100: 60% prontidão + 40% média dos últimos 3 simulados (sem simulado conta 0). Só entra o que mostra se passarias no exame. Ritmo, calibração e dias seguidos não contam.","Ranking points, 0 to 100: 60% readiness + 40% average of the last 3 practice exams (no exam counts as 0). Only what shows whether you’d pass the exam counts. Pace, calibration and day streak don’t."),
  pos:TL("O teu lugar entre os colegas visíveis da mesma certificação, ordenado pelos pontos.","Your place among the visible classmates of the same certification, sorted by points."),
  order:TL("Ordena pelos pontos (60% prontidão + 40% simulados). Em caso de empate, desempata pelos simulados, depois pelo banco visto e por fim pelo número de respostas.","Sorted by points (60% readiness + 40% practice exams). Ties are broken by practice exams, then bank seen, then number of answers."),
  dom:TL("Cobertura e acerto em cada um dos domínios do exame, com o peso que cada um tem.","Coverage and accuracy in each exam domain, with the weight each one has."),
  w:TL("Quanto o domínio pesa no exame, segundo o blueprint oficial.","How much the domain weighs in the exam, according to the official blueprint."),
  seen:TL("Percentagem das questões deste domínio já respondidas pelo menos uma vez.","Share of this domain’s questions answered at least once."),
  acc:TL("Das questões deste domínio já vistas, a percentagem certa na última tentativa.","Of this domain’s questions already seen, the share right on the last attempt."),
  you:TL("O teu acerto no mesmo domínio, para comparares.","Your accuracy in the same domain, for comparison."),
  M:TL("Vale ","Worth ")+w("M")+TL("% do índice. Questões certas na última tentativa sobre as vistas, por domínio, com o peso do blueprint.","% of the index. Questions right on the last attempt over those seen, per domain, with the blueprint weight."),
  X:TL("Vale ","Worth ")+w("X")+TL("% do índice. Média dos últimos 3 simulados válidos. Sem nenhum simulado completo fica a zero.","% of the index. Average of the last 3 valid practice exams. With no complete practice exam it stays at zero."),
  C:TL("Vale ","Worth ")+w("C")+TL("% do índice. Questões já vistas sobre o total, por domínio, com o peso do blueprint.","% of the index. Questions seen over the total, per domain, with the blueprint weight."),
  R:TL("Vale ","Worth ")+w("R")+TL("% do índice. Questões certas que já sobreviveram a revisões espaçadas (caixa 3 ou mais), sobre as vistas. Mede o que fica na memória.","% of the index. Correct questions that have already survived spaced reviews (box 3 or higher), over those seen. It measures what sticks."),
  K:TL("Vale ","Worth ")+w("K")+TL("% do índice. 60% vem do acerto quando dizes «tenho a certeza» (a partir de 10 respostas) e 40% de quão pouco recorres ao palpite.","% of the index. 60% comes from accuracy when you say «I’m sure» (after 10 answers) and 40% from how rarely you guess."),
  P:TL("Vale ","Worth ")+w("P")+TL("% do índice. Tempo médio por questão: 1:00 ou menos vale tudo, 2:00 ou mais vale zero, e pelo meio desce a direito.","% of the index. Average time per question: 1:00 or less scores full, 2:00 or more scores zero, and in between it falls in a straight line."),
  exlist:TL("Os últimos 6 simulados válidos e a nota de cada um. A verde, os de 80% ou mais.","The last 6 valid practice exams and the score of each. In green, those at 80% or more."),
  activity:TL("Questões respondidas por dia nos últimos 14 dias. Passa o rato numa barra para veres o dia e o número.","Questions answered per day over the last 14 days. Hover a bar to see the day and the number."),
  kacc7:TL("Respostas certas sobre respostas dadas nos últimos 7 dias, contando repetições. A seta compara com os 7 dias anteriores. Meta: 80%.","Correct answers over answers given in the last 7 days, repeats included. The arrow compares with the previous 7 days. Target: 80%."),
  kcov:TL("Percentagem das questões ativas do banco a que já respondeste pelo menos uma vez. Em baixo, quantas questões novas viste nos últimos 7 dias.","Share of the active questions in the bank you’ve answered at least once. Below, how many new questions you saw in the last 7 days."),
  kpace:TL("Média do tempo por questão nas últimas 100 respostas (cada uma limitada a 5 minutos). Meta: 1:30, o ritmo do exame (60 questões em 90 minutos).","Average time per question over the last 100 answers (each capped at 5 minutes). Target: 1:30, the exam pace (60 questions in 90 minutes)."),
  kdays:TL("Em quantos dos últimos 7 dias respondeste a pelo menos uma questão. Meta: 5 dias por semana.","On how many of the last 7 days you answered at least one question. Target: 5 days a week."),
  khc:TL("Questões que erraste depois de dizer «tenho a certeza» e que ainda não voltaste a acertar. São as mais perigosas: achas que sabes e não sabes. Meta: 0.","Questions you got wrong after saying «I’m sure» and haven’t got right again yet. They’re the most dangerous: you think you know and you don’t. Target: 0.")
};}
function info(t){return '<button type="button" class="info" data-tip="'+esc(t)+'" aria-label="'+esc(t)+'">i</button>';}
(function(){
  var tip=null;
  function hide(){if(tip){tip.remove();tip=null;}}
  function show(el){
    hide(); tip=document.createElement("div"); tip.className="itip"; tip.setAttribute("role","tooltip"); tip.textContent=el.getAttribute("data-tip");
    (el.closest("dialog")||document.body).appendChild(tip);
    var r=el.getBoundingClientRect(), w=tip.offsetWidth, h=tip.offsetHeight;
    var x=Math.max(8,Math.min(window.innerWidth-w-8,r.left+r.width/2-w/2)), y=r.top-h-8; if(y<8)y=r.bottom+8;
    tip.style.left=x+"px"; tip.style.top=y+"px";
  }
  function inf(e){return e.target&&e.target.closest?e.target.closest(".info"):null;}
  document.addEventListener("mouseover",function(e){var el=inf(e);if(el)show(el);});
  document.addEventListener("mouseout",function(e){if(inf(e))hide();});
  document.addEventListener("focusin",function(e){var el=inf(e);if(el)show(el);});
  document.addEventListener("focusout",function(e){if(inf(e))hide();});
  document.addEventListener("click",function(e){var el=inf(e);if(el){e.preventDefault();e.stopPropagation();show(el);}},true);
  document.addEventListener("keydown",function(e){if(e.key==="Escape")hide();});
  window.addEventListener("scroll",hide,true);
})();

function kpiList(){
  var now=Date.now(),days14=[];for(var i=13;i>=0;i--)days14.push(now-i*DAY);
  var t7=trail(now,7),p7=trail(now-7*DAY,7);
  var acc=t7.q?100*t7.ok/t7.q:null, accP=p7.q?100*p7.ok/p7.q:null;
  var total=pool(false).length, seen=strictSeen(), cov=100*seen/total;
  var nw7=0;for(var j=0;j<7;j++){var dd=S.days[dkey(now-j*DAY)];if(dd)nw7+=dd.nw||0;}
  var am=avgMs(100);
  var paceDays=days14.map(function(t){var k=dkey(t),L=logAll().filter(function(e){return e[4]>0&&dkey(e[0])===k;});return L.length?L.reduce(function(a,e){return a+Math.min(e[4],300000);},0)/L.length/1000:null;});
  var ex=eligibleExams(), exL=ex.slice(-3), exAvg=exL.length?exL.reduce(function(a,e){return a+examPct(e);},0)/exL.length:null;
  var act7=0;for(j=0;j<7;j++){if((S.days[dkey(now-j*DAY)]||{}).q)act7++;}
  var cs=confScore(), rd=readiness(domStats()), hc=hcList().length;
  var cum=0,before=0,ks=Object.keys(S.days);ks.forEach(function(k){if(new Date(k+"T00:00:00")<sod(days14[0]))before+=S.days[k].nw||0;});cum=before;
  var covS=days14.map(function(t){cum+=(S.days[dkey(t)]||{}).nw||0;return Math.min(100,100*cum/total);});
  return [
    {n:TL("Taxa de acerto · 7 dias","Accuracy · 7 days"),h:"kacc7",v:acc,f:acc==null?"—":Math.round(acc)+"%",tg:80,tf:TL("Meta 80%","Target 80%"),hi:true,d:acc!=null&&accP!=null?acc-accP:null,du:" p.p.",sp:days14.map(function(t){var d=S.days[dkey(t)];return d&&d.q?100*d.ok/d.q:null;}),mx:100},
    {n:TL("Índice de confiança","Confidence index"),h:"score",v:cs.score,f:fmt1(cs.score),tg:8,tf:TL("Meta 8,0","Target 8.0"),hi:true,d:null,sp:days14.map(function(t){var d=S.days[dkey(t)];return d&&d.sc!=null?d.sc/10:null;}),mx:10},
    {n:TL("Cobertura do banco","Bank coverage"),h:"kcov",v:cov,f:Math.round(cov)+"%",tg:100,tf:seen+TL(" de "," of ")+total+TL(" vistas"," seen"),hi:true,d:nw7,du:TL(" novas em 7 dias"," new in 7 days"),sp:covS,mx:100,abs:true},
    {n:TL("Prontidão ponderada","Weighted readiness"),h:"readiness",v:rd,f:rd+"%",tg:80,tf:TL("Meta 80% · peso do blueprint","Target 80% · blueprint weight"),hi:true,d:null,sp:days14.map(function(t){var d=S.days[dkey(t)];return d&&d.rd!=null?d.rd:null;}),mx:100},
    {n:TL("Ritmo por questão","Pace per question"),h:"kpace",v:am==null?null:am/1000,f:am==null?"—":mmss(am),tg:90,tf:TL("Meta 1:30 (ritmo do exame)","Target 1:30 (exam pace)"),hi:false,d:null,sp:paceDays,mx:180},
    {n:TL("Média dos simulados","Practice exam average"),h:"exams",v:exAvg,f:exAvg==null?"—":Math.round(exAvg)+"%",tg:80,tf:exL.length?TL("Últimos ","Last ")+exL.length+TL(" · meta 80%"," · target 80%"):TL("Ainda sem simulados completos","No complete practice exams yet"),hi:true,d:null,sp:ex.slice(-8).map(examPct),mx:100},
    {n:TL("Dias de estudo · 7 dias","Study days · 7 days"),h:"kdays",v:act7,f:act7+"/7",tg:5,tf:TL("Meta 5 dias por semana","Target 5 days a week"),hi:true,d:null,sp:days14.map(function(t){var d=S.days[dkey(t)];return d?d.q||0:0;})},
    {n:TL("Erros confiantes por resolver","Open confident mistakes"),h:"khc",v:hc,f:String(hc),tg:0,tf:TL("Meta 0","Target 0"),hi:false,d:null,sp:null}
  ];
}
function kpiHTML(k){
  var st=k.hi===false&&k.tg===0?(k.v===0?"ok":k.v<=3?"warn":"bad"):kpiStatus(k.v,k.tg,k.hi);
  var pill=st?'<span class="pill '+(st==="ok"?"ok":st==="warn"?"warn":"bad")+'">'+(st==="ok"?TL("Na meta","On target"):st==="warn"?TL("Perto","Close"):TL("Abaixo","Below"))+"</span>":TL('<span class="pill">Sem dados</span>','<span class="pill">No data</span>');
  var dl=k.d==null?"":k.abs?'<span class="kd flat">+'+k.d+(k.du||"")+"</span>":'<span class="kd '+(k.d>0.5?"up":k.d<-0.5?"down":"flat")+'">'+(k.d>0?"▲ +":k.d<0?"▼ ":"")+Math.round(k.d)+(k.du||"")+TL(" vs semana anterior</span>"," vs previous week</span>");
  return '<div class="kpi"><div class="kh"><span class="kn">'+esc(k.n)+(k.h?info(HELP()[k.h]):"")+"</span>"+pill+'</div><div class="kv">'+k.f+'</div><div class="kt">'+esc(k.tf)+"</div>"+dl+(k.sp?spark(k.sp,k.hi===false&&k.tg===0?null:k.tg,k.mx):"")+"</div>";
}

/* ---------------- evolução e projeção ---------------- */
function regress(pts){var n=0,sx=0,sy=0,sxx=0,sxy=0;pts.forEach(function(p){var w=p[2]||1;n+=w;sx+=w*p[0];sy+=w*p[1];sxx+=w*p[0]*p[0];sxy+=w*p[0]*p[1];});var den=n*sxx-sx*sx;if(!n||!den)return null;var b=(n*sxy-sx*sy)/den;return {b:b,a:(sy-b*sx)/n};}
function projection(){
  var total=pool(false).length, seen=strictSeen(), rem=total-seen, now=Date.now(), nw=0, act=0;
  for(var i=0;i<14;i++){var d=S.days[dkey(now-i*DAY)];if(d){nw+=d.nw||0;if(d.q)act++;}}
  var rate=nw/14, dCover=rem<=0?0:rate>0?Math.ceil(rem/rate):null;
  var pts=[];for(i=0;i<21;i++){var t=now-i*DAY,dd=S.days[dkey(t)];if(dd&&dd.q>=5)pts.push([-i,100*dd.ok/dd.q,dd.q]);}
  var t7=trail(now,7), cur=t7.q?100*t7.ok/t7.q:null, rg=pts.length>=4?regress(pts):null, slope=rg?rg.b:null;
  var dAcc=cur==null?null:cur>=80?0:slope!=null&&slope>0.05?Math.ceil((80-cur)/slope):null;
  var eta=dCover==null||dAcc==null?null:Math.max(dCover,dAcc);
  return {rem:rem,rate:rate,dCover:dCover,cur:cur,slope:slope,dAcc:dAcc,eta:eta,act:act};
}
function evoData(){
  var ks=Object.keys(S.days).filter(function(k){return S.days[k].q>0;}).sort();if(!ks.length)return null;
  var today=sod(Date.now()), start=sod(new Date(ks[0]+"T00:00:00")), n=Math.round((today-start)/DAY)+1;
  if(n>180){start=today-179*DAY;n=180;}
  var total=pool(false).length, cum=0;
  Object.keys(S.days).forEach(function(k){if(sod(new Date(k+"T00:00:00"))<start)cum+=S.days[k].nw||0;});
  var arr=[];for(var i=0;i<n;i++){var t=start+i*DAY,d=S.days[dkey(t)]||{};cum+=d.nw||0;var w=trail(t,7);
    arr.push({t:t,q:d.q||0,ok:d.ok||0,acc:w.q?100*w.ok/w.q:null,cov:Math.min(100,100*cum/total),sc:d.sc!=null?d.sc:null});}
  var ex=S.exams.filter(function(e){return e.n>=30&&exStats(e).nA>=e.n*0.8;}).map(function(e){return {t:sod(e.at),v:examPct(e)};}).filter(function(e){return e.t>=start;});
  return {arr:arr,ex:ex,start:start,today:today};
}
function evoHTML(){
  var E=evoData();if(!E||E.arr.length<2)return TL('<p class="small muted" style="margin:0">O gráfico aparece a partir do segundo dia de estudo.</p>','<p class="small muted" style="margin:0">The chart appears from the second day of study.</p>');
  var pr=projection(), dl=daysLeft(), end=E.today;
  if(dl!=null&&dl>0)end=E.today+Math.min(dl,120)*DAY;else if(pr.eta)end=E.today+Math.min(pr.eta,60)*DAY;
  var W=720,H=250,ml=36,mr=14,mt=12,mb=28,iw=W-ml-mr,ih=H-mt-mb, span=Math.max(DAY,end-E.start);
  function X(t){return ml+iw*(t-E.start)/span;} function Y(v){return mt+ih*(1-clamp(v,0,100)/100);}
  var g="";[0,20,40,60,80,100].forEach(function(v){g+='<line class="gl" x1="'+ml+'" x2="'+(W-mr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(ml-6)+'" y="'+(Y(v)+3)+'" text-anchor="end">'+v+"%</text>";});
  g+='<line class="tgt" x1="'+ml+'" x2="'+(W-mr)+'" y1="'+Y(80)+'" y2="'+Y(80)+'"/>';
  var nl=Math.min(6,Math.round(span/DAY)+1);for(var i=0;i<nl;i++){var t=E.start+span*i/(nl-1||1);g+='<text x="'+X(t)+'" y="'+(H-8)+'" text-anchor="'+(i===0?"start":i===nl-1?"end":"middle")+'">'+dmy(t)+"</text>";}
  if(end>E.today)g+='<line class="cross" x1="'+X(E.today)+'" x2="'+X(E.today)+'" y1="'+mt+'" y2="'+(mt+ih)+'" stroke-dasharray="2 3"/><text x="'+(X(E.today)+4)+'" y="'+(mt+10)+TL('">hoje</text>','">today</text>');
  if(dl!=null&&dl>0&&dl<=120)g+='<text x="'+(X(end)-2)+'" y="'+(mt+10)+TL('" text-anchor="end">exame</text>','" text-anchor="end">exam</text>');
  function path(key){var d="",pen=false;E.arr.forEach(function(p){var v=p[key];if(v==null){pen=false;return;}d+=(pen?"L":"M")+X(p.t).toFixed(1)+" "+Y(key==="sc"?v:v).toFixed(1)+" ";pen=true;});return d;}
  var last=E.arr[E.arr.length-1], lines='<path class="l1" d="'+path("acc")+'"/><path class="l2" d="'+path("cov")+'"/>'+(E.arr.some(function(p){return p.sc!=null;})?'<path class="l3" d="'+path("sc")+'"/>':"");
  if(end>E.today){
    var dd=Math.round((end-E.today)/DAY), total=pool(false).length;
    var cv=Math.min(100,last.cov+100*pr.rate*dd/total);lines+='<path class="l2 pj" d="M'+X(E.today).toFixed(1)+" "+Y(last.cov).toFixed(1)+" L"+X(end).toFixed(1)+" "+Y(cv).toFixed(1)+'"/>';
    if(pr.cur!=null&&pr.slope!=null){var av=clamp(pr.cur+pr.slope*dd,0,100);lines+='<path class="l1 pj" d="M'+X(E.today).toFixed(1)+" "+Y(pr.cur).toFixed(1)+" L"+X(end).toFixed(1)+" "+Y(av).toFixed(1)+'"/>';}
  }
  var exm=E.ex.map(function(e){return '<circle class="ex" cx="'+X(e.t).toFixed(1)+'" cy="'+Y(e.v).toFixed(1)+TL('" r="4.5"><title>Simulado ','" r="4.5"><title>Practice exam ')+dmy(e.t)+": "+Math.round(e.v)+"%</title></circle>";}).join("");
  var step=iw*DAY/span, hits=E.arr.map(function(p,i){return '<rect class="hit" data-i="'+i+'" x="'+(X(p.t)-step/2).toFixed(1)+'" y="'+mt+'" width="'+Math.max(2,step).toFixed(1)+'" height="'+ih+'"/>';}).join("");
  ui.evo=E;
  var legend=TL('<div class="legend" style="margin:0 0 10px"><span><i style="background:var(--s1)"></i>Acerto (média de 7 dias)</span><span><i style="background:var(--s2)"></i>Banco já visto</span><span><i style="background:var(--s3)"></i>Índice de confiança ×10</span><span><i style="background:var(--surface);border:2px solid var(--ink);border-radius:50%"></i>Simulados</span><span><i style="background:repeating-linear-gradient(90deg,var(--ink-3) 0 4px,transparent 4px 7px)"></i>Projeção ao ritmo atual</span></div>','<div class="legend" style="margin:0 0 10px"><span><i style="background:var(--s1)"></i>Accuracy (7-day average)</span><span><i style="background:var(--s2)"></i>Bank seen</span><span><i style="background:var(--s3)"></i>Confidence index ×10</span><span><i style="background:var(--surface);border:2px solid var(--ink);border-radius:50%"></i>Practice exams</span><span><i style="background:repeating-linear-gradient(90deg,var(--ink-3) 0 4px,transparent 4px 7px)"></i>Projection at the current pace</span></div>');
  var rows=E.arr.filter(function(p,i){return (E.arr.length-1-i)%7===0;}).map(function(p){return "<tr><td>"+dmy(p.t)+'</td><td class="r">'+(p.acc==null?"—":Math.round(p.acc)+"%")+'</td><td class="r">'+Math.round(p.cov)+'%</td><td class="r">'+(p.sc==null?"—":fmt1(p.sc/10))+"</td></tr>";}).join("");
  return legend+'<div class="evo" id="evo"><svg viewBox="0 0 '+W+" "+H+TL('" role="img" aria-label="Evolução do acerto, da cobertura e do índice de confiança">','" role="img" aria-label="Evolution of accuracy, coverage and the confidence index">')+g+lines+exm+hits+'</svg><div class="tip" id="evoTip" hidden></div></div>'+
    TL('<details class="more" style="margin-top:8px"><summary>Ver em tabela (por semana)</summary><div class="tbl"><table class="bp"><thead><tr><th>Dia</th><th class="r">Acerto 7 d</th><th class="r">Visto</th><th class="r">Índice</th></tr></thead><tbody>','<details class="more" style="margin-top:8px"><summary>View as a table (weekly)</summary><div class="tbl"><table class="bp"><thead><tr><th>Day</th><th class="r">Accuracy 7 d</th><th class="r">Seen</th><th class="r">Index</th></tr></thead><tbody>')+rows+"</tbody></table></div></details>";
}
function etaHTML(){
  var pr=projection(), dl=daysLeft(), when=function(n){return n==null?"—":n===0?TL("já","now"):"~"+n+(n===1?TL(" dia"," day"):TL(" dias"," days"));};
  var verdict="";
  if(pr.eta!=null&&dl!=null&&dl>0)verdict=pr.eta<=dl?TL('<div class="verdict ok"><b>Ao ritmo atual chegas a tempo.</b> Ficas pronto cerca de ','<div class="verdict ok"><b>At your current pace you’ll make it.</b> You’ll be ready about ')+(dl-pr.eta)+TL(" dias antes do exame.</div>"," days before the exam.</div>"):TL('<div class="verdict no"><b>Ao ritmo atual não chegas a tempo.</b> Faltam cerca de ','<div class="verdict no"><b>At your current pace you won’t make it.</b> You’re about ')+(pr.eta-dl)+TL(' dias. Vê o plano para saberes quanto estudar por dia. <a class="link" href="#plano">Abrir o plano</a></div>',' days short. Check the plan to see how much to study per day. <a class="link" href="#plano">Open the plan</a></div>');
  else if(pr.eta==null)verdict=TL('<p class="small muted" style="margin:14px 0 0">Ainda não há dados suficientes para projetar: preciso de pelo menos 4 dias com 5 ou mais questões nas últimas 3 semanas, e de questões novas a entrar.</p>','<p class="small muted" style="margin:14px 0 0">Not enough data to project yet: I need at least 4 days with 5 or more questions in the last 3 weeks, and new questions coming in.</p>');
  return '<div class="eta"><div><b>'+when(pr.dCover)+TL('</b><span>para ver o banco todo (','</b><span>to see the whole bank (')+pr.rem+TL(' por ver, ',' left, ')+fmt1(pr.rate)+TL('/dia)</span></div><div><b>','/day)</span></div><div><b>')+when(pr.dAcc)+TL('</b><span>para o acerto chegar a 80%','</b><span>for accuracy to reach 80%')+(pr.slope!=null?TL(" (tendência "," (trend ")+(pr.slope>=0?"+":"")+fmt1(pr.slope)+TL(" p.p./dia)"," pp/day)"):"")+'</span></div><div><b>'+(pr.eta==null?"—":pr.eta===0?TL("Hoje","Today"):dmy(Date.now()+pr.eta*DAY))+TL('</b><span>data provável em que ficas pronto</span></div></div>','</b><span>likely date you’ll be ready</span></div></div>')+verdict;
}

/* ---------------- tema da questão ---------------- */
function topicOpen(){try{return localStorage.getItem("csa2-topic")==="1";}catch(e){return false;}}
function topicHTML(q){
  if(!T)return "";var t=T.subs[q.sub],dm=T.domains[q.d];if(!t&&!dm)return "";
  var sig=t&&t.s&&t.s.length?TL('<div><span class="k">Siglas e termos</span><dl>','<div><span class="k">Acronyms and terms</span><dl>')+t.s.map(function(x){return "<dt>"+esc(x[0])+"</dt><dd>"+esc(x[1])+"</dd>";}).join("")+"</dl></div>":"";
  var src=t&&t.u?TL('<p class="small faint">Fonte: <a href="','<p class="small faint">Source: <a href="')+esc(t.u)+'" target="_blank" rel="noopener">'+esc(t.ut)+TL("</a> · documentação oficial ServiceNow</p>","</a> · official ServiceNow documentation</p>"):TL('<p class="small faint">A documentação oficial não tem um tópico próprio sobre isto. A descrição é geral.</p>','<p class="small faint">The official documentation has no topic of its own on this. The description is general.</p>');
  return '<details class="topic"'+(topicOpen()?" open":"")+TL('><summary><b>Sobre o tema · ','><summary><b>About the topic · ')+esc(q.sub)+"</b><span>"+esc(t?t.o:dm.o)+"</span></summary><div class=\"tbody\">"+
    (t?TL('<p><span class="k">O que é</span>','<p><span class="k">What it is</span>')+esc(t.o)+TL('</p><p><span class="k">Para que serve</span>','</p><p><span class="k">What it’s for</span>')+esc(t.p)+"</p>"+sig:"")+
    (dm?'<p class="dom"><b>D'+q.d+" · "+esc(DN[q.d])+"</b> · "+W[q.d]+TL("% do exame. ","% of the exam. ")+esc(dm.o)+"</p>":"")+src+"</div></details>";
}

/* ---------------- relatório de uma sessão ou simulado ---------------- */
// E: [{id, ok, f (confiança ou "x"/"b"), ms}]
function reportHTML(E,isExam){
  var byD={},byS={};E.forEach(function(e){var q=Q[e.id];if(!q)return;var d=byD[q.d]||(byD[q.d]=[0,0]),s=byS[q.sub]||(byS[q.sub]={d:q.d,n:0,ok:0,g:0,ms:0,mn:0});d[1]++;s.n++;if(e.ok){d[0]++;s.ok++;}if(e.f==="p")s.g++;if(e.ms){s.ms+=e.ms;s.mn++;}});
  var dom='<div class="drows">'+D.domains.filter(function(d){return byD[d.id];}).map(function(d){var b=byD[d.id];return '<div class="drow"><div class="dn"><span>D'+d.id+"</span>"+esc(d.name)+'</div><div class="dv">'+b[0]+"/"+b[1]+" · "+pct(b[0],b[1])+'%</div><div class="bar" role="img" aria-label="'+esc(d.name)+": "+pct(b[0],b[1])+'%"><i class="b-m" style="width:'+pct(b[0],b[1])+'%"></i><i class="b-w" style="width:'+(100-pct(b[0],b[1]))+'%"></i></div></div>';}).join("")+"</div>";
  var subs=Object.keys(byS), bad=subs.filter(function(s){return byS[s].ok<byS[s].n;}).sort(function(a,b){return (byS[b].n-byS[b].ok)-(byS[a].n-byS[a].ok)||byS[a].ok/byS[a].n-byS[b].ok/byS[b].n;});
  var easy=subs.filter(function(s){var o=byS[s];return o.ok===o.n&&o.g===0;}).sort(function(a,b){return byS[b].n-byS[a].n||(byS[a].mn?byS[a].ms/byS[a].mn:9e9)-(byS[b].mn?byS[b].ms/byS[b].mn:9e9);});
  var badH=bad.length?'<ul class="tl">'+bad.map(function(s){var o=byS[s];return '<li><span class="tn">'+esc(s)+"<small>D"+o.d+" · "+(o.n-o.ok)+TL(" errada"," wrong answer")+(o.n-o.ok>1?"s":"")+TL(" em "," in ")+o.n+'</small></span><span class="pill bad">'+pct(o.ok,o.n)+'%</span><button class="btn" data-act="trainsub" data-v="'+esc(s)+TL('">Treinar</button></li>','">Practise</button></li>');}).join("")+"</ul>":TL('<p class="small muted" style="margin:0">Sem erros nesta sessão.</p>','<p class="small muted" style="margin:0">No mistakes in this session.</p>');
  var easyH=easy.length?'<ul class="tl">'+easy.slice(0,6).map(function(s){var o=byS[s];return '<li><span class="tn">'+esc(s)+"<small>D"+o.d+" · "+o.n+TL(" certa"," correct answer")+(o.n>1?"s":"")+(o.mn?" · "+mmss(o.ms/o.mn)+TL(" em média"," on average"):"")+'</small></span><span class="pill ok">100%</span><span></span></li>';}).join("")+"</ul>":TL('<p class="small muted" style="margin:0">Nenhum tema ficou totalmente certo sem palpites.</p>','<p class="small muted" style="margin:0">No topic was fully correct without guesses.</p>');
  var T2=E.filter(function(e){return e.ms>0&&Q[e.id];}).sort(function(a,b){return a.ms-b.ms;});
  function ql(list){return '<ul class="qlist">'+list.map(function(e){var q=Q[e.id];return "<li><span>"+esc(q.stem.length>96?q.stem.slice(0,94)+"…":q.stem)+'</span><span class="num" style="color:'+(e.ok?"var(--ok)":"var(--bad)")+'">'+mmss(e.ms)+" · "+(e.ok?"certa":"errada")+"</span></li>";}).join("")+"</ul>";}
  var times=T2.length>=2?TL('<div class="grid2"><div><p class="lbl">Mais rápidas</p>','<div class="grid2"><div><p class="lbl">Fastest</p>')+ql(T2.slice(0,3))+TL('</div><div><p class="lbl">Mais lentas</p>','</div><div><p class="lbl">Slowest</p>')+ql(T2.slice(-3).reverse())+"</div></div>":TL('<p class="small muted" style="margin:0">Os tempos por questão aparecem nas sessões feitas a partir desta versão.</p>','<p class="small muted" style="margin:0">Times per question appear in sessions done from this version on.</p>');
  return TL('<div class="grid2"><section class="panel"><p class="lbl">Acerto por domínio nesta ','<div class="grid2"><section class="panel"><p class="lbl">Accuracy by domain in this ')+(isExam?TL("prova","exam"):TL("sessão","session"))+'</p>'+dom+TL('<p class="small faint" style="margin:14px 0 0">O domínio com menos acerto e mais peso no exame é o primeiro a reforçar.</p></section>','<p class="small faint" style="margin:14px 0 0">The domain with the lowest accuracy and the most weight in the exam is the first to reinforce.</p></section>')+
    TL('<section class="panel"><p class="lbl">Reler primeiro</p>','<section class="panel"><p class="lbl">Re-read first</p>')+badH+TL('<p class="lbl" style="margin-top:20px">Acertaste com facilidade</p>','<p class="lbl" style="margin-top:20px">Got these right easily</p>')+easyH+"</section></div>"+
    TL('<section class="panel"><p class="lbl">Tempo por questão</p>','<section class="panel"><p class="lbl">Time per question</p>')+times+"</section>";
}

/* ---------------- vistas ---------------- */
function render(){
  if(!D)return;
  document.querySelectorAll(".tabs a").forEach(function(a){if(a.dataset.tab===view)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  var V={treino:vTreino,simulado:vSimulado,progresso:vProgresso,labs:vLabs,montar:vMontar,ranking:vRanking,global:vGlobal,plano:vPlano,exame:vExame,conta:vConta,sobre:vSobre,novidades:vNovidades};
  var h=(V[view]||vHoje)();
  $("view").innerHTML=h; fillCachedAI(); paintSync(); paintExamTop();
}

function domStats(){
  var out={}, strict=pool(false);
  D.domains.forEach(function(d){out[d.id]={t:0,seen:0,c:0,m:0,w:0};});
  strict.forEach(function(q){var o=out[q.d],r=rec(q.id);o.t++;if(r&&r.n){o.seen++;if(r.l){o.c++;if(r.b>=4)o.m++;}else o.w++;}});
  return out;
}
function readiness(ds){var s=0;D.domains.forEach(function(d){var o=ds[d.id];s+=d.w*(o.t?o.c/o.t:0);});return Math.round(s);}
function streak(){var n=0,t=Date.now();if(!(S.days[dkey(t)]||{}).q)t-=DAY;while((S.days[dkey(t)]||{}).q){n++;t-=DAY;}return n;}
function greet(){var h=new Date().getHours();return h<12?TL("Bom dia","Good morning"):h<20?TL("Boa tarde","Good afternoon"):TL("Boa noite","Good evening");}

/* aviso para quem chega com a conta vazia: trazer o progresso do ficheiro offline */
function importHintHTML(){
  if(!WEB||Object.keys(S.p).length)return "";
  return '<section class="panel g-wide imphint"><p class="lbl">'+TL("Já estudaste noutra versão?","Studied in another version?")+'</p><p class="small muted" style="margin:0 0 12px;max-width:70ch">'+
    TL("Se usavas o ficheiro <b>Treino-CSA.html</b> ou a app antiga, abre-o no mesmo browser e vai a <b>Progresso › Dados › Exportar progresso</b>. Depois importa aqui o ficheiro que descarregaste: o progresso passa para a tua conta.",
       "If you used the <b>Treino-CSA.html</b> file or the old app, open it in the same browser and go to <b>Progress › Data › Export progress</b>. Then import the downloaded file here: your progress moves to your account.")+
    '</p>'+dataPanelHTML().replace(/<button class="btn" data-act="exportp">[^<]*<\/button>/,"")+'</section>';
}
function vHoje(){
  var due=dueList().length, fresh=freshList().length, quota=Math.max(0,S.cfg.newPerDay-(day().nw||0)), sm=smartIds(), total=sm.length;
  var d=day(), ds=domStats(), rd=readiness(ds), last=S.exams[S.exams.length-1], cs=confScore(), dl=daysLeft();
  var sess=S.sess&&S.sess.i<S.sess.q.length;
  var nW=sm.filter(function(id){var r=rec(id);return r&&r.n&&!r.l;}).length, nN=sm.filter(function(id){var r=rec(id);return !r||!r.n;}).length;
  var hero=TL('<section class="panel hero g-wide"><div><p class="lbl">Sessão de hoje</p><h2>','<section class="panel hero g-wide"><div><p class="lbl">Today’s session</p><h2>')+(sess?TL("Tens uma sessão a meio","You have a session in progress"):total?TL("A sessão de hoje está pronta","Today’s session is ready"):TL("Estás em dia","You’re up to date"))+'</h2><p>'+
    (sess?esc(lbl(S.sess.label))+TL(": questão ",": question ")+(S.sess.i+1)+TL(" de "," of ")+S.sess.q.length+".":
      total?'<span class="num">'+(total-nW-nN)+TL('</span> revisões, <span class="num">','</span> reviews, <span class="num">')+nW+TL('</span> que erraste antes (no máximo ','</span> you got wrong before (at most ')+Math.round(wrongCap()*100)+TL('% da sessão) e <span class="num">','% of the session) and <span class="num">')+nN+TL('</span> novas, misturadas entre domínios segundo o peso no exame.','</span> new, mixed across domains by their weight in the exam.'):
      TL("Não há revisões para hoje e já fizeste as novas do dia. Um simulado ou os erros confiantes são o melhor uso do tempo agora.","No reviews for today and you’ve already done today’s new questions. A practice exam or your confident mistakes are the best use of your time now."))+
    '</p></div><div class="row">'+(sess?TL('<a class="btn primary big" href="#treino">Continuar</a>','<a class="btn primary big" href="#treino">Continue</a>'):total?TL('<button class="btn primary big" data-act="start" data-v="smart">Começar · ','<button class="btn primary big" data-act="start" data-v="smart">Start · ')+total+'</button>':TL('<a class="btn primary big" href="#simulado">Fazer um simulado</a>','<a class="btn primary big" href="#simulado">Take a practice exam</a>'))+'</div></section>';
  var gauge=TL('<section class="panel"><p class="lbl">Índice de confiança</p>','<section class="panel"><p class="lbl">Confidence index</p>')+gaugeHTML(cs,true)+"</section>";
  var k=kpiList(), kp='<section class="kpis">'+[k[0],k[2],k[4],k[5]].map(kpiHTML).join("")+"</section>";
  var rows=D.domains.map(function(dm){var o=ds[dm.id],m=pct(o.m,o.t),c=pct(o.c-o.m,o.t),w=pct(o.w,o.t);
    return '<div class="drow"><div class="dn"><span>D'+dm.id+'</span>'+esc(dm.name)+'</div><div class="dv">'+o.c+"/"+o.t+" · "+dm.w+'%</div><div class="bar" role="img" aria-label="'+esc(dm.name)+": "+o.c+TL(" de "," of ")+o.t+TL(' certas agora"><i class="b-m" style="width:',' correct now"><i class="b-m" style="width:')+m+'%"></i><i class="b-c" style="width:'+c+'%"></i><i class="b-w" style="width:'+w+'%"></i></div></div>';}).join("");
  var dom=TL('<section class="panel g-wide"><div class="phead"><p class="lbl">Prontidão por domínio</p><span class="small muted"><b class="num">','<section class="panel g-wide"><div class="phead"><p class="lbl">Readiness by domain</p><span class="small muted"><b class="num">')+rd+TL('%</b> do exame que respondes certo agora</span></div><div class="drows">','%</b> of the exam you answer correctly now</span></div><div class="drows">')+rows+'</div>'+
    TL('<div class="legend"><span><i style="background:var(--accent)"></i>Dominadas (caixa 4–5)</span><span><i style="background:color-mix(in srgb,var(--accent) 42%,var(--surface))"></i>Certas na última vez</span><span><i style="background:color-mix(in srgb,var(--bad) 55%,var(--surface))"></i>Erradas na última vez</span><span><i style="background:var(--sunk);border:1px solid var(--line)"></i>Por ver</span></div></section>','<div class="legend"><span><i style="background:var(--accent)"></i>Mastered (box 4–5)</span><span><i style="background:color-mix(in srgb,var(--accent) 42%,var(--surface))"></i>Correct last time</span><span><i style="background:color-mix(in srgb,var(--bad) 55%,var(--surface))"></i>Wrong last time</span><span><i style="background:var(--sunk);border:1px solid var(--line)"></i>Not seen</span></div></section>');
  var cd=TL('<section class="panel"><p class="lbl">Exame</p>','<section class="panel"><p class="lbl">Exam</p>')+(dl==null?TL('<p class="small muted" style="margin:0 0 12px">Ainda não marcaste a data. Com a data, a app ajusta as revisões e diz-te quanto estudar por dia.</p><a class="btn" href="#plano">Definir a data</a>','<p class="small muted" style="margin:0 0 12px">You haven’t set the date yet. With the date, the app adjusts the reviews and tells you how much to study per day.</p><a class="btn" href="#plano">Set the date</a>'):
    '<div class="countdown">'+(dl<0?"—":dl)+'</div><p class="small muted" style="margin:6px 0 12px">'+(dl<0?TL("A data do exame já passou.","The exam date has passed."):dl===0?TL("É hoje. Boa sorte!","It’s today. Good luck!"):TL("dias até ao exame · ","days to the exam · ")+new Date(examTs()).toLocaleDateString(LOC(),{weekday:"short",day:"numeric",month:"long"}))+TL('</p><a class="link" href="#plano">Ver o plano</a>','</p><a class="link" href="#plano">See the plan</a>'))+"</section>";
  var ls=last?exStats(last):null;
  var ex=TL('<section class="panel"><p class="lbl">Último simulado</p>','<section class="panel"><p class="lbl">Last practice exam</p>')+(last?'<div class="countdown" style="font-size:36px">'+(ls.nA?pct(ls.okA,ls.nA)+"%":"—")+'</div><p class="small muted" style="margin:6px 0 12px">'+ls.okA+"/"+ls.nA+(ls.complete?"":TL(" · interrompido"," · interrupted"))+" · "+dmy(last.at)+TL('</p><a class="link" href="#simulado">Abrir simulados</a>','</p><a class="link" href="#simulado">Open practice exams</a>'):
    TL('<p class="small muted" style="margin:0 0 12px">Ainda não fizeste nenhum. Quando tiveres a maior parte das questões vistas, faz um: 60 questões, 90 minutos.</p><a class="link" href="#simulado">Ver como funciona</a>','<p class="small muted" style="margin:0 0 12px">You haven’t done one yet. Once you’ve seen most of the questions, take one: 60 questions, 90 minutes.</p><a class="link" href="#simulado">See how it works</a>'))+"</section>";
  var meth=TL('<section class="panel g-wide"><details class="method"><summary>Porque é que a app funciona assim</summary><ol class="mlist">','<section class="panel g-wide"><details class="method"><summary>Why the app works this way</summary><ol class="mlist">')+
    TL('<li><span class="n">1</span><span><b>Testares-te em vez de releres.</b> Responder antes de ver a resposta é das técnicas com mais evidência; reler e sublinhar quase não ajudam (<a href="https://www.whz.de/fileadmin/lehre/hochschuldidaktik/docs/dunloskiimprovingstudentlearning.pdf" target="_blank" rel="noopener">Dunlosky et al., 2013</a>).</span></li>','<li><span class="n">1</span><span><b>Test yourself instead of re-reading.</b> Answering before seeing the answer is one of the techniques with the most evidence; re-reading and highlighting barely help (<a href="https://www.whz.de/fileadmin/lehre/hochschuldidaktik/docs/dunloskiimprovingstudentlearning.pdf" target="_blank" rel="noopener">Dunlosky et al., 2013</a>).</span></li>')+
    TL('<li><span class="n">2</span><span><b>Revisões espaçadas.</b> Cada questão vive numa caixa de 1 a 5. Acertas, sobe e volta mais tarde; erras, volta à caixa 1. Com a data do exame marcada, os intervalos encolhem ou alargam para caberem no tempo que tens.</span></li>','<li><span class="n">2</span><span><b>Spaced reviews.</b> Each question lives in a box from 1 to 5. Get it right and it moves up and comes back later; get it wrong and it goes back to box 1. With the exam date set, the intervals shrink or stretch to fit the time you have.</span></li>')+
    TL('<li><span class="n">3</span><span><b>Misturar temas.</b> As sessões alternam domínios em vez de fazer 20 seguidas do mesmo. Custa mais na hora e rende mais no teste (<a href="https://onlinelibrary.wiley.com/doi/10.1002/acp.1598" target="_blank" rel="noopener">Taylor &amp; Rohrer, 2010</a>).</span></li>','<li><span class="n">3</span><span><b>Mix topics.</b> Sessions alternate domains instead of doing 20 in a row from the same one. It feels harder at the time and pays off more in the test (<a href="https://onlinelibrary.wiley.com/doi/10.1002/acp.1598" target="_blank" rel="noopener">Taylor &amp; Rohrer, 2010</a>).</span></li>')+
    TL('<li><span class="n">4</span><span><b>Dizer a confiança antes de ver a resposta.</b> Um erro cometido com certeza, depois de corrigido, tende a ficar mais na memória (<a href="https://www.semanticscholar.org/paper/Errors-committed-with-high-confidence-are-Butterfield-Metcalfe/cdbafcb94ae5bffc88b4aaf202cd7098a28c9473" target="_blank" rel="noopener">Butterfield &amp; Metcalfe, 2001</a>), mas muitos voltam ao fim de uma semana, por isso ficam numa lista própria.</span></li>','<li><span class="n">4</span><span><b>Say your confidence before seeing the answer.</b> A mistake made with certainty, once corrected, tends to stick better in memory (<a href="https://www.semanticscholar.org/paper/Errors-committed-with-high-confidence-are-Butterfield-Metcalfe/cdbafcb94ae5bffc88b4aaf202cd7098a28c9473" target="_blank" rel="noopener">Butterfield &amp; Metcalfe, 2001</a>), but many come back after a week, so they go on a list of their own.</span></li>')+
    TL('<li><span class="n">5</span><span><b>Pausas a horas certas.</b> Pausas fixas ao estilo Pomodoro deram melhor humor e rendimento num estudo com 87 estudantes (<a href="https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjep.12593" target="_blank" rel="noopener">Biwer et al., 2023</a>). Usa o ritmo que te mantiver a trabalhar.</span></li>','<li><span class="n">5</span><span><b>Breaks at fixed times.</b> Fixed Pomodoro-style breaks gave better mood and performance in a study of 87 students (<a href="https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjep.12593" target="_blank" rel="noopener">Biwer et al., 2023</a>). Use whichever rhythm keeps you working.</span></li>')+
    TL('<li><span class="n">6</span><span><b>Treinar nas condições do exame.</b> O simulado segue o blueprint oficial: 60 questões, 90 minutos, distribuição por domínio e escolha múltipla sem crédito parcial.</span></li>','<li><span class="n">6</span><span><b>Practise under exam conditions.</b> The practice exam follows the official blueprint: 60 questions, 90 minutes, the domain distribution and multiple choice with no partial credit.</span></li>')+
    "</ol></details></section>";
  return '<div class="vh"><div><h1>'+greet()+'</h1><p>'+new Date().toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long"})+(streak()>1?" · "+streak()+TL(" dias seguidos"," days in a row"):"")+" · "+d.q+TL(" respondidas hoje · "," answered today · ")+d.pomo+' pomodoros</p></div></div><div class="stack">'+importHintHTML()+'<div class="grid3">'+hero+gauge+"</div>"+kp+'<div class="grid3">'+dom+cd+"</div>"+'<div class="grid3">'+ex+meth+'</div></div><p class="syncnote" data-sync></p>';
}

/* rever questões já respondidas nesta sessão (só leitura: a resposta já foi registada) */
function prevQ(){var s=S.sess;if(!s)return;var cur=ui.peek!=null?ui.peek:Math.min(s.i,s.q.length);if(cur>0){ui.peek=cur-1;render();window.scrollTo({top:0});}}
function peekNext(){var s=S.sess;if(!s||ui.peek==null)return;ui.peek++;if(ui.peek>=Math.min(s.i,s.q.length))ui.peek=null;render();window.scrollTo({top:0});}
function vReview(){
  var s=S.sess, idx=ui.peek, q=Q[s.q[idx]], lg=(s.log||{})[idx]||null, ch=lg?lg.ch:[], tot=s.q.length;
  var head='<div class="sessbar"><b>'+esc(lbl(s.label))+'</b><span class="num">'+(idx+1)+"/"+tot+'</span><span class="t"><i style="width:'+pct(s.i,tot)+'%"></i></span><button class="link" data-act="peekcur">'+(s.i<tot?TL("Voltar à questão ","Back to question ")+(s.i+1):TL("Voltar ao resumo","Back to the summary"))+"</button></div>";
  var meta='<div class="qmeta"><span class="qno">'+esc(q.label||("Question "+q.id))+'</span>'+srcTag(q)+'<span class="tag">D'+q.d+" · "+esc(q.sub)+TL('</span><span class="tag rep">Já respondida</span>','</span><span class="tag rep">Already answered</span>')+(q.multi?TL('<span class="tag multi">Escolhe ','<span class="tag multi">Choose ')+q.ans.length+"</span>":"")+boxes(q.id)+"</div>";
  var v=!lg?TL('<div class="verdict nt">A correta é ','<div class="verdict nt">The correct answer is ')+dls(q,q.ans)+".</div>"
    :lg.f==="n"?TL('<div class="verdict nt"><b>Pediste para ver a resposta.</b> A correta é ','<div class="verdict nt"><b>You asked to see the answer.</b> The correct answer is ')+dls(q,q.ans)+".</div>"
    :lg.c?TL('<div class="verdict ok"><b>Acertaste</b> · ','<div class="verdict ok"><b>Correct</b> · ')+CONF[lg.f]+(lg.ms?" · "+mmss(lg.ms):"")+".</div>"
    :TL('<div class="verdict no"><b>Erraste</b> · ','<div class="verdict no"><b>Wrong</b> · ')+CONF[lg.f]+TL(". A correta é ",". The correct answer is ")+dls(q,q.ans)+".</div>";
  var nav='<div class="nextrow" style="justify-content:space-between"><button class="btn" data-act="prevq"'+(idx?"":" disabled")+TL('>Anterior<kbd>←</kbd></button><button class="btn primary" data-act="peeknext">Seguinte<kbd>→</kbd></button></div>','>Previous<kbd>←</kbd></button><button class="btn primary" data-act="peeknext">Next<kbd>→</kbd></button></div>');
  return '<div class="read">'+head+'<article class="qcard">'+meta+topicHTML(q)+stemHTML(q)+optsHTML(q,{chosen:ch,reveal:true})+v+nav+explainHTML(q,ch)+"</article></div>";
}
function vTreino(){
  var s=S.sess;
  if(s&&ui.peek!=null&&ui.peek<Math.min(s.i,s.q.length))return vReview();
  ui.peek=null;
  if(s&&s.i<s.q.length)return vQuestion();
  if(s&&s.i>=s.q.length&&s.q.length)return vSessionEnd();
  return vChooser();
}
function vChooser(){
  var due=dueList().length,fresh=freshList().length,hc=hcList().length,wr=wrongList().length,all=pool().length, smart=smartIds().length;
  function mode(id,title,desc,n,extra){return '<div class="mode"><h3>'+title+"</h3><p>"+desc+"</p>"+(extra||"")+'<div class="act"><span class="cnt">'+n+'</span><button class="btn'+(id==="smart"?" primary":"")+'" data-act="start" data-v="'+id+'"'+(n?"":" disabled")+TL('>Começar</button></div></div>','>Start</button></div></div>');}
  var sizes=[10,20,30,999].map(function(n){return '<option value="'+n+'"'+(ui.size===n?" selected":"")+">"+(n===999?TL("Todas","All"):n)+"</option>";}).join("");
  var npd=[5,10,15,20,25,30,40].concat(S.cfg.newPerDay&&[5,10,15,20,25,30,40].indexOf(S.cfg.newPerDay)<0?[S.cfg.newPerDay]:[]).sort(function(a,b){return a-b;}).map(function(n){return '<option value="'+n+'"'+(S.cfg.newPerDay===n?" selected":"")+">"+n+"</option>";}).join("");
  return TL('<div class="read"><div class="vh"><div><h1>Treino</h1><p>','<div class="read"><div class="vh"><div><h1>Practice</h1><p>')+all+TL(' questões no banco',' questions in the bank')+(S.cfg.dep?TL(" (com deprecated)"," (with deprecated)"):"")+TL('. Para escolher domínio, tema, módulo e número de questões, usa <a class="link" href="#montar">Montar sessão</a>.</p></div></div>','. To choose domain, topic, module and number of questions, use <a class="link" href="#montar">Build a session</a>.</p></div></div>')+
  '<section class="panel">'+bankFieldHTML("train")+'<div class="modes">'+
    mode("smart",TL("Sessão de hoje","Today’s session"),TL("Revisões que chegaram à data, questões que erraste (até ","Reviews that are due, questions you got wrong (up to ")+Math.round(wrongCap()*100)+TL("% da sessão) e novas, misturadas entre domínios. No máximo ","% of the session) and new ones, mixed across domains. At most ")+sessMax()+TL(" questões: o que sobrar fica para a sessão seguinte."," questions: anything left over goes to the next session."),smart)+
    mode("due",TL("Só revisões","Reviews only"),TL("Questões que já viste e que o calendário pede para rever hoje.","Questions you’ve already seen that the schedule asks you to review today."),due)+
    mode("hc",TL("Erros confiantes","Confident mistakes"),TL("Erraste com a certeza de estar certo. São as primeiras a rever.","You got them wrong while sure you were right. They’re the first to review."),hc)+
    mode("wrong",TL("Questões que errei","Questions I got wrong"),TL("Tudo o que falhaste na última tentativa.","Everything you missed on the last attempt."),wr)+
    mode("fresh",TL("Questões novas","New questions"),TL("Ainda não vistas, escolhidas segundo o peso de cada domínio no exame.","Not seen yet, picked by each domain’s weight in the exam."),fresh)+
    mode("mix",TL("Todas, misturadas","All, shuffled"),TL("O banco inteiro em ordem aleatória.","The whole bank in random order."),all)+
  TL('</div><div class="opts-line"><label class="chk">Questões por sessão <select id="selSize" data-act="size">','</div><div class="opts-line"><label class="chk">Questions per session <select id="selSize" data-act="size">')+sizes+'</select></label>'+
  TL('<label class="chk">Máximo na sessão de hoje <select id="selMax" data-act="sessmax">','<label class="chk">Maximum in today’s session <select id="selMax" data-act="sessmax">')+[20,30,40,60,80,100].map(function(n){return '<option value="'+n+'"'+(sessMax()===n?" selected":"")+">"+n+"</option>";}).join("")+'</select></label>'+
  TL('<label class="chk">Novas por dia <select id="selNew" data-act="newpd">','<label class="chk">New per day <select id="selNew" data-act="newpd">')+npd+'</select></label>'+
  '<label class="chk"><input type="checkbox" id="chkDep" data-act="dep"'+(S.cfg.dep?" checked":"")+TL('> Incluir as ','> Include the ')+D.questions.filter(function(q){return q.dep&&q.scorable;}).length+TL(' marcadas deprecated</label></div></section>',' marked deprecated</label></div></section>')+
  TL('<p class="small faint" style="margin-top:14px">As questões que errares já não voltam na mesma sessão: no fim tens um bloco opcional para as refazer, e elas voltam mais vezes nas sessões seguintes.</p></div>','<p class="small faint" style="margin-top:14px">Questions you get wrong no longer come back in the same session: at the end there’s an optional block to redo them, and they come back more often in the following sessions.</p></div>');
}
function subOptions(dv,sel){
  var subs=dv?D.domains.filter(function(d){return String(d.id)===dv;})[0].subs:[];
  return TL('<option value="">Todos os temas</option>','<option value="">All topics</option>')+subs.map(function(s){var n=pool().filter(function(q){return q.sub===s;}).length;return '<option value="'+esc(s)+'"'+(n?"":" disabled")+(sel===s?" selected":"")+">"+esc(s)+" ("+n+")</option>";}).join("");
}
function vQuestion(){
  var s=S.sess,q=curQ();
  var lg0=(s.log||{})[s.i];
  if(!(ui.last&&ui.last.id===q.id)&&lg0){var r0=rec(q.id);ui.last={id:q.id,chosen:lg0.ch||[],correct:lg0.c,conf:lg0.f,due:r0?r0.due:Date.now(),repeat:s.mode==="redo",ms:lg0.ms||0};ui.done=true;}
  var L=ui.last&&ui.last.id===q.id?ui.last:null;
  var done=s.i, tot=s.q.length;
  var head='<div class="sessbar"><b>'+esc(lbl(s.label))+'</b><span class="num">'+(done+1)+"/"+tot+'</span>'+deathTag(s)+'<span class="t"><i style="width:'+pct(done,tot)+'%"></i></span>'+(s.i?TL('<button class="link" data-act="prevq">← Anterior</button>','<button class="link" data-act="prevq">← Previous</button>'):"")+TL('<button class="link" data-act="endsess">Terminar</button></div>','<button class="link" data-act="endsess">Finish</button></div>');
  if(!L)qtStart(q.id);
  var meta='<div class="qmeta"><span class="qno">'+esc(q.label||("Question "+q.id))+'</span>'+srcTag(q)+'<span class="tag">D'+q.d+" · "+esc(q.sub)+"</span>"+(s.mode==="redo"?TL('<span class="tag rep">Bloco final</span>','<span class="tag rep">Final block</span>'):"")+(q.multi?TL('<span class="tag multi">Escolhe ','<span class="tag multi">Choose ')+q.ans.length+"</span>":"")+(q.dep?'<span class="tag dep">Deprecated</span>':"")+(L?"":'<span class="qclock" title="'+TL("Tempo nesta questão (no exame: 1:30 por questão)","Time on this question (exam pace: 1:30 per question)")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/></svg><span id="qClock">'+mmss(qtElapsed())+"</span></span>")+boxes(q.id)+"</div>";
  var body;
  if(!L){
    var ready=ui.sel.length===q.ans.length;
    body=optsHTML(q,{sel:ui.sel,act:"opt"})+'<div class="confrow"><span class="cq">'+(q.multi?TL("Escolhe ","Choose ")+q.ans.length+TL(" opções e diz quão certo estás."," options and say how sure you are."):TL("Escolhe uma opção e diz quão certo estás.","Choose one option and say how sure you are."))+"</span>"+
      ["s","a","p"].map(function(c){return '<button class="cbtn" data-act="conf" data-v="'+c+'"'+(ready?"":" disabled")+">"+CONF[c]+"<kbd>"+{s:"C",a:"A",p:"P"}[c]+"</kbd></button>";}).join("")+
      TL('<button class="link" data-act="conf" data-v="n">Não sei, mostrar resposta</button></div>','<button class="link" data-act="conf" data-v="n">Don’t know, show the answer</button></div>');
  }else{
    var r=rec(q.id), vcls=L.conf==="n"?"nt":L.correct?"ok":"no", vtxt, tm=L.ms?' <span class="num">· '+mmss(L.ms)+"</span>":"";
    if(s.mode==="redo")vtxt=L.correct?TL("<b>Certo desta vez.</b> Como já tinhas visto a resposta, não conta para as estatísticas.","<b>Right this time.</b> Since you’d already seen the answer, it doesn’t count towards the statistics."):TL("<b>Ainda errado.</b> A correta é ","<b>Still wrong.</b> The correct answer is ")+dls(q,q.ans)+TL(". Volta nas próximas sessões.",". It comes back in the next sessions.");
    else if(L.conf==="n")vtxt=TL("<b>Resposta: ","<b>Answer: ")+dls(q,q.ans)+TL(".</b> Fica para o bloco final e nas revisões até a acertares.",".</b> It goes to the final block and stays in your reviews until you get it right.");
    else if(L.correct)vtxt=TL("<b>Certo.</b>","<b>Correct.</b>")+tm+(L.conf==="p"?TL(" Foi palpite, por isso volta "," It was a guess, so it comes back ")+when(r.due)+TL(" para confirmares."," for you to confirm."):TL(" Volta a aparecer "," It comes back ")+when(r.due)+".");
    else vtxt=TL("<b>Errado.</b>","<b>Wrong.</b>")+tm+TL(" A correta é "," The correct answer is ")+dls(q,q.ans)+TL(". Podes refazê-la no bloco final e volta mais vezes nas próximas sessões.",". You can redo it in the final block and it comes back more often in the next sessions.");
    if(s.mode==="death"&&s.dead===s.i+1)vtxt+=" <b>"+TL("É o ","That’s mistake ")+DEATH_MAX+TL(".º erro: o desafio acabou.",": the challenge is over.")+"</b>";
    body=optsHTML(q,{chosen:L.chosen,reveal:true})+'<div class="verdict '+vcls+'" role="status">'+vtxt+"</div>"+
      (!L.correct&&L.conf==="s"&&s.mode!=="redo"?TL('<div class="hc"><b>Erro confiante.</b> Ficou na lista de erros confiantes. Lê a explicação com atenção: são os erros que mais ficam na memória depois de corrigidos.</div>','<div class="hc"><b>Confident mistake.</b> It went on the confident mistakes list. Read the explanation carefully: these are the mistakes that stick best in memory once corrected.</div>'):"")+
      '<div class="nextrow">'+(s.i?TL('<button class="btn" data-act="prevq" style="margin-right:auto">Anterior<kbd>←</kbd></button>','<button class="btn" data-act="prevq" style="margin-right:auto">Previous<kbd>←</kbd></button>'):"")+'<button class="btn primary" data-act="next" id="nextBtn">'+(s.i+1>=s.q.length?TL("Terminar sessão","Finish session"):TL("Seguinte","Next"))+'<kbd>Enter</kbd></button></div>'+
      explainHTML(q,L.chosen);
  }
  return '<div class="read">'+head+'<article class="qcard">'+meta+topicHTML(q)+stemHTML(q)+body+"</article></div>";
}
function sessEntries(s){var E=[];s.q.forEach(function(id,i){var lg=(s.log||{})[i];if(lg)E.push({id:id,ok:lg.c,f:lg.f,ms:lg.ms||0});});return E;}
function vSessionEnd(){
  var s=S.sess,E=sessEntries(s),n=E.length,ok=0,hc=0;E.forEach(function(e){if(e.ok)ok++;else if(e.f==="s")hc++;});
  var mins=Math.max(1,Math.min(Math.round((Date.now()-s.at)/60000),Math.max(1,n)*MPQ_MAX));
  if(!s.counted&&s.mode!=="redo"&&n){s.counted=1;var dd=day();dd.sm=(dd.sm||0)+mins;dd.sq=(dd.sq||0)+n;snapDay();markDirty("d");saveLocal();}
  var wrongIds=E.filter(function(e){return !e.ok;}).map(function(e){return e.id;}).filter(function(id,i,a){return a.indexOf(id)===i;});
  if(s.mode==="redo")return TL('<div class="read"><div class="vh"><div><h1>Bloco final terminado</h1><p>','<div class="read"><div class="vh"><div><h1>Final block finished</h1><p>')+esc(lbl(s.label))+'</p></div></div><section class="panel"><div class="score"><span class="num">'+ok+"/"+n+TL('</span><span class="muted">certas desta vez</span></div><p class="small muted" style="margin:14px 0 0">Estas repetições não contam para as estatísticas, porque já tinhas visto a resposta. As que voltaste a errar continuam nas revisões.</p><div class="row" style="margin-top:20px"><button class="btn primary" data-act="newsess">Nova sessão</button><a class="btn" href="#progresso">Ver progresso</a></div></section></div>','</span><span class="muted">correct this time</span></div><p class="small muted" style="margin:14px 0 0">These repeats don’t count towards the statistics, because you’d already seen the answer. The ones you got wrong again stay in your reviews.</p><div class="row" style="margin-top:20px"><button class="btn primary" data-act="newsess">New session</button><a class="btn" href="#progresso">See progress</a></div></section></div>');
  var ms=E.filter(function(e){return e.ms>0;}), avg=ms.length?ms.reduce(function(a,e){return a+e.ms;},0)/ms.length:null;
  var c={s:0,a:0,p:0,w:0,n:0};E.forEach(function(e){if(e.f==="n")c.n++;else if(!e.ok)c.w++;else c[e.f]=(c[e.f]||0)+1;});
  var cs=confScore();
  var top=deathHTML(s,n)+TL('<section class="panel g-wide"><div class="phead"><p class="lbl">Resultado</p><span class="small faint">','<section class="panel g-wide"><div class="phead"><p class="lbl">Result</p><span class="small faint">')+esc(lbl(s.label))+'</span></div><div class="score"><span class="num">'+pct(ok,n)+TL('%</span><span class="muted">certas à primeira tentativa</span></div>','%</span><span class="muted">correct on the first attempt</span></div>')+
    '<div class="kv"><div><b>'+ok+"/"+n+TL('</b><span>certas</span></div><div><b>','</b><span>correct</span></div><div><b>')+(c.p)+TL('</b><span>certas por palpite</span></div><div><b>','</b><span>correct by guessing</span></div><div><b>')+hc+TL('</b><span>erros confiantes</span></div><div><b>','</b><span>confident mistakes</span></div><div><b>')+(avg?mmss(avg):"—")+TL('</b><span>por questão (exame: 1:30)</span></div><div><b>','</b><span>per question (exam: 1:30)</span></div><div><b>')+mins+TL(' min</b><span>de sessão</span></div></div>',' min</b><span>of session</span></div></div>')+
    '<div class="row" style="margin-top:22px">'+(wrongIds.length?TL('<button class="btn primary" data-act="redo">Refazer as ','<button class="btn primary" data-act="redo">Redo the ')+wrongIds.length+TL(' erradas</button>',' wrong ones</button>'):"")+'<button class="btn'+(wrongIds.length?"":" primary")+TL('" data-act="newsess">Nova sessão</button><button class="btn" data-act="peekfirst">Rever as questões</button></div>','" data-act="newsess">New session</button><button class="btn" data-act="peekfirst">Review the questions</button></div>')+
    (wrongIds.length?TL('<p class="small faint" style="margin:12px 0 0">O bloco final é opcional. As erradas também voltam mais vezes nas próximas sessões.</p>','<p class="small faint" style="margin:12px 0 0">The final block is optional. Wrong answers also come back more often in the next sessions.</p>'):"")+"</section>";
  var donut=TL('<section class="panel"><p class="lbl">Certeza vs. resultado</p>','<section class="panel"><p class="lbl">Confidence vs. result</p>')+donutHTML([{n:TL("Certas com certeza","Correct and sure"),v:c.s,c:"var(--ok)",d:TL("Acertaste e marcaste «Tenho certeza». Avançam no calendário e voltam mais tarde.","You got it right and marked «I’m sure». They move forward in the schedule and come back later.")},{n:TL("Certas, «acho que sim»","Correct, «I think so»"),v:c.a,c:"color-mix(in srgb,var(--ok) 50%,var(--surface))",d:TL("Acertaste com alguma dúvida. Avançam uma caixa no calendário.","You got it right with some doubt. They move up one box in the schedule.")},{n:TL("Certas por palpite","Correct by guessing"),v:c.p,c:"var(--warn)",d:TL("Acertaste a adivinhar. Não avançam de caixa e voltam amanhã para confirmares.","You got it right by guessing. They don’t move up a box and come back tomorrow for you to confirm.")},{n:TL("Erradas","Wrong"),v:c.w,c:"var(--bad)",d:TL("Ficam para o bloco final opcional e voltam mais vezes nas próximas sessões (até 30% de cada sessão).","They go to the optional final block and come back more often in the next sessions (up to 30% of each session).")+(hc?" "+hc+(hc>1?TL(" foram erros confiantes, que têm prioridade."," were confident mistakes, which take priority."):TL(" foi um erro confiante, que tem prioridade."," was a confident mistake, which takes priority.")):"")},{n:TL("Não sabia","Didn’t know"),v:c.n,c:"var(--ink-3)",d:TL("Marcaste «Não sei». Contam como erradas para o calendário e voltam nas próximas sessões.","You marked «Don’t know». They count as wrong for the schedule and come back in the next sessions.")}],TL("Distribuição das respostas","Answer breakdown"))+TL('<p class="small faint" style="margin:12px 0 0">As certas por palpite voltam amanhã para confirmares.</p></section>','<p class="small faint" style="margin:12px 0 0">Answers you got right by guessing come back tomorrow for you to confirm.</p></section>');
  var gauge=TL('<section class="panel g-wide"><div class="phead"><p class="lbl">Índice de confiança para o exame</p><a class="link" href="#progresso">Evolução</a></div>','<section class="panel g-wide"><div class="phead"><p class="lbl">Exam confidence index</p><a class="link" href="#progresso">Evolution</a></div>')+gaugeHTML(cs)+"</section>";
  var kp=TL('<section class="panel"><p class="lbl">Próximo passo</p>','<section class="panel"><p class="lbl">Next step</p>')+nextStepHTML(E)+"</section>";
  return TL('<div class="vh"><div><h1>Sessão terminada</h1><p>','<div class="vh"><div><h1>Session finished</h1><p>')+new Date().toLocaleString(LOC(),{weekday:"long",hour:"2-digit",minute:"2-digit"})+'</p></div></div><div class="stack"><div class="grid3">'+top+donut+"</div>"+reportHTML(E,false)+'<div class="grid3">'+gauge+kp+"</div></div>";
}
function nextStepHTML(E){
  var by={};E.forEach(function(e){var q=Q[e.id];if(!q)return;var o=by[q.d]||(by[q.d]={n:0,ok:0});o.n++;if(e.ok)o.ok++;});
  var ds=domStats(),worst=null,wv=1e9;
  D.domains.forEach(function(d){var o=ds[d.id];var acc=o.seen?o.c/o.seen:0;var v=acc-(d.w/100);if(o.t&&v<wv){wv=v;worst=d;}});
  var ws=worst?TL('<p class="small" style="margin:0 0 10px">O domínio a reforçar é <b>D','<p class="small" style="margin:0 0 10px">The domain to reinforce is <b>D')+worst.id+" · "+esc(worst.name)+TL("</b>: vale ","</b>: it’s worth ")+worst.w+TL("% do exame e tens ","% of the exam and you have ")+pct(ds[worst.id].c,Math.max(1,ds[worst.id].seen))+TL("% certas nas vistas.</p>","% correct among the ones you’ve seen.</p>"):"";
  return ws+TL('<div class="row"><a class="btn" href="#montar">Montar sessão deste domínio</a>','<div class="row"><a class="btn" href="#montar">Build a session for this domain</a>')+(dueList().length?TL('<button class="btn" data-act="start" data-v="due">Fazer as ','<button class="btn" data-act="start" data-v="due">Do the ')+dueList().length+TL(" revisões</button>"," reviews</button>"):"")+"</div>";
}

function vSimulado(){
  if(S.exam)return vExam();
  if(ui.resultAt){var r=S.exams.filter(function(e){return e.at===ui.resultAt;})[0];if(r)return vResult(r);}
  var strict=examPool(), rows=D.domains.map(function(d){var n=Math.round(60*d.w/100);
    return "<tr><td>D"+d.id+" · "+esc(d.name)+'<div class="small faint">'+d.subs.map(esc).join(" · ")+'</div></td><td class="r">'+d.w+'%</td><td class="r">'+n+'</td><td class="r">'+strict.filter(function(q){return q.d===d.id;}).length+"</td></tr>";}).join("");
  var hist=S.exams.length?histHTML():"";
  return TL('<div class="vh"><div><h1>Simulado</h1><p>Segue o blueprint oficial do CSA (janeiro de 2026)</p></div></div><div class="stack"><div class="grid2">','<div class="vh"><div><h1>Practice exam</h1><p>Follows the official CSA blueprint (January 2026)</p></div></div><div class="stack"><div class="grid2">')+
    TL('<section class="panel"><p class="lbl">Como é o exame</p><ul class="rules"><li>60 questões em 90 minutos: 1,5 minutos por questão.</li><li>Escolha múltipla: a questão diz quantas opções escolher. Não há crédito parcial.</li><li>Cada questão vale um ponto. O corte não é público e nem sempre é 70%.</li><li>Aqui não vês se acertaste até ao fim. Podes marcar questões para voltar a elas.</li><li>Até 30% das questões de cada domínio vêm das que erraste antes.</li></ul>','<section class="panel"><p class="lbl">What the exam is like</p><ul class="rules"><li>60 questions in 90 minutes: 1.5 minutes per question.</li><li>Multiple choice: the question says how many options to choose. There’s no partial credit.</li><li>Each question is worth one point. The cut score isn’t public and isn’t always 70%.</li><li>Here you don’t see whether you got it right until the end. You can mark questions to come back to them.</li><li>Up to 30% of each domain’s questions come from the ones you got wrong before.</li></ul>')+
    bankFieldHTML("exam")+TL('<div class="row" style="margin-top:20px"><button class="btn primary big" data-act="exam">Começar simulado</button></div><p class="small faint" style="margin:12px 0 0">Meta pessoal razoável: 80% ou mais em três simulados seguidos. Para um mini-simulado de um domínio, usa <a class="link" href="#montar">Montar sessão</a>.</p></section>','<div class="row" style="margin-top:20px"><button class="btn primary big" data-act="exam">Start practice exam</button></div><p class="small faint" style="margin:12px 0 0">A sensible personal target: 80% or more in three practice exams in a row. For a mini practice exam on one domain, use <a class="link" href="#montar">Build a session</a>.</p></section>')+
    TL('<section class="panel"><p class="lbl">Distribuição por domínio</p><div class="tbl"><table class="bp"><thead><tr><th>Domínio e temas</th><th class="r">Peso</th><th class="r">No simulado</th><th class="r">No banco</th></tr></thead><tbody>','<section class="panel"><p class="lbl">Distribution by domain</p><div class="tbl"><table class="bp"><thead><tr><th>Domain and topics</th><th class="r">Weight</th><th class="r">In the practice exam</th><th class="r">In the bank</th></tr></thead><tbody>')+rows+'</tbody></table></div>'+
    TL('<p class="small faint" style="margin:14px 0 0">O banco tem poucas questões de Instance Configuration (D2): complementa com o módulo 2 do guia.</p></section></div>','<p class="small faint" style="margin:14px 0 0">The bank has few Instance Configuration (D2) questions: supplement with module 2 of the guide.</p></section></div>')+
    hist+
  "</div>";
}
function vExam(){
  var e=S.exam,q=exQ(),a=e.a[q.id]||[],sel=a.map(function(L){return q.opts.map(function(o){return o.letter;}).indexOf(L);});
  var answered=Object.keys(e.a).length, marked=Object.keys(e.m).length;
  var top='<div class="etop"><span class="clock" id="eClock">'+mmss(e.ends-Date.now())+'</span><span id="eCount">'+answered+"/"+e.q.length+TL(' respondidas</span>',' answered</span>')+(e.label?'<span class="tag">'+esc(lbl(e.label))+"</span>":"")+'<span class="sp"><button class="btn" data-act="egrid">'+(ui.examGrid?TL("Esconder lista","Hide list"):TL("Ver todas","View all"))+TL('</button><button class="btn" data-act="efinish">Terminar</button></span></div>','</button><button class="btn" data-act="efinish">Finish</button></span></div>');
  var grid=ui.examGrid?'<div class="grid">'+e.q.map(function(id,i){return '<button data-act="ejump" data-v="'+i+'" class="'+(e.a[id]?"a ":"")+(e.m[id]?"mk ":"")+(i===e.i?"cur":"")+TL('" aria-label="Questão ','" aria-label="Question ')+(i+1)+'">'+(i+1)+"</button>";}).join("")+'</div>':"";
  var conf=ui.examConfirm?'<div class="confirm"><p style="margin:0 0 12px">'+(e.q.length-answered?TL("Tens <b>","You have <b>")+(e.q.length-answered)+TL("</b> por responder","</b> unanswered")+(marked?TL(" e <b>"," and <b>")+marked+TL("</b> marcadas","</b> marked"):"")+TL(". O simulado fica nos interrompidos e o resultado conta só as que respondeste (no exame real, as em branco contam como erradas).",". The practice exam goes to the interrupted ones and the result counts only the ones you answered (in the real exam, blanks count as wrong)."):TL("Respondeste a todas","You answered them all")+(marked?TL(", mas tens <b>",", but you have <b>")+marked+TL("</b> marcadas para rever","</b> marked for review"):"")+".")+TL('</p><div class="row"><button class="btn primary" data-act="edone">Terminar e ver o resultado</button><button class="btn" data-act="enofin">Continuar o exame</button></div></div>','</p><div class="row"><button class="btn primary" data-act="edone">Finish and see the result</button><button class="btn" data-act="enofin">Continue the exam</button></div></div>'):"";
  return '<div class="read">'+top+conf+grid+TL('<article class="qcard" style="margin-top:12px"><div class="qmeta"><span class="qno">Questão ','<article class="qcard" style="margin-top:12px"><div class="qmeta"><span class="qno">Question ')+(e.i+1)+TL(" de "," of ")+e.q.length+'</span>'+srcTag(q)+(q.multi?TL('<span class="tag multi">Escolhe ','<span class="tag multi">Choose ')+q.ans.length+"</span>":"")+'<button class="btn markbtn" style="margin-left:auto;padding:4px 10px;font-size:12.5px" data-act="emark" aria-pressed="'+(e.m[q.id]?"true":"false")+'">'+(e.m[q.id]?TL("Marcada","Marked"):TL("Marcar para rever","Mark for review"))+'</button></div>'+stemHTML(q)+optsHTML(q,{sel:sel,act:"eopt"})+
    '<div class="nextrow" style="justify-content:space-between"><button class="btn" data-act="eprev"'+(e.i?"":" disabled")+TL('>Anterior</button><button class="btn primary" data-act="enext"','>Previous</button><button class="btn primary" data-act="enext"')+(e.i<e.q.length-1?TL('>Seguinte</button></div></article></div>','>Next</button></div></article></div>'):TL('>Terminar</button></div></article></div>','>Finish</button></div></article></div>'));
}
function paintExamTop(){
  var e=S.exam; if(!e||view!=="simulado")return;
  var c=$("eClock"),n=$("eCount"),left=e.ends-Date.now();
  if(c){c.textContent=mmss(left);c.classList.toggle("low",left<10*60e3);}
  if(n)n.textContent=Object.keys(e.a).length+"/"+e.q.length+TL(" respondidas"," answered");
}
/* estatísticas de um simulado, contadas só sobre as questões respondidas */
function exStats(r){
  var ans=r.ans||{}, A=Object.keys(ans).filter(function(id){return Q[id]&&ans[id]&&ans[id].length;});
  var byDA={}, okA=0, wrongA=[];
  A.forEach(function(id){var q=Q[id],right=same(ans[id],q.ans),b=byDA[q.d]||(byDA[q.d]=[0,0]);b[1]++;if(right){b[0]++;okA++;}else wrongA.push(q.id);});
  var used=Math.max(0,(r.end||r.at)-r.at), nA=A.length, reach=0;
  if(r.q)r.q.forEach(function(id,i){if(ans[id]&&ans[id].length)reach=i+1;});
  return {n:r.n,nA:nA,okA:okA,blank:r.n-nA,complete:nA>=r.n,used:used,avg:nA?used/nA:0,reach:reach,byDA:byDA,wrongA:wrongA,t:r.t||null,min:r.min||D.meta.exam.minutes};
}
function perQ(n,min){return (min||D.meta.exam.minutes)*60e3/(n||60);}
// ok: sobra tempo para rever (≤ 83% do tempo por questão) · wa: à justa · no: acima do tempo
function paceCls(s){var p=perQ(s.n,s.min);return !s.nA?"":s.avg<=p*0.83?"ok":s.avg<=p?"wa":"no";}
var PACECOL={ok:"var(--ok)",wa:"var(--warn)",no:"var(--bad)"};
function paceHTML(s,r){
  if(!s.nA)return TL('<section class="panel"><p class="lbl">Ritmo</p><p class="small muted" style="margin:0">Não respondeste a nenhuma questão, por isso não há ritmo para medir.</p></section>','<section class="panel"><p class="lbl">Pace</p><p class="small muted" style="margin:0">You didn’t answer any question, so there’s no pace to measure.</p></section>');
  var per=perQ(s.n,s.min), lim=per*s.n, proj=s.avg*s.n, c=paceCls(s), txt;
  if(c==="ok")txt=TL("<b>Bom ritmo.</b> A esta velocidade, as ","<b>Good pace.</b> At this speed, the ")+s.n+TL(" questões levavam cerca de "," questions would take about ")+Math.round(proj/60000)+TL(" minutos e sobravam "," minutes, leaving ")+Math.round((lim-proj)/60000)+TL(" para rever as marcadas."," to review the marked ones.");
  else if(c==="wa")txt=TL("<b>Dentro do tempo, mas à justa.</b> As ","<b>Within time, but only just.</b> The ")+s.n+TL(" questões levavam cerca de "," questions would take about ")+Math.round(proj/60000)+TL(" dos "," of the ")+Math.round(lim/60000)+TL(" minutos e quase não sobrava tempo para rever. Tenta ganhar uns "," minutes and almost no time left to review. Try to save about ")+Math.max(1,Math.round((s.avg-per*0.83)/1000))+TL(" segundos por questão."," seconds per question.");
  else txt=TL("<b>Acima do tempo.</b> A este ritmo, as ","<b>Over time.</b> At this pace, the ")+s.n+TL(" questões levavam "," questions would take ")+Math.round(proj/60000)+TL(" minutos, mais "," minutes, ")+Math.max(1,Math.round((proj-lim)/60000))+TL(" do que o limite. Precisas de baixar "," more than the limit. You need to cut ")+Math.max(1,Math.round((s.avg-per)/1000))+TL(" segundos por questão."," seconds per question.");
  var kv='<div class="kv" style="margin-top:0"><div><b>'+mmss(s.used)+TL('</b><span>tempo usado</span></div><div><b style="color:','</b><span>time used</span></div><div><b style="color:')+PACECOL[c]+'">'+mmss(s.avg)+TL('</b><span>por questão respondida</span></div><div><b>','</b><span>per answered question</span></div><div><b>')+mmss(per)+TL('</b><span>meta por questão</span></div><div><b>','</b><span>target per question</span></div><div><b>')+Math.round(proj/60000)+TL(' min</b><span>projeção para as ',' min</b><span>projection for the ')+s.n+TL(' (limite ',' (limit ')+Math.round(lim/60000)+')</span></div></div>';
  return TL('<section class="panel"><p class="lbl">Ritmo</p>','<section class="panel"><p class="lbl">Pace</p>')+kv+'<div class="verdict '+c+'">'+txt+"</div></section>";
}
function histHTML(){
  var done=[],intr=[];S.exams.slice().reverse().forEach(function(e){(exStats(e).complete?done:intr).push(e);});
  if(!ui.histTab)ui.histTab=exStats(S.exams[S.exams.length-1]).complete?"done":"int";
  var list=ui.histTab==="done"?done:intr;
  var tabs=TL('<div class="seg" role="group" aria-label="Tipo de simulado" style="margin-bottom:14px"><button data-act="htab" data-v="done" aria-pressed="','<div class="seg" role="group" aria-label="Practice exam type" style="margin-bottom:14px"><button data-act="htab" data-v="done" aria-pressed="')+(ui.histTab==="done")+TL('">Completos · ','">Complete · ')+done.length+'</button><button data-act="htab" data-v="int" aria-pressed="'+(ui.histTab==="int")+TL('">Interrompidos · ','">Interrupted · ')+intr.length+'</button></div>';
  var nA=0,ok=0,used=0,best=0;list.forEach(function(e){var s=exStats(e);nA+=s.nA;ok+=s.okA;used+=s.used;best=Math.max(best,pct(s.okA,s.nA));});
  var avg=nA?used/nA:0, pc=paceCls({n:60,nA:nA,avg:avg,min:90});
  var sum=!list.length?"":ui.histTab==="done"
    ?TL('<p class="small muted" style="margin:0 0 6px">Média de ','<p class="small muted" style="margin:0 0 6px">Average of ')+list.length+TL(' simulado',' practice exam')+(list.length>1?"s":"")+': <b class="num">'+pct(ok,nA)+TL('%</b> · melhor <b class="num">','%</b> · best <b class="num">')+best+'%</b> · <span class="num" style="color:'+PACECOL[pc]+'">'+mmss(avg)+TL('</span> por questão.</p>','</span> per question.</p>')
    :TL('<p class="small muted" style="margin:0 0 6px">Nestes ','<p class="small muted" style="margin:0 0 6px">In these ')+list.length+TL(' respondeste a <b class="num">',' you answered <b class="num">')+nA+TL('</b> questões: <b class="num">','</b> questions: <b class="num">')+pct(ok,nA)+TL('%</b> certas · <span class="num" style="color:','%</b> correct · <span class="num" style="color:')+(nA?PACECOL[pc]:"inherit")+'">'+(nA?mmss(avg):"—")+TL('</span> por questão.</p>','</span> per question.</p>');
  var rows=list.slice(0,15).map(function(e){var s=exStats(e),c=paceCls(s);
    return '<li><span>'+dmy(e.at)+" · "+(e.label?esc(lbl(e.label))+" · ":"")+Math.round(s.used/60000)+" min"+(s.complete?"":' · <span class="num">'+s.nA+"/"+s.n+TL("</span> respondidas","</span> answered"))+'</span><span><b class="num">'+(s.nA?pct(s.okA,s.nA)+"%":"—")+'</b> <span class="faint num">'+s.okA+"/"+s.nA+'</span> <span class="num small" style="color:'+(c?PACECOL[c]:"var(--ink-3)")+'">'+(s.nA?mmss(s.avg):"—")+'/q</span> <button class="link" data-act="seeres" data-v="'+e.at+'">Ver</button></span></li>';}).join("");
  var empty='<p class="small muted" style="margin:0">'+(ui.histTab==="done"?TL("Ainda não terminaste nenhum simulado com todas respondidas.","You haven’t finished any practice exam with every question answered yet."):TL("Nenhum simulado interrompido.","No interrupted practice exams."))+'</p>';
  return TL('<section class="panel"><p class="lbl">Simulados anteriores</p>','<section class="panel"><p class="lbl">Previous practice exams</p>')+tabs+(list.length?sum+'<ul class="hist">'+rows+TL('</ul><p class="small faint" style="margin:12px 0 0">A percentagem conta só as questões respondidas. O ritmo fica a verde abaixo de 83% do tempo por questão, a amarelo até 100% e a vermelho acima disso.</p>','</ul><p class="small faint" style="margin:12px 0 0">The percentage counts only the questions answered. The pace is green below 83% of the time per question, amber up to 100% and red above that.</p>'):empty)+'</section>';
}
function vResult(r){
  var s=exStats(r);
  var wr=s.wrongA.map(function(id,i){var q=Q[id],ch=(r.ans&&r.ans[id])||[],tm=s.t&&s.t[id];
    var meta=srcTag(q)+'<span class="tag">D'+q.d+" · "+esc(q.sub)+TL('</span><span>Escolheste <b class="no">','</span><span>You chose <b class="no">')+esc(dls(q,ch))+TL('</b></span><span>Certa <b class="yes">','</b></span><span>Correct <b class="yes">')+esc(dls(q,q.ans))+"</b></span>"+(tm?'<span class="num">'+mmss(tm)+"</span>":"")+'<span class="qid">'+esc(q.label||("Question "+q.id))+"</span>";
    return '<details class="wr"><summary><span class="wx">'+(i+1)+'</span><span><span class="ws">'+esc(q.stem)+'</span><span class="wmeta">'+meta+'</span></span><span class="chev" aria-hidden="true"></span></summary><div class="body">'+optsHTML(q,{chosen:ch,reveal:true})+explainHTML(q,ch)+"</div></details>";}).join("");
  var mins=Math.round(s.used/60000);
  var tag=s.complete?TL('<span class="pill ok">Completo</span>','<span class="pill ok">Complete</span>'):TL('<span class="pill warn">Interrompido</span>','<span class="pill warn">Interrupted</span>');
  var sub=s.complete?s.okA+TL(" de "," of ")+s.n+TL(" certas em "," correct in ")+mins+TL(" minutos"," minutes"):s.okA+TL(" de "," of ")+s.nA+TL(" certas nas que respondeste"," correct among the ones you answered");
  var intr=s.complete?"":TL('<p class="small muted" style="margin:12px 0 0">Respondeste a <b>','<p class="small muted" style="margin:12px 0 0">You answered <b>')+s.nA+TL(" de "," of ")+s.n+"</b>"+(s.reach?TL(" (a última foi a questão "," (the last one was question ")+s.reach+")":"")+TL(" e terminaste ao fim de "," and finished after ")+mins+TL(" minutos. Contando as "," minutes. Counting the ")+s.blank+TL(" em branco como erradas, como no exame real, ficava "," blanks as wrong, as in the real exam, it would be ")+s.okA+"/"+s.n+" ("+pct(s.okA,s.n)+TL("%). As que ficaram por responder não entram nas revisões.</p>","%). The unanswered ones don’t go into your reviews.</p>");
  var E=(r.q||[]).filter(function(id){return r.ans&&r.ans[id]&&r.ans[id].length&&Q[id];}).map(function(id){return {id:id,ok:same(r.ans[id],Q[id].ans),f:"x",ms:(r.t||{})[id]||0};});
  var cs=confScore();
  return TL('<div class="vh"><div><h1>Resultado','<div class="vh"><div><h1>Result')+(r.label?": "+esc(lbl(r.label)):TL(" do simulado"," of the practice exam"))+'</h1><p>'+new Date(r.at).toLocaleString(LOC(),{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+TL('</p></div><button class="btn" data-act="backsim">Voltar aos simulados</button></div><div class="stack"><div class="grid3">','</p></div><button class="btn" data-act="backsim">Back to practice exams</button></div><div class="stack"><div class="grid3">')+
    '<section class="panel g-wide"><div class="qmeta" style="margin-bottom:12px">'+tag+'</div><div class="score"><span class="num">'+(s.nA?pct(s.okA,s.nA)+"%":"—")+'</span><span class="muted">'+sub+'</span></div>'+intr+TL('<p class="small faint" style="margin:12px 0 0">O corte do exame real não é público. As percentagens por domínio servem para veres onde perdes pontos.</p>','<p class="small faint" style="margin:12px 0 0">The real exam’s cut score isn’t public. The percentages by domain show you where you lose points.</p>')+
    '<div class="row" style="margin-top:20px">'+(s.wrongA.length?'<button class="btn primary" data-act="trainwrong" data-v="'+r.at+TL('">Treinar as ','">Practise the ')+s.wrongA.length+TL(' que errei</button>',' I got wrong</button>'):"")+"</div></section>"+
    TL('<section class="panel"><p class="lbl">Respostas</p>','<section class="panel"><p class="lbl">Answers</p>')+donutHTML([{n:TL("Certas","Correct"),v:s.okA,c:"var(--ok)",d:TL("Respostas certas. No exame real, cada uma vale 1 ponto.","Correct answers. In the real exam, each one is worth 1 point.")},{n:TL("Erradas","Wrong"),v:s.nA-s.okA,c:"var(--bad)",d:TL("Respostas erradas. Nas de escolha múltipla não há crédito parcial: falhar uma opção já conta como errada.","Wrong answers. Multiple-select questions give no partial credit: missing one option already counts as wrong.")},{n:TL("Em branco","Blank"),v:s.blank,c:"var(--ink-3)",d:TL("Ficaram sem resposta. No exame real contam como erradas, por isso responde sempre, mesmo a adivinhar.","Left unanswered. In the real exam they count as wrong, so always answer, even if you have to guess.")}],TL("Respostas do simulado","Practice exam answers"))+"</section></div>"+
    reportHTML(E,true)+'<div class="grid2">'+paceHTML(s,r)+TL('<section class="panel"><div class="phead"><p class="lbl">Índice de confiança</p><a class="link" href="#progresso">Evolução</a></div>','<section class="panel"><div class="phead"><p class="lbl">Confidence index</p><a class="link" href="#progresso">Evolution</a></div>')+gaugeHTML(cs,true)+"</section></div>"+
    (wr?TL('<section class="panel"><div class="wrhead"><p class="lbl">Questões erradas · ','<section class="panel"><div class="wrhead"><p class="lbl">Wrong questions · ')+s.wrongA.length+TL('</p><span class="small faint">Abre uma para veres as opções e a explicação</span></div><div class="wrlist">','</p><span class="small faint">Open one to see the options and the explanation</span></div><div class="wrlist">')+wr+"</div></section>":"")+"</div>";
}

function vProgresso(){
  var strict=pool(false), cs=confScore();
  var kp='<section class="kpis">'+kpiList().map(kpiHTML).join("")+"</section>";
  var bySub={};strict.forEach(function(q){var r=rec(q.id),o=bySub[q.sub]||(bySub[q.sub]={d:q.d,s:0,c:0,t:0});o.t++;if(r&&r.n){o.s++;if(r.l)o.c++;}});
  var weak=Object.keys(bySub).filter(function(s){return bySub[s].s>=3;}).sort(function(a,b){return bySub[a].c/bySub[a].s-bySub[b].c/bySub[b].s;}).slice(0,8);
  var weakH=weak.length?'<ul class="weakl">'+weak.map(function(s){var o=bySub[s];return '<li><span><span class="faint num" style="font-size:11px;margin-right:6px">D'+o.d+"</span>"+esc(s)+'</span><span class="num">'+pct(o.c,o.s)+"% · "+o.s+"/"+o.t+TL(' vistas</span><button class="btn" data-act="trainsub" data-v="',' seen</span><button class="btn" data-act="trainsub" data-v="')+esc(s)+TL('">Treinar</button></li>','">Practise</button></li>');}).join("")+"</ul>":TL('<p class="small muted" style="margin:0">Aparece aqui depois de responderes a pelo menos 3 questões de um tema.</p>','<p class="small muted" style="margin:0">Shows up here after you answer at least 3 questions from a topic.</p>');
  var byMod={};strict.forEach(function(q){var m=modOf(q);if(!m)return;var o=byMod[m]||(byMod[m]={s:0,c:0,t:0});o.t++;var r=rec(q.id);if(r&&r.n){o.s++;if(r.l)o.c++;}});
  var modH='<ul class="weakl">'+mods().map(function(m){var o=byMod[m];return '<li><span>'+esc(modName(m))+'</span><span class="num">'+(o.s?pct(o.c,o.s)+"% · ":"")+o.s+"/"+o.t+TL(' vistas</span><button class="btn" data-act="trainmod" data-v="',' seen</span><button class="btn" data-act="trainmod" data-v="')+esc(m)+TL('">Treinar</button></li>','">Practise</button></li>');}).join("")+"</ul>";
  var calR=["s","a","p"].map(function(c){var v=S.cal[c]||[0,0];return '<div class="r"><span>'+CONF[c]+'</span><div class="bar"><i class="b-m" style="width:'+pct(v[0],v[1])+'%"></i></div><span class="num">'+(v[1]?pct(v[0],v[1])+"% · "+v[1]:"—")+"</span></div>";}).join("");
  var csv=S.cal.s||[0,0],calNote=csv[1]<10?TL("Responde a mais algumas questões para veres se a tua confiança bate certo com os resultados.","Answer a few more questions to see whether your confidence matches your results."):pct(csv[0],csv[1])<85?TL("Quando dizes «tenho a certeza» acertas ","When you say «I’m sure» you’re right ")+pct(csv[0],csv[1])+TL("% das vezes. Estás a sobrestimar-te: os erros confiantes estão na sua própria lista para rever.","% of the time. You’re overestimating yourself: your confident mistakes are on their own list to review."):TL("Quando dizes «tenho a certeza» acertas ","When you say «I’m sure» you’re right ")+pct(csv[0],csv[1])+TL("% das vezes. A tua confiança está bem calibrada.","% of the time. Your confidence is well calibrated.");
  var tot=(S.cal.s[1]||0)+(S.cal.a[1]||0)+(S.cal.p[1]||0), gs=pct(S.cal.p[1]||0,tot);
  var bx=[0,0,0,0,0,0];strict.forEach(function(q){var r=rec(q.id);bx[r&&r.n?r.b:0]++;});
  var bl=[TL("Por ver","Not seen"),TL("hoje","today")].concat([2,3,4,5].map(function(b){var v=ivDays(b);return v+(v===1?TL(" dia"," day"):TL(" dias"," days"));}));
  var leit='<div class="leit">'+bx.map(function(n,i){return "<div><b>"+n+"</b><span>"+(i?TL("Caixa ","Box ")+i+" · "+bl[i]:bl[0])+"</span></div>";}).join("")+"</div>";
  var reset=ui.armed==="reset"?TL('<button class="btn" data-act="resetgo" style="border-color:var(--bad);color:var(--bad)">Apagar mesmo</button> <button class="link" data-act="resetno">Cancelar</button>','<button class="btn" data-act="resetgo" style="border-color:var(--bad);color:var(--bad)">Delete for real</button> <button class="link" data-act="resetno">Cancel</button>'):TL('<button class="link" data-act="reset">Apagar todo o progresso</button>','<button class="link" data-act="reset">Delete all progress</button>');
  return TL('<div class="vh"><div><h1>Progresso</h1><p>KPIs, evolução e pontos fracos, medidos sobre as ','<div class="vh"><div><h1>Progress</h1><p>KPIs, evolution and weak spots, measured over the ')+strict.length+TL(' questões ativas</p></div></div><div class="stack">',' active questions</p></div></div><div class="stack">')+
    TL('<div><div class="phead"><p class="lbl">KPIs</p><span class="small faint">Como os indicadores do Performance Analytics: valor, meta, estado e tendência</span></div>','<div><div class="phead"><p class="lbl">KPIs</p><span class="small faint">Like Performance Analytics indicators: value, target, status and trend</span></div>')+kp+"</div>"+
    TL('<div class="grid3"><section class="panel g-wide"><div class="phead"><p class="lbl">Evolução</p><span class="small faint">Desde o primeiro dia registado</span></div>','<div class="grid3"><section class="panel g-wide"><div class="phead"><p class="lbl">Evolution</p><span class="small faint">Since the first recorded day</span></div>')+evoHTML()+etaHTML()+"</section>"+
    TL('<section class="panel gstack"><p class="lbl">Índice de confiança</p>','<section class="panel gstack"><p class="lbl">Confidence index</p>')+gaugeHTML(cs)+TL('<details class="more" style="margin-top:12px"><summary>Como é calculado</summary><ul class="rules" style="margin-top:8px">','<details class="more" style="margin-top:12px"><summary>How it’s calculated</summary><ul class="rules" style="margin-top:8px">')+cs.parts.map(function(p){return "<li><b>"+esc(p.n)+"</b> ("+Math.round(p.w*100)+"%): "+esc(p.d)+"</li>";}).join("")+TL('</ul><p class="small faint" style="margin:8px 0 0">Índice = 10 × soma de (peso × componente). 8 ou mais, com 80% em três simulados seguidos, é um bom sinal para marcar o exame. É uma estimativa: o corte real não é público.</p></details></section></div>','</ul><p class="small faint" style="margin:8px 0 0">Index = 10 × sum of (weight × component). 8 or more, with 80% in three practice exams in a row, is a good sign to book the exam. It’s an estimate: the real cut score isn’t public.</p></details></section></div>')+
    TL('<div class="grid2"><section class="panel"><p class="lbl">Temas mais fracos</p>','<div class="grid2"><section class="panel"><p class="lbl">Weakest topics</p>')+weakH+"</section>"+
    TL('<section class="panel"><p class="lbl">Por módulo do curso</p>','<section class="panel"><p class="lbl">By course module</p>')+modH+TL('<p class="small muted" style="margin:14px 0 0">Cada questão vai para o módulo do guia que melhor lhe corresponde. É uma aproximação.</p></section></div>','<p class="small muted" style="margin:14px 0 0">Each question goes to the guide module that best matches it. It’s an approximation.</p></section></div>')+
    TL('<div class="grid2"><section class="panel"><p class="lbl">Confiança vs. acerto</p><div class="cal">','<div class="grid2"><section class="panel"><p class="lbl">Confidence vs. accuracy</p><div class="cal">')+calR+'</div><p class="small muted" style="margin:14px 0 0">'+calNote+TL(" Usaste o palpite em "," You used a guess in ")+gs+TL("% das respostas.</p></section>","% of your answers.</p></section>")+
    TL('<section class="panel"><p class="lbl">Calendário de revisão</p>','<section class="panel"><p class="lbl">Review schedule</p>')+leit+TL('<p class="small faint" style="margin:12px 0 0">Cada caixa diz quando a questão volta','<p class="small faint" style="margin:12px 0 0">Each box says when the question comes back')+(daysLeft()!=null&&daysLeft()>=0?TL(", ajustado aos ",", adjusted to the ")+daysLeft()+TL(" dias até ao exame"," days until the exam"):"")+TL('. Acertar sobe uma caixa; errar devolve à caixa 1; questões que já erraste duas vezes voltam mais cedo.</p></section></div>','. A correct answer moves it up a box; a wrong one sends it back to box 1; questions you’ve already missed twice come back sooner.</p></section></div>')+
    TL('<section class="panel"><p class="lbl">Dados</p><p class="small muted" style="margin:0 0 12px" data-sync></p>','<section class="panel"><p class="lbl">Data</p><p class="small muted" style="margin:0 0 12px" data-sync></p>')+dataPanelHTML()+reset+"</section>"+
    TL('</div><p class="src">Questões: ','</div><p class="src">Questions: ')+esc(D.meta.fonte_q)+TL(", texto integral (só se corrigiram opções mal separadas na leitura do Excel). Explicações: documentação oficial ServiceNow (GitHub, ramo brazil) e ",", full text (only options split incorrectly when reading the Excel file were fixed). Explanations: official ServiceNow documentation (GitHub, brazil branch) and ")+esc(TL(D.meta.fonte_pdf,"ServiceNow Administration Fundamentals.pdf (179 pages)"))+TL(". Domínios e regras do exame: ",". Exam domains and rules: ")+esc(TL(D.meta.blueprint,"CSA Mainline Exam Blueprint, KB0011554 (updated January 2026)"))+".</p>";
}

/* ---------------- ranking ---------------- */
function vRanking(){
  var rk=ui.rk||(ui.rk={tab:"bad",d:""});
  var L=pool(false).filter(function(q){var r=rec(q.id);return r&&r.n&&(!rk.d||String(q.d)===rk.d);});
  var list=rk.tab==="bad"?L.filter(function(q){var r=rec(q.id);return r.n-r.k>0;}).sort(function(a,b){var ra=rec(a.id),rb=rec(b.id);return (rb.n-rb.k)-(ra.n-ra.k)||ra.k/ra.n-rb.k/rb.n||(rb.l?0:1)-(ra.l?0:1);})
    :L.filter(function(q){return rec(q.id).k>0;}).sort(function(a,b){var ra=rec(a.id),rb=rec(b.id);return rb.k-ra.k||rb.k/rb.n-ra.k/ra.n||rb.b-ra.b;});
  list=list.slice(0,30);
  var dopts=TL('<option value="">Todos os domínios</option>','<option value="">All domains</option>')+D.domains.map(function(d){return '<option value="'+d.id+'"'+(rk.d===String(d.id)?" selected":"")+">D"+d.id+" · "+esc(d.name)+"</option>";}).join("");
  var rows=list.map(function(q,i){var r=rec(q.id),last=r.l?TL('<b class="yes">certa</b>','<b class="yes">correct</b>'):TL('<b class="no">errada</b>','<b class="no">wrong</b>');
    var meta='<span class="tag">D'+q.d+" · "+esc(q.sub)+'</span><span><b class="'+(rk.tab==="bad"?"no":"yes")+'">'+(rk.tab==="bad"?(r.n-r.k)+TL(" erro"," mistake")+(r.n-r.k>1?"s":""):r.k+TL(" acerto"," correct answer")+(r.k>1?"s":""))+TL("</b> em ","</b> in ")+r.n+TL(" tentativa"," attempt")+(r.n>1?"s":"")+TL('</span><span>Última: ','</span><span>Last: ')+last+'</span><span class="qid">'+esc(q.label||("Question "+q.id))+"</span>";
    return '<details class="wr rk"><summary><span class="wx'+(rk.tab==="bad"?"":" okx")+'">'+(i+1)+'</span><span><span class="ws">'+esc(q.stem)+'</span><span class="wmeta">'+meta+'</span></span><span class="chev" aria-hidden="true"></span></summary><div class="body">'+optsHTML(q,{chosen:[],reveal:true})+explainHTML(q,[])+"</div></details>";}).join("");
  var ids=list.map(function(q){return q.id;});
  return TL('<div class="vh"><div><h1>Ranking</h1><p>As questões que mais erras e as que mais acertas, contadas sem as repetições dentro da mesma sessão</p></div></div><section class="panel">','<div class="vh"><div><h1>Ranking</h1><p>The questions you miss most and the ones you get right most, counted without repeats within the same session</p></div></div><section class="panel">')+
    '<div class="rkbar"><div class="seg" role="group" aria-label="Ranking"><button data-act="rktab" data-v="bad" aria-pressed="'+(rk.tab==="bad")+TL('">Mais erradas</button><button data-act="rktab" data-v="good" aria-pressed="','">Most missed</button><button data-act="rktab" data-v="good" aria-pressed="')+(rk.tab==="good")+TL('">Mais acertadas</button></div><select id="rkD" data-act="rkd" aria-label="Domínio">','">Most correct</button></div><select id="rkD" data-act="rkd" aria-label="Domain">')+dopts+"</select>"+(rk.tab==="bad"&&ids.length?TL('<button class="btn primary" data-act="rktrain" style="margin-left:auto">Treinar estas ','<button class="btn primary" data-act="rktrain" style="margin-left:auto">Practise these ')+ids.length+"</button>":"")+"</div>"+
    (rows?'<div class="wrlist">'+rows+"</div>":'<p class="small muted" style="margin:0">'+(rk.tab==="bad"?TL("Ainda não erraste nenhuma questão aqui.","You haven’t got any question wrong here yet."):TL("Ainda não acertaste nenhuma questão aqui.","You haven’t got any question right here yet."))+"</p>")+"</section>";
}

/* ---------------- ranking global (só na versão online; entra quem já respondeu a questões) ---------------- */
function lbAnswers(){var n=0;for(var k in S.days)n+=S.days[k].q||0;return n;}
function lbProfile(){
  var ds=domStats(), cs=confScore(), parts={}, days=[], t=Date.now(), studied=0, first=null;
  cs.parts.forEach(function(p){parts[p.k]=Math.round(p.v*100);});
  for(var j=13;j>=0;j--){var d=S.days[dkey(t-j*DAY)];days.push(d?d.q||0:0);}
  for(var k in S.days){if(S.days[k].q){studied++;if(!first||k<first)first=k;}}
  var cal=S.cal.s||[0,0], tot=(S.cal.s[1]||0)+(S.cal.a[1]||0)+(S.cal.p[1]||0), am=avgMs(200);
  return {v:1, dom:D.domains.map(function(d){var o=ds[d.id];return [d.id,o.t,o.seen,o.c];}), parts:parts, days:days, studied:studied,
    first:first?new Date(first+"T12:00:00").getTime():null, exams:eligibleExams().slice(-6).map(function(e){return [e.at,Math.round(examPct(e))];}),
    avg_ms:am==null?null:Math.round(am), sure:cal[1]>=10?Math.round(100*cal[0]/cal[1]):null, guess:tot?Math.round(100*(S.cal.p[1]||0)/tot):null};
}
function lbStats(){
  var cs=confScore(), total=pool(false).length, seen=strictSeen(), t7=trail(Date.now(),7), ex=eligibleExams().slice(-3);
  return {score:Math.round(cs.score*10)/10, readiness:readiness(domStats()), coverage:total?Math.round(100*seen/total):0,
    accuracy7:t7.q?Math.round(100*t7.ok/t7.q):null, exams_avg:ex.length?Math.round(ex.reduce(function(a,e){return a+examPct(e);},0)/ex.length):null,
    streak:streak(), answers:lbAnswers(), profile:lbProfile()};
}
function lbDefaultName(){
  var B=window.CSA_BACKEND, e=(B&&B.email)||"";
  var n=e.split("@")[0].replace(/[._\-+0-9]+/g," ").trim().split(/\s+/).map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(" ").slice(0,24).trim();
  return n.length>=2?n:TL("Aluno ","Student ")+String((B&&B.uid)||"").slice(0,4);
}
function lbErrMsg(e){
  var m=String((e&&(e.message||e.code))||"");
  return /leaderboard|PGRST205|schema cache|does not exist|column/i.test(m)?TL("O ranking ainda não está ativo no servidor. Avisa o administrador.","The ranking isn’t set up on the server yet. Tell the admin."):TL("Não consegui guardar. Tenta outra vez.","Couldn’t save. Try again.");
}
function lbPush(extra){
  var B=window.CSA_BACKEND; if(!B||!D)return Promise.resolve();
  var row=lbStats(), m=ui.lbMine;
  row.display_name=m?m.display_name:lbDefaultName(); row.hidden=m?!!m.hidden:false;
  if(extra)for(var k in extra)row[k]=extra[k];
  return B.lbSave(row).then(function(r){ui.lbMine=r||row;ui.lbRows=null;if(view==="global")render();});
}
var lbTimer=null;
function lbSchedule(){
  if(!window.CSA_BACKEND||!ui.lbReady)return;
  if(!ui.lbMine&&!lbAnswers())return;
  clearTimeout(lbTimer);
  lbTimer=setTimeout(function(){lbPush().catch(function(){});},4000);
}
function lbName(){var el=$("lbName");return el?el.value.trim().replace(/\s+/g," "):"";}
function lbSaveName(){
  var name=lbName();
  if(name.length<2||name.length>24){toast(TL("O nome tem de ter entre 2 e 24 caracteres.","The name must have 2 to 24 characters."));return;}
  lbPush({display_name:name}).then(function(){ui.lbRename=false;render();toast(TL("Agora apareces como ","You now appear as ")+name+".");})
  .catch(function(e){toast(lbErrMsg(e));});
}
function lbSetHidden(h){
  lbPush({hidden:h}).then(function(){ui.armed=null;render();toast(h?TL("Já não apareces no ranking.","You no longer appear in the ranking."):TL("Voltaste a aparecer no ranking.","You’re back in the ranking."));})
  .catch(function(e){toast(lbErrMsg(e));});
}
function lbNum(x){x=Number(x);return isFinite(x)?x:null;}
function lbPctTxt(x){x=lbNum(x);return x==null?"—":Math.round(x)+"%";}
function lbBar(label,v,txt){v=lbNum(v);var w=v==null?0:Math.max(0,Math.min(100,v));
  return '<div class="r"><span>'+label+'</span><div class="bar"><i class="b-m" style="width:'+w+'%"></i></div><span class="num">'+txt+"</span></div>";}
function lbProfileHTML(r){
  var H=HELP(), B=window.CSA_BACKEND, p=r.profile&&typeof r.profile==="object"?r.profile:{}, isMe=r.user_id===B.uid, mine=isMe?null:lbProfile();
  var rows=lbSorted(), pos=-1; rows.forEach(function(x,i){if(x.user_id===r.user_id)pos=i;});
  var first=lbNum(p.first), am=lbNum(p.avg_ms);
  var sub='<p class="small muted pf-sub">'+(pos>=0?(pos+1)+"º "+TL("de ","of ")+rows.length+" · ":"")+TL("atualizado a ","updated ")+dmy(r.updated_at)+(first?" · "+TL("a estudar desde ","studying since ")+dmy(first):"")+"</p>";
  var kv=[[fmt1(lbPoints(r)),TL("pontos no ranking","ranking points"),"points"],[fmt1(lbNum(r.score)||0),TL("índice de confiança","confidence index"),"score"],[lbPctTxt(r.readiness),TL("prontidão","readiness"),"readiness"],[lbPctTxt(r.coverage),TL("do banco visto","of the bank seen"),"coverage"],
    [lbPctTxt(r.accuracy7),TL("acerto nos últimos 7 dias","accuracy, last 7 days"),"acc7"],[lbPctTxt(r.exams_avg),TL("média dos últimos simulados","average of recent exams"),"exams"],[lbNum(r.streak)||0,TL("dias seguidos","day streak"),"streak"],
    [lbNum(r.answers)||0,TL("respostas no total","answers in total"),"answers"],[lbNum(p.studied)==null?"—":lbNum(p.studied),TL("dias de estudo","study days"),"studied"],[am==null?"—":mmss(am),TL("tempo médio por questão","average time per question"),"avgms"],
    [lbPctTxt(p.sure),TL("certas quando diz «tenho a certeza»","right when saying «I’m sure»"),"sure"]];
  var kpis='<div class="kv pf-kv">'+kv.map(function(x){return "<div><b>"+esc(x[0])+"</b><span>"+x[1]+(x[2]?info(H[x[2]]):"")+"</span></div>";}).join("")+"</div>";
  if(!p.v)return sub+kpis+'<p class="small muted" style="margin:18px 0 0">'+TL("Os detalhes por domínio aparecem quando esta pessoa voltar a estudar.","The per-domain details show up when this person studies again.")+"</p>";
  var myDom={}; if(mine)mine.dom.forEach(function(d){myDom[d[0]]=d;});
  var dom=(Array.isArray(p.dom)?p.dom:[]).map(function(d){
    var dd=D.domains.filter(function(x){return x.id===lbNum(d[0]);})[0]; if(!dd)return "";
    var t=lbNum(d[1])||0, s=lbNum(d[2])||0, c=lbNum(d[3])||0, me=myDom[dd.id];
    return "<tr><td>D"+dd.id+" · "+esc(dd.name)+'</td><td class="r">'+dd.w+'%</td><td class="r">'+pct(s,t)+'%</td><td class="r"><b>'+(s?pct(c,s)+"%":"—")+"</b></td>"+(mine?'<td class="r faint">'+(me&&me[2]?pct(me[3],me[2])+"%":"—")+"</td>":"")+"</tr>";
  }).join("");
  var domH='<div class="tbl"><table class="bp pf-dom"><thead><tr><th>'+TL("Domínio","Domain")+'</th><th class="r">'+TL("Peso","Weight")+info(H.w)+'</th><th class="r">'+TL("Visto","Seen")+info(H.seen)+'</th><th class="r">'+TL("Acerto","Accuracy")+info(H.acc)+"</th>"+(mine?'<th class="r">'+TL("Tu","You")+info(H.you)+"</th>":"")+"</tr></thead><tbody>"+dom+"</tbody></table></div>";
  var parts=p.parts||{}, names={}; confScore().parts.forEach(function(x){names[x.k]=x.n;});
  var partH='<div class="cal">'+["M","X","C","R","K","P"].map(function(k){return lbBar(esc(names[k])+info(H[k]),parts[k],lbPctTxt(parts[k]));}).join("")+"</div>";
  var ex=(Array.isArray(p.exams)?p.exams:[]).filter(function(e){return Array.isArray(e)&&lbNum(e[1])!=null;});
  var exH=ex.length?'<div class="pf-exams">'+ex.map(function(e){var v=lbNum(e[1]);return '<span class="tag'+(v>=80?" multi":"")+'"><b>'+v+"%</b> · "+dmy(lbNum(e[0]))+"</span>";}).join("")+"</div>"
    :'<p class="small muted" style="margin:0">'+TL("Ainda sem simulados completos.","No complete practice exams yet.")+"</p>";
  var days=(Array.isArray(p.days)?p.days:[]).map(function(x){return lbNum(x)||0;}), mx=Math.max.apply(null,days.concat([1]));
  var actH='<div class="pf-act" role="img" aria-label="'+TL("Questões respondidas por dia, últimos 14 dias","Questions answered per day, last 14 days")+'">'+days.map(function(n,i){var dt=Date.now()-(days.length-1-i)*DAY;
    return '<i style="height:'+Math.max(4,Math.round(100*n/mx))+'%"'+(n?"":' class="z"')+' title="'+esc(dmy(dt))+": "+n+'"></i>';}).join("")+'</div><div class="pf-axis small faint"><span>'+TL("há 14 dias","14 days ago")+"</span><span>"+TL("hoje","today")+"</span></div>";
  return sub+kpis+
    '<h3 class="pf-h">'+TL("Por domínio do exame","By exam domain")+info(H.dom)+"</h3>"+domH+
    '<h3 class="pf-h">'+TL("Componentes do índice","Index components")+info(H.score)+"</h3>"+partH+
    '<div class="pf-two"><div><h3 class="pf-h">'+TL("Últimos simulados","Recent practice exams")+info(H.exlist)+"</h3>"+exH+'</div><div><h3 class="pf-h">'+TL("Atividade","Activity")+info(H.activity)+"</h3>"+actH+"</div></div>";
}
function lbOpenProfile(id){
  var r=(ui.lbRows||[]).filter(function(x){return x.user_id===id;})[0]||(ui.lbMine&&ui.lbMine.user_id===id?ui.lbMine:null);
  var d=document.getElementById("dlg"); if(!r||!d)return;
  if(!d.dataset.lb){d.dataset.lb=1;d.addEventListener("close",function(){d.classList.remove("dlg-wide");});}
  d.classList.add("dlg-wide");
  d.innerHTML='<div class="dlg-head"><h2>'+esc(r.display_name)+(r.user_id===window.CSA_BACKEND.uid?' <span class="tag">'+TL("tu","you")+"</span>":"")+'</h2><button class="dlg-x" data-g="dlgclose" aria-label="'+TL("Fechar","Close")+'">×</button></div><div class="dlg-body">'+lbProfileHTML(r)+"</div>";
  if(!d.open)d.showModal();
}
/* pontos do ranking (0–100): só o que mostra se a pessoa passaria no exame.
   Prontidão (certas sobre o banco todo, por isso ver poucas questões não ajuda) e média dos simulados (sem simulado conta 0).
   Ritmo, calibração e dias seguidos ficam de fora: dizem como se estuda, não quanto se sabe. */
var LB_W={rd:.6,ex:.4};
function lbPoints(r){return Math.round(10*(LB_W.rd*(lbNum(r.readiness)||0)+LB_W.ex*(lbNum(r.exams_avg)||0)))/10;}
function lbSorted(){return (ui.lbRows||[]).slice().sort(function(a,b){return (lbPoints(b)-lbPoints(a))||((lbNum(b.exams_avg)||0)-(lbNum(a.exams_avg)||0))||(b.coverage-a.coverage)||(b.answers-a.answers);});}
function vGlobal(){
  var B=window.CSA_BACKEND;
  var head='<div class="vh"><div><h1>'+TL("Ranking global","Global ranking")+'</h1><p>'+TL("Quem está mais perto de passar no exame: conta o que já respondes certo em todo o banco e os simulados. Entra automaticamente quem já respondeu a questões.","Who is closest to passing the exam: what you already answer correctly across the whole bank, plus practice exams. Everyone who has answered questions joins automatically.")+"</p></div></div>";
  if(!B)return head+'<div class="empty"><b>'+TL("Disponível só na versão online.","Only available in the online version.")+"</b></div>";
  if(!ui.lbRows){
    if(!ui.lbLoading){ui.lbLoading=1;B.lbList().then(function(rows){ui.lbRows=rows;ui.lbLoading=0;ui.lbErr=null;if(view==="global")render();}).catch(function(e){ui.lbRows=[];ui.lbLoading=0;ui.lbErr=e||1;if(view==="global")render();});}
    return head+'<div class="empty"><b>'+TL("A carregar o ranking…","Loading the ranking…")+"</b></div>";
  }
  var mine=ui.lbMine, me=B.uid, st=lbStats(), rows=lbSorted(), H=HELP();
  var myPos=-1; rows.forEach(function(r,i){if(r.user_id===me)myPos=i;});
  var you;
  if(mine&&ui.lbRename){
    you='<section class="panel lbjoin"><p class="lbl">'+TL("Mudar o nome","Change your name")+'</p>'+
      '<p class="small muted" style="margin:0 0 14px;max-width:62ch">'+TL("É o nome que os colegas veem no ranking e no teu perfil (pode ser um apelido). O teu email nunca aparece.","It’s the name your classmates see in the ranking and on your profile (a nickname is fine). Your email never appears.")+"</p>"+
      '<div class="row"><input id="lbName" class="lbinput" type="text" maxlength="24" autocomplete="nickname" value="'+esc(mine.display_name)+'" aria-label="'+TL("Nome no ranking","Ranking name")+'">'+
      '<button class="btn primary" data-act="lbjoin">'+TL("Guardar nome","Save name")+'</button><button class="link" data-act="lbcancel">'+TL("Cancelar","Cancel")+"</button></div></section>";
  }else if(mine&&mine.hidden){
    you='<section class="panel lbjoin"><p class="lbl">'+TL("Estás escondido","You’re hidden")+'</p><p class="small muted" style="margin:0 0 14px;max-width:62ch">'+TL("Os colegas não te veem no ranking nem conseguem abrir o teu perfil. Podes voltar quando quiseres.","Your classmates can’t see you in the ranking or open your profile. You can come back whenever you want.")+"</p>"+
      '<div class="row"><button class="btn primary" data-act="lbshow">'+TL("Voltar a aparecer","Show me again")+"</button></div></section>";
  }else if(mine){
    var hide=ui.armed==="lbleave"?'<button class="btn" data-act="lbleavego" style="border-color:var(--bad);color:var(--bad)">'+TL("Esconder mesmo","Hide me")+'</button> <button class="link" data-act="lbcancel">'+TL("Cancelar","Cancel")+"</button>"
      :'<button class="link" data-act="lbleave">'+TL("Esconder-me do ranking","Hide me from the ranking")+"</button>";
    you='<section class="panel lbme"><div><p class="lbl">'+TL("A tua posição","Your position")+info(H.pos)+'</p><div class="lbpos"><b>'+(myPos>=0?(myPos+1)+"º":"—")+'</b><span>'+TL("de ","of ")+rows.length+" · "+esc(mine.display_name)+"</span></div></div>"+
      '<div class="kv" style="margin:0"><div><b>'+fmt1(lbPoints(st))+'</b><span>'+TL("pontos","points")+info(H.points)+'</span></div><div><b>'+fmt1(st.score)+'</b><span>'+TL("índice de confiança","confidence index")+info(H.score)+'</span></div><div><b>'+st.readiness+'%</b><span>'+TL("prontidão","readiness")+info(H.readiness)+'</span></div><div><b>'+st.coverage+'%</b><span>'+TL("do banco visto","of the bank seen")+info(H.coverage)+"</span></div></div>"+
      '<div class="row lbactions"><button class="btn" data-act="lbprof" data-v="'+esc(me)+'">'+TL("Ver o meu perfil","View my profile")+'</button><button class="link" data-act="lbrename">'+TL("Mudar o nome","Change name")+"</button>"+hide+"</div></section>";
  }else{
    you='<section class="panel lbjoin"><p class="lbl">'+TL("Ainda não estás no ranking","You’re not in the ranking yet")+'</p><p class="small muted" style="margin:0;max-width:62ch">'+
      (ui.lbErr?lbErrMsg(ui.lbErr):lbAnswers()?TL("A entrar no ranking…","Joining the ranking…"):TL("Entras sozinho quando responderes à primeira questão. Depois podes mudar o nome ou esconder-te.","You join by yourself when you answer your first question. Then you can change your name or hide."))+"</p></section>";
  }
  var medal=["🥇","🥈","🥉"];
  var trs=rows.map(function(r,i){
    var isMe=r.user_id===me;
    return '<tr'+(isMe?' class="me"':"")+'><td class="pos">'+(medal[i]||(i+1))+'</td><td class="nm">'+esc(r.display_name)+(isMe?' <span class="tag">'+TL("tu","you")+"</span>":"")+'</td><td class="r"><b>'+fmt1(lbPoints(r))+"</b></td>"+
      '<td class="r">'+fmt1(Number(r.score))+'</td><td class="r">'+r.readiness+'%</td><td class="r">'+r.coverage+'%</td><td class="r">'+(r.accuracy7==null?"—":r.accuracy7+"%")+'</td><td class="r">'+(r.exams_avg==null?"—":r.exams_avg+"%")+"</td>"+
      '<td class="r">'+r.streak+'</td><td class="r small faint">'+dmy(r.updated_at)+'</td><td class="r"><button class="btn lbview" data-act="lbprof" data-v="'+esc(r.user_id)+'">'+TL("Ver perfil","View profile")+"</button></td></tr>";
  }).join("");
  var table=rows.length?'<div class="tbl"><table class="bp lbt"><thead><tr><th>#</th><th>'+TL("Nome","Name")+'</th><th class="r">'+TL("Pontos","Points")+info(H.points)+'</th><th class="r">'+TL("Índice","Index")+info(H.score)+'</th><th class="r">'+TL("Prontidão","Readiness")+info(H.readiness)+'</th><th class="r">'+TL("Banco visto","Bank seen")+info(H.coverage)+'</th><th class="r">'+TL("Acerto 7 d","Accuracy 7 d")+info(H.acc7)+'</th><th class="r">'+TL("Simulados","Exams")+info(H.exams)+'</th><th class="r">'+TL("Dias seguidos","Day streak")+info(H.streak)+'</th><th class="r">'+TL("Atualizado","Updated")+info(H.updated)+'</th><th><span class="sr-only">'+TL("Perfil","Profile")+"</span></th></tr></thead><tbody>"+trs+"</tbody></table></div>"
    :'<p class="small muted" style="margin:0">'+(ui.lbErr?TL("Não consegui carregar o ranking. ","Couldn’t load the ranking. ")+lbErrMsg(ui.lbErr).replace(/^Não consegui guardar\. Tenta outra vez\.$|^Couldn’t save\. Try again\.$/,TL("Recarrega a página.","Reload the page.")):TL("Ainda ninguém respondeu a questões.","Nobody has answered any questions yet."))+"</p>";
  return head+'<div class="stack">'+you+'<section class="panel"><div class="phead"><p class="lbl">'+TL("Classificação","Standings")+'</p><span class="small faint">'+TL("Ordenado por pontos","Sorted by points")+info(H.order)+"</span></div>"+table+
    '<p class="small faint" style="margin:14px 0 0">'+TL("Pontos (0 a 100) = 60% prontidão + 40% média dos simulados. Prontidão = % do exame que respondes certo agora, com o peso de cada domínio. O índice de confiança continua visível, mas serve para ti (inclui ritmo e calibração) e não decide a ordem.","Points (0 to 100) = 60% readiness + 40% practice exam average. Readiness = % of the exam you answer correctly now, weighted by domain. The confidence index is still shown, but it’s for you (it includes pace and calibration) and doesn’t decide the order.")+"</p></section></div>";
}

/* ---------------- conta, privacidade e notas de atualização (versão online) ---------------- */
var NEWS=[
  {d:"2026-11-26",t:["Banco ExamBase e escolha do banco de questões","ExamBase bank and question bank choice"],pt:[
    "O que muda: passa a haver dois bancos de questões. Deloitte é o banco do curso. ExamBase são 36 questões extra de um site público de prática (exambase.com) que não estavam no nosso banco. Em Treino, Montar sessão (incluindo a morte súbita) e Simulado escolhes Deloitte, ExamBase ou Ambos. Cada questão mostra uma etiqueta com o banco de onde vem.",
    "De onde vieram: o Rui reparou que o site tinha as mesmas perguntas que nós e fez uma folha com 47 questões, novas ou com respostas diferentes. O Vitor reviu as respostas e testou algumas na instância. Depois cruzámos o site diretamente: 330 das 408 questões foram comparadas uma a uma com o nosso banco, pelo texto da pergunta e das opções.",
    "O que o cruzamento mostrou: 314 das 330 questões são iguais às nossas, com a mesma resposta. 10 não existiam no nosso banco e 6 tinham resposta diferente. O site usa praticamente o mesmo banco que nós.",
    "As 6 respostas diferentes, e em nenhuma o nosso banco estava errado. Q36 (Basic Configuration UI16): a documentação oficial lista o formato de data, e «Form Header Size» não existe. Q248 (Knowledge): «Can Read» é sobre ler artigos, não sobre escrever. Q390 (formato de data e hora): a documentação confirma Menu do utilizador > Preferences > Language & Region. Q282 (botão Save): o Vitor confirmou na instância que não há uma opção só para o Save, por isso fica a glide.ui.advanced. Q118 e Q235 são deprecated; a Q235 não tinha resposta no banco e o site indica Process Automation Designer, que bate com a nossa nota.",
    "Como escolhemos as 36: as 13 questões da folha que já existiam no banco ficaram de fora, para não haver duplicados. As restantes 34, mais 2 que só apareceram no cruzamento, foram revistas uma a uma. A folha tinha um erro de transcrição (Database View), e em 5 questões a folha e a revisão do Vitor discordavam. Em 4 ficou a resposta confirmada na documentação oficial (Additional actions e papéis do Table Builder, formatters) ou a explicação do Vitor (application menu: Configuration > Applications muda um CI da CMDB, não o menu). Na quinta (que aplicações criam visualizações) ficou a resposta da folha, marcada como não confirmada.",
    "Respostas não confirmadas: 4 questões (duas sobre visualizações de dados, o botão Run do Visualization Designer e a cifra que vem por omissão) não têm confirmação na documentação oficial. Mostram um aviso na nota da questão.",
    "Estatísticas e ranking: o índice, a prontidão, a cobertura, o Progresso e o ranking contam só o banco Deloitte, para todos serem comparados sobre as mesmas questões. Simulados com questões ExamBase não entram no índice nem no ranking.",
    "Simulado só com ExamBase: como o banco tem 36 questões, o simulado tem 36 questões em 54 minutos, o mesmo ritmo do exame real (1,5 minutos por questão).",
    "Obrigado ao Rui e ao Vitor pela folha e pela revisão."],
    en:[
    "What changes: there are now two question banks. Deloitte is the course bank. ExamBase is 36 extra questions from a public practice site (exambase.com) that weren’t in our bank. In Practice, Build a session (including sudden death) and Practice exam you choose Deloitte, ExamBase or Both. Each question shows a tag with the bank it comes from.",
    "Where they came from: Rui noticed the site had the same questions as us and made a sheet with 47 questions, new or with different answers. Vitor reviewed the answers and tested some on the instance. Then we crossed the site directly: 330 of its 408 questions were compared one by one with our bank, by the text of the question and the options.",
    "What the comparison showed: 314 of the 330 questions are the same as ours, with the same answer. 10 weren’t in our bank and 6 had a different answer. The site uses practically the same bank as we do.",
    "The 6 different answers, and our bank was wrong in none of them. Q36 (Basic Configuration UI16): the official docs list the date format, and «Form Header Size» doesn’t exist. Q248 (Knowledge): «Can Read» is about reading articles, not writing. Q390 (date and time format): the docs confirm User menu > Preferences > Language & Region. Q282 (Save button): Vitor confirmed on the instance there’s no Save-only option, so glide.ui.advanced stays. Q118 and Q235 are deprecated; Q235 had no answer in the bank and the site says Process Automation Designer, which matches our note.",
    "How we picked the 36: the 13 questions from the sheet already in the bank were left out, so there are no duplicates. The other 34, plus 2 that only showed up in the comparison, were reviewed one by one. The sheet had a transcription error (Database View), and in 5 questions the sheet and Vitor’s review disagreed. In 4 we kept the answer confirmed in the official docs (Table Builder Additional actions and roles, formatters) or Vitor’s explanation (application menu: Configuration > Applications changes a CMDB CI, not the menu). In the fifth (which applications create visualizations) we kept the sheet’s answer, marked as unconfirmed.",
    "Unconfirmed answers: 4 questions (two on data visualizations, the Visualization Designer Run button and the encryption that comes by default) have no confirmation in the official docs. They show a warning in the question’s note.",
    "Stats and ranking: the index, readiness, coverage, Progress and the ranking count the Deloitte bank only, so everyone is compared on the same questions. Practice exams with ExamBase questions don’t count towards the index or the ranking.",
    "ExamBase-only practice exam: since the bank has 36 questions, the exam has 36 questions in 54 minutes, the real exam’s pace (1.5 minutes per question).",
    "Thanks to Rui and Vitor for the sheet and the review."]},
  {d:"2026-11-24",t:["Ranking mais justo","A fairer ranking"],pt:[
    "O que muda: o ranking passa a ordenar por pontos, de 0 a 100. Pontos = 60% prontidão + 40% média dos últimos 3 simulados. A nova coluna «Pontos» aparece em primeiro lugar.",
    "Porquê: até agora a ordem seguia o índice de confiança. Esse índice mede o acerto e a retenção só nas questões que cada pessoa já viu. Assim, quem tinha visto menos do banco podia ficar à frente de quem viu mais, tinha mais prontidão e melhores simulados.",
    "O índice também dá 20% ao ritmo e à calibração. São bons sinais para cada um acompanhar o seu estudo, mas mostram como se estuda, não quanto se sabe. Por isso deixam de influenciar a ordem.",
    "Prontidão (60%): respostas certas sobre o banco inteiro, com o peso de cada domínio do exame. As questões ainda não vistas contam como não sabidas, por isso ver poucas e acertá-las já não chega para subir. Tem mais peso por ser estável: não depende de um dia bom ou mau.",
    "Simulados (40%): trazem o realismo do exame, com tempo limite e questões sorteadas. Quem ainda não fez nenhum simulado válido (30 ou mais questões, com 80% respondidas) fica com 0 nesta parte, por isso fazer simulados passa a contar.",
    "Os dias seguidos nunca contaram para a ordem e continuam a não contar. Aparecem só como informação.",
    "Em caso de empate, decidem os simulados, depois o banco visto e por fim o número de respostas.",
    "O índice de confiança continua visível no ranking, no perfil e em Progresso, como indicador pessoal para saberes quando marcar o exame."],
    en:[
    "What changes: the ranking now sorts by points, from 0 to 100. Points = 60% readiness + 40% average of the last 3 practice exams. The new «Points» column comes first.",
    "Why: until now the order followed the confidence index. That index measures accuracy and retention only on the questions each person has already seen. So someone who had seen less of the bank could rank above someone who had seen more, with higher readiness and better practice exams.",
    "The index also gives 20% to pace and calibration. They’re good signals for tracking your own study, but they show how you study, not how much you know. So they no longer affect the order.",
    "Readiness (60%): correct answers over the whole bank, weighted by each exam domain. Questions not seen yet count as not known, so seeing a few and getting them right is no longer enough to climb. It weighs more because it’s stable: it doesn’t depend on a good or bad day.",
    "Practice exams (40%): they bring the realism of the exam, with a time limit and random questions. Anyone without a valid practice exam yet (30 or more questions, 80% answered) gets 0 in this part, so taking practice exams now counts.",
    "The day streak never counted towards the order and still doesn’t. It’s shown for information only.",
    "Ties are broken by practice exams, then bank seen, then number of answers.",
    "The confidence index is still shown in the ranking, on profiles and in Progress, as a personal indicator to help you decide when to book the exam."]},
  {d:"2026-11-20",pt:["Conta e perfil numa página própria: nome no ranking, visibilidade, idioma, tema, palavra-passe, exportar e importar o progresso e apagar a conta.","Privacidade e sobre a app numa página própria.","Esta página de notas de atualização, para veres o que muda na app.","O menu lateral ajusta o tamanho à altura da janela: aproveita o espaço e cabe no ecrã sem barra de rolagem."],
    en:["Account and profile on its own page: ranking name, visibility, language, theme, password, export and import your progress, and delete your account.","Privacy and about the app on its own page.","This release notes page, so you can see what changes in the app.","The side menu sizes itself to the window height: it uses the space and fits the screen with no scrollbar."]},
  {d:"2026-11-19",t:["Atualização da tarde","Afternoon update"],pt:["As opções de resposta aparecem por ordem diferente sempre que a questão surge, para não se decorar a posição da resposta.","Morte súbita: entram sempre todas as questões do banco, sem filtros. O formato passou a ser a primeira escolha em Montar sessão.","Ranking global automático: entra toda a gente que já respondeu a questões. Podes mudar o nome ou esconder-te.","Ver perfil: as estatísticas de cada colega, com o acerto por domínio ao lado do teu.","Botões «i» que explicam cada índice e cada KPI.","Novo seletor de tema ☀ ☾ ao lado do idioma."],
    en:["The answer options show in a different order every time a question comes up, so nobody memorises the position of the answer.","Sudden death: it always uses every question in the bank, with no filters. The format is now the first choice in Build a session.","Automatic global ranking: everyone who has answered questions joins. You can change your name or hide.","View profile: each classmate’s stats, with accuracy per domain next to yours.","«i» buttons that explain every index and KPI.","New ☀ ☾ theme switch next to the language."]},
  {d:"2026-11-19",t:["Lançamento da versão online","Online version launch"],pt:["Contas com o código da turma. O progresso fica guardado na conta e funciona em qualquer computador ou telemóvel.","Importar o progresso do ficheiro HTML antigo.","Ranking global da turma.","Modo morte súbita em Montar sessão: acaba ao 18.º erro.","No simulado, o botão da última questão passa a «Terminar».","Menu da conta e seletor de certificação (CAD em breve)."],
    en:["Accounts with the class code. Your progress is saved to your account and works on any computer or phone.","Import your progress from the old HTML file.","Class global ranking.","Sudden death mode in Build a session: it ends at the 18th mistake.","In a practice exam, the last question’s button becomes «Finish».","Account menu and certification picker (CAD coming soon)."]},
  {d:"",t:["Antes da versão online (ficheiro HTML)","Before the online version (HTML file)"],pt:["Versão em inglês (PT | EN), com os termos do livro em inglês.","Relógio por questão em tempo real, que não para ao mudar de separador.","Treino do dia limitado a 60 questões.","Plano com as horas por dia corrigidas.","Exportar e importar o progresso.","Questão 435 corrigida (opções G e H separadas)."],
    en:["English version (PT | EN), with the book’s English terms.","Real-time clock per question that doesn’t stop when you switch tabs.","Today’s practice capped at 60 questions.","Plan with corrected hours per day.","Export and import your progress.","Question 435 fixed (options G and H split)."]}
];
window.CSA_NEWS_LATEST=NEWS[0].d;
function longDate(d){return d?new Date(d+"T12:00:00").toLocaleDateString(LOC(),{day:"numeric",month:"long",year:"numeric"}):"";}
function pageHead(h,p){return '<div class="vh"><div><h1>'+h+"</h1>"+(p?"<p>"+p+"</p>":"")+"</div></div>";}
function onlineOnly(head){return head+'<div class="empty"><b>'+TL("Disponível só na versão online.","Only available in the online version.")+"</b></div>";}
function newsHTML(n){return '<p class="lbl">'+esc(n.d?longDate(n.d):"")+(n.d&&n.t?" · ":"")+esc(n.t?TL(n.t[0],n.t[1]):"")+(n.d===NEWS[0].d&&n===NEWS[0]?' <span class="tag multi">'+TL("Novo","New")+"</span>":"")+'</p><ul class="news-l">'+(LANG==="en"?n.en:n.pt).map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>";}
function segLang(){return '<div class="seg langseg" role="group" aria-label="'+TL("Idioma","Language")+'"><button data-act="lang" data-v="pt" aria-pressed="'+(LANG!=="en")+'" lang="pt-PT">PT</button><button data-act="lang" data-v="en" aria-pressed="'+(LANG==="en")+'" lang="en">EN</button></div>';}
function segTheme(){var th=document.documentElement.dataset.theme==="dark"?"dark":"light";
  return '<div class="seg themeseg" role="group" aria-label="'+TL("Tema","Theme")+'"><button data-act="themeset" data-v="light" aria-pressed="'+(th==="light")+'" aria-label="'+TL("Tema claro","Light theme")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg></button><button data-act="themeset" data-v="dark" aria-pressed="'+(th==="dark")+'" aria-label="'+TL("Tema escuro","Dark theme")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button></div>';}
function vConta(){
  var B=window.CSA_BACKEND, head=pageHead(TL("Conta e perfil","Account and profile"),B?esc(B.email):"");
  if(!B)return onlineOnly(head);
  var mine=ui.lbMine, prof;
  if(!mine){
    prof='<p class="small muted" style="margin:0">'+(lbAnswers()?TL("A entrar no ranking…","Joining the ranking…"):TL("Entras no ranking global sozinho quando responderes à primeira questão. Depois podes mudar aqui o nome e esconder-te.","You join the global ranking by yourself when you answer your first question. Then you can change your name and hide here."))+"</p>";
  }else{
    var vis=mine.hidden?'<button class="btn primary" data-act="lbshow">'+TL("Voltar a aparecer","Show me again")+"</button>"
      :ui.armed==="lbleave"?'<button class="btn danger" data-act="lbleavego">'+TL("Esconder mesmo","Hide me")+'</button><button class="link" data-act="lbcancel">'+TL("Cancelar","Cancel")+"</button>"
      :'<button class="btn" data-act="lbleave">'+TL("Esconder-me do ranking","Hide me from the ranking")+"</button>";
    prof='<p class="acct-k">'+TL("Nome mostrado aos colegas","Name shown to classmates")+'</p><div class="row"><input id="lbName" class="lbinput" type="text" maxlength="24" autocomplete="nickname" value="'+esc(mine.display_name)+'" aria-label="'+TL("Nome no ranking","Ranking name")+'"><button class="btn primary" data-act="lbjoin">'+TL("Guardar nome","Save name")+"</button></div>"+
      '<p class="small faint" style="margin:8px 0 0">'+TL("Entre 2 e 24 caracteres. O teu email nunca aparece.","2 to 24 characters. Your email never appears.")+"</p>"+
      '<div class="acct-row"><div><b>'+(mine.hidden?TL("Escondido do ranking","Hidden from the ranking"):TL("Visível no ranking","Visible in the ranking"))+'</b><span class="small muted">'+(mine.hidden?TL("Os colegas não te veem nem abrem o teu perfil.","Classmates can’t see you or open your profile."):TL("Os colegas veem as tuas estatísticas e podem abrir o teu perfil.","Classmates see your stats and can open your profile."))+'</span></div><div class="row">'+vis+"</div></div>"+
      (mine.hidden?"":'<div class="acct-row"><div><b>'+TL("O teu perfil","Your profile")+'</b><span class="small muted">'+TL("Vê o que os colegas veem quando abrem o teu perfil.","See what classmates see when they open your profile.")+'</span></div><button class="btn" data-act="lbprof" data-v="'+esc(B.uid)+'">'+TL("Ver o meu perfil","View my profile")+"</button></div>");
  }
  return head+'<div class="stack acct-page">'+
    '<section class="panel"><p class="lbl">'+TL("Perfil no ranking","Ranking profile")+"</p>"+prof+"</section>"+
    '<section class="panel"><p class="lbl">'+TL("Preferências","Preferences")+'</p><div class="acct-row first"><div><b>'+TL("Idioma","Language")+'</b><span class="small muted">'+TL("Os nomes técnicos da plataforma ficam em inglês, como no exame.","The platform’s technical names stay in English, as in the exam.")+"</span></div>"+segLang()+'</div><div class="acct-row"><div><b>'+TL("Tema","Theme")+'</b><span class="small muted">'+TL("Claro ou escuro. Fica guardado neste browser.","Light or dark. Saved in this browser.")+"</span></div>"+segTheme()+"</div></section>"+
    '<section class="panel" data-msgbox><p class="lbl">'+TL("Palavra-passe","Password")+"</p>"+B.pwFormHTML()+"</section>"+
    '<section class="panel"><p class="lbl">'+TL("Os teus dados","Your data")+'</p><p class="small muted" style="margin:0 0 12px" data-sync></p>'+dataPanelHTML()+"</section>"+
    (B.isAdmin()?'<section class="panel"><p class="lbl">'+TL("Administração","Admin")+'</p><div class="acct-row first"><div><b>'+TL("Conteúdo e códigos de acesso","Content and access codes")+'</b><span class="small muted">'+TL("Carregar questões e criar códigos para as turmas.","Upload questions and create codes for classes.")+'</span></div><a class="btn" href="admin.html">'+TL("Abrir a administração","Open admin")+"</a></div></section>":"")+
    '<section class="panel acct-danger" data-msgbox><p class="lbl">'+TL("Apagar a conta","Delete account")+'</p><p class="small muted" style="margin:0 0 12px">'+TL("Apaga o progresso, o acesso e o lugar no ranking. Não dá para desfazer. Exporta o progresso antes, se o quiseres guardar.","Deletes your progress, access and ranking place. It can’t be undone. Export your progress first if you want to keep it.")+"</p>"+B.deleteHTML()+"</section>"+
    "</div>";
}
function vSobre(){
  var B=window.CSA_BACKEND, head=pageHead(TL("Privacidade e sobre a app","Privacy and about the app"),TL("O que a app guarda, quem vê o quê e de onde vem o conteúdo.","What the app stores, who sees what and where the content comes from."));
  if(!B)return onlineOnly(head);
  return head+'<div class="stack acct-page"><section class="panel privacy">'+B.privacyHTML()+"</section>"+
    '<section class="panel"><div class="phead"><p class="lbl">'+TL("Notas de atualização","Release notes")+'</p><a class="link" href="#novidades">'+TL("Ver todas","See all")+"</a></div>"+newsHTML(NEWS[0])+"</section></div>";
}
function vNovidades(){
  try{localStorage.setItem("csa2-news-seen",NEWS[0].d);}catch(e){}
  return pageHead(TL("Notas de atualização","Release notes"),TL("O que mudou na app, das novidades mais recentes para as mais antigas.","What changed in the app, from the newest to the oldest."))+
    '<div class="stack acct-page">'+NEWS.map(function(n){return '<section class="panel">'+newsHTML(n)+"</section>";}).join("")+"</div>";
}

/* ---------------- montar sessão ---------------- */
function mkState(){return ui.mk||(ui.mk={d:"",s:"",m:"",st:"all",n:20,fmt:"t"});}
function mkList(){var m=mkState(),e=eod();if(m.fmt==="d")return pool();return pool().filter(function(q){if(m.d&&String(q.d)!==m.d)return false;if(m.s&&q.sub!==m.s)return false;if(m.m&&modOf(q)!==m.m)return false;var r=rec(q.id);
  if(m.st==="new")return !r||!r.n;if(m.st==="wrong")return r&&r.n&&!r.l;if(m.st==="due")return r&&r.n&&r.due<=e;if(m.st==="guess")return r&&r.n&&r.c==="p";if(m.st==="seen")return r&&r.n;return true;});}
function mkSummary(){
  var m=mkState(),av=mkList().length,n=m.fmt==="d"?av:Math.min(m.n,av),ref=n*90000,am=avgMs(200);
  return TL('<p class="lbl">Resumo</p><div><div class="big">','<p class="lbl">Summary</p><div><div class="big">')+n+TL('</div><span class="small muted">questões de ','</div><span class="small muted">questions out of ')+av+TL(" disponíveis</span></div><dl>"," available</span></div><dl>")+
    TL("<dt>Tempo de referência (1:30 por questão, como no exame)</dt><dd>","<dt>Reference time (1:30 per question, as in the exam)</dt><dd>")+mmss(ref)+"</dd>"+
    TL("<dt>Com o teu ritmo atual","<dt>At your current pace")+(am?" ("+mmss(am)+"/q)":"")+"</dt><dd>"+(am?mmss(am*n):"—")+"</dd>"+
    TL("<dt>Formato</dt><dd>","<dt>Format</dt><dd>")+(m.fmt==="x"?TL("Cronometrado","Timed"):m.fmt==="d"?TL("Morte súbita","Sudden death"):TL("Treino","Practice"))+"</dd></dl>"+
    '<p class="small faint" style="margin:0">'+(m.fmt==="d"?TL("Todas as questões do banco, por ordem aleatória, com a resposta a seguir a cada uma. Ao ","Every question in the bank, in random order, with the answer after each one. At mistake ")+DEATH_MAX+TL(".º erro o desafio acaba na hora.",", the challenge ends on the spot."):m.fmt==="x"?TL("Sem respostas até ao fim e com o relógio a contar ","No answers until the end and the clock counting ")+mmss(ref)+TL(". Fica no histórico dos simulados.",". It goes into the practice exam history."):TL("Vês a resposta e a explicação a seguir a cada questão.","You see the answer and the explanation after each question."))+"</p>"+
    '<button class="btn primary big" data-act="mkgo"'+(n?"":" disabled")+TL(">Começar</button>",">Start</button>");
}
function vMontar(){
  var m=mkState();
  var dopts=TL('<option value="">Todos os domínios</option>','<option value="">All domains</option>')+D.domains.map(function(d){return '<option value="'+d.id+'"'+(m.d===String(d.id)?" selected":"")+">D"+d.id+" · "+esc(d.name)+" ("+d.w+"%)</option>";}).join("");
  var mopts=TL('<option value="">Qualquer módulo</option>','<option value="">Any module</option>')+mods().map(function(x){return '<option value="'+esc(x)+'"'+(m.m===x?" selected":"")+">"+esc(modName(x))+"</option>";}).join("");
  var st=[["all",TL("Todas","All")],["new",TL("Só novas","New only")],["wrong",TL("Só as que errei","Only the ones I got wrong")],["due",TL("Só revisões de hoje","Only today’s reviews")],["guess",TL("Só as que acertei por palpite","Only the ones I got right by guessing")],["seen",TL("Só as já vistas","Only the ones already seen")]].map(function(x){return '<option value="'+x[0]+'"'+(m.st===x[0]?" selected":"")+">"+x[1]+"</option>";}).join("");
  var dsc=m.d&&T&&T.domains[m.d]?'<p class="small muted" style="margin:-6px 0 16px">'+esc(T.domains[m.d].o)+"</p>":"";
  return TL('<div class="vh"><div><h1>Montar sessão</h1><p>Escolhe o que estudar, quantas questões e o formato. O tempo de referência segue o ritmo do exame real.</p></div></div><div class="build">','<div class="vh"><div><h1>Build a session</h1><p>Choose what to study, how many questions and the format. The reference time follows the real exam’s pace.</p></div></div><div class="build">')+
    '<section class="panel">'+bankFieldHTML("mk")+
    TL('<div class="field"><span>Formato</span><div class="seg fmtseg" role="group" aria-label="Formato"><button data-act="mkfmt" data-v="t" aria-pressed="','<div class="field"><span>Format</span><div class="seg fmtseg" role="group" aria-label="Format"><button data-act="mkfmt" data-v="t" aria-pressed="')+(m.fmt==="t")+TL('">Treino com respostas</button><button data-act="mkfmt" data-v="x" aria-pressed="','">Practice with answers</button><button data-act="mkfmt" data-v="x" aria-pressed="')+(m.fmt==="x")+TL('">Cronometrado, tipo exame</button>','">Timed, exam-style</button>')+'<button data-act="mkfmt" data-v="d" aria-pressed="'+(m.fmt==="d")+'">'+TL("Morte súbita","Sudden death")+"</button></div></div>"+
    (m.fmt==="d"?'<p class="mk-death">'+TL("Na morte súbita entram todas as ","Sudden death uses all ")+pool().length+TL(" questões do banco, por ordem aleatória, sem filtros. O desafio só acaba quando chegares ao fim do banco ou ao "," questions in the bank, in random order, with no filters. The challenge only ends when you reach the end of the bank or at mistake ")+DEATH_MAX+TL(".º erro.",".")+"</p>":(
    TL('<label class="field" for="mkD"><span>Domínio do blueprint</span><select id="mkD" data-act="mk" data-k="d">','<label class="field" for="mkD"><span>Blueprint domain</span><select id="mkD" data-act="mk" data-k="d">')+dopts+"</select></label>"+dsc+
    TL('<label class="field" for="mkS"><span>Tema</span><select id="mkS" data-act="mk" data-k="s"','<label class="field" for="mkS"><span>Topic</span><select id="mkS" data-act="mk" data-k="s"')+(m.d?"":" disabled")+">"+subOptions(m.d,m.s)+'</select><small>'+(m.d?TL("Os temas são os sub-tópicos do blueprint.","The topics are the blueprint’s subtopics."):TL("Escolhe primeiro um domínio.","Choose a domain first."))+"</small></label>"+
    TL('<label class="field" for="mkM"><span>Módulo do curso SNAF</span><select id="mkM" data-act="mk" data-k="m">','<label class="field" for="mkM"><span>SNAF course module</span><select id="mkM" data-act="mk" data-k="m">')+mopts+TL("</select><small>Aproximação: cada questão vai para o módulo do guia que melhor lhe corresponde.</small></label>","</select><small>Approximation: each question goes to the guide module that best matches it.</small></label>")+
    TL('<label class="field" for="mkSt"><span>Que questões</span><select id="mkSt" data-act="mk" data-k="st">','<label class="field" for="mkSt"><span>Which questions</span><select id="mkSt" data-act="mk" data-k="st">')+st+"</select></label>"+
    TL('<div class="field"><span>Número de questões</span><div class="range"><input type="range" id="mkN" min="5" max="60" step="5" value="','<div class="field"><span>Number of questions</span><div class="range"><input type="range" id="mkN" min="5" max="60" step="5" value="')+m.n+TL('" data-act="mkn" aria-label="Número de questões"><output id="mkNo" for="mkN">','" data-act="mkn" aria-label="Number of questions"><output id="mkNo" for="mkN">')+m.n+"</output></div></div>"))+"</section>"+
    '<section class="panel sum" id="mkSum">'+mkSummary()+"</section></div>";
}
function mkGo(){
  var m=mkState(),L=mkList();if(!L.length)return;
  var lab=m.fmt==="d"?TL("Banco completo","Full bank"):m.s?m.s:m.d?"D"+m.d+" · "+DN[m.d]:m.m?modName(m.m):TL("Sessão à medida","Custom session");
  var ids=interleave(shuffle(L.map(function(q){return q.id;})).slice(0,m.fmt==="d"?L.length:m.n));
  if(m.fmt==="x")startExam({ids:ids,min:ids.length*1.5,label:lab});
  else if(m.fmt==="d")startSession("death",lab+" · "+TL("Morte súbita","Sudden death"),ids);
  else startSession("custom",lab,ids);
}

/* ---------------- plano ---------------- */
function planCalc(){
  var dl=daysLeft(), strict=pool(false), U=0, W=0, revs=0, steps=0, acc=0;
  for(var b=2;b<=5;b++){acc+=ivDays(b);if(dl!=null&&acc<=dl)steps++;}
  steps=Math.max(1,steps);
  strict.forEach(function(q){var r=rec(q.id);if(!r||!r.n)U++;else if(!r.l)W++;else revs+=Math.max(0,Math.min(steps,5-(r.b||1)));});
  var attempts=U*(1+steps)+W*2+revs, mpq=minutesPerQ(), studyDays=Math.max(1,(dl||0)-1);
  var sims=dl==null?0:clamp(Math.ceil(dl/7),2,6), mins=attempts*mpq+sims*95, perDay=mins/studyDays;
  var buffer=Math.min(5,Math.floor(studyDays/4)), npd=U?Math.ceil(U/Math.max(1,studyDays-buffer)):0;
  return {dl:dl,U:U,W:W,revs:revs,steps:steps,attempts:attempts,mpq:mpq,sims:sims,mins:mins,perDay:perDay,npd:npd,studyDays:studyDays,buffer:buffer};
}
function hm(mins){mins=Math.round(mins);var h=Math.floor(mins/60),m=mins%60;return h?h+" h"+(m?" "+pad(m):""):m+" min";}
function vPlano(){
  var p=planCalc(), dl=p.dl, ts=examTs();
  var date=TL('<section class="panel"><p class="lbl">Data do exame</p><div class="datecard"><label class="field" for="examDate" style="margin:0"><span>Quando vais fazer o exame?</span><input type="date" id="examDate" data-act="examdate" value="','<section class="panel"><p class="lbl">Exam date</p><div class="datecard"><label class="field" for="examDate" style="margin:0"><span>When are you taking the exam?</span><input type="date" id="examDate" data-act="examdate" value="')+esc(S.cfg.examDate||"")+'" min="'+dkey()+'"></label>'+(dl!=null?'<div><div class="countdown">'+Math.max(0,dl)+TL('</div><span class="small muted">dias · ','</div><span class="small muted">days · ')+new Date(ts).toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long",year:"numeric"})+"</span></div>"+TL('<button class="link" data-act="examclear">Limpar a data</button>','<button class="link" data-act="examclear">Clear the date</button>'):"")+TL('</div><p class="small faint" style="margin:12px 0 0">A data fica guardada na tua conta. Depois de pagares a inscrição tens 90 dias para agendar e fazer o exame (blueprint oficial).</p></section>','</div><p class="small faint" style="margin:12px 0 0">The date is saved with your progress. After you pay the registration fee you have 90 days to schedule and take the exam (official blueprint).</p></section>');
  if(dl==null||dl<0)return TL('<div class="vh"><div><h1>Plano</h1><p>Marca a data do exame para a app calcular quanto estudar por dia e ajustar as revisões.</p></div></div><div class="stack">','<div class="vh"><div><h1>Plan</h1><p>Set the exam date so the app can work out how much to study per day and adjust the reviews.</p></div></div><div class="stack">')+date+TL('<section class="panel"><p class="lbl">O que muda com a data</p><ul class="rules"><li>As caixas de revisão passam a ter intervalos proporcionais ao tempo que falta: com muito tempo, as questões demoram mais a voltar; com pouco, voltam mais cedo.</li><li>Nas últimas duas semanas, as questões erradas podem ocupar até 40% de cada sessão (antes, 30%).</li><li>Recebes uma estimativa de horas por dia e de questões novas por dia para chegares a tempo.</li></ul></section></div>','<section class="panel"><p class="lbl">What the date changes</p><ul class="rules"><li>The review boxes get intervals proportional to the time left: with plenty of time, questions take longer to come back; with little, they come back sooner.</li><li>In the last two weeks, wrong questions can take up to 40% of each session (before that, 30%).</li><li>You get an estimate of hours per day and new questions per day to make it in time.</li></ul></section></div>');
  var ok=p.perDay<=120, cls=p.perDay<=60?"ok":p.perDay<=120?"wa":"no";
  var iv=TL('<table class="bp ptable"><thead><tr><th>Caixa</th><th class="r">Sem data</th><th class="r">Com a tua data</th></tr></thead><tbody>','<table class="bp ptable"><thead><tr><th>Box</th><th class="r">No date</th><th class="r">With your date</th></tr></thead><tbody>')+[2,3,4,5].map(function(b){return TL("<tr><td>Caixa ","<tr><td>Box ")+b+'</td><td class="r">'+INT[b]+' d</td><td class="r"><b>'+ivDays(b)+" d</b></td></tr>";}).join("")+"</tbody></table>";
  return TL('<div class="vh"><div><h1>Plano</h1><p>Calculado com o teu ritmo real e o que falta ver</p></div></div><div class="stack"><div class="grid2">','<div class="vh"><div><h1>Plan</h1><p>Calculated from your real pace and what’s left to see</p></div></div><div class="stack"><div class="grid2">')+date+
    TL('<section class="panel"><p class="lbl">Quanto estudar</p><div class="score"><span class="num">','<section class="panel"><p class="lbl">How much to study</p><div class="score"><span class="num">')+hm(p.perDay)+TL('</span><span class="muted">por dia, durante ','</span><span class="muted">per day, for ')+p.studyDays+TL(" dias</span></div>"," days</span></div>")+
    '<div class="verdict '+cls+'">'+(cls==="ok"?TL("<b>Ritmo confortável.</b> Cabe numa ou duas sessões por dia.","<b>Comfortable pace.</b> Fits in one or two sessions a day."):cls==="wa"?TL("<b>Exigente mas possível.</b> Planeia duas a quatro sessões de 25 minutos por dia.","<b>Demanding but doable.</b> Plan two to four 25-minute sessions a day."):TL("<b>Muito apertado.</b> Mais de duas horas por dia. Considera adiar a data ou focar nos domínios com mais peso.","<b>Very tight.</b> More than two hours a day. Consider moving the date or focusing on the domains with the most weight."))+"</div>"+
    '<div class="row" style="margin-top:16px"><button class="btn primary" data-act="applynpd" data-v="'+Math.max(5,p.npd)+TL('">Usar ','">Use ')+Math.max(5,p.npd)+TL(' novas por dia</button><span class="small faint">Agora: ',' new per day</button><span class="small faint">Now: ')+S.cfg.newPerDay+TL(" por dia</span></div></section></div>"," per day</span></div></section></div>")+
    TL('<div class="grid2"><section class="panel"><p class="lbl">De onde vem o número</p><div class="tbl"><table class="bp ptable"><tbody>','<div class="grid2"><section class="panel"><p class="lbl">Where the number comes from</p><div class="tbl"><table class="bp ptable"><tbody>')+
      TL("<tr><td>Questões por ver</td><td class=\"r\">","<tr><td>Questions not seen yet</td><td class=\"r\">")+p.U+"</td></tr>"+
      TL("<tr><td>Cada nova é vista mais <b>","<tr><td>Each new one is seen <b>")+p.steps+TL("</b> vezes até ao exame (revisões que cabem no tempo)</td><td class=\"r\">","</b> more times before the exam (reviews that fit in the time)</td><td class=\"r\">")+p.U*(1+p.steps)+"</td></tr>"+
      TL("<tr><td>Erradas por consolidar (×2)</td><td class=\"r\">","<tr><td>Wrong ones to consolidate (×2)</td><td class=\"r\">")+p.W*2+"</td></tr>"+
      TL("<tr><td>Revisões das que já acertaste</td><td class=\"r\">","<tr><td>Reviews of the ones you already got right</td><td class=\"r\">")+p.revs+"</td></tr>"+
      TL("<tr><td><b>Respostas no total</b></td><td class=\"r\"><b>","<tr><td><b>Total answers</b></td><td class=\"r\"><b>")+p.attempts+"</b></td></tr>"+
      TL("<tr><td>Minutos por questão, com explicações (","<tr><td>Minutes per question, with explanations (")+(minutesPerQ()===1.2?TL("estimativa inicial","initial estimate"):TL("medido nas tuas sessões","measured in your sessions"))+")</td><td class=\"r\">"+fmt1(p.mpq)+"</td></tr>"+
      TL("<tr><td>Simulados recomendados (um por semana, 90 min + revisão)</td><td class=\"r\">","<tr><td>Recommended practice exams (one a week, 90 min + review)</td><td class=\"r\">")+p.sims+"</td></tr>"+
      TL("<tr><td><b>Total</b></td><td class=\"r\"><b>","<tr><td><b>Total</b></td><td class=\"r\"><b>")+hm(p.mins)+"</b></td></tr>"+
    TL('</tbody></table></div><p class="small faint" style="margin:12px 0 0">As novas devem ficar vistas ','</tbody></table></div><p class="small faint" style="margin:12px 0 0">The new ones should all be seen ')+p.buffer+TL(" dias antes do exame, para os últimos dias serem só revisões e simulados.</p></section>"," days before the exam, so the last days are just reviews and practice exams.</p></section>")+
    TL('<section class="panel"><p class="lbl">Revisões ajustadas à data</p>','<section class="panel"><p class="lbl">Reviews adjusted to the date</p>')+iv+TL('<p class="small faint" style="margin:12px 0 0">Fator ','<p class="small faint" style="margin:12px 0 0">Factor ')+fmt1(ivFactor())+TL(" sobre os intervalos base, com teto de "," on the base intervals, capped at ")+Math.max(1,Math.floor(dl/3))+TL(" dias para tudo voltar pelo menos três vezes antes do exame. Erradas: até "," days so everything comes back at least three times before the exam. Wrong ones: up to ")+Math.round(wrongCap()*100)+TL("% de cada sessão.</p></section></div>","% of each session.</p></section></div>")+
    TL('<section class="panel"><div class="phead"><p class="lbl">Chegas a tempo?</p><a class="link" href="#progresso">Ver evolução</a></div>','<section class="panel"><div class="phead"><p class="lbl">Will you make it?</p><a class="link" href="#progresso">See evolution</a></div>')+etaHTML()+"</section></div>";
}

/* ---------------- o exame ---------------- */
function vExame(){
  var BP="https://learning.servicenow.com/lxp/en/credentials/certified-system-administrator-mainline-exam-blueprint?id=kb_article_view&sysparm_article=KB0011554";
  var rows=D.domains.map(function(d){return "<tr><td>D"+d.id+" · "+esc(d.name)+'<div class="small faint">'+d.subs.map(esc).join(" · ")+'</div></td><td class="r">'+d.w+'%</td><td class="r">~'+Math.round(60*d.w/100)+"</td></tr>";}).join("");
  return TL('<div class="vh"><div><h1>O exame CSA</h1><p>Informação oficial do blueprint da ServiceNow (KB0011554, atualizado em janeiro de 2026) e dicas para o dia</p></div><a class="btn" href="','<div class="vh"><div><h1>The CSA exam</h1><p>Official information from the ServiceNow blueprint (KB0011554, updated in January 2026) and tips for the day</p></div><a class="btn" href="')+BP+TL('" target="_blank" rel="noopener">Abrir o blueprint oficial</a></div><div class="stack">','" target="_blank" rel="noopener">Open the official blueprint</a></div><div class="stack">')+
    TL('<section class="facts"><div><b>60</b><span>questões</span></div><div><b>90 min</b><span>de duração (1:30 por questão)</span></div><div><b>1 ponto</b><span>por questão, sem crédito parcial</span></div><div><b>Não público</b><span>corte para passar, nem sempre 70%</span></div><div><b>90 dias</b><span>para agendar e fazer depois de pagar</span></div></section>','<section class="facts"><div><b>60</b><span>questions</span></div><div><b>90 min</b><span>long (1:30 per question)</span></div><div><b>1 point</b><span>per question, no partial credit</span></div><div><b>Not public</b><span>cut score to pass, not always 70%</span></div><div><b>90 days</b><span>to schedule and take it after paying</span></div></section>')+
    TL('<div class="grid2"><section class="panel"><p class="lbl">Tipos de questão</p><ul class="rules"><li><b>Escolha múltipla (uma resposta):</b> pelo menos três opções; escolhes uma.</li><li><b>Seleção múltipla:</b> pelo menos quatro opções; a questão diz quantas escolher e tens de acertar todas. Não há crédito parcial.</li></ul>','<div class="grid2"><section class="panel"><p class="lbl">Question types</p><ul class="rules"><li><b>Multiple choice (one answer):</b> at least three options; you choose one.</li><li><b>Multiple select:</b> at least four options; the question says how many to choose and you have to get them all right. There’s no partial credit.</li></ul>')+
      TL('<p class="lbl" style="margin-top:20px">Resultado</p><ul class="rules"><li>Vês logo no fim um resultado <b>condicional</b> (passou/não passou). Pode ser auditado e a certificação revogada se houver violação das regras de segurança do teste.</li><li>O relatório mostra a percentagem certa em cada secção. Essas percentagens não decidem o resultado e não se fazem médias com elas.</li><li>Se passares: certificação CSA e badge digital na Credly.</li><li>Para manter: exames de manutenção anuais (deltas) e a taxa anual do Certification Maintenance Program (CMP).</li></ul></section>','<p class="lbl" style="margin-top:20px">Result</p><ul class="rules"><li>You see a <b>conditional</b> result (pass/fail) right at the end. It may be audited and the certification revoked if the test security rules were violated.</li><li>The report shows the percentage correct in each section. Those percentages don’t decide the result and aren’t averaged.</li><li>If you pass: CSA certification and a digital badge on Credly.</li><li>To keep it: annual maintenance exams (deltas) and the annual Certification Maintenance Program (CMP) fee.</li></ul></section>')+
    TL('<section class="panel"><p class="lbl">Inscrição, passo a passo</p><ol class="steps"><li><span><b>Registar = pagar.</b> Aceita learning credits e cartão. A formação com instrutor inclui uma tentativa grátis. A taxa não é reembolsável.</span></li><li><span><b>Agendar dentro de 90 dias.</b> Se não fizeres o exame nesse prazo, a inscrição expira e pagas de novo.</span></li><li><span><b>Escolher como fazer:</b> num centro de testes Pearson ou online com o OnVUE, com um vigilante a ver pela webcam.</span></li><li><span><b>Fazer o exame.</b> Há adaptações para pessoas com deficiência e para quem tem o inglês como segunda língua (ESL); pede-as ao agendar.</span></li></ol>','<section class="panel"><p class="lbl">Registration, step by step</p><ol class="steps"><li><span><b>Registering = paying.</b> Learning credits and card are accepted. Instructor-led training includes one free attempt. The fee is non-refundable.</span></li><li><span><b>Schedule within 90 days.</b> If you don’t take the exam within that window, the registration expires and you pay again.</span></li><li><span><b>Choose how to take it:</b> at a Pearson test center or online with OnVUE, with a proctor watching through the webcam.</span></li><li><span><b>Take the exam.</b> There are accommodations for people with disabilities and for those with English as a second language (ESL); request them when scheduling.</span></li></ol>')+
      TL('<p class="note">Preço e regras de repetição não estão no blueprint: estão no Credentialing Program Guide. Posts de 2026 na comunidade ServiceNow falam em 300 USD por exame e 150 USD por nova tentativa, com esperas entre tentativas. Não é fonte oficial: confirma antes de pagar.</p></section></div>','<p class="note">Price and retake rules aren’t in the blueprint: they’re in the Credentialing Program Guide. 2026 posts in the ServiceNow community mention 300 USD per exam and 150 USD per retake, with waits between attempts. Not an official source: check before paying.</p></section></div>')+
    TL('<div class="grid2"><section class="panel"><p class="lbl">Distribuição por domínio</p><div class="tbl"><table class="bp"><thead><tr><th>Domínio e temas</th><th class="r">Peso</th><th class="r">Questões</th></tr></thead><tbody>','<div class="grid2"><section class="panel"><p class="lbl">Distribution by domain</p><div class="tbl"><table class="bp"><thead><tr><th>Domain and topics</th><th class="r">Weight</th><th class="r">Questions</th></tr></thead><tbody>')+rows+TL('</tbody></table></div><p class="note">A lista de temas não é exaustiva, segundo a própria ServiceNow.</p></section>','</tbody></table></div><p class="note">The list of topics isn’t exhaustive, according to ServiceNow itself.</p></section>')+
    TL('<section class="panel"><p class="lbl">Preparação recomendada pela ServiceNow</p><ul class="rules"><li>Cursos <b>Welcome to ServiceNow</b> e <b>ServiceNow Administration Fundamentals</b>.</li><li>As questões baseiam-se nos materiais oficiais de formação e na documentação de produto.</li><li>Experiência recomendada: 3 a 6 meses a usar ou manter uma instância, noções de bases de dados e de processos de Service Desk (incident, problem, change).</li><li>Simulados oficiais: MeasureUp (KB0013408).</li><li>A ServiceNow avisa que materiais publicados noutros sítios não são oficiais. O teu banco de questões é um deles: usa a documentação oficial (as notas «Porquê» da app) para confirmar.</li></ul></section></div>','<section class="panel"><p class="lbl">Preparation recommended by ServiceNow</p><ul class="rules"><li>The <b>Welcome to ServiceNow</b> and <b>ServiceNow Administration Fundamentals</b> courses.</li><li>The questions are based on the official training materials and the product documentation.</li><li>Recommended experience: 3 to 6 months using or maintaining an instance, basic database knowledge and Service Desk processes (incident, problem, change).</li><li>Official practice exams: MeasureUp (KB0013408).</li><li>ServiceNow warns that materials published elsewhere aren’t official. Your question bank is one of them: use the official documentation (the app’s «Why» notes) to confirm.</li></ul></section></div>')+
    TL('<section class="panel"><p class="lbl">Dicas para o dia do exame</p><div class="tips">','<section class="panel"><p class="lbl">Tips for exam day</p><div class="tips">')+
      TL('<div><h3>Gere o relógio</h3>A 1:30 por questão, ao fim de 30 minutos deves ir na 20. Se uma questão te prende mais de 2 minutos, responde o melhor que conseguires, marca e segue.</div>','<div><h3>Manage the clock</h3>At 1:30 per question, after 30 minutes you should be on question 20. If a question holds you up for more than 2 minutes, give your best answer, mark it and move on.</div>')+
      TL('<div><h3>Não deixes nenhuma em branco</h3>Cada questão vale um ponto e uma em branco conta como errada. Um palpite informado é sempre melhor.</div>','<div><h3>Don’t leave any blank</h3>Each question is worth one point and a blank one counts as wrong. An informed guess is always better.</div>')+
      TL('<div><h3>Lê o «Choose two/three»</h3>A seleção múltipla diz quantas escolher e não dá crédito parcial. Confirma o número antes de avançar.</div>','<div><h3>Read the «Choose two/three»</h3>Multiple select says how many to choose and gives no partial credit. Check the number before moving on.</div>')+
      TL('<div><h3>Elimina primeiro</h3>Risca mentalmente as opções com nomes inventados ou caminhos de menu que não existem (ex.: <i>requests.list</i>). Muitas vezes sobram duas.</div>','<div><h3>Eliminate first</h3>Mentally cross out the options with made-up names or menu paths that don’t exist (e.g. <i>requests.list</i>). Often two are left.</div>')+
      TL('<div><h3>Nomes antigos e novos</h3>O exame pode usar nomes antigos: Flow Designer (agora Workflow Studio), UI16 (agora Core UI), Report Designer. A ideia é a mesma.</div>','<div><h3>Old and new names</h3>The exam may use old names: Flow Designer (now Workflow Studio), UI16 (now Core UI), Report Designer. The idea is the same.</div>')+
      TL('<div><h3>Volta às marcadas no fim</h3>Guarda 10 minutos para as marcadas. Muda uma resposta só se encontrares uma razão concreta, não por dúvida.</div>','<div><h3>Go back to the marked ones at the end</h3>Keep 10 minutes for the marked ones. Change an answer only if you find a concrete reason, not out of doubt.</div>')+
      TL('<div><h3>Se for online (OnVUE)</h3>Prepara a sala e testa o computador e a webcam antes do dia. Segue as instruções da Pearson para o check-in.</div>','<div><h3>If it’s online (OnVUE)</h3>Prepare the room and test your computer and webcam before the day. Follow Pearson’s check-in instructions.</div>')+
      TL('<div><h3>Antes de marcar</h3>Na app: índice de confiança 8 ou mais e 80% em três simulados seguidos. O D5 vale 30%: não vás sem o dominar.</div>','<div><h3>Before you book</h3>In the app: confidence index of 8 or more and 80% in three practice exams in a row. D5 is worth 30%: don’t go without mastering it.</div>')+
    TL('</div><p class="note">As dicas são minhas, com base nas regras do blueprint. Os factos acima vêm do <a href="','</div><p class="note">The tips are mine, based on the blueprint rules. The facts above come from the <a href="')+BP+TL('" target="_blank" rel="noopener">blueprint oficial KB0011554</a>.</p></section></div>','" target="_blank" rel="noopener">official blueprint KB0011554</a>.</p></section></div>');
}

/* ---------------- eventos ---------------- */
document.addEventListener("click",function(ev){
  if(ev.target.closest('.tabs a[data-tab="labs"]')&&ui.lab){ui.lab=null;if(view==="labs")render();}
  var el=ev.target.closest("[data-act]");
  if(!$("pop").hidden&&!ev.target.closest("#pop")&&!ev.target.closest("#pomoBtn"))togglePop(false);
  if(!el)return;
  var a=el.dataset.act,v=el.dataset.v;
  switch(a){
    case "pomopop":togglePop();break;
    case "pomostart":pomoStart();$("toast").hidden=true;break;
    case "pomopause":pomoPause();break;
    case "pomoskip":pomoDone(true);break;
    case "pomoreset":pomoReset();break;
    case "pomocfg":if(S.pomo.mode==="idle"||!S.pomo.running){S.cfg.pomo=v;if(S.pomo.mode==="focus"&&!S.pomo.running)S.pomo.remain=pc().f*60e3;saveLocal();paintPomo();renderPop();}else toast(TL("Muda o ritmo quando o temporizador estiver parado.","Change the rhythm when the timer is stopped."));break;
    case "start":startMode(v);break;
    case "redo":startMode("redo");break;
    case "theme":setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");break;
    case "themeset":setTheme(v);break;
    case "lang":if(v!==LANG)setLang(v);break;
    case "exportp":exportProgress();break;
    case "impgo":applyImport();break;
    case "impno":ui.imp=null;render();break;
    case "lbjoin":lbSaveName();break;
    case "lbrename":ui.lbRename=true;render();var ln=$("lbName");if(ln)ln.focus();break;
    case "lbcancel":ui.lbRename=false;ui.armed=null;render();break;
    case "lbleave":ui.armed="lbleave";render();break;
    case "lbleavego":lbSetHidden(true);break;
    case "lbshow":lbSetHidden(false);break;
    case "lbprof":lbOpenProfile(v);break;
    case "rktab":(ui.rk||(ui.rk={tab:"bad",d:""})).tab=v;render();break;
    case "rktrain":var rl=Array.prototype.map.call(document.querySelectorAll("details.rk .qid"),function(x){return x.textContent;});var rids=pool(false).filter(function(q){return rl.indexOf(q.label||("Question "+q.id))>=0;}).map(function(q){return q.id;});startSession("rank",TL("Ranking: mais erradas","Ranking: most missed"),shuffle(rids));break;
    case "mkfmt":mkState().fmt=v;render();break;
    case "bank":S.cfg.bank=v;saveLocal();render();break;
    case "mkgo":mkGo();break;
    case "examclear":S.cfg.examDate="";S.cfg.exT=Date.now();ui.smartCache=null;markDirty("p");render();break;
    case "applynpd":S.cfg.newPerDay=+v;ui.smartCache=null;saveLocal();render();toast(TL("Agora entram ","Now ")+v+TL(" questões novas por dia."," new questions come in per day."));break;
    case "opt":toggleOpt(+v);break;
    case "conf":verify(v);break;
    case "next":next();break;
    case "endsess":ui.peek=null;S.sess.q=S.sess.q.slice(0,S.sess.i);if(!S.sess.q.length)S.sess=null;saveLocal();render();break;
    case "newsess":ui.peek=null;S.sess=null;ui.smartCache=null;saveLocal();render();break;
    case "prevq":prevQ();break;
    case "peeknext":peekNext();break;
    case "peekcur":ui.peek=null;render();window.scrollTo({top:0});break;
    case "peekfirst":if(S.sess&&S.sess.q.length){ui.peek=0;render();window.scrollTo({top:0});}break;
    case "explain":explain(+el.dataset.id,el.dataset.ch?el.dataset.ch.split(","):[],!!exCache()[exKey(el.dataset.id)]);break;
    case "stopx":if(ui.ctl)ui.ctl.abort();break;
    case "labopen":ev.preventDefault();ui.lab=v;if(view!=="labs")location.hash="#labs";else{render();window.scrollTo(0,0);}break;
    case "labback":ev.preventDefault();ui.lab=null;render();window.scrollTo(0,0);break;
    case "shotdel":shotDelete(v);break;
    case "exam":startExam();break;
    case "eopt":examToggle(+v);break;
    case "eprev":examGo(-1);break;
    case "enext":if(S.exam&&S.exam.i>=S.exam.q.length-1){examTick();ui.examConfirm=true;saveLocal();render();window.scrollTo({top:0});}else examGo(1);break;
    case "emark":examMark();break;
    case "egrid":ui.examGrid=!ui.examGrid;render();break;
    case "htab":ui.histTab=v;render();break;
    case "ejump":examTick();S.exam.i=+v;ui.examConfirm=false;saveLocal();render();break;
    case "efinish":ui.examConfirm=true;render();window.scrollTo({top:0});break;
    case "enofin":ui.examConfirm=false;render();break;
    case "edone":finishExam();break;
    case "seeres":ui.resultAt=+v;render();window.scrollTo(0,0);break;
    case "backsim":ui.resultAt=null;render();break;
    case "trainwrong":var r=S.exams.filter(function(e){return e.at===+v;})[0];if(r)startSession("exam",TL("Erros do simulado","Practice exam mistakes"),exStats(r).wrongA);break;
    case "trainmod":trainMod(v);break;
    case "trainsub":startSession("dom",v,shuffle(pool().filter(function(q){return q.sub===v;}).map(function(q){return q.id;})).slice(0,ui.size>=999?99999:ui.size));break;
    case "reset":ui.armed="reset";render();break;
    case "resetno":ui.armed=null;render();break;
    case "resetgo":var keep={cfg:S.cfg,pomo:S.pomo};S=blank();S.cfg=keep.cfg;S.pomo=keep.pomo;ui.armed=null;try{localStorage.removeItem(OLDKEY);localStorage.removeItem(EXKEY);}catch(e){}markDirty("p");markDirty("d");markDirty("e");if(sync.db)logMonths().forEach(function(m){ref("log-"+m).set({l:[]}).catch(function(){});});render();toast(TL("Progresso apagado.","Progress deleted."));break;
  }
});
document.addEventListener("change",function(ev){
  var el=ev.target,a=el.dataset.act;
  if(a==="size"){ui.size=+el.value;}
  else if(a==="newpd"){S.cfg.newPerDay=+el.value;ui.smartCache=null;saveLocal();render();}
  else if(a==="sessmax"){S.cfg.sessMax=+el.value;ui.smartCache=null;saveLocal();render();}
  else if(a==="mk"){var mk=mkState();mk[el.dataset.k]=el.value;if(el.dataset.k==="d")mk.s="";render();}
  else if(a==="rkd"){(ui.rk||(ui.rk={tab:"bad",d:""})).d=el.value;render();}
  else if(a==="examdate"){S.cfg.examDate=el.value||"";S.cfg.exT=Date.now();ui.smartCache=null;markDirty("p");render();}
  else if(a==="dep"){S.cfg.dep=el.checked;saveLocal();render();}
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&!$("pop").hidden){togglePop(false);return;}
  if(e.key==="Enter"&&e.target.id==="lbName"){e.preventDefault();lbSaveName();return;}
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
  var k=e.key.toLowerCase();
  if(view==="treino"&&S.sess&&ui.peek!=null){
    if(k==="arrowleft"){prevQ();e.preventDefault();}
    else if(k==="arrowright"||(k==="enter"&&e.target.tagName!=="BUTTON")){peekNext();e.preventDefault();}
    return;
  }
  if(view==="treino"&&curQ()){
    if(k==="arrowleft"){prevQ();e.preventDefault();return;}
    if(!ui.done){
      if(/^[1-9]$/.test(k)){toggleOpt(optAt(curQ(),+k-1));e.preventDefault();}
      else if(k==="c")verify("s"); else if(k==="a")verify("a"); else if(k==="p")verify("p"); else if(k==="n")verify("n");
      else if(k==="enter"&&curQ()&&ui.sel.length===curQ().ans.length){verify("a");e.preventDefault();}
    }else if(k==="enter"||k==="arrowright"){if(e.target.tagName==="BUTTON"&&e.target.dataset.act!=="next"&&k==="enter")return;next();e.preventDefault();}
  }else if(view==="simulado"&&S.exam){
    if(/^[1-9]$/.test(k))examToggle(optAt(exQ(),+k-1)); else if(k==="arrowright")examGo(1); else if(k==="arrowleft")examGo(-1); else if(k==="m")examMark();
  }
});
function route(){var t=(location.hash||"#hoje").slice(1);view=["hoje","treino","montar","simulado","progresso","ranking","global","plano","exame","labs","conta","sobre","novidades"].indexOf(t)>=0?t:"hoje";if(view==="global")ui.lbRows=null;render();}
document.addEventListener("input",function(ev){var el=ev.target;if(el.dataset.act==="mkn"){mkState().n=+el.value;var o=$("mkNo");if(o)o.textContent=el.value;var sm=$("mkSum");if(sm)sm.innerHTML=mkSummary();}});
document.addEventListener("toggle",function(ev){var t=ev.target;if(t.classList&&t.classList.contains("topic")){try{localStorage.setItem("csa2-topic",t.open?"1":"0");}catch(e){}}},true);
function donutTip(ev){
  var seg=ev.target.closest&&ev.target.closest(".donut [data-seg]");
  document.querySelectorAll(".donut.hl").forEach(function(d){if(!seg||d!==seg.closest(".donut")){d.classList.remove("hl");d.querySelectorAll(".on").forEach(function(e){e.classList.remove("on");});var t=d.querySelector(".dtip");if(t)t.hidden=true;}});
  if(!seg)return;
  var dn=seg.closest(".donut"),tip=dn.querySelector(".dtip"),i=seg.dataset.seg;
  dn.classList.add("hl");dn.querySelectorAll("[data-seg]").forEach(function(e){e.classList.toggle("on",e.dataset.seg===i);});
  var s=seg.dataset;
  tip.innerHTML='<div class="th"><i style="background:'+esc(s.c)+'"></i>'+esc(s.n)+'</div><div class="tv">'+s.v+'<small>'+s.p+TL('% do total</small></div>','% of the total</small></div>')+(s.d?"<p>"+esc(s.d)+"</p>":"");
  tip.hidden=false;
  var b=dn.getBoundingClientRect(),x=ev.clientX-b.left+14,y=ev.clientY-b.top+14,w=tip.offsetWidth,h=tip.offsetHeight;
  if(x+w>b.width)x=Math.max(0,ev.clientX-b.left-w-14);
  if(y+h>b.height+40)y=Math.max(-10,ev.clientY-b.top-h-14);
  tip.style.left=x+"px";tip.style.top=y+"px";
}
document.addEventListener("pointerdown",donutTip);
document.addEventListener("mousemove",function(ev){
  donutTip(ev);
  var h=ev.target.closest&&ev.target.closest(".evo .hit"),tip=$("evoTip");if(!tip)return;
  if(!h||!ui.evo){tip.hidden=true;return;}
  var p=ui.evo.arr[+h.dataset.i];if(!p){tip.hidden=true;return;}
  var box=$("evo").getBoundingClientRect(),x=ev.clientX-box.left;
  tip.innerHTML="<b>"+new Date(p.t).toLocaleDateString(LOC(),{weekday:"short",day:"numeric",month:"short"})+TL("</b><div><span><i style=\"background:var(--s1)\"></i>Acerto 7 d</span><span>","</b><div><span><i style=\"background:var(--s1)\"></i>Accuracy 7 d</span><span>")+(p.acc==null?"—":Math.round(p.acc)+"%")+TL("</span></div><div><span><i style=\"background:var(--s2)\"></i>Banco visto</span><span>","</span></div><div><span><i style=\"background:var(--s2)\"></i>Bank seen</span><span>")+Math.round(p.cov)+TL("%</span></div><div><span><i style=\"background:var(--s3)\"></i>Índice</span><span>","%</span></div><div><span><i style=\"background:var(--s3)\"></i>Index</span><span>")+(p.sc==null?"—":fmt1(p.sc/10))+TL("</span></div><div><span>Respondidas</span><span>","</span></div><div><span>Answered</span><span>")+p.q+"</span></div>";
  tip.hidden=false;tip.style.left=Math.max(0,Math.min(box.width-170,x+12))+"px";tip.style.top="8px";
});
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem("csa2-theme",t);}catch(e){}var b=$("themeBtn"),l=$("themeLbl");if(b)b.setAttribute("aria-label",t==="dark"?TL("Mudar para tema claro","Switch to light theme"):TL("Mudar para tema escuro","Switch to dark theme"));if(l)l.textContent=t==="dark"?TL("Tema escuro","Dark theme"):TL("Tema claro","Light theme");document.querySelectorAll('[data-act="themeset"]').forEach(function(x){x.setAttribute("aria-pressed",x.dataset.v===t?"true":"false");});}
function setTopH(){var tp=$("top");document.documentElement.style.setProperty("--toph",(window.innerWidth<1000&&tp?tp.offsetHeight:0)+"px");}
window.addEventListener("resize",setTopH);
window.addEventListener("hashchange",function(){route();window.scrollTo(0,0);});
setInterval(function(){
  var P=S.pomo;if(P.running&&Date.now()>=P.endsAt)pomoDone(false);
  if(P.mode!=="idle")paintPomo();
  paintQClock();
  if(S.exam){if(Date.now()>=S.exam.ends){finishExam();toast(TL("O tempo acabou. O simulado foi entregue.","Time’s up. The practice exam has been submitted."));}else paintExamTop();}
},500);

/* ---------------- arranque ---------------- */
(function(){var t="light";try{t=localStorage.getItem("csa2-theme")||"light";}catch(e){}setTheme(t);})();
paintShell();
setTopH();
paintPomo();
fetch("topics.json").then(function(r){return r.ok?r.json():null;}).then(function(x){if(x){T_PT=x;T=x;applyContent();if(D)render();}}).catch(function(){});
fetch("en.json").then(function(r){return r.ok?r.json():null;}).then(function(x){if(x){EN=x;LABS_EN=null;applyContent();if(D&&LANG==="en")render();}}).catch(function(){});
fetch("data.json").then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
  D=d; d.questions.forEach(function(q){Q[q.id]=q;}); d.domains.forEach(function(x){W[x.id]=x.w;DN[x.id]=x.name;}); applyContent();
  if(S.sess&&S.sess.q)S.sess.q=S.sess.q.filter(function(id){return Q[id];});
  route();
  if(window.CSA_BACKEND)window.CSA_BACKEND.lbMine().then(function(r){ui.lbMine=r;ui.lbReady=1;if(r||lbAnswers())lbPush().catch(function(e){ui.lbErr=e||1;if(view==="global")render();});else if(view==="global")render();}).catch(function(e){ui.lbErr=e||1;if(view==="global")render();});
}).catch(function(){
  $("view").innerHTML=TL('<div class="vh"><h1>Treino CSA</h1></div><div class="empty"><b>Não consegui carregar as questões</b>O ficheiro de dados não respondeu. Recarrega a página.</div>','<div class="vh"><h1>CSA Trainer</h1></div><div class="empty"><b>Couldn’t load the questions</b>The data file didn’t respond. Reload the page.</div>');
});
fetch("labs.json").then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(x){
  LABS_PT={}; x.labs.forEach(function(lb){LABS_PT[lb.id]=lb;}); LABS=LABS_PT; LMAP=x.map; applyContent(); if(D)render();
}).catch(function(){});
document.addEventListener("change",function(ev){
  var t=ev.target;
  if(t.dataset&&t.dataset.shot){shotUpload(t.dataset.shot,t.files&&t.files[0]);t.value="";}
  else if(t.dataset&&t.dataset.import){readImport(t.files&&t.files[0]);t.value="";}
  else if(t.dataset&&t.dataset.done){if(t.checked)LS.done[t.dataset.done]=Date.now();else delete LS.done[t.dataset.done];saveLabs(true);if(view==="labs"&&!ui.lab)render();}
});
initSync();
if(window.claude&&window.claude.use){window.claude.use("assets").then(function(a){if(a){ui.assets=a;if(D)render();}}).catch(function(){});}
if(window.claude&&window.claude.use){window.claude.use("downloads").then(function(d){if(d){ui.downloads=d;if(D&&view==="progresso")render();}}).catch(function(){});}
if(window.claude&&window.claude.use){window.claude.use("sample").then(function(s){if(s){ui.sample=s;if(D&&(view==="treino"||view==="simulado"))render();}}).catch(function(){});}
})();
