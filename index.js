/*
 * ============================================
 *  ST Repo 小助手 — index.js
 *  Author: shadow
 *  Version: 1.0.0
 * ============================================
 */

(function () {
  "use strict";

  // ============ 全局状态 ============
  const STATE = {
    selectedMessages: [],    // { mesId, role, text, element }
    customRedactWords: [],
    autoRedact: true,
    redactStyle: "block",    // block | star | blur
    comment: "",
    theme: "pink",
    bgUrl: "",
  };

  // ============ 工具函数 ============
  const getUserName = () => {
    try {
      return window.name1 || "用户";
    } catch {
      return "用户";
    }
  };

  const truncateText = (text, maxLen = 50) => {
    if (!text) return "";
    const clean = text.replace(/\n/g, " ").trim();
    return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
  };

  const getMessageId = (mesEl) => {
    return mesEl.getAttribute("mesid") || mesEl.getAttribute("data-mesid") || "";
  };

  const getMessageRole = (mesEl) => {
    if (mesEl.getAttribute("is_user") === "true") return "user";
    if (mesEl.classList.contains("user_mes")) return "user";
    return "ai";
  };

  const getMessageText = (mesEl) => {
    const mesTextEl = mesEl.querySelector(".mes_text");
    return mesTextEl ? mesTextEl.textContent.trim() : "";
  };

  // ============ 面板 HTML ============
  const buildPanelHTML = () => {
    return `
    <div id="repo-helper-panel">
      <!-- 标题栏 -->
      <div class="repo-title-bar">
        <h3>📋Repo 小助手 <span class="repo-version">v1.0</span></h3>
      </div>

      <!-- 区块1：已选楼层 -->
      <div class="repo-section" data-section="selected">
        <div class="repo-section-header" data-target="selected">
          <span class="section-title">📌 已选楼层 <span class="repo-badge" id="repo-count">0</span></span>
          <span class="section-toggle">▼</span>
        </div>
        <div class="repo-section-body" id="repo-section-selected">
          <ul class="repo-selected-list" id="repo-selected-list"><li class="repo-selected-empty">还没有选取任何楼层哦～<br>悬停在消息上点击 ＋ 即可选取</li>
          </ul>
          <div class="repo-actions">
            <button class="repo-btn repo-btn-clear" id="repo-btn-clear">🗑 清空</button>
            <button class="repo-btn repo-btn-preview" id="repo-btn-preview">👁 预览导出</button>
          </div>
        </div>
      </div>

      <!-- 区块2：打码设置 -->
      <div class="repo-section" data-section="redact">
        <div class="repo-section-header" data-target="redact">
          <span class="section-title">🔒 打码设置</span>
          <span class="section-toggle">▼</span>
        </div>
        <div class="repo-section-body" id="repo-section-redact">
          <div class="repo-redact-row">
            <label>
              <input type="checkbox" id="repo-auto-redact" checked>
              自动打码 {{user}} 名字（<strong id="repo-username-display"></strong>）
            </label>
          </div>
          <div class="repo-custom-words">
            <input type="text" id="repo-custom-word-input" placeholder="输入需要打码的词…">
            <button class="repo-btn-add" id="repo-btn-add-word">+ 添加</button>
          </div>
          <div class="repo-word-tags" id="repo-word-tags"></div>
          <div class="repo-redact-styles">
            <label><input type="radio" name="repo-redact-style" value="block" checked> ████黑块</label>
            <label><input type="radio" name="repo-redact-style" value="star"> ＊＊＊ 星号</label>
            <label><input type="radio" name="repo-redact-style" value="blur"> 模糊</label>
          </div>
        </div>
      </div>

      <!-- 区块3：评论 -->
      <div class="repo-section" data-section="comment">
        <div class="repo-section-header" data-target="comment">
          <span class="section-title">💬 我的评论</span>
          <span class="section-toggle">▼</span>
        </div>
        <div class="repo-section-body" id="repo-section-comment">
          <textarea class="repo-comment-area" id="repo-comment" placeholder="写点评论吧～ repo的灵魂所在 ✨"></textarea>
        </div>
      </div>

      <!-- 区块4：主题 & 导出 -->
      <div class="repo-section" data-section="export">
        <div class="repo-section-header" data-target="export">
          <span class="section-title">🎨 主题 & 导出</span>
          <span class="section-toggle">▼</span>
        </div>
        <div class="repo-section-body" id="repo-section-export">
          <div class="repo-theme-row">
            <button class="repo-theme-btn active" data-theme="pink">🌸 粉嫩少女</button>
            <button class="repo-theme-btn" data-theme="cyber">🌃赛博暗黑</button>
            <button class="repo-theme-btn" data-theme="paper">📜 简约纸张</button>
            <button class="repo-theme-btn" data-theme="forest">🌿 森林物语</button>
            <button class="repo-theme-btn" data-theme="sunset">🌅 日落黄昏</button>
          </div>
          <div class="repo-bg-url-row">
            <input type="text" id="repo-bg-url" placeholder="自定义背景图 URL（可选）">
          </div>
          <button class="repo-export-btn" id="repo-btn-export">📥 导出图片</button>
        </div>
      </div>
    </div>
    `;
  };

  // ============ 面板折叠逻辑 ============
  const initCollapsible = () => {
    document.querySelectorAll("#repo-helper-panel .repo-section-header").forEach((header) => {
      header.addEventListener("click", () => {
        const target = header.getAttribute("data-target");
        const body = document.getElementById(`repo-section-${target}`);
        if (!body) return;

        const isCollapsed = body.classList.contains("collapsed");
        if (isCollapsed) {
          body.classList.remove("collapsed");
          header.classList.remove("collapsed");
        } else {
          body.classList.add("collapsed");
          header.classList.add("collapsed");
        }
      });
    });
  };

  // ============ 已选列表渲染 ============
  const renderSelectedList = () => {
    const listEl = document.getElementById("repo-selected-list");
    const countEl = document.getElementById("repo-count");
    if (!listEl || !countEl) return;

    countEl.textContent = STATE.selectedMessages.length;

    if (STATE.selectedMessages.length === 0) {
      listEl.innerHTML = `<li class="repo-selected-empty">还没有选取任何楼层哦～<br>悬停在消息上点击 ＋ 即可选取</li>`;
      return;
    }

    listEl.innerHTML = STATE.selectedMessages
      .map((msg, idx) => {
        const roleClass = msg.role === "user" ? "role-user" : "role-ai";
        const roleLabel = msg.role === "user" ? "👤 我" : "🤖 AI";
        return `
        <li class="repo-selected-item" data-idx="${idx}">
          <span class="repo-item-role ${roleClass}">${roleLabel}</span>
          <span class="repo-item-text">${truncateText(msg.text, 60)}</span>
          <button class="repo-item-remove" data-idx="${idx}" title="移除">✕</button>
        </li>`;
      })
      .join("");

    // 绑定移除按钮
    listEl.querySelectorAll(".repo-item-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-idx"));
        removeSelectedMessage(idx);
      });
    });
  };

  // ============ 消息选取/取消 ============
  const toggleSelectMessage = (mesEl) => {
    const mesId = getMessageId(mesEl);
    const existIdx = STATE.selectedMessages.findIndex((m) => m.mesId === mesId);

    if (existIdx !== -1) {
      // 取消选取
      STATE.selectedMessages.splice(existIdx, 1);
      mesEl.classList.remove("repo-selected");
      const btn = mesEl.querySelector(".repo-select-btn");
      if (btn) {
        btn.classList.remove("selected");
        btn.textContent = "＋";
      }
    } else {
      // 选取
      STATE.selectedMessages.push({
        mesId: mesId,
        role: getMessageRole(mesEl),
        text: getMessageText(mesEl),
        element: mesEl,
      });
      mesEl.classList.add("repo-selected");
      const btn = mesEl.querySelector(".repo-select-btn");
      if (btn) {
        btn.classList.add("selected");
        btn.textContent = "✓";
      }
    }

    renderSelectedList();
  };

  const removeSelectedMessage = (idx) => {
    const msg = STATE.selectedMessages[idx];
    if (msg && msg.element) {
      msg.element.classList.remove("repo-selected");
      const btn = msg.element.querySelector(".repo-select-btn");
      if (btn) {
        btn.classList.remove("selected");
        btn.textContent = "＋";
      }
    }
    STATE.selectedMessages.splice(idx, 1);
    renderSelectedList();
  };

  const clearAllSelected = () => {
    STATE.selectedMessages.forEach((msg) => {
      if (msg.element) {
        msg.element.classList.remove("repo-selected");
        const btn = msg.element.querySelector(".repo-select-btn");
        if (btn) {
          btn.classList.remove("selected");
          btn.textContent = "＋";
        }
      }
    });
    STATE.selectedMessages = [];
    renderSelectedList();
  };

  // ============ 注入选取按钮到消息 ============
  const injectSelectButton = (mesEl) => {
    if (mesEl.querySelector(".repo-select-btn")) return;

    const btn = document.createElement("button");
    btn.className = "repo-select-btn";
    btn.textContent = "＋";
    btn.title = "选取此楼层";

    // 检查是否已在已选列表中（切换聊天后恢复状态）
    const mesId = getMessageId(mesEl);
    const isSelected = STATE.selectedMessages.some((m) => m.mesId === mesId);
    if (isSelected) {
      btn.classList.add("selected");
      btn.textContent = "✓";
      mesEl.classList.add("repo-selected");
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleSelectMessage(mesEl);
    });

    // 确保消息元素是relative 定位
    const pos = window.getComputedStyle(mesEl).position;
    if (pos === "static") {
      mesEl.style.position = "relative";
    }

    mesEl.appendChild(btn);
  };

  const injectAllSelectButtons = () => {
    document.querySelectorAll("#chat .mes").forEach((mesEl) => {
      injectSelectButton(mesEl);
    });
  };

  // ============ MutationObserver 监听新消息 ============
  const initChatObserver = () => {
    const chatContainer = document.getElementById("chat");
    if (!chatContainer) {
      // 如果 #chat 还没出现，等一会再试
      setTimeout(initChatObserver, 1000);
      return;
    }

    // 先给已有消息注入按钮
    injectAllSelectButtons();

    // 监听新消息
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList && node.classList.contains("mes")) {
              injectSelectButton(node);
            }
            // 也检查子节点
            if (node.querySelectorAll) {
              node.querySelectorAll(".mes").forEach(injectSelectButton);
            }
          }
        });
      });
    });

    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
    });

    console.log("[Repo小助手] Chat observer 已启动");
  };

  // ============ 打码词管理 ============
  const initRedactControls = () => {
    // 自动打码复选框
    const autoRedactCb = document.getElementById("repo-auto-redact");
    if (autoRedactCb) {
      autoRedactCb.addEventListener("change", () => {
        STATE.autoRedact = autoRedactCb.checked;
      });
    }

    // 显示当前用户名
    const usernameDisplay = document.getElementById("repo-username-display");
    if (usernameDisplay) {
      usernameDisplay.textContent = getUserName();
      // 定期更新（用户可能切换 persona）
      setInterval(() => {
        usernameDisplay.textContent = getUserName();
      }, 3000);
    }

    // 添加自定义打码词
    const addWordBtn = document.getElementById("repo-btn-add-word");
    const wordInput = document.getElementById("repo-custom-word-input");
    if (addWordBtn && wordInput) {
      const addWord = () => {
        const word = wordInput.value.trim();
        if (word && !STATE.customRedactWords.includes(word)) {
          STATE.customRedactWords.push(word);
          wordInput.value = "";
          renderWordTags();
        }
      };
      addWordBtn.addEventListener("click", addWord);
      wordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addWord();
      });
    }

    // 打码样式切换
    document.querySelectorAll('input[name="repo-redact-style"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        STATE.redactStyle = radio.value;
      });
    });
  };

  const renderWordTags = () => {
    const container = document.getElementById("repo-word-tags");
    if (!container) return;

    container.innerHTML = STATE.customRedactWords
      .map(
        (word, idx) => `
      <span class="repo-word-tag">
        ${word}
        <span class="tag-remove" data-idx="${idx}">✕</span>
      </span>`
      )
      .join("");

    container.querySelectorAll(".tag-remove").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-idx"));
        STATE.customRedactWords.splice(idx, 1);
        renderWordTags();
      });
    });
  };

  // ============ 评论 ============
  const initCommentArea = () => {
    const textarea = document.getElementById("repo-comment");
    if (textarea) {
      textarea.addEventListener("input", () => {
        STATE.comment = textarea.value;
      });
    }
  };

  // ============ 主题选择 ============
  const initThemeSelector = () => {
    document.querySelectorAll(".repo-theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".repo-theme-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        STATE.theme = btn.getAttribute("data-theme");
      });
    });

    // 背景图 URL
    const bgInput = document.getElementById("repo-bg-url");
    if (bgInput) {
      bgInput.addEventListener("input", () => {
        STATE.bgUrl = bgInput.value.trim();
      });
    }
  };

  // ============ 按钮事件 ============
  const initButtons = () => {
    // 清空按钮
    const clearBtn = document.getElementById("repo-btn-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (STATE.selectedMessages.length === 0) return;
        clearAllSelected();
      });
    }

    // 预览按钮（阶段三实现，先占位）
    const previewBtn = document.getElementById("repo-btn-preview");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        if (STATE.selectedMessages.length === 0) {
          toastr.warning("请先选取至少一条消息哦～");
          return;
        }
        toastr.info(`已选 ${STATE.selectedMessages.length} 条消息，导出功能开发中…`);
      });
    }

    // 导出按钮（阶段三实现，先占位）
    const exportBtn = document.getElementById("repo-btn-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (STATE.selectedMessages.length === 0) {
          toastr.warning("请先选取至少一条消息哦～");
          return;
        }
        toastr.info(`导出功能将在下一阶段实现 🚧`);
      });
    }
  };

  // ============ 插件初始化 ============
  const init = () => {
    console.log("[Repo小助手] 正在初始化…");

    // 注入面板到ST 的Extensions 设置区
    const settingsContainer = document.getElementById("extensions_settings");
    if (!settingsContainer) {
      console.warn("[Repo小助手] 未找到 #extensions_settings，1秒后重试");
      setTimeout(init, 1000);
      return;
    }

    // 避免重复注入
    if (document.getElementById("repo-helper-panel")) {
      console.log("[Repo小助手] 面板已存在，跳过注入");
      return;
    }

    // 创建面板容器
    const wrapper = document.createElement("div");
    wrapper.id = "repo-helper-wrapper";
    wrapper.innerHTML = buildPanelHTML();
    settingsContainer.appendChild(wrapper);

    // 初始化各模块
    initCollapsible();
    initRedactControls();
    initCommentArea();
    initThemeSelector();
    initButtons();

    // 启动聊天消息监听
    initChatObserver();

    console.log("[Repo小助手] ✅ 初始化完成！");

    // 通知用户
    if (typeof toastr !== "undefined") {
      toastr.success("Repo 小助手已加载 📋✨");
    }
  };

  // ============ 启动 ============
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 2000));
  } else {
    setTimeout(init, 2000);
  }
})();
