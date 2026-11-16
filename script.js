"use strict";

/* ==========================================================
   Helpers
   ========================================================== */

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// localStorage ko safe tareeqe se use karne ke liye
const store = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            /* storage blocked ho to ignore */
        }
    }
};

// Function ko baar baar chalne se rokta hai (search ke liye)
function debounce(fn, wait = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}


/* ==========================================================
   1. Dark / Light Theme
   ========================================================== */

function initTheme() {
    const root = document.documentElement;
    const button = $("#themeBtn");

    function apply(theme) {
        root.dataset.theme = theme;
        button.textContent = theme === "dark" ? "☀️" : "🌙";
        button.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    apply(root.dataset.theme || "light");

    button.addEventListener("click", function () {
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        apply(next);
        store.set("theme", next);
    });
}


/* ==========================================================
   2. Scroll Progress Bar + Back to Top
   ========================================================== */

function initScroll() {
    const bar = $("#progress");
    const topBtn = $("#topBtn");
    let ticking = false;

    function update() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? window.scrollY / max : 0;

        bar.style.transform = "scaleX(" + progress + ")";
        topBtn.classList.toggle("show", window.scrollY > 300);
        ticking = false;
    }

    window.addEventListener("scroll", function () {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });

    window.addEventListener("resize", update);

    topBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });

    update();
}


/* ==========================================================
   3. Active Navigation Link (scroll ke hisab se)
   ========================================================== */

function initActiveNav() {
    if (!("IntersectionObserver" in window)) return;

    const links = $$("nav ul a");
    const byId = new Map(links.map(link => [link.getAttribute("href").slice(1), link]));

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;

            links.forEach(link => {
                link.classList.remove("active");
                link.removeAttribute("aria-current");
            });

            const active = byId.get(entry.target.id);
            if (active) {
                active.classList.add("active");
                active.setAttribute("aria-current", "true");
            }
        });
    }, { rootMargin: "-30% 0px -60% 0px" });

    byId.forEach(function (link, id) {
        const section = document.getElementById(id);
        if (section) observer.observe(section);
    });
}


/* ==========================================================
   4. Reveal Animation (scroll par cards smoothly aate hain)
   ========================================================== */

function initReveal() {
    const items = $$(".reveal");

    if (!("IntersectionObserver" in window)) {
        items.forEach(item => item.classList.add("in"));
        return;
    }

    const observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    items.forEach(item => observer.observe(item));
}


/* ==========================================================
   5. Typing Effect
   ========================================================== */

function initTyping() {
    const element = $("#typed");
    const phrases = [
        "Web Developer in the making",
        "HTML • CSS • JavaScript",
        "Learning something new every day"
    ];

    if (reduceMotion) {
        element.textContent = phrases[0];
        return;
    }

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function tick() {
        const phrase = phrases[phraseIndex];
        charIndex += deleting ? -1 : 1;
        element.textContent = phrase.slice(0, charIndex);

        let delay = deleting ? 40 : 80;

        if (!deleting && charIndex === phrase.length) {
            deleting = true;
            delay = 1500;
        } else if (deleting && charIndex === 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            delay = 300;
        }

        setTimeout(tick, delay);
    }

    tick();
}


/* ==========================================================
   6. Stats Counter (tasks khud count karta hai)
   ========================================================== */

function initStats() {
    const counts = {
        html: $$("#html li a").length,
        css: $$("#css li a").length,
        javascript: $$("#javascript li a").length
    };
    counts.total = counts.html + counts.css + counts.javascript;

    function animate(element, target) {
        if (reduceMotion || target === 0) {
            element.textContent = target;
            return;
        }

        const duration = 900;
        const start = performance.now();

        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            element.textContent = Math.round(target * eased);
            if (t < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    function run() {
        $$("[data-stat]").forEach(function (element) {
            animate(element, counts[element.dataset.stat] || 0);
        });
    }

    const stats = $("#stats");

    if (!("IntersectionObserver" in window)) {
        run();
        return;
    }

    const observer = new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) {
            run();
            obs.disconnect();
        }
    }, { threshold: 0.4 });

    observer.observe(stats);
}


/* ==========================================================
   7. Live Search (/ dabao to search focus hota hai)
   ========================================================== */

function initSearch() {
    const input = $("#search");
    const clearBtn = $("#clearSearch");
    const emptyMessage = $("#noResults");
    const cards = $$("[data-tasks]");

    function run() {
        const query = input.value.trim().toLowerCase();
        let totalShown = 0;

        cards.forEach(function (card) {
            const items = $$("li", card);
            let shown = 0;

            items.forEach(function (item) {
                const match = item.textContent.toLowerCase().includes(query);
                item.hidden = !match;
                if (match) shown++;
            });

            card.hidden = shown === 0;
            totalShown += shown;

            const badge = $("[data-badge]", card);
            if (badge) {
                badge.textContent = query ? shown + "/" + items.length : items.length;
            }
        });

        emptyMessage.hidden = totalShown !== 0;
        clearBtn.hidden = query === "";
    }

    input.addEventListener("input", debounce(run, 120));

    clearBtn.addEventListener("click", function () {
        input.value = "";
        run();
        input.focus();
    });

    document.addEventListener("keydown", function (event) {
        const tag = document.activeElement ? document.activeElement.tagName : "";
        const typing = tag === "INPUT" || tag === "TEXTAREA";

        if (event.key === "/" && !typing) {
            event.preventDefault();
            input.focus();
        }

        if (event.key === "Escape" && document.activeElement === input) {
            input.value = "";
            run();
            input.blur();
        }
    });

    run();
}


/* ==========================================================
   8. Opened Tasks Tracker (localStorage mein save hota hai)
   ========================================================== */

function initVisited() {
    const KEY = "visitedTasks";
    const links = $$("[data-track] li a");
    const fill = $("#visitedFill");
    const text = $("#visitedText");
    const bar = $("#visitedBar");
    let visited = new Set(store.get(KEY, []));

    function render() {
        let opened = 0;

        links.forEach(function (link) {
            const isVisited = visited.has(link.getAttribute("href"));
            link.classList.toggle("is-visited", isVisited);
            if (isVisited) opened++;
        });

        const percent = links.length ? Math.round((opened / links.length) * 100) : 0;
        fill.style.width = percent + "%";
        bar.setAttribute("aria-valuenow", percent);
        text.textContent = "Opened " + opened + " of " + links.length + " tasks (" + percent + "%)";
    }

    function remember(link) {
        visited.add(link.getAttribute("href"));
        store.set(KEY, [...visited]);
    }

    links.forEach(function (link) {
        link.addEventListener("click", () => remember(link));
        link.addEventListener("auxclick", () => remember(link)); // middle click
    });

    $("#resetVisited").addEventListener("click", function () {
        visited.clear();
        store.set(KEY, []);
        render();
    });

    // Back button dabane par bhi tick sahi dikhe
    window.addEventListener("pageshow", function () {
        visited = new Set(store.get(KEY, []));
        render();
    });

    render();
}


/* ==========================================================
   9. Footer Year
   ========================================================== */

function initYear() {
    $("#year").textContent = new Date().getFullYear();
}


/* ==========================================================
   Start
   ========================================================== */

initTheme();
initScroll();
initActiveNav();
initReveal();
initTyping();
initStats();
initSearch();
initVisited();
initYear();
