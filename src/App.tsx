import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Cloud,
  CloudOff,
  Feather,
  FileText,
  Globe2,
  Home,
  Eye,
  EyeOff,
  Library,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import './App.css'
import { normalizeAppData } from './data/normalize'
import { seedData } from './data/seed'
import { addDays, formatShortDate, fromLocalISO, toLocalISO, todayISO } from './lib/date'
import { removeEntry, replaceEntry, toggleEntryVisibility } from './lib/entries'
import { buildPlanItems, planProgress } from './lib/plan'
import { localStore } from './services/localStore'
import {
  cloudAuth,
  currentUser,
  initializeOwner,
  loadCloudData,
  loadPublicSpace,
  ownerExists,
  saveCloudData,
  signIn,
  signOut,
  signUpOwner,
  type CloudUser,
  type PublicSpace,
} from './services/cloudbase'
import { checkReminders, notificationPermission, requestReminderPermission } from './services/reminders'
import type { AppData, DistributionMode, Entry, EntryCategory, Plan, Reflection } from './types'

type Page = 'today' | 'entries' | 'plans' | 'reviews' | 'public' | 'settings'
type Theme = 'light' | 'dark'
type SyncState = 'loading' | 'saving' | 'saved' | 'offline'
type DataSetter = React.Dispatch<React.SetStateAction<AppData>>

const navigation: Array<{ id: Page; label: string; icon: LucideIcon }> = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'entries', label: '记录', icon: Feather },
  { id: 'plans', label: '计划', icon: Target },
  { id: 'reviews', label: '复盘', icon: CalendarDays },
  { id: 'public', label: '公开主页', icon: Globe2 },
]

const pageTitles: Record<Page, { eyebrow: string; title: string }> = {
  today: { eyebrow: '你的生活，慢慢写', title: '今天，想完成什么？' },
  entries: { eyebrow: '每一种经历，都值得归档', title: '记录' },
  plans: { eyebrow: '把遥远的目标，放进每一天', title: '计划' },
  reviews: { eyebrow: '看见行动，也看见原因', title: '复盘' },
  public: { eyebrow: '选择你愿意分享的部分', title: '公开主页' },
  settings: { eyebrow: '你的空间，由你决定', title: '设置' },
}

const categoryIcons: Record<string, LucideIcon> = {
  briefcase: BriefcaseBusiness,
  book: BookOpen,
  library: Library,
  file: FileText,
}

const cloudDataDefaults: AppData = {
  ...seedData,
  entries: [],
  tasks: [],
  plans: [],
  reflections: [],
}

const currentYear = new Date().getFullYear()

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function go(path: string) {
  window.location.hash = path === '/' ? '' : path
}

