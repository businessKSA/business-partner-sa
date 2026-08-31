import fs from 'node:fs';
import path from 'node:path';

// المستشار الذكي للمستندات داخل بوابة العميل — لا صفحة منفصلة ولا شراء.
// طبقة ما بعد البناء على نمط client-portal-v6: تحقن زر تنقّل وعرضاً كاملاً
// بمفردات التصميم الجديد، فيستخدم العميل الخدمة من مكانه المعتاد. الوصول
// مربوط بتجربة أربعة عشر يوماً تبدأ من أول استخدام (الخادم يقرّر، لا الواجهة).
const targets = ['site/ar/account.html', 'site/account.html']
  .map((p) => path.resolve(p)).filter((p) => fs.existsSync(p));
if (!targets.length) process.exit(0);

const css = String.raw`<style id="bp-docagent-v7-css">
:root{--da7-navy:#07163f;--da7-blue:#3159d8;--da7-cyan:#43d6f4;--da7-line:#e3e8f1;--da7-ink:#111b35;--da7-muted:#6c7891}
.da7{display:none}.da7.on{display:block}
.da7-trial{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#07163f,#123c91);color:#fff;border-radius:18px;padding:14px 18px;margin-bottom:16px}
.da7-trial b{font-size:14px}.da7-trial p{margin:3px 0 0;font-size:11.5px;color:rgba(255,255,255,.75);line-height:1.7}
.da7-trial .days{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:800;white-space:nowrap}
.da7-trial.ended{background:linear-gradient(135deg,#5b1120,#a32036)}
.da7-trial a{display:inline-flex;padding:8px 13px;background:#fff;color:#123b87;border-radius:10px;text-decoration:none;font-size:11.5px;font-weight:900}
.da7-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}
@media(max-width:1020px){.da7-grid{grid-template-columns:1fr}}
.da7-box{background:#fff;border:1px solid var(--da7-line);border-radius:19px;padding:18px;box-shadow:0 8px 28px rgba(11,34,90,.05)}
.da7-box h3{font-size:14px;color:var(--da7-navy);margin:0 0 4px}
.da7-box .hint{font-size:11.5px;color:var(--da7-muted);margin:0 0 12px;line-height:1.8}
.da7-log{height:390px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:4px 2px;margin-bottom:12px}
.da7-m{max-width:86%;padding:10px 13px;border-radius:14px;font-size:12.5px;line-height:1.85;white-space:pre-wrap;word-break:break-word}
.da7-m.bot{background:#f4f7fd;border:1px solid var(--da7-line);color:var(--da7-ink);align-self:flex-start;border-bottom-right-radius:5px}
.da7-m.me{background:linear-gradient(135deg,#0a255f,#3159d8);color:#fff;align-self:flex-end;border-bottom-left-radius:5px}
.da7-m.sys{align-self:center;background:#fff8e7;border:1px dashed #e6c98a;color:#7a5a12;font-size:11px}
.da7-m a{color:inherit;font-weight:900;text-decoration:underline}
.da7-m.bot a{color:#2148a8}
.da7-row{display:flex;gap:8px;align-items:center}
.da7-row input[type=text]{flex:1;min-width:0;padding:11px 13px;border:1px solid var(--da7-line);border-radius:12px;font-family:inherit;font-size:12.5px;background:#fbfcfe}
.da7-row input[type=text]:focus{outline:0;border-color:var(--da7-blue);background:#fff}
.da7-btn{border:0;cursor:pointer;font-family:inherit;font-weight:800;font-size:12px;border-radius:11px;padding:11px 15px;background:linear-gradient(135deg,#0a255f,#3159d8);color:#fff}
.da7-btn.ghost{background:#eef3ff;color:#2148a8}
.da7-btn.clip{background:#fff;border:1px solid var(--da7-line);color:var(--da7-navy);padding:11px 13px}
.da7-btn[disabled]{opacity:.5;cursor:not-allowed}
.da7-sig{border:1px solid var(--da7-line);border-radius:14px;padding:12px;background:#fbfcff}
.da7-sig canvas{width:100%;height:150px;display:block;border:1.5px dashed #c3d2ee;border-radius:11px;background:#fff;touch-action:none;cursor:crosshair}
.da7-consent{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:11.5px;color:var(--da7-ink);line-height:1.75;cursor:pointer}
.da7-consent input{margin-top:2px;flex:0 0 auto}
.da7-mark{margin-top:9px;font-size:11.5px;color:var(--da7-muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.da7-mark.on{color:#127a4b;font-weight:800}
.da7-mark img{height:34px;border:1px solid var(--da7-line);border-radius:7px;background:#fff;padding:2px}
.da7-drop{border:1.5px dashed #c3d2ee;border-radius:15px;background:#fbfcff;padding:17px;text-align:center;color:var(--da7-muted);font-size:12px;cursor:pointer;transition:.15s}
.da7-drop:hover,.da7-drop.over{border-color:var(--da7-blue);background:#f2f6ff;color:#2148a8}
.da7-files{display:flex;flex-direction:column;gap:7px;margin-top:11px}
.da7-file{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-bottom:1px solid #eef1f6;padding-bottom:7px}
.da7-file:last-child{border-bottom:0}
.da7-file strong{font-size:12px;color:var(--da7-ink);font-weight:700;word-break:break-all}
.da7-file small{display:block;color:var(--da7-muted);font-size:10.5px;margin-top:2px}
.da7-tag{border-radius:999px;padding:4px 9px;font-size:10px;font-weight:800;white-space:nowrap}
.da7-tag.form{background:#e7f0ff;color:#1f49b3}.da7-tag.src{background:#e7f7ee;color:#12704a}
.da7-tag.other{background:#f1f3f7;color:#5b6478}.da7-tag.out{background:#fdeee7;color:#a84515}
.da7-empty{padding:16px;text-align:center;color:var(--da7-muted);font-size:11.5px}
.da7-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.da7-stat{flex:1;min-width:88px;background:#f7f9fd;border:1px solid var(--da7-line);border-radius:13px;padding:10px 12px}
.da7-stat b{display:block;font-size:1.25rem;color:var(--da7-navy);line-height:1}
.da7-stat span{display:block;margin-top:3px;font-size:10.5px;color:var(--da7-muted)}
</style>`;

