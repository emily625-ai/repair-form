const ANALYTICS_BAR_COLORS=['#5b8cff','#7c6cff','#34d399','#fbbf24','#f87171','#fb923c','#a78bfa','#38bdf8','#f472b6'];
const ANALYTICS_DONUT_COLORS=['#5b8cff','#34d399','#fbbf24','#f87171','#a78bfa'];

function buildCountMap(items, selector, fallback='未知'){
  const map={};
  items.forEach(item=>{
    const key=selector(item) || fallback;
    map[key]=(map[key]||0)+1;
  });
  return map;
}

const REPORT_CLASSIFICATION_VERSION='product-case-v1';
const REPORT_PRODUCTS=['GPS','行車視野','雷達','冷鏈','共通平台／其他'];
function reportClassification(r){
  const text=v=>String(v||'').trim();
  const mapProduct=v=>/GPS/i.test(v)?'GPS':/DMVR|行車視野/i.test(v)?'行車視野':/雷達/.test(v)?'雷達':/冷鏈/.test(v)?'冷鏈':'共通平台／其他';
  const product=mapProduct(text(r.new_product)||text(r.product)||text(r.category));
  const category=text(r.new_category)||text(r.category)||'未分類';
  const subcategory=text(r.new_subcategory)||text(r.subcategory)||'未分類';
  const nature=text(r.case_nature);
  const problem=category+'／'+subcategory;
  const aliases={'設備異常':'故障／異常','系統異常':'故障／異常','資料異動':'資料／設定異動','商務／行政':'帳務／文件','其他／待確認':'查詢／協助'};
  const types=['故障／異常','安裝／維修作業','資料／設定異動','帳務／文件','查詢／協助'];
  let caseType=types.includes(nature)?nature:aliases[nature];
  if(!caseType){
    const basis=nature?'服務作業'===nature?problem:'':problem;
    caseType=/操作|資料提供|資料調閱|查詢|協助/.test(basis)?'查詢／協助':/安裝|施工|拆機|移機|維修|派工|設備處理|回收|更換|購料/.test(basis)?'安裝／維修作業':/修改|異動|設定|新增帳號|權限/.test(basis)?'資料／設定異動':/帳務|費用|發票|合約|文件|請款|報價/.test(basis)?'帳務／文件':/異常|故障|離線|黑屏|模糊|無法|GPS設備|雷達設備|平台系統|冷鏈|行車視野/.test(basis)?'故障／異常':'查詢／協助';
  }
  return {product,caseType,category,subcategory};
}
function buildCategorySummary(items){
  const map=Object.fromEntries(REPORT_PRODUCTS.map(p=>[p,{total:0,closed:0,subs:{}}]));
  items.forEach(r=>{
    const c=reportClassification(r), info=map[c.product];
    const label=c.caseType+' → '+c.category+'／'+c.subcategory;
    info.total++; if(r.status==='結案') info.closed++;
    info.subs[label]=(info.subs[label]||0)+1;
  });
  return map;
}
function analyticsCategory(r){return reportClassification(r).product;}
function analyticsSubcategory(r){return reportClassification(r).subcategory;}

function groupByStatus(items){
  const map={};
  items.forEach(item=>{
    const status=item.status||'未知';
    if(!map[status]) map[status]=[];
    map[status].push(item);
  });
  return map;
}

function getAverageDurationLabel(items){
  const durations=items
    .filter(r=>r.status==='結案'&&r.date&&r.closeDate)
    .map(r=>{
      const closeDate=toDateValue(r.closeDate);
      const caseDate=toDateValue(r.date);
      return closeDate && caseDate ? closeDate-caseDate : NaN;
    })
    .filter(ms=>ms>0);
  if(!durations.length) return '—';
  const avgMs=durations.reduce((sum,value)=>sum+value,0)/durations.length;
  const avgH=Math.round(avgMs/3600000);
  return avgH>=24?`${Math.floor(avgH/24)}天${avgH%24}小時`:`${avgH}小時`;
}

