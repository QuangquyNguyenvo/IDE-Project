// === CANVAS GRID LOGIC ===
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

    // Only create points if screen size is reasonable to avoid crash on massive virtual screens
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

// Optimization: Stop loop when not visible
function checkAnimationStatus() {
    const shouldAnimate = window.scrollY < window.innerHeight + 100;

    if (shouldAnimate && !isAnimating) {
        isAnimating = true;
        animate();
    } else if (!shouldAnimate && isAnimating) {
        isAnimating = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        // CRITICAL FIX: Clear the canvas so dots don't freeze on screen
        ctx.clearRect(0, 0, width, height);
    }
}

window.addEventListener('scroll', checkAnimationStatus, { passive: true });

function animate() {
    if (!isAnimating) return;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(100, 181, 246, 0.36)';
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

// Start
init();
// Initial check to handle refresh at bottom of page
checkAnimationStatus();
// Only start strictly if needed (checkAnimationStatus handles it), 
// but to be safe for Hero view:
if (window.scrollY < window.innerHeight + 100) {
    isAnimating = true;
    animate();
}


// === SCROLL REVEAL LOGIC ===
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


// === AUTO-DOWNLOAD LINK ===
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
