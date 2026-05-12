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
 * --- Phase 2 新增 ---
 * censorWords: Array<{ id, word, replacement }> — 自定义打码词列表
 * censorStyle: 'block' | 'star' | 'blur' | 'replace' — 打码样式
 * censorReplaceWord: string — 自定义替换词（style=replace时使用）
 * autoName1: boolean — 是否自动打码 name1
 * globalComment: string — 全局评论文字
 * annotations: Map<messageId, Array<{ id, type, comment }>> — 段落标注
 */
const RepoState = {
  selectedMessages : new Map(),
  orderedIds       : [],
  currentTheme     : 'sakura',
  dragSrcId        : null,

  // Phase 2 — 打码系统
  censorWords      : [],
  censorStyle      : 'block',
  censorReplaceWord: '***',
  autoName1        : true,

  // Phase 2 — 评论系统
  globalComment    : '',
  annotations      : new Map(),
};

/* ============================================================
   END 1. 全局状态
   ============================================================ */


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
    <span style="font-size:11px;opacity:0.4;">v0.2</span>
  </div>

  <!-- Tab 导航 -->
  <div class="repo-tabs">
    <button class="repo-tab-btn active" data-tab="select">
      选取 <span class="repo-count-badge" id="repo-count-badge">0</span>
    </button>
    <button class="repo-tab-btn" data-tab="censor">打码</button>
    <button class="repo-tab-btn" data-tab="comment">评论</button>
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

  <!-- ── Tab: 打码 ── -->
  <div class="repo-tab-content" data-tab-content="censor">
    <div class="repo-scroll-area">

      <!-- 自动打码 name1 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">🔒 自动打码</div>
        <label class="repo-toggle-row">
          <input type="checkbox" id="repo-censor-auto-name1" ${RepoState.autoName1 ? 'checked' : ''}>
          <span>自动打码用户名（name1）</span>
        </label>
      </div>

      <!-- 打码样式 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">🎨 打码样式</div>
        <div class="repo-censor-style-grid">
          <label class="repo-style-option ${RepoState.censorStyle === 'block' ? 'active' : ''}" data-style="block">
            <input type="radio" name="repo-censor-style" value="block" ${RepoState.censorStyle === 'block' ? 'checked' : ''}>
            <span class="repo-style-preview repo-style-block">■■■</span>
            <span>黑块</span>
          </label>
          <label class="repo-style-option ${RepoState.censorStyle === 'star' ? 'active' : ''}" data-style="star">
            <input type="radio" name="repo-censor-style" value="star" ${RepoState.censorStyle === 'star' ? 'checked' : ''}>
            <span class="repo-style-preview repo-style-star">***</span>
            <span>星号</span>
          </label>
          <label class="repo-style-option ${RepoState.censorStyle === 'blur' ? 'active' : ''}" data-style="blur">
            <input type="radio" name="repo-censor-style" value="blur" ${RepoState.censorStyle === 'blur' ? 'checked' : ''}>
            <span class="repo-style-preview repo-style-blur">模糊</span>
            <span>模糊</span>
          </label>
          <label class="repo-style-option ${RepoState.censorStyle === 'replace' ? 'active' : ''}" data-style="replace">
            <input type="radio" name="repo-censor-style" value="replace" ${RepoState.censorStyle === 'replace' ? 'checked' : ''}>
            <span class="repo-style-preview repo-style-replace">自定义</span>
            <span>替换词</span>
          </label>
        </div>
        <!-- 自定义替换词输入（仅 replace 模式显示） -->
        <div class="repo-replace-word-row ${RepoState.censorStyle === 'replace' ? '' : 'hidden'}" id="repo-replace-word-row">
          <label>替换为：</label>
          <input type="text" id="repo-censor-replace-word" class="repo-text-input"
                 value="${escapeHtml(RepoState.censorReplaceWord)}" placeholder="输入替换词">
        </div>
      </div>

      <!-- 自定义打码词 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">📝 自定义打码词</div>
        <div class="repo-censor-add-row">
          <input type="text" id="repo-censor-word-input" class="repo-text-input" placeholder="输入要打码的词">
          <button class="repo-btn-primary" id="repo-btn-censor-add">添加</button>
        </div>
        <div class="repo-censor-word-list" id="repo-censor-word-list">
          ${buildCensorWordListHTML()}
        </div>
      </div>

      <!-- 实时预览 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">👁 打码预览</div>
        <div class="repo-censor-preview-input-row">
          <input type="text" id="repo-censor-preview-input" class="repo-text-input"
                 placeholder="输入测试文本，查看打码效果">
        </div>
        <div class="repo-censor-preview-output" id="repo-censor-preview-output">
          <span style="opacity:0.4;font-style:italic;">预览将在此显示</span>
        </div>
      </div>

    </div>
  </div>

  <!-- ── Tab: 评论 ── -->
  <div class="repo-tab-content" data-tab-content="comment">
    <div class="repo-scroll-area">

      <!-- 全局评论 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">💬 全局评论</div>
        <div style="font-size:11px;opacity:0.5;margin-bottom:6px;">将显示在导出图片底部</div>
        <textarea id="repo-global-comment" class="repo-textarea"
                  placeholder="在这里写下你的评论、感想或说明..."
                  rows="4">${escapeHtml(RepoState.globalComment)}</textarea>
        <div class="repo-comment-char-count">
          <span id="repo-comment-char-count">${RepoState.globalComment.length}</span> / 500 字
        </div>
      </div>

      <!-- 段落标注 -->
      <div class="repo-censor-section">
        <div class="repo-section-title">🏷 段落标注</div>
        <div style="font-size:11px;opacity:0.5;margin-bottom:8px;">
          为已选楼层添加标注，导出时显示在对应消息旁
        </div>
        <div class="repo-annotation-list" id="repo-annotation-list">
          ${buildAnnotationListHTML()}
        </div>
      </div>

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
   END 4. 面板 HTML 模板
   ============================================================ */


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
     12. 打码系统
     ============================================================ */

  const CensorManager = {

    /** 生成唯一 id */
    _uid() {
      return 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    },

    /** 添加打码词 */
    addWord(word) {
      word = word.trim();
      if (!word) { showToast('⚠️ 请输入打码词'); return; }
      if (word.length > 50) { showToast('⚠️ 打码词不能超过50字'); return; }
      // 防止重复
      if (RepoState.censorWords.some(w => w.word === word)) {
        showToast('⚠️ 该词已在列表中');
        return;
      }
      RepoState.censorWords.push({ id: this._uid(), word });
      this.renderWordList();
      showToast(`已添加打码词：${word}`);
    },

    /** 删除打码词 */
    removeWord(id) {
      RepoState.censorWords = RepoState.censorWords.filter(w => w.id !== id);
      this.renderWordList();
    },

    /** 重新渲染打码词列表 */
    renderWordList() {
      const el = document.getElementById('repo-censor-word-list');
      if (el) el.innerHTML = buildCensorWordListHTML();
      // 重新绑定删除按钮
      el?.querySelectorAll('.repo-censor-word-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          CensorManager.removeWord(btn.dataset.wordId);
        });
      });
    },

    /**
     * 对文本执行打码处理
     * @param {string} text 原始文本
     * @returns {string} 打码后的 HTML 字符串（用于预览）
     */
    applyToText(text) {
      if (!text) return '';

      // 收集所有需要打码的词
      const words = [...RepoState.censorWords.map(w => w.word)];
      if (RepoState.autoName1 && window.name1) {
        words.push(window.name1);
      }

      // 去重、过滤空值、按长度降序（长词优先匹配）
      const uniqueWords = [...new Set(words.filter(Boolean))]
        .sort((a, b) => b.length - a.length);

      if (uniqueWords.length === 0) return escapeHtml(text);

      // 构建正则（转义特殊字符）
      const pattern = uniqueWords
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      const regex = new RegExp(`(${pattern})`, 'g');

      const style = RepoState.censorStyle;

      return escapeHtml(text).replace(
        // 注意：escapeHtml 后再匹配，词中若含 HTML 特殊字符需同步转义
        new RegExp(
          `(${uniqueWords
            .map(w => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|')})`,
          'g'
        ),
        (match) => {
          switch (style) {
            case 'block':
              return `<span class="repo-censor-block" title="已打码">█`.repeat(match.length) + `</span>`;
            case 'star':
              return `<span class="repo-censor-star">` + '*'.repeat(match.length) + `</span>`;
            case 'blur':
              return `<span class="repo-censor-blur">${match}</span>`;
            case 'replace':
              return `<span class="repo-censor-replace">${escapeHtml(RepoState.censorReplaceWord || '***')}</span>`;
            default:
              return match;
          }
        }
      );
    },

    /** 更新实时预览 */
    updatePreview() {
      const input  = document.getElementById('repo-censor-preview-input');
      const output = document.getElementById('repo-censor-preview-output');
      if (!input || !output) return;
      const raw = input.value;
      if (!raw.trim()) {
        output.innerHTML = '<span style="opacity:0.4;font-style:italic;">预览将在此显示</span>';
        return;
      }
      output.innerHTML = this.applyToText(raw);
    },
  };

  /** 构建打码词列表 HTML（供 buildPanelHTML 和 renderWordList 复用） */
  function buildCensorWordListHTML() {
    if (RepoState.censorWords.length === 0) {
      return '<div class="repo-empty-hint" style="padding:10px 0;font-size:11px;">暂无自定义打码词</div>';
    }
    return RepoState.censorWords.map(w => `
      <div class="repo-censor-word-tag">
        <span class="repo-censor-word-text">${escapeHtml(w.word)}</span>
        <button class="repo-censor-word-remove" data-word-id="${w.id}" title="删除">×</button>
      </div>
    `).join('');
  }

  /* ============================================================
     END 12. 打码系统
     ============================================================ */

  /* ============================================================
     13. 段落标注系统
     ============================================================ */

  const AnnotationManager = {

    _uid() {
      return 'ann_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    },

    /** 为某条消息添加标注 */
    addAnnotation(messageId, type, comment) {
      comment = comment.trim();
      if (!comment) { showToast('⚠️ 请输入标注内容'); return false; }
      if (comment.length > 200) { showToast('⚠️ 标注内容不能超过200字'); return false; }

      if (!RepoState.annotations.has(messageId)) {
        RepoState.annotations.set(messageId, []);
      }
      RepoState.annotations.get(messageId).push({
        id: this._uid(),
        type,    // 'highlight' | 'circle'
        comment,
      });
      this.renderAnnotationList();
      return true;
    },

    /** 删除标注 */
    removeAnnotation(messageId, annotationId) {
      const list = RepoState.annotations.get(messageId);
      if (!list) return;
      const filtered = list.filter(a => a.id !== annotationId);
      if (filtered.length === 0) {
        RepoState.annotations.delete(messageId);
      } else {
        RepoState.annotations.set(messageId, filtered);
      }
      this.renderAnnotationList();
    },

    /** 重新渲染标注列表 */
    renderAnnotationList() {
      const el = document.getElementById('repo-annotation-list');
      if (el) {
        el.innerHTML = buildAnnotationListHTML();
        this._bindAnnotationEvents(el);
      }
    },

    /** 绑定标注列表内的事件 */
    _bindAnnotationEvents(container) {
      // 删除按钮
      container.querySelectorAll('.repo-ann-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          AnnotationManager.removeAnnotation(btn.dataset.msgId, btn.dataset.annId);
        });
      });

      // 添加标注按钮
      container.querySelectorAll('.repo-ann-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const msgId  = btn.dataset.msgId;
          const type   = btn.dataset.annType;
          const input  = container.querySelector(`.repo-ann-input[data-msg-id="${msgId}"]`);
          if (!input) return;
          const ok = AnnotationManager.addAnnotation(msgId, type, input.value);
          if (ok) input.value = '';
        });
      });

      // 输入框回车
      container.querySelectorAll('.repo-ann-input').forEach(input => {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const msgId = input.dataset.msgId;
            const btn   = container.querySelector(`.repo-ann-add-btn[data-msg-id="${msgId}"][data-ann-type="highlight"]`);
            btn?.click();
          }
        });
      });
    },
  };

  /** 构建标注列表 HTML */
  function buildAnnotationListHTML() {
    if (RepoState.orderedIds.length === 0) {
      return '<div class="repo-empty-hint" style="padding:10px 0;font-size:11px;">请先在「选取」Tab 选择楼层</div>';
    }

    return RepoState.orderedIds.map(id => {
      const item = RepoState.selectedMessages.get(id);
      if (!item) return '';

      const anns = RepoState.annotations.get(id) || [];
      const annHTML = anns.map(a => `
        <div class="repo-ann-tag repo-ann-type-${a.type}">
          <span class="repo-ann-type-icon">${a.type === 'highlight' ? '🟡' : '⭕'}</span>
          <span class="repo-ann-comment">${escapeHtml(a.comment)}</span>
          <button class="repo-ann-remove" data-msg-id="${id}" data-ann-id="${a.id}" title="删除">×</button>
        </div>
      `).join('');

      return `
        <div class="repo-ann-item">
          <div class="repo-ann-item-header">
            <span class="repo-ann-floor">第 ${escapeHtml(id)} 楼</span>
            <span class="repo-ann-sender ${item.isUser ? 'is-user' : ''}">${escapeHtml(item.sender)}</span>
          </div>
          <div class="repo-ann-preview">${escapeHtml(item.text || '（无文本）')}</div>
          ${annHTML ? `<div class="repo-ann-tags">${annHTML}</div>` : ''}
          <div class="repo-ann-add-row">
            <input type="text" class="repo-text-input repo-ann-input" data-msg-id="${id}"
                   placeholder="添加标注内容…" maxlength="200">
            <button class="repo-btn repo-ann-add-btn" data-msg-id="${id}" data-ann-type="highlight" title="高亮标注">🟡</button>
            <button class="repo-btn repo-ann-add-btn" data-msg-id="${id}" data-ann-type="circle" title="圈起标注">⭕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ============================================================
     END 13. 段落标注系统
     ============================================================ */

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

        // 切换到评论 Tab 时刷新标注列表（选取可能有变化）
        if (tab === 'comment') {
          AnnotationManager.renderAnnotationList();
        }
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

    // ════════════════════════════════════════════════════════════
    // Phase 2 — 打码系统事件
    // ════════════════════════════════════════════════════════════

    // ── 自动打码 name1 开关 ──
    document.getElementById('repo-censor-auto-name1')
      ?.addEventListener('change', e => {
        RepoState.autoName1 = e.target.checked;
        CensorManager.updatePreview();
        showToast(RepoState.autoName1 ? '已开启自动打码用户名' : '已关闭自动打码用户名');
      });

    // ── 打码样式切换 ──
    document.querySelectorAll('input[name="repo-censor-style"]').forEach(radio => {
      radio.addEventListener('change', e => {
        RepoState.censorStyle = e.target.value;

                // 更新样式卡片高亮
        document.querySelectorAll('.repo-style-option').forEach(label => {
          label.classList.toggle('active', label.dataset.style === e.target.value);
        });

        // 替换词输入框显示/隐藏
        const replaceRow = document.getElementById('repo-replace-word-row');
        if (replaceRow) {
          replaceRow.classList.toggle('hidden', e.target.value !== 'replace');
        }

        CensorManager.updatePreview();
      });
    });

    // ── 自定义替换词输入 ──
    document.getElementById('repo-censor-replace-word')
      ?.addEventListener('input', e => {
        RepoState.censorReplaceWord = e.target.value;
        CensorManager.updatePreview();
      });

    // ── 添加打码词 ──
    document.getElementById('repo-btn-censor-add')
      ?.addEventListener('click', () => {
        const input = document.getElementById('repo-censor-word-input');
        if (!input) return;
        CensorManager.addWord(input.value);
        input.value = '';
        input.focus();
      });

    // ── 打码词输入框回车 ──
    document.getElementById('repo-censor-word-input')
      ?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          document.getElementById('repo-btn-censor-add')?.click();
        }
      });

    // ── 打码词列表删除（事件委托） ──
    document.getElementById('repo-censor-word-list')
      ?.addEventListener('click', e => {
        const btn = e.target.closest('.repo-censor-word-remove');
        if (!btn) return;
        CensorManager.removeWord(btn.dataset.wordId);
      });

    // ── 实时预览输入 ──
    document.getElementById('repo-censor-preview-input')
      ?.addEventListener('input', () => {
        CensorManager.updatePreview();
      });

    // ════════════════════════════════════════════════════════════
    // Phase 2 — 评论系统事件
    // ════════════════════════════════════════════════════════════

    // ── 全局评论输入 ──
    document.getElementById('repo-global-comment')
      ?.addEventListener('input', e => {
        const val = e.target.value;
        // 限制 500 字
        if (val.length > 500) {
          e.target.value = val.slice(0, 500);
        }
        RepoState.globalComment = e.target.value;
        const counter = document.getElementById('repo-comment-char-count');
        if (counter) counter.textContent = RepoState.globalComment.length;
      });

    // ── 段落标注列表（事件委托，初始绑定） ──
    const annList = document.getElementById('repo-annotation-list');
    if (annList) {
      AnnotationManager._bindAnnotationEvents(annList);
    }
  }

  /* ============================================================
     END 9. 面板事件绑定
     ============================================================ */


  
  /* ============================================================
     10. ST 侧边栏面板挂载
     ============================================================ */

   function mountPanel() {
    if (document.getElementById('repo-helper-panel')) return;

    // 创建标准的 extension_container，与其他插件保持一致
    const container = document.createElement('div');
    container.id = 'repo-helper-container';
    container.className = 'extension_container';

    // ST 标准抽屉结构
    container.innerHTML = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>📋 Repo小助手</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="padding:0;overflow:hidden;">
          ${buildPanelHTML()}
        </div>
      </div>
    `;

    // 挂到 extensions_settings2（右列），找不到就用 extensions_settings（左列）
    const target =
      document.getElementById('extensions_settings2') ||
      document.getElementById('extensions_settings');

    if (target) {
      target.appendChild(container);
    } else {
      // 最终回退：右下角浮窗
      container.style.cssText = `
        position:fixed;bottom:20px;right:20px;width:300px;
        max-height:80vh;z-index:9999;border-radius:12px;
        box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow:hidden;
      `;
      document.body.appendChild(container);
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

