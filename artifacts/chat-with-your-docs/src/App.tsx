import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  FolderOpen,
  Hash,
  Library,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import {
  DocumentStatus,
  getGetConversationQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDocumentQueryKey,
  getListConversationsQueryKey,
  getListDocumentsQueryKey,
  useAskChat,
  useCreateConversation,
  useCreateDocument,
  useDeleteConversation,
  useDeleteDocument,
  useGetConversation,
  useGetDashboardSummary,
  useGetDocument,
  useListConversations,
  useListDocuments,
  useProcessDocument,
  useRenameConversation,
  useRenameDocument,
  useRequestUploadUrl,
  useSearchDocuments,
  type ChatResponse,
  type Conversation,
  type Document,
  type SearchResult,
  type Source,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

import NotFound from '@/pages/not-found';

import './index.css';

declare global {
  interface Array<T> {
    includes(searchElement: any, fromIndex?: number): boolean;
  }
}

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c96d50',
    colorForeground: '#183346',
    colorMutedForeground: '#66777c',
    colorDanger: '#bd4b49',
    colorBackground: '#fbfaf6',
    colorInput: '#f2eee5',
    colorInputForeground: '#183346',
    colorNeutral: '#d8d0c1',
    fontFamily: 'DM Sans',
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d8d0c1] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#183346] font-semibold',
    headerSubtitle: 'text-[#66777c]',
    socialButtonsBlockButtonText: 'text-[#183346]',
    formFieldLabel: 'text-[#183346]',
    footerActionLink: 'text-[#b75e46] font-medium',
    footerActionText: 'text-[#66777c]',
    dividerText: 'text-[#66777c]',
    identityPreviewEditButton: 'text-[#b75e46]',
    formFieldSuccessText: 'text-[#3c746c]',
    alertText: 'text-[#bd4b49]',
    logoBox: 'h-12',
    logoImage: 'max-h-12',
    socialButtonsBlockButton: 'border-[#d8d0c1] bg-[#f4f0e8] hover:bg-[#ebe5d9]',
    formButtonPrimary: 'bg-[#c96d50] hover:bg-[#b75e46] text-[#fbfaf6]',
    formFieldInput: 'border-[#d8d0c1] bg-[#f2eee5] text-[#183346] focus:border-[#c96d50]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#d8d0c1]',
    alert: 'bg-[#f7e4df] border-[#e7b9ac]',
    otpCodeFieldInput: 'border-[#d8d0c1] bg-[#f2eee5]',
    formFieldRow: 'text-[#183346]',
    main: 'bg-transparent',
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name?: string | null) {
  return (name || 'Reader').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function StatusPill({ status }: { status: DocumentStatus }) {
  const labels: Record<DocumentStatus, string> = {
    UPLOADING: 'Uploading',
    UPLOADED: 'Uploaded',
    PROCESSING: 'Reading',
    EMBEDDING: 'Indexing',
    READY: 'Ready',
    FAILED: 'Needs attention',
  };
  const styles: Record<DocumentStatus, string> = {
    UPLOADING: 'bg-[#f5e9c8] text-[#886a20]',
    UPLOADED: 'bg-[#e9eee9] text-[#557067]',
    PROCESSING: 'bg-[#dcebea] text-[#3c746c]',
    EMBEDDING: 'bg-[#dcebea] text-[#3c746c]',
    READY: 'bg-[#dcebea] text-[#3c746c]',
    FAILED: 'bg-[#f7e4df] text-[#a34844]',
  };
  return <span data-testid={`status-document-${status}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{labels[status]}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-foreground/[0.07] ${className}`} />;
}

function ErrorPanel({ onRetry, message = 'We could not load this just now.' }: { onRetry?: () => void; message?: string }) {
  return <div data-testid="state-error" className="flex items-center justify-between gap-4 rounded-xl border border-[#e7b9ac] bg-[#f7e4df] p-4 text-sm text-[#8f403d]"><div className="flex items-center gap-3"><CircleAlert className="h-4 w-4 shrink-0" /><span>{message}</span></div>{onRetry && <button data-testid="button-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold hover:underline"><RefreshCw className="h-3.5 w-3.5" />Retry</button>}</div>;
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof FileText; title: string; body: string; action?: ReactNode }) {
  return <div data-testid="state-empty" className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/55 px-6 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="h-5 w-5" /></div><h3 className="font-semibold text-foreground">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-logo" className="group flex items-center gap-2.5"><span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${light ? 'bg-[#f8eee5] text-[#183346]' : 'bg-primary text-primary-foreground'}`}><Library className="h-4 w-4" /></span><span className={`font-semibold tracking-[-0.02em] ${light ? 'text-[#f8f4ed]' : 'text-foreground'}`}>locus<span className="text-primary">.</span></span></Link>;
}

