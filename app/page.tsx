"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  NotebookPen,
  Paperclip,
  Pin,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { createContext, FormEvent, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AcademicData, Memory, Note, PlanChange } from "@/lib/types";

type View = "Today" | "Calendar" | "Courses" | "Assignments" | "Notes" | "Memory" | "Progress";

const DataContext = createContext<AcademicData | null>(null);
const useAcademicData = () => useContext(DataContext);

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
  const today = new Date().toISOString().slice(0, 10);
  const currentTerm = data?.semesters.find((semester) => semester.startDate <= today && semester.endDate >= today)
    ?? [...(data?.semesters ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const nav: { label: View; icon: typeof Home }[] = [
    { label: "Today", icon: Home },
    { label: "Calendar", icon: CalendarDays },
    { label: "Courses", icon: BookOpen },
    { label: "Assignments", icon: LayoutList },
    { label: "Notes", icon: NotebookPen },
    { label: "Memory", icon: Brain },
    { label: "Progress", icon: BarChart3 },
  ];
  return (
    <>
      {open && <button className="scrim" aria-label="Close menu" onClick={close} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-top"><Brand /><button className="close-menu" onClick={close} aria-label="Close menu"><X size={20} /></button></div>
        <button className="term-select" onClick={() => { setView("Courses"); close(); }} aria-label="Open course and term setup">
          <span><small>{currentTerm ? "CURRENT TERM" : "ACADEMIC SETUP"}</small><strong>{currentTerm?.name ?? "Set up your term"}</strong></span><ChevronDown size={16} />
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={view === label ? "active" : ""} aria-current={view === label ? "page" : undefined} onClick={() => { setView(label); close(); }}>
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
          <div className="profile"><div className="avatar"><BookOpen size={17}/></div><span><strong>Personal workspace</strong><small>Saved on this device</small></span></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, openMenu, openPlanner, openTask, openAuth, aiConfigured }: { title: string; openMenu: () => void; openPlanner: () => void; openTask: () => void; openAuth: () => void; aiConfigured: boolean }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={openMenu} aria-label="Open menu"><Menu size={21} /></button>
      <div className="mobile-brand"><Brand /></div>
      <div className="breadcrumbs"><span>Alma</span><ChevronRight size={14} /><strong>{title}</strong></div>
      <div className="top-actions">
        <button className={`auth-top ${aiConfigured?"connected":""}`} onClick={openAuth} aria-label={aiConfigured ? "Codex is connected through ChatGPT. Manage connection" : "Connect ChatGPT to enable Codex"} title={aiConfigured ? "Codex connected through ChatGPT" : "Connect ChatGPT to enable Codex"}><LogIn size={16}/><span>{aiConfigured?"Codex ready":"Connect ChatGPT"}</span></button>
        <button className="ai-top" onClick={openPlanner}><Sparkles size={17} /> Ask Alma</button>
        <button className="add-top" onClick={openTask}><Plus size={18} /><span>Add task</span></button>
      </div>
    </header>
  );
}

function TodayView({ openPlanner, openTask, onChanged, onViewCalendar }: { openPlanner: () => void; openTask:()=>void; onChanged: () => Promise<void>; onViewCalendar: () => void }) {
  const data = useAcademicData();
  const [now] = useState(() => Date.now());
  const [busyTaskId,setBusyTaskId]=useState<string|null>(null);
  const [busySessionId,setBusySessionId]=useState<string|null>(null);
  const [taskError,setTaskError]=useState("");
  const [sessionError,setSessionError]=useState("");
  const currentDate = useMemo(() => new Date(now).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }), [now]);
  const greeting = new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 18 ? "Good afternoon" : "Good evening";
  const openAssignments = data?.assignments.filter((assignment) => assignment.status !== "completed") ?? [];
  const weekEnd = now + 7 * 86400000;
  const dueThisWeek = openAssignments.filter((assignment) => +new Date(assignment.dueAt) >= now && +new Date(assignment.dueAt) <= weekEnd);
  const remainingMinutes = openAssignments.reduce((total, assignment) => total + Math.max(0, Math.round(assignment.estimatedMinutes * (1 - assignment.progress / 100)) - assignment.actualMinutes), 0);
  const todaySessions = data?.studySessions.filter((session) => session.status === "planned" && new Date(session.startAt).toDateString() === new Date(now).toDateString()) ?? [];
  const focusMinutesToday = todaySessions.reduce((sum, session) => sum + (+new Date(session.endAt) - +new Date(session.startAt)) / 60000, 0);
  async function toggleTask(task:AcademicData["tasks"][number]){
    if(busyTaskId)return;
    setBusyTaskId(task.id);setTaskError("");
    try{const response=await fetch(`/api/tasks/${task.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:task.status==="completed"?"pending":"completed"})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to update task");await onChanged();}
    catch(problem){setTaskError(problem instanceof Error?problem.message:"Unable to update task");}
    finally{setBusyTaskId(null);}
  }
  async function completeSession(sessionId:string){
    if(busySessionId)return;
    setBusySessionId(sessionId);setSessionError("");
    try{const response=await fetch("/api/study-sessions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:sessionId})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to complete session");await onChanged();}
    catch(problem){setSessionError(problem instanceof Error?problem.message:"Unable to complete session");}
    finally{setBusySessionId(null);}
  }
  async function removeTask(task:AcademicData["tasks"][number]){
    if(busyTaskId||!window.confirm(`Delete “${task.title}”? This cannot be undone.`))return;
    setBusyTaskId(task.id);setTaskError("");
    try{const response=await fetch(`/api/tasks/${task.id}`,{method:"DELETE"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to delete task");await onChanged();}
    catch(problem){setTaskError(problem instanceof Error?problem.message:"Unable to delete task");}
    finally{setBusyTaskId(null);}
  }
  const todayItems = useMemo(() => {
    if (!data) return [];
    const events = [
      ...data.events.map((event) => ({ sessionId:null as string|null,sessionStatus:null as string|null,startAt:event.startAt,endAt:event.endAt,title:event.title,type:event.type === "personal" ? "Personal" : "Class",meta:event.type === "personal" ? "Fixed commitment" : data.courses.find((course) => course.id === event.courseId)?.code || "Course",color:event.type === "personal" ? "blue" : "purple" })),
      ...data.studySessions.map((session) => ({ sessionId:session.id,sessionStatus:session.status,startAt:session.startAt,endAt:session.endAt,title:session.title,type:session.status==="completed"?"Focus completed":"Focus",meta:session.status==="completed"?"Time logged":"Planned by Alma",color:"coral" })),
      ...data.assignments.filter((assignment) => assignment.status !== "completed" && new Date(assignment.dueAt).toDateString() === new Date(now).toDateString()).map((assignment) => ({ sessionId:null as string|null,sessionStatus:null as string|null,startAt:assignment.dueAt,endAt:new Date(+new Date(assignment.dueAt)+15*60000).toISOString(),title:assignment.title,type:"Deadline",meta:data.courses.find((course) => course.id === assignment.courseId)?.code || "Assignment",color:"blue" })),
    ].filter((item) => new Date(item.startAt).toDateString() === new Date(now).toDateString()).sort((a,b) => +new Date(a.startAt)-+new Date(b.startAt));
    return events.map((item) => ({...item,time:new Date(item.startAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),end:new Date(item.endAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}));
  },[data,now]);
  const upcomingAssignments = [...openAssignments].sort((a,b)=>+new Date(a.dueAt)-+new Date(b.dueAt)).slice(0,3);
  const todayMinutes = todayItems.reduce((sum,item)=>sum+(+new Date(item.endAt)-+new Date(item.startAt))/60000,0);
  return (
    <div className="page today-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">{currentDate}</div>
          <h1>{greeting}.</h1>
          <p>{todayItems.length ? `${todayItems.length} blocks are on your calendar today.` : "Your calendar is clear today."} Ask Alma to make a study plan around your deadlines.</p>
        </div>
        <div className="day-score"><span className="next-block-icon"><Clock3 size={19}/></span><span><strong>{todayItems.length ? "On your calendar" : "Open day"}</strong><small>{todayItems.length ? `${Math.round(todayMinutes/60*10)/10}h scheduled` : "No fixed commitments"}</small></span></div>
      </section>

      <button className="command-card" onClick={openPlanner}>
        <span className="command-icon"><Sparkles size={20} /></span>
        <span className="command-copy"><strong>Tell Alma what changed</strong><small>Ask Codex to reorganize your week around deadlines, notes, and saved preferences.</small></span>
        <span className="command-go"><ArrowRight size={18} /></span>
      </button>

      <section className="metric-grid">
        <article className="metric"><span className="metric-icon purple"><Clock3 size={18} /></span><div><small>FOCUS TIME SCHEDULED</small><strong>{Math.round(focusMinutesToday/60*10)/10}h</strong><em>{todaySessions.length} planned sessions</em></div></article>
        <article className="metric"><span className="metric-icon coral"><Target size={18} /></span><div><small>DUE THIS WEEK</small><strong>{dueThisWeek.length} tasks</strong><em>{dueThisWeek.filter((assignment)=>assignment.priority === "high").length} high priority</em></div></article>
        <article className="metric"><span className="metric-icon green"><Zap size={18} /></span><div><small>WORK REMAINING</small><strong>{Math.round(remainingMinutes/60*10)/10}h</strong><em>Across {openAssignments.length} assignments</em></div></article>
        <article className="metric"><span className="metric-icon gold"><GraduationCap size={18} /></span><div><small>COURSES</small><strong>{data?.courses.length ?? 0}</strong><em>{data?.assignments.filter((assignment)=>assignment.status==="completed").length ?? 0} assignments completed</em></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel schedule-panel">
          <div className="panel-head"><div><h2>Today’s plan</h2><p>{todayItems.length} {todayItems.length===1?"commitment":"commitments"} · {Math.round(todayMinutes/60*10)/10}h scheduled</p></div><button onClick={onViewCalendar}>View calendar <ArrowRight size={16} /></button></div>
          <div className="timeline">
            {todayItems.length ? todayItems.map((item) => (
              <div className="timeline-row" key={`${item.time}-${item.title}`}>
                <div className="time"><strong>{item.time}</strong><span>{item.end}</span></div>
                <div className={`event ${item.color}`}>
                  <div className="event-detail"><span className="event-type">{item.type}</span><h3>{item.title}</h3><p>{item.meta}</p></div>
                  {item.sessionId&&<div className="session-action">{item.sessionStatus==="planned"?<button type="button" disabled={busySessionId===item.sessionId} onClick={()=>void completeSession(item.sessionId!)}>{busySessionId===item.sessionId?"Saving…":"Mark done"}</button>:<span><Check size={13}/> Done</span>}</div>}
                </div>
              </div>
            )) : <div className="empty-inline">No commitments today. Ask Alma to create a focus plan.</div>}
          </div>
          {sessionError&&<div className="task-error" role="alert">{sessionError}</div>}
        </article>

        <div className="right-stack">
          <article className="panel attention-panel">
            <div className="panel-head"><div><h2>Upcoming work</h2><p>Open assignments by deadline</p></div></div>
            {upcomingAssignments.length ? upcomingAssignments.map((assignment)=>{
              const course=data?.courses.find((item)=>item.id===assignment.courseId);
              const due=new Date(assignment.dueAt);
              const urgent=+due-now<3*86400000;
              return <div className="attention-item" key={assignment.id}>
                <div className={`date-block ${urgent?"urgent":""}`}><strong>{due.toLocaleDateString([],{day:"numeric"})}</strong><span>{due.toLocaleDateString([],{month:"short"}).toUpperCase()}</span></div>
                <div className="attention-copy"><span className="course-pill"><i style={{background:course?.color||"var(--accent)"}}/>{course?.code||"GENERAL"}</span><h3>{assignment.title}</h3><div className="mini-progress"><span className="mini-progress-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,assignment.progress))}%`}}/></span><span>{assignment.progress}% complete</span></div></div>
              </div>;
            }):<div className="empty-inline">Nothing is due in the next few days.</div>}
          </article>

          <article className="panel checklist-panel">
            <div className="panel-head"><div><h2>Quick wins</h2><p>Small tasks for open moments</p></div><span className="count-pill">{data?.tasks.filter(task=>task.status==="completed").length||0}/{data?.tasks.length||0} done</span></div>
            {(data?.tasks.length?data.tasks.slice(0,5):[]).map((task) => (
              <div className={`check-row ${task.status === "completed" ? "checked" : ""} ${busyTaskId===task.id?"busy":""}`} key={task.id}>
                <button className="task-toggle" type="button" disabled={busyTaskId===task.id} onClick={()=>void toggleTask(task)} aria-label={`${task.status==="completed"?"Reopen":"Complete"} ${task.title}`}>
                  <span className="checkbox">{task.status === "completed" && <Check size={13} />}</span><span className="task-title">{task.title}</span>
                </button>
                <small>{task.estimatedMinutes} min</small>
                <button className="task-delete" type="button" disabled={busyTaskId===task.id} onClick={()=>void removeTask(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={16}/></button>
              </div>
            ))}
            {!data?.tasks.length&&<div className="empty-inline"><p>No tasks yet.</p><button className="secondary-action" onClick={openTask}><Plus size={16}/> Add a task</button></div>}
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
  const [weekOffset,setWeekOffset]=useState(0);
  const monday=useMemo(()=>{const date=new Date(today);const day=date.getDay();date.setDate(date.getDate()-(day===0?6:day-1)+weekOffset*7);date.setHours(0,0,0,0);return date;},[today,weekOffset]);
  const days=useMemo(()=>Array.from({length:7},(_,index)=>{const date=new Date(monday);date.setDate(date.getDate()+index);return date;}),[monday]);
  const items=useMemo(()=>{if(!data)return[];return [...data.events.map((event)=>({...event,kind:"event"})),...data.studySessions.map((session)=>({...session,kind:"session",courseId:null,type:"focus"}))].map((item)=>{const start=new Date(item.startAt);const end=new Date(item.endAt);const day=Math.floor((+new Date(start.getFullYear(),start.getMonth(),start.getDate())-+monday)/86400000)+1;const hour=start.getHours()+start.getMinutes()/60;const courseIndex=data.courses.findIndex((course)=>course.id===item.courseId);return{...item,day,top:58+(hour-8)*33,height:Math.max(28,(+end-+start)/3600000*33),color:item.kind==="session"?"coral":item.type==="personal"?"blue":CALENDAR_COLORS[Math.max(0,courseIndex)%CALENDAR_COLORS.length]};}).filter((item)=>item.day>=1&&item.day<=7);},[data,monday]);
  const focusMinutes=items.filter((item)=>item.kind==="session").reduce((sum,item)=>sum+(+new Date(item.endAt)-+new Date(item.startAt))/60000,0);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="page calendar-page">
      <div className="page-heading"><div><div className="eyebrow">{days[0].toLocaleDateString([],{month:"long",day:"numeric"})}–{days[6].toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"})}</div><h1>Your week</h1><p>Classes, commitments, and focused work in one place.</p></div><div className="heading-actions"><button onClick={()=>setWeekOffset((offset)=>offset-1)} aria-label="Previous week"><ChevronLeft size={18} /></button><button className="today-chip" onClick={()=>setWeekOffset(0)}>Today</button><button onClick={()=>setWeekOffset((offset)=>offset+1)} aria-label="Next week"><ChevronRight size={18} /></button><button className="primary-small" onClick={openEvent}><Plus size={18} /> New event</button></div></div>
      <div className="calendar-summary">
        <span><i className="dot purple-dot" /> {items.filter((item)=>item.kind==="event"&&item.type==="class").length} classes</span><span><i className="dot coral-dot" /> {Math.round(focusMinutes/60*10)/10}h focused work</span><span><i className="dot blue-dot" /> {items.filter((item)=>item.kind==="event"&&item.type==="personal").length} personal</span><strong>{items.length} blocks this week</strong>
      </div>
      <article className="week-calendar">
        <div className="calendar-corner">{timezone}</div>
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
  const offset=(day-1)/7;
  return <div className={`calendar-event ${color}`} style={{ left:`calc(62px + ${offset*100}% - ${offset*62}px)`, top, height }}><strong>{title}</strong><span>{time}</span></div>;
}

function CoursesView({openCourse,openTerm}:{openCourse:()=>void;openTerm:()=>void}) {
  const data = useAcademicData();
  const courseRows = data?.courses ?? [];
  const semesterById = new Map((data?.semesters ?? []).map((semester) => [semester.id, semester]));
  return (
    <div className="page courses-page">
      <div className="page-heading"><div><div className="eyebrow">Academic workspace</div><h1>Your courses</h1><p>Courses and work you’ve added, organized by term.</p></div><div className="heading-actions"><button onClick={openTerm}><Plus size={17}/> Add term</button><button className="primary-small" onClick={openCourse} disabled={!data?.semesters.length}><Plus size={17} /> Add course</button></div></div>
      {(data?.semesters.length??0)>0&&<div className="semester-track">{data?.semesters.map((semester)=><div key={semester.id}><span>{semester.name}</span><small>{new Date(`${semester.startDate}T00:00:00`).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})} – {new Date(`${semester.endDate}T00:00:00`).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}</small></div>)}</div>}
      {courseRows.length===0&&<div className="empty-state"><BookOpen size={26}/><h2>{data?.semesters.length?"No courses yet":"Start by adding a term"}</h2><p>{data?.semesters.length?"Add a course to record its assignments, notes, and scores.":"Enter the term dates from your academic calendar. You can then add your courses."}</p><button className="primary-small" onClick={data?.semesters.length?openCourse:openTerm}><Plus size={17}/>{data?.semesters.length?"Add a course":"Add your first term"}</button></div>}
      <div className="courses-grid">
        {courseRows.map((course) => {
          const next = data?.assignments.filter((assignment) => assignment.courseId === course.id && assignment.status !== "completed").sort((a,b) => +new Date(a.dueAt)-+new Date(b.dueAt))[0];
          const term=semesterById.get(course.semesterId);
          const courseAssignments=data?.assignments.filter((assignment)=>assignment.courseId===course.id)??[];
          const progress=courseAssignments.length?Math.round(courseAssignments.reduce((sum,assignment)=>sum+assignment.progress,0)/courseAssignments.length):null;
          return (
          <article className="course-card" key={course.code}>
            <div className="course-card-top" style={{ background: `${course.color}16` }}><span className="course-symbol" style={{ color: course.color, borderColor: `${course.color}40` }}>{course.code.split(" ")[0]}</span><span className="course-credits">{course.credits} credits</span></div>
            <div className="course-body"><span className="code" style={{ color: course.color }}>{course.code}</span><h2>{course.name}</h2><p>{term?.name??"Term unavailable"} · {course.credits} credits</p><div className="course-progress"><span><strong>{progress===null?"—":`${progress}%`}</strong>{progress===null?" · No assignments":" complete"}</span><div><i style={{ background: course.color, width: `${progress??0}%` }} /></div></div><div className="next-up"><span><small>NEXT DEADLINE</small><strong>{next?.title || "No open assignments"}</strong></span><b>{next ? new Date(next.dueAt).toLocaleDateString([], {month:"short",day:"numeric"}) : "—"}</b></div></div>
          </article>
        )})}
      </div>
    </div>
  );
}

