const form = document.getElementById('waitlistForm');
const message = document.getElementById('formMessage');
const revealItems = document.querySelectorAll('.reveal');
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const setMessage = (text, type) => {
  message.textContent = text;
  message.className = `form-message ${type}`;
};

const validate = (name, email) => {
  if (name.trim().length < 2) {
    return 'Digite um nome válido.';
  }

  if (!emailRegex.test(email.trim())) {
    return 'Digite um e-mail válido.';
  }

  return '';
};

const persistFallback = ({ name, email }) => {
  const current = JSON.parse(localStorage.getItem('nortelabs_waitlist') || '[]');
  const exists = current.some((entry) => entry.email === email.toLowerCase());

  if (exists) {
    throw new Error('Este e-mail já está na lista.');
  }

  current.push({
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    createdAt: new Date().toISOString(),
    source: 'localStorage'
  });

  localStorage.setItem('nortelabs_waitlist', JSON.stringify(current));
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();

  const validationError = validate(name, email);
  if (validationError) {
    setMessage(validationError, 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Enviando...';
  setMessage('', '');

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || 'Não foi possível concluir o cadastro.');
    }

    setMessage(payload.message, 'success');
    form.reset();
  } catch (error) {
    try {
      persistFallback({ name, email });
      setMessage('Você entrou para a lista! Em breve entraremos em contato.', 'success');
      form.reset();
    } catch (fallbackError) {
      setMessage(fallbackError.message || error.message, 'error');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Garantir minha vaga';
  }
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  },
  { threshold: 0.2 }
);

revealItems.forEach((item) => observer.observe(item));

const particles = [];
const particleCount = 54;
const maxDistance = 140;

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const createParticle = () => ({
  x: randomBetween(0, canvas.width),
  y: randomBetween(0, canvas.height),
  vx: randomBetween(-0.28, 0.28),
  vy: randomBetween(-0.28, 0.28),
  radius: randomBetween(1, 2.8)
});

const initParticles = () => {
  particles.length = 0;
  for (let i = 0; i < particleCount; i += 1) {
    particles.push(createParticle());
  }
};

const draw = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((particle, index) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x <= 0 || particle.x >= canvas.width) particle.vx *= -1;
    if (particle.y <= 0 || particle.y >= canvas.height) particle.vy *= -1;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = index % 2 === 0 ? 'rgba(0, 229, 255, 0.9)' : 'rgba(155, 89, 182, 0.88)';
    ctx.fill();

    for (let next = index + 1; next < particles.length; next += 1) {
      const other = particles[next];
      const dx = particle.x - other.x;
      const dy = particle.y - other.y;
      const distance = Math.hypot(dx, dy);

      if (distance < maxDistance) {
        const alpha = 1 - distance / maxDistance;
        const gradient = ctx.createLinearGradient(particle.x, particle.y, other.x, other.y);
        gradient.addColorStop(0, `rgba(0, 229, 255, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(155, 89, 182, ${alpha * 0.45})`);
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(other.x, other.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  window.requestAnimationFrame(draw);
};

resizeCanvas();
initParticles();
draw();

window.addEventListener('resize', () => {
  resizeCanvas();
  initParticles();
});
