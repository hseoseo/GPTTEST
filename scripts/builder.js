const state = {
  targetFile: null,
  targetFileName: '',
  entries: [],
};

const targetInput = document.querySelector('#target-file');
const targetOutput = document.querySelector('#target-file-output');
const addEntryButton = document.querySelector('#add-entry');
const entriesContainer = document.querySelector('#entries');
const downloadButton = document.querySelector('#download-project');
const exportSummary = document.querySelector('#export-summary');
const entryTemplate = document.querySelector('#entry-template');

const toEntryName = (index) => `コンテンツ${index + 1}`;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEntry = () => ({
  id: `entry-${createId()}`,
  name: toEntryName(state.entries.length),
  assetType: 'image',
  referenceFile: null,
  referencePreviewUrl: null,
  assetFile: null,
  assetPreviewUrl: null,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
});

const revokeUrl = (url) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const slugify = (value, fallback = 'asset') => {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return base || fallback;
};

const renderPreview = (container, entry, kind) => {
  container.innerHTML = '';
  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  placeholder.textContent = kind === 'asset' ? 'アセット未選択' : '画像未選択';

  const previewUrl = kind === 'asset' ? entry.assetPreviewUrl : entry.referencePreviewUrl;
  if (!previewUrl) {
    container.appendChild(placeholder);
    return;
  }

  if (kind === 'asset' && entry.assetType === 'video') {
    const video = document.createElement('video');
    video.src = previewUrl;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.controls = true;
    container.appendChild(video);
    return;
  }

  if (kind === 'asset' && entry.assetType === 'model') {
    const label = document.createElement('div');
    label.className = 'placeholder';
    label.textContent = entry.assetFile?.name || '3Dモデル';
    container.appendChild(label);
    return;
  }

  const image = document.createElement('img');
  image.src = previewUrl;
  image.alt = kind === 'asset' ? 'アセットプレビュー' : 'リファレンス画像';
  container.appendChild(image);
};

const getEntryIndex = (entryId) => state.entries.findIndex((entry) => entry.id === entryId);

const updateExportState = () => {
  const ready =
    Boolean(state.targetFile) &&
    state.entries.length > 0 &&
    state.entries.every((entry) => entry.assetFile);

  downloadButton.disabled = !ready;

  if (!state.targetFile) {
    exportSummary.textContent = 'ターゲットファイルを選択してください。';
    return;
  }

  if (state.entries.length === 0) {
    exportSummary.textContent = 'コンテンツを最低1件追加してください。';
    return;
  }

  if (!state.entries.every((entry) => entry.assetFile)) {
    exportSummary.textContent = 'すべてのコンテンツにアセットファイルを割り当ててください。';
    return;
  }

  exportSummary.textContent = `ターゲット ${state.entries.length} 件 / アセット準備完了`;
};