function buildAnalyticsModel(){
  const recs=getRptRecords();
  const from=document.getElementById('rptFrom').value;
  const to=document.getElementById('rptTo').value;
  const total=recs.length;
  const closed=recs.filter(r=>r.status==='結案').length;
  const open=total-closed;
  const surveySent=recs.filter(r=>r.surveySent).length;
  const surveyReplied=recs.filter(r=>r.surveyReplied).length;
  return {
    recs,
    from,
    to,
    total,
    closed,
    open,
    surveySent,
    surveyReplied,
    overdueList:records.filter(r=>isDispatchOverdue(r)),
    statusCounts:buildCountMap(recs, r=>r.status),
    categoryCounts:buildCountMap(recs, analyticsCategory, '其他'),
    companyCounts:buildCountMap(recs, r=>r.company, '未填公司'),
    handlerCounts:buildCountMap(recs, r=>r.handler),
    channelCounts:buildCountMap(recs, r=>r.channel),
    categorySummary:buildCategorySummary(recs),
    statusGroups:groupByStatus(recs),
    avgDurationLabel:getAverageDurationLabel(recs),
  };
}

async function downloadReport(endpoint, filenamePrefix){
  const model=buildAnalyticsModel();
  if(!model.from||!model.to){
    alert(`請先選擇報表期間再下載${filenamePrefix}`);
    return;
  }
  if(!model.recs.length){
    alert('此期間無資料');
    return;
  }
  showToast(`⏳ 產生${filenamePrefix}中，請稍候…`,'var(--accent)');
  try{
    const res=await fetch(`https://report-api-ehs7.onrender.com/${endpoint}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(buildLegacyReportPayload(model,records))
    });
    if(!res.ok) throw new Error(await res.text());
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${filenamePrefix}_${model.from}_${model.to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ ${filenamePrefix}已下載`);
  }catch(e){
    showToast('下載失敗：'+e.message,'var(--red)');
  }
}

function renderBarCard(data,title,colors=ANALYTICS_BAR_COLORS){
  const sorted=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const max=sorted[0]?.[1]||1;
  return '<div class="cc"><div class="ct">'+title+'</div><div class="bc">'+sorted.map(([label,count],idx)=>'<div class="br"><div class="bla" title="'+label+'">'+label+'</div><div class="bt"><div class="bf" style="width:'+(count/max*100).toFixed(1)+'%;background:'+colors[idx%colors.length]+'">'+count+'</div></div></div>').join('')+'</div></div>';
}

function renderDonutCard(data,title){
  const entries=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const total=entries.reduce((sum,[,value])=>sum+value,0);
  const r=50,cx=60,cy=60,circ=2*Math.PI*r;
  let offset=0;
  const slices=entries.map(([,value],idx)=>{
    const portion=value/total;
    const dash=portion*circ;
    const gap=circ-dash;
    const svg='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+ANALYTICS_DONUT_COLORS[idx]+'" stroke-width="18" stroke-dasharray="'+dash+' '+gap+'" stroke-dashoffset="'+(-offset*circ)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
    offset+=portion;
    return svg;
  }).join('');
  const legend=entries.map(([label,value],idx)=>'<div class="li"><div class="ld" style="background:'+ANALYTICS_DONUT_COLORS[idx]+'"></div><span style="color:var(--text2);flex:1">'+label+'</span><span style="font-weight:600">'+value+'</span></div>').join('');
  return '<div class="cc"><div class="ct">'+title+'</div><div class="dw"><svg width="120" height="120" viewBox="0 0 120 120"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--border)" stroke-width="18"/>'+slices+'<text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" fill="var(--text)" font-size="15" font-weight="700">'+total+'</text></svg><div class="leg">'+legend+'</div></div></div>';
}

