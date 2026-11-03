document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector(".mobile-menu-button");
  const nav = document.querySelector(".nav-links");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }));
  }
  document.querySelectorAll("[data-year]").forEach(node => node.textContent = new Date().getFullYear());
  document.querySelectorAll("[data-dismiss]").forEach(button => button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.dismiss);
    if (target) target.hidden = true;
  }));
  document.querySelectorAll("[data-reveal]").forEach(node => {
    if (!("IntersectionObserver" in window)) { node.classList.add("is-visible"); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    observer.observe(node);
  });
});