const renderEntries = () => {
  entriesContainer.innerHTML = '';

  state.entries.forEach((entry, index) => {
    const fragment = entryTemplate.content.cloneNode(true);
    const article = fragment.querySelector('.entry');
    article.dataset.entryId = entry.id;

    const indexEl = fragment.querySelector('.entry-index');
    indexEl.textContent = `#${index}`;

    const nameEl = fragment.querySelector('.entry-name');
    nameEl.textContent = entry.name;
    nameEl.addEventListener('input', (event) => {
      entry.name = event.target.textContent.trim() || toEntryName(index);
      updateExportState();
    });

    const assetTypeEl = fragment.querySelector('.asset-type');
    assetTypeEl.value = entry.assetType;
    assetTypeEl.addEventListener('change', (event) => {
      entry.assetType = event.target.value;
      const file = entry.assetFile;
      let valid = true;
      if (file) {
        if (entry.assetType === 'image') {
          valid = file.type.startsWith('image/');
        } else if (entry.assetType === 'video') {
          valid = file.type.startsWith('video/');
        } else if (entry.assetType === 'model') {
          valid = /\.(glb|gltf)$/i.test(file.name);
        }
      }
      if (!valid) {
        revokeUrl(entry.assetPreviewUrl);
        entry.assetFile = null;
        entry.assetPreviewUrl = null;
      }
      renderPreview(article.querySelector('[data-preview="asset"]'), entry, 'asset');
      updateExportState();
    });

    const referenceInput = fragment.querySelector('.reference-input');
    referenceInput.addEventListener('change', () => {
      const file = referenceInput.files?.[0];
      revokeUrl(entry.referencePreviewUrl);
      entry.referenceFile = file || null;
      entry.referencePreviewUrl = file ? URL.createObjectURL(file) : null;
      renderPreview(article.querySelector('[data-preview="reference"]'), entry, 'reference');
    });

    const assetInput = fragment.querySelector('.asset-input');
    const acceptMap = {
      image: 'image/*',
      video: 'video/*',
      model: '.glb,.gltf',
    };
    assetInput.setAttribute('accept', acceptMap[entry.assetType]);
    assetTypeEl.addEventListener('change', () => {
      assetInput.value = '';
      assetInput.setAttribute('accept', acceptMap[entry.assetType]);
    });
    assetInput.addEventListener('change', () => {
      const file = assetInput.files?.[0];
      revokeUrl(entry.assetPreviewUrl);
      entry.assetFile = file || null;
      entry.assetPreviewUrl = file && entry.assetType !== 'model' ? URL.createObjectURL(file) : null;
      renderPreview(article.querySelector('[data-preview="asset"]'), entry, 'asset');
      updateExportState();
    });

    const referencePreview = fragment.querySelector('[data-preview="reference"]');
    const assetPreview = fragment.querySelector('[data-preview="asset"]');
    renderPreview(referencePreview, entry, 'reference');
    renderPreview(assetPreview, entry, 'asset');

    const bindTransform = (selector, axis, category) => {
      const input = fragment.querySelector(selector);
      input.value = entry.transform[category][axis];
      input.addEventListener('input', (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value)) {
          entry.transform[category][axis] = value;
        }
      });
    };

    bindTransform('.position-x', 'x', 'position');
    bindTransform('.position-y', 'y', 'position');
    bindTransform('.position-z', 'z', 'position');
    bindTransform('.rotation-x', 'x', 'rotation');
    bindTransform('.rotation-y', 'y', 'rotation');
    bindTransform('.rotation-z', 'z', 'rotation');
    bindTransform('.scale-x', 'x', 'scale');
    bindTransform('.scale-y', 'y', 'scale');
    bindTransform('.scale-z', 'z', 'scale');

    const removeBtn = fragment.querySelector('.remove');
    removeBtn.addEventListener('click', () => {
      const entryIndex = getEntryIndex(entry.id);
      if (entryIndex !== -1) {
        const [removed] = state.entries.splice(entryIndex, 1);
        revokeUrl(removed.assetPreviewUrl);
        revokeUrl(removed.referencePreviewUrl);
        renderEntries();
        updateExportState();
      }
    });

    const moveUpBtn = fragment.querySelector('.move-up');
    moveUpBtn.addEventListener('click', () => {
      const entryIndex = getEntryIndex(entry.id);
      if (entryIndex > 0) {
        [state.entries[entryIndex - 1], state.entries[entryIndex]] = [
          state.entries[entryIndex],
          state.entries[entryIndex - 1],
        ];
        renderEntries();
        updateExportState();
      }
    });

    const moveDownBtn = fragment.querySelector('.move-down');
    moveDownBtn.addEventListener('click', () => {
      const entryIndex = getEntryIndex(entry.id);
      if (entryIndex !== -1 && entryIndex < state.entries.length - 1) {
        [state.entries[entryIndex + 1], state.entries[entryIndex]] = [
          state.entries[entryIndex],
          state.entries[entryIndex + 1],
        ];
        renderEntries();
        updateExportState();
      }
    });

    entriesContainer.appendChild(fragment);
  });
};

targetInput.addEventListener('change', () => {
  const file = targetInput.files?.[0];
  state.targetFile = file || null;
  state.targetFileName = file?.name || '';
  targetOutput.textContent = file
    ? `${file.name} (${formatBytes(file.size)})`
    : 'ファイルが選択されていません。';
  updateExportState();
});

