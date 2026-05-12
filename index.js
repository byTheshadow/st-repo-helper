/**
 * Repo小助手 (st-repo-helper)
 * Phase 1 — 插件骨架 + 楼层选取系统
 *
 * 架构说明：
 *  - 所有面板 HTML 通过模板字符串内联生成，无需外部 HTML 文件
 *  - 状态全部存储在顶层 RepoState 对象中
 *  - 各功能模块以 IIFE 风格组织，挂载到 RepoHelper 命名空间
 */

(function () {
  'use strict';

  /* ============================================================
     0. 常量 & 配置
     ============================================================ */

  const PLUGIN_ID   = 'repo-helper';
  const PLUGIN_NAME = 'Repo小助手';
  const STORAGE_KEY = 'repo_helper_state';

  /* ============================================================
     1. 全局状态
     ============================================================ */

  /**
   * RepoState — 插件运行时状态
   * selectedMessages: Map<messageId, { id, floor, sender, isUser, text, element }>
   * orderedIds: string[]  — 维护拖拽后的顺序
   * currentTheme: string
   */
  const RepoState = {
    selectedMessages : new Map(),
    orderedIds       : [],
    currentTheme     : 'sakura',
    dragSrcId        : null,   // 拖拽排序用
  };

  /* ============================================================
     2. 工具函数
     ============================================================ */

  /** 显示底部 Toast 通知 */
  function showToast(msg, duration = 2200) {
    let el = document.getElementById('repo-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'repo-toast';
      el.className = 'repo-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  /** 从消息元素中提取纯文本预览（截断到 60 字） */
  function extractPreview(mesEl) {
    const textEl = mesEl.querySelector('.mes_text');
    if (!textEl) return '';
    return (textEl.innerText || textEl.textContent || '').trim().slice(0, 60);
  }

  /** 获取消息的发送者名称 */
  function extractSender(mesEl) {
    const nameEl = mesEl.querySelector('.name_text');
    if (nameEl) return (nameEl.innerText || nameEl.textContent || '').trim();
    // 回退：判断是否是 user 消息
    return mesEl.classList.contains('is_user') ? (window.name1 || '用户') : (window.name2 || 'AI');
  }

  /** 判断是否是用户消息 */
  function isUserMessage(mesEl) {
    return mesEl.classList.contains('is_user');
  }

  /** 获取消息楼层号（data-mesid 属性） */
  function getFloorNumber(mesEl) {
    return mesEl.getAttribute('data-mesid') ?? mesEl.getAttribute('mesid') ?? '?';
  }

  /** 获取当前聊天中所有消息元素，按楼层排序 */
  function getAllMessages() {
    return Array.from(document.querySelectorAll('#chat .mes'));
  }

  /* ============================================================
     3. 楼层选取核心逻辑
     ============================================================ */

  const SelectionManager = {

    /** 切换某条消息的选中状态 */
    toggle(mesEl) {
      const id = getFloorNumber(mesEl);
      if (RepoState.selectedMessages.has(id)) {
        this.deselect(mesEl, id);
      } else {
        this.select(mesEl, id);
      }
      this.syncUI();
    },

    /** 选中一条消息 */
    select(mesEl, id) {
      id = id ?? getFloorNumber(mesEl);
      if (RepoState.selectedMessages.has(id)) return;

      RepoState.selectedMessages.set(id, {
        id,
        floor  : id,
        sender : extractSender(mesEl),
        isUser : isUserMessage(mesEl),
        text   : extractPreview(mesEl),
        element: mesEl,
      });
      RepoState.orderedIds.push(id);

      mesEl.classList.add('repo-selected');
      const btn = mesEl.querySelector('.repo-select-btn');
      if (btn) btn.classList.add('selected');
    },

    /** 取消选中一条消息 */
    deselect(mesEl, id) {
      id = id ?? getFloorNumber(mesEl);
      RepoState.selectedMessages.delete(id);
      RepoState.orderedIds = RepoState.orderedIds.filter(x => x !== id);

      mesEl.classList.remove('repo-selected');
      const btn = mesEl.querySelector('.repo-select-btn');
      if (btn) btn.classList.remove('selected');
    },

    /** 通过 id 移除（从已选列表面板调用） */
    removeById(id) {
      const data = RepoState.selectedMessages.get(id);
      if (data && data.element) {
        this.deselect(data.element, id);
      } else {
        // 元素可能已不在 DOM（翻页等情况），直接清理状态
        RepoState.selectedMessages.delete(id);
        RepoState.orderedIds = RepoState.orderedIds.filter(x => x !== id);
      }
      this.syncUI();
    },

    /** 范围选取：从 floorA 到 floorB（含两端，支持反向） */
    selectRange(floorA, floorB) {
      const all = getAllMessages();
      const a = Math.min(floorA, floorB);
      const b = Math.max(floorA, floorB);
      let count = 0;
      all.forEach(mesEl => {
        const f = parseInt(getFloorNumber(mesEl), 10);
        if (!isNaN(f) && f >= a && f <= b) {
          if (!RepoState.selectedMessages.has(String(f))) {
            this.select(mesEl, String(f));
            count++;
          }
        }
      });
      this.syncUI();
      showToast(`已选取第 ${a}～${b} 楼，新增 ${count} 条`);
    },

    /** 清空所有选中 */
    clearAll() {
      getAllMessages().forEach(mesEl => {
        mesEl.classList.remove('repo-selected');
        const btn = mesEl.querySelector('.repo-select-btn');
        if (btn) btn.classList.remove('selected');
      });
      RepoState.selectedMessages.clear();
      RepoState.orderedIds = [];
      this.syncUI();
      showToast('已清空选取');
    },

    /** 同步面板 UI（已选列表 + 计数徽章） */
    syncUI() {
      renderSelectedList();
      updateCountBadge();
    },
  };

  /* ============================================================
     4. 面板 HTML 模板
     ============================================================ */

  function buildPanelHTML() {
    return `
<div id="repo-helper-panel">

  <!-- 标题栏 -->
  <div class="repo-panel-header">
    <span class="repo-panel-title">📋 Repo小助手</span>
    <span style="font-size:11px;opacity:0.4;">v0.1</span>
  </div>

  <!-- Tab 导航 -->
  <div class="repo-tabs">
    <button class="repo-tab-btn active" data-tab="select">
      选取 <span class="repo-count-badge" id="repo-count-badge">0</span>
    </button>
    <button class="repo-tab-btn" data-tab="theme">主题</button>
    <button class="repo-tab-btn" data-tab="export">导出</button>
  </div>

  <!-- ── Tab: 选取 ── -->
  <div class="repo-tab-content active" data-tab-content="select">

    <!-- 工具栏 -->
    <div class="repo-toolbar">
      <button class="repo-btn" id="repo-btn-clear-all">🗑 清空</button>
      <button class="repo-btn" id="repo-btn-select-all">全选当前</button>
      <button class="repo-btn" id="repo-btn-invert">反选</button>
    </div>

    <!-- 范围快选 -->
    <div class="repo-range-row">
      <label>范围选取：第</label>
      <input class="repo-range-input" type="number" id="repo-range-from" min="0" placeholder="起">
      <label>楼 到 第</label>
      <input class="repo-range-input" type="number" id="repo-range-to"   min="0" placeholder="止">
      <label>楼</label>
      <button class="repo-btn" id="repo-btn-range-select">确定</button>
    </div>

    <!-- 已选消息列表 -->
    <div class="repo-scroll-area">
      <div class="repo-selected-list" id="repo-selected-list">
        <div class="repo-empty-hint">
          点击消息旁的 📌 图标<br>开始选取楼层
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="repo-toolbar" style="border-top:1px solid rgba(255,255,255,0.08);border-bottom:none;justify-content:flex-end;">
      <button class="repo-btn-primary" id="repo-btn-goto-export">去导出 →</button>
    </div>

  </div>

  <!-- ── Tab: 主题 ── -->
  <div class="repo-tab-content" data-tab-content="theme">
    <div class="repo-scroll-area">
      <div style="font-size:11px;opacity:0.5;padding:4px 2px 8px;">选择导出图主题</div>
      <div class="repo-theme-grid" id="repo-theme-grid">
        ${buildThemeCardsHTML()}
      </div>
    </div>
  </div>

  <!-- ── Tab: 导出 ── -->
  <div class="repo-tab-content" data-tab-content="export">
    <div class="repo-scroll-area">
      <div class="repo-empty-hint" style="padding:40px 10px;">
        🚧 导出功能将在 Phase 3 实装<br>
        <span style="font-size:10px;opacity:0.5;">当前已选 <span id="repo-export-count">0</span> 条消息</span>
      </div>
    </div>
  </div>

</div>
    `.trim();
  }

  /* ============================================================
     5. 主题数据 & 主题卡片
     ============================================================ */

  const THEMES = [
    { id: 'sakura', emoji: '🌸', name: '粉嫩少女', previewClass: 'theme-preview-sakura' },
    { id: 'cyber',  emoji: '🌙', name: '赛博暗黑', previewClass: 'theme-preview-cyber'  },
    { id: 'paper',  emoji: '📄', name: '简约纸张', previewClass: 'theme-preview-paper'  },
    { id: 'ocean',  emoji: '🌊', name: '清新水蓝', previewClass: 'theme-preview-ocean'  },
    { id: 'autumn', emoji: '🍂', name: '复古暖秋', previewClass: 'theme-preview-autumn' },
    { id: 'galaxy', emoji: '🌌', name: '星空梦幻', previewClass: 'theme-preview-galaxy' },
    { id: 'candy',  emoji: '🎀', name: '甜系可爱', previewClass: 'theme-preview-candy'  },
    { id: 'mono',   emoji: '⬛', name: '极简黑白', previewClass: 'theme-preview-mono'   },
  ];

  function buildThemeCardsHTML() {
    return THEMES.map(t => `
      <div class="repo-theme-card ${t.id === RepoState.currentTheme ? 'active' : ''}"
           data-theme-id="${t.id}">
        <div class="repo-theme-card-inner ${t.previewClass}">
          <span class="repo-theme-card-emoji">${t.emoji}</span>
          <span>${t.name}</span>
        </div>
      </div>
    `).join('');
  }

  /* ============================================================
     6. 已选列表渲染 & 拖拽排序
     ============================================================ */

  function renderSelectedList() {
    const container = document.getElementById('repo-selected-list');
    if (!container) return;

    if (RepoState.orderedIds.length === 0) {
      container.innerHTML = `
        <div class="repo-empty-hint">
          点击消息旁的 📌 图标<br>开始选取楼层
        </div>`;
      return;
    }

    container.innerHTML = RepoState.orderedIds.map(id => {
      const item = RepoState.selectedMessages.get(id);
      if (!item) return '';
      const senderClass = item.isUser ? 'is-user' : '';
      const preview = item.text
        ? escapeHtml(item.text)
        : '<span style="opacity:0.4;font-style:italic;">（无文本）</span>';
      return `
        <div class="repo-selected-item" draggable="true" data-item-id="${escapeHtml(id)}">
          <span class="repo-item-drag-handle" title="拖拽排序">⠿</span>
          <div class="repo-item-meta">
            <div class="repo-item-floor">第 ${escapeHtml(id)} 楼</div>
            <div class="repo-item-sender ${senderClass}">${escapeHtml(item.sender)}</div>
            <div class="repo-item-preview">${preview}</div>
          </div>
          <button class="repo-item-remove" data-remove-id="${escapeHtml(id)}" title="移除">×</button>
        </div>
      `;
    }).join('');

    // 绑定移除按钮
    container.querySelectorAll('.repo-item-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        SelectionManager.removeById(btn.dataset.removeId);
      });
    });

    // 绑定拖拽排序
    bindDragSort(container);
  }

  /** HTML 转义，防止消息内容中的特殊字符破坏面板结构 */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 更新计数徽章 */
  function updateCountBadge() {
    const badge = document.getElementById('repo-count-badge');
    if (badge) badge.textContent = RepoState.orderedIds.length;
    const exportCount = document.getElementById('repo-export-count');
    if (exportCount) exportCount.textContent = RepoState.orderedIds.length;
  }

  /* ============================================================
     7. 拖拽排序
     ============================================================ */

  function bindDragSort(container) {
    const items = container.querySelectorAll('.repo-selected-item[draggable]');

    items.forEach(item => {
      item.addEventListener('dragstart', e => {
        RepoState.dragSrcId = item.dataset.itemId;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Firefox 需要设置数据才能触发拖拽
        e.dataTransfer.setData('text/plain', RepoState.dragSrcId);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        container.querySelectorAll('.repo-selected-item').forEach(el => {
          el.classList.remove('drag-over');
        });
      });

      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item.dataset.itemId !== RepoState.dragSrcId) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('drag-over');

        const srcId  = RepoState.dragSrcId;
        const destId = item.dataset.itemId;
        if (!srcId || srcId === destId) return;

        const arr     = RepoState.orderedIds;
        const srcIdx  = arr.indexOf(srcId);
        const destIdx = arr.indexOf(destId);
        if (srcIdx === -1 || destIdx === -1) return;

        // 把 src 从原位置移到 dest 位置
        arr.splice(srcIdx, 1);
        arr.splice(destIdx, 0, srcId);

        RepoState.dragSrcId = null;
        renderSelectedList();
      });
    });
  }

  /* ============================================================
     8. 消息按钮注入
     ============================================================ */

  /**
   * 向单条消息元素注入选取按钮
   * 挂载到 ST 原生的 .extraMesButtons 区域
   */
  function injectSelectButton(mesEl) {
    // 防止重复注入
    if (mesEl.querySelector('.repo-select-btn')) return;

    const btn = document.createElement('button');
    btn.className   = 'repo-select-btn mes_button';
    btn.title       = '选取此楼层';
    btn.textContent = '📌';

    // 如果当前消息已在选中状态（比如面板重建后），恢复样式
    const id = getFloorNumber(mesEl);
    if (RepoState.selectedMessages.has(id)) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      SelectionManager.toggle(mesEl);
    });

    // 优先插入到 .extraMesButtons，找不到就插到 .mes_buttons
    const target =
      mesEl.querySelector('.extraMesButtons') ||
      mesEl.querySelector('.mes_buttons');

    if (target) {
      // 插到第一个位置，不影响原有按钮
      target.insertBefore(btn, target.firstChild);
    }
  }

  /** 对当前 DOM 中所有消息批量注入按钮 */
  function injectAllButtons() {
    getAllMessages().forEach(injectSelectButton);
  }

  /**
   * 用 MutationObserver 监听新消息，自动注入按钮
   * 覆盖流式输出、翻页、重新生成等场景
   */
  function observeNewMessages() {
    const chatContainer = document.getElementById('chat');
    if (!chatContainer) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          // 新增的节点本身是 .mes
          if (node.classList.contains('mes')) {
            injectSelectButton(node);
          }
          // 新增节点内部包含 .mes（批量插入场景）
          node.querySelectorAll?.('.mes').forEach(injectSelectButton);
        });
      });
    });

    observer.observe(chatContainer, { childList: true, subtree: true });
    return observer;
  }

  /* ============================================================
     9. 面板事件绑定
     ============================================================ */

  function bindPanelEvents() {

    // ── Tab 切换 ──
    document.querySelectorAll('#repo-helper-panel .repo-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        document.querySelectorAll('#repo-helper-panel .repo-tab-btn')
          .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

        document.querySelectorAll('#repo-helper-panel .repo-tab-content')
          .forEach(c => c.classList.toggle('active', c.dataset.tabContent === tab));
      });
    });

    // ── 清空所有 ──
    document.getElementById('repo-btn-clear-all')
      ?.addEventListener('click', () => {
        if (RepoState.orderedIds.length === 0) return;
        if (confirm(`确定清空已选的 ${RepoState.orderedIds.length} 条消息吗？`)) {
          SelectionManager.clearAll();
        }
      });

    // ── 全选当前聊天 ──
    document.getElementById('repo-btn-select-all')
      ?.addEventListener('click', () => {
        const all = getAllMessages();
        all.forEach(mesEl => {
          const id = getFloorNumber(mesEl);
          if (!RepoState.selectedMessages.has(id)) {
            SelectionManager.select(mesEl, id);
          }
        });
        SelectionManager.syncUI();
        showToast(`已全选 ${all.length} 条消息`);
      });

    // ── 反选 ──
    document.getElementById('repo-btn-invert')
      ?.addEventListener('click', () => {
        const all = getAllMessages();
        all.forEach(mesEl => {
          const id = getFloorNumber(mesEl);
          if (RepoState.selectedMessages.has(id)) {
            SelectionManager.deselect(mesEl, id);
          } else {
            SelectionManager.select(mesEl, id);
          }
        });
        SelectionManager.syncUI();
        showToast('已反选');
      });

    // ── 范围快选 ──
    document.getElementById('repo-btn-range-select')
      ?.addEventListener('click', () => {
        const fromVal = document.getElementById('repo-range-from')?.value.trim();
        const toVal   = document.getElementById('repo-range-to')?.value.trim();
        const from    = parseInt(fromVal, 10);
        const to      = parseInt(toVal,   10);

        if (isNaN(from) || isNaN(to)) {
          showToast('⚠️ 请填写起止楼层数字');
          return;
        }
        if (from < 0 || to < 0) {
          showToast('⚠️ 楼层号不能为负数');
          return;
        }
        SelectionManager.selectRange(from, to);
      });

    // ── 范围输入框回车触发 ──
    ['repo-range-from', 'repo-range-to'].forEach(inputId => {
      document.getElementById(inputId)
        ?.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            document.getElementById('repo-btn-range-select')?.click();
          }
        });
    });

    // ── 去导出 Tab ──
    document.getElementById('repo-btn-goto-export')
      ?.addEventListener('click', () => {
        if (RepoState.orderedIds.length === 0) {
          showToast('⚠️ 请先选取至少一条消息');
          return;
        }
        // 切换到导出 Tab
        document.querySelectorAll('#repo-helper-panel .repo-tab-btn')
          .forEach(b => b.classList.toggle('active', b.dataset.tab === 'export'));
        document.querySelectorAll('#repo-helper-panel .repo-tab-content')
          .forEach(c => c.classList.toggle('active', c.dataset.tabContent === 'export'));
      });

    // ── 主题选择 ──
    document.getElementById('repo-theme-grid')
      ?.addEventListener('click', e => {
        const card = e.target.closest('.repo-theme-card');
        if (!card) return;
        const themeId = card.dataset.themeId;
        if (!themeId) return;

        RepoState.currentTheme = themeId;

        document.querySelectorAll('.repo-theme-card')
          .forEach(c => c.classList.toggle('active', c.dataset.themeId === themeId));

        showToast(`已切换主题：${THEMES.find(t => t.id === themeId)?.name ?? themeId}`);
      });
  }

  /* ============================================================
     10. ST 侧边栏面板挂载
     ============================================================ */

  function mountPanel() {
    // 避免重复挂载
    if (document.getElementById('repo-helper-panel')) return;

    // ST 的扩展面板容器
    const extensionsMenu = document.getElementById('extensionsMenu');

    // 创建侧边栏抽屉条目（与其他插件保持一致的挂载方式）
    const drawerHtml = `
      <div id="repo-helper-drawer" class="drawer">
        <div class="drawer-toggle inline-drawer-toggle inline-drawer-header">
          <b>📋 Repo小助手</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="padding:0;overflow:hidden;">
          ${buildPanelHTML()}
        </div>
      </div>
    `;

    // 挂载到 ST 左侧扩展面板区域
    const target =
      document.getElementById('left-nav-panel') ||
      document.getElementById('extensions_settings') ||
      extensionsMenu;

    if (target) {
      target.insertAdjacentHTML('beforeend', drawerHtml);
    } else {
      // 最终回退：直接挂到 body 右下角浮窗
      const fallback = document.createElement('div');
      fallback.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 300px;
        max-height: 80vh; z-index: 9999; border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5); overflow: hidden;
      `;
      fallback.innerHTML = buildPanelHTML();
      document.body.appendChild(fallback);
    }

    bindPanelEvents();
  }

  /* ============================================================
     11. 插件入口 — 等待 ST 就绪后初始化
     ============================================================ */

  function init() {
    mountPanel();
    injectAllButtons();
    observeNewMessages();
    console.log(`[${PLUGIN_NAME}] Phase 1 已加载 ✓`);
  }

  // ST 使用 jQuery，等待文档与 ST 核心就绪
  if (typeof jQuery !== 'undefined') {
    jQuery(document).ready(() => {
      // 额外等待 ST 自身初始化完成（chat 容器出现）
      const waitForChat = setInterval(() => {
        if (document.getElementById('chat')) {
          clearInterval(waitForChat);
          init();
        }
      }, 300);
    });
  } else {
    // 无 jQuery 回退
    document.addEventListener('DOMContentLoaded', init);
  }

})();