function renderAnalyticsPeriod(model){
  const periodLabel=model.from&&model.to?(model.from+' ～ '+model.to):'全部記錄';
  return '<div style="padding:4px 0 14px;font-size:12px;color:var(--text3)">📅 報表期間：<strong style="color:var(--text)">'+periodLabel+'</strong>　共 <strong style="color:var(--accent)">'+model.total+'</strong> 筆</div>';
}

function renderSummaryCard(label, value, subtext, style=''){
  return '<div class="sc"><div class="slb">'+label+'</div><div class="sv" style="'+style+'">'+value+'</div><div class="ss">'+subtext+'</div></div>';
}

function renderAnalyticsSummary(model){
  const closeRate=model.total>0?((model.closed/model.total)*100).toFixed(1):0;
  const surveyRate=model.surveySent>0?((model.surveyReplied/model.surveySent)*100).toFixed(1):0;
  return '<div class="sg">'
    + renderSummaryCard('總案件數', model.total, '期間記錄', 'color:var(--accent)')
    + renderSummaryCard('已結案', model.closed, '結案率 '+closeRate+'%', 'color:var(--green)')
    + renderSummaryCard('未結案', model.open, '逾7天 <span style="color:var(--orange);font-weight:700">'+model.overdueList.length+'</span> 筆', 'color:var(--yellow)')
    + renderSummaryCard('平均處理時間', model.avgDurationLabel, '已結案案件', 'color:var(--purple);font-size:20px')
    + renderSummaryCard('問卷回收率', surveyRate+'%', '發送 '+model.surveySent+' / 回覆 '+model.surveyReplied, 'color:var(--accent2)')
    + '</div>';
}

function renderStatusTableRows(model){
  return Object.entries(model.statusGroups).sort((a,b)=>b[1].length-a[1].length).map(([status,rows])=>{
    const handlers=[...new Set(rows.map(r=>r.handler).filter(Boolean))].join('、');
    const notes=rows.slice(0,2).map(r=>'<div style="font-size:10px;color:var(--text2);margin-bottom:2px">・['+escapeHtml(r.company)+'] '+escapeHtml(analyticsSubcategory(r))+(r.result?'<span style="color:var(--green)"> →'+escapeHtml(r.result)+'</span>':'')+'</div>').join('');
    return '<tr><td><span class="badge badge-'+status+'">'+status+'</span></td><td style="font-weight:700;text-align:center">'+rows.length+'</td><td style="font-size:11px">'+(handlers||'—')+'</td><td>'+notes+'</td></tr>';
  }).join('');
}

function renderAnalyticsStatusSection(model){
  return '<div style="margin-bottom:14px">'
    + '<div class="rpt-section-title">① 處理狀態 × 處理人員 × 重點說明</div>'
    + '<div class="occ"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--surface2)"><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2);text-transform:uppercase">狀態</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">件數</th><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">處理人員</th><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">重點說明</th></tr></thead>'
    + '<tbody>'+renderStatusTableRows(model)+'</tbody>'
    + '</table></div></div>';
}

function renderChannelBars(model){
  const max=Math.max(...Object.values(model.channelCounts),1);
  return Object.entries(model.channelCounts).sort((a,b)=>b[1]-a[1]).map(([channel,count],idx)=>
    '<div class="br"><div class="bla">'+channel+'</div><div class="bt"><div class="bf" style="width:'+(count/max*100).toFixed(1)+'%;background:'+ANALYTICS_BAR_COLORS[idx%ANALYTICS_BAR_COLORS.length]+'">'+count+'</div></div></div>'
  ).join('');
}

function renderAnalyticsVolumeSection(model){
  return '<div class="cg" style="margin-bottom:14px">'
    + '<div class="cc"><div class="ct">② 進線來源</div><div class="bc">'+renderChannelBars(model)+'</div></div>'
    + renderBarCard(model.handlerCounts,'👤 人員負責案件數')
    + '</div>';
}

