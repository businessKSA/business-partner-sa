(function(){
 var keys=["quote","contract","nda"];
 document.querySelectorAll(".sheet").forEach(function(root){
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n,list=[];
  while((n=w.nextNode()))if(n.nodeValue.indexOf("[●]")>-1)list.push(n);
  list.forEach(function(t){var f=document.createDocumentFragment();
   t.nodeValue.split("[●]").forEach(function(p,i){if(i){var m=document.createElement("mark");m.className="ph";m.textContent="[●]";f.appendChild(m)}f.appendChild(document.createTextNode(p))});
   t.parentNode.replaceChild(f,t)});
  var box=document.createElement("div");box.className="fit";root.parentNode.insertBefore(box,root);box.appendChild(root);
 });
 function fit(){document.querySelectorAll(".fit").forEach(function(b){var s=b.firstElementChild,w=s.classList.contains("land")?1123:794,h=s.classList.contains("land")?794:1123;
  var avail=b.parentNode.clientWidth;if(!avail)return;var k=Math.min(1.5,avail/w);
  s.style.transform="scale("+k+")";s.style.transformOrigin="top left";b.style.width=Math.round(w*k)+"px";b.style.height=Math.round(h*k)+"px"})}
 function show(k){if(keys.indexOf(k)<0)k="quote";
  keys.forEach(function(x){document.getElementById("p-"+x).hidden=x!==k;document.getElementById("t-"+x).setAttribute("aria-selected",x===k)});fit()}
 document.querySelectorAll("[role=tab]").forEach(function(b){b.addEventListener("click",function(){location.hash=b.dataset.tab})});
 window.addEventListener("hashchange",function(){show(location.hash.slice(1))});
 window.addEventListener("resize",fit);
 show(location.hash.slice(1));
})();
