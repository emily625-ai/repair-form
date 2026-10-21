const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,channel:process.env.LINE_BROWSER_CHANNEL||'chrome'});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.route('**/*',r=>r.abort());
const root=path.join(__dirname,'..');const html=fs.readFileSync(path.join(root,'客服記錄系統.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');await page.setContent(html);
for(const name of ['config','classification-v31','classification','core','form','list','line-conversations','line-import','data'])await page.addScriptTag({content:fs.readFileSync(path.join(root,`客服記錄系統.${name}.js`),'utf8')});
const result=await page.evaluate(async()=>{
 const checks=[];const ok=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 const message={id:'11111111-1111-4111-8111-111111111111',source:'manual_paste',sender_id:'synthetic',sender_name:'Synthetic group',received_at:'2026-10-21T00:00:00Z',raw_message:'<img src=x onerror="window.bad=true">',status:'pending'};
 let paths=[];
 sbFetch=async(path,opt)=>{paths.push(path);if(path.startsWith('line_conversation_queue'))return [{id:'22222222-2222-4222-8222-222222222222',source:message.source,sender_name:message.sender_name,started_at:message.received_at,last_message_at:'2026-10-21T00:05:00Z',message_count:2,combined_message:'Synthetic summary',status:'pending_review',version:1,message_ids:[message.id],has_missing_hash:false}];if(path.startsWith('line_messages'))return [message];throw Error(path);};
 await refreshLineImportPendingRows({silent:true});
 ok(document.querySelectorAll('#linePendingBody tr').length===1,'one conversation per row');
 ok(document.getElementById('linePendingBody').textContent.includes('2 則'),'message count');
 ok(lineImportPendingRows[0].status==='pending','pending_review compatibility');
 await openLineMessageDetail(lineImportPendingRows[0].id);
 ok(document.getElementById('lineDetailBody').textContent.includes(message.raw_message),'original text retained');
 ok(!window.bad&&!document.querySelector('#lineDetailBody img'),'customer text escaped');
 ok(paths.every(x=>!x.includes('ingest')),'queue never backfills');
 document.getElementById('lineQueueScope').value='legacy';await refreshLineImportPendingRows({silent:true});
 ok(lineImportStorageMode==='legacy'&&lineImportPendingRows.length===1,'history retained');
 ok(!document.querySelector('#linePendingBody button').disabled,'history detail available');
 ok([...document.querySelectorAll('#linePendingBody button')].slice(1).every(x=>x.disabled),'history mutation disabled');
 await openLineMessageDetail(lineImportPendingRows[0].id);
 ok([...document.querySelectorAll('#lineDetailModal .mf button')].filter(x=>!x.getAttribute('onclick').includes('closeLineMessageDetail')).every(x=>x.disabled),'history modal readonly');
 const original=paths.length;await performLineConversationAction(lineImportPendingRows[0].id,'archive');ok(paths.length===original,'history RPC blocked');
 return checks;
});console.log('PASS '+result.length+' browser checks: '+result.join(', '));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