function Landing() {
  return <main data-testid="page-landing" className="noise min-h-[100dvh] overflow-hidden bg-background text-foreground">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><Logo /><nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"><a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a><a href="#principles" className="transition-colors hover:text-foreground">Why locus</a></nav><div className="flex items-center gap-3"><Link href="/sign-in" data-testid="link-sign-in" className="hidden px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:block">Sign in</Link><Link href="/sign-up" data-testid="link-sign-up" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5">Start reading <ArrowUpRight className="h-4 w-4" /></Link></div></header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-36 lg:pt-24"><div className="relative z-10 max-w-2xl animate-rise-in"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/65 px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-[#3c746c]" />Private by default · grounded by design</div><h1 className="max-w-3xl text-[clamp(3.5rem,8vw,7.5rem)] leading-[.88] tracking-[-.055em] text-foreground">Ask better<br /><em className="font-serif text-primary">questions.</em></h1><p className="mt-8 max-w-lg text-lg leading-8 text-muted-foreground">Locus turns your private PDFs and notes into a quiet place to think. Ask anything, then follow the thread back to the exact passage that answered you.</p><div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/sign-up" data-testid="button-landing-start" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">Bring your first document <ArrowUpRight className="h-4 w-4" /></Link><span className="text-xs text-muted-foreground">PDF and TXT · yours alone</span></div></div><div className="relative mx-auto w-full max-w-[510px] animate-rise-in [animation-delay:120ms]"><div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#e4b46c]/35 blur-3xl" /><div className="relative rounded-[2rem] border border-[#c5d8d1] bg-[#dcebea] p-4 shadow-lg"><div className="rounded-[1.35rem] border border-[#b7d0c9] bg-[#f6f3ea] p-5"><div className="flex items-center justify-between border-b border-border pb-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Library className="h-3.5 w-3.5" /></span><span className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground">Locus / workspace</span></div><span className="font-mono text-[10px] text-[#3c746c]">PRIVATE</span></div><div className="pt-8"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Question · 09:42</p><p className="mt-3 text-xl leading-8 text-foreground">What changed between the two proposals?</p><div className="mt-6 rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#3c746c]"><Sparkles className="h-3.5 w-3.5" />Answer grounded in 3 passages</div><p className="text-sm leading-6 text-muted-foreground">The second proposal moves the launch from Q2 to early Q3, while keeping the research scope intact. The new constraint appears in the resourcing note.</p><div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] font-medium text-primary"><Hash className="h-3 w-3" /> 3 sources · pages 2, 7, 11 <ChevronRight className="ml-auto h-3 w-3" /></div></div></div></div></div><div className="absolute -bottom-5 -left-8 hidden rounded-xl border border-border bg-card px-4 py-3 shadow-md sm:block"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Traceable</p><p className="mt-1 text-sm font-semibold text-foreground">Every answer has a trail.</p></div></div></section>
    <section id="how-it-works" className="border-y border-border bg-card/45"><div className="mx-auto grid max-w-7xl gap-px bg-border md:grid-cols-3"><div className="bg-background px-6 py-12 lg:px-10"><span className="font-mono text-xs text-primary">01 / ADD</span><h2 className="mt-5 text-2xl font-semibold tracking-tight">Bring the context.</h2><p className="mt-3 leading-7 text-muted-foreground">Drop in the documents you already trust. We keep them private and make them legible to your questions.</p></div><div className="bg-background px-6 py-12 lg:px-10"><span className="font-mono text-xs text-primary">02 / ASK</span><h2 className="mt-5 text-2xl font-semibold tracking-tight">Follow your curiosity.</h2><p className="mt-3 leading-7 text-muted-foreground">Ask in plain language. Narrow the conversation to one document or let the whole library connect the dots.</p></div><div className="bg-background px-6 py-12 lg:px-10"><span className="font-mono text-xs text-primary">03 / TRACE</span><h2 className="mt-5 text-2xl font-semibold tracking-tight">See the evidence.</h2><p className="mt-3 leading-7 text-muted-foreground">Relevant passages sit beside each answer, so you can verify the thought instead of taking it on faith.</p></div></div></section>
    <section id="principles" className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-32"><div><span className="font-mono text-xs uppercase tracking-[.2em] text-primary">A small promise</span><h2 className="mt-5 max-w-md text-5xl leading-[.95] tracking-[-.04em]">The source is part of the answer.</h2></div><div className="grid gap-8 sm:grid-cols-2"><div className="border-l-2 border-primary pl-5"><h3 className="font-semibold">Quiet, not empty</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A focused workspace with enough signal to help you keep thinking.</p></div><div className="border-l-2 border-[#7da99c] pl-5"><h3 className="font-semibold">Honest, not magical</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Answers show their work. Find the passage, check the context, make the call.</p></div><div className="border-l-2 border-[#e4b46c] pl-5"><h3 className="font-semibold">Personal, not public</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Your library is yours. No shared links, no training theater, no noise.</p></div><div className="border-l-2 border-foreground pl-5"><h3 className="font-semibold">Ready when you are</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Start with one document. The best workflow is the one you return to.</p></div></div></section>
    <footer className="border-t border-border px-6 py-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><Logo /><span>Made for careful readers.</span></div></footer>
  </main>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const nav = [{ href: '/dashboard', label: 'Overview', icon: BookOpen }, { href: '/documents', label: 'Documents', icon: FolderOpen }, { href: '/settings', label: 'Settings', icon: Settings2 }];
  return <div className="noise flex min-h-[100dvh] bg-background text-foreground"><aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:relative lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center justify-between px-3"><Logo light /><button data-testid="button-close-menu" onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"><X className="h-4 w-4" /></button></div><div className="mt-10 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/45">Your library</div><nav className="mt-3 space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${location === href || (href === '/documents' && location.startsWith('/documents/')) ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon className="h-4 w-4" /><span>{label}</span>{href === '/documents' && <span className="ml-auto text-[10px] text-sidebar-foreground/35">private</span>}</Link>)}</nav><div className="mt-auto border-t border-sidebar-border pt-4"><div className="flex items-center gap-3 px-3 py-2"><span data-testid="avatar-user" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8eee5] text-xs font-bold text-sidebar">{initials(user?.fullName || user?.firstName)}</span><div className="min-w-0 flex-1"><p data-testid="text-user-name" className="truncate text-sm font-medium">{user?.firstName || 'Reader'}</p><p className="truncate text-[11px] text-sidebar-foreground/45">{user?.primaryEmailAddress?.emailAddress || 'Private workspace'}</p></div><button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-md p-1.5 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground" title="Sign out"><LogOut className="h-4 w-4" /></button></div></div></aside>{mobileOpen && <button data-testid="button-overlay-menu" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-foreground/20 lg:hidden" />}<div className="min-w-0 flex-1"><header className="flex h-[72px] items-center justify-between border-b border-border bg-background/85 px-5 backdrop-blur-md lg:px-9"><button data-testid="button-open-menu" onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><span className="font-mono text-[10px] uppercase tracking-[.18em]">Workspace</span><ChevronRight className="h-3 w-3" /><span className="text-foreground">{location === '/dashboard' ? 'Overview' : location.startsWith('/chat') ? 'Conversation' : location.startsWith('/settings') ? 'Settings' : 'Documents'}</span></div><div className="ml-auto flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex"><ShieldCheck className="h-3.5 w-3.5 text-[#3c746c]" /> Private workspace</div><Link href="/settings" data-testid="link-header-settings" className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"><UserRound className="h-4 w-4" /></Link></div></header><main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-9 lg:py-10">{children}</main></div></div>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return <><Show when="signed-in"><AppShell>{children}</AppShell></Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>;
}

