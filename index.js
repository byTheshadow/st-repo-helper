// ============================================================
//  ST Repo 小助手 — index.js
//  阶段一：基础骨架 + 插件面板 + 消息选取
// ============================================================

(function () {
  'use strict';

  // ── 状态 ────────────────────────────────────────────────
  const state = {
    selectedMessages: [], // { id, role, name, content, element }
    redactWords: [],
    redactStyle: 'block', // 'block' | 'star' | 'blur'
    autoRedact: true,
    comment: '',
    theme: 'pink', // 'pink' | 'cyber' | 'paper'
  };

  // ── 面板 HTML ────────────────────────────────────────────
  const PANEL_HTML = `
<div id="repo-helper-panel">
  <div class="repo-section">
    <div class="repo-section-header">
      <span>已选楼层 <span id="repo-count">0</span></span>
      <button id="repo-clear-btn" class="repo-btn-small">清空</button>
    </div>
    <div id="repo-selected-list">
      <div class="repo-empty-hint">悬停消息，点击 ＋ 选取楼层</div>
    </div>
  </div>

  <div class="repo-section">
    <div class="repo-section-header">打码设置</div>
    <label class="repo-checkbox-label">
      <input type="checkbox" id="repo-auto-redact" checked />
      自动打码 {{user}} 名字
    </label>
    <div class="repo-row">
      <input type="text" id="repo-redact-input" placeholder="自定义打码词" />
      <button id="repo-redact-add" class="repo-btn-small">＋ 添加</button>
    </div>
    <div id="repo-redact-tags"></div>
    <div class="repo-radio-group">
      <label><input type="radio" name="redact-style" value="block" checked /> 黑块 ████</label>
      <label><input type="radio" name="redact-style" value="star" /> 星号 ***</label>
      <label><input type="radio" name="redact-style" value="blur" /> 模糊</label>
    </div>
  </div>

  <div class="repo-section">
    <div class="repo-section-header">我的评论</div>
    <textarea id="repo-comment" placeholder="写下你的 repo 评论…" rows="3"></textarea>
  </div>

  <div class="repo-section repo-section-footer">
    <div class="repo-theme-btns">
      <button class="repo-theme-btn active" data-theme="pink">🌸 粉嫩</button>
      <button class="repo-theme-btn" data-theme="cyber">🌃 赛博</button>
      <button class="repo-theme-btn" data-theme="paper">📄 简约</button>
    </div>
    <button id="repo-export-btn" class="repo-btn-primary">导出图片 ↓</button>
  </div>
</div>
`;

  // ── 注入面板 ─────────────────────────────────────────────
  function initPanel() {
    // ST 的插件面板挂载点
    const $settingsContainer = $('#extensions_settings');
    if (!$settingsContainer.length) {
      console.warn('[Repo小助手] 找不到 #extensions_settings，延迟重试');
      setTimeout(initPanel, 1000);
      return;
    }

    // 避免重复注入
    if ($('#repo-helper-panel').length) return;

    $settingsContainer.append(PANEL_HTML);
    bindPanelEvents();
    console.log('[Repo小助手] 面板已加载 ✓');
  }

  // ── 绑定面板事件 ─────────────────────────────────────────
  function bindPanelEvents() {
    // 清空已选
    $('#repo-clear-btn').on('click', () => {
      state.selectedMessages = [];
      // 移除所有消息的选中样式
      document.querySelectorAll('.mes.repo-selected').forEach(el => {
        el.classList.remove('repo-selected');
        const btn = el.querySelector('.repo-select-btn');
        if (btn) btn.textContent = '＋';
      });
      renderSelectedList();
    });

    // 自动打码开关
    $('#repo-auto-redact').on('change', function () {
      state.autoRedact = this.checked;
    });

    // 添加自定义打码词
    $('#repo-redact-add').on('click', addRedactWord);
    $('#repo-redact-input').on('keydown', function (e) {
      if (e.key === 'Enter') addRedactWord();
    });

    // 打码样式切换
    $('input[name="redact-style"]').on('change', function () {
      state.redactStyle = this.value;
    });

    // 评论输入
    $('#repo-comment').on('input', function () {
      state.comment = this.value;
    });

    // 主题切换
    $('.repo-theme-btn').on('click', function () {
      const theme = $(this).data('theme');
      state.theme = theme;
      $('.repo-theme-btn').removeClass('active');
      $(this).addClass('active');
    });

    // 导出按钮（阶段三实现，先占位）
    $('#repo-export-btn').on('click', () => {
      if (state.selectedMessages.length === 0) {
        alert('请先选取至少一条楼层！');
        return;
      }
      alert('导出功能将在阶段三实现 🚧');
    });
  }

  // ── 添加打码词 ───────────────────────────────────────────
  function addRedactWord() {
    const input = document.getElementById('repo-redact-input');
    const word = input.value.trim();
    if (!word || state.redactWords.includes(word)) {
      input.value = '';
      return;
    }
    state.redactWords.push(word);
    input.value = '';
    renderRedactTags();
  }

  function renderRedactTags() {
    const container = document.getElementById('repo-redact-tags');
    container.innerHTML = state.redactWords.map((w, i) => `
      <span class="repo-tag">
        ${escapeHtml(w)}
        <button class="repo-tag-remove" data-index="${i}">×</button>
      </span>
    `).join('');

    container.querySelectorAll('.repo-tag-remove').forEach(btn => {
      btn.addEventListener('click', function () {
        state.redactWords.splice(parseInt(this.dataset.index), 1);
        renderRedactTags();
      });
    });
  }

  // ── 渲染已选列表 ─────────────────────────────────────────
  function renderSelectedList() {
    const list = document.getElementById('repo-selected-list');
    const count = document.getElementById('repo-count');
    count.textContent = state.selectedMessages.length;

    if (state.selectedMessages.length === 0) {
      list.innerHTML = '<div class="repo-empty-hint">悬停消息，点击 ＋ 选取楼层</div>';
      return;
    }

    list.innerHTML = state.selectedMessages.map((msg, i) => `
      <div class="repo-selected-item">
        <button class="repo-item-remove" data-index="${i}">×</button>
        <span class="repo-item-role">${escapeHtml(msg.name)}</span>
        <span class="repo-item-preview">${escapeHtml(truncate(msg.content, 30))}</span>
      </div>
    `).join('');

    list.querySelectorAll('.repo-item-remove').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.index);
        const msg = state.selectedMessages[idx];
        // 取消消息高亮
        if (msg.element) {
          msg.element.classList.remove('repo-selected');
          const selectBtn = msg.element.querySelector('.repo-select-btn');
          if (selectBtn) selectBtn.textContent = '＋';
        }
        state.selectedMessages.splice(idx, 1);
        renderSelectedList();
      });
    });
  }

  // ── 消息选取按钮注入 ─────────────────────────────────────
  function injectSelectButton(mesElement) {
    if (mesElement.querySelector('.repo-select-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'repo-select-btn';
    btn.textContent = '＋';
    btn.title = '选取此楼层';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelectMessage(mesElement);
    });

    mesElement.appendChild(btn);
  }

  function toggleSelectMessage(mesElement) {
    const isSelected = mesElement.classList.contains('repo-selected');

    if (isSelected) {
      // 取消选取
      mesElement.classList.remove('repo-selected');
      const btn = mesElement.querySelector('.repo-select-btn');
      if (btn) btn.textContent = '＋';

      state.selectedMessages = state.selectedMessages.filter(
        m => m.element !== mesElement
      );
    } else {
      // 选取
      mesElement.classList.add('repo-selected');
      const btn = mesElement.querySelector('.repo-select-btn');
      if (btn) btn.textContent = '✓';

      // 提取消息内容
      const msgData = extractMessageData(mesElement);
      state.selectedMessages.push(msgData);
    }

    renderSelectedList();
  }

  function extractMessageData(mesElement) {
    // ST 消息结构：.mes_block > .mes_text 存放正文
    // .name_text 存放角色名，.mes[is_user] 区分用户/AI
    const isUser = mesElement.getAttribute('is_user') === 'true';
    const nameEl = mesElement.querySelector('.name_text');
    const textEl = mesElement.querySelector('.mes_text');

    return {
      id: mesElement.getAttribute('mesid') || Date.now().toString(),
      role: isUser ? 'user' : 'assistant',
      name: nameEl ? nameEl.textContent.trim() : (isUser ? '用户' : 'AI'),
      content: textEl ? textEl.innerText.trim() : '',
      element: mesElement,
    };
  }

  // ── MutationObserver 监听新消息 ──────────────────────────
  function observeChat() {
    const chat = document.getElementById('chat');
    if (!chat) {
      setTimeout(observeChat, 1000);
      return;
    }

    // 给已有消息注入按钮
    chat.querySelectorAll('.mes').forEach(injectSelectButton);

    // 监听新消息
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.classList.contains('mes')) {
              injectSelectButton(node);
            }
            // 子节点里也可能有 .mes
            node.querySelectorAll && node.querySelectorAll('.mes').forEach(injectSelectButton);
          }
        });
      });
    });

    observer.observe(chat, { childList: true, subtree: true });
    console.log('[Repo小助手] 消息监听已启动 ✓');
  }

  // ── 工具函数 ─────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  // ── 入口 ─────────────────────────────────────────────────
  function init() {
    initPanel();
    observeChat();
  }

  // ST 加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