function AssignmentsView({ openAdd, onChanged }: { openAdd: (mode?: "write"|"upload") => void; onChanged: () => Promise<void> }) {
  const data = useAcademicData();
  const [filter, setFilter] = useState("All");
  const [query,setQuery]=useState("");
  const [now] = useState(() => Date.now());
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [deleteError,setDeleteError]=useState("");
  const rows = (data?.assignments ?? []).filter((assignment) => (filter === "All" || assignment.status.replace("_"," ") === filter.toLowerCase()) && `${assignment.title} ${assignment.description} ${data?.courses.find((course)=>course.id===assignment.courseId)?.name??""}`.toLowerCase().includes(query.toLowerCase()));
  async function removeAssignment(assignment:AcademicData["assignments"][number]){
    if(deletingId||!window.confirm(`Delete “${assignment.title}”? Its planned calendar sessions will also be removed.`))return;
    setDeletingId(assignment.id);setDeleteError("");
    try{const response=await fetch(`/api/assignments/${assignment.id}`,{method:"DELETE"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to delete assignment");await onChanged();}
    catch(problem){setDeleteError(problem instanceof Error?problem.message:"Unable to delete assignment");}
    finally{setDeletingId(null);}
  }
  return (
    <div className="page assignments-page">
      <div className="page-heading"><div><div className="eyebrow">All terms</div><h1>Assignments</h1><p>Assignments saved to your academic workspace.</p></div><button className="primary-small" onClick={()=>openAdd("write")}><Plus size={17} /> Add assignment</button></div>
      <div className="filter-row"><div>{["All", "In progress", "Not started", "Completed"].map((f) => <button key={f} className={filter === f ? "active" : ""} aria-pressed={filter===f} onClick={() => setFilter(f)}>{f}{f === "All" && <b>{data?.assignments.length ?? 0}</b>}</button>)}</div><label className="filter-search"><Search size={16} /><input type="search" aria-label="Search assignments" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search assignments"/></label></div>
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
            <AssignmentProgressInput key={`${assignment.id}-${assignment.progress}`} assignment={assignment} onChanged={onChanged}/>
            <button className="task-delete assignment-delete" type="button" disabled={deletingId===assignment.id} onClick={()=>void removeAssignment(assignment)} aria-label={`Delete ${assignment.title}`} title="Delete assignment"><Trash2 size={15}/></button>
          </div>
        )})}
        {rows.length===0&&<div className="empty-state assignment-empty"><LayoutList size={25}/><h2>{query?"No matching assignments":"No assignments yet"}</h2><p>{query?"Try a different search or status filter.":"Add an assignment and it will appear here with its deadline and progress."}</p>{!query&&<button className="secondary-action" onClick={()=>openAdd("write")}><Plus size={16}/> Add an assignment</button>}</div>}
        {deleteError&&<div className="assignment-delete-error" role="alert">{deleteError}</div>}
      </article>
      <div className="upload-card"><div className="upload-icon"><Upload size={20} /></div><div><strong>Drop in an assignment brief</strong><p>Upload a PDF and Alma will extract the requirements, estimate the work, and propose a plan.</p></div><button onClick={()=>openAdd("upload")}>Choose PDF</button></div>
    </div>
  );
}

