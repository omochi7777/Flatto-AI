(() => {
  'use strict';

  const STORAGE_KEY = 'freshchat-thread';
  const CONFIG_KEY = 'freshchat-config';
  const DEFAULT_SYSTEM_PROMPT =
    '\u3042\u306A\u305F\u306FUI\u8A2D\u8A08\u3092\u624B\u4F1D\u3046\u89AA\u3057\u307F\u3084\u3059\u3044\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u5E38\u306B\u65E5\u672C\u8A9E\u3067\u3001\u660E\u308B\u304F\u524D\u5411\u304D\u306A\u53E3\u8ABF\u3067\u4E01\u5BE7\u306B\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\u3002';
  const SUPPORTED_MODELS = ['gpt-4o-latest', 'gpt-4o-mini', 'gpt-4.1'];
  const MAX_AVATAR_FILE_SIZE = 1024 * 1024; // 1MB
  const AVATAR_STATUS_TEXT = {
    inUse: '\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u6E08\u307F\u306E\u753B\u50CF\u3092\u4F7F\u7528\u3057\u3066\u3044\u307E\u3059\u3002',
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
  };

  assistantProfile.name = state.config.assistantName || DEFAULT_CONFIG.assistantName;
  state.draftAvatarData = state.config.avatarData || '';

  function init() {
    state.messages = loadMessages();
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
      const button = event.target.closest('.thread-item');
      if (!button) return;
      threadListEl.querySelectorAll('.thread-item').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
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
    const content = textareaEl.value.trim();
    if (!content) return;

    cancelPendingAssistant();

    const userMessage = createMessage('user', content);
    appendMessage(userMessage);

    textareaEl.value = '';
    autoResizeTextArea();
    updateSendButton();
    textareaEl.focus();

    requestAssistantReply(content);
  }

  function requestAssistantReply(userContent) {
    const assistantMessage = createMessage('assistant', '');
    appendMessage(assistantMessage, { persist: false });
    setTypingState(assistantMessage.id, true);
    setMessageStatus(assistantMessage.id, `${assistantProfile.name}\u30FB\u751F\u6210\u4E2D`);

    const tracker = {
      messageId: assistantMessage.id,
      controller: new AbortController(),
    };
    state.pendingAssistant = tracker;

    const pastMessages = state.messages
      .filter((message) => message.id !== tracker.messageId && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (!state.config.apiKey) {
      const fallback = pickAssistantReply(userContent);
      playFallbackAnimation(tracker.messageId, fallback);
      state.pendingAssistant = null;
      return;
    }

    (async () => {
      const signal = tracker.controller.signal;
      const modelId = SUPPORTED_MODELS.includes(state.config.model)
        ? state.config.model
        : DEFAULT_CONFIG.model;
      if (!SUPPORTED_MODELS.includes(state.config.model)) {
        state.config.model = modelId;
        saveConfig();
      }
      const requestBody = {
        model: modelId,
        messages: [
          { role: 'system', content: (state.config.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim() || DEFAULT_SYSTEM_PROMPT },
          ...pastMessages,
        ],
        stream: true,
      };

      let streamedText = '';

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('\u5FDC\u7B54\u30B9\u30C8\u30EA\u30FC\u30E0\u304C\u5229\u7528\u3067\u304D\u307E\u305B\u3093\u3002');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            if (line === 'data: [DONE]') {
              finalizeMessage(tracker.messageId, streamedText.trim() || streamedText);
              state.pendingAssistant = null;
              return;
            }
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload) continue;

            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            const segments = Array.isArray(delta.content) ? delta.content : [delta.content];
            for (const segment of segments) {
              if (!segment) continue;
              const text =
                typeof segment === 'string'
                  ? segment
                  : typeof segment.text === 'string'
                  ? segment.text
                  : '';
              if (!text) continue;
              streamedText += text;
              updateMessageBubble(tracker.messageId, streamedText);
              scrollToBottom('auto');
            }
          }
        }

        finalizeMessage(tracker.messageId, streamedText.trim() || streamedText);
      } catch (error) {
        if (signal.aborted) {
          const partial = streamedText.trim() || '\uFF08\u5FDC\u7B54\u306F\u4E2D\u65AD\u3055\u308C\u307E\u3057\u305F\uFF09';
          finalizeMessage(tracker.messageId, partial);
          return;
        }
        console.error('Assistant request failed:', error);
        const failure =
          '\u3059\u307F\u307E\u305B\u3093\u3001\u5FDC\u7B54\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u6642\u9593\u3092\u7F6E\u3044\u3066\u304B\u3089\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002';
        finalizeMessage(tracker.messageId, failure);
      } finally {
        state.pendingAssistant = null;
      }
    })();
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

  function cancelPendingAssistant() {
    if (!state.pendingAssistant) return;
    state.pendingAssistant.controller.abort();
    state.pendingAssistant = null;
  }

  function createMessage(role, content) {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      role,
      content,
      createdAt: Date.now(),
    };
  }

  function appendMessage(message, options = {}) {
    const { persist = true, scrollBehavior = 'smooth' } = options;
    state.messages.push(message);
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

  function renderAllMessages() {
    threadEl.textContent = '';
    state.messageElements.clear();

    const fragment = document.createDocumentFragment();
    state.messages.forEach((message) => {
      const { element, bubble, meta } = buildMessageElement(message);
      state.messageElements.set(message.id, { element, bubble, meta });
      fragment.appendChild(element);
    });

    threadEl.appendChild(fragment);
    renderThreadList();
    scrollToBottom('auto');
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
    const message = state.messages.find((item) => item.id === messageId);
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
    const message = state.messages.find((item) => item.id === messageId);
    if (message) {
      message.createdAt = Date.now();
    }
    const entry = state.messageElements.get(messageId);
    if (entry) {
      entry.element.classList.remove('is-typing');
      entry.meta.textContent = message ? formatMeta(message) : `${assistantProfile.name}`;
    }
    saveMessages();
    updateEmptyState();
    renderThreadList();
    scrollToBottom('smooth');
  }

  function autoResizeTextArea() {
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 180)}px`;
  }

  function updateSendButton() {
    const hasText = textareaEl.value.trim().length > 0;
    sendButtonEl.disabled = !hasText;
  }

  function updateEmptyState() {
    const hasMessages = state.messages.length > 0;
    emptyStateEl.hidden = hasMessages;
    threadEl.classList.toggle('is-empty', !hasMessages);
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

  function loadMessages() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidMessage).slice(-200);
    } catch (error) {
      console.warn('Unable to load stored messages:', error);
      return [];
    }
  }

  function saveMessages() {
    try {
      const payload = JSON.stringify(state.messages.slice(-200));
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn('Unable to save messages:', error);
    }
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
    state.messages = [];
    saveMessages();
    state.messageElements.clear();
    threadEl.textContent = '';
    updateEmptyState();
    renderThreadList();
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

  function updateAvatarDisplay() {
    if (!avatarEl || !avatarInitialEl) return;
    const nameSource =
      (state.config.assistantName || DEFAULT_CONFIG.assistantName || '').trim() || 'A';
    const initialChar = Array.from(nameSource)[0] || 'A';
    avatarInitialEl.textContent = initialChar;

    const dataSource = (state.config.avatarData || '').trim();
    const urlSource = (state.config.avatarUrl || '').trim();

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
    state.draftAvatarData = state.config.avatarData || '';
    if (avatarFileInput instanceof HTMLInputElement) {
      avatarFileInput.value = '';
    }
    applyDefaultAvatarStatus();
  }

  function handleAvatarFileChange(event) {
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
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        state.draftAvatarData = result;
        updateAvatarStatus(AVATAR_STATUS_TEXT.pending);
      } else {
        updateAvatarStatus(AVATAR_STATUS_TEXT.readError);
        input.value = '';
      }
    };
    reader.onerror = () => {
      updateAvatarStatus(AVATAR_STATUS_TEXT.readError);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  function clearAvatarSelection(event) {
    if (event) event.preventDefault();
    state.draftAvatarData = '';
    if (avatarFileInput instanceof HTMLInputElement) {
      avatarFileInput.value = '';
    }
    updateAvatarStatus(AVATAR_STATUS_TEXT.cleared);
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

    const threadItem = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thread-item is-active';
    button.dataset.threadId = 'main';

    const title = document.createElement('div');
    title.className = 'thread-title';
    title.textContent = '\u30E1\u30A4\u30F3\u30B9\u30EC\u30C3\u30C9';
    button.appendChild(title);

    const preview = document.createElement('div');
    preview.className = 'thread-preview';
    preview.textContent = formatThreadPreview(state.messages);
    button.appendChild(preview);

    threadItem.appendChild(button);
    threadListEl.appendChild(threadItem);

    if (threadEmptyEl) {
      threadEmptyEl.hidden = true;
    }
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
    if (!threadEmptyEl) return;
    threadEmptyEl.hidden = false;
    threadEmptyEl.textContent = '\u30B9\u30EC\u30C3\u30C9\u6A5F\u80FD\u306F\u6B21\u306E\u30B9\u30C6\u30C3\u30D7\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059\u3002\u304A\u697D\u3057\u307F\u306B\uFF01';
    window.setTimeout(() => {
      threadEmptyEl.hidden = true;
    }, 3200);
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
        return [...state.messages];
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