function renderCategoryTableRows(model){
  return Object.entries(model.categorySummary).map(([category,info])=>{
    const topSubs=Object.entries(info.subs).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,count])=>escapeHtml(name)+'('+count+')').join('、');
    const rate=(info.total?info.closed/info.total*100:0).toFixed(0);
    const rateColor=rate>=80?'var(--green)':rate>=50?'var(--yellow)':'var(--red)';
    return '<tr><td style="font-weight:600">'+category+'</td><td style="text-align:center;font-weight:700">'+info.total+'</td><td style="text-align:center;color:var(--green)">'+info.closed+'</td><td style="text-align:center"><span style="color:'+rateColor+'">'+rate+'%</span></td><td style="font-size:10px;color:var(--text2)">'+topSubs+'</td></tr>';
  }).join('');
}

function renderAnalyticsCategorySection(model){
  return '<div style="margin-bottom:14px">'
    + '<div class="rpt-section-title">③ V2 問題分類統計（歷史案件自動回退舊分類）</div>'
    + '<div class="occ"><table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr style="background:var(--surface2)"><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">產品別</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">總件數</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">已結案</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">結案率</th><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">案件類型 → 問題大類／次分類</th></tr></thead>'
    + '<tbody>'+renderCategoryTableRows(model)+'</tbody>'
    + '</table></div></div>';
}

function renderOverdueRows(model){
  return model.overdueList.map(r=>{
    const caseDate=toDateValue(r.date);
    const days=caseDate?Math.floor((new Date()-caseDate)/864e5):'—';
    return '<tr><td><span class="mono" style="font-size:10px">'+r.id+'</span></td><td>'+escapeHtml(r.company)+'</td><td style="font-size:11px;color:var(--text2)">'+escapeHtml(analyticsSubcategory(r))+'</td><td><span class="badge badge-'+r.status+'">'+r.status+'</span></td><td style="font-size:11px">'+(r.handler||'—')+'</td><td style="color:var(--orange);font-weight:700">'+(typeof days==='number'?`${days}天`:'—')+'</td></tr>';
  }).join('');
}

function renderAnalyticsOverdueSection(model){
  const overdueRows=renderOverdueRows(model);
  return '<div style="margin-bottom:14px">'
    + '<div class="rpt-section-title">④ 超過7天未結案（'+model.overdueList.length+' 筆）</div>'
    + '<div class="occ">'
    + (overdueRows
      ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:9px 12px;font-size:10px;color:var(--text2)">編號</th><th style="padding:9px 12px;font-size:10px;color:var(--text2)">公司</th><th style="padding:9px 12px;font-size:10px;color:var(--text2)">問題</th><th style="padding:9px 12px;font-size:10px;color:var(--text2)">狀態</th><th style="padding:9px 12px;font-size:10px;color:var(--text2)">負責人</th><th style="padding:9px 12px;font-size:10px;color:var(--text2)">已逾</th></tr></thead><tbody>'+overdueRows+'</tbody></table>'
      : '<div style="padding:20px;text-align:center;color:var(--green);font-size:13px">✅ 本期無逾期未結案</div>')
    + '</div></div>';
}

function renderAnalyticsOverview(model){
  return '<div class="cg">'
    + renderDonutCard(model.statusCounts,'📊 處理狀態分佈')
    + renderBarCard(model.categoryCounts,'🏷️ 產品別案件排行')
    + '</div>';
}

async function exportWeeklyReport(){
  const from=document.getElementById('rptFrom').value;
  const to=document.getElementById('rptTo').value;
  if(from){
    const start=new Date(from+'T00:00:00');
    // Weekly reports run Saturday through Friday; complete a partial range.
    if(!Number.isNaN(start.getTime()) && start.getDay()===6){
      const friday=new Date(start);
      friday.setDate(friday.getDate()+6);
      const endKey=toLocalDateInputValue(friday);
      if(!to || to<endKey){
        document.getElementById('rptTo').value=endKey;
        renderAnalytics();
      }
    }
  }
  return downloadReport('weekly-report','週報');
}