function AssignmentProgressInput({assignment,onChanged}:{assignment:AcademicData["assignments"][number];onChanged:()=>Promise<void>}){
  const [value,setValue]=useState(assignment.progress);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function save(){
    if(saving||value===assignment.progress)return;
    setSaving(true);setError("");
    try{
      const status=value===100?"completed":assignment.status==="completed"?"in_progress":assignment.status;
      const response=await fetch(`/api/assignments/${assignment.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({progress:value,status})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to update progress");await onChanged();
    }catch(problem){setError(problem instanceof Error?problem.message:"Unable to update progress");setValue(assignment.progress);}
    finally{setSaving(false);}
  }
  return <div className="table-progress"><label><span className="visually-hidden">Progress for {assignment.title}</span><input type="range" min="0" max="100" step="5" value={value} onChange={(event)=>setValue(Number(event.target.value))} onPointerUp={()=>void save()} onKeyUp={()=>void save()} onBlur={()=>void save()} aria-valuetext={`${value}%${saving?", saving":""}`}/><b>{value}%{saving?"…":""}</b></label>{error&&<small role="alert">{error}</small>}</div>;
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
  async function deleteNote(){if(!selectedId||!window.confirm(`Delete “${selected?.title||"this note"}”? This cannot be undone.`))return;await fetch(`/api/notes/${selectedId}`,{method:"DELETE"});setSelectedId(null);await onChanged();}
  async function togglePin(){if(!selected)return;await fetch(`/api/notes/${selected.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({pinned:!selected.pinned})});await onChanged();}
  async function toggleContext(){if(!selected)return;await fetch(`/api/notes/${selected.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({includeInContext:!selected.includeInContext})});await onChanged();}
  function choose(note:Note){setSelectedId(note.id);setTitle(note.title);setContent(note.content);setCourseId(note.courseId||"");}

  return <div className="page notes-page">
    <div className="page-heading"><div><div className="eyebrow">Knowledge base</div><h1>Course notes</h1><p>Write, organize, and give Alma the context behind your coursework.</p></div><button className="primary-small" onClick={createNote}><Plus size={17}/> New note</button></div>
    <section className="notes-workspace">
      <aside className="notes-list">
        <div className="notes-search"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search notes..."/></div>
        <div className="notes-count">{filtered.length} NOTES</div>
        {filtered.map((note)=>{const course=data?.courses.find((item)=>item.id===note.courseId);return <button key={note.id} className={selected?.id===note.id?"active":""} onClick={()=>choose(note)}><div><strong>{note.title}</strong>{note.pinned&&<Pin size={12}/>}</div><p>{note.content.replace(/[#*]/g,"").slice(0,90)||"Empty note"}</p><span><i style={{background:course?.color||"#a2a5ad"}}/>{course?.code||"GENERAL"}<time>{new Date(note.updatedAt).toLocaleDateString([],{month:"short",day:"numeric"})}</time></span><small className={`context-state ${note.includeInContext?"enabled":"paused"}`}>{note.includeInContext?"Available to Codex":"Excluded from Codex"}</small></button>})}
      </aside>
      <article className="note-editor">
        {selected ? <>
          <div className="note-toolbar"><select value={courseId} onChange={(event)=>setCourseId(event.target.value)} aria-label="Course for note"><option value="">General</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select><button type="button" className={`context-toggle ${selected.includeInContext?"active":""}`} onClick={toggleContext} aria-label={`${selected.includeInContext?"Exclude":"Include"} note in Codex context`} aria-pressed={selected.includeInContext}><span className="switch-track" aria-hidden="true"><i/></span><span>Codex context</span></button><button onClick={togglePin} className={selected.pinned?"active":""} aria-label={selected.pinned?"Unpin note":"Pin note"} aria-pressed={selected.pinned}><Pin size={18}/></button><button onClick={deleteNote} aria-label="Delete note"><Trash2 size={18}/></button><button className="save-note" onClick={saveNote}><Save size={16}/>{saving?"Saving...":saved?"Saved":"Save note"}</button></div>
          <input className="note-title-input" value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Note title"/>
          <textarea className="note-content-input" value={content} onChange={(event)=>setContent(event.target.value)} placeholder="Start writing. Use # headings, bullet points, formulas, questions..."/>
          <div className="note-status"><span>{content.trim().split(/\s+/).filter(Boolean).length} words</span><span>Markdown supported</span></div>
        </>:<div className="empty-note"><NotebookPen size={32}/><h2>Your notes live here</h2><p>Create a note and connect it to a course. Alma will use it when helping you plan.</p><button onClick={createNote}><Plus size={16}/> Create first note</button></div>}
      </article>
    </section>
  </div>;
}

type MemoryDraft = { title: string; content: string; category: Memory["category"]; enabled: boolean };

function MemoryView({ onChanged }: { onChanged: () => Promise<void> }) {
  const data = useAcademicData();
  const memories = data?.memories ?? [];
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<MemoryDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const filtered = memories.filter((memory) => `${memory.title} ${memory.content} ${memory.category}`.toLowerCase().includes(query.toLowerCase()));
  function startNew() {
    setEditingId(null);
    setDraft({ title: "", content: "", category: "preference", enabled: true });
    setError("");
  }
  function edit(memory: Memory) {
    setEditingId(memory.id);
    setDraft({ title: memory.title, content: memory.content, category: memory.category, enabled: memory.enabled });
    setError("");
  }
  async function saveMemory(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editingId ? `/api/memories/${editingId}` : "/api/memories", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save memory.");
      await onChanged();
      setDraft(null);
      setEditingId(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to save memory.");
    } finally {
      setSaving(false);
    }
  }
  async function toggleMemory(memory: Memory) {
    if (busyId) return;
    setBusyId(memory.id);
    setActionError("");
    try {
      const response = await fetch(`/api/memories/${memory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !memory.enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update memory.");
      await onChanged();
    } catch (problem) {
      setActionError(problem instanceof Error ? problem.message : "Unable to update memory.");
    } finally {
      setBusyId(null);
    }
  }
  async function removeMemory(memory: Memory) {
    if (busyId || !window.confirm(`Delete “${memory.title}”? Codex will stop using it.`)) return;
    setBusyId(memory.id);
    setActionError("");
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete memory.");
      await onChanged();
      if (editingId === memory.id) setDraft(null);
    } catch (problem) {
      setActionError(problem instanceof Error ? problem.message : "Unable to delete memory.");
    } finally {
      setBusyId(null);
    }
  }

  return <div className="page memory-page">
    <div className="page-heading">
      <div><div className="eyebrow">Your context</div><h1>What Alma remembers</h1><p>Keep study preferences, goals, and constraints in one place.</p></div>
      <button className="primary-small" onClick={startNew}><Plus size={18}/> Add memory</button>
    </div>
    <section className="memory-policy" aria-label="How saved context is used">
      <span className="memory-policy-icon"><Brain size={22}/></span>
      <div><strong>You choose what Codex can use</strong><p>Alma only uses memories you add here, and only when they fit your request. Up to eight relevant memories can be included in an answer.</p><small>Memories are not inferred from chat. Pause or delete any item at any time.</small></div>
    </section>
    <div className="memory-toolbar">
      <label className="memory-search"><Search size={18}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search saved context" aria-label="Search saved memories"/></label>
      <span>{memories.filter((memory)=>memory.enabled).length} enabled · {memories.length} saved</span>
    </div>
    {actionError&&<div className="memory-error" role="alert">{actionError}</div>}
    <section className="memory-grid" aria-label="Saved memories">
      {filtered.map((memory)=><article className={`memory-card ${memory.enabled?"":"paused"}`} key={memory.id}>
        <div className="memory-card-head"><span className={`memory-category ${memory.category}`}>{memory.category}</span><button type="button" className={`memory-switch ${memory.enabled?"active":""}`} aria-label={`${memory.enabled?"Pause":"Enable"} ${memory.title} for Codex context`} aria-pressed={memory.enabled} disabled={busyId===memory.id} onClick={()=>void toggleMemory(memory)}><span/></button></div>
        <h2>{memory.title}</h2>
        <p>{memory.content}</p>
        <div className="memory-card-footer"><span>{memory.enabled?"Included when relevant":"Paused"}</span><div><button type="button" onClick={()=>edit(memory)}>Edit</button><button type="button" className="memory-delete" onClick={()=>void removeMemory(memory)} disabled={busyId===memory.id}>Delete</button></div></div>
      </article>)}
      {filtered.length===0&&<div className="memory-empty"><span><Brain size={24}/></span><h2>{query?"No matching memories":"Start with one useful detail"}</h2><p>{query?"Try a different search term.":"Add a study preference or constraint so Codex can shape relevant plans around it."}</p>{!query&&<button className="secondary-action" onClick={startNew}><Plus size={17}/> Add your first memory</button>}</div>}
    </section>
    {draft&&<div className="modal-wrap memory-modal-wrap"><button className="modal-scrim" onClick={()=>setDraft(null)} aria-label="Close memory editor"/><form className="add-modal memory-modal" onSubmit={saveMemory}>
      <div className="modal-head"><div><span className="modal-kicker"><Brain size={15}/> SAVED CONTEXT</span><h2>{editingId?"Edit memory":"Add a memory"}</h2><p>Use a short, factual detail that will help with future academic planning.</p></div><button type="button" onClick={()=>setDraft(null)} aria-label="Close"><X size={20}/></button></div>
      <div className="memory-form">
        <label>Title<input required maxLength={120} value={draft.title} onChange={(event)=>setDraft({...draft,title:event.target.value})} placeholder="e.g. Best time for focused study"/></label>
        <label>Type<select value={draft.category} onChange={(event)=>setDraft({...draft,category:event.target.value as MemoryDraft["category"]})}><option value="preference">Preference</option><option value="goal">Goal</option><option value="constraint">Constraint</option><option value="other">Other</option></select></label>
        <label>What should Alma remember?<textarea required maxLength={1500} rows={5} value={draft.content} onChange={(event)=>setDraft({...draft,content:event.target.value})} placeholder="I focus best in 45-minute sessions and prefer to finish before 8 PM."/><small>{draft.content.length} of 1,500 characters</small></label>
        <label className="memory-enable-row"><input type="checkbox" checked={draft.enabled} onChange={(event)=>setDraft({...draft,enabled:event.target.checked})}/> Allow Codex to use this when relevant</label>
        {error&&<div className="form-error" role="alert">{error}</div>}
      </div>
      <div className="modal-footer"><button type="button" className="cancel" onClick={()=>setDraft(null)}>Cancel</button><button className="capture" type="submit" disabled={saving}>{saving?"Saving...":"Save memory"}<Check size={16}/></button></div>
    </form></div>}
  </div>;
}

function ProgressView({openGrade}:{openGrade:()=>void}) {
  const data = useAcademicData();
  const courseRows = data?.courses ?? [];
  const grades = data?.grades ?? [];
  const weightedScore = grades.reduce((sum,grade)=>sum+grade.score/Math.max(1,grade.maxScore)*100*(grade.weight||1),0);
  const totalWeight = grades.reduce((sum,grade)=>sum+(grade.weight||1),0);
  const averageScore = totalWeight ? Math.round(weightedScore/totalWeight) : null;
  const completedAssignments = data?.assignments.filter((assignment)=>assignment.status==="completed").length ?? 0;
  const completedSessions = data?.studySessions.filter((session)=>session.status==="completed") ?? [];
  const focusHours = completedSessions.reduce((sum,session)=>sum+(+new Date(session.endAt)-+new Date(session.startAt))/3_600_000,0);
  return (
    <div className="page progress-page">
      <div className="page-heading"><div><div className="eyebrow">All terms</div><h1>Progress</h1><p>A clear view of recorded scores, assignments, and focus sessions.</p></div><div className="heading-actions"><span className="period-select">All terms</span><button className="primary-small" onClick={openGrade} disabled={!courseRows.length}><Plus size={17}/> Add score</button></div></div>
      <section className="progress-metrics"><article><small>AVERAGE SCORE</small><strong>{averageScore===null?"—":`${averageScore}%`}</strong><p>{averageScore===null?"Add a score to see your average":"Across recorded assessments"}</p></article><article><small>ASSIGNMENTS DONE</small><strong>{completedAssignments}</strong><p>of {data?.assignments.length ?? 0} assignments</p></article><article><small>FOCUS TIME LOGGED</small><strong>{Math.round(focusHours*10)/10}h</strong><p>{completedSessions.length} completed sessions</p></article></section>
      <section className="progress-grid">
        <article className="panel chart-panel"><div className="panel-head"><div><h2>Course progress</h2><p>Average assignment completion by course</p></div><span className="legend"><i /> Complete</span></div><div className="bar-chart">{courseRows.length?courseRows.map((course)=>{const assignments=data?.assignments.filter((assignment)=>assignment.courseId===course.id)??[];const progress=assignments.length?Math.round(assignments.reduce((sum,assignment)=>sum+assignment.progress,0)/assignments.length):0;return <div key={course.id}><span>{assignments.length?`${progress}%`:"—"}</span><i style={{height:`${progress}%`,background:course.color}}/><small>{course.code}</small></div>}):<p className="chart-empty">Add a course and assignments to see your progress.</p>}</div></article>
        <article className="panel grade-panel">
          <div className="panel-head"><div><h2>Course standing</h2><p>Current weighted scores</p></div></div>
          {courseRows.length ? courseRows.map((course) => {
            const courseGrades=data?.grades.filter((grade)=>grade.courseId===course.id)??[];
            const earned=courseGrades.reduce((sum,grade)=>sum+grade.score/Math.max(1,grade.maxScore)*100*(grade.weight||1),0);
            const weights=courseGrades.reduce((sum,grade)=>sum+(grade.weight||1),0);
            const score=weights?Math.round(earned/weights):null;
            return <div className="grade-row" key={course.code}><i style={{ background: course.color }} /><span><strong>{course.name}</strong><small>{course.code}</small></span><div><b>{score===null?"—":`${score}%`}</b><em>{score===null?"No scores":score>=90?"A":score>=80?"B":score>=70?"C":"Below C"}</em></div></div>;
          }) : <p className="grade-empty">Add a course and record an assessment to see course standings.</p>}
        </article>
      </section>
    </div>
  );
}

type AssignmentDraft={title:string;description:string;courseId:string;dueAt:string;estimatedMinutes:number;priority:"low"|"medium"|"high";confidence:number;subtasks:Array<{title:string;estimatedMinutes:number}>};
type PlannerPlan={planId:string;action:"answer"|"rebuild_schedule"|"workspace_update"|"clarification";message:string;changes:PlanChange[];atRisk:string[];appliedActions?:Array<{kind:string;id:string;summary:string}>;aiUsed:boolean;accepted?:boolean};
type ContextReceipt={savedMemories:string[];courseNotes:string[];courses:string[];assignments:string[];commitments:string[];studySessions:string[];grades:string[];conversationMessages:number};
type ChatEntry={id:string;role:"user"|"assistant";text:string;createdAt:string;attachmentName?:string;aiUsed?:boolean;error?:boolean;plan?:PlannerPlan;assignment?:{draft:AssignmentDraft;saved?:boolean};context?:ContextReceipt};
type ChatThread={id:string;title:string;entries:ChatEntry[];createdAt:string;updatedAt:string};
const EMPTY_CHAT_ENTRIES:ChatEntry[]=[];

const CHAT_STORAGE_KEY="alma-planner-conversations-v3";
const LEGACY_CHAT_STORAGE_KEY="alma-planner-conversation-v2";
const makeChatId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
const newChatThread=():ChatThread=>{const now=new Date().toISOString();return{id:makeChatId(),title:"New chat",entries:[],createdAt:now,updatedAt:now};};

type CodexLoginStatus={status:"disconnected"|"pending"|"connected"|"error";connected:boolean;verificationUrl?:string;userCode?:string;message:string;model:string};

function ContextReceiptDetails({ receipt }: { receipt: ContextReceipt }) {
  const groups: Array<[string, string[]]> = [
    ["Saved memories", receipt.savedMemories], ["Course notes", receipt.courseNotes],
    ["Courses", receipt.courses], ["Assignments", receipt.assignments],
    ["Fixed commitments", receipt.commitments], ["Planned study sessions", receipt.studySessions],
    ["Grades", receipt.grades],
  ];
  const sourceCount = groups.reduce((count, [, items]) => count + items.length, 0);
  return <details className="context-receipt">
    <summary><span><Brain size={16}/> Context used</span><b>{sourceCount} records · {receipt.conversationMessages} recent messages</b></summary>
    <div className="context-receipt-body">
      {sourceCount===0&&receipt.conversationMessages===0?<p>No saved records matched this request.</p>:<>
        <p>Codex received only the relevant records listed here, plus your current request.</p>
        {groups.filter(([,items])=>items.length>0).map(([label,items])=><section key={label}><strong>{label}</strong><ul>{items.map((item,index)=><li key={`${label}-${index}`}>{item}</li>)}</ul></section>)}
        {receipt.conversationMessages>0&&<p className="receipt-history">Recent conversation: {receipt.conversationMessages} message{receipt.conversationMessages===1?"":"s"}</p>}
      </>}
    </div>
  </details>;
}

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
        const draft={...result.extraction,dueAt:result.extraction.dueAt?new Date(result.extraction.dueAt).toISOString().slice(0,16):""} as AssignmentDraft;
        setEntries(current=>[...current,{id:makeChatId(),role:"assistant",text:`I read ${file.name} and turned it into a structured assignment. Review the details below, then save it to your workspace.`,createdAt:new Date().toISOString(),aiUsed:result.aiUsed,assignment:{draft}}]);
      }else{
        const history=entries.slice(-8).map((entry)=>({role:entry.role,text:entry.text}));
        const response=await fetch("/api/planner",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,history})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Unable to respond");
        setEntries(current=>[...current,{id:makeChatId(),role:"assistant",text:result.message,createdAt:new Date().toISOString(),aiUsed:result.aiUsed,plan:result.changes.length?result:undefined,context:result.contextReceipt}]);
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
    if(!draft.courseId||!draft.dueAt||!Number.isFinite(Date.parse(draft.dueAt))){setComposerError("Choose a course and enter the real due date before saving this assignment.");return;}
    setSavingId(entryId);
    try{const response=await fetch("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,dueAt:new Date(draft.dueAt).toISOString()})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save assignment");setEntries(current=>current.map(entry=>entry.id===entryId&&entry.assignment?{...entry,assignment:{...entry.assignment,saved:true},text:`${entry.assignment.draft.title} is now saved. I’ll include it in future planning.`}:entry));await onChanged();}
    catch(problem){setComposerError(problem instanceof Error?problem.message:"Unable to save assignment");}
    finally{setSavingId(null);}
  }

  function clearConversation(){setEntries([]);setMessage("");setAttachment(null);setComposerError("");}

  return <>
    {open&&<button className="drawer-scrim" aria-label="Close planner" onClick={onClose}/>}
    <aside className={`planner-drawer ${open?"open":""}`} aria-label="Alma planner">
      <div className="drawer-head"><div className="alma-orb"><Sparkles size={19}/></div><div><strong>Alma</strong><span><i className={data?.aiConfigured?"":"offline"}/>{data?.aiConfigured?`Codex · ${data.aiModel||"connected"} via ChatGPT`:"Connect ChatGPT to enable Codex"}</span></div><button onClick={newChat} disabled={loading} aria-label="New chat" title="New chat"><Plus size={18}/></button>{entries.length>0&&<button onClick={clearConversation} disabled={loading} aria-label="Clear conversation" title="Clear conversation"><Trash2 size={17}/></button>}<button onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div className="chat-threadbar"><select aria-label="Choose chat" value={activeThread?.id||""} onChange={event=>{setActiveThreadId(event.target.value);setMessage("");setAttachment(null);setComposerError("");}} disabled={loading}>{threads.map(thread=><option key={thread.id} value={thread.id}>{thread.title}</option>)}</select><button onClick={deleteChat} disabled={loading} aria-label="Delete chat" title="Delete chat"><Trash2 size={15}/></button></div>
      <div className="chat-body" ref={chatBody}>
        <div className="chat-date">CHAT HISTORY STAYS IN THIS BROWSER</div>
        <div className="assistant-message"><p>Ask Alma to plan study time or update your academic workspace. Codex uses only relevant records and enabled memories you choose.</p></div>
        {entries.length===0&&<div className="suggestions"><button onClick={()=>setMessage("Add a task for tomorrow")}>Add a task</button><button onClick={()=>setMessage("Add a personal event tomorrow from 5 to 6 PM")}>Add a calendar event</button><button onClick={()=>setMessage("What should I focus on this week?")}>Plan my week</button><button onClick={()=>fileInput.current?.click()}><Paperclip size={15}/> Upload an assignment brief</button></div>}
        {entries.map(entry=><div className={`chat-entry ${entry.role}`} key={entry.id}>
          {entry.role==="user"?<div className="user-message">{entry.attachmentName&&<span className="message-attachment"><FileText size={14}/>{entry.attachmentName}</span>}{entry.text&&<p>{entry.text}</p>}</div>:<>
            <div className={`assistant-message ${entry.error?"error":""}`}><p>{entry.text}</p>{!entry.error&&<small>{entry.aiUsed?"Codex":"Alma"} · {entry.context?"selected academic context":"assistant response"}</small>}</div>
            {entry.context&&<ContextReceiptDetails receipt={entry.context}/>}
            {entry.assignment&&<article className={`assignment-preview ${entry.assignment.saved?"saved":""}`}><div className="assignment-preview-head"><span><FileText size={16}/> ASSIGNMENT BRIEF</span><b>{entry.assignment.saved?"Saved":`${Math.round(entry.assignment.draft.confidence*100)}% confidence`}</b></div><div className="assignment-preview-body"><label>Course<select aria-label="Course for assignment" value={entry.assignment.draft.courseId||""} onChange={(event)=>setEntries(current=>current.map(item=>item.id===entry.id&&item.assignment?{...item,assignment:{...item.assignment,draft:{...item.assignment.draft,courseId:event.target.value}}}:item))}><option value="">Choose a course</option>{data?.courses.map(course=><option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label><h3>{entry.assignment.draft.title}</h3><p>{entry.assignment.draft.description}</p><div><label><CalendarDays size={14}/> Due date<input aria-label="Assignment due date" type="datetime-local" value={entry.assignment.draft.dueAt} onChange={(event)=>setEntries(current=>current.map(item=>item.id===entry.id&&item.assignment?{...item,assignment:{...item.assignment,draft:{...item.assignment.draft,dueAt:event.target.value}}}:item))}/></label><span><Clock3 size={14}/>{Math.round(entry.assignment.draft.estimatedMinutes/60*10)/10}h estimated</span></div><ul>{entry.assignment.draft.subtasks.slice(0,4).map((subtask,index)=><li key={`${subtask.title}-${index}`}><i>{index+1}</i><span>{subtask.title}</span><b>{subtask.estimatedMinutes}m</b></li>)}</ul></div>{!entry.assignment.saved&&<div className="preview-actions"><button onClick={()=>saveAssignment(entry.id,entry.assignment!.draft)} disabled={savingId===entry.id||!entry.assignment.draft.courseId||!entry.assignment.draft.dueAt}>{savingId===entry.id?"Saving...":"Save assignment"}<Check size={15}/></button></div>}</article>}
            {entry.plan&&<article className={`plan-preview ${entry.plan.accepted?"accepted":""}`}><div className="plan-title"><span><Sparkles size={16}/> PROPOSED PLAN</span><b>{entry.plan.accepted?"Applied":`${entry.plan.changes.length} sessions`}</b></div>{entry.plan.changes.slice(0,8).map(change=><div className="plan-change" key={change.id}><span className="change-icon add">+</span><div><strong>{change.title}</strong><small>{new Date(change.startAt).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} · {Math.round((+new Date(change.endAt)-+new Date(change.startAt))/60000)}m</small></div></div>)}<div className="plan-note"><Check size={15}/>{entry.plan.atRisk.length?`${entry.plan.atRisk.length} item(s) still need attention: ${entry.plan.atRisk.join(", ")}`:"The proposed work fits around every fixed commitment."}</div>{!entry.plan.accepted&&<div className="plan-actions"><button onClick={()=>acceptPlan(entry.id,entry.plan!)} disabled={savingId===entry.id}>{savingId===entry.id?"Applying...":"Accept plan"}</button><button onClick={()=>setMessage("Adjust that plan: make it lighter and keep more evening time free.")}>Adjust</button></div>}</article>}
          </>}
        </div>)}
        {loading&&<div className="planner-loading"><Sparkles size={18}/><strong>{attachment?"Reading your assignment...":"Thinking across your academic context..."}</strong><span>{attachment?"Extracting requirements, deadline, and workload.":"Checking deadlines, notes, workload, and commitments."}</span></div>}
      </div>
      <form ref={formRef} className={`chat-input ${dragging?"dragging":""}`} onSubmit={submit} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);chooseAttachment(event.dataTransfer.files[0]||null);}}>
        <input ref={fileInput} hidden type="file" accept="application/pdf,.pdf,text/plain,.txt" onChange={event=>chooseAttachment(event.target.files?.[0]||null)}/>
        {attachment&&<div className="composer-attachment"><FileText size={15}/><span><strong>{attachment.name}</strong><small>{Math.max(1,Math.round(attachment.size/1024))} KB</small></span><button type="button" onClick={()=>{setAttachment(null);if(fileInput.current)fileInput.current.value="";}} aria-label="Remove attachment"><X size={15}/></button></div>}
        {composerError&&<div className="composer-error">{composerError}<button type="button" onClick={()=>setComposerError("")}><X size={13}/></button></div>}
        <textarea value={message} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();formRef.current?.requestSubmit();}}} placeholder={attachment?"Add instructions for this assignment...":"Try “Move my event to Friday at 6 PM”..."} rows={3}/>
        <div><button type="button" onClick={()=>fileInput.current?.click()} aria-label="Attach assignment" title="Attach PDF or text"><Paperclip size={18}/></button><span>Enter to send · Shift+Enter for a new line</span><button className="send-button" type="submit" aria-label="Send" disabled={loading||(!message.trim()&&!attachment)}>{loading?<span className="send-spinner"/>:<Send size={17}/>}</button></div>
      </form>
    </aside>
  </>;
}