addEntryButton.addEventListener('click', () => {
  state.entries.push(createEntry());
  renderEntries();
  updateExportState();
});

const generateReadme = (entryCount) => `# MindAR WebAR プロジェクト\n\nこのフォルダーには MindAR 用の WebAR 体験が含まれています。\n\n## 使い方\n\n1. サーバーにアップロードするか、静的ホスティングに配置します。\n2. \`index.html\` をブラウザーで開きます。\n3. カメラアクセスを許可し、用意したマーカーをスキャンすると登録したコンテンツが表示されます。\n\n## 構成\n\n- \`targets/targets.mind\` : MindAR のイメージターゲット。\n- \`assets/\` : 画像・動画・3Dモデルなどのコンテンツ。\n- \`config.json\` : このビルダーで設定した内容。\n\n登録済みターゲット数: ${entryCount}\n`;

const generateConfig = (assetMap) => ({
  name: 'MindAR WebAR Experience',
  createdAt: new Date().toISOString(),
  targetFile: 'targets/targets.mind',
  entries: state.entries.map((entry, index) => ({
    index,
    name: entry.name,
    asset: {
      type: entry.assetType,
      path: assetMap.get(entry.id)?.assetPath || '',
    },
    referenceImage: assetMap.get(entry.id)?.referencePath || null,
    transform: entry.transform,
  })),
});

