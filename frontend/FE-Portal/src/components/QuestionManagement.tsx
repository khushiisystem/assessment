import { sanitizeHtml } from "@/lib/sanitize";
import { renderRich } from "@/lib/miniMarkdown";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Eye, Edit, Trash2, ArrowLeft, Save, PlusCircle, Link, Power, PowerOff, FileText, EyeOff, X, Download, Upload, FileUp, Loader2, Users, Mail, ChevronUp, Clock, ChevronRight, CheckCircle, Circle, Hourglass, CalendarClock, AlertTriangle, Activity } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from '@/hooks/use-toast';
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  useDeleteAssignmentMutation,
  useUnassignAssignmentMutation,
  useGetTechnologiesQuery,
  useLazyGetTechnologyQuestionsQuery,
  useUpdateTechQuestionMutation,
  useAddTechQuestionMutation,
  useDeleteTechQuestionMutation,
  useUploadQuestionsMutation,
  useCreateAssignmentMutation,
  useSendReminderEmailMutation,
  useLazyDownloadQuestionTemplateQuery,
} from "@/store";
import { useLazyGetCandidatesQuery } from "@/store"; 
import { formatDateValue } from "@/utils/commonFunctions";
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { QuestionsToolbar } from "@/components/dashboard/QuestionsToolbar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LearningAssignment {
  technology_id: string;
  technology_name: string;
  assigned_at: string;
  due_at: string;
  notes: string;
  progress: number;
  completed: number;
  total: number;
  user_notes: string | null;
  assignment_id?: number;
  status?: string;
  last_active_at?: string;
}

interface Candidate {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string | null;
  role: string;
  date_joined: string;
  resume_s3_url: string | null;
  learning_assignments: LearningAssignment[];
  start_date?: string;
  end_date?: string;
  assigned_at?: string;
  due_at?: string;
}
interface CandidatesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    candidates: Candidate[];
  };
}

interface Question {
  id: number;
  question: string;
  answer: string;
  difficulty: "Easy" | "Medium" | "Hard";
  reference_link?: string;
  task_description?: string;
  task_file?: string | null;
  technology: string;
  created_at: string;
  updated_at: string;
  module_level: "beginner" | "basic" | "intermediate" | "advanced";
}

interface QuestionManagementProps {
  technologyId: string;
  technologyName: string;
  onBack: () => void;
  candidatesData?: Candidate[];
}

interface Technology {
  id: string;
  name: string;
  description: string;
  category: string;
  questionCount: number;
  assignedUsersCount: number;
}