function AddTaskModal({open,onClose,onChanged}:{open:boolean;onClose:()=>void;onChanged:()=>Promise<void>}) {
  const data=useAcademicData();
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [courseId,setCourseId]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [estimatedMinutes,setEstimatedMinutes]=useState("30");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  if(!open)return null;
  async function submit(event:FormEvent){
    event.preventDefault();setSaving(true);setError("");
    try{
      const response=await fetch("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,courseId:courseId||null,dueAt:dueAt?new Date(dueAt).toISOString():null,estimatedMinutes:Number(estimatedMinutes)})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save task");
      await onChanged();setTitle("");setDescription("");setCourseId("");setDueAt("");setEstimatedMinutes("30");onClose();
    }catch(problem){setError(problem instanceof Error?problem.message:"Unable to save task");}
    finally{setSaving(false);}
  }
  return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} aria-label="Close task form"/><form className="add-modal record-modal" onSubmit={submit}><div className="modal-head"><div><span className="modal-kicker">PERSONAL TASK</span><h2>Add a task</h2><p>Save a reminder to your academic workspace.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="record-form"><label>Task<input required maxLength={180} autoFocus value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Task title"/></label><label>Details<textarea rows={3} value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="Optional details"/></label><div className="draft-grid"><label>Course<select value={courseId} onChange={(event)=>setCourseId(event.target.value)}><option value="">No course</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select></label><label>Due date<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label><label>Estimated minutes<input type="number" min="5" step="5" value={estimatedMinutes} onChange={(event)=>setEstimatedMinutes(event.target.value)}/></label></div>{error&&<div className="form-error" role="alert">{error}</div>}</div><div className="modal-footer"><button type="button" onClick={onClose}>Cancel</button><button className="capture" type="submit" disabled={saving||!title.trim()}>{saving?"Saving…":"Save task"}<Check size={16}/></button></div></form></div>;
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
  async function analyze(){if(!description.trim()&&!file){setError("Describe the assignment or choose a PDF first.");return;}if(!data?.courses.length){setError("Add a term and course before capturing an assignment.");return;}setLoading(true);setError("");const form=new FormData();form.set("description",description);if(file)form.set("file",file);try{const response=await fetch("/api/assignments/analyze",{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Analysis failed");setDraft({...result.extraction,dueAt:result.extraction.dueAt?new Date(result.extraction.dueAt).toISOString().slice(0,16):""});setAiUsed(result.aiUsed);}catch(problem){setError(problem instanceof Error?problem.message:"Analysis failed");}finally{setLoading(false);}}
  async function confirm(){if(!draft)return;if(!draft.courseId||!draft.dueAt||!Number.isFinite(Date.parse(draft.dueAt))){setError("Choose a course and enter the actual due date before saving.");return;}setLoading(true);setError("");try{const response=await fetch("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,dueAt:new Date(draft.dueAt).toISOString()})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save assignment");setSaved(true);await onChanged();}catch(problem){setError(problem instanceof Error?problem.message:"Unable to save assignment");}finally{setLoading(false);}}
  function close(){setSaved(false);setDraft(null);setDescription("");setFile(null);setError("");onClose();}
  if (!open) return null;
  return (
    <div className="modal-wrap">
      <button className="modal-scrim" onClick={close} aria-label="Close" />
      <section className="add-modal">
        <div className="modal-head">
          <div>
            <span className="modal-kicker"><Sparkles size={15} /> SMART CAPTURE</span>
            <h2>{draft ? "Review the plan" : "Add an assignment"}</h2>
            <p>{draft ? "Confirm the extracted details and fill any missing information." : "Share an assignment brief. The course and deadline are confirmed before saving."}</p>
          </div>
          <button onClick={close} aria-label="Close"><X size={20} /></button>
        </div>

        {saved ? (
          <div className="saved-state">
            <span><Check size={28} /></span>
            <h3>Assignment saved</h3>
            <p>It is now part of your academic record and planning context.</p>
            <button onClick={close}>Done</button>
          </div>
        ) : draft ? (
          <div className="review-draft">
            <div className="draft-badge"><Sparkles size={14} />{aiUsed ? "Extracted with Codex" : "Structured from your brief"} · {Math.round(draft.confidence * 100)}% confidence</div>
            <label>Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <div className="draft-grid">
              <label>Course
                <select required value={draft.courseId || ""} onChange={(event) => setDraft({ ...draft, courseId: event.target.value })}>
                  <option value="">Choose a course</option>
                  {data?.courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}
                </select>
              </label>
              <label>Actual due date<input required type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} /></label>
              <label>Estimated hours<input type="number" min="0.5" step="0.5" value={draft.estimatedMinutes / 60} onChange={(event) => setDraft({ ...draft, estimatedMinutes: Number(event.target.value) * 60 })} /></label>
              <label>Priority
                <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as AssignmentDraft["priority"] })}>
                  <option>low</option><option>medium</option><option>high</option>
                </select>
              </label>
            </div>
            <label>Description<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <div className="draft-subtasks">
              <strong>Suggested subtasks</strong>
              {draft.subtasks.map((subtask, index) => (
                <div key={`${subtask.title}-${index}`}>
                  <span>{index + 1}</span>
                  <input value={subtask.title} onChange={(event) => setDraft({ ...draft, subtasks: draft.subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} />
                  <b>{subtask.estimatedMinutes}m</b>
                </div>
              ))}
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="modal-footer">
              <button className="cancel" onClick={() => setDraft(null)}>Back</button>
              <button className="capture" onClick={confirm} disabled={loading || !draft.courseId || !draft.dueAt}>{loading ? "Saving..." : "Save assignment"}<Check size={16} /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="capture-tabs">
              <button className={mode === "write" ? "active" : ""} onClick={() => setMode("write")}><FileText size={17} /> Describe it</button>
              <button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}><Upload size={17} /> Upload PDF</button>
            </div>
            {mode === "write" ? (
              <div className="capture-form">
                <label>What’s the assignment?<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste or describe the assignment brief" rows={6} /></label>
                <div className="capture-hint"><Sparkles size={15} /><span>Alma extracts requirements from the brief. Review the course, deadline, and workload before saving.</span></div>
              </div>
            ) : (
              <div className="drop-zone" onClick={() => fileInput.current?.click()}>
                <input ref={fileInput} type="file" accept="application/pdf,.pdf,text/plain,.txt" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <span><Upload size={23} /></span>
                <strong>{file?.name || "Choose an assignment brief"}</strong>
                <p>{file ? `${Math.round(file.size / 1024)} KB selected` : "PDF or text · up to 20 MB"}</p>
                <button type="button">Choose file</button>
              </div>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            {!data?.courses.length && <div className="form-error">Add a term and course before capturing an assignment.</div>}
            <div className="modal-footer">
              <button className="cancel" onClick={close}>Cancel</button>
              <button className="capture" onClick={analyze} disabled={loading || !data?.courses.length}>{loading ? "Analyzing..." : "Analyze & continue"}<ArrowRight size={16} /></button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

type RecordKind="term"|"course"|"event"|"grade";
function RecordModal({kind,open,onClose,onChanged}:{kind:RecordKind;open:boolean;onClose:()=>void;onChanged:()=>Promise<void>}){
  const data=useAcademicData();
  const [form,setForm]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  if(!open)return null;
  const label=kind==="term"?"term":kind==="course"?"course":kind==="event"?"calendar event":"score";
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");const endpoint=kind==="grade"?"grades":kind==="event"?"events":kind==="term"?"semesters":"courses";const payload=kind==="term"?{name:form.name,startDate:form.startDate,endDate:form.endDate}:kind==="course"?{name:form.name,code:form.code,credits:Number(form.credits||3),color:form.color||"#0066cc",semesterId:form.semesterId||data?.semesters[0]?.id}:kind==="event"?{title:form.title,startAt:form.startAt,endAt:form.endAt,type:form.type||"personal",courseId:form.courseId||null}:{title:form.title,courseId:form.courseId,score:Number(form.score),maxScore:Number(form.maxScore||100),weight:Number(form.weight||0)};try{const response=await fetch(`/api/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||`Unable to save ${label}`);await onChanged();setForm({});onClose();}catch(problem){setError(problem instanceof Error?problem.message:`Unable to save ${label}`);}finally{setSaving(false);}}
  return <div className="modal-wrap"><button className="modal-scrim" onClick={onClose} aria-label="Close"/><form className="add-modal record-modal" onSubmit={submit}><div className="modal-head"><div><span className="modal-kicker">ACADEMIC WORKSPACE</span><h2>Add {label}</h2><p>This will be saved to your academic record.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="record-form">{kind==="term"&&<><label>Term name<input required value={form.name||""} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Fall 2026"/></label><div className="draft-grid"><label>Starts<input required type="date" value={form.startDate||""} onChange={(e)=>setForm({...form,startDate:e.target.value})}/></label><label>Ends<input required type="date" value={form.endDate||""} onChange={(e)=>setForm({...form,endDate:e.target.value})}/></label></div></>}{kind==="course"&&<><label>Course name<input required value={form.name||""} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Course name"/></label><div className="draft-grid"><label>Course code<input required value={form.code||""} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="Course code"/></label><label>Credits<input type="number" min="1" value={form.credits||"3"} onChange={(e)=>setForm({...form,credits:e.target.value})}/></label><label>Term<select required value={form.semesterId||data?.semesters[0]?.id||""} onChange={(e)=>setForm({...form,semesterId:e.target.value})}>{data?.semesters.map((semester)=><option value={semester.id} key={semester.id}>{semester.name}</option>)}</select></label><label>Color<input type="color" value={form.color||"#0066cc"} onChange={(e)=>setForm({...form,color:e.target.value})}/></label></div></>}{kind==="event"&&<><label>Event title<input required value={form.title||""} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Event name"/></label><div className="draft-grid"><label>Starts<input required type="datetime-local" value={form.startAt||""} onChange={(e)=>setForm({...form,startAt:e.target.value})}/></label><label>Ends<input required type="datetime-local" value={form.endAt||""} onChange={(e)=>setForm({...form,endAt:e.target.value})}/></label><label>Type<select value={form.type||"personal"} onChange={(e)=>setForm({...form,type:e.target.value})}><option value="personal">Personal</option><option value="class">Class</option></select></label><label>Course<select value={form.courseId||""} onChange={(e)=>setForm({...form,courseId:e.target.value})}><option value="">No course</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code}</option>)}</select></label></div></>}{kind==="grade"&&<><label>Score title<input required value={form.title||""} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Assessment name"/></label><div className="draft-grid"><label>Course<select required value={form.courseId||""} onChange={(e)=>setForm({...form,courseId:e.target.value})}><option value="">Choose a course</option>{data?.courses.map((course)=><option value={course.id} key={course.id}>{course.code} · {course.name}</option>)}</select></label><label>Score<input required type="number" step="0.1" value={form.score||""} onChange={(e)=>setForm({...form,score:e.target.value})}/></label><label>Out of<input type="number" value={form.maxScore||"100"} onChange={(e)=>setForm({...form,maxScore:e.target.value})}/></label><label>Weight %<input type="number" min="0" max="100" value={form.weight||"0"} onChange={(e)=>setForm({...form,weight:e.target.value})}/></label></div></>}{error&&<div className="form-error">{error}</div>}</div><div className="modal-footer"><button type="button" onClick={onClose}>Cancel</button><button className="capture" type="submit" disabled={saving||(kind==="grade"&&!data?.courses.length)||(kind==="course"&&!data?.semesters.length)}>{saving?"Saving...":`Save ${label}`}<Check size={16}/></button></div></form></div>;
}

export default function HomePage() {
  const [view, setView] = useState<View>("Today");
  const [menu, setMenu] = useState(false);
  const [planner, setPlanner] = useState(false);
  const [add, setAdd] = useState<"write"|"upload"|null>(null);
  const [taskModal,setTaskModal]=useState(false);
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
        <Topbar title={title} openMenu={() => setMenu(true)} openPlanner={() => setPlanner(true)} openTask={()=>setTaskModal(true)} openAuth={()=>setAuth(true)} aiConfigured={data.aiConfigured}/>
        {!data.aiConfigured&&<div className="ai-config-banner"><Sparkles size={16}/><span><strong>Connect ChatGPT to enable Codex.</strong> Alma sends only relevant coursework and memories you have enabled.</span><button onClick={()=>setAuth(true)}>Connect</button></div>}
        <main>
          {view === "Today" && <TodayView openPlanner={() => setPlanner(true)} openTask={()=>setTaskModal(true)} onChanged={refresh} onViewCalendar={()=>setView("Calendar")} />}
          {view === "Calendar" && <CalendarView openEvent={()=>setRecord("event")} />}
          {view === "Courses" && <CoursesView openCourse={()=>setRecord("course")} openTerm={()=>setRecord("term")} />}
          {view === "Assignments" && <AssignmentsView openAdd={(mode="write") => setAdd(mode)} onChanged={refresh} />}
          {view === "Notes" && <NotesView onChanged={refresh} />}
          {view === "Memory" && <MemoryView onChanged={refresh} />}
          {view === "Progress" && <ProgressView openGrade={()=>setRecord("grade")} />}
        </main>
      </div>
      <button className="mobile-ai" onClick={() => setPlanner(true)} aria-label="Ask Alma"><Sparkles size={20} /></button>
      <AddTaskModal open={taskModal} onClose={()=>setTaskModal(false)} onChanged={refresh}/>
      <PlannerDrawer open={planner} onClose={() => setPlanner(false)} onChanged={refresh} onLogin={()=>setAuth(true)} />
      <AddAssignmentModal key={add||"closed"} open={Boolean(add)} initialMode={add||"write"} onClose={() => setAdd(null)} onChanged={refresh} />
      <RecordModal kind={record||"course"} open={Boolean(record)} onClose={()=>setRecord(null)} onChanged={refresh}/>
      {auth&&<ChatGPTAuthModal onClose={()=>setAuth(false)} onChanged={refresh}/>}
    </div></DataContext.Provider>
  );
}
