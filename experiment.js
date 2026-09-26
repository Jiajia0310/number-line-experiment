(() => {
  'use strict';

  // ============================================================
  // 基本实验设置
  // ============================================================

  const EXPERIMENT_ID = '9g92tharOXFX';

  // 22 个正式实验数字
  const TARGETS = [
    2, 4, 9, 11, 14, 17, 23, 26, 31, 38, 44, 45,
    52, 59, 61, 66, 73, 78, 84, 86, 92, 99
  ];

  // 3 个练习数字
  const PRACTICE = [10, 50, 90];

  // 最终 CSV 中保存的所有变量
  const COLUMNS = [
    'participant_id',
    'phase',
    'trial_index',
    'trial_order',
    'target_number',
    'click_ratio',
    'estimated_number',
    'signed_error',
    'absolute_error',
    'reaction_time_ms',
    'timestamp',
    'screen_width',
    'screen_height',
    'user_agent',
    'viewport_width',
    'viewport_height',
    'session_id',
    'is_test',

    // 整体结果
    'accuracy_score',
    'total_response_time_ms'
  ];

  const STORAGE_KEY = 'numberline_pending_v1';

  const isTest =
    new URLSearchParams(location.search).get('test') === '1';

  const app = document.querySelector('#app');
  const progress = document.querySelector('#progress');

  const diagnostics = {
    errors: [],
    upload: null
  };

  let run = null;
  let active = false;
  let uploading = false;


  // ============================================================
  // 全局错误监听
  // ============================================================

  window.addEventListener('error', event => {
    diagnostics.errors.push(String(event.message));
  });

  window.addEventListener('unhandledrejection', event => {
    diagnostics.errors.push(String(event.reason));
  });

  window.addEventListener('beforeunload', event => {
    if (active) {
      event.preventDefault();
      event.returnValue = '';
    }
  });


  // ============================================================
  // 随机化
  // ============================================================

  function shuffle(values) {
    const result = [...values];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [result[i], result[j]] = [
        result[j],
        result[i]
      ];
    }

    return result;
  }


  // ============================================================
  // 时间戳
  // ============================================================

  function stamp(date) {

    const pad = n =>
      String(n).padStart(2, '0');

    return (
      `${date.getFullYear()}` +
      `${pad(date.getMonth() + 1)}` +
      `${pad(date.getDate())}_` +
      `${pad(date.getHours())}` +
      `${pad(date.getMinutes())}` +
      `${pad(date.getSeconds())}`
    );
  }


  // ============================================================
  // 本地临时保存
  // ============================================================

  function persist() {

    try {

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(run)
      );

    } catch (error) {

      console.error(
        'Local recovery storage unavailable',
        error
      );

    }
  }


  function clearSaved() {

    try {

      sessionStorage.removeItem(STORAGE_KEY);

    } catch (error) {

      console.error(
        'Unable to clear local recovery record',
        error
      );

    }
  }


  // ============================================================
  // 计算正式实验总分和总反应时间
  // ============================================================

  function calculateSummary() {

    const formalRows =
      run.rows.filter(
        row => row.phase === 'formal'
      );

    if (formalRows.length === 0) {

      return {
        accuracyScore: 0,
        totalResponseTime: 0
      };
    }


    // --------------------------------------------
    // 正式实验绝对误差总和
    // --------------------------------------------

    const totalAbsoluteError =
      formalRows.reduce(
        (sum, row) =>
          sum + Number(row.absolute_error),
        0
      );


    // --------------------------------------------
    // 正式实验总反应时间
    // --------------------------------------------

    const totalResponseTime =
      formalRows.reduce(
        (sum, row) =>
          sum + Number(row.reaction_time_ms),
        0
      );


    /*
      原 PsychoPy 程序：

      accuracy =
      100 * (
        1 -
        total_error /
        (600 * trial_count)
      )

      原数轴跨度：
      -300 ～ +300
      共 600 pixel

      网页版已经把位置标准化为 1～100，
      因此整个数轴跨度为 99 个数值单位。

      所以使用：

      accuracy =
      100 * (
        1 -
        total_absolute_error /
        (99 * trial_count)
      )

      这与原来的“相对于整个数轴跨度计算准确率”
      的思想保持一致，同时避免受电脑分辨率影响。
    */

    let accuracyScore =
      100 *
      (
        1 -
        totalAbsoluteError /
        (99 * formalRows.length)
      );


    // 防止极端情况下超过范围
    accuracyScore =
      Math.max(
        0,
        Math.min(
          100,
          accuracyScore
        )
      );


    accuracyScore =
      Number(
        accuracyScore.toFixed(2)
      );


    const roundedResponseTime =
      Math.round(
        totalResponseTime
      );


    return {
      accuracyScore,
      totalResponseTime:
        roundedResponseTime
    };
  }


  // ============================================================
  // 把整体结果加入 CSV 数据
  // ============================================================

  function attachSummaryToRows() {

    const summary =
      calculateSummary();


    run.summary = {
      accuracy_score:
        summary.accuracyScore,

      total_response_time_ms:
        summary.totalResponseTime
    };


    /*
      为了不改变原来的 25 行数据结构，
      不额外创建 summary row。

      将两个整体指标记录在整个 CSV 中。
      每一行都会保存相同的整体结果。

      这样后续无论读取哪一行，
      都可以获得这个被试的总分和总反应时间。
    */

    run.rows.forEach(row => {

      row.accuracy_score =
        summary.accuracyScore;

      row.total_response_time_ms =
        summary.totalResponseTime;

    });


    persist();

    return summary;
  }


  // ============================================================
  // 生成 CSV
  // ============================================================

  function csv() {

    const cell = value =>
      '"' +
      String(value ?? '')
        .replaceAll('"', '""') +
      '"';


    return (
      COLUMNS.join(',') +
      '\r\n' +

      run.rows
        .map(
          row =>
            COLUMNS
              .map(
                key =>
                  cell(row[key])
              )
              .join(',')
        )
        .join('\r\n') +

      '\r\n'
    );
  }


  // ============================================================
  // 测试诊断面板
  // ============================================================

  function debugPanel() {

    if (!isTest) return;


    const details =
      document.createElement('details');

    details.open = true;


    const summary =
      document.createElement('summary');

    summary.textContent =
      '测试诊断';


    const pre =
      document.createElement('pre');

    pre.id =
      'diagnostics';


    pre.textContent =
      JSON.stringify(
        {
          filename:
            run?.filename,

          rows:
            run?.rows.length,

          practice:
            run?.rows.filter(
              row =>
                row.phase === 'practice'
            ).length,

          formal:
            run?.rows.filter(
              row =>
                row.phase === 'formal'
            ).length,

          summary:
            run?.summary,

          ...diagnostics
        },
        null,
        2
      );


    details.append(
      summary,
      pre
    );

    app.append(details);
  }


  // ============================================================
  // 下载备份
  // ============================================================

  function backupButton() {

    const button =
      document.createElement('button');

    button.className =
      'secondary';

    button.textContent =
      '下载数据备份';


    button.onclick = () => {

      const url =
        URL.createObjectURL(
          new Blob(
            [csv()],
            {
              type:
                'text/csv;charset=utf-8'
            }
          )
        );


      const a =
        document.createElement('a');

      a.href =
        url;

      a.download =
        run.filename;

      a.click();


      setTimeout(
        () =>
          URL.revokeObjectURL(url),
        1000
      );
    };


    app.append(button);
  }


  // ============================================================
  // DataPipe 重试
  // ============================================================

  function retryControls() {

    const label =
      document.createElement('label');


    const check =
      document.createElement('input');

    check.type =
      'checkbox';

    check.id =
      'retry-confirm';

    check.style.cssText =
      'display:inline;width:auto;margin:20px 10px 10px 0';


    label.append(
      check,
      document.createTextNode(
        '研究人员已确认后台未接收本文件，并已修复接收设置或网络问题'
      )
    );


    const button =
      document.createElement('button');

    button.textContent =
      '重新尝试保存';

    button.disabled =
      true;


    check.onchange = () => {

      button.disabled =
        !check.checked;

    };


    button.onclick = () => {

      if (check.checked) {
        upload();
      }

    };


    app.append(
      label,
      button
    );
  }


  // ============================================================
  // DataPipe 上传失败
  // ============================================================

  function failed(result) {

    run.uploadState =
      'failed';

    run.lastResponse =
      result;

    persist();


    console.error(
      'DataPipe upload failed',
      {
        experiment_id:
          EXPERIMENT_ID,

        filename:
          run.filename,

        ...result
      }
    );


    diagnostics.upload =
      result;


    app.innerHTML =
      `
      <h1 class="failure">
        数据保存失败，请暂时不要关闭页面，并联系研究人员。
      </h1>

      <p>
        数据仍保留在当前页面。
        请下载备份交给研究人员；
        网络错误可能发生在服务器接收之后，
        请先核实后台记录，避免重复提交。
      </p>
      `;


    progress.textContent =
      '保存失败';


    backupButton();

    retryControls();

    debugPanel();
  }


  // ============================================================
  // DataPipe 上传
  // ============================================================

  async function upload() {

    if (uploading) return;


    uploading = true;

    run.uploadState =
      'sending';

    persist();


    progress.textContent =
      '正在保存';


    app.innerHTML =
      `
      <h1>
        正在保存数据…
      </h1>

      <p>
        请暂时不要关闭或刷新页面。
      </p>
      `;


    backupButton();


    const timeout =
      setTimeout(
        () => {

          const p =
            app.querySelector('p');

          if (p) {

            p.textContent =
              '上传仍在等待服务器响应，请保持页面开启。您可以先下载备份并联系研究人员。';

          }

        },
        60000
      );


    try {

      if (
        !window.DataPipe?.saveData
      ) {

        throw new Error(
          'DataPipe client could not be loaded'
        );

      }


      const result =
        await DataPipe.saveData(
          {
            experiment_id:
              EXPERIMENT_ID,

            filename:
              run.filename,

            data:
              csv()
          }
        );


      console.info(
        'DataPipe upload result',
        {
          filename:
            run.filename,

          ...result
        }
      );


      diagnostics.upload =
        result;


      if (
        !result.ok ||
        ![201, 202]
          .includes(result.status) ||
        result.body?.error
      ) {

        failed(result);

        return;
      }


      run.uploadState =
        result.status === 201
          ? 'stored'
          : 'queued';


      persist();


      active =
        false;


      const summary =
        run.summary ||
        calculateSummary();


      clearSaved();


      progress.textContent =
        '数据已提交';


      // ========================================================
      // 实验结束结果页面
      // ========================================================

      app.innerHTML =
        `
        <div class="result-page">

          <h1 class="success">
            实验已完成
          </h1>

          <div
            style="
              max-width:520px;
              margin:30px auto;
              font-size:20px;
            "
          >

            <table
              style="
                width:100%;
                border-collapse:collapse;
                text-align:left;
              "
            >

              <tr>

                <td
                  style="
                    padding:14px;
                    border-bottom:1px solid #ddd;
                  "
                >
                  总分（准确性评分）
                </td>

                <td
                  style="
                    padding:14px;
                    border-bottom:1px solid #ddd;
                    text-align:right;
                    font-weight:bold;
                  "
                >
                  ${summary.accuracy_score}/100
                </td>

              </tr>


              <tr>

                <td
                  style="
                    padding:14px;
                  "
                >
                  总反应时间（毫秒）
                </td>

                <td
                  style="
                    padding:14px;
                    text-align:right;
                    font-weight:bold;
                  "
                >
                  ${summary.total_response_time_ms}
                </td>

              </tr>

            </table>

          </div>


          <p>
            感谢您的参与。
          </p>


          <p
            id="save-status"
            class="muted"
          ></p>

        </div>
        `;


      document
        .querySelector(
          '#save-status'
        )
        .textContent =
          result.status === 201

            ? '数据已成功保存。现在可以关闭页面。'

            : '数据已安全接收，请勿重复参加或重复提交。';


      debugPanel();

    } catch (error) {

      failed(
        {
          ok:
            false,

          status:
            0,

          body:
            {
              error:
                String(error)
            }
        }
      );

    } finally {

      clearTimeout(
        timeout
      );

      uploading =
        false;

    }
  }


  // ============================================================
  // Trial
  // ============================================================

  function nextTrial() {

    /*
      共：
      3 个练习
      +
      22 个正式
      =
      25 行 trial 数据
    */

    if (
      run.rows.length === 25
    ) {

      // 先计算整体结果
      attachSummaryToRows();

      // 再上传
      upload();

      return;
    }


    // ==========================================================
    // 练习结束
    // ==========================================================

    if (
      run.rows.length === 3 &&
      !run.formalStarted
    ) {

      progress.textContent =
        '';


      app.innerHTML =
        `
        <h1>
          练习结束
        </h1>

        <p>
          接下来进入正式实验。
          请继续按照刚才的方式进行判断，
          并尽可能准确地完成实验。
        </p>

        <button id="formal">
          开始正式实验
        </button>
        `;


      document
        .querySelector(
          '#formal'
        )
        .onclick = () => {

          run.formalStarted =
            true;

          persist();

          nextTrial();

        };


      return;
    }


    const index =
      run.rows.length;


    const phase =
      index < 3
        ? 'practice'
        : 'formal';


    const order =
      phase === 'practice'
        ? index + 1
        : index - 2;


    const target =
      phase === 'practice'

        ? PRACTICE[index]

        : run.order[
            index - 3
          ];


    // ==========================================================
    // 不向被试显示试次序号
    // ==========================================================

    progress.textContent =
      '';


    // ==========================================================
    // 先显示数轴
    // ==========================================================

    app.innerHTML =
      `
      <div class="trial">

        <div
          class="target"
          id="target"
        >
          &nbsp;
        </div>


        <div
          class="line-wrap"
        >

          <div
            class="line-hit"
            id="line"
            aria-label="从 1 到 100 的数轴，请用鼠标点击"
          >

            <span
              class="tick left"
            ></span>

            <span
              class="tick right"
            ></span>

            <span
              class="marker"
              id="marker"
              hidden
            ></span>

          </div>


          <span
            class="end left"
          >
            1
          </span>


          <span
            class="end right"
          >
            100
          </span>

        </div>


        <p
          class="status"
          id="status"
        >
          请准备
        </p>

      </div>
      `;


    const line =
      document.querySelector(
        '#line'
      );


    const marker =
      document.querySelector(
        '#marker'
      );


    // ==========================================================
    // 将 marker 设置成 PsychoPy 风格红色圆点
    // ==========================================================

    line.style.position =
      'relative';


    marker.style.position =
      'absolute';

    marker.style.width =
      '10px';

    marker.style.height =
      '10px';

    marker.style.borderRadius =
      '50%';

    marker.style.background =
      'red';

    marker.style.top =
      '50%';

    marker.style.transform =
      'translate(-50%, -50%)';

    marker.style.pointerEvents =
      'none';

    marker.style.zIndex =
      '10';


    let locked =
      true;

    let started =
      0;


    // ==========================================================
    // 先显示数轴 1 秒，再显示数字
    // ==========================================================

    setTimeout(
      () => {

        document
          .querySelector(
            '#target'
          )
          .textContent =
            String(target);


        document
          .querySelector(
            '#status'
          )
          .textContent =
            '';


        requestAnimationFrame(
          () => {

            started =
              performance.now();

            locked =
              false;

          }
        );

      },
      1000
    );


    // ==========================================================
    // PsychoPy 风格：
    // 鼠标在数轴上移动时红色圆点实时跟随
    // ==========================================================

    line.addEventListener(
      'pointermove',
      event => {

        // 数字尚未出现或者已经点击后，
        // 不再更新光标位置
        if (locked) return;


        const rect =
          line.getBoundingClientRect();


        const ratio =
          Math.max(
            0,
            Math.min(
              1,
              (
                event.clientX -
                rect.left
              ) /
              rect.width
            )
          );


        marker.hidden =
          false;


        marker.style.left =
          `${ratio * 100}%`;

      }
    );


    // 鼠标离开数轴时，
    // 在尚未确认的情况下隐藏红点
    line.addEventListener(
      'pointerleave',
      () => {

        if (!locked) {

          marker.hidden =
            true;

        }

      }
    );


    // 再次进入数轴
    line.addEventListener(
      'pointerenter',
      event => {

        if (locked) return;


        const rect =
          line.getBoundingClientRect();


        const ratio =
          Math.max(
            0,
            Math.min(
              1,
              (
                event.clientX -
                rect.left
              ) /
              rect.width
            )
          );


        marker.hidden =
          false;


        marker.style.left =
          `${ratio * 100}%`;

      }
    );


    // ==========================================================
    // 点击确认
    // ==========================================================

    line.addEventListener(
      'pointerdown',
      event => {

        if (
          locked ||
          event.button !== 0 ||
          event.isPrimary === false
        ) {

          return;

        }


        // 点击后立即锁定
        locked =
          true;


        const reaction =
          performance.now() -
          started;


        const rect =
          line.getBoundingClientRect();


        const ratio =
          Math.max(
            0,
            Math.min(
              1,
              (
                event.clientX -
                rect.left
              ) /
              rect.width
            )
          );


        // ======================================================
        // 根据 1～100 数轴计算被试估计值
        // ======================================================

        const estimate =
          1 +
          ratio * 99;


        // 点击位置固定
        marker.hidden =
          false;


        marker.style.left =
          `${ratio * 100}%`;


        // ======================================================
        // 保存 Trial 数据
        // ======================================================

        run.rows.push(
          {

            participant_id:
              run.participant,

            phase:
              phase,

            trial_index:
              index,

            trial_order:
              order,

            target_number:
              target,

            click_ratio:
              ratio,

            estimated_number:
              estimate,

            signed_error:
              estimate -
              target,

            absolute_error:
              Math.abs(
                estimate -
                target
              ),

            reaction_time_ms:
              reaction,

            timestamp:
              new Date()
                .toISOString(),

            screen_width:
              screen.width,

            screen_height:
              screen.height,

            user_agent:
              navigator.userAgent,

            viewport_width:
              innerWidth,

            viewport_height:
              innerHeight,

            session_id:
              run.session,

            is_test:
              run.isTest,

            // 实验结束前统一填写
            accuracy_score:
              '',

            total_response_time_ms:
              ''
          }
        );


        persist();


        document
          .querySelector(
            '#status'
          )
          .textContent =
            '位置已确认';


        // ======================================================
        // 与原 PsychoPy 相同：
        // 点击后等待 1 秒进入下一题
        // ======================================================

        setTimeout(
          nextTrial,
          1000
        );

      }
    );
  }


  // ============================================================
  // 欢迎页 + 被试编号
  // ============================================================

  function welcome() {

    progress.textContent =
      '';


    app.innerHTML =
      `
      <h1>
        数轴标记实验
      </h1>


      <p>
        请填写研究人员分配的被试编号。
      </p>


      <form
        id="entry"
      >

        <label
          for="participant"
        >
          被试编号
        </label>


        <input
          id="participant"
          name="participant_id"
          maxlength="40"
          pattern="[A-Za-z0-9_-]{1,40}"
          placeholder="例如 S001"
          autocomplete="off"
          required
        >


        <p
          class="muted"
        >
          请填写研究人员分配的实验编号，
          请勿填写姓名。
        </p>


        <button>
          继续
        </button>

      </form>
      `;


    document
      .querySelector(
        '#entry'
      )
      .onsubmit =
        event => {

          event.preventDefault();


          const participant =
            document
              .querySelector(
                '#participant'
              )
              .value
              .trim();


          if (
            !/^[A-Za-z0-9_-]{1,40}$/
              .test(
                participant
              )
          ) {

            return;
          }


          const session =
            crypto.randomUUID();


          run = {

            participant:
              participant,

            session:
              session,

            filename:
              `numberline_${participant}_${stamp(new Date())}_${session.slice(0, 8)}.csv`,

            order:
              shuffle(
                TARGETS
              ),

            rows:
              [],

            formalStarted:
              false,

            isTest:
              isTest,

            uploadState:
              'not_started',

            summary:
              null
          };


          // ====================================================
          // 新指导语
          // ====================================================

          app.innerHTML =
            `
            <h1>
              实验指导语
            </h1>


            <p>
              欢迎参加数字线标记实验！
            </p>


            <p>
              实验中，屏幕上会呈现一条从
              <strong>1 到 100</strong>
              的数轴，并显示一个目标数字。
            </p>


            <p>
              请根据你的判断，将鼠标移动到数轴上你认为该数字对应的位置，并点击鼠标进行确认。
            </p>


            <p>
              每次点击后，所选位置将被记录并进入下一题。请尽量按照自己的直觉进行判断，同时保证作答准确。
            </p>


            <p>
              实验开始前请确认已准备好，并在整个过程中保持专注。
            </p>


            <p>
              准备好后，请点击“开始实验”。
            </p>


            <button
              id="practice"
            >
              开始实验
            </button>
            `;


          document
            .querySelector(
              '#practice'
            )
            .onclick =
              () => {

                active =
                  true;

                persist();

                nextTrial();

              };

        };
  }


  // ============================================================
  // 页面恢复
  // ============================================================

  try {

    const saved =
      JSON.parse(
        sessionStorage
          .getItem(
            STORAGE_KEY
          ) ||
        'null'
      );


    if (
      saved?.session &&
      Array.isArray(
        saved.rows
      ) &&
      saved.rows.length <= 25
    ) {

      run =
        saved;


      active =
        true;


      if (
        [
          'sending',
          'failed'
        ].includes(
          run.uploadState
        )
      ) {

        app.innerHTML =
          `
          <h1>
            检测到尚未确认的数据提交
          </h1>

          <p>
            请暂时不要关闭页面，
            并联系研究人员核查 DataPipe 后台。
            本页不会自动重复上传。
          </p>
          `;


        diagnostics.upload =
          run.lastResponse ||
          null;


        backupButton();

        retryControls();

        debugPanel();


      } else if (
        [
          'stored',
          'queued'
        ].includes(
          run.uploadState
        )
      ) {

        active =
          false;


        const summary =
          run.summary ||
          calculateSummary();


        clearSaved();


        app.innerHTML =
          `
          <h1>
            实验已完成
          </h1>

          <p>
            总分（准确性评分）：
            <strong>
              ${summary.accuracy_score}/100
            </strong>
          </p>

          <p>
            总反应时间（毫秒）：
            <strong>
              ${summary.total_response_time_ms}
            </strong>
          </p>

          <p>
            感谢您的参与。
          </p>
          `;


      } else {

        app.innerHTML =
          `
          <h1>
            继续实验
          </h1>

          <p>
            检测到本标签页中尚未完成的实验。
            点击继续，从上一次未完成的位置继续。
          </p>

          <button
            id="resume"
          >
            继续实验
          </button>
          `;


        document
          .querySelector(
            '#resume'
          )
          .onclick =
            nextTrial;

      }


    } else {

      welcome();

    }

  } catch (error) {

    console.error(
      'Recovery state could not be read',
      error
    );


    welcome();
  }

})();