function DashboardPage() {
  const summary = useGetDashboardSummary();
  const conversations = useListConversations();
  const data = summary.data;
  if (summary.isLoading) return <DashboardSkeleton />;
  if (summary.isError) return <ErrorPanel onRetry={() => summary.refetch()} />;
  return <div data-testid="page-dashboard" className="animate-rise-in"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Tuesday, quiet hours</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Good to see you.</h1><p className="mt-3 text-muted-foreground">Your documents are ready when the question arrives.</p></div><Link href="/documents" data-testid="button-dashboard-upload" className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add document</Link></div><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Documents" value={data?.totalDocuments ?? 0} note={`${data?.readyDocuments ?? 0} ready to query`} icon={FolderOpen} /><Metric label="Being read" value={data?.processingDocuments ?? 0} note="Processing now" icon={LoaderCircle} tone="teal" /><Metric label="Conversations" value={data?.totalConversations ?? 0} note="Questions explored" icon={MessageCircle} tone="gold" /><Metric label="Library health" value={data?.totalDocuments ? `${Math.round(((data.readyDocuments || 0) / data.totalDocuments) * 100)}%` : '—'} note="Documents ready" icon={CircleCheck} tone="ink" /></div><div className="mt-10 grid gap-8 xl:grid-cols-[1.15fr_.85fr]"><section><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Recently added</p><h2 className="mt-1 text-xl font-semibold">Your library</h2></div><Link href="/documents" data-testid="link-view-all-documents" className="text-xs font-semibold text-primary hover:underline">View all <ArrowUpRight className="ml-1 inline h-3 w-3" /></Link></div>{data?.recentDocuments?.length ? <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{data.recentDocuments.map((doc) => <DocumentRow key={doc.id} document={doc} />)}</div> : <EmptyState icon={FolderOpen} title="Your library is waiting" body="Add a PDF or text file to begin asking questions." action={<Link href="/documents" data-testid="button-empty-add-document" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add a document</Link>} />}</section><section><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">The thread</p><h2 className="mt-1 text-xl font-semibold">Recent conversations</h2></div><MessageCircle className="h-5 w-5 text-muted-foreground" /></div>{data?.recentConversations?.length ? <div className="space-y-3">{data.recentConversations.slice(0, 5).map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} />)}</div> : <EmptyState icon={MessageCircle} title="No questions yet" body="Open a ready document and start a conversation when you are ready." />}</section></div><div className="mt-8 rounded-xl border border-[#b7d0c9] bg-[#dcebea] p-5 text-[#183346]"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#3c746c]" /><div><p className="font-semibold">A note on privacy</p><p className="mt-1 text-sm leading-6 text-[#4e6d6c]">Your workspace is private. Locus only searches documents you have added here, and every answer keeps its source passages attached.</p></div></div></div>{conversations.isFetching && <span className="sr-only">Refreshing conversations</span>}</div>;
}

