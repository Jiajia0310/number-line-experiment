(() => {
  'use strict';
  const EXPERIMENT_ID = '9g92tharOXFX';
  const TARGETS = [2,4,9,11,14,17,23,26,31,38,44,45,52,59,61,66,73,78,84,86,92,99];
  const PRACTICE = [10,50,90];
  const COLUMNS = ['participant_id','phase','trial_index','trial_order','target_number','click_ratio','estimated_number','signed_error','absolute_error','reaction_time_ms','timestamp','screen_width','screen_height','user_agent','viewport_width','viewport_height','session_id','is_test'];
  const STORAGE_KEY = 'numberline_pending_v1';
  const isTest = new URLSearchParams(location.search).get('test') === '1';
  const app = document.querySelector('#app');
  const progress = document.querySelector('#progress');
  const diagnostics = { errors: [], upload: null };
  let run = null, active = false, uploading = false;
  window.addEventListener('error', e => diagnostics.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => diagnostics.errors.push(String(e.reason)));
  window.addEventListener('beforeunload', e => { if(active) { e.preventDefault(); e.returnValue = ''; } });

  function shuffle(values) {
    const result = [...values];
    for(let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i],result[j]] = [result[j],result[i]];
    }
    return result;
  }
  function stamp(date) {
    const pad = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }
  function persist() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(run)); }
    catch(error) { console.error('Local recovery storage unavailable', error); }
  }
  function clearSaved() {
    try { sessionStorage.removeItem(STORAGE_KEY); }
    catch(error) { console.error('Unable to clear local recovery record',error); }
  }
  function csv() {
    const cell = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
    return COLUMNS.join(',') + '\r\n' + run.rows.map(row => COLUMNS.map(k => cell(row[k])).join(',')).join('\r\n') + '\r\n';
  }
  function debugPanel() {
    if(!isTest) return;
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = '测试诊断（不改变试次数量或时序）';
    const pre = document.createElement('pre');
    pre.id = 'diagnostics';
    pre.textContent = JSON.stringify({filename:run?.filename,rows:run?.rows.length,practice:run?.rows.filter(r=>r.phase==='practice').length,formal:run?.rows.filter(r=>r.phase==='formal').length,...diagnostics},null,2);
    details.append(summary,pre); app.append(details);
  }
  function backupButton() {
    const button = document.createElement('button');
    button.className = 'secondary'; button.textContent = '下载数据备份';
    button.onclick = () => {
      const url = URL.createObjectURL(new Blob([csv()],{type:'text/csv;charset=utf-8'}));
      const a = document.createElement('a'); a.href = url; a.download = run.filename; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    app.append(button);
  }
  function retryControls() {
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox'; check.id = 'retry-confirm';
    check.style.cssText = 'display:inline;width:auto;margin:20px 10px 10px 0';
    label.append(check,document.createTextNode('研究人员已确认后台未接收本文件，并已修复接收设置或网络问题'));
    const button = document.createElement('button');
    button.textContent = '重新尝试保存'; button.disabled = true;
    check.onchange = () => { button.disabled = !check.checked; };
    button.onclick = () => { if(check.checked) upload(); };
    app.append(label,button);
  }
  function failed(result) {
    run.uploadState = 'failed'; run.lastResponse = result; persist();
    console.error('DataPipe upload failed', {experiment_id:EXPERIMENT_ID,filename:run.filename,...result});
    diagnostics.upload = result;
    app.innerHTML = '<h1 class="failure">数据保存失败，请暂时不要关闭页面，并联系研究人员。</h1><p>数据仍保留在当前页面。请下载备份交给研究人员；网络错误可能发生在服务器接收之后，请先核实后台记录，避免重复提交。</p>';
    progress.textContent = '保存失败';
    backupButton(); retryControls(); debugPanel();
  }
  async function upload() {
    if(uploading) return;
    uploading = true; run.uploadState = 'sending'; persist();
    progress.textContent = '正在保存';
    app.innerHTML = '<h1>正在保存数据…</h1><p>请暂时不要关闭或刷新页面。</p>';
    backupButton();
    const timeout = setTimeout(() => {
      app.querySelector('p').textContent = '上传仍在等待服务器响应，请保持页面开启。您可以先下载备份并联系研究人员。';
    },60000);
    try {
      if(!window.DataPipe?.saveData) throw new Error('DataPipe client could not be loaded');
      const result = await DataPipe.saveData({experiment_id:EXPERIMENT_ID,filename:run.filename,data:csv()});
      console.info('DataPipe upload result', {filename:run.filename,...result});
      diagnostics.upload = result;
      if(!result.ok || ![201,202].includes(result.status) || result.body?.error) { failed(result); return; }
      run.uploadState = result.status === 201 ? 'stored' : 'queued'; persist();
      active = false; clearSaved();
      progress.textContent = '数据已提交';
      app.innerHTML = '<h1 class="success">实验已完成，感谢您的参与。</h1><p id="save-status"></p>';
      document.querySelector('#save-status').textContent = result.status === 201
        ? '数据已成功保存。现在可以关闭页面。'
        : 'DataPipe 已安全接收数据，正在等待自动转存。请勿重复参加或重复提交。';
      debugPanel();
    } catch(error) { failed({ok:false,status:0,body:{error:String(error)}}); }
    finally { clearTimeout(timeout); uploading = false; }
  }
  function nextTrial() {
    if(run.rows.length === 25) { upload(); return; }
    if(run.rows.length === 3 && !run.formalStarted) {
      app.innerHTML = '<h1>练习结束</h1><p>接下来是 22 个正式试次。请尽可能准确地点击数轴上的对应位置。</p><button id="formal">开始正式实验</button>';
      document.querySelector('#formal').onclick = () => { run.formalStarted = true; persist(); nextTrial(); };
      return;
    }
    const index = run.rows.length;
    const phase = index < 3 ? 'practice' : 'formal';
    const order = phase === 'practice' ? index + 1 : index - 2;
    const target = phase === 'practice' ? PRACTICE[index] : run.order[index-3];
    progress.textContent = `${phase === 'practice' ? '练习' : '正式'} ${order} / ${phase === 'practice' ? 3 : 22}`;
    app.innerHTML = '<div class="trial"><p class="muted">请在数轴上点击目标数字对应的位置</p><div class="target" id="target">&nbsp;</div><div class="line-wrap"><div class="line-hit" id="line" aria-label="从 1 到 100 的数轴，请用鼠标点击"><span class="tick left"></span><span class="tick right"></span><span class="marker" id="marker" hidden></span></div><span class="end left">1</span><span class="end right">100</span></div><p class="status" id="status">请准备</p></div>';
    const line = document.querySelector('#line'), marker = document.querySelector('#marker');
    let locked = true, started = 0;
    setTimeout(() => {
      document.querySelector('#target').textContent = String(target);
      document.querySelector('#status').textContent = '点击一次即可确认，确认后不能修改';
      requestAnimationFrame(() => { started = performance.now(); locked = false; });
    },1000);
    line.addEventListener('pointerdown', event => {
      if(locked || event.button !== 0 || event.isPrimary === false) return;
      locked = true; // Lock synchronously before collecting or drawing anything.
      const reaction = performance.now() - started;
      const rect = line.getBoundingClientRect();
      const ratio = Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
      const estimate = 1 + ratio * 99;
      marker.hidden = false; marker.style.left = `${ratio*100}%`;
      run.rows.push({participant_id:run.participant,phase,trial_index:index,trial_order:order,target_number:target,click_ratio:ratio,estimated_number:estimate,signed_error:estimate-target,absolute_error:Math.abs(estimate-target),reaction_time_ms:reaction,timestamp:new Date().toISOString(),screen_width:screen.width,screen_height:screen.height,user_agent:navigator.userAgent,viewport_width:innerWidth,viewport_height:innerHeight,session_id:run.session,is_test:run.isTest});
      persist();
      document.querySelector('#status').textContent = '位置已确认';
      setTimeout(nextTrial,1000);
    });
  }
  function welcome() {
    app.innerHTML = '<h1>数轴标记实验</h1><p>欢迎参加实验。请填写研究人员分配的被试编号。</p><form id="entry"><label for="participant">被试编号 / participant_id</label><input id="participant" name="participant_id" maxlength="40" pattern="[A-Za-z0-9_-]{1,40}" placeholder="例如 S001" autocomplete="off" required><p class="muted">使用字母、数字、下划线或短横线，请勿填写姓名。实验数据将通过 DataPipe 保存至研究人员的 Google Drive。</p><button>阅读指导语</button></form>';
    document.querySelector('#entry').onsubmit = event => {
      event.preventDefault();
      const participant = document.querySelector('#participant').value.trim();
      if(!/^[A-Za-z0-9_-]{1,40}$/.test(participant)) return;
      const session = crypto.randomUUID();
      run = {participant,session,filename:`numberline_${participant}_${stamp(new Date())}_${session.slice(0,8)}.csv`,order:shuffle(TARGETS),rows:[],formalStarted:false,isTest,uploadState:'not_started'};
      app.innerHTML = '<h1>实验指导语</h1><p>屏幕上会出现一条从 <strong>1 到 100</strong> 的数轴，以及一个目标数字。请用鼠标在数轴上点击您认为该数字对应的位置。</p><p>每次先显示数轴 1 秒，再出现目标数字。点击一次后位置会立即锁定，不能修改；1 秒后进入下一题。</p><p>先完成 <strong>3 个练习试次</strong>，再完成 <strong>22 个正式试次</strong>。请尽可能准确地作答。完成后请等待数据保存结果。</p><button id="practice">开始练习</button>';
      document.querySelector('#practice').onclick = () => {active = true;persist();nextTrial();};
    };
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if(saved?.session && Array.isArray(saved.rows) && saved.rows.length <= 25) {
      run = saved; active = true;
      if(['sending','failed'].includes(run.uploadState)) {
        app.innerHTML = '<h1>检测到尚未确认的数据提交</h1><p>请暂时不要关闭页面，并联系研究人员核查 DataPipe 后台。本页不会自动重复上传。</p>';
        diagnostics.upload = run.lastResponse || null;
        backupButton(); retryControls(); debugPanel();
      } else if(['stored','queued'].includes(run.uploadState)) {
        active = false; clearSaved();
        app.innerHTML = '<h1>实验已完成，感谢您的参与。</h1>';
      } else {
        app.innerHTML = '<h1>继续实验</h1><p>检测到本标签页中尚未完成的实验。点击继续，从下一个未完成试次开始。</p><button id="resume">继续实验</button>';
        document.querySelector('#resume').onclick = nextTrial;
      }
    } else welcome();
  } catch(error) {console.error('Recovery state could not be read',error);welcome();}
})();