async function exportMonthlyReport(){
  return downloadReport('monthly-report','月報');
}

function renderAnalytics(){
  const model=buildAnalyticsModel();
  const el=document.getElementById('analyticsContent');
  el.innerHTML=
    renderAnalyticsPeriod(model)
    + renderAnalyticsSummary(model)
    + renderAnalyticsOverview(model)
    + renderAnalyticsStatusSection(model)
    + renderAnalyticsVolumeSection(model)
    + renderAnalyticsCategorySection(model)
    + renderAnalyticsOverdueSection(model);
}

// Preview and export share the product summary; keep V2 fields in both periods.
function buildLegacyReportPayload(model,allRecords){
  // Keep V2 fields in report payload so the API can use the new classification.
  return {records:model.recs,from:model.from,to:model.to,all_records:allRecords,classification_version:REPORT_CLASSIFICATION_VERSION,classification_summary:model.categorySummary};
}


function getReportMonth(model){
  const source=model?.from || new Date().toISOString().slice(0,10);
  const match=String(source).match(/^(\d{4})-(\d{2})/);
  const now=new Date();
  return {year:match?Number(match[1]):now.getFullYear(),month:match?Number(match[2])-1:now.getMonth()};
}
function localDateKey(value){
  const date=toDateValue(value); if(!date) return '';
  const local=new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
}
function buildMonthlyWeeklySummary(model){
  const {year,month}=getReportMonth(model), first=new Date(year,month,1), last=new Date(year,month+1,0), weeks=[];
  let cursor=new Date(first);
  while(cursor<=last){
    const weekStart=new Date(cursor), day=(weekStart.getDay()+6)%7, weekEnd=new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate()+(6-day)); if(weekEnd>last) weekEnd.setTime(last.getTime());
    const startKey=localDateKey(weekStart), endKey=localDateKey(weekEnd);
    const created=model.recs.filter(r=>{const key=localDateKey(r.date);return key>=startKey&&key<=endKey;});
    const closed=model.recs.filter(r=>{const key=localDateKey(r.closeDate);return key>=startKey&&key<=endKey;});
    weeks.push({label:`第${weeks.length+1}週`,range:`${month+1}/${weekStart.getDate()}–${month+1}/${weekEnd.getDate()}`,created:created.length,closed:closed.length,open:created.filter(r=>r.status!=='結案').length});
    cursor=new Date(weekEnd); cursor.setDate(cursor.getDate()+1);
  }
  return {year,month,weeks};
}
function renderMonthlyWeeklySection(model){
  const summary=buildMonthlyWeeklySummary(model), monthLabel=`${summary.year}年${summary.month+1}月`;
  const rows=summary.weeks.map(week=>'<tr><td style="font-weight:700">'+week.label+'</td><td style="color:var(--text2)">'+week.range+'</td><td style="text-align:center;color:var(--accent);font-weight:700">'+week.created+'</td><td style="text-align:center;color:var(--green);font-weight:700">'+week.closed+'</td><td style="text-align:center;color:var(--yellow);font-weight:700">'+week.open+'</td></tr>').join('');
  return '<div style="margin-bottom:14px"><div class="rpt-section-title">⑤ '+monthLabel+'每週案件統計</div><div class="occ"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--surface2)"><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">週別</th><th style="padding:9px 12px;text-align:left;font-size:10px;color:var(--text2)">日期範圍</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">新增</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">結案</th><th style="padding:9px 12px;text-align:center;font-size:10px;color:var(--text2)">未結案</th></tr></thead><tbody>'+rows+'</tbody></table><div style="padding:8px 12px;color:var(--text3);font-size:11px">未結案＝該週新增案件中，目前狀態尚未結案。</div></div></div>';
}
const renderAnalyticsBase=renderAnalytics;
renderAnalytics=function(){renderAnalyticsBase();const model=buildAnalyticsModel();document.getElementById('analyticsContent').insertAdjacentHTML('beforeend',renderMonthlyWeeklySection(model));};