function DashboardSkeleton() {
  return <div data-testid="state-dashboard-loading" className="space-y-10"><div><Skeleton className="h-3 w-32" /><Skeleton className="mt-4 h-12 w-80" /><Skeleton className="mt-3 h-4 w-64" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div><div className="grid gap-8 xl:grid-cols-2"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div></div>;
}

function Metric({ label, value, note, icon: Icon, tone = 'coral' }: { label: string; value: string | number; note: string; icon: typeof FolderOpen; tone?: string }) {
  const toneClass = tone === 'teal' ? 'bg-[#dcebea] text-[#3c746c]' : tone === 'gold' ? 'bg-[#f5e9c8] text-[#886a20]' : tone === 'ink' ? 'bg-[#e1e6e5] text-[#183346]' : 'bg-[#f7e4df] text-[#a34844]';
  return <div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="rounded-xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span></div><p className="mt-4 text-xs text-muted-foreground">{note}</p></div>;
}

function DocumentRow({ document }: { document: Document }) {
  return <Link href={`/documents/${document.id}`} data-testid={`row-document-${document.id}`} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/55 sm:px-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f7e4df] text-primary"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:text-primary">{document.filename}</span><span className="mt-1 block text-xs text-muted-foreground">{formatSize(document.fileSize)} · added {formatDate(document.createdAt)}</span></span><StatusPill status={document.status} /><ChevronRight className="h-4 w-4 text-muted-foreground/50" /></Link>;
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  return <Link href={`/chat/${conversation.id}`} data-testid={`row-conversation-${conversation.id}`} className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-transform hover:-translate-y-0.5 hover:shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5e9c8] text-[#886a20]"><MessageCircle className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:text-primary">{conversation.title || 'Untitled conversation'}</span><span className="mt-1 block text-xs text-muted-foreground">{conversation.messageCount} messages · {formatDate(conversation.updatedAt)}</span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground/45 group-hover:text-primary" /></Link>;
}

