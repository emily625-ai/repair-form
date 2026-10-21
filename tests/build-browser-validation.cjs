// Builds a self-contained synthetic UI test page for an existing browser.
// No credentials or customer records, and no outbound fetch calls are permitted.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=process.argv[2]||'/tmp/line-ui-validation';
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(root,'客服記錄系統.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const script=code=>'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';
let scripts=script("window.fetch=async()=>{throw Error('Outbound network disabled in synthetic UI test');};");
for(const name of ['config','classification-v31','classification','core','form','list','line-conversations','line-import','data'])scripts+=script(fs.readFileSync(path.join(root,`客服記錄系統.${name}.js`),'utf8'));
const test=fs.readFileSync(path.join(__dirname,'browser-line-groups.cjs'),'utf8');
const start=test.indexOf('const result=await page.evaluate(async()=>{')+'const result=await page.evaluate(async()=>{'.length;
const end=test.indexOf('\n});console.log',start);
if(start<40||end<start)throw Error('Browser test extraction failed');
scripts+=script(`(async()=>{try{const checks=await(async()=>{${test.slice(start,end)}\n})();
 document.body.classList.remove('auth-locked');
 document.querySelectorAll('.view').forEach(node=>node.classList.remove('active'));
 document.getElementById('view-line-import').classList.add('active');
 closeLineMessageDetail();
 const results=document.createElement('section');results.id='validationResults';results.style='padding:16px;background:#123c24;color:white;position:fixed;top:0;left:0;right:0;z-index:99999';
 results.textContent='PASS '+checks.length+' synthetic browser checks — '+checks.join(' / ');
 document.body.prepend(results);document.body.style.paddingTop='110px';
 document.title='PASS: LINE conversation browser validation';
 }catch(error){document.body.textContent='FAIL: '+error.message;document.title='FAIL: LINE conversation browser validation';}})();`);
html=html.replace('</body>',scripts+'</body>');
fs.writeFileSync(path.join(out,'index.html'),html);console.log('Synthetic browser test page generated at '+out+'/index.html');
