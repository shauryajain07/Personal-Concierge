"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  LayoutList,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type View = "Today" | "Calendar" | "Courses" | "Assignments" | "Progress";

const courses = [
  { code: "PHY 204", name: "Modern Physics", color: "#7067e8", light: "#eeedff", progress: 68, next: "Quantum Mechanics Test", due: "Fri" },
  { code: "ECO 202", name: "Macroeconomics", color: "#e36b4f", light: "#fff0eb", progress: 44, next: "Policy Analysis Essay", due: "Mon" },
  { code: "MAT 212", name: "Linear Algebra", color: "#24956f", light: "#e6f7f0", progress: 77, next: "Problem Set 6", due: "Wed" },
  { code: "CS 231", name: "Data Structures", color: "#2b78c5", light: "#e8f3ff", progress: 52, next: "Graph Algorithms Lab", due: "Jul 23" },
];

const week = [
  { day: "MON", date: 13 },
  { day: "TUE", date: 14, active: true },
  { day: "WED", date: 15 },
  { day: "THU", date: 16 },
  { day: "FRI", date: 17 },
];

const schedule = [
  { time: "9:00", end: "10:15", title: "Modern Physics", meta: "Science Hall 204", color: "purple", type: "Class" },
  { time: "11:00", end: "12:00", title: "Essay research", meta: "Economics · 2 of 4 sources", color: "coral", type: "Focus" },
  { time: "14:00", end: "15:15", title: "Linear Algebra", meta: "North Campus 12", color: "green", type: "Class" },
  { time: "17:30", end: "19:00", title: "Football practice", meta: "University field", color: "blue", type: "Personal" },
];

const assignments = [
  { title: "Quantum Mechanics Test", course: "Modern Physics", due: "Jul 17", remaining: "3h 20m", status: "In progress", color: "#7067e8", progress: 46 },
  { title: "Policy Analysis Essay", course: "Macroeconomics", due: "Jul 20", remaining: "5h 30m", status: "In progress", color: "#e36b4f", progress: 28 },
  { title: "Problem Set 6", course: "Linear Algebra", due: "Jul 22", remaining: "2h", status: "Not started", color: "#24956f", progress: 0 },
  { title: "Graph Algorithms Lab", course: "Data Structures", due: "Jul 23", remaining: "4h 15m", status: "Not started", color: "#2b78c5", progress: 0 },
];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /><span /><span /></div>
      <div><strong>alma</strong><small>ACADEMIC OS</small></div>
    </div>
  );
}

function Sidebar({ view, setView, open, close }: { view: View; setView: (v: View) => void; open: boolean; close: () => void }) {
  const nav: { label: View; icon: typeof Home }[] = [
    { label: "Today", icon: Home },
    { label: "Calendar", icon: CalendarDays },
    { label: "Courses", icon: BookOpen },
    { label: "Assignments", icon: LayoutList },
    { label: "Progress", icon: BarChart3 },
  ];
  return (
    <>
      {open && <button className="scrim" aria-label="Close menu" onClick={close} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-top"><Brand /><button className="close-menu" onClick={close} aria-label="Close menu"><X size={20} /></button></div>
        <button className="term-select">
          <span><small>CURRENT TERM</small><strong>Semester 3</strong></span><ChevronDown size={16} />
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={view === label ? "active" : ""} onClick={() => { setView(label); close(); }}>
              <Icon size={18} strokeWidth={2} /><span>{label}</span>{label === "Assignments" && <b>4</b>}
            </button>
          ))}
        </nav>
        <div className="side-label">YOUR COURSES</div>
        <div className="course-nav">
          {courses.map((course) => (
            <button key={course.code} onClick={() => { setView("Courses"); close(); }}>
              <i style={{ background: course.color }} />
              <span>{course.name}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button><CircleHelp size={18} /> Help & support</button>
          <button><Settings size={18} /> Settings</button>
          <div className="profile"><div className="avatar">SJ</div><span><strong>Shaurya Jain</strong><small>Year 2 · Semester 3</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, openMenu, openPlanner, openAdd }: { title: string; openMenu: () => void; openPlanner: () => void; openAdd: () => void }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={openMenu} aria-label="Open menu"><Menu size={21} /></button>
      <div className="mobile-brand"><Brand /></div>
      <div className="breadcrumbs"><span>Semester 3</span><ChevronRight size={14} /><strong>{title}</strong></div>
      <div className="top-actions">
        <button className="search-button" aria-label="Search"><Search size={18} /><span>Search</span><kbd>⌘ K</kbd></button>
        <button className="ai-top" onClick={openPlanner}><Sparkles size={17} /> Ask Alma</button>
        <button className="add-top" onClick={openAdd}><Plus size={18} /><span>Add task</span></button>
      </div>
    </header>
  );
}

