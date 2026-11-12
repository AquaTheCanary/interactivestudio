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


// Persistent site-wide light/dark appearance control.
(function(){
  const key="is-theme";
  const saved=localStorage.getItem(key);
  const theme=saved==="light"?"light":"dark";
  document.documentElement.dataset.theme=theme;
  document.addEventListener("DOMContentLoaded",()=>{
    const footer=document.querySelector("footer");
    if(!footer||footer.querySelector("[data-theme-toggle]"))return;
    const button=document.createElement("button");
    button.type="button";button.dataset.themeToggle="";button.className="theme-toggle";
    const render=()=>{const light=document.documentElement.dataset.theme==="light";button.textContent=light?"☾ Dark mode":"☀ Light mode";button.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");};
    button.addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="light"?"dark":"light";document.documentElement.dataset.theme=next;localStorage.setItem(key,next);render();});
    render();
    const inner=footer.querySelector(".footer-inner")||footer;
    inner.append(button);
  });
})();