const js = String.raw`<script id="bp-docagent-v7-js">(function(){
var API='/api/requests?__route=doc-agent';
var ref='', access=null, busy=false;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function get(qs){return fetch(API+qs,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(d){d.__code=r.status;return d})})}
function post(b){return fetch(API,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(b)}).then(function(r){return r.json().then(function(d){d.__code=r.status;return d})})}
function say(cls,text){var d=document.createElement('div');d.className='da7-m '+cls;d.textContent=text;var l=$('da7Log');l.appendChild(d);l.scrollTop=1e9;return d}
function link(name,url,note){var d=document.createElement('div');d.className='da7-m bot';d.appendChild(document.createTextNode('⬇️ '));
  var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent=name;d.appendChild(a);
  if(note)d.appendChild(document.createTextNode(' — '+note));
  var l=$('da7Log');l.appendChild(d);l.scrollTop=1e9}
function wall(d){say('sys',d&&d.message?d.message:'انتهت فترتك التجريبية.');renderTrial({allowed:false,days_left:0,entitled:false});}

function renderTrial(a){
  access=a||access; if(!access)return;
  var box=$('da7Trial'); if(!box)return;
  if(access.entitled){box.className='da7-trial';box.innerHTML='<div><b>المستشار الذكي للمستندات</b><p>اشتراكك فعّال — تعبئة بلا حدود لنماذج Word وExcel وPDF.</p></div><span class="days">مُفعّل</span>';return}
  var left=access.days_left==null?access.trial_days:access.days_left;
  if(access.allowed){
    box.className='da7-trial';
    box.innerHTML='<div><b>تجربة مجانية '+(access.trial_days||14)+' يوماً — بلا شراء</b><p>ارفع مستنداتك والنماذج المطلوب تعبئتها، والمستشار يقرأ ويستخرج ويعبّئ ويجهّز الحزمة. ملفاتك في خزنة منشأتك وحدها.</p></div><span class="days">'+(access.never_started?('تبدأ عند أول استخدام · '+(access.trial_days||14)+' يوماً'):('متبقٍ '+left+' يوم'))+'</span>';
  }else{
    box.className='da7-trial ended';
    box.innerHTML='<div><b>انتهت الفترة التجريبية</b><p>كل ما أنتجه المستشار يبقى محفوظاً وقابلاً للتنزيل. للاستمرار في تعبئة نماذج جديدة فعّل الاشتراك.</p></div><a href="/ar/services?q=%D9%88%D9%83%D9%8A%D9%84%20%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%86%D8%AF%D8%A7%D8%AA">فعّل الاشتراك</a>';
  }
}
function tag(role){
  if(role==='target_form')return '<span class="da7-tag form">نموذج للتعبئة</span>';
  if(role==='source')return '<span class="da7-tag src">مستند مصدر</span>';
  if(role==='stamp_asset')return '<span class="da7-tag other">ختم</span>';
  if(role==='signature_asset')return '<span class="da7-tag other">توقيع</span>';
  if(role==='requirement')return '<span class="da7-tag other">قائمة متطلبات</span>';
  return '<span class="da7-tag other">'+esc(role||'—')+'</span>';
}
function renderState(d){
  if(!d||!d.ok)return;
  if(d.access)renderTrial(d.access);
  if(d.marks)renderMarks(d.marks);
  var g=d.gap||{};
  $('da7Stats').innerHTML='<div class="da7-stat"><b>'+(g.forms||0)+'</b><span>نموذج للتعبئة</span></div>'+
    '<div class="da7-stat"><b>'+(g.sources||0)+'</b><span>مستند مصدر</span></div>'+
    '<div class="da7-stat"><b>'+(g.facts||0)+'</b><span>معلومة مستخرجة</span></div>'+
    '<div class="da7-stat"><b>'+((g.conflicts||[]).length)+'</b><span>تعارض</span></div>';
  var files=d.files||[];
  $('da7Files').innerHTML=files.length?files.map(function(f){
    return '<div class="da7-file"><div><strong>'+esc(f.file_name)+'</strong><small>'+esc(f.doc_kind||'')+(f.expiry_status==='EXPIRED'?' · منتهي الصلاحية':'')+'</small></div>'+tag(f.role)+'</div>'
  }).join(''):'<div class="da7-empty">لم تُرفع ملفات بعد.</div>';
  var outs=d.outputs||[];
  $('da7Outs').innerHTML=outs.length?outs.map(function(o){
    return '<div class="da7-file"><div><strong>'+esc(o.delivery_name)+'</strong><small>إصدار '+o.version_no+' · فحص الجودة: '+esc(o.qa_status)+'</small></div><button class="da7-btn ghost" data-out="'+esc(o.id)+'">تنزيل</button></div>'
  }).join(''):'<div class="da7-empty">لا مخرجات بعد — ارفع نموذجاً واطلب التعبئة.</div>';
  Array.prototype.forEach.call($('da7Outs').querySelectorAll('[data-out]'),function(b){
    b.onclick=function(){get('&action=output-link&id='+encodeURIComponent(b.getAttribute('data-out'))).then(function(l){if(l.url)window.open(l.url,'_blank')})}
  });
  $('da7Fill').disabled=!(g.forms>0);
  $('da7Pack').disabled=!(outs.length>0);
}
function refresh(){ if(ref)get('&action=state&ref='+encodeURIComponent(ref)).then(renderState) }

function begin(cb){
  if(ref)return cb&&cb();
  post({action:'start',locale:'ar'}).then(function(d){
    if(d.__code===402){wall(d);return}
    if(!d.ok){say('sys','تعذّر بدء الطلب.');return}
    ref=d.ref; try{localStorage.setItem('bp_da_ref',ref)}catch(e){}
    cb&&cb();
  });
}
function send(){
  var i=$('da7Input'), v=(i.value||'').trim(); if(!v||busy)return;
  i.value=''; say('me',v);
  begin(function(){
    busy=true; var t=say('sys','…');
    post({action:'chat',ref:ref,message:v}).then(function(d){
      busy=false; t.remove();
      if(d.__code===402){wall(d);return}
      say('bot',d.ok?d.reply:'صار خطأ — أعد المحاولة.');
      if(d.ok&&d.generate_now)fill();
      refresh();
    }).catch(function(){busy=false;t.remove();say('sys','تعذّر الاتصال.')});
  });
}
function upload(files){
  files=Array.prototype.slice.call(files||[]); if(!files.length)return;
  begin(function(){
    (function next(i){
      if(i>=files.length){refresh();return}
      var f=files[i]; say('me','📎 '+f.name);
      if(f.size>3*1024*1024){say('sys','هذا الملف أكبر من 3 ميجابايت وهو حد الرفع. اضغطه أو قسّمه ثم أعد إرساله.');return next(i+1)}
      var t=say('sys','جارٍ الرفع والقراءة…');
      var rd=new FileReader();
      rd.onload=function(){
        var b64=String(rd.result).split(',')[1]||'';
        var ext=(f.name.split('.').pop()||'').toLowerCase();
        var m={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
        post({action:'upload',ref:ref,fileBase64:b64,fileName:f.name,fileType:f.type||m[ext]||'application/pdf'}).then(function(d){
          t.remove();
          if(d.__code===402){wall(d);return}
          say('bot',d.ok?d.note:(d.error==='too_large'?'الملف أكبر من 3 ميجابايت.':'تعذّرت قراءة الملف.'));
          next(i+1);
        }).catch(function(){t.remove();say('sys','تعذّر الرفع.');next(i+1)});
      };
      rd.readAsDataURL(f);
    })(0);
  });
}
function fill(formId,seen){
  if(!ref)return; seen=seen||0;
  var t=say('sys','جارٍ تعبئة النماذج — وتمر بمراجعة جودة قبل أن تصلك…');
  post(formId?{action:'generate',ref:ref,form_id:formId}:{action:'generate',ref:ref}).then(function(d){
    t.remove();
    if(d.__code===402){wall(d);return}
    if(!d.ok){say('bot',d.error==='no_target_forms'?'ما عندي نموذج للتعبئة بعد — قل لي أي ملف من المرفوعة هو النموذج، مثل: «عبّي ملف كذا».':'تعذّرت التعبئة'+(d.detail?(' — '+d.detail):'.'));refresh();return}
    var done=0;
    (d.outputs||[]).forEach(function(o){
      if(o.ok&&o.output_id){done++;get('&action=output-link&id='+encodeURIComponent(o.output_id)).then(function(l){if(l.url)link(o.form,l.url,o.unfilled?(o.unfilled+' حقل بانتظارك'):'')})}
      else if(!o.ok)say('sys','⚠ '+o.form+(o.detail?(' — '+o.detail):''));
    });
    if(d.signed&&d.signed.length){
      var has=function(k){return d.signed.indexOf(k)!==-1};
      say('sys',has('signature')&&has('stamp')?'وُضع توقيعك وختم منشأتك في مواضعهما.'
        :has('signature')?'وُضع توقيعك في موضع التوقيع.':'وُضع ختم منشأتك في موضعه.');
    }
    var rest=d.remaining||[];
    if(rest.length&&seen<12){fill(rest[0].id,seen+1);return}
    if(done||seen)say('bot','تم — ملفاتك المعبّأة جاهزة، حمّلها من الروابط أعلاه أو من «مخرجاتك».');
    refresh();
  }).catch(function(){t.remove();say('sys','تعذّر التوليد.')});
}
function pack(){
  if(!ref)return; var t=say('sys','جارٍ ضغط كل شيء في ملف واحد…');
  post({action:'package',ref:ref}).then(function(d){
    t.remove();
    if(d.ok&&d.url)link('حزمة التسليم النهائية (ZIP)',d.url,'');
    else say('sys','لا توجد مخرجات لتغليفها بعد.');
    refresh();
  }).catch(function(){t.remove();say('sys','تعذّر التغليف.')});
}
function fresh(){
  ref=''; try{localStorage.removeItem('bp_da_ref')}catch(e){}
  $('da7Log').innerHTML=''; $('da7Files').innerHTML='<div class="da7-empty">لم تُرفع ملفات بعد.</div>';
  $('da7Outs').innerHTML='<div class="da7-empty">لا مخرجات بعد.</div>';
  say('bot','ارفع المستندات التي تحتوي على البيانات، وارفع الملفات التي تريد تعبئتها. سأراجع كل شيء وأستخدم المعلومات المتوفرة وأطلب منك فقط ما هو ناقص.');
}

function view(){
  return '<div class="pagehead"><h2>المستشار الذكي للمستندات</h2><div class="sub">ارفع مستنداتك والنماذج المطلوب تعبئتها — يقرأ ويستخرج ويطابق ويعبّئ Word وExcel وPDF في مكانها، ويسألك عن الناقص فقط.</div></div>'+
  '<div class="da7-trial" id="da7Trial"></div>'+
  '<div class="da7-stats" id="da7Stats"></div>'+
  '<div class="da7-grid">'+
    '<div class="da7-box"><h3>محادثة المستشار</h3><p class="hint">اكتب بلغتك: «عبّي ملف كذا»، «Section 9 كله No»، «حط تاريخ اليوم»، «وش الناقص؟».</p>'+
      '<div class="da7-log" id="da7Log"></div>'+
      '<div class="da7-row"><button class="da7-btn clip" id="da7Clip" title="أرفق ملفات">📎</button>'+
      '<input type="text" id="da7Input" placeholder="اكتب هنا…" autocomplete="off">'+
      '<button class="da7-btn" id="da7Send">إرسال</button></div>'+
      '<input type="file" id="da7File" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" hidden>'+
    '</div>'+
    '<div>'+
      '<div class="da7-box"><h3>ارفع ملفاتك</h3><p class="hint">مستندات فيها بيانات، ونماذج تحتاج تعبئة، وحتى صورة من إيميل المتطلبات — المستشار يصنّف كل ملف بنفسه. حتى 3 ميجابايت للملف.</p>'+
        '<div class="da7-drop" id="da7Drop">اسحب الملفات هنا أو اضغط للاختيار<br><small>PDF · Word · Excel · صور</small></div>'+
        '<div class="da7-files" id="da7Files"><div class="da7-empty">لم تُرفع ملفات بعد.</div></div></div>'+
      '<div class="da7-box" style="margin-top:14px"><h3>توقيعك وختم منشأتك</h3>'+
        '<p class="hint">وقّع بإصبعك أو بالفأرة مرة واحدة، ويُستخدم التوقيع نفسه في كل نموذج بعدها. يُطبَّق فقط على الحقول التي تطلب توقيعاً أو ختماً — ولا يُطبَّق أبداً بدون موافقتك الصريحة أدناه.</p>'+
        '<div class="da7-sig"><canvas id="da7Pad" width="600" height="200"></canvas>'+
          '<div class="da7-row" style="margin-top:8px;flex-wrap:wrap">'+
            '<button class="da7-btn ghost" id="da7PadClear" type="button">مسح</button>'+
            '<button class="da7-btn clip" id="da7SigUp" type="button">ارفع صورة توقيع</button>'+
            '<button class="da7-btn" id="da7SigSave" type="button">احفظ التوقيع</button>'+
          '</div>'+
          '<label class="da7-consent"><input type="checkbox" id="da7Consent"> أوافق على استخدام هذا التوقيع لتوقيع مستنداتي التي يعبّئها المستشار.</label>'+
          '<div class="da7-mark" id="da7SigState">لا يوجد توقيع محفوظ.</div>'+
        '</div>'+
        '<div class="da7-sig" style="margin-top:12px">'+
          '<div class="da7-row" style="flex-wrap:wrap">'+
            '<button class="da7-btn clip" id="da7StampUp" type="button">ارفع صورة الختم</button>'+
            '<button class="da7-btn ghost" id="da7StampClear" type="button">احذف الختم</button>'+
          '</div>'+
          '<div class="da7-mark" id="da7StampState">لا يوجد ختم محفوظ.</div>'+
        '</div>'+
        '<input type="file" id="da7MarkFile" accept="image/png,image/jpeg,image/webp" hidden>'+
      '</div>'+
      '<div class="da7-box" style="margin-top:14px"><h3>مخرجاتك</h3><p class="hint">النماذج المعبّأة والحزمة النهائية — بروابط تنزيل موقّعة قصيرة العمر.</p>'+
        '<div class="da7-files" id="da7Outs"><div class="da7-empty">لا مخرجات بعد.</div></div>'+
        '<div class="da7-row" style="margin-top:12px"><button class="da7-btn" id="da7Fill" disabled>عبّئ النماذج</button>'+
        '<button class="da7-btn ghost" id="da7Pack" disabled>جهّز الحزمة</button>'+
        '<button class="da7-btn ghost" id="da7New">طلب جديد</button></div></div>'+
    '</div>'+
  '</div>';
}
function mount(){
  var wrap=document.querySelector('.viewwrap'); if(!wrap||$('view-docagent'))return;
  var s=document.createElement('section'); s.className='view da7'; s.id='view-docagent'; s.innerHTML=view();
  wrap.appendChild(s);
  padSetup();
  $('da7Send').onclick=send;
  $('da7Input').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();send()}});
  $('da7Clip').onclick=function(){$('da7File').click()};
  $('da7Drop').onclick=function(){$('da7File').click()};
  $('da7File').addEventListener('change',function(){upload(this.files);this.value=''});
  ['dragenter','dragover'].forEach(function(ev){$('da7Drop').addEventListener(ev,function(e){e.preventDefault();this.classList.add('over')})});
  ['dragleave','drop'].forEach(function(ev){$('da7Drop').addEventListener(ev,function(e){e.preventDefault();this.classList.remove('over')})});
  $('da7Drop').addEventListener('drop',function(e){upload(e.dataTransfer&&e.dataTransfer.files)});
  $('da7Fill').onclick=function(){fill()};
  $('da7Pack').onclick=pack;
  $('da7New').onclick=fresh;
}
function nav(){
  var n=document.getElementById('sideNav'); if(!n||n.querySelector('[data-v="docagent"]'))return;
  var b=document.createElement('button'); b.setAttribute('data-v','docagent');
  b.innerHTML='<span>🗂️</span><span>مستشار المستندات</span>';
  var after=n.querySelector('[data-v="documents"]')||n.querySelector('[data-v="company"]');
  if(after)after.insertAdjacentElement('afterend',b); else n.appendChild(b);
  b.onclick=function(){
    document.querySelectorAll('.view').forEach(function(x){x.classList.remove('on')});
    document.querySelectorAll('#sideNav button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); var v=$('view-docagent'); if(v)v.classList.add('on');
    open(); window.scrollTo(0,0);
  };
}
// ---- the client's signature and the company stamp ------------------------
// The pad writes a transparent PNG: black ink on nothing, so the signature sits
// over the form's own ruled line instead of hiding it behind a white box.
var padDrawn=false, markKind='signature';
function padSetup(){
  var c=$('da7Pad'); if(!c||c._on)return; c._on=1;
  var g=c.getContext('2d'), drawing=false, last=null;
  function fit(){
    var r=c.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    var data=padDrawn?c.toDataURL():null;
    c.width=Math.max(300,Math.round(r.width*dpr)); c.height=Math.round(150*dpr);
    g.scale(dpr,dpr); g.lineWidth=2.2; g.lineCap='round'; g.lineJoin='round'; g.strokeStyle='#101828';
    if(data){var im=new Image();im.onload=function(){g.drawImage(im,0,0,r.width,150)};im.src=data}
  }
  fit(); window.addEventListener('resize',fit);
  function at(e){
    var r=c.getBoundingClientRect();
    var t=(e.touches&&e.touches[0])||e;
    return {x:t.clientX-r.left, y:t.clientY-r.top};
  }
  function down(e){e.preventDefault();drawing=true;last=at(e)}
  function move(e){
    if(!drawing)return; e.preventDefault();
    var p=at(e); g.beginPath(); g.moveTo(last.x,last.y); g.lineTo(p.x,p.y); g.stroke();
    last=p; padDrawn=true;
  }
  function up(){drawing=false}
  c.addEventListener('mousedown',down); c.addEventListener('mousemove',move);
  window.addEventListener('mouseup',up);
  c.addEventListener('touchstart',down,{passive:false});
  c.addEventListener('touchmove',move,{passive:false});
  c.addEventListener('touchend',up);
  $('da7PadClear').onclick=function(){g.clearRect(0,0,c.width,c.height);padDrawn=false};
  $('da7SigSave').onclick=function(){
    if(!$('da7Consent').checked){alert('فعّل الموافقة أولاً — لا يُطبَّق توقيعك بدونها.');return}
    if(!padDrawn){alert('ارسم توقيعك في المربع أولاً، أو ارفعه كصورة.');return}
    saveMark('signature', c.toDataURL('image/png').split(',')[1], 'image/png');
  };
  $('da7SigUp').onclick=function(){markKind='signature';$('da7MarkFile').click()};
  $('da7StampUp').onclick=function(){markKind='stamp';$('da7MarkFile').click()};
  $('da7StampClear').onclick=function(){
    post({action:'clear-mark',ref:ref||undefined,kind:'stamp'}).then(function(d){if(d.marks)renderMarks(d.marks)});
  };
  $('da7MarkFile').onchange=function(){
    var f=(this.files||[])[0]; this.value='';
    if(!f)return;
    if(markKind==='signature'&&!$('da7Consent').checked){alert('فعّل الموافقة أولاً — لا يُطبَّق توقيعك بدونها.');return}
    if(f.size>2*1024*1024){alert('الصورة أكبر من 2 ميجابايت.');return}
    var rd=new FileReader();
    rd.onload=function(){saveMark(markKind,String(rd.result).split(',')[1],f.type||'image/png')};
    rd.readAsDataURL(f);
  };
}
function saveMark(kind,b64,mime){
  post({action:'set-mark',kind:kind,fileBase64:b64,fileType:mime,consent:kind==='signature'?!!$('da7Consent').checked:undefined})
    .then(function(d){
      if(!d.ok){alert(d.error==='consent_required'?'فعّل الموافقة أولاً.':'تعذّر الحفظ — حاول مرة أخرى.');return}
      renderMarks(d.marks);
      say('sys',kind==='signature'?'حُفِظ توقيعك — سيُطبَّق على حقول التوقيع في النماذج القادمة.':'حُفِظ ختم منشأتك.');
      if(kind==='signature'&&ref)post({action:'set-option',ref:ref,signature_mode:'client_image'});
    });
}
function renderMarks(m){
  if(!m)return;
  var sg=$('da7SigState'), st=$('da7StampState');
  if(sg){
    sg.className='da7-mark'+(m.signature.saved?' on':'');
    sg.textContent=m.signature.saved?'✓ توقيعك محفوظ ومُفعّل.':'لا يوجد توقيع محفوظ.';
    if(m.signature.saved){
      var c=$('da7Consent'); if(c)c.checked=true;
      get('&action=mark-link&kind=signature').then(function(d){
        if(!d.url)return; var i=new Image(); i.src=d.url; i.alt='توقيعك'; sg.appendChild(i);
      });
    }
  }
  if(st){
    st.className='da7-mark'+(m.stamp.saved?' on':'');
    st.textContent=m.stamp.saved?'✓ ختم منشأتك محفوظ.':'لا يوجد ختم محفوظ.';
    if(m.stamp.saved)get('&action=mark-link&kind=stamp').then(function(d){
      if(!d.url)return; var i=new Image(); i.src=d.url; i.alt='ختم المنشأة'; st.appendChild(i);
    });
  }
}
var opened=false;
function purge(){
  try{localStorage.removeItem('bp_da_ref');localStorage.removeItem('bp_da_org')}catch(e){}
  ref=''; var l=$('da7Log'); if(l)l.innerHTML='';
}
function open(){
  if(opened)return; opened=true;
  get('&action=access').then(function(a){
    if(a.__code===401||a.__code===400){
      // not a registered client (or no establishment yet): nothing of theirs is
      // kept here, and any stale local pointer is dropped on the spot.
      purge();
      say('bot','سجّل دخولك كعميل (أو أضف منشأتك) لتبدأ تجربتك المجانية 30 يوماً.');
      return;
    }
    if(a.ok)renderTrial(a.access);
    if(a.marks)renderMarks(a.marks);
    get('&action=list').then(function(d){
      // A cached ref belongs to exactly one establishment. If the signed-in tenant
      // changed on this browser, the previous client's pointer and log go first.
      var who=''; try{who=localStorage.getItem('bp_da_org')||''}catch(e){}
      if(d&&d.org&&who&&who!==d.org)purge();
      try{if(d&&d.org)localStorage.setItem('bp_da_org',d.org)}catch(e){}
      var openReq=((d&&d.requests)||[]).filter(function(r){return ['DELIVERED','COMPLETED'].indexOf(r.status)===-1});
      var saved=''; try{saved=localStorage.getItem('bp_da_ref')||''}catch(e){}
      var pick=openReq.filter(function(r){return r.ref===saved})[0]||openReq[0];
      if(pick){ref=pick.ref;try{localStorage.setItem('bp_da_ref',ref)}catch(e){}
        get('&action=state&ref='+encodeURIComponent(ref)).then(function(s){
          if(s.ok){(s.messages||[]).slice(-10).forEach(function(m){say(m.author==='client'?'me':'bot',m.body)});renderState(s)}
        });
      } else { try{localStorage.removeItem('bp_da_ref')}catch(e){} fresh(); }
    });
  });
}
function routeQuery(){var v=new URLSearchParams(location.search).get('view');if(v==='docagent'){var b=document.querySelector('#sideNav [data-v="docagent"]');if(b)b.click()}}
function boot(){nav();mount();routeQuery()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`;

let n = 0;
for (const file of targets) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<style id="bp-docagent-v7-css">[\s\S]*?<\/style>/g, '')
             .replace(/<script id="bp-docagent-v7-js">[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', css + '\n</head>').replace('</body>', js + '\n</body>');
  fs.writeFileSync(file, html);
  n++;
}
console.log('Doc agent portal v7 applied to ' + n + ' page(s)');