const MODULE_LEVEL_CHOICES = [
  { value: "beginner", label: "Beginner" },
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const DIFFICULTY_FORM_OPTIONS = [
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK PREVIEW DATA — TEMPORARY
// Shown only when a technology has no questions yet, so the Q&A layout can be
// designed/reviewed against realistic content. Safe to delete once real
// questions exist; the page automatically uses real API data when present.
// ─────────────────────────────────────────────────────────────────────────────
// Small builder so each mock question stays readable. Answers are rich HTML
// (the answer panel renders them via prose styling) modelled on interview-prep
// resources: short answer → detailed explanation → code → key points → trap.
const mockQ = (
  id: number,
  module_level: Question["module_level"],
  difficulty: Question["difficulty"],
  question: string,
  answer: string,
  extra: Partial<Question> = {},
): Question => ({
  id,
  module_level,
  difficulty,
  question,
  answer,
  technology: "Java",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...extra,
});

// Interview-round tags shown as a small pill before each question.
const L1 = `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;margin-right:8px;vertical-align:middle">L1 · Screening</span>`;
const L2 = `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;background:#fef3c7;color:#b45309;font-size:10px;font-weight:700;margin-right:8px;vertical-align:middle">L2 · Technical</span>`;
const FINAL = `<span style="display:inline-block;padding:1px 8px;border-radius:9999px;background:#ede9fe;color:#6d28d9;font-size:10px;font-weight:700;margin-right:8px;vertical-align:middle">Final Round</span>`;

const MOCK_QUESTIONS: Question[] = [
  mockQ(
    -101,
    "beginner",
    "Easy",
    `${L1} What is Object-Oriented Programming (OOP), in plain words?`,
    `<p><strong>The gist:</strong> OOP writes code the way we see the world — as <em>things</em> (objects) that hold some data and can do stuff.</p>
<p>Before OOP, data sat in one place and the functions using it were scattered elsewhere, which got messy as programs grew. OOP keeps the data and the actions that belong together in one unit. A <code>BankAccount</code> holds the balance <em>and</em> its <code>deposit()</code> / <code>withdraw()</code> methods — so everything about an account lives in one place. That makes big code easier to understand, reuse, and change safely.</p>
<h4>The four ideas it stands on</h4>
<div style="margin:12px 0;text-align:center">
<svg viewBox="0 0 460 152" width="460" height="152" style="max-width:100%;height:auto" role="img" aria-label="The four pillars of OOP">
  <rect x="185" y="8" width="90" height="32" rx="8" fill="#7c3aed"/>
  <text x="230" y="29" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold">OOP</text>
  <line x1="230" y1="40" x2="60" y2="78" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="230" y1="40" x2="173" y2="78" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="230" y1="40" x2="287" y2="78" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="230" y1="40" x2="399" y2="78" stroke="#cbd5e1" stroke-width="1.5"/>
  <g font-family="sans-serif">
    <rect x="12" y="78" width="96" height="62" rx="8" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="60" y="103" text-anchor="middle" fill="#5b21b6" font-size="11.5" font-weight="bold">Encapsulation</text>
    <text x="60" y="122" text-anchor="middle" fill="#64748b" font-size="10">keep data safe</text>
    <rect x="125" y="78" width="96" height="62" rx="8" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="173" y="103" text-anchor="middle" fill="#5b21b6" font-size="11.5" font-weight="bold">Abstraction</text>
    <text x="173" y="122" text-anchor="middle" fill="#64748b" font-size="10">hide details</text>
    <rect x="238" y="78" width="96" height="62" rx="8" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="286" y="103" text-anchor="middle" fill="#5b21b6" font-size="11.5" font-weight="bold">Inheritance</text>
    <text x="286" y="122" text-anchor="middle" fill="#64748b" font-size="10">reuse code</text>
    <rect x="351" y="78" width="96" height="62" rx="8" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="399" y="103" text-anchor="middle" fill="#5b21b6" font-size="11.5" font-weight="bold">Polymorphism</text>
    <text x="399" y="122" text-anchor="middle" fill="#64748b" font-size="10">many forms</text>
  </g>
</svg>
</div>
<ul>
<li><strong>Encapsulation</strong> — keep data private, change it only through safe methods (like an ATM).</li>
<li><strong>Abstraction</strong> — show what's needed, hide the messy details (a steering wheel, not the engine).</li>
<li><strong>Inheritance</strong> — build on an existing class instead of copying code.</li>
<li><strong>Polymorphism</strong> — the same call behaves differently per object ("play" on a TV vs a speaker).</li>
</ul>
<h4>🎯 In the interview</h4>
<p>The usual warm-up. Lead with one sentence on the <em>why</em>, then name the four pillars <strong>with a one-line example each</strong>. Likely follow-ups: <em>"a downside of OOP?"</em> (deep inheritance gets rigid) · <em>"how is it different from procedural code?"</em></p>`,
    {
      reference_link: "https://docs.oracle.com/javase/tutorial/java/concepts/",
      task_description:
        "<strong>Practice:</strong> Pick a real thing (coffee machine, phone, account). List two pieces of data and two actions, sketch it as a class, and say which pillar each part shows.",
    },
  ),
  mockQ(
    -102,
    "beginner",
    "Easy",
    `${L1} What is the difference between a class and an object?`,
    `<p><strong>The gist:</strong> a <strong>class is a cookie cutter</strong>, <strong>objects are the cookies</strong>. The cutter sets the shape; each cookie is its own real thing.</p>
<p>A class is the <em>definition</em> — it lists the fields and methods but isn't a real value and uses no memory for that data by itself. An <strong>object</strong> is what you get with <code>new</code>: a real value in memory with its own copy of the fields.</p>
<div style="margin:12px 0;text-align:center">
<svg viewBox="0 0 460 140" width="460" height="140" style="max-width:100%;height:auto" role="img" aria-label="A class is a blueprint, objects are instances">
  <rect x="14" y="46" width="132" height="52" rx="8" fill="#eef2ff" stroke="#c7d2fe"/>
  <text x="80" y="70" text-anchor="middle" fill="#3730a3" font-family="sans-serif" font-size="12.5" font-weight="bold">class Car</text>
  <text x="80" y="87" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10">the blueprint</text>
  <line x1="150" y1="72" x2="206" y2="72" stroke="#7c3aed" stroke-width="2"/>
  <polygon points="206,66 219,72 206,78" fill="#7c3aed"/>
  <text x="180" y="62" text-anchor="middle" fill="#7c3aed" font-family="sans-serif" font-size="10">new</text>
  <rect x="230" y="22" width="150" height="40" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="305" y="46" text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="11">object a — "Tesla"</text>
  <rect x="230" y="82" width="150" height="40" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="305" y="106" text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="11">object b — "BMW"</text>
  <text x="416" y="76" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10">objects</text>
</svg>
</div>
<pre><code>class Car { String model; }   // blueprint (written once)

Car a = new Car(); a.model = "Tesla";   // one object
Car b = new Car(); b.model = "BMW";     // a separate object</code></pre>
<ul><li>One class → many objects.</li><li>Each object keeps its own state.</li><li>No memory for object data until you say <code>new</code>.</li></ul>
<h4>🎯 In the interview</h4>
<p>Give the blueprint-vs-instance line, then the consequence: two objects of one class are independent. Follow-ups: <em>"where do object fields live?"</em> (heap; the reference is on the stack) · <em>"what does <code>new</code> do?"</em> (allocates memory, runs the constructor, returns a reference).</p>`,
    {
      task_description:
        "<strong>Practice:</strong> Make a <code>Book</code> with <code>title</code> and <code>author</code>. Create three books, change one title, and confirm the others don't change — proving each has its own state.",
    },
  ),
  mockQ(
    -103,
    "basic",
    "Easy",
    `${L1} What is encapsulation and how do you do it in Java?`,
    `<p><strong>The gist:</strong> hide an object's data and only let it change through safe methods. Like an ATM — you go through deposit/withdraw, which check the rules first.</p>
<p>This protects the object's <em>invariants</em> (e.g. "balance never goes negative") and lets you change how the data is stored later without breaking any caller, since they only touch your methods.</p>
<h4>How you do it</h4>
<ul><li>Make the fields <code>private</code>.</li><li>Expose <code>public</code> methods that read/change them <em>with checks</em>.</li></ul>
<pre><code>public class Account {
    private double balance;               // locked away
    public double getBalance() { return balance; }
    public void deposit(double amount) {
        if (amount &lt;= 0) throw new IllegalArgumentException("amount must be &gt; 0");
        balance += amount;                // the only safe door in
    }
}</code></pre>
<h4>🎯 In the interview</h4>
<p>Say what it is, then the two payoffs: <strong>protects valid state</strong> and <strong>lets internals change freely</strong>. Follow-ups: <em>"is a getter+setter on every field real encapsulation?"</em> (no) · <em>"encapsulation vs abstraction?"</em> (hiding <em>data</em> vs hiding <em>complexity</em>).</p>
<blockquote><strong>Heads up:</strong> a getter and setter on every field isn't encapsulation — the point is to <em>protect</em> the data, not rubber-stamp access to it.</blockquote>`,
    {
      task_description:
        "<strong>Practice:</strong> Build a <code>Thermostat</code> with a private <code>temperature</code>. Allow only 16–30°; reject anything else. Try 5 and 40 (blocked), then 22 (works).",
    },
  ),
  mockQ(
    -104,
    "basic",
    "Medium",
    `${L2} What is the difference between overloading and overriding?`,
    `<p><strong>The gist:</strong> <strong>overloading</strong> = same method name, different inputs, same class (compiler picks it). <strong>Overriding</strong> = a child rewrites an inherited method with the same signature (JVM picks it at run time).</p>
<table>
<thead><tr><th></th><th>Overloading</th><th>Overriding</th></tr></thead>
<tbody>
<tr><td>Inputs</td><td>Must differ</td><td>Must be the same</td></tr>
<tr><td>Where</td><td>One class</td><td>Parent → child</td></tr>
<tr><td>Decided</td><td>Compile time</td><td>Run time</td></tr>
<tr><td>Marked with</td><td>nothing</td><td><code>@Override</code></td></tr>
</tbody>
</table>
<pre><code>class Printer {
    void print(String s) { }
    void print(int n) { }              // overload
}
class ColorPrinter extends Printer {
    @Override void print(String s) { } // override
}</code></pre>
<p>Hook: <em>overload = same name, new arguments</em>; <em>override = same everything, new behaviour</em>.</p>
<h4>🎯 In the interview</h4>
<p>The row that matters most is <strong>compile-time vs run-time</strong>. Follow-ups: <em>"overload by changing only the return type?"</em> (no) · <em>"override a <code>static</code> or <code>private</code> method?"</em> (no — statics are hidden, privates aren't visible to the child).</p>`,
    {
      task_description:
        "<strong>Practice:</strong> Overload <code>add</code> for <code>(int,int)</code> and <code>(double,double)</code>. Then override a parent's <code>describe()</code> in a subclass with <code>@Override</code> and see which runs.",
    },
  ),
  mockQ(
    -105,
    "intermediate",
    "Medium",
    `${L2} What is polymorphism (runtime vs compile-time)?`,
    `<p><strong>The gist:</strong> "many forms" — the same call does different things depending on the real object. You call <code>shape.area()</code>; the object decides what "area" means, so your code skips piles of <code>if/else</code>.</p>
<p>Two kinds: <strong>compile-time</strong> (overloading — the compiler picks from argument types) and <strong>run-time</strong> (overriding — decided while running, based on the real object). That run-time choice is <strong>dynamic dispatch</strong>, which is usually what "polymorphism" means.</p>
<div style="margin:12px 0;text-align:center">
<svg viewBox="0 0 300 264" width="300" height="264" style="max-width:100%;height:auto" role="img" aria-label="Dynamic dispatch flow">
  <g font-family="sans-serif">
    <rect x="20" y="8" width="260" height="44" rx="8" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="150" y="35" text-anchor="middle" fill="#3730a3" font-size="12">Shape s = new Circle();</text>
    <rect x="20" y="76" width="260" height="44" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="150" y="103" text-anchor="middle" fill="#334155" font-size="12">you call  s.area()</text>
    <rect x="20" y="144" width="260" height="44" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="150" y="166" text-anchor="middle" fill="#334155" font-size="11.5">JVM checks the REAL object</text>
    <text x="150" y="181" text-anchor="middle" fill="#64748b" font-size="10">not the Shape label — the Circle inside</text>
    <rect x="20" y="212" width="260" height="44" rx="8" fill="#7c3aed"/>
    <text x="150" y="239" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">Circle.area() runs</text>
    <line x1="150" y1="52" x2="150" y2="74" stroke="#94a3b8" stroke-width="1.5"/>
    <polygon points="144,74 150,84 156,74" fill="#94a3b8"/>
    <line x1="150" y1="120" x2="150" y2="142" stroke="#94a3b8" stroke-width="1.5"/>
    <polygon points="144,142 150,152 156,142" fill="#94a3b8"/>
    <line x1="150" y1="188" x2="150" y2="210" stroke="#94a3b8" stroke-width="1.5"/>
    <polygon points="144,210 150,220 156,210" fill="#94a3b8"/>
  </g>
</svg>
</div>
<pre><code>for (Shape s : List.of(new Circle(), new Square()))
    System.out.println(s.area());   // each prints its own area</code></pre>
<h4>🎯 In the interview</h4>
<p>Split it into compile-time (overloading) vs run-time (overriding) and name <strong>dynamic dispatch</strong>. Follow-ups: <em>"are fields polymorphic?"</em> (no — fields use the reference type) · <em>"how does the JVM find the method?"</em> (the object's vtable).</p>`,
    {
      task_description:
        "<strong>Practice:</strong> <code>Shape.area()</code> overridden by <code>Circle</code> and <code>Square</code>. Put them in a <code>List&lt;Shape&gt;</code>, loop once, and watch each print its own area — no <code>if/else</code>.",
    },
  ),
  mockQ(
    -106,
    "intermediate",
    "Medium",
    `${L2} Abstract class vs interface — which one and when?`,
    `<p><strong>The gist:</strong> use an <strong>interface</strong> for a <em>capability</em> different things can have ("can fly"); use an <strong>abstract class</strong> when related classes share real code and data.</p>
<p>An interface is a pure contract — unrelated classes can share it and a class can implement <em>many</em>. An abstract class is a half-built parent with fields, constructors and finished methods, but a class can extend only <em>one</em>.</p>
<table>
<thead><tr><th></th><th>Interface</th><th>Abstract class</th></tr></thead>
<tbody>
<tr><td>How many?</td><td>Many</td><td>One parent only</td></tr>
<tr><td>Holds state?</td><td>Constants only</td><td>Yes, real fields</td></tr>
<tr><td>Constructor?</td><td>No</td><td>Yes</td></tr>
<tr><td>Best for</td><td>A capability</td><td>Shared base for related types</td></tr>
</tbody>
</table>
<h4>🎯 In the interview</h4>
<p>Give the one-line rule, then the deciding fact: <strong>implement many interfaces, extend one class</strong>. Follow-up: <em>"Java 8 interfaces have default methods — why not always use interfaces?"</em> (they still can't hold instance state or constructors).</p>`,
    {
      task_description:
        "<strong>Practice:</strong> Interface <code>Playable.play()</code> implemented by <code>Song</code> and <code>Video</code>. Then an abstract <code>Media</code> holding a shared <code>title</code>. Note which one needed shared state.",
    },
  ),
  mockQ(
    -107,
    "intermediate",
    "Medium",
    `${L2} How do you know a method is really overriding? Does Spring give you @Override?`,
    `<p><strong>The gist:</strong> add <code>@Override</code> above the method — if it isn't really overriding a parent method, it won't compile. It's plain <strong>core Java</strong> (<code>java.lang</code>), <em>not</em> Spring.</p>
<p>The subtle bug it prevents: writing an <strong>overload</strong> by accident (slightly wrong parameter, or a lowercase letter) when you meant to override. Without the annotation the compiler stays silent and you get a confusing run-time bug; with it, the build fails right away. It has source retention — zero effect at run time.</p>
<pre><code>public class User {
    private String email;
    @Override
    public boolean equals(Object o) {        // really overrides Object.equals
        if (this == o) return true;
        if (!(o instanceof User)) return false;
        return email.equals(((User) o).email);
    }
}</code></pre>
<h4>🎯 In the interview</h4>
<p>Often a trap to see if you confuse Java with Spring. Answer crisply: <strong>core Java, compile-time check, no run-time effect</strong>. Follow-up: <em>"name a Spring annotation and contrast it"</em> — e.g. <code>@Autowired</code> does work at run time (injection), unlike <code>@Override</code>.</p>
<blockquote><strong>Heads up:</strong> "which Spring annotation verifies overrides?" — none. It's core Java.</blockquote>`,
    {
      reference_link: "https://docs.oracle.com/javase/8/docs/api/java/lang/Override.html",
      task_description:
        "<strong>Practice:</strong> Override <code>toString()</code> with <code>@Override</code>. Misspell it as <code>tostring</code> and watch the compiler complain — then remove the annotation and see the error (and bug) return.",
    },
  ),
  mockQ(
    -108,
    "advanced",
    "Hard",
    `${FINAL} What is the equals() and hashCode() rule everyone trips on?`,
    `<p><strong>The gist:</strong> <strong>equal objects must return the same hash code.</strong> Break it and <code>HashSet</code> / <code>HashMap</code> quietly misbehave.</p>
<p>Hash collections find items in two steps: <code>hashCode()</code> jumps to a "bucket", then <code>equals()</code> confirms the exact item. If two "equal" objects return different hash codes, they land in different buckets and are never compared — so you store something and then can't find it with an equal key.</p>
<div style="margin:12px 0;text-align:center">
<svg viewBox="0 0 340 168" width="340" height="168" style="max-width:100%;height:auto" role="img" aria-label="equals implies same hashCode">
  <g font-family="sans-serif">
    <rect x="40" y="10" width="260" height="44" rx="8" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="170" y="37" text-anchor="middle" fill="#3730a3" font-size="12">a.equals(b) is true</text>
    <line x1="170" y1="54" x2="170" y2="84" stroke="#94a3b8" stroke-width="1.5"/>
    <polygon points="164,84 170,94 176,84" fill="#94a3b8"/>
    <text x="170" y="73" text-anchor="middle" fill="#64748b" font-size="10">then Java requires</text>
    <rect x="40" y="94" width="260" height="44" rx="8" fill="#7c3aed"/>
    <text x="170" y="121" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">a.hashCode() == b.hashCode()</text>
    <text x="170" y="156" text-anchor="middle" fill="#64748b" font-size="10">(the reverse is NOT promised — collisions are allowed)</text>
  </g>
</svg>
</div>
<p>Rule of thumb: <strong>override both together, from the same fields.</strong> Two different objects sharing a hash code (a "collision") is fine — <code>equals()</code> sorts them out.</p>
<pre><code>@Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof User)) return false;
    return Objects.equals(email, ((User) o).email);
}
@Override public int hashCode() { return Objects.hash(email); }  // same field</code></pre>
<h4>🎯 In the interview</h4>
<p>A senior-level filter. Be ready for: <em>"what breaks if you override only <code>equals()</code>?"</em> (objects "vanish" from hash collections) · <em>"can unequal objects share a hash code?"</em> (yes) · <em>"what's a good hashCode?"</em> (cheap, stable, well-spread — usually <code>Objects.hash(...)</code>).</p>
<blockquote><strong>Heads up:</strong> the classic bug is overriding <code>equals()</code> but not <code>hashCode()</code> — the object then "disappears" from a <code>HashSet</code>.</blockquote>`,
    {
      reference_link: "https://docs.oracle.com/javase/8/docs/api/java/lang/Object.html",
      task_description:
        "<strong>Practice:</strong> <code>Employee</code> with <code>id</code> + <code>email</code>. Override <code>equals()</code> only, add two equal employees to a <code>HashSet</code> → size 2. Add <code>hashCode()</code> from the same fields → size 1.",
    },
  ),
];

/**
 * Plain-language metadata for each learning stage so admins instantly
 * understand where a candidate is and what to do next.
 */
const STAGE_META: Record<
  string,
  { label: string; hint: string; nextStep: string; Icon: typeof Circle; badge: string; iconColor: string }
> = {
  assigned: {
    label: "Not started",
    hint: "Assigned but hasn't opened the course yet.",
    nextStep: "Send a reminder",
    Icon: Circle,
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    iconColor: "text-slate-400",
  },
  in_progress: {
    label: "Learning",
    hint: "Actively working through the course.",
    nextStep: "On track",
    Icon: Hourglass,
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
    iconColor: "text-amber-500",
  },
  completed: {
    label: "Completed",
    hint: "Finished every assigned question.",
    nextStep: "All done",
    Icon: CheckCircle,
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    iconColor: "text-emerald-500",
  },
};

/** Human-friendly "time ago" for last-activity / dates. */
const timeAgo = (dateString?: string): string | null => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m > 1 ? "s" : ""} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
};

