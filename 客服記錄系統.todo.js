function openAnalyticsView(){
  const analyticsTab=document.querySelectorAll('.tab-btn')[1];
  if(analyticsTab) switchView('analytics',analyticsTab);
}

function toggleOverdueView(){
  document.getElementById('overdueBtn').click();
}

function createTodoItem({color,icon,text,action=''}){
  return {color,icon,text,action};
}

function getTodayTodoDateText(){
  return new Date().toISOString().slice(0,10);
}

function collectDailyTodos(){
  const todos=[];
  const overdueRecords=records.filter(record=>isDispatchOverdue(record));
  if(overdueRecords.length){
    todos.push(createTodoItem({color:'var(--orange)',icon:'⚠️',text:`${overdueRecords.length} 筆派工逾7天未結案`,action:'toggleOverdueView()'}));
  }
  const warningRecords=records.filter(record=>isDispatchWarning(record));
  if(warningRecords.length){
    todos.push(createTodoItem({color:'var(--yellow)',icon:'⏰',text:`${warningRecords.length} 筆案件快到7天`}));
  }
  const pendingInvoices=records.filter(record=>record.invoice===INVOICE_STATUS.pending);
  if(pendingInvoices.length){
    todos.push(createTodoItem({color:'var(--red)',icon:'🧾',text:`${pendingInvoices.length} 筆待開立發票`,action:'openAnalyticsView()'}));
  }
  const todayText=getTodayTodoDateText();
  const todayRecords=records.filter(record=>getDateOnlyText(record.date)===todayText);
  if(todayRecords.length){
    todos.push(createTodoItem({color:'var(--accent)',icon:'📥',text:`今日 ${todayRecords.length} 筆新進線`}));
  }
  return todos;
}

function renderTodoChip(todo){
  const cursorStyle=todo.action?'pointer':'default';
  const onClickAttr=todo.action?` onclick="${todo.action}"`:'';
  return `<span class="todo-chip" style="color:${todo.color};cursor:${cursorStyle}"${onClickAttr}>${todo.icon} ${todo.text}</span>`;
}

function renderDailyTodo(){
  const todoBar=document.getElementById('dailyTodo');
  const todoItems=document.getElementById('todoItems');
  const todos=collectDailyTodos();
  if(!todos.length){
    todoBar.style.display='none';
    return;
  }
  todoBar.style.display='';
  todoItems.innerHTML=todos.map(renderTodoChip).join('');
}