function App() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '/')
  const [user, setUser] = useState<CloudUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const updatePath = () => setPath(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', updatePath)
    return () => window.removeEventListener('hashchange', updatePath)
  }, [])

  useEffect(() => {
    currentUser().then(setUser).finally(() => setCheckingSession(false))
    const { data } = cloudAuth.onAuthStateChange((_event, session) => {
      setUser((session?.user as CloudUser | undefined) ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (checkingSession) return <LoadingScreen label="正在确认你的空间……" />

  if (path === '/login') {
    if (user) {
      go('/app')
      return <LoadingScreen label="正在进入私人空间……" />
    }
    return <LoginPage onAuthenticated={(nextUser) => { setUser(nextUser); go('/app') }} />
  }

  if (path.startsWith('/app')) {
    if (!user) return <LoginPage onAuthenticated={(nextUser) => setUser(nextUser)} />
    return <Workspace user={user} onSignedOut={() => { setUser(null); go('/') }} />
  }

  const slug = path.startsWith('/u/') ? decodeURIComponent(path.slice(3)) : undefined
  return <PublicHome slug={slug} canEnterWorkspace={Boolean(user)} />
}

function Workspace({ user, onSignedOut }: { user: CloudUser; onSignedOut: () => void }) {
  const [page, setPage] = useState<Page>('today')
  const [data, setData] = useState<AppData>(() => localStore.load(seedData))
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('loading')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    loadCloudData(user)
      .then(async (cloudData) => {
        if (!active) return
        if (cloudData) setData(normalizeAppData(cloudData, cloudDataDefaults))
        else await initializeOwner(user, localStore.load(seedData))
        if (active) {
          setCloudReady(true)
          setSyncState('saved')
        }
      })
      .catch(() => {
        if (active) {
          setCloudReady(true)
          setSyncState('offline')
        }
      })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    localStore.save(data)
    if (!cloudReady) return
    const timer = window.setTimeout(() => {
      setSyncState('saving')
      saveCloudData(user, data)
        .then(() => setSyncState('saved'))
        .catch(() => setSyncState('offline'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cloudReady, data, user])

  useEffect(() => {
    const run = () => {
      const due = checkReminders(data)
      if (due.length) {
        setToast(due[0].body)
        window.setTimeout(() => setToast(''), 5000)
      }
    }
    run()
    const timer = window.setInterval(run, 30_000)
    return () => window.clearInterval(timer)
  }, [data])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const navigate = (nextPage: Page) => {
    setPage(nextPage)
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleTask = (taskId: string) => {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
    }))
  }

  const updateTodayPlanProgress = (planId: string, mode: 'step' | 'complete') => {
    const today = todayISO()
    setData((current) => ({
      ...current,
      plans: current.plans.map((plan) => {
        if (plan.id !== planId) return plan
        return {
          ...plan,
          items: plan.items.map((item) => {
            if (item.date !== today) return item
            const actual = mode === 'complete' ? item.target : Math.min(item.target, item.actual + 10)
            return { ...item, actual }
          }),
        }
      }),
    }))
  }

  const openNewEntry = () => {
    setEditingEntryId(null)
    setEntryModalOpen(true)
  }

  const openEntryEditor = (entryId: string) => {
    setSelectedEntryId(null)
    setEditingEntryId(entryId)
    setEntryModalOpen(true)
  }

  const closeEntryEditor = () => {
    setEntryModalOpen(false)
    setEditingEntryId(null)
  }

  const changeEntryVisibility = (entryId: string) => {
    setData((current) => ({
      ...current,
      entries: toggleEntryVisibility(current.entries, entryId, new Date().toISOString()),
    }))
  }

  const deleteEntry = (entryId: string) => {
    if (!window.confirm('确定删除这条记录吗？此操作会同步到云端。')) return
    setData((current) => ({ ...current, entries: removeEntry(current.entries, entryId) }))
    setSelectedEntryId(null)
  }

  const resetDemo = () => {
    localStore.clear()
    setData(seedData)
    setPage('today')
  }

  const selectedEntry = data.entries.find((entry) => entry.id === selectedEntryId)
  const editingEntry = data.entries.find((entry) => entry.id === editingEntryId)
  const title = pageTitles[page]

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} syncState={syncState} onSignOut={async () => { await signOut(); onSignedOut() }} />

      <header className="mobile-header">
        <button className="icon-button" type="button" aria-label="打开菜单" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <Brand compact />
        <button className="icon-button" type="button" aria-label="切换主题" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-title-row">
              <Brand />
              <button className="icon-button" type="button" aria-label="关闭菜单" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
            </div>
            <Navigation page={page} onNavigate={navigate} />
          </aside>
        </div>
      )}

      <main className="main-content">
        <div className="topbar">
          <div>
            <p className="eyebrow">{title.eyebrow}</p>
            <h1>{title.title}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" type="button" aria-label="查看提醒">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <button className="icon-button desktop-only" type="button" aria-label="切换主题" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button className="primary-button" type="button" onClick={openNewEntry}>
              <Plus size={17} /> 快速记录
            </button>
          </div>
        </div>

        {page === 'today' && (
          <TodayPage
            data={data}
            onToggleTask={toggleTask}
            onNewEntry={openNewEntry}
            onOpenEntry={setSelectedEntryId}
            onNewPlan={() => setPlanModalOpen(true)}
            onNewTask={() => setTaskModalOpen(true)}
            onPlanProgress={updateTodayPlanProgress}
            onNavigate={navigate}
          />
        )}
        {page === 'entries' && (
          <EntriesPage
            data={data}
            setData={setData}
            onNewEntry={openNewEntry}
            onOpenEntry={setSelectedEntryId}
            onToggleEntryVisibility={changeEntryVisibility}
            onDeleteEntry={deleteEntry}
          />
        )}
        {page === 'plans' && <PlansPage plans={data.plans} setData={setData} onNewPlan={() => setPlanModalOpen(true)} onPlanProgress={updateTodayPlanProgress} />}
        {page === 'reviews' && <ReviewsPage data={data} setData={setData} />}
        {page === 'public' && <PublicPage data={data} onOpenEntry={setSelectedEntryId} />}
        {page === 'settings' && <SettingsPage data={data} setData={setData} theme={theme} setTheme={setTheme} syncState={syncState} onReset={resetDemo} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="主要导航">
        {navigation.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <button key={item.id} className={page === item.id ? 'active' : ''} type="button" onClick={() => navigate(item.id)}>
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          category={data.categories.find((category) => category.id === selectedEntry.categoryId)}
          onClose={() => setSelectedEntryId(null)}
          onEdit={() => openEntryEditor(selectedEntry.id)}
          onToggleVisibility={() => changeEntryVisibility(selectedEntry.id)}
          onDelete={() => deleteEntry(selectedEntry.id)}
        />
      )}
      {entryModalOpen && (
        <EntryModal
          categories={data.categories}
          entry={editingEntry}
          setData={setData}
          onClose={closeEntryEditor}
        />
      )}
      {planModalOpen && <PlanModal setData={setData} onClose={() => setPlanModalOpen(false)} />}
      {taskModalOpen && <TaskModal setData={setData} onClose={() => setTaskModalOpen(false)} />}
      {toast && <div className="toast"><Bell size={16} /><span>{toast}</span></div>}
    </div>
  )
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="loading-screen"><span className="brand-mark"><Feather size={22} /></span><p>{label}</p></div>
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (user: CloudUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyEmail, setVerifyEmail] = useState<((code: string) => Promise<CloudUser>) | null>(null)
  const [isFirstSetup, setIsFirstSetup] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ownerExists()
      .then((exists) => setIsFirstSetup(!exists))
      .catch((caught) => setError(caught instanceof Error ? `无法检查站点账号：${caught.message}` : '无法检查站点账号，请刷新页面重试。'))
      .finally(() => setChecking(false))
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (verifyEmail) {
      if (!/^\d{4,8}$/.test(verificationCode.trim())) return setError('请输入邮件中的验证码。')
      setSubmitting(true)
      try {
        onAuthenticated(await verifyEmail(verificationCode.trim()))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '验证失败，请稍后重试。')
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('请输入有效的邮箱地址。')
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('密码需为 8–32 位，并同时包含字母和数字。')
    setSubmitting(true)
    try {
      if (isFirstSetup) {
        const result = await signUpOwner(email.trim(), password)
        if (result.user) onAuthenticated(result.user)
        else setVerifyEmail(() => result.verifyEmail)
      } else {
        onAuthenticated(await signIn(email.trim(), password))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <button className="auth-back" type="button" onClick={() => go('/')}><ArrowRight size={16} /> 返回公开主页</button>
      <section className="auth-story">
        <Brand />
        <p className="eyebrow">PRIVATE LIFE SPACE</p>
        <h1>把零散的日子，<br />慢慢写成自己的答案。</h1>
        <p>记录生活、整理经验、拆解长期目标。私人内容只属于你，公开内容由你决定。</p>
        <div className="auth-points"><span><CheckCircle2 size={17} /> 云端同步</span><span><CheckCircle2 size={17} /> 私密隔离</span><span><CheckCircle2 size={17} /> 自定义计划</span></div>
      </section>
      <section className="auth-card">
        <div><p className="section-kicker">{checking ? '连接云端' : verifyEmail ? '验证邮箱' : isFirstSetup ? '首次设置' : '欢迎回来'}</p><h2>{checking ? '正在检查空间' : verifyEmail ? '输入邮件验证码' : isFirstSetup ? '创建站长账号' : '登录私人空间'}</h2><p>{checking ? '请稍候，正在确认是否已有站长账号……' : verifyEmail ? `验证码已发送到 ${email}。` : isFirstSetup ? '这个账号将成为网站唯一的站长账号。' : '使用你的站长邮箱和密码继续。'}</p></div>
        <form className="modal-form" onSubmit={submit}>
          {verifyEmail ? (
            <label><span>邮件验证码</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="请输入验证码" disabled={submitting} /></label>
          ) : <>
            <label><span>邮箱</span><input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" disabled={checking || submitting} /></label>
            <label><span>密码</span><input type="password" autoComplete={isFirstSetup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8–32 位，包含字母和数字" disabled={checking || submitting} /></label>
          </>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={checking || submitting || isFirstSetup === null}>{checking ? '正在检查…' : submitting ? '正在处理…' : verifyEmail ? '验证并进入空间' : isFirstSetup ? '创建并进入空间' : '登录'} <LogIn size={17} /></button>
        </form>
        <small className="auth-security">账号凭据由腾讯云身份认证处理，密码不会写入本站数据库。</small>
      </section>
    </div>
  )
}

function PublicHome({ slug, canEnterWorkspace }: { slug?: string; canEnterWorkspace: boolean }) {
  const [space, setSpace] = useState<PublicSpace | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeEntry, setActiveEntry] = useState<string | null>(null)

  useEffect(() => {
    loadPublicSpace(slug).then(setSpace).catch(() => setSpace(null)).finally(() => setLoading(false))
  }, [slug])

  if (loading) return <LoadingScreen label="正在翻开这一页……" />

  const profile = space?.profile
  const entries = space?.entries ?? []
  const selected = entries.find((entry) => entry.id === activeEntry)

  return (
    <div className="standalone-public">
      <header className="public-nav">
        <button className="public-brand" type="button" onClick={() => { setActiveEntry(null); go('/') }}><Feather size={18} /><strong>{profile?.display_name || '留白之间'}</strong></button>
        <nav><a href="#articles">文章</a><a href="#about">关于</a><a href="#now">现在</a></nav>
        <button className="workspace-link" type="button" onClick={() => go(canEnterWorkspace ? '/app' : '/login')}>{canEnterWorkspace ? '进入工作台' : '站长登录'} <ArrowRight size={15} /></button>
      </header>

      {selected ? (
        <article className="public-article-detail">
          <button className="text-button" type="button" onClick={() => setActiveEntry(null)}>← 返回文章列表</button>
          <small>{new Date(selected.published_at).toLocaleDateString('zh-CN')} · {selected.category_name}</small>
          <h1>{selected.title}</h1>
          <div className="tag-row">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <MarkdownContent content={selected.content} className="article-content" />
        </article>
      ) : (
        <>
          <main className="public-home-main">
            <section className="public-home-hero">
              <p className="eyebrow">你好，我在这里记录</p>
              <h1>{profile?.headline || seedData.profile.headline}</h1>
              <p>{profile?.bio || seedData.profile.bio}</p>
              <a href="#articles">读最近的记录 <ArrowRight size={16} /></a>
            </section>

            <section className="public-article-section" id="articles">
              <div className="public-section-heading"><div><p className="section-kicker">RECENT WRITING</p><h2>最近发布</h2></div><span>{entries.length} 篇公开记录</span></div>
              {entries.length ? (
                <div className="public-article-list">
                  {entries.map((entry, index) => (
                    <button key={entry.id} type="button" onClick={() => setActiveEntry(entry.id)}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div><small>{new Date(entry.published_at).toLocaleDateString('zh-CN')} · {entry.category_name}</small><h3>{entry.title}</h3><p>{entry.summary}</p></div>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </div>
              ) : <div className="public-empty"><Feather size={28} /><h3>这里还在留白</h3><p>{space ? '站长还没有发布公开文章。' : '网站已经准备好，等待站长完成首次设置。'}</p></div>}
            </section>

            <section className="public-about-grid" id="about">
              <div><p className="section-kicker">ABOUT</p><h2>关于这个空间</h2><p>{profile?.bio || '这里会留下工作、阅读、成长与生活里的思考。私人记录不会出现在公开主页。'}</p></div>
              <div id="now"><p className="section-kicker">NOW</p><h2>最近在做</h2><p>{profile?.current_focus || seedData.profile.currentFocus}</p></div>
            </section>
          </main>
          <footer className="public-footer"><span>© {currentYear} {profile?.display_name || '留白'}</span><span>由 Personspace 记录</span></footer>
        </>
      )}
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <span className="brand-mark"><Feather size={19} /></span>
      <span><strong>留白</strong>{!compact && <small>生活与成长空间</small>}</span>
    </div>
  )
}

function Sidebar({ page, onNavigate, syncState, onSignOut }: { page: Page; onNavigate: (page: Page) => void; syncState: SyncState; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <Navigation page={page} onNavigate={onNavigate} />
      <div className="sidebar-bottom">
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} type="button" onClick={() => onNavigate('settings')}>
          <Settings size={19} /><span>设置</span>
        </button>
        <div className="profile-card">
          <span className="avatar"><CircleUserRound size={21} /></span>
          <span><strong>我的空间</strong><small>{syncState === 'saved' ? '已同步到云端' : syncState === 'saving' ? '正在同步…' : syncState === 'offline' ? '离线，已保存在本机' : '正在读取云端'}</small></span>
          <button className="profile-signout" type="button" aria-label="退出登录" onClick={onSignOut}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  )
}

function Navigation({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <nav className="navigation" aria-label="主要导航">
      <p className="nav-label">空间</p>
      {navigation.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} type="button" onClick={() => onNavigate(item.id)}>
            <Icon size={19} />
            <span>{item.label}</span>
            {item.id === 'entries' && <span className="nav-count">2</span>}
          </button>
        )
      })}
    </nav>
  )
}

function TodayPage({
  data,
  onToggleTask,
  onNewEntry,
  onOpenEntry,
  onNewPlan,
  onNewTask,
  onPlanProgress,
  onNavigate,
}: {
  data: AppData
  onToggleTask: (id: string) => void
  onNewEntry: () => void
  onOpenEntry: (id: string) => void
  onNewPlan: () => void
  onNewTask: () => void
  onPlanProgress: (id: string, mode: 'step' | 'complete') => void
  onNavigate: (page: Page) => void
}) {
  const today = todayISO()
  const activePlan = data.plans.find((plan) => !plan.archived)
  const todayItem = activePlan?.items.find((item) => item.date === today)
  const progress = activePlan ? planProgress(activePlan.items) : null
  const completedTasks = data.tasks.filter((task) => task.completed).length

  return (
    <div className="page-stack">
      <section className="welcome-strip">
        <div>
          <span className="date-pill">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(fromLocalISO(today))}</span>
          <p>不必一次完成很多，只要让今天向前一点。</p>
        </div>
        <div className="day-progress">
          <span>{completedTasks}/{data.tasks.length}</span>
          <small>今日事项</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card focus-card">
          <div className="card-heading">
            <div><p className="section-kicker">今日焦点</p><h2>把注意力留给重要的事</h2></div>
            <button className="text-button" type="button" onClick={() => onNavigate('plans')}>全部计划 <ChevronRight size={16} /></button>
          </div>
          <div className="task-list">
            {data.tasks.map((task) => (
              <button key={task.id} className={`task-row ${task.completed ? 'completed' : ''}`} type="button" onClick={() => onToggleTask(task.id)}>
                <span className={`task-check ${task.tone}`}>{task.completed && <Check size={15} />}</span>
                <span className="task-copy"><strong>{task.title}</strong><small>{task.dueLabel}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <button className="add-row-button" type="button" onClick={onNewTask}><Plus size={16} /> 添加今日任务</button>
        </section>

        {activePlan && progress && (
          <section className="card plan-focus-card">
            <div className="plan-card-accent"><Sparkles size={18} /></div>
            <p className="section-kicker">进行中的计划</p>
            <h2>{activePlan.title}</h2>
            <p className="muted">{activePlan.reminderStart} 开始提醒 · {activePlan.reminderCheckin} 完成回顾</p>
            <div className="progress-figure">
              <div className="progress-ring" style={{ '--progress': `${progress.percent * 3.6}deg` } as React.CSSProperties}>
                <span><strong>{progress.percent}%</strong><small>整体进度</small></span>
              </div>
              <div className="today-target">
                <small>今日目标</small>
                <strong>{todayItem?.target ?? 0}<span>{activePlan.unit}</span></strong>
                <p>已完成 {todayItem?.actual ?? 0}</p>
              </div>
            </div>
            <div className="button-pair">
              <button className="secondary-button" type="button" onClick={() => onPlanProgress(activePlan.id, 'step')}>+10 进度</button>
              <button className="primary-button wide" type="button" onClick={() => onPlanProgress(activePlan.id, 'complete')}><Check size={16} /> 完成今日</button>
            </div>
          </section>
        )}

        <section className="card recent-card">
          <div className="card-heading compact-heading">
            <div><p className="section-kicker">最近记录</p><h2>刚刚留下的想法</h2></div>
            <button className="round-link" type="button" aria-label="查看全部记录" onClick={() => onNavigate('entries')}><ArrowRight size={17} /></button>
          </div>
          {data.entries.slice(0, 2).map((entry) => {
            const category = data.categories.find((item) => item.id === entry.categoryId)
            return (
              <button className="entry-snippet" key={entry.id} type="button" onClick={() => onOpenEntry(entry.id)}>
                <span className="category-dot" style={{ background: category?.color }} />
                <div><small>{category?.name ?? '未分类'} · {formatShortDate(entry.createdAt.slice(0, 10))}</small><h3>{entry.title}</h3><p>{entry.content}</p></div>
                <ChevronRight size={16} />
              </button>
            )
          })}
        </section>

        <section className="card quick-card">
          <p className="section-kicker">快速开始</p>
          <h2>现在，你想做什么？</h2>
          <div className="quick-grid">
            <button type="button" onClick={onNewEntry}><span className="quick-icon sage"><Feather size={19} /></span><strong>写一条记录</strong><small>捕捉当下的想法</small></button>
            <button type="button" onClick={onNewPlan}><span className="quick-icon amber"><Target size={19} /></span><strong>制定新计划</strong><small>拆解长期目标</small></button>
            <button type="button" onClick={() => onNavigate('reviews')}><span className="quick-icon blue"><CalendarDays size={19} /></span><strong>开始复盘</strong><small>理解今天的行动</small></button>
            <button type="button" onClick={() => onNavigate('public')}><span className="quick-icon rose"><Globe2 size={19} /></span><strong>查看公开主页</strong><small>预览分享的内容</small></button>
          </div>
        </section>
      </div>
    </div>
  )
}

function EntriesPage({
  data,
  setData,
  onNewEntry,
  onOpenEntry,
  onToggleEntryVisibility,
  onDeleteEntry,
}: {
  data: AppData
  setData: DataSetter
  onNewEntry: () => void
  onOpenEntry: (id: string) => void
  onToggleEntryVisibility: (id: string) => void
  onDeleteEntry: (id: string) => void
}) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  const entries = data.entries.filter((entry) => {
    const categoryMatches = activeCategory === 'all' || entry.categoryId === activeCategory
    const query = search.trim().toLowerCase()
    return categoryMatches && (!query || `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase().includes(query))
  })

  const addCategory = () => {
    const name = categoryName.trim()
    if (!name) return
    const category: EntryCategory = { id: uid('category'), name, color: '#8a7c68', icon: 'file', description: '自定义记录分类', template: '' }
    setData((current) => ({ ...current, categories: [...current.categories, category] }))
    setCategoryName('')
  }

  const removeCategory = (id: string) => {
    if (data.entries.some((entry) => entry.categoryId === id)) return
    setData((current) => ({ ...current, categories: current.categories.filter((category) => category.id !== id) }))
  }

  return (
    <div className="page-stack">
      <div className="toolbar-card">
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、正文或标签" /></label>
        <button className="secondary-button" type="button" onClick={() => setShowCategoryManager(!showCategoryManager)}><Archive size={16} /> 管理分类</button>
        <button className="primary-button" type="button" onClick={onNewEntry}><Plus size={16} /> 新建记录</button>
      </div>

      {showCategoryManager && (
        <section className="card category-manager">
          <div><p className="section-kicker">自定义分类</p><h2>让不同的记录，有自己的结构</h2></div>
          <div className="category-manager-list">
            {data.categories.map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name}<button type="button" aria-label={`删除${category.name}`} disabled={data.entries.some((entry) => entry.categoryId === category.id)} onClick={() => removeCategory(category.id)}><X size={13} /></button></span>)}
          </div>
          <div className="inline-form"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="例如：旅行记录" onKeyDown={(event) => event.key === 'Enter' && addCategory()} /><button className="primary-button" type="button" onClick={addCategory}>添加分类</button></div>
        </section>
      )}

      <div className="category-tabs" role="tablist" aria-label="记录分类">
        <button className={activeCategory === 'all' ? 'active' : ''} type="button" onClick={() => setActiveCategory('all')}>全部 <span>{data.entries.length}</span></button>
        {data.categories.map((category) => (
          <button key={category.id} className={activeCategory === category.id ? 'active' : ''} type="button" onClick={() => setActiveCategory(category.id)}>
            <i style={{ background: category.color }} />{category.name}<span>{data.entries.filter((entry) => entry.categoryId === category.id).length}</span>
          </button>
        ))}
      </div>

      <div className="entry-grid">
        {entries.map((entry) => {
          const category = data.categories.find((item) => item.id === entry.categoryId)
          const Icon = categoryIcons[category?.icon ?? 'file'] ?? FileText
          return (
            <article className="entry-card" key={entry.id}>
              <button className="entry-card-open" type="button" onClick={() => onOpenEntry(entry.id)}>
                <div className="entry-card-top">
                  <span className="entry-type-icon" style={{ color: category?.color, background: `${category?.color}18` }}><Icon size={18} /></span>
                  <span className={`visibility-badge ${entry.visibility}`}>{entry.visibility === 'public' ? '已公开' : '仅自己'}</span>
                </div>
                <small>{category?.name ?? '未分类'} · {formatShortDate(entry.createdAt.slice(0, 10))}</small>
                <h2>{entry.title}</h2>
                <p>{entry.content}</p>
                <div className="tag-row">{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
              </button>
              <div className="entry-card-actions"><button type="button" onClick={() => onOpenEntry(entry.id)}><BookOpen size={14} />查看</button><button type="button" onClick={() => onToggleEntryVisibility(entry.id)}>{entry.visibility === 'public' ? <EyeOff size={14} /> : <Eye size={14} />}{entry.visibility === 'public' ? '转为私密' : '发布'}</button><button className="danger-link" type="button" onClick={() => onDeleteEntry(entry.id)}><Trash2 size={14} />删除</button></div>
            </article>
          )
        })}
        <button className="entry-card add-entry-card" type="button" onClick={onNewEntry}><Plus size={24} /><strong>新建一条记录</strong><small>从一句话开始也可以</small></button>
      </div>
    </div>
  )
}

function PlansPage({ plans, setData, onNewPlan, onPlanProgress }: { plans: Plan[]; setData: DataSetter; onNewPlan: () => void; onPlanProgress: (id: string, mode: 'step' | 'complete') => void }) {
  const archivePlan = (id: string) => setData((current) => ({ ...current, plans: current.plans.map((plan) => plan.id === id ? { ...plan, archived: true } : plan) }))
  return (
    <div className="page-stack">
      <section className="plan-intro">
        <div><p className="section-kicker">计划不是约束，而是一种看见</p><h2>先定下总量，再决定每天走多远。</h2><p>你可以平均分配，也可以前松后紧、前紧后松。漏做时，系统会保留原计划并让你决定如何重排。</p></div>
        <button className="primary-button" type="button" onClick={onNewPlan}><Plus size={17} /> 创建长期计划</button>
      </section>
      <div className="plans-list">
        {plans.filter((plan) => !plan.archived).map((plan) => {
          const progress = planProgress(plan.items)
          const todayItem = plan.items.find((item) => item.date === todayISO())
          return (
            <section className="card detailed-plan" key={plan.id}>
              <div className="detailed-plan-header">
                <div><span className="status-badge">进行中</span><h2>{plan.title}</h2><p>{plan.startDate} — {plan.endDate} · {plan.items.length} 个执行日</p></div>
                <div className="plan-total"><small>总目标</small><strong>{plan.total.toLocaleString()} <span>{plan.unit}</span></strong></div>
              </div>
              <div className="linear-progress"><span style={{ width: `${progress.percent}%` }} /></div>
              <div className="plan-metrics">
                <div><small>已完成</small><strong>{progress.actual}</strong></div>
                <div><small>整体进度</small><strong>{progress.percent}%</strong></div>
                <div><small>今日计划</small><strong>{todayItem?.target ?? 0}</strong></div>
                <div><small>提醒</small><strong>{plan.reminderStart} / {plan.reminderCheckin}</strong></div>
              </div>
              <div className="schedule-preview">
                <div className="schedule-title"><strong>接下来 7 个执行日</strong><small>{plan.distributionMode === 'even' ? '平均分配' : plan.distributionMode === 'rampUp' ? '前松后紧' : '前紧后松'}</small></div>
                <div className="schedule-days">
                  {plan.items.filter((item) => item.date >= todayISO()).slice(0, 7).map((item) => (
                    <div key={item.date} className={item.date === todayISO() ? 'today' : ''}><small>{formatShortDate(item.date)}</small><strong>{item.target}</strong><span>{plan.unit}</span></div>
                  ))}
                </div>
              </div>
              <div className="plan-actions"><button className="text-button archive-plan" type="button" onClick={() => archivePlan(plan.id)}><Archive size={15} /> 归档</button><button className="secondary-button" type="button" onClick={() => onPlanProgress(plan.id, 'step')}>记录 +10</button><button className="primary-button" type="button" onClick={() => onPlanProgress(plan.id, 'complete')}>完成今日目标</button></div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ReviewsPage({ data, setData }: { data: AppData; setData: DataSetter }) {
  const complete = data.tasks.filter((task) => task.completed).length
  const [showForm, setShowForm] = useState(false)
  const [wins, setWins] = useState('')
  const [lessons, setLessons] = useState('')
  const [tomorrow, setTomorrow] = useState('')

  const saveReflection = (event: React.FormEvent) => {
    event.preventDefault()
    if (!wins.trim() && !lessons.trim() && !tomorrow.trim()) return
    const reflection: Reflection = { id: uid('reflection'), date: todayISO(), wins: wins.trim(), lessons: lessons.trim(), tomorrow: tomorrow.trim(), createdAt: new Date().toISOString() }
    setData((current) => ({ ...current, reflections: [reflection, ...current.reflections] }))
    setWins(''); setLessons(''); setTomorrow(''); setShowForm(false)
  }
  return (
    <div className="page-stack">
      <section className="review-hero card">
        <span className="review-icon"><CalendarDays size={26} /></span>
        <div><p className="section-kicker">今日复盘</p><h2>今天发生了什么？</h2><p>系统会先整理事实，你只需要补充自己的判断。</p></div>
        <button className="primary-button" type="button" onClick={() => setShowForm(!showForm)}>{showForm ? '收起复盘' : '开始复盘'} <ArrowRight size={16} /></button>
      </section>
      {showForm && <section className="card reflection-form"><form className="modal-form" onSubmit={saveReflection}><label><span>今天做得好的事情</span><textarea rows={3} value={wins} onChange={(event) => setWins(event.target.value)} placeholder="哪怕只是一件小事……" /></label><label><span>今天学到或想调整的事情</span><textarea rows={3} value={lessons} onChange={(event) => setLessons(event.target.value)} /></label><label><span>明天最重要的一步</span><textarea rows={2} value={tomorrow} onChange={(event) => setTomorrow(event.target.value)} /></label><div className="modal-actions"><button className="primary-button" type="submit">保存今日复盘</button></div></form></section>}
      <div className="review-grid">
        <section className="card"><p className="section-kicker">行动摘要</p><h2>{complete} 项已完成</h2><p className="muted">还有 {data.tasks.length - complete} 项等待处理，可以延期、拆分或放弃。</p></section>
        <section className="card"><p className="section-kicker">记录摘要</p><h2>留下了 {data.entries.length} 条记录</h2><p className="muted">记录事实之后，再写下你如何理解它。</p></section>
        <section className="card reflection-prompt"><Sparkles size={21} /><p>“今天有哪些事情，值得明天继续？”</p><button className="text-button" type="button">写下回答 <ArrowRight size={15} /></button></section>
      </div>
      {data.reflections.length > 0 && <section className="reflection-history"><div className="card-heading"><div><p className="section-kicker">过往复盘</p><h2>回看走过的路</h2></div></div>{data.reflections.map((reflection) => <article className="card reflection-entry" key={reflection.id}><small>{formatShortDate(reflection.date)}</small>{reflection.wins && <div><strong>做得好</strong><p>{reflection.wins}</p></div>}{reflection.lessons && <div><strong>学到</strong><p>{reflection.lessons}</p></div>}{reflection.tomorrow && <div><strong>下一步</strong><p>{reflection.tomorrow}</p></div>}</article>)}</section>}
    </div>
  )
}

function PublicPage({ data, onOpenEntry }: { data: AppData; onOpenEntry: (id: string) => void }) {
  const publicEntries = data.entries.filter((entry) => entry.visibility === 'public')
  return (
    <div className="public-preview">
      <div className="browser-bar"><span /><span /><span /><small>preview.liubai.space</small></div>
      <section className="public-site">
        <nav><strong>留白之间</strong><div><span>文章</span><span>关于我</span><span>现在</span></div></nav>
        <div className="public-hero"><p>你好，我在这里记录</p><h2>生活里真正留下来的，<br />通常不是答案，而是认真想过的痕迹。</h2><span>工作、阅读、成长与一些正在发生的事情。</span></div>
        <div className="public-posts">
          <p className="section-kicker">最近发布</p>
          {publicEntries.length ? publicEntries.map((entry) => (
            <button key={entry.id} type="button" onClick={() => onOpenEntry(entry.id)}><small>{formatShortDate(entry.createdAt.slice(0, 10))}</small><span><strong>{entry.title}</strong><em>{entry.content}</em></span><span>继续阅读 <ArrowRight size={14} /></span></button>
          )) : <p className="muted">还没有公开文章。私人记录不会自动出现在这里。</p>}
        </div>
      </section>
    </div>
  )
}

function SettingsPage({ data, setData, theme, setTheme, syncState, onReset }: { data: AppData; setData: DataSetter; theme: Theme; setTheme: (theme: Theme) => void; syncState: SyncState; onReset: () => void }) {
  const updateProfile = (field: keyof AppData['profile'], value: string | boolean) => setData((current) => ({ ...current, profile: { ...current.profile, [field]: value } }))
  const [permission, setPermission] = useState(notificationPermission())
  return (
    <div className="settings-list">
      <section className="card profile-settings"><div className="setting-title"><div><h2>公开主页</h2><p>这些信息会显示在任何人都能访问的主页上。</p></div><label className="publish-toggle"><input type="checkbox" checked={data.profile.published} onChange={(event) => updateProfile('published', event.target.checked)} /><span>{data.profile.published ? '已公开' : '已隐藏'}</span></label></div><div className="form-grid two-columns"><label><span>显示名称</span><input value={data.profile.displayName} onChange={(event) => updateProfile('displayName', event.target.value)} /></label><label><span>主页地址标识</span><input value={data.profile.slug} onChange={(event) => updateProfile('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} /></label></div><label><span>主页标题</span><textarea rows={2} value={data.profile.headline} onChange={(event) => updateProfile('headline', event.target.value)} /></label><label><span>个人简介</span><textarea rows={3} value={data.profile.bio} onChange={(event) => updateProfile('bio', event.target.value)} /></label><label><span>最近在做</span><input value={data.profile.currentFocus} onChange={(event) => updateProfile('currentFocus', event.target.value)} /></label><a className="secondary-button settings-link" href={`/#/u/${data.profile.slug}`} target="_blank" rel="noreferrer"><Globe2 size={16} /> 打开公开主页</a></section>
      <section className="card setting-row"><div><h2>外观</h2><p>选择适合当前环境的阅读主题。</p></div><div className="segmented"><button className={theme === 'light' ? 'active' : ''} type="button" onClick={() => setTheme('light')}><Sun size={16} /> 浅色</button><button className={theme === 'dark' ? 'active' : ''} type="button" onClick={() => setTheme('dark')}><Moon size={16} /> 深色</button></div></section>
      <section className="card setting-row"><div><h2>数据同步</h2><p>私人数据存储在腾讯云 PostgreSQL，并在当前浏览器保留离线副本。</p></div><span className={`status-badge neutral sync-${syncState}`}>{syncState === 'saved' ? <><Cloud size={14} /> 已同步</> : syncState === 'saving' ? '同步中' : syncState === 'offline' ? <><CloudOff size={14} /> 离线</> : '载入中'}</span></section>
      <section className="card setting-row"><div><h2>浏览器提醒</h2><p>在计划或任务到达设定时间时发送通知；浏览器关闭后的系统推送需要后续接入微信或邮件渠道。</p></div><button className="secondary-button" type="button" disabled={permission === 'granted' || permission === 'unsupported'} onClick={async () => setPermission(await requestReminderPermission())}>{permission === 'granted' ? '已允许' : permission === 'denied' ? '已被浏览器拒绝' : permission === 'unsupported' ? '浏览器不支持' : '开启提醒'}</button></section>
      <section className="card setting-row danger-setting"><div><h2>恢复示例数据</h2><p>清除本地修改，恢复到第一次打开时的演示状态。</p></div><button className="danger-button" type="button" onClick={onReset}><RotateCcw size={16} /> 恢复示例</button></section>
    </div>
  )
}

function EntryDetailModal({
  entry,
  category,
  onClose,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  entry: Entry
  category?: EntryCategory
  onClose: () => void
  onEdit: () => void
  onToggleVisibility: () => void
  onDelete: () => void
}) {
  const Icon = categoryIcons[category?.icon ?? 'file'] ?? FileText
  const categoryColor = category?.color ?? '#8a7c68'

  return (
    <Modal title={entry.title} subtitle={`${category?.name ?? '未分类'} · ${formatShortDate(entry.createdAt.slice(0, 10))}`} onClose={onClose} wide>
      <article className="entry-detail">
        <div className="entry-detail-meta">
          <span className="entry-type-icon" style={{ color: categoryColor, background: `${categoryColor}18` }}><Icon size={18} /></span>
          <span className={`visibility-badge ${entry.visibility}`}>{entry.visibility === 'public' ? '已公开' : '仅自己可见'}</span>
        </div>
        {entry.tags.length > 0 && <div className="tag-row">{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <MarkdownContent content={entry.content} className="entry-detail-content" />
        <div className="entry-detail-actions">
          <button className="danger-button" type="button" onClick={onDelete}><Trash2 size={15} /> 删除</button>
          <div>
            <button className="secondary-button" type="button" onClick={onToggleVisibility}>{entry.visibility === 'public' ? <EyeOff size={15} /> : <Eye size={15} />}{entry.visibility === 'public' ? '转为私密' : '发布到主页'}</button>
            <button className="primary-button" type="button" onClick={onEdit}><Pencil size={15} /> 编辑记录</button>
          </div>
        </div>
      </article>
    </Modal>
  )
}

function EntryModal({ categories, entry, setData, onClose }: { categories: EntryCategory[]; entry?: Entry; setData: DataSetter; onClose: () => void }) {
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? categories[0]?.id ?? '')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? categories[0]?.template ?? '')
  const [tags, setTags] = useState(entry?.tags.join(' ') ?? '')
  const [visibility, setVisibility] = useState<'private' | 'public'>(entry?.visibility ?? 'private')
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')

  const selectCategory = (nextId: string) => {
    const previousTemplate = categories.find((category) => category.id === categoryId)?.template ?? ''
    const nextTemplate = categories.find((category) => category.id === nextId)?.template ?? ''
    setCategoryId(nextId)
    if (!content.trim() || content === previousTemplate) setContent(nextTemplate)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const now = new Date().toISOString()
    const nextEntry: Entry = {
      id: entry?.id ?? uid('entry'),
      title: title.trim(),
      content: content.trim(),
      categoryId,
      tags: tags.split(/[,，\s]+/).filter(Boolean),
      visibility,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
    }
    setData((current) => ({
      ...current,
      entries: entry ? replaceEntry(current.entries, nextEntry) : [nextEntry, ...current.entries],
    }))
    onClose()
  }

  return (
    <Modal title={entry ? '编辑记录' : '新建记录'} subtitle={entry ? '支持 Markdown，修改会自动保存并同步到云端。' : '支持 Markdown 长文写作，也可以直接输入普通文字。'} onClose={onClose} editor>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid two-columns">
          <label><span>记录分类</span><select value={categoryId} onChange={(event) => selectCategory(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>可见范围</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'public')}><option value="private">仅自己可见</option><option value="public">加入公开主页</option></select></label>
        </div>
        <label><span>标题</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="今天想记录什么？" /></label>
        <section className="markdown-editor-section">
          <div className="markdown-editor-toolbar">
            <div><strong>正文</strong><small>Markdown</small></div>
            <div className="segmented markdown-mode-switch" aria-label="正文显示模式">
              <button className={editorMode === 'edit' ? 'active' : ''} type="button" onClick={() => setEditorMode('edit')}>编辑</button>
              <button className={editorMode === 'preview' ? 'active' : ''} type="button" onClick={() => setEditorMode('preview')}>预览</button>
            </div>
          </div>
          {editorMode === 'edit' ? (
            <textarea className="markdown-editor-input" value={content} onChange={(event) => setContent(event.target.value)} placeholder={'# 标题\n\n从这里开始写正文……'} spellCheck />
          ) : content.trim() ? (
            <MarkdownContent content={content} className="markdown-editor-preview" />
          ) : (
            <div className="markdown-editor-preview markdown-empty">还没有正文，切换到“编辑”开始写作。</div>
          )}
          <p className="markdown-help">支持标题、列表、引用、代码块、表格、链接和任务清单。</p>
        </section>
        <label><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用空格或逗号分隔，例如：工作 复盘" /></label>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{entry ? '保存修改' : '保存记录'}</button></div>
      </form>
    </Modal>
  )
}

function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return <div className={`markdown-content ${className}`.trim()}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
}

function TaskModal({ setData, onClose }: { setData: DataSetter; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [dueTime, setDueTime] = useState('21:00')
  const [tone, setTone] = useState<'sage' | 'amber' | 'blue'>('sage')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const dateLabel = dueDate === todayISO() ? '今天' : formatShortDate(dueDate)
    setData((current) => ({ ...current, tasks: [...current.tasks, { id: uid('task'), title: title.trim(), dueLabel: dueTime ? `${dateLabel} ${dueTime}` : dateLabel, dueDate, dueTime, completed: false, tone, createdAt: new Date().toISOString() }] }))
    onClose()
  }

  return <Modal title="添加任务" subtitle="给今天一个清楚、可以完成的下一步。" onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>任务名称</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：整理项目周报" /></label><div className="form-grid two-columns"><label><span>日期</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label><span>提醒时间</span><input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></label></div><label><span>标记颜色</span><select value={tone} onChange={(event) => setTone(event.target.value as 'sage' | 'amber' | 'blue')}><option value="sage">绿色 · 日常</option><option value="amber">橙色 · 重要</option><option value="blue">蓝色 · 成长</option></select></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">添加任务</button></div></form></Modal>
}

function PlanModal({ setData, onClose }: { setData: DataSetter; onClose: () => void }) {
  const [title, setTitle] = useState('一个月掌握 3000 个单词')
  const [total, setTotal] = useState(3000)
  const [unit, setUnit] = useState('个单词')
  const [startDate, setStartDate] = useState(() => todayISO())
  const [endDate, setEndDate] = useState(() => toLocalISO(addDays(new Date(), 29)))
  const [activeWeekdays, setActiveWeekdays] = useState([0, 1, 2, 3, 4, 5, 6])
  const [mode, setMode] = useState<DistributionMode>('even')
  const [reminderStart, setReminderStart] = useState('08:00')
  const [reminderCheckin, setReminderCheckin] = useState('21:30')

  const preview = useMemo(() => buildPlanItems(total, startDate, endDate, activeWeekdays, mode), [total, startDate, endDate, activeWeekdays, mode])

  const toggleWeekday = (day: number) => setActiveWeekdays((days) => days.includes(day) ? days.filter((value) => value !== day) : [...days, day])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || preview.length === 0 || total <= 0) return
    const plan: Plan = { id: uid('plan'), title: title.trim(), total: Math.round(total), unit: unit.trim() || '项', startDate, endDate, activeWeekdays, distributionMode: mode, reminderStart, reminderCheckin, items: preview, createdAt: new Date().toISOString() }
    setData((current) => ({ ...current, plans: [plan, ...current.plans] }))
    onClose()
  }

  return (
    <Modal title="创建长期计划" subtitle="先预览每日负担，确认后再生成计划。" onClose={onClose} wide>
      <form className="modal-form" onSubmit={submit}>
        <label><span>计划名称</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <div className="form-grid three-columns">
          <label><span>总量</span><input type="number" min="1" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></label>
          <label><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
          <label><span>分配方式</span><select value={mode} onChange={(event) => setMode(event.target.value as DistributionMode)}><option value="even">平均分配</option><option value="rampUp">前松后紧</option><option value="rampDown">前紧后松</option></select></label>
        </div>
        <div className="form-grid two-columns">
          <label><span>开始日期</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label><span>结束日期</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        <fieldset className="weekday-field"><legend>执行日</legend><div>{['日', '一', '二', '三', '四', '五', '六'].map((label, day) => <button key={label} className={activeWeekdays.includes(day) ? 'active' : ''} type="button" onClick={() => toggleWeekday(day)}>{label}</button>)}</div></fieldset>
        <div className="form-grid two-columns">
          <label><span>开始提醒</span><input type="time" value={reminderStart} onChange={(event) => setReminderStart(event.target.value)} /></label>
          <label><span>完成回顾</span><input type="time" value={reminderCheckin} onChange={(event) => setReminderCheckin(event.target.value)} /></label>
        </div>
        <div className="allocation-preview">
          <div><span>预计生成</span><strong>{preview.length} 个执行日</strong></div>
          <div><span>首日目标</span><strong>{preview[0]?.target ?? 0} {unit}</strong></div>
          <div><span>最后一日</span><strong>{preview.at(-1)?.target ?? 0} {unit}</strong></div>
          <div><span>合计</span><strong>{preview.reduce((sum, item) => sum + item.target, 0)} {unit}</strong></div>
        </div>
        {preview.length === 0 && <p className="form-error">当前日期和执行日组合无法生成计划，请至少选择一个有效执行日。</p>}
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={preview.length === 0}>生成每日计划</button></div>
      </form>
    </Modal>
  )
}

function Modal({ title, subtitle, onClose, wide = false, editor = false, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; editor?: boolean; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal-card ${editor ? 'editor' : wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>
        {children}
      </section>
    </div>
  )
}

export default App
