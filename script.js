(() => {
  'use strict';

  const STORAGE_KEY = 'freshchat-thread';
  const CONFIG_KEY = 'freshchat-config';
  const DEFAULT_SYSTEM_PROMPT =
    '\u3042\u306A\u305F\u306FUI\u8A2D\u8A08\u3092\u624B\u4F1D\u3046\u89AA\u3057\u307F\u3084\u3059\u3044\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u5E38\u306B\u65E5\u672C\u8A9E\u3067\u3001\u660E\u308B\u304F\u524D\u5411\u304D\u306A\u53E3\u8ABF\u3067\u4E01\u5BE7\u306B\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\u3002';
  const SUPPORTED_MODELS = ['gpt-4o-latest', 'gpt-4o-mini', 'gpt-4.1'];
  const MAX_AVATAR_FILE_SIZE = 1024 * 1024; // 1MB
  const MAX_AVATAR_DIMENSION = 256;
  const MIN_AVATAR_DIMENSION = 48;
  const MAX_AVATAR_DATA_LENGTH = 140000; // ~280KB as UTF-16, keeps storage under control
  const MAIN_THREAD_TITLE = '\u30E1\u30A4\u30F3\u30B9\u30EC\u30C3\u30C9';
  const NEW_THREAD_TITLE_BASE = '\u30B9\u30EC\u30C3\u30C9';
  const THREAD_STORAGE_VERSION = 2;
  const AVATAR_STATUS_TEXT = {
    inUse: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u6E08\u307F\u306E\u753B\u50CF\u3092\u4F7F\u7528\u3057\u3066\u3044\u307E\u3059\u3002',
    processing: '\u753B\u50CF\u3092\u51E6\u7406\u4E2D\u3067\u3059\u2026',
    usingUrl: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u753B\u50CF\u306F\u3042\u308A\u307E\u305B\u3093\uFF08URL\u3092\u5229\u7528\u4E2D\uFF09\u3002',
    empty: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u753B\u50CF\u306F\u3042\u308A\u307E\u305B\u3093\u3002',
    chooseImage: '\u753B\u50CF\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    sizeLimit: '\u753B\u50CF\u306F1MB\u4EE5\u4E0B\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    readError: '\u753B\u50CF\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002',
    pending: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u753B\u50CF\u304C\u4FDD\u5B58\u5F85\u3061\u3067\u3059\u3002',
    cleared: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u753B\u50CF\u3092\u30AF\u30EA\u30A2\u3057\u307E\u3057\u305F\u3002\u4FDD\u5B58\u3059\u308B\u3068\u53CD\u6620\u3055\u308C\u307E\u3059\u3002',
  };
  const DEFAULT_CONFIG = {
    assistantName: 'Aeris',
    assistantStatus: '\u3044\u3064\u3067\u3082\u76F8\u8AC7\u3067\u304D\u307E\u3059',
    apiKey: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    model: 'gpt-4o-latest',
    avatarUrl: '',
    avatarData: '',
  };

  const app = document.querySelector('.app');
  if (!app) return;

  const threadEl = app.querySelector('.chat-messages');
  const emptyStateEl = app.querySelector('.chat-empty');
  const formEl = app.querySelector('.composer');
  const textareaEl = formEl.querySelector('textarea');
  const sendButtonEl = formEl.querySelector('.send-button');
  const composerDefaultPlaceholder = textareaEl.getAttribute('placeholder') || '';
  const composerNoThreadPlaceholder = '\u307E\u305A\u65B0\u3057\u3044\u30B9\u30EC\u30C3\u30C9\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002';
  const profileNameEl = app.querySelector('.identity .name');
  const profileStatusEl = app.querySelector('.identity .status');
  const avatarEl = app.querySelector('.avatar');
  const avatarImageEl = avatarEl?.querySelector('.avatar-image');
  const avatarInitialEl = avatarEl?.querySelector('.avatar-initial');

  const drawerToggle = app.querySelector('.drawer-toggle');
  const drawerLayer = app.querySelector('[data-role="drawer-layer"]');
  const drawerBackdrop = drawerLayer?.querySelector('[data-action="close-drawer"]');
  const drawerEl = drawerLayer?.querySelector('.chat-drawer');
  const drawerClose = drawerLayer?.querySelector('.drawer-close');
  const newThreadButton = drawerLayer?.querySelector('[data-action="create-thread"]');
  const threadListEl = drawerLayer?.querySelector('.thread-list');
  const threadEmptyEl = drawerLayer?.querySelector('.thread-empty');

  const settingsToggle = app.querySelector('.settings-toggle');
  const settingsLayer = app.querySelector('[data-role="settings-layer"]');
  const settingsBackdrop = settingsLayer?.querySelector('[data-action="close-settings"]');
  const settingsModal = settingsLayer?.querySelector('.settings-modal');
  const settingsCloseButtons = settingsLayer?.querySelectorAll('[data-action="close-settings"]') || [];
  const settingsForm = settingsLayer?.querySelector('.settings-form');
  const avatarFileInput = settingsForm?.elements.namedItem('avatarFile');
  const avatarStatusEl = settingsForm?.querySelector('[data-avatar-status]');
  const avatarClearButton = settingsForm?.querySelector('[data-action="clear-avatar"]');

  const assistantProfile = {
    name: DEFAULT_CONFIG.assistantName,
    cannedReplies: [
      '\u4E86\u89E3\u3057\u307E\u3057\u305F\u3002\u6B21\u306B\u9032\u3081\u305F\u3044\u5185\u5BB9\u304C\u3042\u308C\u3070\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002',
      '\u30C1\u30E3\u30C3\u30C8\u6B04\u306E\u30D9\u30FC\u30B9\u306F\u6574\u3044\u307E\u3057\u305F\u3002\u7D9A\u3044\u3066\u30B9\u30EC\u30C3\u30C9\u4E00\u89A7\u3092\u6574\u3048\u307E\u3057\u3087\u3046\u304B\uFF1F',
      '\u6C17\u306B\u306A\u308B\u8981\u4EF6\u304C\u3042\u308C\u3070\u3001\u3044\u3064\u3067\u3082\u6C17\u8EFD\u306B\u805E\u3044\u3066\u304F\u3060\u3055\u3044\u306D\u3002',
      '\u3044\u3044\u611F\u3058\u3067\u3059\u306D\uFF01\u3053\u306E\u307E\u307E\u660E\u308B\u3044\u30C8\u30FC\u30F3\u3067\u78E8\u304D\u8FBC\u3093\u3067\u3044\u304D\u307E\u3057\u3087\u3046\u3002',
    ],
  };

  const state = {
    threads: [],
    activeThreadId: null,
    messages: [],
    messageElements: new Map(),
    pendingAssistant: null,
    config: loadConfig(),
    focusTrapHandlers: {
      drawer: null,
      settings: null,
    },
    lastFocused: {
      drawer: null,
      settings: null,
    },
    draftAvatarData: '',
    avatarReadToken: 0,
  };

  assistantProfile.name = state.config.assistantName || DEFAULT_CONFIG.assistantName;
  state.draftAvatarData = state.config.avatarData || '';

  function init() {
    const { threads, activeThreadId } = loadThreadState();
    state.threads = threads;
    state.activeThreadId = activeThreadId;
    state.messages = getActiveThreadMessages();
    renderAllMessages();
    updateEmptyState();
    renderThreadList();
    applyConfigToUI();
    autoResizeTextArea();
    updateSendButton();

    textareaEl.addEventListener('input', () => {
      autoResizeTextArea();
      updateSendButton();
    });

    formEl.addEventListener('submit', handleSubmit);
    window.addEventListener('beforeunload', saveMessages);
    document.addEventListener('keydown', handleGlobalKeydown);

    if (drawerToggle) {
      drawerToggle.addEventListener('click', () => {
        if (app.dataset.chatOpen === 'true') {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    drawerBackdrop?.addEventListener('click', closeDrawer);
    drawerClose?.addEventListener('click', closeDrawer);
    newThreadButton?.addEventListener('click', handleCreateThread);

    threadListEl?.addEventListener('click', (event) => {
      const deleteTarget = event.target.closest('[data-action="delete-thread"]');
      if (deleteTarget) {
        event.preventDefault();
        const threadId = deleteTarget.dataset.threadId;
        if (threadId) {
          handleDeleteThread(threadId);
        }
        return;
      }
      const button = event.target.closest('.thread-item');
      if (!button) return;
      const threadId = button.dataset.threadId;
      if (threadId) {
        setActiveThread(threadId, { scrollBehavior: 'auto' });
        if (!textareaEl.disabled) {
          textareaEl.focus();
        }
      }
      closeDrawer();
    });

    if (settingsToggle) {
      settingsToggle.addEventListener('click', () => {
        if (app.dataset.settingsOpen === 'true') {
          closeSettings();
        } else {
          openSettings();
        }
      });
    }

    settingsBackdrop?.addEventListener('click', closeSettings);
    settingsCloseButtons.forEach((button) => button.addEventListener('click', closeSettings));
    settingsForm?.addEventListener('submit', handleSettingsSubmit);
    if (avatarFileInput instanceof HTMLInputElement) {
      avatarFileInput.addEventListener('change', handleAvatarFileChange);
    }
    avatarClearButton?.addEventListener('click', clearAvatarSelection);

    applyDefaultAvatarStatus();
    exposeFreshchatApi();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!getActiveThread()) return;
    const content = textareaEl.value.trim();
    if (!content) return;

    cancelPendingAssistant();

    const userMessage = createMessage('user', content);
    appendMessage(userMessage);

    textareaEl.value = '';
    autoResizeTextArea();
    updateSendButton();
    if (!textareaEl.disabled) {
      textareaEl.focus();
    }

    requestAssistantReply(content);
  }

  function playFallbackAnimation(messageId, finalText) {
    const entry = state.messageElements.get(messageId);
    if (!entry) {
      finalizeMessage(messageId, finalText);
      return;
    }
    runTypewriterAnimation(entry.bubble, finalText, () => {
      finalizeMessage(messageId, finalText);
    });
  }

  async function sendChat(messages, signal) {
    if (window.__DEMO__) {
      return mockChat(messages);
    }

    const modelId = SUPPORTED_MODELS.includes(state.config.model)
      ? state.config.model
      : DEFAULT_CONFIG.model;

    const body = {
      messages,
      model: modelId,
      systemPrompt: (state.config.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim() || DEFAULT_SYSTEM_PROMPT,
    };

    if (window.__BYOK__) {
      body.apiKey = state.config.apiKey;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${errorText}`);
    }
    return response.json();
  }

  async function mockChat(messages) {
    const last = messages?.at(-1)?.content ?? '';
    await new Promise(r => setTimeout(r, 800));
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: `これはデモ応答です 👋\n入力:「${last.slice(
              0,
              60
            )}」\n本番はVercelでデプロイしてね。`,
          },
        },
      ],
    };
  }

  function requestAssistantReply(userContent) {
    const assistantMessage = createMessage('assistant', '');
    appendMessage(assistantMessage, { persist: false });
    setTypingState(assistantMessage.id, true);
    setMessageStatus(assistantMessage.id, `${assistantProfile.name}・生成中`);

    const tracker = {
      messageId: assistantMessage.id,
      controller: new AbortController(),
      threadId: state.activeThreadId,
    };
    state.pendingAssistant = tracker;

    const pastMessages = getActiveThreadMessages()
      .filter((message) => message.id !== tracker.messageId && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (!window.__DEMO__ && !window.__BYOK__ && !state.config.apiKey) {
       const fallback = pickAssistantReply(userContent);
       playFallbackAnimation(tracker.messageId, fallback);
       state.pendingAssistant = null;
       return;
    }

    (async () => {
      const signal = tracker.controller.signal;
      try {
        const data = await sendChat(pastMessages, signal);
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          playFallbackAnimation(tracker.messageId, content);
        } else {
          throw new Error('No content in response');
        }
      } catch (error) {
        if (signal.aborted) {
          const partial = '（応答は中断されました）';
          finalizeMessage(tracker.messageId, partial);
          return;
        }
        console.error('Assistant request failed:', error);
        const failure =
          'すみません、応答の取得に失敗しました。時間をおいてから再試行してください。';
        finalizeMessage(tracker.messageId, failure);
      } finally {
        state.pendingAssistant = null;
      }
    })();
  }

  function cancelPendingAssistant() {
    if (!state.pendingAssistant) return;
    state.pendingAssistant.controller.abort();
    state.pendingAssistant = null;
  }

  function createMessage(role, content) {
    return {
      id: generateMessageId(),
      role,
      content,
      createdAt: Date.now(),
    };
  }

  function appendMessage(message, options = {}) {
    const { persist = true, scrollBehavior = 'smooth' } = options;
    const thread = getActiveThread();
    if (!thread) return;
    thread.messages.push(message);
    thread.updatedAt = Date.now();
    state.messages = thread.messages;
    if (persist) {
      saveMessages();
    }
    const { element, bubble, meta } = buildMessageElement(message);
    state.messageElements.set(message.id, { element, bubble, meta });
    threadEl.appendChild(element);
    updateEmptyState();
    renderThreadList();
    scrollToBottom(scrollBehavior);
  }

  function buildMessageElement(message) {
    const element = document.createElement('li');
    element.className = 'chat-message';
    element.dataset.role = message.role;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = message.content;
    element.appendChild(bubble);

    const meta = document.createElement('span');
    meta.className = 'chat-meta';
    meta.textContent = formatMeta(message);
    element.appendChild(meta);

    return { element, bubble, meta };
  }

  function renderAllMessages(scrollBehavior = 'auto') {
    threadEl.textContent = '';
    state.messageElements.clear();

    const messages = getActiveThreadMessages();
    state.messages = messages;

    const fragment = document.createDocumentFragment();
    messages.forEach((message) => {
      const { element, bubble, meta } = buildMessageElement(message);
      state.messageElements.set(message.id, { element, bubble, meta });
      fragment.appendChild(element);
    });

    threadEl.appendChild(fragment);
    renderThreadList();
    scrollToBottom(scrollBehavior);
    updateSendButton();
  }

  function formatMeta(message) {
    const label = message.role === 'user' ? '\u3042\u306A\u305F' : assistantProfile.name;
    const time = new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(message.createdAt || Date.now());
    return `${label}\u30FB${time}`;
  }

  function updateMessageBubble(messageId, content) {
    const { message } = findMessageById(messageId);
    if (!message) return;
    message.content = content;

    const entry = state.messageElements.get(messageId);
    if (entry) {
      entry.bubble.textContent = content;
    }
  }

  function setMessageStatus(messageId, status) {
    const entry = state.messageElements.get(messageId);
    if (entry) {
      entry.meta.textContent = status;
    }
  }

  function setTypingState(messageId, isTyping) {
    const entry = state.messageElements.get(messageId);
    if (entry) {
      entry.element.classList.toggle('is-typing', isTyping);
    }
  }

  function finalizeMessage(messageId, finalText) {
    updateMessageBubble(messageId, finalText);
    const { thread, message } = findMessageById(messageId);
    if (message) {
      message.createdAt = Date.now();
    }
    const entry = state.messageElements.get(messageId);
    if (entry) {
      entry.element.classList.remove('is-typing');
      entry.meta.textContent = message ? formatMeta(message) : `${assistantProfile.name}`;
    }
    if (thread) {
      thread.updatedAt = message?.createdAt || Date.now();
    }
    saveMessages();
    updateEmptyState();
    renderThreadList();
    if (thread && thread.id === state.activeThreadId) {
      scrollToBottom('smooth');
    }
  }

  function autoResizeTextArea() {
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 180)}px`;
  }

  function updateSendButton() {
    const hasThread = Boolean(getActiveThread());
    const hasText = textareaEl.value.trim().length > 0;
    sendButtonEl.disabled = !hasThread || !hasText;
    const previouslyDisabled = textareaEl.disabled;
    textareaEl.disabled = !hasThread;
    if (!hasThread) {
      textareaEl.placeholder = composerNoThreadPlaceholder;
      textareaEl.setAttribute('aria-disabled', 'true');
      if (!previouslyDisabled) {
        textareaEl.value = '';
      }
      textareaEl.style.height = '';
    } else {
      textareaEl.placeholder = composerDefaultPlaceholder;
      textareaEl.removeAttribute('aria-disabled');
      autoResizeTextArea();
    }
  }

  function updateThreadControls() {
    if (!threadListEl) return;
    const deleteButtons = threadListEl.querySelectorAll('[data-action="delete-thread"]');
    deleteButtons.forEach((button) => {
      const threadId = button.dataset.threadId;
      const thread = threadId ? getThreadById(threadId) : null;
      button.disabled = !thread;
    });
  }

  function updateEmptyState() {
    const hasMessages = getActiveThreadMessages().length > 0;
    emptyStateEl.hidden = hasMessages;
    threadEl.classList.toggle('is-empty', !hasMessages);
    updateThreadControls();
  }

  function scrollToBottom(behavior = 'smooth') {
    window.requestAnimationFrame(() => {
      threadEl.scrollTo({
        top: threadEl.scrollHeight,
        behavior,
      });
    });
  }

  function runTypewriterAnimation(bubbleEl, fullText, onComplete) {
    const characters = Array.from(fullText);
    bubbleEl.textContent = '';
    let index = 0;

    const tick = () => {
      if (index >= characters.length) {
        if (typeof onComplete === 'function') {
          onComplete();
        }
        return;
      }

      bubbleEl.textContent += characters[index];
      index += 1;
      const previousChar = characters[index - 1] || '';
      const pause = /[\u3002\uFF01\uFF1F!?.]/.test(previousChar) ? 110 : 26;
      window.setTimeout(() => {
        window.requestAnimationFrame(tick);
      }, pause);
    };

    tick();
  }

  function pickAssistantReply(userContent) {
    const normalizedLower = userContent.toLowerCase();
    const normalized = userContent;

    if (normalized.includes('\u3042\u308A\u304C\u3068\u3046') || normalizedLower.includes('thanks')) {
      return '\u3069\u3046\u3044\u305F\u3057\u307E\u3057\u3066\u3002\u3044\u3064\u3067\u3082\u30B5\u30DD\u30FC\u30C8\u3057\u307E\u3059\u306D\u3002';
    }

    if (normalized.includes('\u6B21') || normalizedLower.includes('next')) {
      return '\u6B21\u306E\u30B9\u30C6\u30C3\u30D7\u3068\u3057\u3066\u30B9\u30EC\u30C3\u30C9\u4E00\u89A7\u306EUI\u3092\u6E96\u5099\u3057\u3066\u304A\u304F\u3068\u30B9\u30E0\u30FC\u30BA\u3067\u3059\u3002';
    }

    const index = Math.floor(Math.random() * assistantProfile.cannedReplies.length);
    return assistantProfile.cannedReplies[index];
  }

  function generateThreadId() {
    return `thread-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function sanitizeMessages(rawMessages) {
    if (!Array.isArray(rawMessages)) return [];
    const sanitized = [];
    for (const entry of rawMessages) {
      if (!isValidMessage(entry)) continue;
      const normalized = {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateMessageId(),
        role: entry.role,
        content: entry.content,
        createdAt:
          typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
            ? entry.createdAt
            : Date.now(),
      };
      sanitized.push(normalized);
    }
    return sanitized.slice(-200);
  }

  function createDefaultThreadState(messages = []) {
    const sanitized = sanitizeMessages(messages);
    const now = Date.now();
    const initialCreatedAt = sanitized.length ? sanitized[0].createdAt : now;
    const initialUpdatedAt = sanitized.length ? sanitized[sanitized.length - 1].createdAt : now;
    return {
      threads: [
        {
          id: 'main',
          title: MAIN_THREAD_TITLE,
          createdAt: initialCreatedAt,
          updatedAt: initialUpdatedAt,
          messages: sanitized,
        },
      ],
      activeThreadId: 'main',
    };
  }

  function loadThreadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultThreadState([]);
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return createDefaultThreadState(parsed);
      }
      if (typeof parsed !== 'object' || parsed === null) {
        return createDefaultThreadState([]);
      }

      const storedThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
      const normalizedThreads = [];
      const seenIds = new Set();
      let autoTitleIndex = 1;

      for (const thread of storedThreads) {
        if (!thread || typeof thread !== 'object') continue;
        let id =
          typeof thread.id === 'string' && thread.id.trim() ? thread.id.trim() : generateThreadId();
        if (seenIds.has(id)) {
          id = generateThreadId();
        }
        seenIds.add(id);

        const messages = sanitizeMessages(thread.messages);
        const now = Date.now();
        const createdAt =
          typeof thread.createdAt === 'number' && Number.isFinite(thread.createdAt)
            ? thread.createdAt
            : messages[0]?.createdAt ?? now;
        const updatedAt =
          typeof thread.updatedAt === 'number' && Number.isFinite(thread.updatedAt)
            ? thread.updatedAt
            : messages[messages.length - 1]?.createdAt ?? createdAt;

        let title = '';
        if (id === 'main') {
          title = MAIN_THREAD_TITLE;
        } else if (typeof thread.title === 'string' && thread.title.trim()) {
          title = thread.title.trim();
        } else {
          title = `${NEW_THREAD_TITLE_BASE} ${autoTitleIndex}`;
          autoTitleIndex += 1;
        }

        normalizedThreads.push({
          id,
          title,
          createdAt,
          updatedAt,
          messages,
        });
      }

      if (normalizedThreads.length === 0 && storedThreads.length === 0) {
        return {
          threads: [],
          activeThreadId: null,
        };
      }

      if (normalizedThreads.length === 0) {
        return createDefaultThreadState([]);
      }

      const requestedActive =
        typeof parsed.activeThreadId === 'string' ? parsed.activeThreadId : null;
      const activeThreadId = normalizedThreads.some((thread) => thread.id === requestedActive)
        ? requestedActive
        : normalizedThreads[0]?.id ?? null;

      return {
        threads: normalizedThreads,
        activeThreadId,
      };
    } catch (error) {
      console.warn('Unable to load stored threads:', error);
      return createDefaultThreadState([]);
    }
  }

  function saveMessages() {
    try {
      const payload = JSON.stringify({
        version: THREAD_STORAGE_VERSION,
        activeThreadId: state.activeThreadId || null,
        threads: state.threads.map((thread) => ({
          id: thread.id,
          title: thread.id === 'main' ? MAIN_THREAD_TITLE : thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          messages: thread.messages.slice(-200).map((message) => ({
            id:
              typeof message.id === 'string' && message.id.trim()
                ? message.id.trim()
                : generateMessageId(),
            role: message.role,
            content: message.content,
            createdAt:
              typeof message.createdAt === 'number' && Number.isFinite(message.createdAt)
                ? message.createdAt
                : Date.now(),
          })),
        })),
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn('Unable to save messages:', error);
    }
  }

  function getThreadById(threadId) {
    if (typeof threadId !== 'string') return null;
    return state.threads.find((thread) => thread.id === threadId) || null;
  }

  function getActiveThread() {
    const active =
      typeof state.activeThreadId === 'string' ? getThreadById(state.activeThreadId) : null;
    if (active) {
      return active;
    }
    const fallback = state.threads[0] || null;
    if (fallback && state.activeThreadId !== fallback.id) {
      state.activeThreadId = fallback.id;
    }
    return fallback;
  }

  function getActiveThreadMessages() {
    const thread = getActiveThread();
    return thread ? thread.messages : [];
  }

  function getNextThreadTitle() {
    const count = state.threads.filter((thread) => thread.id !== 'main').length + 1;
    return `${NEW_THREAD_TITLE_BASE} ${count}`;
  }

  function findMessageById(messageId) {
    if (typeof messageId !== 'string') {
      return { thread: null, message: null };
    }
    for (const thread of state.threads) {
      const message = thread.messages.find((item) => item.id === messageId);
      if (message) {
        return { thread, message };
      }
    }
    return { thread: null, message: null };
  }

  function setActiveThread(threadId, options = {}) {
    const thread = getThreadById(threadId);
    if (!thread || state.activeThreadId === thread.id) return;
    const { scrollBehavior = 'auto' } = options;
    state.activeThreadId = thread.id;
    state.messages = thread.messages;
    renderAllMessages(scrollBehavior);
    updateEmptyState();
    saveMessages();
  }

  function loadConfig() {
    try {
      const raw = window.localStorage.getItem(CONFIG_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_CONFIG };
      return {
        assistantName:
          typeof parsed.assistantName === 'string' && parsed.assistantName.trim()
            ? parsed.assistantName.trim()
            : DEFAULT_CONFIG.assistantName,
        assistantStatus:
          typeof parsed.assistantStatus === 'string' && parsed.assistantStatus.trim()
            ? parsed.assistantStatus.trim()
            : DEFAULT_CONFIG.assistantStatus,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_CONFIG.apiKey,
        systemPrompt:
          typeof parsed.systemPrompt === 'string' && parsed.systemPrompt.trim()
            ? parsed.systemPrompt
            : DEFAULT_CONFIG.systemPrompt,
        model:
          typeof parsed.model === 'string' && SUPPORTED_MODELS.includes(parsed.model.trim())
            ? parsed.model.trim()
            : DEFAULT_CONFIG.model,
        avatarUrl:
          typeof parsed.avatarUrl === 'string'
            ? parsed.avatarUrl
            : DEFAULT_CONFIG.avatarUrl,
        avatarData:
          typeof parsed.avatarData === 'string'
            ? parsed.avatarData
            : DEFAULT_CONFIG.avatarData,
      };
    } catch (error) {
      console.warn('Unable to load config:', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    try {
      const payload = JSON.stringify({
        assistantName: state.config.assistantName,
        assistantStatus: state.config.assistantStatus,
        apiKey: state.config.apiKey,
        systemPrompt: state.config.systemPrompt,
        model: state.config.model,
        avatarUrl: state.config.avatarUrl,
        avatarData: state.config.avatarData,
      });
      window.localStorage.setItem(CONFIG_KEY, payload);
    } catch (error) {
      console.warn('Unable to save config:', error);
    }
  }

  function clearMessages() {
    cancelPendingAssistant();
    const thread = getActiveThread();
    if (!thread) return;
    thread.messages = [];
    thread.updatedAt = Date.now();
    state.messages = thread.messages;
    saveMessages();
    renderAllMessages();
    updateEmptyState();
    if (!textareaEl.disabled) {
      textareaEl.focus();
    }
  }

  function isValidMessage(message) {
    return (
      message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string'
    );
  }

  function applyConfigToUI() {
    profileNameEl.textContent = state.config.assistantName || DEFAULT_CONFIG.assistantName;
    profileStatusEl.textContent = state.config.assistantStatus || DEFAULT_CONFIG.assistantStatus;
    assistantProfile.name = state.config.assistantName || DEFAULT_CONFIG.assistantName;
    updateAvatarDisplay();
  }

  function updateAvatarDisplay(previewSource) {
    if (!avatarEl || !avatarInitialEl) return;
    const nameSource =
      (state.config.assistantName || DEFAULT_CONFIG.assistantName || '').trim() || 'A';
    const initialChar = Array.from(nameSource)[0] || 'A';
    avatarInitialEl.textContent = initialChar;

    const usingPreview = previewSource !== undefined;
    const dataSource = usingPreview
      ? ((previewSource || '').toString().trim())
      : (state.config.avatarData || '').trim();
    const urlSource = usingPreview ? '' : (state.config.avatarUrl || '').trim();

    const applyInitial = () => {
      if (avatarImageEl) {
        avatarImageEl.hidden = true;
        avatarImageEl.removeAttribute('src');
      }
      delete avatarEl.dataset.hasImage;
    };

    const applyImage = (source) => {
      if (!avatarImageEl) {
        avatarEl.dataset.hasImage = 'true';
        return;
      }
      const handleLoad = () => {
        avatarImageEl.hidden = false;
        avatarEl.dataset.hasImage = 'true';
      };
      const handleError = () => {
        avatarImageEl.hidden = true;
        avatarImageEl.removeAttribute('src');
        delete avatarEl.dataset.hasImage;
      };
      avatarImageEl.onload = handleLoad;
      avatarImageEl.onerror = handleError;
      avatarImageEl.src = source;
      if (avatarImageEl.complete && avatarImageEl.naturalWidth > 0) {
        handleLoad();
      }
    };

    if (dataSource) {
      applyImage(dataSource);
      return;
    }

    if (urlSource) {
      applyImage(urlSource);
      return;
    }

    applyInitial();
  }

  function updateAvatarStatus(message) {
    if (!avatarStatusEl) return;
    avatarStatusEl.textContent = message;
  }

  function applyDefaultAvatarStatus() {
    const hasUpload = !!state.draftAvatarData;
    const hasUrl = !!(state.config.avatarUrl || '').trim();
    if (hasUpload) {
      updateAvatarStatus(AVATAR_STATUS_TEXT.inUse);
    } else if (hasUrl) {
      updateAvatarStatus(AVATAR_STATUS_TEXT.usingUrl);
    } else {
      updateAvatarStatus(AVATAR_STATUS_TEXT.empty);
    }
  }

  function resetAvatarDraft() {
    state.avatarReadToken += 1;
    state.draftAvatarData = state.config.avatarData || '';
    if (avatarFileInput instanceof HTMLInputElement) {
      avatarFileInput.value = '';
    }
    applyDefaultAvatarStatus();
    updateAvatarDisplay();
  }

  async function handleAvatarFileChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      updateAvatarStatus(AVATAR_STATUS_TEXT.chooseImage);
      input.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      updateAvatarStatus(AVATAR_STATUS_TEXT.sizeLimit);
      input.value = '';
      return;
    }
    const token = ++state.avatarReadToken;
    updateAvatarStatus(AVATAR_STATUS_TEXT.processing);
    try {
      const processed = await prepareAvatarDataUrl(file);
      if (state.avatarReadToken !== token) {
        return;
      }
      state.draftAvatarData = processed;
      updateAvatarStatus(AVATAR_STATUS_TEXT.pending);
      updateAvatarDisplay(state.draftAvatarData);
    } catch (error) {
      if (state.avatarReadToken !== token) {
        return;
      }
      console.warn('Unable to process avatar file:', error);
      updateAvatarStatus(AVATAR_STATUS_TEXT.readError);
      input.value = '';
      state.draftAvatarData = state.config.avatarData || '';
      updateAvatarDisplay();
    }
  }

  function clearAvatarSelection(event) {
    if (event) event.preventDefault();
    state.avatarReadToken += 1;
    state.draftAvatarData = '';
    if (avatarFileInput instanceof HTMLInputElement) {
      avatarFileInput.value = '';
    }
    updateAvatarStatus(AVATAR_STATUS_TEXT.cleared);
    updateAvatarDisplay('');
  }

  async function prepareAvatarDataUrl(file) {
    const baseDataUrl = await readFileAsDataUrl(file);
    if (!supportsCanvas()) {
      return baseDataUrl;
    }
    try {
      const image = await loadImageFromSource(baseDataUrl);
      return optimizeAvatarDataUrl(image, baseDataUrl, file.type || '');
    } catch (error) {
      console.warn('Unable to optimise avatar image:', error);
      return baseDataUrl;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unexpected reader result'));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error('Unable to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  function supportsCanvas() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return false;
    }
    const canvas = document.createElement('canvas');
    return !!canvas && typeof canvas.getContext === 'function';
  }

  function loadImageFromSource(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = source;
    });
  }

  function optimizeAvatarDataUrl(image, fallbackDataUrl, originalType) {
    let width = image.naturalWidth || image.width || 0;
    let height = image.naturalHeight || image.height || 0;
    if (!width || !height) {
      return fallbackDataUrl;
    }

    const maxDimension = Math.max(width, height);
    if (maxDimension > MAX_AVATAR_DIMENSION) {
      const scale = MAX_AVATAR_DIMENSION / maxDimension;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const candidates = getAvatarExportCandidates(originalType, image);
    let currentWidth = width;
    let currentHeight = height;

    while (currentWidth >= MIN_AVATAR_DIMENSION && currentHeight >= MIN_AVATAR_DIMENSION) {
      const encodings = tryEncodeAvatar(image, currentWidth, currentHeight, candidates);
      const acceptable = encodings.find((entry) => entry.data.length <= MAX_AVATAR_DATA_LENGTH);
      if (acceptable) {
        return acceptable.data;
      }
      if (currentWidth === MIN_AVATAR_DIMENSION && currentHeight === MIN_AVATAR_DIMENSION) {
        break;
      }
      currentWidth = Math.max(MIN_AVATAR_DIMENSION, Math.floor(currentWidth * 0.85));
      currentHeight = Math.max(MIN_AVATAR_DIMENSION, Math.floor(currentHeight * 0.85));
    }

    const fallbackEncodings = tryEncodeAvatar(image, MIN_AVATAR_DIMENSION, MIN_AVATAR_DIMENSION, candidates);
    if (fallbackEncodings.length) {
      return fallbackEncodings.reduce((best, entry) => (entry.data.length < best.data.length ? entry : best)).data;
    }
    return fallbackDataUrl;
  }

  function getAvatarExportCandidates(originalType, image) {
    const lower = (originalType || '').toLowerCase();
    const allowAlpha = lower.includes('png') || lower.includes('webp') || lower.includes('svg');
    const needsAlpha = allowAlpha && imageHasAlpha(image);
    const candidates = needsAlpha
      ? [
          { type: 'image/webp', quality: 0.86 },
          { type: 'image/png' },
        ]
      : [
          { type: 'image/webp', quality: 0.82 },
          { type: 'image/webp', quality: 0.7 },
          { type: 'image/jpeg', quality: 0.82 },
          { type: 'image/jpeg', quality: 0.72 },
        ];
    if (!candidates.some((candidate) => candidate.type === 'image/png')) {
      candidates.push({ type: 'image/png' });
    }
    return candidates;
  }

  function imageHasAlpha(image) {
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    if (!width || !height) {
      return false;
    }
    const sampleWidth = Math.min(width, 64);
    const sampleHeight = Math.min(height, 64);
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return false;
    }
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    try {
      const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] < 255) {
          return true;
        }
      }
    } catch (error) {
      if (!(error && error.name === 'SecurityError')) {
        console.warn('Unable to inspect avatar transparency:', error);
      }
    }
    return false;
  }

  function tryEncodeAvatar(image, width, height, candidates) {
    const results = [];
    candidates.forEach((candidate) => {
      try {
        const data = drawImageToDataUrl(image, width, height, candidate.type, candidate.quality);
        if (data) {
          results.push({ ...candidate, data });
        }
      } catch (error) {
        // Ignore encoding failures for specific formats; fallbacks will handle it.
      }
    });
    if (!results.length) {
      try {
        const fallbackData = drawImageToDataUrl(image, width, height, 'image/png');
        if (fallbackData) {
          results.push({ type: 'image/png', data: fallbackData });
        }
      } catch (error) {
        console.warn('Avatar fallback encoding failed:', error);
      }
    }
    return results;
  }

  function drawImageToDataUrl(image, width, height, type, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }
    context.drawImage(image, 0, 0, width, height);
    if (typeof quality === 'number') {
      return canvas.toDataURL(type, quality);
    }
    return canvas.toDataURL(type);
  }

  function populateSettingsForm() {
    if (!settingsForm) return;
    const { assistantName, assistantStatus, apiKey, systemPrompt, model, avatarUrl } = state.config;
    const nameInput = settingsForm.elements.namedItem('assistantName');
    const statusInput = settingsForm.elements.namedItem('assistantStatus');
    const apiKeyInput = settingsForm.elements.namedItem('apiKey');
    const systemPromptInput = settingsForm.elements.namedItem('systemPrompt');
    const modelInput = settingsForm.elements.namedItem('model');
    const avatarInput = settingsForm.elements.namedItem('avatarUrl');

    if (nameInput) nameInput.value = assistantName || '';
    if (statusInput) statusInput.value = assistantStatus || '';
    if (apiKeyInput) apiKeyInput.value = apiKey || '';
    if (systemPromptInput) systemPromptInput.value = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    if (modelInput) {
      const currentModel = SUPPORTED_MODELS.includes(model) ? model : DEFAULT_CONFIG.model;
      modelInput.value = currentModel;
    }
    if (avatarInput) avatarInput.value = avatarUrl || '';
    resetAvatarDraft();
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    if (!settingsForm) return;
    const formData = new FormData(settingsForm);
    state.config.assistantName =
      (formData.get('assistantName') || '').toString().trim() || DEFAULT_CONFIG.assistantName;
    state.config.assistantStatus =
      (formData.get('assistantStatus') || '').toString().trim() || DEFAULT_CONFIG.assistantStatus;
    state.config.apiKey = (formData.get('apiKey') || '').toString().trim();
    state.config.systemPrompt =
      (formData.get('systemPrompt') || '').toString().trim() || DEFAULT_SYSTEM_PROMPT;
    const selectedModel = (formData.get('model') || '').toString().trim();
    state.config.model = SUPPORTED_MODELS.includes(selectedModel)
      ? selectedModel
      : DEFAULT_CONFIG.model;
    state.config.avatarUrl = (formData.get('avatarUrl') || '').toString().trim();
    state.config.avatarData = state.draftAvatarData || '';

    applyConfigToUI();
    saveConfig();
    closeSettings();
  }

  function renderThreadList() {
    if (!threadListEl) return;
    threadListEl.textContent = '';

    state.threads.forEach((thread, index) => {
      const threadItem = document.createElement('li');
      threadItem.className = 'thread-list-entry';

      const button = document.createElement('button');
      button.type = 'button';
      const isActive = state.activeThreadId
        ? thread.id === state.activeThreadId
        : index === 0;
      button.className = `thread-item${isActive ? ' is-active' : ''}`;
      button.dataset.threadId = thread.id;

      const title = document.createElement('div');
      title.className = 'thread-title';
      title.textContent = thread.title || MAIN_THREAD_TITLE;
      button.appendChild(title);

      const preview = document.createElement('div');
      preview.className = 'thread-preview';
      preview.textContent = formatThreadPreview(thread.messages);
      button.appendChild(preview);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'thread-item-delete';
      deleteButton.dataset.action = 'delete-thread';
      deleteButton.dataset.threadId = thread.id;
      deleteButton.setAttribute('aria-label', '\u30B9\u30EC\u30C3\u30C9\u3092\u524A\u9664\u3059\u308B');
      deleteButton.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6 18 18M6 18 18 6" vector-effect="non-scaling-stroke" /></svg>';

      threadItem.appendChild(button);
      threadItem.appendChild(deleteButton);
      threadListEl.appendChild(threadItem);
    });

    if (threadEmptyEl) {
      if (state.threads.length === 0) {
        threadEmptyEl.hidden = false;
        threadEmptyEl.textContent = '\u307E\u3060\u30B9\u30EC\u30C3\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u300C\u65B0\u898F\u30B9\u30EC\u30C3\u30C9\u300D\u3092\u62BC\u3057\u3066\u4F5C\u6210\u3057\u307E\u3057\u3087\u3046\u3002';
      } else {
        threadEmptyEl.hidden = true;
      }
    }
    updateThreadControls();
  }

  function formatThreadPreview(messages) {
    if (!messages.length) {
      return '\u307E\u3060\u30E1\u30C3\u30BB\u30FC\u30B8\u304C\u3042\u308A\u307E\u305B\u3093\u3002';
    }
    const lastMessage = messages[messages.length - 1].content || '';
    const normalized = lastMessage.replace(/\s+/g, ' ').trim();
    return normalized.length > 36 ? `${normalized.slice(0, 36)}\u2026` : normalized || '\u30E1\u30C3\u30BB\u30FC\u30B8';
  }

  function handleCreateThread() {
    const now = Date.now();
    const id = generateThreadId();
    const title = getNextThreadTitle();
    const newThread = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    state.threads.push(newThread);
    setActiveThread(newThread.id, { scrollBehavior: 'auto' });
    closeDrawer();
    if (!textareaEl.disabled) {
      textareaEl.focus();
    }
  }

  function handleDeleteThread(threadId) {
    if (typeof threadId !== 'string') return;
    const targetThread = getThreadById(threadId);
    if (!targetThread) return;

    const confirmed = window.confirm(
      '\u3053\u306E\u30B9\u30EC\u30C3\u30C9\u3092\u524A\u9664\u3059\u308B\u3068\u3001\u4F1A\u8A71\u5C65\u6B74\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F'
    );
    if (!confirmed) return;

    if (state.pendingAssistant?.threadId === threadId) {
      cancelPendingAssistant();
    }

    const index = state.threads.findIndex((thread) => thread.id === threadId);
    if (index === -1) return;
    state.threads.splice(index, 1);

    if (state.activeThreadId === threadId) {
      const fallbackThread =
        state.threads[index] || state.threads[index - 1] || state.threads[0] || null;
      state.activeThreadId = fallbackThread ? fallbackThread.id : null;
    }

    state.messageElements.clear();
    state.messages = getActiveThreadMessages();
    saveMessages();
    renderAllMessages();
    updateEmptyState();
    if (state.activeThreadId && !textareaEl.disabled) {
      textareaEl.focus();
    } else {
      textareaEl.value = '';
      updateSendButton();
    }
  }

  function openDrawer() {
    if (!drawerLayer || !drawerEl || !drawerToggle) return;
    if (app.dataset.chatOpen === 'true') return;
    state.lastFocused.drawer = document.activeElement;
    app.dataset.chatOpen = 'true';
    drawerToggle.setAttribute('aria-expanded', 'true');
    drawerLayer.classList.add('is-open');
    drawerBackdrop?.setAttribute('aria-hidden', 'false');
    drawerEl.setAttribute('aria-hidden', 'false');
    focusFirstElement(drawerEl);
    activateFocusTrap('drawer', drawerEl);
  }

  function closeDrawer() {
    if (!drawerLayer || !drawerEl || !drawerToggle) return;
    if (app.dataset.chatOpen !== 'true') return;
    app.dataset.chatOpen = 'false';
    drawerToggle.setAttribute('aria-expanded', 'false');
    drawerLayer.classList.remove('is-open');
    drawerBackdrop?.setAttribute('aria-hidden', 'true');
    drawerEl.setAttribute('aria-hidden', 'true');
    deactivateFocusTrap('drawer', drawerEl);
    if (state.lastFocused.drawer instanceof HTMLElement) {
      state.lastFocused.drawer.focus();
    }
    state.lastFocused.drawer = null;
  }

  function openSettings() {
    if (!settingsLayer || !settingsModal || !settingsToggle) return;
    if (app.dataset.settingsOpen === 'true') return;
    state.lastFocused.settings = document.activeElement;
    populateSettingsForm();
    app.dataset.settingsOpen = 'true';
    settingsToggle.setAttribute('aria-expanded', 'true');
    settingsLayer.classList.add('is-open');
    settingsBackdrop?.setAttribute('aria-hidden', 'false');
    settingsModal.setAttribute('aria-hidden', 'false');
    focusFirstElement(settingsModal);
    activateFocusTrap('settings', settingsModal);
  }

  function closeSettings() {
    if (!settingsLayer || !settingsModal || !settingsToggle) return;
    if (app.dataset.settingsOpen !== 'true') return;
    app.dataset.settingsOpen = 'false';
    settingsToggle.setAttribute('aria-expanded', 'false');
    settingsLayer.classList.remove('is-open');
    settingsBackdrop?.setAttribute('aria-hidden', 'true');
    settingsModal.setAttribute('aria-hidden', 'true');
    deactivateFocusTrap('settings', settingsModal);
    if (state.lastFocused.settings instanceof HTMLElement) {
      state.lastFocused.settings.focus();
    }
    state.lastFocused.settings = null;
    resetAvatarDraft();
  }

  function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
      if (app.dataset.settingsOpen === 'true') {
        closeSettings();
        event.preventDefault();
        return;
      }
      if (app.dataset.chatOpen === 'true') {
        closeDrawer();
        event.preventDefault();
      }
    }
  }

  function focusFirstElement(root) {
    const focusables = getFocusableElements(root);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      root.focus();
    }
  }

  function activateFocusTrap(key, root) {
    const handler = (event) => {
      if (event.key !== 'Tab') return;
      const focusables = getFocusableElements(root);
      if (!focusables.length) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const isShift = event.shiftKey;

      if (isShift && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!isShift && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', handler);
    state.focusTrapHandlers[key] = handler;
  }

  function deactivateFocusTrap(key, root) {
    const handler = state.focusTrapHandlers[key];
    if (handler) {
      root.removeEventListener('keydown', handler);
      state.focusTrapHandlers[key] = null;
    }
  }

  function getFocusableElements(root) {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
  }

  function exposeFreshchatApi() {
    const api = {
      setApiKey(nextKey) {
        if (typeof nextKey !== 'string') return;
        state.config.apiKey = nextKey.trim();
        saveConfig();
      },
      getApiKey() {
        return state.config.apiKey || '';
      },
      clearHistory() {
        clearMessages();
      },
      getHistory() {
        return [...getActiveThreadMessages()];
      },
      setAssistantProfile({ name, status, systemPrompt, model, avatarUrl, avatarData }) {
        if (typeof name === 'string' && name.trim()) {
          state.config.assistantName = name.trim();
        }
        if (typeof status === 'string' && status.trim()) {
          state.config.assistantStatus = status.trim();
        }
        if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
          state.config.systemPrompt = systemPrompt.trim();
        }
        if (typeof model === 'string' && model.trim()) {
          const trimmedModel = model.trim();
          if (SUPPORTED_MODELS.includes(trimmedModel)) {
            state.config.model = trimmedModel;
          }
        }
        if (typeof avatarUrl === 'string') {
          state.config.avatarUrl = avatarUrl.trim();
        }
        if (typeof avatarData === 'string') {
          state.config.avatarData = avatarData;
        }
        resetAvatarDraft();
        applyConfigToUI();
        saveConfig();
      },
      setModel(nextModel) {
        if (typeof nextModel !== 'string' || !nextModel.trim()) return;
        const trimmedModel = nextModel.trim();
        if (!SUPPORTED_MODELS.includes(trimmedModel)) return;
        state.config.model = trimmedModel;
        saveConfig();
      },
    };

    window.freshchat = Object.assign(window.freshchat || {}, api);
  }

  init();
})();

