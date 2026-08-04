import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  CloudOff,
  CloudUpload,
  Download,
  FileImage,
  Gauge,
  Home,
  KeyRound,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { NoticeStack, type NoticeMessage, type NoticeTone } from './components/NoticeStack'
import { useSpeechReader } from './hooks/useSpeechReader'
import { createProject, listProjects, removeProject, saveProject } from './lib/db'
import { clearCloudOcrPin, CloudOcrError, getCloudOcrPin, recognizeWithTencent, saveCloudOcrPin } from './lib/cloudOcr'
import { lookupWord, prepareOfflineResources } from './lib/dictionary'
import { prepareCloudImage, prepareImage, type PreparedImage } from './lib/image'
import { cancelRecognition, recognizeEnglish, type OcrProgress } from './lib/ocr'
import { splitSentences, tokenizeSentence } from './lib/sentences'
import type { AppView, DictionaryEntry, ReadingProject, ReadingRate } from './types'

const OCR_STATUS: Record<string, string> = {
  'loading tesseract core': '正在加载 OCR 引擎',
  'initializing tesseract': '正在初始化识别引擎',
  'loading language traineddata': '正在加载英文模型',
  'initializing api': '正在准备英文识别',
  'reusing initialized worker': 'OCR 引擎已就绪',
  'recognizing text': '正在识别书页文字',
}

const OCR_HINT: Record<string, string> = {
  'loading tesseract core': '首次使用需下载约 6 MB，完成后会保存在这台设备。',
  'loading language traineddata': '首次使用需下载约 6 MB，完成后会保存在这台设备。',
  'initializing tesseract': '正在设备中启动本地识别引擎。',
  'initializing api': '正在设备中准备英文识别。',
  'reusing initialized worker': '已复用本次打开期间加载的模型。',
  'recognizing text': '所有文字识别都在这台设备中完成。',
}