/** Friendly deadline summary relative to today. */
const deadlineInfo = (
  due?: string,
  progress = 0
): { label: string; tone: "danger" | "warn" | "success" | "muted"; Icon: typeof Circle } => {
  if (progress >= 100) return { label: "Completed on time", tone: "success", Icon: CheckCircle };
  if (!due) return { label: "No deadline", tone: "muted", Icon: CalendarClock };
  const d = new Date(due);
  if (isNaN(d.getTime())) return { label: "No deadline", tone: "muted", Icon: CalendarClock };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const days = Math.round((dd.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    const n = Math.abs(days);
    return { label: `Overdue by ${n} day${n > 1 ? "s" : ""}`, tone: "danger", Icon: AlertTriangle };
  }
  if (days === 0) return { label: "Due today", tone: "warn", Icon: CalendarClock };
  if (days === 1) return { label: "Due tomorrow", tone: "warn", Icon: CalendarClock };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "warn", Icon: CalendarClock };
  return { label: `Due in ${days} days`, tone: "muted", Icon: CalendarClock };
};

const DEADLINE_TONE: Record<string, string> = {
  danger: "text-red-600",
  warn: "text-amber-600",
  success: "text-emerald-600",
  muted: "text-slate-500",
};

const DIFFICULTY_CHOICES = [
  { value: "all", label: "All Difficulties" },
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
];