function TodayView({ openPlanner }: { openPlanner: () => void }) {
  const [done, setDone] = useState([false, false, true]);
  return (
    <div className="page today-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">TUESDAY, JULY 14</div>
          <h1>Good morning, Shaurya.</h1>
          <p>You have a focused day ahead. Your plan leaves <strong>2h 15m</strong> of breathing room.</p>
        </div>
        <div className="day-score"><div className="score-ring"><span>76</span></div><span><strong>Day balance</strong><small>Looking healthy</small></span></div>
      </section>

      <button className="command-card" onClick={openPlanner}>
        <span className="command-icon"><Sparkles size={20} /></span>
        <span className="command-copy"><strong>Tell Alma what changed...</strong><small>“I have a physics test Friday and football tomorrow. Rebuild my schedule.”</small></span>
        <span className="command-go"><ArrowRight size={18} /></span>
      </button>

      <section className="metric-grid">
        <article className="metric"><span className="metric-icon purple"><Clock3 size={18} /></span><div><small>FOCUS TIME</small><strong>2h 45m</strong><em>3 sessions today</em></div></article>
        <article className="metric"><span className="metric-icon coral"><Target size={18} /></span><div><small>DUE THIS WEEK</small><strong>4 tasks</strong><em>1 needs attention</em></div></article>
        <article className="metric"><span className="metric-icon green"><Zap size={18} /></span><div><small>WEEKLY LOAD</small><strong>68%</strong><em>8h 20m remaining</em></div></article>
        <article className="metric"><span className="metric-icon gold"><GraduationCap size={18} /></span><div><small>CURRENT GPA</small><strong>3.72</strong><em>On track</em></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel schedule-panel">
          <div className="panel-head"><div><h2>Today’s plan</h2><p>4 commitments · 5h total</p></div><button>View calendar <ArrowRight size={15} /></button></div>
          <div className="timeline">
            {schedule.map((item, i) => (
              <div className="timeline-row" key={item.time}>
                <div className="time"><strong>{item.time}</strong><span>{item.end}</span></div>
                <div className={`event ${item.color}`}>
                  <div><span className="event-type">{item.type}</span><h3>{item.title}</h3><p>{item.meta}</p></div>
                  {i === 1 && <button className="start-button">Start session</button>}
                  <MoreHorizontal size={18} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="right-stack">
          <article className="panel attention-panel">
            <div className="panel-head"><div><h2>Needs attention</h2><p>Closest deadlines first</p></div><button className="plain-icon"><MoreHorizontal size={19} /></button></div>
            <div className="attention-item">
              <div className="date-block urgent"><strong>17</strong><span>JUL</span></div>
              <div className="attention-copy"><span className="course-pill physics">PHY 204</span><h3>Quantum Mechanics Test</h3><div className="mini-progress"><i style={{ width: "46%" }} /><span>46% ready</span></div></div>
              <ChevronRight size={17} />
            </div>
            <div className="attention-item">
              <div className="date-block"><strong>20</strong><span>JUL</span></div>
              <div className="attention-copy"><span className="course-pill economics">ECO 202</span><h3>Policy Analysis Essay</h3><div className="mini-progress coral-bar"><i style={{ width: "28%" }} /><span>28% done</span></div></div>
              <ChevronRight size={17} />
            </div>
          </article>

          <article className="panel checklist-panel">
            <div className="panel-head"><div><h2>Quick wins</h2><p>Small tasks for open moments</p></div><span className="count-pill">{done.filter(Boolean).length}/3</span></div>
            {[
              "Review lecture 8 flashcards",
              "Email essay outline to tutor",
              "Upload problem set scan",
            ].map((task, i) => (
              <button className={`check-row ${done[i] ? "checked" : ""}`} key={task} onClick={() => setDone((d) => d.map((v, n) => n === i ? !v : v))}>
                <span className="checkbox">{done[i] && <Check size={13} />}</span><span>{task}</span><small>{["15 min", "5 min", "3 min"][i]}</small>
              </button>
            ))}
          </article>
        </div>
      </section>
    </div>
  );
}

function CalendarView() {
  return (
    <div className="page calendar-page">
      <div className="page-heading"><div><div className="eyebrow">JULY 13–17, 2026</div><h1>Your week</h1><p>Classes, commitments, and focused work in one place.</p></div><div className="heading-actions"><button><ChevronLeft size={17} /></button><button className="today-chip">Today</button><button><ChevronRight size={17} /></button><button className="primary-small"><Plus size={17} /> New event</button></div></div>
      <div className="calendar-summary">
        <span><i className="dot purple-dot" /> 8h 45m classes</span><span><i className="dot coral-dot" /> 10h 30m focused work</span><span><i className="dot blue-dot" /> 4h personal</span><strong>72% capacity</strong>
      </div>
      <article className="week-calendar">
        <div className="calendar-corner">GMT+5:30</div>
        {week.map((d) => <div className={`day-head ${d.active ? "active" : ""}`} key={d.day}><span>{d.day}</span><strong>{d.date}</strong>{d.active && <i />}</div>)}
        {["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"].map((time, row) => (
          <div className="calendar-row" key={time} style={{ gridRow: row + 2 }}><span>{time}</span></div>
        ))}
        <CalendarEvent day={1} top={77} height={70} color="purple" title="Modern Physics" time="9:00–10:15" />
        <CalendarEvent day={2} top={124} height={56} color="coral" title="Essay research" time="11:00–12:00" />
        <CalendarEvent day={2} top={224} height={70} color="green" title="Linear Algebra" time="14:00–15:15" />
        <CalendarEvent day={2} top={345} height={78} color="blue" title="Football" time="17:30–19:00" />
        <CalendarEvent day={3} top={84} height={58} color="green" title="Problem set" time="9:15–10:15" />
        <CalendarEvent day={3} top={270} height={70} color="purple" title="Test prep" time="15:30–16:45" />
        <CalendarEvent day={4} top={126} height={70} color="coral" title="Draft essay" time="11:00–12:30" />
        <CalendarEvent day={4} top={302} height={58} color="blue" title="Office hours" time="16:30–17:30" />
        <CalendarEvent day={5} top={74} height={78} color="purple" title="Physics test" time="9:00–10:30" />
        <CalendarEvent day={5} top={225} height={58} color="coral" title="Essay edit" time="14:00–15:00" />
      </article>
    </div>
  );
}

function CalendarEvent({ day, top, height, color, title, time }: { day: number; top: number; height: number; color: string; title: string; time: string }) {
  return <div className={`calendar-event ${color}`} style={{ gridColumn: day + 1, top, height }}><strong>{title}</strong><span>{time}</span></div>;
}

function CoursesView() {
  return (
    <div className="page courses-page">
      <div className="page-heading"><div><div className="eyebrow">YEAR 2 · SEMESTER 3</div><h1>Your courses</h1><p>Everything you’re learning, organized by term.</p></div><button className="primary-small"><Plus size={17} /> Add course</button></div>
      <div className="semester-track">
        {[1,2,3,4,5,6,7,8].map((n) => <button key={n} className={n === 3 ? "active" : n < 3 ? "complete" : ""}><span>{n < 3 ? <Check size={14} /> : n}</span><small>SEM {n}</small></button>)}
      </div>
      <div className="courses-grid">
        {courses.map((course) => (
          <article className="course-card" key={course.code}>
            <div className="course-card-top" style={{ background: course.light }}><span className="course-symbol" style={{ color: course.color, borderColor: `${course.color}40` }}>{course.code.split(" ")[0]}</span><button><MoreHorizontal size={19} /></button></div>
            <div className="course-body"><span className="code" style={{ color: course.color }}>{course.code}</span><h2>{course.name}</h2><p>12 weeks · 3 credits</p><div className="course-progress"><span><strong>{course.progress}%</strong> complete</span><div><i style={{ background: course.color, width: `${course.progress}%` }} /></div></div><div className="next-up"><span><small>NEXT UP</small><strong>{course.next}</strong></span><b>{course.due}</b></div></div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AssignmentsView({ openAdd }: { openAdd: () => void }) {
  const [filter, setFilter] = useState("All");
  return (
    <div className="page assignments-page">
      <div className="page-heading"><div><div className="eyebrow">SEMESTER 3</div><h1>Assignments</h1><p>Plan the work, then work the plan.</p></div><button className="primary-small" onClick={openAdd}><Plus size={17} /> Add assignment</button></div>
      <div className="filter-row"><div>{["All", "In progress", "Not started", "Completed"].map((f) => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}{f === "All" && <b>4</b>}</button>)}</div><button className="filter-search"><Search size={16} /> Search assignments</button></div>
      <article className="assignment-list">
        <div className="assignment-head"><span>ASSIGNMENT</span><span>DUE</span><span>WORK LEFT</span><span>PROGRESS</span><span /></div>
        {assignments.filter((a) => filter === "All" || a.status === filter).map((a) => (
          <div className="assignment-row" key={a.title}>
            <div className="assignment-name"><i style={{ background: a.color }} /><span><strong>{a.title}</strong><small>{a.course}</small></span></div>
            <div><strong>{a.due}</strong><small>{a.due === "Jul 17" ? "3 days" : "Upcoming"}</small></div>
            <div><strong>{a.remaining}</strong><small>estimated</small></div>
            <div className="table-progress"><span><i style={{ width: `${a.progress}%`, background: a.color }} /></span><b>{a.progress}%</b></div>
            <button className="plain-icon"><MoreHorizontal size={18} /></button>
          </div>
        ))}
      </article>
      <div className="upload-card"><div className="upload-icon"><Upload size={20} /></div><div><strong>Drop in an assignment brief</strong><p>Upload a PDF and Alma will extract the requirements, estimate the work, and propose a plan.</p></div><button>Choose PDF</button></div>
    </div>
  );
}

function ProgressView() {
  const bars = [62,74,55,83,69,91,78];
  return (
    <div className="page progress-page">
      <div className="page-heading"><div><div className="eyebrow">SEMESTER 3</div><h1>Progress</h1><p>A clear view of your effort, consistency, and results.</p></div><button className="period-select">This semester <ChevronDown size={16} /></button></div>
      <section className="progress-metrics"><article><small>CURRENT GPA</small><strong>3.72</strong><span className="up">↗ 0.14</span><p>from last semester</p></article><article><small>FOCUS HOURS</small><strong>42.5</strong><span className="up">↗ 12%</span><p>this semester</p></article><article><small>ON-TIME RATE</small><strong>91%</strong><span className="up">↗ 6%</span><p>14 of 15 submitted</p></article></section>
      <section className="progress-grid">
        <article className="panel chart-panel"><div className="panel-head"><div><h2>Focus consistency</h2><p>Planned time completed each week</p></div><span className="legend"><i /> Completion rate</span></div><div className="bar-chart">{bars.map((b,i) => <div key={i}><span>{b}%</span><i style={{ height: `${b}%` }} /><small>W{i+1}</small></div>)}</div></article>
        <article className="panel grade-panel"><div className="panel-head"><div><h2>Course standing</h2><p>Current weighted scores</p></div></div>{courses.map((c,i) => <div className="grade-row" key={c.code}><i style={{ background: c.color }} /><span><strong>{c.name}</strong><small>{c.code}</small></span><div><b>{[86,79,91,84][i]}%</b><em>{["A−","B+","A","A−"][i]}</em></div></div>)}</article>
      </section>
    </div>
  );
}

function PlannerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [planned, setPlanned] = useState(false);
  const [accepted, setAccepted] = useState(false);
  function submit(e: FormEvent) { e.preventDefault(); if (!message.trim()) return; setPlanned(true); }
  return (
    <>
      {open && <button className="drawer-scrim" aria-label="Close planner" onClick={onClose} />}
      <aside className={`planner-drawer ${open ? "open" : ""}`} aria-label="Alma planner">
        <div className="drawer-head"><div className="alma-orb"><Sparkles size={19} /></div><div><strong>Alma planner</strong><span><i /> Academic context connected</span></div><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="chat-body">
          <div className="chat-date">TODAY, 10:24 AM</div>
          <div className="assistant-message"><p>Hi Shaurya — tell me what changed and I’ll rebuild the plan around your real commitments.</p></div>
          {!planned ? <div className="suggestions"><button onClick={() => setMessage("I have a physics test on Friday, an economics essay due Monday, and football practice tomorrow. Rebuild my schedule.")}>Physics test Friday, essay Monday, football tomorrow</button><button onClick={() => setMessage("I missed today’s essay session. Find another time this week.")}>I missed a study session</button><button onClick={() => setMessage("Make Thursday lighter without risking my deadlines.")}>Make Thursday lighter</button></div> : (
            <>
              <div className="user-message">{message}</div>
              <div className="assistant-message"><p>I found a balanced option. I protected football practice and moved lower-priority work without changing any fixed classes.</p></div>
              <article className={`plan-preview ${accepted ? "accepted" : ""}`}>
                <div className="plan-title"><span><Sparkles size={16} /> PROPOSED PLAN</span><b>{accepted ? "Applied" : "3 changes"}</b></div>
                <div className="plan-change"><span className="change-icon add">+</span><div><strong>Physics test prep</strong><small>Wed 3:30–4:45 PM · 1h 15m</small></div></div>
                <div className="plan-change"><span className="change-icon move">→</span><div><strong>Essay research</strong><small>Moved to Thu 11:00 AM</small></div></div>
                <div className="plan-change"><span className="change-icon add">+</span><div><strong>Essay editing</strong><small>Fri 2:00–3:00 PM · 1h</small></div></div>
                <div className="plan-note"><Check size={15} /> All work finishes before its deadline with 1h 45m of buffer.</div>
                {!accepted && <div className="plan-actions"><button onClick={() => setAccepted(true)}>Accept plan</button><button onClick={() => setMessage("Make the plan less intense on Wednesday.")}>Adjust</button></div>}
              </article>
            </>
          )}
        </div>
        <form className="chat-input" onSubmit={submit}><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What changed?" rows={3} /><div><button type="button" aria-label="Attach file"><Paperclip size={18} /></button><span>Alma may make mistakes. Review changes.</span><button className="send-button" type="submit" aria-label="Send"><Send size={17} /></button></div></form>
      </aside>
    </>
  );
}

function AddAssignmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"write" | "upload">("write");
  const [saved, setSaved] = useState(false);
  if (!open) return null;
  return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} aria-label="Close" /><section className="add-modal"><div className="modal-head"><div><span className="modal-kicker"><Sparkles size={15} /> SMART CAPTURE</span><h2>Add an assignment</h2><p>Share what you know. Alma will structure the rest.</p></div><button onClick={onClose}><X size={20} /></button></div>{saved ? <div className="saved-state"><span><Check size={28} /></span><h3>Assignment captured</h3><p>Alma is estimating the work and preparing a schedule for your review.</p><button onClick={onClose}>Done</button></div> : <><div className="capture-tabs"><button className={mode === "write" ? "active" : ""} onClick={() => setMode("write")}><FileText size={17} /> Describe it</button><button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}><Upload size={17} /> Upload PDF</button></div>{mode === "write" ? <div className="capture-form"><label>What’s the assignment?<textarea placeholder="e.g. Economics essay on monetary policy, 2,000 words, due Monday at 11:59 PM..." rows={6} /></label><div className="capture-hint"><Sparkles size={15} /><span>You can write naturally. Alma will find the course, deadline, requirements, and likely workload.</span></div></div> : <div className="drop-zone"><span><Upload size={23} /></span><strong>Drop your assignment PDF here</strong><p>or click to browse · PDF up to 20 MB</p><button>Choose file</button></div>}<div className="modal-footer"><button className="cancel" onClick={onClose}>Cancel</button><button className="capture" onClick={() => setSaved(true)}>Continue <ArrowRight size={16} /></button></div></>}</section></div>;
}

export default function HomePage() {
  const [view, setView] = useState<View>("Today");
  const [menu, setMenu] = useState(false);
  const [planner, setPlanner] = useState(false);
  const [add, setAdd] = useState(false);
  const title = useMemo(() => view, [view]);
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} open={menu} close={() => setMenu(false)} />
      <div className="main-shell">
        <Topbar title={title} openMenu={() => setMenu(true)} openPlanner={() => setPlanner(true)} openAdd={() => setAdd(true)} />
        <main>
          {view === "Today" && <TodayView openPlanner={() => setPlanner(true)} />}
          {view === "Calendar" && <CalendarView />}
          {view === "Courses" && <CoursesView />}
          {view === "Assignments" && <AssignmentsView openAdd={() => setAdd(true)} />}
          {view === "Progress" && <ProgressView />}
        </main>
      </div>
      <button className="mobile-ai" onClick={() => setPlanner(true)} aria-label="Ask Alma"><Sparkles size={20} /></button>
      <PlannerDrawer open={planner} onClose={() => setPlanner(false)} />
      <AddAssignmentModal open={add} onClose={() => setAdd(false)} />
    </div>
  );
}
