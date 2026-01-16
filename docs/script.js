const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
let width, height;
let points = [];
const spacing = 50;
const mouse = { x: -1000, y: -1000 };
let animationFrameId;
let isAnimating = false;

function init() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    points = [];

    if (width * height > 50000000) return;

    for (let x = 0; x < width + spacing; x += spacing) {
        for (let y = 0; y < height + spacing; y += spacing) {
            points.push({
                originX: x,
                originY: y,
                x: x,
                y: y
            });
        }
    }
}

window.addEventListener('resize', init);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function checkAnimationStatus() {
    const shouldAnimate = window.scrollY < window.innerHeight + 100;

    if (shouldAnimate && !isAnimating) {
        isAnimating = true;
        animate();
    } else if (!shouldAnimate && isAnimating) {
        isAnimating = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, width, height);
    }
}

window.addEventListener('scroll', checkAnimationStatus, { passive: true });

function animate() {
    if (!isAnimating) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = window.dotColor || 'rgba(100, 181, 246, 0.36)';
    ctx.beginPath();

    const maxDist = 300;
    const maxDistSq = maxDist * maxDist;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            const force = (maxDist - dist) / maxDist;
            const angle = Math.atan2(dy, dx);
            const move = force * 60;
            p.x = p.originX - Math.cos(angle) * move;
            p.y = p.originY - Math.sin(angle) * move;
        } else {
            const k = 0.1;
            const diffX = p.originX - p.x;
            const diffY = p.originY - p.y;

            if (Math.abs(diffX) < 0.1 && Math.abs(diffY) < 0.1) {
                p.x = p.originX;
                p.y = p.originY;
            } else {
                p.x += diffX * k;
                p.y += diffY * k;
            }
        }

        ctx.moveTo(p.x + 2, p.y);
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    }

    ctx.fill();
    animationFrameId = requestAnimationFrame(animate);
}

init();
checkAnimationStatus();
if (window.scrollY < window.innerHeight + 100) {
    isAnimating = true;
    animate();
}

const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

fetch('https://api.github.com/repos/QuangquyNguyenvo/Sameko-Dev-CPP/releases')
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            const latest = data[0];
            const btn = document.getElementById('download-btn');
            if (btn) btn.href = latest.html_url;
        }
    })
    .catch(e => console.log('GitHub API warning: ', e));

const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const bars = entry.target.querySelectorAll('.bar-value');
            bars.forEach((bar, index) => {
                setTimeout(() => bar.classList.add('animate'), index * 100);
            });
            barObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const benchmarkCard = document.getElementById('benchmark-card');
if (benchmarkCard) barObserver.observe(benchmarkCard);

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

// Get stored theme or detect system preference
function getPreferredTheme() {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
        return storedTheme;
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);

    // Update canvas dot color based on theme
    updateCanvasColor(theme);
}

// Update canvas animation color based on theme
function updateCanvasColor(theme) {
    const isDark = theme === 'dark';
    // The animate function will use this color
    window.dotColor = isDark ? 'rgba(100, 181, 246, 0.5)' : 'rgba(100, 181, 246, 0.36)';
}

// Toggle theme
function toggleTheme() {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Initialize theme
applyTheme(getPreferredTheme());

// Add click listener
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only apply if no stored preference
    if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});

// ===== SCROLL TO TOP =====
const scrollTopBtn = document.getElementById('scroll-top');

// Generic Smooth Scroll Function
function smoothScrollTo(targetY, duration = 1000) {
    const startY = window.scrollY;
    // Handle document height limit
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const effectiveTargetY = Math.min(targetY, maxScroll);

    const diff = effectiveTargetY - startY;

    // If distance is 0, don't animate
    if (diff === 0) return;

    const startTime = performance.now();

    function scrollStep(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        window.scrollTo(0, startY + diff * ease);

        if (progress < 1) {
            requestAnimationFrame(scrollStep);
        }
    }

    requestAnimationFrame(scrollStep);
}

function checkScrollTop() {
    if (window.scrollY > 300) {
        scrollTopBtn.classList.add('visible');
    } else {
        scrollTopBtn.classList.remove('visible');
    }
}

function scrollToTop() {
    smoothScrollTo(0);
}

// Bind smooth scroll to nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        // Only trigger for links on the same page
        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            e.preventDefault();
            // Account for sticky header height (approx 80px)
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            smoothScrollTo(offsetPosition);

            // Optional: Update URL without jumping
            history.pushState(null, null, '#' + targetId);
        }
    });
});

if (scrollTopBtn) {
    window.addEventListener('scroll', checkScrollTop, { passive: true });
    scrollTopBtn.addEventListener('click', scrollToTop);
    // Initial check
    checkScrollTop();
}
