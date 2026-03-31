(function () {
  'use strict';

  // ─── DOM 元素 ───
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const cameraInput = document.getElementById('cameraInput');
  const fileList = document.getElementById('fileList');
  const fileItems = document.getElementById('fileItems');
  const fileCount = document.getElementById('fileCount');
  const addMoreBtn = document.getElementById('addMoreBtn');
  const clearBtn = document.getElementById('clearBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const statusTitle = document.getElementById('statusTitle');
  const statusSubtitle = document.getElementById('statusSubtitle');
  const overallProgress = document.getElementById('overallProgress');
  const overallText = document.getElementById('overallText');
  const statusItems = document.getElementById('statusItems');
  const doneBtn = document.getElementById('doneBtn');
  const qrImage = document.getElementById('qrImage');
  const qrUrl = document.getElementById('qrUrl');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');

  // ─── 图片灯箱 ───
  function openLightbox(url) {
    lightboxImg.src = url;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.style.display = 'none';
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  let selectedFiles = [];
  const previewUrlMap = new Map();

  function getFileKey(file) {
    return [file.name, file.size, file.lastModified].join(':');
  }

  function getPreviewUrl(file) {
    const key = getFileKey(file);
    const cached = previewUrlMap.get(key);
    if (cached) return cached;
    const url = URL.createObjectURL(file);
    previewUrlMap.set(key, url);
    return url;
  }

  function revokePreviewUrl(file) {
    const key = getFileKey(file);
    const url = previewUrlMap.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlMap.delete(key);
    }
  }

  function revokeAllPreviewUrls() {
    for (const url of previewUrlMap.values()) {
      URL.revokeObjectURL(url);
    }
    previewUrlMap.clear();
  }

  // ─── 加载二维码 ───
  async function loadQRCode() {
    try {
      const res = await fetch('/api/qrcode');
      const data = await res.json();
      qrImage.src = data.qrcode;
      qrUrl.textContent = data.url;
    } catch (e) {
      qrUrl.textContent = '无法加载二维码';
    }
  }

  loadQRCode();

  // ─── 格式化文件大小 ───
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
  }

  // ─── 判断是否为图片 ───
  function isImage(file) {
    return file.type.startsWith('image/');
  }

  // ─── 文件选择处理 ───
  function handleFiles(files) {
    for (const file of files) {
      // 检查是否已选中
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        selectedFiles.push(file);
      }
    }
    renderFileList();
  }

  // ─── 渲染文件列表 ───
  function renderFileList() {
    if (selectedFiles.length === 0) {
      fileList.style.display = 'none';
      uploadArea.style.display = '';
      return;
    }

    uploadArea.style.display = 'none';
    fileList.style.display = '';
    fileCount.textContent = selectedFiles.length;

    fileItems.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';

      if (isImage(file)) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = getPreviewUrl(file);
        img.title = '点击预览';
        img.addEventListener('click', function () {
          openLightbox(getPreviewUrl(file));
        });
        img.onerror = function () {
          const placeholder = document.createElement('div');
          placeholder.className = 'thumb-placeholder';
          placeholder.textContent = '🖼️';
          item.replaceChild(placeholder, img);
        };
        item.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'thumb-placeholder';
        placeholder.textContent = '🎬';
        item.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'file-info';
      info.innerHTML = '<div class="file-name">' + escapeHtml(file.name) + '</div>' +
        '<div class="file-size">' + formatSize(file.size) + '</div>';
      item.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', function () {
        revokePreviewUrl(file);
        selectedFiles.splice(index, 1);
        renderFileList();
      });
      item.appendChild(removeBtn);

      fileItems.appendChild(item);
    });
  }

  // ─── HTML 转义 ───
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── 文件输入事件 ───
  function openPicker(inputEl) {
    // 先清空值，确保再次选择同一个文件也会触发 change。
    inputEl.value = '';
    inputEl.click();
  }

  fileInput.addEventListener('change', function () {
    if (this.files.length > 0) {
      handleFiles(this.files);
    }
    this.value = '';
  });

  cameraInput.addEventListener('change', function () {
    if (this.files.length > 0) {
      handleFiles(this.files);
    }
    this.value = '';
  });

  addMoreBtn.addEventListener('click', function () {
    openPicker(fileInput);
  });

  // ─── 点击上传区域触发文件选择 ───
  uploadArea.addEventListener('click', function (e) {
    if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
    openPicker(fileInput);
  });

  // ─── 拖拽上传 ───
  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // ─── 清空按钮 ───
  clearBtn.addEventListener('click', function () {
    revokeAllPreviewUrls();
    selectedFiles = [];
    renderFileList();
  });

  // ─── 开始上传 ───
  uploadBtn.addEventListener('click', function () {
    if (selectedFiles.length === 0) return;
    startUpload();
  });

  // ─── 保存路径提示 ───
  function showSavePathTip(savePath) {
    removeSavePathTip();
    var tip = document.createElement('div');
    tip.className = 'save-path-tip';
    tip.id = 'savePathTip';
    tip.innerHTML =
      '<div class="save-path-icon">📁</div>' +
      '<div class="save-path-content">' +
        '<div class="save-path-label">文件已保存到</div>' +
        '<div class="save-path-value">' + escapeHtml(savePath) + '</div>' +
      '</div>';
    // 插入到 doneBtn 之前
    doneBtn.parentNode.insertBefore(tip, doneBtn);
  }

  function removeSavePathTip() {
    var existing = document.getElementById('savePathTip');
    if (existing) existing.remove();
  }

  // ─── 继续上传按钮 ───
  doneBtn.addEventListener('click', function () {
    revokeAllPreviewUrls();
    selectedFiles = [];
    removeSavePathTip();
    uploadStatus.style.display = 'none';
    uploadArea.style.display = '';
    fileList.style.display = 'none';
    doneBtn.style.display = 'none';
  });

  // ─── 逐个上传文件 ───
  async function startUpload() {
    const files = selectedFiles.slice();
    fileList.style.display = 'none';
    uploadStatus.style.display = '';
    doneBtn.style.display = 'none';

    var lastSavePath = '';
    removeSavePathTip();
    statusTitle.textContent = '正在上传...';
    statusSubtitle.textContent = '0 / ' + files.length;
    overallProgress.style.width = '0%';
    overallText.textContent = '0%';
    statusItems.innerHTML = '';

    // 为每个文件创建状态行
    var itemElements = [];
    files.forEach(function (file) {
      var item = document.createElement('div');
      item.className = 'status-item uploading';
      item.innerHTML =
        '<span class="status-icon">⏳</span>' +
        '<span class="status-name">' + escapeHtml(file.name) + '</span>' +
        '<div class="item-progress"><div class="item-progress-fill" style="width:0%"></div></div>' +
        '<span class="status-detail">' + formatSize(file.size) + '</span>';
      statusItems.appendChild(item);
      itemElements.push(item);
    });

    var completed = 0;
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var itemEl = itemElements[i];

      try {
        var result = await uploadSingleFile(file, itemEl);
        if (result && result.savePath) {
          lastSavePath = result.savePath;
        }
        successCount++;
        itemEl.className = 'status-item success';
        itemEl.querySelector('.status-icon').textContent = '✅';
        itemEl.querySelector('.item-progress').style.display = 'none';
      } catch (err) {
        failCount++;
        itemEl.className = 'status-item error';
        itemEl.querySelector('.status-icon').textContent = '❌';
        itemEl.querySelector('.item-progress').style.display = 'none';
        itemEl.querySelector('.status-detail').textContent = err.message || '上传失败';
      }

      completed++;
      var pct = Math.round((completed / files.length) * 100);
      overallProgress.style.width = pct + '%';
      overallText.textContent = pct + '%';
      statusSubtitle.textContent = completed + ' / ' + files.length;
    }

    statusTitle.textContent = '上传完成';
    var msg = successCount + ' 个文件上传成功';
    if (failCount > 0) {
      msg += '，' + failCount + ' 个失败';
    }
    statusSubtitle.textContent = msg;

    // 显示保存路径提示
    if (lastSavePath) {
      showSavePathTip(lastSavePath);
    }

    doneBtn.style.display = '';
    revokeAllPreviewUrls();
    selectedFiles = [];
  }

  // ─── 上传单个文件（带进度） ───
  function uploadSingleFile(file, itemEl) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var formData = new FormData();
      formData.append('file', file);

      var progressFill = itemEl.querySelector('.item-progress-fill');

      xhr.upload.addEventListener('progress', function (e) {
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = pct + '%';
          itemEl.querySelector('.status-detail').textContent = pct + '%';
        }
      });

      xhr.addEventListener('load', function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
              resolve(data);
            } else {
              reject(new Error(data.error || '上传失败'));
            }
          } catch (e) {
            reject(new Error('响应解析失败'));
          }
        } else {
          try {
            var errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || '上传失败'));
          } catch (e) {
            reject(new Error('上传失败 (' + xhr.status + ')'));
          }
        }
      });

      xhr.addEventListener('error', function () {
        reject(new Error('网络错误'));
      });

      xhr.addEventListener('timeout', function () {
        reject(new Error('上传超时'));
      });

      xhr.timeout = 300000; // 5分钟超时
      xhr.open('POST', '/api/upload-single');
      xhr.send(formData);
    });
  }
})();