const generateExportHtml = (config) => {
  const entriesJson = JSON.stringify(config.entries, null, 2);
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${config.name}</title>
    <style>
      body { margin: 0; font-family: 'Inter', 'Hiragino Sans', 'Noto Sans JP', sans-serif; background: #020617; color: #e2e8f0; }
      #ar-container { position: fixed; inset: 0; }
      .loading { position: fixed; inset: 0; display: grid; place-items: center; font-size: 1.2rem; letter-spacing: 0.05em; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.152.2/examples/js/loaders/GLTFLoader.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.1.7/dist/mindar-image-three.prod.js"></script>
  </head>
  <body>
    <div id="ar-container"></div>
    <div id="loading" class="loading">Loading MindAR Experience...</div>
    <script>
      const entries = ${entriesJson};

      const degToRad = (deg) => (deg * Math.PI) / 180;

      const setupEntry = async (entry, mindarThree, assets) => {
        const anchor = mindarThree.addAnchor(entry.index);
        const { THREE } = window;
        const { scene } = mindarThree;

        if (entry.asset.type === 'image') {
          const textureLoader = assets.textureLoader || (assets.textureLoader = new THREE.TextureLoader());
          const texture = await textureLoader.loadAsync(entry.asset.path);
          const geometry = new THREE.PlaneGeometry(1, 1);
          const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(entry.transform.position.x, entry.transform.position.y, entry.transform.position.z);
          mesh.rotation.set(
            degToRad(entry.transform.rotation.x),
            degToRad(entry.transform.rotation.y),
            degToRad(entry.transform.rotation.z)
          );
          const ratio = texture.image.height / texture.image.width;
          mesh.scale.set(entry.transform.scale.x, entry.transform.scale.y * ratio, entry.transform.scale.z);
          anchor.group.add(mesh);
          return;
        }

        if (entry.asset.type === 'video') {
          const video = document.createElement('video');
          video.src = entry.asset.path;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          const texture = new THREE.VideoTexture(video);
          const geometry = new THREE.PlaneGeometry(1, 1);
          const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(entry.transform.position.x, entry.transform.position.y, entry.transform.position.z);
          mesh.rotation.set(
            degToRad(entry.transform.rotation.x),
            degToRad(entry.transform.rotation.y),
            degToRad(entry.transform.rotation.z)
          );
          mesh.scale.set(entry.transform.scale.x, entry.transform.scale.y, entry.transform.scale.z);
          anchor.group.add(mesh);
          anchor.onTargetFound = () => {
            video.play().catch(() => {});
          };
          anchor.onTargetLost = () => {
            video.pause();
          };
          return;
        }

        if (entry.asset.type === 'model') {
          const loader = assets.gltfLoader || (assets.gltfLoader = new THREE.GLTFLoader());
          const gltf = await loader.loadAsync(entry.asset.path);
          const root = gltf.scene;
          root.position.set(entry.transform.position.x, entry.transform.position.y, entry.transform.position.z);
          root.rotation.set(
            degToRad(entry.transform.rotation.x),
            degToRad(entry.transform.rotation.y),
            degToRad(entry.transform.rotation.z)
          );
          root.scale.set(entry.transform.scale.x, entry.transform.scale.y, entry.transform.scale.z);
          anchor.group.add(root);
          const { AnimationMixer, Clock } = THREE;
          if (!assets.clock) {
            assets.clock = new Clock();
          }
          if (!assets.mixers) {
            assets.mixers = [];
          }
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new AnimationMixer(root);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
            assets.mixers.push(mixer);
          }
          return;
        }
      };

      (async () => {
        const mindarThree = new window.MINDAR.IMAGE.MindARThree({
          container: document.querySelector('#ar-container'),
          imageTargetSrc: '${config.targetFile}',
        });

        const { renderer, scene, camera } = mindarThree;
        const assets = {};

        for (const entry of entries) {
          await setupEntry(entry, mindarThree, assets);
        }

        await mindarThree.start();
        document.getElementById('loading').style.display = 'none';
        renderer.setAnimationLoop(() => {
          if (assets.mixers && assets.clock) {
            const delta = assets.clock.getDelta();
            assets.mixers.forEach((mixer) => mixer.update(delta));
          }
          renderer.render(scene, camera);
        });
      })().catch((error) => {
        console.error(error);
        document.getElementById('loading').textContent = 'エラーが発生しました。コンソールを確認してください。';
      });
    </script>
  </body>
</html>`;
};

const downloadProject = async () => {
  if (!state.targetFile || state.entries.length === 0) return;
  const zip = new JSZip();
  const assetsFolder = zip.folder('assets');
  const targetFolder = zip.folder('targets');
  const referenceFolder = zip.folder('references');

  targetFolder.file('targets.mind', await state.targetFile.arrayBuffer());

  const assetMap = new Map();

  const usedNames = new Set();
  const ensureUnique = (name, ext) => {
    let candidate = `${name}.${ext}`;
    let counter = 1;
    while (usedNames.has(candidate)) {
      candidate = `${name}-${counter}.${ext}`;
      counter += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };

  for (let index = 0; index < state.entries.length; index += 1) {
    const entry = state.entries[index];
    if (!entry.assetFile) continue;
    const assetExt = entry.assetFile.name.split('.').pop()?.toLowerCase() || 'bin';
    const baseName = slugify(entry.name || toEntryName(index), `asset-${index + 1}`);
    const assetFileName = ensureUnique(`${String(index + 1).padStart(2, '0')}-${baseName}`, assetExt);
    assetsFolder.file(assetFileName, await entry.assetFile.arrayBuffer());

    let referencePath = null;
    if (entry.referenceFile) {
      const refExt = entry.referenceFile.name.split('.').pop()?.toLowerCase() || 'png';
      const refFileName = ensureUnique(`${String(index + 1).padStart(2, '0')}-${baseName}-ref`, refExt);
      referenceFolder.file(refFileName, await entry.referenceFile.arrayBuffer());
      referencePath = `references/${refFileName}`;
    }

    assetMap.set(entry.id, {
      assetPath: `assets/${assetFileName}`,
      referencePath,
    });
  }

  const config = generateConfig(assetMap);
  zip.file('config.json', JSON.stringify(config, null, 2));
  zip.file('README.md', generateReadme(state.entries.length));
  zip.file('index.html', generateExportHtml(config));

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = `mindar-experience-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  if (typeof saveAs === 'function') {
    saveAs(blob, fileName);
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }
};

downloadButton.addEventListener('click', () => {
  downloadProject().catch((error) => {
    console.error(error);
    alert('エクスポート中にエラーが発生しました。詳細はコンソールを確認してください。');
  });
});

updateExportState();