function DocumentsPage() {
  const docsQuery = useListDocuments();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const requestUpload = useRequestUploadUrl();
  const createDocument = useCreateDocument();
  const renameDocument = useRenameDocument();
  const deleteDocument = useDeleteDocument();
  const processDocument = useProcessDocument();
  const documents = useMemo(() => (docsQuery.data || []).filter((doc) => doc.filename.toLowerCase().includes(filter.toLowerCase())), [docsQuery.data, filter]);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  const handleFile = (file?: File) => {
    if (!file) return;
    if (!['application/pdf', 'text/plain'].includes(file.type) && !file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.txt')) { setUploadError('Choose a PDF or TXT file.'); return; }
    setUploadError(''); setUploading(true);
    const contentType = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/pdf';
    requestUpload.mutate({ data: { name: file.name, size: file.size, contentType } }, { onSuccess: (upload) => {
      void (async () => {
        try {
          const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
          if (!response.ok) throw new Error('Upload did not complete');
          createDocument.mutate({ data: { filename: file.name, originalFilename: file.name, fileType: contentType, fileSize: file.size, storagePath: upload.objectPath } }, { onSuccess: () => { setUploading(false); refresh(); }, onError: () => { setUploading(false); setUploadError('The file uploaded, but we could not save its details.'); } });
        } catch { setUploading(false); setUploadError('Upload interrupted. Please try again.'); }
      })();
    }, onError: () => { setUploading(false); setUploadError('Could not prepare a secure upload. Please try again.'); } });
  };
  const rename = (doc: Document) => { const next = window.prompt('Rename document', doc.filename); if (next?.trim() && next.trim() !== doc.filename) renameDocument.mutate({ id: doc.id, data: { filename: next.trim() } }, { onSuccess: refresh }); };
  const remove = (doc: Document) => { if (window.confirm(`Delete “${doc.filename}”? This also removes its conversations.`)) deleteDocument.mutate({ id: doc.id }, { onSuccess: refresh }); };
  if (docsQuery.isLoading) return <div data-testid="state-documents-loading" className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>;
  return <div data-testid="page-documents" className="animate-rise-in"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">The library</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Documents</h1><p className="mt-3 text-muted-foreground">Private context for better questions.</p></div><button data-testid="button-upload-document" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"><Upload className="h-4 w-4" />{uploading ? 'Uploading…' : 'Upload document'}</button><input ref={inputRef} data-testid="input-document-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ''; }} /></div><div className="mt-9 rounded-2xl border border-dashed border-[#9ebeb6] bg-[#e7f0ed] p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3c746c] text-[#eff8f4]"><Upload className="h-5 w-5" /></div><div className="flex-1"><h2 className="font-semibold text-[#183346]">Add a source to your library</h2><p className="mt-1 text-sm leading-6 text-[#4e6d6c]">PDFs and plain text files up to 25 MB. Locus reads them, then keeps the relevant passages close at hand.</p></div><button data-testid="button-browse-files" onClick={() => inputRef.current?.click()} className="rounded-lg border border-[#9ebeb6] bg-[#f6fbf8] px-4 py-2.5 text-sm font-semibold text-[#285b55] hover:bg-[#fff]">Browse files</button></div></div>{uploadError && <div className="mt-4"><ErrorPanel message={uploadError} /></div>}<div className="mt-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-xl font-semibold">All documents <span className="ml-1 text-sm font-normal text-muted-foreground">({docsQuery.data?.length || 0})</span></h2></div><label className="relative block w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-documents" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search filenames" className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none ring-primary/20 placeholder:text-muted-foreground/70 focus:ring-4" /></label></div>{docsQuery.isError ? <div className="mt-4"><ErrorPanel onRetry={() => docsQuery.refetch()} /></div> : documents.length ? <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{documents.map((doc) => <div key={doc.id} data-testid={`card-document-${doc.id}`} className="group flex flex-wrap items-center gap-4 border-b border-border px-4 py-4 last:border-0 sm:px-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7e4df] text-primary"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><Link href={`/documents/${doc.id}`} data-testid={`link-document-${doc.id}`} className="block truncate text-sm font-semibold hover:text-primary">{doc.filename}</Link><p className="mt-1 text-xs text-muted-foreground">{formatSize(doc.fileSize)} · {doc.pageCount ? `${doc.pageCount} pages` : 'Pages pending'} · {formatDate(doc.updatedAt)}</p></div><StatusPill status={doc.status} /><div className="flex items-center gap-1"><button data-testid={`button-process-document-${doc.id}`} onClick={() => processDocument.mutate({ id: doc.id }, { onSuccess: refresh })} disabled={doc.status === DocumentStatus.PROCESSING || doc.status === DocumentStatus.EMBEDDING || processDocument.isPending} className="rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">{doc.status === DocumentStatus.FAILED ? 'Retry' : doc.status === DocumentStatus.READY ? 'Re-index' : 'Process'}</button><button data-testid={`button-rename-document-${doc.id}`} onClick={() => rename(doc)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Rename"><MoreHorizontal className="h-4 w-4" /></button><button data-testid={`button-delete-document-${doc.id}`} onClick={() => remove(doc)} className="rounded-md p-2 text-muted-foreground hover:bg-[#f7e4df] hover:text-[#a34844]" title="Delete"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <div className="mt-4"><EmptyState icon={FolderOpen} title={filter ? 'No matching documents' : 'Your library is empty'} body={filter ? 'Try a different filename.' : 'The first document is the beginning of a useful conversation.'} action={!filter ? <button data-testid="button-empty-upload" onClick={() => inputRef.current?.click()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Upload a document</button> : undefined} /></div>}</div>;
}

function DocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id || '';
  const documentQuery = useGetDocument(id, { query: { enabled: Boolean(id), queryKey: getGetDocumentQueryKey(id) } });
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const doc = documentQuery.data;
  const startChat = () => { if (!doc) return; createConversation.mutate({ data: { documentId: doc.id, title: `Questions about ${doc.filename}` } }, { onSuccess: (conversation) => { void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation(`/chat/${conversation.id}`); } }); };
  if (documentQuery.isLoading) return <div data-testid="state-document-loading" className="space-y-5"><Skeleton className="h-8 w-28" /><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;
  if (documentQuery.isError || !doc) return <ErrorPanel onRetry={() => documentQuery.refetch()} message="This document could not be found." />;
  return <div data-testid="page-document-detail" className="animate-rise-in"><Link href="/documents" data-testid="link-back-documents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4 rotate-180" />All documents</Link><div className="mt-7 flex flex-col justify-between gap-5 border-b border-border pb-8 sm:flex-row sm:items-start"><div className="flex items-start gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7e4df] text-primary"><FileText className="h-7 w-7" /></span><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Document detail</p><h1 data-testid="text-document-title" className="mt-2 max-w-xl text-3xl font-semibold tracking-[-.035em]">{doc.filename}</h1><p className="mt-2 text-sm text-muted-foreground">{formatSize(doc.fileSize)} · {doc.pageCount ? `${doc.pageCount} pages` : 'Page count pending'} · added {formatDate(doc.createdAt)}</p></div></div><button data-testid="button-start-document-chat" onClick={startChat} disabled={doc.status !== DocumentStatus.READY || createConversation.isPending} className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{createConversation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{doc.status === DocumentStatus.READY ? 'Ask this document' : 'Document is not ready'}</button></div><div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Readiness</p><h2 className="mt-1 text-xl font-semibold">Your source is {doc.status === DocumentStatus.READY ? 'ready' : 'getting ready'}</h2></div><StatusPill status={doc.status} /></div><div className="mt-8 space-y-5"><ReadinessRow label="File uploaded" complete={[DocumentStatus.UPLOADED, DocumentStatus.PROCESSING, DocumentStatus.EMBEDDING, DocumentStatus.READY].includes(doc.status)} /><ReadinessRow label="Text extracted" complete={[DocumentStatus.PROCESSING, DocumentStatus.EMBEDDING, DocumentStatus.READY].includes(doc.status)} active={doc.status === DocumentStatus.PROCESSING} /><ReadinessRow label="Search index built" complete={doc.status === DocumentStatus.READY} active={doc.status === DocumentStatus.EMBEDDING} /></div>{doc.status === DocumentStatus.FAILED && <div className="mt-6 rounded-lg bg-[#f7e4df] p-4 text-sm text-[#8f403d]"><p className="font-semibold">We could not finish reading this file.</p><p className="mt-1">{doc.errorMessage || 'Try processing it again from your document library.'}</p></div>}</section><section className="rounded-2xl border border-border bg-[#f5e9c8] p-6 text-[#604d1e]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4b46c]/45"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-6 text-xl font-semibold">A source you can trust</h2><p className="mt-3 text-sm leading-6 text-[#735d29]">When you ask a question, Locus will show the exact passages it used from this document. You stay in control of the context.</p><div className="mt-7 border-t border-[#d8bb78] pt-4 font-mono text-[10px] uppercase tracking-[.14em] text-[#8d712f]">Index · {doc.chunkCount || 0} passages</div></section></div></div>;
}

function ReadinessRow({ label, complete, active }: { label: string; complete: boolean; active?: boolean }) {
  return <div className="flex items-center gap-3 text-sm"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? 'bg-[#dcebea] text-[#3c746c]' : active ? 'bg-[#f5e9c8] text-[#886a20]' : 'bg-muted text-muted-foreground'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : active ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={complete ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>{complete && <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-[#3c746c]">Done</span>}</div>;
}

function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const id = params.conversationId || '';
  const conversationQuery = useGetConversation(id, { query: { enabled: Boolean(id), queryKey: getGetConversationQueryKey(id) } });
  const askChat = useAskChat();
  const searchDocuments = useSearchDocuments();
  const renameConversation = useRenameConversation();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [question, setQuestion] = useState('');
  const [localAnswer, setLocalAnswer] = useState<ChatResponse | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const conversation = conversationQuery.data;
  const submit = () => { const trimmed = question.trim(); if (!trimmed || askChat.isPending) return; setQuestion(''); askChat.mutate({ data: { question: trimmed, conversationId: id, documentId: conversation?.documentId || null } }, { onSuccess: (answer) => { setLocalAnswer(answer); void queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) }); void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); }, onError: () => setQuestion(trimmed) }); };
  const rename = () => { const next = window.prompt('Rename conversation', conversation?.title || 'Conversation'); if (next?.trim()) renameConversation.mutate({ id, data: { title: next.trim() } }, { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(id) }) }); };
  const remove = () => { if (window.confirm('Delete this conversation?')) deleteConversation.mutate({ id }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation('/dashboard'); } }); };
  const runSearch = () => { if (!search.trim()) return; searchDocuments.mutate({ data: { query: search.trim(), documentId: conversation?.documentId || null, topK: 6 } }, { onSuccess: setSearchResults }); };
  if (conversationQuery.isLoading) return <div data-testid="state-chat-loading" className="mx-auto max-w-4xl space-y-6"><Skeleton className="h-8 w-72" /><Skeleton className="h-24 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-28 w-3/4 rounded-2xl" /></div>;
  if (conversationQuery.isError || !conversation) return <ErrorPanel onRetry={() => conversationQuery.refetch()} message="This conversation could not be loaded." />;
  const messages = conversation.messages || [];
  return <div data-testid="page-chat" className="animate-rise-in mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-start"><div className="min-w-0"><Link href="/dashboard" data-testid="link-back-dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4 rotate-180" />Overview</Link><div className="mt-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5e9c8] text-[#886a20]"><MessageCircle className="h-4 w-4" /></span><div className="min-w-0"><h1 data-testid="text-conversation-title" className="truncate text-2xl font-semibold tracking-[-.03em]">{conversation.title || 'Untitled conversation'}</h1><p className="mt-1 text-xs text-muted-foreground">{conversation.messageCount} messages · {conversation.documentId ? 'Focused document' : 'Entire library'}</p></div></div></div><div className="flex items-center gap-2"><button data-testid="button-search-sources" onClick={() => setShowSearch((value) => !value)} className={`rounded-lg border border-border px-3 py-2 text-xs font-semibold ${showSearch ? 'bg-secondary text-secondary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}><Search className="mr-1.5 inline h-3.5 w-3.5" />Find in library</button><button data-testid="button-rename-conversation" onClick={rename} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button><button data-testid="button-delete-conversation" onClick={remove} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-[#f7e4df] hover:text-[#a34844]"><Trash2 className="h-4 w-4" /></button></div></div>{showSearch && <div className="mt-5 rounded-xl border border-[#9ebeb6] bg-[#e7f0ed] p-4"><div className="flex gap-2"><input data-testid="input-search-sources" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} placeholder="Search passages across your library" className="h-10 min-w-0 flex-1 rounded-lg border border-[#b7d0c9] bg-[#f6fbf8] px-3 text-sm outline-none focus:ring-4 focus:ring-[#3c746c]/15" /><button data-testid="button-run-source-search" onClick={runSearch} disabled={searchDocuments.isPending} className="rounded-lg bg-[#3c746c] px-4 text-sm font-semibold text-[#f6fbf8]">{searchDocuments.isPending ? 'Searching…' : 'Search'}</button></div>{searchResults.length > 0 && <div className="mt-4 grid gap-2">{searchResults.map((result) => <SourceCard key={result.chunkId} source={result} />)}</div>}{searchResults.length === 0 && searchDocuments.isSuccess && <p className="mt-4 text-sm text-[#4e6d6c]">No matching passages found.</p>}</div>}<div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0"><div className="space-y-7">{messages.map((message) => <MessageBubble key={message.id} role={message.role} content={message.content} sources={message.sources} />)}{localAnswer && <MessageBubble role="assistant" content={localAnswer.answer} sources={localAnswer.sources} temporary />}{askChat.isPending && <div className="flex items-start gap-3"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcebea] text-[#3c746c]"><Sparkles className="h-4 w-4" /></span><div className="rounded-2xl rounded-tl-sm border border-border bg-card px-5 py-4"><div className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" /><span className="ml-2">Reading your sources…</span></div></div></div>}</div>{messages.length === 0 && !localAnswer && <EmptyState icon={MessageCircle} title="Start with a question" body="Ask for a summary, a comparison, or the detail you cannot quite place." />}<div className="sticky bottom-4 mt-10"><div className="rounded-2xl border border-border bg-card p-2 shadow-md"><textarea data-testid="input-chat-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Ask something grounded in your documents…" rows={2} className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</span><button data-testid="button-send-question" onClick={submit} disabled={!question.trim() || askChat.isPending} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"><Send className="h-4 w-4" /></button></div></div></div></section><aside className="hidden lg:block"><div className="sticky top-8 rounded-xl border border-border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Conversation note</p><p className="mt-4 text-sm leading-6 text-muted-foreground">Each response is paired with the passages that shaped it. Select a source to read the surrounding context.</p><div className="mt-5 border-t border-border pt-4"><div className="flex items-center gap-2 text-xs font-semibold text-[#3c746c]"><ShieldCheck className="h-3.5 w-3.5" />Evidence attached</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Answers are not a substitute for reading the source. They are a faster way back to it.</p></div></div></aside></div></div>;
}

function MessageBubble({ role, content, sources = [], temporary }: { role: 'user' | 'assistant'; content: string; sources?: Source[]; temporary?: boolean }) {
  return <div data-testid={`message-${role}-${temporary ? 'latest' : content.slice(0, 12)}`} className={`flex items-start gap-3 ${role === 'user' ? 'justify-end' : ''}`}><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${role === 'user' ? 'order-2 bg-foreground text-background' : 'bg-[#dcebea] text-[#3c746c]'}`}>{role === 'user' ? <UserRound className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span><div className={`max-w-[min(680px,85%)] ${role === 'user' ? 'order-1' : ''}`}><div className={`rounded-2xl px-5 py-4 text-sm leading-7 ${role === 'user' ? 'rounded-tr-sm bg-foreground text-background' : 'rounded-tl-sm border border-border bg-card text-foreground'}`}><p className="whitespace-pre-wrap">{content}</p></div>{role === 'assistant' && sources.length > 0 && <div className="mt-3 space-y-2">{sources.map((source) => <SourceCard key={source.chunkId} source={source} compact />)}</div>}</div></div>;
}

