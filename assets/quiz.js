/* CCAR-F quiz component.
 *
 * Markup:
 *   <section class="quiz" data-quiz="0001-agentic-loop" data-title="Scenario check">
 *     <div class="item" data-ts="1.1">              <!-- task statement tag -->
 *       <div class="stem">Question text…</div>
 *       <ol class="opts">
 *         <li>Option</li>
 *         <li data-correct>Option</li>
 *       </ol>
 *       <div class="explain">Why…</div>
 *     </div>
 *   </section>
 *
 * Items with more than one data-correct become multi-response ("Select 2"),
 * as on the real exam. Results persist per viewer in localStorage (best-effort)
 * and a copyable summary line is shown so the learner can paste it to the tutor.
 *
 * Live variants: when the page is served by `npm run quiz` (lab/quiz/server.ts), a missed item
 * offers "Try a new question on this topic". The server writes a fresh item on the same concept
 * with `claude -p`. Variants don't change the main score; they get their own tally in the summary.
 * Opened as a plain file, the quiz works exactly as before, without the button.
 */
(function () {
  const LETTERS = "ABCDEFGH";

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) { return null; }
  }

  // Is the variant server behind this page? Checked once per page.
  const live = location.protocol.startsWith("http")
    ? fetch("/api/health").then(r => r.ok).catch(() => false)
    : Promise.resolve(false);

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rich = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

  /* Wire one .item: option clicks, multi-select, marking, explanation.
   * opts: { label, restore (array of picked indices) | null, onAnswer(picked, ok) } */
  function wire(item, { label, restore, onAnswer }) {
    const opts = Array.from(item.querySelectorAll(".opts > li"));
    const correct = opts.map((o, i) => (o.hasAttribute("data-correct") ? i : -1)).filter(i => i >= 0);
    const multi = correct.length > 1;
    const explain = item.querySelector(".explain");
    const selected = new Set();

    const num = document.createElement("div");
    num.className = "item-num";
    num.textContent = label + (multi ? " · Select " + correct.length : "");
    item.prepend(num);

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const check = document.createElement("button");
    check.textContent = "Check answer";
    check.disabled = true;
    check.addEventListener("click", () => submit(false));
    if (multi) actions.appendChild(check);
    item.querySelector(".opts").after(actions);

    opts.forEach((o, i) => {
      o.dataset.letter = LETTERS[i];
      o.tabIndex = 0;
      o.setAttribute("role", "button");
      const choose = () => {
        if (item.classList.contains("done")) return;
        if (!multi) { selected.clear(); selected.add(i); submit(false); return; }
        selected.has(i) ? selected.delete(i) : selected.add(i);
        o.classList.toggle("picked", selected.has(i));
        check.disabled = selected.size !== correct.length;
      };
      o.addEventListener("click", choose);
      o.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    });

    function submit(restoring) {
      item.classList.add("done");
      check.remove();
      const ok = correct.length === selected.size && correct.every(c => selected.has(c));
      opts.forEach((o, i) => {
        o.classList.remove("picked");
        if (correct.includes(i)) o.classList.add("right");
        else if (selected.has(i)) o.classList.add("wrong");
      });
      item.classList.add(ok ? "item-ok" : "item-bad");
      const verdict = document.createElement("div");
      verdict.className = "verdict";
      verdict.textContent = ok ? "Correct" : "Not quite. Correct: " + correct.map(c => LETTERS[c]).join(", ");
      actions.appendChild(verdict);
      if (explain) explain.classList.add("show");
      onAnswer(Array.from(selected), ok, restoring, actions);
    }

    if (restore) { restore.forEach(p => selected.add(p)); submit(true); }
  }

  // Plain-text snapshot of an item, sent to the variant generator.
  function snapshot(item) {
    const lis = Array.from(item.querySelectorAll(".opts > li"));
    return {
      ts: item.dataset.ts || "",
      stem: item.querySelector(".stem").textContent.trim(),
      options: lis.map(li => li.textContent.trim()),
      correct: lis.map((li, i) => (li.hasAttribute("data-correct") ? i : -1)).filter(i => i >= 0),
      explain: Array.from((item.querySelector(".explain") || document.createElement("div")).childNodes)
        .filter(n => !(n.classList && n.classList.contains("variant-note"))).map(n => n.textContent).join("").trim(),
    };
  }

  function buildItem(v) {
    const el = document.createElement("div");
    el.className = "item variant";
    el.dataset.ts = v.ts;
    el.innerHTML = `<div class="stem">${rich(v.stem)}</div><ol class="opts">${v.options
      .map((o, i) => `<li${v.correct.includes(i) ? " data-correct" : ""}>${rich(o)}</li>`).join("")}</ol>` +
      `<div class="explain">${rich(v.explain)}<span class="variant-note">Generated by Claude for practice on: ${esc(v.concept || v.ts)}. Not reviewed. If it looks wrong, ask your tutor.</span></div>`;
    return el;
  }

  function initQuiz(quiz) {
    const id = quiz.dataset.quiz || "quiz";
    const key = "ccarf:quiz:" + id;
    const vkey = "ccarf:variants:" + id;
    const saved = store(key) || {};
    const variants = store(vkey) || []; // [{ parent, v, picked, ok }]
    const items = Array.from(quiz.querySelectorAll(".item"));

    const summary = document.createElement("div");
    summary.className = "quiz-summary";
    quiz.appendChild(summary);

    // Offer a new question on the same topic, after a wrong answer, when the server is up.
    function offerVariant(actions, parentIdx, sourceEl) {
      live.then(ok => {
        if (!ok) return;
        const btn = document.createElement("button");
        btn.className = "variant-btn";
        btn.textContent = "Try a new question on this topic";
        btn.addEventListener("click", async () => {
          // Build from the question just missed (the original, or the last generated one).
          const from = sourceEl || items[parentIdx];
          const src = snapshot(from);
          const picked = Array.from(from.querySelectorAll(".opts > li")).map((li, i) => (li.classList.contains("wrong") ? i : -1)).filter(i => i >= 0);
          btn.disabled = true;
          btn.textContent = "Writing a new question… (about 20–40 s)";
          try {
            const r = await fetch("/api/variant", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ quiz: id, ...src, picked: picked.length ? picked : [], avoid: variants.filter(x => x.parent === parentIdx).map(x => x.v.stem) }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || r.statusText);
            btn.remove();
            const entry = { parent: parentIdx, v: data, picked: null, ok: null };
            variants.push(entry);
            store(vkey, variants);
            mount(entry, true);
          } catch (e) {
            btn.disabled = false;
            btn.textContent = "Couldn't generate (" + String(e.message || e).slice(0, 80) + "). Try again";
          }
        });
        actions.appendChild(btn);
      });
    }

    // Insert a variant after its parent (and after any earlier variants of it).
    function mount(entry, scroll) {
      const el = buildItem(entry.v);
      const siblings = Array.from(quiz.querySelectorAll(`.item.variant[data-parent="${entry.parent}"]`));
      el.dataset.parent = entry.parent;
      (siblings.at(-1) || items[entry.parent]).after(el);
      const n = variants.filter(x => x.parent === entry.parent).indexOf(entry) + 1;
      wire(el, {
        label: `Q${entry.parent + 1} · ${entry.v.ts} · new question ${n}`,
        restore: entry.picked,
        onAnswer(picked, ok, restoring, actions) {
          if (!restoring) { entry.picked = picked; entry.ok = ok; store(vkey, variants); }
          if (!ok) offerVariant(actions, entry.parent, el);
          render();
        },
      });
      if (scroll) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    items.forEach((item, qi) => {
      wire(item, {
        label: "Q" + (qi + 1) + (item.dataset.ts ? " · " + item.dataset.ts : ""),
        restore: saved[qi] ? saved[qi].picked : null,
        onAnswer(picked, ok, restoring, actions) {
          if (!restoring) { saved[qi] = { picked, ok }; store(key, saved); }
          const last = variants.filter(x => x.parent === qi).at(-1);
          if (!ok && (!last || last.ok === false)) offerVariant(actions, qi);
          render();
        },
      });
    });
    variants.forEach(e => mount(e, false));
    // Only the newest variant of a chain keeps the button; drop buttons on items that already have an unanswered/answered follow-up.
    live.then(() => items.forEach((_, qi) => {
      const chain = variants.filter(x => x.parent === qi);
      if (!chain.length) return;
      const holders = [items[qi], ...Array.from(quiz.querySelectorAll(`.item.variant[data-parent="${qi}"]`))];
      holders.slice(0, -1).forEach(h => h.querySelectorAll(".variant-btn").forEach(b => b.remove()));
    }));

    function render() {
      const done = Object.keys(saved).length;
      const right = Object.values(saved).filter(s => s.ok).length;
      const missed = items
        .map((it, i) => (saved[i] && !saved[i].ok ? (it.dataset.ts || "Q" + (i + 1)) : null))
        .filter(Boolean);
      const vDone = variants.filter(x => x.ok !== null);
      const vRight = vDone.filter(x => x.ok).length;
      const vPart = vDone.length ? ` · new questions: ${vRight}/${vDone.length}` : "";
      const line = `[${id}] ${right}/${items.length}` + (missed.length ? ` · missed: ${missed.join(", ")}` : "") + vPart;
      summary.innerHTML = "";
      const p = document.createElement("p");
      p.innerHTML = `<b>${right} / ${items.length}</b> correct` +
        (vDone.length ? ` · new questions ${vRight} / ${vDone.length}` : "") +
        (done < items.length ? ` · ${items.length - done} unanswered` : "") +
        (done === items.length ? " · paste this to your tutor:" : "");
      summary.appendChild(p);
      if (done === items.length) {
        const code = document.createElement("code");
        code.textContent = line;
        summary.appendChild(code);
      }
      const reset = document.createElement("button");
      reset.textContent = "Reset quiz";
      reset.className = "linkish";
      reset.addEventListener("click", () => { store(key, {}); store(vkey, []); location.reload(); });
      summary.appendChild(reset);
    }
    render();
  }

  document.querySelectorAll(".quiz").forEach(initQuiz);
})();