export function App() {
  const [view, setView] = useState<AppView>('library')
  const [projects, setProjects] = useState<ReadingProject[]>([])
  const [project, setProject] = useState<ReadingProject | null>(null)
  const [notice, setNotice] = useState<NoticeMessage | null>(null)
  const noticeId = useRef(0)
  const [persistent, setPersistent] = useState<boolean | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  const showNotice = useCallback((message: string, tone: NoticeTone = 'info') => {
    noticeId.current += 1
    setNotice({ id: noticeId.current, message, tone })
  }, [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  const refreshProjects = useCallback(async () => setProjects(await listProjects()), [])

  useEffect(() => {
    void refreshProjects()
    if (navigator.storage) {
      void navigator.storage.persisted?.().then(setPersistent)
      void navigator.storage.estimate?.().then(({ usage = 0, quota = 0 }) => setStorage({ usage, quota }))
    }
  }, [refreshProjects])

  useEffect(() => {
    if (!offlineReady) return
    showNotice('应用外壳已可离线使用。', 'success')
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, showNotice])

  const navigate = useCallback((next: AppView) => {
    window.location.hash = next
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const openProject = useCallback((selected: ReadingProject, target: AppView = selected.text ? 'reader' : 'capture') => {
    setProject(selected)
    navigate(target)
  }, [navigate])

  const updateProject = useCallback(async (next: ReadingProject) => {
    const saved = await saveProject(next)
    setProject(saved)
    await refreshProjects()
    return saved
  }, [refreshProjects])

  const goHome = useCallback(() => {
    window.speechSynthesis?.cancel()
    setProject(null)
    navigate('library')
    void refreshProjects()
  }, [navigate, refreshProjects])

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand-button" onClick={goHome} aria-label="回到项目库">
          <span className="brand-mark"><BookOpen size={20} /></span>
          <span><strong>PageVoice</strong><small>英文拍照读书</small></span>
        </button>
        <div className="header-actions">
          {view !== 'library' && <button className="icon-button" onClick={goHome} aria-label="项目库"><Home size={20} /></button>}
          <button className="icon-button" onClick={() => navigate('settings')} aria-label="设置"><Settings size={20} /></button>
        </div>
      </header>

      <NoticeStack
        notice={notice}
        needRefresh={needRefresh}
        onDismiss={dismissNotice}
        onUpdate={() => void updateServiceWorker(true)}
      />

      {view === 'library' && (
        <Library
          projects={projects}
          onCreate={async () => openProject(await createProject(), 'capture')}
          onOpen={openProject}
          onRename={async (item) => {
            const title = window.prompt('项目名称', item.title)?.trim()
            if (title) await updateProject({ ...item, title })
          }}
          onDelete={async (item) => {
            if (!window.confirm(`删除“${item.title}”？本机保存的正文和进度也会删除。`)) return
            await removeProject(item.id)
            await refreshProjects()
          }}
        />
      )}

      {view === 'capture' && project && (
        <Capture
          project={project}
          onBack={goHome}
          onPaste={() => navigate('edit')}
          onRecognized={async (text, thumbnail) => {
            const sentences = splitSentences(text)
            await updateProject({ ...project, text, sentences, thumbnail, currentSentence: 0 })
            navigate('edit')
          }}
        />
      )}

      {view === 'edit' && project && (
        <Editor
          project={project}
          onBack={() => navigate(project.text ? 'reader' : 'capture')}
          onSave={async (text) => {
            const sentences = splitSentences(text)
            await updateProject({ ...project, text: text.trim(), sentences, currentSentence: Math.min(project.currentSentence, Math.max(0, sentences.length - 1)) })
            navigate('reader')
          }}
        />
      )}

      {view === 'reader' && project && (
        <Reader
          project={project}
          onEdit={() => navigate('edit')}
          onChange={updateProject}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          persistent={persistent}
          storage={storage}
          onBack={() => project ? navigate('reader') : navigate('library')}
          onPersistence={async () => {
            if (!navigator.storage?.persist) return showNotice('当前浏览器不支持请求持久存储。', 'warning')
            try {
              const granted = await navigator.storage.persist()
              setPersistent(granted)
              showNotice(
                granted ? '本地项目已获得持久存储保护。' : '浏览器暂未授予持久存储；请定期打开应用。',
                granted ? 'success' : 'warning',
              )
            } catch (error) {
              showNotice(error instanceof Error ? error.message : '持久存储申请失败。', 'error')
            }
          }}
          onNotice={showNotice}
        />
      )}
    </div>
  )
}

function Library({ projects, onCreate, onOpen, onRename, onDelete }: {
  projects: ReadingProject[]
  onCreate: () => void
  onOpen: (project: ReadingProject) => void
  onRename: (project: ReadingProject) => void
  onDelete: (project: ReadingProject) => void
}) {
  return (
    <main className="app-content app-content--wide library-view">
      <section className="library-intro">
        <div>
          <span className="eyebrow">PRIVATE · LOCAL · CALM</span>
          <h1>把英文书页，变成可以听的阅读伙伴。</h1>
          <p>默认在这台设备中处理，也可由你选择联网高精度识别。拍一页、校对一下，然后跟着高亮逐句阅读。</p>
        </div>
        <button className="primary-button primary-button--large" onClick={onCreate}><Camera size={21} />拍一页开始</button>
      </section>

      <section className="section-heading">
        <div><span className="section-kicker">MY READING</span><h2>我的阅读项目</h2></div>
        <span>{projects.length} 个项目</span>
      </section>

      {projects.length ? (
        <div className="project-grid">
          {projects.map((item) => <ProjectCard key={item.id} project={item} onOpen={() => onOpen(item)} onRename={() => onRename(item)} onDelete={() => onDelete(item)} />)}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-illustration"><BookOpen size={44} /><span>ABC</span></div>
          <h2>书架还是空的</h2>
          <p>拍摄一张清晰的英文书页，或者直接粘贴一段英文开始体验。</p>
          <button className="primary-button" onClick={onCreate}><Plus size={19} />创建第一个项目</button>
        </div>
      )}
    </main>
  )
}

function ProjectCard({ project, onOpen, onRename, onDelete }: { project: ReadingProject; onOpen: () => void; onRename: () => void; onDelete: () => void }) {
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  useEffect(() => {
    if (!project.thumbnail) return
    const url = URL.createObjectURL(project.thumbnail)
    setThumbnailUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [project.thumbnail])

  const progress = project.sentences.length ? Math.round(((project.currentSentence + 1) / project.sentences.length) * 100) : 0
  return (
    <article className="project-card" onClick={onOpen}>
      <div className="project-cover">
        {thumbnailUrl ? <img src={thumbnailUrl} alt="书页缩略图" /> : <div className="cover-placeholder"><BookOpen size={34} /><span>ENGLISH</span></div>}
        <span className="privacy-badge"><CloudOff size={13} />仅保存在本机</span>
      </div>
      <div className="project-card__body">
        <div className="project-card__top"><h3>{project.title}</h3><button className="icon-button icon-button--small" onClick={(event) => { event.stopPropagation(); onRename() }} aria-label="重命名"><MoreHorizontal size={18} /></button></div>
        <p>{project.text ? `${project.sentences.length} 句 · 上次读到第 ${project.currentSentence + 1} 句` : '等待拍照或粘贴文字'}</p>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="project-card__footer"><time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(project.updatedAt)}</time><button className="text-button text-button--danger" onClick={(event) => { event.stopPropagation(); onDelete() }}><Trash2 size={15} />删除</button></div>
      </div>
    </article>
  )
}

export function Capture({ project, onBack, onPaste, onRecognized }: { project: ReadingProject; onBack: () => void; onPaste: () => void; onRecognized: (text: string, thumbnail: Blob) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [rotation, setRotation] = useState(0)
  const [enhanced, setEnhanced] = useState(false)
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [scanMode, setScanMode] = useState<'local' | 'cloud' | null>(null)
  const [error, setError] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const cancelledRef = useRef(false)
  const cloudAbortRef = useRef<AbortController | null>(null)
  const scanning = scanMode !== null

  const process = useCallback(async (source: File, nextRotation: number, nextEnhanced: boolean) => {
    setError('')
    try { setImage(await prepareImage(source, nextRotation, nextEnhanced)) } catch (reason) { setError(reason instanceof Error ? reason.message : '图片处理失败。') }
  }, [])

  const choose = (selected?: File) => {
    if (!selected) return
    setFile(selected); setRotation(0); setEnhanced(false); void process(selected, 0, false)
  }

  const rotate = () => {
    if (!file) return
    const next = (rotation + 90) % 360
    setRotation(next); void process(file, next, enhanced)
  }

  const toggleEnhanced = () => {
    if (!file) return
    const next = !enhanced
    setEnhanced(next); void process(file, rotation, next)
  }

  const recognizeLocal = async () => {
    if (!image) return
    cancelledRef.current = false
    setScanMode('local'); setError(''); setProgress({ status: 'loading tesseract core', progress: 0 })
    try {
      const text = await recognizeEnglish(image.dataUrl, setProgress)
      if (!text.trim()) throw new Error('没有识别到英文文字。请检查清晰度、方向和光线后重试。')
      await onRecognized(text, image.thumbnail)
    } catch (reason) {
      if (!cancelledRef.current) setError(reason instanceof Error ? reason.message : 'OCR 识别失败，请重试。')
    } finally { setScanMode(null) }
  }

  const recognizeCloud = async (pin: string) => {
    if (!image) return
    if (!navigator.onLine) return setError('当前设备处于离线状态，请联网后使用高精度识别，或改用本地离线识别。')
    cancelledRef.current = false
    const controller = new AbortController()
    cloudAbortRef.current = controller
    setScanMode('cloud'); setError(''); setProgress(null)
    try {
      const imageBase64 = await prepareCloudImage(image.dataUrl)
      if (controller.signal.aborted) throw new DOMException('OCR cancelled', 'AbortError')
      const result = await recognizeWithTencent(imageBase64, pin, controller.signal)
      const text = result.text?.trim() ?? ''
      if (!text) throw new CloudOcrError('腾讯云没有识别到英文文字，请检查清晰度后重试或改用本地识别。', 'NO_TEXT')
      saveCloudOcrPin(pin)
      await onRecognized(text, image.thumbnail)
    } catch (reason) {
      if (reason instanceof CloudOcrError && reason.code === 'INVALID_PIN') {
        clearCloudOcrPin(); setPinDraft(''); setPinOpen(true)
      }
      if (!cancelledRef.current && !(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : '高精度识别失败，请改用本地识别。')
      }
    } finally {
      if (cloudAbortRef.current === controller) cloudAbortRef.current = null
      setScanMode(null)
    }
  }

  const requestCloudRecognition = () => {
    const savedPin = getCloudOcrPin()
    if (savedPin) void recognizeCloud(savedPin)
    else { setPinDraft(''); setPinOpen(true) }
  }

  const cancelScan = () => {
    cancelledRef.current = true
    if (scanMode === 'cloud') cloudAbortRef.current?.abort()
    else void cancelRecognition()
    setScanMode(null)
  }

  return (
    <main className="app-content capture-view">
      <div className="page-toolbar"><button className="back-button" onClick={onBack}><ChevronLeft size={19} />项目库</button><span>{project.title}</span></div>
      <div className="page-title"><span className="step-badge">1</span><div><h1>拍摄或选择书页</h1><p>尽量让文字清晰、页面平整，并避开阴影和反光。</p></div></div>

      {!image ? (
        <div className="capture-options">
          <label className="capture-option capture-option--primary"><Camera size={35} /><strong>拍摄书页</strong><span>使用后置摄像头</span><input type="file" accept="image/*" capture="environment" onChange={(event) => choose(event.target.files?.[0])} /></label>
          <label className="capture-option"><FileImage size={35} /><strong>从相册选择</strong><span>JPG、PNG；Safari 可选 HEIC</span><input type="file" accept="image/*" onChange={(event) => choose(event.target.files?.[0])} /></label>
          <button className="paste-option" onClick={onPaste}>没有照片？直接粘贴英文文字</button>
        </div>
      ) : (
        <div className="capture-workspace">
          <div className="image-preview"><img src={image.dataUrl} alt="待识别书页" /></div>
          <div className="image-actions">
            <button className="secondary-button" onClick={rotate} disabled={scanning}><RotateCw size={18} />旋转</button>
            <button className={`secondary-button ${enhanced ? 'is-active' : ''}`} onClick={toggleEnhanced} disabled={scanning}><Sparkles size={18} />增强文字</button>
            <label className="secondary-button"><FileImage size={18} />换一张<input type="file" accept="image/*" onChange={(event) => choose(event.target.files?.[0])} /></label>
          </div>
          {scanning ? (
            <div className="ocr-progress" role="status">
              <div className="progress-ring"><span>{scanMode === 'cloud' ? <CloudUpload size={22} /> : `${Math.round((progress?.progress ?? 0) * 100)}%`}</span></div>
              {scanMode === 'cloud'
                ? <div><strong>正在高精度识别</strong><p>压缩书页后发送给腾讯云，本应用不会保存原图。</p></div>
                : <div><strong>{OCR_STATUS[progress?.status ?? ''] ?? '正在本地识别'}</strong><p>{OCR_HINT[progress?.status ?? ''] ?? '所有处理都在这台设备中完成。'}</p></div>}
              <button className="secondary-button" onClick={cancelScan}><CircleStop size={18} />取消</button>
            </div>
          ) : (
            <div className="ocr-choices">
              <button className="primary-button" onClick={requestCloudRecognition}><CloudUpload size={19} />高精度识别（需联网）</button>
              <button className="secondary-button" onClick={() => void recognizeLocal()}><Sparkles size={19} />本地离线识别</button>
            </div>
          )}
        </div>
      )}
      {error && <div className="error-message" role="alert">{error}</div>}
      <div className="privacy-note"><CloudOff size={18} /><div><strong>由你决定是否上传</strong><p>本地识别不会上传照片；只有点击“高精度识别”后，当前压缩图片才会发送给腾讯云完成一次识别。PageVoice2 不保存原图。</p></div></div>
      {pinOpen && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPinOpen(false) }}>
          <form className="pin-dialog" role="dialog" aria-modal="true" aria-labelledby="pin-dialog-title" onSubmit={(event) => {
            event.preventDefault()
            const pin = pinDraft.trim()
            if (!pin) return
            setPinOpen(false)
            void recognizeCloud(pin)
          }}>
            <button type="button" className="dialog-close" onClick={() => setPinOpen(false)} aria-label="关闭"><X size={18} /></button>
            <span className="dialog-icon"><KeyRound size={24} /></span>
            <h2 id="pin-dialog-title">使用家庭高精度识别</h2>
            <p>当前压缩书页将发送给腾讯云 OCR 处理。服务端不保存原图、PIN 或识别请求；验证成功后 PIN 仅保存在这台设备。</p>
            <label>家庭 PIN<input autoFocus type="password" inputMode="text" autoComplete="off" minLength={6} maxLength={64} pattern="[A-Za-z0-9]+" value={pinDraft} onChange={(event) => setPinDraft(event.target.value)} placeholder="6–12 位字母和数字" /></label>
            <button className="primary-button" type="submit" disabled={!pinDraft.trim()}><CloudUpload size={18} />同意并开始识别</button>
          </form>
        </div>
      )}
    </main>
  )
}

function Editor({ project, onBack, onSave }: { project: ReadingProject; onBack: () => void; onSave: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState(project.text)
  const [error, setError] = useState('')
  return (
    <main className="app-content editor-view">
      <div className="page-toolbar"><button className="back-button" onClick={onBack}><ChevronLeft size={19} />返回</button><span>校对文字</span></div>
      <div className="page-title"><span className="step-badge">2</span><div><h1>检查识别文字</h1><p>修正漏字和断行。保存后会自动按英文句子拆分。</p></div></div>
      <div className="editor-card">
        <div className="editor-meta"><span>{draft.trim().split(/\s+/).filter(Boolean).length} 个词</span><span>预计 {splitSentences(draft).length} 句</span></div>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="在这里粘贴或校对英文正文……" spellCheck lang="en" />
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      <button className="primary-button primary-button--wide" onClick={() => {
        if (!draft.trim()) return setError('请先输入或识别英文正文。')
        setError(''); void onSave(draft)
      }}><BookOpen size={19} />保存并开始阅读</button>
    </main>
  )
}

function Reader({ project, onEdit, onChange }: { project: ReadingProject; onEdit: () => void; onChange: (project: ReadingProject) => Promise<ReadingProject> }) {
  const [wordEntry, setWordEntry] = useState<DictionaryEntry | null>(null)
  const [wordLoading, setWordLoading] = useState('')
  const [lookupOpen, setLookupOpen] = useState(false)
  const onIndexChange = useCallback((currentSentence: number) => { void onChange({ ...project, currentSentence }) }, [onChange, project])
  const speech = useSpeechReader({
    sentences: project.sentences,
    currentIndex: project.currentSentence,
    rate: project.rate,
    voiceURI: project.voiceURI,
    repeat: project.repeatSentence,
    onIndexChange,
  })

  useEffect(() => {
    document.querySelector(`[data-sentence="${project.currentSentence}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [project.currentSentence])

  const chooseWord = async (word: string) => {
    setLookupOpen(true); setWordEntry(null); setWordLoading(word)
    try { setWordEntry(await lookupWord(word)) } finally { setWordLoading('') }
  }

  return (
    <main className="reader-layout">
      <section className="reading-pane">
        <div className="reader-header">
          <div><span className="eyebrow">NOW READING</span><h1>{project.title}</h1><p>第 {project.currentSentence + 1} / {project.sentences.length} 句</p></div>
          <button className="secondary-button" onClick={onEdit}>校对文字</button>
        </div>
        <article className="reading-text" lang="en">
          {project.sentences.map((sentence, index) => (
            <div
              className={`sentence ${index === project.currentSentence ? 'is-current' : ''}`}
              data-sentence={index}
              key={`${index}-${sentence.slice(0, 18)}`}
              onClick={() => speech.speakAt(index)}
            >
              <button className="sentence-start" onClick={(event) => { event.stopPropagation(); speech.speakAt(index) }} aria-label={`从第 ${index + 1} 句开始朗读`}><Play size={13} fill="currentColor" /></button>
              {tokenizeSentence(sentence).map((token, tokenIndex) => token.isWord ? (
                <button className="word" key={tokenIndex} onClick={(event) => { event.stopPropagation(); void chooseWord(token.value) }}>{token.value}</button>
              ) : <span key={tokenIndex}>{token.value}</span>)}
            </div>
          ))}
        </article>
      </section>

      <aside className={`dictionary-panel ${lookupOpen ? 'is-open' : ''}`} aria-label="单词释义">
        <button className="panel-close" onClick={() => setLookupOpen(false)} aria-label="关闭释义"><X size={20} /></button>
        {!lookupOpen ? (
          <div className="dictionary-empty"><Volume2 size={32} /><h2>点击正文中的单词</h2><p>这里会显示中文释义和英文发音。</p></div>
        ) : wordLoading ? (
          <div className="dictionary-empty"><RefreshCw className="spin" size={30} /><p>正在查找 {wordLoading}…</p></div>
        ) : wordEntry ? (
          <div className="dictionary-entry">
            <span className="eyebrow">WORD LOOKUP</span>
            <div className="word-title"><h2>{wordEntry.word}</h2><button className="round-speak" onClick={() => speech.speakWord(wordEntry.word)} aria-label={`朗读 ${wordEntry.word}`}><Volume2 size={21} /></button></div>
            {wordEntry.phonetic && <p className="phonetic">/{wordEntry.phonetic}/</p>}
            {wordEntry.lemma && <p className="lemma">原形：<strong>{wordEntry.lemma}</strong></p>}
            <ol className="translations">{wordEntry.translations.map((item, index) => <li key={index}><span>{index + 1}</span>{item}</li>)}</ol>
            <p className="dictionary-tip">听完单词后，点击播放会从当前句句首继续。</p>
          </div>
        ) : (
          <div className="dictionary-empty"><BookOpen size={30} /><h2>核心词典未收录</h2><p>可以根据上下文理解，或稍后查阅更完整的词典。</p></div>
        )}
      </aside>

      <div className="player-bar">
        {speech.error && <div className="speech-error" role="alert"><span>{speech.error}</span><button onClick={speech.clearError} aria-label="关闭朗读提示"><X size={15} /></button></div>}
        <button className="player-icon" onClick={speech.previous} aria-label="上一句"><ChevronLeft size={25} /></button>
        <button
          className="play-button"
          onClick={speech.toggle}
          aria-label={speech.status === 'starting' ? '取消语音启动' : speech.status === 'speaking' ? '暂停' : '播放'}
        >
          {speech.status === 'starting' ? <RefreshCw className="spin" size={25} /> : speech.status === 'speaking' ? <Pause size={27} /> : <Play size={27} fill="currentColor" />}
        </button>
        <button className="player-icon" onClick={speech.next} aria-label="下一句"><ChevronRight size={25} /></button>
        <button className={`repeat-button ${project.repeatSentence ? 'is-active' : ''}`} onClick={() => void onChange({ ...project, repeatSentence: !project.repeatSentence })}><RefreshCw size={18} />单句</button>
        <div className="rate-switch" aria-label="语速">
          {[0.75, 1, 1.2].map((rate) => <button key={rate} className={project.rate === rate ? 'is-active' : ''} onClick={() => void onChange({ ...project, rate: rate as ReadingRate })}>{rate}×</button>)}
        </div>
        <select className="voice-select" value={project.voiceURI} onChange={(event) => void onChange({ ...project, voiceURI: event.target.value })} aria-label="英文声音">
          <option value="">设备默认英文声音</option>
          {speech.voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}
        </select>
        {speech.status === 'paused' && !speech.error && <button className="restart-link" onClick={speech.restartCurrent}>没声音？从句首重播</button>}
      </div>
    </main>
  )
}

function SettingsView({ persistent, storage, onBack, onPersistence, onNotice }: {
  persistent: boolean | null
  storage: { usage: number; quota: number } | null
  onBack: () => void
  onPersistence: () => void
  onNotice: (message: string, tone?: NoticeTone) => void
}) {
  const [offlineProgress, setOfflineProgress] = useState<number | null>(null)
  const [cloudPinSaved, setCloudPinSaved] = useState(() => Boolean(getCloudOcrPin()))
  const storageLabel = useMemo(() => storage ? `${(storage.usage / 1024 / 1024).toFixed(1)} MB / ${(storage.quota / 1024 / 1024 / 1024).toFixed(1)} GB` : '浏览器未提供容量信息', [storage])
  return (
    <main className="app-content settings-view">
      <div className="page-toolbar"><button className="back-button" onClick={onBack}><ChevronLeft size={19} />返回</button><span>设置与离线</span></div>
      <div className="page-title"><span className="step-badge"><Settings size={20} /></span><div><h1>让阅读更安心</h1><p>准备离线资源，并了解这台设备上的保存状态。</p></div></div>
      <section className="settings-card">
        <div className="settings-icon"><Download size={24} /></div>
        <div><h2>离线阅读包</h2><p>下载快速英文 OCR 模型和 5 万词核心词典。首次准备约需 20 MB，之后断网也能使用。</p>{offlineProgress !== null && <div className="progress-track"><span style={{ width: `${offlineProgress}%` }} /></div>}</div>
        <button className="primary-button" disabled={offlineProgress !== null && offlineProgress < 100} onClick={async () => {
          setOfflineProgress(0)
          try {
            await prepareOfflineResources((done, total) => setOfflineProgress(Math.round((done / total) * 100)))
            setOfflineProgress(100); onNotice('离线 OCR 和核心词典已准备完成。', 'success')
          } catch (error) { setOfflineProgress(null); onNotice(error instanceof Error ? error.message : '离线资源准备失败。', 'error') }
        }}>{offlineProgress === 100 ? '已准备' : offlineProgress !== null ? `${offlineProgress}%` : '准备离线资源'}</button>
      </section>
      <section className="settings-card">
        <div className="settings-icon"><Gauge size={24} /></div>
        <div><h2>本地存储</h2><p>{storageLabel}。项目保存在浏览器 IndexedDB 中，系统存储压力较大时仍可能被清理。</p><span className={`status-pill ${persistent ? 'is-good' : ''}`}>{persistent ? '已获得持久存储' : '普通本地存储'}</span></div>
        {!persistent && <button className="secondary-button" onClick={onPersistence}>请求保护</button>}
      </section>
      <section className="settings-card">
        <div className="settings-icon"><KeyRound size={24} /></div>
        <div><h2>家庭高精度识别</h2><p>家庭 PIN 只保存在这台设备，用于防止他人消耗腾讯云 OCR 额度。</p><span className={`status-pill ${cloudPinSaved ? 'is-good' : ''}`}>{cloudPinSaved ? '已保存家庭 PIN' : '尚未验证家庭 PIN'}</span></div>
        {cloudPinSaved && <button className="secondary-button" onClick={() => { clearCloudOcrPin(); setCloudPinSaved(false); onNotice('这台设备保存的家庭 PIN 已清除。', 'success') }}>清除 PIN</button>}
      </section>
      <section className="settings-card settings-card--about">
        <div className="settings-icon"><CloudOff size={24} /></div>
        <div><h2>隐私说明</h2><p>PageVoice 默认在本机处理；只有你明确选择高精度识别时，当前压缩图片才会发送给腾讯云 OCR。应用不保存原图，也没有账号、云同步或行为追踪。清除浏览器网站数据会同时删除本地项目和家庭 PIN。</p></div>
      </section>
      <footer className="credits">界面设计基于 Esther Design System · © ESTHER不二 · CC BY-NC-SA 4.0</footer>
    </main>
  )
}