function SourceCard({ source, compact }: { source: Source | SearchResult; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div data-testid={`source-${source.chunkId}`} className="rounded-lg border border-[#b7d0c9] bg-[#eef5f1] text-[#285b55]"><button data-testid={`button-toggle-source-${source.chunkId}`} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs"><Hash className="h-3.5 w-3.5 shrink-0 text-[#3c746c]" /><span className="min-w-0 flex-1 truncate font-semibold">{source.documentName}</span><span className="shrink-0 text-[#62817b]">{source.pageNumber ? `p. ${source.pageNumber}` : 'passage'}</span><ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} /></button>{open && <div className={`border-t border-[#cce0d8] px-3 py-3 text-xs leading-5 text-[#4e6d6c] ${compact ? '' : 'max-h-48 overflow-auto'}`}><p>{source.content}</p><p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#73948b]">Similarity · {Math.round(source.similarity * 100)}%</p></div>}</div>;
}

function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [dark, setDark] = useState(() => localStorage.getItem('locus-theme') === 'dark');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('locus-theme', dark ? 'dark' : 'light'); }, [dark]);
  return <div data-testid="page-settings" className="animate-rise-in max-w-3xl"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Workspace preferences</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Settings</h1><p className="mt-3 text-muted-foreground">Make this quiet place feel like yours.</p></div><div className="mt-9 space-y-5"><section className="rounded-xl border border-border bg-card p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dcebea] text-[#3c746c]"><UserRound className="h-4 w-4" /></span><div><h2 className="font-semibold">Profile</h2><p className="text-sm text-muted-foreground">Your account details from Clerk.</p></div></div><div className="mt-6 flex items-center gap-4 rounded-lg bg-muted/60 p-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{initials(user?.fullName || user?.firstName)}</span><div className="min-w-0"><p data-testid="text-settings-name" className="font-semibold">{user?.fullName || user?.firstName || 'Reader'}</p><p data-testid="text-settings-email" className="mt-1 truncate text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || 'Your email is managed by Clerk.'}</p></div></div></section><section className="rounded-xl border border-border bg-card p-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5e9c8] text-[#886a20]"><Settings2 className="h-4 w-4" /></span><div><h2 className="font-semibold">Reading environment</h2><p className="text-sm text-muted-foreground">Small choices for long sessions.</p></div></div><div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5"><div><p className="text-sm font-semibold">Deep ink theme</p><p className="mt-1 text-xs text-muted-foreground">A darker canvas for late-night reading.</p></div><button data-testid="button-toggle-theme" onClick={() => setDark((value) => !value)} className={`relative h-7 w-12 rounded-full transition-colors ${dark ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${dark ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5"><div><p className="text-sm font-semibold">Grounded answers</p><p className="mt-1 text-xs text-muted-foreground">Always show source passages with answers.</p></div><span data-testid="status-grounded-answers" className="inline-flex items-center gap-1.5 rounded-full bg-[#dcebea] px-2.5 py-1 text-[11px] font-semibold text-[#3c746c]"><Check className="h-3 w-3" />Always on</span></div></section><section className="rounded-xl border border-[#e7b9ac] bg-[#f7e4df] p-6"><h2 className="font-semibold text-[#8f403d]">Session</h2><p className="mt-1 text-sm text-[#a34844]">Sign out of this browser when you are finished.</p><button data-testid="button-settings-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#dca99d] bg-[#fff5f1] px-3 py-2 text-sm font-semibold text-[#8f403d] hover:bg-[#fff]"><LogOut className="h-4 w-4" />Sign out</button></section></div></div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <main className="noise flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="absolute left-6 top-6 lg:left-10 lg:top-8"><Logo /></div><div className="w-full">{mode === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => { const userId = user?.id ?? null; if (previous.current !== undefined && previous.current !== userId) client.clear(); previous.current = userId; }), [addListener, client]);
  return null;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function AppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Your sources are waiting.' } }, signUp: { start: { title: 'Make space for better questions', subtitle: 'Your private reading room starts here.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><ClerkQueryClientCacheInvalidator /><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route path="/dashboard">{() => <ProtectedPage><DashboardPage /></ProtectedPage>}</Route><Route path="/documents">{() => <ProtectedPage><DocumentsPage /></ProtectedPage>}</Route><Route path="/documents/:id">{() => <ProtectedPage><DocumentPage /></ProtectedPage>}</Route><Route path="/chat/:conversationId">{() => <ProtectedPage><ChatPage /></ProtectedPage>}</Route><Route path="/settings">{() => <ProtectedPage><SettingsPage /></ProtectedPage>}</Route><Route component={NotFound} /></Switch></ClerkProvider>;
}

function App() {
  if (!clerkPubKey) return <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-center text-foreground"><div><Logo /><p className="mt-6 max-w-sm text-sm text-muted-foreground">Clerk is not configured for this workspace yet.</p></div></div>;
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><AppRoutes /></WouterRouter></QueryClientProvider>;
}

export default App;