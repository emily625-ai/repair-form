const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes=new Map();
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.textContent='';this.checked=false;this.style={};this.dataset={};this.classList={add(){},remove(){}};}
 set id(v){this._id=v;nodes.set(v,this)}get id(){return this._id}
 get options(){return this.children}add(n){this.children.push(n)}append(n){this.children.push(n)}
 prepend(n){this.children.unshift(n)}
 replaceChildren(...n){this.children=n;this.value=n[0]?.value||''}remove(i){this.children.splice(i,1)}
 addEventListener(){}
 set innerHTML(v){this.children=[...v.matchAll(/<option(?:[^>]*value="([^"]*)")?[^>]*>([^<]*)<\/option>/g)].map(m=>new Option(m[2],m[1]??m[2]));this.value=this.children[0]?.value||''}
}
class Option{constructor(t,v){this.textContent=t;this.value=v}}
const html=fs.readFileSync(__dirname+'/../客服記錄系統.html','utf8');
for(const m of html.matchAll(/\bid="([^"]+)"/g)){const n=new Node();n.id=m[1]}
for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))nodes.get(m[1]).innerHTML=m[2];
const alerts=[];const c=vm.createContext({document:{getElementById(id){return nodes.get(id)||null},createElement(tag){return new Node(tag)}},Option,window:null,alert:m=>alerts.push(m),confirm:()=>true,console,setTimeout:()=>0,assert});

c.window=c;
c.document.body=new Node();
for(const name of ['config','classification-v31','classification','core','form','list','analytics','app','import','line-import','line-conversations','report-tools','data'])vm.runInContext(fs.readFileSync(__dirname+'/../客服記錄系統.'+name+'.js','utf8'),c);

const result=vm.runInContext(`(()=>{
let checks=0;
const active=V3_CLASSIFICATIONS.filter(x=>x.status==='使用中');
assert.equal(active.length,131);
for(const item of active){
 const record={classification_version:V3_VERSION,classification_code:item.code,project_name:item.project,new_product:item.product,case_nature:item.nature,new_category:item.category,new_subcategory:item.subcategory,classification_note:'Synthetic confirmation'};
 validateV2Classification(record);checks++;
 assert.throws(()=>validateV2Classification({...record,project_name:'invalid'}));checks++;
}
return checks;
})()`,c);
console.log('PASS '+result+' V3.1 active classification/project checks');

const sql=fs.readFileSync(__dirname+'/../docs/sql/line-conversations/direct-fk-actions-draft.sql','utf8');
const tuples=JSON.parse(sql.split('$v31$')[1]);
const expected=vm.runInContext('V3_CLASSIFICATIONS.filter(x=>x.status==="使用中").map(x=>({classification_code:x.code,project_name:x.project,new_product:x.product,case_nature:x.nature,new_category:x.category,new_subcategory:x.subcategory}))',c);
assert.equal(JSON.stringify(tuples),JSON.stringify(expected));
console.log('PASS SQL V3.1 tuples exactly match current active frontend dictionary');
