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
 */
(function () {
  const LETTERS = "ABCDEFGH";

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) { return null; }
  }

  function initQuiz(quiz) {
    const id = quiz.dataset.quiz || "quiz";
    const key = "ccarf:quiz:" + id;
    const saved = store(key) || {};
    const items = Array.from(quiz.querySelectorAll(".item"));

    const summary = document.createElement("div");
    summary.className = "quiz-summary";
    quiz.appendChild(summary);

    items.forEach((item, qi) => {
      const opts = Array.from(item.querySelectorAll(".opts > li"));
      const correct = opts.map((o, i) => (o.hasAttribute("data-correct") ? i : -1)).filter(i => i >= 0);
      const multi = correct.length > 1;
      const explain = item.querySelector(".explain");
      const selected = new Set();

      const num = document.createElement("div");
      num.className = "item-num";
      num.textContent = "Q" + (qi + 1) + (item.dataset.ts ? " · " + item.dataset.ts : "") +
        (multi ? " · Select " + correct.length : "");
      item.prepend(num);

      opts.forEach((o, i) => {
        o.dataset.letter = LETTERS[i];
        o.tabIndex = 0;
        o.setAttribute("role", "button");
        const choose = () => {
          if (item.classList.contains("done")) return;
          if (!multi) { selected.clear(); selected.add(i); submit(); return; }
          selected.has(i) ? selected.delete(i) : selected.add(i);
          o.classList.toggle("picked", selected.has(i));
          check.disabled = selected.size !== correct.length;
        };
        o.addEventListener("click", choose);
        o.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
      });

      const actions = document.createElement("div");
      actions.className = "quiz-actions";
      const check = document.createElement("button");
      check.textContent = "Check answer";
      check.disabled = true;
      check.addEventListener("click", submit);
      if (multi) actions.appendChild(check);
      item.querySelector(".opts").after(actions);

      function submit(_, restoring) {
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
        if (!restoring) {
          saved[qi] = { picked: Array.from(selected), ok };
          store(key, saved);
        }
        render();
      }

      if (saved[qi]) { saved[qi].picked.forEach(p => selected.add(p)); submit(null, true); }
    });

    function render() {
      const done = Object.keys(saved).length;
      const right = Object.values(saved).filter(s => s.ok).length;
      const missed = items
        .map((it, i) => (saved[i] && !saved[i].ok ? (it.dataset.ts || "Q" + (i + 1)) : null))
        .filter(Boolean);
      const line = `[${id}] ${right}/${items.length}` + (missed.length ? ` · missed: ${missed.join(", ")}` : "");
      summary.innerHTML = "";
      const p = document.createElement("p");
      p.innerHTML = `<b>${right} / ${items.length}</b> correct` +
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
      reset.addEventListener("click", () => { store(key, {}); location.reload(); });
      summary.appendChild(reset);
    }
    render();
  }

  document.querySelectorAll(".quiz").forEach(initQuiz);
})();