/** Difficulty pill styling (Easy / Medium / Hard). */
const DIFFICULTY_META: Record<string, { badge: string; dot: string }> = {
  Easy: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  Medium: { badge: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  Hard: { badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

/** Module-level group styling (beginner / basic / intermediate / advanced). */
const LEVEL_META: Record<string, { gradient: string; soft: string; text: string; ring: string }> = {
  beginner: { gradient: "from-emerald-500 to-green-600", soft: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  basic: { gradient: "from-sky-500 to-blue-600", soft: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200" },
  intermediate: { gradient: "from-violet-500 to-purple-600", soft: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  advanced: { gradient: "from-rose-500 to-red-600", soft: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
};

const MODULE_LEVEL_FILTERS = [
  { value: "all", label: "All Levels" },
  ...MODULE_LEVEL_CHOICES
];

const QuestionManagement = ({
  technologyId,
  technologyName,
  onBack,
  candidatesData,
}: QuestionManagementProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal states for candidates
  const [modalType, setModalType] = useState<'all' | 'completed' | 'inProgress'>('all');
  const [modalTitle, setModalTitle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Import modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{ created: number; errors: string[] } | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [moduleLevelFilter, setModuleLevelFilter] = useState("all");
  const { id } = useParams();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const [questionFormData, setQuestionFormData] = useState({
    question: "",
    answer: "",
    difficulty: "Medium" as "Easy" | "Medium" | "Hard",
    module_level: "basic" as "beginner" | "basic" | "intermediate" | "advanced",
    reference_link: "",
    task_description: "",
  });

  const [rawCandidatesData, setRawCandidatesData] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [deleteAssignmentMut] = useDeleteAssignmentMutation();
  const [unassignAssignmentMut] = useUnassignAssignmentMutation();
  const { data: techQueryData, isLoading: techQueryLoading, refetch: refetchTechnologies } = useGetTechnologiesQuery({});
  const [fetchTechnologyQuestions] = useLazyGetTechnologyQuestionsQuery();
  const [updateTechQuestionMut] = useUpdateTechQuestionMutation();
  const [addTechQuestionMut] = useAddTechQuestionMutation();
  const [deleteTechQuestionMut] = useDeleteTechQuestionMutation();
  const [uploadQuestionsMut] = useUploadQuestionsMutation();

  const fetchAllTechnologyQuestions = async (initialUrl: string): Promise<Question[]> => {
    const accumulated: Question[] = [];
    let url: string | null = initialUrl;
    const seen = new Set<string>();
    const MAX_PAGES = 50; // hard safety cap so the loop can never run forever

    while (url && seen.size < MAX_PAGES) {
      // Guard against a server returning a `next` that points back to a page
      // we've already fetched (which would otherwise loop forever).
      if (seen.has(url)) {
        console.warn("[QuestionManagement] Pagination loop detected, stopping at", url);
        break;
      }
      seen.add(url);

      const pageData = await fetchTechnologyQuestions(url).unwrap();
      // Support both paginated ({ results, next }) and bare-array responses.
      const pageResults: Question[] = Array.isArray(pageData)
        ? pageData
        : pageData?.results ?? [];
      accumulated.push(...pageResults);

      const next: string | null = Array.isArray(pageData) ? null : pageData?.next || null;
      // If the server echoes the same URL back as `next`, stop.
      url = next && next !== url ? next : null;
    }

    if (seen.size >= MAX_PAGES) {
      console.warn(`[QuestionManagement] Stopped paginating after ${MAX_PAGES} pages.`);
    }

    return accumulated;
  };
  const [sendReminderMut] = useSendReminderEmailMutation();
  const [downloadQuestionTemplate] = useLazyDownloadQuestionTemplateQuery();

  // Refs to prevent duplicate API calls - single source of truth
  const isFetchingQuestions = useRef(false);

  const { assignedCandidates, completedCandidates, inProgressCandidates } = useMemo(() => {
  if (!rawCandidatesData || rawCandidatesData.length === 0) {
    return { assignedCandidates: [], completedCandidates: [], inProgressCandidates: [] };
  }

  const transformedCandidates: Candidate[] = rawCandidatesData.map((candidate: any) => {
    const nameParts = (candidate.name || "").trim().split(" ");
    return {
      id: parseInt(candidate.userId || candidate.id || "0"),
      username: (candidate.name || "").toLowerCase().replace(/\s+/g, "."),
      email: candidate.email || "",
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      phone: "",
      profile: null,
      role: "candidate",
      date_joined: new Date().toISOString(),
      resume_s3_url: null,
      learning_assignments: [
        {
          technology_id: technologyId,
          technology_name: technologyName,
          assigned_at: candidate.assigned_at || "",
          due_at: candidate.due_at || "",
          notes: "",
          progress: candidate.progress || 0,
          completed: candidate.completed || 0,
          total: candidate.total || 0,
          user_notes: candidate.user_notes || null,
          assignment_id: candidate.assignment_id,
          last_active_at: candidate.last_active_at || null,
          status:
            candidate.progress >= 100
              ? "completed"
              : candidate.progress > 0
              ? "in_progress"
              : "assigned",
        },
      ],
    };
  });

  return {
    assignedCandidates: transformedCandidates,
    completedCandidates: transformedCandidates.filter(
      (c) => c.learning_assignments[0]?.progress >= 100
    ),
    inProgressCandidates: transformedCandidates.filter(
      (c) =>
        c.learning_assignments[0]?.progress > 0 &&
        c.learning_assignments[0]?.progress < 100
    ),
  };
}, [rawCandidatesData, technologyId, technologyName]);

  // Helper function to determine status from progress
  const getAssignmentStatus = (progress: number) => {
    if (progress >= 100) return 'completed';
    if (progress > 0 && progress < 100) return 'in_progress';
    return 'assigned'; // progress === 0
  };

  // Get assignment status display - UPDATED VERSION
  const getAssignmentStatusDisplay = (statusOrProgress: string | number) => {
    // If it's a number (progress), determine status
    if (typeof statusOrProgress === 'number') {
      const status = getAssignmentStatus(statusOrProgress);
      switch (status) {
        case 'completed':
          return 'Completed';
        case 'in_progress':
          return 'In Progress';
        case 'assigned':
          return 'Assigned';
        default:
          return 'Assigned';
      }
    }

    // If it's a string (status), use the old logic
    const status = statusOrProgress as string;
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'assigned':
        return 'Assigned';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  // Get assignment status color - UPDATED VERSION
  const getAssignmentStatusColor = (statusOrProgress: string | number) => {
    // If it's a number (progress), determine status
    if (typeof statusOrProgress === 'number') {
      const status = getAssignmentStatus(statusOrProgress);
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-800';
        case 'in_progress':
          return 'bg-amber-100 text-amber-800';
        case 'assigned':
          return 'bg-blue-100 text-blue-800';
        default:
          return 'bg-blue-100 text-blue-800';
      }
    }

    // If it's a string (status), use the old logic
    const status = statusOrProgress as string;
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (dateString: string) => {
    if (!dateString) return false;
    const due = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Check if candidate is completed
  const isCandidateCompleted = (assignments: LearningAssignment[]) => {
    return assignments.some(assignment => {
      const statusLower = assignment.status?.toLowerCase() || '';
      return statusLower === 'completed' || assignment.progress >= 100;
    });
  };

  // Check if candidate is in progress
  const isCandidateInProgress = (assignments: LearningAssignment[]) => {
    return assignments.some(assignment => {
      const statusLower = assignment.status?.toLowerCase() || '';
      return (statusLower === 'in_progress' ||
        statusLower === 'inprogress' ||
        assignment.status === 'in progress' ||
        assignment.status === 'In Progress' ||
        (assignment.progress > 0 && assignment.progress < 100));
    });
  };

  // Format date without time
  const formatSimpleDate = (dateString: string) =>
    formatDateValue(dateString, { month: "short", day: "numeric", year: "numeric" }, dateString);

  // Close modal handler
  const handleCloseModal = () => {
    setShowModal(false);
    setCandidates([]);
  };

  // Unassign a candidate from this technology
  const handleUnassignCandidate = async (candidateItem: Candidate) => {
    const assignment = candidateItem.learning_assignments.find(
      (a) => a.technology_id === technologyId
    );
    const assignmentId = assignment?.assignment_id;

    try {
      try {
        await deleteAssignmentMut(assignmentId).unwrap();
      } catch (deleteError: any) {
        if (deleteError.status === 404 || deleteError.status === 405) {
          await unassignAssignmentMut(assignmentId).unwrap();
        } else {
          throw deleteError;
        }
      }

      toast({
        title: "Success",
        description: "Assignment unassigned successfully.",
        variant: "success",
        duration: 3000,
      });

      // Refresh candidate lists/counts by triggering a re-render
      // This will cause the useMemo to recalculate with updated data
      window.location.reload();
    } catch (error: any) {
      console.error("Error unassigning candidate:", error);
      let errorMessage = "Failed to unassign. Please try again.";
      if (error.data?.detail) errorMessage = error.data.detail;
      else if (error.data?.message) errorMessage = error.data.message;

      toast({
        title: "Unassign Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Send reminder email to a candidate for this technology
  const handleSendReminder = async (candidateItem: Candidate) => {
    const assignment = candidateItem.learning_assignments.find(
      (a) => a.technology_id === technologyId
    );
    const assignmentId = (assignment as any)?.assignment_id || (assignment as any)?.id;

    try {
      let data;
      if (assignmentId) {
        data = await sendReminderMut({
          url: `/api/candidates/${candidateItem.id}/assignments/${assignmentId}/send-reminder-email/`,
          data: {},
        }).unwrap();
      } else {
        // Fallback: candidate-scoped reminder endpoint
        data = await sendReminderMut({
          url: `/api/candidates/${candidateItem.id}/assignments/send-reminder-email/`,
          data: { technology_id: technologyId },
        }).unwrap();
      }

      toast({
        title: "Success",
        description: data?.message || "Reminder email sent successfully",
        variant: "success",
        duration: 3000,
      });

      // Optionally refresh candidate data
      // await fetchCandidatesData();
    } catch (error: any) {
      console.error("Error sending reminder:", error);
      let errorMessage = "Failed to send reminder. Please try again.";
      if (error.data?.error) errorMessage = error.data.error;
      else if (error.data?.message) errorMessage = error.data.message;

      toast({
        title: "Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  const [getCandidates] = useLazyGetCandidatesQuery();

  const buildCandidatesUrl = useCallback(() => {
      return `/api/technologies/${id || technologyId}/candidates/`;
  }, [id, technologyId]);

  const ITEMS_PER_PAGE = 20;

  const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });
  
  const fetchCandidates = useCallback(async (page: number = 1) => {
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
        const endpoint = buildCandidatesUrl();
        const data = await getCandidates(endpoint, true).unwrap();

        setRawCandidatesData(Array.isArray(data) ? data : data.results || []);

    } catch (error) {
        console.error("Failed to fetch candidates:", error);
        toast({
            title: "Failed",
            description: "Failed to fetch candidates",
            variant: "destructive",
            duration: 3000
        });
    } finally {
        setCandidatesLoading(false); 
    }
}, [buildCandidatesUrl, getCandidates, toast]);

  useEffect(() => {
    fetchCandidates();
}, [id, technologyId]);


  const formatSimpleDateTime = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Open modal handler - uses already loaded data
  const handleOpenModal = (type: 'all' | 'completed' | 'inProgress') => {
    setModalType(type);
    setModalTitle(
      type === 'all'
        ? 'All Assigned Candidates'
        : type === 'completed'
          ? 'Completed Candidates'
          : 'In Progress Candidates'
    );
    setShowModal(true);

    // Filter from already loaded data
    let filteredCandidates: Candidate[] = [];

    if (type === 'all') {
      filteredCandidates = assignedCandidates;
    } else if (type === 'completed') {
      filteredCandidates = completedCandidates;
    } else if (type === 'inProgress') {
      filteredCandidates = inProgressCandidates;
    }

    setCandidates(filteredCandidates);
  };

  // Derive technologies from auto-fetch query
  useEffect(() => {
    if (techQueryData) {
      const technologiesData = techQueryData.results || [];
      const technologiesWithCounts = technologiesData.map((tech: any) => ({
        id: tech.id,
        name: tech.name,
        description: tech.description,
        category: tech.category,
        questionCount: tech.total_questions,
        assignedUsersCount: tech.total_assigned_users,
      }));
      setTechnologies(technologiesWithCounts);
      setIsLoading(false);
    }
  }, [techQueryData]);

  // Sync loading state from query
  useEffect(() => {
    if (techQueryLoading) {
      setIsLoading(true);
    }
  }, [techQueryLoading]);

  // Fetch questions for the specific technology
  const fetchQuestions = async () => {
    // Guard: prevent concurrent calls
    if (isFetchingQuestions.current) return;
    isFetchingQuestions.current = true;

    try {
      setIsQuestionsLoading(true);
      const data = await fetchAllTechnologyQuestions(
        `api/technologies/${technologyId}/questions/?page_size=100`
      );
      // MOCK PREVIEW: fall back to sample Q&A when this technology has none yet,
      // so the layout is reviewable. Remove MOCK_QUESTIONS to disable.
      setQuestions(Array.isArray(data) && data.length > 0 ? data : MOCK_QUESTIONS);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast({
        title: "Error fetching questions",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsQuestionsLoading(false);
      isFetchingQuestions.current = false;
    }
  };

  // Fetch questions only on mount/technologyId change
  useEffect(() => {
    fetchQuestions();
  }, [technologyId]);

  const filteredQuestions = useMemo(() => {
    let filtered = questions;
    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.answer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(q => q.difficulty === difficultyFilter);
    }
    if (moduleLevelFilter !== "all") {
      filtered = filtered.filter(q => q.module_level === moduleLevelFilter);
    }
    return filtered;
  }, [searchTerm, difficultyFilter, moduleLevelFilter, questions]);

  const groupedQuestions = useMemo(() => {
    return filteredQuestions.reduce((acc, question) => {
      const level = question.module_level;
      if (!acc[level]) {
        acc[level] = [];
      }
      acc[level].push(question);
      return acc;
    }, {} as Record<string, Question[]>);
  }, [filteredQuestions]);

  const sortedModuleLevels = useMemo(() =>
    MODULE_LEVEL_CHOICES.map(level => level.value).filter(level => groupedQuestions[level]),
    [groupedQuestions]
  );

  const toggleQuestion = (id: number) => {
    const newSet = new Set(expandedQuestions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedQuestions(newSet);
    if (newSet.size === filteredQuestions.length && filteredQuestions.length > 0) {
      setShowAll(true);
    } else if (newSet.size === 0) {
      setShowAll(false);
    }
  };

  const toggleAll = () => {
    if (showAll) {
      setExpandedQuestions(new Set());
    } else {
      const allIds = filteredQuestions.map(q => q.id);
      setExpandedQuestions(new Set(allIds));
    }
    setShowAll(!showAll);
  };

  const levelLabelFor = (value: string) =>
    MODULE_LEVEL_CHOICES.find((m) => m.value === value)?.label || value;

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionFormData.question.trim() || !questionFormData.answer.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both question and answer",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        question: questionFormData.question,
        answer: questionFormData.answer,
        difficulty: questionFormData.difficulty,
        module_level: questionFormData.module_level,
        reference_link: questionFormData.reference_link || undefined,
        task_description: questionFormData.task_description || undefined,
      };

      if (editingQuestionId) {
        // Update existing question using PATCH
        await updateTechQuestionMut({
          technologyId: (technologyId),
          questionId: editingQuestionId,
          data: payload,
        }).unwrap();
        toast({
          title: "Success",
          description: "Question updated successfully",
          variant: "success",
          duration: 3000
        });
      } else {
        // Add new question
        await addTechQuestionMut({
          technologyId: (technologyId),
          data: payload,
        }).unwrap();
        toast({
          title: "Success",
          description: "Question added successfully",
          variant: "success",
          duration: 3000
        });
      }

      // Reset form
      setQuestionFormData({
        question: "",
        answer: "",
        difficulty: "Medium",
        module_level: "basic",
        reference_link: "",
        task_description: "",
      });
      setShowAddQuestionForm(false);
      setEditingQuestionId(null);

      // Refresh questions
      await fetchQuestions();
    } catch (error) {
      console.error("Error saving question:", error);
      toast({
        title: `Failed to ${editingQuestionId ? 'update' : 'add'} question`,
        description: "Please try again.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (questionId: number) => {
    if (!window.confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      await deleteTechQuestionMut({
        technologyId: (technologyId),
        questionId,
      }).unwrap();

      toast({
        title: "Success",
        description: "Question deleted successfully",
        variant: "success",
        duration: 3000
      });

      // Refresh questions
      await fetchQuestions();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast({
        title: "Failed to delete question",
        description: "Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // Edit question
  const handleEditQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setQuestionFormData({
      question: question.question,
      answer: question.answer,
      difficulty: question.difficulty,
      module_level: question.module_level,
      reference_link: question.reference_link || "",
      task_description: question.task_description || "",
    });
    setShowAddQuestionForm(true);
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const templateBlob = await downloadQuestionTemplate().unwrap();

      // Create a blob from the response
      const blob = new Blob([templateBlob], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `question-template-${technologyName}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      toast({
        title: "Template Downloaded",
        description: "Question template downloaded successfully",
        duration: 3000
      });
    } catch (error) {
      console.error("Error downloading template:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download template. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file extension
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV or Excel file",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
          duration: 3000
        });
        return;
      }

      setSelectedFile(file);
      setImportStatus(null); // Reset previous import status
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const responseData = await uploadQuestionsMut({
        technologyId: technologyId,
        data: formData,
      }).unwrap();

      setImportStatus({
        created: responseData.created || 0,
        errors: responseData.errors || []
      });

      if (responseData.created > 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${responseData.created} questions`,
          variant: "success",
          duration: 3000
        });

        // Refresh questions after a short delay
        setTimeout(() => {
          fetchQuestions();
        }, 1000);
      }

      if (responseData.errors && responseData.errors.length > 0) {
        toast({
          title: "Import Completed with Errors",
          description: `${responseData.created} imported, ${responseData.errors.length} errors`,
          variant: "warning",
          duration: 5000
        });
      }

    } catch (error: any) {
      console.error("Error importing questions:", error);

      let errorMessage = "Failed to import questions";
      if (error.data?.detail) {
        errorMessage = error.data.detail;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }

      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset import modal
  const resetImportModal = () => {
    setSelectedFile(null);
    setImportStatus(null);
    setShowImportModal(false);
  };

  // Load data on component mount
  useEffect(() => {
    // Reset initialized flag when technologyId changes
    isFetchingQuestions.current = false;
  }, [technologyId]);

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "default";
      case "Hard": return "destructive";
      default: return "secondary";
    }
  };

  const getModuleLevelVariant = (level: string) => {
    switch (level) {
      case "beginner": return "default";
      case "basic": return "secondary";
      case "intermediate": return "outline";
      case "advanced": return "destructive";
      default: return "secondary";
    }
  };

  const formatDate = (dateString: string) =>
    formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, dateString);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-slate-800">Import Questions</h2>
                  <button
                    onClick={resetImportModal}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* File Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${selectedFile
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileUp className="w-8 h-8 text-green-500 mx-auto" />
                        <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                        <p className="text-xs text-green-600">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-medium text-slate-700">
                          Drag & drop your file here
                        </p>
                        <p className="text-xs text-slate-500">
                          or click to browse (CSV, XLSX, XLS)
                        </p>
                        <p className="text-xs text-slate-400 mt-2">Max file size: 10MB</p>
                      </div>
                    )}
                  </div>

                  {/* Import Results */}
                  {importStatus && (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Results:</span>
                        <span className="text-sm font-semibold text-green-600">
                          {importStatus.created} imported
                        </span>
                      </div>

                      {importStatus.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-600 mb-1">Errors:</p>
                          <div className="max-h-32 overflow-y-auto">
                            {importStatus.errors.map((error, index) => (
                              <p key={index} className="text-xs text-red-500 mb-1">
                                • {error}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import Instructions */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-blue-700 mb-1">Import Instructions:</h4>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• Use the downloaded template for correct format</li>
                      <li>• Required columns: Question, Answer, Difficulty</li>
                      <li>• Optional columns: Module_Level, Reference_Link, Task_Description</li>
                      <li>• Difficulty: Easy, Medium, Hard</li>
                      <li>• Module Level: beginner, basic, intermediate, advanced</li>
                      <li>• Answer &amp; Task support formatting: <code className="rounded bg-white/70 px-1">## heading</code>, <code className="rounded bg-white/70 px-1">- list</code>, <code className="rounded bg-white/70 px-1">**bold**</code>, <code className="rounded bg-white/70 px-1">`code`</code>, code blocks. Wrap multi-line cells in quotes.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={resetImportModal}
                    className="px-4 py-2 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors"
                    disabled={isImporting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!selectedFile || isImporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import Questions
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              title="Go back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-brand-violet/40 hover:text-brand-violet"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">Manage Questions</h1>
              <p className="truncate text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{technologyName}</span> · {questions.length} questions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              title="Download Question Template"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-violet/40 hover:text-brand-violet"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Template</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              title="Import Questions from Excel"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-violet/40 hover:text-brand-violet"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={() => navigate(`/admin/assign-study-materials/${technologyId}`)}
              title="Assign to Candidate"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-violet/40 hover:text-brand-violet"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Assign</span>
            </button>

            <button
              onClick={() => {
                setShowAddQuestionForm(true);
                setEditingQuestionId(null);
                setQuestionFormData({
                  question: "",
                  answer: "",
                  difficulty: "Medium",
                  module_level: "basic",
                  reference_link: "",
                  task_description: "",
                });
              }}
              title="Add Question"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#ff5a1f]"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Total Assigned"
            value={assignedCandidates.length}
            icon={Users}
            gradient="from-brand-purple to-brand-violet"
            onClick={() => handleOpenModal('all')}
          />
          <StatCard
            index={1}
            label="Completed"
            value={completedCandidates.length}
            icon={CheckCircle}
            gradient="from-[#0e9f6e] to-[#23c366]"
            onClick={() => handleOpenModal('completed')}
          />
          <StatCard
            index={2}
            label="In Progress"
            value={inProgressCandidates.length}
            icon={Clock}
            gradient="from-[#c2790b] to-[#eab40b]"
            onClick={() => handleOpenModal('inProgress')}
          />
          <StatCard
            index={3}
            label="Total Questions"
            value={questions.length}
            icon={FileText}
            gradient="from-[#5b21b6] to-[#9d5bd2]"
          />
        </div>
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-800">
              Recent Candidates Activity
            </h2>
          </div>

          <TooltipProvider delayDuration={150}>
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="min-w-[200px] px-4 py-3">Candidate</th>
                    <th className="min-w-[150px] px-4 py-3">Stage</th>
                    <th className="min-w-[170px] px-4 py-3">Course Progress</th>
                    <th className="min-w-[150px] px-4 py-3">Deadline</th>
                    <th className="min-w-[120px] px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidatesLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet" />
                          <span className="text-sm">Loading candidates…</span>
                        </div>
                      </td>
                    </tr>
                  ) : candidatesError ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-red-500 text-sm">
                        {candidatesError}
                      </td>
                    </tr>
                  ) : assignedCandidates && assignedCandidates.length > 0 ? (
                    assignedCandidates
                      .sort((a, b) => {
                        const dateA = a.learning_assignments[0]?.last_active_at || a.learning_assignments[0]?.assigned_at || '';
                        const dateB = b.learning_assignments[0]?.last_active_at || b.learning_assignments[0]?.assigned_at || '';
                        return new Date(dateB).getTime() - new Date(dateA).getTime();
                      })
                      .slice(0, 4)
                      .map((candidate) => {
                        const assignment = candidate.learning_assignments[0];
                        const progress = Math.round(assignment.progress || 0);
                        const status = getAssignmentStatus(progress);
                        const stage = STAGE_META[status] || STAGE_META.assigned;
                        const overdue = isOverdue(assignment.due_at) && progress < 100;
                        const nextStep = overdue ? "Follow up — overdue" : stage.nextStep;
                        const dl = deadlineInfo(assignment.due_at, progress);
                        const lastSeen = timeAgo(assignment.last_active_at);

                        return (
                          <tr
                            key={candidate.id}
                            className="cursor-pointer transition-colors hover:bg-violet-50/40"
                            onClick={() => navigate(`/admin/learner/${candidate.id}`)}
                          >
                            {/* Candidate */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold text-white">
                                  {candidate.first_name?.charAt(0)}{candidate.last_name?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-800">
                                    {candidate.first_name} {candidate.last_name}
                                  </div>
                                  <div className="max-w-[160px] truncate text-[10px] text-slate-500">
                                    {candidate.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Stage + next step */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${stage.badge}`}>
                                      <stage.Icon className={`h-3 w-3 ${stage.iconColor}`} />
                                      {stage.label}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{stage.hint}</TooltipContent>
                                </Tooltip>
                                <span className={`text-[10px] ${overdue ? "font-semibold text-red-500" : "text-slate-400"}`}>
                                  {nextStep}
                                </span>
                              </div>
                            </td>

                            {/* Course Progress */}
                            <td className="px-4 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="max-w-[150px]">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-medium text-slate-600">
                                        {assignment.completed} of {assignment.total} questions
                                      </span>
                                      <span className="text-[11px] font-bold text-slate-800">{progress}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className={`h-full rounded-full ${getProgressColor(progress)}`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Completed {assignment.completed} of {assignment.total} questions ({progress}%)
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* Deadline */}
                            <td className="px-4 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${DEADLINE_TONE[dl.tone]}`}>
                                    <dl.Icon className="h-3.5 w-3.5" />
                                    {dl.label}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-0.5 text-xs">
                                    <div>Assigned: {assignment.assigned_at ? formatSimpleDate(assignment.assigned_at) : "—"}</div>
                                    <div>Due: {assignment.due_at ? formatSimpleDate(assignment.due_at) : "No deadline"}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>

                            {/* Last Seen */}
                            <td className="px-4 py-3">
                              {lastSeen ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                      <Activity className="h-3.5 w-3.5 text-slate-400" />
                                      {lastSeen}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>Last active on {formatSimpleDate(assignment.last_active_at)}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                  <Circle className="h-3 w-3" />
                                  Never opened
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSendReminder(candidate); }}
                                      className="rounded-lg border border-slate-200 p-1.5 text-brand-violet transition-colors hover:bg-violet-50"
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Send a reminder email</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/learner/${candidate.id}`); }}
                                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>View full progress</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Are you sure you want to unassign this candidate?')) {
                                          handleUnassignCandidate(candidate);
                                        }
                                      }}
                                      className="rounded-lg border border-slate-200 p-1.5 text-red-600 transition-colors hover:bg-red-50"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove from this course</TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No candidates assigned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {assignedCandidates && assignedCandidates.length > 4 && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center">
                <button
                  onClick={() => handleOpenModal('all')}
                  className="text-xs font-medium text-brand-violet hover:text-brand-purple"
                >
                  View all {assignedCandidates.length} candidates →
                </button>
              </div>
            )}
          </div>
          </TooltipProvider>
        </div>

        {/* Questions List and Add/Edit Form */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
          {/* Questions List */}
          <Card className={`${showAddQuestionForm ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-2xl border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)] transition-all duration-300`}>

            <div className="border-b border-slate-100 px-5 pb-4 pt-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Questions</h3>
                    <p className="text-xs text-slate-500">Browse, search &amp; manage the question bank</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={filteredQuestions.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-brand-violet/40 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showAll ? "Collapse all" : "Expand all"}
                </button>
              </div>

              <QuestionsToolbar
                search={searchTerm}
                onSearchChange={setSearchTerm}
                difficulty={difficultyFilter}
                onDifficultyChange={setDifficultyFilter}
                level={moduleLevelFilter}
                onLevelChange={setModuleLevelFilter}
                difficultyOptions={DIFFICULTY_CHOICES}
                levelOptions={MODULE_LEVEL_FILTERS}
                levelLabel={levelLabelFor}
                resultCount={filteredQuestions.length}
                totalCount={questions.length}
              />
            </div>
            <CardContent className="p-4 pt-3">
              <ScrollArea className="h-[600px] pr-2">
                {isQuestionsLoading ? (
                  <div className="space-y-2.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <div className="h-6 w-6 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                          <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : filteredQuestions.length > 0 ? (
                  <div className="space-y-5">
                    {sortedModuleLevels.map((moduleLevel) => {
                      const lvl = LEVEL_META[moduleLevel] || LEVEL_META.basic;
                      return (
                        <div key={moduleLevel} className="space-y-2.5">
                          {/* group header */}
                          <div className="flex items-center gap-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset", lvl.soft, lvl.text, lvl.ring)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full bg-gradient-to-r", lvl.gradient)} />
                              {moduleLevel}
                              <span className="rounded-full bg-white/70 px-1.5 text-[10px]">{groupedQuestions[moduleLevel].length}</span>
                            </span>
                            <div className="h-px flex-1 bg-slate-100" />
                          </div>

                          {/* questions */}
                          <div className="space-y-2.5">
                            {groupedQuestions[moduleLevel].map((question, index) => {
                              const isAnswerVisible = expandedQuestions.has(question.id);
                              const diff = DIFFICULTY_META[question.difficulty] || DIFFICULTY_META.Medium;
                              return (
                                <div
                                  key={question.id}
                                  className={cn(
                                    "group/q overflow-hidden rounded-xl border bg-white transition-all duration-200",
                                    isAnswerVisible
                                      ? "border-brand-violet/30 shadow-[0_10px_28px_-18px_rgba(61,7,95,0.45)]"
                                      : "border-slate-200 hover:border-slate-300 hover:shadow-[0_6px_18px_-14px_rgba(15,23,42,0.4)]"
                                  )}
                                >
                                  {/* header row */}
                                  <div className="flex items-start gap-3 p-3">
                                    <div
                                      onClick={() => toggleQuestion(question.id)}
                                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                                    >
                                      <span className="mt-0.5 flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple to-brand-violet px-1.5 text-[10px] font-bold text-white">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div
                                          className={cn("prose prose-sm max-w-none text-sm font-medium leading-snug text-slate-800", !isAnswerVisible && "line-clamp-2")}
                                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }}
                                        />
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", diff.badge)}>
                                            <span className={cn("h-1.5 w-1.5 rounded-full", diff.dot)} />
                                            {question.difficulty}
                                          </span>
                                          {question.reference_link && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                              <Link className="h-2.5 w-2.5" /> Reference
                                            </span>
                                          )}
                                          {question.task_description && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                              <FileText className="h-2.5 w-2.5" /> Task
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* actions */}
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditQuestion(question); }}
                                        title="Edit question"
                                        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all duration-200 hover:bg-violet-50 hover:text-brand-violet focus:opacity-100 group-hover/q:opacity-100"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(question.id); }}
                                        title="Delete question"
                                        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover/q:opacity-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => toggleQuestion(question.id)}
                                        title={isAnswerVisible ? "Hide answer" : "Show answer"}
                                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-brand-violet"
                                      >
                                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isAnswerVisible && "rotate-180")} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* expanded answer */}
                                  <AnimatePresence initial={false}>
                                    {isAnswerVisible && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                      >
                                        <div className="border-t border-slate-100 bg-gradient-to-b from-violet-50/40 to-white">
                                          <div className="space-y-3 p-4">
                                            {/* Answer */}
                                            <section className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-brand-purple to-brand-violet text-white">
                                                  <CheckCircle className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Answer</span>
                                              </div>
                                              <div
                                                className="prose prose-sm max-w-none px-3.5 py-3 leading-relaxed text-slate-700 prose-headings:text-slate-800 prose-strong:font-semibold prose-strong:text-slate-800 prose-a:font-medium prose-a:text-brand-violet prose-code:rounded prose-code:bg-violet-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:text-brand-violet prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-p:my-1.5 prose-li:my-0.5 prose-img:rounded-lg [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal [&_pre_code]:text-slate-100 [&_pre_code]:text-[12.5px] [&_pre_code]:whitespace-pre [&_pre_code]:before:content-[''] [&_pre_code]:after:content-['']"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderRich(question.answer)) }}
                                              />
                                            </section>

                                            {/* Reference */}
                                            {question.reference_link && (
                                              <section className="rounded-xl border border-slate-200/70 bg-white p-3.5">
                                                <div className="mb-2 flex items-center gap-2">
                                                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-600">
                                                    <Link className="h-3.5 w-3.5" />
                                                  </span>
                                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reference</span>
                                                </div>
                                                <a
                                                  href={question.reference_link}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="group/ref flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-brand-violet transition-colors hover:border-brand-violet/40 hover:bg-violet-50"
                                                >
                                                  <Link className="h-3.5 w-3.5 shrink-0" />
                                                  <span className="truncate">{question.reference_link}</span>
                                                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/ref:translate-x-0.5" />
                                                </a>
                                              </section>
                                            )}

                                            {/* Task */}
                                            {question.task_description && (
                                              <section className="overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/50">
                                                <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-100/50 px-3.5 py-2">
                                                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white">
                                                    <FileText className="h-3.5 w-3.5" />
                                                  </span>
                                                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Task</span>
                                                </div>
                                                <div
                                                  className="prose prose-sm max-w-none px-3.5 py-3 leading-relaxed text-slate-700 prose-strong:text-slate-800 prose-a:font-medium prose-a:text-amber-700 prose-p:my-1.5 prose-li:my-0.5"
                                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderRich(question.task_description)) }}
                                                />
                                              </section>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 ring-1 ring-violet-100">
                      <FileText className="h-7 w-7 text-brand-violet" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {searchTerm || difficultyFilter !== "all" || moduleLevelFilter !== "all"
                        ? "No questions match your filters"
                        : "No questions yet"}
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      {searchTerm || difficultyFilter !== "all" || moduleLevelFilter !== "all"
                        ? "Try adjusting your search or clearing the filters."
                        : `Start building the question bank for ${technologyName}.`}
                    </p>
                    {searchTerm || difficultyFilter !== "all" || moduleLevelFilter !== "all" ? (
                      <button
                        onClick={() => {
                          setSearchTerm("");
                          setDifficultyFilter("all");
                          setModuleLevelFilter("all");
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition-all hover:border-brand-violet/40 hover:text-brand-violet"
                      >
                        Clear filters
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAddQuestionForm(true);
                          setEditingQuestionId(null);
                          setQuestionFormData({
                            question: "",
                            answer: "",
                            difficulty: "Medium",
                            module_level: "basic",
                            reference_link: "",
                            task_description: "",
                          });
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ff5a1f]"
                      >
                        <Plus className="h-4 w-4" />
                        Add first question
                      </button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>


          {/* Add/Edit Question Form */}
          {showAddQuestionForm && (
            <Card className="lg:col-span-1 h-fit sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-800 text-base font-semibold">
                  {editingQuestionId ? "Edit Question" : "Add New Question"}
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs">
                  {editingQuestionId
                    ? "Update question details"
                    : `Add to ${technologyName}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={handleAddQuestion} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Level *</label>
                      <Dropdown
                        value={questionFormData.module_level}
                        onChange={(value) => setQuestionFormData({
                          ...questionFormData,
                          module_level: value as "beginner" | "basic" | "intermediate" | "advanced"
                        })}
                        options={MODULE_LEVEL_CHOICES as DropdownOption<string>[]}
                        buttonClassName="py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Difficulty *</label>
                      <Dropdown
                        value={questionFormData.difficulty}
                        onChange={(value) => setQuestionFormData({ ...questionFormData, difficulty: value as "Easy" | "Medium" | "Hard" })}
                        options={DIFFICULTY_FORM_OPTIONS}
                        buttonClassName="py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Question *</label>
                    <textarea
                      placeholder="Enter your question..."
                      value={questionFormData.question}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, question: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm min-h-[80px] resize-vertical"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Answer *</label>
                    <textarea
                      placeholder={"Write the answer. You can use simple formatting:\n## Heading\n- bullet point\n**bold**  `inline code`\n```\ncode block\n```\n> tip / note"}
                      value={questionFormData.answer}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, answer: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm font-mono min-h-[120px] resize-vertical"
                    />
                    <p className="text-[11px] text-slate-400">
                      Formatting: <code className="rounded bg-slate-100 px-1">## heading</code>,{" "}
                      <code className="rounded bg-slate-100 px-1">- list</code>,{" "}
                      <code className="rounded bg-slate-100 px-1">**bold**</code>,{" "}
                      <code className="rounded bg-slate-100 px-1">`code`</code>, and{" "}
                      <code className="rounded bg-slate-100 px-1">```code block```</code>.
                    </p>
                    {questionFormData.answer.trim() && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60">
                        <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Live preview
                        </div>
                        <div
                          className="prose prose-sm max-w-none px-3 py-2.5 leading-relaxed text-slate-700 prose-headings:text-slate-800 prose-headings:text-sm prose-strong:text-slate-800 prose-a:text-brand-violet prose-code:rounded prose-code:bg-violet-50 prose-code:px-1 prose-code:text-brand-violet prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-p:my-1.5 prose-li:my-0.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100 [&_pre_code]:text-[12px] [&_pre_code]:before:content-[''] [&_pre_code]:after:content-['']"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderRich(questionFormData.answer)) }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Reference Link</label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={questionFormData.reference_link}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, reference_link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">Task Description</label>
                    <textarea
                      placeholder="Optional task description..."
                      value={questionFormData.task_description}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, task_description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm min-h-[60px] resize-vertical"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 text-sm font-medium"
                      disabled={isSubmitting}
                    >
                      <Save className="w-4 h-4" />
                      {isSubmitting
                        ? (editingQuestionId ? "Updating..." : "Creating...")
                        : (editingQuestionId ? "Update Question" : "Create Question")}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-all duration-200 text-slate-700 text-sm font-medium"
                      onClick={() => {
                        setShowAddQuestionForm(false);
                        setEditingQuestionId(null);
                        setQuestionFormData({
                          question: "",
                          answer: "",
                          difficulty: "Medium",
                          module_level: "basic",
                          reference_link: "",
                          task_description: "",
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Candidates Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6"
            onClick={handleCloseModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              className="mt-6 flex max-h-[86vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.5)] ring-1 ring-black/5"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ================= Header ================= */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/70 to-transparent px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                      modalType === "completed"
                        ? "from-emerald-500 to-green-600"
                        : modalType === "inProgress"
                          ? "from-amber-500 to-orange-500"
                          : "from-brand-purple to-brand-violet"
                    )}
                  >
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-800">{modalTitle}</h2>
                      {!loadingCandidates && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {candidates.length}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {modalType === "all"
                        ? "All candidates assigned to this technology"
                        : modalType === "completed"
                          ? "Candidates who completed this technology"
                          : "Candidates with in-progress assignments"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ================= Content ================= */}
              <TooltipProvider delayDuration={150}>
                <div className="flex-1 overflow-y-auto">
                  {loadingCandidates ? (
                    <div className="space-y-2.5 p-5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-100" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                            <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                          </div>
                          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 ring-1 ring-violet-100">
                        <Users className="h-7 w-7 text-brand-violet" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">No candidates found</p>
                      <p className="mt-1 text-xs text-slate-500">No one matches this view yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Candidate</th>
                          <th className="px-4 py-3">Stage</th>
                          <th className="min-w-[150px] px-4 py-3">Progress</th>
                          <th className="px-4 py-3">Deadline</th>
                          {modalType === "all" && <th className="px-5 py-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {candidates.map((candidate) => {
                          const assignment = candidate.learning_assignments.find(
                            (a) => a.technology_id === technologyId
                          );
                          const progress = Math.round(assignment?.progress || 0);
                          const status = getAssignmentStatus(progress);
                          const stage = STAGE_META[status] || STAGE_META.assigned;
                          const dl = deadlineInfo(assignment?.due_at, progress);
                          return (
                            <tr
                              key={candidate.id}
                              onClick={() => navigate(`/admin/learner/${candidate.id}`)}
                              className="cursor-pointer transition-colors hover:bg-violet-50/40"
                            >
                              {/* Candidate */}
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold text-white">
                                    {candidate.first_name?.charAt(0)}{candidate.last_name?.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-800">
                                      {candidate.first_name} {candidate.last_name}
                                    </div>
                                    <div className="max-w-[220px] truncate text-[10px] text-slate-500">{candidate.email}</div>
                                  </div>
                                </div>
                              </td>
                              {/* Stage */}
                              <td className="px-4 py-3">
                                {assignment ? (
                                  <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", stage.badge)}>
                                    <stage.Icon className={cn("h-3 w-3", stage.iconColor)} />
                                    {stage.label}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Not assigned</span>
                                )}
                              </td>
                              {/* Progress */}
                              <td className="px-4 py-3">
                                {assignment ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                      <div className={cn("h-full rounded-full", getProgressColor(progress))} style={{ width: `${progress}%` }} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700">{progress}%</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              {/* Deadline */}
                              <td className="px-4 py-3">
                                {assignment ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", DEADLINE_TONE[dl.tone])}>
                                        <dl.Icon className="h-3.5 w-3.5" />
                                        {dl.label}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="space-y-0.5 text-xs">
                                        <div>Assigned: {assignment.assigned_at ? formatSimpleDate(assignment.assigned_at) : "—"}</div>
                                        <div>Due: {assignment.due_at ? formatSimpleDate(assignment.due_at) : "No deadline"}</div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              {/* Actions */}
                              {modalType === "all" && (
                                <td className="px-5 py-3 text-right">
                                  {assignment && assignment.progress < 100 && (
                                    <div className="flex items-center justify-end gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSendReminder(candidate); }}
                                            className="rounded-lg border border-slate-200 p-1.5 text-brand-violet transition-colors hover:bg-violet-50"
                                          >
                                            <Mail className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Send a reminder email</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (window.confirm('Are you sure you want to unassign this candidate from the technology?')) { handleUnassignCandidate(candidate); } }}
                                            className="rounded-lg border border-slate-200 p-1.5 text-red-600 transition-colors hover:bg-red-50"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Remove from this course</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </TooltipProvider>

              {/* ================= Footer ================= */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <span className="text-xs text-slate-500">
                  {loadingCandidates ? "Loading…" : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`}
                </span>
                <button
                  onClick={handleCloseModal}
                  className="rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ff5a1f]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionManagement;

