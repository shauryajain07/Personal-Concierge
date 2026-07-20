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
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  Home,
  LayoutList,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Pin,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AcademicData, Note, PlanChange } from "@/lib/types";

type View = "Today" | "Calendar" | "Courses" | "Assignments" | "Notes" | "Progress";

const DataContext = createContext<AcademicData | null>(null);
const useAcademicData = () => useContext(DataContext);

const schedule = [
  { time: "9:00", end: "10:15", title: "Modern Physics", meta: "Science Hall 204", color: "purple", type: "Class" },
  { time: "11:00", end: "12:00", title: "Essay research", meta: "Economics · 2 of 4 sources", color: "coral", type: "Focus" },
  { time: "14:00", end: "15:15", title: "Linear Algebra", meta: "North Campus 12", color: "green", type: "Class" },
  { time: "17:30", end: "19:00", title: "Football practice", meta: "University field", color: "blue", type: "Personal" },
];
const CALENDAR_COLORS=["purple","coral","green","blue"];

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /><span /><span /></div>
      <div><strong>alma</strong><small>ACADEMIC OS</small></div>
    </div>
  );
}

function Sidebar({ view, setView, open, close }: { view: View; setView: (v: View) => void; open: boolean; close: () => void }) {
  const data = useAcademicData();
  const sidebarCourses = data?.courses ?? [];
  const nav: { label: View; icon: typeof Home }[] = [
    { label: "Today", icon: Home },
    { label: "Calendar", icon: CalendarDays },
    { label: "Courses", icon: BookOpen },
    { label: "Assignments", icon: LayoutList },
    { label: "Notes", icon: NotebookPen },
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
              <Icon size={18} strokeWidth={2} /><span>{label}</span>{label === "Assignments" && <b>{data?.assignments.filter((assignment) => assignment.status !== "completed").length ?? 0}</b>}
            </button>
          ))}
        </nav>
        <div className="side-label">YOUR COURSES</div>
        <div className="course-nav">
          {sidebarCourses.map((course) => (
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

function Topbar({ title, openMenu, openPlanner, openAdd, openAuth, aiConfigured }: { title: string; openMenu: () => void; openPlanner: () => void; openAdd: () => void; openAuth: () => void; aiConfigured: boolean }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={openMenu} aria-label="Open menu"><Menu size={21} /></button>
      <div className="mobile-brand"><Brand /></div>
      <div className="breadcrumbs"><span>Semester 3</span><ChevronRight size={14} /><strong>{title}</strong></div>
      <div className="top-actions">
        <button className="search-button" aria-label="Search"><Search size={18} /><span>Search</span><kbd>⌘ K</kbd></button>
        <button className={`auth-top ${aiConfigured?"connected":""}`} onClick={openAuth}><LogIn size={16}/><span>{aiConfigured?"Your ChatGPT":"Connect ChatGPT"}</span></button>
        <button className="ai-top" onClick={openPlanner}><Sparkles size={17} /> Ask Alma</button>
        <button className="add-top" onClick={openAdd}><Plus size={18} /><span>Add task</span></button>
      </div>
    </header>
  );
}

function TodayView({ openPlanner, onChanged }: { openPlanner: () => void; onChanged: () => Promise<void> }) {
  const data = useAcademicData();
  const [now] = useState(() => Date.now());
  const [busyTaskId,setBusyTaskId]=useState<string|null>(null);
  const [taskError,setTaskError]=useState("");
  const currentDate = useMemo(() => new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }), [now]);
  const openAssignments = data?.assignments.filter((assignment) => assignment.status !== "completed") ?? [];
  const weekEnd = now + 7 * 86400000;
  const dueThisWeek = openAssignments.filter((assignment) => +new Date(assignment.dueAt) <= weekEnd);
  const remainingMinutes = openAssignments.reduce((total, assignment) => total + Math.max(0, Math.round(assignment.estimatedMinutes * (1 - assignment.progress / 100)) - assignment.actualMinutes), 0);
  async function toggleTask(task:AcademicData["tasks"][number]){
    if(busyTaskId)return;
    setBusyTaskId(task.id);setTaskError("");
    try{const response=await fetch(`/api/tasks/${task.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:task.status==="completed"?"pending":"completed"})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to update task");await onChanged();}
    catch(problem){setTaskError(problem instanceof Error?problem.message:"Unable to update task");}
    finally{setBusyTaskId(null);}
  }
  async function removeTask(task:AcademicData["tasks"][number]){
    if(busyTaskId||!window.confirm(`Delete “${task.title}”? This cannot be undone.`))return;
    setBusyTaskId(task.id);setTaskError("");
    try{const response=await fetch(`/api/tasks/${task.id}`,{method:"DELETE"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to delete task");await onChanged();}
    catch(problem){setTaskError(problem instanceof Error?problem.message:"Unable to delete task");}
    finally{setBusyTaskId(null);}
  }
  const todayItems = useMemo(() => {
    if (!data) return schedule;
    const events = [
      ...data.events.map((event) => ({ startAt:event.startAt,endAt:event.endAt,title:event.title,type:event.type === "personal" ? "Personal" : "Class",meta:event.type === "personal" ? "Fixed commitment" : data.courses.find((course) => course.id === event.courseId)?.code || "Course",color:event.type === "personal" ? "blue" : "purple" })),
      ...data.studySessions.map((session) => ({ startAt:session.startAt,endAt:session.endAt,title:session.title,type:"Focus",meta:"Planned by Alma",color:"coral" })),
    ].filter((item) => new Date(item.startAt).toDateString() === new Date().toDateString()).sort((a,b) => +new Date(a.startAt)-+new Date(b.startAt));
    return events.map((item) => ({...item,time:new Date(item.startAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),end:new Date(item.endAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}));
  },[data]);
  return (
    <div className="page today-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">{currentDate}</div>
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
        <article className="metric"><span className="metric-icon purple"><Clock3 size={18} /></span><div><small>FOCUS TIME</small><strong>{Math.round((data?.studySessions.filter((session) => session.status === "planned").reduce((sum,session)=>sum+(+new Date(session.endAt)-+new Date(session.startAt))/60000,0)||0)/60*10)/10}h</strong><em>{data?.studySessions.length ?? 0} planned sessions</em></div></article>
        <article className="metric"><span className="metric-icon coral"><Target size={18} /></span><div><small>DUE THIS WEEK</small><strong>{dueThisWeek.length} tasks</strong><em>{dueThisWeek.filter((assignment)=>assignment.priority === "high").length} high priority</em></div></article>
        <article className="metric"><span className="metric-icon green"><Zap size={18} /></span><div><small>WORK REMAINING</small><strong>{Math.round(remainingMinutes/60*10)/10}h</strong><em>Across {openAssignments.length} assignments</em></div></article>
        <article className="metric"><span className="metric-icon gold"><GraduationCap size={18} /></span><div><small>CURRENT GPA</small><strong>3.72</strong><em>On track</em></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel schedule-panel">
          <div className="panel-head"><div><h2>Today’s plan</h2><p>4 commitments · 5h total</p></div><button>View calendar <ArrowRight size={15} /></button></div>
          <div className="timeline">
            {todayItems.length ? todayItems.map((item, i) => (
              <div className="timeline-row" key={`${item.time}-${item.title}`}>
                <div className="time"><strong>{item.time}</strong><span>{item.end}</span></div>
                <div className={`event ${item.color}`}>
                  <div><span className="event-type">{item.type}</span><h3>{item.title}</h3><p>{item.meta}</p></div>
                  {i === 1 && <button className="start-button">Start session</button>}
                  <MoreHorizontal size={18} />
                </div>
              </div>
            )) : <div className="empty-inline">No commitments today. Ask Alma to create a focus plan.</div>}
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
            <div className="panel-head"><div><h2>Quick wins</h2><p>Small tasks for open moments</p></div><span className="count-pill">{data?.tasks.filter(task=>task.status==="completed").length||0}/{data?.tasks.length||0}</span></div>
            {(data?.tasks.length?data.tasks.slice(0,5):[{id:"example-1",courseId:null,title:"Ask Alma to add a task",description:"",dueAt:null,status:"pending" as const,priority:"medium" as const,estimatedMinutes:5,createdAt:"",updatedAt:""}]).map((task) => (
              <div className={`check-row ${task.status === "completed" ? "checked" : ""} ${busyTaskId===task.id?"busy":""}`} key={task.id}>
                <button className="task-toggle" type="button" disabled={busyTaskId===task.id} onClick={()=>{if(task.id.startsWith("example-")){openPlanner();return;}void toggleTask(task);}} aria-label={`${task.status==="completed"?"Reopen":"Complete"} ${task.title}`}>
                  <span className="checkbox">{task.status === "completed" && <Check size={13} />}</span><span className="task-title">{task.title}</span>
                </button>
                <small>{task.estimatedMinutes} min</small>
                {!task.id.startsWith("example-")&&<button className="task-delete" type="button" disabled={busyTaskId===task.id} onClick={()=>void removeTask(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={14}/></button>}
              </div>
            ))}
            {taskError&&<div className="task-error" role="alert">{taskError}</div>}
          </article>
        </div>
      </section>
    </div>
  );
}

function CalendarView({openEvent}:{openEvent:()=>void}) {
  const data=useAcademicData();
  const [today]=useState(()=>new Date());
  const monday=useMemo(()=>{const date=new Date(today);const day=date.getDay();date.setDate(date.getDate()-(day===0?6:day-1));date.setHours(0,0,0,0);return date;},[today]);
  const days=useMemo(()=>Array.from({length:5},(_,index)=>{const date=new Date(monday);date.setDate(date.getDate()+index);return date;}),[monday]);
  const items=useMemo(()=>{if(!data)return[];return [...data.events.map((event)=>({...event,kind:"event"})),...data.studySessions.map((session)=>({...session,kind:"session",courseId:null,type:"focus"}))].map((item)=>{const start=new Date(item.startAt);const end=new Date(item.endAt);const day=Math.floor((+new Date(start.getFullYear(),start.getMonth(),start.getDate())-+monday)/86400000)+1;const hour=start.getHours()+start.getMinutes()/60;const courseIndex=data.courses.findIndex((course)=>course.id===item.courseId);return{...item,day,top:58+(hour-8)*33,height:Math.max(28,(+end-+start)/3600000*33),color:item.kind==="session"?"coral":item.type==="personal"?"blue":CALENDAR_COLORS[Math.max(0,courseIndex)%CALENDAR_COLORS.length]};}).filter((item)=>item.day>=1&&item.day<=5);},[data,monday]);
  const focusMinutes=items.filter((item)=>item.kind==="session").reduce((sum,item)=>sum+(+new Date(item.endAt)-+new Date(item.startAt))/60000,0);
  return (
    <div className="page calendar-page">
      <div className="page-heading"><div><div className="eyebrow">{days[0].toLocaleDateString([],{month:"long",day:"numeric"})}–{days[4].toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"})}</div><h1>Your week</h1><p>Classes, commitments, and focused work in one place.</p></div><div className="heading-actions"><button><ChevronLeft size={17} /></button><button className="today-chip">Today</button><button><ChevronRight size={17} /></button><button className="primary-small" onClick={openEvent}><Plus size={17} /> New event</button></div></div>
      <div className="calendar-summary">
        <span><i className="dot purple-dot" /> {data?.events.filter((event)=>event.type==="class").length||0} classes</span><span><i className="dot coral-dot" /> {Math.round(focusMinutes/60*10)/10}h focused work</span><span><i className="dot blue-dot" /> {data?.events.filter((event)=>event.type==="personal").length||0} personal</span><strong>{items.length} blocks this week</strong>
      </div>
      <article className="week-calendar">
        <div className="calendar-corner">GMT+5:30</div>
        {days.map((date) => <div className={`day-head ${date.toDateString()===today.toDateString()?"active":""}`} key={date.toISOString()}><span>{date.toLocaleDateString([],{weekday:"short"}).toUpperCase()}</span><strong>{date.getDate()}</strong>{date.toDateString()===today.toDateString()&&<i />}</div>)}
        {["8 AM", "10 AM", "12 PM", "2 PM", "4 PM", "6 PM", "8 PM"].map((time, row) => (
          <div className="calendar-row" key={time} style={{ gridRow: row + 2 }}><span>{time}</span></div>
        ))}
        {items.map((item)=><CalendarEvent key={item.id} day={item.day} top={item.top} height={item.height} color={item.color} title={item.title} time={`${new Date(item.startAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}–${new Date(item.endAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`}/>)}
      </article>
    </div>
  );
}

function CalendarEvent({ day, top, height, color, title, time }: { day: number; top: number; height: number; color: string; title: string; time: string }) {
  const offset=(day-1)/5;
  return <div className={`calendar-event ${color}`} style={{ left:`calc(62px + ${offset*100}% - ${offset*62}px)`, top, height }}><strong>{title}</strong><span>{time}</span></div>;
}

function CoursesView({openCourse}:{openCourse:()=>void}) {
  const data = useAcademicData();
  const courseRows = data?.courses ?? [];
  return (
    <div className="page courses-page">
      <div className="page-heading"><div><div className="eyebrow">Year 2 · Semester 3</div><h1>Your courses</h1><p>Everything you’re learning, organized by term.</p></div><button className="primary-small" onClick={openCourse}><Plus size={17} /> Add course</button></div>
      <div className="semester-track">
        {[1,2,3,4,5,6,7,8].map((n) => <button key={n} className={n === 3 ? "active" : n < 3 ? "complete" : ""}><span>{n < 3 ? <Check size={14} /> : n}</span><small>SEM {n}</small></button>)}
      </div>
      <div className="courses-grid">
        {courseRows.map((course) => {
          const next = data?.assignments.filter((assignment) => assignment.courseId === course.id && assignment.status !== "completed").sort((a,b) => +new Date(a.dueAt)-+new Date(b.dueAt))[0];
          return (
          <article className="course-card" key={course.code}>
            <div className="course-card-top" style={{ background: `${course.color}16` }}><span className="course-symbol" style={{ color: course.color, borderColor: `${course.color}40` }}>{course.code.split(" ")[0]}</span><button><MoreHorizontal size={19} /></button></div>
            <div className="course-body"><span className="code" style={{ color: course.color }}>{course.code}</span><h2>{course.name}</h2><p>Semester 3 · {course.credits} credits</p><div className="course-progress"><span><strong>{course.progress}%</strong> complete</span><div><i style={{ background: course.color, width: `${course.progress}%` }} /></div></div><div className="next-up"><span><small>NEXT UP</small><strong>{next?.title || "No upcoming work"}</strong></span><b>{next ? new Date(next.dueAt).toLocaleDateString([], {month:"short",day:"numeric"}) : "Clear"}</b></div></div>
          </article>
        )})}
      </div>
    </div>
  );
}

function AssignmentsView({ openAdd, onChanged }: { openAdd: (mode?: "write"|"upload") => void; onChanged: () => Promise<void> }) {
  const data = useAcademicData();
  const [filter, setFilter] = useState("All");
  const [now] = useState(() => Date.now());
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [deleteError,setDeleteError]=useState("");
  const rows = (data?.assignments ?? []).filter((assignment) => filter === "All" || assignment.status.replace("_"," ") === filter.toLowerCase());
  async function removeAssignment(assignment:AcademicData["assignments"][number]){
    if(deletingId||!window.confirm(`Delete “${assignment.title}”? Its planned calendar sessions will also be removed.`))return;
    setDeletingId(assignment.id);setDeleteError("");
    try{const response=await fetch(`/api/assignments/${assignment.id}`,{method:"DELETE"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to delete assignment");await onChanged();}
    catch(problem){setDeleteError(problem instanceof Error?problem.message:"Unable to delete assignment");}
    finally{setDeletingId(null);}
  }
  return (
    <div className="page assignments-page">
      <div className="page-heading"><div><div className="eyebrow">Semester 3</div><h1>Assignments</h1><p>Plan the work, then work the plan.</p></div><button className="primary-small" onClick={()=>openAdd("write")}><Plus size={17} /> Add assignment</button></div>
      <div className="filter-row"><div>{["All", "In progress", "Not started", "Completed"].map((f) => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}{f === "All" && <b>{data?.assignments.length ?? 0}</b>}</button>)}</div><button className="filter-search"><Search size={16} /> Search assignments</button></div>
      <article className="assignment-list">
        <div className="assignment-head"><span>ASSIGNMENT</span><span>DUE</span><span>WORK LEFT</span><span>PROGRESS</span><span /></div>
        {rows.map((assignment) => {
          const course = data?.courses.find((item) => item.id === assignment.courseId);
          const remaining = Math.max(0,Math.round(assignment.estimatedMinutes*(1-assignment.progress/100))-assignment.actualMinutes);
          return (
          <div className="assignment-row" key={assignment.id}>
            <div className="assignment-name"><i style={{ background: course?.color || "#6258df" }} /><span><strong>{assignment.title}</strong><small>{course?.name || "Course"}</small></span></div>
            <div><strong>{new Date(assignment.dueAt).toLocaleDateString([], {month:"short",day:"numeric"})}</strong><small>{Math.max(0,Math.ceil((+new Date(assignment.dueAt)-now)/86400000))} days</small></div>
            <div><strong>{Math.floor(remaining/60)}h {remaining%60}m</strong><small>estimated</small></div>
            <div className="table-progress"><span><i style={{ width: `${assignment.progress}%`, background: course?.color || "#6258df" }} /></span><b>{assignment.progress}%</b></div>
            <button className="task-delete assignment-delete" type="button" disabled={deletingId===assignment.id} onClick={()=>void removeAssignment(assignment)} aria-label={`Delete ${assignment.title}`} title="Delete assignment"><Trash2 size={15}/></button>
          </div>
        )})}
        {deleteError&&<div className="assignment-delete-error" role="alert">{deleteError}</div>}
      </article>
      <div className="upload-card"><div className="upload-icon"><Upload size={20} /></div><div><strong>Drop in an assignment brief</strong><p>Upload a PDF and Alma will extract the requirements, estimate the work, and propose a plan.</p></div><button onClick={()=>openAdd("upload")}>Choose PDF</button></div>
    </div>
  );
}

function NotesView({ onChanged }: { onChanged: () => Promise<void> }) {
  const data = useAcademicData();
  const notes = data?.notes ?? [];
  const [selectedId,setSelectedId]=useState<string|null>(()=>notes[0]?.id||null);
  const [query,setQuery]=useState("");
  const [title,setTitle]=useState(()=>notes[0]?.title||"");
  const [content,setContent]=useState(()=>notes[0]?.content||"");
  const [courseId,setCourseId]=useState<string>(()=>notes[0]?.courseId||"");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const selected=notes.find((note)=>note.id===selectedId) || notes[0] || null;

  const filtered=notes.filter((note)=>`${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  async function createNote(){const response=await fetch("/api/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Untitled note",courseId:data?.courses[0]?.id||null})});const result=await response.json();await onChanged();setSelectedId(result.id);setTitle("Untitled note");setContent("");}
  async function saveNote(){if(!selectedId)return;setSaving(true);setSaved(false);await fetch(`/api/notes/${selectedId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,content,courseId:courseId||null})});await onChanged();setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),1600);}
  async function deleteNote(){if(!selectedId)return;await fetch(`/api/notes/${selectedId}`,{method:"DELETE"});setSelectedId(null);await onChanged();}
  async function togglePin(){if(!selected)return;await fetch(`/api/notes/${selected.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({pinned:!selected.pinned})});await onChanged();}
  function choose(note:Note){setSelectedId(note.id);setTitle(note.title);setContent(note.content);setCourseId(note.courseId||"");}

  return <div className="page notes-page">
    <div className="page-heading"><div><div className="eyebrow">Knowledge base</div><h1>Course notes</h1><p>Write, organize, and give Alma the context behind your coursework.</p></div><button className="primary-small" onClick={createNote}><Plus size={17}/> New note</button></div>
    <section className="notes-workspace">
      <aside className="notes-list">
        <div className="notes-search"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search notes..."/></div>
        <div className="notes-count">{filtered.length} NOTES</div>
        {filtered.map((note)=>{const course=data?.courses.find((item)=>item.id===note.courseId);return <button key={note.id} className={selected?.id===note.id?"active":""} onClick={()=>choose(note)}><div><strong>{note.title}</strong>{note.pinned&&<Pin size={12}/>}</div><p>{note.content.replace(/[#*]/g,"").slice(0,90)||"Empty note"}</p><span><i style={{background:course?.color||"#a2a5ad"}}/>{course?.code||"GENERAL"}<time>{new Date(note.updatedAt).toLocaleDateString([],{month:"short",day:"numeric"})}</time></span></button>})}
      </aside>
      <article className="note-editor">
        {selected ? <>
          <div className="note-toolbar"><select value={courseId} onChange={(event)=>setCourseId(event.target.value)}><option value="">General</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select><span><Sparkles size={14}/> Included in Alma context</span><button onClick={togglePin} className={selected.pinned?"active":""} aria-label="Pin note"><Pin size={17}/></button><button onClick={deleteNote} aria-label="Delete note"><Trash2 size={17}/></button><button className="save-note" onClick={saveNote}><Save size={16}/>{saving?"Saving...":saved?"Saved":"Save"}</button></div>
          <input className="note-title-input" value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Note title"/>
          <textarea className="note-content-input" value={content} onChange={(event)=>setContent(event.target.value)} placeholder="Start writing. Use # headings, bullet points, formulas, questions..."/>
          <div className="note-status"><span>{content.trim().split(/\s+/).filter(Boolean).length} words</span><span>Markdown supported</span></div>
        </>:<div className="empty-note"><NotebookPen size={32}/><h2>Your notes live here</h2><p>Create a note and connect it to a course. Alma will use it when helping you plan.</p><button onClick={createNote}><Plus size={16}/> Create first note</button></div>}
      </article>
    </section>
  </div>;
}

function ProgressView({openGrade}:{openGrade:()=>void}) {
  const data = useAcademicData();
  const bars = [62,74,55,83,69,91,78];
  const courseRows = data?.courses ?? [];
  return (
    <div className="page progress-page">
      <div className="page-heading"><div><div className="eyebrow">Semester 3</div><h1>Progress</h1><p>A clear view of your effort, consistency, and results.</p></div><div className="heading-actions"><button className="period-select">This semester <ChevronDown size={16} /></button><button className="primary-small" onClick={openGrade}><Plus size={17}/> Add score</button></div></div>
      <section className="progress-metrics"><article><small>CURRENT GPA</small><strong>3.72</strong><span className="up">↗ 0.14</span><p>from last semester</p></article><article><small>FOCUS HOURS</small><strong>42.5</strong><span className="up">↗ 12%</span><p>this semester</p></article><article><small>ON-TIME RATE</small><strong>91%</strong><span className="up">↗ 6%</span><p>14 of 15 submitted</p></article></section>
      <section className="progress-grid">
        <article className="panel chart-panel"><div className="panel-head"><div><h2>Focus consistency</h2><p>Planned time completed each week</p></div><span className="legend"><i /> Completion rate</span></div><div className="bar-chart">{bars.map((b,i) => <div key={i}><span>{b}%</span><i style={{ height: `${b}%` }} /><small>W{i+1}</small></div>)}</div></article>
        <article className="panel grade-panel"><div className="panel-head"><div><h2>Course standing</h2><p>Current weighted scores</p></div></div>{courseRows.map((course) => { const courseGrades=data?.grades.filter((grade)=>grade.courseId===course.id)??[];const earned=courseGrades.reduce((sum,grade)=>sum+grade.score/grade.maxScore*100*(grade.weight||1),0);const weights=courseGrades.reduce((sum,grade)=>sum+(grade.weight||1),0);const score=weights?Math.round(earned/weights):0;return <div className="grade-row" key={course.code}><i style={{ background: course.color }} /><span><strong>{course.name}</strong><small>{course.code}</small></span><div><b>{score || "—"}{score ? "%" : ""}</b><em>{score>=90?"A":score>=80?"B":score>=70?"C":"—"}</em></div></div>})}</article>
      </section>
    </div>
  );
}

type AssignmentDraft={title:string;description:string;courseId:string;dueAt:string;estimatedMinutes:number;priority:"low"|"medium"|"high";confidence:number;subtasks:Array<{title:string;estimatedMinutes:number}>};
type PlannerPlan={planId:string;action:"answer"|"rebuild_schedule"|"workspace_update"|"clarification";message:string;changes:PlanChange[];atRisk:string[];appliedActions?:Array<{kind:string;id:string;summary:string}>;aiUsed:boolean;accepted?:boolean};
type ChatEntry={id:string;role:"user"|"assistant";text:string;createdAt:string;attachmentName?:string;aiUsed?:boolean;error?:boolean;plan?:PlannerPlan;assignment?:{draft:AssignmentDraft;saved?:boolean}};
type ChatThread={id:string;title:string;entries:ChatEntry[];createdAt:string;updatedAt:string};
const EMPTY_CHAT_ENTRIES:ChatEntry[]=[];

const CHAT_STORAGE_KEY="alma-planner-conversations-v3";
const LEGACY_CHAT_STORAGE_KEY="alma-planner-conversation-v2";
const makeChatId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
const newChatThread=():ChatThread=>{const now=new Date().toISOString();return{id:makeChatId(),title:"New chat",entries:[],createdAt:now,updatedAt:now};};

type CodexLoginStatus={status:"disconnected"|"pending"|"connected"|"error";connected:boolean;verificationUrl?:string;userCode?:string;message:string;model:string};

function ChatGPTAuthModal({onClose,onChanged}:{onClose:()=>void;onChanged:()=>Promise<void>}){
  const data=useAcademicData();
  const [status,setStatus]=useState<CodexLoginStatus>({status:data?.aiConfigured?"connected":"disconnected",connected:Boolean(data?.aiConfigured),message:data?.aiAuthMessage||"Connect your ChatGPT account to use Codex in Alma.",model:data?.aiModel||"gpt-5.6-luna"});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const authOpened=useRef(false);
  useEffect(()=>{if(status.status!=="pending")return;const timer=setInterval(async()=>{try{const response=await fetch("/api/auth/codex",{cache:"no-store"});const result=await response.json();if(!response.ok)return;setStatus(result);if(result.connected)await onChanged();}catch{}},2000);return()=>clearInterval(timer);},[status.status,onChanged]);
  useEffect(()=>{if(status.verificationUrl&&!authOpened.current){authOpened.current=true;const authWindow=window.open(status.verificationUrl,"_blank","noopener,noreferrer");if(!authWindow)window.location.assign(status.verificationUrl);}},[status.verificationUrl]);
  async function connect(){setLoading(true);setError("");authOpened.current=false;try{const response=await fetch("/api/auth/codex",{method:"POST"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to start ChatGPT sign-in");setStatus(result);}catch(problem){setError(problem instanceof Error?problem.message:"Unable to start ChatGPT sign-in");}finally{setLoading(false);}}
  async function copyCode(){if(!status.userCode)return;await navigator.clipboard.writeText(status.userCode);}
  async function logout(){setLoading(true);setError("");try{const response=await fetch("/api/auth/codex",{method:"DELETE"});if(!response.ok)throw new Error("Unable to disconnect ChatGPT");setStatus({status:"disconnected",connected:false,message:"ChatGPT disconnected from this browser.",model:data?.aiModel||"gpt-5.6-luna"});await onChanged();}catch(problem){setError(problem instanceof Error?problem.message:"Unable to disconnect ChatGPT");}finally{setLoading(false);}}
  return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} aria-label="Close"/><section className="add-modal auth-modal"><div className="modal-head"><div><span className="modal-kicker"><Sparkles size={15}/> CHATGPT</span><h2>{status.connected?"ChatGPT connected":"Login with ChatGPT"}</h2><p>{status.connected?"Alma AI is ready to use.":"Login with ChatGPT to use Alma AI."}</p></div><button onClick={onClose}><X size={20}/></button></div><div className="auth-modal-body">{status.connected?<><div className="auth-success"><Check size={22}/><span><strong>Connected with ChatGPT</strong><small>Using {status.model} · low reasoning</small></span></div><button className="auth-logout" onClick={logout} disabled={loading}><LogOut size={16}/>{loading?"Disconnecting…":"Disconnect ChatGPT"}</button></>:status.verificationUrl?<>{status.userCode&&<div className="device-code"><small>ONE-TIME CODE</small><strong>{status.userCode}</strong><button onClick={copyCode}><Copy size={15}/> Copy code</button></div>}<a className="auth-open" href={status.verificationUrl} target="_blank" rel="noreferrer">Continue with ChatGPT <ExternalLink size={16}/></a><small className="auth-waiting">Waiting for authorization…</small></>:<><button className="auth-connect" onClick={connect} disabled={loading}>{loading?"Starting sign-in…":status.status==="error"?"Try login again":"Login with ChatGPT"}<ArrowRight size={16}/></button>{status.status==="error"&&<div className="form-error">{status.message}</div>}</>}{error&&<div className="form-error">{error}</div>}</div></section></div>;
}

function PlannerDrawer({ open, onClose, onChanged, onLogin }: { open: boolean; onClose: () => void; onChanged: () => Promise<void>; onLogin: () => void }) {
  const data=useAcademicData();
  const [message,setMessage]=useState("");
  const [attachment,setAttachment]=useState<File|null>(null);
  const [threads,setThreads]=useState<ChatThread[]>([]);
  const [activeThreadId,setActiveThreadId]=useState("");
  const [hydrated,setHydrated]=useState(false);
  const [loading,setLoading]=useState(false);
  const [savingId,setSavingId]=useState<string|null>(null);
  const [composerError,setComposerError]=useState("");
  const [dragging,setDragging]=useState(false);
  const chatBody=useRef<HTMLDivElement>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const formRef=useRef<HTMLFormElement>(null);

  const activeThread=useMemo(()=>threads.find(thread=>thread.id===activeThreadId)||threads[0],[threads,activeThreadId]);
  const entries=useMemo(()=>activeThread?.entries||EMPTY_CHAT_ENTRIES,[activeThread]);
  function setEntries(update:ChatEntry[]|((current:ChatEntry[])=>ChatEntry[])){setThreads(current=>current.map(thread=>thread.id!==activeThread?.id?thread:{...thread,entries:typeof update==="function"?update(thread.entries):update,updatedAt:new Date().toISOString()}));}
  useEffect(()=>{try{const stored=localStorage.getItem(CHAT_STORAGE_KEY);if(stored){const parsed=JSON.parse(stored) as {threads?:ChatThread[];activeThreadId?:string};if(Array.isArray(parsed.threads)&&parsed.threads.length){setThreads(parsed.threads);setActiveThreadId(parsed.activeThreadId||parsed.threads[0].id);}else throw new Error("Invalid saved chats");}else{const legacy=localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);const thread=newChatThread();if(legacy)thread.entries=JSON.parse(legacy) as ChatEntry[];setThreads([thread]);setActiveThreadId(thread.id);}}catch{const thread=newChatThread();setThreads([thread]);setActiveThreadId(thread.id);}finally{setHydrated(true);}},[]);
  useEffect(()=>{if(hydrated&&threads.length)localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify({threads,activeThreadId}));},[threads,activeThreadId,hydrated]);
  useEffect(()=>{if(!open)return;requestAnimationFrame(()=>chatBody.current?.scrollTo({top:chatBody.current.scrollHeight,behavior:"smooth"}));},[entries,loading,open]);

  function chooseAttachment(file:File|null){
    if(!file)return;
    const extension=file.name.split(".").pop()?.toLowerCase();
    if(!["pdf","txt"].includes(extension||"")){setComposerError("Choose a PDF or plain-text assignment brief.");return;}
    if(file.size>20*1024*1024){setComposerError("Assignment files must be 20 MB or smaller.");return;}
    setAttachment(file);setComposerError("");
  }

  function newChat(){if(loading)return;const thread=newChatThread();setThreads(current=>[thread,...current]);setActiveThreadId(thread.id);setMessage("");setAttachment(null);setComposerError("");}
  function deleteChat(){if(loading||!activeThread)return;if(threads.length===1){setEntries([]);setMessage("");return;}const remaining=threads.filter(thread=>thread.id!==activeThread.id);setThreads(remaining);setActiveThreadId(remaining[0].id);setMessage("");setAttachment(null);setComposerError("");}

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!data?.aiConfigured){setComposerError("Login with ChatGPT to use Alma AI.");onLogin();return;}
    const text=message.trim();
    const file=attachment;
    if((!text&&!file)||loading)return;
    const userEntry:ChatEntry={id:makeChatId(),role:"user",text:text||`Review ${file?.name}`,attachmentName:file?.name,createdAt:new Date().toISOString()};
    const conversation=[...entries,userEntry];
    setEntries(conversation);setMessage("");setAttachment(null);setComposerError("");setLoading(true);
    if(activeThread?.title==="New chat")setThreads(current=>current.map(thread=>thread.id===activeThread.id?{...thread,title:userEntry.text.slice(0,42)||"Assignment review"}:thread));
    if(fileInput.current)fileInput.current.value="";
    try{
      if(file){
        const form=new FormData();form.set("description",text);form.set("file",file);form.set("source","chat");form.set("history",JSON.stringify(entries.slice(-8).map((entry)=>({role:entry.role,text:entry.text}))));
        const response=await fetch("/api/assignments/analyze",{method:"POST",body:form});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Unable to read that assignment");
        const draft={...result.extraction,dueAt:(result.extraction.dueAt||new Date(Date.now()+7*86400000).toISOString()).slice(0,16)} as AssignmentDraft;
        setEntries(current=>[...current,{id:makeChatId(),role:"assistant",text:`I read ${file.name} and turned it into a structured assignment. Review the details below, then save it to your workspace.`,createdAt:new Date().toISOString(),aiUsed:result.aiUsed,assignment:{draft}}]);
      }else{
        const history=entries.slice(-8).map((entry)=>({role:entry.role,text:entry.text}));
        const response=await fetch("/api/planner",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,history})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Unable to respond");
        setEntries(current=>[...current,{id:makeChatId(),role:"assistant",text:result.message,createdAt:new Date().toISOString(),aiUsed:result.aiUsed,plan:result.changes.length?result:undefined}]);
        if(result.appliedActions?.length)await onChanged();
      }
    }catch(problem){
      setEntries(current=>[...current,{id:makeChatId(),role:"assistant",text:problem instanceof Error?problem.message:"Something went wrong. Please try again.",createdAt:new Date().toISOString(),error:true}]);
    }finally{setLoading(false);}
  }

  async function acceptPlan(entryId:string,plan:PlannerPlan){
    setSavingId(entryId);
    try{const response=await fetch("/api/planner/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:plan.planId,changes:plan.changes})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to apply plan");setEntries(current=>current.map(entry=>entry.id===entryId&&entry.plan?{...entry,plan:{...entry.plan,accepted:true}}:entry));await onChanged();}
    catch(problem){setComposerError(problem instanceof Error?problem.message:"Unable to apply plan");}
    finally{setSavingId(null);}
  }

  async function saveAssignment(entryId:string,draft:AssignmentDraft){
    setSavingId(entryId);
    try{const response=await fetch("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,dueAt:new Date(draft.dueAt).toISOString()})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save assignment");setEntries(current=>current.map(entry=>entry.id===entryId&&entry.assignment?{...entry,assignment:{...entry.assignment,saved:true},text:`${entry.assignment.draft.title} is now saved. I’ll include it in future planning.`}:entry));await onChanged();}
    catch(problem){setComposerError(problem instanceof Error?problem.message:"Unable to save assignment");}
    finally{setSavingId(null);}
  }

  function clearConversation(){setEntries([]);setMessage("");setAttachment(null);setComposerError("");}

  return <>
    {open&&<button className="drawer-scrim" aria-label="Close planner" onClick={onClose}/>}
    <aside className={`planner-drawer ${open?"open":""}`} aria-label="Alma planner">
      <div className="drawer-head"><div className="alma-orb"><Sparkles size={19}/></div><div><strong>Alma</strong><span><i className={data?.aiConfigured?"":"offline"}/>{data?.aiConfigured?`Your ChatGPT · ${data.aiModel||"Codex"}`:"Login with ChatGPT to use Alma AI"}</span></div><button onClick={newChat} disabled={loading} aria-label="New chat" title="New chat"><Plus size={17}/></button>{entries.length>0&&<button onClick={clearConversation} disabled={loading} aria-label="Clear conversation" title="Clear conversation"><Trash2 size={17}/></button>}<button onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div className="chat-threadbar"><select aria-label="Choose chat" value={activeThread?.id||""} onChange={event=>{setActiveThreadId(event.target.value);setMessage("");setAttachment(null);setComposerError("");}} disabled={loading}>{threads.map(thread=><option key={thread.id} value={thread.id}>{thread.title}</option>)}</select><button onClick={deleteChat} disabled={loading} aria-label="Delete chat" title="Delete chat"><Trash2 size={15}/></button></div>
      <div className="chat-body" ref={chatBody}>
        <div className="chat-date">TODAY</div>
        <div className="assistant-message"><p>Hi Shaurya — ask me to add, edit, complete, move, or delete assignments, tasks, and calendar events. I can also plan your workload.</p></div>
        {entries.length===0&&<div className="suggestions"><button onClick={()=>setMessage("Add a task to email my tutor tomorrow")}>Add a task</button><button onClick={()=>setMessage("Add football practice tomorrow from 5:30 to 7 PM")}>Add a calendar event</button><button onClick={()=>setMessage("What should I focus on this week?")}>Plan my week</button><button onClick={()=>fileInput.current?.click()}><Paperclip size={13}/> Upload an assignment brief</button></div>}
        {entries.map(entry=><div className={`chat-entry ${entry.role}`} key={entry.id}>
          {entry.role==="user"?<div className="user-message">{entry.attachmentName&&<span className="message-attachment"><FileText size={14}/>{entry.attachmentName}</span>}{entry.text&&<p>{entry.text}</p>}</div>:<>
            <div className={`assistant-message ${entry.error?"error":""}`}><p>{entry.text}</p>{!entry.error&&<small>Codex · academic context included</small>}</div>
            {entry.assignment&&<article className={`assignment-preview ${entry.assignment.saved?"saved":""}`}><div className="assignment-preview-head"><span><FileText size={16}/> ASSIGNMENT BRIEF</span><b>{entry.assignment.saved?"Saved":`${Math.round(entry.assignment.draft.confidence*100)}% confidence`}</b></div><div className="assignment-preview-body"><span className="course-pill">{data?.courses.find(course=>course.id===entry.assignment?.draft.courseId)?.code||"COURSE"}</span><h3>{entry.assignment.draft.title}</h3><p>{entry.assignment.draft.description}</p><div><span><CalendarDays size={14}/>{new Date(entry.assignment.draft.dueAt).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span><span><Clock3 size={14}/>{Math.round(entry.assignment.draft.estimatedMinutes/60*10)/10}h estimated</span></div><ul>{entry.assignment.draft.subtasks.slice(0,4).map((subtask,index)=><li key={`${subtask.title}-${index}`}><i>{index+1}</i><span>{subtask.title}</span><b>{subtask.estimatedMinutes}m</b></li>)}</ul></div>{!entry.assignment.saved&&<div className="preview-actions"><button onClick={()=>saveAssignment(entry.id,entry.assignment!.draft)} disabled={savingId===entry.id}>{savingId===entry.id?"Saving...":"Save assignment"}<Check size={15}/></button></div>}</article>}
            {entry.plan&&<article className={`plan-preview ${entry.plan.accepted?"accepted":""}`}><div className="plan-title"><span><Sparkles size={16}/> PROPOSED PLAN</span><b>{entry.plan.accepted?"Applied":`${entry.plan.changes.length} sessions`}</b></div>{entry.plan.changes.slice(0,8).map(change=><div className="plan-change" key={change.id}><span className="change-icon add">+</span><div><strong>{change.title}</strong><small>{new Date(change.startAt).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} · {Math.round((+new Date(change.endAt)-+new Date(change.startAt))/60000)}m</small></div></div>)}<div className="plan-note"><Check size={15}/>{entry.plan.atRisk.length?`${entry.plan.atRisk.length} item(s) still need attention: ${entry.plan.atRisk.join(", ")}`:"The proposed work fits around every fixed commitment."}</div>{!entry.plan.accepted&&<div className="plan-actions"><button onClick={()=>acceptPlan(entry.id,entry.plan!)} disabled={savingId===entry.id}>{savingId===entry.id?"Applying...":"Accept plan"}</button><button onClick={()=>setMessage("Adjust that plan: make it lighter and keep more evening time free.")}>Adjust</button></div>}</article>}
          </>}
        </div>)}
        {loading&&<div className="planner-loading"><Sparkles size={18}/><strong>{attachment?"Reading your assignment...":"Thinking across your academic context..."}</strong><span>{attachment?"Extracting requirements, deadline, and workload.":"Checking deadlines, notes, workload, and commitments."}</span></div>}
      </div>
      <form ref={formRef} className={`chat-input ${dragging?"dragging":""}`} onSubmit={submit} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);chooseAttachment(event.dataTransfer.files[0]||null);}}>
        <input ref={fileInput} hidden type="file" accept="application/pdf,.pdf,text/plain,.txt" onChange={event=>chooseAttachment(event.target.files?.[0]||null)}/>
        {attachment&&<div className="composer-attachment"><FileText size={15}/><span><strong>{attachment.name}</strong><small>{Math.max(1,Math.round(attachment.size/1024))} KB</small></span><button type="button" onClick={()=>{setAttachment(null);if(fileInput.current)fileInput.current.value="";}} aria-label="Remove attachment"><X size={15}/></button></div>}
        {composerError&&<div className="composer-error">{composerError}<button type="button" onClick={()=>setComposerError("")}><X size={13}/></button></div>}
        <textarea value={message} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();formRef.current?.requestSubmit();}}} placeholder={attachment?"Add instructions for this assignment...":"Try “Move football to Friday at 6 PM”..."} rows={3}/>
        <div><button type="button" onClick={()=>fileInput.current?.click()} aria-label="Attach assignment" title="Attach PDF or text"><Paperclip size={18}/></button><span>Enter to send · Shift+Enter for a new line</span><button className="send-button" type="submit" aria-label="Send" disabled={loading||(!message.trim()&&!attachment)}>{loading?<span className="send-spinner"/>:<Send size={17}/>}</button></div>
      </form>
    </aside>
  </>;
}

function AddAssignmentModal({ open, initialMode, onClose, onChanged }: { open: boolean; initialMode: "write"|"upload"; onClose: () => void; onChanged: () => Promise<void> }) {
  const data=useAcademicData();
  const [mode, setMode] = useState<"write" | "upload">(initialMode);
  const [description,setDescription]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [draft,setDraft]=useState<AssignmentDraft|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [aiUsed,setAiUsed]=useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  async function analyze(){if(!description.trim()&&!file){setError("Describe the assignment or choose a PDF first.");return;}setLoading(true);setError("");const form=new FormData();form.set("description",description);if(file)form.set("file",file);try{const response=await fetch("/api/assignments/analyze",{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Analysis failed");setDraft({...result.extraction,dueAt:(result.extraction.dueAt||new Date(Date.now()+7*86400000).toISOString()).slice(0,16)});setAiUsed(result.aiUsed);}catch(problem){setError(problem instanceof Error?problem.message:"Analysis failed");}finally{setLoading(false);}}
  async function confirm(){if(!draft)return;setLoading(true);setError("");try{const response=await fetch("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,dueAt:new Date(draft.dueAt).toISOString()})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save assignment");setSaved(true);await onChanged();}catch(problem){setError(problem instanceof Error?problem.message:"Unable to save assignment");}finally{setLoading(false);}}
  function close(){setSaved(false);setDraft(null);setDescription("");setFile(null);setError("");onClose();}
  if (!open) return null;
  return <div className="modal-wrap"><button className="modal-scrim" onClick={close} aria-label="Close" /><section className="add-modal"><div className="modal-head"><div><span className="modal-kicker"><Sparkles size={15} /> SMART CAPTURE</span><h2>{draft?"Review the plan":"Add an assignment"}</h2><p>{draft?"Confirm what Alma extracted before it enters your schedule.":"Share what you know. Alma will structure the rest."}</p></div><button onClick={close}><X size={20} /></button></div>{saved ? <div className="saved-state"><span><Check size={28} /></span><h3>Assignment saved</h3><p>Its subtasks and workload are now part of your academic context. Ask Alma to rebuild your schedule.</p><button onClick={close}>Done</button></div> : draft ? <div className="review-draft"><div className="draft-badge"><Sparkles size={14}/>{aiUsed?"Extracted with Codex OAuth":"Structured with Alma fallback"} · {Math.round(draft.confidence*100)}% confidence</div><label>Title<input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label><div className="draft-grid"><label>Course<select value={draft.courseId} onChange={(e)=>setDraft({...draft,courseId:e.target.value})}>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select></label><label>Deadline<input type="datetime-local" value={draft.dueAt} onChange={(e)=>setDraft({...draft,dueAt:e.target.value})}/></label><label>Estimated hours<input type="number" min="0.5" step="0.5" value={draft.estimatedMinutes/60} onChange={(e)=>setDraft({...draft,estimatedMinutes:Number(e.target.value)*60})}/></label><label>Priority<select value={draft.priority} onChange={(e)=>setDraft({...draft,priority:e.target.value as AssignmentDraft["priority"]})}><option>low</option><option>medium</option><option>high</option></select></label></div><label>Description<textarea rows={3} value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})}/></label><div className="draft-subtasks"><strong>Suggested subtasks</strong>{draft.subtasks.map((subtask,index)=><div key={index}><span>{index+1}</span><input value={subtask.title} onChange={(e)=>setDraft({...draft,subtasks:draft.subtasks.map((item,i)=>i===index?{...item,title:e.target.value}:item)})}/><b>{subtask.estimatedMinutes}m</b></div>)}</div><div className="modal-footer"><button className="cancel" onClick={()=>setDraft(null)}>Back</button><button className="capture" onClick={confirm} disabled={loading}>{loading?"Saving...":"Save assignment"}<Check size={16}/></button></div></div> : <><div className="capture-tabs"><button className={mode === "write" ? "active" : ""} onClick={() => setMode("write")}><FileText size={17} /> Describe it</button><button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}><Upload size={17} /> Upload PDF</button></div>{mode === "write" ? <div className="capture-form"><label>What’s the assignment?<textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="e.g. Economics essay on monetary policy, 2,000 words, due Monday at 11:59 PM..." rows={6} /></label><div className="capture-hint"><Sparkles size={15} /><span>You can write naturally. Alma will use your courses and current date to understand the request.</span></div></div> : <div className="drop-zone" onClick={()=>fileInput.current?.click()}><input ref={fileInput} type="file" accept="application/pdf,.pdf,text/plain,.txt" hidden onChange={(e)=>setFile(e.target.files?.[0]||null)}/><span><Upload size={23} /></span><strong>{file?.name||"Choose an assignment brief"}</strong><p>{file?`${Math.round(file.size/1024)} KB selected`:"PDF or text · up to 20 MB"}</p><button type="button">Choose file</button></div>}{error&&<div className="form-error">{error}</div>}<div className="modal-footer"><button className="cancel" onClick={close}>Cancel</button><button className="capture" onClick={analyze} disabled={loading}>{loading?"Analyzing...":"Analyze & continue"}<ArrowRight size={16}/></button></div></>}</section></div>;
}

type RecordKind="course"|"event"|"grade";
function RecordModal({kind,open,onClose,onChanged}:{kind:RecordKind;open:boolean;onClose:()=>void;onChanged:()=>Promise<void>}){
  const data=useAcademicData();
  const [form,setForm]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  if(!open)return null;
  const label=kind==="course"?"course":kind==="event"?"calendar event":"score";
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");const endpoint=kind==="grade"?"grades":kind==="event"?"events":"courses";const payload=kind==="course"?{name:form.name,code:form.code,credits:Number(form.credits||3),color:form.color||"#6258df",semesterId:form.semesterId||"sem-3"}:kind==="event"?{title:form.title,startAt:form.startAt,endAt:form.endAt,type:form.type||"personal",courseId:form.courseId||null}:{title:form.title,courseId:form.courseId,score:Number(form.score),maxScore:Number(form.maxScore||100),weight:Number(form.weight||0)};try{const response=await fetch(`/api/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||`Unable to save ${label}`);await onChanged();setForm({});onClose();}catch(problem){setError(problem instanceof Error?problem.message:`Unable to save ${label}`);}finally{setSaving(false);}}
  return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} aria-label="Close"/><form className="add-modal record-modal" onSubmit={submit}><div className="modal-head"><div><span className="modal-kicker">ACADEMIC WORKSPACE</span><h2>Add {label}</h2><p>This will be saved to your academic record.</p></div><button type="button" onClick={onClose}><X size={20}/></button></div><div className="record-form">{kind==="course"&&<><label>Course name<input required value={form.name||""} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="e.g. Organic Chemistry"/></label><div className="draft-grid"><label>Course code<input required value={form.code||""} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="CHEM 201"/></label><label>Credits<input type="number" min="1" value={form.credits||"3"} onChange={(e)=>setForm({...form,credits:e.target.value})}/></label><label>Semester<select value={form.semesterId||"sem-3"} onChange={(e)=>setForm({...form,semesterId:e.target.value})}>{data?.semesters.map((semester)=><option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label><label>Color<input type="color" value={form.color||"#6258df"} onChange={(e)=>setForm({...form,color:e.target.value})}/></label></div></>}{kind==="event"&&<><label>Event title<input required value={form.title||""} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Football practice"/></label><div className="draft-grid"><label>Starts<input required type="datetime-local" value={form.startAt||""} onChange={(e)=>setForm({...form,startAt:e.target.value})}/></label><label>Ends<input required type="datetime-local" value={form.endAt||""} onChange={(e)=>setForm({...form,endAt:e.target.value})}/></label><label>Type<select value={form.type||"personal"} onChange={(e)=>setForm({...form,type:e.target.value})}><option value="personal">Personal</option><option value="class">Class</option></select></label><label>Course<select value={form.courseId||""} onChange={(e)=>setForm({...form,courseId:e.target.value})}><option value="">No course</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code}</option>)}</select></label></div></>}{kind==="grade"&&<><label>Score title<input required value={form.title||""} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Midterm exam"/></label><div className="draft-grid"><label>Course<select required value={form.courseId||""} onChange={(e)=>setForm({...form,courseId:e.target.value})}><option value="">Choose a course</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select></label><label>Score<input required type="number" step="0.1" value={form.score||""} onChange={(e)=>setForm({...form,score:e.target.value})}/></label><label>Out of<input type="number" value={form.maxScore||"100"} onChange={(e)=>setForm({...form,maxScore:e.target.value})}/></label><label>Weight %<input type="number" min="0" max="100" value={form.weight||"0"} onChange={(e)=>setForm({...form,weight:e.target.value})}/></label></div></>}{error&&<div className="form-error">{error}</div>}</div><div className="modal-footer"><button type="button" onClick={onClose}>Cancel</button><button className="capture" type="submit" disabled={saving}>{saving?"Saving...":`Save ${label}`}<Check size={16}/></button></div></form></div>;
}

export default function HomePage() {
  const [view, setView] = useState<View>("Today");
  const [menu, setMenu] = useState(false);
  const [planner, setPlanner] = useState(false);
  const [add, setAdd] = useState<"write"|"upload"|null>(null);
  const [record,setRecord]=useState<RecordKind|null>(null);
  const [auth,setAuth]=useState(false);
  const [data,setData]=useState<AcademicData|null>(null);
  const [loadError,setLoadError]=useState("");
  const title = useMemo(() => view, [view]);
  async function refresh(){const response=await fetch("/api/data",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to load your workspace");setData(result);}
  useEffect(()=>{fetch("/api/data",{cache:"no-store"}).then(async(response)=>{const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to load your workspace");setData(result);}).catch((error)=>setLoadError(error instanceof Error?error.message:"Unable to load your workspace"));},[]);
  if(loadError)return <div className="fatal-state"><Brand/><h1>Alma couldn’t open your workspace.</h1><p>{loadError}</p><button onClick={()=>location.reload()}>Try again</button></div>;
  if(!data)return <div className="app-loading"><Brand/><span/><p>Opening your academic workspace...</p></div>;
  return (
    <DataContext.Provider value={data}><div className="app-shell">
      <Sidebar view={view} setView={setView} open={menu} close={() => setMenu(false)} />
      <div className="main-shell">
        <Topbar title={title} openMenu={() => setMenu(true)} openPlanner={() => setPlanner(true)} openAdd={() => setAdd("write")} openAuth={()=>setAuth(true)} aiConfigured={data.aiConfigured}/>
        {!data.aiConfigured&&<div className="ai-config-banner"><Sparkles size={15}/><span><strong>Connect your own ChatGPT.</strong> Alma will use your Codex access—not the machine owner’s account.</span><button onClick={()=>setAuth(true)}>Connect ChatGPT</button></div>}
        <main>
          {view === "Today" && <TodayView openPlanner={() => setPlanner(true)} onChanged={refresh} />}
          {view === "Calendar" && <CalendarView openEvent={()=>setRecord("event")} />}
          {view === "Courses" && <CoursesView openCourse={()=>setRecord("course")} />}
          {view === "Assignments" && <AssignmentsView openAdd={(mode="write") => setAdd(mode)} onChanged={refresh} />}
          {view === "Notes" && <NotesView onChanged={refresh} />}
          {view === "Progress" && <ProgressView openGrade={()=>setRecord("grade")} />}
        </main>
      </div>
      <button className="mobile-ai" onClick={() => setPlanner(true)} aria-label="Ask Alma"><Sparkles size={20} /></button>
      <PlannerDrawer open={planner} onClose={() => setPlanner(false)} onChanged={refresh} onLogin={()=>setAuth(true)} />
      <AddAssignmentModal key={add||"closed"} open={Boolean(add)} initialMode={add||"write"} onClose={() => setAdd(null)} onChanged={refresh} />
      <RecordModal kind={record||"course"} open={Boolean(record)} onClose={()=>setRecord(null)} onChanged={refresh}/>
      {auth&&<ChatGPTAuthModal onClose={()=>setAuth(false)} onChanged={refresh}/>}
    </div></DataContext.Provider>
  );
}
